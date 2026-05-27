<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useScrollReveal } from '../composables/useScrollReveal'
import type { LegalSection, LegalBlock } from '@/locales/pages.zh'

useScrollReveal()

const { t, tm } = useI18n()

const sections = computed(() => tm('pages.terms.sections') as LegalSection[])

function isP(block: LegalBlock): block is Extract<LegalBlock, { type: 'p' }> {
  return block.type === 'p'
}
function isUl(block: LegalBlock): block is Extract<LegalBlock, { type: 'ul' }> {
  return block.type === 'ul'
}
function isHtml(block: LegalBlock): block is Extract<LegalBlock, { type: 'html' }> {
  return block.type === 'html'
}
</script>

<template>
  <div class="relative z-10">
    <section class="w-full flex flex-col items-center justify-center px-4 pt-24 pb-12 text-center">
      <div class="animate-fade-in-up">
        <h1 class="text-4xl sm:text-5xl font-bold font-serif text-white mb-4">{{ t('pages.terms.heroTitle') }}</h1>
        <p class="text-gray-400 text-lg">{{ t('pages.terms.heroSub') }}</p>
        <p class="text-gray-500 text-sm mt-2">{{ t('pages.terms.updated') }}</p>
      </div>
    </section>

    <section class="w-full max-w-4xl mx-auto px-4 pb-20">
      <div class="space-y-8">
        <div
          v-for="section in sections"
          :key="section.num"
          class="p-6 rounded-2xl card-panel border border-gold-500/10 reveal-on-scroll"
        >
          <h2 class="text-xl font-bold font-serif text-white mb-4 flex items-center gap-2">
            <span class="w-8 h-8 rounded-full bg-gold-500/20 flex items-center justify-center text-gold-400 text-sm">{{ section.num }}</span>
            {{ section.title }}
          </h2>
          <div class="text-gray-400 text-sm leading-relaxed space-y-3">
            <template v-for="(block, bi) in section.blocks" :key="bi">
              <p v-if="isP(block)">{{ block.text }}</p>
              <ul v-else-if="isUl(block)" class="list-disc list-inside space-y-1 ml-4">
                <li v-for="(item, ii) in block.items" :key="ii">{{ item }}</li>
              </ul>
              <div v-else-if="isHtml(block)" v-html="block.html" />
            </template>
          </div>
        </div>
      </div>
    </section>

    <section class="w-full max-w-4xl mx-auto px-4 py-16 text-center reveal-on-scroll">
      <h3 class="text-2xl font-bold font-serif text-white mb-3">{{ t('pages.terms.ctaTitle') }}</h3>
      <p class="text-gray-400 mb-8">{{ t('pages.terms.ctaSub') }}</p>
      <RouterLink
        to="/yes-no-tarot"
        class="inline-block px-10 py-4 rounded-full cta-button text-white font-semibold text-lg hover:shadow-2xl hover:shadow-gold-500/30 transition-all"
      >{{ t('pages.terms.ctaButton') }}</RouterLink>
    </section>
  </div>
</template>
