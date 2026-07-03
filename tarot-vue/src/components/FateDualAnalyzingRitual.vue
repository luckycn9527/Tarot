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
  { zh: '校准本命盘 · 抽取长期底色', en: 'Reading the birth chart baseline' },
  { zh: '翻译变量牌 · 捕捉当下暗流', en: 'Translating the three Tarot variables' },
  { zh: '让两张盘面相遇 · 计算冲突频率', en: 'Finding the East and West tension' },
  { zh: '分离稳守与破局路线 · 凝结结论', en: 'Preparing the two path strategies' },
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
      <div class="fate-dual-beams" aria-hidden="true">
        <span class="fate-beam fate-beam--left" />
        <span class="fate-beam fate-beam--right" />
      </div>

      <div class="fate-astro-svg-wrap">
        <svg
          class="fate-astro-svg"
          viewBox="0 0 400 400"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <defs>
            <radialGradient id="fa-bg-g" cx="50%" cy="45%" r="65%">
              <stop offset="0%" stop-color="#24164d" />
              <stop offset="58%" stop-color="#0b0822" />
              <stop offset="100%" stop-color="#020108" />
            </radialGradient>
            <linearGradient id="fa-silver-line" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#ffffff" stop-opacity="0.98" />
              <stop offset="54%" stop-color="#d8d9f2" stop-opacity="0.76" />
              <stop offset="100%" stop-color="#8b91b5" stop-opacity="0.84" />
            </linearGradient>
            <linearGradient id="fa-violet-line" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#f0e8ff" stop-opacity="0.95" />
              <stop offset="46%" stop-color="#a78bfa" stop-opacity="0.88" />
              <stop offset="100%" stop-color="#5b21b6" stop-opacity="0.78" />
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
            <g class="fate-impact-wave">
              <circle r="54" fill="none" stroke="rgba(232,231,255,0.22)" stroke-width="0.5" />
              <circle r="74" fill="none" stroke="rgba(167,139,250,0.16)" stroke-width="0.5" />
            </g>

            <!-- 外环：天干（银，左盘） -->
            <g class="fate-spin fate-spin--outer fate-disc fate-disc--left">
              <circle r="132" fill="none" stroke="url(#fa-silver-line)" stroke-width="0.55" opacity="0.48" />
              <circle r="116" fill="none" stroke="rgba(232,231,255,0.14)" stroke-width="0.35" stroke-dasharray="2 6" />
              <g v-for="(ch, i) in stems" :key="'s' + i" :transform="`rotate(${i * 36 - 90})`">
                <circle cy="-124" r="0.9" fill="rgba(232,231,255,0.64)" />
                <text
                  x="0" y="-108" text-anchor="middle"
                  fill="rgba(238,238,255,0.9)" font-size="12"
                  class="select-none" style="font-family: 'Songti SC', 'Noto Serif SC', serif"
                >{{ ch }}</text>
              </g>
            </g>

            <!-- 中环：地支（紫，右盘） -->
            <g class="fate-spin fate-spin--mid fate-disc fate-disc--right">
              <circle r="132" fill="none" stroke="url(#fa-violet-line)" stroke-width="0.55" opacity="0.5" />
              <g v-for="(ch, i) in branches" :key="'b' + i" :transform="`rotate(${i * 30 - 90})`">
                <line x1="0" y1="-132" x2="0" y2="-106" stroke="rgba(167,139,250,0.22)" stroke-width="0.4" />
                <text
                  x="0" y="-116" text-anchor="middle"
                  fill="rgba(208,195,255,0.84)" font-size="12"
                  class="select-none" style="font-family: 'Songti SC', 'Noto Serif SC', serif"
                >{{ ch }}</text>
              </g>
            </g>

            <!-- 内环：塔罗大阿尔卡那（中心共振） -->
            <g class="fate-spin fate-spin--inner">
              <circle r="96" fill="rgba(10,7,26,0.32)" stroke="url(#fa-violet-line)" stroke-width="0.55" opacity="0.52" />
              <g v-for="(ch, i) in arcana" :key="'a' + i" :transform="`rotate(${i * (360 / 13) - 90})`">
                <text
                  x="0" y="-82" text-anchor="middle"
                  fill="rgba(232,231,255,0.68)" font-size="8.5"
                  class="select-none" style="font-family: ui-serif, Georgia, serif; letter-spacing: 0.5px"
                >{{ ch }}</text>
              </g>
            </g>

            <!-- 双引擎能量弧：银 vs 紫 对向旋转 -->
            <g class="fate-arc fate-arc--silver">
              <path d="M0,-58 A58,58 0 0 1 50,29" fill="none" stroke="url(#fa-silver-line)" stroke-width="2.2" stroke-linecap="round" />
            </g>
            <g class="fate-arc fate-arc--violet">
              <path d="M0,58 A58,58 0 0 1 -50,-29" fill="none" stroke="url(#fa-violet-line)" stroke-width="2.2" stroke-linecap="round" />
            </g>

            <!-- 中心：太极核（脉动） -->
            <g filter="url(#fa-core-glow)" class="fate-core-grp">
              <circle r="40" fill="none" stroke="rgba(232,231,255,0.28)" stroke-width="0.5" class="fate-core-ring" />
              <g class="fate-taiji">
                <circle r="28" fill="none" stroke="rgba(232,231,255,0.4)" stroke-width="0.5" />
                <path d="M0,-28 A28,28 0 1,1 0,28 A14,14 0 0,0 0,0 A14,14 0 0,1 0,-28 Z" fill="#f4f2ff" opacity="0.94" />
                <path d="M0,-28 A28,28 0 0,0 0,28 A14,14 0 0,1 0,0 A14,14 0 0,0 0,-28 Z" fill="#14082e" opacity="0.96" />
                <circle cx="0" cy="-14" r="4.5" fill="#14082e" />
                <circle cx="0" cy="14" r="4.5" fill="#f4f2ff" />
                <circle cx="0" cy="-14" r="1.5" fill="#f4f2ff" />
                <circle cx="0" cy="14" r="1.5" fill="#14082e" />
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

    <p class="fate-astro-title mt-10 max-w-md text-center font-serif text-xl tracking-wide text-[#eeeaff] sm:mt-14 sm:text-2xl">
      双盘碰撞中…
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
  --fa-violet: #8b5cf6;
  --fa-silver: #e8e7ff;
}

.fate-astro-stage {
  position: relative;
  width: min(92vw, 460px);
  height: min(92vw, 460px);
  perspective: 1100px;
}

.fate-astro-canvas {
  position: absolute;
  inset: -14%;
  border-radius: 50%;
  background:
    radial-gradient(circle at 34% 38%, rgba(232, 231, 255, 0.14) 0%, transparent 38%),
    radial-gradient(circle at 64% 62%, rgba(139, 92, 246, 0.24) 0%, transparent 46%),
    conic-gradient(from 220deg, transparent, rgba(232, 231, 255, 0.08), transparent 20%, rgba(124, 58, 237, 0.2), transparent 58%, rgba(232, 231, 255, 0.08), transparent);
  filter: blur(4px);
  animation: fa-canvas-breathe 5s ease-in-out infinite;
}

@keyframes fa-canvas-breathe {
  0%, 100% { opacity: 0.85; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.04); }
}

.fate-dual-beams {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 2;
}

.fate-beam {
  position: absolute;
  top: 50%;
  width: 44%;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(232,231,255,0.85), rgba(139,92,246,0.7), transparent);
  filter: drop-shadow(0 0 10px rgba(167,139,250,0.72));
  opacity: 0.36;
  transform-origin: center;
}

.fate-beam--left {
  left: 1%;
  animation: fa-beam-left 2.8s ease-in-out infinite;
}

.fate-beam--right {
  right: 1%;
  animation: fa-beam-right 2.8s ease-in-out infinite;
}

@keyframes fa-beam-left {
  0%, 100% { transform: translate3d(-10px, -50%, 0) rotate(0deg) scaleX(0.8); opacity: 0.18; }
  48%, 58% { transform: translate3d(22px, -50%, 0) rotate(0deg) scaleX(1.06); opacity: 0.72; }
}

@keyframes fa-beam-right {
  0%, 100% { transform: translate3d(10px, -50%, 0) rotate(180deg) scaleX(0.8); opacity: 0.18; }
  48%, 58% { transform: translate3d(-22px, -50%, 0) rotate(180deg) scaleX(1.06); opacity: 0.72; }
}

.fate-astro-svg-wrap {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  box-shadow:
    0 0 70px rgba(139, 92, 246, 0.24),
    0 0 120px rgba(232, 231, 255, 0.08),
    inset 0 0 44px rgba(0, 0, 0, 0.5);
  transform: rotateX(8deg);
}

.fate-astro-svg {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: 50%;
}

/* 各环旋转 */
.fate-spin { transform-origin: 0 0; }
.fate-spin--outer { animation: fa-rot 88s linear infinite; }
.fate-spin--mid { animation: fa-rot-rev 60s linear infinite; }
.fate-spin--inner { animation: fa-rot 34s linear infinite; }
.fate-disc { filter: drop-shadow(0 0 12px rgba(167,139,250,0.24)); }
.fate-disc--left { animation: fa-left-disc 4.8s ease-in-out infinite, fa-rot 88s linear infinite; }
.fate-disc--right { animation: fa-right-disc 4.8s ease-in-out infinite, fa-rot-rev 60s linear infinite; }

@keyframes fa-left-disc {
  0%, 100% { translate: -72px 0; opacity: 0.78; }
  50% { translate: -42px 0; opacity: 1; }
}

@keyframes fa-right-disc {
  0%, 100% { translate: 72px 0; opacity: 0.78; }
  50% { translate: 42px 0; opacity: 1; }
}

.fate-impact-wave {
  transform-origin: 0 0;
  animation: fa-impact-wave 2.8s ease-in-out infinite;
}

@keyframes fa-impact-wave {
  0%, 100% { opacity: 0.16; transform: scale(0.82); }
  52% { opacity: 0.82; transform: scale(1.2); }
  74% { opacity: 0.18; transform: scale(1.38); }
}

/* 双引擎能量弧 */
.fate-arc { transform-origin: 0 0; }
.fate-arc--silver { animation: fa-rot 6s linear infinite; }
.fate-arc--violet { animation: fa-rot-rev 6s linear infinite; }

/* 太极核 */
.fate-taiji { transform-origin: 0 0; animation: fa-rot 18s linear infinite; }
.fate-core-grp { animation: fa-core-pulse 3s ease-in-out infinite; transform-origin: 0 0; }
.fate-core-ring { animation: fa-ring-breathe 3s ease-in-out infinite; transform-origin: 0 0; }

@keyframes fa-rot { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
@keyframes fa-rot-rev { from { transform: rotate(0deg); } to { transform: rotate(-360deg); } }

@keyframes fa-core-pulse {
  0%, 100% { filter: drop-shadow(0 0 7px rgba(232, 231, 255, 0.42)) drop-shadow(0 0 18px rgba(139, 92, 246, 0.36)); }
  50% { filter: drop-shadow(0 0 15px rgba(232, 231, 255, 0.72)) drop-shadow(0 0 34px rgba(139, 92, 246, 0.64)); }
}
@keyframes fa-ring-breathe {
  0%, 100% { opacity: 0.6; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.08); }
}

.fate-astro-sparkles {
  pointer-events: none;
  position: absolute;
  inset: 0;
  border-radius: 50%;
  overflow: hidden;
}

.fate-astro-spark {
  position: absolute;
  width: 2px;
  height: 2px;
  border-radius: 50%;
  background: rgba(232, 231, 255, 0.92);
  box-shadow: 0 0 7px rgba(167, 139, 250, 0.95);
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
  color: rgba(221, 214, 254, 0.84);
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
  background: linear-gradient(135deg, #f5f3ff, #8b5cf6);
  box-shadow: 0 0 10px rgba(167, 139, 250, 0.6);
  transform: scale(1.3);
}

@media (prefers-reduced-motion: reduce) {
  .fate-spin--outer,
  .fate-spin--mid,
  .fate-spin--inner,
  .fate-arc--silver,
  .fate-arc--violet,
  .fate-disc--left,
  .fate-disc--right,
  .fate-impact-wave,
  .fate-beam,
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
