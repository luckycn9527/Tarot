<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import ChevronsDown from '@icons/chevrons-down.vue'
import { readers as apiReaders } from '../data/readers'
import { useScrollReveal } from '../composables/useScrollReveal'
import TarotCardHero from '../components/TarotCardHero.vue'
import FaqAccordion from '../components/FaqAccordion.vue'

useScrollReveal()

const { t, tm } = useI18n()

const activeMethod = ref(0)

type MethodItem = { title: string; desc: string }
type ExploreLink = { to: string; title: string; desc: string; variant: 'gold' | 'violet' }
type FaqItem = { question: string; answer: string }

const methods = computed((): MethodItem[] => {
  const m = tm('home.methods') as unknown
  return Array.isArray(m) ? (m as MethodItem[]) : []
})

const exploreLinks = computed((): ExploreLink[] => {
  const m = tm('home.exploreLinks') as unknown
  return Array.isArray(m) ? (m as ExploreLink[]) : []
})

const faqItems = computed((): FaqItem[] => {
  const m = tm('home.faq') as unknown
  return Array.isArray(m) ? (m as FaqItem[]) : []
})

const readers = computed(() =>
  apiReaders.value.map((reader) => {
    const gradient = reader.gradient.trim()
    const splitAt = gradient.indexOf(' to-')
    return {
      name: reader.name,
      emoji: reader.emoji,
      from: splitAt >= 0 ? gradient.slice(0, splitAt) : gradient,
      to: splitAt >= 0 ? gradient.slice(splitAt + 1) : 'to-purple-600/30',
    }
  }),
)
</script>

<template>
  <div class="relative z-10">
    <!-- HERO -->
    <section class="home-hero-section flex w-full flex-col items-center justify-center">
      <div class="text-center mb-8 animate-fade-in-up">
        <h1 class="text-4xl sm:text-5xl md:text-6xl font-bold leading-tight mb-4 font-serif">
          <span class="text-gold-200">{{ t('home.heroTitle') }}</span>
        </h1>
        <p class="text-base sm:text-lg text-gray-500 max-w-md mx-auto">
          {{ t('home.heroSubtitle') }}
        </p>
      </div>

      <div class="animate-fade-in-up anim-delay-1">
        <TarotCardHero />
      </div>

      <div class="animate-fade-in-up anim-delay-2">
        <RouterLink to="/tarot" class="cta-button group relative overflow-hidden inline-flex items-center gap-2 px-10 py-4 rounded-full text-white font-semibold text-lg transition-all duration-300 hover:shadow-2xl hover:shadow-gold-500/20">
          {{ t('home.ctaStart') }}
          <div class="cta-shimmer"></div>
        </RouterLink>
      </div>

      <div class="absolute bottom-8 animate-bounce">
        <ChevronsDown :size="24" class="text-gold-500/40" />
      </div>
    </section>

    <!-- EXPLORE -->
    <section class="w-full max-w-6xl mx-auto px-4 py-24 reveal-on-scroll">
      <div class="mb-12">
        <h2 class="text-2xl sm:text-3xl font-serif text-gold-200 mb-3">{{ t('home.exploreTitle') }}</h2>
        <p class="text-gray-600 text-sm">{{ t('home.exploreSubtitle') }}</p>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
        <RouterLink
          v-for="item in exploreLinks"
          :key="item.to"
          :to="item.to"
          class="group p-6 card-glass"
          :class="item.variant === 'violet'
            ? 'hover:border-violet-500/25 border-violet-500/15'
            : 'hover:border-gold-500/25'"
        >
          <h3
            class="text-lg font-serif mb-2 transition-colors"
            :class="item.variant === 'violet' ? 'text-violet-200 group-hover:text-violet-300' : 'text-gold-200 group-hover:text-gold-300'"
          >
            {{ item.title }}
          </h3>
          <p class="text-gray-500 text-sm leading-relaxed mb-4">{{ item.desc }}</p>
          <span class="text-sm" :class="item.variant === 'violet' ? 'text-violet-400' : 'text-gold-400'">{{ t('home.exploreEnter') }}</span>
        </RouterLink>
      </div>
    </section>

    <!-- HOW IT WORKS -->
    <section class="w-full max-w-6xl mx-auto px-4 py-16 reveal-on-scroll">
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
        <div>
          <h2 class="text-2xl font-serif text-gold-200 mb-6">{{ t('home.howItWorksTitle') }}</h2>
          <div class="space-y-3">
            <div
              v-for="(method, methodIndex) in methods"
              :key="methodIndex"
              class="p-4 rounded-xl border cursor-pointer transition-all duration-200"
              :class="activeMethod === methodIndex
                ? 'border-gold-500/20 bg-gold-500/4'
                : 'border-transparent hover:border-gold-500/8'"
              @click="activeMethod = methodIndex"
            >
              <h3 class="text-base text-gray-200 mb-1">{{ method.title }}</h3>
              <p class="text-gray-600 text-sm">{{ method.desc }}</p>
            </div>
          </div>
        </div>
        <div class="rounded-2xl overflow-hidden aspect-[4/3] bg-gradient-to-br from-obsidian to-void border border-gold-500/8 flex items-center justify-center">
          <div v-show="activeMethod === 0" class="flex flex-col items-center gap-4 p-8">
            <div class="grid grid-cols-5 gap-2">
              <div v-for="miniIndex in 10" :key="miniIndex" class="tarot-mini" :style="{ '--delay': miniIndex - 1 } as any">
                <div class="tarot-mini-inner"></div>
              </div>
            </div>
            <p class="text-gray-600 text-xs mt-2">{{ t('home.methodDemoPick') }}</p>
          </div>
          <div v-show="activeMethod === 1" class="flex flex-col items-center gap-4 p-8">
            <div class="grid grid-cols-4 gap-4">
              <div v-for="luckyNum in [3, 7, 12, 21]" :key="luckyNum" class="w-14 h-14 rounded-xl bg-gold-500/8 border border-gold-500/12 flex items-center justify-center text-xl font-bold font-serif text-gold-300/70">
                {{ luckyNum }}
              </div>
            </div>
          </div>
          <div v-show="activeMethod === 2" class="flex flex-col items-center gap-4 p-8">
            <div class="flex gap-3">
              <div v-for="idx in 3" :key="idx" class="w-16 h-24 rounded-lg bg-gradient-to-b from-gold-500/5 to-transparent border border-gold-500/10 flex items-center justify-center text-gold-400/30 text-sm font-serif">
                {{ ['I', 'II', 'III'][idx - 1] }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- READERS -->
    <section class="w-full py-16 overflow-hidden reveal-on-scroll">
      <div class="max-w-6xl mx-auto px-4 mb-6">
        <h2 class="text-2xl font-serif text-gold-200 mb-2">{{ t('home.readersTitle') }}</h2>
        <p class="text-gray-600 text-sm">{{ t('home.readersSubtitle') }}</p>
      </div>
      <div class="reader-carousel my-6">
        <div class="reader-track">
          <template v-for="repeatIndex in 3" :key="repeatIndex">
            <div v-for="readerItem in readers" :key="`${repeatIndex}-${readerItem.name}`" class="reader-card">
              <div class="reader-avatar" :class="`bg-gradient-to-br ${readerItem.from} ${readerItem.to}`">
                <span class="text-4xl">{{ readerItem.emoji }}</span>
              </div>
              <p class="text-sm text-gray-500 mt-2">{{ readerItem.name }}</p>
            </div>
          </template>
        </div>
      </div>
      <div class="max-w-2xl mx-auto px-6">
        <p class="text-gray-500 text-sm leading-relaxed">{{ t('home.readersNote') }}</p>
      </div>
    </section>

    <!-- FAQ -->
    <section class="w-full max-w-3xl mx-auto px-4 py-16 reveal-on-scroll">
      <h2 class="text-2xl font-serif text-gold-200 mb-6">{{ t('home.faqTitle') }}</h2>
      <FaqAccordion :items="faqItems" />
    </section>

    <!-- Closing -->
    <section class="w-full max-w-4xl mx-auto px-4 py-16 text-center reveal-on-scroll">
      <p class="text-gray-600 text-sm mb-4">{{ t('home.closingReady') }}</p>
      <RouterLink to="/tarot" class="inline-block text-gold-400 hover:text-gold-300 text-sm transition-colors">
        {{ t('home.closingCta') }}
      </RouterLink>
    </section>
  </div>
</template>
