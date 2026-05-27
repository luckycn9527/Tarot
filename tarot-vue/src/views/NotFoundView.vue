<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <div class="relative z-10 min-h-[calc(100vh-56px)] flex flex-col items-center justify-center px-6 py-24 text-center">
    <p class="text-gold-500/50 text-xs font-serif tracking-[0.2em] uppercase mb-3">404</p>
    <h1 class="text-3xl sm:text-4xl font-serif font-bold text-gold-100 mb-3">{{ t('notFound.title') }}</h1>
    <p class="text-gray-500 text-sm max-w-md leading-relaxed mb-10">{{ t('notFound.desc') }}</p>
    <RouterLink
      to="/"
      class="inline-flex items-center gap-2 px-8 py-3 rounded-full cta-button text-white font-medium"
    >
      {{ t('common.backHome') }}
    </RouterLink>
  </div>
</template>
