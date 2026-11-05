// Explicit opt-in: creates and removes only isolated fixture accounts in the
// configured database. Back up the target before running against production.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';

if (!process.argv.includes('--allow-database-writes')) {
  throw new Error('Requires --allow-database-writes; back up the target database first');
}
const require = createRequire(process.cwd() + '/package.json');
require('dotenv').config();
const code = process.env.FLOW_CODE_ROOT || process.cwd();
const [{ pool }, Users, Readings, { signAccessToken }, { quotaWindow }] = await Promise.all([
  import(pathToFileURL(code + '/dist/config/database.js')),
  import(pathToFileURL(code + '/dist/models/user.model.js')),
  import(pathToFileURL(code + '/dist/models/reading.model.js')),
  import(pathToFileURL(code + '/dist/utils/jwt.js')),
  import(pathToFileURL(code + '/dist/utils/quotaDate.js')),
]);
const expectFixed = process.env.EXPECT_FLOW_FIX !== 'false';
const ids = [];
const today = quotaWindow(process.env.QUOTA_TIME_ZONE || 'UTC').businessDate;
const yesterday = new Date(Date.parse(today + 'T12:00:00Z') - 86400000).toISOString().slice(0, 10);
async function fixture() {
  const [result] = await pool.execute('INSERT INTO users (email, nickname, password_hash) VALUES (?, ?, NULL)',
    [`release-check-${randomUUID()}@example.invalid`, 'Flow verification']);
  ids.push(result.insertId);
  return result.insertId;
}
async function setQuota(id, membership, expires, remaining = 3) {
  await pool.execute(`UPDATE users SET membership = ?, membership_expires_at = ?,
    remaining_free_quota = ?, quota_reset_date = ?, remaining_daily_fortune_quota = 1,
    daily_fortune_quota_reset_date = ?, remaining_fate_dual_quota = 1,
    fate_dual_quota_reset_date = ? WHERE id = ?`,
    [membership, expires, remaining, today, today, today, id]);
}
async function quotas(id) {
  const user = await Users.findById(id);
  return [user.remaining_free_quota, user.remaining_daily_fortune_quota, user.remaining_fate_dual_quota];
}
async function api(path, method = 'GET', body, userId) {
  const response = await fetch('http://127.0.0.1:5174/api' + path, {
    method, headers: { 'content-type': 'application/json', ...(userId ? { authorization: `Bearer ${signAccessToken({ userId })}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(10000),
  });
  return { status: response.status, body: await response.json() };
}
try {
  const owner = await fixture();
  const other = await fixture();
  const expired = new Date(Date.now() - 86400000);
  const future = new Date(Date.now() + 86400000);
  const consumers = [Users.consumeQuota, Users.consumeDailyFortuneQuota, Users.consumeFateDualQuota];
  const refunds = [Users.refundQuota, Users.refundDailyFortuneQuota, Users.refundFateDualQuota];
  await setQuota(owner, 'vip', expired);
  for (let i = 0; i < 3; i++) {
    assert.equal(await consumers[i](owner, today), 'ok');
    await refunds[i](owner, today);
  }
  const expiredAfterRefund = await quotas(owner);
  if (expectFixed) assert.deepEqual(expiredAfterRefund, [3, 1, 1]);

  await setQuota(owner, 'free', null, 10);
  assert.equal(await Users.consumeQuota(owner, today), 'ok');
  await Users.refundQuota(owner, today);
  const bonusAfterRefund = (await quotas(owner))[0];
  if (expectFixed) assert.equal(bonusAfterRefund, 10);

  await setQuota(owner, 'free', null);
  const staleResults = [];
  for (const consume of consumers) staleResults.push(await consume(owner, yesterday));
  const afterStaleRequest = await quotas(owner);
  if (expectFixed) {
    assert.deepEqual(staleResults, ['exhausted', 'exhausted', 'exhausted']);
    assert.deepEqual(afterStaleRequest, [3, 1, 1]);
  }
  await Users.refundQuota(owner, yesterday);
  assert.deepEqual(await quotas(owner), afterStaleRequest);

  await setQuota(owner, 'vip', future);
  for (const consume of consumers) assert.equal(await consume(owner, today), 'vip');
  assert.deepEqual(await quotas(owner), [3, 1, 1]);

  const readingId = await Readings.create({ userId: owner, type: 'single', question: 'Release fixture question',
    cardIds: [0], orientations: ['upright'], answer: '是', resultData: { interpretation: 'Public fixture reading',
      followups: [{ question: 'Private fixture followup', answer: 'Private fixture answer' }], _requestId: randomUUID() } });
  assert.equal((await api('/shares', 'POST', { readingId }, other)).status, 404);
  const shared = await api('/shares', 'POST', { readingId }, owner);
  assert.equal(shared.status, 200);
  const code = shared.body.data.shareCode;
  assert.equal((await api('/shares', 'POST', { readingId }, owner)).body.data.shareCode, code);
  const mine = await api('/shares/mine', 'GET', undefined, owner);
  assert.equal(mine.body.data.length, 1);
  const publicReading = await api('/shares/' + code);
  assert.equal(publicReading.status, 200);
  assert.equal(publicReading.body.data.resultData.interpretation, 'Public fixture reading');
  for (const key of ['followups', '_requestId', 'userId']) assert.equal(key in publicReading.body.data.resultData, false);
  assert.equal((await api('/shares/' + code, 'DELETE', undefined, other)).status, 404);
  assert.equal((await api('/shares/' + code, 'DELETE', undefined, owner)).status, 200);
  assert.equal((await api('/shares/' + code)).status, 404);
  const second = await api('/shares', 'POST', { readingId }, owner);
  assert.equal(second.status, 200);
  assert.equal((await api('/readings/history/' + readingId, 'DELETE', undefined, owner)).status, 200);
  assert.equal((await api('/shares/' + second.body.data.shareCode)).status, 404);
  assert.equal((await api('/shares/mine', 'GET', undefined, owner)).body.data.length, 0);
  console.log(JSON.stringify({ flows: expectFixed ? 'passed' : 'baseline-reproduced', expiredAfterRefund,
    bonusAfterRefund, staleResults, afterStaleRequest, activeVipUnlimited: true, shareOwnershipAndRevocation: true }));
} finally {
  for (const id of ids) await Users.deleteUserAndData(id);
  const [left] = await pool.execute(`SELECT COUNT(*) AS count FROM users WHERE id IN (${ids.map(() => '?').join(',') || 'NULL'})`, ids);
  assert.equal(Number(left[0].count), 0);
  await pool.end();
  console.log(JSON.stringify({ fixtureAccountsRemoved: true }));
}
