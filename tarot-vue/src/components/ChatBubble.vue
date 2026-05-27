<script setup lang="ts">
defineProps<{
  side: 'left' | 'right'
  /** 无 #avatar 插槽时显示的 emoji 或短文本 */
  avatar?: string
  name?: string
}>()
</script>

<template>
  <div class="flex gap-3 chat-bubble-enter" :class="side === 'right' ? 'flex-row-reverse' : ''">
    <div
      v-if="$slots.avatar"
      class="w-9 h-9 rounded-full overflow-hidden shrink-0 flex items-center justify-center"
      :class="side === 'left' ? 'ring-1 ring-gold-500/20 bg-gold-500/10' : 'ring-1 ring-blue-500/25 bg-blue-500/10'"
    >
      <slot name="avatar" />
    </div>
    <div
      v-else-if="avatar"
      class="w-9 h-9 rounded-full flex items-center justify-center text-lg shrink-0"
      :class="side === 'left' ? 'bg-gold-500/20' : 'bg-blue-500/20'"
    >
      {{ avatar }}
    </div>

    <!-- Bubble -->
    <div class="max-w-[80%] min-w-0">
      <div v-if="name && side === 'left'" class="text-xs text-gray-500 mb-1 ml-1">{{ name }}</div>
      <div
        class="px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap"
        :class="side === 'left'
          ? 'bg-white/4 border border-gold-500/10 text-gray-200 rounded-tl-sm'
          : 'bg-gold-500/30 border border-gold-500/20 text-gray-200 rounded-tr-sm'"
      >
        <slot />
      </div>
    </div>
  </div>
</template>

<style scoped>
.chat-bubble-enter {
  animation: bubbleFadeIn 0.4s ease-out both;
}

@keyframes bubbleFadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
