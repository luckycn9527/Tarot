# 生产部署指南（Linux）

本项目只保留一条生产部署链路：

1. 本地构建后端和 `tarot-vue/dist`；
2. `scripts/sync-to-server.ps1` 打包并通过 SSH 上传；
3. 服务器运行 `tarot-server/deploy/deploy.sh`，由 PM2 管理后端、Nginx 发布前端并反代 API。

生产架构：`https://<DOMAIN>` → Nginx 静态发布前端；`/api`、`/uploads`、`/health`、`/ready` 反代到本机 Express（默认 `127.0.0.1:5174`）。

## 前置要求

- 本地：Node.js >= 18、npm、tar、OpenSSH（`scp`/`ssh`）和可登录服务器的 SSH 私钥。
- 服务器：Node.js >= 18、MySQL >= 5.7、Nginx、PM2、certbot。
- 域名已解析到服务器公网 IP；中国内地服务器还必须完成 ICP 备案，否则 80/443 可能被云厂商阻断。

## 1. 本地构建并同步

```powershell
.\scripts\sync-to-server.ps1 `
  -RemoteHost "<server-ip-or-host>" `
  -Port 22 `
  -User "<ssh-user>" `
  -KeyPath "C:\path\to\id_ed25519" `
  -RemotePath "~/tarot-clone"
```

脚本默认执行：

- `tarot-server npm run build`；
- `tarot-vue npm run build`；
- 检查 `tarot-vue/dist/index.html`；
- 排除 `.git`、`node_modules` 和服务器 `.env` 后打包上传。

只有明确要使用已有构建产物时才加 `-SkipBuild`。不要使用 `-IncludeEnv` 覆盖生产服务器密钥，生产 `.env` 应在服务器维护。

## 2. 服务器首次部署

```bash
cd ~/tarot-clone/tarot-server/deploy
chmod +x deploy.sh

# 首次生成生产环境变量；会备份已有 .env
./deploy.sh init-env

# 全流程：检查 → 后端构建/PM2 → 发布 dist → Nginx/证书 → 健康检查
./deploy.sh
```

Nginx 配置由 `nginx.conf.template` 自动渲染，不要手工复制模板到 `/etc/nginx/conf.d`。脚本会在安装新配置前保留上一份配置，校验或重载失败时自动回滚。

## 3. 后续发布

先重新运行本地同步命令，再在服务器执行：

```bash
cd ~/tarot-clone/tarot-server/deploy
./deploy.sh
```

常用子命令：

| 命令 | 说明 |
|---|---|
| `./deploy.sh check` | 检查依赖、DNS、`.env` 和运行状态 |
| `./deploy.sh backend` | `npm ci`、构建后端、执行迁移并更新 PM2 |
| `./deploy.sh frontend` | 发布已经同步的前端 `dist` |
| `./deploy.sh nginx` | 渲染 Nginx 配置、签发证书并安全重载 |

服务器默认不构建前端。仅应急时可执行：

```bash
BUILD_FRONTEND_ON_SERVER=true FRONTEND_BUILD_MAX_OLD_SPACE=1024 ./deploy.sh frontend
```

## 可配置项

以下变量必须在同一次部署中保持一致；Nginx 模板会同步使用域名、端口和前端目录：

| 变量 | 默认值 | 说明 |
|---|---|---|
| `DOMAIN` | `tarot.zaopic.cn` | 正式域名 |
| `BACKEND_PORT` | `5174` | Express 监听端口 |
| `DIST_TARGET` | `/var/www/<DOMAIN>/dist` | Nginx 前端目录 |
| `PM2_NAME` | `tarot-api` | PM2 进程名 |
| `CERTBOT_EMAIL` | `you@qq.com` | Let's Encrypt 通知邮箱 |
| `NGINX_CONF_DST` | `/etc/nginx/conf.d/<DOMAIN>.conf` | 渲染后的 Nginx 配置路径 |

例如：

```bash
DOMAIN=tarot.zaopic.cn BACKEND_PORT=5174 CERTBOT_EMAIL=admin@example.com ./deploy.sh
```

首次执行 `init-env` 会把 `PORT`、`APP_PUBLIC_ORIGIN` 和 `CORS_ORIGIN` 写入服务器 `.env`。之后如果更换域名或端口，还需同步修改 `.env`，再运行完整部署。

## 故障排查

- `dist/index.html` 不存在：在本地重新构建并运行同步脚本。
- Nginx 配置失败：运行 `nginx -t`，查看 `/var/log/nginx/error.log`。
- 后端异常：运行 `pm2 status`、`pm2 logs tarot-api --lines 100`。
- 本机健康检查：`curl http://127.0.0.1:5174/health` 和 `/ready`。
- 本机正常但公网 403/TLS 被重置：检查 DNS、云安全组、WAF 和 ICP 备案状态。

部署脚本的实现说明见 [`tarot-server/deploy/README.md`](tarot-server/deploy/README.md)。

海外生产站 `asktarot.zaopic.cn` 的服务器清单、发布参数和第三方服务维护记录见
[`OVERSEAS_DEPLOY.md`](OVERSEAS_DEPLOY.md)。
