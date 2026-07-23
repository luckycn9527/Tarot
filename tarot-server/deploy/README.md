# 部署脚本说明

生产部署统一使用本目录的 `deploy.sh`，完整操作步骤见仓库根目录 [`DEPLOY.md`](../../DEPLOY.md)。

本目录只包含三项：

- `deploy.sh`：后端构建、数据库迁移、PM2 更新、前端发布、Nginx/证书和健康检查；
- `nginx.conf.template`：由脚本渲染的唯一 Nginx 模板；
- `healthcheck.mjs`：部署后健康检查。

不要把 `nginx.conf.template` 手工复制到 `/etc/nginx/conf.d`，其中含有 `__DOMAIN__`、`__BACKEND_PORT__`、`__DIST_TARGET__` 占位符。运行 `./deploy.sh nginx` 会渲染、校验并安全重载配置。

```bash
./deploy.sh init-env
./deploy.sh check
./deploy.sh backend
./deploy.sh frontend
./deploy.sh nginx
./deploy.sh
```

前端默认在本地构建并由 `scripts/sync-to-server.ps1` 上传；服务器脚本只发布已有 `tarot-vue/dist`。生产后端仅由 PM2 管理，不要再同时配置 systemd 运行同一个 `dist/index.js`。
