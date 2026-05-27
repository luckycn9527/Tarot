import { ref, onMounted, onUnmounted } from 'vue'
import { LegacyKeys, StorageKeys, storageGetJson, storageSetJson } from '@/utils/storage'

interface DailyCache {
  date: string
  cardId: number
  isReversed: boolean
  fortune?: string
}

function getTodayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

export function useDailyCache() {
  const hasDrawnToday = ref(false)
  const hasCachedResult = ref(false)
  const countdown = ref('')
  let countdownTimer: ReturnType<typeof setInterval> | undefined

  function loadCache(): DailyCache | null {
    const data = storageGetJson<DailyCache>(StorageKeys.DAILY_FORTUNE, LegacyKeys.dailyFortune)
    if (!data || data.date !== getTodayStr()) return null
    return data
  }

  function saveCache(cache: DailyCache) {
    storageSetJson(StorageKeys.DAILY_FORTUNE, cache)
  }

  function saveDraw(cardId: number, isReversed: boolean) {
    saveCache({ date: getTodayStr(), cardId, isReversed })
    hasDrawnToday.value = true
  }

  function saveFortune(cardId: number, isReversed: boolean, fortuneJson: string) {
    saveCache({ date: getTodayStr(), cardId, isReversed, fortune: fortuneJson })
    hasCachedResult.value = true
  }

  function updateCountdown() {
    const now = new Date()
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(0, 0, 0, 0)
    const diff = tomorrow.getTime() - now.getTime()
    const hours = Math.floor(diff / 3600000)
    const minutes = Math.floor((diff % 3600000) / 60000)
    const seconds = Math.floor((diff % 60000) / 1000)
    countdown.value = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
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
    hasDrawnToday, hasCachedResult, countdown,
    loadCache, saveDraw, saveFortune,
  }
}
