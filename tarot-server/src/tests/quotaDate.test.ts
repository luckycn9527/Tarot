import assert from 'node:assert/strict';
import test from 'node:test';
import { dateOnlyInTimeZone, previousBusinessDate, quotaWindow } from '../utils/quotaDate.js';

test('daily quota date follows the configured site time zone', () => {
  const instant = new Date('2026-07-30T16:30:00.000Z');

  assert.equal(dateOnlyInTimeZone(instant, 'UTC'), '2026-07-30');
  assert.equal(dateOnlyInTimeZone(instant, 'Asia/Shanghai'), '2026-07-31');
  assert.equal(dateOnlyInTimeZone(instant, 'America/New_York'), '2026-07-30');
});

test('invalid quota time zones fail fast', () => {
  assert.throws(
    () => dateOnlyInTimeZone(new Date('2026-07-30T00:00:00.000Z'), 'Not/A_Time_Zone'),
    RangeError,
  );
});

test('quota reset time is the next midnight in the configured zone, across years and fractional offsets', () => {
  assert.deepEqual(quotaWindow('Asia/Shanghai', new Date('2026-12-31T16:30:00Z')), {
    businessDate: '2027-01-01', resetsAt: '2027-01-01T16:00:00.000Z', timeZone: 'Asia/Shanghai',
  });
  assert.equal(quotaWindow('Asia/Kathmandu', new Date('2026-10-27T00:00:00Z')).resetsAt, '2026-10-27T18:15:00.000Z');
  assert.equal(quotaWindow('UTC', new Date('2026-10-27T23:59:59.999Z')).resetsAt, '2026-10-28T00:00:00.000Z');
});

test('quota windows handle both daylight-saving transitions without assuming 24-hour days', () => {
  const spring = quotaWindow('America/New_York', new Date('2026-03-08T05:00:00Z'));
  const autumn = quotaWindow('America/New_York', new Date('2026-11-01T04:00:00Z'));
  assert.equal(spring.resetsAt, '2026-03-09T04:00:00.000Z');
  assert.equal(autumn.resetsAt, '2026-11-02T05:00:00.000Z');
});

test('yesterday uses the previous business calendar date across months, years, and leap days', () => {
  assert.equal(previousBusinessDate('UTC', new Date('2026-11-01T09:00:00Z')), '2026-10-31');
  assert.equal(previousBusinessDate('Asia/Shanghai', new Date('2026-12-31T16:00:00Z')), '2026-12-31');
  assert.equal(previousBusinessDate('UTC', new Date('2028-03-01T00:00:00Z')), '2028-02-29');
  assert.equal(previousBusinessDate('UTC', new Date('2026-03-01T00:00:00Z')), '2026-02-28');
});

test('yesterday changes at the configured business midnight, independently of UTC and device dates', () => {
  const beforeMidnight = new Date('2026-10-31T15:59:59.999Z');
  const atMidnight = new Date('2026-10-31T16:00:00.000Z');
  assert.equal(previousBusinessDate('Asia/Shanghai', beforeMidnight), '2026-10-30');
  assert.equal(previousBusinessDate('Asia/Shanghai', atMidnight), '2026-10-31');
  assert.equal(previousBusinessDate('UTC', atMidnight), '2026-10-30');
  assert.equal(previousBusinessDate('America/Los_Angeles', new Date('2027-01-01T07:59:59Z')), '2026-12-30');
});

test('yesterday follows calendar subtraction on both daylight-saving transitions', () => {
  assert.equal(previousBusinessDate('America/New_York', new Date('2026-03-09T04:00:00Z')), '2026-03-08');
  assert.equal(previousBusinessDate('America/New_York', new Date('2026-11-02T04:30:00Z')), '2026-10-31');
  assert.equal(previousBusinessDate('America/New_York', new Date('2026-11-02T05:00:00Z')), '2026-11-01');
});
