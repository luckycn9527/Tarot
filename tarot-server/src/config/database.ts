import mysql from 'mysql2/promise';
import { env } from './env.js';

export const pool = mysql.createPool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: '+08:00',
  // 避免中文牌背名/描述等在连接层被当成 latin1 读写成乱码
  charset: 'utf8mb4',
});

export async function testConnection(): Promise<void> {
  const conn = await pool.getConnection();
  try {
    await conn.ping();
    console.log('✅ MySQL connected');
  } finally {
    conn.release();
  }
}
