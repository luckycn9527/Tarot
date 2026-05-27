<script setup lang="ts">
import { ref, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Mail from '@icons/mail.vue'
import Lock from '@icons/lock.vue'
import Eye from '@icons/eye.vue'
import EyeOff from '@icons/eye-off.vue'
import { useAuth } from '../composables/useAuth'
import { getLoginFormSchema, formatZodFieldErrors } from '@/schemas/auth'
import { getGoogleClientId, renderGoogleSignInButton, cancelGoogleOneTap } from '@/composables/useGoogleSignIn'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const { login, loginWithGoogle } = useAuth()

const email = ref('')
const password = ref('')
const showPassword = ref(false)
const errors = ref<Record<string, string>>({})
const toastMessage = ref('')
const showToast = ref(false)
const submitting = ref(false)

async function handleLogin() {
  errors.value = {}
  const parsed = getLoginFormSchema(t).safeParse({ email: email.value, password: password.value })
  if (!parsed.success) {
    errors.value = formatZodFieldErrors(parsed.error)
    return
  }
  submitting.value = true
  try {
    const result = await login(parsed.data.email, parsed.data.password)
    if (result) {
      if (result.field) {
        errors.value[result.field] = result.message
      } else {
        errors.value.general = result.message
      }
    } else {
      const r = route.query.redirect
      const path = typeof r === 'string' && r.startsWith('/') ? r : '/'
      await nextTick()
      await router.push(path)
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
        <h1 class="text-2xl font-bold font-serif text-white mb-2">{{ t('pages.login.heroTitle') }}</h1>
        <p class="text-gray-400 text-sm">{{ t('pages.login.heroSub') }}</p>
      </div>

      <form @submit.prevent="handleLogin">
        <div class="space-y-4">
          <!-- Email -->
          <div>
            <div class="relative">
              <Mail class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" :size="16" />
              <input v-model="email" type="email" :placeholder="t('pages.login.emailPh')" class="login-input pl-11">
            </div>
            <p v-if="errors.email" class="text-red-400 text-xs mt-1 ml-1">{{ errors.email }}</p>
          </div>
          <!-- Password -->
          <div>
            <div class="relative">
              <Lock class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" :size="16" />
              <input
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                :placeholder="t('pages.login.passwordPh')"
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
            <p v-if="errors.password" class="text-red-400 text-xs mt-1 ml-1">{{ errors.password }}</p>
          </div>
        </div>

        <p v-if="errors.general" class="text-red-400 text-xs mt-3 text-center">{{ errors.general }}</p>

        <div class="flex items-center justify-between mt-4">
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" class="w-4 h-4 rounded bg-white/4 border-white/20 text-gold-600 focus:ring-gold-400 focus:ring-offset-0">
            <span class="text-gray-400 text-sm">{{ t('pages.login.remember') }}</span>
          </label>
          <RouterLink to="/forgot-password" class="text-gold-400/90 text-sm hover:text-gold-300 transition-colors">
            {{ t('pages.login.forgot') }}
          </RouterLink>
        </div>

        <button type="submit" :disabled="submitting" class="w-full mt-6 py-3 rounded-xl cta-button text-white font-semibold hover:shadow-lg hover:shadow-gold-500/30 transition-all disabled:opacity-50">
          {{ submitting ? t('pages.login.submitting') : t('pages.login.submit') }}
        </button>
      </form>

      <div class="mt-6 text-center">
        <p class="text-gray-400 text-sm">{{ t('pages.login.noAccount') }}<RouterLink to="/register" class="text-gold-400 hover:text-gold-300 transition-colors">{{ t('pages.login.registerNow') }}</RouterLink></p>
      </div>

      <!-- Social Login -->
      <div class="relative mt-8">
        <div class="absolute inset-0 flex items-center"><div class="w-full border-t border-gold-500/10"></div></div>
        <div class="relative flex justify-center text-sm"><span class="px-4 bg-abyss text-gray-500">{{ t('pages.login.divider') }}</span></div>
      </div>

      <div class="mt-6 flex flex-col items-center gap-2">
        <div ref="googleBtnWrap" class="min-h-[44px] flex justify-center w-full" />
        <p v-if="!getGoogleClientId()" class="text-gray-600 text-xs text-center">{{ t('pages.login.googleDisabledHint') }}</p>
      </div>

      <p class="mt-8 text-center text-gray-600 text-xs leading-relaxed">
        {{ t('pages.login.termsPrefix') }}
        <RouterLink to="/terms" class="text-gold-400 hover:text-gold-300">{{ t('seo.titles.terms') }}</RouterLink>
        {{ t('pages.login.termsMid') }}
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
