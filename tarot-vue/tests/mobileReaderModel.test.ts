import test from 'node:test'
import assert from 'node:assert/strict'
import { availableMobileReaders, defaultMobileReaderId, restoredMobileReaderId, resolveReadingReader, validReaderPreference } from '../src/mobile/mobileReaderModel'
import type { MobileHistoryEntry, MobileReader, MobileReaderPreference } from '../src/mobile/types'

const readers: MobileReader[] = [
  { id: 'yanxi', name: '言溪', accessLevel: 'free' },
  { id: 'qinghe', name: '清和', accessLevel: 'free' },
  { id: 'xuanyin', name: '玄音', accessLevel: 'vip' },
]
const preference: MobileReaderPreference = { schema: 1, owner: 7, site: 'domestic', readerId: 'yanxi', savedAt: Date.now() }

test('reader preferences belong to one account and one site including the guest scope', () => {
  assert.equal(validReaderPreference(preference, 7, 'domestic'), true)
  assert.equal(validReaderPreference(preference, 8, 'domestic'), false)
  assert.equal(validReaderPreference(preference, 7, 'overseas'), false)
  assert.equal(validReaderPreference(preference, null, 'domestic'), false)
  assert.equal(validReaderPreference({ ...preference, owner: null }, null, 'domestic'), true)
  assert.equal(validReaderPreference({ ...preference, readerId: '' }, 7, 'domestic'), false)
  assert.equal(validReaderPreference({ ...preference, savedAt: NaN }, 7, 'domestic'), false)
})

test('a draft reader takes precedence over the account preference without silently replacing unavailable IDs', () => {
  assert.equal(restoredMobileReaderId('qinghe', preference, readers), 'qinghe')
  assert.equal(restoredMobileReaderId(undefined, preference, readers), 'yanxi')
  assert.equal(restoredMobileReaderId('removed-reader', preference, readers), 'removed-reader')
  assert.equal(restoredMobileReaderId(undefined, { ...preference, readerId: 'xuanyin' }, readers), 'xuanyin')
  assert.equal(restoredMobileReaderId(undefined, null, readers), 'qinghe')
})

test('availability changes restrict new selection while the initial default always uses a free reader', () => {
  assert.deepEqual(availableMobileReaders(readers, false).map(reader => reader.id), ['yanxi', 'qinghe'])
  assert.equal(availableMobileReaders(readers, true).length, 3)
  assert.equal(defaultMobileReaderId(readers.slice(0, 1)), 'yanxi')
  assert.equal(defaultMobileReaderId(readers.slice(2)), '')
  assert.equal(defaultMobileReaderId([]), '')
})

test('history identity comes from the saved reader ID and never the new-question preference', () => {
  const entry = { id: 4, type: 'reader-reading', readerId: 'qinghe' } as MobileHistoryEntry
  assert.equal(resolveReadingReader(entry, readers)?.name, '清和')
  assert.equal(resolveReadingReader({ ...entry, readerId: 'removed-reader' }, readers), undefined)
  assert.equal(resolveReadingReader({ ...entry, type: 'single' }, readers), undefined)
  assert.equal(resolveReadingReader(null, readers), undefined)
  assert.equal(preference.readerId, 'yanxi')
})
