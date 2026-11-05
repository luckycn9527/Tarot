import assert from 'node:assert/strict';
import test from 'node:test';
import { adminListUsersQuerySchema, adminUserQuestionsQuerySchema } from '../validation/adminQuery.js';
import { businessDayRange } from '../utils/quotaDate.js';

test('admin user queries accept recent-login sorting and keep page sizes bounded', () => {
  assert.equal(adminListUsersQuerySchema.parse({}).sort, 'newest');
  assert.equal(adminListUsersQuerySchema.parse({ sort: 'last-login', pageSize: '999' }).pageSize, 100);
  assert.equal(adminListUsersQuerySchema.safeParse({ sort: 'last_login_at; DROP TABLE users' }).success, false);
});

test('admin question queries whitelist question types and normalize filters', () => {
  assert.equal(adminUserQuestionsQuerySchema.parse({ type: 'fate-dual', keyword: '  creative  ' }).keyword, 'creative');
  assert.equal(adminUserQuestionsQuerySchema.parse({}).page, 1);
  assert.equal(adminUserQuestionsQuerySchema.safeParse({ type: 'password_hash' }).success, false);
});

test('admin reporting follows the configured site day rather than database local date', () => {
  const now = new Date('2026-10-27T17:00:00Z');
  const overseas = businessDayRange('UTC', now);
  const domestic = businessDayRange('Asia/Shanghai', now);
  assert.equal(overseas.businessDate, '2026-10-27');
  assert.equal(overseas.startsAt, '2026-10-27T00:00:00.000Z');
  assert.equal(overseas.resetsAt, '2026-10-28T00:00:00.000Z');
  assert.equal(domestic.businessDate, '2026-10-28');
  assert.equal(domestic.startsAt, '2026-10-27T16:00:00.000Z');
  assert.equal(domestic.resetsAt, '2026-10-28T16:00:00.000Z');
});

test('admin reporting boundaries cover exact midnight and 23/25 hour days', () => {
  const exact = businessDayRange('UTC', new Date('2026-10-27T00:00:00Z'));
  assert.equal(exact.startsAt, '2026-10-27T00:00:00.000Z');
  for (const [date, hours] of [['2026-03-08T16:00:00Z', 23], ['2026-11-01T16:00:00Z', 25]] as const) {
    const range = businessDayRange('America/New_York', new Date(date));
    assert.equal((Date.parse(range.resetsAt) - Date.parse(range.startsAt)) / 3600000, hours);
  }
});
