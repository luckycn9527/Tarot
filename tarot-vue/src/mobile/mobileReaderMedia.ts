import { computed, ref, watch, type Ref } from 'vue'
import { resolveMobileMediaUrl } from './mobileMediaUrl'

export interface MobileReaderMediaSource {
  id: string
  avatarThumbUrl?: string | null
  avatarUrl?: string | null
}

// These paths identify the exact public web thumbnails bundled on 2026-10-30.
// Source URLs and byte hashes are recorded in output/web-assets-20261030/source-audit.json.
const snapshotFiles: Readonly<Record<string, readonly [string, string]>> = {
  qinghe: ['reader-avatar-1783587503177-bsp85j-thumb.webp', 'reader-avatar-1783587503177-bsp85j.webp'],
  yanxi: ['reader-avatar-1783587521856-1c7nn7-thumb.webp', 'reader-avatar-1783587521856-1c7nn7.webp'],
  haruka: ['reader-avatar-1783588688836-6lvaj5-thumb.webp', 'reader-avatar-1783588688836-6lvaj5.webp'],
  xuanyin: ['reader-avatar-1783587627881-ed1iqt-thumb.webp', 'reader-avatar-1783587627881-ed1iqt.webp'],
  mirelle: ['reader-avatar-1783588534738-r64mh3-thumb.webp', 'reader-avatar-1783588534738-r64mh3.webp'],
  lingsha: ['reader-avatar-1783587046391-w4fow4-thumb.webp', 'reader-avatar-1783587046391-w4fow4.webp'],
  norick: ['reader-avatar-1783588564614-behg86-thumb.webp', 'reader-avatar-1783588564614-behg86.webp'],
  amara: ['reader-avatar-1782721169316-yy9g29-thumb.webp', 'reader-avatar-1782721169316-yy9g29.png'],
  vikram: ['reader-avatar-1783588546952-ec40uw-thumb.webp', 'reader-avatar-1783588546952-ec40uw.webp'],
  catalina: ['reader-avatar-1783588542404-ubcel8-thumb.webp', 'reader-avatar-1783588542404-ubcel8.webp'],
  kazuki: ['reader-avatar-1783588558508-i0103l-thumb.webp', 'reader-avatar-1783588558508-i0103l.webp'],
  solveig: ['reader-avatar-1782721199133-7aizy0-thumb.webp', 'reader-avatar-1782721199133-7aizy0.png'],
}

export function mobileReaderAvatarCandidates(
  reader: MobileReaderMediaSource | undefined,
  origin: string,
  bundledAvatar?: string,
): string[] {
  if (!reader) return []
  const configured = [reader.avatarThumbUrl, reader.avatarUrl]
    .filter((value): value is string => value !== null && value !== undefined && value !== '')
  const resolved = configured.map(value => resolveMobileMediaUrl(value, origin))
  const candidates = resolved.filter(Boolean)
  const snapshot = Object.prototype.hasOwnProperty.call(snapshotFiles, reader.id) ? snapshotFiles[reader.id] : undefined
  // Missing URL fields can use this reader's web default. Explicit new or invalid
  // URLs cannot fall back to an older packaged portrait after an admin changes it.
  const matchesSnapshot = snapshot && resolved.every(value => value && snapshot.some(file => new URL(value).pathname === `/uploads/admin/${file}`))
  if (bundledAvatar && matchesSnapshot) candidates.push(bundledAvatar)
  return [...new Set(candidates)]
}

/** Image failure state belongs to the current reader and URL configuration. */
export function useMobileReaderAvatarMedia(
  reader: Readonly<Ref<MobileReaderMediaSource | undefined>>,
  origin: string,
  bundledAvatar: (id: string) => string | undefined,
) {
  const candidates = computed(() => mobileReaderAvatarCandidates(reader.value, origin, reader.value ? bundledAvatar(reader.value.id) : undefined))
  const candidate = ref(0)
  watch([() => reader.value?.id, candidates], () => { candidate.value = 0 }, { flush: 'sync' })
  const image = computed(() => candidates.value[candidate.value] || '')
  function handleFailure(failedUrl: string) {
    if (failedUrl && failedUrl === image.value) candidate.value++
  }
  return { candidates, image, handleFailure }
}
