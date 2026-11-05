import assert from 'node:assert/strict';
import test from 'node:test';
import type { Pool } from 'mysql2/promise';
import express from 'express';
import { assertBirthday, assertBirthTime, toBirthTime } from '../utils/birthInfo.js';

// No real credentials or network database. Every SQL statement is intercepted.
process.env.NODE_ENV = 'test';
process.env.DB_PASSWORD = 'birth-test-db-inert';
process.env.JWT_ACCESS_SECRET = 'birth-test-access-inert-secret';
process.env.JWT_REFRESH_SECRET = 'birth-test-refresh-inert-secret';
process.env.ADMIN_USERNAME_PEPPER = 'birth-test-admin-inert-pepper';
process.env.ADMIN_JWT_SECRET = 'birth-test-admin-inert-secret';
process.env.REDIS_URL = '';

const [{ pool }, UserService, { toPublicUser }, { signAccessToken }, { default: userRoutes }, { errorHandler }] = await Promise.all([
  import('../config/database.js'), import('../services/user.service.js'), import('../services/auth.service.js'),
  import('../utils/jwt.js'), import('../routes/user.routes.js'), import('../middleware/errorHandler.js'),
]);

function row(id = 91) {
  return {
    id, email: `birth-${id}@example.invalid`, username: `birth_${id}`, nickname: `Birth fixture ${id}`,
    password_hash: null, avatar: null, gender: 'unset', birthday: '1991-10-30' as string | null, birth_time: '07:45:00' as string | null,
    zodiac_sign: '天蝎座', location: null, bio: null, membership: 'free', membership_expires_at: null,
    remaining_free_quota: 3, created_at: '2026-10-28T00:00:00Z', access_token_revoked_at: null,
  };
}

async function withStore(run: (rows: Map<number, ReturnType<typeof row>>, writes: string[]) => Promise<void>) {
  const original = pool.execute;
  const rows = new Map([[91, row()], [92, row(92)]]);
  const writes: string[] = [];
  pool.execute = (async (sql: string, params: unknown[]) => {
    if (sql === 'SELECT * FROM users WHERE id = ?') {
      const user = rows.get(Number(params[0]));
      return [user ? [{ ...user }] : [], []];
    }
    if (/SET remaining_(?:free|daily_fortune|fate_dual)_quota = \?/.test(sql) && sql.includes('quota_reset_date')) return [{ affectedRows: 0 }, []];
    const update = sql.match(/^UPDATE users SET (.+) WHERE id = \?$/);
    if (update) {
      const owner = Number(params.at(-1)), user = rows.get(owner);
      assert.ok(user);
      const fields = update[1]!.split(', ').map(assignment => {
        assert.match(assignment, /^[a-z_]+ = \?$/);
        return assignment.slice(0, -4);
      });
      fields.forEach((field, index) => { (user as Record<string, unknown>)[field] = params[index]; });
      writes.push(sql);
      return [{ affectedRows: 1 }, []];
    }
    throw new Error('Unexpected fixture SQL: ' + sql);
  }) as unknown as Pool['execute'];
  try { await run(rows, writes); } finally { pool.execute = original; }
}

async function withHttp(run: (request: (method: string, path: string, body?: unknown, owner?: number | null) => Promise<Response>) => Promise<void>) {
  const app = express(); app.use(express.json()); app.use('/api/user', userRoutes); app.use(errorHandler);
  const server = await new Promise<ReturnType<typeof app.listen>>(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
  try {
    const address = server.address(); assert.ok(address && typeof address !== 'string');
    await run((method, path, body, owner = 91) => fetch(`http://127.0.0.1:${address.port}/api/user${path}`, {
      method,
      headers: { 'content-type': 'application/json', ...(owner === null ? {} : { authorization: `Bearer ${signAccessToken({ userId: owner })}` }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }));
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
}

test('birth times support midnight and unknown while rejecting non-calendar times', () => {
  for (const value of [undefined, null, '00:00', '07:45', '23:59']) assert.doesNotThrow(() => assertBirthTime(value));
  for (const value of ['24:00', '12:60', '7:45', '07:45:00', '', ' 07:45', 745, {}, false]) assert.throws(() => assertBirthTime(value));
  assert.equal(toBirthTime('00:00:00'), '00:00');
  assert.equal(toBirthTime('23:59:00'), '23:59');
  for (const value of [null, undefined, '24:00:00', '-07:00:00', '07:99:00']) assert.equal(toBirthTime(value), null);
});

test('shared birthday validation rejects invalid calendar dates and future dates', () => {
  assert.doesNotThrow(() => assertBirthday(null));
  assert.doesNotThrow(() => assertBirthday('2000-02-29'));
  for (const value of ['2001-02-29', '1991-04-31', '1991-13-01', '2999-01-01', '1991-1-01', '', undefined]) assert.throws(() => assertBirthday(value));
});

test('birth-info saves the owner only, survives another read and is present in public profile', async () => withStore(async (rows) => withHttp(async request => {
  const anonymous = await request('GET', '/birth-info', undefined, null);
  assert.equal(anonymous.status, 401);
  const saved = await request('PUT', '/birth-info', { birthday: '2000-02-29', birthTime: '00:00' });
  assert.equal(saved.status, 200);
  const data = (await saved.json()).data;
  assert.equal(data.birthday, '2000-02-29'); assert.equal(data.birthTime, '00:00'); assert.ok(data.zodiacSign);
  assert.equal(rows.get(92)!.birth_time, '07:45:00');
  assert.equal(rows.get(92)!.birthday, '1991-10-30');
  const reopened = await request('GET', '/birth-info');
  assert.deepEqual((await reopened.json()).data, data);
  const profile = await request('GET', '/profile');
  assert.equal(profile.status, 200);
  assert.equal((await profile.json()).data.birthTime, '00:00');
})));

test('legacy birthday-only updates preserve time; unknown and clearing the date are distinct', async () => withStore(async (rows) => {
  const preserved = await UserService.updateBirthInfo(91, '1992-01-01');
  assert.equal(preserved.birthTime, '07:45'); assert.equal(rows.get(91)!.birth_time, '07:45:00');
  const unknown = await UserService.updateBirthInfo(91, '1992-01-01', null);
  assert.equal(unknown.birthTime, null); assert.equal(rows.get(91)!.birth_time, null);
  await UserService.updateBirthInfo(91, '1992-01-01', '23:59');
  const cleared = await UserService.updateBirthInfo(91, null);
  assert.deepEqual(cleared, { birthday: null, birthTime: null, zodiacSign: null });
  assert.equal(rows.get(91)!.birth_time, null);
  await assert.rejects(UserService.updateBirthInfo(91, null, '07:45'), /先设置出生日期/);
}));

test('HTTP birth-info rejects invalid times without changing persisted data', async () => withStore(async (rows, writes) => withHttp(async request => {
  for (const birthTime of ['24:00', '12:60', '7:45', '07:45:00', 745, false]) {
    const response = await request('PUT', '/birth-info', { birthday: '1991-10-30', birthTime });
    assert.equal(response.status, 400);
  }
  const missingDate = await request('PUT', '/birth-info', { birthday: null, birthTime: '07:45' });
  assert.equal(missingDate.status, 400);
  assert.equal(rows.get(91)!.birth_time, '07:45:00'); assert.equal(writes.length, 0);
})));

test('profile and birth-info both reject invalid birthdays rather than relying on SQL coercion', async () => withStore(async (rows, writes) => withHttp(async request => {
  for (const path of ['/profile', '/birth-info']) for (const birthday of ['2001-02-29', '1991-04-31', '2999-01-01']) {
    const response = await request('PUT', path, { birthday });
    assert.equal(response.status, 400, `${path} must reject ${birthday}`);
  }
  assert.equal(rows.get(91)!.birthday, '1991-10-30'); assert.equal(writes.length, 0);
  const cleared = await request('PUT', '/profile', { birthday: null });
  assert.equal(cleared.status, 200);
  assert.equal(rows.get(91)!.birth_time, null);
})));

test('all public user payloads normalize SQL TIME and hide legacy orphan times', async () => withStore(async (rows) => {
  const user = rows.get(91)!;
  assert.equal(toPublicUser(user as never).birthTime, '07:45');
  user.birth_time = '00:00:00'; assert.equal(toPublicUser(user as never).birthTime, '00:00');
  user.birthday = null; assert.equal(toPublicUser(user as never).birthTime, null);
}));
