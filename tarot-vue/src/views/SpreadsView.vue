<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useScrollReveal } from '../composables/useScrollReveal'
import { spreads } from '../data/spreadsData'

useScrollReveal()

const { t } = useI18n()
</script>

<template>
  <div class="relative z-10">
    <!-- Hero -->
    <section class="w-full flex flex-col items-center justify-center px-4 pt-24 pb-12 text-center">
      <div class="animate-fade-in-up">
        <h1 class="text-4xl sm:text-5xl font-bold font-serif text-white mb-4">{{ t('pages.spreads.heroTitle') }}</h1>
        <p class="text-gray-400 text-lg">{{ t('pages.spreads.heroSub') }}</p>
      </div>
    </section>

    <!-- Spreads -->
    <section class="w-full max-w-5xl mx-auto px-4 pb-12">
      <div class="space-y-8">
        <div
          v-for="spread in spreads"
          :key="spread.id"
          class="p-6 sm:p-8 rounded-2xl bg-obsidian border border-gold-500/10 reveal-on-scroll"
        >
          <div class="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-8">
            <!-- Info -->
            <div>
              <div class="flex items-center gap-3 mb-4">
                <span class="text-3xl">{{ spread.emoji }}</span>
                <div>
                  <h2 class="text-xl font-bold font-serif text-white">{{ spread.name }}</h2>
                  <p class="text-gray-500 text-sm">{{ t('pages.spreads.cardCount', { n: spread.cardCount }) }}</p>
                </div>
              </div>
              <p class="text-gray-400 text-sm leading-relaxed mb-4">{{ spread.description }}</p>
              <div class="mb-4">
                <p class="text-gray-500 text-xs mb-1">{{ t('pages.spreads.whenToUse') }}</p>
                <p class="text-gray-300 text-sm">{{ spread.whenToUse }}</p>
              </div>
              <div>
                <p class="text-gray-500 text-xs mb-2">{{ t('pages.spreads.positions') }}</p>
                <div class="space-y-1.5">
                  <div
                    v-for="pos in spread.positions"
                    :key="pos.index"
                    class="flex items-start gap-2 text-sm"
                  >
                    <span class="w-5 h-5 rounded bg-gold-600/20 text-gold-400 text-xs flex items-center justify-center shrink-0 mt-0.5">{{ pos.index }}</span>
                    <div>
                      <span class="text-gray-300 font-medium">{{ pos.name }}</span>
                      <span class="text-gray-500 ml-1">— {{ pos.description }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Position Diagram -->
            <div class="flex items-center justify-center">
              <div class="relative" :style="{ minHeight: spread.cardCount <= 3 ? '160px' : '200px' }">
                <!-- Single card -->
                <div v-if="spread.id === 'single'" class="flex items-center justify-center h-40">
                  <div class="w-16 h-24 rounded-lg border-2 border-dashed border-gold-500/40 flex items-center justify-center text-gold-400 text-xs">1</div>
                </div>
                <!-- Three card -->
                <div v-else-if="spread.id === 'three-card'" class="flex items-center justify-center gap-3 h-40">
                  <div v-for="i in 3" :key="i" class="w-14 h-20 rounded-lg border-2 border-dashed border-gold-500/40 flex items-center justify-center text-gold-400 text-xs">{{ i }}</div>
                </div>
                <!-- Celtic Cross -->
                <div v-else-if="spread.id === 'celtic-cross'" class="grid gap-1.5" style="grid-template-columns: repeat(6, 28px); grid-template-rows: repeat(5, 28px);">
                  <div></div><div></div>
                  <div class="w-7 h-7 rounded border border-dashed border-gold-500/40 flex items-center justify-center text-gold-400 text-[10px]">5</div>
                  <div></div><div></div>
                  <div class="w-7 h-7 rounded border border-dashed border-gold-500/40 flex items-center justify-center text-gold-400 text-[10px]">10</div>

                  <div></div>
                  <div class="w-7 h-7 rounded border border-dashed border-gold-500/40 flex items-center justify-center text-gold-400 text-[10px]">4</div>
                  <div class="w-7 h-7 rounded border border-dashed border-gold-500/40 flex items-center justify-center text-gold-400 text-[10px] bg-gold-500/10">1</div>
                  <div class="w-7 h-7 rounded border border-dashed border-gold-500/40 flex items-center justify-center text-gold-400 text-[10px]">6</div>
                  <div></div>
                  <div class="w-7 h-7 rounded border border-dashed border-gold-500/40 flex items-center justify-center text-gold-400 text-[10px]">9</div>

                  <div></div><div></div>
                  <div class="w-7 h-7 rounded border border-dashed border-gold-500/40 flex items-center justify-center text-gold-400 text-[10px]">2</div>
                  <div></div><div></div>
                  <div class="w-7 h-7 rounded border border-dashed border-gold-500/40 flex items-center justify-center text-gold-400 text-[10px]">8</div>

                  <div></div><div></div>
                  <div class="w-7 h-7 rounded border border-dashed border-gold-500/40 flex items-center justify-center text-gold-400 text-[10px]">3</div>
                  <div></div><div></div>
                  <div class="w-7 h-7 rounded border border-dashed border-gold-500/40 flex items-center justify-center text-gold-400 text-[10px]">7</div>

                  <div></div><div></div><div></div><div></div><div></div><div></div>
                </div>
                <!-- Relationship (5 cards) -->
                <div v-else-if="spread.id === 'relationship'" class="flex flex-col items-center gap-2">
                  <div class="flex gap-6">
                    <div class="w-14 h-20 rounded-lg border-2 border-dashed border-gold-500/40 flex items-center justify-center text-gold-400 text-xs">1</div>
                    <div class="w-14 h-20 rounded-lg border-2 border-dashed border-gold-500/40 flex items-center justify-center text-gold-400 text-xs">2</div>
                  </div>
                  <div class="w-14 h-20 rounded-lg border-2 border-dashed border-gold-500/40 flex items-center justify-center text-gold-400 text-xs bg-gold-500/10">3</div>
                  <div class="flex gap-6">
                    <div class="w-14 h-20 rounded-lg border-2 border-dashed border-gold-500/40 flex items-center justify-center text-gold-400 text-xs">4</div>
                    <div class="w-14 h-20 rounded-lg border-2 border-dashed border-gold-500/40 flex items-center justify-center text-gold-400 text-xs">5</div>
                  </div>
                </div>
                <!-- Career (5 cards) -->
                <div v-else-if="spread.id === 'career'" class="flex flex-col items-center gap-2">
                  <div class="w-14 h-20 rounded-lg border-2 border-dashed border-gold-500/40 flex items-center justify-center text-gold-400 text-xs">1</div>
                  <div class="flex gap-3">
                    <div class="w-14 h-20 rounded-lg border-2 border-dashed border-gold-500/40 flex items-center justify-center text-gold-400 text-xs">2</div>
                    <div class="w-14 h-20 rounded-lg border-2 border-dashed border-gold-500/40 flex items-center justify-center text-gold-400 text-xs">3</div>
                  </div>
                  <div class="flex gap-3">
                    <div class="w-14 h-20 rounded-lg border-2 border-dashed border-gold-500/40 flex items-center justify-center text-gold-400 text-xs">4</div>
                    <div class="w-14 h-20 rounded-lg border-2 border-dashed border-gold-500/40 flex items-center justify-center text-gold-400 text-xs">5</div>
                  </div>
                </div>
                <!-- Horseshoe (7 cards) -->
                <div v-else-if="spread.id === 'horseshoe'" class="flex items-end gap-1.5">
                  <div class="w-10 h-16 rounded border-2 border-dashed border-gold-500/40 flex items-center justify-center text-gold-400 text-xs mb-6">1</div>
                  <div class="w-10 h-16 rounded border-2 border-dashed border-gold-500/40 flex items-center justify-center text-gold-400 text-xs mb-10">2</div>
                  <div class="w-10 h-16 rounded border-2 border-dashed border-gold-500/40 flex items-center justify-center text-gold-400 text-xs mb-12">3</div>
                  <div class="w-10 h-16 rounded border-2 border-dashed border-gold-500/40 flex items-center justify-center text-gold-400 text-xs mb-14 bg-gold-500/10">4</div>
                  <div class="w-10 h-16 rounded border-2 border-dashed border-gold-500/40 flex items-center justify-center text-gold-400 text-xs mb-12">5</div>
                  <div class="w-10 h-16 rounded border-2 border-dashed border-gold-500/40 flex items-center justify-center text-gold-400 text-xs mb-10">6</div>
                  <div class="w-10 h-16 rounded border-2 border-dashed border-gold-500/40 flex items-center justify-center text-gold-400 text-xs mb-6">7</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- CTA -->
    <section class="w-full max-w-4xl mx-auto px-4 py-16 text-center reveal-on-scroll">
      <h3 class="text-2xl font-bold font-serif text-white mb-3">{{ t('pages.spreads.ctaTitle') }}</h3>
      <p class="text-gray-400 mb-8">{{ t('pages.spreads.ctaSub') }}</p>
      <div class="flex flex-col sm:flex-row items-center justify-center gap-4">
        <RouterLink to="/yes-no-tarot/single-card" class="inline-block px-8 py-3 rounded-full cta-button text-white font-semibold hover:shadow-lg hover:shadow-gold-500/30 transition-all">{{ t('pages.spreads.ctaSingle') }}</RouterLink>
        <RouterLink to="/yes-no-tarot/three-cards" class="inline-block px-8 py-3 rounded-full bg-white/4 border border-gold-500/10 text-gray-300 font-semibold hover:bg-white/10 transition-all">{{ t('pages.spreads.ctaThree') }}</RouterLink>
      </div>
    </section>
  </div>
</template>
