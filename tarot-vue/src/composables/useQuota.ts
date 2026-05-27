import { storeToRefs } from 'pinia'
import { useUserResourcesStore } from '@/stores/userResources'

export function useQuota() {
  const s = useUserResourcesStore()
  const { remaining, isExhausted, isVip, quotaState } = storeToRefs(s)
  return {
    remaining,
    isExhausted,
    isVip,
    fetchQuota: (force?: boolean) => s.fetchQuota(force),
    decrement: s.decrement,
    quotaState,
  }
}
