import type { Request, Response, NextFunction } from 'express';
import { fail } from '../utils/response.js';
import * as UserModel from '../models/user.model.js';

/**
 * 配额守卫：原子性检查并预扣用户免费配额。
 * - VIP 用户直接放行，不扣减配额。
 * - 免费用户在配额充足时预扣 1 次后放行。
 * - 请求最终失败时自动退还本次预扣，避免用户没拿到结果却损失额度。
 * - 配额不足时返回 429。
 */
export async function quotaGuard(req: Request, res: Response, next: NextFunction): Promise<void> {
  const userId = req.userId!;
  const result = await UserModel.consumeQuota(userId);

  switch (result) {
    case 'vip':
      next();
      return;
    case 'ok':
      res.once('finish', () => {
        if (res.statusCode >= 400) {
          void UserModel.refundQuota(userId).catch((err) => {
            console.error(
              JSON.stringify({
                ts: new Date().toISOString(),
                level: 'error',
                event: 'quota_refund_failed',
                userId,
                statusCode: res.statusCode,
                message: err instanceof Error ? err.message : String(err),
              }),
            );
          });
        }
      });
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
