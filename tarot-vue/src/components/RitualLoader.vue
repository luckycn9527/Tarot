<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'

const props = withDefaults(defineProps<{
  progress?: number
  messages?: string[]
}>(), {
  progress: 0,
  messages: () => [
    '通灵中...',
    '感应牌面能量...',
    '解读星象密码...',
    '凝聚宇宙智慧...',
    '启示即将降临...',
  ],
})

const currentMessageIndex = ref(0)
let messageTimer: ReturnType<typeof setInterval> | undefined

const currentMessage = computed(() =>
  props.messages[currentMessageIndex.value % props.messages.length]
)

onMounted(() => {
  messageTimer = setInterval(() => {
    currentMessageIndex.value++
  }, 2500)
})

onUnmounted(() => {
  if (messageTimer) clearInterval(messageTimer)
})
</script>

<template>
  <div class="ritual-loader">
    <!-- Orbital ring -->
    <div class="ritual-orbit">
      <div class="orbit-ring">
        <div class="orbit-particle orbit-p1"></div>
        <div class="orbit-particle orbit-p2"></div>
        <div class="orbit-particle orbit-p3"></div>
      </div>

      <!-- Progress ring -->
      <svg class="ritual-progress" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(212,168,83,.08)" stroke-width="2" />
        <circle
          cx="50" cy="50" r="42"
          fill="none"
          stroke="url(#ritualGradient)"
          stroke-width="2.5"
          stroke-linecap="round"
          :stroke-dasharray="`${progress * 2.64} 264`"
          transform="rotate(-90 50 50)"
          class="transition-all duration-300"
        />
        <defs>
          <linearGradient id="ritualGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#d4a853" />
            <stop offset="50%" stop-color="#7c3aed" />
            <stop offset="100%" stop-color="#d4a853" />
          </linearGradient>
        </defs>
      </svg>

      <!-- Center symbol -->
      <div class="ritual-center">
        <span class="ritual-symbol">✦</span>
        <span class="ritual-percent">{{ Math.round(progress) }}%</span>
      </div>
    </div>

    <!-- Message -->
    <p class="ritual-message" :key="currentMessageIndex">
      {{ currentMessage }}
    </p>
  </div>
</template>

<style scoped>
.ritual-loader {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  padding: 24px;
}

.ritual-orbit {
  position: relative;
  width: 120px;
  height: 120px;
}

.orbit-ring {
  position: absolute;
  inset: 0;
  animation: rotateGlow 8s linear infinite;
}

.orbit-particle {
  position: absolute;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--color-gold-400);
  box-shadow: 0 0 8px rgba(212,168,83,.5);
}
.orbit-p1 { top: 0; left: 50%; transform: translateX(-50%); }
.orbit-p2 { bottom: 15%; right: 5%; }
.orbit-p3 { bottom: 15%; left: 5%; }

.ritual-progress {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.ritual-center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
}

.ritual-symbol {
  color: var(--color-gold-400);
  font-size: 20px;
  animation: breathe 2s ease-in-out infinite;
}

.ritual-percent {
  color: rgba(232,224,212,.8);
  font-size: 13px;
  font-weight: 600;
  font-family: var(--font-cinzel);
}

.ritual-message {
  color: rgba(212,168,83,.7);
  font-size: 14px;
  font-family: var(--font-body);
  letter-spacing: 0.5px;
  animation: fadeInUp 0.5s ease-out;
}

@keyframes rotateGlow {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@keyframes breathe {
  0%, 100% { opacity: .5; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.15); }
}

@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
