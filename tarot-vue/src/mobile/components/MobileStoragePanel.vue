<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { clearMobileUpdateCache, getMobileStorageInfo, mobileUpdaterSupported, mobileUpdaterPlatform, mobileUpdateState } from '../mobileUpdater'
import { isUpdateBusy } from '../mobileUpdateModel'
import { formatStorageBytes, storageErrorText, type MobileStorageInfo } from '../mobileStorageManagement'

const props = defineProps<{ english: boolean }>()
const t = (zh: string, en: string) => props.english ? en : zh
const info = ref<MobileStorageInfo | null>(null)
const loading = ref(false), clearing = ref(false), confirming = ref(false)
const error = ref(''), notice = ref('')
const clearButton = ref<HTMLButtonElement | null>(null), confirmButton = ref<HTMLButtonElement | null>(null)
let disposed = false, sequence = 0
const updateBusy = computed(() => isUpdateBusy(mobileUpdateState.value.status) || mobileUpdateState.value.cacheClearing === true)
const working = computed(() => loading.value || clearing.value)
const canClear = computed(() => mobileUpdaterSupported && !working.value && !updateBusy.value && !!info.value?.canClear && !info.value.busy)
const cacheSize = computed(() => info.value ? formatStorageBytes(info.value.bytes, props.english) : '—')
const failed = (cause: unknown) => storageErrorText(cause && typeof cause === 'object' && 'code' in cause ? cause.code : undefined, props.english)

async function refresh() {
  if (!mobileUpdaterSupported || working.value || updateBusy.value || disposed) return
  const action = ++sequence
  loading.value = true; error.value = ''; notice.value = ''
  try {
    const value = await getMobileStorageInfo()
    if (!disposed && action === sequence) info.value = value
  } catch (cause) {
    if (!disposed && action === sequence) { info.value = null; error.value = failed(cause) }
  } finally { if (!disposed && action === sequence) loading.value = false }
}
async function askClear() {
  if (!canClear.value) return
  confirming.value = true; error.value = ''; notice.value = ''
  await nextTick(); if (!disposed) confirmButton.value?.focus()
}
async function cancelClear() {
  confirming.value = false
  await nextTick(); if (!disposed && clearButton.value?.isConnected) clearButton.value.focus()
}
async function clearCache() {
  if (!canClear.value || !confirming.value || disposed) return
  const action = ++sequence
  clearing.value = true; confirming.value = false; error.value = ''; notice.value = ''
  try {
    const result = await clearMobileUpdateCache()
    if (disposed || action !== sequence) return
    info.value = result.storage
    if (result.clearedBytes > 0) notice.value = t(`已释放 ${formatStorageBytes(result.clearedBytes, false)}。`, `Freed ${formatStorageBytes(result.clearedBytes, true)}.`)
    else if (result.removedFiles > 0) notice.value = t('已清理空的更新缓存文件，未释放额外空间。', 'Empty update cache files were removed; no additional space was freed.')
    else notice.value = t('当前没有需要清理的更新缓存。', 'There is no update cache to clear.')
  } catch (cause) {
    if (!disposed && action === sequence) { info.value = null; error.value = failed(cause) }
  } finally { if (!disposed && action === sequence) clearing.value = false }
}
watch(updateBusy, value => {
  if (value) confirming.value = false
  else void refresh()
})
onMounted(() => { void refresh() })
onBeforeUnmount(() => { disposed = true; sequence++ })
</script>

<template>
  <section class="mobile-storage-panel mobile-settings-group" :aria-label="t('存储管理', 'Storage management')">
    <h2>{{ t('存储管理', 'Storage management') }}</h2>
    <div class="mobile-storage-size">
      <span>{{ t('更新缓存', 'Update cache') }}</span>
      <strong aria-live="polite">{{ cacheSize }}</strong>
      <span v-if="info" class="mobile-storage-files">{{ english ? `${info.files} ${info.files === 1 ? 'file' : 'files'}` : `${info.files} 个文件` }}</span>
    </div>
    <p class="mobile-storage-scope">{{ t('仅统计和清理已下载更新包、下载残留及校验文件，不包含应用本体或图片缓存。', 'Only downloaded updates, partial downloads and verification files are measured and cleared. The app itself and image caches are not included.') }}</p>
    <p class="mobile-storage-preserve">{{ t('登录、每日牌面、未发送问题与追问和云端记录都会保留。', 'Your sign-in, daily cards, unsent questions and follow-ups, and cloud readings are kept.') }}</p>
    <p v-if="!mobileUpdaterSupported" class="mobile-storage-status" role="status">{{ mobileUpdaterPlatform === 'ios' ? t('更新缓存清理仅在安卓 APP 内提供。', 'Update cache management is available in the Android app.') : t('请在安卓 APP 内查看和清理更新缓存。', 'View and clear update cache in the Android app.') }}</p>
    <template v-else>
      <p v-if="clearing || mobileUpdateState.cacheClearing" class="mobile-storage-status" role="status">{{ t('正在清理更新缓存…', 'Clearing update cache…') }}</p>
      <p v-else-if="updateBusy || info?.busy" class="mobile-storage-status" role="status">{{ t('更新正在进行，完成或取消后可刷新并清理。', 'An update is in progress. Finish or cancel it, then refresh and clear the cache.') }}</p>
      <p v-else-if="loading" class="mobile-storage-status" role="status">{{ t('正在统计更新缓存…', 'Measuring update cache…') }}</p>
      <p v-if="error" class="mobile-storage-error" role="alert">{{ error }}</p>
      <p v-if="notice" class="mobile-storage-status" role="status">{{ notice }}</p>
      <div v-if="confirming" class="mobile-storage-confirm" role="group" :aria-label="t('确认清理更新缓存', 'Confirm clearing update cache')">
        <p>{{ t('清理后，已下载的更新包需重新下载才能安装。登录和草稿不会删除。', 'After clearing, downloaded updates must be downloaded again before installation. Your sign-in and drafts will remain.') }}</p>
        <div class="mobile-storage-actions">
          <button type="button" class="mobile-storage-secondary" :disabled="working" @click="cancelClear">{{ t('取消', 'Cancel') }}</button>
          <button ref="confirmButton" type="button" class="mobile-storage-primary" :disabled="!canClear" @click="clearCache">{{ t('确认清理', 'Clear update cache') }}</button>
        </div>
      </div>
      <div v-else class="mobile-storage-actions">
        <button type="button" class="mobile-storage-secondary" :disabled="working || updateBusy" @click="refresh">{{ loading ? t('正在统计…', 'Measuring…') : t('刷新占用', 'Refresh size') }}</button>
        <button ref="clearButton" type="button" class="mobile-storage-primary" :disabled="!canClear" @click="askClear">{{ clearing ? t('正在清理…', 'Clearing…') : t('清理更新缓存', 'Clear update cache') }}</button>
      </div>
    </template>
  </section>
</template>

<style scoped>
.mobile-storage-panel { min-width:0; padding:22px 20px; border:1px solid var(--m-line,#cbb0ed2b); border-radius:18px; background:var(--m-card-surface,#211b29); }
.mobile-storage-panel h2 { margin:0; color:var(--m-text,#f1ecf4); font-size:16px; font-weight:600; }
.mobile-storage-size { display:grid; gap:7px; margin-top:18px; min-width:0; color:var(--m-muted,#b6a8c6); font-size:12px; }
.mobile-storage-size strong { min-width:0; color:var(--m-text,#f1ecf4); font-size:17px; font-weight:500; line-height:1.6; overflow-wrap:anywhere; }
.mobile-storage-files { font-variant-numeric:tabular-nums; }
.mobile-storage-scope,.mobile-storage-preserve,.mobile-storage-status,.mobile-storage-error { margin:14px 0 0; color:var(--m-muted,#b6a8c6); font-size:12px; line-height:1.8; overflow-wrap:anywhere; }
.mobile-storage-preserve { margin-top:8px; }
.mobile-storage-error { color:var(--m-danger,#edb4c5); }
.mobile-storage-actions { display:flex; flex-wrap:wrap; align-items:stretch; gap:10px; margin-top:18px; }
.mobile-storage-actions button { flex:1; min-width:0; min-height:48px; padding:10px 12px; border:1px solid var(--m-line,#cbb0ed2b); border-radius:12px; font:inherit; font-size:13px; line-height:1.6; cursor:pointer; overflow-wrap:anywhere; }
.mobile-storage-secondary { color:var(--m-text,#f1ecf4); background:transparent; }
.mobile-storage-primary { color:var(--m-button-text,#21162f); background:var(--m-accent,#cbb0ed); }
.mobile-storage-actions button:disabled { opacity:.45; cursor:default; }
.mobile-storage-actions button:focus-visible { outline:2px solid var(--m-accent,#cbb0ed); outline-offset:4px; }
.mobile-storage-confirm { margin-top:17px; padding-top:16px; border-top:1px solid var(--m-line,#cbb0ed2b); }
.mobile-storage-confirm p { margin:0; color:var(--m-text,#f1ecf4); font-size:13px; line-height:1.8; overflow-wrap:anywhere; }
</style>
