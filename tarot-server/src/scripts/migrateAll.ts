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

async function migrateAll() {
  const connection = await createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
  });

  try {
    // 创建迁移追踪表
    await connection.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    const migrationsDir = join(__dirname, '../../migrations');
    const files = readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    if (files.length === 0) {
      console.log('No migration files found.');
      return;
    }

    const [rows] = await connection.query('SELECT name FROM migrations') as [Array<{ name: string }>, unknown];
    const done = new Set(rows.map((r) => r.name));

    let applied = 0;
    let skipped = 0;

    for (const file of files) {
      if (done.has(file)) {
        skipped++;
        continue;
      }

      const sql = readFileSync(join(migrationsDir, file), 'utf-8');
      console.log(`[·] Executing: ${file}`);
      await connection.query(sql);
      await connection.query('INSERT INTO migrations (name) VALUES (?)', [file]);
      console.log(`[✓] ${file} done`);
      applied++;
    }

    console.log(`\nDone. Applied: ${applied}, Skipped: ${skipped}, Total: ${files.length}`);
  } finally {
    await connection.end();
  }
}

migrateAll().catch((e) => {
  console.error('❌ Migration failed:', e.message || e);
  process.exit(1);
});
