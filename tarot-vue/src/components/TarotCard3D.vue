<script setup lang="ts">
import { ref, watch, computed } from 'vue'

const props = withDefaults(defineProps<{
  cardImageUrl?: string
  cardBackUrl: string
  isReversed?: boolean
  isFlipped?: boolean
  size?: 'sm' | 'md' | 'lg'
  clickable?: boolean
}>(), {
  isReversed: false,
  isFlipped: false,
  size: 'md',
  clickable: true,
})

const emit = defineEmits<{
  flip: []
}>()

const isAnimating = ref(false)
const showBurst = ref(false)
const isHovering = ref(false)
const tiltX = ref(0)
const tiltY = ref(0)
const shineX = ref(50)
const shineY = ref(50)

const sizeClasses = computed(() => {
  switch (props.size) {
    case 'sm': return 'w-[96px] h-[144px] sm:w-[112px] sm:h-[168px]'
    case 'md': return 'w-[160px] h-[250px] sm:w-[220px] sm:h-[340px]'
    case 'lg': return 'w-[200px] h-[310px] sm:w-[260px] sm:h-[400px]'
  }
})

/** 倾斜与「是否可点击翻牌」解耦：与每日运势一致，翻面后/动画中关闭 */
const canTilt = computed(() => !props.isFlipped && !isAnimating.value)

const cardTransform = computed(() => {
  if (props.isFlipped) return 'rotateY(180deg)'
  if (isHovering.value && canTilt.value) {
    return `rotateY(${tiltY.value}deg) rotateX(${tiltX.value}deg) translateZ(8px)`
  }
  return ''
})

const shineStyle = computed(() => ({
  background: `radial-gradient(circle at ${shineX.value}% ${shineY.value}%, rgba(255,255,255,.12) 0%, rgba(255,255,255,.03) 40%, transparent 70%)`,
  opacity: isHovering.value && canTilt.value ? 1 : 0,
}))

watch(() => props.isFlipped, (flipped) => {
  if (flipped) {
    isHovering.value = false
    isAnimating.value = true
    setTimeout(() => { showBurst.value = true }, 400)
    setTimeout(() => { showBurst.value = false }, 1200)
    setTimeout(() => { isAnimating.value = false }, 900)
  }
})

function onMouseMove(event: MouseEvent) {
  if (!canTilt.value) return
  const el = (event.currentTarget as HTMLElement)
  const rect = el.getBoundingClientRect()
  const normalizedX = (event.clientX - rect.left) / rect.width
  const normalizedY = (event.clientY - rect.top) / rect.height
  tiltY.value = (normalizedX - 0.5) * 24
  tiltX.value = (0.5 - normalizedY) * 16
  shineX.value = normalizedX * 100
  shineY.value = normalizedY * 100
  isHovering.value = true
}

function onMouseLeave() {
  isHovering.value = false
  tiltX.value = 0
  tiltY.value = 0
  shineX.value = 50
  shineY.value = 50
}

function handleClick() {
  if (!props.clickable || props.isFlipped || isAnimating.value) return
  emit('flip')
}
</script>

<template>
  <div
    class="tarot-3d-wrapper"
    :class="sizeClasses"
    @click="handleClick"
    @mousemove="onMouseMove"
    @mouseleave="onMouseLeave"
  >
    <div class="tarot-3d-glow" :class="{ 'glow-active': isFlipped }"></div>

    <div class="tarot-3d-perspective">
      <div
        class="tarot-3d-card"
        :class="{ animating: isAnimating, clickable: clickable && !isFlipped }"
        :style="{ transform: cardTransform }"
      >
        <!-- Back face -->
        <div class="tarot-3d-face tarot-3d-back">
          <img :src="cardBackUrl" alt="牌背" class="w-full h-full object-cover rounded-[14px]" />
          <div class="tarot-3d-back-border"></div>
          <!-- Shine overlay on back -->
          <div class="tarot-3d-shine" :style="shineStyle"></div>
        </div>

        <!-- Front face -->
        <div class="tarot-3d-face tarot-3d-front">
          <img
            v-if="cardImageUrl"
            :src="cardImageUrl"
            alt="塔罗牌"
            class="w-full h-full object-cover rounded-[14px]"
            :class="{ 'rotate-180': isReversed }"
          />
          <div v-else class="w-full h-full rounded-[14px] bg-gradient-to-br from-obsidian to-void flex items-center justify-center">
            <span class="text-gold-400/50 text-2xl">✦</span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showBurst" class="tarot-3d-burst">
      <span v-for="particleIndex in 8" :key="particleIndex" class="burst-particle" :style="{ '--angle': `${particleIndex * 45}deg` } as any"></span>
    </div>
  </div>
</template>

<style scoped>
.tarot-3d-wrapper {
  position: relative;
  cursor: default;
}

.tarot-3d-glow {
  position: absolute;
  inset: -20%;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(212,168,83,.06) 0%, transparent 70%);
  transition: all 1s ease;
  pointer-events: none;
  z-index: -1;
}
.glow-active {
  background: radial-gradient(circle, rgba(212,168,83,.15) 0%, rgba(124,58,237,.05) 50%, transparent 70%);
  animation: cardPulse 4s ease-in-out infinite;
}

.tarot-3d-perspective {
  width: 100%;
  height: 100%;
  perspective: 1200px;
}

.tarot-3d-card {
  width: 100%;
  height: 100%;
  position: relative;
  transform-style: preserve-3d;
  transition: transform 0.35s ease-out;
}
.tarot-3d-card.clickable {
  cursor: pointer;
}
.tarot-3d-card.animating {
  transition: transform 0.9s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.tarot-3d-face {
  position: absolute;
  inset: 0;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  border-radius: 16px;
  overflow: hidden;
  border: 2px solid rgba(212,168,83,.3);
  box-shadow:
    0 4px 20px rgba(0,0,0,.4),
    0 0 1px rgba(212,168,83,.3),
    inset 0 0 20px rgba(0,0,0,.2);
}

.tarot-3d-back {
  z-index: 2;
}
.tarot-3d-back-border {
  position: absolute;
  inset: 6px;
  border: 1px solid rgba(212,168,83,.15);
  border-radius: 10px;
  pointer-events: none;
}

.tarot-3d-shine {
  position: absolute;
  inset: 0;
  border-radius: 14px;
  pointer-events: none;
  transition: opacity 0.4s ease;
  z-index: 3;
}

.tarot-3d-front {
  transform: rotateY(180deg);
  z-index: 1;
}

.tarot-3d-burst {
  position: absolute;
  top: 50%;
  left: 50%;
  pointer-events: none;
  z-index: 10;
}
.burst-particle {
  position: absolute;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--color-gold-400);
  box-shadow: 0 0 6px rgba(212,168,83,.6);
  animation: burstOut 0.8s ease-out forwards;
  transform: rotate(var(--angle)) translateX(0);
}

@keyframes burstOut {
  0% { opacity: 1; transform: rotate(var(--angle)) translateX(0); }
  100% { opacity: 0; transform: rotate(var(--angle)) translateX(80px); }
}
@keyframes cardPulse {
  0%, 100% { opacity: .7; }
  50% { opacity: 1; }
}
</style>
