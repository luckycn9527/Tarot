<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useScrollReveal } from '../composables/useScrollReveal'
import FaqAccordion from '../components/FaqAccordion.vue'
import api from '../services/api'
import { LegacyKeys, StorageKeys, storageGetJson, storageSetJson } from '@/utils/storage'

useScrollReveal()

const { t, tm, locale } = useI18n()

const feedbackType = ref('suggestion')
const email = ref('')
const content = ref('')
const submitted = ref(false)

const feedbackTypes = computed(() => tm('pages.feedback.types') as { value: string; label: string }[])
const faqItems = computed(() => tm('pages.feedback.faq') as { question: string; answer: string }[])

interface FeedbackRecord {
  type: string
  email: string
  content: string
  time: string
}

function loadFeedbacks(): FeedbackRecord[] {
  const data = storageGetJson<FeedbackRecord[]>(StorageKeys.FEEDBACK_HISTORY, LegacyKeys.feedbacks)
  return Array.isArray(data) ? data : []
}

function saveFeedback(record: FeedbackRecord) {
  const list = loadFeedbacks()
  list.unshift(record)
  storageSetJson(StorageKeys.FEEDBACK_HISTORY, list.slice(0, 20))
}

const feedbacks = ref(loadFeedbacks())

async function handleSubmit() {
  if (!content.value.trim() || content.value.trim().length < 10) return
  const record: FeedbackRecord = {
    type: feedbackType.value,
    email: email.value.trim(),
    content: content.value.trim(),
    time: new Date().toLocaleString(String(locale.value)),
  }
  // Submit to backend
  try {
    await api.post('/feedback', {
      type: feedbackType.value === 'suggestion' ? 'feature' : feedbackType.value === 'content' ? 'other' : feedbackType.value,
      content: content.value.trim(),
      contact: email.value.trim() || undefined,
    })
  } catch {
    // Fallback to local only
  }
  saveFeedback(record)
  feedbacks.value = loadFeedbacks()
  submitted.value = true
  content.value = ''
  email.value = ''
  setTimeout(() => { submitted.value = false }, 3000)
}

function getTypeLabel(value: string) {
  return feedbackTypes.value.find(opt => opt.value === value)?.label ?? value
}
</script>

<template>
  <div class="relative z-10">
    <!-- Hero -->
    <section class="w-full flex flex-col items-center justify-center px-4 pt-24 pb-12 text-center">
      <div class="animate-fade-in-up">
        <h1 class="text-4xl sm:text-5xl font-bold font-serif text-white mb-4">{{ t('pages.feedback.heroTitle') }}</h1>
        <p class="text-gray-400 text-lg">{{ t('pages.feedback.heroSub') }}</p>
      </div>
    </section>

    <!-- Feedback Form -->
    <section class="w-full max-w-2xl mx-auto px-4 pb-12 reveal-on-scroll">
      <div class="p-6 sm:p-8 rounded-2xl card-panel border border-gold-500/10">
        <h2 class="text-lg font-bold font-serif text-white mb-6">{{ t('pages.feedback.formTitle') }}</h2>

        <!-- Type -->
        <div class="mb-6">
          <label class="block text-gray-300 text-sm mb-2">{{ t('pages.feedback.typeLabel') }}</label>
          <div class="flex flex-wrap gap-3">
            <button
              v-for="opt in feedbackTypes"
              :key="opt.value"
              class="px-4 py-2 rounded-full text-sm transition-all border"
              :class="feedbackType === opt.value ? 'bg-gradient-to-r from-gold-500 to-gold-600 text-abyss border-gold-400' : 'bg-white/4 border-gold-500/10 text-gray-400 hover:border-gold-500/30'"
              @click="feedbackType = opt.value"
            >
              {{ opt.label }}
            </button>
          </div>
        </div>

        <!-- Email -->
        <div class="mb-6">
          <label class="block text-gray-300 text-sm mb-2">{{ t('pages.feedback.emailLabel') }} <span class="text-gray-500">{{ t('pages.feedback.emailHint') }}</span></label>
          <input
            v-model="email"
            type="email"
            :placeholder="t('pages.feedback.emailPlaceholder')"
            class="w-full px-4 py-3 rounded-xl bg-white/4 border border-gold-500/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-gold-400 transition-colors"
          >
        </div>

        <!-- Content -->
        <div class="mb-6">
          <label class="block text-gray-300 text-sm mb-2">{{ t('pages.feedback.contentLabel') }} <span class="text-gray-500">{{ t('pages.feedback.contentHint') }}</span></label>
          <textarea
            v-model="content"
            rows="5"
            :placeholder="t('pages.feedback.contentPlaceholder')"
            class="w-full px-4 py-3 rounded-xl bg-white/4 border border-gold-500/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-gold-400 transition-colors resize-none"
          ></textarea>
          <p class="text-gray-500 text-xs mt-1 text-right">{{ content.length }} {{ t('pages.feedback.charUnit') }}</p>
        </div>

        <!-- Submit -->
        <button
          class="w-full py-3 rounded-full font-semibold text-white transition-all"
          :class="submitted ? 'bg-emerald-600' : 'cta-button hover:shadow-lg hover:shadow-gold-500/30'"
          :disabled="submitted"
          @click="handleSubmit"
        >
          {{ submitted ? t('pages.feedback.submitDone') : t('pages.feedback.submit') }}
        </button>
      </div>
    </section>

    <!-- History -->
    <section v-if="feedbacks.length > 0" class="w-full max-w-2xl mx-auto px-4 pb-12 reveal-on-scroll">
      <h2 class="text-lg font-bold font-serif text-white mb-4">{{ t('pages.feedback.historyTitle') }}</h2>
      <div class="space-y-3">
        <div
          v-for="(fb, i) in feedbacks.slice(0, 5)"
          :key="i"
          class="p-4 rounded-xl card-panel border border-gold-500/10"
        >
          <div class="flex items-center gap-2 mb-2">
            <span class="px-2 py-0.5 rounded-full bg-gold-500/10 border border-gold-500/20 text-gold-300 text-xs">{{ getTypeLabel(fb.type) }}</span>
            <span class="text-gray-500 text-xs">{{ fb.time }}</span>
          </div>
          <p class="text-gray-400 text-sm line-clamp-2">{{ fb.content }}</p>
        </div>
      </div>
    </section>

    <!-- FAQ -->
    <section class="w-full max-w-2xl mx-auto px-4 py-12 reveal-on-scroll">
      <h2 class="text-lg font-bold font-serif text-white mb-6 text-center">{{ t('pages.feedback.faqTitle') }}</h2>
      <FaqAccordion :items="faqItems" />
    </section>

    <!-- CTA -->
    <section class="w-full max-w-4xl mx-auto px-4 py-16 text-center reveal-on-scroll">
      <h3 class="text-2xl font-bold font-serif text-white mb-3">{{ t('pages.feedback.thanksTitle') }}</h3>
      <p class="text-gray-400 mb-8">{{ t('pages.feedback.thanksSub') }}</p>
      <RouterLink to="/yes-no-tarot" class="inline-block px-10 py-4 rounded-full cta-button text-white font-semibold text-lg hover:shadow-2xl hover:shadow-gold-500/30 transition-all">{{ t('pages.feedback.ctaHomeReading') }}</RouterLink>
    </section>
  </div>
</template>
