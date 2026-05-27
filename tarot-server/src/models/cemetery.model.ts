import { pool } from '../config/database.js';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';

/** 创建墓碑 */
export async function create(data: {
  userId: number;
  longitude: number;
  latitude: number;
  tombstoneStyle: string;
  displayName: string;
  epitaph: string | null;
  tarotCardId: number | null;
  hexagramId: number | null;
}) {
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO tombstones (user_id, longitude, latitude, tombstone_style, display_name, epitaph, tarot_card_id, hexagram_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.userId,
      data.longitude,
      data.latitude,
      data.tombstoneStyle,
      data.displayName,
      data.epitaph,
      data.tarotCardId,
      data.hexagramId,
    ]
  );
  return result.insertId;
}

/** 获取所有公开墓碑的轻量标记（地图渲染用） */
export async function findAllMarkers() {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, longitude, latitude, tombstone_style, display_name
     FROM tombstones WHERE is_public = 1`
  );
  return rows.map(r => ({
    id: r.id,
    longitude: Number(r.longitude),
    latitude: Number(r.latitude),
    style: r.tombstone_style,
    name: r.display_name,
  }));
}

/** 根据 ID 获取墓碑详情 */
export async function findById(id: number) {
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT * FROM tombstones WHERE id = ?',
    [id]
  );
  return rows[0] ? formatRow(rows[0]) : null;
}

/** 获取当前用户的墓碑 */
export async function findByUserId(userId: number) {
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT * FROM tombstones WHERE user_id = ?',
    [userId]
  );
  return rows[0] ? formatRow(rows[0]) : null;
}

/** 检查坐标是否已被占用 */
export async function isPositionOccupied(longitude: number, latitude: number) {
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT id FROM tombstones WHERE longitude = ? AND latitude = ?',
    [longitude, latitude]
  );
  return rows.length > 0;
}

/** 检查用户是否已有墓碑 */
export async function userHasTombstone(userId: number) {
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT id FROM tombstones WHERE user_id = ?',
    [userId]
  );
  return rows.length > 0;
}

/** 更新墓碑（仅名称/墓志铭） */
export async function update(userId: number, data: {
  displayName?: string;
  epitaph?: string | null;
}) {
  const fields: string[] = [];
  const params: any[] = [];

  if (data.displayName !== undefined) {
    fields.push('display_name = ?');
    params.push(data.displayName);
  }
  if (data.epitaph !== undefined) {
    fields.push('epitaph = ?');
    params.push(data.epitaph);
  }

  if (fields.length === 0) return false;

  params.push(userId);
  const [result] = await pool.execute<ResultSetHeader>(
    `UPDATE tombstones SET ${fields.join(', ')} WHERE user_id = ?`,
    params
  );
  return result.affectedRows > 0;
}

/** 删除用户的墓碑 */
export async function deleteByUserId(userId: number) {
  const [result] = await pool.execute<ResultSetHeader>(
    'DELETE FROM tombstones WHERE user_id = ?',
    [userId]
  );
  return result.affectedRows > 0;
}

/** 增加浏览量 */
export async function incrementViewCount(id: number) {
  await pool.execute(
    'UPDATE tombstones SET view_count = view_count + 1 WHERE id = ?',
    [id]
  );
}

function formatRow(row: RowDataPacket) {
  return {
    id: row.id,
    userId: row.user_id,
    longitude: Number(row.longitude),
    latitude: Number(row.latitude),
    tombstoneStyle: row.tombstone_style,
    displayName: row.display_name,
    epitaph: row.epitaph,
    tarotCardId: row.tarot_card_id,
    hexagramId: row.hexagram_id,
    isPublic: !!row.is_public,
    viewCount: row.view_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
