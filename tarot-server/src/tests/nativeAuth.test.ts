import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import type { Pool, PoolConnection } from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';

// Inert credentials only; every database operation in this file is intercepted.
process.env.NODE_ENV = 'test';
process.env.DB_PASSWORD = 'native-test-db-inert';
process.env.JWT_ACCESS_SECRET = 'native-test-access-inert-secret';
process.env.JWT_REFRESH_SECRET = 'native-test-refresh-inert-secret';
process.env.ADMIN_USERNAME_PEPPER = 'native-test-admin-inert-pepper';
process.env.ADMIN_JWT_SECRET = 'native-test-admin-inert-secret';
process.env.CORS_ORIGIN = 'https://fixture.example';
process.env.JWT_ACCESS_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';

const [{ pool }, Auth, { signRefreshToken, signAccessToken, verifyRefreshToken, verifyAccessToken }, { corsOptions, corsOptionsForOrigin }, { default: authRoutes }, { errorHandler }] = await Promise.all([
  import('../config/database.js'), import('../services/auth.service.js'), import('../utils/jwt.js'), import('../config/cors.js'),
  import('../routes/auth.routes.js'), import('../middleware/errorHandler.js'),
]);

type TokenRow = { id: number; user_id: number; expires_at: string };
const DAY_MS = 24 * 60 * 60 * 1000;
const hash = (token: string) => createHash('sha256').update(token).digest('hex');
const user = {
  id: 12, email: 'native-fixture@example.invalid', username: 'native_fixture', nickname: 'Native fixture',
  password_hash: bcrypt.hashSync('inert-fixture-password', 4), avatar: null, gender: 'secret', birthday: null,
  zodiac_sign: null, location: null, bio: null, membership: 'free', membership_expires_at: null,
  remaining_free_quota: 3, created_at: '2026-10-28T00:00:00Z', access_token_revoked_at: null,
};

async function withDatabase(run: (db: {
  tokens: () => Map<string, TokenRow>; events: string[]; add: (token: string, owner?: number) => void; failInsert: () => void;
}) => Promise<void>) {
  const original = { execute: pool.execute, getConnection: pool.getConnection };
  let tokens = new Map<string, TokenRow>(), nextId = 1, failInsert = false;
  let transactionTail = Promise.resolve();
  const events: string[] = [];
  const execute = async (sql: string, params: unknown[], transaction?: Map<string, TokenRow>): Promise<unknown> => {
    const rows = transaction ?? tokens;
    if (sql.startsWith('SELECT id, user_id, expires_at FROM refresh_tokens')) {
      if (sql.endsWith('FOR UPDATE')) events.push('lock-refresh');
      const row = rows.get(String(params[0])); return [row ? [row] : [], []];
    }
    if (sql.startsWith('INSERT INTO refresh_tokens')) {
      events.push('insert-refresh');
      if (failInsert) throw new Error('fixture insert failure');
      const key = String(params[1]); assert.equal(rows.has(key), false);
      rows.set(key, { id: nextId++, user_id: Number(params[0]), expires_at: new Date(params[2] as Date).toISOString() });
      return [{ affectedRows: 1, insertId: nextId - 1 }, []];
    }
    if (sql === 'DELETE FROM refresh_tokens WHERE user_id = ? AND token = ?') {
      events.push('delete-owned-refresh');
      const key = String(params[1]), row = rows.get(key), owned = row?.user_id === params[0];
      if (owned) rows.delete(key);
      return [{ affectedRows: owned ? 1 : 0 }, []];
    }
    if (sql === 'DELETE FROM refresh_tokens WHERE token = ?') { rows.delete(String(params[0])); return [{ affectedRows: 1 }, []]; }
    if (sql === 'DELETE FROM refresh_tokens WHERE user_id = ?') {
      for (const [key, row] of rows) if (row.user_id === params[0]) rows.delete(key);
      events.push('revoke-all-refresh'); return [{ affectedRows: 1 }, []];
    }
    if (sql.startsWith('SELECT * FROM users')) {
      const matches = params.includes(user.id) || params.includes(user.email) || params.includes(user.username);
      return [matches ? [user] : [], []];
    }
    if (sql.startsWith('UPDATE users SET last_login_at')) { events.push('touch-login'); return [{ affectedRows: 1 }, []]; }
    if (sql.startsWith('SELECT * FROM password_reset_tokens')) return [[{ id: 5, user_id: user.id }], []];
    if (sql.startsWith('UPDATE password_reset_tokens SET used_at')) return [{ affectedRows: 1 }, []];
    if (sql.startsWith('UPDATE users SET password_hash')) return [{ affectedRows: 1 }, []];
    if (sql.startsWith('UPDATE users SET access_token_revoked_at')) { events.push('revoke-access'); return [{ affectedRows: 1 }, []]; }
    throw new Error('Unexpected fixture query: ' + sql);
  };
  pool.execute = ((sql: string, params: unknown[]) => execute(sql, params)) as Pool['execute'];
  pool.getConnection = (async () => {
    let transaction: Map<string, TokenRow> | undefined;
    let unlock: (() => void) | undefined;
    return {
      // Serialize the fixture transactions like the production FOR UPDATE row lock.
      beginTransaction: async () => {
        const previous = transactionTail;
        transactionTail = new Promise<void>(resolve => { unlock = resolve; });
        await previous; events.push('begin'); transaction = new Map(tokens);
      },
      execute: (sql: string, params: unknown[]) => execute(sql, params, transaction),
      commit: async () => { events.push('commit'); tokens = transaction!; transaction = undefined; },
      rollback: async () => { events.push('rollback'); transaction = undefined; },
      release: () => { events.push('release'); unlock?.(); },
    } as unknown as PoolConnection;
  }) as Pool['getConnection'];
  try {
    await run({ tokens: () => tokens, events, add(token, owner = user.id) {
      tokens.set(hash(token), { id: nextId++, user_id: owner, expires_at: new Date(Date.now() + 86400000).toISOString() });
    }, failInsert() { failInsert = true; } });
  } finally { Object.assign(pool, original); }
}

test('native CORS permits only exact bundled origins without cookie credentials', () => {
  for (const origin of ['capacitor://localhost', 'http://localhost', 'https://localhost']) {
    assert.equal(corsOptionsForOrigin(origin).origin, origin);
    assert.equal(corsOptionsForOrigin(origin).credentials, false);
  }
  for (const origin of ['https://localhost:9000', 'https://localhost.evil.invalid', 'http://127.0.0.1', 'capacitor://other', 'null', undefined]) {
    assert.equal(corsOptionsForOrigin(origin).origin, false);
    assert.equal(corsOptionsForOrigin(origin).credentials, false);
  }
  assert.equal(corsOptionsForOrigin('https://fixture.example').credentials, true, 'configured web origin keeps cookie behavior');
});

test('native rotation commits the replacement and removal together without recording another login', async () => withDatabase(async db => {
  const oldToken = signRefreshToken({ userId: user.id }); db.add(oldToken);
  const result = await Auth.refreshNative(oldToken);
  assert.equal(result.user.id, user.id); assert.notEqual(result.refreshToken, oldToken);
  assert.equal(db.tokens().has(hash(oldToken)), false);
  assert.equal(db.tokens().has(hash(result.refreshToken)), true);
  assert.deepEqual(db.events, ['begin', 'lock-refresh', 'insert-refresh', 'delete-owned-refresh', 'commit', 'release']);
  await assert.rejects(Auth.refreshNative(oldToken), error => (error as { statusCode: number }).statusCode === 401);
  assert.equal(db.tokens().size, 1, 'replaying a consumed refresh token must not create a second session');
}));

test('failed native rotation retains the previous device credential', async () => withDatabase(async db => {
  const token = signRefreshToken({ userId: user.id }); db.add(token); db.failInsert();
  await assert.rejects(Auth.refreshNative(token), /fixture insert failure/);
  assert.equal(db.tokens().has(hash(token)), true); assert.equal(db.tokens().size, 1);
  assert.ok(db.events.includes('rollback')); assert.equal(db.events.includes('commit'), false);
}));

test('native login lasts at most 90 days and refresh never moves its absolute deadline', async () => {
  const realNow = Date.now;
  const start = 1793520000123;
  let now = start;
  Date.now = () => now;
  try {
    await withDatabase(async db => {
      let session = await Auth.login(user.email, 'inert-fixture-password', 'native');
      const deadlineMs = Math.floor((start + 90 * DAY_MS) / 1000) * 1000;
      assert.equal(session.sessionExpiresAt, new Date(deadlineMs).toISOString());
      assert.equal(verifyRefreshToken(session.refreshToken).exp * 1000, deadlineMs);
      assert.equal(db.tokens().get(hash(session.refreshToken))!.expires_at, session.sessionExpiresAt);
      assert.equal(db.tokens().has(session.refreshToken), false, 'database stores the token digest only');
      const access = verifyAccessToken(session.accessToken);
      assert.equal(access.exp - access.iat, 15 * 60, 'access tokens remain short-lived');
      for (const nextTime of [start + 3 * DAY_MS, start + 89 * DAY_MS, deadlineMs - 1000]) {
        now = nextTime;
        session = await Auth.refreshNative(session.refreshToken);
        assert.equal(session.sessionExpiresAt, new Date(deadlineMs).toISOString());
        assert.equal(verifyRefreshToken(session.refreshToken).exp * 1000, deadlineMs);
        assert.equal(db.tokens().get(hash(session.refreshToken))!.expires_at, session.sessionExpiresAt);
      }
      now = deadlineMs;
      await assert.rejects(Auth.refreshNative(session.refreshToken), error => (error as { statusCode: number }).statusCode === 401);
      now = deadlineMs + DAY_MS;
      await assert.rejects(Auth.refreshNative(session.refreshToken), error => (error as { statusCode: number }).statusCode === 401);
      assert.equal(db.tokens().size, 1, 'expired refresh cannot create a replacement');
    });
  } finally { Date.now = realNow; }
});

test('web sessions retain seven-day expiry while legacy native refresh cannot extend its earlier deadline', async () => {
  const realNow = Date.now;
  const start = 1793520000000;
  let now = start;
  Date.now = () => now;
  try {
    await withDatabase(async db => {
      const web = await Auth.login(user.email, 'inert-fixture-password');
      const legacy = await Auth.login(user.email, 'inert-fixture-password');
      assert.equal(web.sessionExpiresAt, undefined);
      assert.equal(verifyRefreshToken(web.refreshToken).exp * 1000, start + 7 * DAY_MS);
      now += 2 * DAY_MS;
      const webRefresh = await Auth.refresh(web.refreshToken);
      assert.equal(webRefresh.sessionExpiresAt, undefined);
      assert.equal(verifyRefreshToken(webRefresh.refreshToken).exp * 1000, now + 7 * DAY_MS);
      assert.equal(db.tokens().get(hash(webRefresh.refreshToken))!.expires_at, new Date(now + 7 * DAY_MS).toISOString());
      const nativeRefresh = await Auth.refreshNative(legacy.refreshToken);
      assert.equal(nativeRefresh.sessionExpiresAt, new Date(start + 7 * DAY_MS).toISOString());
      assert.equal(verifyRefreshToken(nativeRefresh.refreshToken).exp * 1000, start + 7 * DAY_MS);
      now = start + 7 * DAY_MS;
      await assert.rejects(Auth.refreshNative(nativeRefresh.refreshToken), error => (error as { statusCode: number }).statusCode === 401);
    });
  } finally { Date.now = realNow; }
});

test('simultaneous native refresh requests consume the credential only once', async () => withDatabase(async db => {
  const token = signRefreshToken({ userId: user.id }); db.add(token);
  const results = await Promise.allSettled([Auth.refreshNative(token), Auth.refreshNative(token)]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  const rejected = results.find(result => result.status === 'rejected');
  assert.equal((rejected as PromiseRejectedResult).reason.statusCode, 401);
  assert.equal(db.tokens().size, 1);
  assert.equal(db.events.filter(event => event === 'insert-refresh').length, 1);
}));

test('native credentials cannot bypass their absolute deadline through the web refresh endpoint', async () => withDatabase(async db => {
  const session = await Auth.login(user.email, 'inert-fixture-password', 'native');
  assert.equal(verifyRefreshToken(session.refreshToken).nativeSession, true);
  await assert.rejects(Auth.refresh(session.refreshToken), /请在原生应用中刷新登录/);
  assert.equal(db.tokens().has(hash(session.refreshToken)), true, 'wrong endpoint does not consume the native credential');
  assert.equal(db.tokens().size, 1);
}));

test('native refresh chooses the earlier signed or stored deadline and rejects missing expiration', async () => withDatabase(async db => {
  const token = signRefreshToken({ userId: user.id }); db.add(token);
  const storedDeadline = Math.floor((Date.now() + DAY_MS) / 1000) * 1000;
  db.tokens().get(hash(token))!.expires_at = new Date(storedDeadline).toISOString();
  const shorterDb = await Auth.refreshNative(token);
  assert.equal(verifyRefreshToken(shorterDb.refreshToken).exp * 1000, storedDeadline);
  const signedToken = signRefreshToken({ userId: user.id }); db.add(signedToken);
  db.tokens().get(hash(signedToken))!.expires_at = new Date(Date.now() + 90 * DAY_MS).toISOString();
  const shorterJwt = await Auth.refreshNative(signedToken);
  assert.equal(verifyRefreshToken(shorterJwt.refreshToken).exp, verifyRefreshToken(signedToken).exp);
  const noExpiry = jwt.sign({ userId: user.id }, process.env.JWT_REFRESH_SECRET!); db.add(noExpiry);
  await assert.rejects(Auth.refreshNative(noExpiry), error => (error as { statusCode: number }).statusCode === 401);
}));

test('native refresh rejects expired, malformed and incorrectly owned credentials without creating a session', async () => withDatabase(async db => {
  const expired = signRefreshToken({ userId: user.id }); db.add(expired);
  db.tokens().get(hash(expired))!.expires_at = '2000-01-01T00:00:00Z';
  const mismatched = signRefreshToken({ userId: 99 }); db.add(mismatched, user.id);
  for (const token of [expired, mismatched, 'not-a-signed-refresh-credential']) {
    await assert.rejects(Auth.refreshNative(token), error => (error as { statusCode: number }).statusCode === 401);
  }
  assert.equal(db.tokens().size, 2); assert.equal(db.events.includes('insert-refresh'), false);
}));

test('native logout cannot revoke another account or all devices', async () => withDatabase(async db => {
  const other = signRefreshToken({ userId: 99 }), current = signRefreshToken({ userId: user.id }), second = signRefreshToken({ userId: user.id });
  db.add(other, 99); db.add(current); db.add(second);
  await assert.rejects(Auth.logoutNative(user.id, other), error => (error as { statusCode: number }).statusCode === 401);
  assert.equal(db.tokens().size, 3);
  await Auth.logoutNative(user.id, current);
  assert.equal(db.tokens().has(hash(other)), true); assert.equal(db.tokens().has(hash(second)), true);
  assert.equal(db.tokens().has(hash(current)), false);
  await assert.rejects(Auth.refreshNative(current), error => (error as { statusCode: number }).statusCode === 401);
}));

test('password reset revokes every existing 90-day native credential', async () => withDatabase(async db => {
  const first = await Auth.login(user.email, 'inert-fixture-password', 'native');
  const second = await Auth.login(user.email, 'inert-fixture-password', 'native');
  await Auth.resetPasswordWithToken('inert-reset-credential', 'inert-new-password');
  assert.equal(db.tokens().size, 0);
  assert.ok(db.events.includes('revoke-access'));
  for (const session of [first, second]) {
    await assert.rejects(Auth.refreshNative(session.refreshToken), error => (error as { statusCode: number }).statusCode === 401);
  }
}));

test('native HTTP auth returns JSON tokens, never cookies, and disables caching on validation failures too', async () => withDatabase(async db => {
  const app = express(); app.use(cors(corsOptions)); app.use(express.json()); app.use('/api/auth', authRoutes); app.use(errorHandler);
  const server = await new Promise<ReturnType<typeof app.listen>>(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
  try {
    const address = server.address(); assert.ok(address && typeof address !== 'string');
    const request = (path: string, body: unknown, token?: string) => fetch(`http://127.0.0.1:${address.port}/api/auth/native/${path}`, {
      method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://localhost', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body),
    });
    const invalid = await request('login', {});
    assert.equal(invalid.status, 400); assert.equal(invalid.headers.get('cache-control'), 'no-store');
    const login = await request('login', { identifier: user.email, password: 'inert-fixture-password' });
    assert.equal(login.status, 200); assert.equal(login.headers.get('set-cookie'), null);
    assert.equal(login.headers.get('access-control-allow-origin'), 'https://localhost');
    assert.equal(login.headers.get('access-control-allow-credentials'), null);
    assert.equal(login.headers.get('cache-control'), 'no-store');
    const session = (await login.json()).data;
    assert.equal(session.user.id, user.id); assert.equal(typeof session.refreshToken, 'string'); assert.equal(typeof session.accessToken, 'string');
    assert.equal(session.user.birthTime, null, 'native login includes the optional birth time');
    assert.equal(session.sessionExpiresAt, db.tokens().get(hash(session.refreshToken))!.expires_at);
    const missing = await request('logout', {}, signAccessToken({ userId: user.id }));
    assert.equal(missing.status, 400); assert.equal(db.tokens().size, 1);
    const refreshed = await request('refresh', { refreshToken: session.refreshToken });
    assert.equal(refreshed.status, 200); assert.equal(refreshed.headers.get('set-cookie'), null);
    assert.equal(db.events.filter(event => event === 'touch-login').length, 1, 'refresh is not a new login');
    const current = (await refreshed.json()).data;
    assert.equal(current.user.birthTime, null, 'native refresh keeps the public user birth-time field');
    assert.equal(current.sessionExpiresAt, session.sessionExpiresAt);
    const out = await request('logout', { refreshToken: current.refreshToken }, current.accessToken);
    assert.equal(out.status, 200); assert.equal(out.headers.get('cache-control'), 'no-store'); assert.equal(db.tokens().size, 0);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
}));
