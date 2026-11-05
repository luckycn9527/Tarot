import type { RowDataPacket } from 'mysql2';
import { pool } from '../config/database.js';
import type { AdminUserQuestionsQuery } from '../validation/adminQuery.js';

export function literalLike(value: string): string {
  return `%${value.replace(/[\\%_]/g, '\\$&')}%`;
}

/** One batch for the displayed user page, never one HTTP/SQL request per user. */
export async function latestQuestionsForUsers(ids: number[]) {
  const result = new Map<number, Record<string, unknown> | null>();
  if (!ids.length) return result;
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT u.id AS user_id,
       rh.id AS reading_id, rh.type AS reading_type, rh.question AS reading_question, rh.created_at AS reading_at,
       fc.id AS fate_id, b.question AS fate_question, fc.created_at AS fate_at
     FROM users u
     LEFT JOIN reading_history rh ON rh.id = (
       SELECT r.id FROM reading_history r WHERE r.user_id = u.id
         AND r.type <> 'daily-fortune' AND r.question IS NOT NULL AND TRIM(r.question) <> ''
       ORDER BY r.created_at DESC, r.id DESC LIMIT 1)
     LEFT JOIN fate_conflicts fc ON fc.id = (
       SELECT f.id FROM fate_conflicts f JOIN bazi_results br ON br.id = f.bazi_id
       WHERE f.user_id = u.id AND br.question IS NOT NULL AND TRIM(br.question) <> ''
       ORDER BY f.created_at DESC, f.id DESC LIMIT 1)
     LEFT JOIN bazi_results b ON b.id = fc.bazi_id
     WHERE u.id IN (${ids.map(() => '?').join(',')})`, ids,
  );
  for (const row of rows) {
    const useFate = row.fate_id && (!row.reading_id || new Date(row.fate_at).getTime() > new Date(row.reading_at).getTime());
    result.set(Number(row.user_id), useFate
      ? { id: row.fate_id, source: 'fate', type: 'fate-dual', question: row.fate_question, askedAt: row.fate_at }
      : row.reading_id
        ? { id: row.reading_id, source: 'reading', type: row.reading_type, question: row.reading_question, askedAt: row.reading_at }
        : null);
  }
  return result;
}

export async function listUserQuestions(userId: number, options: AdminUserQuestionsQuery) {
  const [users] = await pool.execute<RowDataPacket[]>(
    'SELECT id, email, nickname, last_login_at AS lastLoginAt FROM users WHERE id = ?', [userId]);
  if (!users[0]) return null;
  const readingFilters = ["rh.user_id = ?", "rh.type <> 'daily-fortune'", "rh.question IS NOT NULL", "TRIM(rh.question) <> ''"];
  const fateFilters = ['fc.user_id = ?', 'b.question IS NOT NULL', "TRIM(b.question) <> ''"];
  const readingArgs: (string | number)[] = [userId];
  const fateArgs: (string | number)[] = [userId];
  if (options.type === 'fate-dual') readingFilters.push('1 = 0');
  else if (options.type) {
    readingFilters.push('rh.type = ?');
    readingArgs.push(options.type);
    fateFilters.push('1 = 0');
  }
  if (options.keyword) {
    readingFilters.push('rh.question LIKE ?'); readingArgs.push(literalLike(options.keyword));
    fateFilters.push('b.question LIKE ?'); fateArgs.push(literalLike(options.keyword));
  }
  const readingWhere = readingFilters.join(' AND ');
  const fateWhere = fateFilters.join(' AND ');
  const args = [...readingArgs, ...fateArgs];
  const union = `SELECT rh.id, 'reading' AS source, rh.type, rh.question, rh.created_at AS askedAt
    FROM reading_history rh WHERE ${readingWhere}
    UNION ALL
    SELECT fc.id, 'fate' AS source, 'fate-dual' AS type, b.question, fc.created_at AS askedAt
    FROM fate_conflicts fc JOIN bazi_results b ON b.id = fc.bazi_id WHERE ${fateWhere}`;
  const [counts] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM (${union}) questions`, args);
  const total = Number(counts[0].total);
  const pageSize = Math.min(100, Math.max(1, Math.trunc(options.pageSize) || 20));
  const totalPages = Math.ceil(total / pageSize);
  const page = Math.min(Math.max(1, Math.trunc(options.page) || 1), Math.max(1, totalPages));
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM (${union}) questions ORDER BY askedAt DESC, source DESC, id DESC
     LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`, args);
  const visibleIds = rows.filter(row => row.source === 'reading').map(row => Number(row.id));
  const followups = new Map<number, { question: string; askedAt: string | null }[]>();
  if (visibleIds.length) {
    const [turns] = await pool.query<RowDataPacket[]>(
      `SELECT rh.id, turn.question, turn.asked_at AS askedAt FROM reading_history rh
       JOIN JSON_TABLE(
         CASE WHEN JSON_TYPE(JSON_EXTRACT(rh.result_data, '$.followups')) = 'ARRAY'
           THEN JSON_EXTRACT(rh.result_data, '$.followups') ELSE JSON_ARRAY() END,
         '$[*]' COLUMNS (position_no FOR ORDINALITY,
           question VARCHAR(500) PATH '$.question' NULL ON EMPTY NULL ON ERROR,
           asked_at VARCHAR(50) PATH '$.at' NULL ON EMPTY NULL ON ERROR)) AS turn
       WHERE rh.user_id = ? AND rh.id IN (${visibleIds.map(() => '?').join(',')})
         AND turn.question IS NOT NULL AND TRIM(turn.question) <> ''
       ORDER BY rh.id, turn.position_no`, [userId, ...visibleIds]);
    for (const turn of turns) {
      const id = Number(turn.id);
      const list = followups.get(id) ?? [];
      list.push({ question: String(turn.question), askedAt: turn.askedAt || null });
      followups.set(id, list);
    }
  }
  return { user: users[0], total, page, pageSize, totalPages,
    items: rows.map(row => ({ id: row.id, source: row.source, type: row.type, question: row.question,
      askedAt: row.askedAt, followups: row.source === 'reading' ? followups.get(Number(row.id)) ?? [] : [] })) };
}
