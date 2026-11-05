import type { Request, Response, NextFunction } from 'express';
import { fail } from '../utils/response.js';
import * as UserModel from '../models/user.model.js';
import { env } from '../config/env.js';
import { quotaWindow } from '../utils/quotaDate.js';
import { refundFailedReservation } from '../utils/quotaReservation.js';

type Consume = (userId: number, date: string) => Promise<'vip' | 'ok' | 'exhausted' | 'not_found'>;
type Refund = (userId: number, date: string) => Promise<void>;

async function guardQuota(
  req: Request,
  res: Response,
  next: NextFunction,
  consume: Consume,
  refund: Refund,
  exhaustedMessage: string,
): Promise<void> {
  const userId = req.userId!;
  const window = res.locals.quotaWindow ?? quotaWindow(env.QUOTA_TIME_ZONE);
  res.locals.quotaWindow = window;
  const result = await consume(userId, window.businessDate);

  switch (result) {
    case 'vip':
      next();
      return;
    case 'ok':
      refundFailedReservation(res, () => refund(userId, window.businessDate), (err) => {
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
      next();
      return;
    case 'exhausted':
      res.status(429).json(fail(exhaustedMessage));
      return;
    case 'not_found':
    default:
      res.status(404).json(fail('用户不存在'));
  }
}

/**
 * 配额守卫：原子性检查并预扣用户免费配额。
 * - VIP 用户直接放行，不扣减配额。
 * - 免费用户在配额充足时预扣 1 次后放行。
 * - 请求最终失败时自动退还本次预扣，避免用户没拿到结果却损失额度。
 * - 配额不足时返回 429。
 */
export async function quotaGuard(req: Request, res: Response, next: NextFunction): Promise<void> {
  await guardQuota(req, res, next, UserModel.consumeQuota, UserModel.refundQuota, '今日免费次数已用完，明天再来吧');
}

export async function dailyFortuneQuotaGuard(req: Request, res: Response, next: NextFunction): Promise<void> {
  await guardQuota(
    req,
    res,
    next,
    UserModel.consumeDailyFortuneQuota,
    UserModel.refundDailyFortuneQuota,
    '今日每日运势次数已用完，明天再来吧',
  );
}

export async function fateDualQuotaGuard(req: Request, res: Response, next: NextFunction): Promise<void> {
  await guardQuota(
    req,
    res,
    next,
    UserModel.consumeFateDualQuota,
    UserModel.refundFateDualQuota,
    '今日命运双盘次数已用完，明天再来吧',
  );
}
