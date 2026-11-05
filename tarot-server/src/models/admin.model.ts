import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { repairUtf8Mojibake } from '../utils/fixMojibakeUtf8.js';
import { pool } from '../config/database.js';
import type { PoolConnection } from 'mysql2/promise';
import { latestQuestionsForUsers, literalLike } from './adminUserQuestions.model.js';
import { env } from '../config/env.js';
import { businessDayRange } from '../utils/quotaDate.js';

export interface DbAdminUser extends RowDataPacket {
  id: number;
  username_hash: string;
  password_hash: string;
  display_name: string;
  is_active: number;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminConfigCardBack extends RowDataPacket {
  id: number;
  code: string;
  name: string;
  description: string | null;
  asset_url: string | null;
  is_active: number;
  access_type: 'free' | 'vip' | 'paid';
  price: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface AdminConfigCard extends RowDataPacket {
  id: number;
  name: string;
  name_en: string;
  upright_keywords: string;
  reversed_keywords: string;
  yes_no_tendency: 'yes' | 'no' | 'neutral';
  image_url: string | null;
  is_active: number;
}

export interface AdminReaderPrompt extends RowDataPacket {
  id: number;
  reader_code: string;
  display_name: string | null;
  avatar_url: string | null;
  emoji: string | null;
  access_level: 'free' | 'vip' | null;
  system_prompt: string;
  greeting: string;
  updated_at: string;
}

export interface AdminFeaturedReader extends RowDataPacket {
  id: number;
  reader_code: string;
  sort_order: number;
  is_active: number;
  updated_at: string;
}

export interface AdminInvitationCode extends RowDataPacket {
  id: number;
  code: string;
  type: 'quota' | 'vip_days';
  value: number;
  max_uses: number;
  used_count: number;
  expires_at: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export async function findAdminByUsernameHash(usernameHash: string): Promise<DbAdminUser | null> {
  const [rows] = await pool.execute<DbAdminUser[]>(
    'SELECT * FROM admin_users WHERE username_hash = ? LIMIT 1',
    [usernameHash],
  );
  return rows[0] || null;
}

/** 鉴权中间件用：仅查是否仍存在且启用 */
export async function findAdminActiveById(id: number): Promise<Pick<DbAdminUser, 'id' | 'is_active'> | null> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT id, is_active FROM admin_users WHERE id = ? LIMIT 1',
    [id],
  );
  const row = rows[0] as { id: number; is_active: number } | undefined;
  if (!row) return null;
  return { id: row.id, is_active: row.is_active };
}

export async function touchAdminLastLogin(id: number): Promise<void> {
  await pool.execute('UPDATE admin_users SET last_login_at = NOW() WHERE id = ?', [id]);
}

export async function listUsers(params: { page: number; pageSize: number; keyword?: string; sort?: 'newest' | 'last-login' }) {
  const { keyword } = params;
  const pageSize = Math.min(100, Math.max(1, Math.trunc(params.pageSize) || 20));
  const like = keyword ? literalLike(keyword) : null;

  const where = keyword
    ? 'WHERE email LIKE ? OR nickname LIKE ? OR username LIKE ? OR CAST(id AS CHAR) = ?'
    : '';

  const args = keyword ? [like, like, like, keyword] : [];
  const [countRows] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM users ${where}`,
    args,
  );
  const total = Number(countRows[0]?.total || 0);
  const totalPages = Math.ceil(total / pageSize);
  const page = Math.min(Math.max(1, Math.trunc(params.page) || 1), Math.max(1, totalPages));
  const offset = (page - 1) * pageSize;

  // mysql2 execute() (prepared statements) has issues with LIMIT/OFFSET params — use query() instead
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, email, username, nickname, avatar, membership, membership_expires_at, remaining_free_quota, created_at, updated_at, last_login_at
     FROM users ${where}
     ORDER BY ${params.sort === 'last-login' ? 'last_login_at DESC, id DESC' : 'id DESC'}
     LIMIT ${Number(pageSize)} OFFSET ${Number(offset)}`,
    args,
  );

  const summaries = await latestQuestionsForUsers(rows.map(row => Number(row.id)));
  return { total, page, pageSize, totalPages, rows: rows.map(row => ({ ...row, latestQuestion: summaries.get(Number(row.id)) ?? null })) };
}

export async function updateUserByAdmin(
  userId: number,
  patch: Partial<{
    nickname: string;
    avatar: string;
    membership: 'free' | 'vip';
    membership_expires_at: string | null;
    remaining_free_quota: number;
  }>,
): Promise<void> {
  const fields: string[] = [];
  const values: any[] = [];

  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  }
  if (!fields.length) return;
  values.push(userId);
  await pool.execute(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
}

export async function listInvitationCodes(): Promise<AdminInvitationCode[]> {
  const [rows] = await pool.execute<AdminInvitationCode[]>(
    `SELECT id, code, type, value, max_uses, used_count, expires_at, is_active, created_at, updated_at
     FROM invitation_codes
     ORDER BY id DESC
     LIMIT 500`,
  );
  return rows;
}

export async function createInvitationCode(input: {
  code: string;
  type: 'quota' | 'vip_days';
  value: number;
  maxUses: number;
  expiresAt: Date | null;
}): Promise<number> {
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO invitation_codes (code, type, value, max_uses, expires_at, is_active)
     VALUES (?, ?, ?, ?, ?, 1)`,
    [input.code, input.type, input.value, input.maxUses, input.expiresAt],
  );
  return result.insertId;
}

export async function setInvitationCodeActive(id: number, isActive: boolean): Promise<boolean> {
  const [result] = await pool.execute<ResultSetHeader>(
    'UPDATE invitation_codes SET is_active = ? WHERE id = ?',
    [isActive ? 1 : 0, id],
  );
  return result.affectedRows > 0;
}

export async function listCardBacks(connection?: PoolConnection): Promise<AdminConfigCardBack[]> {
  const [rows] = await (connection ?? pool).execute<AdminConfigCardBack[]>(
    `SELECT id, code, name, description, asset_url, is_active, access_type, price, sort_order, created_at, updated_at
     FROM card_backs ORDER BY sort_order ASC, id ASC`,
  );
  return rows;
}

export async function upsertCardBacks(items: Array<{
  code: string;
  name: string;
  description: string | null;
  assetUrl: string | null;
  isActive: boolean;
  accessType: 'free' | 'vip' | 'paid';
  price: number | null;
  sortOrder: number;
}>, connection?: PoolConnection): Promise<void> {
  const conn = connection ?? await pool.getConnection();
  try {
    if (!connection) await conn.beginTransaction();
    for (const item of items) {
      await conn.execute(
        `INSERT INTO card_backs (code, name, description, asset_url, is_active, access_type, price, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           name = VALUES(name),
           description = VALUES(description),
           asset_url = VALUES(asset_url),
           is_active = VALUES(is_active),
           access_type = VALUES(access_type),
           price = VALUES(price),
           sort_order = VALUES(sort_order)`,
        [item.code, item.name, item.description ?? null, item.assetUrl ?? null, item.isActive ? 1 : 0, item.accessType, item.price ?? null, item.sortOrder],
      );
    }
    if (!connection) await conn.commit();
  } catch (e) {
    if (!connection) await conn.rollback();
    throw e;
  } finally {
    if (!connection) conn.release();
  }
}

export async function deleteCardBack(id: number): Promise<void> {
  await pool.execute('DELETE FROM card_backs WHERE id = ?', [id]);
}

export async function listUserCardBacks(userId: number): Promise<RowDataPacket[]> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT ucb.card_back_id, ucb.purchased_at
     FROM user_card_backs ucb
     WHERE ucb.user_id = ?`,
    [userId],
  );
  return rows;
}

export async function grantUserCardBack(userId: number, cardBackId: number): Promise<void> {
  await pool.execute(
    `INSERT IGNORE INTO user_card_backs (user_id, card_back_id) VALUES (?, ?)`,
    [userId, cardBackId],
  );
}

export async function listTarotCardsConfig(connection?: PoolConnection): Promise<AdminConfigCard[]> {
  const [rows] = await (connection ?? pool).execute<AdminConfigCard[]>(
    `SELECT id, name, name_en, upright_keywords, reversed_keywords, yes_no_tendency, image_url, is_active
     FROM tarot_cards_config
     ORDER BY id ASC`,
  );
  return rows;
}

export async function upsertTarotCardsConfig(items: Array<{
  id: number;
  name: string;
  nameEn: string;
  uprightKeywords: string;
  reversedKeywords: string;
  yesNoTendency: 'yes' | 'no' | 'neutral';
  imageUrl: string | null;
  isActive: boolean;
}>, connection?: PoolConnection): Promise<void> {
  const conn = connection ?? await pool.getConnection();
  try {
    if (!connection) await conn.beginTransaction();
    for (const c of items) {
      await conn.execute(
        `INSERT INTO tarot_cards_config
          (id, name, name_en, upright_keywords, reversed_keywords, yes_no_tendency, image_url, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           name = VALUES(name),
           name_en = VALUES(name_en),
           upright_keywords = VALUES(upright_keywords),
           reversed_keywords = VALUES(reversed_keywords),
           yes_no_tendency = VALUES(yes_no_tendency),
           image_url = VALUES(image_url),
           is_active = VALUES(is_active)`,
        [c.id, c.name, c.nameEn, c.uprightKeywords, c.reversedKeywords, c.yesNoTendency, c.imageUrl ?? null, c.isActive ? 1 : 0],
      );
    }
    if (!connection) await conn.commit();
  } catch (e) {
    if (!connection) await conn.rollback();
    throw e;
  } finally {
    if (!connection) conn.release();
  }
}

export async function listReaderPromptsConfig(connection?: PoolConnection): Promise<AdminReaderPrompt[]> {
  const [rows] = await (connection ?? pool).execute<AdminReaderPrompt[]>(
    `SELECT id, reader_code, display_name, avatar_url, emoji, access_level,
            system_prompt, greeting, updated_at
     FROM reader_prompts_config ORDER BY reader_code ASC`,
  );
  return rows;
}

export async function upsertReaderPromptsConfig(items: Array<{
  readerCode: string;
  displayName: string | null;
  avatarUrl: string | null;
  emoji: string | null;
  accessLevel: 'free' | 'vip' | null;
  systemPrompt: string;
  greeting: string;
}>, connection?: PoolConnection): Promise<void> {
  const conn = connection ?? await pool.getConnection();
  try {
    if (!connection) await conn.beginTransaction();
    for (const item of items) {
      // reader_prompts_config.reader_code 外键引用 reference_tarot_readers；旧库可能只有历史 code
      await conn.execute(
        `INSERT IGNORE INTO reference_tarot_readers (code, display_name) VALUES (?, ?)`,
        [item.readerCode, item.displayName?.trim() || item.readerCode],
      );
      await conn.execute(
        `INSERT INTO reader_prompts_config
          (reader_code, display_name, avatar_url, emoji, access_level, system_prompt, greeting)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           display_name = VALUES(display_name),
           avatar_url = VALUES(avatar_url),
           emoji = VALUES(emoji),
           access_level = VALUES(access_level),
           system_prompt = VALUES(system_prompt),
           greeting = VALUES(greeting)`,
        [
          item.readerCode,
          item.displayName ?? null,
          item.avatarUrl ?? null,
          item.emoji ?? null,
          item.accessLevel ?? null,
          item.systemPrompt,
          item.greeting,
        ],
      );
    }
    if (!connection) await conn.commit();
  } catch (e) {
    if (!connection) await conn.rollback();
    throw e;
  } finally {
    if (!connection) conn.release();
  }
}

export async function findReaderPromptByCode(readerCode: string): Promise<AdminReaderPrompt | null> {
  const [rows] = await pool.execute<AdminReaderPrompt[]>(
    `SELECT id, reader_code, display_name, avatar_url, emoji, access_level,
            system_prompt, greeting, updated_at
     FROM reader_prompts_config WHERE reader_code = ? LIMIT 1`,
    [readerCode],
  );
  return rows[0] || null;
}

export async function listFeaturedReadersConfig(connection?: PoolConnection): Promise<AdminFeaturedReader[]> {
  const [rows] = await (connection ?? pool).execute<AdminFeaturedReader[]>(
    `SELECT id, reader_code, sort_order, is_active, updated_at
     FROM featured_readers ORDER BY sort_order ASC, reader_code ASC`,
  );
  return rows;
}

export async function upsertFeaturedReadersConfig(items: Array<{
  readerCode: string;
  sortOrder: number;
  isActive: boolean;
}>, connection?: PoolConnection): Promise<void> {
  const conn = connection ?? await pool.getConnection();
  try {
    if (!connection) await conn.beginTransaction();
    for (const item of items) {
      await conn.execute(
        `INSERT INTO featured_readers (reader_code, sort_order, is_active)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE
           sort_order = VALUES(sort_order),
           is_active = VALUES(is_active)`,
        [item.readerCode, item.sortOrder, item.isActive ? 1 : 0],
      );
    }
    if (!connection) await conn.commit();
  } catch (e) {
    if (!connection) await conn.rollback();
    throw e;
  } finally {
    if (!connection) conn.release();
  }
}

export async function getStats(now = new Date(), timeZone = env.QUOTA_TIME_ZONE) {
  const day = businessDayRange(timeZone, now);
  const bounds = [new Date(day.startsAt), new Date(day.resetsAt)];
  const [[userStats]] = await pool.execute<RowDataPacket[]>(
    `SELECT
       COUNT(*) AS totalUsers,
       SUM(CASE WHEN created_at >= ? AND created_at < ? THEN 1 ELSE 0 END) AS todayUsers
     FROM users`, bounds,
  );
  const [[readingStats]] = await pool.execute<RowDataPacket[]>(
    `SELECT SUM(total_count) AS totalReadings, SUM(today_count) AS todayReadings FROM (
       SELECT COUNT(*) AS total_count,
         SUM(CASE WHEN created_at >= ? AND created_at < ? THEN 1 ELSE 0 END) AS today_count FROM reading_history
       UNION ALL
       SELECT COUNT(*) AS total_count,
         SUM(CASE WHEN created_at >= ? AND created_at < ? THEN 1 ELSE 0 END) AS today_count FROM fate_conflicts
     ) counts`, [...bounds, ...bounds],
  );
  const [[feedbackStats]] = await pool.execute<RowDataPacket[]>(
    `SELECT
       COUNT(*) AS totalFeedback,
       SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pendingFeedback
     FROM feedback`
  );
  return {
    businessDate: day.businessDate,
    timeZone: day.timeZone,
    totalUsers: Number(userStats?.totalUsers || 0),
    todayUsers: Number(userStats?.todayUsers || 0),
    totalReadings: Number(readingStats?.totalReadings || 0),
    todayReadings: Number(readingStats?.todayReadings || 0),
    totalFeedback: Number(feedbackStats?.totalFeedback || 0),
    pendingFeedback: Number(feedbackStats?.pendingFeedback || 0),
  };
}

export async function listFeedback(params: { page: number; pageSize: number; status?: string }) {
  const { page, pageSize, status } = params;
  const offset = (page - 1) * pageSize;
  const where = status ? 'WHERE f.status = ?' : '';
  const args: any[] = status ? [status] : [];

  const [countRows] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM feedback f ${where}`, args
  );
  const total = Number(countRows[0]?.total || 0);

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT f.id, f.user_id, f.type, f.content, f.contact, f.status, f.admin_reply, f.created_at, f.updated_at,
            u.email AS user_email, u.nickname AS user_nickname
     FROM feedback f
     LEFT JOIN users u ON f.user_id = u.id
     ${where}
     ORDER BY f.created_at DESC
     LIMIT ${Number(pageSize)} OFFSET ${Number(offset)}`,
    args
  );
  const repaired = rows.map((r) => ({
    ...r,
    type: typeof r.type === 'string' ? repairUtf8Mojibake(r.type) : r.type,
    content: repairUtf8Mojibake(String(r.content ?? '')),
    contact: r.contact == null ? r.contact : repairUtf8Mojibake(String(r.contact)),
    admin_reply: r.admin_reply == null ? r.admin_reply : repairUtf8Mojibake(String(r.admin_reply)),
    user_email: r.user_email == null ? r.user_email : repairUtf8Mojibake(String(r.user_email)),
    user_nickname: r.user_nickname == null ? r.user_nickname : repairUtf8Mojibake(String(r.user_nickname)),
  }));
  return { total, rows: repaired };
}

export async function replyFeedback(id: number, adminReply: string, status: string): Promise<void> {
  await pool.execute(
    'UPDATE feedback SET admin_reply = ?, status = ? WHERE id = ?',
    [adminReply, status, id]
  );
}
