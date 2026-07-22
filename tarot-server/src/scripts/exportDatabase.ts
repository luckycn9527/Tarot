/**
 * Export the configured MySQL database as a portable, self-contained SQL file.
 *
 * Usage:
 *   npm run db:export
 *   npm run db:export -- --output ../database-backups/tarot-full.sql
 *
 * Import on another server:
 *   mysql -u root -p < tarot-full.sql
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import mysql, { type RowDataPacket } from 'mysql2/promise';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');

function cliValue(name: string): string | undefined {
  const direct = process.argv.find((arg) => arg.startsWith(`${name}=`));
  if (direct) return direct.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function timestamp(date = new Date()): string {
  return [
    date.getFullYear(), pad2(date.getMonth() + 1), pad2(date.getDate()), '-',
    pad2(date.getHours()), pad2(date.getMinutes()), pad2(date.getSeconds()),
  ].join('');
}

function quoteIdentifier(value: string): string {
  return `\`${value.replace(/`/g, '``')}\``;
}

/** Hex string literals avoid SQL-mode and escaping differences on the target server. */
function sqlLiteral(value: unknown): string {
  if (value == null) return 'NULL';
  if (Buffer.isBuffer(value)) return `X'${value.toString('hex')}'`;
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'boolean') return value ? '1' : '0';
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  if (text === '') return "''";
  return `CONVERT(X'${Buffer.from(text, 'utf8').toString('hex')}' USING utf8mb4)`;
}

function portableCreateSql(sql: string): string {
  return sql.replace(/\s+DEFINER=`[^`]+`@`[^`]+`/gi, '');
}

function outputPath(database: string): string {
  const requested = cliValue('--output');
  if (requested) return path.resolve(process.cwd(), requested);
  return path.join(repoRoot, 'database-backups', `${database}-full-${timestamp()}.sql`);
}

async function main() {
  const database = process.env.DB_NAME?.trim();
  if (!database) throw new Error('DB_NAME is missing from tarot-server/.env');

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database,
    charset: 'utf8mb4',
    dateStrings: true,
    supportBigNumbers: true,
    bigNumberStrings: true,
  });

  try {
    await connection.query('SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    await connection.query('START TRANSACTION WITH CONSISTENT SNAPSHOT');

    const [schemaRows] = await connection.query<RowDataPacket[]>(
      `SELECT DEFAULT_CHARACTER_SET_NAME AS charset_name, DEFAULT_COLLATION_NAME AS collation_name
       FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?`,
      [database],
    );
    if (!schemaRows[0]) throw new Error(`Database not found: ${database}`);

    const [objectRows] = await connection.query<RowDataPacket[]>('SHOW FULL TABLES');
    const objects = objectRows.map((row) => {
      const values = Object.values(row) as string[];
      return { name: String(values[0]), type: String(values[1]).toUpperCase() };
    });
    const tables = objects.filter((item) => item.type === 'BASE TABLE');
    const views = objects.filter((item) => item.type === 'VIEW');

    const lines: string[] = [
      '-- E-Tomd / TarotQA complete MySQL snapshot',
      `-- Source database: ${database}`,
      `-- Exported at: ${new Date().toISOString()}`,
      '-- Contains schema and all table data. Treat this file as sensitive.',
      '-- One-command import: mysql -u root -p < this-file.sql',
      '',
      'SET NAMES utf8mb4;',
      "SET SQL_MODE='NO_AUTO_VALUE_ON_ZERO';",
      'SET TIME_ZONE=\'+08:00\';',
      'SET FOREIGN_KEY_CHECKS=0;',
      'SET UNIQUE_CHECKS=0;',
      '',
      `CREATE DATABASE IF NOT EXISTS ${quoteIdentifier(database)}`,
      `  CHARACTER SET ${schemaRows[0].charset_name}`,
      `  COLLATE ${schemaRows[0].collation_name};`,
      `USE ${quoteIdentifier(database)};`,
      '',
    ];

    const tableCounts: Array<{ name: string; rows: number }> = [];
    for (const table of tables) {
      const name = table.name;
      const quoted = quoteIdentifier(name);
      const [createRows] = await connection.query<RowDataPacket[]>(`SHOW CREATE TABLE ${quoted}`);
      const createSql = String(createRows[0]?.['Create Table'] ?? '');
      if (!createSql) throw new Error(`Unable to read schema for table ${name}`);

      lines.push(`-- --------------------------------------------------------`);
      lines.push(`-- Table: ${quoted}`);
      lines.push(`DROP TABLE IF EXISTS ${quoted};`);
      lines.push(`${createSql};`, '');

      const [columnRows] = await connection.query<RowDataPacket[]>(`SHOW COLUMNS FROM ${quoted}`);
      const columns = columnRows.map((row) => String(row.Field));
      const [countRows] = await connection.query<RowDataPacket[]>(`SELECT COUNT(*) AS row_count FROM ${quoted}`);
      const rowCount = Number(countRows[0]?.row_count ?? 0);
      tableCounts.push({ name, rows: rowCount });

      const pageSize = 200;
      for (let offset = 0; offset < rowCount; offset += pageSize) {
        const [dataRows] = await connection.query<RowDataPacket[]>(
          `SELECT * FROM ${quoted} LIMIT ${pageSize} OFFSET ${offset}`,
        );
        if (dataRows.length === 0) break;
        const columnSql = columns.map(quoteIdentifier).join(', ');
        const valuesSql = dataRows.map((row) => (
          `(${columns.map((column) => sqlLiteral(row[column])).join(', ')})`
        ));
        lines.push(`INSERT INTO ${quoted} (${columnSql}) VALUES`);
        lines.push(`${valuesSql.join(',\n')};`, '');
      }
    }

    for (const view of views) {
      const quoted = quoteIdentifier(view.name);
      const [createRows] = await connection.query<RowDataPacket[]>(`SHOW CREATE VIEW ${quoted}`);
      const createSql = portableCreateSql(String(createRows[0]?.['Create View'] ?? ''));
      if (!createSql) throw new Error(`Unable to read schema for view ${view.name}`);
      lines.push(`DROP VIEW IF EXISTS ${quoted};`);
      lines.push(`${createSql};`, '');
    }

    const [triggerRows] = await connection.query<RowDataPacket[]>('SHOW TRIGGERS');
    if (triggerRows.length > 0) lines.push('DELIMITER ;;');
    for (const trigger of triggerRows) {
      const name = String(trigger.Trigger);
      const [createRows] = await connection.query<RowDataPacket[]>(
        `SHOW CREATE TRIGGER ${quoteIdentifier(name)}`,
      );
      const createSql = portableCreateSql(String(createRows[0]?.['SQL Original Statement'] ?? ''));
      lines.push(`DROP TRIGGER IF EXISTS ${quoteIdentifier(name)};;`);
      lines.push(`${createSql};;`);
    }
    if (triggerRows.length > 0) lines.push('DELIMITER ;', '');

    lines.push('SET UNIQUE_CHECKS=1;');
    lines.push('SET FOREIGN_KEY_CHECKS=1;');
    lines.push('COMMIT;', '');
    lines.push('-- Export summary');
    for (const item of tableCounts) lines.push(`-- ${item.name}: ${item.rows} rows`);
    lines.push(`-- Total tables: ${tables.length}; views: ${views.length}; triggers: ${triggerRows.length}`);
    lines.push('');

    const target = outputPath(database);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, lines.join('\n'), { encoding: 'utf8', mode: 0o600 });
    await connection.rollback();

    const totalRows = tableCounts.reduce((sum, item) => sum + item.rows, 0);
    console.log(JSON.stringify({
      output: target,
      database,
      tables: tables.length,
      views: views.length,
      triggers: triggerRows.length,
      rows: totalRows,
      tableCounts,
    }, null, 2));
  } finally {
    await connection.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
