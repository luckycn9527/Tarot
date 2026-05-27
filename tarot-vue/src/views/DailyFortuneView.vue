<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useToast } from '../composables/useToast'
import { useScrollReveal } from '../composables/useScrollReveal'
import { tarotCards, getCardImageUrl } from '../data/tarotCards'
import { generateAiDailyFortune } from '../services/tarotAiReading'
import { useCardBack } from '../composables/useCardBack'
import { useZodiac } from '../composables/useZodiac'
import { useDailyCache } from '../composables/useDailyCache'
import { useShuffle } from '../composables/useShuffle'
import TarotCard3D from '../components/TarotCard3D.vue'
import RitualLoader from '../components/RitualLoader.vue'
import FaqAccordion from '../components/FaqAccordion.vue'
import { StorageKeys, storageSet } from '@/utils/storage'

useScrollReveal()
const { loadCardBack, cardBackUrl } = useCardBack()
const { birthYear, birthMonth, birthDay, zodiacSign, loadFromStorage, onBirthdayChange, clearBirthday } = useZodiac()
const { hasDrawnToday, hasCachedResult, countdown, loadCache, saveDraw, saveFortune } = useDailyCache()
const { drawRandom } = useShuffle()

const route = useRoute()
const router = useRouter()
const { t, tm } = useI18n()
const toast = useToast()
const flipped = ref(false)
const loading = ref(false)
const loadingProgress = ref(0)
const showBirthdayPanel = ref(false)
const selectedCard = ref<typeof tarotCards[0] | null>(null)
const isReversed = ref(false)

const currentYear = new Date().getFullYear()
const yearOptions = Array.from({ length: 100 }, (_, idx) => currentYear - idx)
const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1)
const dayOptions = Array.from({ length: 31 }, (_, i) => i + 1)
const canFlip = computed(() => !flipped.value && !loading.value)

function handleCardFlip() {
  if (flipped.value || loading.value) return
  const drawn = drawRandom()
  selectedCard.value = drawn.card
  isReversed.value = drawn.isReversed
  flipped.value = true
  saveDraw(drawn.card.id, drawn.isReversed)
}

async function handleViewFortune() {
  if (!selectedCard.value) return

  const cache = loadCache()
  if (cache?.fortune) {
    storageSet(StorageKeys.DAILY_FORTUNE_RESULT, cache.fortune)
    router.push('/daily-fortune/result')
    return
  }

  loading.value = true
  loadingProgress.value = 0
  const progressInterval = setInterval(() => {
    if (loadingProgress.value < 90) {
      loadingProgress.value += Math.random() * 12
    }
  }, 600)

  try {
    const result = await generateAiDailyFortune(
      selectedCard.value,
      isReversed.value,
      zodiacSign.value || undefined
    )
    loadingProgress.value = 100
    const resultJson = JSON.stringify(result)
    saveFortune(selectedCard.value.id, isReversed.value, resultJson)
    storageSet(StorageKeys.DAILY_FORTUNE_RESULT, resultJson)
    setTimeout(() => { router.push('/daily-fortune/result') }, 300)
  } catch (err: unknown) {
    const ax = err as { response?: { status: number; data?: { message?: string } }; message?: string }
    if (ax.response?.status === 401) {
      toast.error(t('pages.dailyFortune.toastViewLogin'))
      void router.replace({ path: '/login', query: { redirect: route.fullPath } })
    } else if (ax.response?.status === 429) {
      toast.error(ax.response?.data?.message || t('pages.dailyFortune.toastQuota'))
    } else {
      toast.error(ax.response?.data?.message || ax.message || t('pages.dailyFortune.toastFailed'))
    }
  } finally {
    clearInterval(progressInterval)
    loading.value = false
  }
}

onMounted(() => {
  void loadCardBack(true)
  loadFromStorage()
  const cache = loadCache()
  if (cache) {
    hasDrawnToday.value = true
    selectedCard.value = tarotCards.find(card => card.id === cache.cardId) || tarotCards[cache.cardId]
    isReversed.value = cache.isReversed
    flipped.value = true
    hasCachedResult.value = !!cache.fortune
  }
})

const ritualMessages = computed(() => tm('pages.dailyFortune.ritualMessages') as string[])

const faqItems = computed(() => tm('pages.dailyFortune.faq') as { question: string; answer: string }[])
</script>

<template>
  <div class="relative z-10">
    <!-- Hero -->
    <section class="w-full flex flex-col items-center justify-center px-4 pt-24 pb-8 min-h-[85vh]">
      <div class="text-center mb-6 animate-fade-in-up">
        <h1 class="text-3xl sm:text-4xl md:text-5xl font-bold leading-tight mb-3 font-serif text-gold-200">
          {{ t('pages.dailyFortune.heroTitle') }}
        </h1>
        <p class="text-gray-500 text-sm">{{ t('pages.dailyFortune.heroSub') }}</p>

        <button
          class="mt-4 px-5 py-2 rounded-full bg-white/3 border border-gold-500/12 text-gray-400 text-sm hover:border-gold-500/20 transition-all"
          @click="showBirthdayPanel = !showBirthdayPanel"
        >
          {{ zodiacSign ? t('pages.dailyFortune.zodiacOk', { sign: zodiacSign }) : t('pages.dailyFortune.addBirth') }}
        </button>
      </div>

      <!-- Birthday Panel -->
      <div v-if="showBirthdayPanel" class="w-full max-w-sm mx-auto mb-8 p-5 card-glass animate-fade-in-up">
        <p class="text-gray-500 text-xs mb-3">{{ t('pages.dailyFortune.localHint') }}</p>
        <div class="grid grid-cols-3 gap-2 mb-3">
          <select
            v-model="birthYear"
            class="birth-native-select w-full min-w-0 px-3 py-2.5 rounded-lg border border-gold-500/15 text-sm focus:outline-none focus:border-gold-400/70 focus:ring-1 focus:ring-gold-500/25"
            @change="onBirthdayChange"
          >
            <option value="" disabled class="birth-native-option">{{ t('pages.dailyFortune.year') }}</option>
            <option v-for="year in yearOptions" :key="year" :value="String(year)" class="birth-native-option">{{ year }}</option>
          </select>
          <select
            v-model="birthMonth"
            class="birth-native-select w-full min-w-0 px-3 py-2.5 rounded-lg border border-gold-500/15 text-sm focus:outline-none focus:border-gold-400/70 focus:ring-1 focus:ring-gold-500/25"
            @change="onBirthdayChange"
          >
            <option value="" disabled class="birth-native-option">{{ t('pages.dailyFortune.month') }}</option>
            <option v-for="month in monthOptions" :key="month" :value="String(month)" class="birth-native-option">{{ t('pages.dailyFortune.monthOption', { n: month }) }}</option>
          </select>
          <select
            v-model="birthDay"
            class="birth-native-select w-full min-w-0 px-3 py-2.5 rounded-lg border border-gold-500/15 text-sm focus:outline-none focus:border-gold-400/70 focus:ring-1 focus:ring-gold-500/25"
            @change="onBirthdayChange"
          >
            <option value="" disabled class="birth-native-option">{{ t('pages.dailyFortune.day') }}</option>
            <option v-for="day in dayOptions" :key="day" :value="String(day)" class="birth-native-option">{{ t('pages.dailyFortune.dayOption', { n: day }) }}</option>
          </select>
        </div>
        <div class="flex items-center justify-between text-xs">
          <span v-if="zodiacSign" class="text-gold-400">{{ t('pages.dailyFortune.zodiacLine', { sign: zodiacSign }) }}</span>
          <span v-else class="text-gray-700">{{ t('pages.dailyFortune.pickFullDate') }}</span>
          <button v-if="birthYear || birthMonth || birthDay" class="text-gray-600 hover:text-red-400 transition-colors" @click="clearBirthday">{{ t('pages.dailyFortune.reset') }}</button>
        </div>
      </div>

      <!-- Already drawn -->
      <div v-if="hasDrawnToday && hasCachedResult" class="mb-6 px-4 py-2 rounded-full bg-gold-500/5 border border-gold-500/12 text-sm text-gold-300/80 animate-fade-in-up anim-delay-1">
        {{ t('pages.dailyFortune.drawnToday', { countdown }) }}
      </div>

      <!-- Card -->
      <div class="mb-8 animate-fade-in-up anim-delay-1">
        <TarotCard3D
          :card-image-url="selectedCard ? getCardImageUrl(selectedCard.nameEn) : undefined"
          :card-back-url="cardBackUrl"
          :is-reversed="isReversed"
          :is-flipped="flipped"
          :clickable="canFlip"
          @flip="handleCardFlip"
        />
      </div>

      <!-- Card name -->
      <div v-if="flipped && selectedCard" class="text-center mb-4 animate-fade-in-up">
        <p class="text-gold-200 font-serif font-bold text-lg">{{ selectedCard.name }}</p>
        <p class="text-gray-600 text-sm">{{ selectedCard.nameEn }} · {{ isReversed ? t('pages.dailyFortune.reversed') : t('pages.dailyFortune.upright') }}</p>
      </div>

      <!-- Action -->
      <div class="animate-fade-in-up anim-delay-2">
        <button
          v-if="!flipped"
          class="px-8 py-3 rounded-full text-white font-medium transition-all"
          :class="canFlip ? 'cta-button cursor-pointer' : 'bg-gray-800 text-gray-500 cursor-not-allowed'"
          @click="handleCardFlip"
        >
          {{ t('pages.dailyFortune.flip') }}
        </button>

        <div v-else-if="loading" class="text-center">
          <RitualLoader :progress="Math.min(loadingProgress, 100)" :messages="ritualMessages" />
        </div>

        <button
          v-else
          class="px-8 py-3 rounded-full cta-button text-white font-medium transition-all"
          @click="handleViewFortune"
        >
          {{ hasCachedResult ? t('pages.dailyFortune.viewFortune') : t('pages.dailyFortune.genFortune') }}
        </button>
      </div>
    </section>

    <!-- FAQ -->
    <section class="w-full max-w-3xl mx-auto px-4 py-12 reveal-on-scroll">
      <h2 class="text-xl font-serif text-gold-200 mb-5">{{ t('pages.dailyFortune.faqTitle') }}</h2>
      <FaqAccordion :items="faqItems" />
    </section>
  </div>
</template>

<style scoped>
/* 原生 select：暗色下拉与选项可读（Windows / Android / iOS 系统菜单差异大，用 color-scheme + option 底色兜底） */
.birth-native-select {
  color-scheme: dark;
  -webkit-appearance: none;
  appearance: none;
  background-color: rgba(12, 8, 22, 0.92);
  color: #e8e0d4;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23c4a35a' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.65rem center;
  background-size: 0.75rem;
  padding-right: 2rem;
}
.birth-native-select:focus {
  background-color: rgba(18, 12, 32, 0.95);
}
.birth-native-option {
  background-color: #0c0a14;
  color: #e8e0d4;
}
</style>
