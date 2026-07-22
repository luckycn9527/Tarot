import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { success: false, message: '请求过于频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false,
});

/** 忘记密码：防枚举与刷邮箱 */
export const passwordResetRequestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { success: false, message: '重置请求过于频繁，请一小时后再试' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const passwordResetConsumeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: { success: false, message: '请求过于频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60,
  message: { success: false, message: '请求过于频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false,
  // Creem webhooks have their own higher, signature-protected limiter below.
  skip: (req) => req.path === '/payments/webhook',
});

/** 管理端写操作：在 adminAuth 之后挂载，按 adminId 计数，避免误伤同 IP 下其它服务 */
export const adminWriteLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 120,
  message: { success: false, message: '管理操作过于频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const id = (req as { adminId?: number }).adminId;
    return id != null ? `admin:${id}` : ipKeyGenerator(req.ip ?? '');
  },
});

export const invitationRedeemLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { success: false, message: '邀请码兑换过于频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const id = (req as { userId?: number }).userId;
    return id != null ? `invite:${id}` : ipKeyGenerator(req.ip ?? '');
  },
});

/** Checkout creation is authenticated and constrained per account to prevent payment-session abuse. */
export const paymentCheckoutLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 6,
  message: { success: false, message: '创建支付订单过于频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const id = (req as { userId?: number }).userId;
    return id != null ? `checkout:${id}` : ipKeyGenerator(req.ip ?? '');
  },
});

/** Webhook is signature-verified; retain a high IP guard against unauthenticated floods. */
export const paymentWebhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  message: { success: false, message: 'Webhook 请求过于频繁' },
  standardHeaders: true,
  legacyHeaders: false,
});
