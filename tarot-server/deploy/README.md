# 生产部署清单 —— tarot.zaopic.cn（方式B：Nginx 托管前端 + 反代后端 API）

> 架构：用户访问 `https://tarot.zaopic.cn` → Nginx(443) 直接发前端静态文件；`/api`、`/uploads` 反代到本机 Express(5174)。前端与 API 同域名 **同源**，httpOnly 的 refreshToken cookie 无跨域问题。

## 一键部署（推荐）

低内存服务器推荐先在本地构建前端 dist，再把产物同步到服务器：

```powershell
.\scripts\sync-to-server.ps1 -RemoteHost 106.75.23.170 -Port 2223 -User ubuntu `
  -KeyPath "C:\Users\admin\Documents\beiji123.pem" -RemotePath "~/tarot-clone"
```

同步完成后，在服务器 `tarot-server/deploy/` 下：
```bash
chmod +x deploy.sh
./deploy.sh init-env     # 首次：交互生成生产 .env（自动生成 JWT 密钥，权限 600）
./deploy.sh              # 全流程：依赖检测 → 后端 build+pm2 → 发布已同步的前端 dist → Nginx+证书 → 健康自检
# 其它子命令：
./deploy.sh check        # 仅检测：依赖 + DNS + .env + 运行健康自检
./deploy.sh backend      # 仅后端    ./deploy.sh frontend  # 仅发布 dist    ./deploy.sh nginx  # 仅 Nginx+证书
```
> 脚本已内置：依赖/Node 版本/DNS/备案 检测、`.env` 关键项校验、首次自动签发 HTTPS 证书，以及部署后健康自检（后端存活、Nginx 反代、SPA 深链接回退、SMTP 鉴权、数据库表）。
> 健康自检也可单独跑：`node deploy/healthcheck.mjs`。
>
> 2G 内存服务器默认不再构建前端。只有临时需要在服务器构建时，才使用：`BUILD_FRONTEND_ON_SERVER=true FRONTEND_BUILD_MAX_OLD_SPACE=1024 ./deploy.sh frontend`。
>
> 下面是脚本各步骤背后的**手动等价操作**，供理解与排查。

## 0. 前提
- DNS：`tarot.zaopic.cn` 的 A 记录指向服务器公网 IP `106.75.23.170`。
- **ICP 备案**：服务器在国内时，域名必须已备案，否则 80/443 会被运营商拦截（域名能 ping 通 ≠ 能开放 web 服务）。

## 1. 后端（Express API）
```bash
cd tarot-server
npm ci
npm run build          # 编译 TS → dist/（生产用编译产物，不用 tsx watch）
# 配置生产 .env（见第 4 节），然后用 pm2 常驻：
pm2 start dist/index.js --name tarot-api --update-env
pm2 save
```

## 2. 前端（Vue 构建产物）
```bash
# 在本地或 CI 上执行，而不是在 2G 服务器上执行
cd tarot-vue
npm ci
npm run build          # 产出 dist/（api baseURL 为相对 '/api'，天然适配同域名）
# 用 scripts/sync-to-server.ps1 打包上传后，服务器 ./deploy.sh frontend 会发布这个 dist
```

## 3. Nginx + HTTPS
```bash
# 安装（按发行版）：apt install nginx certbot python3-certbot-nginx
# 1) 放置站点配置
cp tarot-server/deploy/nginx-tarot.zaopic.cn.conf /etc/nginx/conf.d/
#    修改其中 root 为 dist 实际路径
# 2) 签发证书（自动改配置补全 443）
sudo certbot --nginx -d tarot.zaopic.cn
# 3) 校验并重载
sudo nginx -t && sudo nginx -s reload
```

## 4. 生产 .env 关键项（服务器上的 tarot-server/.env，不要用开发那份）
```ini
NODE_ENV=production
PORT=5174

# 重置链接域名 —— 必须是 https 正式域名，否则邮件里的链接打不开
APP_PUBLIC_ORIGIN=https://tarot.zaopic.cn

# HTTPS 下登录态 cookie 必须 secure
COOKIE_SECURE=true

# 同源即可；列上正式域名更稳妥
CORS_ORIGIN=https://tarot.zaopic.cn

# 前端由 Nginx 托管，后端纯 API（不再用 Express 托管 dist）
SERVE_STATIC_FRONTEND=false

# 生产务必替换为强随机串（勿沿用开发值）
JWT_ACCESS_SECRET=<强随机>
JWT_REFRESH_SECRET=<强随机>

# 数据库 / DeepSeek / QQ 邮件（沿用已验证的配置）
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=<生产库密码>
DB_NAME=tarot_qa
DEEPSEEK_API_KEY=<你的key>
SMTP_HOST=smtp.qq.com
SMTP_PORT=465
SMTP_USER=you@qq.com
SMTP_PASS=<QQ授权码>
SMTP_FROM=you@qq.com
PASSWORD_RESET_EXPIRES_HOURS=1
```
> 改完 `.env` 后 `pm2 restart tarot-api --update-env` 才会生效。

## 5. 上线后验证忘记密码全链路
1. 打开 `https://tarot.zaopic.cn/login` → 点「忘记密码」→ 输入已注册邮箱。
2. 收到邮件，链接形如 `https://tarot.zaopic.cn/reset-password?token=...`。
3. 点开（任意设备/手机均可，因是公网 https 深链接，Nginx 的 try_files 兜底不会 404）。
4. 设新密码 → 提示成功 → 用新密码登录；旧设备上的登录会话会被强制下线（本次安全修复）。
