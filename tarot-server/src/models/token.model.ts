import { pool } from '../config/database.js';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';

export async function saveRefreshToken(userId: number, token: string, expiresAt: Date): Promise<void> {
  await pool.execute(
    'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
    [userId, token, expiresAt]
  );
}

export async function findRefreshToken(token: string): Promise<{ id: number; user_id: number; expires_at: string } | null> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT id, user_id, expires_at FROM refresh_tokens WHERE token = ?',
    [token]
  );
  return (rows[0] as any) || null;
}

export async function deleteRefreshToken(token: string): Promise<void> {
  await pool.execute('DELETE FROM refresh_tokens WHERE token = ?', [token]);
}

export async function deleteAllUserTokens(userId: number): Promise<void> {
  await pool.execute('DELETE FROM refresh_tokens WHERE user_id = ?', [userId]);
}

export async function cleanExpiredTokens(): Promise<void> {
  await pool.execute('DELETE FROM refresh_tokens WHERE expires_at < NOW()');
}
