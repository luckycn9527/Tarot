/**
 * 自动按顺序执行所有迁移 SQL 文件（幂等：已执行过的自动跳过）
 * 用法: npx tsx src/scripts/migrateAll.ts
 * 无需安装 mysql 命令行工具
 */
import { readdirSync, readFileSync } from 'fs';
import { createConnection } from 'mysql2/promise';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const HOST = process.env.DB_HOST || 'localhost';
const PORT = Number(process.env.DB_PORT) || 3306;
const USER = process.env.DB_USER || 'root';
const PASS = process.env.DB_PASSWORD || '';
const DB = process.env.DB_NAME || 'tarot_qa';

// 005b is a one-off recovery script for databases where 005 stopped midway.
// It repeats DDL from 005 and must never be part of the normal ordered run.
const MANUAL_RECOVERY_MIGRATIONS = new Set(['005b_resume_after_partial.sql']);

function prepareMigrationSql(sql: string): string {
  // migrateAll 已创建并选中 DB_NAME。旧迁移里写死的 CREATE DATABASE/USE tarot_qa
  // 会让测试库或自定义库名被误切回生产库，因此执行前统一移除。
  return sql
    .replace(/^[ \t]*CREATE\s+DATABASE\b[^;]*;[ \t]*\r?$/gim, '')
    .replace(/^[ \t]*USE\s+[^;]+;[ \t]*\r?$/gim, '');
}

const baseConfig = {
  host: HOST,
  port: PORT,
  user: USER,
  password: PASS,
  multipleStatements: true,
};

async function migrateAll() {
  // 1. 确保数据库存在
  {
    const conn = await createConnection(baseConfig);
    try {
      await conn.query(
        `CREATE DATABASE IF NOT EXISTS \`${DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
      );
      console.log(`[✓] Database '${DB}' ensured`);
    } finally {
      await conn.end();
    }
  }

  // 2. 连接指定数据库
  const connection = await createConnection({ ...baseConfig, database: DB });

  try {
    // 3. 创建迁移追踪表
    await connection.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    const migrationsDir = join(__dirname, '../../migrations');
    const files = readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql') && !MANUAL_RECOVERY_MIGRATIONS.has(f))
      .sort();

    if (files.length === 0) {
      console.log('No migration files found.');
      return;
    }

    const [rows] = (await connection.query('SELECT name FROM migrations')) as [
      Array<{ name: string }>,
      unknown,
    ];
    const done = new Set(rows.map((r) => r.name));

    let applied = 0;
    let skipped = 0;
    for (const file of files) {
      if (done.has(file)) {
        skipped++;
        continue;
      }

      const sql = prepareMigrationSql(readFileSync(join(migrationsDir, file), 'utf-8'));
      console.log(`[·] Executing: ${file}`);
      // DDL migration statements may commit implicitly in MySQL, so a failed
      // migration must stop here and must never be marked as completed.
      await connection.query(sql);
      await connection.query('INSERT INTO migrations (name) VALUES (?)', [file]);
      console.log(`[✓] ${file} done`);
      applied++;
    }

    console.log(
      `\nDone. Applied: ${applied}, Skipped: ${skipped}, Total: ${files.length}`,
    );
  } finally {
    await connection.end();
  }
}

migrateAll().catch((e) => {
  console.error('❌ Migration failed:', e.message || e);
  process.exit(1);
});
