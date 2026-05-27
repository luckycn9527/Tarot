<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import HeroBg from './components/HeroBg.vue'
import AppHeader from './components/AppHeader.vue'
import AppFooter from './components/AppFooter.vue'
import ToastNotification from './components/ToastNotification.vue'
import AppErrorBoundary from './components/AppErrorBoundary.vue'

const route = useRoute()
const { t } = useI18n()
const isCemeteryPage = computed(() => route.path.startsWith('/cemetery'))
const isAdminPage = computed(() => route.path.startsWith('/admin'))
</script>

<template>
  <a
    href="#main-content"
    class="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-abyss focus:px-4 focus:py-2 focus:text-sm focus:text-gold-200 focus:outline-none focus:ring-2 focus:ring-gold-500/40"
  >
    {{ t('nav.skipToContent') }}
  </a>
  <HeroBg v-if="!isCemeteryPage && !isAdminPage" />
  <AppHeader v-if="!isAdminPage" />
  <main id="main-content" :class="isAdminPage ? '' : 'main-content-safe'" tabindex="-1">
    <AppErrorBoundary>
      <RouterView v-slot="{ Component }">
        <Transition name="page-oracle">
          <component :is="Component" />
        </Transition>
      </RouterView>
    </AppErrorBoundary>
  </main>
  <AppFooter v-if="!isCemeteryPage && !isAdminPage" />
  <ToastNotification />
</template>
