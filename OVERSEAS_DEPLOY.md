# 海外站部署与维护记录

> 本文为所标日期的部署历史，未在 2026-11-05 重新核验海外生产状态。此次仅将最新源码及 [iOS 构建说明](./docs/IOS_BUILD.md) 交付 Git，未发布海外 APK 或部署网站。

最后核验：`2026-10-28`。当前海外前端 `20261028-mobile-002`、后端 `20261028-mobile-001`，Android `0.1.1`。
两站总体状态、完整变更和遗留问题见 [MAINTENANCE_HANDOFF.md](./MAINTENANCE_HANDOFF.md)。

本文记录 `asktarot.zaopic.cn` 的非敏感生产信息。密码、API Key、Webhook Secret、
OAuth Client Secret 等敏感值不得写入仓库；它们只保存在服务器
`/home/ubuntu/tarot-global/tarot-server/.env` 中，该文件权限应保持为 `600`。

## 环境清单

| 项目 | 当前值 |
|---|---|
| 域名 | `https://asktarot.zaopic.cn` |
| 服务器 | `43.172.90.37` |
| SSH 用户 | `ubuntu` |
| 系统 | Ubuntu 22.04 LTS x86_64 |
| 代码目录 | `/home/ubuntu/tarot-global` |
| 前端目录 | `/var/www/asktarot.zaopic.cn/dist` |
| 后端地址 | `127.0.0.1:5174` |
| PM2 进程 | `tarot-global-api` |
| 数据库 | MySQL 8，库名和用户均为 `tarot_global` |
| Nginx 配置 | `/etc/nginx/conf.d/asktarot.zaopic.cn.conf` |
| TLS 证书 | `/etc/letsencrypt/live/asktarot.zaopic.cn/` |
| 健康检查 | `https://asktarot.zaopic.cn/health`、`/ready` |

`mobile-002` 修复三卡界面牌位与后端 `problem` 牌阵含义不一致的问题，直接读取配置牌位。
前端 22 项测试及类型检查通过，国内中文/海外英文新 APK 显示回归通过。两站网页及两个
地区的 `0.1.1` APK 均已更新，`0.1.0` 下载保留。当前静态回滚目录为
`/var/www/asktarot.zaopic.cn/dist.pre-20261028-mobile-002`，变更源码回滚位于
`/home/ubuntu/tarot-global/.releases/20261028-mobile-002/rollback`；本次未改后端、数据库、Nginx 或 PM2。

以下是首版 `mobile-001` 的基线：前后端均已更新，Vite 为 `6.4.5`，配额时区为 `UTC`（PM2 环境已保存）。生产 `.env`
未修改；数据库备份为
`/home/ubuntu/tarot-global/database-backups/pre-20261028-mobile-001.sql`，前后端代码回滚位于
`/home/ubuntu/tarot-global/.releases/20261028-mobile-001/rollback`（本轮依赖未变），前端回滚目录为
`/var/www/asktarot.zaopic.cn/dist.pre-20261028-mobile-001`。本轮后端 `37` 项、前端 `20` 项测试、类型检查和两站构建通过，
非支付迁移 `029` 已幂等执行。原生 JSON 登录/轮换/设备登出、持久化 AI 请求去重/退款、
任务查询和历史归属通过两站真实 MySQL 独立表 HTTP 回归。国内额外执行 1 次真实 AI 解读
及 1 次追问，UUID 重放不增加调用或扣费；海外未追加真实 AI 请求。全部测试表已清理，
未创建生产测试账号、修改线上业务配置或执行真实支付扣款。
手机界面位于 `https://asktarot.zaopic.cn/app`，支持离线基础翻牌、单/三卡问卜、追问和历史；
APP 使用海外站独立账号，固定海外 API，不自动切换国内。网页原支付和价格保持不变，
原生 APP 内测暂不提供购买。Android 构建与验证见 `docs/MOBILE_NATIVE.md`；iOS 工程已生成，
用户明确优先安卓，苹果编译/签名后置。海外精确 native CORS 已通过，无 Nginx 修改。
海外仍没有启用的管理员账号，本轮未创建。

数据库、JWT、后台、AI、支付和 SMTP 密钥均由服务器 `.env` 管理。海外站使用独立
数据库和独立 JWT/后台密钥，不与国内站实时共享账户数据。

## DNS

生产解析至少包含：

```text
asktarot  A    43.172.90.37
@         CAA  0 issue "letsencrypt.org"
```

证书由 Certbot 自动续期。签发或续期异常时先检查 A/CAA 记录，再运行：

```bash
sudo certbot renew --dry-run
sudo nginx -t
```

## 日常发布

前端域名和 Google Client ID 是 Vite 构建期配置，发布前在本机 PowerShell 中设置：

```powershell
$env:VITE_PUBLIC_APP_ORIGIN = "https://asktarot.zaopic.cn"
$env:VITE_DEFAULT_LOCALE = "en-US"
$env:VITE_GOOGLE_CLIENT_ID = "<google-web-client-id>"

.\scripts\sync-to-server.ps1 `
  -RemoteHost "43.172.90.37" `
  -Port 22 `
  -User "ubuntu" `
  -KeyPath "C:\path\to\id_ed25519" `
  -RemotePath "~/tarot-global"
```

服务器执行：

```bash
cd /home/ubuntu/tarot-global/tarot-server/deploy
DOMAIN=asktarot.zaopic.cn \
BACKEND_PORT=5174 \
PM2_NAME=tarot-global-api \
QUOTA_TIME_ZONE=UTC \
CERTBOT_EMAIL=<working-email> \
./deploy.sh
```

生产 `.env` 不随代码同步。不要使用 `-IncludeEnv` 覆盖服务器密钥。

## Google 登录

项目使用 Google Identity Services 的 ID Token 流程，不使用 OAuth 重定向回调。
在 Google Cloud Console 创建类型为 **Web application** 的 OAuth 2.0 Client ID，并配置：

```text
Authorized JavaScript origins:
https://asktarot.zaopic.cn

Authorized redirect URIs:
留空
```

OAuth consent screen 需要发布到 Production；测试状态下只有 Test users 可登录。同一个
Client ID 必须同时配置到：

```text
本地前端构建：VITE_GOOGLE_CLIENT_ID
服务器后端：GOOGLE_CLIENT_ID
```

修改服务器变量后重启并保存 PM2：

```bash
cd /home/ubuntu/tarot-global/tarot-server
pm2 restart tarot-global-api --update-env
pm2 save
```

前端必须带同一 Client ID 重新构建和发布，否则 Google 按钮不会出现；前后端 Client ID
不一致时，后端会拒绝 ID Token。

## Creem 支付

海外站 Webhook 地址：

```text
https://asktarot.zaopic.cn/api/payments/webhook
```

Creem 为该 Webhook 端点提供的签名密钥应写入服务器
`CREEM_WEBHOOK_SECRET`。它与 `CREEM_API_KEY`、产品 ID 不是同一个值。产品和密钥更新后
重启 `tarot-global-api`。

### Account review

公开会员页为 `https://asktarot.zaopic.cn/membership`。当前公开价格为：

```text
VIP monthly: USD 9.90 / month
VIP yearly:  USD 89.90 / year
```

会员页必须在结账前同时显示月付和年付的完整价格、币种和计费周期。公开网站及登录后的
个人中心均显示支持邮箱 `luckycn521@gmail.com`。CREEM 商户后台的支持邮箱也必须保持一致，
修改路径为 `Settings -> Business Details`。

修复审核问题后，在 CREEM 后台进入 `Balance -> Payout Account`，点击
`Request re-review`。重新审核前还应确认 CREEM 当前产品政策是否接受本产品类型；其公开
清单目前将 metaphysical、fortune-telling 和 spiritual outcome services 列为禁止产品，
应先向 CREEM 支持提供 Store ID 并取得书面确认，不应通过改变措辞隐瞒产品实际用途。

## 运维检查

```bash
pm2 status tarot-global-api
pm2 logs tarot-global-api --lines 100
curl -fsS http://127.0.0.1:5174/health
curl -fsS https://asktarot.zaopic.cn/health
sudo nginx -t
sudo systemctl status mysql nginx pm2-ubuntu --no-pager
```

数据库备份示例（密码从安全环境读取，不要写入命令历史）：

```bash
cd /home/ubuntu/tarot-global/tarot-server
npm run db:export
```

## 旧服务

部署时停止了 `mirofish-frontend` 和 `mirofish-backend` 两个 Docker 容器，但未删除容器、
镜像或数据。`mirofish-frontend` 会占用 `80/443`，不可与当前 Nginx 同时启动；恢复前必须
先安排端口或反向代理共存方案。
