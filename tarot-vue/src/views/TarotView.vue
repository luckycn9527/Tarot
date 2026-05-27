<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useScrollReveal } from '../composables/useScrollReveal'
import { useQuota } from '../composables/useQuota'
import { useAuth } from '../composables/useAuth'
import { useRoute, useRouter } from 'vue-router'
import { readers } from '../data/readers'
import FaqAccordion from '../components/FaqAccordion.vue'
import ReaderAvatarMedia from '../components/ui/ReaderAvatarMedia.vue'

useScrollReveal()

const { t, tm } = useI18n()
const { remaining, isVip } = useQuota()
const { user, isLoggedIn } = useAuth()
const route = useRoute()
const router = useRouter()

function selectReader(readerId: string, accessLevel: 'free' | 'vip') {
  if (accessLevel === 'vip') {
    if (!isLoggedIn.value || user.value?.membership !== 'vip') {
      router.push('/membership')
      return
    }
  }
  router.push(`/reader/${readerId}/ask`)
}

const noticeFaq = computed(() => tm('pages.tarot.noticeFaq') as { question: string; answer: string }[])
</script>

<template>
  <div class="relative z-10">
    <!-- Hero -->
    <section class="w-full flex flex-col items-center justify-center px-4 pt-24 pb-8">
      <div class="text-center mb-6 animate-fade-in-up">
        <h1 class="text-3xl sm:text-4xl md:text-5xl font-bold leading-tight mb-3 font-serif text-gold-200">
          {{ t('pages.tarot.heroTitle') }}
        </h1>
        <p class="text-gray-500 text-sm sm:text-base">{{ t('pages.tarot.heroSub') }}</p>
      </div>

      <!-- Quota info -->
      <div class="flex items-center gap-3 px-5 py-2 rounded-full bg-gold-500/4 border border-gold-500/10 mb-8 animate-fade-in-up anim-delay-1 text-sm">
        <span class="text-gray-400">{{ t('pages.tarot.quotaRemaining') }}</span>
        <strong class="text-gold-300">{{ remaining }}</strong>
        <RouterLink
          v-if="!isLoggedIn"
          :to="{ path: '/login', query: { redirect: route.fullPath } }"
          class="text-gold-400 text-xs hover:text-gold-300 transition-colors"
        >{{ t('nav.loginMore') }}</RouterLink>
        <span v-else-if="isVip" class="text-amber-400/70 text-xs">{{ t('pages.tarot.quotaVip') }}</span>
      </div>
    </section>

    <!-- Readers Grid -->
    <section class="w-full max-w-6xl mx-auto px-4 pb-20">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <div v-for="readerItem in readers" :key="readerItem.id" class="reader-select-card flex flex-col">
          <div class="flex items-center gap-4 mb-4">
            <ReaderAvatarMedia :reader="readerItem" />
            <div class="min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <span class="badge" :class="readerItem.accessLevel === 'free' ? 'badge-free' : 'badge-vip'">{{ readerItem.badge }}</span>
                <span class="badge" :class="readerItem.accessLevel === 'free' ? 'badge-free' : 'badge-vip'">{{ readerItem.label }}</span>
              </div>
              <h3 class="text-base font-serif text-gold-200">{{ readerItem.name }}</h3>
            </div>
          </div>
          <p class="text-gray-500 text-sm leading-relaxed flex-1">{{ readerItem.desc }}</p>
          <div class="flex items-center justify-between mt-4 pt-4 border-t border-gold-500/6">
            <button
              class="px-6 py-2.5 rounded-full text-sm font-medium transition-all cursor-pointer active:scale-95"
              :class="readerItem.accessLevel === 'free'
                ? 'bg-gradient-to-r from-gold-500 to-gold-600 text-abyss hover:shadow-lg hover:shadow-gold-500/15 hover:from-gold-400 hover:to-gold-500'
                : 'bg-gradient-to-r from-amber-600 to-yellow-500 text-white hover:shadow-lg hover:shadow-amber-500/15'"
              @click="selectReader(readerItem.id, readerItem.accessLevel)"
            >
              {{ readerItem.accessLevel === 'free' ? t('pages.tarot.selectFree') : t('pages.tarot.selectVip') }}
            </button>
            <span class="text-gray-600 text-xs">{{ readerItem.likes }} {{ t('pages.tarot.picksSuffix') }}</span>
          </div>
        </div>
      </div>
    </section>

    <!-- Tips -->
    <section class="w-full max-w-3xl mx-auto px-4 py-12 reveal-on-scroll">
      <h2 class="text-xl font-serif text-gold-200 mb-5">{{ t('pages.tarot.tipsTitle') }}</h2>
      <FaqAccordion :items="noticeFaq" />
    </section>

    <!-- Related links -->
    <section class="w-full max-w-3xl mx-auto px-4 py-10 reveal-on-scroll">
      <p class="text-gray-600 text-sm">
        {{ t('pages.tarot.relatedIntro') }}
        <RouterLink to="/daily-fortune" class="text-gold-400 hover:text-gold-300 transition-colors">{{ t('pages.tarot.relatedDaily') }}</RouterLink>
        {{ t('pages.tarot.relatedOr') }}
        <RouterLink to="/yes-no-tarot" class="text-gold-400 hover:text-gold-300 transition-colors">{{ t('pages.tarot.relatedYesNo') }}</RouterLink>
      </p>
    </section>
  </div>
</template>
