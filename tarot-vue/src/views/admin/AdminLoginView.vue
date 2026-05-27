<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import ShieldCheck from '@icons/shield-check.vue'
import LogIn from '@icons/log-in.vue'
import adminApi, { setAdminToken } from '../../services/adminApi'
import { formatAdminApiError } from '../../utils/adminApiError'

const router = useRouter()
const { t } = useI18n()
const username = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')
const adminName = ref('')

async function onLogin() {
  loading.value = true
  error.value = ''
  try {
    const res = await adminApi.post('/auth/login', {
      username: username.value.trim(),
      password: password.value,
    })
    const data = res.data?.data
    if (!data?.accessToken) throw new Error(t('pages.adminLogin.errNoToken'))
    setAdminToken(data.accessToken)
    adminName.value = data.admin?.displayName || 'Admin'
    localStorage.setItem('admin_display_name', adminName.value)
    await router.replace('/admin')
  } catch (e) {
    error.value = formatAdminApiError(e, t('pages.adminLogin.errLoginFail'))
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-[#07060e] flex items-center justify-center px-4">
    <div class="w-full max-w-sm">
      <div class="text-center mb-8">
        <div class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-gold-500 to-gold-600 mb-4 shadow-lg shadow-gold-500/15 text-[#07060e]">
          <ShieldCheck :size="32" />
        </div>
        <h1 class="text-xl text-gold-200 font-semibold tracking-wide">{{ t('pages.adminLogin.title') }}</h1>
        <p class="text-gray-600 text-sm mt-1">{{ t('pages.adminLogin.subtitle') }}</p>
      </div>
      <div class="rounded-2xl border border-gold-500/8 bg-[#0c0a16] p-6">
        <form class="space-y-4" @submit.prevent="onLogin">
          <div>
            <label for="admin-login-username" class="block text-sm text-gray-500 mb-1.5">{{ t('pages.adminLogin.username') }}</label>
            <input id="admin-login-username" v-model="username" autocomplete="username" class="w-full rounded-lg px-4 py-2.5 bg-white/3 border border-gold-500/8 text-gray-200 placeholder-gray-700 focus:border-gold-400/40 focus:shadow-[0_0_0_2px_rgba(212,168,83,.06)] focus:outline-none transition-all" :placeholder="t('pages.adminLogin.usernamePh')" />
          </div>
          <div>
            <label for="admin-login-password" class="block text-sm text-gray-500 mb-1.5">{{ t('pages.adminLogin.password') }}</label>
            <input id="admin-login-password" v-model="password" type="password" autocomplete="current-password" class="w-full rounded-lg px-4 py-2.5 bg-white/3 border border-gold-500/8 text-gray-200 placeholder-gray-700 focus:border-gold-400/40 focus:shadow-[0_0_0_2px_rgba(212,168,83,.06)] focus:outline-none transition-all" :placeholder="t('pages.adminLogin.passwordPh')" />
          </div>
          <p v-if="error" role="alert" class="text-sm text-red-400 bg-red-500/8 rounded-lg px-3 py-2 border border-red-500/10">{{ error }}</p>
          <button type="submit" :disabled="loading" class="w-full inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 bg-gradient-to-r from-gold-500 to-gold-600 text-[#07060e] font-semibold disabled:opacity-50 transition-all hover:shadow-lg hover:shadow-gold-500/15">
            <LogIn v-if="!loading" :size="18" />
            {{ loading ? t('pages.adminLogin.loggingIn') : t('pages.adminLogin.login') }}
          </button>
        </form>
      </div>
      <p class="text-center text-gray-700 text-xs mt-6">{{ t('pages.adminLogin.footer') }}</p>
    </div>
  </div>
</template>
