import assert from 'node:assert/strict';
import test from 'node:test';
import type { Request, Response } from 'express';
import type { PoolConnection } from 'mysql2/promise';

// Every database operation is intercepted; no serving data is read or written.
process.env.NODE_ENV = 'test';
process.env.DB_PASSWORD = 'inert-redemption-database-password';
process.env.JWT_ACCESS_SECRET = 'inert-redemption-access-secret';
process.env.JWT_REFRESH_SECRET = 'inert-redemption-refresh-secret';
process.env.ADMIN_USERNAME_PEPPER = 'inert-redemption-admin-pepper';
process.env.ADMIN_JWT_SECRET = 'inert-redemption-admin-secret';
const [{ pool }, Model, Controller] = await Promise.all([
  import('../config/database.js'), import('../models/auxiliary.model.js'), import('../controllers/invitation.controller.js'),
]);
test.after(async () => { await pool.end(); });

const invitation = { id: 4, type: 'vip_days', value: 7, is_active: 1, expires_at: null };

async function withDatabase(
  options: { row?: Record<string, unknown> | null; redeemed?: boolean; exhausted?: boolean; missingUser?: boolean; updateError?: Error },
  run: (calls: string[]) => Promise<void>,
) {
  const original = pool.getConnection;
  const calls: string[] = [];
  const connection = {
    beginTransaction: async () => { calls.push('begin'); },
    commit: async () => { calls.push('commit'); },
    rollback: async () => { calls.push('rollback'); },
    release: () => { calls.push('release'); },
    execute: async (sql: string) => {
      calls.push(sql);
      if (sql.startsWith('SELECT * FROM invitation_codes')) return [options.row === null ? [] : [{ ...invitation, ...options.row }], []];
      if (sql.startsWith('SELECT id FROM users')) return [options.missingUser ? [] : [{ id: 8 }], []];
      if (sql.startsWith('SELECT id FROM invitation_redemptions')) return [options.redeemed ? [{ id: 1 }] : [], []];
      if (sql.startsWith('UPDATE invitation_codes')) return [{ affectedRows: options.exhausted ? 0 : 1 }, []];
      if (sql.startsWith('UPDATE users') && options.updateError) throw options.updateError;
      if (sql.startsWith('INSERT INTO invitation_redemptions') || sql.startsWith('UPDATE users')) return [{ affectedRows: 1 }, []];
      throw new Error(`Unexpected fixture query: ${sql}`);
    },
  } as unknown as PoolConnection;
  pool.getConnection = (async () => connection) as typeof pool.getConnection;
  try { await run(calls); } finally { pool.getConnection = original; }
}

test('unsupported or damaged rewards are rejected before consuming a code', async () => {
  const invalid = [
    { type: 'unexpected' }, { value: 0 }, { value: -1 }, { value: 1.5 }, { value: NaN },
    { value: Infinity }, { value: null }, { value: '7' }, { value: 3651 }, { value: 2147483647 },
    { expires_at: 'invalid-date' },
  ];
  for (const row of invalid) {
    await withDatabase({ row }, async calls => {
      await assert.rejects(Model.redeemCode(8, 'TEST-VIP'), error => error instanceof Model.InvitationRedemptionError && error.code === 'INVITATION_INVALID');
      assert.equal(calls.filter(sql => /^(UPDATE|INSERT)/.test(sql)).length, 0);
      assert.deepEqual(calls.slice(-2), ['rollback', 'release']);
    });
  }
});

test('an expiry exactly equal to now is expired', async () => {
  const originalNow = Date.now;
  const now = 1793664000000;
  Date.now = () => now;
  try {
    await withDatabase({ row: { expires_at: new Date(now) } }, async calls => {
      await assert.rejects(Model.redeemCode(8, 'BOUNDARY'), error => error instanceof Model.InvitationRedemptionError && error.code === 'INVITATION_EXPIRED');
      assert.equal(calls.filter(sql => /^(UPDATE|INSERT)/.test(sql)).length, 0);
    });
  } finally { Date.now = originalNow; }
});

test('missing, disabled, duplicate and exhausted codes roll back with known business errors', async () => {
  const cases = [
    { options: { row: null }, code: 'INVITATION_NOT_FOUND' },
    { options: { row: { is_active: 0 } }, code: 'INVITATION_DISABLED' },
    { options: { redeemed: true }, code: 'INVITATION_ALREADY_REDEEMED' },
    { options: { exhausted: true }, code: 'INVITATION_EXHAUSTED' },
  ];
  for (const fixture of cases) {
    await withDatabase(fixture.options, async calls => {
      await assert.rejects(Model.redeemCode(8, 'FAILED'), error => error instanceof Model.InvitationRedemptionError && error.code === fixture.code);
      assert.equal(calls.some(sql => sql.startsWith('INSERT') || sql.startsWith('UPDATE users')), false);
      assert.deepEqual(calls.slice(-2), ['rollback', 'release']);
      assert.equal(calls.includes('commit'), false);
    });
  }
});

test('a reward update failure rolls back the reservation and record instead of returning success', async () => {
  const error = new Error('Fixture database reward failure');
  await withDatabase({ updateError: error }, async calls => {
    await assert.rejects(Model.redeemCode(8, 'FAILED'), value => value === error);
    assert.ok(calls.some(sql => sql.startsWith('INSERT INTO invitation_redemptions')));
    assert.deepEqual(calls.slice(-2), ['rollback', 'release']);
    assert.equal(calls.includes('commit'), false);
  });
});

function response() {
  return {
    statusCode: 200,
    body: undefined as unknown,
    status(status: number) { this.statusCode = status; return this; },
    json(body: unknown) { this.body = body; return this; },
  };
}

test('controller rejects malformed input safely and exposes only known business messages', async () => {
  for (const body of [undefined, null, {}, { code: null }, { code: 1234 }, { code: '  ' }, { code: 'BAD CODE' }]) {
    const res = response();
    await Controller.redeem({ body, userId: 8 } as Request, res as unknown as Response);
    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body, { success: false, message: '兑换码格式无效', code: 'INVITATION_FORMAT_INVALID' });
  }
  await withDatabase({ row: null }, async () => {
    const res = response();
    await Controller.redeem({ body: { code: '  MISSING  ' }, userId: 8 } as Request, res as unknown as Response);
    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body, { success: false, message: '兑换码不存在', code: 'INVITATION_NOT_FOUND' });
  });
});

test('controller sends generic 500 for SQL/connection errors, even a forged business message', async () => {
  const original = pool.getConnection;
  try {
    for (const error of [new Error('SQLSTATE 42000 SELECT fixture_secret'), new Error('兑换码不存在')]) {
      pool.getConnection = (async () => { throw error; }) as typeof pool.getConnection;
      const res = response();
      await Controller.redeem({ body: { code: 'VALID' }, userId: 8 } as Request, res as unknown as Response);
      assert.equal(res.statusCode, 500);
      assert.deepEqual(res.body, { success: false, message: '兑换失败，请稍后重试' });
    }
  } finally { pool.getConnection = original; }
});

test('quota and VIP rewards retain the existing success payload and commit once', async () => {
  for (const type of ['quota', 'vip_days']) {
    await withDatabase({ row: { type, value: 7 } }, async calls => {
      const result = await Model.redeemCode(8, 'SUCCESS');
      assert.deepEqual(result, { type, value: 7, message: type === 'quota' ? '成功获得 7 次额外占卜次数' : '成功获得 7 天 VIP 会员' });
      assert.deepEqual(calls.slice(-2), ['commit', 'release']);
      assert.equal(calls.includes('rollback'), false);
    });
  }
});
