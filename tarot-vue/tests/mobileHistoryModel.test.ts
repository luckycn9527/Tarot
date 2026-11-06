import assert from 'node:assert/strict'
import test from 'node:test'
import { historyFilterError, normalizeMobileOutcome, validHistoryDate } from '../src/mobile/mobileHistoryModel'

test('history dates reject rollover days and invalid formats, including non-leap February', () => {
  for (const date of ['2026-11-05', '2024-02-29', '2000-02-29', '2026-12-31']) assert.equal(validHistoryDate(date), true, date)
  for (const date of ['2026-02-29', '2026-02-30', '2026-04-31', '1900-02-29', '2026-00-01', '2026-13-01', '2026-11-00', '2026-11-32', '0000-01-01', '2026-1-01', '2026-01-1', ' 2026-11-05 ', '2026-11-05T00:00:00Z', '']) {
    assert.equal(validHistoryDate(date), false, date)
  }
})

test('history filters allow open bounds and equal days but reject inverted ranges in both languages', () => {
  for (const filters of [
    { type: '', from: '', to: '' },
    { type: 'single', from: '2026-11-01', to: '' },
    { type: 'three-card', from: '', to: '2026-11-05' },
    { type: 'reader-reading', from: '2026-11-05', to: '2026-11-05' },
  ]) assert.equal(historyFilterError(filters), '')
  const inverted = { type: '', from: '2026-11-05', to: '2026-11-04' }
  assert.match(historyFilterError(inverted), /开始日期不能晚于结束日期/)
  assert.match(historyFilterError(inverted, true), /start date.*before.*end date/)
  for (const filters of [
    { type: 'daily-fortune', from: '', to: '' },
    { type: 'unsupported', from: '', to: '' },
    { type: '', from: '2026-02-30', to: '' },
    { type: '', from: '', to: 'invalid' },
  ]) {
    assert.notEqual(historyFilterError(filters), '')
    assert.notEqual(historyFilterError(filters, true), '')
  }
})

test('outcome normalizer accepts only server rating enum and preserves optional recorded time', () => {
  for (const rating of ['full', 'partial', 'none'] as const) {
    assert.deepEqual(normalizeMobileOutcome({ rating }), { rating })
    assert.deepEqual(normalizeMobileOutcome({ rating, at: '2026-11-05T08:30:00Z', notes: 'unsupported' }), { rating, at: '2026-11-05T08:30:00Z' })
    assert.deepEqual(normalizeMobileOutcome({ rating, at: 'broken' }), { rating })
    assert.deepEqual(normalizeMobileOutcome({ rating, at: 12 }), { rating })
  }
  for (const value of [null, undefined, false, [], {}, 'full', { rating: 'strong' }, { rating: 1 }, { rating: '' }, { outcome: { rating: 'full' } }]) {
    assert.equal(normalizeMobileOutcome(value), null)
  }
})
