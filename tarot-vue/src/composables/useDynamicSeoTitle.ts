import { watch, type MaybeRefOrGetter, toValue } from 'vue'
import { applyDynamicDocumentMeta } from '@/seo/documentMeta'

/** 随数据变化更新 `document.title` 与 OpenGraph / Twitter 标题 */
export function useDynamicSeoTitle(titleSource: MaybeRefOrGetter<string | null | undefined>) {
  watch(
    () => toValue(titleSource),
    (title) => {
      if (title) applyDynamicDocumentMeta({ title })
    },
    { immediate: true },
  )
}
