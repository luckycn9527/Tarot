<script setup lang="ts">
import { computed, toRef } from 'vue'
import UserRound from '@icons/user-round.vue'
import { getWebReaderAvatar } from '../data/webReaderAssets'
import { mobileWebsiteOrigin } from '../mobileApi'
import { useMobileReaderAvatarMedia, type MobileReaderMediaSource } from '../mobileReaderMedia'

const props = withDefaults(defineProps<{
  reader?: MobileReaderMediaSource
  name?: string
  size?: number
}>(), { name: '', size: 44 })

const { image, handleFailure } = useMobileReaderAvatarMedia(toRef(props, 'reader'), mobileWebsiteOrigin, getWebReaderAvatar)
const dimensions = computed(() => ({ width: `${props.size}px`, height: `${props.size}px` }))
function onImageError(event: Event) {
  const element = event.currentTarget as HTMLImageElement | null
  // A window capture listener may rewrite src before this component receives error.
  // Keep the original candidate identity separate from the mutable DOM address.
  if (element?.isConnected) handleFailure(element.dataset.avatarSource || '')
}
</script>

<template>
  <span class="mobile-reader-avatar" :style="dimensions" aria-hidden="true">
    <img v-if="image" :key="`${reader?.id || ''}:${image}`" :src="image" :data-avatar-source="image" alt="" loading="lazy" decoding="async" @error="onImageError">
    <span v-else class="mobile-reader-avatar-placeholder"><UserRound :size="Math.round(size * .52)" /></span>
  </span>
</template>

<style scoped>
.mobile-reader-avatar { display: inline-flex; align-items: center; justify-content: center; flex: none; overflow: hidden; border: 1px solid var(--m-line, #cbb0ed2b); border-radius: 50%; background: var(--m-accent, #cbb0ed); color: var(--m-accent-ink, #291d35); }
.mobile-reader-avatar img { display: block; width: 100%; height: 100%; object-fit: cover; }
.mobile-reader-avatar-placeholder { display: inline-flex; align-items: center; justify-content: center; width: 100%; height: 100%; }
</style>
