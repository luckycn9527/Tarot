<script setup lang="ts">
/** 二十八宿（顺时针传统序） */
const mansions = '角亢氐房心尾箕斗牛女虚危室壁奎娄胃昴毕觜参井鬼柳星张翼轸'.split('')
const branches = '子丑寅卯辰巳午未申酉戌亥'.split('')

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
      <!-- 纹理底 -->
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
              <stop offset="0%" stop-color="#1a2744" />
              <stop offset="55%" stop-color="#0d1528" />
              <stop offset="100%" stop-color="#060a14" />
            </radialGradient>
            <filter id="fa-gold-soft" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="0.6" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="fa-blue-glow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <linearGradient id="fa-gold-line" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#e8c76b" stop-opacity="0.95" />
              <stop offset="50%" stop-color="#d4af37" stop-opacity="0.75" />
              <stop offset="100%" stop-color="#a67c2d" stop-opacity="0.85" />
            </linearGradient>
          </defs>

          <rect width="400" height="400" fill="url(#fa-bg-g)" rx="8" />

          <!-- 远景星点（静态） -->
          <g opacity="0.35" fill="#e2e8f0">
            <circle v-for="s in 24" :key="'st' + s" :cx="30 + (s * 37) % 340" :cy="25 + (s * 53) % 310" :r="0.6 + (s % 3) * 0.25" />
          </g>

          <g transform="translate(200,200)">
            <!-- 装饰：日相（右上） -->
            <g transform="translate(132,-118)" opacity="0.55" filter="url(#fa-gold-soft)">
              <circle r="18" fill="none" stroke="url(#fa-gold-line)" stroke-width="0.85" />
              <g stroke="url(#fa-gold-line)" stroke-width="0.55" stroke-linecap="round">
                <path d="M0,-26 L0,-22 M18,-8 L14,-6 M18,8 L14,6 M0,26 L0,22 M-18,8 L-14,6 M-18,-8 L-14,-6" />
              </g>
              <circle r="7" fill="rgba(212,175,55,0.12)" stroke="url(#fa-gold-line)" stroke-width="0.4" />
            </g>

            <!-- 装饰：月相（左下） -->
            <g transform="translate(-128,122)" opacity="0.45">
              <path
                d="M0,-14 A14,14 0 1,1 0,14 A9,14 0 1,0 0,-14 Z"
                fill="none"
                stroke="url(#fa-gold-line)"
                stroke-width="0.65"
              />
            </g>

            <!-- 外环：二十八宿（慢旋） -->
            <g class="fate-astro-spin fate-astro-spin--outer">
              <circle r="188" fill="none" stroke="url(#fa-gold-line)" stroke-width="0.45" opacity="0.35" />
              <circle r="172" fill="none" stroke="rgba(212,175,55,0.12)" stroke-width="0.35" stroke-dasharray="2 5" />
              <g v-for="(ch, i) in mansions" :key="'m' + i" :transform="`rotate(${i * (360 / 28) - 90})`">
                <circle cy="-181" r="0.9" fill="rgba(212,175,55,0.5)" />
                <text
                  x="0"
                  y="-166"
                  text-anchor="middle"
                  fill="rgba(232,206,120,0.88)"
                  font-size="11"
                  class="select-none font-serif"
                  style="font-family: 'Songti SC', 'Noto Serif SC', serif"
                >
                  {{ ch }}
                </text>
              </g>
            </g>

            <!-- 中环：十二地支（逆旋） -->
            <g class="fate-astro-spin fate-astro-spin--mid">
              <circle r="128" fill="none" stroke="url(#fa-gold-line)" stroke-width="0.55" opacity="0.42" />
              <circle r="108" fill="none" stroke="rgba(96,165,250,0.15)" stroke-width="0.4" />
              <g v-for="(ch, i) in branches" :key="'b' + i" :transform="`rotate(${i * 30 - 90})`">
                <line x1="0" y1="-128" x2="0" y2="-98" stroke="rgba(212,175,55,0.2)" stroke-width="0.4" />
                <text
                  x="0"
                  y="-112"
                  text-anchor="middle"
                  fill="rgba(186,230,253,0.75)"
                  font-size="13"
                  class="select-none font-serif"
                  style="font-family: 'Songti SC', 'Noto Serif SC', serif"
                >
                  {{ ch }}
                </text>
              </g>
            </g>

            <!-- 内环：节气刻度感 -->
            <g class="fate-astro-spin fate-astro-spin--inner">
              <circle r="86" fill="rgba(8,12,24,0.35)" stroke="rgba(212,175,55,0.18)" stroke-width="0.5" />
              <g v-for="i in 24" :key="'t' + i" :transform="`rotate(${i * 15 - 90})`">
                <line x1="0" y1="-86" x2="0" y2="-78" stroke="rgba(147,197,253,0.25)" stroke-width="0.35" />
              </g>
            </g>

            <!-- 中心：八角星 + 太极（微光） -->
            <g filter="url(#fa-blue-glow)">
              <path
                d="M0,-36 L9,-9 L36,0 L9,9 L0,36 L-9,9 L-36,0 L-9,-9 Z"
                fill="none"
                stroke="rgba(212,175,55,0.55)"
                stroke-width="0.65"
                opacity="0.9"
                class="fate-astro-star-pulse"
              />
              <circle r="34" fill="none" stroke="rgba(96,165,250,0.2)" stroke-width="0.4" />
              <g class="fate-astro-taiji">
                <circle r="26" fill="none" stroke="rgba(212,175,55,0.35)" stroke-width="0.45" />
                <path
                  d="M0,-26 A26,26 0 1,1 0,26 A13,13 0 0,0 0,0 A13,13 0 0,1 0,-26 Z"
                  fill="#e8e4ef"
                  opacity="0.92"
                />
                <path
                  d="M0,-26 A26,26 0 0,0 0,26 A13,13 0 0,1 0,0 A13,13 0 0,0 0,-26 Z"
                  fill="#0a0c12"
                  opacity="0.95"
                />
                <circle cx="0" cy="-13" r="4.2" fill="#0a0c12" />
                <circle cx="0" cy="13" r="4.2" fill="#e8e4ef" />
                <circle cx="0" cy="-13" r="1.4" fill="#e8e4ef" />
                <circle cx="0" cy="13" r="1.4" fill="#0a0c12" />
              </g>
            </g>
          </g>
        </svg>

        <!-- 罩层微粒 -->
        <div class="fate-astro-sparkles" aria-hidden="true">
          <span v-for="n in 32" :key="'sp' + n" class="fate-astro-spark" :style="sparkStyle(n)" />
        </div>
      </div>
    </div>

    <p class="fate-astro-title mt-10 max-w-md text-center font-serif text-xl tracking-wide text-[#e8d5a3] sm:mt-14 sm:text-2xl">
      星盘推演中…
    </p>
    <p class="mt-3 max-w-md px-2 text-center text-sm leading-relaxed text-slate-500 sm:text-base">
      二十八宿周天运转，十二地支气机流转 — 八字与塔罗正感应你的所问
    </p>
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
  inset: -8%;
  border-radius: 50%;
  background:
    radial-gradient(circle at 40% 35%, rgba(59, 130, 246, 0.12) 0%, transparent 45%),
    radial-gradient(circle at 60% 65%, rgba(212, 175, 55, 0.08) 0%, transparent 40%);
  filter: blur(2px);
  animation: fa-canvas-breathe 5s ease-in-out infinite;
}

@keyframes fa-canvas-breathe {
  0%,
  100% {
    opacity: 0.85;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.03);
  }
}

.fate-astro-svg-wrap {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 12px;
  box-shadow:
    0 0 60px rgba(59, 130, 246, 0.15),
    0 0 100px rgba(212, 175, 55, 0.06),
    inset 0 0 40px rgba(0, 0, 0, 0.45);
}

.fate-astro-svg {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: 12px;
}

.fate-astro-spin--outer {
  animation: fa-rot 96s linear infinite;
  transform-origin: 0 0;
}

.fate-astro-spin--mid {
  animation: fa-rot-rev 72s linear infinite;
  transform-origin: 0 0;
}

.fate-astro-spin--inner {
  animation: fa-rot 48s linear infinite;
  transform-origin: 0 0;
}

.fate-astro-taiji {
  animation: fa-rot 24s linear infinite;
  transform-origin: 0 0;
}

@keyframes fa-rot {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@keyframes fa-rot-rev {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(-360deg);
  }
}

.fate-astro-star-pulse {
  animation: fa-star-pulse 3s ease-in-out infinite;
}

@keyframes fa-star-pulse {
  0%,
  100% {
    opacity: 0.65;
    filter: drop-shadow(0 0 4px rgba(59, 130, 246, 0.35));
  }
  50% {
    opacity: 1;
    filter: drop-shadow(0 0 10px rgba(96, 165, 250, 0.55));
  }
}

.fate-astro-sparkles {
  pointer-events: none;
  position: absolute;
  inset: 0;
  border-radius: 12px;
  overflow: hidden;
}

.fate-astro-spark {
  position: absolute;
  width: 2px;
  height: 2px;
  border-radius: 50%;
  background: rgba(147, 197, 253, 0.85);
  box-shadow: 0 0 6px rgba(56, 189, 248, 0.9);
  animation: fa-spark-twinkle ease-in-out infinite;
}

@keyframes fa-spark-twinkle {
  0%,
  100% {
    opacity: 0.15;
    transform: scale(0.6);
  }
  50% {
    opacity: 1;
    transform: scale(1.2);
  }
}

.fate-astro-title {
  animation: fa-title-breathe 2.8s ease-in-out infinite;
}

@keyframes fa-title-breathe {
  0%,
  100% {
    opacity: 0.88;
  }
  50% {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .fate-astro-spin--outer,
  .fate-astro-spin--mid,
  .fate-astro-spin--inner,
  .fate-astro-taiji,
  .fate-astro-star-pulse,
  .fate-astro-spark,
  .fate-astro-title,
  .fate-astro-canvas {
    animation: none !important;
  }
}
</style>
