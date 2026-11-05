<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const legalEntityName = import.meta.env.VITE_LEGAL_ENTITY_NAME?.trim() || 'E-Tomd'
const legalEntityAddress = import.meta.env.VITE_LEGAL_ENTITY_ADDRESS?.trim() || ''
</script>

<template>
  <footer class="relative z-10 border-t border-gold-500/10 bg-abyss/90 backdrop-blur-xl pb-[env(safe-area-inset-bottom,0px)]">
    <!-- Gold divider line -->
    <div class="section-divider"></div>

    <div class="max-w-6xl mx-auto px-6 py-12">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
        <!-- Brand & Support -->
        <div>
          <p class="text-lg font-serif text-gold-300 tracking-wider mb-2">E-Tomd</p>
          <p class="text-gray-600 text-sm mb-4 leading-relaxed">{{ t('footer.copyrightLine') }}</p>
          <a href="mailto:luckycn521@gmail.com" class="text-sm text-gold-300 hover:text-gold-200 transition-colors">luckycn521@gmail.com</a>
          <p class="mt-2 text-xs leading-relaxed text-gray-600">{{ t('footer.supportResponse') }}</p>
          <p class="mt-3 text-xs leading-relaxed text-gray-600">{{ t('footer.operator') }}: {{ legalEntityName }}</p>
          <p v-if="legalEntityAddress" class="mt-1 text-xs leading-relaxed text-gray-700">{{ legalEntityAddress }}</p>
        </div>

        <!-- About -->
        <div>
          <h3 class="text-gold-200 font-serif text-sm mb-4 tracking-wide">{{ t('footer.about') }}</h3>
          <ul class="space-y-2">
            <li><RouterLink to="/privacy" class="text-gray-500 text-sm hover:text-gold-300 transition-colors">{{ t('footer.privacy') }}</RouterLink></li>
            <li><RouterLink to="/terms" class="text-gray-500 text-sm hover:text-gold-300 transition-colors">{{ t('footer.terms') }}</RouterLink></li>
            <li><RouterLink to="/refund-policy" class="text-gray-500 text-sm hover:text-gold-300 transition-colors">{{ t('footer.refundPolicy') }}</RouterLink></li>
            <li><RouterLink to="/feedback" class="text-gray-500 text-sm hover:text-gold-300 transition-colors">{{ t('footer.feedback') }}</RouterLink></li>
            <li><a href="mailto:luckycn521@gmail.com" class="text-gray-500 text-sm hover:text-gold-300 transition-colors">{{ t('footer.contactEmail') }}</a></li>
          </ul>
        </div>

        <!-- Features -->
        <div>
          <h3 class="text-gold-200 font-serif text-sm mb-4 tracking-wide">{{ t('footer.features') }}</h3>
          <ul class="space-y-2">
            <li><RouterLink to="/" class="text-gray-500 text-sm hover:text-gold-300 transition-colors">{{ t('nav.home') }}</RouterLink></li>
            <li><RouterLink to="/tarot" class="text-gray-500 text-sm hover:text-gold-300 transition-colors">{{ t('nav.tarot') }}</RouterLink></li>
            <li><RouterLink to="/daily-fortune" class="text-gray-500 text-sm hover:text-gold-300 transition-colors">{{ t('nav.daily') }}</RouterLink></li>
            <li><RouterLink to="/yes-no-tarot" class="text-gray-500 text-sm hover:text-gold-300 transition-colors">{{ t('nav.yesNo') }}</RouterLink></li>
            <li><RouterLink to="/horoscope" class="text-gray-500 text-sm hover:text-gold-300 transition-colors">{{ t('nav.horoscope') }}</RouterLink></li>
            <li><RouterLink to="/membership" class="text-gray-500 text-sm hover:text-gold-300 transition-colors">{{ t('nav.membership') }}</RouterLink></li>
            <li><RouterLink to="/oracle-gallery" class="text-gray-500 text-sm hover:text-gold-300 transition-colors">{{ t('nav.oracleGallery') }}</RouterLink></li>
          </ul>
        </div>

        <!-- Blog -->
        <div>
          <h3 class="text-gold-200 font-serif text-sm mb-4 tracking-wide">{{ t('footer.explore') }}</h3>
          <ul class="space-y-2">
            <li><RouterLink to="/blog" class="text-gray-500 text-sm hover:text-gold-300 transition-colors">{{ t('nav.blog') }}</RouterLink></li>
            <li><RouterLink to="/gallery" class="text-gray-500 text-sm hover:text-gold-300 transition-colors">{{ t('nav.gallery') }}</RouterLink></li>
            <li><RouterLink to="/spreads" class="text-gray-500 text-sm hover:text-gold-300 transition-colors">{{ t('nav.spreads') }}</RouterLink></li>
          </ul>
        </div>
      </div>

      <div class="text-center text-gray-700 text-xs pt-4 border-t border-gold-500/6">
        <p>{{ legalEntityName }}</p>
      </div>
    </div>
  </footer>
</template>
