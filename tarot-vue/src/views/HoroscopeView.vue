<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { useScrollReveal } from '../composables/useScrollReveal'

useScrollReveal()

const { t, tm } = useI18n()

interface ZodiacSign {
  key: string
  icon: string
  name: string
  date: string
}

const zodiacList = computed(() => tm('pages.horoscope.signs') as ZodiacSign[])
const zodiacDescriptions = computed(() => tm('pages.horoscope.descriptions') as Record<string, { focus: string; brief: string }>)

const selectedSign = ref('aries')
const detailRef = ref<HTMLElement | null>(null)

const currentSign = computed(() => zodiacList.value.find(z => z.key === selectedSign.value))
const currentDesc = computed(() => zodiacDescriptions.value[selectedSign.value])

function showZodiac(sign: string) {
  selectedSign.value = sign
  nextTick(() => {
    detailRef.value?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  })
}
</script>

<template>
  <div class="relative z-10">
    <section class="w-full flex flex-col items-center justify-center px-4 pt-24 pb-8 text-center">
      <div class="animate-fade-in-up">
        <h1 class="text-3xl sm:text-4xl md:text-5xl font-bold font-serif leading-tight mb-3 text-gold-200">
          {{ t('pages.horoscope.heroTitle') }}
        </h1>
        <p class="text-gray-500 text-sm max-w-lg mx-auto">{{ t('pages.horoscope.heroSub') }}</p>
      </div>
    </section>

    <section class="w-full max-w-5xl mx-auto px-4 py-10 reveal-on-scroll">
      <div class="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        <button
          v-for="z in zodiacList"
          :key="z.key"
          class="zodiac-card"
          :class="{ 'border-gold-500/25 bg-gold-500/4': selectedSign === z.key }"
          @click="showZodiac(z.key)"
        >
          <div class="zodiac-icon">{{ z.icon }}</div>
          <h3 class="text-gray-200 font-serif text-sm">{{ z.name }}</h3>
          <p class="text-gray-600 text-xs">{{ z.date }}</p>
        </button>
      </div>
    </section>

    <section ref="detailRef" class="w-full max-w-3xl mx-auto px-4 py-8 reveal-on-scroll">
      <div v-if="currentSign && currentDesc" class="p-6 rounded-2xl card-glass">
        <div class="flex items-center gap-3 mb-4">
          <span class="text-3xl">{{ currentSign.icon }}</span>
          <div>
            <h3 class="text-lg font-serif text-gold-200">{{ currentSign.name }}</h3>
            <p class="text-gray-600 text-xs">{{ t('pages.horoscope.detailFocus') }}：{{ currentDesc.focus }}</p>
          </div>
        </div>
        <p class="text-gray-400 text-sm leading-relaxed">{{ currentDesc.brief }}</p>
      </div>
    </section>

    <section class="w-full max-w-3xl mx-auto px-4 py-12 reveal-on-scroll">
      <h2 class="text-xl font-serif text-gold-200 mb-5">{{ t('pages.horoscope.relatedTitle') }}</h2>
      <div class="space-y-3">
        <RouterLink to="/daily-fortune" class="flex items-center gap-4 p-4 rounded-xl card-panel hover:border-gold-500/20 transition-all group">
          <span class="text-2xl">☀️</span>
          <div>
            <h3 class="text-sm text-gray-200 group-hover:text-gold-300 transition-colors">{{ t('pages.horoscope.relatedDailyTitle') }}</h3>
            <p class="text-gray-600 text-xs">{{ t('pages.horoscope.relatedDailyDesc') }}</p>
          </div>
        </RouterLink>
        <RouterLink to="/tarot" class="flex items-center gap-4 p-4 rounded-xl card-panel hover:border-gold-500/20 transition-all group">
          <span class="text-2xl">🔮</span>
          <div>
            <h3 class="text-sm text-gray-200 group-hover:text-gold-300 transition-colors">{{ t('pages.horoscope.relatedTarotTitle') }}</h3>
            <p class="text-gray-600 text-xs">{{ t('pages.horoscope.relatedTarotDesc') }}</p>
          </div>
        </RouterLink>
      </div>
    </section>
  </div>
</template>
