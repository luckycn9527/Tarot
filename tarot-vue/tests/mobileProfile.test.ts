import test from 'node:test'
import assert from 'node:assert/strict'
import { birthInputError, localDateOnly } from '../src/mobile/mobileProfile'

test('birth date validates actual calendar dates including leap years without timezone conversion', () => {
  assert.equal(birthInputError('2000-02-29', '', true, false, '2026-10-30'), '')
  assert.match(birthInputError('2001-02-29', '', true, false, '2026-10-30'), /真实有效/)
  assert.match(birthInputError('2020-04-31', '', true, false, '2026-10-30'), /真实有效/)
  assert.match(birthInputError('2020-13-01', '', true, false, '2026-10-30'), /真实有效/)
  assert.match(birthInputError('20/01/01', '', true, false, '2026-10-30'), /公历/)
})
test('future dates are rejected while today and optional unknown birth time remain valid', () => {
  assert.equal(birthInputError('2026-10-30', '', true, false, '2026-10-30'), '')
  assert.match(birthInputError('2026-10-31', '', true, false, '2026-10-30'), /晚于今天/)
  assert.equal(birthInputError('', '', true), '')
  assert.match(birthInputError('', '08:30', false), /先选择/)
})
test('birth time preserves midnight, validates exact minutes, and never invents a time when unknown', () => {
  for (const time of ['00:00', '08:30', '23:59']) assert.equal(birthInputError('1990-05-17', time, false), '')
  for (const time of ['', '24:00', '12:60', '8:30', '08:30:00']) assert.match(birthInputError('1990-05-17', time, false), /不知道/)
  assert.equal(birthInputError('1990-05-17', '', true), '')
  assert.match(birthInputError('2099-01-01', '', true, true, '2026-10-30'), /future/)
})
test('date-only formatting follows local calendar components', () => {
  assert.equal(localDateOnly(new Date(2000, 0, 2, 23, 59)), '2000-01-02')
})
