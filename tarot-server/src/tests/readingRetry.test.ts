import assert from 'node:assert/strict';
import test from 'node:test';
import { EventEmitter } from 'node:events';
import type { Request, Response } from 'express';
import { createSingleReadingRetry, type SavedSingleReading } from '../utils/readingRetry.js';

function response() {
  const res = Object.assign(new EventEmitter(), {
    statusCode: 200, body: undefined as unknown, headers: {} as Record<string, string>,
    setHeader(key: string, value: string) { this.headers[key] = value; },
    status(code: number) { this.statusCode = code; return this; },
    json(body: unknown) { this.body = body; res.emit('finish'); return this; },
  });
  return res as unknown as Response & { body: any };
}

function fixture() {
  const saved = new Map<string, SavedSingleReading>();
  const locks = new Set<string>();
  const middleware = createSingleReadingRetry({
    async find(userId, requestId) { return saved.get(`${userId}:${requestId}`) ?? null; },
    async acquire(key) {
      if (locks.has(key)) return null;
      locks.add(key);
      return () => { locks.delete(key); };
    },
  });
  const req = { userId: 1, body: { requestId: 'request-1', question: 'Should I take this job?', cardId: 0, orientation: 'upright' } } as Request;
  return { middleware, saved, locks, req };
}

test('successful retry replays a persisted result before generation and quota consumption', async () => {
  const { middleware, saved, req } = fixture();
  let generated = 0;
  await middleware(req, response(), () => {
    generated++;
    saved.set('1:request-1', { ...req.body, response: { id: 42, result: { answer: 'yes' } } });
  });
  const retry = response();
  await middleware(req, retry, () => { generated++; });
  assert.equal(generated, 1);
  assert.equal(retry.body.data.id, 42);
});

test('disconnecting the browser keeps in-flight work locked until the handler finishes', async () => {
  const { middleware, req, locks } = fixture();
  const first = response();
  await middleware(req, first, () => {});
  first.emit('close');
  const retry = response();
  await middleware(req, retry, () => { assert.fail('must not generate twice'); });
  assert.equal(retry.statusCode, 409);
  assert.equal(locks.size, 1);
  first.status(502).json({ success: false });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(locks.size, 0);
  let continued = false;
  await middleware(req, response(), () => { continued = true; });
  assert.equal(continued, true);
});

test('request IDs cannot replay another account or a changed question', async () => {
  const { middleware, saved, req } = fixture();
  saved.set('1:request-1', { ...req.body, response: { id: 42 } });
  const changed = response();
  await middleware({ ...req, body: { ...req.body, question: 'A different question?' } } as Request, changed, () => assert.fail());
  assert.equal(changed.statusCode, 409);
  let continued = false;
  await middleware({ ...req, userId: 2 } as Request, response(), () => { continued = true; });
  assert.equal(continued, true);
});
