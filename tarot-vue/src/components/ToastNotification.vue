<script setup lang="ts">
import { useToast } from '../composables/useToast'

const { toasts } = useToast()

const typeStyles: Record<string, string> = {
  success: 'bg-green-600/90 shadow-green-500/20',
  error: 'bg-red-600/90 shadow-red-500/20',
  info: 'bg-gold-500/90 shadow-gold-500/20',
}

const typeIcons: Record<string, string> = {
  success: '✓',
  error: '✕',
  info: 'ℹ',
}
</script>

<template>
  <Teleport to="body">
    <div
      class="toast-stack-safe fixed z-[100] flex flex-col items-center gap-2 pointer-events-none"
      role="status"
      aria-live="polite"
      aria-relevant="additions text"
    >
      <TransitionGroup
        enter-active-class="transition-all duration-300 ease-out"
        leave-active-class="transition-all duration-200 ease-in"
        enter-from-class="opacity-0 -translate-y-2 scale-95"
        enter-to-class="opacity-100 translate-y-0 scale-100"
        leave-from-class="opacity-100 translate-y-0 scale-100"
        leave-to-class="opacity-0 -translate-y-2 scale-95"
      >
        <div
          v-for="toast in toasts"
          :key="toast.id"
          class="px-5 py-2.5 rounded-xl backdrop-blur-md text-white text-sm font-medium shadow-lg border border-white/10 flex items-center gap-2 pointer-events-auto"
          :class="typeStyles[toast.type]"
        >
          <span class="text-xs font-bold">{{ typeIcons[toast.type] }}</span>
          {{ toast.message }}
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>
