import { pool } from '../config/database.js';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';

function trunc(s: string | null | undefined, max: number): string | null {
  if (s == null || s === '') return s ?? null;
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '…';
}

export async function insertBaziResult(data: {
  userId: number;
  birthDate: string;
  birthTime: string | null;
  fiveElementsJson: object | null;
  luckTrend: string | null;
  keywords: string | null;
  analysisText: string;
  question: string;
  category: string;
}): Promise<number> {
  const [r] = await pool.execute<ResultSetHeader>(
    `INSERT INTO bazi_results
     (user_id, birth_date, birth_time, five_elements_json, luck_trend, keywords, analysis_text, question, category)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.userId,
      data.birthDate,
      data.birthTime,
      data.fiveElementsJson ? JSON.stringify(data.fiveElementsJson) : null,
      trunc(data.luckTrend, 100),
      trunc(data.keywords, 255),
      data.analysisText,
      trunc(data.question, 500),
      trunc(data.category, 32),
    ],
  );
  return r.insertId;
}

export async function insertTarotResult(data: {
  userId: number;
  card1: string;
  card2: string;
  card3: string;
  card1En: string;
  card2En: string;
  card3En: string;
  orient1: string;
  orient2: string;
  orient3: string;
  positions: string;
  meaningText: string;
  question: string;
  category: string;
}): Promise<number> {
  const [r] = await pool.execute<ResultSetHeader>(
    `INSERT INTO tarot_results
     (user_id, card_1, card_2, card_3, card_1_en, card_2_en, card_3_en,
      orient_1, orient_2, orient_3, positions, meaning_text, question, category)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.userId,
      trunc(data.card1, 80),
      trunc(data.card2, 80),
      trunc(data.card3, 80),
      trunc(data.card1En, 80),
      trunc(data.card2En, 80),
      trunc(data.card3En, 80),
      trunc(data.orient1, 16),
      trunc(data.orient2, 16),
      trunc(data.orient3, 16),
      trunc(data.positions, 80),
      data.meaningText,
      trunc(data.question, 500),
      trunc(data.category, 32),
    ],
  );
  return r.insertId;
}

export async function insertFateConflict(data: {
  userId: number;
  baziId: number;
  tarotId: number;
  conflictType: string;
  conflictLevel: string | null;
  summaryText: string;
  pathStableText: string;
  pathAdventureText: string;
}): Promise<number> {
  const [r] = await pool.execute<ResultSetHeader>(
    `INSERT INTO fate_conflicts
     (user_id, bazi_id, tarot_id, conflict_type, conflict_level, summary_text, path_stable_text, path_adventure_text)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.userId,
      data.baziId,
      data.tarotId,
      trunc(data.conflictType, 32),
      trunc(data.conflictLevel, 32),
      data.summaryText,
      data.pathStableText,
      data.pathAdventureText,
    ],
  );
  return r.insertId;
}

export async function insertFateChoice(data: {
  userId: number;
  conflictId: number;
  choiceType: string;
  resultPathText: string;
}): Promise<number> {
  const [r] = await pool.execute<ResultSetHeader>(
    `INSERT INTO fate_choices (user_id, conflict_id, choice_type, result_path_text)
     VALUES (?, ?, ?, ?)`,
    [data.userId, data.conflictId, trunc(data.choiceType, 16), data.resultPathText],
  );
  return r.insertId;
}

export async function findConflictForUser(
  conflictId: number,
  userId: number,
): Promise<RowDataPacket | null> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, path_stable_text, path_adventure_text, summary_text, conflict_type
     FROM fate_conflicts WHERE id = ? AND user_id = ?`,
    [conflictId, userId],
  );
  return rows[0] ?? null;
}

export async function getChoiceByConflictId(conflictId: number): Promise<RowDataPacket | null> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT * FROM fate_choices WHERE conflict_id = ?',
    [conflictId],
  );
  return rows[0] ?? null;
}

export async function listFateHistory(userId: number, limit: number): Promise<RowDataPacket[]> {
  let lim = Math.trunc(Number(limit));
  if (!Number.isFinite(lim)) lim = 20;
  lim = Math.min(Math.max(lim, 1), 50);
  // mysql2 的 execute + LIMIT ? 在部分 MySQL/驱动组合下会报错，改用已校验的整数拼接
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
       fc.id AS conflict_id,
       fc.summary_text,
       fc.conflict_type,
       fc.created_at AS analyzed_at,
       b.keywords AS bazi_keywords,
       t.card_1, t.card_2, t.card_3,
       ch.choice_type,
       ch.result_path_text,
       ch.created_at AS chosen_at
     FROM fate_conflicts fc
     JOIN bazi_results b ON b.id = fc.bazi_id
     JOIN tarot_results t ON t.id = fc.tarot_id
     LEFT JOIN fate_choices ch ON ch.conflict_id = fc.id
     WHERE fc.user_id = ?
     ORDER BY fc.created_at DESC
     LIMIT ${lim}`,
    [userId],
  );
  return rows;
}
