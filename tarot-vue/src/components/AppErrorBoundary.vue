<script setup lang="ts">
import { ref, onErrorCaptured } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const err = ref<Error | null>(null)

onErrorCaptured((e) => {
  err.value = e instanceof Error ? e : new Error(String(e))
  console.error('[AppErrorBoundary]', e)
  return false
})

function recover() {
  err.value = null
  window.location.assign('/')
}
</script>

<template>
  <div v-if="err" class="relative z-20 min-h-[50vh] flex flex-col items-center justify-center px-6 py-16 text-center">
    <h1 class="text-xl font-serif text-gold-200 mb-2">{{ t('errors.boundary') }}</h1>
    <p class="text-gray-500 text-sm max-w-md mb-6">{{ t('errors.generic') }}</p>
    <button
      type="button"
      class="px-6 py-2.5 rounded-full bg-white/10 border border-gold-500/20 text-gold-200 text-sm hover:bg-white/15 transition-colors"
      @click="recover"
    >
      {{ t('common.backHome') }}
    </button>
  </div>
  <slot v-else />
</template>
