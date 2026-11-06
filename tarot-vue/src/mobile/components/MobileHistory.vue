<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import SearchIcon from '@icons/search.vue'
import TrashIcon from '@icons/trash-2.vue'
import ChevronRightIcon from '@icons/chevron-right.vue'
import RefreshIcon from '@icons/refresh-cw.vue'
import LayersIcon from '@icons/layers.vue'
import MessageIcon from '@icons/message-circle.vue'
import type { ReadingHistoryEntry } from '../../stores/readingHistory'
import type { MobileReader } from '../types'
import MobileReaderAvatar from './MobileReaderAvatar.vue'
import { historyFilterError, type MobileHistoryFilters } from '../mobileHistoryModel'

const props = withDefaults(defineProps<{
  entries: ReadingHistoryEntry[]
  loading: boolean
  loaded?: boolean
  error: string
  page: number
  totalPages: number
  total: number
  search: string
  english: boolean
  deletingId?: number | null
  readers?: MobileReader[]
  filters?: MobileHistoryFilters
}>(), { loaded: true, deletingId: null, readers: () => [], filters: () => ({ type: '', from: '', to: '' }) })

const emit = defineEmits<{
  search: [value: string]
  page: [value: number]
  retry: []
  open: [id: number]
  delete: [id: number]
  filters: [value: MobileHistoryFilters]
}>()

const searchId = `mh-search-${useId()}`
const headingId = `mh-heading-${useId()}`
const filterId = `mh-filter-${useId()}`
const filterErrorId = `${filterId}-error`
const query = ref(props.search)
watch(() => props.search, value => { query.value = value })
const filterDraft = ref<MobileHistoryFilters>({ ...props.filters })
const filterError = ref('')
watch(() => props.filters, value => {
  filterDraft.value = { ...value }
  filterError.value = ''
}, { deep: true })
watch(filterDraft, () => { filterError.value = '' }, { deep: true })
const pages = computed(() => Math.max(1, props.totalPages))
const currentPage = computed(() => Math.min(Math.max(1, props.page), pages.value))
const initialLoading = computed(() => props.loading && !props.entries.length)
const hasSearch = computed(() => Boolean(props.search.trim()))
const hasFilters = computed(() => Boolean(props.filters.type || props.filters.from || props.filters.to))
const hasQuery = computed(() => hasSearch.value || hasFilters.value)
const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
const dateFormatter = computed(() => new Intl.DateTimeFormat(props.english ? 'en-US' : 'zh-CN', {
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
}))

function submitSearch() {
  if (!props.loading) emit('search', query.value.trim().slice(0, 100))
}

function clearSearch() {
  query.value = ''
  emit('search', '')
}

function applyFilters() {
  if (props.loading) return
  filterError.value = historyFilterError(filterDraft.value, props.english)
  if (!filterError.value) emit('filters', { ...filterDraft.value })
}

function clearFilters() {
  if (props.loading) return
  filterDraft.value = { type: '', from: '', to: '' }
  filterError.value = ''
  emit('filters', { ...filterDraft.value })
}

function date(value: string) {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime())
    ? (props.english ? 'Time not recorded' : '暂无时间记录')
    : dateFormatter.value.format(parsed)
}

function readingType(entry: ReadingHistoryEntry) {
  switch (entry.type) {
    case 'single': return props.english ? 'Single card' : '单卡占卜'
    case 'three-card': return props.english ? 'Three cards' : '三卡占卜'
    case 'daily-fortune': return props.english ? 'Daily reading' : '每日运势'
    case 'reader-reading': {
      const count = Array.isArray(entry.cardIds) ? entry.cardIds.length : 0
      return props.english
        ? `Reader reading${count ? ` · ${count} ${count === 1 ? 'card' : 'cards'}` : ''}`
        : `塔罗师解读${count ? ` · ${count} 张牌` : ''}`
    }
    default: return props.english ? 'Reading' : '占卜记录'
  }
}

function question(entry: ReadingHistoryEntry) {
  return entry.question?.trim() || (entry.type === 'daily-fortune'
    ? (props.english ? 'Your daily reading' : '这一天的运势')
    : (props.english ? 'View this reading' : '查看这次占卜'))
}

function followupCount(entry: ReadingHistoryEntry) {
  if (entry.type !== 'reader-reading' || !entry.resultData || typeof entry.resultData !== 'object') return 0
  const followups = (entry.resultData as Record<string, unknown>).followups
  return Array.isArray(followups) ? followups.length : 0
}

function originalReader(entry: ReadingHistoryEntry) {
  return entry.type === 'reader-reading' && entry.readerId
    ? props.readers.find(reader => reader.id === entry.readerId)
    : undefined
}

function readerName(entry: ReadingHistoryEntry) {
  return originalReader(entry)?.name || (props.english ? 'Original reader details unavailable' : '原塔罗师资料暂不可用')
}
function readerAvatar(entry: ReadingHistoryEntry) {
  return originalReader(entry) || (entry.type === 'reader-reading' && entry.readerId ? { id: entry.readerId } : undefined)
}
</script>

<template>
  <section class="mh-screen" :aria-labelledby="headingId" :aria-busy="loading">
    <header class="mh-heading">
      <h1 :id="headingId">{{ english ? 'Keep your insights close.' : '把启发留在这里。' }}</h1>
      <p class="mh-description">{{ english ? 'Revisit your cards and readings, and continue the conversation.' : '回看牌面和解读，继续之前的对话。' }}</p>
    </header>

    <form class="mh-search" role="search" @submit.prevent="submitSearch">
      <label :for="searchId" class="mh-sr-only">{{ english ? 'Search your reading questions' : '搜索占卜问题' }}</label>
      <div class="mh-search-field">
        <SearchIcon :size="18" aria-hidden="true" />
        <input
          :id="searchId"
          v-model="query"
          type="search"
          maxlength="100"
          autocomplete="off"
          enterkeyhint="search"
          :placeholder="english ? 'Search a question…' : '搜索你问过的问题…'"
          :disabled="loading"
        >
      </div>
      <button type="submit" class="mh-search-submit" :disabled="loading">{{ english ? 'Search' : '搜索' }}</button>
    </form>

    <form class="mh-filters" novalidate @submit.prevent="applyFilters">
      <fieldset :disabled="loading" :aria-describedby="filterError ? filterErrorId : undefined">
        <legend>{{ english ? 'Filter readings' : '筛选记录' }}<span v-if="hasFilters" class="mh-filter-applied">{{ english ? 'Applied' : '已应用' }}</span></legend>
        <label class="mh-filter-type" :for="`${filterId}-type`">
          <span>{{ english ? 'Reading type' : '占卜类型' }}</span>
          <select :id="`${filterId}-type`" v-model="filterDraft.type">
            <option value="">{{ english ? 'All types' : '全部类型' }}</option>
            <option value="single">{{ english ? 'Single card' : '单卡占卜' }}</option>
            <option value="three-card">{{ english ? 'Three cards' : '三卡占卜' }}</option>
            <option value="reader-reading">{{ english ? 'Reader reading' : '塔罗师解读' }}</option>
          </select>
        </label>
        <div class="mh-filter-dates">
          <label :for="`${filterId}-from`">
            <span>{{ english ? 'From date' : '开始日期' }}</span>
            <input :id="`${filterId}-from`" v-model="filterDraft.from" type="date" :max="filterDraft.to || '9999-12-31'" :aria-invalid="Boolean(filterError)" :aria-describedby="filterError ? filterErrorId : undefined">
          </label>
          <label :for="`${filterId}-to`">
            <span>{{ english ? 'To date' : '结束日期' }}</span>
            <input :id="`${filterId}-to`" v-model="filterDraft.to" type="date" :min="filterDraft.from || undefined" max="9999-12-31" :aria-invalid="Boolean(filterError)" :aria-describedby="filterError ? filterErrorId : undefined">
          </label>
        </div>
        <p v-if="filterError" :id="filterErrorId" class="mh-filter-error" role="alert">{{ filterError }}</p>
        <div class="mh-filter-actions">
          <button type="button" class="mh-text-button" @click="clearFilters">{{ english ? 'Clear filters' : '清除筛选' }}</button>
          <button type="submit" class="mh-secondary">{{ english ? 'Apply filters' : '应用筛选' }}</button>
        </div>
      </fieldset>
    </form>

    <div class="mh-list-meta">
      <p v-if="loaded">{{ english ? `${total} ${total === 1 ? 'reading' : 'readings'}${hasQuery ? ' found' : ''}` : `${hasQuery ? '找到' : '共'} ${total} 条记录` }}</p>
      <button v-if="query || hasSearch" type="button" class="mh-text-button" :disabled="loading" @click="clearSearch">{{ english ? 'Clear search' : '清除搜索' }}</button>
    </div>

    <div v-if="error" class="mh-error" role="alert">
      <p>{{ error }}</p>
      <button type="button" class="mh-secondary" :disabled="loading" @click="emit('retry')">
        <RefreshIcon :size="16" aria-hidden="true" />{{ english ? 'Try again' : '重新加载' }}
      </button>
    </div>

    <div v-if="initialLoading" class="mh-initial-loading" role="status">
      <RefreshIcon :size="20" class="mh-spin" aria-hidden="true" />
      <span>{{ english ? 'Loading your readings…' : '正在加载你的记录…' }}</span>
    </div>

    <template v-else-if="entries.length">
      <p v-if="loading" class="mh-refreshing" role="status">{{ english ? 'Updating your readings…' : '正在更新记录…' }}</p>
      <ol class="mh-list" :aria-label="english ? 'Saved readings' : '已保存的占卜'">
        <li v-for="entry in entries" :key="entry.id" class="mh-card">
          <button
              type="button"
              class="mh-entry-main"
              :disabled="deletingId === entry.id"
              :aria-label="`${english ? 'Open reading: ' : '查看占卜：'}${question(entry)}`"
              @click="emit('open', entry.id)"
          >
            <span class="mh-entry-heading">
              <span class="mh-entry-icon" aria-hidden="true"><LayersIcon :size="21" /></span>
              <span class="mh-entry-type">{{ readingType(entry) }}</span>
              <time class="mh-date" :datetime="entry.createdAt">{{ date(entry.createdAt) }}</time>
            </span>
            <span class="mh-entry-body">
              <span class="mh-question">{{ question(entry) }}</span>
              <span class="mh-open-label">{{ english ? 'Read interpretation' : '查看解读' }}<ChevronRightIcon :size="17" aria-hidden="true" /></span>
            </span>
            <span v-if="entry.type === 'reader-reading'" class="mh-reader-identity">
              <MobileReaderAvatar :reader="readerAvatar(entry)" :size="24" />
              <span>{{ english ? 'Reader · ' : '塔罗师 · ' }}{{ readerName(entry) }}</span>
            </span>
          </button>
          <div class="mh-entry-footer">
            <span class="mh-followups">
              <MessageIcon :size="16" aria-hidden="true" />
              <span>
              <template v-if="followupCount(entry)">{{ english ? `${followupCount(entry)} saved ${followupCount(entry) === 1 ? 'follow-up' : 'follow-ups'}` : `已保存 ${followupCount(entry)} 次追问` }}</template>
              <template v-else>{{ english ? 'Saved to your account' : '已保存到你的账户' }}</template>
              </span>
            </span>
            <button
                type="button"
                class="mh-delete"
                :disabled="loading || deletingId !== null"
                :aria-label="`${english ? 'Delete reading: ' : '删除占卜：'}${question(entry)}`"
                @click="emit('delete', entry.id)"
            >
              <TrashIcon :size="16" aria-hidden="true" />
              <span>{{ deletingId === entry.id ? (english ? 'Deleting…' : '正在删除…') : (english ? 'Delete' : '删除') }}</span>
            </button>
          </div>
        </li>
      </ol>
    </template>

    <div v-else-if="loaded && !error" class="mh-empty" role="status">
      <p class="mh-empty-title">{{ hasQuery ? (english ? 'No matching readings.' : '没有找到符合条件的记录。') : (english ? 'Your story starts with a question.' : '从一个问题，开始记录。') }}</p>
      <p>{{ hasQuery ? (english ? 'Try another keyword or adjust your filters.' : '试试其他关键词，或调整筛选条件。') : (english ? 'Completed readings will be saved here so you can revisit them.' : '完成问卜后，解读会保存在这里，方便随时回看。') }}</p>
      <button v-if="hasFilters" type="button" class="mh-secondary" :disabled="loading" @click="clearFilters">{{ english ? 'Clear filters' : '清除筛选' }}</button>
      <button v-else-if="hasSearch" type="button" class="mh-secondary" :disabled="loading" @click="clearSearch">{{ english ? 'Clear search' : '清除搜索' }}</button>
    </div>

    <nav v-if="loaded && total > 0" class="mh-pagination" :aria-label="english ? 'Reading pages' : '占卜记录分页'">
      <button type="button" class="mh-secondary" :disabled="loading || currentPage <= 1" @click="emit('page', currentPage - 1)">{{ english ? 'Previous' : '上一页' }}</button>
      <span aria-live="polite">{{ currentPage }} / {{ pages }}</span>
      <button type="button" class="mh-secondary" :disabled="loading || currentPage >= pages" @click="emit('page', currentPage + 1)">{{ english ? 'Next' : '下一页' }}</button>
    </nav>
    <p class="mh-timezone">{{ english ? `Times shown in ${timeZone || 'your local time zone'}.` : `时间按 ${timeZone || '当前设备时区'} 显示。` }}</p>
  </section>
</template>

<style scoped>
.mh-screen {
  --mh-accent: var(--m-accent, #cbb0ed);
  --mh-accent-ink: var(--m-accent-ink, #291d35);
  --mh-surface: var(--m-card-surface, #211b29);
  min-width: 0;
  color: var(--m-text, #f1ecf4);
}
.mh-screen * { box-sizing: border-box; }
.mh-heading { margin-bottom: 22px; }
.mh-heading h1 { margin: 0 0 10px; font-family: var(--m-body-font, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif); font-size: 25px; font-weight: 600; line-height: 1.4; letter-spacing: -.025em; }
.mh-description { max-width: 36em; margin: 0; color: var(--m-muted, #b6a8c6); font-size: 14px; line-height: 1.75; }
.mh-screen :where(button, input, select) { font: inherit; }
.mh-screen button { touch-action: manipulation; cursor: pointer; -webkit-tap-highlight-color: transparent; }
.mh-screen button:disabled { cursor: not-allowed; opacity: .45; }
.mh-screen :is(button, input, select):focus-visible { outline: 2px solid var(--mh-accent); outline-offset: 4px; }
.mh-search { display: flex; align-items: stretch; gap: 10px; min-width: 0; }
.mh-search-field { flex: 1; min-width: 0; display: flex; align-items: center; gap: 10px; padding-left: 14px; border: 1px solid var(--m-line, #cbb0ed2b); border-radius: 12px; background: var(--m-bg, #151019); color: var(--m-muted, #b6a8c6); }
.mh-search-field svg { flex-shrink: 0; }
.mh-search input { width: 100%; min-width: 0; min-height: 48px; padding: 12px 10px 12px 0; border: 0; border-radius: inherit; background: transparent; color: var(--m-text, #f1ecf4); font-size: 16px; line-height: 1.4; }
.mh-search input::placeholder { color: var(--m-muted, #b6a8c6); opacity: .9; }
.mh-search input::-webkit-search-cancel-button { display: none; }
.mh-search-submit { flex-shrink: 0; min-width: 66px; min-height: 48px; padding: 10px 15px; border: 0; border-radius: 12px; background: var(--mh-accent); color: var(--mh-accent-ink); font-size: 14px; font-weight: 600; }
.mh-filters { margin-top: 16px; }
.mh-filters fieldset { min-width: 0; margin: 0; padding: 12px 14px 8px; border: 1px solid var(--m-line, #cbb0ed2b); border-radius: 16px; }
.mh-filters legend { padding: 0 6px; color: var(--m-text, #f1ecf4); font-size: 13px; }
.mh-filter-applied { margin-left: 9px; color: var(--mh-accent); font-size: 11px; }
.mh-filters label { display: grid; min-width: 0; gap: 6px; color: var(--m-muted, #b6a8c6); font-size: 12px; }
.mh-filters :is(input, select) { width: 100%; min-width: 0; max-width: 100%; min-height: 44px; padding: 9px; border: 1px solid var(--m-line, #cbb0ed2b); border-radius: 9px; background: var(--m-bg, #151019); color: var(--m-text, #f1ecf4); font-size: 14px; color-scheme: dark; }
.mh-filters input[type="date"] { -webkit-appearance: none; appearance: none; }
.mh-filter-dates { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 10px; margin-top: 12px; }
.mh-filter-actions { display: flex; align-items: center; justify-content: flex-end; flex-wrap: wrap; gap: 12px; margin-top: 8px; }
.mh-filter-actions .mh-secondary { border-color: var(--mh-accent); color: var(--mh-accent); }
.mh-filter-actions .mh-text-button { padding-inline: 4px; color: var(--m-muted, #b6a8c6); }
.mh-filter-error { margin: 10px 0 0; color: #f2d3c9; font-size: 13px; line-height: 1.6; overflow-wrap: anywhere; }
.mh-list-meta { display: flex; align-items: center; justify-content: space-between; gap: 10px; min-height: 48px; margin: 5px 0 8px; }
.mh-list-meta p { margin: 0; color: var(--m-muted, #b6a8c6); font-size: 13px; }
.mh-text-button { min-height: 44px; padding: 9px 0 9px 10px; border: 0; background: transparent; color: var(--mh-accent); font-size: 14px; }
.mh-error { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; padding: 15px; border: 1px solid #ecc1b14d; border-radius: 18px; background: #513a3b55; }
.mh-error p { flex: 1; min-width: min(100%, 170px); margin: 0; color: #f2d3c9; overflow-wrap: anywhere; font-size: 14px; line-height: 1.6; }
.mh-secondary { display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-height: 44px; min-width: 0; padding: 10px 14px; border: 1px solid var(--m-line, #cbb0ed2b); border-radius: 12px; background: transparent; color: var(--m-text, #f1ecf4); font-size: 14px; line-height: 1.4; }
.mh-initial-loading { display: flex; align-items: center; justify-content: center; gap: 10px; min-height: 230px; color: var(--m-muted, #b6a8c6); font-size: 14px; }
.mh-refreshing { margin: 0 0 12px; color: var(--mh-accent); font-size: 13px; }
.mh-spin { animation: mh-spin 1.3s linear infinite; }
.mh-list { display: grid; gap: 14px; margin: 0; padding: 0; list-style: none; }
.mh-card { min-width: 0; overflow: hidden; border: 1px solid var(--m-line, #cbb0ed2b); border-radius: 20px; background: var(--mh-surface); }
.mh-entry-main { display: grid; width: 100%; gap: 14px; min-width: 0; padding: 17px 17px 10px; border: 0; border-radius: 19px 19px 0 0; background: transparent; color: inherit; text-align: left; transition: background-color .16s; }
.mh-entry-heading { display: grid; grid-template-columns: 36px minmax(0, 1fr) auto; align-items: center; gap: 9px; min-width: 0; }
.mh-entry-icon { display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 50%; background: var(--mh-accent); color: var(--mh-accent-ink); }
.mh-entry-type { min-width: 0; color: var(--m-muted, #b6a8c6); font-size: 12px; line-height: 1.5; overflow-wrap: anywhere; }
.mh-date { max-width: 128px; color: var(--m-muted, #b6a8c6); font-size: 11px; line-height: 1.5; text-align: right; overflow-wrap: anywhere; }
.mh-entry-body { display: flex; align-items: center; gap: 13px; min-width: 0; }
.mh-reader-identity { display: flex; align-items: center; gap: 8px; min-width: 0; color: var(--m-muted, #b6a8c6); font-size: 12px; line-height: 1.6; }
.mh-reader-identity > span:last-child { min-width: 0; overflow-wrap: anywhere; }
.mh-question { flex: 1; min-width: 0; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; color: var(--m-text, #f1ecf4); font-size: 17px; font-weight: 500; line-height: 1.6; overflow-wrap: anywhere; white-space: pre-line; }
.mh-open-label { flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center; gap: 3px; max-width: 43%; min-height: 44px; padding: 10px 12px; border-radius: 12px; background: var(--m-bg, #151019); color: var(--m-text, #f1ecf4); font-size: 14px; font-weight: 500; line-height: 1.45; }
.mh-open-label svg { flex-shrink: 0; }
.mh-entry-footer { display: flex; align-items: center; justify-content: space-between; gap: 10px; min-height: 48px; margin: 0 17px; padding-bottom: 5px; }
.mh-followups { display: inline-flex; align-items: center; gap: 7px; min-width: 0; padding: 8px 0; color: var(--m-muted, #b6a8c6); font-size: 12px; line-height: 1.5; overflow-wrap: anywhere; }
.mh-followups svg { flex-shrink: 0; }
.mh-followups > span { min-width: 0; }
.mh-delete { flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-width: 58px; min-height: 44px; padding: 10px 0 10px 8px; border: 0; background: transparent; color: var(--m-muted, #b6a8c6); font-size: 14px; }
.mh-empty { padding: 38px 18px; border: 1px solid var(--m-line, #cbb0ed2b); border-radius: 20px; background: var(--mh-surface); text-align: center; }
.mh-empty-title { margin: 0 0 10px; color: var(--m-text, #f1ecf4); font-size: 18px; line-height: 1.6; }
.mh-empty > p:not(.mh-empty-title) { max-width: 28em; margin: 0 auto 20px; color: var(--m-muted, #b6a8c6); font-size: 14px; line-height: 1.8; }
.mh-pagination { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: center; gap: 14px; margin-top: 20px; }
.mh-pagination span { color: var(--m-text, #f1ecf4); font-size: 14px; text-align: center; font-variant-numeric: tabular-nums; }
.mh-timezone { margin: 15px 0 0; color: var(--m-muted, #b6a8c6); font-size: 11px; line-height: 1.7; text-align: center; overflow-wrap: anywhere; }
.mh-sr-only { position: absolute; width: 1px; height: 1px; padding: 0; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
@keyframes mh-spin { to { transform: rotate(360deg); } }
@media (hover: hover) { .mh-entry-main:hover { background: #cbb0ed08; } .mh-delete:hover { color: #f3c7cf; } .mh-secondary:hover { background: #cbb0ed0a; } }
@media (max-width: 360px) {
  .mh-heading { margin-bottom: 18px; }
  .mh-search { gap: 8px; }
  .mh-search-submit { min-width: 60px; padding-inline: 11px; }
  .mh-search-field { gap: 7px; padding-left: 11px; }
  .mh-entry-main { gap: 12px; padding-inline: 14px; }
  .mh-entry-heading { grid-template-columns: 34px minmax(0, 1fr); gap: 3px 9px; }
  .mh-entry-icon { grid-row: span 2; width: 34px; height: 34px; }
  .mh-date { grid-column: 2; max-width: none; text-align: left; }
  .mh-entry-body { display: grid; gap: 10px; }
  .mh-question { font-size: 16px; }
  .mh-open-label { justify-self: start; max-width: 100%; min-height: 44px; }
  .mh-entry-footer { margin-inline: 14px; }
  .mh-pagination { gap: 9px; }
  .mh-pagination .mh-secondary { padding-inline: 9px; }
}
@media (prefers-reduced-motion: reduce) { .mh-spin { animation: none; } .mh-entry-main { transition: none; } }
</style>
