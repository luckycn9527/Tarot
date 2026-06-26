import { pool } from '../config/database.js';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';

const CODE_TTL_MINUTES = 10;

export async function createVerificationCode(
  email: string,
  code: string,
  purpose: 'register' = 'register',
): Promise<void> {
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000);
  await pool.execute(
    'INSERT INTO email_verification_codes (email, code, purpose, expires_at) VALUES (?, ?, ?, ?)',
    [email, code, purpose, expiresAt],
  );
}

export async function findValidCode(
  email: string,
  code: string,
  purpose: 'register' = 'register',
): Promise<{ id: number } | null> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT id FROM email_verification_codes WHERE email = ? AND code = ? AND purpose = ? AND used = FALSE AND expires_at > NOW() LIMIT 1',
    [email, code, purpose],
  );
  return (rows[0] as { id: number }) || null;
}

export async function markCodeUsed(id: number): Promise<void> {
  await pool.execute(
    'UPDATE email_verification_codes SET used = TRUE WHERE id = ?',
    [id],
  );
}

/** 清理该邮箱同一目的下的所有旧验证码 */
export async function invalidateExistingCodes(
  email: string,
  purpose: 'register' = 'register',
): Promise<void> {
  await pool.execute(
    'UPDATE email_verification_codes SET used = TRUE WHERE email = ? AND purpose = ? AND used = FALSE',
    [email, purpose],
  );
}

/** 检查该邮箱在指定时间窗口内发送次数 */
export async function countRecentCodes(
  email: string,
  purpose: 'register' = 'register',
  windowMinutes = 60,
): Promise<number> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT COUNT(*) AS cnt FROM email_verification_codes WHERE email = ? AND purpose = ? AND created_at > DATE_SUB(NOW(), INTERVAL ? MINUTE)',
    [email, purpose, windowMinutes],
  );
  return (rows[0] as { cnt: number }).cnt ?? 0;
}

/** 查找最近一条未使用且未过期的验证码 */
export async function findLatestUnusedCode(
  email: string,
  purpose: 'register' = 'register',
): Promise<{ code: string; created_at: string } | null> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT code, created_at FROM email_verification_codes WHERE email = ? AND purpose = ? AND used = FALSE AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1',
    [email, purpose],
  );
  return (rows[0] as { code: string; created_at: string }) || null;
}

export async function cleanExpiredCodes(): Promise<void> {
  await pool.execute('DELETE FROM email_verification_codes WHERE expires_at < NOW()');
}
