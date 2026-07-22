# 数据库完整备份与迁入

当前完整快照：`database-backups/tarot_qa-full-20260717.sql`

该 SQL 包含 `tarot_qa` 数据库的表结构、索引、约束、触发器以及全部数据，并会自动创建和选中 `tarot_qa` 数据库。

## 在其他服务器迁入

将 SQL 文件复制到目标服务器后执行：

```bash
mysql -h 127.0.0.1 -P 3306 -u root -p < tarot_qa-full-20260717.sql
```

输入目标服务器的 MySQL 密码即可。若 MySQL 在本机且使用默认端口，可以简化为：

```bash
mysql -u root -p < tarot_qa-full-20260717.sql
```

导入后可检查：

```bash
mysql -u root -p -e "USE tarot_qa; SHOW TABLES;"
```

## 重新导出当前数据库

后端会读取 `tarot-server/.env` 中的数据库配置：

```bash
cd tarot-server
npm run db:export
```

也可以指定文件名：

```bash
npm run db:export -- --output ../database-backups/tarot-full.sql
```

## 安全提示

完整快照包含用户资料、密码哈希及会话/重置记录，不应提交到 Git 或放到公开下载地址。`database-backups/` 已加入 `.gitignore`。
