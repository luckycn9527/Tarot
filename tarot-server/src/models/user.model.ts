import { pool } from '../config/database.js';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';
import type { DbUser } from '../types/index.js';

export const DAILY_FREE_QUOTA = 3;

export async function findByEmail(email: string): Promise<DbUser | null> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT * FROM users WHERE LOWER(TRIM(email)) = ? LIMIT 1',
    [email]
  );
  return (rows[0] as DbUser) || null;
}

export async function findByUsername(username: string): Promise<DbUser | null> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT * FROM users WHERE LOWER(TRIM(username)) = ? LIMIT 1',
    [username.trim().toLowerCase()]
  );
  return (rows[0] as DbUser) || null;
}

/** 用户名或邮箱（同一标识符两者皆查），用于「用户名或邮箱 + 密码」登录 */
export async function findByUsernameOrEmail(identifier: string): Promise<DbUser | null> {
  const norm = identifier.trim().toLowerCase();
  if (!norm) return null;
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT * FROM users
     WHERE LOWER(TRIM(email)) = ? OR LOWER(TRIM(username)) = ?
     ORDER BY (LOWER(TRIM(email)) = ?) DESC
     LIMIT 1`,
    [norm, norm, norm]
  );
  return (rows[0] as DbUser) || null;
}

/** 手机号查找（手机号登录预留） */
export async function findByPhone(phone: string): Promise<DbUser | null> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT * FROM users WHERE phone = ? LIMIT 1',
    [phone.trim()]
  );
  return (rows[0] as DbUser) || null;
}

export async function findByGoogleId(googleId: string): Promise<DbUser | null> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT * FROM users WHERE google_id = ? LIMIT 1',
    [googleId]
  );
  return (rows[0] as DbUser) || null;
}

export async function findById(id: number): Promise<DbUser | null> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT * FROM users WHERE id = ?',
    [id]
  );
  return (rows[0] as DbUser) || null;
}

export async function create(data: {
  email: string;
  nickname: string;
  passwordHash: string | null;
  avatar?: string | null;
  googleId?: string | null;
  username?: string | null;
  phone?: string | null;
}): Promise<number> {
  const [result] = await pool.execute<ResultSetHeader>(
    'INSERT INTO users (email, username, phone, nickname, password_hash, avatar, google_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [
      data.email.trim().toLowerCase(),
      data.username ? data.username.trim().toLowerCase() : null,
      data.phone ? data.phone.trim() : null,
      data.nickname,
      data.passwordHash,
      data.avatar ?? '🔮',
      data.googleId ?? null,
    ]
  );
  return result.insertId;
}

export async function setGoogleId(userId: number, googleId: string): Promise<void> {
  await pool.execute('UPDATE users SET google_id = ? WHERE id = ?', [googleId, userId]);
}

export async function updateProfile(
  id: number,
  data: Partial<{
    nickname: string;
    avatar: string;
    gender: string;
    birthday: string | null;
    zodiac_sign: string | null;
    location: string | null;
    bio: string | null;
  }>
): Promise<void> {
  const fields: string[] = [];
  const values: any[] = [];

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  }

  if (fields.length === 0) return;
  values.push(id);
  await pool.execute(
    `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
    values
  );
}

export async function updatePassword(id: number, passwordHash: string): Promise<void> {
  await pool.execute(
    'UPDATE users SET password_hash = ? WHERE id = ?',
    [passwordHash, id]
  );
}

/**
 * 原子性检查并扣减用户免费配额。
 * 在同一事务中完成：重置过期配额 → VIP 判断 → 扣减 1 次。
 * 返回 'vip'（VIP 用户不扣减）、'ok'（成功扣减）、'exhausted'（配额不足）、'not_found'（用户不存在）。
 */
export async function consumeQuota(id: number): Promise<'vip' | 'ok' | 'exhausted' | 'not_found'> {
  const today = new Date().toISOString().slice(0, 10);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. 若配额已过期，先原子重置为 3 次
    await connection.execute(
      'UPDATE users SET remaining_free_quota = ?, quota_reset_date = ? WHERE id = ? AND (quota_reset_date IS NULL OR quota_reset_date < ?)',
      [DAILY_FREE_QUOTA, today, id, today]
    );

    // 2. VIP 用户直接放行，不扣减
    const [vipRows] = await connection.execute<RowDataPacket[]>(
      'SELECT 1 FROM users WHERE id = ? AND membership = ? AND membership_expires_at > NOW()',
      [id, 'vip']
    );
    if (vipRows.length > 0) {
      await connection.commit();
      return 'vip';
    }

    // 3. 原子扣减：仅当 remaining_free_quota > 0 时才扣减
    const [result] = await connection.execute<ResultSetHeader>(
      'UPDATE users SET remaining_free_quota = remaining_free_quota - 1 WHERE id = ? AND remaining_free_quota > 0',
      [id]
    );

    if (result.affectedRows === 0) {
      await connection.commit();
      return 'exhausted';
    }

    await connection.commit();
    return 'ok';
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

export async function refundQuota(id: number): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  await pool.execute(
    `UPDATE users
     SET remaining_free_quota = LEAST(remaining_free_quota + 1, ?)
     WHERE id = ?
       AND membership = 'free'
       AND quota_reset_date = ?`,
    [DAILY_FREE_QUOTA, id, today],
  );
}

/**
 * 若用户每日配额已过期，则原子重置为 3 次。
 * 用于 getProfile / getQuota 等只读接口，确保前端看到最新剩余次数。
 */
export async function resetQuotaIfNeeded(id: number): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  await pool.execute(
    'UPDATE users SET remaining_free_quota = ?, quota_reset_date = ? WHERE id = ? AND (quota_reset_date IS NULL OR quota_reset_date < ?)',
    [DAILY_FREE_QUOTA, today, id, today]
  );
}

/**
 * 吊销用户所有已签发的 access token。
 * 将 access_token_revoked_at 设为当前时间，此后 iat 小于等于该时间的 token 均失效。
 */
export async function revokeAccessTokens(id: number): Promise<void> {
  await pool.execute(
    'UPDATE users SET access_token_revoked_at = NOW() WHERE id = ?',
    [id]
  );
}
