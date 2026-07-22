import { pool } from '../config/database.js';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { v4 as uuidv4 } from 'uuid';
import * as ReadingModel from './reading.model.js';

// === Shares ===
export async function createShare(userId: number, readingId: number) {
  const shareCode = uuidv4().replace(/-/g, '').slice(0, 16);
  await pool.execute(
    'INSERT INTO user_shares (user_id, reading_id, share_code) VALUES (?, ?, ?)',
    [userId, readingId, shareCode],
  );
  return shareCode;
}

export async function getShareByCode(code: string) {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT s.*, r.id AS reading_row_id, r.type, r.question, r.answer, r.result_data, r.created_at AS reading_date
     FROM user_shares s
     JOIN reading_history r ON s.reading_id = r.id
     WHERE s.share_code = ?`,
    [code],
  );
  if (rows.length === 0) return null;

  await pool.execute(
    'UPDATE user_shares SET view_count = view_count + 1 WHERE share_code = ?',
    [code],
  );

  const row = rows[0];
  const readingId = row.reading_row_id as number;
  const { cardIds, orientations } = await ReadingModel.getCardsForReading(readingId);

  return {
    type: row.type,
    question: row.question,
    cardIds,
    orientations,
    answer: row.answer,
    resultData: typeof row.result_data === 'string' ? JSON.parse(row.result_data) : row.result_data,
    readingDate: row.reading_date,
    viewCount: row.view_count + 1,
  };
}

export async function getUserShares(userId: number) {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT s.share_code, s.view_count, s.created_at, r.type, r.question
     FROM user_shares s
     JOIN reading_history r ON s.reading_id = r.id
     WHERE s.user_id = ?
     ORDER BY s.created_at DESC`,
    [userId],
  );
  return rows;
}

export async function deleteShare(userId: number, shareCode: string): Promise<boolean> {
  const [result] = await pool.execute<ResultSetHeader>(
    'DELETE FROM user_shares WHERE user_id = ? AND share_code = ?',
    [userId, shareCode],
  );
  return result.affectedRows > 0;
}

// === Invitations ===
export async function redeemCode(userId: number, code: string) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [codeRows] = await connection.execute<RowDataPacket[]>(
      'SELECT * FROM invitation_codes WHERE code = ? FOR UPDATE',
      [code],
    );
    if (codeRows.length === 0) throw new Error('邀请码不存在');

    const invitation = codeRows[0];
    if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
      throw new Error('邀请码已过期');
    }

    const [redeemed] = await connection.execute<RowDataPacket[]>(
      'SELECT id FROM invitation_redemptions WHERE code_id = ? AND user_id = ? FOR UPDATE',
      [invitation.id, userId],
    );
    if (redeemed.length > 0) throw new Error('您已使用过该邀请码');

    const [reserved] = await connection.execute<ResultSetHeader>(
      'UPDATE invitation_codes SET used_count = used_count + 1 WHERE id = ? AND used_count < max_uses',
      [invitation.id],
    );
    if (reserved.affectedRows === 0) throw new Error('邀请码已被使用完');

    await connection.execute(
      'INSERT INTO invitation_redemptions (code_id, user_id) VALUES (?, ?)',
      [invitation.id, userId],
    );

    if (invitation.type === 'quota') {
      await connection.execute(
        'UPDATE users SET remaining_free_quota = remaining_free_quota + ? WHERE id = ?',
        [invitation.value, userId],
      );
    } else if (invitation.type === 'vip_days') {
      await connection.execute(
        `UPDATE users SET
          membership = 'vip',
          membership_expires_at = GREATEST(COALESCE(membership_expires_at, NOW()), NOW()) + INTERVAL ? DAY
         WHERE id = ?`,
        [invitation.value, userId],
      );
    }

    await connection.commit();
    return {
      type: invitation.type,
      value: invitation.value,
      message: invitation.type === 'quota'
        ? `成功获得 ${invitation.value} 次额外占卜次数`
        : `成功获得 ${invitation.value} 天 VIP 会员`,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// === Feedback ===
export async function createFeedback(data: {
  userId?: number;
  type: string;
  content: string;
  contact?: string;
}) {
  const [result] = await pool.execute<ResultSetHeader>(
    'INSERT INTO feedback (user_id, type, content, contact) VALUES (?, ?, ?, ?)',
    [data.userId || null, data.type, data.content, data.contact || null],
  );
  return result.insertId;
}
