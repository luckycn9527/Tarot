// Real MySQL transactions, using only random, independent fixture tables.
// No serving users, codes or redemptions are read or modified.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

if (!process.argv.includes('--allow-isolated-database-tests')) {
  throw new Error('Requires --allow-isolated-database-tests; only independent local fixture tables will be used');
}
const require = createRequire(process.cwd() + '/package.json');
require('dotenv').config({ quiet: true });
assert.ok(['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST || 'localhost'), 'This test is limited to local MySQL');
const root = process.env.FLOW_CODE_ROOT || process.cwd();
const [{ pool }, Model, Controller] = await Promise.all([
  import(pathToFileURL(root + '/dist/config/database.js')),
  import(pathToFileURL(root + '/dist/models/auxiliary.model.js')),
  import(pathToFileURL(root + '/dist/controllers/invitation.controller.js')),
]);
const prefix = `inv_redeem_test_${randomBytes(6).toString('hex')}_`;
assert.match(prefix, /^inv_redeem_test_[a-f0-9]{12}_$/);
const tableNames = ['users', 'invitation_codes', 'invitation_redemptions'];
const names = tableNames.map(name => prefix + name);
const table = name => {
  assert.ok(tableNames.includes(name));
  return '`' + prefix + name + '`';
};
const realQuery = pool.query.bind(pool), realExecute = pool.execute.bind(pool), realGet = pool.getConnection.bind(pool);
const originalMethods = { query: pool.query, execute: pool.execute, getConnection: pool.getConnection };
const pattern = new RegExp(`\\b(${tableNames.join('|')})\\b`, 'g');
const created = [];
let server = null, failRewardUser = null;
function rewriteAllowedSql(sql) {
  assert.equal(typeof sql, 'string');
  assert.ok(!/[;#]|--|\/\*/.test(sql), 'Multiple statements and SQL comments are forbidden');
  assert.match(sql.trim(), /^(?:SELECT\b|INSERT\s+INTO\b|UPDATE\b)/i, 'Only the expected redemption statement kinds are permitted');
  const referenced = [...sql.matchAll(/\b(?:FROM|JOIN|INTO|UPDATE)\s+`?([A-Za-z0-9_$.]+)`?/gi)].map(match => match[1]);
  assert.ok(referenced.length > 0 && referenced.every(name => tableNames.includes(name)), 'Every SQL table must be explicitly allowlisted before rewriting');
  const rewritten = sql.replace(pattern, name => prefix + name);
  assert.ok(!tableNames.some(name => new RegExp(`\\b${name}\\b`).test(rewritten)));
  return rewritten;
}
function wrapConnection(connection) {
  return new Proxy(connection, { get(target, key) {
    if (key === 'execute' || key === 'query') return (sql, ...args) => {
      const rewritten = rewriteAllowedSql(sql);
      if (sql.startsWith('UPDATE users') && Number(args[0]?.[1]) === failRewardUser) {
        // A real SQL failure after the counter + redemption INSERT must undo both.
        return target[key](`UPDATE ${table('users')} SET fixture_missing_column = 1 WHERE id = ?`, [failRewardUser]);
      }
      return target[key](rewritten, ...args);
    };
    const value = Reflect.get(target, key);
    return typeof value === 'function' ? value.bind(target) : value;
  } });
}
const day = 86400;
async function user({ membership = 'free', expires = null, quota = 3 } = {}) {
  const [result] = await realQuery(`INSERT INTO ${table('users')} (membership, membership_expires_at, remaining_free_quota) VALUES (?, ?, ?)`, [membership, expires, quota]);
  return result.insertId;
}
async function code(name, overrides = {}) {
  const row = { type: 'vip_days', value: 7, maxUses: 1, usedCount: 0, expires: null, active: 1, ...overrides };
  const [result] = await realQuery(`INSERT INTO ${table('invitation_codes')} (code, type, value, max_uses, used_count, expires_at, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [name, row.type, row.value, row.maxUses, row.usedCount, row.expires, row.active]);
  return { id: result.insertId, code: name };
}
async function state(userId, invitation) {
  const [users] = await realQuery(`SELECT membership, UNIX_TIMESTAMP(membership_expires_at) AS expires, remaining_free_quota AS quota FROM ${table('users')} WHERE id = ?`, [userId]);
  const [codes] = await realQuery(`SELECT used_count FROM ${table('invitation_codes')} WHERE id = ?`, [invitation.id]);
  const [records] = await realQuery(`SELECT id, code_id, user_id FROM ${table('invitation_redemptions')} WHERE code_id = ? ORDER BY id`, [invitation.id]);
  return { user: { ...users[0] }, usedCount: codes[0].used_count, records: records.map(row => ({ ...row })) };
}
async function expectRemainingDays(userId, days) {
  const [rows] = await realQuery(`SELECT membership, TIMESTAMPDIFF(SECOND, NOW(), membership_expires_at) AS seconds_left FROM ${table('users')} WHERE id = ?`, [userId]);
  assert.equal(rows[0].membership, 'vip');
  assert.ok(Math.abs(rows[0].seconds_left - days * day) <= 5, `Expected ${days} days from now, got ${rows[0].seconds_left} seconds`);
  return rows[0].seconds_left;
}

try {
  // Deliberately independent definitions: no CREATE LIKE, production foreign keys
  // or SELECTs against the serving tables. DOUBLE/VARCHAR also allow damage cases.
  await realQuery(`CREATE TABLE ${table('users')} (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    membership ENUM('free','vip') NOT NULL DEFAULT 'free', membership_expires_at DATETIME NULL,
    remaining_free_quota INT NOT NULL DEFAULT 3
  ) ENGINE=InnoDB`); created.push(prefix + 'users');
  await realQuery(`CREATE TABLE ${table('invitation_codes')} (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, code VARCHAR(50) NOT NULL UNIQUE,
    type VARCHAR(30) NOT NULL, value DOUBLE NULL, max_uses INT NOT NULL DEFAULT 1,
    used_count INT NOT NULL DEFAULT 0, expires_at DATETIME NULL, is_active TINYINT NOT NULL DEFAULT 1
  ) ENGINE=InnoDB`); created.push(prefix + 'invitation_codes');
  await realQuery(`CREATE TABLE ${table('invitation_redemptions')} (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, code_id BIGINT UNSIGNED NOT NULL, user_id BIGINT UNSIGNED NOT NULL,
    UNIQUE KEY uk_code_user (code_id, user_id),
    FOREIGN KEY (code_id) REFERENCES ${table('invitation_codes')}(id),
    FOREIGN KEY (user_id) REFERENCES ${table('users')}(id)
  ) ENGINE=InnoDB`); created.push(prefix + 'invitation_redemptions');
  const [foreignKeys] = await realQuery(`SELECT REFERENCED_TABLE_NAME AS target FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND REFERENCED_TABLE_NAME IS NOT NULL`, [prefix + 'invitation_redemptions']);
  assert.equal(foreignKeys.length, 2);
  assert.ok(foreignKeys.every(row => names.includes(row.target)), 'Every fixture FK must remain inside this fixture');
  // AdminModel writes through pool.execute, whereas redemption uses a connection.
  // Install every guard before importing/calling the real admin controller.
  pool.query = (sql, ...args) => realQuery(rewriteAllowedSql(sql), ...args);
  pool.execute = (sql, ...args) => realExecute(rewriteAllowedSql(sql), ...args);
  pool.getConnection = async () => wrapConnection(await realGet());
  assert.throws(() => pool.execute('DELETE FROM users'), /expected redemption statement kinds/);
  assert.throws(() => pool.query('SELECT * FROM admin_users'), /explicitly allowlisted/);
  assert.throws(() => pool.query('SELECT * FROM users JOIN admin_users ON 1 = 1'), /explicitly allowlisted/);
  const AdminController = await import(pathToFileURL(root + '/dist/controllers/admin.controller.js'));

  const single = await code('SINGLE_USE', { type: 'quota', value: 5 });
  const contenders = await Promise.all(Array.from({ length: 12 }, () => user()));
  const race = await Promise.allSettled(contenders.map(id => Model.redeemCode(id, single.code)));
  assert.equal(race.filter(result => result.status === 'fulfilled').length, 1);
  assert.ok(race.filter(result => result.status === 'rejected').every(result => result.reason instanceof Model.InvitationRedemptionError && result.reason.code === 'INVITATION_EXHAUSTED'));
  const singleState = await state(contenders[0], single);
  assert.equal(singleState.usedCount, 1); assert.equal(singleState.records.length, 1);
  const [quotaSum] = await realQuery(`SELECT SUM(remaining_free_quota) AS n FROM ${table('users')}`);
  assert.equal(Number(quotaSum[0].n), contenders.length * 3 + 5);

  const active = await user({ membership: 'vip', expires: new Date(Date.now() + 30 * day * 1000) });
  const stackedCodes = await Promise.all(Array.from({ length: 8 }, (_, i) => code(`STACK_${i}`, { value: i + 1 })));
  const initial = (await state(active, stackedCodes[0])).user.expires;
  const stacked = await Promise.all(stackedCodes.map(row => Model.redeemCode(active, row.code)));
  assert.equal(stacked.length, 8);
  const afterStack = await state(active, stackedCodes[0]);
  assert.equal(afterStack.user.expires, Number(initial) + 36 * day);
  const [stackRecords] = await realQuery(`SELECT COUNT(*) AS n FROM ${table('invitation_redemptions')} WHERE user_id = ?`, [active]);
  assert.equal(stackRecords[0].n, 8);

  // Different users and different initially unused codes must not contend on an
  // empty redemption-index gap and deadlock either.
  const independent = await Promise.all(Array.from({ length: 6 }, async (_, i) => ({ user: await user(), invitation: await code(`INDEPENDENT_${i}`, { type: 'quota', value: 1 }) })));
  assert.equal((await Promise.all(independent.map(row => Model.redeemCode(row.user, row.invitation.code)))).length, 6);

  const repeatUser = await user(), repeatCode = await code('REPEATED', { type: 'quota', value: 2, maxUses: 10 });
  const repeated = await Promise.allSettled([Model.redeemCode(repeatUser, repeatCode.code), Model.redeemCode(repeatUser, repeatCode.code)]);
  assert.equal(repeated.filter(row => row.status === 'fulfilled').length, 1);
  assert.equal(repeated.find(row => row.status === 'rejected').reason.code, 'INVITATION_ALREADY_REDEEMED');
  assert.equal((await state(repeatUser, repeatCode)).usedCount, 1);
  assert.equal((await state(repeatUser, repeatCode)).user.quota, 5);
  const repeatBefore = await state(repeatUser, repeatCode);
  await assert.rejects(Model.redeemCode(repeatUser, repeatCode.code), error => error.code === 'INVITATION_ALREADY_REDEEMED');
  assert.deepEqual(await state(repeatUser, repeatCode), repeatBefore);

  for (const [label, setup] of [['FREE_NULL', {}], ['EXPIRED_VIP', { membership: 'vip', expires: new Date(Date.now() - day * 1000) }], ['EXPIRED_FREE', { expires: new Date(Date.now() - day * 1000) }]]) {
    const id = await user(setup), reward = await code(label, { value: 4 });
    await Model.redeemCode(id, reward.code); await expectRemainingDays(id, 4);
    assert.equal((await state(id, reward)).usedCount, 1);
  }
  const lifetime = await user({ membership: 'vip', expires: null, quota: 9 });
  const lifetimeCode = await code('LIFETIME', { value: 3650 });
  await Model.redeemCode(lifetime, lifetimeCode.code);
  assert.deepEqual((await state(lifetime, lifetimeCode)).user, { membership: 'vip', expires: null, quota: 9 });
  assert.equal((await state(lifetime, lifetimeCode)).usedCount, 1);
  const quotaCode = await code('QUOTA_COMPAT', { type: 'quota', value: 10 });
  const quotaResult = await Model.redeemCode(lifetime, quotaCode.code);
  assert.equal(quotaResult.type, 'quota'); assert.equal(quotaResult.value, 10);
  assert.deepEqual((await state(lifetime, quotaCode)).user, { membership: 'vip', expires: null, quota: 19 });

  const unchangedUser = await user();
  const rejected = [
    ['DISABLED', { active: 0 }, 'INVITATION_DISABLED'],
    ['EXPIRED', { expires: new Date(Date.now() - 1000) }, 'INVITATION_EXPIRED'],
    ['EXHAUSTED', { usedCount: 1 }, 'INVITATION_EXHAUSTED'],
    ['UNKNOWN_TYPE', { type: 'unknown' }, 'INVITATION_INVALID'],
    ['ZERO_VALUE', { value: 0 }, 'INVITATION_INVALID'],
    ['NEGATIVE_VALUE', { value: -1 }, 'INVITATION_INVALID'],
    ['FRACTIONAL_VALUE', { value: 1.5 }, 'INVITATION_INVALID'],
    ['NULL_VALUE', { value: null }, 'INVITATION_INVALID'],
    ['TOO_LARGE_VALUE', { value: 2147483647 }, 'INVITATION_INVALID'],
  ];
  for (const [label, overrides, expected] of rejected) {
    const reward = await code(label, overrides), before = await state(unchangedUser, reward);
    await assert.rejects(Model.redeemCode(unchangedUser, reward.code), error => error instanceof Model.InvitationRedemptionError && error.code === expected);
    assert.deepEqual(await state(unchangedUser, reward), before, `${label} must not consume or change anything`);
  }

  const express = require('express'), app = express(); app.use(express.json());
  app.post('/api/invitations/redeem', (req, res) => { req.userId = Number(req.headers['x-fixture-user']); return Controller.redeem(req, res); });
  app.post('/api/admin/invitation-codes', AdminController.createInvitationCode);
  app.use((error, _req, res, _next) => { res.status(error.statusCode || 500).json({ success: false, message: error.message }); });
  server = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  async function api(id, value) {
    const response = await fetch(origin + '/api/invitations/redeem', { method: 'POST', headers: { 'content-type': 'application/json', 'x-fixture-user': String(id) }, body: JSON.stringify({ code: value }), signal: AbortSignal.timeout(15000) });
    return { status: response.status, body: await response.json() };
  }
  const adminPipelineCases = [];
  for (const days of [30, 90, 365]) {
    // Omit code deliberately: run AdminController -> AdminService random-code
    // generation -> AdminModel INSERT, then redeem that same row via HTTP.
    const createdResponse = await fetch(origin + '/api/admin/invitation-codes', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'vip_days', value: days, maxUses: 1, expiresAt: null }),
      signal: AbortSignal.timeout(15000),
    });
    const createdBody = await createdResponse.json();
    assert.equal(createdResponse.status, 201); assert.equal(createdBody.success, true);
    assert.match(createdBody.data.code, /^ETOMD-[A-F0-9]{12}$/);
    assert.ok(Number.isSafeInteger(createdBody.data.id));
    const generated = createdBody.data, member = await user();
    const [stored] = await realQuery(`SELECT code, type, value, max_uses, used_count, is_active FROM ${table('invitation_codes')} WHERE id = ?`, [generated.id]);
    assert.deepEqual({ ...stored[0] }, { code: generated.code, type: 'vip_days', value: days, max_uses: 1, used_count: 0, is_active: 1 });
    const redeemed = await api(member, generated.code);
    assert.equal(redeemed.status, 200); assert.equal(redeemed.body.success, true);
    assert.equal(redeemed.body.data.type, 'vip_days'); assert.equal(redeemed.body.data.value, days);
    const remainingSeconds = await expectRemainingDays(member, days);
    const afterRedeem = await state(member, generated);
    assert.equal(afterRedeem.usedCount, 1); assert.equal(afterRedeem.records.length, 1);
    assert.equal(afterRedeem.records[0].user_id, member);
    const again = await api(member, generated.code);
    assert.equal(again.status, 400); assert.equal(again.body.code, 'INVITATION_ALREADY_REDEEMED');
    assert.deepEqual(await state(member, generated), afterRedeem);
    adminPipelineCases.push({ days, createStatus: createdResponse.status, redeemStatus: redeemed.status,
      duplicateStatus: again.status, usedCount: afterRedeem.usedCount, redemptionRecords: afterRedeem.records.length, remainingSeconds });
  }
  const apiUser = await user(), apiCode = await code('API_SUCCESS', { value: 3 });
  const success = await api(apiUser, `  ${apiCode.code}  `);
  assert.equal(success.status, 200); assert.equal(success.body.success, true);
  assert.equal(success.body.data.type, 'vip_days'); assert.equal(success.body.data.value, 3);
  await expectRemainingDays(apiUser, 3);
  const duplicate = await api(apiUser, apiCode.code);
  assert.equal(duplicate.status, 400); assert.equal(duplicate.body.code, 'INVITATION_ALREADY_REDEEMED');
  const failureUser = await user(), failureCode = await code('API_SQL_FAILURE', { type: 'quota', value: 10 });
  const beforeFailure = await state(failureUser, failureCode);
  failRewardUser = failureUser;
  const failed = await api(failureUser, failureCode.code);
  failRewardUser = null;
  assert.equal(failed.status, 500);
  assert.deepEqual(failed.body, { success: false, message: '兑换失败，请稍后重试' });
  assert.deepEqual(await state(failureUser, failureCode), beforeFailure, 'SQL failure must roll back the use, record and reward');
  console.log(JSON.stringify({ invitationRedemptionFlows: 'passed', isolatedTables: true, fixtureForeignKeys: true,
    singleUseRace: true, duplicateRejected: true, sameUserDifferentCodesStack: true, unrelatedRedemptionsConcurrent: true,
    freeNullStartsNow: true, expiredMembershipStartsNow: true, activeMembershipExtends: true, lifetimeVipPreserved: true,
    quotaCompatible: true, invalidCodesUnconsumed: true, sqlFailureRollback: true, safeHttpErrors: true,
    strictSqlIsolation: true, adminToRedeemPipeline: true, adminGeneratedMembershipDays: [30, 90, 365], adminPipelineCases,
    servingBusinessWrites: 0 }));
} finally {
  if (server) await new Promise(resolve => server.close(resolve));
  Object.assign(pool, originalMethods);
  for (const name of created.reverse()) {
    assert.ok(name.startsWith(prefix) && names.includes(name));
    await realQuery(`DROP TABLE IF EXISTS \`${name}\``);
  }
  const [remaining] = await realQuery(`SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (${names.map(() => '?').join(',')})`, names);
  await pool.end();
  assert.equal(remaining.length, 0);
  console.log(JSON.stringify({ fixtureTablesRemoved: true, remainingFixtureTables: remaining.length }));
}
