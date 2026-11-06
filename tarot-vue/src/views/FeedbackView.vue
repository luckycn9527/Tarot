<script setup lang="ts">
import { reactive, computed, toRefs, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useScrollReveal } from '../composables/useScrollReveal'
import FaqAccordion from '../components/FaqAccordion.vue'
import api from '../services/api'
import { LegacyKeys, StorageKeys, storageGetJson, storageSetJson } from '@/utils/storage'
import { createFeedbackState, createFeedbackSubmitter, FEEDBACK_LIMITS, isValidFeedback, type FeedbackRecord } from '@/utils/feedbackSubmission'
import { useAuthStore } from '@/stores/auth'
import { getSessionScope, isCurrentSession } from '@/utils/sessionScope'

useScrollReveal()

const { t, tm, locale } = useI18n()

const auth = useAuthStore()
const readHistory = () => storageGetJson<unknown>(StorageKeys.FEEDBACK_HISTORY, LegacyKeys.feedbacks)
const state = reactive(createFeedbackState(readHistory()))
const { feedbackType, email, content, isSubmitting, outcome, localSaved, validation, history: feedbacks } = toRefs(state)
let nextId = 0
const { submit: handleSubmit, restoreDraft, resetSession } = createFeedbackSubmitter(state, {
  send: async payload => (await api.post('/feedback', payload)).data,
  writeHistory: records => storageSetJson(StorageKeys.FEEDBACK_HISTORY, records),
  readHistory,
  createId: () => globalThis.crypto?.randomUUID?.() ?? `feedback-${Date.now()}-${++nextId}`,
  captureScope: () => {
    const scope = getSessionScope()
    return () => isCurrentSession(scope)
  },
})
watch(() => auth.user?.id ?? null, () => resetSession(readHistory()), { flush: 'sync' })
const canSubmit = computed(() => isValidFeedback(state))

const feedbackTypes = computed(() => tm('pages.feedback.types') as { value: string; label: string }[])
const faqItems = computed(() => tm('pages.feedback.faq') as { question: string; answer: string }[])

const messages = computed(() => String(locale.value).startsWith('zh') ? {
  sending: '正在提交…', sent: '服务器已确认收到反馈。',
  failedSaved: '未收到服务器成功确认，内容已保存为本机草稿。您可以手动重试，不会自动发送。',
  failedUnsaved: '未收到服务器成功确认，本机草稿也未能保存。内容仍在表单中，请保留本页或复制内容后重试。',
  uncertain: '网络中断时反馈也可能已经送达，重试可能产生重复反馈。',
  historyUnsaved: '服务器已收到反馈，但本机历史记录保存失败，请勿重复提交。',
  sentBadge: '已确认送达', unsentBadge: '未确认送达', unknownBadge: '旧记录 · 送达状态未知',
  restore: '载入草稿', contentLimit: '请输入10–2000个字。', contactLimit: '联系方式不能超过100个字符。',
  historyNote: '此处展示本机记录；只有“已确认送达”表示收到服务器成功确认。',
} : {
  sending: 'Sending…', sent: 'The server confirmed receipt of your feedback.',
  failedSaved: 'No success confirmation was received. A draft was saved on this device. Retry manually; drafts are never sent automatically.',
  failedUnsaved: 'No success confirmation was received and the local draft could not be saved. Your text is still in the form. Keep this page open or copy it before retrying.',
  uncertain: 'A connection loss can occur after delivery; retrying may send the same feedback twice.',
  historyUnsaved: 'The server received your feedback, but local history could not be saved. Please do not submit it again.',
  sentBadge: 'Delivery confirmed', unsentBadge: 'Delivery unconfirmed', unknownBadge: 'Old record · delivery unknown',
  restore: 'Load draft', contentLimit: 'Enter 10–2000 characters.', contactLimit: 'Contact details must be at most 100 characters.',
  historyNote: 'These are local records. Only “Delivery confirmed” means the server acknowledged receipt.',
})

function clearNotice() {
  if (isSubmitting.value) return
  outcome.value = 'idle'
  validation.value = null
}

function formatTime(record: FeedbackRecord) {
  const date = new Date(record.time)
  return Number.isNaN(date.getTime()) ? record.time : date.toLocaleString(String(locale.value))
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
      <form class="p-6 sm:p-8 rounded-2xl card-panel border border-gold-500/10" :aria-busy="isSubmitting" @submit.prevent="handleSubmit">
        <h2 class="text-lg font-bold font-serif text-white mb-6">{{ t('pages.feedback.formTitle') }}</h2>

        <!-- Type -->
        <div class="mb-6">
          <label class="block text-gray-300 text-sm mb-2">{{ t('pages.feedback.typeLabel') }}</label>
          <div class="flex flex-wrap gap-3">
            <button
              v-for="opt in feedbackTypes"
              :key="opt.value"
              type="button"
              :disabled="isSubmitting"
              class="px-4 py-2 rounded-full text-sm transition-all border"
              :class="feedbackType === opt.value ? 'bg-gradient-to-r from-gold-500 to-gold-600 text-abyss border-gold-400' : 'bg-white/4 border-gold-500/10 text-gray-400 hover:border-gold-500/30'"
              @click="feedbackType = opt.value; clearNotice()"
            >
              {{ opt.label }}
            </button>
          </div>
        </div>

        <!-- Email -->
        <div class="mb-6">
          <label for="feedback-email" class="block text-gray-300 text-sm mb-2">{{ t('pages.feedback.emailLabel') }} <span class="text-gray-500">{{ t('pages.feedback.emailHint') }}</span></label>
          <input
            id="feedback-email"
            v-model="email"
            type="email"
            :maxlength="FEEDBACK_LIMITS.maxContact"
            :disabled="isSubmitting"
            @input="clearNotice"
            :placeholder="t('pages.feedback.emailPlaceholder')"
            class="w-full px-4 py-3 rounded-xl bg-white/4 border border-gold-500/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-gold-400 transition-colors"
          >
        </div>

        <!-- Content -->
        <div class="mb-6">
          <label for="feedback-content" class="block text-gray-300 text-sm mb-2">{{ t('pages.feedback.contentLabel') }} <span class="text-gray-500">{{ t('pages.feedback.contentHint') }}</span></label>
          <textarea
            id="feedback-content"
            v-model="content"
            rows="5"
            required
            :minlength="FEEDBACK_LIMITS.minContent"
            :maxlength="FEEDBACK_LIMITS.maxContent"
            :disabled="isSubmitting"
            @input="clearNotice"
            :placeholder="t('pages.feedback.contentPlaceholder')"
            class="w-full px-4 py-3 rounded-xl bg-white/4 border border-gold-500/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-gold-400 transition-colors resize-none"
          ></textarea>
          <p class="text-gray-500 text-xs mt-1 text-right">{{ content.length }}/{{ FEEDBACK_LIMITS.maxContent }} {{ t('pages.feedback.charUnit') }}</p>
        </div>

        <!-- Submit -->
        <button
          type="submit"
          class="w-full py-3 rounded-full font-semibold text-white transition-all"
          :class="outcome === 'sent' ? 'bg-emerald-600' : 'cta-button hover:shadow-lg hover:shadow-gold-500/30 disabled:opacity-50'"
          :disabled="isSubmitting || !canSubmit"
        >
          {{ isSubmitting ? messages.sending : outcome === 'sent' ? t('pages.feedback.submitDone') : t('pages.feedback.submit') }}
        </button>
        <p v-if="isSubmitting || outcome === 'sent'" role="status" aria-live="polite" class="mt-3 text-sm text-emerald-300">{{ isSubmitting ? messages.sending : messages.sent }}</p>
        <div v-if="outcome === 'failed'" role="alert" class="mt-3 text-sm text-amber-200">
          <p>{{ localSaved ? messages.failedSaved : messages.failedUnsaved }}</p>
          <p class="mt-1">{{ messages.uncertain }}</p>
        </div>
        <p v-if="outcome === 'sent' && localSaved === false" role="status" class="mt-2 text-sm text-amber-200">{{ messages.historyUnsaved }}</p>
        <p v-if="validation" role="alert" class="mt-3 text-sm text-amber-200">{{ validation === 'content' ? messages.contentLimit : messages.contactLimit }}</p>
      </form>
    </section>

    <!-- History -->
    <section v-if="feedbacks.length > 0" class="w-full max-w-2xl mx-auto px-4 pb-12 reveal-on-scroll">
      <h2 class="text-lg font-bold font-serif text-white mb-4">{{ t('pages.feedback.historyTitle') }}</h2>
      <p class="text-gray-500 text-xs mb-4">{{ messages.historyNote }}</p>
      <div class="space-y-3">
        <div
          v-for="fb in feedbacks.slice(0, 5)"
          :key="fb.id"
          class="p-4 rounded-xl card-panel border border-gold-500/10"
        >
          <div class="flex flex-wrap items-center gap-2 mb-2">
            <span class="px-2 py-0.5 rounded-full bg-gold-500/10 border border-gold-500/20 text-gold-300 text-xs">{{ getTypeLabel(fb.type) }}</span>
            <span class="text-gray-500 text-xs">{{ formatTime(fb) }}</span>
            <span class="text-xs" :class="fb.delivery === 'sent' ? 'text-emerald-300' : 'text-amber-200'">{{ fb.delivery === 'sent' ? messages.sentBadge : fb.delivery === 'unsent' ? messages.unsentBadge : messages.unknownBadge }}</span>
          </div>
          <p class="text-gray-400 text-sm line-clamp-2">{{ fb.content }}</p>
          <button v-if="fb.delivery === 'unsent'" type="button" class="mt-2 text-sm text-gold-300 underline" :disabled="isSubmitting" @click="restoreDraft(fb)">{{ messages.restore }}</button>
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
