import assert from 'node:assert/strict'
import test from 'node:test'
import { createMobileReviewClock, reviewEligibleAt } from '../src/mobile/mobileReviewClock'

function fixture(at: string, initialZone: string | undefined = 'Asia/Shanghai') {
  let now = Date.parse(at), zone = initialZone, nextId = 0
  const ticks: number[] = [], delays: number[] = []
  const timers = new Map<number, { callback: () => void; at: number }>()
  const clock = createMobileReviewClock({
    now: () => now, timeZone: () => zone, onTick: time => { ticks.push(time) },
    setTimer: (callback, delay) => { const id = ++nextId; timers.set(id, { callback, at: now + delay }); delays.push(delay); return id },
    clearTimer: id => { timers.delete(id as number) },
  })
  function advance(milliseconds: number, fire = true) {
    const target = now + milliseconds
    if (fire) {
      while (true) {
        const next = [...timers.entries()].filter(([, value]) => value.at <= target).sort((a, b) => a[1].at - b[1].at)[0]
        if (!next) break
        timers.delete(next[0]); now = next[1].at; next[1].callback()
      }
    }
    now = target
  }
  return { clock, ticks, delays, timers, advance, now: () => now, zone: (value: string | undefined) => { zone = value } }
}

test('review eligibility follows the business date rather than the device or UTC date', () => {
  const now = Date.parse('2026-11-06T16:00:00Z')
  assert.equal(reviewEligibleAt('2026-11-06T15:59:59Z', now, 'Asia/Shanghai'), true)
  assert.equal(reviewEligibleAt('2026-11-06T15:59:59Z', now, 'UTC'), false)
  assert.equal(reviewEligibleAt('2026-11-06T15:59:59Z', now, 'America/Los_Angeles'), false)
  assert.equal(reviewEligibleAt('2026-11-06T16:00:00Z', now, 'Asia/Shanghai'), false)
  const utcMidnight = Date.parse('2026-11-07T00:00:00Z')
  assert.equal(reviewEligibleAt('2026-11-06T23:59:59Z', utcMidnight, 'UTC'), true)
  assert.equal(reviewEligibleAt('2026-11-06T23:59:59Z', utcMidnight, 'Asia/Shanghai'), false)
})

test('invalid and future reading timestamps never become eligible', () => {
  const now = Date.parse('2026-11-06T16:00:00Z')
  for (const created of [undefined, '', 'not-a-date', '2026-11-07T16:00:00Z']) assert.equal(reviewEligibleAt(created, now, 'Asia/Shanghai'), false)
  assert.equal(reviewEligibleAt('2026-11-05T16:00:00Z', NaN, 'Asia/Shanghai'), false)
})

test('missing or unsupported time zones fall back to the local calendar date', () => {
  const earlier = new Date(2026, 10, 5, 23, 59, 59).toISOString()
  const now = new Date(2026, 10, 6, 0, 0, 1).getTime()
  assert.equal(reviewEligibleAt(earlier, now), true)
  assert.equal(reviewEligibleAt(earlier, now, 'Unsupported/Zone'), true)
  assert.equal(reviewEligibleAt(new Date(2026, 10, 6, 0, 0, 0).toISOString(), now, 'Unsupported/Zone'), false)
})

test('a reading kept in the foreground becomes reviewable immediately after business midnight', () => {
  const f = fixture('2026-11-06T15:59:59.900Z')
  const created = '2026-11-06T08:00:00Z'
  f.clock.refresh()
  assert.equal(reviewEligibleAt(created, f.ticks.at(-1)!, 'Asia/Shanghai'), false)
  assert.equal(f.delays[0], 125)
  f.advance(125)
  assert.equal(reviewEligibleAt(created, f.ticks.at(-1)!, 'Asia/Shanghai'), true)
  assert.equal(f.ticks.length, 2)
  assert.ok(f.delays.every(delay => delay > 0 && delay <= 60_000))
})

test('a foreground refresh corrects a clock whose timer was skipped in the background', () => {
  const f = fixture('2026-11-06T15:59:00Z')
  f.clock.refresh(); f.advance(2 * 60_000, false)
  assert.equal(f.ticks.length, 1)
  f.clock.refresh()
  assert.equal(f.ticks.at(-1), f.now())
  assert.equal(reviewEligibleAt('2026-11-06T08:00:00Z', f.ticks.at(-1)!, 'Asia/Shanghai'), true)
  assert.equal(f.timers.size, 1)
})

test('refresh uses a newly supplied business zone and replaces the existing timer', () => {
  const f = fixture('2026-11-06T15:59:59.900Z')
  f.clock.refresh(); assert.equal(f.delays.at(-1), 125)
  f.zone('America/Los_Angeles'); f.clock.refresh()
  assert.equal(f.delays.at(-1), 60_000); assert.equal(f.timers.size, 1)
})

test('daylight-saving transitions use the real business midnight timestamp', () => {
  for (const at of ['2026-03-08T04:59:59.900Z', '2026-11-01T03:59:59.900Z']) {
    const f = fixture(at, 'America/New_York')
    f.clock.refresh(); assert.equal(f.delays[0], 125)
    f.advance(125)
    assert.equal(reviewEligibleAt(at, f.ticks.at(-1)!, 'America/New_York'), true)
  }
})

test('dispose removes the timer and prevents future refreshes or stale callbacks from ticking', () => {
  const f = fixture('2026-11-06T15:59:59.900Z')
  f.clock.refresh()
  const callback = [...f.timers.values()][0]!.callback
  f.clock.dispose(); assert.equal(f.timers.size, 0)
  f.advance(1000); f.clock.refresh(); callback()
  assert.equal(f.ticks.length, 1); assert.equal(f.timers.size, 0)
})
