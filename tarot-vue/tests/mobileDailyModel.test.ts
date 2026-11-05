import test from 'node:test'
import assert from 'node:assert/strict'
import {
  acceptsMobileDailyScope, isCurrentMobileDailyCache, mobileDailyCacheFromResponse,
  mobileDailyResponseFromCache, sameMobileDailyWindow, selectMobileDailyCard,
  validMobileDailyCard, validMobileDailyResponse, validMobileDailyResult, validMobileDailyWindow,
} from '../src/mobile/mobileDailyModel'
import type { MobileDailyCache } from '../src/mobile/mobileDailyModel'
import type { DailyFortuneResponse } from '../src/services/tarotAiReading'

const now = Date.parse('2026-10-29T16:00:00Z') // Already Oct 30 in Shanghai; still Oct 29 in the server's UTC window.
const window = { businessDate: '2026-10-29', resetsAt: '2026-10-30T00:00:00.000Z', timeZone: 'UTC' }
const response: DailyFortuneResponse = {
  ...window, cached: true,
  card: { id: 17, name: '星星', nameEn: 'The Star', isReversed: true },
  result: {
    cardName: '星星', cardNameEn: 'The Star', isReversed: true,
    sections: {
      intro: '今天从照顾自己开始。', overall: '放慢速度，看见已经取得的进展。', love: '把想法平和地说出来。',
      career: '专注手边的一件工作。', wealth: '检查预算，再决定支出。', health: '给自己留出休息时间。', mystery: '耐心也是一种力量。',
    },
    ratings: { overall: 3, love: 4, career: 2, wealth: 5, health: 1 },
  },
}
const completed = (): MobileDailyCache => mobileDailyCacheFromResponse(structuredClone(response), 7, 'domestic')
const pending = (): MobileDailyCache => ({
  schema: 1, owner: 7, site: 'domestic', window: { ...window }, card: null, result: null,
  pending: { id: 42, isReversed: false },
})

test('daily cache belongs to one authenticated account and one mobile site', () => {
  const cache = completed()
  assert.equal(isCurrentMobileDailyCache(cache, 7, 'domestic', now), true)
  assert.equal(isCurrentMobileDailyCache(cache, 8, 'domestic', now), false)
  assert.equal(isCurrentMobileDailyCache(cache, 7, 'overseas', now), false)
  for (const owner of [null, 0, -1, NaN, 7.5]) assert.equal(isCurrentMobileDailyCache(cache, owner, 'domestic', now), false)
  assert.equal(isCurrentMobileDailyCache({ ...cache, owner: null }, null, 'domestic', now), false)
})

test('service window survives phone-local midnight and expires exactly at server resetsAt', () => {
  const cache = completed()
  assert.equal(new Date(now).toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' }), '2026-10-30')
  assert.equal(validMobileDailyWindow(window, now), true)
  assert.equal(isCurrentMobileDailyCache(cache, 7, 'domestic', now), true)
  const reset = Date.parse(window.resetsAt)
  assert.equal(isCurrentMobileDailyCache(cache, 7, 'domestic', reset - 1), true)
  assert.equal(isCurrentMobileDailyCache(cache, 7, 'domestic', reset), false)
  assert.equal(isCurrentMobileDailyCache(cache, 7, 'domestic', reset + 1), false)
  assert.equal(validMobileDailyWindow({ ...window, resetsAt: '2026-10-30T08:00:00+08:00' }, reset - 1), true)
  assert.equal(validMobileDailyWindow({ ...window, resetsAt: '2026-10-30T08:00:00+08:00' }, reset), false)
})

test('a newly confirmed service day or changed window invalidates the old cache', () => {
  const cache = completed()
  assert.equal(isCurrentMobileDailyCache(cache, 7, 'domestic', now, { ...window }), true)
  for (const next of [
    { ...window, businessDate: '2026-10-30' },
    { ...window, resetsAt: '2026-10-31T00:00:00.000Z' },
    { ...window, timeZone: 'Asia/Shanghai' },
  ]) {
    assert.equal(sameMobileDailyWindow(window, next), false)
    assert.equal(isCurrentMobileDailyCache(cache, 7, 'domestic', now, next), false)
  }
})

test('pending draw reuses its exact card and orientation without consuming randomness', () => {
  const cache = pending()
  assert.equal(isCurrentMobileDailyCache(cache, 7, 'domestic', now), true)
  const card = selectMobileDailyCard(cache, [], () => { throw new Error('A retry must not select a new card') })
  assert.deepEqual(card, { id: 42, isReversed: false })
  card.isReversed = true
  assert.equal(cache.pending?.isReversed, false)
  const empty = { ...cache, pending: null }
  const samples = [.99, .49]
  assert.deepEqual(selectMobileDailyCard(empty, [-1, 3, 3, 77, 78, 1.5], () => samples.shift()!), { id: 77, isReversed: true })
  assert.throws(() => selectMobileDailyCard(empty, [-1, 78, 1.5]), /No daily cards available/)
})

test('GET without a result retains pending only for the same owner, site, and exact window', () => {
  const emptyResponse: DailyFortuneResponse = { ...window, cached: false, card: null, result: null }
  const previous = pending()
  assert.deepEqual(mobileDailyCacheFromResponse(emptyResponse, 7, 'domestic', previous).pending, previous.pending)
  assert.equal(mobileDailyCacheFromResponse(emptyResponse, 8, 'domestic', previous).pending, null)
  assert.equal(mobileDailyCacheFromResponse(emptyResponse, 7, 'overseas', previous).pending, null)
  assert.equal(mobileDailyCacheFromResponse({ ...emptyResponse, businessDate: '2026-10-30' }, 7, 'domestic', previous).pending, null)
  assert.equal(mobileDailyCacheFromResponse({ ...emptyResponse, resetsAt: '2026-10-31T00:00:00.000Z' }, 7, 'domestic', previous).pending, null)
  const restored = mobileDailyCacheFromResponse(response, 7, 'domestic', previous)
  assert.equal(restored.pending, null)
  assert.deepEqual(mobileDailyResponseFromCache(restored), response)
  assert.deepEqual(mobileDailyResponseFromCache(previous), emptyResponse)
})

test('malformed and incompatible cache envelopes are never accepted as a fortune', () => {
  const cache = completed()
  const malformed: unknown[] = [
    null, [], {}, { ...cache, schema: 2 }, { ...cache, pending: undefined },
    { ...cache, pending: { id: 1, isReversed: false } },
    { ...cache, result: null }, { ...cache, card: null },
    { ...cache, card: { ...cache.card, id: 78 } },
    { ...cache, card: { ...cache.card, isReversed: false } },
    { ...cache, card: { ...cache.card, name: '另一张牌' } },
    { ...cache, window: { ...window, businessDate: '2026-02-30' } },
    { ...cache, window: { ...window, resetsAt: '2026-10-30T00:00:00' } },
    { ...cache, window: { ...window, resetsAt: 'not-a-date' } },
    { ...cache, window: { ...window, resetsAt: '2028-02-30T00:00:00Z' } },
    { ...cache, window: { ...window, timeZone: '' } },
    { ...pending(), pending: { id: 42 } },
    { ...pending(), pending: { id: -1, isReversed: false } },
  ]
  for (const value of malformed) assert.equal(isCurrentMobileDailyCache(value, 7, 'domestic', now), false, JSON.stringify(value))
})

test('response validation requires all real sections and integer ratings from one through five', () => {
  assert.equal(validMobileDailyResponse(response, now), true)
  assert.equal(validMobileDailyResult(response.result), true)
  assert.equal(validMobileDailyResponse({ ...window, cached: false, card: null, result: null }, now), true)
  assert.equal(validMobileDailyResponse({ ...response, cached: 'true' }, now), false)
  assert.equal(validMobileDailyResponse({ ...response, card: null }, now), false)
  assert.equal(validMobileDailyResponse(response, Date.parse(window.resetsAt)), false)
  for (const key of ['intro', 'overall', 'love', 'career', 'wealth', 'health', 'mystery']) {
    const value = structuredClone(response.result!)
    Reflect.set(value.sections, key, ' ')
    assert.equal(validMobileDailyResult(value), false, `empty ${key}`)
  }
  for (const key of ['overall', 'love', 'career', 'wealth', 'health']) for (const rating of [0, 6, 2.5, NaN, '3', null]) {
    const value = structuredClone(response.result!)
    Reflect.set(value.ratings, key, rating)
    assert.equal(validMobileDailyResult(value), false, `${key}=${String(rating)}`)
  }
  for (const card of [{ id: 0, isReversed: false }, { id: 77, isReversed: true }]) assert.equal(validMobileDailyCard(card), true)
  for (const card of [{ id: 78, isReversed: false }, { id: .5, isReversed: false }, { id: 2, isReversed: 'false' }]) assert.equal(validMobileDailyCard(card), false)
})

test('late responses are rejected after account change, newer request, sign-out, or session reset', () => {
  const scope = { owner: 7, sequence: 4 }
  assert.equal(acceptsMobileDailyScope(scope, 7, 4, true), true)
  assert.equal(acceptsMobileDailyScope(scope, 8, 4, true), false)
  assert.equal(acceptsMobileDailyScope(scope, 7, 5, true), false)
  assert.equal(acceptsMobileDailyScope(scope, 7, 4, false), false)
  assert.equal(acceptsMobileDailyScope(scope, null, 4, true), false)
  assert.equal(acceptsMobileDailyScope(scope, 7, 6, true), false, 'returning to the same account must still reject the old sequence')
})
