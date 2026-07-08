import { storeToRefs } from 'pinia'
import { useUserResourcesStore } from '@/stores/userResources'

export function useQuota() {
  const s = useUserResourcesStore()
  const { remaining, isUnlimited, isExhausted, isVip, quotaState } = storeToRefs(s)
  return {
    remaining,
    isUnlimited,
    isExhausted,
    isVip,
    fetchQuota: (force?: boolean) => s.fetchQuota(force),
    decrement: s.decrement,
    quotaState,
  }
}
