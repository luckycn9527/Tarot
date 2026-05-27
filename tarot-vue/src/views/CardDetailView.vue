<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useScrollReveal } from '../composables/useScrollReveal'
import { useDynamicSeoTitle } from '../composables/useDynamicSeoTitle'
import { tarotCards, getCardImageUrl } from '../data/tarotCards'
import { getCardSlug, findCardBySlug } from '../data/tarotCards'
import { tarotCardDetails } from '../data/tarotCardDetails'

useScrollReveal()

const route = useRoute()
const router = useRouter()
const { t } = useI18n()

const slug = computed(() => route.params.slug as string)
const card = computed(() => findCardBySlug(slug.value))
const detail = computed(() => card.value ? tarotCardDetails[card.value.id] : undefined)

watch(
  card,
  (c) => {
    if (!c) void router.replace('/gallery')
  },
  { immediate: true },
)

useDynamicSeoTitle(computed(() =>
  card.value ? t('seo.dynamic.cardDetailTitle', { name: card.value.name }) : null,
))

const relatedCards = computed(() => {
  if (!card.value) return []
  const id = card.value.id
  const ids = [id - 2, id - 1, id + 1, id + 2].filter(i => i >= 0 && i <= 77 && i !== id)
  return ids.map(i => tarotCards[i]).slice(0, 4)
})

function getTendencyLabel(tend: string) {
  if (tend === 'yes') return t('pages.cardDetail.tendencyYes')
  if (tend === 'no') return t('pages.cardDetail.tendencyNo')
  return t('pages.cardDetail.tendencyNeutral')
}

function getTendencyClass(t: string) {
  if (t === 'yes') return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
  if (t === 'no') return 'bg-red-500/10 border-red-500/20 text-red-300'
  return 'bg-gray-500/10 border-gray-500/20 text-gray-300'
}

const sections = computed(() => {
  if (!detail.value) return []
  return [
    { title: t('pages.cardDetail.sectionDescription'), content: detail.value.description, icon: '📖' },
    { title: t('pages.cardDetail.sectionUpright'), content: detail.value.uprightMeaning, icon: '⬆️' },
    { title: t('pages.cardDetail.sectionReversed'), content: detail.value.reversedMeaning, icon: '⬇️' },
    { title: t('pages.cardDetail.sectionSymbolism'), content: detail.value.symbolism, icon: '🔮' },
    { title: t('pages.cardDetail.sectionLove'), content: detail.value.loveAdvice, icon: '💕' },
    { title: t('pages.cardDetail.sectionCareer'), content: detail.value.careerAdvice, icon: '💼' },
  ]
})
</script>

<template>
  <div v-if="card && detail" class="relative z-10">
    <!-- Breadcrumb -->
    <section class="w-full max-w-6xl mx-auto px-4 pt-20 pb-4">
      <nav class="flex items-center gap-2 text-sm text-gray-500">
        <RouterLink to="/gallery" class="hover:text-gold-300 transition-colors">{{ t('pages.cardDetail.breadcrumb') }}</RouterLink>
        <span>/</span>
        <span class="text-gray-300">{{ card.name }}</span>
      </nav>
    </section>

    <!-- Card Header -->
    <section class="w-full max-w-6xl mx-auto px-4 pb-12">
      <div class="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-8 items-start">
        <!-- Card Image -->
        <div class="flex justify-center md:justify-start">
          <div class="w-56 md:w-full rounded-2xl overflow-hidden bg-gradient-to-br from-gold-600/20 to-indigo-950/40 border border-gold-500/10 p-4">
            <img
              :src="getCardImageUrl(card.nameEn)"
              :alt="card.name"
              class="w-full rounded-lg"
            >
          </div>
        </div>

        <!-- Card Info -->
        <div class="animate-fade-in-up">
          <h1 class="text-3xl sm:text-4xl font-bold font-serif text-white mb-1">{{ card.name }}</h1>
          <p class="text-gray-400 text-lg mb-4">{{ card.nameEn }}</p>

          <!-- Tendency -->
          <div class="mb-6">
            <span
              class="inline-block px-3 py-1 rounded-full text-sm border"
              :class="getTendencyClass(card.yesNoTendency)"
            >
              {{ getTendencyLabel(card.yesNoTendency) }}
            </span>
          </div>

          <!-- Keywords -->
          <div class="space-y-3 mb-6">
            <div>
              <p class="text-gray-500 text-xs mb-1.5">{{ t('pages.cardDetail.uprightKw') }}</p>
              <div class="flex flex-wrap gap-2">
                <span
                  v-for="kw in card.uprightKeywords.split('、')"
                  :key="kw"
                  class="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs"
                >{{ kw }}</span>
              </div>
            </div>
            <div>
              <p class="text-gray-500 text-xs mb-1.5">{{ t('pages.cardDetail.reversedKw') }}</p>
              <div class="flex flex-wrap gap-2">
                <span
                  v-for="kw in card.reversedKeywords.split('、')"
                  :key="kw"
                  class="px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-300 text-xs"
                >{{ kw }}</span>
              </div>
            </div>
          </div>

          <!-- Quick desc -->
          <p class="text-gray-400 text-sm leading-relaxed">{{ detail.description }}</p>
        </div>
      </div>
    </section>

    <!-- Detailed Meanings -->
    <section class="w-full max-w-6xl mx-auto px-4 pb-12">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div
          v-for="(sec, i) in sections.slice(1)"
          :key="i"
          class="p-6 rounded-2xl bg-obsidian border border-gold-500/10 reveal-on-scroll"
        >
          <h3 class="text-lg font-bold font-serif text-white mb-3 flex items-center gap-2">
            <span>{{ sec.icon }}</span>
            {{ sec.title }}
          </h3>
          <p class="text-gray-400 text-sm leading-relaxed">{{ sec.content }}</p>
        </div>
      </div>
    </section>

    <!-- Related Cards -->
    <section v-if="relatedCards.length" class="w-full max-w-6xl mx-auto px-4 py-12 reveal-on-scroll">
      <h2 class="text-xl font-bold font-serif text-white mb-6">{{ t('pages.cardDetail.relatedTitle') }}</h2>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <RouterLink
          v-for="rc in relatedCards"
          :key="rc.id"
          :to="`/gallery/card/${getCardSlug(rc.nameEn)}`"
          class="group rounded-2xl bg-obsidian border border-gold-500/10 overflow-hidden hover:border-gold-500/30 transition-all"
        >
          <div class="aspect-[2/3] bg-gradient-to-br from-gold-600/15 to-indigo-950/30 flex items-center justify-center p-3">
            <img
              :src="getCardImageUrl(rc.nameEn)"
              :alt="rc.name"
              loading="lazy"
              class="w-full h-full object-contain rounded-lg group-hover:scale-105 transition-transform duration-300"
            >
          </div>
          <div class="p-3">
            <h3 class="text-white text-sm font-semibold font-serif truncate group-hover:text-gold-300 transition-colors">{{ rc.name }}</h3>
            <p class="text-gray-500 text-xs truncate">{{ rc.nameEn }}</p>
          </div>
        </RouterLink>
      </div>
    </section>

    <!-- Back Button -->
    <section class="w-full max-w-6xl mx-auto px-4 py-8 text-center">
      <RouterLink to="/gallery" class="inline-block px-8 py-3 rounded-full bg-white/4 border border-gold-500/10 text-gray-300 font-semibold hover:bg-white/10 transition-all">
        {{ t('pages.cardDetail.back') }}
      </RouterLink>
    </section>
  </div>
</template>
