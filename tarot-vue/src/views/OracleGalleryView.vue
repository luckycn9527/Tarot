<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useScrollReveal } from '../composables/useScrollReveal'

useScrollReveal()

const { t } = useI18n()
</script>

<template>
  <div class="relative z-10">
    <section class="w-full flex flex-col items-center justify-center px-4 pt-24 pb-12 min-h-[70vh] text-center">
      <div class="animate-fade-in-up">
        <div class="text-8xl mb-6">🔮</div>
        <h1 class="text-4xl sm:text-5xl font-bold font-serif text-white mb-4">{{ t('pages.oracleGallery.heroTitle') }}</h1>
        <p class="text-gray-400 text-lg mb-2">{{ t('pages.oracleGallery.heroSub') }}</p>
        <div class="mt-6 inline-flex items-center gap-2 px-5 py-2 rounded-full bg-gold-500/10 border border-gold-500/20">
          <span class="w-2 h-2 rounded-full bg-gold-400 animate-pulse"></span>
          <span class="text-gold-300 text-sm">{{ t('pages.oracleGallery.badge') }}</span>
        </div>
        <p class="text-gray-500 text-sm mt-8 max-w-md mx-auto leading-relaxed">
          {{ t('pages.oracleGallery.body') }}
        </p>
        <div class="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10">
          <RouterLink to="/gallery" class="px-8 py-3 rounded-full cta-button text-white font-semibold hover:shadow-lg hover:shadow-gold-500/30 transition-all">
            {{ t('pages.oracleGallery.ctaGallery') }}
          </RouterLink>
          <RouterLink to="/" class="px-8 py-3 rounded-full bg-white/4 border border-gold-500/10 text-gray-300 font-semibold hover:bg-white/10 transition-all">
            {{ t('pages.oracleGallery.ctaHome') }}
          </RouterLink>
        </div>
      </div>
    </section>
  </div>
</template>
