# 部署指南（Linux 服务器）

> **注意：根目录旧版 `deploy.sh` 已废弃。** 请统一使用 `tarot-server/deploy/deploy.sh` 进行生产部署。

本项目为全栈应用：

- **后端** `tarot-server/` — Node.js + Express + TypeScript + MySQL
- **前端** `tarot-vue/` — Vue 3 + Vite，构建为静态资源由 **Nginx 托管**（方式 B）

生产部署架构：用户访问 `https://tarot.zaopic.cn` → Nginx(443) 直接发前端静态文件；`/api`、`/uploads`、`/health` 反代到本机 Express（默认 5174）。

完整部署细节见 [`tarot-server/deploy/README.md`](tarot-server/deploy/README.md)。

---

## 前置要求

- Node.js >= 18（推荐 20 LTS）
- MySQL >= 5.7 / 8.0（需可创建数据库）
- Nginx、pm2、certbot
- 一个 [DeepSeek API Key](https://platform.deepseek.com/api_keys)（占卜 AI 解读必填）

---

## 一键部署（推荐）

```bash
# 1. 克隆代码
git clone https://github.com/luckycn9527/Tarot.git
cd Tarot

# 2. 使用新版部署脚本
cd tarot-server/deploy
chmod +x deploy.sh

# 3. 首次生成生产 .env（自动生成 JWT / Admin 密钥，权限 600）
./deploy.sh init-env
# 按提示输入：DB_PASSWORD、SMTP_USER、SMTP_PASS、DeepSeek API Key（可留空）

# 4. 一键全量部署
./deploy.sh
# 流程：依赖检测 → 后端 build+pm2 → 前端 build+发布 → Nginx+证书 → 健康自检
```

部署完成后访问 `https://tarot.zaopic.cn`（或你配置的域名）。

---

## 常用命令

| 命令 | 说明 |
|------|------|
| `./deploy.sh` | 全流程部署（依赖 → 后端 → 前端 → Nginx/证书 → 自检） |
| `./deploy.sh init-env` | 交互生成生产 `.env` |
| `./deploy.sh check` | 仅检测：依赖 + DNS + `.env` + 运行健康自检 |
| `./deploy.sh backend` | 仅部署后端（`npm ci` + `build` + `pm2`） |
| `./deploy.sh frontend` | 仅构建并发布前端 `dist` 到 `/var/www/域名/dist` |
| `./deploy.sh nginx` | 仅配置 Nginx + 自动签发/更新 HTTPS 证书 |

---

## 部署脚本环境变量

| 变量 | 说明 | 示例 |
|------|------|------|
| `SKIP_NPM_CI=true` | 跳过 `npm ci`，直接使用现有 `node_modules`（适合低内存服务器） | `SKIP_NPM_CI=true sudo ./deploy.sh frontend` |
| `DOMAIN` | 覆盖默认域名 | `DOMAIN=tarot.zaopic.cn ./deploy.sh nginx` |
| `DIST_TARGET` | 覆盖前端 dist 发布路径 | `DIST_TARGET=/var/www/tarot/dist ./deploy.sh frontend` |
| `BACKEND_PORT` | 覆盖后端端口 | `BACKEND_PORT=5174 ./deploy.sh backend` |

---

## 关键环境变量（tarot-server/.env）

生产 `.env` 由 `./deploy.sh init-env` 生成。关键项如下：

| 变量 | 说明 | 典型值 |
|------|------|--------|
| `PORT` | 后端服务端口 | `5174` |
| `NODE_ENV` | 运行环境 | `production` |
| `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` | MySQL 连接 | localhost / 3306 / root / — / tarot_qa |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | JWT 密钥 | `init-env` 自动生成 |
| `ADMIN_USERNAME_PEPPER` / `ADMIN_JWT_SECRET` | 管理后台安全密钥 | `init-env` 自动生成 |
| `DEEPSEEK_API_KEY` | DeepSeek 密钥（必填）| — |
| `APP_PUBLIC_ORIGIN` | 公网访问地址 | `https://tarot.zaopic.cn` |
| `CORS_ORIGIN` | 允许的前端来源 | `https://tarot.zaopic.cn` |
| `SERVE_STATIC_FRONTEND` | 是否由后端托管前端 | `false`（方式 B 由 Nginx 托管） |
| `COOKIE_SECURE` | HTTPS 部署设 `true` | `true` |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | 找回密码邮件 | smtp.qq.com / 465 / you@qq.com / 授权码 / you@qq.com |

修改 `.env` 后需 `pm2 restart tarot-api --update-env` 生效。

---

## 进阶：systemd 守护进程（可选）

新版脚本使用 `pm2` 管理后端，已具备崩溃自动重启、开机自启能力（`pm2 save`）。如需改用 systemd：

```ini
# /etc/systemd/system/tarot.service
[Unit]
Description=E-Tomd Tarot Server
After=network.target mysql.service

[Service]
Type=simple
WorkingDirectory=/path/to/Tarot/tarot-server
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now tarot
sudo systemctl status tarot
```

> 使用 systemd 前请先 `cd tarot-server && npm ci && npm run build` 完成构建。

---

## 故障排查

- **部署后 `/var/www/tarot.zaopic.cn/dist/` 不存在**：运行 `./deploy.sh frontend` 重新发布；检查是否有 `/var/www` 写入权限（建议 root/sudo）。
- **Nginx 返回 404**：确认 `grep "root " /etc/nginx/conf.d/tarot.zaopic.cn.conf` 指向的 dist 目录存在。
- **证书签发失败**：确认 80 端口可达、域名已备案、DNS 已生效，然后重跑 `./deploy.sh nginx`。
- **后端健康检查失败**：查看日志 `pm2 logs tarot-api` 或 `tail -f tarot-server/server.log`。
