<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { getCardImageUrl, tarotCards } from '../data/tarotCards'
import { fetchSharedReading, type SharedReading } from '../services/readingShares'

const route = useRoute()
const { locale } = useI18n()
const loading = ref(true)
const error = ref(false)
const reading = ref<SharedReading | null>(null)

const isZh = computed(() => String(locale.value).toLowerCase().startsWith('zh'))
const copy = computed(() => isZh.value ? {
  eyebrow: '来自 E塔罗 的公开解读',
  title: '一份塔罗解读',
  question: '占卜问题',
  cards: '抽到的牌',
  upright: '正位',
  reversed: '逆位',
  interpretation: '解读',
  advice: '建议',
  conclusion: '结论',
  summary: '总结',
  answer: '答案',
  views: '次浏览',
  cta: '开始我的占卜',
  unavailable: '这份分享不存在或已被撤销',
  unavailableHint: '你仍然可以回到 E塔罗，开始一段属于自己的解读。',
  retry: '重新加载',
} : {
  eyebrow: 'A public reading from E-Tarot',
  title: 'A Tarot Reading',
  question: 'The question',
  cards: 'Cards drawn',
  upright: 'Upright',
  reversed: 'Reversed',
  interpretation: 'Interpretation',
  advice: 'Advice',
  conclusion: 'Conclusion',
  summary: 'Summary',
  answer: 'Answer',
  views: 'views',
  cta: 'Start my reading',
  unavailable: 'This share is unavailable or has been revoked',
  unavailableHint: 'You can still return to E-Tarot and begin a reading of your own.',
  retry: 'Try again',
})

const typeLabel = computed(() => {
  const type = reading.value?.type
  const labels = isZh.value
    ? { single: '单牌解读', 'three-card': '三牌解读', 'daily-fortune': '每日运势', 'reader-reading': '塔罗师解读' }
    : { single: 'Single-card reading', 'three-card': 'Three-card reading', 'daily-fortune': 'Daily reading', 'reader-reading': 'Tarot reader session' }
  return type ? labels[type as keyof typeof labels] || type : ''
})

const cards = computed(() => (reading.value?.cardIds || []).map((id, index) => {
  const card = tarotCards.find((item) => item.id === id) || tarotCards[id]
  const orientation = reading.value?.orientations?.[index] || 'upright'
  return {
    id,
    card,
    orientation,
    name: card ? (isZh.value ? card.name : card.nameEn) : `${isZh.value ? '牌' : 'Card'} ${id + 1}`,
  }
}))

const result = computed<Record<string, unknown>>(() => {
  const value = reading.value?.resultData
  return value && typeof value === 'object' ? value as Record<string, unknown> : {}
})

const messages = computed(() => {
  const value = result.value.messages
  if (!Array.isArray(value)) return []
  return value
    .map((item) => item && typeof item === 'object' ? (item as Record<string, unknown>).content : '')
    .filter((item): item is string => typeof item === 'string' && item.length > 0)
})

function resultField(key: string): string {
  const value = result.value[key]
  return typeof value === 'string' ? value : ''
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(String(locale.value), {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

async function loadReading() {
  const code = typeof route.params.code === 'string' ? route.params.code : ''
  loading.value = true
  error.value = false
  try {
    reading.value = await fetchSharedReading(code)
  } catch {
    reading.value = null
    error.value = true
  } finally {
    loading.value = false
  }
}

onMounted(loadReading)
</script>

<template>
  <main class="relative z-10 min-h-screen bg-gradient-to-b from-void via-obsidian to-void px-4 pb-20 pt-24">
    <div v-if="loading" class="mx-auto max-w-3xl py-24 text-center text-sm text-gray-400">
      <span class="mx-auto mb-4 block h-7 w-7 animate-spin rounded-full border-2 border-gold-500/20 border-t-gold-300" />
    </div>

    <section v-else-if="error || !reading" class="card-glass mx-auto max-w-xl px-6 py-14 text-center">
      <div class="mb-5 text-4xl text-gold-300/70">✦</div>
      <h1 class="font-serif text-2xl text-white">{{ copy.unavailable }}</h1>
      <p class="mx-auto mt-3 max-w-md text-sm leading-7 text-gray-400">{{ copy.unavailableHint }}</p>
      <div class="mt-8 flex flex-wrap justify-center gap-3">
        <button class="rounded-full border border-white/10 px-5 py-2.5 text-sm text-gray-300 hover:border-gold-500/30" @click="loadReading">
          {{ copy.retry }}
        </button>
        <RouterLink to="/tarot" class="cta-button rounded-full px-5 py-2.5 text-sm font-medium text-white">
          {{ copy.cta }}
        </RouterLink>
      </div>
    </section>

    <article v-else class="mx-auto max-w-3xl">
      <header class="mb-8 text-center">
        <p class="mb-3 text-[11px] uppercase tracking-[0.28em] text-gold-400/65">{{ copy.eyebrow }}</p>
        <h1 class="font-serif text-3xl text-white sm:text-4xl">{{ typeLabel || copy.title }}</h1>
        <div class="mt-3 flex items-center justify-center gap-2 text-xs text-gray-500">
          <span>{{ formatDate(reading.readingDate) }}</span>
          <span>·</span>
          <span>{{ reading.viewCount }} {{ copy.views }}</span>
        </div>
      </header>

      <section v-if="reading.question" class="card-glass mb-5 p-5 sm:p-6">
        <p class="mb-2 text-[11px] uppercase tracking-[0.2em] text-gold-400/55">{{ copy.question }}</p>
        <p class="font-serif text-lg leading-8 text-gold-50">{{ reading.question }}</p>
      </section>

      <section v-if="cards.length" class="card-glass mb-5 p-5 sm:p-6">
        <p class="mb-5 text-[11px] uppercase tracking-[0.2em] text-gold-400/55">{{ copy.cards }}</p>
        <div class="grid gap-4" :class="cards.length > 1 ? 'grid-cols-2 sm:grid-cols-3' : 'mx-auto max-w-[180px] grid-cols-1'">
          <div v-for="item in cards" :key="`${item.id}-${item.orientation}`" class="text-center">
            <div class="mx-auto aspect-[2/3] overflow-hidden rounded-xl border border-gold-500/15 bg-black/25 shadow-lg shadow-black/30">
              <img
                v-if="item.card"
                :src="getCardImageUrl(item.card.nameEn, item.card)"
                :alt="item.name"
                class="h-full w-full object-cover"
                :class="item.orientation === 'reversed' ? 'rotate-180' : ''"
              />
            </div>
            <p class="mt-2 text-sm text-gray-200">{{ item.name }}</p>
            <p class="mt-0.5 text-[11px]" :class="item.orientation === 'reversed' ? 'text-violet-300/70' : 'text-gold-400/65'">
              {{ item.orientation === 'reversed' ? copy.reversed : copy.upright }}
            </p>
          </div>
        </div>
      </section>

      <section class="card-glass space-y-5 p-5 sm:p-7">
        <template v-if="messages.length">
          <p v-for="(message, index) in messages" :key="index" class="whitespace-pre-wrap text-sm leading-7 text-gray-300">{{ message }}</p>
        </template>
        <div v-if="resultField('interpretation')">
          <p class="mb-2 text-[11px] uppercase tracking-[0.2em] text-gray-500">{{ copy.interpretation }}</p>
          <p class="whitespace-pre-wrap text-sm leading-7 text-gray-300">{{ resultField('interpretation') }}</p>
        </div>
        <div v-if="resultField('advice')">
          <p class="mb-2 text-[11px] uppercase tracking-[0.2em] text-gray-500">{{ copy.advice }}</p>
          <p class="whitespace-pre-wrap text-sm leading-7 text-gray-300">{{ resultField('advice') }}</p>
        </div>
        <div v-if="resultField('conclusion')">
          <p class="mb-2 text-[11px] uppercase tracking-[0.2em] text-gray-500">{{ copy.conclusion }}</p>
          <p class="whitespace-pre-wrap text-sm leading-7 text-gray-300">{{ resultField('conclusion') }}</p>
        </div>
        <div v-if="resultField('summary')" class="rounded-xl border border-gold-500/15 bg-gold-500/[0.05] p-4">
          <p class="mb-2 text-[11px] uppercase tracking-[0.2em] text-gold-400/55">{{ copy.summary }}</p>
          <p class="whitespace-pre-wrap text-sm leading-7 text-gold-50/90">{{ resultField('summary') }}</p>
        </div>
        <div v-if="reading.answer && !messages.length && !resultField('interpretation')">
          <p class="mb-2 text-[11px] uppercase tracking-[0.2em] text-gray-500">{{ copy.answer }}</p>
          <p class="whitespace-pre-wrap text-sm leading-7 text-gray-300">{{ reading.answer }}</p>
        </div>
      </section>

      <div class="mt-8 text-center">
        <RouterLink to="/tarot" class="cta-button inline-block rounded-full px-7 py-3 text-sm font-medium text-white shadow-lg shadow-gold-500/10">
          {{ copy.cta }}
        </RouterLink>
      </div>
    </article>
  </main>
</template>
