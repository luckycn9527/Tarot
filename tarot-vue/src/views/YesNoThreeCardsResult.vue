<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useToast } from '../composables/useToast'
import { tarotCards, getCardImageUrl } from '../data/tarotCards'
import { generateThreeCardReading, type ThreeCardReadingResult } from '../data/tarotReadings'
import { generateAiThreeCardReading } from '../services/tarotAiReading'
import { useCardBack } from '../composables/useCardBack'
import TarotCard3D from '../components/TarotCard3D.vue'
import RitualLoader from '../components/RitualLoader.vue'
import { sanitizeStoredInput } from '../utils/sanitize'
import { StorageKeys, storageGetJson, storageRemoveRawAndLegacy, storageSet } from '@/utils/storage'

const route = useRoute()
const router = useRouter()
const { t, tm, te } = useI18n()
const toast = useToast()
const { loadCardBack, cardBackUrl } = useCardBack()

const question = ref('')
const selectedCards = ref<number[]>([])
const orientations = ref<boolean[]>([])
const flippedCards = ref<boolean[]>([false, false, false])
const allFlipped = ref(false)
const isLoading = ref(false)
const loadingProgress = ref(0)
const readingResult = ref<ThreeCardReadingResult | null>(null)
const showResult = ref(false)
const readingError = ref('')

const ritualMessages = computed(() => tm('pages.yesNoThreeResult.ritualMessages') as string[])

const positionLabels = computed(() => {
  const rows = tm('pages.yesNoThree.positions') as { name: string }[]
  return rows.map(r => r.name)
})
const positionColors = ['text-green-400', 'text-red-400', 'text-gold-300']
const threeCardLevels: ThreeCardReadingResult['level'][] = [
  'definite-yes',
  'likely-yes',
  'conditional',
  'likely-no',
  'definite-no',
]
const answerColorMap: Record<ThreeCardReadingResult['level'], string> = {
  'definite-yes': 'text-green-400',
  'likely-yes': 'text-emerald-400',
  conditional: 'text-yellow-400',
  'likely-no': 'text-orange-400',
  'definite-no': 'text-red-400',
}
const confidenceMap: Record<ThreeCardReadingResult['level'], string> = {
  'definite-yes': '非常高',
  'likely-yes': '较高',
  conditional: '中等',
  'likely-no': '较高',
  'definite-no': '非常高',
}

const cards = computed(() =>
  selectedCards.value.flatMap((idx, i) => {
    const card = tarotCards[idx]
    if (!card) return []
    const orientation = orientations.value[i] ? t('pages.dailyFortune.reversed') : t('pages.dailyFortune.upright')
    return [{
      data: card,
      isReversed: orientations.value[i],
      imageUrl: getCardImageUrl(card.nameEn, card),
      displayName: t('pages.yesNoThreeResult.orientationPair', { name: card.name, orientation }),
    }]
  }),
)

onMounted(() => {
  void loadCardBack(true)
  const storedQuestion = sanitizeStoredInput(StorageKeys.YES_NO_USER_Q, 'userQuestion')
  if (!storedQuestion) {
    router.replace('/yes-no-tarot/three-cards')
    return
  }
  question.value = storedQuestion

  if (!hydrateCachedReading()) {
    selectRandomCards()
  }
})

function selectRandomCards() {
  showResult.value = false
  readingResult.value = null
  readingError.value = ''
  flippedCards.value = [false, false, false]
  allFlipped.value = false
  isLoading.value = false
  selectedCards.value = []
  orientations.value = []

  if (tarotCards.length < 3) {
    const message = String(t('pages.yesNoThreeResult.toastDeckFailed'))
    readingError.value = message
    toast.error(message)
    return
  }

  const indices = new Set<number>()
  while (indices.size < 3) {
    indices.add(Math.floor(Math.random() * tarotCards.length))
  }
  selectedCards.value = [...indices]
  orientations.value = [Math.random() < 0.5, Math.random() < 0.5, Math.random() < 0.5]
}

function flipCard(index: number) {
  if (flippedCards.value[index] || allFlipped.value) return

  const expected = flippedCards.value.filter(Boolean).length
  if (index !== expected) return

  flippedCards.value[index] = true

  if (flippedCards.value.every(Boolean)) {
    setTimeout(() => {
      allFlipped.value = true
      startReading()
    }, 600)
  }
}

function startReading() {
  if (isLoading.value) return
  if (!buildCardPairs()) {
    clearThreeCardCache()
    const message = String(t('pages.yesNoThreeResult.toastDeckFailed'))
    readingError.value = message
    toast.error(message)
    selectRandomCards()
    return
  }

  readingError.value = ''
  isLoading.value = true
  loadingProgress.value = 0

  // 模拟进度（前80%匀速推进，后20%等待AI实际返回）
  const interval = 80
  let progress = 0
  const timer = setInterval(() => {
    progress += 1
    if (progress <= 80) {
      loadingProgress.value = progress
    }
  }, interval)

  finishReading().finally(() => {
    clearInterval(timer)
  })
}

async function finishReading() {
  const cardPairs = buildCardPairs()
  if (!cardPairs) {
    readingError.value = String(t('pages.yesNoThreeResult.toastDeckFailed'))
    isLoading.value = false
    return
  }

  try {
    const rawResult = await generateAiThreeCardReading(cardPairs, question.value)
    const fallback = generateThreeCardReading(cardPairs, question.value)
    const result = normalizeReadingResult(rawResult, fallback) ?? fallback

    loadingProgress.value = 100
    readingResult.value = result

    storageSet(StorageKeys.YES_NO_THREE_RESULT, JSON.stringify(result))
    storageSet(StorageKeys.YES_NO_THREE_CARDS, JSON.stringify(selectedCards.value))
    storageSet(StorageKeys.YES_NO_THREE_ORIENTS, JSON.stringify(orientations.value))

    await new Promise(resolve => setTimeout(resolve, 300))
    showResult.value = true
  } catch (err: unknown) {
    const ax = err as { response?: { status: number; data?: { message?: string } }; message?: string }
    if (ax.response?.status === 401) {
      const message = String(t('pages.yesNoThreeResult.toastLoginRequired'))
      readingError.value = message
      toast.error(message)
      void router.replace({ path: '/login', query: { redirect: route.fullPath } })
    } else if (ax.response?.status === 429) {
      const message = String(t('pages.yesNoThreeResult.toastQuota'))
      readingError.value = message
      toast.error(message)
    } else {
      const message = ax.response?.data?.message || ax.message || String(t('pages.yesNoThreeResult.toastFailed'))
      readingError.value = message
      toast.error(message)
    }
  } finally {
    isLoading.value = false
  }
}

function clearThreeCardCache() {
  storageRemoveRawAndLegacy(StorageKeys.YES_NO_THREE_RESULT, 'threeCardReadingResult')
  storageRemoveRawAndLegacy(StorageKeys.YES_NO_THREE_CARDS, 'threeCardSelectedCards')
  storageRemoveRawAndLegacy(StorageKeys.YES_NO_THREE_ORIENTS, 'threeCardOrientations')
}

function startOver() {
  clearThreeCardCache()
  storageRemoveRawAndLegacy(StorageKeys.YES_NO_USER_Q, 'userQuestion')
  router.push('/yes-no-tarot/three-cards')
}

function retryReading() {
  if (isLoading.value) return
  showResult.value = false
  readingResult.value = null
  startReading()
}

function hydrateCachedReading() {
  const cachedCards = storageGetJson<unknown>(StorageKeys.YES_NO_THREE_CARDS, 'threeCardSelectedCards')
  const cachedOrientations = storageGetJson<unknown>(StorageKeys.YES_NO_THREE_ORIENTS, 'threeCardOrientations')
  const cachedResult = storageGetJson<unknown>(StorageKeys.YES_NO_THREE_RESULT, 'threeCardReadingResult')

  if (!isValidCardIndexes(cachedCards) || !isValidOrientations(cachedOrientations) || cachedResult == null) {
    clearThreeCardCache()
    return false
  }

  selectedCards.value = cachedCards
  orientations.value = cachedOrientations

  const cardPairs = buildCardPairs()
  if (!cardPairs) {
    clearThreeCardCache()
    return false
  }

  const normalized = normalizeReadingResult(cachedResult, generateThreeCardReading(cardPairs, question.value))
  if (!normalized) {
    clearThreeCardCache()
    return false
  }

  flippedCards.value = [true, true, true]
  allFlipped.value = true
  readingResult.value = normalized
  showResult.value = true
  readingError.value = ''
  return true
}

function buildCardPairs() {
  if (!isValidCardIndexes(selectedCards.value) || !isValidOrientations(orientations.value)) return null
  return selectedCards.value.map((idx, i) => ({
    card: tarotCards[idx],
    isReversed: orientations.value[i],
  }))
}

function isValidCardIndexes(value: unknown): value is number[] {
  return Array.isArray(value)
    && value.length === 3
    && value.every(idx => Number.isInteger(idx) && idx >= 0 && idx < tarotCards.length && tarotCards[idx])
}

function isValidOrientations(value: unknown): value is boolean[] {
  return Array.isArray(value) && value.length === 3 && value.every(item => typeof item === 'boolean')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readString(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function normalizeLevel(value: unknown, answer: unknown, fallback: ThreeCardReadingResult['level']) {
  if (typeof value === 'string' && threeCardLevels.includes(value as ThreeCardReadingResult['level'])) {
    return value as ThreeCardReadingResult['level']
  }

  const answerText = typeof answer === 'string' ? answer : ''
  if (answerText.includes('明确') && answerText.includes('是')) return 'definite-yes'
  if (answerText.includes('可能') && answerText.includes('是')) return 'likely-yes'
  if (answerText.includes('明确') && answerText.includes('否')) return 'definite-no'
  if (answerText.includes('可能') && answerText.includes('否')) return 'likely-no'
  if (answerText.includes('否')) return 'likely-no'
  if (answerText.includes('是')) return 'likely-yes'
  return fallback
}

function normalizeReadingResult(value: unknown, fallback: ThreeCardReadingResult): ThreeCardReadingResult | null {
  if (!isRecord(value)) return null

  const level = normalizeLevel(value.level, value.answer, fallback.level)
  const rawCardReadings = Array.isArray(value.cardReadings) ? value.cardReadings : []
  const cardReadings = fallback.cardReadings.map((fallbackReading, i) => {
    const raw = rawCardReadings[i]
    if (!isRecord(raw)) return fallbackReading
    return { summary: readString(raw.summary, fallbackReading.summary) }
  })

  return {
    answer: readString(value.answer, fallback.answer),
    answerColor: answerColorMap[level],
    confidence: readString(value.confidence, confidenceMap[level]),
    level,
    interpretation: readString(value.interpretation, fallback.interpretation),
    advice: readString(value.advice, fallback.advice),
    conclusion: readString(value.conclusion, fallback.conclusion),
    cardReadings,
  }
}

function getLevelBadge(level: string) {
  const tk = `pages.yesNoThreeResult.levels.${level}`
  const label = te(tk) ? String(t(tk)) : t('pages.yesNoThreeResult.levels.pending')
  switch (level) {
    case 'definite-yes': return { text: label, bg: 'bg-green-500/20', color: 'text-green-400' }
    case 'likely-yes': return { text: label, bg: 'bg-emerald-500/20', color: 'text-emerald-400' }
    case 'conditional': return { text: label, bg: 'bg-yellow-500/20', color: 'text-yellow-400' }
    case 'likely-no': return { text: label, bg: 'bg-orange-500/20', color: 'text-orange-400' }
    case 'definite-no': return { text: label, bg: 'bg-red-500/20', color: 'text-red-400' }
    default: return { text: label, bg: 'bg-gray-500/20', color: 'text-gray-400' }
  }
}

function answerLooksYes(answer: string | undefined) {
  if (!answer) return false
  return answer.includes('是') || /\byes\b/i.test(answer)
}
function answerLooksNo(answer: string | undefined) {
  if (!answer) return false
  return answer.includes('否') || /\bno\b/i.test(answer)
}
</script>

<template>
  <div class="relative z-10">
    <section class="w-full flex flex-col items-center justify-center px-4 pt-24 pb-4 text-center">
      <div class="animate-fade-in-up">
        <h1 class="text-2xl sm:text-3xl font-bold font-serif text-gold-200 mb-2">{{ t('pages.yesNoThreeResult.heroTitle') }}</h1>
        <p class="text-gray-400 text-sm max-w-xl">「{{ question }}」</p>
      </div>
    </section>

    <!-- Three Cards Area -->
    <section class="w-full flex flex-col items-center justify-center px-4 py-8">
      <div class="flex gap-3 sm:gap-6 items-end">
        <div v-for="(card, i) in cards" :key="i" class="flex flex-col items-center">
          <!-- Position Label -->
          <p class="text-xs sm:text-sm font-semibold mb-2" :class="positionColors[i]">{{ positionLabels[i] }}</p>

          <!-- Card -->
          <TarotCard3D
            :card-image-url="card.imageUrl || undefined"
            :card-back-url="cardBackUrl"
            :is-reversed="card.isReversed"
            :is-flipped="flippedCards[i]"
            :clickable="!allFlipped && !flippedCards[i] && i === flippedCards.filter(Boolean).length"
            size="sm"
            @flip="() => flipCard(i)"
          />

          <!-- Card Name -->
          <p v-if="flippedCards[i]" class="mt-2 text-gold-200 font-serif text-xs sm:text-sm font-semibold text-center max-w-[100px] sm:max-w-[160px]">
            {{ card.displayName }}
          </p>
        </div>
      </div>

      <!-- Flip Instructions -->
      <p v-if="!allFlipped" class="mt-6 text-gray-400 text-sm animate-pulse">
        {{
          flippedCards.filter(Boolean).length === 0
            ? t('pages.yesNoThreeResult.flipFirst')
            : t('pages.yesNoThreeResult.flipNth', { n: flippedCards.filter(Boolean).length + 1 })
        }}
      </p>
    </section>

    <!-- Loading Progress -->
    <section v-if="isLoading" class="w-full max-w-md mx-auto px-4 py-4">
      <div class="card-glass p-6 text-center">
        <RitualLoader :progress="Math.min(loadingProgress, 100)" :messages="ritualMessages" />
      </div>
    </section>

    <!-- Error Recovery -->
    <section v-if="readingError && !isLoading && !showResult" class="w-full max-w-md mx-auto px-4 py-4">
      <div class="card-glass p-6 text-center space-y-4">
        <h3 class="text-gold-200 font-serif font-semibold">{{ t('pages.yesNoThreeResult.errorTitle') }}</h3>
        <p class="text-gray-400 text-sm leading-relaxed">{{ readingError }}</p>
        <div class="flex flex-col sm:flex-row gap-3">
          <button
            class="flex-1 py-3 rounded-full cta-button text-white font-semibold hover:shadow-lg hover:shadow-gold-500/20 transition-all"
            @click="retryReading"
          >
            {{ t('pages.yesNoThreeResult.retry') }}
          </button>
          <button
            class="flex-1 py-3 rounded-full border border-gold-500/15 text-gray-300 font-semibold hover:bg-gold-500/5 transition-all"
            @click="startOver"
          >
            {{ t('pages.yesNoThreeResult.again') }}
          </button>
        </div>
      </div>
    </section>

    <!-- Reading Result -->
    <section v-if="showResult && readingResult" class="w-full max-w-2xl mx-auto px-4 py-8 animate-fade-in-up">
      <div class="card-glass p-6 sm:p-8 space-y-6">
        <!-- Answer & Level Badge -->
        <div class="text-center">
          <div class="inline-block px-4 py-1 rounded-full text-xs font-semibold mb-4"
            :class="[getLevelBadge(readingResult.level).bg, getLevelBadge(readingResult.level).color]">
            {{ getLevelBadge(readingResult.level).text }}
          </div>
          <div
            class="inline-flex items-center justify-center w-auto px-8 h-20 rounded-full border-2 mb-4 mx-auto"
            :class="answerLooksYes(readingResult.answer) ? 'border-green-400/50' : answerLooksNo(readingResult.answer) ? 'border-red-400/50' : 'border-yellow-400/50'"
          >
            <span class="text-2xl sm:text-3xl font-bold font-serif" :class="readingResult.answerColor">
              {{ readingResult.answer }}
            </span>
          </div>
          <p class="text-gray-400 text-sm">{{ t('pages.yesNoThreeResult.confidence', { confidence: readingResult.confidence }) }}</p>
        </div>

        <!-- Per-card Readings -->
        <div class="space-y-3">
          <div v-for="(cr, i) in readingResult.cardReadings" :key="i"
            class="p-4 rounded-xl bg-white/3 border border-gold-500/10">
            <p class="text-gray-300 text-sm leading-relaxed">{{ cr.summary }}</p>
          </div>
        </div>

        <!-- Interpretation -->
        <div>
          <h3 class="text-gold-400 font-serif font-semibold mb-2">{{ t('pages.yesNoThreeResult.synthesis') }}</h3>
          <p class="text-gray-300 text-sm leading-relaxed whitespace-pre-line">{{ readingResult.interpretation }}</p>
        </div>

        <!-- Advice -->
        <div>
          <h3 class="text-gold-400 font-serif font-semibold mb-2">{{ t('pages.yesNoThreeResult.advice') }}</h3>
          <p class="text-gray-300 text-sm leading-relaxed">{{ readingResult.advice }}</p>
        </div>

        <!-- Conclusion -->
        <div class="border-t border-gold-500/10 pt-4">
          <p class="text-gray-400 text-sm italic">{{ readingResult.conclusion }}</p>
        </div>

        <!-- Actions -->
        <div class="flex flex-col sm:flex-row gap-3 pt-4">
          <button
            class="flex-1 py-3 rounded-full cta-button text-white font-semibold hover:shadow-lg hover:shadow-gold-500/20 transition-all"
            @click="startOver"
          >
            {{ t('pages.yesNoThreeResult.again') }}
          </button>
          <RouterLink
            to="/yes-no-tarot"
            class="flex-1 py-3 rounded-full border border-gold-500/15 text-gray-300 font-semibold hover:bg-gold-500/5 transition-all text-center"
          >
            {{ t('pages.yesNoThreeResult.backChoose') }}
          </RouterLink>
        </div>
      </div>
    </section>
  </div>
</template>
