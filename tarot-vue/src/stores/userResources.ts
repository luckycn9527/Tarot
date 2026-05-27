import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/services/api'
import { CACHE_TTL_MS, isFresh } from '@/stores/cacheTtl'

const DAILY_LIMIT = 3

interface QuotaState {
  remaining: number
  total: number
  isVip: boolean
  membership: string
  membershipExpiresAt: string | null
}

export interface UserSettingsPayload {
  cardBack: string
  settings: Record<string, unknown>
}

export const useUserResourcesStore = defineStore('userResources', () => {
  const quotaState = ref<QuotaState>({
    remaining: DAILY_LIMIT,
    total: DAILY_LIMIT,
    isVip: false,
    membership: 'free',
    membershipExpiresAt: null,
  })
  const settings = ref<UserSettingsPayload | null>(null)
  let quotaFetchedAt: number | null = null
  let settingsFetchedAt: number | null = null

  const remaining = computed(() => quotaState.value.remaining)
  const isExhausted = computed(() => !quotaState.value.isVip && quotaState.value.remaining <= 0)
  const isVip = computed(() => quotaState.value.isVip)

  async function fetchQuota(force = false) {
    if (!force && isFresh(quotaFetchedAt, CACHE_TTL_MS.quota)) return
    try {
      const res = await api.get('/user/quota')
      if (res.data.success) {
        quotaState.value = res.data.data
        quotaFetchedAt = Date.now()
      }
    } catch {
      /* 未登录等场景保持本地默认值 */
    }
  }

  async function fetchSettings(force = false) {
    if (!force && isFresh(settingsFetchedAt, CACHE_TTL_MS.settings)) return
    try {
      const res = await api.get('/user/settings')
      if (res.data.success) {
        settings.value = res.data.data
        settingsFetchedAt = Date.now()
      }
    } catch {
      settings.value = null
    }
  }

  function decrement() {
    if (quotaState.value.remaining > 0) {
      quotaState.value = { ...quotaState.value, remaining: quotaState.value.remaining - 1 }
    }
  }

  function invalidateQuota() {
    quotaFetchedAt = null
  }

  function invalidateSettings() {
    settingsFetchedAt = null
    settings.value = null
  }

  function invalidateAll() {
    invalidateQuota()
    invalidateSettings()
  }

  return {
    quotaState,
    settings,
    remaining,
    isExhausted,
    isVip,
    fetchQuota,
    fetchSettings,
    decrement,
    invalidateQuota,
    invalidateSettings,
    invalidateAll,
  }
})
