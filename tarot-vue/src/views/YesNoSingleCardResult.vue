<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useToast } from '../composables/useToast'
import { tarotCards, getCardImageUrl } from '../data/tarotCards'
import { type ReadingResult } from '../data/tarotReadings'
import { generateAiSingleCardReading } from '../services/tarotAiReading'
import { useCardBack } from '../composables/useCardBack'
import { useShuffle } from '../composables/useShuffle'
import { sanitizeStoredInput } from '../utils/sanitize'
import { StorageKeys, storageGetRaw, storageRemoveRawAndLegacy, storageSet } from '@/utils/storage'
import TarotCard3D from '../components/TarotCard3D.vue'
import RitualLoader from '../components/RitualLoader.vue'

const route = useRoute()
const router = useRouter()
const { t, tm } = useI18n()
const toast = useToast()
const { loadCardBack, cardBackUrl } = useCardBack()
const { drawRandom } = useShuffle()

const question = ref('')
const selectedCard = ref<number | null>(null)
const isReversed = ref(false)
const isFlipped = ref(false)
const isLoading = ref(false)
const loadingProgress = ref(0)
const readingResult = ref<ReadingResult | null>(null)
const showResult = ref(false)

const cardData = computed(() =>
  selectedCard.value !== null ? tarotCards[selectedCard.value] : null
)
const cardImageUrl = computed(() =>
  cardData.value ? getCardImageUrl(cardData.value.nameEn) : ''
)
const cardDisplayName = computed(() => {
  if (!cardData.value) return ''
  const orientation = isReversed.value ? t('pages.dailyFortune.reversed') : t('pages.dailyFortune.upright')
  return t('pages.yesNoSingleResult.orientationPair', { name: cardData.value.name, orientation })
})

const ritualMessages = computed(() => tm('pages.yesNoSingleResult.ritualMessages') as string[])

function answerLooksYes(answer: string) {
  return answer.includes('是') || /\byes\b/i.test(answer)
}
function answerLooksNo(answer: string) {
  return answer.includes('否') || /\bno\b/i.test(answer)
}

onMounted(() => {
  void loadCardBack(true)
  const storedQuestion = sanitizeStoredInput(StorageKeys.YES_NO_USER_Q, 'userQuestion')
  if (!storedQuestion) {
    router.replace('/yes-no-tarot/single-card')
    return
  }
  question.value = storedQuestion

  const cachedResult = storageGetRaw(StorageKeys.YES_NO_SINGLE_RESULT, 'singleCardReadingResult')
  const cachedCard = storageGetRaw(StorageKeys.YES_NO_SINGLE_CARD, 'singleCardSelectedCard')
  const cachedOrientation = storageGetRaw(StorageKeys.YES_NO_SINGLE_ORIENT, 'singleCardOrientation')

  if (cachedResult && cachedCard) {
    selectedCard.value = parseInt(cachedCard)
    isReversed.value = cachedOrientation === 'true'
    isFlipped.value = true
    readingResult.value = JSON.parse(cachedResult)
    showResult.value = true
  }
})

function handleFlip() {
  if (isFlipped.value) return
  const drawn = drawRandom()
  selectedCard.value = tarotCards.indexOf(drawn.card)
  isReversed.value = drawn.isReversed
  isFlipped.value = true
  startReading()
}

function startReading() {
  isLoading.value = true
  loadingProgress.value = 0

  const timer = setInterval(() => {
    if (loadingProgress.value < 85) {
      loadingProgress.value += Math.random() * 10
    }
  }, 500)

  finishReading().finally(() => clearInterval(timer))
}

async function finishReading() {
  if (!cardData.value) return

  try {
    const result = await generateAiSingleCardReading(cardData.value, isReversed.value, question.value)
    loadingProgress.value = 100
    readingResult.value = result

    storageSet(StorageKeys.YES_NO_SINGLE_RESULT, JSON.stringify(result))
    storageSet(StorageKeys.YES_NO_SINGLE_CARD, String(selectedCard.value))
    storageSet(StorageKeys.YES_NO_SINGLE_ORIENT, String(isReversed.value))

    await new Promise(resolve => setTimeout(resolve, 400))
    showResult.value = true
  } catch (err: unknown) {
    const ax = err as { response?: { status: number; data?: { message?: string } }; message?: string }
    if (ax.response?.status === 401) {
      toast.error(t('pages.yesNoSingleResult.toastLoginRequired'))
      void router.replace({ path: '/login', query: { redirect: route.fullPath } })
    } else if (ax.response?.status === 429) {
      toast.error(t('pages.yesNoSingleResult.toastQuota'))
    } else {
      toast.error(ax.response?.data?.message || ax.message || t('pages.yesNoSingleResult.toastFailed'))
    }
  } finally {
    isLoading.value = false
  }
}

function startOver() {
  storageRemoveRawAndLegacy(StorageKeys.YES_NO_SINGLE_RESULT, 'singleCardReadingResult')
  storageRemoveRawAndLegacy(StorageKeys.YES_NO_SINGLE_CARD, 'singleCardSelectedCard')
  storageRemoveRawAndLegacy(StorageKeys.YES_NO_SINGLE_ORIENT, 'singleCardOrientation')
  storageRemoveRawAndLegacy(StorageKeys.YES_NO_USER_Q, 'userQuestion')
  router.push('/yes-no-tarot/single-card')
}
</script>

<template>
  <div class="relative z-10">
    <section class="w-full flex flex-col items-center justify-center px-4 pt-24 pb-4 text-center">
      <div class="animate-fade-in-up">
        <h1 class="text-2xl sm:text-3xl font-serif text-gold-200 mb-2">{{ t('pages.yesNoSingleResult.heroTitle') }}</h1>
        <p class="text-gray-500 text-sm max-w-xl">「{{ question }}」</p>
      </div>
    </section>

    <!-- Card Area -->
    <section class="w-full flex flex-col items-center justify-center px-4 py-8">
      <TarotCard3D
        :card-image-url="cardImageUrl || undefined"
        :card-back-url="cardBackUrl"
        :is-reversed="isReversed"
        :is-flipped="isFlipped"
        :clickable="!isFlipped"
        size="md"
        @flip="handleFlip"
      />

      <!-- Card Name -->
      <div v-if="isFlipped && cardData" class="mt-4 text-center animate-fade-in-up">
        <p class="text-gold-200 font-serif font-bold text-lg sm:text-xl">{{ cardDisplayName }}</p>
      </div>

      <!-- Flip Button -->
      <button
        v-if="!isFlipped"
        class="mt-8 px-8 py-3 rounded-full cta-button text-white font-semibold hover:shadow-lg hover:shadow-gold-500/20 transition-all animate-fade-in-up"
        @click="handleFlip"
      >
        {{ t('pages.yesNoSingleResult.flipCard') }}
      </button>
    </section>

    <!-- Loading -->
    <section v-if="isLoading" class="w-full max-w-md mx-auto px-4 py-4">
      <div class="card-glass p-6">
        <RitualLoader :progress="Math.min(loadingProgress, 100)" :messages="ritualMessages" />
      </div>
    </section>

    <!-- Reading Result -->
    <section v-if="showResult && readingResult" class="w-full max-w-2xl mx-auto px-4 py-8 animate-fade-in-up">
      <div class="card-glass p-6 sm:p-8 space-y-6">
        <!-- Answer -->
        <div class="text-center">
          <div
            class="inline-flex items-center justify-center w-24 h-24 rounded-full border-2 mb-4"
            :class="answerLooksYes(readingResult.answer) ? 'border-emerald-400/50' : answerLooksNo(readingResult.answer) ? 'border-red-400/50' : 'border-yellow-400/50'"
          >
            <span class="text-4xl font-bold font-serif" :class="readingResult.answerColor">
              {{ readingResult.answer }}
            </span>
          </div>
          <p class="text-gray-500 text-sm">{{ t('pages.yesNoSingleResult.confidence', { confidence: readingResult.confidence }) }}</p>
        </div>

        <!-- Interpretation -->
        <div>
          <h3 class="text-gold-400 font-serif font-semibold mb-2">{{ t('pages.yesNoSingleResult.interpret') }}</h3>
          <p class="text-gray-300 text-sm leading-relaxed whitespace-pre-line">{{ readingResult.interpretation }}</p>
        </div>

        <!-- Advice -->
        <div>
          <h3 class="text-gold-400 font-serif font-semibold mb-2">{{ t('pages.yesNoSingleResult.advice') }}</h3>
          <p class="text-gray-300 text-sm leading-relaxed">{{ readingResult.advice }}</p>
        </div>

        <!-- Conclusion -->
        <div class="border-t border-gold-500/10 pt-4">
          <p class="text-gray-500 text-sm italic">{{ readingResult.conclusion }}</p>
        </div>

        <!-- Actions -->
        <div class="flex flex-col sm:flex-row gap-3 pt-4">
          <button
            class="flex-1 py-3 rounded-full cta-button text-white font-semibold hover:shadow-lg hover:shadow-gold-500/20 transition-all"
            @click="startOver"
          >
            {{ t('pages.yesNoSingleResult.again') }}
          </button>
          <RouterLink
            to="/yes-no-tarot"
            class="flex-1 py-3 rounded-full border border-gold-500/15 text-gray-300 font-semibold hover:bg-gold-500/5 transition-all text-center"
          >
            {{ t('pages.yesNoSingleResult.backChoose') }}
          </RouterLink>
        </div>
      </div>
    </section>
  </div>
</template>
