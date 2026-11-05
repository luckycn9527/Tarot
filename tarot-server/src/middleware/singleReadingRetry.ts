import { randomUUID } from 'crypto';
import { getRedis } from '../config/redis.js';
import * as ReadingModel from '../models/reading.model.js';
import { createSingleReadingRetry } from '../utils/readingRetry.js';
import { tarotCards } from '../data/tarotCards.js';

const leases = new Map<string, { token: string; expiresAt: number }>();
const TTL_MS = 150_000;

export const singleReadingRetry = createSingleReadingRetry({
  async find(userId, requestId) {
    const reading = await ReadingModel.findSingleByRequestId(userId, requestId);
    if (!reading) return null;
    const { _requestId: _, ...result } = reading.resultData as Record<string, unknown>;
    const card = tarotCards.find(item => item.id === reading.cardIds[0]);
    return {
      question: reading.question,
      cardId: reading.cardIds[0],
      orientation: reading.orientations[0],
      response: {
        id: reading.id,
        card: card ? { id: card.id, name: card.name, nameEn: card.nameEn, isReversed: reading.orientations[0] === 'reversed' } : null,
        result,
      },
    };
  },
  async acquire(key) {
    const token = randomUUID();
    const redis = getRedis();
    const redisKey = `tarot:single:retry:${key}`;
    if (redis) {
      // Fail closed during a Redis outage; retry must never bypass an active lease.
      const result = await redis.set(redisKey, token, 'PX', TTL_MS, 'NX');
      if (result !== 'OK') return null;
      return async () => {
        await redis.eval("if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) end return 0", 1, redisKey, token);
      };
    }
    const now = Date.now();
    for (const [name, lease] of leases) if (lease.expiresAt <= now) leases.delete(name);
    if (leases.has(key)) return null;
    leases.set(key, { token, expiresAt: now + TTL_MS });
    return () => { if (leases.get(key)?.token === token) leases.delete(key); };
  },
});
