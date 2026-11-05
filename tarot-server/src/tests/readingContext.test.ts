import assert from 'node:assert/strict';
import test from 'node:test';
import { historyInsightKey, recentSavedFollowups } from '../utils/readingContext.js';

test('saved long conversations restore the newest six turns in order with bounded prompt size', () => {
  const data = { followups: Array.from({ length: 12 }, (_, index) =>
    ({ question: `Question ${index}`, answer: 'A'.repeat(5000) })) };
  const context = recentSavedFollowups(data);
  assert.deepEqual(context.map(turn => turn.question), Array.from({ length: 6 }, (_, index) => `Question ${index + 6}`));
  assert.ok(context.every(turn => turn.answer.length === 2000));
  assert.equal(data.followups[11].answer.length, 5000, 'saved answers stay complete');
});

test('legacy or malformed followups do not prevent reading a saved conversation', () => {
  assert.deepEqual(recentSavedFollowups(null), []);
  assert.deepEqual(recentSavedFollowups({ followups: 'old value' }), []);
  assert.deepEqual(recentSavedFollowups({ followups: [null, {}, { question: 1, answer: 'bad' }, { question: ' ', answer: 'bad' },
    { question: 'Valid', answer: 'Answer' }] }), [{ question: 'Valid', answer: 'Answer' }]);
});

test('analysis cache changes when a full window changes, even with the same record count', () => {
  const rows = Array.from({ length: 200 }, (_, index) => ({ id: index + 1, question: `Question ${index}` }));
  const key = historyInsightKey(6, 'en-US', '2026-10-27', rows);
  assert.equal(historyInsightKey(6, 'en-US', '2026-10-27', [...rows]), key);
  const replaced = [{ id: 201, question: 'A new concern' }, ...rows.slice(0, -1)];
  assert.notEqual(historyInsightKey(6, 'en-US', '2026-10-27', replaced), key);
  assert.notEqual(historyInsightKey(6, 'en-US', '2026-10-27', [{ ...rows[0], question: 'Changed question' }, ...rows.slice(1)]), key);
});

test('analysis caches keep languages, reporting windows and business dates separate', () => {
  const rows = [{ id: 1, question: 'Career question' }];
  const key = historyInsightKey(6, 'en-US', '2026-10-27', rows);
  assert.notEqual(historyInsightKey(6, 'zh-CN', '2026-10-27', rows), key);
  assert.notEqual(historyInsightKey(3, 'en-US', '2026-10-27', rows), key);
  assert.notEqual(historyInsightKey(6, 'en-US', '2026-10-28', rows), key);
});
