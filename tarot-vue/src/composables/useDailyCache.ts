import { ref, computed, onMounted, onUnmounted } from 'vue'
import { StorageKeys, storageGetJson, storageSetJson } from '@/utils/storage'
import { isCurrentDailyCache, type DailyCache } from '@/utils/dailyCache'
import { useUserResourcesStore } from '@/stores/userResources'

export function useDailyCache() {
  const resources = useUserResourcesStore()
  const hasDrawnToday = ref(false)
  const hasCachedResult = ref(false)
  const now = ref(Date.now())
  const businessDate = computed(() => resources.quotaState.businessDate)
  let countdownTimer: ReturnType<typeof setInterval> | undefined
  let refreshing = false
  let lastRefresh = 0
  const countdown = computed(() => {
    const deadline = Date.parse(resources.quotaState.resetsAt ?? '')
    if (!Number.isFinite(deadline)) return ''
    const seconds = Math.max(0, Math.ceil((deadline - now.value) / 1000))
    return [Math.floor(seconds / 3600), Math.floor(seconds % 3600 / 60), seconds % 60]
      .map(value => String(value).padStart(2, '0')).join(':')
  })

  function loadCache(): DailyCache | null {
    const value = storageGetJson<DailyCache>(StorageKeys.DAILY_FORTUNE)
    return isCurrentDailyCache(value, businessDate.value, resources.quotaState.resetsAt) ? value : null
  }

  function saveCache(cache: DailyCache) {
    storageSetJson(StorageKeys.DAILY_FORTUNE, cache)
  }

  function saveDraw(cardId: number, isReversed: boolean) {
    if (!businessDate.value) return
    saveCache({ date: businessDate.value, cardId, isReversed })
    hasDrawnToday.value = true
  }

  function saveFortune(cardId: number, isReversed: boolean, fortuneJson: string) {
    if (!businessDate.value) return
    saveCache({ date: businessDate.value, cardId, isReversed, fortune: fortuneJson })
    hasDrawnToday.value = true
    hasCachedResult.value = true
  }

  function updateCountdown() {
    now.value = Date.now()
    const deadline = Date.parse(resources.quotaState.resetsAt ?? '')
    if (deadline <= now.value) {
      hasDrawnToday.value = false
      hasCachedResult.value = false
      if (!refreshing && now.value - lastRefresh > 15_000) {
        refreshing = true
        lastRefresh = now.value
        void resources.fetchQuota(true).finally(() => { refreshing = false })
      }
    }
  }

  function startCountdown() {
    updateCountdown()
    countdownTimer = setInterval(updateCountdown, 1000)
  }

  function stopCountdown() {
    if (countdownTimer) clearInterval(countdownTimer)
  }

  onMounted(startCountdown)
  onUnmounted(stopCountdown)

  return {
    hasDrawnToday, hasCachedResult, countdown, businessDate,
    loadCache, saveDraw, saveFortune,
  }
}
