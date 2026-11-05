import type { MobileHistoryEntry, MobileReader, MobileReaderPreference } from './types'

export function validReaderPreference(value: unknown, owner: number | null, site: 'domestic' | 'overseas'): value is MobileReaderPreference {
  if (!value || typeof value !== 'object') return false
  const preference = value as MobileReaderPreference
  return preference.schema === 1 && preference.owner === owner && preference.site === site &&
    typeof preference.readerId === 'string' && /^[a-z0-9_-]{1,80}$/i.test(preference.readerId) &&
    Number.isFinite(preference.savedAt) && preference.savedAt > 0
}

export function availableMobileReaders(readers: readonly MobileReader[], vip: boolean) {
  return readers.filter(reader => reader.accessLevel === 'free' || vip)
}

export function defaultMobileReaderId(readers: readonly MobileReader[]) {
  const free = readers.filter(reader => reader.accessLevel === 'free')
  return (free.find(reader => reader.id === 'qinghe') || free[0])?.id || ''
}

// Preserve stored IDs even when unavailable. The user must choose a replacement.
export function restoredMobileReaderId(draftReaderId: string | undefined, preference: MobileReaderPreference | null, readers: readonly MobileReader[]) {
  return draftReaderId || preference?.readerId || defaultMobileReaderId(readers)
}

export function resolveReadingReader(entry: MobileHistoryEntry | null, readers: readonly MobileReader[]) {
  return entry?.type === 'reader-reading' && entry.readerId ? readers.find(reader => reader.id === entry.readerId) : undefined
}
