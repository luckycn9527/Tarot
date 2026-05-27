import { env } from '../config/env.js';

/** 管理端列表分页：防 NaN / 超大 pageSize */
export function clampAdminPage(raw: unknown, fallback = 1): number {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(n, 1_000_000);
}

export function clampAdminPageSize(raw: unknown, fallback = 20, max = 100): number {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(n, max);
}

const FEEDBACK_STATUSES = ['pending', 'processing', 'resolved', 'closed'] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

export function parseFeedbackListStatus(raw: unknown): FeedbackStatus | undefined {
  if (typeof raw !== 'string' || raw.length === 0) return undefined;
  return (FEEDBACK_STATUSES as readonly string[]).includes(raw) ? (raw as FeedbackStatus) : undefined;
}

/** 生产环境不向客户端暴露数据库/栈信息 */
export function adminSafeServerMessage(err: unknown, fallback: string): string {
  if (env.NODE_ENV === 'production') return fallback;
  return err instanceof Error && err.message ? err.message : fallback;
}
