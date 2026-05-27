<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Lock from '@icons/lock.vue'
import Eye from '@icons/eye.vue'
import EyeOff from '@icons/eye-off.vue'
import { useAuth } from '@/composables/useAuth'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const { resetPasswordWithToken } = useAuth()

const token = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const showPassword = ref(false)
const submitting = ref(false)
const error = ref('')
const success = ref(false)

onMounted(() => {
  const q = route.query.token
  token.value = typeof q === 'string' ? q : ''
})

const canSubmit = computed(() => token.value.length >= 32 && newPassword.value.length >= 6 && newPassword.value === confirmPassword.value)

async function submit() {
  error.value = ''
  if (!canSubmit.value) {
    if (newPassword.value !== confirmPassword.value) {
      error.value = t('pages.resetPassword.mismatch')
    } else if (token.value.length < 32) {
      error.value = t('pages.resetPassword.badToken')
    } else {
      error.value = t('pages.resetPassword.weak')
    }
    return
  }
  submitting.value = true
  try {
    const r = await resetPasswordWithToken(token.value, newPassword.value)
    if (r.ok) {
      success.value = true
      setTimeout(() => router.push('/login'), 2000)
    } else {
      error.value = r.message
    }
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="relative z-10 flex items-center justify-center min-h-[calc(100vh-56px)] px-4 py-12">
    <div class="login-card animate-fade-in-up w-full max-w-md">
      <div class="text-center mb-8">
        <h1 class="text-2xl font-bold font-serif text-white mb-2">{{ t('pages.resetPassword.heroTitle') }}</h1>
        <p class="text-gray-400 text-sm">{{ t('pages.resetPassword.heroSub') }}</p>
      </div>

      <div v-if="success" class="text-center text-green-400/90 text-sm py-4">
        {{ t('pages.resetPassword.success') }}
      </div>

      <form v-else @submit.prevent="submit">
        <div class="space-y-4">
          <div>
            <div class="relative">
              <Lock class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" :size="16" />
              <input
                v-model="newPassword"
                :type="showPassword ? 'text' : 'password'"
                autocomplete="new-password"
                :placeholder="t('pages.resetPassword.newPh')"
                class="login-input pl-11 pr-11"
              >
              <button
                type="button"
                class="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-gray-500 hover:text-gold-300/90 transition-colors"
                :aria-label="showPassword ? t('pages.login.hidePassword') : t('pages.login.showPassword')"
                @click="showPassword = !showPassword"
              >
                <Eye v-if="!showPassword" class="w-4 h-4" :size="16" aria-hidden="true" />
                <EyeOff v-else class="w-4 h-4" :size="16" aria-hidden="true" />
              </button>
            </div>
          </div>
          <div>
            <div class="relative">
              <Lock class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" :size="16" />
              <input
                v-model="confirmPassword"
                :type="showPassword ? 'text' : 'password'"
                autocomplete="new-password"
                :placeholder="t('pages.resetPassword.confirmPh')"
                class="login-input pl-11"
              >
            </div>
          </div>
        </div>
        <p v-if="error" class="text-red-400 text-xs mt-3">{{ error }}</p>
        <button
          type="submit"
          :disabled="submitting"
          class="w-full mt-6 py-3 rounded-xl cta-button text-white font-semibold hover:shadow-lg hover:shadow-gold-500/30 transition-all disabled:opacity-50"
        >
          {{ submitting ? t('pages.resetPassword.submitting') : t('pages.resetPassword.submit') }}
        </button>
      </form>

      <div class="mt-6 text-center">
        <RouterLink to="/login" class="text-gold-400 hover:text-gold-300 text-sm">{{ t('pages.resetPassword.backLogin') }}</RouterLink>
      </div>
    </div>
  </div>
</template>
