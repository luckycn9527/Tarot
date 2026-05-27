<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import QuestionForm from '../components/QuestionForm.vue'
import { sanitizeInput } from '../utils/sanitize'
import { StorageKeys, storageRemoveRawAndLegacy, storageSet } from '@/utils/storage'

const router = useRouter()
const { t, tm } = useI18n()

const examples = computed(() => tm('pages.yesNoSingle.examples') as { category: string; items: string[] }[])

function handleSubmit(question: string) {
  storageRemoveRawAndLegacy(StorageKeys.YES_NO_SINGLE_RESULT, 'singleCardReadingResult')
  storageRemoveRawAndLegacy(StorageKeys.YES_NO_SINGLE_CARD, 'singleCardSelectedCard')
  storageRemoveRawAndLegacy(StorageKeys.YES_NO_SINGLE_ORIENT, 'singleCardOrientation')
  try {
    localStorage.removeItem('userQuestion')
  } catch {
    /* ignore */
  }
  storageSet(StorageKeys.YES_NO_USER_Q, sanitizeInput(question))

  setTimeout(() => {
    router.push('/yes-no-tarot/single-card/result')
  }, 800)
}
</script>

<template>
  <div class="relative z-10">
    <section class="w-full flex flex-col items-center justify-center px-4 pt-24 pb-8 text-center">
      <div class="animate-fade-in-up">
        <h1 class="text-3xl sm:text-4xl md:text-5xl font-bold font-serif mb-4">
          <span class="text-gold-200">{{ t('pages.yesNoSingle.titleGold') }}</span><span class="text-ethereal">{{ t('pages.yesNoSingle.titleRest') }}</span>
        </h1>
        <p class="text-gray-500 text-lg">{{ t('pages.yesNoSingle.sub') }}</p>
      </div>
    </section>

    <section class="w-full max-w-3xl mx-auto px-4 py-8">
      <QuestionForm
        :title="t('pages.yesNoSingle.formTitle')"
        :placeholder="t('pages.yesNoSingle.placeholder')"
        image-url="https://cdn.tarotqa.com/images-optimized/landing/Yes-No-Single-Card.webp"
        image-alt="Single Card Reading"
        :examples="examples"
        @submit="handleSubmit"
      />
    </section>

    <section class="w-full max-w-3xl mx-auto px-4 py-8 text-center">
      <RouterLink to="/yes-no-tarot" class="text-gold-400 hover:text-gold-300 text-sm transition-colors">
        {{ t('pages.yesNoSingle.back') }}
      </RouterLink>
    </section>
  </div>
</template>
