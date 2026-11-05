import { computed } from 'vue'
import purpleCardBack from '../assets/mobile/daily-purple-card-back.png'

/** APP artwork is bundled and fixed; account settings and connectivity never replace it. */
export const mobileCardBackUrl = purpleCardBack

export function useMobileCardBack() {
  const backImageUrl = computed(() => mobileCardBackUrl)
  return { backImageUrl }
}
