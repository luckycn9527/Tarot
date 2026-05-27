import { pool } from '../config/database.js';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';

export type PasswordResetRow = RowDataPacket & {
  id: number;
  user_id: number;
  token_hash: string;
  expires_at: Date;
  used_at: Date | null;
};

export async function insertPasswordResetToken(
  userId: number,
  tokenHash: string,
  expiresAt: Date,
): Promise<void> {
  await pool.execute(
    'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
    [userId, tokenHash, expiresAt],
  );
}

export async function findValidPasswordResetByHash(
  tokenHash: string,
): Promise<PasswordResetRow | null> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT * FROM password_reset_tokens
     WHERE token_hash = ? AND used_at IS NULL AND expires_at > NOW()
     LIMIT 1`,
    [tokenHash],
  );
  return (rows[0] as PasswordResetRow | undefined) ?? null;
}

export async function markPasswordResetTokenUsed(id: number): Promise<void> {
  await pool.execute<ResultSetHeader>(
    'UPDATE password_reset_tokens SET used_at = NOW() WHERE id = ?',
    [id],
  );
}

/** 同一用户未使用的旧令牌作废，减少重放窗口 */
export async function invalidateUnusedTokensForUser(userId: number): Promise<void> {
  await pool.execute(
    'UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL',
    [userId],
  );
}
