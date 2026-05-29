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
#
#  典型流程 (首次部署到服务器):
#    1. git clone https://github.com/luckycn9527/Tarot.git
#    2. cd Tarot
#    3. bash deploy.sh install
#    4. 按提示编辑 tarot-server/.env (数据库密码 / JWT 密钥 / DeepSeek Key)
#    5. bash deploy.sh install   # 再次运行完成构建启动
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

check_mysql() {
  if ! command -v mysql &>/dev/null; then
    warn "未找到 mysql 命令行工具，跳过自动数据库操作"
    warn "请确保 MySQL 服务已运行且数据库已初始化"
    return 1
  fi
  return 0
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
  info "执行数据库迁移..."
  if ! check_mysql; then
    warn "无法自动执行迁移，请手动执行以下 SQL 文件 (按文件名顺序):"
    for f in "$BACKEND_DIR"/migrations/*.sql; do
      echo "  mysql -u root -p 数据库名 < $f"
    done
    return
  fi

  local db_host db_port db_user db_pass db_name
  db_host=$(grep -E '^DB_HOST=' "$BACKEND_DIR/.env" | cut -d= -f2)
  db_port=$(grep -E '^DB_PORT=' "$BACKEND_DIR/.env" | cut -d= -f2)
  db_user=$(grep -E '^DB_USER=' "$BACKEND_DIR/.env" | cut -d= -f2)
  db_pass=$(grep -E '^DB_PASSWORD=' "$BACKEND_DIR/.env" | cut -d= -f2)
  db_name=$(grep -E '^DB_NAME=' "$BACKEND_DIR/.env" | cut -d= -f2)

  db_host=${db_host:-localhost}
  db_port=${db_port:-3306}
  db_user=${db_user:-root}
  db_name=${db_name:-tarot_qa}

  # 确保数据库存在
  info "  确保数据库 $db_name 存在..."
  mysql -h"$db_host" -P"$db_port" -u"$db_user" -p"$db_pass" \
    -e "CREATE DATABASE IF NOT EXISTS \`$db_name\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>/dev/null || {
    err "  创建数据库失败，请检查 .env 中的数据库账号密码"
    exit 1
  }

  for f in "$BACKEND_DIR"/migrations/*.sql; do
    local fname
    fname=$(basename "$f")
    info "  迁移: $fname"
    mysql -h"$db_host" -P"$db_port" -u"$db_user" -p"$db_pass" "$db_name" < "$f" 2>/dev/null || {
      warn "  $fname 执行失败 (可能已执行过，可忽略)"
    }
  done
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

  info "构建前端 (Vite → dist/)..."
  cd "$FRONTEND_DIR"
  npx vue-tsc -b && npx vite build
  log "前端构建完成 → dist/"

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
}

# ===== 主入口 =====
case "${1:-install}" in
  install)  do_full_install ;;
  build)    check_node; do_build ;;
  start)    do_start ;;
  stop)     do_stop ;;
  restart)  do_restart ;;
  status)   do_status ;;
  logs)     do_logs ;;
  migrate)  check_env; do_migrate ;;
  update)   check_node; do_update ;;
  *)
    echo "用法: bash deploy.sh [命令]"
    echo ""
    echo "命令:"
    echo "  install   首次部署 (检查环境+安装+迁移+构建+启动)"
    echo "  build     重新构建前后端"
    echo "  start     启动服务"
    echo "  stop      停止服务"
    echo "  restart   重启服务"
    echo "  status    查看运行状态 + 健康检查"
    echo "  logs      查看实时日志 (Ctrl+C 退出)"
    echo "  migrate   执行数据库迁移"
    echo "  update    拉取最新代码 + 重建 + 重启"
    ;;
esac
