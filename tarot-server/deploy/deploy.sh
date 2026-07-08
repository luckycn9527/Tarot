#!/usr/bin/env bash
#
# tarot.zaopic.cn 一键部署 / 自检脚本（方式B：Nginx 托管前端 + 反代后端 API）
# 在【服务器】上运行（Linux）。用法：
#   ./deploy.sh init-env     首次：交互生成生产 .env（自动生成 JWT 密钥，权限 600）
#   ./deploy.sh check        仅检测：依赖 + DNS + .env 校验 + 运行健康自检
#   ./deploy.sh backend      仅部署后端（npm ci + build + pm2）
#   ./deploy.sh frontend     仅发布已同步的前端 dist（默认不在服务器构建）
#   ./deploy.sh nginx        安装站点配置 + 首次自动签发证书 + 校验重载
#   ./deploy.sh              全流程：check → backend → 发布前端 dist → nginx → health
#
# 可用环境变量覆盖：DOMAIN BACKEND_PORT PM2_NAME DIST_TARGET WEB_DIR
#                    NGINX_CONF_DST CERTBOT_EMAIL SMTP_USER BUILD_FRONTEND_ON_SERVER
set -euo pipefail

# ---------------- 配置 ----------------
DOMAIN="${DOMAIN:-tarot.zaopic.cn}"
BACKEND_PORT="${BACKEND_PORT:-5174}"
PM2_NAME="${PM2_NAME:-tarot-api}"
DIST_TARGET="${DIST_TARGET:-/var/www/${DOMAIN}/dist}"
CERTBOT_EMAIL="${CERTBOT_EMAIL:-you@qq.com}"
SMTP_USER_DEFAULT="${SMTP_USER:-you@qq.com}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$SERVER_DIR/.." && pwd)"
WEB_DIR="${WEB_DIR:-$REPO_ROOT/tarot-vue}"
ENV_FILE="$SERVER_DIR/.env"
NGINX_CONF_SRC="$SCRIPT_DIR/nginx-${DOMAIN}.conf"
NGINX_CONF_DST="${NGINX_CONF_DST:-/etc/nginx/conf.d/${DOMAIN}.conf}"

# ---------------- 日志 ----------------
if [ -t 1 ]; then R=$'\e[31m'; G=$'\e[32m'; Y=$'\e[33m'; B=$'\e[36m'; N=$'\e[0m'; else R=; G=; Y=; B=; N=; fi
info(){ printf '%s\n' "${B}▶ $*${N}"; }
ok(){   printf '%s\n' "${G}  ✔ $*${N}"; }
warn(){ printf '%s\n' "${Y}  ⚠ $*${N}"; }
die(){  printf '%s\n' "${R}  ✘ $*${N}" >&2; exit 1; }

# ---------------- 依赖检测 ----------------
check_deps(){
  info "检测依赖与目录"
  local miss=0 c
  for c in node npm nginx pm2 curl; do
    if command -v "$c" >/dev/null 2>&1; then ok "$c -> $(command -v "$c")"; else warn "$c 未安装"; miss=1; fi
  done
  if command -v certbot >/dev/null 2>&1; then ok "certbot 已装"; else warn "certbot 未装（HTTPS 证书需要：apt install certbot python3-certbot-nginx）"; fi
  if command -v node >/dev/null 2>&1; then
    local v; v="$(node -p 'process.versions.node.split(".")[0]')"
    if [ "$v" -ge 18 ]; then ok "Node $(node -v)"; else die "Node 需 >= 18，当前 $(node -v)"; fi
  fi
  [ -d "$SERVER_DIR" ] || die "找不到后端目录：$SERVER_DIR"
  [ -d "$WEB_DIR" ]    || die "找不到前端目录：$WEB_DIR（可用 WEB_DIR=... 覆盖）"
  [ "$miss" -eq 0 ] || die "缺少必要依赖，请先安装后重试"
  ok "目录结构正常（server=$SERVER_DIR  web=$WEB_DIR）"
}

# ---------------- DNS / 备案提醒 ----------------
check_dns(){
  info "检测域名解析"
  local pubip dnsip
  pubip="$(curl -fsS --max-time 5 https://api.ipify.org 2>/dev/null || true)"
  dnsip="$(getent hosts "$DOMAIN" 2>/dev/null | awk 'NR==1{print $1}' || true)"
  if [ -n "$dnsip" ]; then ok "$DOMAIN 解析到 $dnsip"; else warn "$DOMAIN 暂无 DNS 解析（请添加 A 记录指向本机公网 IP）"; fi
  if [ -n "$pubip" ] && [ -n "$dnsip" ] && [ "$pubip" != "$dnsip" ]; then
    warn "本机公网 IP($pubip) 与域名解析($dnsip) 不一致（用了 CDN/负载均衡可忽略）"
  fi
  warn "国内服务器请确认 $DOMAIN 已 ICP 备案，否则 80/443 会被运营商拦截"
}

# ---------------- 生成 .env ----------------
gen_secret(){ openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n'; }
init_env(){
  info "生成生产 .env"
  if [ -f "$ENV_FILE" ]; then
    warn "$ENV_FILE 已存在"
    read -rp "  覆盖？旧文件将备份 (y/N) " a
    if [ "${a:-N}" != "y" ] && [ "${a:-N}" != "Y" ]; then warn "跳过生成，沿用现有 .env"; return 0; fi
    cp "$ENV_FILE" "$ENV_FILE.bak.$(date +%Y%m%d%H%M%S)" && ok "已备份旧 .env"
  fi
  local dbpass smtppass deepseek smtpuser
  read -rsp "  数据库密码 DB_PASSWORD: " dbpass; echo
  read -rp  "  发信邮箱 SMTP_USER [${SMTP_USER_DEFAULT}]: " smtpuser; smtpuser="${smtpuser:-$SMTP_USER_DEFAULT}"
  read -rsp "  QQ 邮箱客户端授权码 SMTP_PASS: " smtppass; echo
  read -rp  "  DeepSeek API Key（占卜解读用，可留空）: " deepseek
  umask 077
  cat > "$ENV_FILE" <<EOF
# 生产环境（由 deploy.sh init-env 生成于 $(date '+%F %T')）
NODE_ENV=production
PORT=${BACKEND_PORT}
HOST=127.0.0.1

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=${dbpass}
DB_NAME=tarot_qa

JWT_ACCESS_SECRET=$(gen_secret)
JWT_REFRESH_SECRET=$(gen_secret)
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

DEEPSEEK_API_KEY=${deepseek}
DEEPSEEK_BASE_URL=https://api.deepseek.com

# —— 找回密码 / 部署相关 ——
APP_PUBLIC_ORIGIN=https://${DOMAIN}
CORS_ORIGIN=https://${DOMAIN}
COOKIE_SECURE=true
SERVE_STATIC_FRONTEND=false

SMTP_HOST=smtp.qq.com
SMTP_PORT=465
SMTP_USER=${smtpuser}
SMTP_PASS=${smtppass}
SMTP_FROM=${smtpuser}
PASSWORD_RESET_EXPIRES_HOURS=1

# —— 管理后台安全密钥（生产环境务必使用强随机值，丢失后管理员密码将失效） ——
ADMIN_USERNAME_PEPPER=$(gen_secret)
ADMIN_JWT_SECRET=$(gen_secret)
EOF
  chmod 600 "$ENV_FILE"
  ok "已写入 $ENV_FILE（权限 600，JWT/Admin 密钥已随机生成）"
}

# ---------------- .env 校验 ----------------
check_envfile(){
  info "校验 .env"
  [ -f "$ENV_FILE" ] || die ".env 不存在，请先运行：$0 init-env"
  local k miss=0
  for k in NODE_ENV APP_PUBLIC_ORIGIN COOKIE_SECURE SERVE_STATIC_FRONTEND \
           DB_PASSWORD JWT_ACCESS_SECRET JWT_REFRESH_SECRET \
           SMTP_HOST SMTP_USER SMTP_PASS SMTP_FROM \
           ADMIN_USERNAME_PEPPER ADMIN_JWT_SECRET; do
    if grep -qE "^${k}=.+" "$ENV_FILE"; then :; else warn ".env 缺少或为空：$k"; miss=1; fi
  done
  grep -qE "^APP_PUBLIC_ORIGIN=https://${DOMAIN}" "$ENV_FILE" || warn "APP_PUBLIC_ORIGIN 应为 https://${DOMAIN}"
  grep -qE "^COOKIE_SECURE=true"          "$ENV_FILE" || warn "HTTPS 部署应设 COOKIE_SECURE=true"
  grep -qE "^SERVE_STATIC_FRONTEND=false"  "$ENV_FILE" || warn "方式B 建议 SERVE_STATIC_FRONTEND=false（前端交给 Nginx）"
  [ "$miss" -eq 0 ] || die ".env 不完整，请补全或重跑 init-env"
  ok ".env 关键项齐全"
}

# ---------------- 部署后端 ----------------
deploy_backend(){
  info "部署后端（build + pm2）"
  cd "$SERVER_DIR"
  npm ci
  npm run build
  if pm2 describe "$PM2_NAME" >/dev/null 2>&1; then
    pm2 reload "$PM2_NAME" --update-env
  else
    pm2 start dist/index.js --name "$PM2_NAME" --update-env
  fi
  pm2 save >/dev/null 2>&1 || true
  ok "后端已运行（pm2: $PM2_NAME, 端口 $BACKEND_PORT）"
}

# ---------------- 部署前端 ----------------
deploy_frontend(){
  info "发布前端 dist"
  cd "$WEB_DIR"

  if [ "${BUILD_FRONTEND_ON_SERVER:-false}" = "true" ]; then
    warn "BUILD_FRONTEND_ON_SERVER=true，将在服务器构建前端；2G 内存机器不推荐"
    if [ "${SKIP_NPM_CI:-false}" = "true" ]; then
      warn "SKIP_NPM_CI=true，跳过 npm ci（使用现有 node_modules）"
      if [ ! -d "$WEB_DIR/node_modules" ]; then
        die "$WEB_DIR/node_modules 不存在，无法跳过 npm ci"
      fi
    else
      npm ci
    fi
    # build:prod 只跑 vite build，不跑 vue-tsc；内存上限默认 1024MB，避免 2G 机器被单进程吃满。
    local max_old_space="${FRONTEND_BUILD_MAX_OLD_SPACE:-1024}"
    NODE_OPTIONS="${NODE_OPTIONS:+$NODE_OPTIONS }--max-old-space-size=${max_old_space}" npm run build:prod
  elif [ ! -f "$WEB_DIR/dist/index.html" ]; then
    die "找不到 $WEB_DIR/dist/index.html。请先在本地运行：cd tarot-vue && npm run build，然后用 scripts/sync-to-server.ps1 同步 dist 到服务器。"
  fi

  mkdir -p "$DIST_TARGET"
  if command -v rsync >/dev/null 2>&1; then
    rsync -a --delete "$WEB_DIR/dist/" "$DIST_TARGET/"
  else
    rm -rf "${DIST_TARGET:?}/"* && cp -r "$WEB_DIR/dist/." "$DIST_TARGET/"
  fi
  ok "前端 dist 已发布到 $DIST_TARGET"
}

# ---------------- 配置 Nginx + 证书 ----------------
deploy_nginx(){
  info "配置 Nginx"
  [ -f "$NGINX_CONF_SRC" ] || die "找不到 Nginx 模板：$NGINX_CONF_SRC"
  [ "$(id -u)" -eq 0 ] || warn "非 root：写入 $NGINX_CONF_DST / 操作证书可能需要 sudo 重跑"

  if [ ! -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]; then
    warn "未发现证书，先用临时 80 配置签发 Let's Encrypt 证书"
    command -v certbot >/dev/null 2>&1 || die "需要 certbot：apt install certbot python3-certbot-nginx"
    cat > "$NGINX_CONF_DST" <<EOF
server {
    listen 80;
    server_name ${DOMAIN};
    root ${DIST_TARGET};
    index index.html;
    location /api/      { proxy_pass http://127.0.0.1:${BACKEND_PORT}; proxy_set_header Host \$host; proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for; proxy_set_header X-Forwarded-Proto \$scheme; }
    location = /health  { proxy_pass http://127.0.0.1:${BACKEND_PORT}; }
    location /uploads/  { proxy_pass http://127.0.0.1:${BACKEND_PORT}; }
    location /          { try_files \$uri \$uri/ /index.html; }
}
EOF
    nginx -t && { nginx -s reload 2>/dev/null || systemctl reload nginx; }
    certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --redirect -m "$CERTBOT_EMAIL" \
      || die "certbot 签发失败（检查 80 端口可达、域名已备案、DNS 已生效）"
    ok "证书已签发"
  else
    ok "已存在证书：/etc/letsencrypt/live/${DOMAIN}/"
  fi

  # 套用完整配置（把模板里的 root 替换成实际 DIST_TARGET）
  sed "s#/var/www/${DOMAIN}/dist#${DIST_TARGET}#g" "$NGINX_CONF_SRC" > "$NGINX_CONF_DST"
  if nginx -t; then
    nginx -s reload 2>/dev/null || systemctl reload nginx
    ok "Nginx 配置已生效（$NGINX_CONF_DST）"
  else
    die "nginx -t 校验失败，请检查 $NGINX_CONF_DST"
  fi
}

# ---------------- 健康自检 ----------------
run_health(){
  info "部署后健康自检"
  cd "$SERVER_DIR"
  DOMAIN="$DOMAIN" BACKEND_PORT="$BACKEND_PORT" node "$SCRIPT_DIR/healthcheck.mjs"
}

# ---------------- 主流程 ----------------
case "${1:-all}" in
  init-env)  init_env ;;
  check)     check_deps; check_dns; check_envfile; run_health || warn "健康自检未全通过（服务可能尚未部署）" ;;
  backend)   check_envfile; deploy_backend ;;
  frontend)  deploy_frontend ;;
  nginx)     deploy_nginx ;;
  all|"")     check_deps; check_dns; check_envfile; deploy_backend; deploy_frontend; deploy_nginx; run_health ;;
  -h|--help) grep -E '^#( |$)' "$0" | sed 's/^# \{0,1\}//' ;;
  *)         die "未知命令：$1（用 -h 查看用法）" ;;
esac
