import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/services/api'
import { CACHE_TTL_MS, isFresh } from '@/stores/cacheTtl'
import { getSessionScope, isCurrentSession } from '@/utils/sessionScope'

const DAILY_LIMIT = 3

export interface QuotaWindow {
  businessDate: string
  resetsAt: string
  timeZone: string
}

interface QuotaState {
  remaining: number
  total: number
  dailyFortuneRemaining: number
  dailyFortuneTotal: number
  fateDualRemaining: number
  fateDualTotal: number
  isVip: boolean
  unlimited?: boolean
  membership: string
  membershipExpiresAt: string | null
  businessDate?: string
  resetsAt?: string
  timeZone?: string
}

export interface UserSettingsPayload {
  cardBack: string
  settings: Record<string, unknown>
}

function defaultQuota(): QuotaState {
  return {
    remaining: DAILY_LIMIT,
    total: DAILY_LIMIT,
    dailyFortuneRemaining: 1,
    dailyFortuneTotal: 1,
    fateDualRemaining: 1,
    fateDualTotal: 1,
    isVip: false,
    unlimited: false,
    membership: 'free',
    membershipExpiresAt: null,
  }
}

export const useUserResourcesStore = defineStore('userResources', () => {
  const quotaState = ref<QuotaState>(defaultQuota())
  const settings = ref<UserSettingsPayload | null>(null)
  let quotaFetchedAt: number | null = null
  let settingsFetchedAt: number | null = null

  const remaining = computed(() => quotaState.value.remaining)
  const dailyFortuneRemaining = computed(() => quotaState.value.dailyFortuneRemaining)
  const fateDualRemaining = computed(() => quotaState.value.fateDualRemaining)
  const isUnlimited = computed(() => quotaState.value.isVip || quotaState.value.unlimited === true)
  const isExhausted = computed(() => !isUnlimited.value && quotaState.value.remaining <= 0)
  const isDailyFortuneExhausted = computed(() => !isUnlimited.value && quotaState.value.dailyFortuneRemaining <= 0)
  const isFateDualExhausted = computed(() => !isUnlimited.value && quotaState.value.fateDualRemaining <= 0)
  const isVip = computed(() => quotaState.value.isVip)

  async function fetchQuota(force = false) {
    const scope = getSessionScope()
    if (scope.owner === null) return
    if (!force && isFresh(quotaFetchedAt, CACHE_TTL_MS.quota)) return
    try {
      const res = await api.get('/user/quota')
      if (res.data.success && isCurrentSession(scope)) {
        quotaState.value = res.data.data
        quotaFetchedAt = Date.now()
      }
    } catch {
      /* 未登录等场景保持本地默认值 */
    }
  }

  async function fetchSettings(force = false) {
    const scope = getSessionScope()
    if (scope.owner === null) return
    if (!force && isFresh(settingsFetchedAt, CACHE_TTL_MS.settings)) return
    try {
      const res = await api.get('/user/settings')
      if (res.data.success && isCurrentSession(scope)) {
        settings.value = res.data.data
        settingsFetchedAt = Date.now()
      }
    } catch {
      if (isCurrentSession(scope)) settings.value = null
    }
  }

  function decrement() {
    if (isUnlimited.value) return
    if (quotaState.value.remaining > 0) {
      quotaState.value = { ...quotaState.value, remaining: quotaState.value.remaining - 1 }
    }
  }

  function decrementDailyFortune() {
    if (isUnlimited.value) return
    if (quotaState.value.dailyFortuneRemaining > 0) {
      quotaState.value = {
        ...quotaState.value,
        dailyFortuneRemaining: quotaState.value.dailyFortuneRemaining - 1,
      }
    }
  }

  function decrementFateDual() {
    if (isUnlimited.value) return
    if (quotaState.value.fateDualRemaining > 0) {
      quotaState.value = {
        ...quotaState.value,
        fateDualRemaining: quotaState.value.fateDualRemaining - 1,
      }
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
    quotaState.value = defaultQuota()
  }

  function applyQuotaWindow(window: QuotaWindow) {
    const { businessDate, resetsAt, timeZone } = window
    quotaState.value = { ...quotaState.value, businessDate, resetsAt, timeZone }
  }

  return {
    quotaState,
    settings,
    remaining,
    dailyFortuneRemaining,
    fateDualRemaining,
    isUnlimited,
    isExhausted,
    isDailyFortuneExhausted,
    isFateDualExhausted,
    isVip,
    fetchQuota,
    fetchSettings,
    decrement,
    decrementDailyFortune,
    decrementFateDual,
    invalidateQuota,
    invalidateSettings,
    invalidateAll,
    applyQuotaWindow,
  }
})
