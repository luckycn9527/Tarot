<script setup lang="ts">
import { ref, computed, nextTick, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Lock from '@icons/lock.vue'
import Eye from '@icons/eye.vue'
import EyeOff from '@icons/eye-off.vue'
import { useAuth } from '@/composables/useAuth'
import { MOBILE_PASSWORD_RETURN_URL, supportsAndroidPasswordReturn } from '@/mobile/mobilePasswordReturnModel'

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
const androidReturn = ref(false)
const appReturnAttempted = ref(false)
const successPanel = ref<HTMLElement | null>(null)

onMounted(() => {
  const q = route.query.token
  token.value = typeof q === 'string' ? q : ''
  androidReturn.value = supportsAndroidPasswordReturn(navigator.userAgent)
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
      // The token has been used. Do not retain it in the page or forward any
      // part of this query to the app's parameter-free return signal.
      token.value = ''; newPassword.value = ''; confirmPassword.value = ''
      await router.replace({ path: '/reset-password', query: {} }).catch(() => {})
      await nextTick(); successPanel.value?.focus()
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

      <div v-if="success" ref="successPanel" class="reset-success text-center text-sm py-4" role="status" tabindex="-1">
        <p class="text-green-400/90">{{ t('pages.resetPassword.success') }}</p>
        <p class="reset-success-note">{{ t('pages.resetPassword.returnHint') }}</p>
        <a v-if="androidReturn" :href="MOBILE_PASSWORD_RETURN_URL" rel="noreferrer" class="reset-app-return cta-button" @click="appReturnAttempted = true">{{ t('pages.resetPassword.returnApp') }}</a>
        <p v-if="appReturnAttempted" class="reset-success-note">{{ t('pages.resetPassword.returnFallback') }}</p>
        <RouterLink to="/login" class="reset-web-login">{{ t('pages.resetPassword.webLogin') }}</RouterLink>
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

      <div v-if="!success" class="mt-6 text-center">
        <RouterLink to="/login" class="text-gold-400 hover:text-gold-300 text-sm">{{ t('pages.resetPassword.backLogin') }}</RouterLink>
      </div>
    </div>
  </div>
</template>

<style scoped>
.reset-success-note { margin: 14px 0 0; color: #b6adbf; line-height: 1.8; overflow-wrap: anywhere; }
.reset-success { outline: none; }
.reset-app-return { display: flex; align-items: center; justify-content: center; min-height: 48px; margin-top: 22px; padding: 12px 16px; border-radius: 12px; color: #fff; font-weight: 600; line-height: 1.5; }
.reset-web-login { display: flex; align-items: center; justify-content: center; min-height: 48px; margin-top: 12px; padding: 10px 14px; border: 1px solid #cbb0ed44; border-radius: 12px; color: #d5b8f0; line-height: 1.5; }
.reset-success a:focus-visible { outline: 2px solid #cbb0ed; outline-offset: 4px; }
</style>
