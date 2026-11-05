import test from 'node:test'
import assert from 'node:assert/strict'
import { dailyRatingPresentation } from '../src/mobile/mobileDailyPresentation'

test('daily fortune presents exactly five stars without visible numeric scores', () => {
  for (const [value, stars] of [[1, '★☆☆☆☆'], [2, '★★☆☆☆'], [3, '★★★☆☆'], [4, '★★★★☆'], [5, '★★★★★']] as const) {
    assert.deepEqual(dailyRatingPresentation(value, false), {
      stars,
      text: stars,
      ariaLabel: `${value} 星，共 5 星`,
    })
    const english = dailyRatingPresentation(value, true)
    assert.equal(english.text, stars)
    assert.doesNotMatch(english.text, /\d/)
    assert.equal(english.ariaLabel, `${value} of 5 stars`)
  }
})

test('missing and malformed ratings stay unavailable without coercion or invented zero stars', () => {
  for (const value of [undefined, null, NaN, Infinity, -Infinity, -1, 0, 0.5, 1.5, 5.1, 6, '3', '', true, {}, []]) {
    assert.deepEqual(dailyRatingPresentation(value, false), {
      stars: null,
      text: '暂无星级',
      ariaLabel: '暂无星级',
    })
    assert.deepEqual(dailyRatingPresentation(value, true), { stars: null, text: 'Not rated', ariaLabel: 'Not rated' })
  }
})
