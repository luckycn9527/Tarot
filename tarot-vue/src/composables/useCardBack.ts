import { computed } from 'vue'
import defaultCardBack from '../assets/back/pocket.png'
import { useUserResourcesStore } from '@/stores/userResources'
import { cardBacksList } from '@/services/referenceBootstrap'
import { publicAssetUrl } from '@/utils/publicAssetUrl'

/** 模块级默认（仅作兜底，优先用 useCardBack().cardBackUrl） */
export const cardBackUrl = defaultCardBack

export function useCardBack() {
  const ur = useUserResourcesStore()

  const currentBack = computed(() => ur.settings?.cardBack ?? 'pocket')

  const cardBackUrl = computed(() => {
    const code = currentBack.value
    const back = cardBacksList.value.find(b => b.code === code)
    if (back?.assetUrl) return publicAssetUrl(back.assetUrl)
    return defaultCardBack
  })

  async function loadCardBack(force = false) {
    await ur.fetchSettings(force)
  }

  function getImageUrl(): string {
    return cardBackUrl.value
  }

  return { currentBack, cardBackUrl, loadCardBack, getImageUrl, cardBacksList }
}
