import { pool } from '../config/database.js';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';
import type { PoolConnection } from 'mysql2/promise';

let readerCodeToIdCache: Map<string, number> | null = null;
let spreadCodeToIdCache: Map<string, number> | null = null;

async function getReaderCodeToIdMap(connection?: PoolConnection): Promise<Map<string, number>> {
  if (!readerCodeToIdCache) {
    const [rows] = await (connection ?? pool).execute<RowDataPacket[]>('SELECT id, code FROM reference_tarot_readers');
    readerCodeToIdCache = new Map(rows.map((r) => [r.code as string, r.id as number]));
  }
  return readerCodeToIdCache;
}

async function getSpreadCodeToIdMap(connection?: PoolConnection): Promise<Map<string, number>> {
  if (!spreadCodeToIdCache) {
    const [rows] = await (connection ?? pool).execute<RowDataPacket[]>('SELECT id, code FROM reference_spreads');
    spreadCodeToIdCache = new Map(rows.map((r) => [r.code as string, r.id as number]));
  }
  return spreadCodeToIdCache;
}

export async function resolveReaderRefId(code: string | null | undefined, connection?: PoolConnection): Promise<number | null> {
  if (!code) return null;
  const m = await getReaderCodeToIdMap(connection);
  return m.get(code) ?? null;
}

export async function resolveSpreadId(code: string | null | undefined, connection?: PoolConnection): Promise<number | null> {
  if (!code) return null;
  const m = await getSpreadCodeToIdMap(connection);
  return m.get(code) ?? null;
}

type CardRow = { reading_id: number; position_order: number; card_id: number; orientation: string };

async function loadCardsByReadingIds(readingIds: number[]): Promise<Map<number, { cardIds: number[]; orientations: string[] }>> {
  const map = new Map<number, { cardIds: number[]; orientations: string[] }>();
  if (readingIds.length === 0) return map;
  const placeholders = readingIds.map(() => '?').join(',');
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT reading_id, position_order, card_id, orientation
     FROM reading_history_cards WHERE reading_id IN (${placeholders})
     ORDER BY reading_id, position_order`,
    readingIds
  );
  for (const r of rows as CardRow[]) {
    let entry = map.get(r.reading_id);
    if (!entry) {
      entry = { cardIds: [], orientations: [] };
      map.set(r.reading_id, entry);
    }
    entry.cardIds.push(r.card_id);
    entry.orientations.push(r.orientation);
  }
  return map;
}

function formatRowBase(row: RowDataPacket, cards: { cardIds: number[]; orientations: string[] }) {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    question: row.question,
    cardIds: cards.cardIds,
    orientations: cards.orientations,
    answer: row.answer,
    resultData: typeof row.result_data === 'string' ? JSON.parse(row.result_data) : row.result_data,
    readerId: row.reader_code || null,
    spreadType: row.spread_code || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function create(data: {
  userId: number;
  type: string;
  question: string | null;
  cardIds: number[];
  orientations: string[];
  answer: string | null;
  resultData: object;
  readerId?: string | null;
  spreadType?: string | null;
}, connection?: PoolConnection) {
  const readerRefId = await resolveReaderRefId(data.readerId, connection);
  const spreadId = await resolveSpreadId(data.spreadType, connection);

  const conn = connection ?? await pool.getConnection();
  try {
    if (!connection) await conn.beginTransaction();
    const [result] = await conn.execute<ResultSetHeader>(
      `INSERT INTO reading_history (user_id, type, question, answer, result_data, reader_ref_id, spread_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        data.userId,
        data.type,
        data.question,
        data.answer,
        JSON.stringify(data.resultData),
        readerRefId,
        spreadId,
      ]
    );
    const readingId = result.insertId;
    for (let i = 0; i < data.cardIds.length; i++) {
      const orientation = (data.orientations[i] ?? 'upright').slice(0, 20);
      await conn.execute(
        `INSERT INTO reading_history_cards (reading_id, position_order, card_id, orientation)
         VALUES (?, ?, ?, ?)`,
        [readingId, i + 1, data.cardIds[i], orientation]
      );
    }
    if (!connection) await conn.commit();
    return readingId;
  } catch (e) {
    if (!connection) await conn.rollback();
    throw e;
  } finally {
    if (!connection) conn.release();
  }
}

export async function findByUserId(
  userId: number,
  options: {
    page?: number;
    limit?: number;
    type?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
  } = {}
) {
  const { page = 1, limit = 20, type, search, dateFrom, dateTo } = options;
  // LIMIT/OFFSET 经校验后直接拼接：mysql2 的 execute 在部分 MySQL/驱动组合下
  // 无法把 LIMIT ?/OFFSET ? 作为占位符（会以字符串绑定导致语法错误），与 fate.model 保持一致。
  const safeLimit = Math.min(Math.max(Math.trunc(Number(limit)) || 20, 1), 100);
  const requestedPage = Math.max(Math.trunc(Number(page)) || 1, 1);

  let where = 'WHERE rh.user_id = ?'
  const params: (string | number)[] = [userId];

  // 每日运势不计入历史（只展示有问题的塔罗占卜）
  where += " AND rh.type <> 'daily-fortune'";

  if (type) {
    where += ' AND rh.type = ?';
    params.push(type);
  }
  if (search) {
    where += ' AND rh.question LIKE ?';
    params.push(`%${search}%`);
  }
  if (dateFrom) {
    where += ' AND rh.created_at >= ?';
    params.push(dateFrom);
  }
  if (dateTo) {
    where += ' AND rh.created_at <= ?';
    params.push(dateTo + ' 23:59:59');
  }

  const [countRows] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) as total FROM reading_history rh ${where}`,
    params
  );
  const total = countRows[0].total as number;
  const totalPages = Math.ceil(total / safeLimit);
  const safePage = Math.min(requestedPage, Math.max(totalPages, 1));
  const offset = (safePage - 1) * safeLimit;

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT rh.*, rr.code AS reader_code, rs.code AS spread_code
     FROM reading_history rh
     LEFT JOIN reference_tarot_readers rr ON rh.reader_ref_id = rr.id
     LEFT JOIN reference_spreads rs ON rh.spread_id = rs.id
     ${where} ORDER BY rh.created_at DESC, rh.id DESC LIMIT ${safeLimit} OFFSET ${offset}`,
    params
  );

  const ids = (rows as RowDataPacket[]).map((r) => r.id as number);
  const cardsMap = await loadCardsByReadingIds(ids);

  return {
    items: (rows as RowDataPacket[]).map((row) =>
      formatRowBase(row, cardsMap.get(row.id as number) ?? { cardIds: [], orientations: [] })
    ),
    total,
    page: safePage,
    totalPages,
  };
}

export async function findById(id: number, userId: number) {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT rh.*, rr.code AS reader_code, rs.code AS spread_code
     FROM reading_history rh
     LEFT JOIN reference_tarot_readers rr ON rh.reader_ref_id = rr.id
     LEFT JOIN reference_spreads rs ON rh.spread_id = rs.id
     WHERE rh.id = ? AND rh.user_id = ?`,
    [id, userId]
  );
  const row = rows[0];
  if (!row) return null;
  const cardsMap = await loadCardsByReadingIds([id]);
  return formatRowBase(row, cardsMap.get(id) ?? { cardIds: [], orientations: [] });
}

export async function findSingleByRequestId(userId: number, requestId: string) {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id FROM reading_history WHERE user_id = ? AND type = 'single'
     AND JSON_UNQUOTE(JSON_EXTRACT(result_data, '$._requestId')) = ?
     ORDER BY id DESC LIMIT 1`,
    [userId, requestId],
  );
  return rows[0] ? findById(Number(rows[0].id), userId) : null;
}

export async function deleteById(id: number, userId: number) {
  const [result] = await pool.execute<ResultSetHeader>(
    'DELETE FROM reading_history WHERE id = ? AND user_id = ?',
    [id, userId]
  );
  return result.affectedRows > 0;
}

/** 把一轮追问/反馈持久化到该占卜记录的 result_data.followups（从现在起记录后续对话） */
export async function appendFollowupTurn(
  id: number,
  userId: number,
  turn: { question: string; answer: string; requestId?: string },
  connection?: PoolConnection,
): Promise<boolean> {
  // Update only this JSON path under the row lock; parallel feedback must not
  // replace a followup saved after an earlier SELECT.
  const [result] = await (connection ?? pool).execute<ResultSetHeader>(
    `UPDATE reading_history SET result_data = JSON_SET(
       CASE WHEN JSON_TYPE(result_data) = 'OBJECT' THEN result_data ELSE JSON_OBJECT() END,
       '$.followups', JSON_ARRAY_APPEND(
         CASE WHEN JSON_TYPE(JSON_EXTRACT(result_data, '$.followups')) = 'ARRAY'
           THEN JSON_EXTRACT(result_data, '$.followups') ELSE JSON_ARRAY() END,
         '$', CAST(? AS JSON)))
     WHERE id = ? AND user_id = ?`,
    [JSON.stringify({ question: turn.question, answer: turn.answer, at: new Date().toISOString(), ...(turn.requestId ? { requestId: turn.requestId } : {}) }), id, userId],
  );
  return result.affectedRows > 0;
}

/** 设置某次占卜的"应验程度"评分（存入 result_data.outcome；次日回访用） */
export async function setOutcome(
  id: number,
  userId: number,
  rating: 'full' | 'partial' | 'none',
): Promise<boolean> {
  const [result] = await pool.execute<ResultSetHeader>(
    `UPDATE reading_history SET result_data = JSON_SET(
       CASE WHEN JSON_TYPE(result_data) = 'OBJECT' THEN result_data ELSE JSON_OBJECT() END,
       '$.outcome', CAST(? AS JSON)) WHERE id = ? AND user_id = ?`,
    [JSON.stringify({ rating, at: new Date().toISOString() }), id, userId],
  );
  return result.affectedRows > 0;
}

/** 取最近 N 个月、有问题的占卜（用于 AI 历史分析），排除每日运势 */
export async function listRecentQuestions(
  userId: number,
  months: number,
): Promise<{ id: number; type: string; question: string; createdAt: string }[]> {
  const m = Math.min(Math.max(Math.trunc(months) || 6, 1), 24);
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, type, question, created_at
     FROM reading_history
     WHERE user_id = ?
       AND type <> 'daily-fortune'
       AND question IS NOT NULL AND question <> ''
       AND created_at >= DATE_SUB(NOW(), INTERVAL ${m} MONTH)
     ORDER BY created_at DESC, id DESC
     LIMIT 200`,
    [userId],
  );
  return (rows as RowDataPacket[]).map((r) => ({
    id: Number(r.id),
    type: String(r.type),
    question: String(r.question ?? ''),
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
  }));
}

export async function getDailyFortuneCache(userId: number, date: string) {
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT * FROM daily_fortune_cache WHERE user_id = ? AND fortune_date = ?',
    [userId, date]
  );
  return rows[0] || null;
}

export async function saveDailyFortuneCache(data: {
  userId: number;
  fortuneDate: string;
  cardId: number;
  orientation: string;
  resultData: object;
}) {
  await pool.execute(
    `INSERT INTO daily_fortune_cache (user_id, fortune_date, card_id, orientation, result_data)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE card_id = VALUES(card_id), orientation = VALUES(orientation),
       result_data = VALUES(result_data), updated_at = CURRENT_TIMESTAMP(3)`,
    [data.userId, data.fortuneDate, data.cardId, data.orientation, JSON.stringify(data.resultData)]
  );
}

/** 分享页等：按记录 ID 取牌列表（已排序） */
export async function getCardsForReading(readingId: number) {
  const m = await loadCardsByReadingIds([readingId]);
  return m.get(readingId) ?? { cardIds: [], orientations: [] };
}
