/**
 * 执行命运双盘相关表迁移（013_fate_dual_engine.sql）
 * 使用 .env 中的 DB_*，与主服务一致；可重复执行（CREATE IF NOT EXISTS / 条件 ALTER）。
 *
 * 用法：npm run migrate:fate-dual
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = Number(process.env.DB_PORT) || 3306;
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD ?? '';
const DB_NAME = process.env.DB_NAME || 'tarot_qa';

async function main() {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const sqlPath = join(__dirname, '../../migrations/013_fate_dual_engine.sql');
  let sql = readFileSync(sqlPath, 'utf-8');
  // 连接已指定 database，去掉文件里的 USE，避免与 .env 库名不一致
  sql = sql.replace(/^\s*USE\s+[^;]+;\s*/im, '');

  const conn = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    multipleStatements: true,
    charset: 'utf8mb4',
  });

  try {
    await conn.query(sql);
    console.log(`✅ 命运双盘迁移已执行完成 → 数据库「${DB_NAME}」`);
  } finally {
    await conn.end();
  }
}

main().catch((err: unknown) => {
  console.error('❌ migrate:fate-dual 失败:', err instanceof Error ? err.message : err);
  process.exit(1);
});
