import { ref } from 'vue'
import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core'
import version from '../../mobile-version.json'
import { mobileSite } from './mobileStorage'
import { classifyUpdate, isUpdateBusy, validateUpdateManifest, UPDATE_APPLICATION_ID, type UpdateState, type UpdateStatus } from './mobileUpdateModel'
import { parseMobileStorageInfo, parseMobileStorageClearResult, type MobileStorageInfo, type MobileStorageClearResult } from './mobileStorageManagement'

interface UpdaterPlugin {
  getState(): Promise<UpdateState>
  checkForUpdate(): Promise<UpdateState>
  downloadUpdate(): Promise<UpdateState>
  cancelDownload(): Promise<UpdateState>
  installUpdate(): Promise<UpdateState>
  openInstallSettings(): Promise<UpdateState>
  getStorageInfo(): Promise<MobileStorageInfo>
  clearUpdateCache(): Promise<MobileStorageClearResult & { updateState?: UpdateState; errorCode?: string }>
  addListener(event: 'updateState', listener: (state: UpdateState) => void): Promise<PluginListenerHandle>
}
declare global { interface Window { __ETOMD_UPDATER_QA__?: UpdaterPlugin } }

export const mobileUpdaterPlatform = Capacitor.getPlatform()
const qa = import.meta.env.DEV && mobileUpdaterPlatform !== 'ios' ? window.__ETOMD_UPDATER_QA__ : undefined
export const mobileUpdaterSupported = mobileSite === 'domestic' && (!!qa || mobileUpdaterPlatform === 'android')
// iOS updates are delivered through their signing/distribution channel. Do not
// register or invoke the Android installer bridge on unsupported platforms.
const plugin = mobileUpdaterSupported ? qa || registerPlugin<UpdaterPlugin>('AppUpdater') : null
const initialState = (): UpdateState => ({ status: 'idle', currentVersion: version.version, currentVersionCode: version.versionCode,
  applicationId: UPDATE_APPLICATION_ID, site: 'domestic', sdkInt: 24,
  downloadedBytes: 0, totalBytes: 0, progress: 0, installPermissionGranted: false })
export const mobileUpdateState = ref<UpdateState>(initialState())
const statuses: UpdateStatus[] = ['idle', 'checking', 'upToDate', 'unavailable', 'available', 'downloading', 'verifying', 'downloaded', 'permissionRequired', 'installing', 'cancelled', 'error']
let initialized: Promise<void> | null = null, listener: PluginListenerHandle | null = null
let epoch = 0, events = 0, quietCheckedAt = 0
const quietKey = 'etomd-domestic-update-checked-v1'

function accept(value: UpdateState) {
  if (!value || !statuses.includes(value.status) || value.applicationId !== UPDATE_APPLICATION_ID || value.site !== 'domestic' ||
    !Number.isSafeInteger(value.currentVersionCode) || value.currentVersionCode < 1 || !Number.isInteger(value.sdkInt) || value.sdkInt < 24 ||
    typeof value.currentVersion !== 'string') {
    mobileUpdateState.value = { ...initialState(), status: 'error', errorCode: 'INVALID_STATE' }; return
  }
  const manifest = value.latest === undefined ? undefined : validateUpdateManifest(value.latest)
  if (manifest && !manifest.valid) {
    mobileUpdateState.value = { ...initialState(), status: 'error', errorCode: 'INVALID_MANIFEST' }; return
  }
  let status = value.status, errorCode = value.errorCode
  const latest = manifest?.valid ? manifest.value : undefined
  // Cache recovery can start verifying before its saved manifest has been read.
  // This state offers no install action; native verification publishes the result.
  if (['available', 'downloading', 'downloaded', 'permissionRequired', 'installing'].includes(status) || (status === 'verifying' && latest)) {
    if (!latest) { mobileUpdateState.value = { ...initialState(), status: 'error', errorCode: 'INVALID_MANIFEST' }; return }
    const availability = classifyUpdate(latest, value.currentVersionCode, value.sdkInt)
    if (availability === 'upToDate') status = 'upToDate'
    else if (availability === 'incompatible') { status = 'error'; errorCode = 'INCOMPATIBLE_SDK' }
  }
  mobileUpdateState.value = { status, currentVersion: value.currentVersion, currentVersionCode: value.currentVersionCode,
    applicationId: UPDATE_APPLICATION_ID, site: 'domestic', sdkInt: value.sdkInt, ...(latest ? { latest } : {}),
    downloadedBytes: Math.max(0, Number(value.downloadedBytes) || 0), totalBytes: Math.max(0, Number(value.totalBytes) || 0),
    progress: Math.min(100, Math.max(0, Number(value.progress) || 0)), installPermissionGranted: value.installPermissionGranted === true,
    downloadReady: value.downloadReady === true,
    cacheClearing: value.cacheClearing === true,
    ...(errorCode ? { errorCode } : {}) }
}

type Action = 'getState' | 'checkForUpdate' | 'downloadUpdate' | 'cancelDownload' | 'installUpdate' | 'openInstallSettings'
async function invoke(action: Action) {
  if (!mobileUpdaterSupported || !plugin) return
  const currentEpoch = epoch, beforeEvents = events
  try {
    const result = await plugin[action]()
    // Events sent during a long native operation carry the newer snapshot.
    if (epoch === currentEpoch && events === beforeEvents) accept(result)
  } catch {
    if (epoch === currentEpoch && events === beforeEvents) mobileUpdateState.value = { ...mobileUpdateState.value, status: 'error', errorCode: 'BRIDGE_ERROR' }
  }
}

export function initializeMobileUpdater(): Promise<void> {
  if (!mobileUpdaterSupported || !plugin) return Promise.resolve()
  if (initialized) return initialized
  const currentEpoch = epoch
  initialized = (async () => {
    try {
      const handle = await plugin.addListener('updateState', value => { if (epoch === currentEpoch) { events++; accept(value) } })
      if (epoch !== currentEpoch) { await handle.remove(); return }
      listener = handle
      await invoke('getState')
    } catch {
      if (epoch === currentEpoch) { initialized = null; mobileUpdateState.value = { ...mobileUpdateState.value, status: 'error', errorCode: 'BRIDGE_ERROR' } }
    }
  })()
  return initialized
}

export async function refreshMobileUpdater() { await initializeMobileUpdater(); await invoke('getState') }
export async function checkMobileUpdate() { await initializeMobileUpdater(); await invoke('checkForUpdate') }
export async function downloadMobileUpdate() { await initializeMobileUpdater(); await invoke('downloadUpdate') }
export async function cancelMobileUpdate() { await invoke('cancelDownload') }
export async function installMobileUpdate() { await invoke('installUpdate') }
export async function openMobileInstallSettings() { await invoke('openInstallSettings') }

const storageCodes = ['UPDATER_BUSY', 'CACHE_UNSAFE_PATH', 'CACHE_IO_ERROR', 'STORAGE_UNAVAILABLE'] as const
export class MobileStorageOperationError extends Error {
  readonly code: typeof storageCodes[number]
  constructor(error: unknown) {
    super('Update cache operation could not be completed')
    const code = error && typeof error === 'object' ? (error as { code?: unknown }).code : undefined
    this.code = storageCodes.find(value => value === code) || 'STORAGE_UNAVAILABLE'
  }
}
export async function getMobileStorageInfo(): Promise<MobileStorageInfo> {
  if (!plugin || !mobileUpdaterSupported) throw new MobileStorageOperationError(null)
  try { return parseMobileStorageInfo(await plugin.getStorageInfo()) }
  catch (error) { throw new MobileStorageOperationError(error) }
}
export async function clearMobileUpdateCache(): Promise<MobileStorageClearResult> {
  if (!plugin || !mobileUpdaterSupported) throw new MobileStorageOperationError(null)
  const generation = epoch, beforeEvents = events
  try {
    const result = await plugin.clearUpdateCache()
    // The native cleanup emits the resulting updater snapshot. Never let an
    // older clear callback overwrite a newer update operation's event.
    if (result.updateState && generation === epoch && beforeEvents === events) accept(result.updateState)
    const parsed = parseMobileStorageClearResult(result)
    if (result.errorCode) throw { code: result.errorCode }
    return parsed
  } catch (error) {
    // A storage operation failure is local to its panel. In particular, a busy
    // rejection must not turn an active download into an updater error.
    throw new MobileStorageOperationError(error)
  }
}

export async function quietlyCheckMobileUpdate() {
  if (!mobileUpdaterSupported) return
  await initializeMobileUpdater()
  const state = mobileUpdateState.value
  if (state.cacheClearing || isUpdateBusy(state.status) || ['available', 'downloaded', 'permissionRequired'].includes(state.status)) return
  try { quietCheckedAt = Math.max(quietCheckedAt, Number(localStorage.getItem(quietKey)) || 0) } catch { /* memory throttle remains available */ }
  const now = Date.now()
  if (quietCheckedAt > now) quietCheckedAt = 0
  if (now - quietCheckedAt < 6 * 60 * 60 * 1000) return
  quietCheckedAt = now
  try { localStorage.setItem(quietKey, String(now)) } catch { /* no dependency on private account storage */ }
  await invoke('checkForUpdate')
}

export function disposeMobileUpdater() {
  epoch++; events++; const handle = listener; listener = null; initialized = null
  if (handle) void handle.remove().catch(() => {})
}
