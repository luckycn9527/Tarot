<script setup lang="ts">
withDefaults(
  defineProps<{
    label?: string
  }>(),
  { label: '加载中...' },
)
</script>

<template>
  <div class="text-center py-16 text-gray-500">
    <div class="inline-block w-6 h-6 border-2 border-gold-500/30 border-t-gold-500 rounded-full animate-spin mb-3" />
    <p class="text-sm">{{ label }}</p>
  </div>
</template>
