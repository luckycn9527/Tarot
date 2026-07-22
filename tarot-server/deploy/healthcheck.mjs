// 部署后健康自检（Node 原生 + 生产依赖 nodemailer/mysql2/dotenv）。
// 单独运行：cd tarot-server && node deploy/healthcheck.mjs
// 退出码 0 = 全通过，非 0 = 有问题（便于 CI / 监控接入）。
import path from 'node:path';
import http from 'node:http';
import https from 'node:https';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const DOMAIN = process.env.DOMAIN || 'tarot.zaopic.cn';
const PORT = process.env.BACKEND_PORT || process.env.PORT || '5174';

let fail = 0;
const ok = (m) => console.log(`  \x1b[32m✔\x1b[0m ${m}`);
const bad = (m) => { console.log(`  \x1b[31m✘\x1b[0m ${m}`); fail++; };

function fetchUrl(url) {
  return new Promise((resolve) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { timeout: 8000, rejectUnauthorized: false }, (r) => {
      let b = '';
      r.on('data', (c) => (b += c));
      r.on('end', () => resolve({ status: r.statusCode, body: b }));
    });
    req.on('error', (e) => resolve({ error: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ error: 'timeout' }); });
  });
}

console.log('— 健康自检 —');

// 1) 后端存活（本机，绕过 Nginx）
{
  const r = await fetchUrl(`http://127.0.0.1:${PORT}/health`);
  if (r.status === 200) ok(`后端存活 http://127.0.0.1:${PORT}/health`);
  else bad(`后端 /health 异常：${r.error || 'HTTP ' + r.status}（检查 pm2 是否 online）`);
}

// 2) 后端就绪（包含数据库连通性）
{
  const r = await fetchUrl(`http://127.0.0.1:${PORT}/ready`);
  if (r.status === 200) ok(`后端就绪 http://127.0.0.1:${PORT}/ready`);
  else bad(`后端 /ready 异常：${r.error || 'HTTP ' + r.status}（检查数据库连接和 PM2 环境变量）`);
}

// 3) 经 Nginx 反代到后端
{
  const r = await fetchUrl(`https://${DOMAIN}/ready`);
  if (r.status === 200) ok(`Nginx 反代后端 https://${DOMAIN}/ready`);
  else bad(`Nginx→后端 /ready：${r.error || 'HTTP ' + r.status}（检查 Nginx 配置 / 证书 / 后端）`);
}

// 4) 前端首页
{
  const r = await fetchUrl(`https://${DOMAIN}/`);
  if (r.status === 200 && /<!doctype html/i.test(r.body)) ok('前端首页可访问');
  else bad(`前端首页：${r.error || 'HTTP ' + r.status}（检查 dist 是否发布、Nginx root 路径）`);
}

// 5) SPA 深链接（重置密码链接能否打开的关键）
{
  const r = await fetchUrl(`https://${DOMAIN}/reset-password`);
  if (r.status === 200 && /<!doctype html/i.test(r.body)) ok('深链接 /reset-password 正确回退 index.html');
  else bad(`/reset-password 回退：${r.error || 'HTTP ' + r.status}（缺 try_files 兜底会 404）`);
}

// 6) SMTP 鉴权
try {
  const nodemailer = (await import('nodemailer')).default;
  const port = Number(process.env.SMTP_PORT || 465);
  const t = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  await t.verify();
  ok(`SMTP 鉴权成功（${process.env.SMTP_HOST}，发信 ${process.env.SMTP_FROM}）`);
} catch (e) {
  bad(`SMTP 鉴权失败：${e.message}（确认 SMTP_PASS 是授权码、已开启 SMTP 服务）`);
}

// 7) 数据库找回密码相关表
try {
  const mysql = await import('mysql2/promise');
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  const [rows] = await conn.query(
    "SELECT TABLE_NAME t FROM information_schema.TABLES WHERE TABLE_SCHEMA=? AND TABLE_NAME IN ('users','refresh_tokens','password_reset_tokens')",
    [process.env.DB_NAME],
  );
  await conn.end();
  const names = rows.map((r) => r.t);
  for (const t of ['users', 'refresh_tokens', 'password_reset_tokens']) {
    if (names.includes(t)) ok(`数据库表 ${t}`);
    else bad(`缺少数据库表 ${t}（执行对应 migration）`);
  }
} catch (e) {
  bad(`数据库连接失败：${e.message}`);
}

console.log(fail ? `\n\x1b[31m✘ 自检发现 ${fail} 项问题\x1b[0m` : '\n\x1b[32m✔ 全部通过，找回密码链路就绪\x1b[0m');
process.exit(fail ? 1 : 0);
