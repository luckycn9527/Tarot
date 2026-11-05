<script setup lang="ts">
import { computed, ref } from 'vue'
import { mobileUpdateState, mobileUpdaterPlatform, mobileUpdaterSupported, checkMobileUpdate, downloadMobileUpdate, cancelMobileUpdate, installMobileUpdate, openMobileInstallSettings, refreshMobileUpdater } from '../mobileUpdater'
import { classifyUpdate, isUpdateBusy } from '../mobileUpdateModel'

const props = defineProps<{ english: boolean }>()
const t = (zh: string, en: string) => props.english ? en : zh
const state = mobileUpdateState
const working = ref(false)
const busy = computed(() => isUpdateBusy(state.value.status))
const newer = computed(() => mobileUpdaterSupported && !!state.value.latest && classifyUpdate(state.value.latest, state.value.currentVersionCode, state.value.sdkInt) === 'available')
const notes = computed(() => props.english ? state.value.latest?.releaseNotesEn || state.value.latest?.releaseNotes : state.value.latest?.releaseNotes)
const size = computed(() => state.value.latest ? `${(state.value.latest.bytes / 1024 / 1024).toFixed(1)} MB` : '')
const statusText = computed(() => {
  const status = state.value.status
  if (mobileUpdaterPlatform === 'ios') return t('iOS 更新请使用新的签名安装包，或通过你收到的测试邀请更新。', 'For iOS updates, install the new signed build or follow your testing invitation.')
  if (!mobileUpdaterSupported) return t('请在安卓 APP 内检查更新。', 'Check for updates in the Android app.')
  if (status === 'checking') return t('正在检查新版本…', 'Checking for updates…')
  if (status === 'upToDate') return t('已是最新版本。', 'You are up to date.')
  if (status === 'unavailable') return t('更新服务暂未就绪，请稍后重试。', 'Updates are temporarily unavailable. Try again later.')
  if (status === 'available') return t('发现新版本，可在下方查看更新内容。', 'A new version is available. See what’s new below.')
  if (status === 'downloading') return t('正在下载更新，可继续使用其他页面。', 'Downloading. You can keep using other pages.')
  if (status === 'verifying') return t('下载完成，正在检查安装包…', 'Download complete. Checking the update…')
  if (status === 'downloaded') return t('更新已准备好，安装会保留账号和记录。', 'Your update is ready. Your account and saved activity will be kept.')
  if (status === 'permissionRequired') return t('请先允许 E-Tomd 安装更新，返回这里后继续。', 'Allow E-Tomd to install updates, then return here to continue.')
  if (status === 'installing') return t('请在安卓提示中确认安装。取消后可返回重试。', 'Confirm installation in Android. If cancelled, return here to retry.')
  if (status === 'cancelled') return t('下载已取消，可以重新下载。', 'Download cancelled. You can try again.')
  if (status === 'error') {
    if (/INCOMPATIBLE/.test(state.value.errorCode || '')) return t('此更新需要更高版本的安卓系统。', 'This update requires a newer Android version.')
    if (/HASH|SIZE|SIGN|PACKAGE|APPLICATION|SITE|VERSION|APK|MANIFEST|VERIFY|INVALID_|DOWNLOAD_URL|RELEASE_NOTES|PUBLISHED_AT/.test(state.value.errorCode || '')) return t('更新包未通过检查，请重新检查版本或下载。', 'The update could not be verified. Check again or download it again.')
    return t('更新暂时失败，请检查网络后重试。', 'The update failed. Check your connection and try again.')
  }
  return t('检查新版，查看更新内容并在这里下载安装。', 'Check what’s new and download updates here.')
})
async function act(action: () => Promise<void>) { if (working.value) return; working.value = true; try { await action() } finally { working.value = false } }
</script>

<template>
  <section class="mobile-update-panel mobile-settings-group" :aria-label="mobileUpdaterPlatform === 'ios' ? t('版本信息', 'App version') : t('版本更新', 'App updates')">
    <div class="mobile-update-heading"><div><h2>{{ mobileUpdaterPlatform === 'ios' ? t('版本信息', 'App version') : t('版本更新', 'App updates') }}</h2><p>{{ t('当前版本', 'Current version') }} {{ state.currentVersion }}</p></div><span v-if="newer" class="mobile-update-badge">{{ t('有新版', 'New') }}</span></div>
    <p class="mobile-update-status" role="status" aria-live="polite">{{ statusText }}</p>
    <div v-if="newer && state.latest" class="mobile-update-release">
      <div class="mobile-update-release-title"><strong>{{ state.latest.version }}</strong><span>{{ size }}</span></div>
      <ul><li v-for="(note, index) in notes" :key="index">{{ note }}</li></ul>
    </div>
    <div v-if="mobileUpdaterSupported && (state.status === 'downloading' || state.status === 'verifying')" class="mobile-update-download">
      <div class="mobile-update-progress" role="progressbar" :aria-label="t('更新下载进度', 'Update download progress')" :aria-valuenow="Math.round(state.progress)" :aria-valuemin="0" :aria-valuemax="100"><span :style="{ width: `${state.progress}%` }" /></div>
      <span>{{ state.status === 'verifying' ? t('正在检查…', 'Checking…') : `${Math.floor(state.progress)}%` }}</span>
    </div>
    <div v-if="mobileUpdaterSupported" class="mobile-update-actions" :class="{ 'mobile-update-actions-expanded': newer || ['downloading', 'downloaded', 'permissionRequired', 'installing'].includes(state.status) }">
      <button v-if="state.status === 'downloading'" type="button" class="mobile-secondary" @click="cancelMobileUpdate">{{ t('取消下载', 'Cancel download') }}</button>
      <button v-else-if="state.status === 'downloaded' || state.status === 'permissionRequired'" type="button" class="mobile-primary" :disabled="working" @click="act(state.installPermissionGranted ? installMobileUpdate : openMobileInstallSettings)">{{ state.installPermissionGranted ? t('安装更新', 'Install update') : t('允许安装此来源', 'Allow app updates') }}</button>
      <button v-else-if="state.status === 'installing'" type="button" class="mobile-secondary" :disabled="working" @click="act(refreshMobileUpdater)">{{ t('返回后重试', 'Retry after returning') }}</button>
      <button v-else-if="newer && ['available', 'cancelled', 'error'].includes(state.status)" type="button" class="mobile-primary" :disabled="working" @click="act(downloadMobileUpdate)">{{ state.status === 'available' ? t('下载更新', 'Download update') : t('重新下载', 'Download again') }}</button>
      <button type="button" class="mobile-update-check" :disabled="busy || working" @click="act(checkMobileUpdate)">{{ state.status === 'checking' ? t('正在检查…', 'Checking…') : t('检查更新', 'Check for updates') }}</button>
    </div>
  </section>
</template>

<style scoped>
.mobile-update-panel { min-width: 0; padding: 22px 20px; border: 1px solid var(--m-line, #cbb0ed2b); border-radius: 18px; background: var(--m-card-surface, #211b29); }
.mobile-update-heading, .mobile-update-release-title { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.mobile-update-heading h2 { margin: 0; color: var(--m-text, #f1ecf4); font-size: 16px; font-weight: 600; letter-spacing: 0; }
.mobile-update-heading p { margin: 7px 0 0; color: var(--m-muted, #b6a8c6); font-size: 12px; }
.mobile-update-badge { flex-shrink: 0; padding: 4px 8px; border: 1px solid var(--m-line, #cbb0ed2b); border-radius: 20px; color: var(--m-accent, #cbb0ed); font-size: 11px; }
.mobile-update-status { margin: 17px 0 0; color: var(--m-muted, #b6a8c6); font-size: 13px; line-height: 1.7; overflow-wrap: anywhere; }
.mobile-update-release { margin-top: 17px; padding-top: 16px; border-top: 1px solid var(--m-line, #cbb0ed2b); }
.mobile-update-release-title strong { color: var(--m-text, #f1ecf4); font-size: 15px; font-weight: 500; }
.mobile-update-release-title span { color: var(--m-muted, #b6a8c6); font-size: 12px; }
.mobile-update-release ul { padding-left: 18px; margin: 12px 0 0; color: var(--m-muted, #b6a8c6); font-size: 13px; line-height: 1.8; }
.mobile-update-release li { padding-left: 2px; margin-top: 4px; overflow-wrap: anywhere; }
.mobile-update-download { display: flex; align-items: center; gap: 12px; margin-top: 18px; color: var(--m-muted, #b6a8c6); font-size: 12px; }
.mobile-update-progress { flex: 1; height: 4px; border-radius: 5px; overflow: hidden; background: var(--m-line, #cbb0ed2b); }
.mobile-update-progress span { display: block; height: 100%; background: var(--m-accent, #cbb0ed); transition: width .2s; }
.mobile-update-actions { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-top: 18px; }
.mobile-update-actions .mobile-primary, .mobile-update-actions .mobile-secondary { min-height: 48px; width: auto; flex: 1; padding: 10px 16px; margin: 0; border-radius: 12px; font-size: 14px; }
.mobile-update-check { min-height: 48px; padding: 10px 16px; border: 1px solid var(--m-line, #cbb0ed2b); border-radius: 12px; background: transparent; color: var(--m-text, #f1ecf4); font: inherit; font-size: 14px; cursor: pointer; text-align: center; }
.mobile-update-check:disabled { opacity: .45; cursor: default; }
.mobile-update-panel button:focus-visible { outline: 2px solid var(--m-accent, #cbb0ed); outline-offset: 4px; }
</style>
