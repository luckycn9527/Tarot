import { pool } from '../config/database.js';
import type { RowDataPacket } from 'mysql2';

/** 牌背等项按 user_settings.user_id 隔离，非全站共享 */
export async function getSettings(userId: number) {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT us.card_back_id, us.settings_json, cb.code AS card_back_code
     FROM user_settings us
     LEFT JOIN card_backs cb ON us.card_back_id = cb.id
     WHERE us.user_id = ?`,
    [userId],
  );
  if (rows.length === 0) {
    return { cardBack: 'pocket', cardBackId: null, settings: {} };
  }
  const row = rows[0];
  return {
    cardBack: row.card_back_code || 'pocket',
    cardBackId: row.card_back_id || null,
    settings: row.settings_json ? JSON.parse(row.settings_json) : {},
  };
}

export async function resolveCardBackId(code: string): Promise<number | null> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT id FROM card_backs WHERE code = ? LIMIT 1',
    [code],
  );
  return rows[0]?.id ?? null;
}

export async function upsertSettings(
  userId: number,
  cardBackId?: number | null,
  settingsJson?: object,
) {
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT id FROM user_settings WHERE user_id = ?',
    [userId],
  );

  if (rows.length === 0) {
    await pool.execute(
      'INSERT INTO user_settings (user_id, card_back_id, settings_json) VALUES (?, ?, ?)',
      [userId, cardBackId ?? null, settingsJson ? JSON.stringify(settingsJson) : null],
    );
  } else {
    const updates: string[] = [];
    const values: any[] = [];
    if (cardBackId !== undefined) {
      updates.push('card_back_id = ?');
      values.push(cardBackId);
    }
    if (settingsJson !== undefined) {
      updates.push('settings_json = ?');
      values.push(JSON.stringify(settingsJson));
    }
    if (updates.length > 0) {
      values.push(userId);
      await pool.execute(
        `UPDATE user_settings SET ${updates.join(', ')} WHERE user_id = ?`,
        values,
      );
    }
  }
}
