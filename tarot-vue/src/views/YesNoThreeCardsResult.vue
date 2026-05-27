<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useToast } from '../composables/useToast'
import { tarotCards, getCardImageUrl } from '../data/tarotCards'
import { type ThreeCardReadingResult } from '../data/tarotReadings'
import { generateAiThreeCardReading } from '../services/tarotAiReading'
import { useCardBack } from '../composables/useCardBack'
import TarotCard3D from '../components/TarotCard3D.vue'
import RitualLoader from '../components/RitualLoader.vue'
import { sanitizeInput } from '../utils/sanitize'
import { StorageKeys, storageGetRaw, storageRemoveRawAndLegacy, storageSet } from '@/utils/storage'

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

const ritualMessages = computed(() => tm('pages.yesNoThreeResult.ritualMessages') as string[])

const positionLabels = computed(() => {
  const rows = tm('pages.yesNoThree.positions') as { name: string }[]
  return rows.map(r => r.name)
})
const positionColors = ['text-green-400', 'text-red-400', 'text-gold-300']

const cards = computed(() =>
  selectedCards.value.map((idx, i) => {
    const orientation = orientations.value[i] ? t('pages.dailyFortune.reversed') : t('pages.dailyFortune.upright')
    return {
      data: tarotCards[idx],
      isReversed: orientations.value[i],
      imageUrl: getCardImageUrl(tarotCards[idx].nameEn),
      displayName: t('pages.yesNoThreeResult.orientationPair', { name: tarotCards[idx].name, orientation }),
    }
  }),
)

onMounted(() => {
  void loadCardBack(true)
  const q = storageGetRaw(StorageKeys.YES_NO_USER_Q, 'userQuestion')
  if (!q) {
    router.replace('/yes-no-tarot/three-cards')
    return
  }
  question.value = sanitizeInput(q)

  const cachedResult = storageGetRaw(StorageKeys.YES_NO_THREE_RESULT, 'threeCardReadingResult')
  const cachedCards = storageGetRaw(StorageKeys.YES_NO_THREE_CARDS, 'threeCardSelectedCards')
  const cachedOrientations = storageGetRaw(StorageKeys.YES_NO_THREE_ORIENTS, 'threeCardOrientations')

  if (cachedResult && cachedCards && cachedOrientations) {
    selectedCards.value = JSON.parse(cachedCards)
    orientations.value = JSON.parse(cachedOrientations)
    flippedCards.value = [true, true, true]
    allFlipped.value = true
    readingResult.value = JSON.parse(cachedResult)
    showResult.value = true
  } else {
    selectRandomCards()
  }
})

function selectRandomCards() {
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
  const cardPairs = selectedCards.value.map((idx, i) => ({
    card: tarotCards[idx],
    isReversed: orientations.value[i],
  }))

  try {
    const result = await generateAiThreeCardReading(cardPairs, question.value)

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
      toast.error(t('pages.yesNoThreeResult.toastLoginRequired'))
      void router.replace({ path: '/login', query: { redirect: route.fullPath } })
    } else if (ax.response?.status === 429) {
      toast.error(t('pages.yesNoThreeResult.toastQuota'))
    } else {
      toast.error(ax.response?.data?.message || ax.message || t('pages.yesNoThreeResult.toastFailed'))
    }
  } finally {
    isLoading.value = false
  }
}

function startOver() {
  storageRemoveRawAndLegacy(StorageKeys.YES_NO_THREE_RESULT, 'threeCardReadingResult')
  storageRemoveRawAndLegacy(StorageKeys.YES_NO_THREE_CARDS, 'threeCardSelectedCards')
  storageRemoveRawAndLegacy(StorageKeys.YES_NO_THREE_ORIENTS, 'threeCardOrientations')
  storageRemoveRawAndLegacy(StorageKeys.YES_NO_USER_Q, 'userQuestion')
  router.push('/yes-no-tarot/three-cards')
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

function answerLooksYes(answer: string) {
  return answer.includes('是') || /\byes\b/i.test(answer)
}
function answerLooksNo(answer: string) {
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
