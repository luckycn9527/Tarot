<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useReadingHistory, type ReadingHistoryEntry } from '../composables/useReadingHistory'
import { useAuth } from '../composables/useAuth'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useToast } from '../composables/useToast'

const route = useRoute()
const router = useRouter()
const { t, tm, locale } = useI18n()
const { isLoggedIn, isInitialized } = useAuth()
const { fetchHistory, deleteReading } = useReadingHistory()
const toast = useToast()

const entries = ref<ReadingHistoryEntry[]>([])
const currentPage = ref(1)
const totalPages = ref(0)
const total = ref(0)
const loading = ref(false)

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

async function loadData(page = 1, force = false) {
  loading.value = true
  try {
    const result = await fetchHistory({
      page,
      limit: 10,
      type: typeFilter.value || undefined,
      search: searchQuery.value || undefined,
      dateFrom: dateFrom.value || undefined,
      dateTo: dateTo.value || undefined,
    }, force)
    entries.value = result.items
    currentPage.value = result.page
    totalPages.value = result.totalPages
    total.value = result.total
  } finally {
    loading.value = false
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
  <div class="min-h-screen bg-gradient-to-b from-void via-obsidian to-void pt-20 pb-12 px-4">
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
            <option value="daily-fortune">{{ typeLabel('daily-fortune') }}</option>
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

      <!-- Results -->
      <div v-if="loading" class="text-center py-12 text-gray-400">{{ t('pages.history.loading') }}</div>

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
          :key="entry.id"
          class="card-panel p-4 hover:border-gold-500/20 transition-colors"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-2">
                <span class="px-2 py-0.5 rounded-full text-xs" :class="typeColors[entry.type] || 'bg-gray-500/20 text-gray-300'">
                  {{ typeLabel(entry.type) }}
                </span>
                <span class="text-gray-500 text-xs">{{ formatDate(entry.createdAt) }}</span>
              </div>
              <p v-if="entry.question" class="text-white text-sm mb-1 truncate">{{ entry.question }}</p>
              <p v-if="entry.answer" class="text-gray-400 text-xs">{{ t('pages.history.answerPrefix') }}{{ entry.answer }}</p>
              <p v-if="entry.type === 'reader-reading' && entry.readerId" class="text-gray-400 text-xs">
                {{ t('pages.history.readerPrefix') }}{{ readerLabel(entry.readerId) }}
                <span v-if="resultSummary(entry.resultData)"> · {{ resultSummary(entry.resultData) }}</span>
              </p>
            </div>
            <button
              class="text-gray-500 hover:text-red-400 transition-colors p-1"
              :title="t('pages.history.deleteTitle')"
              @click="handleDelete(entry.id)"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
            </button>
          </div>
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
