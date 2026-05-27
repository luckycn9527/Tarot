<script setup lang="ts">
import { onMounted } from 'vue'
import { useCardBack } from '../composables/useCardBack'
import TarotCard3D from './TarotCard3D.vue'

const { cardBackUrl, loadCardBack } = useCardBack()

onMounted(() => {
  void loadCardBack(true)
})
</script>

<template>
  <div class="relative mb-8 flex flex-col items-center">
    <!-- 与首页原 hero 光晕一致，衬在 3D 牌后 -->
    <div class="card-glow-hero pointer-events-none" aria-hidden="true" />
    <TarotCard3D
      :card-back-url="cardBackUrl"
      :is-flipped="false"
      :clickable="false"
      size="lg"
    />
  </div>
</template>

<style scoped>
.card-glow-hero {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -42%);
  width: 140%;
  height: 130%;
  border-radius: 50%;
  background: radial-gradient(
    circle,
    rgba(212, 168, 83, 0.14) 0%,
    rgba(212, 168, 83, 0.05) 42%,
    transparent 70%
  );
  z-index: -1;
}
</style>
