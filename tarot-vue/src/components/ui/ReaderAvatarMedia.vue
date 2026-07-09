<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { ReaderInfo } from '@/data/readers'
import { getReaderAvatarSrc } from '@/utils/readerDisplay'

const props = withDefaults(
  defineProps<{
    reader: Pick<ReaderInfo, 'avatarUrl' | 'avatarThumbUrl' | 'emoji' | 'name' | 'gradient'>
    /** 外层容器 Tailwind class，如 w-14 h-14 rounded-2xl */
    wrapperClass?: string
    /** 无头像时是否使用 reader.gradient 渐变底 */
    useGradientFallback?: boolean
    /** 无头像时 emoji 的 text class，如 text-2xl */
    emojiClass?: string
    /** 有头像时是否加细 ring（塔罗师列表用） */
    avatarRing?: boolean
    /** 是否优先使用原图（默认缩略图），用于大卡片展示 */
    preferOriginal?: boolean
  }>(),
  {
    wrapperClass: 'w-14 h-14 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 overflow-hidden',
    useGradientFallback: true,
    emojiClass: 'text-2xl',
    avatarRing: true,
    preferOriginal: false,
  },
)

const imageSrc = computed(() => {
  if (!props.reader.avatarUrl && !props.reader.avatarThumbUrl) return ''
  return getReaderAvatarSrc(props.reader, { prefer: props.preferOriginal ? 'original' : 'thumb' })
})

const originalSrc = computed(() => {
  if (!props.reader.avatarUrl && !props.reader.avatarThumbUrl) return ''
  return getReaderAvatarSrc(props.reader, { prefer: 'original' })
})

const renderedSrc = ref('')

watch(imageSrc, (src) => {
  renderedSrc.value = src
}, { immediate: true })

function handleImageError() {
  if (renderedSrc.value && originalSrc.value && renderedSrc.value !== originalSrc.value) {
    renderedSrc.value = originalSrc.value
    return
  }
  renderedSrc.value = ''
}
</script>

<template>
  <div
    :class="[
      wrapperClass,
      (reader.avatarUrl || reader.avatarThumbUrl) && avatarRing ? 'ring-1 ring-gold-500/15' : '',
      !reader.avatarUrl && useGradientFallback ? `bg-gradient-to-br ${reader.gradient}` : '',
      !reader.avatarUrl && !useGradientFallback ? 'bg-gold-500/10' : '',
    ]"
  >
    <img
      v-if="renderedSrc"
      :src="renderedSrc"
      :alt="reader.name"
      class="w-full h-full object-cover"
      loading="lazy"
      decoding="async"
      @error="handleImageError"
    />
    <span v-else :class="emojiClass">{{ reader.emoji }}</span>
  </div>
</template>
