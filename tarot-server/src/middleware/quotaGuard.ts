import type { Request, Response, NextFunction } from 'express';
import { fail } from '../utils/response.js';
import * as UserModel from '../models/user.model.js';

/**
 * 配额守卫：原子性检查并扣减用户免费配额。
 * - VIP 用户直接放行，不扣减配额。
 * - 免费用户在配额充足时扣减 1 次后放行。
 * - 配额不足时返回 429。
 */
export async function quotaGuard(req: Request, res: Response, next: NextFunction): Promise<void> {
  const userId = req.userId!;
  const result = await UserModel.consumeQuota(userId);

  switch (result) {
    case 'vip':
    case 'ok':
      next();
      return;
    case 'exhausted':
      res.status(429).json(fail('今日免费次数已用完，明天再来吧'));
      return;
    case 'not_found':
    default:
      res.status(404).json(fail('用户不存在'));
      return;
  }
}
