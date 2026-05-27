#!/bin/bash
#============================================================
#  E-Tomd 一键部署启动脚本
#  用法: bash deploy.sh [命令]
#  命令:
#    install   - 首次部署: 安装依赖 + 初始化数据库 + 构建 + 启动
#    build     - 重新构建前后端
#    start     - 启动服务
#    stop      - 停止服务
#    restart   - 重启服务
#    status    - 查看运行状态
#    logs      - 查看日志
#    migrate   - 执行数据库迁移
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
    exit 1
  fi
  local ver
  ver=$(node -v | sed 's/v//' | cut -d. -f1)
  if [ "$ver" -lt "$NODE_MIN_VERSION" ]; then
    err "Node.js 版本过低 ($(node -v))，需要 >= $NODE_MIN_VERSION"
    exit 1
  fi
  log "Node.js $(node -v)"
}

check_mysql() {
  if ! command -v mysql &>/dev/null; then
    warn "未找到 mysql 命令行工具，跳过数据库检查"
    warn "请确保 MySQL 服务已运行且数据库已初始化"
    return 1
  fi
  return 0
}

check_env() {
  if [ ! -f "$BACKEND_DIR/.env" ]; then
    warn "未找到 .env 文件，从模板创建..."
    cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
    err "请编辑 $BACKEND_DIR/.env 填入实际配置后重新运行"
    err "  - DB_PASSWORD: MySQL 密码"
    err "  - JWT_ACCESS_SECRET: JWT 密钥 (至少10位)"
    err "  - JWT_REFRESH_SECRET: JWT 刷新密钥 (至少10位)"
    err "  - DEEPSEEK_API_KEY: DeepSeek API 密钥"
    err "  - CORS_ORIGIN: 前端地址 (生产环境改为实际域名)"
    exit 1
  fi
  log ".env 配置文件已就绪"
}

# ===== 数据库迁移 =====
do_migrate() {
  info "执行数据库迁移..."
  if ! check_mysql; then
    warn "无法自动执行迁移，请手动执行以下 SQL 文件:"
    for f in "$BACKEND_DIR"/migrations/*.sql; do
      echo "  mysql -u root -p < $f"
    done
    return
  fi

  # 从 .env 读取数据库配置
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

  for f in "$BACKEND_DIR"/migrations/*.sql; do
    local fname
    fname=$(basename "$f")
    info "  迁移: $fname"
    mysql -h"$db_host" -P"$db_port" -u"$db_user" -p"$db_pass" < "$f" 2>/dev/null || {
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
  info "构建后端..."
  cd "$BACKEND_DIR"
  npx tsc
  log "后端构建完成 → dist/"

  info "构建前端..."
  cd "$FRONTEND_DIR"
  npx vue-tsc -b && npx vite build
  log "前端构建完成 → dist/"

  # 确保 uploads 目录存在
  mkdir -p "$BACKEND_DIR/uploads/avatars"
}

# ===== 启动 =====
do_start() {
  if [ -f "$PID_FILE" ]; then
    local old_pid
    old_pid=$(cat "$PID_FILE")
    if kill -0 "$old_pid" 2>/dev/null; then
      warn "服务已在运行 (PID: $old_pid)"
      return
    fi
    rm -f "$PID_FILE"
  fi

  check_env

  # 检查前端是否已构建
  if [ ! -d "$FRONTEND_DIR/dist" ]; then
    warn "前端未构建，先执行构建..."
    do_build
  fi

  # 检查后端是否已编译
  if [ ! -f "$BACKEND_DIR/dist/index.js" ]; then
    warn "后端未编译，先执行构建..."
    do_build
  fi

  info "启动服务..."
  cd "$BACKEND_DIR"
  nohup node dist/index.js > "$LOG_FILE" 2>&1 &
  local pid=$!
  echo "$pid" > "$PID_FILE"

  # 等待启动
  sleep 2
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
  else
    err "服务启动失败，查看日志:"
    tail -20 "$LOG_FILE"
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
      # 健康检查
      local port
      port=$(grep -E '^PORT=' "$BACKEND_DIR/.env" 2>/dev/null | cut -d= -f2)
      port=${port:-5174}
      if command -v curl &>/dev/null; then
        local health
        health=$(curl -s "http://localhost:$port/health" 2>/dev/null)
        if [ -n "$health" ]; then
          log "健康检查: $health"
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

# ===== 首次安装 =====
do_full_install() {
  echo ""
  echo -e "${CYAN}========================================${NC}"
  echo -e "${CYAN}   E-Tomd 一键部署${NC}"
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
  *)
    echo "用法: bash deploy.sh [命令]"
    echo ""
    echo "命令:"
    echo "  install   首次部署 (安装+迁移+构建+启动)"
    echo "  build     重新构建前后端"
    echo "  start     启动服务"
    echo "  stop      停止服务"
    echo "  restart   重启服务"
    echo "  status    查看运行状态"
    echo "  logs      查看日志 (Ctrl+C 退出)"
    echo "  migrate   执行数据库迁移"
    ;;
esac
