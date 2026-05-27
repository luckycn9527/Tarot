<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useScrollReveal } from '../composables/useScrollReveal'
import { useQuota } from '../composables/useQuota'
import { useAuth } from '../composables/useAuth'
import FaqAccordion from '../components/FaqAccordion.vue'

useScrollReveal()

const { t, tm } = useI18n()
const route = useRoute()
const { remaining } = useQuota()
const { isLoggedIn } = useAuth()

type FaqItem = { question: string; answer: string }

const faqItems = computed((): FaqItem[] => {
  const m = tm('yesNoLanding.faq') as unknown
  return Array.isArray(m) ? (m as FaqItem[]) : []
})

const howThreeBullets = computed((): string[] => {
  const m = tm('yesNoLanding.howThreeBullets') as unknown
  return Array.isArray(m) ? (m as string[]) : []
})
</script>

<template>
  <div class="relative z-10">
    <!-- Hero -->
    <section class="w-full flex flex-col items-center justify-center px-4 pt-24 pb-8 text-center">
      <div class="animate-fade-in-up">
        <h1 class="text-3xl sm:text-4xl md:text-5xl font-bold font-serif leading-tight mb-3 text-gold-200">
          {{ t('yesNoLanding.heroTitle') }}
        </h1>
        <p class="text-gray-500 text-sm sm:text-base max-w-md mx-auto">{{ t('yesNoLanding.heroSubtitle') }}</p>
        <div v-if="!isLoggedIn" class="mt-4 inline-flex items-center gap-2 text-sm text-gray-500">
          <span>{{ t('yesNoLanding.quotaHint', { count: remaining }) }}</span>
          <span aria-hidden="true">·</span>
          <RouterLink
            :to="{ path: '/login', query: { redirect: route.fullPath } }"
            class="text-gold-400 hover:text-gold-300 transition-colors"
          >{{ t('nav.loginMore') }}</RouterLink>
        </div>
      </div>
    </section>

    <!-- Two Options -->
    <section class="w-full max-w-4xl mx-auto px-4 py-10 reveal-on-scroll">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <RouterLink to="/yes-no-tarot/single-card" class="group p-6 rounded-2xl card-glass hover:border-gold-500/25 transition-all">
          <h3 class="text-lg font-serif text-gold-200 mb-2 group-hover:text-gold-300 transition-colors">{{ t('yesNoLanding.optionSingleTitle') }}</h3>
          <p class="text-gray-500 text-sm leading-relaxed mb-4">{{ t('yesNoLanding.optionSingleDesc') }}</p>
          <span class="text-gold-400 text-sm">{{ t('yesNoLanding.optionCta') }}</span>
        </RouterLink>
        <RouterLink to="/yes-no-tarot/three-cards" class="group p-6 rounded-2xl card-glass hover:border-gold-500/25 transition-all">
          <h3 class="text-lg font-serif text-gold-200 mb-2 group-hover:text-gold-300 transition-colors">{{ t('yesNoLanding.optionThreeTitle') }}</h3>
          <p class="text-gray-500 text-sm leading-relaxed mb-4">{{ t('yesNoLanding.optionThreeDesc') }}</p>
          <span class="text-gold-400 text-sm">{{ t('yesNoLanding.optionCta') }}</span>
        </RouterLink>
      </div>
    </section>

    <!-- Questioning Tips -->
    <section class="w-full max-w-4xl mx-auto px-4 py-12 reveal-on-scroll">
      <h2 class="text-xl font-serif text-gold-200 mb-6">{{ t('yesNoLanding.tipsTitle') }}</h2>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div class="p-5 rounded-xl card-panel">
          <p class="text-gray-500 text-xs mb-3">{{ t('yesNoLanding.tipsLoveCategory') }}</p>
          <p class="text-gray-600 text-sm line-through mb-1.5">{{ t('yesNoLanding.tipsLoveBad') }}</p>
          <p class="text-gray-300 text-sm">{{ t('yesNoLanding.tipsLoveGood') }}</p>
        </div>
        <div class="p-5 rounded-xl card-panel">
          <p class="text-gray-500 text-xs mb-3">{{ t('yesNoLanding.tipsCareerCategory') }}</p>
          <p class="text-gray-600 text-sm line-through mb-1.5">{{ t('yesNoLanding.tipsCareerBad') }}</p>
          <p class="text-gray-300 text-sm">{{ t('yesNoLanding.tipsCareerGood') }}</p>
        </div>
        <div class="p-5 rounded-xl card-panel">
          <p class="text-gray-500 text-xs mb-3">{{ t('yesNoLanding.tipsDecisionCategory') }}</p>
          <p class="text-gray-600 text-sm line-through mb-1.5">{{ t('yesNoLanding.tipsDecisionBad') }}</p>
          <p class="text-gray-300 text-sm">{{ t('yesNoLanding.tipsDecisionGood') }}</p>
        </div>
      </div>
      <p class="text-gray-600 text-xs mt-4">{{ t('yesNoLanding.tipsPrinciple') }}</p>
    </section>

    <!-- How it decides -->
    <section class="w-full max-w-4xl mx-auto px-4 py-12 reveal-on-scroll">
      <h2 class="text-xl font-serif text-gold-200 mb-6">{{ t('yesNoLanding.howTitle') }}</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div class="p-5 rounded-xl card-panel">
          <h3 class="text-base text-gray-200 mb-2">{{ t('yesNoLanding.howSingleTitle') }}</h3>
          <p class="text-gray-500 text-sm leading-relaxed">{{ t('yesNoLanding.howSingleDesc') }}</p>
        </div>
        <div class="p-5 rounded-xl card-panel">
          <h3 class="text-base text-gray-200 mb-2">{{ t('yesNoLanding.howThreeTitle') }}</h3>
          <p class="text-gray-500 text-sm leading-relaxed mb-3">{{ t('yesNoLanding.howThreeIntro') }}</p>
          <ul class="text-sm text-gray-500 space-y-1">
            <li
              v-for="(line, idx) in howThreeBullets"
              :key="idx"
              class="flex items-center gap-2"
            >
              <span
                class="w-2 h-2 rounded-full shrink-0"
                :class="idx === 0 ? 'bg-emerald-500/60' : idx === 1 ? 'bg-amber-500/60' : 'bg-red-500/60'"
              />
              <span>{{ line }}</span>
            </li>
          </ul>
        </div>
      </div>
    </section>

    <!-- FAQ -->
    <section class="w-full max-w-3xl mx-auto px-4 py-12 reveal-on-scroll">
      <h2 class="text-xl font-serif text-gold-200 mb-5">{{ t('yesNoLanding.faqSectionTitle') }}</h2>
      <FaqAccordion :items="faqItems" />
    </section>

    <!-- Closing -->
    <section class="w-full max-w-3xl mx-auto px-4 py-12 reveal-on-scroll">
      <p class="text-gray-600 text-sm">
        {{ t('yesNoLanding.closingStart') }}
        <RouterLink to="/tarot" class="text-gold-400 hover:text-gold-300 transition-colors">{{ t('nav.tarot') }}</RouterLink>
        {{ t('yesNoLanding.closingOr') }}
        <RouterLink to="/daily-fortune" class="text-gold-400 hover:text-gold-300 transition-colors">{{ t('nav.daily') }}</RouterLink>
      </p>
    </section>
  </div>
</template>
