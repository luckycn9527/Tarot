# 部署指南（Linux 服务器）

本项目为全栈应用：

- **后端** `tarot-server/` — Node.js + Express + TypeScript + MySQL
- **前端** `tarot-vue/` — Vue 3 + Vite，构建为静态资源由后端托管

后端进程可同时托管前端静态文件（`SERVE_STATIC_FRONTEND=true`，默认开启），因此**单进程即可对外提供完整服务**。

---

## 前置要求

- Node.js >= 18（推荐 20 LTS）
- MySQL >= 5.7 / 8.0（需可创建数据库）
- 一个 [DeepSeek API Key](https://platform.deepseek.com/api_keys)（占卜 AI 解读必填）

---

## 一键部署

```bash
# 1. 克隆代码
git clone https://github.com/luckycn9527/Tarot.git
cd Tarot

# 2. 首次运行（会生成 .env 模板并自动填充 JWT 密钥）
bash deploy.sh install

# 3. 按提示编辑 tarot-server/.env，填入：
#    - DB_PASSWORD      MySQL 密码
#    - DEEPSEEK_API_KEY DeepSeek 密钥
#    - CORS_ORIGIN      最终访问地址（如 http://你的域名 或 http://服务器IP:5174）
nano tarot-server/.env

# 4. 再次运行，完成数据库迁移 + 构建 + 启动
bash deploy.sh install
```

启动后访问 `http://服务器IP:5174`。

---

## 常用命令

| 命令 | 说明 |
|------|------|
| `bash deploy.sh install` | 首次部署：检查环境 + 安装依赖 + 迁移 + 构建 + 启动 |
| `bash deploy.sh build`   | 重新构建前后端 |
| `bash deploy.sh start`   | 启动服务 |
| `bash deploy.sh stop`    | 停止服务 |
| `bash deploy.sh restart` | 重启服务 |
| `bash deploy.sh status`  | 查看运行状态 + 健康检查 |
| `bash deploy.sh logs`    | 查看实时日志（Ctrl+C 退出）|
| `bash deploy.sh migrate` | 单独执行数据库迁移 |
| `bash deploy.sh update`  | 拉取最新代码 + 重建 + 重启 |

---

## 关键环境变量（tarot-server/.env）

| 变量 | 说明 | 默认 |
|------|------|------|
| `PORT` | 服务端口 | `5174` |
| `NODE_ENV` | 运行环境 | `production`（脚本自动设置）|
| `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` | MySQL 连接 | localhost / 3306 / root / — / tarot_qa |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | JWT 密钥 | 脚本自动生成随机值 |
| `DEEPSEEK_API_KEY` | DeepSeek 密钥（必填）| — |
| `CORS_ORIGIN` | 允许的前端来源，逗号分隔 | 本地地址 |
| `SERVE_STATIC_FRONTEND` | 是否由后端托管前端 | `true` |
| `COOKIE_SECURE` | HTTPS 部署设 `true`，HTTP 部署设 `false` | `false` |
| `REDIS_URL` | 可选，启用缓存 | 未启用 |

---

## 进阶：用 systemd 守护进程（可选）

`deploy.sh start` 使用 `nohup` 后台运行。若希望开机自启、崩溃自动重启，可改用 systemd：

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

> 使用 systemd 前请先 `bash deploy.sh build` 完成构建。

---

## 进阶：Nginx 反向代理（可选）

若需绑定域名 / 上 HTTPS，可在前面挂 Nginx：

```nginx
server {
  listen 80;
  server_name your-domain.com;

  location / {
    proxy_pass http://127.0.0.1:5174;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

启用 HTTPS 后记得把 `tarot-server/.env` 的 `COOKIE_SECURE=true`、`CORS_ORIGIN` 改为 `https://your-domain.com`。
