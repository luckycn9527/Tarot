import assert from 'node:assert/strict'
import test from 'node:test'
import { formatStorageBytes, parseMobileStorageClearResult, parseMobileStorageInfo, storageErrorText } from '../src/mobile/mobileStorageManagement'

const info = () => ({ scope: 'update-cache', bytes: 1_048_581, files: 3, busy: false, canClear: true })

test('only the native update-cache scope becomes a clearable size', () => {
  const input = { ...info(), internalPath: '/private/device/path' }
  const parsed = parseMobileStorageInfo(input)
  assert.deepEqual(parsed, info())
  assert.notEqual(parsed, input)
  assert.equal('internalPath' in parsed, false)
  assert.throws(() => parseMobileStorageInfo({ ...input, scope: 'all-app-data' }), { code: 'STORAGE_UNAVAILABLE' })
})

test('invalid sizes and contradictory native availability never enable clearing', () => {
  for (const patch of [{ bytes: -1 }, { bytes: Infinity }, { bytes: NaN }, { bytes: 0.5 }, { bytes: '12' },
    { bytes: Number.MAX_SAFE_INTEGER + 1 }, { files: -1 }, { files: 1.5 }, { files: '3' }, { busy: 'false' },
    { canClear: 1 }, { busy: true }, { files: 0 }, { bytes: 0, files: 0 }, { bytes: 1, files: 0, canClear: false }]) {
    assert.throws(() => parseMobileStorageInfo({ ...info(), ...patch }), { code: 'STORAGE_UNAVAILABLE' }, JSON.stringify(patch))
  }
  for (const input of [undefined, null, [], {}]) assert.throws(() => parseMobileStorageInfo(input), { code: 'STORAGE_UNAVAILABLE' })
})

test('busy snapshots and empty files stay distinguishable from no cache', () => {
  assert.deepEqual(parseMobileStorageInfo({ ...info(), busy: true, canClear: false }), { ...info(), busy: true, canClear: false })
  assert.equal(parseMobileStorageInfo({ ...info(), bytes: 0 }).canClear, true)
  assert.deepEqual(parseMobileStorageInfo({ scope: 'update-cache', bytes: 0, files: 0, busy: false, canClear: false }),
    { scope: 'update-cache', bytes: 0, files: 0, busy: false, canClear: false })
})

test('cleanup results report actual removals and reject imaginary freed bytes', () => {
  const remaining = { scope: 'update-cache', bytes: 0, files: 0, busy: false, canClear: false }
  assert.deepEqual(parseMobileStorageClearResult({ storage: remaining, clearedBytes: 1_048_581, removedFiles: 3 }),
    { storage: remaining, clearedBytes: 1_048_581, removedFiles: 3 })
  assert.equal(parseMobileStorageClearResult({ storage: remaining, clearedBytes: 0, removedFiles: 2 }).removedFiles, 2)
  assert.equal(parseMobileStorageClearResult({ storage: remaining, clearedBytes: 0, removedFiles: 0 }).clearedBytes, 0)
  for (const patch of [{ clearedBytes: 1, removedFiles: 0 }, { clearedBytes: -1, removedFiles: 1 },
    { clearedBytes: 1, removedFiles: Infinity }, { clearedBytes: '12', removedFiles: 1 }, { storage: { ...info(), busy: true } }]) {
    assert.throws(() => parseMobileStorageClearResult({ storage: remaining, clearedBytes: 0, removedFiles: 0, ...patch }), { code: 'STORAGE_UNAVAILABLE' })
  }
})

test('human-readable sizes retain the exact byte count and never turn unknown values into zero', () => {
  assert.equal(formatStorageBytes(0, false), '0 字节')
  assert.equal(formatStorageBytes(1, true), '1 byte')
  assert.equal(formatStorageBytes(1023, true), '1,023 bytes')
  assert.equal(formatStorageBytes(1024, false), '1.00 KiB（1,024 字节）')
  assert.equal(formatStorageBytes(1_048_581, true), '1.00 MiB (1,048,581 bytes)')
  assert.match(formatStorageBytes(Number.MAX_SAFE_INTEGER, true), /9,007,199,254,740,991 bytes/)
  for (const input of [-1, NaN, Infinity, 0.5, Number.MAX_SAFE_INTEGER + 1]) assert.equal(formatStorageBytes(input, false), '—')
})

test('storage errors give distinct public recovery advice without exposing device details', () => {
  for (const english of [false, true]) {
    assert.match(storageErrorText('UPDATER_BUSY', english), english ? /Finish or cancel/ : /完成或取消/)
    assert.match(storageErrorText('CACHE_UNSAFE_PATH', english), english ? /safely/ : /安全清理/)
    assert.match(storageErrorText('CACHE_IO_ERROR', english), english ? /fully cleared.*Refresh/ : /未能全部清理.*刷新/)
    const fallback = storageErrorText('/private/path: secret OS exception', english)
    assert.doesNotMatch(fallback, /private|secret|OS exception/)
    assert.match(fallback, english ? /Refresh/ : /刷新/)
  }
})
