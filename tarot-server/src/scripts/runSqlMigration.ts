/**
 * 执行指定迁移 SQL（multipleStatements）
 * 用法: npx tsx src/scripts/runSqlMigration.ts migrations/005_normalize_fk_audit.sql
 */
import { readFileSync } from 'fs';
import { createConnection } from 'mysql2/promise';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const rel = process.argv[2] || 'migrations/005_normalize_fk_audit.sql';
const sqlPath = join(__dirname, '../..', rel);

async function main() {
  const sql = readFileSync(sqlPath, 'utf-8');
  const connection = await createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
  });
  try {
    console.log('Executing:', rel);
    await connection.query(sql);
    console.log('✅ OK');
  } finally {
    await connection.end();
  }
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
