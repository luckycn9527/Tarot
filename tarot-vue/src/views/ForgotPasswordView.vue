<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Mail from '@icons/mail.vue'
import { useAuth } from '@/composables/useAuth'

const router = useRouter()
const { t } = useI18n()
const { requestPasswordReset } = useAuth()

const email = ref('')
const submitting = ref(false)
const done = ref(false)
const message = ref('')

async function submit() {
  message.value = ''
  if (!email.value.trim()) {
    message.value = t('pages.forgotPassword.emailRequired')
    return
  }
  submitting.value = true
  try {
    const r = await requestPasswordReset(email.value)
    if (r.ok) {
      done.value = true
    }
    message.value = r.message
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="relative z-10 flex items-center justify-center min-h-[calc(100vh-56px)] px-4 py-12">
    <div class="login-card animate-fade-in-up w-full max-w-md">
      <div class="text-center mb-8">
        <h1 class="text-2xl font-bold font-serif text-white mb-2">{{ t('pages.forgotPassword.heroTitle') }}</h1>
        <p class="text-gray-400 text-sm">{{ t('pages.forgotPassword.heroSub') }}</p>
      </div>

      <form v-if="!done" @submit.prevent="submit">
        <div class="space-y-4">
          <div>
            <div class="relative">
              <Mail class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" :size="16" />
              <input
                v-model="email"
                type="email"
                autocomplete="email"
                :placeholder="t('pages.forgotPassword.emailPh')"
                class="login-input pl-11"
              >
            </div>
          </div>
        </div>
        <p v-if="message" class="text-amber-400/90 text-xs mt-3">{{ message }}</p>
        <button
          type="submit"
          :disabled="submitting"
          class="w-full mt-6 py-3 rounded-xl cta-button text-white font-semibold hover:shadow-lg hover:shadow-gold-500/30 transition-all disabled:opacity-50"
        >
          {{ submitting ? t('pages.forgotPassword.submitting') : t('pages.forgotPassword.submit') }}
        </button>
      </form>

      <div v-else class="text-center space-y-4">
        <p class="text-gray-300 text-sm leading-relaxed">{{ message }}</p>
        <RouterLink to="/login" class="inline-block text-gold-400 hover:text-gold-300 text-sm">
          {{ t('pages.forgotPassword.backLogin') }}
        </RouterLink>
      </div>

      <div v-if="!done" class="mt-6 text-center">
        <button type="button" class="text-gray-500 text-sm hover:text-gray-400" @click="router.push('/login')">
          {{ t('pages.forgotPassword.cancel') }}
        </button>
      </div>
    </div>
  </div>
</template>
