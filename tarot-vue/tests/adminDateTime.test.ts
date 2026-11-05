import assert from 'node:assert/strict'
import test from 'node:test'
import { adminDateTime } from '../src/utils/adminDateTime'

test('admin login times retain hours, minutes and seconds for equivalent instants', () => {
  const utc = adminDateTime('2026-10-27T09:23:45Z', 'en-US', 'Not recorded')
  const offset = adminDateTime('2026-10-27T17:23:45+08:00', 'en-US', 'Not recorded')
  assert.equal(utc, offset)
  assert.ok(utc.includes('23:45'))
  assert.ok(utc.includes('2026'))
});

test('unknown historical sign-in times stay unknown instead of showing an invented date', () => {
  assert.equal(adminDateTime(null, 'zh-CN', '暂无记录'), '暂无记录')
  assert.equal(adminDateTime(undefined, 'en-US', 'Not recorded'), 'Not recorded')
  assert.equal(adminDateTime('invalid date', 'en-US', 'Not recorded'), 'Not recorded')
});
