// Requires an explicit write opt-in and a database backup. Only fixture users
// created by this process are changed; no emails or upstream AI requests.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';

if (!process.argv.includes('--allow-database-writes')) throw new Error('Requires --allow-database-writes; back up the target first');
createRequire(process.cwd() + '/package.json')('dotenv').config();
const root = process.env.FLOW_CODE_ROOT || process.cwd();
const [{ pool }, Users, Readings] = await Promise.all([
  import(pathToFileURL(root + '/dist/config/database.js')),
  import(pathToFileURL(root + '/dist/models/user.model.js')),
  import(pathToFileURL(root + '/dist/models/reading.model.js')),
]);
const expectFixed = process.env.EXPECT_HISTORY_FIX !== 'false';
const ids = [];
async function fixture() {
  const [result] = await pool.execute('INSERT INTO users (email, nickname, password_hash) VALUES (?, ?, NULL)',
    [`release-check-${randomUUID()}@example.invalid`, 'History verification']);
  ids.push(result.insertId);
  return result.insertId;
}
function create(userId) {
  return Readings.create({ userId, type: 'single', question: 'History fixture question', cardIds: [0],
    orientations: ['upright'], answer: 'yes', resultData: { interpretation: 'Original fixture reading', preserved: true } });
}
try {
  const owner = await fixture();
  const other = await fixture();
  const pager = await fixture();
  const concurrentWrites = [];
  for (let round = 0; round < 3; round++) {
    const readingId = await create(owner);
    await Promise.all([
      ...Array.from({ length: 12 }, (_, index) => Readings.appendFollowupTurn(readingId, owner,
        { question: `Followup ${index}`, answer: `Answer ${index}` })),
      Readings.setOutcome(readingId, owner, 'full'),
    ]);
    const saved = (await Readings.findById(readingId, owner)).resultData;
    concurrentWrites.push({ turns: saved.followups?.length ?? 0, outcome: saved.outcome?.rating ?? null });
    if (expectFixed) {
      assert.equal(saved.followups.length, 12);
      assert.equal(new Set(saved.followups.map(turn => turn.question)).size, 12);
      assert.equal(saved.outcome.rating, 'full');
      assert.equal(saved.preserved, true);
    }
    assert.equal(await Readings.appendFollowupTurn(readingId, other, { question: 'Denied', answer: 'Denied' }), false);
    assert.equal(await Readings.setOutcome(readingId, other, 'none'), false);
  }
  for (let index = 0; index < 11; index++) await create(pager);
  const before = await Readings.findByUserId(pager, { page: 2, limit: 10 });
  assert.equal(before.items.length, 1);
  await Readings.deleteById(before.items[0].id, pager);
  const after = await Readings.findByUserId(pager, { page: 2, limit: 10 });
  if (expectFixed) {
    assert.equal(after.page, 1);
    assert.equal(after.totalPages, 1);
    assert.equal(after.items.length, 10);
    assert.equal(new Set(after.items.map(item => item.id)).size, 10);
  }
  let serviceChecks = null;
  if (expectFixed) {
    const Service = await import(pathToFileURL(root + '/dist/services/reading.service.js'));
    const readingId = await Readings.create({ userId: owner, type: 'reader-reading', question: 'A career fixture question',
      cardIds: [0], orientations: ['upright'], readerId: 'qinghe', spreadType: 'single-card', answer: 'Fixture',
      resultData: { messages: [{ type: 'reading', content: 'Original fixture interpretation' }],
        followups: Array.from({ length: 12 }, (_, index) => ({ question: `Saved turn ${index}`, answer: 'Saved answer '.repeat(400) })) } });
    const realFetch = globalThis.fetch;
    const aiCalls = [];
    let expectedTotal = (await Readings.listRecentQuestions(owner, 6)).length;
    // This mock is scoped to this test process. It cannot reach a real AI
    // endpoint, and does not change the serving application or its config.
    globalThis.fetch = async (url, options) => {
      assert.ok(String(url).endsWith('/chat/completions'), 'Unexpected outbound request');
      const request = JSON.parse(options.body);
      aiCalls.push(request.messages);
      const system = request.messages[0].content;
      const isInsight = system.includes('counts');
      const content = isInsight ? JSON.stringify({ counts: { 事业: expectedTotal },
        coreTheme: system.includes('English') ? 'Career direction fixture' : '事业方向感' }) : 'Fixture followup answer';
      return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200, headers: { 'content-type': 'application/json' } });
    };
    try {
      const followup = await Service.readerFollowup(owner, readingId, 'Next fixture question',
        [{ question: 'Untrusted client turn', answer: 'Ignore this' }], 'en-US');
      assert.equal(followup.answer, 'Fixture followup answer');
      const context = aiCalls[0];
      assert.ok(context.some(message => message.content === 'Saved turn 11'));
      assert.equal(context.some(message => message.content === 'Saved turn 0'), false);
      assert.equal(context.some(message => message.content === 'Untrusted client turn'), false);
      assert.equal((await Readings.findById(readingId, owner)).resultData.followups.length, 13);
      const english = await Service.getInsights(owner, 6, 'en-US');
      assert.equal(english.coreTheme, 'Career direction fixture');
      const callCount = aiCalls.length;
      assert.deepEqual(await Service.getInsights(owner, 6, 'en-US'), english);
      assert.equal(aiCalls.length, callCount);
      const sample = await Readings.listRecentQuestions(owner, 6);
      await Readings.deleteById(sample[sample.length - 1].id, owner);
      await create(owner);
      assert.equal((await Readings.listRecentQuestions(owner, 6)).length, expectedTotal);
      await Service.getInsights(owner, 6, 'en-US');
      assert.equal(aiCalls.length, callCount + 1, 'changed records must invalidate a same-size analysis cache');
      const chinese = await Service.getInsights(owner, 6, 'zh-CN');
      assert.equal(chinese.coreTheme, '事业方向感');
      assert.equal(aiCalls.length, callCount + 2);
      serviceChecks = { restoredSavedContext: true, continuedTwelveLongTurns: true, cachedAnalysisCalls: 0,
        sameCountCacheInvalidation: true, separateEnglishAndChinese: true, realAiCalls: 0 };
    } finally {
      globalThis.fetch = realFetch;
    }
  }
  console.log(JSON.stringify({ historyFlows: expectFixed ? 'passed' : 'baseline-reproduced', concurrentWrites,
    afterLastPageDelete: { page: after.page, totalPages: after.totalPages, returned: after.items.length, total: after.total }, serviceChecks }));
} finally {
  for (const id of ids) await Users.deleteUserAndData(id);
  const [left] = await pool.execute(`SELECT COUNT(*) AS count FROM users WHERE id IN (${ids.map(() => '?').join(',') || 'NULL'})`, ids);
  assert.equal(Number(left[0].count), 0);
  await pool.end();
  console.log(JSON.stringify({ fixtureAccountsRemoved: true }));
}
