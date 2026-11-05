import assert from 'node:assert/strict';
import test, { after, afterEach, beforeEach, mock } from 'node:test';
import type { Request, Response } from 'express';

// Inert local fixtures only. Every database and AI operation is intercepted.
process.env.NODE_ENV = 'test';
process.env.DB_HOST = '127.0.0.1';
process.env.DB_USER = 'yesterday-fixture';
process.env.DB_PASSWORD = 'yesterday-test-db-inert';
process.env.DB_NAME = 'yesterday_fixture';
process.env.JWT_ACCESS_SECRET = 'yesterday-test-access-inert-secret';
process.env.JWT_REFRESH_SECRET = 'yesterday-test-refresh-inert-secret';
process.env.ADMIN_USERNAME_PEPPER = 'yesterday-test-admin-inert-pepper';
process.env.ADMIN_JWT_SECRET = 'yesterday-test-admin-inert-secret';
process.env.DEEPSEEK_API_KEY = 'yesterday-test-ai-inert';
process.env.REDIS_URL = '';
process.env.QUOTA_TIME_ZONE = 'Asia/Shanghai';

const [{ pool }, ReadingService, ReadingController, { default: readingRoutes }, { auth }, { previousBusinessDate }] = await Promise.all([
  import('../config/database.js'), import('../services/reading.service.js'),
  import('../controllers/reading.controller.js'), import('../routes/reading.routes.js'),
  import('../middleware/auth.js'), import('../utils/quotaDate.js'),
]);

interface CacheRow {
  card_id: number;
  orientation: 'upright' | 'reversed';
  result_data: unknown;
}

const saved = new Map<string, CacheRow>();
const queries: { sql: string; params: unknown[] }[] = [];
const forbidden: string[] = [];
const fixedNow = new Date('2026-10-31T16:30:00.000Z');
const result = { cardName: '愚者', isReversed: true, sections: { overall: '原存昨日解读' }, ratings: { overall: 4 } };

beforeEach(() => {
  saved.clear(); queries.length = 0; forbidden.length = 0;
  mock.method(pool, 'execute', (async (sql: string, params: unknown[]) => {
    queries.push({ sql, params });
    assert.equal(sql, 'SELECT * FROM daily_fortune_cache WHERE user_id = ? AND fortune_date = ?');
    const row = saved.get(`${params[0]}:${params[1]}`);
    return [row ? [row] : [], []];
  }) as unknown as typeof pool.execute);
  for (const method of ['query', 'getConnection'] as const) {
    mock.method(pool, method, (() => { forbidden.push(method); throw new Error(`Unexpected database ${method}`); }) as any);
  }
  mock.method(globalThis, 'fetch', (() => { forbidden.push('fetch'); throw new Error('Unexpected AI/network request'); }) as typeof fetch);
});

afterEach(() => {
  mock.restoreAll();
  assert.deepEqual(forbidden, [], 'historical reads must never create connections, generate AI, or use other database paths');
});
after(async () => { await pool.end(); });

function response() {
  return {
    statusCode: 200, body: undefined as any, headers: {} as Record<string, string>,
    setHeader(key: string, value: string) { this.headers[key] = value; },
    status(code: number) { this.statusCode = code; return this; },
    json(body: unknown) { this.body = body; return this; },
  };
}

test('yesterday returns the exact stored card, orientation, and JSON result without a quota window', async () => {
  saved.set('7:2026-10-31', { card_id: 0, orientation: 'reversed', result_data: JSON.stringify(result) });
  const yesterday = await ReadingService.getYesterdayDailyFortuneCache(7, fixedNow);
  assert.deepEqual(yesterday, {
    businessDate: '2026-10-31', timeZone: 'Asia/Shanghai', cached: true,
    card: { id: 0, name: '愚者', nameEn: 'The Fool', isReversed: true }, result,
  });
  assert.equal('resetsAt' in yesterday, false);
  assert.deepEqual(queries.map(query => query.params), [[7, '2026-10-31']]);
});

test('yesterday also preserves native JSON data and upright orientation', async () => {
  saved.set('7:2026-10-31', { card_id: 0, orientation: 'upright', result_data: result });
  const yesterday = await ReadingService.getYesterdayDailyFortuneCache(7, fixedNow);
  assert.equal(yesterday.result, result);
  assert.equal(yesterday.card?.isReversed, false);
  assert.equal(queries.length, 1);
});

test('yesterday prefers original stored card names while today retains its existing card mapping', async () => {
  const originalResult = { ...result, cardName: '原存牌名', cardNameEn: 'Original saved card name' };
  saved.set('7:2026-10-31', { card_id: 0, orientation: 'reversed', result_data: originalResult });
  const yesterday = await ReadingService.getYesterdayDailyFortuneCache(7, fixedNow);
  assert.deepEqual(yesterday.card, { id: 0, name: originalResult.cardName, nameEn: originalResult.cardNameEn, isReversed: true });
  assert.equal(yesterday.result, originalResult);
  const today = await ReadingService.getDailyFortuneCache(7, {
    businessDate: '2026-10-31', resetsAt: '2026-10-31T16:00:00.000Z', timeZone: 'Asia/Shanghai',
  });
  assert.equal(today.card?.name, '愚者');
  assert.equal(today.card?.nameEn, 'The Fool');
});

test('missing yesterday is an explicit empty result even when today and older records exist', async () => {
  const row: CacheRow = { card_id: 0, orientation: 'reversed', result_data: result };
  saved.set('7:2026-11-01', row);
  saved.set('7:2026-10-30', row);
  saved.set('8:2026-10-31', row);
  assert.deepEqual(await ReadingService.getYesterdayDailyFortuneCache(7, fixedNow), {
    businessDate: '2026-10-31', timeZone: 'Asia/Shanghai', cached: false, card: null, result: null,
  });
  assert.deepEqual(queries.map(query => query.params), [[7, '2026-10-31']]);
});

test('yesterday never reads another owner and does not generate or consume quota for a missing result', async () => {
  saved.set('7:2026-10-31', { card_id: 0, orientation: 'reversed', result_data: result });
  assert.equal((await ReadingService.getYesterdayDailyFortuneCache(8, fixedNow)).cached, false);
  assert.deepEqual(queries.map(query => query.params), [[8, '2026-10-31']]);
});

test('the selected date moves at site midnight, including a year boundary', async () => {
  for (const [instant, expected] of [
    ['2026-10-31T15:59:59.999Z', '2026-10-30'],
    ['2026-10-31T16:00:00.000Z', '2026-10-31'],
    ['2026-12-31T16:00:00.000Z', '2026-12-31'],
  ]) {
    const yesterday = await ReadingService.getYesterdayDailyFortuneCache(7, new Date(instant!));
    assert.equal(yesterday.businessDate, expected);
  }
  assert.deepEqual(queries.map(query => query.params), [[7, '2026-10-30'], [7, '2026-10-31'], [7, '2026-12-31']]);
});

test('cached parse failures retain the existing error behavior rather than generating replacement history', async () => {
  saved.set('7:2026-10-31', { card_id: 0, orientation: 'reversed', result_data: '{broken-json' });
  await assert.rejects(ReadingService.getYesterdayDailyFortuneCache(7, fixedNow), SyntaxError);
  assert.equal(queries.length, 1);
});

test('today still returns its original quota window and only its current cached result', async () => {
  saved.set('7:2026-10-31', { card_id: 0, orientation: 'reversed', result_data: result });
  const window = { businessDate: '2026-11-01', resetsAt: '2026-11-01T16:00:00.000Z', timeZone: 'Asia/Shanghai' };
  assert.deepEqual(await ReadingService.getDailyFortuneCache(7, window), { ...window, cached: false, card: null, result: null });
  saved.set('7:2026-11-01', { card_id: 0, orientation: 'upright', result_data: result });
  const current = await ReadingService.getDailyFortuneCache(7, window);
  assert.equal(current.cached, true);
  assert.equal(current.resetsAt, window.resetsAt);
  assert.equal(current.card?.isReversed, false);
  assert.deepEqual(queries.map(query => query.params), [[7, '2026-11-01'], [7, '2026-11-01']]);
});

test('yesterday controller uses only the authenticated owner and returns a no-store empty success response', async () => {
  const res = response();
  const expectedDate = previousBusinessDate('Asia/Shanghai');
  const req = { userId: 11, query: { userId: '99', date: '2020-01-01' }, body: { userId: 99 } } as unknown as Request;
  await ReadingController.yesterdayDailyFortuneCache(req, res as unknown as Response);
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['Cache-Control'], 'no-store');
  assert.deepEqual(res.body.data, { businessDate: expectedDate, timeZone: 'Asia/Shanghai', cached: false, card: null, result: null });
  assert.equal(res.body.success, true);
  assert.deepEqual(queries.map(query => query.params), [[11, expectedDate]]);
});

test('yesterday route is authenticated and has no AI or quota middleware', async () => {
  const router = readingRoutes as unknown as {
    stack: { route?: { path: string; methods: Record<string, boolean>; stack: { handle: unknown }[] } }[];
  };
  const route = router.stack.find(layer => layer.route?.path === '/daily-fortune/yesterday')?.route;
  assert.ok(route);
  assert.equal(route.methods.get, true);
  assert.deepEqual(route.stack.map(layer => layer.handle), [auth, ReadingController.yesterdayDailyFortuneCache]);
  const res = response();
  await auth({ headers: {} } as Request, res as unknown as Response, () => assert.fail('unauthenticated request must not reach history'));
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.success, false);
  assert.equal(queries.length, 0);
});
