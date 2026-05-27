<script setup lang="ts">
import { computed } from 'vue'
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
  }>(),
  {
    wrapperClass: 'w-14 h-14 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 overflow-hidden',
    useGradientFallback: true,
    emojiClass: 'text-2xl',
    avatarRing: true,
  },
)

const imageSrc = computed(() => (props.reader.avatarUrl ? getReaderAvatarSrc(props.reader) : ''))
</script>

<template>
  <div
    :class="[
      wrapperClass,
      reader.avatarUrl && avatarRing ? 'ring-1 ring-gold-500/15' : '',
      !reader.avatarUrl && useGradientFallback ? `bg-gradient-to-br ${reader.gradient}` : '',
      !reader.avatarUrl && !useGradientFallback ? 'bg-gold-500/10' : '',
    ]"
  >
    <img
      v-if="imageSrc"
      :src="imageSrc"
      :alt="reader.name"
      class="w-full h-full object-cover"
      loading="lazy"
      decoding="async"
    />
    <span v-else :class="emojiClass">{{ reader.emoji }}</span>
  </div>
</template>
