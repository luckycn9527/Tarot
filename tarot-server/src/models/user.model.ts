import { pool } from '../config/database.js';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';
import type { DbUser } from '../types/index.js';

export async function findByEmail(email: string): Promise<DbUser | null> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT * FROM users WHERE LOWER(TRIM(email)) = ? LIMIT 1',
    [email]
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
}): Promise<number> {
  const [result] = await pool.execute<ResultSetHeader>(
    'INSERT INTO users (email, nickname, password_hash, avatar, google_id) VALUES (?, ?, ?, ?, ?)',
    [
      data.email.trim().toLowerCase(),
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

export async function decrementQuota(id: number): Promise<void> {
  await pool.execute(
    'UPDATE users SET remaining_free_quota = GREATEST(remaining_free_quota - 1, 0) WHERE id = ?',
    [id]
  );
}
