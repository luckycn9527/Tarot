<script setup lang="ts">
import { ref, watch, computed, nextTick } from 'vue'
import { useReadingHistory, type ReadingHistoryEntry } from '../composables/useReadingHistory'
import { askReaderFollowUp } from '../services/tarotAiReading'
import { useAuth } from '../composables/useAuth'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useToast } from '../composables/useToast'

const route = useRoute()
const router = useRouter()
const { t, tm, locale } = useI18n()
const { isLoggedIn, isInitialized } = useAuth()
const { fetchHistory, deleteReading, setOutcome, fetchInsights } = useReadingHistory()
const toast = useToast()

const entries = ref<ReadingHistoryEntry[]>([])
const currentPage = ref(1)
const totalPages = ref(0)
const total = ref(0)
const loading = ref(false)
const loadError = ref(false)

// 筛选
const searchQuery = ref('')
const typeFilter = ref('')
const dateFrom = ref('')
const dateTo = ref('')

const typeLabels = computed(() => tm('pages.history.typeLabels') as Record<string, string>)

const typeColors: Record<string, string> = {
  'single': 'bg-gold-500/10 text-gold-300',
  'three-card': 'bg-blue-500/20 text-blue-300',
  'daily-fortune': 'bg-amber-500/20 text-amber-300',
  'reader-reading': 'bg-pink-500/20 text-pink-300',
}

const readerNames = computed(() => tm('pages.history.readerNames') as Record<string, string>)

let loadSeq = 0

async function loadData(page = 1, force = false) {
  const seq = ++loadSeq
  // 仅在还没有任何内容时显示整页 loading，避免重载时把已渲染列表替换成 loading 造成闪烁
  if (entries.value.length === 0) loading.value = true
  loadError.value = false
  try {
    const result = await fetchHistory({
      page,
      limit: 10,
      type: typeFilter.value || undefined,
      search: searchQuery.value || undefined,
      dateFrom: dateFrom.value || undefined,
      dateTo: dateTo.value || undefined,
    }, force)
    // 竞态防护：只有最新一次请求可写入状态，过期响应直接丢弃
    if (seq !== loadSeq) return
    entries.value = Array.isArray(result.items) ? result.items : []
    currentPage.value = result.page
    totalPages.value = result.totalPages
    total.value = result.total
    // 首页有数据时加载 AI 分析（store 自身按天缓存）
    if (result.page === 1 && entries.value.length > 0) void loadInsights()
  } catch {
    if (seq !== loadSeq) return
    // 出错时若已有内容则保留，不清空，避免"闪一下消失"
    if (entries.value.length === 0) {
      loadError.value = true
      total.value = 0
      totalPages.value = 0
    }
    toast.error(t('pages.history.loadFailed'))
  } finally {
    if (seq === loadSeq) loading.value = false
  }
}

function handleSearch() {
  loadData(1, true)
}

function resetFilters() {
  searchQuery.value = ''
  typeFilter.value = ''
  dateFrom.value = ''
  dateTo.value = ''
  loadData(1, true)
}

async function handleDelete(id: number) {
  if (!confirm(t('pages.history.deleteConfirm'))) return
  try {
    await deleteReading(id)
    toast.success(t('pages.history.deleted'))
    loadData(currentPage.value)
  } catch {
    toast.error(t('pages.history.deleteFailed'))
  }
}

function resultSummary(data: unknown): string {
  if (data && typeof data === 'object' && 'summary' in data) {
    const s = (data as { summary: unknown }).summary
    return typeof s === 'string' ? s : ''
  }
  return ''
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString(String(locale.value), {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

function typeLabel(type: string) {
  return typeLabels.value[type] || type
}

function readerLabel(id: string) {
  return readerNames.value[id] || id
}

/** 提取一条记录的「当时建议」：reader-reading 用 summary，单/三卡用 advice，回退到 answer */
function adviceOf(entry: ReadingHistoryEntry): string {
  const d = entry.resultData as Record<string, unknown> | null
  if (d && typeof d === 'object') {
    const advice = typeof d.advice === 'string' ? d.advice : ''
    const summary = typeof d.summary === 'string' ? d.summary : ''
    const conclusion = typeof d.conclusion === 'string' ? d.conclusion : ''
    const pick = advice || summary || conclusion
    if (pick) return pick
  }
  return entry.answer || ''
}

/** 提取一条记录的应验评分 */
function outcomeOf(entry: ReadingHistoryEntry): 'full' | 'partial' | 'none' | null {
  const d = entry.resultData as { outcome?: { rating?: string } } | null
  const r = d?.outcome?.rating
  return r === 'full' || r === 'partial' || r === 'none' ? r : null
}

/** 回访复盘：基于最近一条「有问题」的记录，且仅在首页无筛选时展示 */
const noFilterActive = computed(
  () => !searchQuery.value && !typeFilter.value && !dateFrom.value && !dateTo.value,
)
const followUp = computed(() => {
  if (currentPage.value !== 1 || !noFilterActive.value) return null
  const last = entries.value.find((e) => e.question && e.question.trim())
  if (!last) return null
  const days = Math.max(0, Math.floor((Date.now() - new Date(last.createdAt).getTime()) / 86400000))
  const advice = adviceOf(last)
  // 次日提醒：记录不是「今天」创建的才提示评分
  const isPastDay = new Date(last.createdAt).toDateString() !== new Date().toDateString()
  return {
    id: last.id,
    days,
    question: last.question,
    advice: advice.length > 60 ? advice.slice(0, 60) + '…' : advice,
    type: last.type,
    readerId: last.readerId,
    rating: outcomeOf(last),
    isPastDay,
    entry: last,
  }
})

/** 提交应验评分 */
const ratingLoading = ref(false)
async function rateOutcome(rating: 'full' | 'partial' | 'none') {
  const fu = followUp.value
  if (!fu || ratingLoading.value) return
  ratingLoading.value = true
  try {
    await setOutcome(fu.id, rating)
    // 本地同步，避免重拉
    const d = (fu.entry.resultData ?? {}) as { outcome?: { rating: string; at: string } }
    d.outcome = { rating, at: new Date().toISOString() }
    fu.entry.resultData = d
    toast.success(t('pages.history.outcome.thanks'))
  } catch {
    toast.error(t('pages.history.outcome.fail'))
  } finally {
    ratingLoading.value = false
  }
}

/* ——— AI 历史分析 ——— */
interface InsightItem { category: string; count: number; percent: number }
const insights = ref<{ rangeMonths: number; total: number; distribution: InsightItem[]; coreTheme: string } | null>(null)
const insightsLoading = ref(false)
const catColors: Record<string, string> = {
  事业: '#D4AF37', 财富: '#FBBF24', 感情: '#E879F9', 健康: '#34D399', 人际: '#60A5FA', 抉择: '#A78BFA', 其他: '#94A3B8',
}
async function loadInsights() {
  if (insightsLoading.value) return
  insightsLoading.value = true
  try {
    insights.value = await fetchInsights()
  } catch {
    insights.value = null
  } finally {
    insightsLoading.value = false
  }
}

/** 回访 CTA：展开最近一条记录详情；reader-reading 可直接在详情里反馈追问 */
function followUpAgain() {
  const last = entries.value.find((e) => e.question && e.question.trim())
  if (!last) return
  expandedId.value = last.id
  void nextTick(() => {
    document.getElementById('hist-entry-' + last.id)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  })
}

/* ——— 详情展开 + 追问/反馈 ——— */
const expandedId = ref<number | null>(null)
const followupInput = ref('')
const followupLoading = ref(false)

function toggleDetail(id: number) {
  expandedId.value = expandedId.value === id ? null : id
  followupInput.value = ''
}

interface ReaderMsg { type: string; content: string }
interface FollowupTurn { question: string; answer: string; at?: string }

/** reader-reading 解读正文（messages 拼接） */
function readingMessages(entry: ReadingHistoryEntry): ReaderMsg[] {
  const d = entry.resultData as { messages?: unknown } | null
  if (d && Array.isArray(d.messages)) {
    return (d.messages as ReaderMsg[]).filter((m) => m && typeof m.content === 'string')
  }
  return []
}
function readingSummary(entry: ReadingHistoryEntry): string {
  const d = entry.resultData as { summary?: unknown } | null
  return d && typeof d.summary === 'string' ? d.summary : ''
}
/** 单/三卡详情字段 */
function readingField(entry: ReadingHistoryEntry, key: 'interpretation' | 'advice' | 'conclusion'): string {
  const d = entry.resultData as Record<string, unknown> | null
  return d && typeof d[key] === 'string' ? (d[key] as string) : ''
}
/** 已记录的追问/反馈轮次 */
function entryFollowups(entry: ReadingHistoryEntry): FollowupTurn[] {
  const d = entry.resultData as { followups?: unknown } | null
  if (d && Array.isArray(d.followups)) {
    return (d.followups as FollowupTurn[]).filter((f) => f && typeof f.question === 'string' && typeof f.answer === 'string')
  }
  return []
}

async function submitFollowup(entry: ReadingHistoryEntry) {
  const q = followupInput.value.trim()
  if (followupLoading.value) return
  if (q.length < 2) { toast.error(t('pages.history.detail.followupMin')); return }
  if (q.length > 200) { toast.error(t('pages.history.detail.followupMax')); return }
  followupLoading.value = true
  try {
    const prior = entryFollowups(entry).map((f) => ({ question: f.question, answer: f.answer }))
    const data = await askReaderFollowUp({ readingId: entry.id, question: q, priorTurns: prior })
    // 后端已持久化；本地同步追加，避免重新拉取
    const d = (entry.resultData ?? {}) as { followups?: FollowupTurn[] }
    if (!Array.isArray(d.followups)) d.followups = []
    d.followups.push({ question: q, answer: data.answer, at: new Date().toISOString() })
    entry.resultData = d
    followupInput.value = ''
  } catch (err: unknown) {
    const ax = err as { response?: { status?: number; data?: { message?: string } }; message?: string }
    if (ax.response?.status === 401) {
      toast.error(t('pages.history.detail.loginRequired'))
      void router.replace({ path: '/login', query: { redirect: route.fullPath } })
    } else {
      toast.error(ax.response?.data?.message || ax.message || t('pages.history.detail.followupFail'))
    }
  } finally {
    followupLoading.value = false
  }
}

watch(
  [isInitialized, isLoggedIn],
  ([init, logged]) => {
    if (!init) return
    if (!logged) {
      void router.replace({ path: '/login', query: { redirect: route.fullPath } })
      return
    }
    void loadData()
  },
  { immediate: true },
)
</script>

<template>
  <div class="relative z-10 min-h-screen bg-gradient-to-b from-void via-obsidian to-void pt-20 pb-12 px-4">
    <div class="max-w-4xl mx-auto">
      <!-- Header -->
      <div class="text-center mb-8">
        <h1 class="text-2xl font-bold font-serif text-white mb-2">{{ t('pages.history.title') }}</h1>
        <p class="text-gray-400 text-sm">{{ t('pages.history.subtitle') }}</p>
      </div>

      <!-- Filters -->
      <div class="card-glass p-4 mb-6 space-y-3">
        <div class="flex flex-col sm:flex-row gap-3">
          <input
            v-model="searchQuery"
            type="text"
            :placeholder="t('pages.history.searchPlaceholder')"
            class="flex-1 px-4 py-2.5 rounded-xl bg-white/4 border border-gold-500/10 text-white placeholder-gray-500 text-sm focus:border-gold-400 focus:outline-none"
            @keyup.enter="handleSearch"
          />
          <select
            v-model="typeFilter"
            class="px-4 py-2.5 rounded-xl bg-white/4 border border-gold-500/10 text-gray-300 text-sm focus:border-gold-400 focus:outline-none"
          >
            <option value="">{{ t('pages.history.typeAll') }}</option>
            <option value="single">{{ typeLabel('single') }}</option>
            <option value="three-card">{{ typeLabel('three-card') }}</option>
            <option value="reader-reading">{{ typeLabel('reader-reading') }}</option>
          </select>
        </div>
        <div class="flex flex-col sm:flex-row gap-3">
          <div class="flex items-center gap-2 flex-1">
            <span class="text-gray-400 text-sm whitespace-nowrap">{{ t('pages.history.dateFrom') }}</span>
            <input
              v-model="dateFrom"
              type="date"
              class="flex-1 px-3 py-2 rounded-xl bg-white/4 border border-gold-500/10 text-gray-300 text-sm focus:border-gold-400 focus:outline-none"
            />
          </div>
          <div class="flex items-center gap-2 flex-1">
            <span class="text-gray-400 text-sm whitespace-nowrap">{{ t('pages.history.dateTo') }}</span>
            <input
              v-model="dateTo"
              type="date"
              class="flex-1 px-3 py-2 rounded-xl bg-white/4 border border-gold-500/10 text-gray-300 text-sm focus:border-gold-400 focus:outline-none"
            />
          </div>
          <div class="flex gap-2">
            <button
              class="px-4 py-2 rounded-xl bg-gradient-to-r from-gold-500 to-gold-600 text-abyss text-sm font-medium transition-colors hover:shadow-lg hover:shadow-gold-500/25"
              @click="handleSearch"
            >
              {{ t('pages.history.search') }}
            </button>
            <button
              class="px-4 py-2 rounded-xl bg-white/4 hover:bg-white/10 text-gray-300 text-sm transition-colors"
              @click="resetFilters"
            >
              {{ t('pages.history.reset') }}
            </button>
          </div>
        </div>
      </div>

      <!-- 回访复盘卡：用户回来时的温柔提醒 -->
      <div
        v-if="followUp"
        class="follow-up-card relative overflow-hidden rounded-2xl border border-gold-500/25 bg-gradient-to-br from-gold-500/[0.08] to-violet-500/[0.05] p-5 sm:p-6 mb-6"
      >
        <div class="flex items-start gap-4">
          <div class="shrink-0 flex h-11 w-11 items-center justify-center rounded-full bg-gold-500/15 ring-1 ring-gold-400/30 text-gold-300">
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-gold-200 font-serif text-base sm:text-lg mb-3">
              {{ t('pages.history.followUp.title', { days: followUp.days }) }}
            </p>
            <div class="space-y-1.5 text-sm">
              <p class="text-gray-300">
                <span class="text-gray-500">{{ t('pages.history.followUp.lastQuestion') }}</span>
                {{ followUp.question }}
              </p>
              <p v-if="followUp.advice" class="text-gray-300">
                <span class="text-gray-500">{{ t('pages.history.followUp.lastAdvice') }}</span>
                {{ followUp.advice }}
              </p>
            </div>

            <!-- 次日提醒：应验程度评分 -->
            <div v-if="followUp.isPastDay" class="mt-4">
              <p class="text-gold-300/90 text-sm mb-2">{{ t('pages.history.outcome.question') }}</p>
              <div v-if="followUp.rating" class="text-sm text-emerald-300/90">
                {{ t('pages.history.outcome.recorded') }}「{{ t('pages.history.outcome.' + followUp.rating) }}」
              </div>
              <div v-else class="flex flex-wrap gap-2">
                <button
                  v-for="opt in (['full','partial','none'] as const)"
                  :key="opt"
                  type="button"
                  :disabled="ratingLoading"
                  class="px-3.5 py-1.5 rounded-full border border-gold-500/25 bg-white/4 text-gray-200 text-sm hover:border-gold-400/60 hover:bg-gold-500/10 transition-colors cursor-pointer disabled:opacity-50"
                  @click="rateOutcome(opt)"
                >
                  {{ t('pages.history.outcome.' + opt) }}
                </button>
              </div>
            </div>

            <div class="mt-4 flex flex-wrap items-center gap-3">
              <p class="text-gold-300/90 text-sm">{{ t('pages.history.followUp.prompt') }}</p>
              <button
                type="button"
                class="px-4 py-1.5 rounded-full bg-gradient-to-r from-gold-500 to-gold-600 text-abyss text-sm font-medium hover:shadow-lg hover:shadow-gold-500/25 transition-all cursor-pointer"
                @click="followUpAgain"
              >
                {{ t('pages.history.followUp.cta') }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- AI 历史分析卡 -->
      <div
        v-if="insights && insights.total > 0 && noFilterActive && currentPage === 1"
        class="relative overflow-hidden rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-500/[0.07] to-gold-500/[0.04] p-5 sm:p-6 mb-6"
      >
        <div class="flex items-center gap-2 mb-4">
          <svg class="w-4 h-4 text-violet-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 3v18h18" stroke-linecap="round"/><path d="M7 14l4-4 3 3 5-6" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <h3 class="text-violet-100 font-serif text-base">{{ t('pages.history.insights.title', { months: insights.rangeMonths }) }}</h3>
        </div>
        <div class="space-y-2.5">
          <div v-for="(d, di) in insights.distribution.slice(0, 5)" :key="d.category" class="flex items-center gap-3">
            <span class="w-12 shrink-0 text-sm" :class="di === 0 ? 'text-gold-200 font-medium' : 'text-gray-400'">{{ d.category }}</span>
            <div class="flex-1 h-2.5 rounded-full bg-white/[0.06] overflow-hidden">
              <div class="h-full rounded-full transition-all duration-700" :style="{ width: d.percent + '%', background: catColors[d.category] || '#94A3B8' }" />
            </div>
            <span class="w-10 shrink-0 text-right text-sm tabular-nums" :class="di === 0 ? 'text-gold-200' : 'text-gray-500'">{{ d.percent }}%</span>
          </div>
        </div>
        <div v-if="insights.coreTheme" class="mt-5 flex items-center gap-2 rounded-xl border border-gold-500/20 bg-gold-500/[0.06] px-4 py-3">
          <span class="text-[11px] tracking-widest text-gold-500/60 shrink-0">{{ t('pages.history.insights.coreTheme') }}</span>
          <span class="text-gold-100 font-medium">{{ insights.coreTheme }}</span>
        </div>
      </div>

      <!-- Results -->
      <div v-if="loading" class="text-center py-12 text-gray-400">{{ t('pages.history.loading') }}</div>

      <div v-else-if="loadError" class="text-center py-16">
        <p class="text-5xl mb-4">⚠️</p>
        <p class="text-gray-400 mb-4">{{ t('pages.history.loadFailed') }}</p>
        <button
          class="inline-block px-6 py-2 rounded-full cta-button text-white text-sm font-medium hover:shadow-lg hover:shadow-gold-500/25 transition-all"
          @click="loadData(currentPage, true)"
        >
          {{ t('pages.history.retry') }}
        </button>
      </div>

      <div v-else-if="entries.length === 0" class="text-center py-16">
        <p class="text-5xl mb-4">🔮</p>
        <p class="text-gray-400">{{ t('pages.history.empty') }}</p>
        <RouterLink to="/yes-no-tarot" class="inline-block mt-4 px-6 py-2 rounded-full cta-button text-white text-sm font-medium hover:shadow-lg hover:shadow-gold-500/25 transition-all">
          {{ t('pages.history.ctaRead') }}
        </RouterLink>
      </div>

      <div v-else class="space-y-3">
        <div class="text-sm text-gray-400 mb-2">{{ t('pages.history.total', { count: total }) }}</div>

        <div
          v-for="entry in entries"
          :id="'hist-entry-' + entry.id"
          :key="entry.id"
          class="card-panel p-4 transition-colors"
          :class="expandedId === entry.id ? 'border-gold-500/30' : 'hover:border-gold-500/20'"
        >
          <div class="flex items-start justify-between gap-3">
            <button type="button" class="flex-1 min-w-0 text-left cursor-pointer" @click="toggleDetail(entry.id)">
              <div class="flex items-center gap-2 mb-2">
                <span class="px-2 py-0.5 rounded-full text-xs" :class="typeColors[entry.type] || 'bg-gray-500/20 text-gray-300'">
                  {{ typeLabel(entry.type) }}
                </span>
                <span class="text-gray-500 text-xs">{{ formatDate(entry.createdAt) }}</span>
                <svg class="w-3.5 h-3.5 text-gray-500 transition-transform duration-300" :class="expandedId === entry.id ? 'rotate-180' : ''" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </div>
              <p v-if="entry.question" class="text-white text-sm mb-1" :class="expandedId === entry.id ? '' : 'truncate'">{{ entry.question }}</p>
              <p v-if="entry.answer && expandedId !== entry.id" class="text-gray-400 text-xs truncate">{{ t('pages.history.answerPrefix') }}{{ entry.answer }}</p>
              <p v-if="entry.type === 'reader-reading' && entry.readerId" class="text-gray-400 text-xs">
                {{ t('pages.history.readerPrefix') }}{{ readerLabel(entry.readerId) }}
                <span v-if="resultSummary(entry.resultData) && expandedId !== entry.id"> · {{ resultSummary(entry.resultData) }}</span>
              </p>
            </button>
            <button
              class="text-gray-500 hover:text-red-400 transition-colors p-1 shrink-0"
              :title="t('pages.history.deleteTitle')"
              @click="handleDelete(entry.id)"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
            </button>
          </div>

          <!-- 详情展开 -->
          <Transition name="fade">
            <div v-if="expandedId === entry.id" class="mt-4 pt-4 border-t border-white/[0.06] space-y-4">
              <!-- reader-reading：解读对话 + 摘要 -->
              <template v-if="entry.type === 'reader-reading'">
                <div v-for="(m, mi) in readingMessages(entry)" :key="'m'+mi" class="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{{ m.content }}</div>
                <div v-if="readingSummary(entry)" class="rounded-xl border border-gold-500/15 bg-gold-500/[0.05] p-3">
                  <p class="text-[11px] tracking-widest text-gold-500/60 mb-1">{{ t('pages.history.detail.summary') }}</p>
                  <p class="text-sm text-gold-100/90 leading-relaxed whitespace-pre-wrap">{{ readingSummary(entry) }}</p>
                </div>
              </template>
              <!-- single / three-card：解读 / 建议 / 结论 -->
              <template v-else>
                <div v-if="readingField(entry, 'interpretation')">
                  <p class="text-[11px] tracking-widest text-gray-500 mb-1">{{ t('pages.history.detail.interpretation') }}</p>
                  <p class="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{{ readingField(entry, 'interpretation') }}</p>
                </div>
                <div v-if="readingField(entry, 'advice')">
                  <p class="text-[11px] tracking-widest text-gray-500 mb-1">{{ t('pages.history.detail.advice') }}</p>
                  <p class="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{{ readingField(entry, 'advice') }}</p>
                </div>
                <div v-if="readingField(entry, 'conclusion')">
                  <p class="text-[11px] tracking-widest text-gray-500 mb-1">{{ t('pages.history.detail.conclusion') }}</p>
                  <p class="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{{ readingField(entry, 'conclusion') }}</p>
                </div>
              </template>

              <!-- 已记录的追问/反馈 -->
              <div v-if="entryFollowups(entry).length" class="space-y-3 pt-2 border-t border-white/[0.06]">
                <p class="text-[11px] tracking-widest text-violet-300/60">{{ t('pages.history.detail.followupHistory') }}</p>
                <div v-for="(f, fi) in entryFollowups(entry)" :key="'f'+fi" class="space-y-1.5">
                  <p class="text-sm text-gold-100/90"><span class="text-gray-500">{{ t('pages.history.detail.youAsked') }}</span>{{ f.question }}</p>
                  <p class="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap pl-3 border-l-2 border-violet-500/30">{{ f.answer }}</p>
                </div>
              </div>

              <!-- 反馈/追问输入（仅塔罗师占卜支持基于上下文的追问） -->
              <div v-if="entry.type === 'reader-reading'" class="pt-2">
                <p class="text-xs text-gray-500 mb-2">{{ t('pages.history.detail.followupHint') }}</p>
                <div class="flex items-end gap-2 rounded-2xl bg-white/4 border border-gold-500/15 p-2 focus-within:border-gold-500/40 transition-colors">
                  <textarea
                    v-model="followupInput"
                    rows="1"
                    maxlength="200"
                    :placeholder="t('pages.history.detail.followupPlaceholder')"
                    class="flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-gray-200 placeholder:text-gray-600 outline-none"
                    :disabled="followupLoading"
                    @keydown.enter.exact.prevent="submitFollowup(entry)"
                  />
                  <button
                    type="button"
                    class="cursor-pointer shrink-0 w-9 h-9 rounded-full flex items-center justify-center bg-gold-500/30 border border-gold-500/30 text-gold-100 hover:bg-gold-500/45 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    :disabled="followupLoading || followupInput.trim().length < 2"
                    :aria-label="t('pages.history.detail.send')"
                    @click="submitFollowup(entry)"
                  >
                    <svg v-if="!followupLoading" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    <span v-else class="w-4 h-4 border-2 border-gold-200/40 border-t-gold-100 rounded-full animate-spin" />
                  </button>
                </div>
              </div>
            </div>
          </Transition>
        </div>

        <!-- Pagination -->
        <div v-if="totalPages > 1" class="flex justify-center items-center gap-2 mt-6">
          <button
            :disabled="currentPage <= 1"
            class="px-3 py-1.5 rounded-lg text-sm transition-colors"
            :class="currentPage <= 1 ? 'text-gray-600 cursor-not-allowed' : 'text-gray-300 hover:bg-white/4'"
            @click="loadData(currentPage - 1)"
          >
            {{ t('pages.history.prev') }}
          </button>
          <span class="text-gray-400 text-sm">{{ currentPage }} / {{ totalPages }}</span>
          <button
            :disabled="currentPage >= totalPages"
            class="px-3 py-1.5 rounded-lg text-sm transition-colors"
            :class="currentPage >= totalPages ? 'text-gray-600 cursor-not-allowed' : 'text-gray-300 hover:bg-white/4'"
            @click="loadData(currentPage + 1)"
          >
            {{ t('pages.history.next') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active { transition: opacity 0.25s ease; }
.fade-enter-from,
.fade-leave-to { opacity: 0; }
</style>
