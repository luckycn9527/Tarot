<script setup lang="ts">
withDefaults(defineProps<{
  text?: string
  to?: string
}>(), {
  text: '选择塔罗师，开始占卜 →',
  to: '/tarot',
})
</script>

<template>
  <section class="relative z-10 w-full max-w-3xl mx-auto px-4 py-12 text-center reveal-on-scroll">
    <RouterLink :to="to" class="text-gold-400 hover:text-gold-300 text-sm transition-colors">
      {{ text }}
    </RouterLink>
  </section>
</template>
