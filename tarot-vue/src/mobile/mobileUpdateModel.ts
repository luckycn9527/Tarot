export const UPDATE_ORIGIN = 'https://121.40.27.226:9443'
export const UPDATE_FEED_URL = `${UPDATE_ORIGIN}/downloads/android-latest.json`
export const UPDATE_APPLICATION_ID = 'cn.zaopic.etomd'
export const UPDATE_SITE = 'domestic'
export const MIN_UPDATE_BYTES = 1024 * 1024
export const MAX_UPDATE_BYTES = 200 * 1024 * 1024

export interface UpdateManifest {
  schema: 1
  site: 'domestic'
  applicationId: 'cn.zaopic.etomd'
  version: string
  versionCode: number
  minSdk: number
  bytes: number
  sha256: string
  downloadUrl: string
  releaseNotes: string[]
  publishedAt: string
  releaseNotesEn?: string[]
}

export type UpdateStatus = 'idle' | 'checking' | 'upToDate' | 'unavailable' | 'available' |
  'downloading' | 'verifying' | 'downloaded' | 'permissionRequired' | 'installing' | 'cancelled' | 'error'

export interface InstalledAppInfo {
  currentVersion: string
  currentVersionCode: number
  applicationId: string
  site: string
  sdkInt: number
}

export interface UpdateState extends InstalledAppInfo {
  status: UpdateStatus
  latest?: UpdateManifest
  downloadedBytes: number
  totalBytes: number
  progress: number
  installPermissionGranted: boolean
  /** Native confirms a complete, verified APK is still present; installation verifies it again. */
  downloadReady?: boolean
  /** Cache cleanup reserves the same native updater queue without changing its status enum. */
  cacheClearing?: boolean
  errorCode?: string
  message?: string
}

export type ManifestValidationCode = 'INVALID_MANIFEST' | 'WRONG_SITE' | 'WRONG_APPLICATION' |
  'INVALID_VERSION' | 'INVALID_MIN_SDK' | 'INVALID_SIZE' | 'INVALID_HASH' |
  'INVALID_DOWNLOAD_URL' | 'INVALID_RELEASE_NOTES' | 'INVALID_PUBLISHED_AT'
export type ManifestValidation = { valid: true; value: UpdateManifest } | { valid: false; code: ManifestValidationCode }

const failure = (code: ManifestValidationCode): ManifestValidation => ({ valid: false, code })
const integerIn = (value: unknown, min: number, max: number) => Number.isSafeInteger(value) && Number(value) >= min && Number(value) <= max
const versionPattern = /^(?:0|[1-9]\d{0,3})\.(?:0|[1-9]\d{0,3})\.(?:0|[1-9]\d{0,3})$/

function validNotes(value: unknown): value is string[] {
  return Array.isArray(value) && value.length >= 1 && value.length <= 30 && value.every(note =>
    typeof note === 'string' && note.trim().length > 0 && note.length <= 500 && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(note))
}

function validPublishedAt(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-](\d{2}):(\d{2}))$/.exec(value)
  if (!match || !Number.isFinite(Date.parse(value))) return false
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3])
  const days = [31, year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1]! &&
    Number(match[4]) <= 23 && Number(match[5]) <= 59 && Number(match[6]) <= 59 &&
    (match[7] === 'Z' || (Number(match[8]) <= 23 && Number(match[9]) <= 59))
}

// This validates a feed document, not its relationship to the installed version.
// The native updater independently validates the manifest and the actual APK before installation.
export function validateUpdateManifest(value: unknown): ManifestValidation {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return failure('INVALID_MANIFEST')
  const data = value as Record<string, unknown>
  if (data.schema !== 1) return failure('INVALID_MANIFEST')
  if (data.site !== UPDATE_SITE) return failure('WRONG_SITE')
  if (data.applicationId !== UPDATE_APPLICATION_ID) return failure('WRONG_APPLICATION')
  if (typeof data.version !== 'string' || data.version.length > 40 || !versionPattern.test(data.version) ||
    !integerIn(data.versionCode, 1, 2_100_000_000)) return failure('INVALID_VERSION')
  if (!integerIn(data.minSdk, 24, 100)) return failure('INVALID_MIN_SDK')
  if (!integerIn(data.bytes, MIN_UPDATE_BYTES, MAX_UPDATE_BYTES)) return failure('INVALID_SIZE')
  if (typeof data.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(data.sha256)) return failure('INVALID_HASH')
  const expectedUrl = `${UPDATE_ORIGIN}/downloads/E-Tomd-${data.version}-domestic-debug.apk`
  if (data.downloadUrl !== expectedUrl) return failure('INVALID_DOWNLOAD_URL')
  try {
    const url = new URL(data.downloadUrl)
    if (url.origin !== UPDATE_ORIGIN || url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.href !== expectedUrl) return failure('INVALID_DOWNLOAD_URL')
  } catch { return failure('INVALID_DOWNLOAD_URL') }
  if (!validNotes(data.releaseNotes) || (data.releaseNotesEn !== undefined && !validNotes(data.releaseNotesEn))) return failure('INVALID_RELEASE_NOTES')
  if (!validPublishedAt(data.publishedAt)) return failure('INVALID_PUBLISHED_AT')
  return {
    valid: true,
    value: {
      schema: 1, site: UPDATE_SITE, applicationId: UPDATE_APPLICATION_ID,
      version: data.version, versionCode: Number(data.versionCode), minSdk: Number(data.minSdk), bytes: Number(data.bytes),
      sha256: data.sha256, downloadUrl: expectedUrl,
      releaseNotes: [...data.releaseNotes], publishedAt: data.publishedAt,
      ...(data.releaseNotesEn !== undefined ? { releaseNotesEn: [...data.releaseNotesEn] } : {}),
    },
  }
}

export type UpdateAvailability = 'available' | 'upToDate' | 'incompatible'
export function classifyUpdate(manifest: UpdateManifest, currentVersionCode: number, sdkInt: number): UpdateAvailability {
  if (manifest.versionCode <= currentVersionCode) return 'upToDate'
  return manifest.minSdk <= sdkInt ? 'available' : 'incompatible'
}

export function canInstallUpdate(state: UpdateState) {
  const validated = validateUpdateManifest(state.latest)
  return state.status === 'downloaded' && state.installPermissionGranted && validated.valid &&
    state.applicationId === UPDATE_APPLICATION_ID && state.site === UPDATE_SITE &&
    classifyUpdate(validated.value, state.currentVersionCode, state.sdkInt) === 'available'
}

export function isUpdateBusy(status: UpdateStatus) {
  return ['checking', 'downloading', 'verifying', 'installing'].includes(status)
}
