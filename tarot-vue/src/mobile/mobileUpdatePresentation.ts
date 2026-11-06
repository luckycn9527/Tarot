import {
  classifyUpdate, UPDATE_APPLICATION_ID, UPDATE_SITE, validateUpdateManifest, type UpdateState,
} from './mobileUpdateModel'

export type UpdateRecoveryAction = 'install' | 'settings' | 'download' | 'refresh' | 'check' | null
export interface UpdateErrorRecovery { message: string; action: UpdateRecoveryAction; label?: string }

/** Translate native error codes into public copy and an action the current state can support. */
export function updateErrorRecovery(state: UpdateState, english: boolean): UpdateErrorRecovery {
  if (state.status !== 'error') return { message: '', action: null }
  const t = (zh: string, en: string) => english ? en : zh
  const check = { action: 'check' as const, label: t('检查更新', 'Check for updates') }
  if (state.applicationId !== UPDATE_APPLICATION_ID || state.site !== UPDATE_SITE) {
    return { message: t('更新信息需要重新确认，请重新检查更新。', 'The update information needs to be checked again.'), ...check }
  }
  const code = state.errorCode || ''
  const manifest = validateUpdateManifest(state.latest)
  const installedValid = Number.isSafeInteger(state.currentVersionCode) && state.currentVersionCode >= 1 &&
    Number.isInteger(state.sdkInt) && state.sdkInt >= 24
  const available = manifest.valid && installedValid && classifyUpdate(manifest.value, state.currentVersionCode, state.sdkInt) === 'available'
  const download = available ? { action: 'download' as const, label: t('重新下载', 'Download again') } : check

  // A safety failure always wins over the presence of a cached file. Native
  // installation independently validates the manifest and APK again.
  if (/INCOMPATIBLE/.test(code) || (manifest.valid && installedValid && classifyUpdate(manifest.value, state.currentVersionCode, state.sdkInt) === 'incompatible')) {
    return { message: t('此更新需要更高版本的安卓系统。', 'This update requires a newer Android version.'), ...check }
  }
  if (/HASH|SIZE|SIGN|PACKAGE|APPLICATION|SITE|VERSION|APK|MANIFEST|VERIFY|INVALID_|DOWNLOAD_URL|RELEASE_NOTES|PUBLISHED_AT/.test(code)) {
    return {
      message: available ? t('更新包未通过安全检查，请重新下载。', 'The update failed its safety checks. Download it again.')
        : t('更新信息未通过检查，请重新检查更新。', 'The update information could not be verified. Check for updates again.'),
      ...download,
    }
  }
  if (code === 'INSTALL_FAILED' || code === 'SETTINGS_FAILED') {
    if (state.downloadReady === true && available) {
      if (state.installPermissionGranted) {
        return {
          message: t('安装未完成，已下载的更新包仍可用，请重试安装。', 'Installation did not finish. Your downloaded update is still ready; retry installation.'),
          action: 'install', label: t('重试安装', 'Retry installation'),
        }
      }
      return {
        message: code === 'SETTINGS_FAILED'
          ? t('无法打开安装权限页面。请在系统设置中找到 E-Tomd，允许安装未知应用后返回重试。', 'Could not open installation settings. Find E-Tomd in system settings, allow it to install unknown apps, then return here.')
          : t('请允许 E-Tomd 安装更新。可在系统设置中找到 E-Tomd，允许安装未知应用后返回重试。', 'Allow E-Tomd to install updates. Find E-Tomd in system settings, allow it to install unknown apps, then return here.'),
        action: 'settings', label: t('打开安装设置', 'Open install settings'),
      }
    }
    return { message: t('安装包暂不可用，请重新检查或下载更新后安装。', 'The downloaded package is no longer available. Check for updates or download it again.'), ...download }
  }
  if (code === 'INSUFFICIENT_STORAGE' || code === 'STORAGE_ERROR') {
    return {
      message: code === 'INSUFFICIENT_STORAGE'
        ? t('存储空间不足，请释放一些空间后重新下载更新。', 'There is not enough storage. Free up some space, then download the update again.')
        : t('无法保存更新。请检查可用存储空间，释放空间后重试。', 'The update could not be saved. Check available storage, free up space, then retry.'),
      ...download,
    }
  }
  if (code === 'NETWORK_ERROR') return { message: t('网络连接中断，请连接网络后重试。', 'The network connection was interrupted. Reconnect and try again.'), ...download }
  if (code === 'HTTP_ERROR') return { message: t('更新服务暂时不可用，请稍后重试。', 'The update service is temporarily unavailable. Try again later.'), ...download }
  if (code === 'SECURE_CONNECTION_ERROR') return { message: t('无法建立安全连接，请稍后重新检查更新。', 'A secure connection could not be established. Check for updates again later.'), ...check }
  if (code === 'BRIDGE_ERROR') return {
    message: t('暂时无法读取系统更新状态，请重新读取后重试。', 'The system update status could not be read. Refresh it and try again.'),
    action: 'refresh', label: t('重新读取状态', 'Refresh update status'),
  }
  if (code === 'NO_DOWNLOAD') return { message: t('更新包尚未准备好，请重新下载后安装。', 'The update package is not ready. Download it again before installing.'), ...download }
  if (code === 'NO_UPDATE') return { message: t('请先检查可用的新版本。', 'Check for an available update first.'), ...check }
  // Never display the native exception message or infer install permission from
  // an unrecognized code, even when an old snapshot reports a ready download.
  return { message: t('更新暂未完成，请重新检查更新后重试。', 'The update did not finish. Check for updates and try again.'), ...check }
}
