#!/bin/bash
# 在服务器上以 debian-sys-maint 连接本机 MySQL，创建 tarot_qa 库与 tarot 用户，并写回 tarot-server/.env
set -euo pipefail

DEBIAN_CNF="/etc/mysql/debian.cnf"
ENV_FILE="${1:-$HOME/tarot-clone/tarot-server/.env}"

if ! sudo test -f "$DEBIAN_CNF"; then
  echo "未找到 $DEBIAN_CNF，无法自动取维护账号。" >&2
  exit 1
fi
if [[ ! -f "$ENV_FILE" ]]; then
  echo "未找到 .env: $ENV_FILE" >&2
  exit 1
fi

MAINT_USER=$(sudo grep '^user' "$DEBIAN_CNF" | head -1 | awk '{print $3}')
MAINT_PASS=$(sudo grep '^password' "$DEBIAN_CNF" | head -1 | awk '{print $3}')

if [[ -z "${MAINT_USER:-}" || -z "${MAINT_PASS:-}" ]]; then
  echo "无法从 debian.cnf 解析 user/password。" >&2
  exit 1
fi

APP_PASS=$(openssl rand -hex 16)

mysql -u"$MAINT_USER" -p"$MAINT_PASS" -h localhost <<SQL
CREATE DATABASE IF NOT EXISTS tarot_qa CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
DROP USER IF EXISTS 'tarot'@'localhost';
CREATE USER 'tarot'@'localhost' IDENTIFIED BY '${APP_PASS}';
GRANT ALL PRIVILEGES ON tarot_qa.* TO 'tarot'@'localhost';
FLUSH PRIVILEGES;
SQL

# 更新 .env 中的数据库配置（保留其它行）
tmp="$(mktemp)"
while IFS= read -r line || [[ -n "$line" ]]; do
  case "$line" in
    DB_HOST=*) echo "DB_HOST=localhost" ;;
    DB_PORT=*) echo "DB_PORT=3306" ;;
    DB_USER=*) echo "DB_USER=tarot" ;;
    DB_PASSWORD=*) echo "DB_PASSWORD=${APP_PASS}" ;;
    DB_NAME=*) echo "DB_NAME=tarot_qa" ;;
    *) echo "$line" ;;
  esac
done < "$ENV_FILE" > "$tmp"
mv "$tmp" "$ENV_FILE"
chmod 600 "$ENV_FILE" 2>/dev/null || true

export MYSQL_PWD="$APP_PASS"
MIG_DIR="$(dirname "$ENV_FILE")/migrations"
if [[ -d "$MIG_DIR" ]]; then
  for f in "$MIG_DIR"/*.sql; do
    [[ -e "$f" ]] || continue
    echo "migrate: $(basename "$f")"
    mysql -u tarot -h localhost tarot_qa <"$f" 2>/dev/null || echo "  (跳过或已执行: $(basename "$f"))"
  done
fi
unset MYSQL_PWD

echo "OK: 已创建库 tarot_qa、用户 tarot，并已写入 $ENV_FILE"
echo "APP_DB_PASSWORD=${APP_PASS}"
