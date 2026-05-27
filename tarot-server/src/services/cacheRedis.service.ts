import { getRedis } from '../config/redis.js';

const KEY_PREFIX = 'tarot:';

function prefixedKey(key: string): string {
  return KEY_PREFIX + key;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const r = getRedis();
  if (!r) return null;
  try {
    const raw = await r.get(prefixedKey(key));
    if (raw == null) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSec: number): Promise<void> {
  const r = getRedis();
  if (!r) return;
  try {
    await r.set(prefixedKey(key), JSON.stringify(value), 'EX', ttlSec);
  } catch {
    /* 缓存失败不影响主流程 */
  }
}

export async function cacheDel(...keys: string[]): Promise<void> {
  const r = getRedis();
  if (!r || keys.length === 0) return;
  try {
    await r.del(...keys.map(prefixedKey));
  } catch {
    /* ignore */
  }
}

/** 与 cacheGet/cacheSet 使用相同的 key（不含前缀），供失效时调用 */
export const CACHE_KEYS = {
  cemeteryMarkers: 'cemetery:markers',
  userSettings: (userId: number) => `user:settings:${userId}`,
} as const;
