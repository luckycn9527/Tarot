<script setup lang="ts">
import { ref, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import UserRound from '@icons/user-round.vue'
import Mail from '@icons/mail.vue'
import Lock from '@icons/lock.vue'
import Eye from '@icons/eye.vue'
import EyeOff from '@icons/eye-off.vue'
import { useAuth } from '../composables/useAuth'
import { getRegisterFormSchema, formatZodFieldErrors } from '@/schemas/auth'
import { getGoogleClientId, renderGoogleSignInButton, cancelGoogleOneTap } from '@/composables/useGoogleSignIn'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const { register, loginWithGoogle } = useAuth()

const nickname = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const showPassword = ref(false)
const showConfirmPassword = ref(false)

const errors = ref<Record<string, string>>({})
const toastMessage = ref('')
const showToast = ref(false)
const submitting = ref(false)

async function handleRegister() {
  errors.value = {}
  const parsed = getRegisterFormSchema(t).safeParse({
    nickname: nickname.value,
    email: email.value,
    password: password.value,
    confirmPassword: confirmPassword.value,
  })
  if (!parsed.success) {
    errors.value = formatZodFieldErrors(parsed.error)
    return
  }
  submitting.value = true
  try {
    const result = await register({
      nickname: parsed.data.nickname,
      email: parsed.data.email,
      password: parsed.data.password,
      confirmPassword: parsed.data.confirmPassword,
    })
    if (result) {
      if (result.field) {
        errors.value[result.field] = result.message
      } else {
        errors.value.general = result.message
      }
    } else {
      const r = route.query.redirect
      const path = typeof r === 'string' && r.startsWith('/') ? r : '/'
      router.push(path)
    }
  } finally {
    submitting.value = false
  }
}

const googleBtnWrap = ref<HTMLElement | null>(null)

onMounted(async () => {
  await nextTick()
  const el = googleBtnWrap.value
  if (!el || !getGoogleClientId()) return
  try {
    await renderGoogleSignInButton(el, async (idToken) => {
      const result = await loginWithGoogle(idToken)
      if (result) {
        toastMessage.value = result.message
        showToast.value = true
        setTimeout(() => { showToast.value = false }, 4000)
        return
      }
      const r = route.query.redirect
      const path = typeof r === 'string' && r.startsWith('/') ? r : '/'
      await router.push(path)
    })
  } catch {
    toastMessage.value = t('pages.login.googleLoadFail')
    showToast.value = true
    setTimeout(() => { showToast.value = false }, 4000)
  }
})

onBeforeUnmount(() => {
  cancelGoogleOneTap()
})
</script>

<template>
  <div class="relative z-10 flex items-center justify-center min-h-[calc(100vh-56px)] px-4 py-12">
    <div class="login-card animate-fade-in-up">
      <div class="text-center mb-8">
        <h1 class="text-2xl font-bold font-serif text-white mb-2">{{ t('pages.register.heroTitle') }}</h1>
        <p class="text-gray-400 text-sm">{{ t('pages.register.heroSub') }}</p>
      </div>

      <form @submit.prevent="handleRegister">
        <div class="space-y-4">
          <!-- Nickname -->
          <div>
            <div class="relative">
              <UserRound class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" :size="16" />
              <input v-model="nickname" type="text" :placeholder="t('pages.register.nicknamePh')" class="login-input pl-11">
            </div>
            <p v-if="errors.nickname" class="text-red-400 text-xs mt-1 ml-1">{{ errors.nickname }}</p>
          </div>
          <!-- Email -->
          <div>
            <div class="relative">
              <Mail class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" :size="16" />
              <input v-model="email" type="email" :placeholder="t('pages.register.emailPh')" class="login-input pl-11">
            </div>
            <p v-if="errors.email" class="text-red-400 text-xs mt-1 ml-1">{{ errors.email }}</p>
          </div>
          <!-- Password -->
          <div>
            <div class="relative">
              <Lock class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" :size="16" />
              <input v-model="password" :type="showPassword ? 'text' : 'password'" :placeholder="t('pages.register.passwordPh')" class="login-input pl-11 pr-11">
              <button
                type="button"
                class="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-gray-500 hover:text-gold-300/90 transition-colors"
                :aria-label="showPassword ? t('pages.register.hidePassword') : t('pages.register.showPassword')"
                @click="showPassword = !showPassword"
              >
                <Eye v-if="!showPassword" class="w-4 h-4" :size="16" aria-hidden="true" />
                <EyeOff v-else class="w-4 h-4" :size="16" aria-hidden="true" />
              </button>
            </div>
            <p v-if="errors.password" class="text-red-400 text-xs mt-1 ml-1">{{ errors.password }}</p>
          </div>
          <!-- Confirm Password -->
          <div>
            <div class="relative">
              <Lock class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" :size="16" />
              <input v-model="confirmPassword" :type="showConfirmPassword ? 'text' : 'password'" :placeholder="t('pages.register.confirmPh')" class="login-input pl-11 pr-11">
              <button
                type="button"
                class="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-gray-500 hover:text-gold-300/90 transition-colors"
                :aria-label="showConfirmPassword ? t('pages.register.hideConfirmPassword') : t('pages.register.showConfirmPassword')"
                @click="showConfirmPassword = !showConfirmPassword"
              >
                <Eye v-if="!showConfirmPassword" class="w-4 h-4" :size="16" aria-hidden="true" />
                <EyeOff v-else class="w-4 h-4" :size="16" aria-hidden="true" />
              </button>
            </div>
            <p v-if="errors.confirmPassword" class="text-red-400 text-xs mt-1 ml-1">{{ errors.confirmPassword }}</p>
          </div>
        </div>

        <p v-if="errors.general" class="text-red-400 text-xs mt-3 text-center">{{ errors.general }}</p>

        <button type="submit" :disabled="submitting" class="w-full mt-6 py-3 rounded-xl cta-button text-white font-semibold hover:shadow-lg hover:shadow-gold-500/30 transition-all disabled:opacity-50">
          {{ submitting ? t('pages.register.submitting') : t('pages.register.submit') }}
        </button>
      </form>

      <div class="mt-6 text-center">
        <p class="text-gray-400 text-sm">{{ t('pages.register.hasAccount') }}<RouterLink to="/login" class="text-gold-400 hover:text-gold-300 transition-colors">{{ t('pages.register.loginNow') }}</RouterLink></p>
      </div>

      <!-- Social Login -->
      <div class="relative mt-8">
        <div class="absolute inset-0 flex items-center"><div class="w-full border-t border-gold-500/10"></div></div>
        <div class="relative flex justify-center text-sm"><span class="px-4 bg-abyss text-gray-500">{{ t('pages.register.divider') }}</span></div>
      </div>

      <div class="mt-6 flex flex-col items-center gap-2">
        <div ref="googleBtnWrap" class="min-h-[44px] flex justify-center w-full" />
        <p v-if="!getGoogleClientId()" class="text-gray-600 text-xs text-center">{{ t('pages.login.googleDisabledHint') }}</p>
      </div>

      <p class="mt-8 text-center text-gray-600 text-xs leading-relaxed">
        {{ t('pages.register.termsPrefix') }}
        <RouterLink to="/terms" class="text-gold-400 hover:text-gold-300">{{ t('seo.titles.terms') }}</RouterLink>
        {{ t('pages.register.termsMid') }}
        <RouterLink to="/privacy" class="text-gold-400 hover:text-gold-300">{{ t('seo.titles.privacy') }}</RouterLink>
      </p>
    </div>
  </div>

  <!-- Toast -->
  <Transition name="toast">
    <div v-if="showToast" class="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl bg-gold-600/90 backdrop-blur-sm text-abyss text-sm font-medium shadow-lg shadow-gold-500/20">
      {{ toastMessage }}
    </div>
  </Transition>
</template>
