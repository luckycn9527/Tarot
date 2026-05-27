<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import QuestionForm from '../components/QuestionForm.vue'
import { sanitizeInput } from '../utils/sanitize'
import { StorageKeys, storageRemoveRawAndLegacy, storageSet } from '@/utils/storage'

const router = useRouter()
const { t, tm } = useI18n()

const examples = computed(() => tm('pages.yesNoThree.examples') as { category: string; items: string[] }[])
const positions = computed(() => tm('pages.yesNoThree.positions') as { name: string; color: string; desc: string }[])

function handleSubmit(question: string) {
  storageRemoveRawAndLegacy(StorageKeys.YES_NO_THREE_RESULT, 'threeCardReadingResult')
  storageRemoveRawAndLegacy(StorageKeys.YES_NO_THREE_CARDS, 'threeCardSelectedCards')
  storageRemoveRawAndLegacy(StorageKeys.YES_NO_THREE_ORIENTS, 'threeCardOrientations')
  try {
    localStorage.removeItem('userQuestion')
  } catch {
    /* ignore */
  }
  storageSet(StorageKeys.YES_NO_USER_Q, sanitizeInput(question))

  setTimeout(() => {
    router.push('/yes-no-tarot/three-cards/result')
  }, 800)
}
</script>

<template>
  <div class="relative z-10">
    <section class="w-full flex flex-col items-center justify-center px-4 pt-24 pb-8 text-center">
      <div class="animate-fade-in-up">
        <h1 class="text-3xl sm:text-4xl md:text-5xl font-bold font-serif mb-4">
          <span class="text-gold-200">{{ t('pages.yesNoThree.titleGold') }}</span><span class="text-ethereal">{{ t('pages.yesNoThree.titleRest') }}</span>
        </h1>
        <p class="text-gray-500 text-lg">{{ t('pages.yesNoThree.sub') }}</p>
      </div>
    </section>

    <section class="w-full max-w-3xl mx-auto px-4 py-8">
      <QuestionForm
        :title="t('pages.yesNoThree.formTitle')"
        :placeholder="t('pages.yesNoThree.placeholder')"
        image-url="https://cdn.tarotqa.com/images-optimized/landing/Yes-No-Three-Card-Spread.webp"
        image-alt="Three Card Reading"
        :examples="examples"
        @submit="handleSubmit"
      />
    </section>

    <section class="w-full max-w-3xl mx-auto px-4 py-8">
      <h3 class="text-lg font-serif text-gold-200 mb-4 text-center">{{ t('pages.yesNoThree.positionsTitle') }}</h3>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div v-for="(position, posIndex) in positions" :key="posIndex" class="card-panel p-4 text-center">
          <div class="w-10 h-10 mx-auto rounded-full flex items-center justify-center mb-3 text-white font-bold font-serif bg-gradient-to-br" :class="position.color">
            {{ posIndex + 1 }}
          </div>
          <h4 class="text-gold-200 font-serif font-semibold text-sm mb-1">{{ position.name }}</h4>
          <p class="text-gray-500 text-xs">{{ position.desc }}</p>
        </div>
      </div>
    </section>

    <section class="w-full max-w-3xl mx-auto px-4 py-8 text-center">
      <RouterLink to="/yes-no-tarot" class="text-gold-400 hover:text-gold-300 text-sm transition-colors">
        {{ t('pages.yesNoThree.back') }}
      </RouterLink>
    </section>
  </div>
</template>
