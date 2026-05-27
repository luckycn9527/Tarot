<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useScrollReveal } from '../composables/useScrollReveal'
import { useDynamicSeoTitle } from '../composables/useDynamicSeoTitle'
import { getCardImageUrl } from '../data/tarotCards'
import type { DailyFortuneResult } from '../data/tarotReadings'
import StarRating from '../components/StarRating.vue'
import CtaSection from '../components/CtaSection.vue'
import { StorageKeys, storageGetRaw } from '@/utils/storage'

useScrollReveal()

const router = useRouter()
const { t, locale } = useI18n()
const fortune = ref<DailyFortuneResult | null>(null)

onMounted(() => {
  try {
    const raw = storageGetRaw(StorageKeys.DAILY_FORTUNE_RESULT, 'dailyFortuneResult')
    if (!raw) {
      router.replace('/daily-fortune')
      return
    }
    fortune.value = JSON.parse(raw)
  } catch {
    router.replace('/daily-fortune')
  }
})

useDynamicSeoTitle(computed(() =>
  fortune.value
    ? t('seo.dynamic.dailyFortuneResultTitle', { cardName: fortune.value.cardName })
    : null,
))

const todayStr = computed(() => {
  const d = new Date()
  return new Intl.DateTimeFormat(String(locale.value), {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(d)
})

interface FortuneSection {
  key: keyof DailyFortuneResult['sections']
  title: string
  emoji: string
  ratingKey?: keyof DailyFortuneResult['ratings']
}

const sectionDefs: Omit<FortuneSection, 'title'>[] = [
  { key: 'overall', emoji: '🌟', ratingKey: 'overall' },
  { key: 'love', emoji: '💕', ratingKey: 'love' },
  { key: 'career', emoji: '💼', ratingKey: 'career' },
  { key: 'wealth', emoji: '💰', ratingKey: 'wealth' },
  { key: 'health', emoji: '🌿', ratingKey: 'health' },
  { key: 'mystery', emoji: '🔮' },
]

const sections = computed((): FortuneSection[] =>
  sectionDefs.map(s => ({
    ...s,
    title: t(`pages.dailyFortuneResult.sectionTitles.${s.key}`),
  })),
)
</script>

<template>
  <div v-if="fortune" class="relative z-10">
    <!-- Header -->
    <section class="w-full flex flex-col items-center justify-center px-4 pt-24 pb-8 text-center">
      <div class="animate-fade-in-up">
        <h1 class="text-3xl sm:text-4xl font-bold font-serif mb-2">
          <span class="bg-gradient-to-r from-gold-300 via-ethereal to-gold-400 bg-clip-text text-transparent">{{ t('pages.dailyFortuneResult.pageTitle') }}</span>
        </h1>
        <p class="text-gray-400 text-sm">{{ todayStr }}</p>
      </div>
    </section>

    <!-- Card Display -->
    <section class="w-full max-w-4xl mx-auto px-4 pb-8">
      <div class="flex flex-col items-center animate-fade-in-up anim-delay-1">
        <div class="w-40 h-60 rounded-2xl overflow-hidden border-2 border-gold-500/40 bg-gradient-to-br from-obsidian/80 to-void p-2 mb-4">
          <img
            :src="getCardImageUrl(fortune.cardNameEn)"
            :alt="fortune.cardName"
            class="w-full h-full object-contain rounded-lg"
            :style="fortune.isReversed ? 'transform: rotate(180deg)' : ''"
          >
        </div>
        <h2 class="text-white font-bold font-serif text-xl">{{ fortune.cardName }}</h2>
        <p class="text-gray-400 text-sm">{{ fortune.cardNameEn }} · {{ fortune.isReversed ? t('pages.dailyFortune.reversed') : t('pages.dailyFortune.upright') }}</p>
      </div>
    </section>

    <!-- Intro -->
    <section class="w-full max-w-4xl mx-auto px-4 pb-8 animate-fade-in-up anim-delay-2">
      <div class="p-6 rounded-2xl bg-gradient-to-r from-gold-500/10 to-mystic/10 border border-gold-500/20">
        <p class="text-gray-300 text-sm leading-relaxed">{{ fortune.sections.intro }}</p>
      </div>
    </section>

    <!-- Fortune Sections -->
    <section class="w-full max-w-4xl mx-auto px-4 pb-8">
      <div class="space-y-6">
        <div
          v-for="(sec, i) in sections"
          :key="sec.key"
          class="p-6 rounded-2xl card-panel border border-gold-500/10 reveal-on-scroll"
        >
          <div
            class="flex flex-col gap-4"
            :class="i % 2 === 0 ? 'sm:flex-row' : 'sm:flex-row-reverse'"
          >
            <!-- Emoji illustration -->
            <div class="sm:w-32 h-28 sm:h-auto rounded-xl bg-gradient-to-br from-gold-500/10 to-obsidian/40 flex items-center justify-center shrink-0 border border-gold-500/10">
              <span class="text-5xl">{{ sec.emoji }}</span>
            </div>
            <!-- Content -->
            <div class="flex-1">
              <div class="flex items-center gap-3 mb-3">
                <h3 class="text-lg font-bold font-serif text-white">{{ sec.title }}</h3>
                <StarRating v-if="sec.ratingKey && fortune" :rating="fortune.ratings[sec.ratingKey]" />
              </div>
              <p class="text-gray-400 text-sm leading-relaxed">{{ fortune.sections[sec.key] }}</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Back -->
    <section class="w-full max-w-4xl mx-auto px-4 py-8 text-center">
      <RouterLink to="/daily-fortune" class="inline-block px-8 py-3 rounded-full bg-white/4 border border-gold-500/10 text-gray-300 font-semibold hover:bg-gold-500/5 transition-all">
        {{ t('pages.dailyFortuneResult.back') }}
      </RouterLink>
    </section>

    <!-- CTA -->
    <CtaSection :text="t('pages.dailyFortuneResult.cta')" to="/yes-no-tarot" />
  </div>
</template>
