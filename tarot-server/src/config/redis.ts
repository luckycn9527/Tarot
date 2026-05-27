import Redis from 'ioredis';
import { env } from './env.js';

let client: Redis | null = null;

export type RedisHealthStatus = 'disabled' | 'ok' | 'error';

/** 未配置 REDIS_URL 时返回 null，业务层应降级直连数据库 */
export function getRedis(): Redis | null {
  if (!env.REDIS_URL) return null;
  if (!client) {
    client = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
    });
    client.on('error', (err) => {
      console.warn('Redis error:', err.message);
    });
  }
  return client;
}

/** 用于 /health：不暴露 Redis 细节，仅状态 */
export async function getRedisHealth(): Promise<{ status: RedisHealthStatus; message?: string }> {
  if (!env.REDIS_URL) {
    return { status: 'disabled' };
  }
  const r = getRedis();
  if (!r) {
    return { status: 'error', message: 'client_init_failed' };
  }
  try {
    const pong = await r.ping();
    if (pong === 'PONG') return { status: 'ok' };
    return { status: 'error', message: 'unexpected_ping' };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'ping_failed';
    return { status: 'error', message: msg };
  }
}
