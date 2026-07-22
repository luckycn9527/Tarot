import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';
import { getRedis } from '../config/redis.js';
import { fail } from '../utils/response.js';

type LocalCounter = { count: number; expiresAt: number };
type LocalLock = { token: string; expiresAt: number };

const localCounters = new Map<string, LocalCounter>();
const localLocks = new Map<number, LocalLock>();
const LOCK_TTL_MS = 90_000;

function minuteBucket(): number {
  return Math.floor(Date.now() / 60_000);
}

function localRateAllowed(key: string): boolean {
  const now = Date.now();
  const current = localCounters.get(key);
  if (!current || current.expiresAt <= now) {
    localCounters.set(key, { count: 1, expiresAt: now + 60_000 });
    return true;
  }
  current.count += 1;
  return current.count <= env.AI_RATE_LIMIT_PER_MIN;
}

async function rateAllowed(userId: number): Promise<boolean> {
  const key = `tarot:ai:rate:${userId}:${minuteBucket()}`;
  const redis = getRedis();
  if (!redis) return localRateAllowed(key);

  try {
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, 60);
    return count <= env.AI_RATE_LIMIT_PER_MIN;
  } catch {
    return localRateAllowed(key);
  }
}

async function acquireLock(userId: number, token: string): Promise<(() => Promise<void>) | null> {
  const key = `tarot:ai:lock:${userId}`;
  const redis = getRedis();
  if (redis) {
    try {
      const result = await redis.set(key, token, 'PX', LOCK_TTL_MS, 'NX');
      if (result !== 'OK') return null;
      return async () => {
        try {
          await redis.eval(
            "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) end return 0",
            1,
            key,
            token,
          );
        } catch {
          // The TTL is the fallback release path when Redis is unavailable.
        }
      };
    } catch {
      // Fall back to the local lock for development or a Redis outage.
    }
  }

  const now = Date.now();
  const current = localLocks.get(userId);
  if (current && current.expiresAt > now) return null;
  localLocks.set(userId, { token, expiresAt: now + LOCK_TTL_MS });
  return async () => {
    if (localLocks.get(userId)?.token === token) localLocks.delete(userId);
  };
}

/** Bounds AI spend per user and prevents overlapping generation requests. */
export async function aiGuard(req: Request, res: Response, next: NextFunction): Promise<void> {
  const userId = req.userId;
  if (!userId) {
    res.status(401).json(fail('请先登录'));
    return;
  }

  if (!(await rateAllowed(userId))) {
    res.setHeader('Retry-After', '60');
    res.status(429).json(fail('AI 解读请求过于频繁，请稍后再试'));
    return;
  }

  const release = await acquireLock(userId, randomUUID());
  if (!release) {
    res.status(429).json(fail('上一条 AI 解读仍在生成，请完成后再试'));
    return;
  }

  let released = false;
  const releaseOnce = () => {
    if (released) return;
    released = true;
    void release();
  };
  res.once('finish', releaseOnce);
  res.once('close', releaseOnce);
  next();
}
