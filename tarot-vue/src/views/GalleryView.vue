<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useScrollReveal } from '../composables/useScrollReveal'
import { tarotCards, getCardImageUrl } from '../data/tarotCards'
import { getCardSlug } from '../data/tarotCards'

useScrollReveal()

const { t, tm } = useI18n()

type Category = 'all' | 'major' | 'wands' | 'cups' | 'swords' | 'pentacles'

const activeCategory = ref<Category>('all')

const categories = computed(() => tm('pages.gallery.categories') as { key: Category; label: string; count: number }[])

const filteredCards = computed(() => {
  switch (activeCategory.value) {
    case 'major': return tarotCards.filter(c => c.id <= 21)
    case 'wands': return tarotCards.filter(c => c.id >= 22 && c.id <= 35)
    case 'cups': return tarotCards.filter(c => c.id >= 36 && c.id <= 49)
    case 'swords': return tarotCards.filter(c => c.id >= 50 && c.id <= 63)
    case 'pentacles': return tarotCards.filter(c => c.id >= 64 && c.id <= 77)
    default: return tarotCards
  }
})

function getTendencyLabel(tend: string) {
  if (tend === 'yes') return t('pages.gallery.tendencyYes')
  if (tend === 'no') return t('pages.gallery.tendencyNo')
  return t('pages.gallery.tendencyNeutral')
}

function getTendencyClass(t: string) {
  if (t === 'yes') return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
  if (t === 'no') return 'bg-red-500/10 border-red-500/20 text-red-300'
  return 'bg-gray-500/10 border-gray-500/20 text-gray-300'
}
</script>

<template>
  <div class="relative z-10">
    <!-- Hero -->
    <section class="w-full flex flex-col items-center justify-center px-4 pt-24 pb-8 text-center">
      <div class="animate-fade-in-up">
        <h1 class="text-4xl sm:text-5xl font-bold font-serif text-white mb-4">{{ t('pages.gallery.heroTitle') }}</h1>
        <p class="text-gray-400 text-lg">{{ t('pages.gallery.heroSub') }}</p>
      </div>
    </section>

    <!-- Tabs -->
    <section class="w-full max-w-6xl mx-auto px-4 pb-4">
      <div class="flex flex-wrap justify-center gap-2">
        <button
          v-for="cat in categories"
          :key="cat.key"
          class="px-4 py-2 rounded-full text-sm transition-all border"
          :class="activeCategory === cat.key
            ? 'bg-gradient-to-r from-gold-500 to-gold-600 text-abyss border-gold-400'
            : 'bg-white/4 border-gold-500/10 text-gray-400 hover:border-gold-500/50'"
          @click="activeCategory = cat.key"
        >
          {{ cat.label }}
          <span class="ml-1 text-xs opacity-70">({{ cat.count }})</span>
        </button>
      </div>
    </section>

    <!-- Grid -->
    <section class="w-full max-w-6xl mx-auto px-4 py-8">
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        <RouterLink
          v-for="card in filteredCards"
          :key="card.id"
          :to="`/gallery/card/${getCardSlug(card.nameEn)}`"
          class="group rounded-2xl bg-obsidian border border-gold-500/10 overflow-hidden hover:border-gold-500/30 transition-all hover:shadow-lg hover:shadow-gold-500/10"
        >
          <div class="aspect-[2/3] bg-gradient-to-br from-gold-600/15 to-indigo-950/30 flex items-center justify-center p-3">
            <img
              :src="getCardImageUrl(card.nameEn)"
              :alt="card.name"
              loading="lazy"
              class="w-full h-full object-contain rounded-lg group-hover:scale-105 transition-transform duration-300"
            >
          </div>
          <div class="p-3">
            <h3 class="text-white text-sm font-semibold font-serif truncate group-hover:text-gold-300 transition-colors">{{ card.name }}</h3>
            <p class="text-gray-500 text-xs truncate">{{ card.nameEn }}</p>
            <div class="mt-2">
              <span
                class="inline-block px-2 py-0.5 rounded-full text-xs border"
                :class="getTendencyClass(card.yesNoTendency)"
              >
                {{ getTendencyLabel(card.yesNoTendency) }}
              </span>
            </div>
          </div>
        </RouterLink>
      </div>
      <p class="text-center text-gray-500 text-sm mt-8">共 {{ filteredCards.length }} 张牌</p>
    </section>

    <!-- CTA -->
    <section class="w-full max-w-4xl mx-auto px-4 py-16 text-center reveal-on-scroll">
      <h3 class="text-2xl font-bold font-serif text-white mb-3">想体验塔罗的智慧？</h3>
      <p class="text-gray-400 mb-8">了解了这些牌之后，不妨亲自体验一次塔罗占卜</p>
      <RouterLink to="/yes-no-tarot" class="inline-block px-10 py-4 rounded-full cta-button text-white font-semibold text-lg hover:shadow-2xl hover:shadow-gold-500/30 transition-all">开始占卜</RouterLink>
    </section>
  </div>
</template>
