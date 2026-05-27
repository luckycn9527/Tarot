import { pool } from '../config/database.js';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';

let readerCodeToIdCache: Map<string, number> | null = null;
let spreadCodeToIdCache: Map<string, number> | null = null;

async function getReaderCodeToIdMap(): Promise<Map<string, number>> {
  if (!readerCodeToIdCache) {
    const [rows] = await pool.execute<RowDataPacket[]>('SELECT id, code FROM reference_tarot_readers');
    readerCodeToIdCache = new Map(rows.map((r) => [r.code as string, r.id as number]));
  }
  return readerCodeToIdCache;
}

async function getSpreadCodeToIdMap(): Promise<Map<string, number>> {
  if (!spreadCodeToIdCache) {
    const [rows] = await pool.execute<RowDataPacket[]>('SELECT id, code FROM reference_spreads');
    spreadCodeToIdCache = new Map(rows.map((r) => [r.code as string, r.id as number]));
  }
  return spreadCodeToIdCache;
}

export async function resolveReaderRefId(code: string | null | undefined): Promise<number | null> {
  if (!code) return null;
  const m = await getReaderCodeToIdMap();
  return m.get(code) ?? null;
}

export async function resolveSpreadId(code: string | null | undefined): Promise<number | null> {
  if (!code) return null;
  const m = await getSpreadCodeToIdMap();
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
}) {
  const readerRefId = await resolveReaderRefId(data.readerId);
  const spreadId = await resolveSpreadId(data.spreadType);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
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
    await conn.commit();
    return readingId;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
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
  const offset = (page - 1) * limit;

  let where = 'WHERE rh.user_id = ?';
  const params: (string | number)[] = [userId];

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

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT rh.*, rr.code AS reader_code, rs.code AS spread_code
     FROM reading_history rh
     LEFT JOIN reference_tarot_readers rr ON rh.reader_ref_id = rr.id
     LEFT JOIN reference_spreads rs ON rh.spread_id = rs.id
     ${where} ORDER BY rh.created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const ids = (rows as RowDataPacket[]).map((r) => r.id as number);
  const cardsMap = await loadCardsByReadingIds(ids);

  return {
    items: (rows as RowDataPacket[]).map((row) =>
      formatRowBase(row, cardsMap.get(row.id as number) ?? { cardIds: [], orientations: [] })
    ),
    total,
    page,
    totalPages: Math.ceil(total / limit),
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

export async function deleteById(id: number, userId: number) {
  const [result] = await pool.execute<ResultSetHeader>(
    'DELETE FROM reading_history WHERE id = ? AND user_id = ?',
    [id, userId]
  );
  return result.affectedRows > 0;
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
