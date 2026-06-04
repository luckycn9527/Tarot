<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'

/** 十天干 · 东方命理环 */
const stems = '甲乙丙丁戊己庚辛壬癸'.split('')
/** 十二地支 · 中环 */
const branches = '子丑寅卯辰巳午未申酉戌亥'.split('')
/** 塔罗大阿尔卡那罗马数字 · 西方环 */
const arcana = ['0', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']

/** 推演阶段文案，循环播放，营造"正在思考"的真实进度感 */
const phases = [
  { zh: '排布四柱 · 校准日主旺衰', en: 'Casting the four pillars' },
  { zh: '流转五行 · 权衡喜忌格局', en: 'Weighing the five elements' },
  { zh: '翻阅塔罗 · 解过去现在未来', en: 'Reading past · present · future' },
  { zh: '东西合参 · 推演命运岔路', en: 'Merging East & West' },
]
const phaseIndex = ref(0)
let phaseTimer: number | undefined

onMounted(() => {
  phaseTimer = window.setInterval(() => {
    phaseIndex.value = (phaseIndex.value + 1) % phases.length
  }, 2200)
})
onBeforeUnmount(() => {
  if (phaseTimer) window.clearInterval(phaseTimer)
})

function sparkStyle(n: number) {
  const left = ((n * 53) % 1000) / 10
  const top = ((n * 79) % 1000) / 10
  return {
    left: `${left}%`,
    top: `${top}%`,
    animationDelay: `${(n % 10) * 0.15}s`,
    animationDuration: `${2.2 + (n % 5) * 0.4}s`,
  }
}
</script>

<template>
  <div
    class="fate-astro-root flex flex-col items-center justify-center px-4 py-12 sm:py-20"
    aria-live="polite"
    aria-busy="true"
  >
    <div class="fate-astro-stage relative">
      <!-- 氛围底光 -->
      <div class="fate-astro-canvas" aria-hidden="true" />

      <div class="fate-astro-svg-wrap">
        <svg
          class="fate-astro-svg"
          viewBox="0 0 400 400"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <defs>
            <radialGradient id="fa-bg-g" cx="50%" cy="45%" r="65%">
              <stop offset="0%" stop-color="#171033" />
              <stop offset="55%" stop-color="#0b0820" />
              <stop offset="100%" stop-color="#050310" />
            </radialGradient>
            <linearGradient id="fa-gold-line" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#f0d98a" stop-opacity="0.95" />
              <stop offset="55%" stop-color="#d4af37" stop-opacity="0.7" />
              <stop offset="100%" stop-color="#a67c2d" stop-opacity="0.85" />
            </linearGradient>
            <linearGradient id="fa-violet-line" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#d8b4fe" stop-opacity="0.9" />
              <stop offset="100%" stop-color="#7c3aed" stop-opacity="0.8" />
            </linearGradient>
            <filter id="fa-core-glow" x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation="3.2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <rect width="400" height="400" fill="url(#fa-bg-g)" rx="10" />

          <!-- 远景星点 -->
          <g opacity="0.4" fill="#e2e0f5">
            <circle v-for="s in 28" :key="'st' + s" :cx="20 + (s * 41) % 360" :cy="18 + (s * 57) % 364" :r="0.5 + (s % 3) * 0.3" />
          </g>

          <g transform="translate(200,200)">
            <!-- 外环：天干（金，顺时针） -->
            <g class="fate-spin fate-spin--outer">
              <circle r="186" fill="none" stroke="url(#fa-gold-line)" stroke-width="0.5" opacity="0.4" />
              <circle r="170" fill="none" stroke="rgba(212,175,55,0.14)" stroke-width="0.35" stroke-dasharray="2 6" />
              <g v-for="(ch, i) in stems" :key="'s' + i" :transform="`rotate(${i * 36 - 90})`">
                <circle cy="-178" r="0.9" fill="rgba(212,175,55,0.6)" />
                <text
                  x="0" y="-162" text-anchor="middle"
                  fill="rgba(238,210,130,0.9)" font-size="13"
                  class="select-none" style="font-family: 'Songti SC', 'Noto Serif SC', serif"
                >{{ ch }}</text>
              </g>
            </g>

            <!-- 中环：地支（逆时针） -->
            <g class="fate-spin fate-spin--mid">
              <circle r="138" fill="none" stroke="url(#fa-gold-line)" stroke-width="0.55" opacity="0.42" />
              <g v-for="(ch, i) in branches" :key="'b' + i" :transform="`rotate(${i * 30 - 90})`">
                <line x1="0" y1="-138" x2="0" y2="-110" stroke="rgba(212,175,55,0.18)" stroke-width="0.4" />
                <text
                  x="0" y="-122" text-anchor="middle"
                  fill="rgba(196,168,255,0.78)" font-size="12"
                  class="select-none" style="font-family: 'Songti SC', 'Noto Serif SC', serif"
                >{{ ch }}</text>
              </g>
            </g>

            <!-- 内环：塔罗大阿尔卡那（紫，顺时针快） -->
            <g class="fate-spin fate-spin--inner">
              <circle r="96" fill="rgba(10,7,26,0.4)" stroke="url(#fa-violet-line)" stroke-width="0.55" opacity="0.5" />
              <g v-for="(ch, i) in arcana" :key="'a' + i" :transform="`rotate(${i * (360 / 13) - 90})`">
                <text
                  x="0" y="-82" text-anchor="middle"
                  fill="rgba(216,180,254,0.7)" font-size="8.5"
                  class="select-none" style="font-family: ui-serif, Georgia, serif; letter-spacing: 0.5px"
                >{{ ch }}</text>
              </g>
            </g>

            <!-- 双引擎能量弧：东(金) vs 西(紫) 对向旋转 -->
            <g class="fate-arc fate-arc--gold">
              <path d="M0,-58 A58,58 0 0 1 50,29" fill="none" stroke="url(#fa-gold-line)" stroke-width="2.2" stroke-linecap="round" />
            </g>
            <g class="fate-arc fate-arc--violet">
              <path d="M0,58 A58,58 0 0 1 -50,-29" fill="none" stroke="url(#fa-violet-line)" stroke-width="2.2" stroke-linecap="round" />
            </g>

            <!-- 中心：太极核（脉动） -->
            <g filter="url(#fa-core-glow)" class="fate-core-grp">
              <circle r="40" fill="none" stroke="rgba(212,175,55,0.25)" stroke-width="0.5" class="fate-core-ring" />
              <g class="fate-taiji">
                <circle r="28" fill="none" stroke="rgba(212,175,55,0.4)" stroke-width="0.5" />
                <path d="M0,-28 A28,28 0 1,1 0,28 A14,14 0 0,0 0,0 A14,14 0 0,1 0,-28 Z" fill="#ede9f7" opacity="0.94" />
                <path d="M0,-28 A28,28 0 0,0 0,28 A14,14 0 0,1 0,0 A14,14 0 0,0 0,-28 Z" fill="#0b0820" opacity="0.96" />
                <circle cx="0" cy="-14" r="4.5" fill="#0b0820" />
                <circle cx="0" cy="14" r="4.5" fill="#ede9f7" />
                <circle cx="0" cy="-14" r="1.5" fill="#ede9f7" />
                <circle cx="0" cy="14" r="1.5" fill="#0b0820" />
              </g>
            </g>
          </g>
        </svg>

        <!-- 罩层微粒 -->
        <div class="fate-astro-sparkles" aria-hidden="true">
          <span v-for="n in 30" :key="'sp' + n" class="fate-astro-spark" :style="sparkStyle(n)" />
        </div>
      </div>
    </div>

    <p class="fate-astro-title mt-10 max-w-md text-center font-serif text-xl tracking-wide text-[#ead7a8] sm:mt-14 sm:text-2xl">
      星盘推演中…
    </p>

    <!-- 阶段进度 -->
    <div class="fate-phase mt-4" aria-hidden="true">
      <Transition name="fate-phase-fade" mode="out-in">
        <p :key="phaseIndex" class="fate-phase-text">{{ phases[phaseIndex].zh }}</p>
      </Transition>
    </div>
    <div class="fate-phase-dots mt-3" aria-hidden="true">
      <span
        v-for="(_phase, i) in phases"
        :key="i"
        class="fate-phase-dot"
        :class="{ 'fate-phase-dot--on': i === phaseIndex }"
      />
    </div>
  </div>
</template>

<style scoped>
.fate-astro-root {
  --fa-gold: #d4af37;
}

.fate-astro-stage {
  position: relative;
  width: min(92vw, 420px);
  height: min(92vw, 420px);
}

.fate-astro-canvas {
  position: absolute;
  inset: -10%;
  border-radius: 50%;
  background:
    radial-gradient(circle at 38% 32%, rgba(212, 175, 55, 0.14) 0%, transparent 46%),
    radial-gradient(circle at 64% 70%, rgba(138, 43, 226, 0.16) 0%, transparent 44%);
  filter: blur(3px);
  animation: fa-canvas-breathe 5s ease-in-out infinite;
}

@keyframes fa-canvas-breathe {
  0%, 100% { opacity: 0.85; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.04); }
}

.fate-astro-svg-wrap {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 14px;
  box-shadow:
    0 0 60px rgba(138, 43, 226, 0.18),
    0 0 110px rgba(212, 175, 55, 0.08),
    inset 0 0 44px rgba(0, 0, 0, 0.5);
}

.fate-astro-svg {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: 14px;
}

/* 各环旋转 */
.fate-spin { transform-origin: 0 0; }
.fate-spin--outer { animation: fa-rot 88s linear infinite; }
.fate-spin--mid { animation: fa-rot-rev 60s linear infinite; }
.fate-spin--inner { animation: fa-rot 34s linear infinite; }

/* 双引擎能量弧 */
.fate-arc { transform-origin: 0 0; }
.fate-arc--gold { animation: fa-rot 6s linear infinite; }
.fate-arc--violet { animation: fa-rot-rev 6s linear infinite; }

/* 太极核 */
.fate-taiji { transform-origin: 0 0; animation: fa-rot 18s linear infinite; }
.fate-core-grp { animation: fa-core-pulse 3s ease-in-out infinite; transform-origin: 0 0; }
.fate-core-ring { animation: fa-ring-breathe 3s ease-in-out infinite; transform-origin: 0 0; }

@keyframes fa-rot { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
@keyframes fa-rot-rev { from { transform: rotate(0deg); } to { transform: rotate(-360deg); } }

@keyframes fa-core-pulse {
  0%, 100% { filter: drop-shadow(0 0 6px rgba(212, 175, 55, 0.35)) drop-shadow(0 0 14px rgba(138, 43, 226, 0.3)); }
  50% { filter: drop-shadow(0 0 12px rgba(212, 175, 55, 0.6)) drop-shadow(0 0 26px rgba(138, 43, 226, 0.55)); }
}
@keyframes fa-ring-breathe {
  0%, 100% { opacity: 0.6; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.08); }
}

.fate-astro-sparkles {
  pointer-events: none;
  position: absolute;
  inset: 0;
  border-radius: 14px;
  overflow: hidden;
}

.fate-astro-spark {
  position: absolute;
  width: 2px;
  height: 2px;
  border-radius: 50%;
  background: rgba(216, 180, 254, 0.85);
  box-shadow: 0 0 6px rgba(167, 139, 250, 0.9);
  animation: fa-spark-twinkle ease-in-out infinite;
}

@keyframes fa-spark-twinkle {
  0%, 100% { opacity: 0.15; transform: scale(0.6); }
  50% { opacity: 1; transform: scale(1.2); }
}

.fate-astro-title {
  animation: fa-title-breathe 2.8s ease-in-out infinite;
}

@keyframes fa-title-breathe {
  0%, 100% { opacity: 0.88; }
  50% { opacity: 1; }
}

/* 阶段进度 */
.fate-phase { min-height: 1.4rem; }
.fate-phase-text {
  font-size: 0.85rem;
  letter-spacing: 0.08em;
  color: rgba(196, 168, 255, 0.82);
  text-align: center;
}
.fate-phase-fade-enter-active,
.fate-phase-fade-leave-active { transition: opacity 0.45s ease, transform 0.45s ease; }
.fate-phase-fade-enter-from { opacity: 0; transform: translateY(6px); }
.fate-phase-fade-leave-to { opacity: 0; transform: translateY(-6px); }

.fate-phase-dots { display: flex; gap: 0.45rem; }
.fate-phase-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: rgba(167, 139, 250, 0.25);
  transition: all 0.4s ease;
}
.fate-phase-dot--on {
  background: linear-gradient(135deg, #d4af37, #a78bfa);
  box-shadow: 0 0 10px rgba(167, 139, 250, 0.6);
  transform: scale(1.3);
}

@media (prefers-reduced-motion: reduce) {
  .fate-spin--outer,
  .fate-spin--mid,
  .fate-spin--inner,
  .fate-arc--gold,
  .fate-arc--violet,
  .fate-taiji,
  .fate-core-grp,
  .fate-core-ring,
  .fate-astro-spark,
  .fate-astro-title,
  .fate-astro-canvas {
    animation: none !important;
  }
}
</style>
