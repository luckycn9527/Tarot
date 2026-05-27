import { readFileSync } from 'fs';
import { createConnection } from 'mysql2/promise';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * 仅执行 001 初始化库。后续请按需手动执行：
 * mysql ... < migrations/002_reader_reading.sql
 * mysql ... < migrations/004_cemetery_lnglat.sql
 * mysql ... < migrations/005_normalize_fk_audit.sql
 * mysql ... < migrations/013_fate_dual_engine.sql（或 npm run migrate:fate-dual）
 */
async function migrate() {
  const connection = await createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
  });

  try {
    const sqlPath = join(__dirname, '../../migrations/001_init.sql');
    const sql = readFileSync(sqlPath, 'utf-8');
    await connection.query(sql);
    console.log('✅ 001_init.sql completed. Apply 002 / 004 / 005 manually when needed.');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

migrate();
