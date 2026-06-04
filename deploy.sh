#!/bin/bash
#============================================================
#  E-Tomd 命运双盘 · Linux 一键部署脚本
#  用法: bash deploy.sh [命令]
#
#  命令:
#    install   首次部署: 检查环境 + 安装依赖 + 初始化 .env + 数据库迁移 + 构建 + 启动
#    build     重新构建前后端
#    start     启动服务
#    stop      停止服务
#    restart   重启服务
#    status    查看运行状态 + 健康检查
#    logs      查看实时日志 (Ctrl+C 退出)
#    migrate   执行数据库迁移
#    update    拉取最新代码 + 重新构建 + 重启 (git pull && build && restart)
#    setup-nginx 配置 Nginx 反向代理 + HTTPS 证书 (Let's Encrypt)
#
#  典型流程 (首次部署到服务器):
#    1. git clone https://github.com/luckycn9527/Tarot.git
#    2. cd Tarot
#    3. bash deploy.sh install
#    4. 按提示编辑 tarot-server/.env (数据库密码 / JWT 密钥 / DeepSeek Key)
#    5. bash deploy.sh install   # 再次运行完成构建启动；会询问域名并自动配 Nginx + HTTPS
#
#  仅配置域名访问 (应用已在跑):
#    bash deploy.sh setup-nginx tarot.zaopic.cn
#============================================================

set -e

# ===== 配置 =====
PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
FRONTEND_DIR="$PROJECT_ROOT/tarot-vue"
BACKEND_DIR="$PROJECT_ROOT/tarot-server"
PID_FILE="$BACKEND_DIR/.server.pid"
LOG_FILE="$BACKEND_DIR/server.log"
NODE_MIN_VERSION=18

# ===== 颜色 =====
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; }
info() { echo -e "${CYAN}[·]${NC} $1"; }

# ===== 前置检查 =====
check_node() {
  if ! command -v node &>/dev/null; then
    err "未找到 Node.js，请先安装 Node.js >= $NODE_MIN_VERSION"
    err "  Ubuntu/Debian: curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs"
    err "  CentOS/RHEL:   curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash - && sudo yum install -y nodejs"
    exit 1
  fi
  local ver
  ver=$(node -v | sed 's/v//' | cut -d. -f1)
  if [ "$ver" -lt "$NODE_MIN_VERSION" ]; then
    err "Node.js 版本过低 ($(node -v))，需要 >= $NODE_MIN_VERSION"
    exit 1
  fi
  log "Node.js $(node -v)"

  if ! command -v npm &>/dev/null; then
    err "未找到 npm，请检查 Node.js 安装"
    exit 1
  fi
}

# 生成随机密钥 (32 字节 hex)
gen_secret() {
  if command -v openssl &>/dev/null; then
    openssl rand -hex 32
  else
    head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n'
  fi
}

check_env() {
  if [ ! -f "$BACKEND_DIR/.env" ]; then
    warn "未找到 .env 文件，从模板创建并填充随机密钥..."
    cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"

    # 自动填充 JWT 密钥，省去手动生成
    local acc ref adm
    acc=$(gen_secret)
    ref=$(gen_secret)
    adm=$(gen_secret)
    sed -i "s|^JWT_ACCESS_SECRET=.*|JWT_ACCESS_SECRET=$acc|" "$BACKEND_DIR/.env"
    sed -i "s|^JWT_REFRESH_SECRET=.*|JWT_REFRESH_SECRET=$ref|" "$BACKEND_DIR/.env"
    # 生产建议：开启独立 admin 密钥
    if grep -q '^# ADMIN_JWT_SECRET=' "$BACKEND_DIR/.env"; then
      sed -i "s|^# ADMIN_JWT_SECRET=.*|ADMIN_JWT_SECRET=$adm|" "$BACKEND_DIR/.env"
    fi
    # 生产环境默认值
    sed -i "s|^NODE_ENV=.*|NODE_ENV=production|" "$BACKEND_DIR/.env"

    echo ""
    err "已生成 .env 模板 (JWT 密钥已自动填充)。请编辑以下必填项后重新运行 install:"
    err "  $BACKEND_DIR/.env"
    echo ""
    err "  - DB_PASSWORD     : MySQL 数据库密码"
    err "  - DEEPSEEK_API_KEY: DeepSeek API 密钥 (占卜 AI 解读必填)"
    err "  - CORS_ORIGIN     : 前端访问地址 (如 http://你的域名 或 http://服务器IP:5174)"
    echo ""
    warn "提示: 若前后端同端口部署 (默认)，CORS_ORIGIN 设为最终访问地址即可。"
    exit 1
  fi
  log ".env 配置文件已就绪"
}

# ===== 数据库迁移 =====
do_migrate() {
  info "执行数据库迁移 (Node.js，无需 mysql 命令行工具)..."
  cd "$BACKEND_DIR"
  npx tsx src/scripts/migrateAll.ts || {
    err "数据库迁移失败，请检查 .env 中的数据库连接配置"
    exit 1
  }
  log "数据库迁移完成"
}

# ===== 安装依赖 =====
do_install_deps() {
  info "安装后端依赖..."
  cd "$BACKEND_DIR"
  npm install --production=false
  log "后端依赖安装完成"

  info "安装前端依赖..."
  cd "$FRONTEND_DIR"
  npm install
  log "前端依赖安装完成"
}

# ===== 构建 =====
do_build() {
  info "构建后端 (TypeScript → dist/)..."
  cd "$BACKEND_DIR"
  npx tsc
  log "后端构建完成 → dist/"

  # SKIP_FRONTEND_BUILD=true 时跳过前端构建（dist/ 已随 git 分发）
  if [ "${SKIP_FRONTEND_BUILD:-false}" = "true" ]; then
    log "跳过前端构建 (dist/ 已随仓库预构建)"
  else
    info "构建前端 (Vite → dist/)..."
    cd "$FRONTEND_DIR"
    npm run build:prod
    log "前端构建完成 → dist/"
  fi

  # 确保 uploads 目录存在
  mkdir -p "$BACKEND_DIR/uploads/avatars" "$BACKEND_DIR/uploads/admin" "$BACKEND_DIR/uploads/card-backs"
}

# ===== 启动 =====
do_start() {
  if [ -f "$PID_FILE" ]; then
    local old_pid
    old_pid=$(cat "$PID_FILE")
    if kill -0 "$old_pid" 2>/dev/null; then
      warn "服务已在运行 (PID: $old_pid)，如需重启请用: bash deploy.sh restart"
      return
    fi
    rm -f "$PID_FILE"
  fi

  check_env

  if [ ! -d "$FRONTEND_DIR/dist" ]; then
    warn "前端未构建，先执行构建..."
    do_build
  fi
  if [ ! -f "$BACKEND_DIR/dist/index.js" ]; then
    warn "后端未编译，先执行构建..."
    do_build
  fi

  info "启动服务..."
  cd "$BACKEND_DIR"
  nohup node dist/index.js > "$LOG_FILE" 2>&1 &
  local pid=$!
  echo "$pid" > "$PID_FILE"

  sleep 3
  if kill -0 "$pid" 2>/dev/null; then
    local port
    port=$(grep -E '^PORT=' "$BACKEND_DIR/.env" | cut -d= -f2)
    port=${port:-5174}
    log "服务启动成功 (PID: $pid)"
    log "访问地址: http://localhost:$port"
    echo ""
    info "常用命令:"
    echo "  bash deploy.sh status   - 查看状态"
    echo "  bash deploy.sh logs     - 查看日志"
    echo "  bash deploy.sh restart  - 重启服务"
    echo "  bash deploy.sh stop     - 停止服务"
    echo "  bash deploy.sh update   - 更新代码并重启"
  else
    err "服务启动失败，最近日志:"
    tail -30 "$LOG_FILE"
    rm -f "$PID_FILE"
    exit 1
  fi
}

# ===== 停止 =====
do_stop() {
  if [ ! -f "$PID_FILE" ]; then
    warn "未找到 PID 文件，服务可能未运行"
    return
  fi
  local pid
  pid=$(cat "$PID_FILE")
  if kill -0 "$pid" 2>/dev/null; then
    kill "$pid"
    sleep 1
    if kill -0 "$pid" 2>/dev/null; then
      kill -9 "$pid"
    fi
    log "服务已停止 (PID: $pid)"
  else
    warn "进程 $pid 已不存在"
  fi
  rm -f "$PID_FILE"
}

# ===== 重启 =====
do_restart() {
  do_stop
  sleep 1
  do_start
}

# ===== 状态 =====
do_status() {
  if [ -f "$PID_FILE" ]; then
    local pid
    pid=$(cat "$PID_FILE")
    if kill -0 "$pid" 2>/dev/null; then
      log "服务运行中 (PID: $pid)"
      local port
      port=$(grep -E '^PORT=' "$BACKEND_DIR/.env" 2>/dev/null | cut -d= -f2)
      port=${port:-5174}
      if command -v curl &>/dev/null; then
        local health
        health=$(curl -s "http://localhost:$port/health" 2>/dev/null)
        if [ -n "$health" ]; then
          log "健康检查: $health"
        else
          warn "健康检查无响应 (端口 $port)"
        fi
      fi
      return
    fi
  fi
  warn "服务未运行"
}

# ===== 日志 =====
do_logs() {
  if [ ! -f "$LOG_FILE" ]; then
    warn "日志文件不存在"
    return
  fi
  tail -f "$LOG_FILE"
}

# ===== 更新 (拉取最新代码 + 重建 + 重启) =====
do_update() {
  info "拉取最新代码..."
  cd "$PROJECT_ROOT"
  if [ -d .git ]; then
    git pull
    log "代码已更新"
  else
    warn "非 git 仓库，跳过 git pull"
  fi
  do_install_deps
  do_build
  do_restart
}

# ===== Nginx 反向代理 + HTTPS（Let's Encrypt） =====
# 用法:
#   bash deploy.sh setup-nginx [域名]
# 也可用环境变量:
#   DOMAIN=tarot.zaopic.cn CERTBOT_EMAIL=you@mail.com bash deploy.sh setup-nginx
# CERTBOT_EMAIL 提供时自动签发证书；否则进入 certbot 交互式流程。
# SKIP_HTTPS=true 时只配 80 端口反代，不签证书。
do_setup_nginx() {
  # 需要 root；非 root 时尝试用 sudo
  local SUDO=""
  if [ "$(id -u)" -ne 0 ]; then
    if command -v sudo &>/dev/null; then
      SUDO="sudo"
    else
      err "需要 root 权限安装/配置 Nginx，请用 root 运行或安装 sudo"
      return 1
    fi
  fi

  # 1) 解析域名：参数 > DOMAIN 环境变量 > .env 的 APP_PUBLIC_ORIGIN > 交互输入
  local domain="${1:-${DOMAIN:-}}"
  if [ -z "$domain" ] && [ -f "$BACKEND_DIR/.env" ]; then
    domain=$(grep -E '^APP_PUBLIC_ORIGIN=' "$BACKEND_DIR/.env" | head -1 | cut -d= -f2- | sed -E 's#^https?://##; s#/.*$##')
  fi
  if [ -z "$domain" ]; then
    if [ -t 0 ]; then
      printf "请输入网站域名 (如 tarot.zaopic.cn，留空跳过 Nginx 配置): "
      read -r domain
    fi
  fi
  if [ -z "$domain" ]; then
    warn "未提供域名，跳过 Nginx 配置。可稍后运行: bash deploy.sh setup-nginx 你的域名"
    return 0
  fi

  # 2) 应用端口（默认 5174）
  local port
  port=$(grep -E '^PORT=' "$BACKEND_DIR/.env" 2>/dev/null | cut -d= -f2)
  port=${port:-5174}

  # 3) 安装 Nginx（按包管理器）
  if ! command -v nginx &>/dev/null; then
    info "安装 Nginx..."
    if command -v apt &>/dev/null; then
      $SUDO apt update && $SUDO apt install -y nginx
    elif command -v dnf &>/dev/null; then
      $SUDO dnf install -y nginx
    elif command -v yum &>/dev/null; then
      $SUDO yum install -y nginx
    else
      err "未识别的包管理器，请手动安装 Nginx 后重试"
      return 1
    fi
  fi
  $SUDO systemctl enable nginx 2>/dev/null || true

  # 4) 写入 vhost 配置
  local conf_dir="/etc/nginx/conf.d"
  $SUDO mkdir -p "$conf_dir"
  local conf_path="$conf_dir/tarot.conf"
  info "写入 Nginx 配置: $conf_path (域名: $domain → 127.0.0.1:$port)"
  $SUDO tee "$conf_path" >/dev/null <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $domain;

    client_max_body_size 10m;

    location / {
        proxy_pass http://127.0.0.1:$port;
        proxy_http_version 1.1;
        proxy_set_header Host              \$host;
        proxy_set_header X-Real-IP         \$remote_addr;
        proxy_set_header X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade           \$http_upgrade;
        proxy_set_header Connection        "upgrade";
        proxy_read_timeout 120s;
    }
}
EOF

  # Debian/Ubuntu 默认站点可能抢占，禁用之
  if [ -e /etc/nginx/sites-enabled/default ]; then
    $SUDO rm -f /etc/nginx/sites-enabled/default
  fi

  info "测试并重载 Nginx..."
  $SUDO nginx -t || { err "Nginx 配置测试失败"; return 1; }
  $SUDO systemctl reload nginx || $SUDO systemctl restart nginx
  log "Nginx 已生效: http://$domain"

  # 5) HTTPS 证书
  if [ "${SKIP_HTTPS:-false}" = "true" ]; then
    warn "SKIP_HTTPS=true，跳过证书签发（仅 HTTP）"
  else
    if ! command -v certbot &>/dev/null; then
      info "安装 certbot..."
      if command -v apt &>/dev/null; then
        $SUDO apt install -y certbot python3-certbot-nginx
      elif command -v dnf &>/dev/null; then
        $SUDO dnf install -y certbot python3-certbot-nginx
      elif command -v yum &>/dev/null; then
        $SUDO yum install -y certbot python3-certbot-nginx
      fi
    fi
    if command -v certbot &>/dev/null; then
      info "签发 HTTPS 证书 (Let's Encrypt)..."
      if [ -n "${CERTBOT_EMAIL:-}" ]; then
        $SUDO certbot --nginx -d "$domain" --non-interactive --agree-tos -m "$CERTBOT_EMAIL" --redirect || \
          warn "证书签发失败（检查 80 端口是否放行 / 域名是否解析到本机）。可稍后手动: sudo certbot --nginx -d $domain"
      else
        $SUDO certbot --nginx -d "$domain" --redirect || \
          warn "证书签发失败或被取消。可稍后手动: sudo certbot --nginx -d $domain"
      fi
    else
      warn "certbot 未安装，跳过 HTTPS。可手动: sudo certbot --nginx -d $domain"
    fi
  fi

  # 6) 同步后端 .env 的域名相关项
  sync_env_domain "$domain"

  echo ""
  log "Nginx 配置完成。请确认云服务器安全组已放行 80 / 443 端口。"
  warn "国内服务器需完成域名备案，否则 80 端口可能被拦截。"
}

# 把后端 .env 的 CORS_ORIGIN / APP_PUBLIC_ORIGIN / COOKIE_SECURE 对齐到 https://域名
sync_env_domain() {
  local domain="$1"
  local envf="$BACKEND_DIR/.env"
  [ -f "$envf" ] || return 0
  local origin="https://$domain"

  set_env_kv() {
    local key="$1" val="$2"
    if grep -qE "^${key}=" "$envf"; then
      sed -i "s|^${key}=.*|${key}=${val}|" "$envf"
    else
      printf '%s=%s\n' "$key" "$val" >> "$envf"
    fi
  }

  info "对齐 .env 域名相关项 → $origin"
  set_env_kv "CORS_ORIGIN" "$origin"
  set_env_kv "APP_PUBLIC_ORIGIN" "$origin"
  set_env_kv "COOKIE_SECURE" "true"
  log ".env 已更新（重启后端后生效）"
  warn "如需 Google 登录，请确认 .env 中 GOOGLE_CLIENT_ID 已填写。"
}

# ===== 首次安装 =====
do_full_install() {
  echo ""
  echo -e "${CYAN}========================================${NC}"
  echo -e "${CYAN}   E-Tomd 命运双盘 · 一键部署${NC}"
  echo -e "${CYAN}========================================${NC}"
  echo ""

  check_node
  check_env
  do_install_deps
  do_migrate
  do_build
  do_start

  # 可选：配置 Nginx 反代 + HTTPS（提供域名才执行）
  # 触发条件：DOMAIN 环境变量、.env 里的 APP_PUBLIC_ORIGIN，或交互式输入
  if [ "${SKIP_NGINX:-false}" = "true" ]; then
    info "SKIP_NGINX=true，跳过 Nginx 配置"
  else
    echo ""
    info "下一步：配置 Nginx 反向代理 + HTTPS（让域名可访问）"
    do_setup_nginx "${DOMAIN:-}"
    # 域名同步到 .env 后重启使其生效
    if [ -f "$BACKEND_DIR/.env" ] && grep -qE '^APP_PUBLIC_ORIGIN=https' "$BACKEND_DIR/.env"; then
      do_restart
    fi
  fi
}

# ===== 主入口 =====
case "${1:-install}" in
  install)      do_full_install ;;
  build)        check_node; do_build ;;
  start)        do_start ;;
  stop)         do_stop ;;
  restart)      do_restart ;;
  status)       do_status ;;
  logs)         do_logs ;;
  migrate)      check_env; do_migrate ;;
  update)       check_node; do_update ;;
  setup-nginx)  do_setup_nginx "${2:-}" ;;
  *)
    echo "用法: bash deploy.sh [命令]"
    echo ""
    echo "命令:"
    echo "  install      首次部署 (检查环境+安装+迁移+构建+启动+Nginx/HTTPS)"
    echo "  build        重新构建前后端"
    echo "  start        启动服务"
    echo "  stop         停止服务"
    echo "  restart      重启服务"
    echo "  status       查看运行状态 + 健康检查"
    echo "  logs         查看实时日志 (Ctrl+C 退出)"
    echo "  migrate      执行数据库迁移"
    echo "  update       拉取最新代码 + 重建 + 重启"
    echo "  setup-nginx  配置 Nginx 反向代理 + HTTPS (可带域名参数)"
    echo ""
    echo "示例:"
    echo "  bash deploy.sh setup-nginx tarot.zaopic.cn"
    echo "  DOMAIN=tarot.zaopic.cn CERTBOT_EMAIL=you@mail.com bash deploy.sh install"
    echo "  SKIP_NGINX=true bash deploy.sh install   # 跳过 Nginx 配置"
    ;;
esac
