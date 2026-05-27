import type { Request, Response, NextFunction } from 'express';
import { pool } from '../config/database.js';
import { fail } from '../utils/response.js';
import type { RowDataPacket } from 'mysql2';

export async function quotaGuard(req: Request, res: Response, next: NextFunction): Promise<void> {
  const userId = req.userId!;
  const today = new Date().toISOString().slice(0, 10);

  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT remaining_free_quota, quota_reset_date, membership, membership_expires_at FROM users WHERE id = ?',
    [userId]
  );

  if (rows.length === 0) {
    res.status(404).json(fail('用户不存在'));
    return;
  }

  const user = rows[0];

  // VIP 用户不受限制
  if (user.membership === 'vip' && user.membership_expires_at && new Date(user.membership_expires_at) > new Date()) {
    next();
    return;
  }

  // 检查是否需要重置每日配额
  if (user.quota_reset_date !== today) {
    await pool.execute(
      'UPDATE users SET remaining_free_quota = 3, quota_reset_date = ? WHERE id = ?',
      [today, userId]
    );
    next();
    return;
  }

  // 检查剩余配额
  if (user.remaining_free_quota <= 0) {
    res.status(429).json(fail('今日免费次数已用完，明天再来吧'));
    return;
  }

  next();
}
