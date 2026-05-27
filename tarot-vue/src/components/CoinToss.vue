<script setup lang="ts">
import { ref } from 'vue'

defineProps<{
  lineIndex: number // 0-5, 第几爻
}>()

const emit = defineEmits<{
  (e: 'result', value: number): void // 0=阴, 1=阳
}>()

const isAnimating = ref(false)
const result = ref<number | null>(null)
const coinRotation = ref(0)

async function toss() {
  if (isAnimating.value) return
  isAnimating.value = true
  result.value = null

  // 动画: 旋转硬币
  const duration = 600
  const startTime = Date.now()
  const totalRotations = 4 + Math.random() * 3

  await new Promise<void>(resolve => {
    function animate() {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      // easeOutCubic
      const eased = 1 - Math.pow(1 - progress, 3)
      coinRotation.value = eased * totalRotations * 360

      if (progress < 1) {
        requestAnimationFrame(animate)
      } else {
        resolve()
      }
    }
    requestAnimationFrame(animate)
  })

  // 结果: 0=阴(背), 1=阳(正)
  const value = Math.random() < 0.5 ? 0 : 1
  result.value = value
  isAnimating.value = false

  emit('result', value)
}

const lineNames = ['初爻', '二爻', '三爻', '四爻', '五爻', '上爻']
</script>

<template>
  <div class="flex flex-col items-center gap-3">
    <!-- 爻位名称 -->
    <span class="text-xs text-gray-400">{{ lineNames[lineIndex] }}</span>

    <!-- 硬币 -->
    <button
      class="relative w-16 h-16 rounded-full border-2 transition-all duration-200"
      :class="[
        result === null
          ? 'border-gold-500/50 bg-gold-500/10 hover:border-gold-400 hover:bg-gold-500/20 cursor-pointer'
          : result === 1
            ? 'border-yellow-400 bg-yellow-900/30 cursor-default'
            : 'border-blue-400 bg-blue-900/30 cursor-default',
        isAnimating ? 'pointer-events-none' : '',
      ]"
      :disabled="result !== null"
      @click="toss"
    >
      <div
        class="w-full h-full flex items-center justify-center text-2xl font-bold"
        :style="{ transform: `rotateY(${coinRotation}deg)` }"
      >
        <template v-if="result === null">
          <span class="text-gold-300">?</span>
        </template>
        <template v-else-if="result === 1">
          <span class="text-yellow-300">阳</span>
        </template>
        <template v-else>
          <span class="text-blue-300">阴</span>
        </template>
      </div>
    </button>

    <!-- 爻线可视化 -->
    <div v-if="result !== null" class="flex gap-1 items-center">
      <template v-if="result === 1">
        <!-- 阳爻: 实线 -->
        <div class="w-10 h-1.5 bg-yellow-400 rounded-full" />
      </template>
      <template v-else>
        <!-- 阴爻: 断线 -->
        <div class="w-4 h-1.5 bg-blue-400 rounded-full" />
        <div class="w-1" />
        <div class="w-4 h-1.5 bg-blue-400 rounded-full" />
      </template>
    </div>
  </div>
</template>
