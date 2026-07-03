import { computed } from 'vue'
import { useUserResourcesStore } from '@/stores/userResources'
import { cardBacksList } from '@/services/referenceBootstrap'
import { ossAssetUrl, publicAssetUrl } from '@/utils/publicAssetUrl'

const defaultCardBack = ossAssetUrl('/frontend-assets/back/pocket.webp')

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
