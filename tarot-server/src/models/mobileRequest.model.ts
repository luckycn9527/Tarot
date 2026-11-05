import { randomUUID } from 'node:crypto';
import type { RowDataPacket } from 'mysql2';
import type { PoolConnection } from 'mysql2/promise';
import { pool } from '../config/database.js';
import { ApiError } from '../utils/apiError.js';
import { isActiveVip } from '../utils/membership.js';
import { DAILY_FREE_QUOTA } from './user.model.js';
import { MOBILE_REQUEST_LEASE_MS, type MobileRequestKind } from '../utils/mobileRequest.js';

export interface MobileRequestRow {
  user_id: number; request_id: string; kind: MobileRequestKind; payload_hash: string;
  status: 'running' | 'succeeded' | 'failed'; run_token: string; quota_date: string;
  quota_charged: number; quota_refunded: number; history_id: number | null;
  result_metadata: Record<string, unknown> | null; error_code: string | null; error_message: string | null;
  lease_expires_at: Date; created_at: Date; updated_at: Date;
}
function row(value: RowDataPacket | undefined): MobileRequestRow | null {
  if (!value) return null;
  return { ...value, user_id: Number(value.user_id), history_id: value.history_id == null ? null : Number(value.history_id),
    result_metadata: typeof value.result_metadata === 'string' ? JSON.parse(value.result_metadata) : value.result_metadata,
  } as MobileRequestRow;
}
async function select(userId: number, requestId: string, connection?: PoolConnection, lock = false) {
  const [rows] = await (connection ?? pool).execute<RowDataPacket[]>(
    `SELECT * FROM mobile_ai_requests WHERE user_id = ? AND request_id = ?${lock ? ' FOR UPDATE' : ''}`, [userId, requestId]);
  return row(rows[0]);
}
export const find = (userId: number, requestId: string) => select(userId, requestId);

/** Every task transaction locks its user first, giving one consistent lock order. */
async function transaction<T>(userId: number, run: (connection: PoolConnection) => Promise<T>) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [users] = await connection.execute<RowDataPacket[]>('SELECT id FROM users WHERE id = ? FOR UPDATE', [userId]);
    if (!users.length) throw new ApiError(404, '用户不存在');
    const result = await run(connection);
    await connection.commit();
    return result;
  } catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
}

export async function claim(userId: number, requestId: string, kind: MobileRequestKind, hash: string, quotaDate: string) {
  return transaction(userId, async connection => {
    const existing = await select(userId, requestId, connection, true);
    if (existing) return { task: existing, fresh: false };
    const [pending] = await connection.execute<RowDataPacket[]>(
      "SELECT request_id FROM mobile_ai_requests WHERE user_id = ? AND status = 'running' LIMIT 1 FOR UPDATE", [userId]);
    if (pending.length) throw new ApiError(429, '上一条解读仍在生成，请先查看原请求的进度');
    await connection.execute(
      'UPDATE users SET remaining_free_quota = ?, quota_reset_date = ? WHERE id = ? AND (quota_reset_date IS NULL OR quota_reset_date < ?)',
      [DAILY_FREE_QUOTA, quotaDate, userId, quotaDate]);
    const [users] = await connection.execute<RowDataPacket[]>(
      'SELECT membership, membership_expires_at, remaining_free_quota FROM users WHERE id = ?', [userId]);
    const vip = isActiveVip(users[0] as { membership: string; membership_expires_at: string | Date | null });
    if (!vip && Number(users[0].remaining_free_quota) < 1) throw new ApiError(429, '今日免费次数已用完，明天再来吧');
    if (!vip) await connection.execute('UPDATE users SET remaining_free_quota = remaining_free_quota - 1 WHERE id = ?', [userId]);
    const now = new Date();
    await connection.execute(
      `INSERT INTO mobile_ai_requests (user_id, request_id, kind, payload_hash, status, run_token, quota_date,
       quota_charged, lease_expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, 'running', ?, ?, ?, ?, ?, ?)`,
      [userId, requestId, kind, hash, randomUUID(), quotaDate, vip ? 0 : 1,
        new Date(now.getTime() + MOBILE_REQUEST_LEASE_MS), now, now]);
    return { task: (await select(userId, requestId, connection))!, fresh: true };
  });
}

/** History/followup and terminal status share the same transaction. */
export async function complete(task: MobileRequestRow,
  save: (connection: PoolConnection) => Promise<{ historyId: number; metadata: Record<string, unknown> | null }>) {
  return transaction(task.user_id, async connection => {
    const current = await select(task.user_id, task.request_id, connection, true);
    if (!current || current.status !== 'running' || current.run_token !== task.run_token
      || new Date(current.lease_expires_at).getTime() <= Date.now()) throw new ApiError(409, '本次任务已结束，请刷新原请求状态');
    const saved = await save(connection);
    await connection.execute(
      "UPDATE mobile_ai_requests SET status = 'succeeded', history_id = ?, result_metadata = ?, updated_at = ? WHERE user_id = ? AND request_id = ?",
      [saved.historyId, saved.metadata ? JSON.stringify(saved.metadata) : null, new Date(), task.user_id, task.request_id]);
    return saved.historyId;
  });
}

export async function fail(task: MobileRequestRow, code: string, message: string, expiredOnly = false) {
  return transaction(task.user_id, async connection => {
    const current = await select(task.user_id, task.request_id, connection, true);
    if (!current || current.status !== 'running' || current.run_token !== task.run_token) return false;
    if (expiredOnly && new Date(current.lease_expires_at).getTime() > Date.now()) return false;
    if (current.quota_charged && !current.quota_refunded) {
      // A reservation belongs to its original business day, never the next day's quota.
      await connection.execute(
        'UPDATE users SET remaining_free_quota = remaining_free_quota + 1 WHERE id = ? AND quota_reset_date = ?',
        [task.user_id, current.quota_date]);
    }
    await connection.execute(
      `UPDATE mobile_ai_requests SET status = 'failed', quota_refunded = quota_charged,
       error_code = ?, error_message = ?, updated_at = ? WHERE user_id = ? AND request_id = ?`,
      [code.slice(0, 40), message.slice(0, 255), new Date(), task.user_id, task.request_id]);
    return true;
  });
}

export async function recoverExpired(userId?: number) {
  const args: (Date | number)[] = [new Date()];
  if (userId !== undefined) args.push(userId);
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT * FROM mobile_ai_requests WHERE status = 'running' AND lease_expires_at <= ?${userId === undefined ? '' : ' AND user_id = ?'} LIMIT 100`, args);
  let recovered = 0;
  for (const entry of rows) {
    if (await fail(row(entry)!, 'request_interrupted', '本次解读中断，已释放本次额度。可重新发起解读。', true)) recovered++;
  }
  return recovered;
}

/** Keep an idempotency tombstone, but never replay content after its history was removed. */
export async function markHistoryRemoved(userId: number, requestId: string) {
  await pool.execute(
    `UPDATE mobile_ai_requests SET status = 'failed', result_metadata = NULL,
     error_code = 'history_removed', error_message = '原占卜记录已删除', updated_at = ?
     WHERE user_id = ? AND request_id = ? AND status = 'succeeded'`, [new Date(), userId, requestId]);
}
