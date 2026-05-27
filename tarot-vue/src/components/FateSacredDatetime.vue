<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Solar } from 'lunar-javascript'

const birthDate = defineModel<string>('birthDate', { default: '' })
const birthTime = defineModel<string>('birthTime', { default: '' })

const emit = defineEmits<{
  dateCommit: []
  timeCommit: []
}>()

const currentYear = new Date().getFullYear()

const y = ref(1990)
const m = ref(6)
const d = ref(15)

const hour = ref(12)
const minute = ref(0)

const ZODIAC = ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓'] as const
const ZODIAC_CN = ['白羊', '金牛', '双子', '巨蟹', '狮子', '处女', '天秤', '天蝎', '射手', '摩羯', '水瓶', '双鱼'] as const

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate()
}

const dayValues = computed(() => {
  const max = daysInMonth(y.value, m.value)
  return Array.from({ length: max }, (_, i) => i + 1)
})

watch(
  [y, m],
  () => {
    const max = daysInMonth(y.value, m.value)
    if (d.value > max) d.value = max
  },
  { immediate: true },
)

function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`
}

function parseDate(s: string) {
  if (!s) return null
  const [Y, M, D] = s.split('-').map(Number)
  if (!Y || !M || !D) return null
  return { Y, M, D }
}

function parseTime(s: string) {
  if (!s) return null
  const [h, mm] = s.split(':').map(Number)
  if (Number.isNaN(h)) return null
  return { h, mm: Number.isNaN(mm) ? 0 : mm }
}

watch(
  birthDate,
  (s) => {
    const p = parseDate(s)
    if (p) {
      y.value = p.Y
      m.value = p.M
      d.value = p.D
    }
  },
  { immediate: true },
)

watch(
  birthTime,
  (s) => {
    const p = parseTime(s)
    if (p) {
      hour.value = p.h
      minute.value = p.mm
    }
  },
  { immediate: true },
)

function commitDate() {
  birthDate.value = `${y.value}-${pad2(m.value)}-${pad2(d.value)}`
  emit('dateCommit')
}

function commitTime() {
  birthTime.value = `${pad2(hour.value)}:${pad2(minute.value)}`
  emit('timeCommit')
}

function selectDay(day: number) {
  d.value = day
  commitDate()
}

function deltaMonth(delta: number) {
  let nm = m.value + delta
  let ny = y.value
  while (nm < 1) { nm += 12; ny -= 1 }
  while (nm > 12) { nm -= 12; ny += 1 }
  if (ny < 1940) ny = 1940
  if (ny > currentYear) ny = currentYear
  y.value = ny
  m.value = nm
  const max = daysInMonth(ny, nm)
  if (d.value > max) d.value = max
  commitDate()
}

function deltaYear(delta: number) {
  let ny = y.value + delta
  if (ny < 1940) ny = 1940
  if (ny > currentYear) ny = currentYear
  y.value = ny
  const max = daysInMonth(ny, m.value)
  if (d.value > max) d.value = max
  commitDate()
}

const calendarMeta = computed(() => {
  try {
    const solar = Solar.fromYmdHms(y.value, m.value, d.value, hour.value, minute.value, 0)
    const lunar = solar.getLunar()
    const ec = lunar.getEightChar()
    const xz = solar.getXingZuo()
    const xzLabel = xz.endsWith('座') ? xz : `${xz}座`
    const idx = ZODIAC_CN.findIndex((z) => xzLabel.startsWith(z))
    return {
      lunarLine: lunar.toString().replace(/\s+/g, ' ').trim(),
      xingZuo: xzLabel,
      zodiacGlyph: idx >= 0 ? ZODIAC[idx] : '✧',
      yearGZ: ec.getYear(),
      monthGZ: ec.getMonth(),
      dayGZ: ec.getDay(),
      timeGZ: ec.getTime(),
    }
  } catch {
    return null
  }
})

const SHICHEN = [
  { name: '子', pickH: 0 }, { name: '丑', pickH: 2 }, { name: '寅', pickH: 4 },
  { name: '卯', pickH: 6 }, { name: '辰', pickH: 8 }, { name: '巳', pickH: 10 },
  { name: '午', pickH: 12 }, { name: '未', pickH: 14 }, { name: '申', pickH: 16 },
  { name: '酉', pickH: 18 }, { name: '戌', pickH: 20 }, { name: '亥', pickH: 22 },
] as const

function isShichenActive(name: (typeof SHICHEN)[number]['name'], h: number): boolean {
  const x = ((h % 24) + 24) % 24
  const ranges: Record<string, [number, number]> = {
    子: [23, 1], 丑: [1, 3], 寅: [3, 5], 卯: [5, 7], 辰: [7, 9], 巳: [9, 11],
    午: [11, 13], 未: [13, 15], 申: [15, 17], 酉: [17, 19], 戌: [19, 21], 亥: [21, 23],
  }
  const [a, b] = ranges[name]
  if (a > b) return x >= a || x < b
  return x >= a && x < b
}

function pickShichen(startHour: number) {
  hour.value = startHour
  minute.value = 0
  commitTime()
}

/** 当月第一天是星期几 (0=Sun) */
const firstDayOfWeek = computed(() => new Date(y.value, m.value - 1, 1).getDay())
</script>

<template>
  <div class="sacred-dt relative overflow-hidden rounded-2xl">
    <!-- 深邃背景 -->
    <div class="sacred-dt-bg pointer-events-none absolute inset-0" aria-hidden="true" />

    <div class="relative z-[1] p-4 sm:p-5">
      <!-- 上部：年月导航 + 星座/农历信息 -->
      <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <!-- 年月导航 -->
        <div class="flex items-center gap-1.5">
          <button type="button" class="sacred-nav-btn cursor-pointer" aria-label="上一年" @click="deltaYear(-1)">
            <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 17l-5-5 5-5M18 17l-5-5 5-5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
          <button type="button" class="sacred-nav-btn cursor-pointer" aria-label="上一月" @click="deltaMonth(-1)">
            <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
          <span class="min-w-[7.5rem] text-center font-serif text-sm tracking-wider text-[#f5e9ff]">
            {{ y }} 年 <span class="text-[#d4af37]">{{ m }}</span> 月
          </span>
          <button type="button" class="sacred-nav-btn cursor-pointer" aria-label="下一月" @click="deltaMonth(1)">
            <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
          <button type="button" class="sacred-nav-btn cursor-pointer" aria-label="下一年" @click="deltaYear(1)">
            <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 17l5-5-5-5M6 17l5-5-5-5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>

        <!-- 星座 + 农历 -->
        <div v-if="calendarMeta" class="flex items-center gap-2 text-xs">
          <span class="text-lg text-[#d4af37]/80">{{ calendarMeta.zodiacGlyph }}</span>
          <div class="text-left">
            <p class="font-serif text-[#e2d9f3]">{{ calendarMeta.xingZuo }}</p>
            <p class="text-[10px] text-[#8A7E9F]">{{ calendarMeta.lunarLine }}</p>
          </div>
        </div>
      </div>

      <!-- 日历网格 -->
      <div class="mb-4">
        <!-- 星期头 -->
        <div class="mb-1.5 grid grid-cols-7 gap-1">
          <span v-for="w in ['日', '一', '二', '三', '四', '五', '六']" :key="w"
            class="py-1 text-center text-[10px] tracking-wider text-[#8A7E9F]/70">{{ w }}</span>
        </div>
        <!-- 日期格 -->
        <div class="grid grid-cols-7 gap-1">
          <!-- 空白占位 -->
          <span v-for="_ in firstDayOfWeek" :key="'e' + _" />
          <!-- 日期按钮 -->
          <button
            v-for="day in dayValues"
            :key="day"
            type="button"
            class="sacred-day-cell cursor-pointer"
            :class="d === day ? 'sacred-day-cell--active' : 'sacred-day-cell--idle'"
            @click="selectDay(day)"
          >
            {{ day }}
          </button>
        </div>
      </div>

      <!-- 分隔线 -->
      <div class="mb-4 h-px bg-gradient-to-r from-transparent via-[#d4af37]/20 to-transparent" />

      <!-- 四柱 -->
      <div v-if="calendarMeta" class="mb-4">
        <p class="mb-2 text-[10px] uppercase tracking-[0.25em] text-[#d4af37]/60">八字四柱</p>
        <div class="grid grid-cols-4 gap-2">
          <div v-for="pill in [
            { k: '年柱', v: calendarMeta.yearGZ },
            { k: '月柱', v: calendarMeta.monthGZ },
            { k: '日柱', v: calendarMeta.dayGZ },
            { k: '时柱', v: calendarMeta.timeGZ },
          ]" :key="pill.k" class="sacred-pillar">
            <span class="text-[9px] text-[#d4af37]/55">{{ pill.k }}</span>
            <p class="mt-0.5 font-serif text-base font-semibold tracking-wide text-[#f5e9ff]">{{ pill.v }}</p>
          </div>
        </div>
      </div>

      <!-- 时辰选择 -->
      <div>
        <p class="mb-2 text-[10px] uppercase tracking-[0.25em] text-[#8A7E9F]">降生时辰</p>
        <div class="grid grid-cols-6 gap-1.5 sm:grid-cols-12">
          <button
            v-for="s in SHICHEN"
            :key="s.name"
            type="button"
            class="sacred-shichen cursor-pointer"
            :class="isShichenActive(s.name, hour) ? 'sacred-shichen--active' : 'sacred-shichen--idle'"
            @click="pickShichen(s.pickH)"
          >
            {{ s.name }}
          </button>
        </div>
        <!-- 精确时间微调 -->
        <div class="mt-2.5 flex items-center gap-2 text-[10px] text-[#8A7E9F]">
          <label class="flex items-center gap-1">
            时
            <input v-model.number="hour" type="number" min="0" max="23"
              class="sacred-time-input" @change="commitTime">
          </label>
          <span class="text-[#d4af37]/40">:</span>
          <label class="flex items-center gap-1">
            分
            <input v-model.number="minute" type="number" min="0" max="59"
              class="sacred-time-input" @change="commitTime">
          </label>
          <span class="ml-auto font-mono text-[10px] text-[#8b7ec8]/70">
            {{ y }}-{{ pad2(m) }}-{{ pad2(d) }} {{ pad2(hour) }}:{{ pad2(minute) }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sacred-dt {
  background: transparent;
}

.sacred-dt-bg {
  background:
    radial-gradient(ellipse 100% 70% at 50% 0%, rgba(88, 28, 149, 0.2) 0%, transparent 50%),
    radial-gradient(ellipse 60% 50% at 85% 100%, rgba(30, 58, 138, 0.15) 0%, transparent 50%),
    linear-gradient(168deg, rgba(14, 8, 24, 0.95) 0%, rgba(6, 4, 14, 0.98) 100%);
}

/* 导航按钮 */
.sacred-nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: 1px solid rgba(212, 175, 55, 0.15);
  background: rgba(12, 8, 28, 0.6);
  color: #d4af37;
  transition: all 0.15s ease;
}
.sacred-nav-btn:hover {
  border-color: rgba(212, 175, 55, 0.4);
  background: rgba(76, 29, 149, 0.3);
  box-shadow: 0 0 12px rgba(212, 175, 55, 0.1);
}

/* 日历格子 */
.sacred-day-cell {
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  font-size: 0.8rem;
  font-variant-numeric: tabular-nums;
  transition: all 0.15s ease;
  border: 1px solid transparent;
}

.sacred-day-cell--idle {
  color: rgba(226, 217, 243, 0.75);
  background: transparent;
}
.sacred-day-cell--idle:hover {
  background: rgba(212, 175, 55, 0.08);
  border-color: rgba(212, 175, 55, 0.2);
  color: #f5e9ff;
}

.sacred-day-cell--active {
  background: linear-gradient(135deg, rgba(138, 43, 226, 0.4), rgba(99, 102, 241, 0.3));
  border-color: rgba(212, 175, 55, 0.5);
  color: #fffbeb;
  font-weight: 600;
  box-shadow:
    0 0 16px rgba(212, 175, 55, 0.25),
    0 0 32px rgba(138, 43, 226, 0.15),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

/* 四柱卡片 */
.sacred-pillar {
  text-align: center;
  padding: 0.6rem 0.4rem;
  border-radius: 12px;
  border: 1px solid rgba(212, 175, 55, 0.12);
  background: linear-gradient(168deg, rgba(22, 12, 40, 0.8), rgba(8, 6, 18, 0.9));
  box-shadow: inset 0 0 20px rgba(99, 102, 241, 0.06);
  transition: all 0.2s ease;
}
.sacred-pillar:hover {
  border-color: rgba(212, 175, 55, 0.25);
  box-shadow:
    inset 0 0 20px rgba(99, 102, 241, 0.08),
    0 0 12px rgba(212, 175, 55, 0.08);
}

/* 时辰按钮 */
.sacred-shichen {
  padding: 0.35rem 0;
  border-radius: 8px;
  font-family: ui-serif, Georgia, serif;
  font-size: 0.7rem;
  text-align: center;
  transition: all 0.15s ease;
  border: 1px solid transparent;
}

.sacred-shichen--idle {
  color: rgba(168, 156, 196, 0.8);
  background: rgba(0, 0, 0, 0.15);
  border-color: rgba(255, 255, 255, 0.06);
}
.sacred-shichen--idle:hover {
  border-color: rgba(212, 175, 55, 0.2);
  color: #e2d9f3;
}

.sacred-shichen--active {
  background: rgba(76, 29, 149, 0.35);
  border-color: rgba(212, 175, 55, 0.4);
  color: #fffbeb;
  box-shadow: 0 0 10px rgba(212, 175, 55, 0.15);
}

/* 时间输入 */
.sacred-time-input {
  width: 3rem;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(0, 0, 0, 0.25);
  padding: 0.25rem 0.35rem;
  text-align: center;
  color: #e2d9f3;
  font-size: 0.7rem;
  font-variant-numeric: tabular-nums;
  transition: border-color 0.15s ease;
}
.sacred-time-input:focus {
  outline: none;
  border-color: rgba(212, 175, 55, 0.4);
  box-shadow: 0 0 8px rgba(212, 175, 55, 0.1);
}

@media (prefers-reduced-motion: reduce) {
  .sacred-day-cell,
  .sacred-shichen,
  .sacred-pillar,
  .sacred-nav-btn {
    transition: none !important;
  }
}
</style>
