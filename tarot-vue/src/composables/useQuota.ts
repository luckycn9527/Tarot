import { storeToRefs } from 'pinia'
import { useUserResourcesStore } from '@/stores/userResources'

export function useQuota() {
  const s = useUserResourcesStore()
  const { remaining, dailyFortuneRemaining, fateDualRemaining, isUnlimited, isExhausted, isDailyFortuneExhausted, isFateDualExhausted, isVip, quotaState } = storeToRefs(s)
  return {
    remaining,
    dailyFortuneRemaining,
    fateDualRemaining,
    isUnlimited,
    isExhausted,
    isDailyFortuneExhausted,
    isFateDualExhausted,
    isVip,
    fetchQuota: (force?: boolean) => s.fetchQuota(force),
    decrement: s.decrement,
    decrementDailyFortune: s.decrementDailyFortune,
    decrementFateDual: s.decrementFateDual,
    quotaState,
  }
}
