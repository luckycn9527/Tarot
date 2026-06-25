import { createHash } from 'crypto';
import { pool } from '../config/database.js';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function saveRefreshToken(userId: number, token: string, expiresAt: Date): Promise<void> {
  const tokenHash = hashToken(token);
  await pool.execute(
    'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
    [userId, tokenHash, expiresAt]
  );
}

export async function findRefreshToken(token: string): Promise<{ id: number; user_id: number; expires_at: string } | null> {
  const tokenHash = hashToken(token);
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT id, user_id, expires_at FROM refresh_tokens WHERE token = ?',
    [tokenHash]
  );
  return (rows[0] as { id: number; user_id: number; expires_at: string }) || null;
}

export async function deleteRefreshToken(token: string): Promise<void> {
  const tokenHash = hashToken(token);
  await pool.execute('DELETE FROM refresh_tokens WHERE token = ?', [tokenHash]);
}

export async function deleteAllUserTokens(userId: number): Promise<void> {
  await pool.execute('DELETE FROM refresh_tokens WHERE user_id = ?', [userId]);
}

export async function cleanExpiredTokens(): Promise<void> {
  await pool.execute('DELETE FROM refresh_tokens WHERE expires_at < NOW()');
}
