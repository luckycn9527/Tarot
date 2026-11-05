import assert from 'node:assert/strict';
import test from 'node:test';
import { sanitizeSharedResultData } from '../utils/sharedReading.js';

test('public shares keep reading content and remove private follow-up metadata', () => {
  const result = sanitizeSharedResultData({
    interpretation: 'Public interpretation',
    advice: 'Public advice',
    messages: [{ type: 'reader', content: 'Public message', internal: 'remove me' }],
    followups: [{ question: 'Private update', answer: 'Private response' }],
    outcome: { rating: 'full' },
    internalPrompt: 'secret',
  });

  assert.deepEqual(result, {
    interpretation: 'Public interpretation',
    advice: 'Public advice',
    messages: [{ type: 'reader', content: 'Public message' }],
  });
});

test('malformed stored result data does not break a public share', () => {
  assert.equal(sanitizeSharedResultData('{not-json'), null);
  assert.equal(sanitizeSharedResultData(null), null);
});
