import assert from 'node:assert/strict';
import test from 'node:test';
import { mobileReadingSchema, mobileFollowupSchema } from '../schemas/mobile.schema.js';
import { mobilePayloadHash } from '../utils/mobileRequest.js';

const input = {
  requestId: '016e83c3-8136-49b5-8554-223320b1fd12', readerId: 'qinghe', spreadType: 'single',
  question: '现在可以从哪里开始行动？', cardIds: [0], orientations: ['upright'], locale: 'zh-CN',
};
test('mobile validation preserves card zero and the original selected spread', () => {
  assert.equal(mobileReadingSchema.parse(input).cardIds[0], 0);
  assert.equal(mobileReadingSchema.safeParse({ ...input, spreadType: 'problem' }).success, false);
  assert.equal(mobileReadingSchema.safeParse({ ...input, spreadType: 'problem', cardIds: [0, 1, 1], orientations: ['upright', 'reversed', 'upright'] }).success, false);
  assert.equal(mobileReadingSchema.safeParse({ ...input, cardIds: [78] }).success, false);
  assert.equal(mobileReadingSchema.safeParse({ ...input, orientations: [] }).success, false);
  assert.equal(mobileReadingSchema.safeParse({ ...input, spreadType: 'celtic-cross' }).success, false);
  assert.equal(mobileFollowupSchema.safeParse({ requestId: input.requestId, readingId: 0, question: '下一步呢' }).success, false);
});
test('a mobile submission hash forbids reusing a request for another question, orientation, order or operation', () => {
  const payload = mobileReadingSchema.parse(input);
  const hash = mobilePayloadHash('reading', payload);
  assert.equal(hash, mobilePayloadHash('reading', { ...payload, requestId: '45a23db7-8026-493e-b3f3-d17287909485' }));
  assert.equal(hash, mobilePayloadHash('reading', Object.fromEntries(Object.entries(payload).reverse())));
  for (const altered of [{ ...payload, question: '我可以如何改善现在的状况？' }, { ...payload, orientations: ['reversed'] }, { ...payload, cardIds: [1] }]) {
    assert.notEqual(hash, mobilePayloadHash('reading', altered));
  }
  assert.notEqual(hash, mobilePayloadHash('followup', payload));
  assert.notEqual(mobilePayloadHash('reading', { cardIds: [0, 1, 2] }), mobilePayloadHash('reading', { cardIds: [2, 1, 0] }));
});
