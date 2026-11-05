<script setup lang="ts">
import { ref, watch, onBeforeUnmount, computed, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import adminApi from '@/services/adminApi'
import { formatAdminApiError } from '@/utils/adminApiError'
import { adminDateTime } from '@/utils/adminDateTime'
import type { ConfigScope, ConfigHistoryEntry, ConfigHistoryDetail, ConfigRollbackPreview } from '@/types/configHistory'
import ConfigDifferences from './ConfigDifferences.vue'

const props = defineProps<{ initialScope?: ConfigScope; refreshKey: number }>()
const emit = defineEmits<{ restored: [scope: ConfigScope]; loading: [busy: boolean] }>()
const { t, locale } = useI18n()
const scopes: ConfigScope[] = ['card-backs', 'cards', 'readers-prompts', 'featured-readers']
const scope = ref<ConfigScope | ''>(props.initialScope ?? '')
const entries = ref<ConfigHistoryEntry[]>([])
const page = ref(1), totalPages = ref(1), total = ref(0)
const loading = ref(false), detailLoading = ref(false), previewLoading = ref(false), applying = ref(false)
const listError = ref(''), detailError = ref(''), actionError = ref(''), notice = ref('')
const selected = ref<ConfigHistoryDetail | null>(null)
const selectedId = ref<number | null>(null)
const detailPanel = ref<HTMLElement | null>(null)
const preview = ref<ConfigRollbackPreview | null>(null)
const reason = ref('')
const mode = ref<'change' | 'rollback'>('change')
const busy = computed(() => loading.value || detailLoading.value || previewLoading.value || applying.value)
watch(busy, value => emit('loading', value))
const when = (value: unknown) => adminDateTime(value, String(locale.value), t('pages.admin.noTimeRecord'))
let disposed = false, listSequence = 0, detailSequence = 0, previewSequence = 0
let listController: AbortController | null = null, detailController: AbortController | null = null, previewController: AbortController | null = null

async function loadList(targetPage = 1) {
  const sequence = ++listSequence
  listController?.abort(); listController = new AbortController()
  loading.value = true; listError.value = ''
  try {
    const response = await adminApi.get('/config-history', { params: { page: targetPage, pageSize: 20, scope: scope.value || undefined }, signal: listController.signal })
    if (disposed || sequence !== listSequence) return
    const data = response.data.data
    entries.value = data.items; total.value = data.total; page.value = data.page; totalPages.value = Math.max(1, data.totalPages)
  } catch (error) { if (!disposed && sequence === listSequence) listError.value = formatAdminApiError(error, t('pages.admin.configHistory.loadFailed')) }
  finally { if (!disposed && sequence === listSequence) loading.value = false }
}

async function selectVersion(entry: ConfigHistoryEntry) {
  if (applying.value) return
  const sequence = ++detailSequence
  previewSequence++; previewController?.abort()
  detailController?.abort(); detailController = new AbortController()
  selectedId.value = entry.id; selected.value = null; preview.value = null; mode.value = 'change'
  reason.value = ''; actionError.value = ''; detailError.value = ''; notice.value = ''; detailLoading.value = true; previewLoading.value = false
  try {
    const response = await adminApi.get(`/config-history/${entry.id}`, { signal: detailController.signal })
    if (!disposed && sequence === detailSequence && selectedId.value === entry.id) {
      selected.value = response.data.data
      await nextTick()
      if (window.matchMedia('(max-width: 1279px)').matches) detailPanel.value?.scrollIntoView({ block: 'start' })
    }
  } catch (error) { if (!disposed && sequence === detailSequence) detailError.value = formatAdminApiError(error, t('pages.admin.configHistory.loadFailed')) }
  finally { if (!disposed && sequence === detailSequence) detailLoading.value = false }
}

async function loadPreview() {
  const target = selected.value
  if (!target || applying.value) return
  const sequence = ++previewSequence
  previewController?.abort(); previewController = new AbortController()
  mode.value = 'rollback'; preview.value = null; previewLoading.value = true; actionError.value = ''; notice.value = ''
  try {
    const response = await adminApi.get(`/config-history/${target.id}/rollback-preview`, { signal: previewController.signal })
    if (!disposed && sequence === previewSequence && selectedId.value === target.id) preview.value = response.data.data
  } catch (error) { if (!disposed && sequence === previewSequence) actionError.value = formatAdminApiError(error, t('pages.admin.configHistory.loadFailed')) }
  finally { if (!disposed && sequence === previewSequence) previewLoading.value = false }
}

async function applyRollback() {
  const target = selected.value, review = preview.value
  if (!target || !review || review.target.id !== target.id || applying.value || reason.value.trim().length < 3 || !review.changes.length || review.blockers.length) return
  applying.value = true; actionError.value = ''
  try {
    const response = await adminApi.post(`/config-history/${target.id}/rollback`, {
      expectedRevision: review.configVersion.revision, expectedHash: review.configVersion.hash, reason: reason.value.trim(),
    })
    if (disposed) return
    const result = response.data.data
    emit('restored', target.scope)
    await loadList(1)
    applying.value = false
    const restored = entries.value.find(entry => entry.id === result.versionId)
    if (restored) await selectVersion(restored)
    else { preview.value = null; mode.value = 'change' }
    notice.value = t(result.changed ? 'pages.admin.configHistory.rollbackDone' : 'pages.admin.configHistory.noDifferences')
  } catch (error) {
    if (disposed) return
    actionError.value = formatAdminApiError(error, t('pages.admin.configHistory.rollbackFailed'))
    // Any failure requires a fresh preview, so an old confirmation cannot be replayed.
    preview.value = null
  } finally { if (!disposed) applying.value = false }
}

watch(scope, () => { selectedId.value = null; selected.value = null; preview.value = null; detailSequence++; previewSequence++; detailController?.abort(); previewController?.abort(); detailLoading.value = false; previewLoading.value = false; void loadList() })
watch(() => props.refreshKey, () => { if (!applying.value) { preview.value = null; void loadList(page.value) } })
void loadList()
onBeforeUnmount(() => { disposed = true; listSequence++; detailSequence++; previewSequence++; listController?.abort(); detailController?.abort(); previewController?.abort(); emit('loading', false) })
</script>

<template>
  <section :aria-label="t('pages.admin.configHistory.title')" class="min-w-0">
    <p class="mb-4 text-xs leading-relaxed text-gray-400">{{ t('pages.admin.configHistory.intro') }}</p>
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <label class="flex items-center gap-2 text-xs text-gray-400">
        {{ t('pages.admin.configHistory.scopeLabel') }}
        <select v-model="scope" :disabled="applying" class="history-control">
          <option value="">{{ t('pages.admin.configHistory.allScopes') }}</option>
          <option v-for="kind in scopes" :key="kind" :value="kind">{{ t('pages.admin.configHistory.scopes.' + kind) }}</option>
        </select>
      </label>
      <span class="text-xs text-gray-500">{{ t('pages.admin.totalRows', { n: total }) }}</span>
    </div>
    <p v-if="notice" role="status" class="mb-4 rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-3 text-sm text-emerald-200">{{ notice }}</p>
    <div class="grid min-w-0 gap-5 xl:grid-cols-[minmax(300px,.85fr)_minmax(0,1.5fr)]">
      <div class="min-w-0">
        <p v-if="loading" role="status" class="py-8 text-center text-sm text-gray-400">{{ t('pages.admin.configHistory.loading') }}</p>
        <div v-else-if="listError" role="alert" class="rounded-xl border border-amber-400/20 p-4 text-sm text-amber-200">
          <p>{{ listError }}</p><button type="button" class="history-button mt-3" @click="loadList(page)">{{ t('pages.admin.retry') }}</button>
        </div>
        <p v-else-if="!entries.length" class="py-8 text-sm text-gray-400">{{ t('pages.admin.configHistory.empty') }}</p>
        <ol v-else class="max-h-[34rem] space-y-2 overflow-y-auto pr-1" :aria-label="t('pages.admin.configHistory.entries')">
          <li v-for="entry in entries" :key="entry.id">
            <button type="button" :disabled="applying" :aria-pressed="selectedId === entry.id" class="w-full rounded-xl border p-4 text-left transition-colors disabled:opacity-50" :class="selectedId === entry.id ? 'border-gold-400/50 bg-gold-400/5' : 'border-white/10 bg-white/[.02] hover:border-white/25'" @click="selectVersion(entry)">
              <span class="flex flex-wrap items-center justify-between gap-2 text-sm text-gold-100">
                <span>{{ t('pages.admin.configHistory.scopes.' + entry.scope) }} · V{{ entry.revision }}</span>
                <span class="text-xs text-violet-200">{{ t('pages.admin.configHistory.actions.' + entry.action) }}</span>
              </span>
              <span class="mt-2 block text-xs text-gray-400">{{ entry.action === 'baseline' ? t('pages.admin.configHistory.system') : entry.operatorName }} · {{ when(entry.createdAt) }}</span>
              <span class="mt-2 block break-words text-xs text-gray-300">{{ entry.action === 'baseline' ? t('pages.admin.configHistory.baselineReason') : entry.reason || t('pages.admin.configHistory.noReason') }}</span>
              <span class="mt-2 block text-[11px] text-gray-500">{{ t('pages.admin.configHistory.changedItems', { n: entry.changeCount }) }}</span>
            </button>
          </li>
        </ol>
        <div class="mt-4 flex items-center justify-center gap-2 text-xs text-gray-400">
          <button type="button" class="history-button" :disabled="loading || applying || page <= 1" @click="loadList(page - 1)">{{ t('pages.admin.prevPage') }}</button>
          <span>{{ page }} / {{ totalPages }}</span>
          <button type="button" class="history-button" :disabled="loading || applying || page >= totalPages" @click="loadList(page + 1)">{{ t('pages.admin.nextPage') }}</button>
        </div>
      </div>
      <div ref="detailPanel" class="min-w-0 scroll-mt-4 rounded-2xl border border-white/10 bg-white/[.015] p-4 sm:p-5">
        <p v-if="detailLoading" role="status" class="text-sm text-gray-400">{{ t('pages.admin.configHistory.loading') }}</p>
        <p v-else-if="detailError" role="alert" class="text-sm text-amber-200">{{ detailError }}</p>
        <p v-else-if="!selected" class="py-8 text-sm text-gray-400">{{ t('pages.admin.configHistory.selectVersion') }}</p>
        <template v-else>
          <div class="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 class="text-base font-medium text-gold-100">{{ t('pages.admin.configHistory.scopes.' + selected.scope) }} · V{{ selected.revision }}</h3>
              <p class="mt-1 text-xs text-gray-500">{{ selected.operatorName }} · {{ when(selected.createdAt) }}</p>
            </div>
            <button type="button" class="history-button" :disabled="applying || previewLoading" @click="loadPreview">{{ t('pages.admin.configHistory.previewRollback') }}</button>
          </div>
          <p v-if="selected.action === 'baseline'" class="mb-4 text-xs leading-relaxed text-gray-400">{{ t('pages.admin.configHistory.baselineHint') }}</p>
          <template v-if="mode === 'change'">
            <p class="mb-3 text-sm text-gray-300">{{ t('pages.admin.configHistory.savedChanges') }}</p>
            <ConfigDifferences :changes="selected.changes" />
          </template>
          <template v-else>
            <p class="mb-4 rounded-xl border border-amber-400/20 bg-amber-400/5 p-3 text-xs leading-relaxed text-amber-100">{{ t('pages.admin.configHistory.rollbackHint', { name: t('pages.admin.configHistory.scopes.' + selected.scope), revision: selected.revision }) }}</p>
            <p v-if="previewLoading" role="status" class="py-4 text-sm text-gray-400">{{ t('pages.admin.configHistory.loading') }}</p>
            <template v-else-if="preview">
              <p class="mb-3 text-xs text-gray-400">{{ t('pages.admin.configHistory.currentVersion', { n: preview.configVersion.revision }) }}</p>
              <ConfigDifferences :changes="preview.changes" />
              <div v-if="preview.blockers.length" role="alert" class="mt-4 rounded-xl border border-amber-400/20 p-3 text-sm text-amber-200">
                <p>{{ t('pages.admin.configHistory.ownedBacksBlock') }}</p>
                <p v-for="blocker in preview.blockers" :key="blocker.id" class="mt-2 break-words text-xs">{{ blocker.name }} ({{ blocker.code }})</p>
              </div>
              <form v-if="preview.changes.length && !preview.blockers.length" class="mt-5 space-y-3 border-t border-white/10 pt-4" @submit.prevent="applyRollback">
                <label class="block text-xs text-gray-300">{{ t('pages.admin.configHistory.reasonLabel') }}
                  <textarea v-model="reason" minlength="3" maxlength="500" required rows="3" class="history-control mt-2 w-full resize-y" :disabled="applying" :placeholder="t('pages.admin.configHistory.reasonPh')" />
                </label>
                <button type="submit" class="rounded-lg bg-gold-500 px-4 py-2 text-sm font-semibold text-black disabled:opacity-40" :disabled="applying || reason.trim().length < 3">{{ t(applying ? 'pages.admin.configHistory.applying' : 'pages.admin.configHistory.confirmRollback') }}</button>
              </form>
            </template>
            <p v-if="actionError" role="alert" class="mt-4 text-sm text-amber-200">{{ actionError }}</p>
          </template>
        </template>
      </div>
    </div>
  </section>
</template>

<style scoped>
.history-control { max-width: 100%; border: 1px solid rgb(255 255 255 / .13); border-radius: 9px; background: #191522; color: #e5e7eb; padding: 9px 12px; font-size: 13px; }
.history-button { border: 1px solid rgb(255 255 255 / .15); border-radius: 8px; color: #d1d5db; font-size: 12px; padding: 8px 12px; }
.history-button:disabled { cursor: not-allowed; opacity: .35; }
label { min-width: 0; max-width: 100%; }
select { min-width: 0; }
:is(button,input,textarea,select):focus-visible { outline: 2px solid #d4af37; outline-offset: 3px; }
</style>
