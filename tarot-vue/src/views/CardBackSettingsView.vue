<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuth } from '../composables/useAuth'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from '../composables/useToast'
import api from '../services/api'
import { useUserResourcesStore } from '../stores/userResources'
import { loadReferenceBundle, cardBacksList } from '../services/referenceBootstrap'
import defaultCardBack from '../assets/back/pocket.png'
import { publicAssetUrl } from '../utils/publicAssetUrl'
import AppSpinner from '../components/ui/AppSpinner.vue'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const { isLoggedIn, isInitialized } = useAuth()
const toast = useToast()
const userResources = useUserResourcesStore()

const selectedBack = ref('pocket')
const refreshing = ref(false)

const cardBacks = computed(() => {
  if (cardBacksList.value.length > 0) return cardBacksList.value
  return [{ code: 'pocket', name: t('pages.cardBack.defaultName'), description: null, assetUrl: null, accessType: 'free' as const, price: null }]
})

const isVip = computed(() => userResources.isVip)

function canSelect(back: (typeof cardBacks.value)[0]): boolean {
  if (back.accessType === 'free') return true
  if (back.accessType === 'vip' && isVip.value) return true
  return false
}

function accessLabel(type: string): string {
  if (type === 'vip') return t('pages.cardBack.accessVip')
  if (type === 'paid') return t('pages.cardBack.accessPaid')
  return ''
}

function getPreviewSrc(back: (typeof cardBacks.value)[0]): string {
  if (!back.assetUrl) return defaultCardBack
  return publicAssetUrl(back.assetUrl)
}

async function loadSettings() {
  refreshing.value = true
  try {
    await loadReferenceBundle()
    await userResources.fetchSettings(true)
    selectedBack.value = userResources.settings?.cardBack || 'pocket'
  } catch {
    toast.error(t('pages.cardBack.loadError'))
  } finally {
    refreshing.value = false
  }
}

async function saveSettings() {
  try {
    await api.put('/user/settings', { cardBack: selectedBack.value })
    await userResources.fetchSettings(true)
    toast.success(t('pages.cardBack.saveOk'))
  } catch {
    toast.error(t('pages.cardBack.saveFail'))
  }
}

function selectBack(code: string, back: (typeof cardBacks.value)[0]) {
  if (!canSelect(back)) {
    if (back.accessType === 'vip') toast.error(t('pages.cardBack.vipOnly'))
    else toast.error(t('pages.cardBack.needPurchase'))
    return
  }
  selectedBack.value = code
  void saveSettings()
}

/** 等 initSession 完成再判断登录，避免刷新时误判未登录 → 白屏/错跳 */
watch(
  [isInitialized, isLoggedIn],
  ([init, logged]) => {
    if (!init) return
    if (!logged) {
      void router.replace({ path: '/login', query: { redirect: route.fullPath } })
      return
    }
    void loadSettings()
  },
  { immediate: true },
)
</script>

<template>
  <div class="min-h-screen bg-gradient-to-b from-void via-obsidian to-void pt-20 pb-12 px-4">
    <div class="max-w-3xl mx-auto">
      <div class="text-center mb-8">
        <h1 class="text-2xl font-bold font-serif text-white mb-2">{{ t('pages.cardBack.title') }}</h1>
        <p class="text-gray-400 text-sm">{{ t('pages.cardBack.subtitle') }}</p>
      </div>

      <AppSpinner v-if="refreshing" />

      <div v-else class="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <button
          v-for="back in cardBacks"
          :key="back.code"
          type="button"
          class="relative group rounded-2xl overflow-hidden border-2 transition-all aspect-[3/4]"
          :class="[
            selectedBack === back.code
              ? 'border-gold-500 shadow-lg shadow-gold-500/20'
              : canSelect(back)
                ? 'border-gold-500/10 hover:border-gold-500/30'
                : 'border-white/5 opacity-60 cursor-not-allowed',
          ]"
          @click="selectBack(back.code, back)"
        >
          <img
            :src="getPreviewSrc(back)"
            :alt="back.name"
            class="absolute inset-0 w-full h-full object-cover"
          />

          <div
            v-if="back.accessType !== 'free'"
            class="absolute top-2 left-2 px-2 py-0.5 rounded-md text-xs font-semibold"
            :class="back.accessType === 'vip'
              ? 'bg-amber-500/90 text-black'
              : 'bg-emerald-500/90 text-black'"
          >
            {{ accessLabel(back.accessType) }}
            <span v-if="back.accessType === 'paid' && back.price">¥{{ back.price }}</span>
          </div>

          <div
            v-if="!canSelect(back)"
            class="absolute inset-0 bg-black/40 flex items-center justify-center"
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" class="opacity-70">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
          </div>

          <div
            v-if="selectedBack === back.code"
            class="absolute top-2 right-2 w-6 h-6 bg-gold-500 rounded-full flex items-center justify-center"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12" /></svg>
          </div>

          <div class="absolute bottom-0 inset-x-0 bg-gradient-to-t from-abyss/90 to-transparent p-3">
            <p class="text-white text-sm font-medium">{{ back.name }}</p>
            <p v-if="back.description" class="text-white/50 text-xs mt-0.5 line-clamp-1">{{ back.description }}</p>
          </div>
        </button>
      </div>

      <div class="mt-8 text-center">
        <p class="text-gray-500 text-xs">{{ t('pages.cardBack.hintAutoSave') }}</p>
      </div>

      <div class="mt-8 text-center">
        <RouterLink to="/profile" class="text-gold-400 hover:text-gold-300 text-sm transition-colors">
          {{ t('pages.cardBack.backProfile') }}
        </RouterLink>
      </div>
    </div>
  </div>
</template>
