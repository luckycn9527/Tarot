export interface MobileStorageInfo {
  scope: 'update-cache'
  bytes: number
  files: number
  busy: boolean
  canClear: boolean
}

export interface MobileStorageClearResult {
  storage: MobileStorageInfo
  clearedBytes: number
  removedFiles: number
}

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}
function count(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0
}
function invalid(): never {
  throw Object.assign(new Error('Storage information is unavailable'), { code: 'STORAGE_UNAVAILABLE' })
}

/** Accept only the bounded, app-owned update cache reported by the native bridge. */
export function parseMobileStorageInfo(value: unknown): MobileStorageInfo {
  if (!record(value) || value.scope !== 'update-cache' || !count(value.bytes) || !count(value.files) ||
    typeof value.busy !== 'boolean' || typeof value.canClear !== 'boolean' ||
    (value.canClear && (value.busy || value.files === 0)) || (value.files === 0 && value.bytes !== 0)) return invalid()
  return { scope: 'update-cache', bytes: value.bytes, files: value.files, busy: value.busy, canClear: value.canClear }
}

export function parseMobileStorageClearResult(value: unknown): MobileStorageClearResult {
  if (!record(value) || !count(value.clearedBytes) || !count(value.removedFiles) ||
    (value.removedFiles === 0 && value.clearedBytes !== 0)) return invalid()
  return { storage: parseMobileStorageInfo(value.storage), clearedBytes: value.clearedBytes, removedFiles: value.removedFiles }
}

/** Include the exact byte count even when a larger binary unit improves readability. */
export function formatStorageBytes(value: number, english: boolean): string {
  if (!count(value)) return '—'
  const exact = new Intl.NumberFormat(english ? 'en-US' : 'zh-CN').format(value)
  const bytes = english ? `${exact} ${value === 1 ? 'byte' : 'bytes'}` : `${exact} 字节`
  if (value < 1024) return bytes
  const units = ['KiB', 'MiB', 'GiB', 'TiB', 'PiB']
  let size = value / 1024, unit = 0
  while (size >= 1024 && unit < units.length - 1) { size /= 1024; unit++ }
  return english ? `${size.toFixed(2)} ${units[unit]} (${bytes})` : `${size.toFixed(2)} ${units[unit]}（${bytes}）`
}

export function storageErrorText(code: unknown, english: boolean): string {
  const t = (zh: string, en: string) => english ? en : zh
  if (code === 'UPDATER_BUSY') return t('更新正在进行，请完成或取消后再清理。', 'An update is in progress. Finish or cancel it before clearing its cache.')
  if (code === 'CACHE_UNSAFE_PATH') return t('暂时无法安全清理更新缓存，请保留现有文件并稍后重试。', 'The update cache could not be cleared safely. Keep the current files and try again later.')
  if (code === 'CACHE_IO_ERROR') return t('更新缓存未能全部清理，请刷新查看剩余占用后重试。', 'The update cache could not be fully cleared. Refresh its size and try again.')
  return t('暂时无法读取或清理更新缓存，请刷新后重试。', 'The update cache could not be read or cleared. Refresh it and try again.')
}
