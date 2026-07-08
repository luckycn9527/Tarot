<script setup lang="ts">
import { ref, computed, nextTick, markRaw, onMounted, type Component } from 'vue'
import { useI18n } from 'vue-i18n'
import { useScrollReveal } from '../composables/useScrollReveal'
import { useZodiac } from '../composables/useZodiac'
import { getHoroscope, type HoroscopePeriod, type HoroscopeResult } from '../services/tarotAiReading'
import StarIcon from '@icons/star.vue'
import HeartIcon from '@icons/heart.vue'
import BriefcaseIcon from '@icons/briefcase.vue'
import CoinsIcon from '@icons/coins.vue'
import LeafIcon from '@icons/leaf.vue'
import SparklesIcon from '@icons/sparkles.vue'
import GemIcon from '@icons/gem.vue'
import OrbitIcon from '@icons/orbit.vue'
import ZodiacAries from '@icons/zodiac-aries.vue'
import ZodiacTaurus from '@icons/zodiac-taurus.vue'
import ZodiacGemini from '@icons/zodiac-gemini.vue'
import ZodiacCancer from '@icons/zodiac-cancer.vue'
import ZodiacLeo from '@icons/zodiac-leo.vue'
import ZodiacVirgo from '@icons/zodiac-virgo.vue'
import ZodiacLibra from '@icons/zodiac-libra.vue'
import ZodiacScorpio from '@icons/zodiac-scorpio.vue'
import ZodiacSagittarius from '@icons/zodiac-sagittarius.vue'
import ZodiacCapricorn from '@icons/zodiac-capricorn.vue'
import ZodiacAquarius from '@icons/zodiac-aquarius.vue'
import ZodiacPisces from '@icons/zodiac-pisces.vue'

useScrollReveal()

const { t, tm, locale } = useI18n()
const { zodiacSign, loadFromStorage } = useZodiac()

interface ZodiacSign { key: string; icon: string; name: string; date: string }
interface SignMeta { planet: string; modality: string; traits: string; match: string }
interface SignDescription { focus: string; brief: string }
interface EnergyAxis { key: keyof NonNullable<HoroscopeResult['energy']>; value: number; label: string; x: number; y: number }

const zodiacList = computed(() => tm('pages.horoscope.signs') as ZodiacSign[])
const signMeta = computed(() => tm('pages.horoscope.meta') as Record<string, SignMeta>)
const signDescriptions = computed(() => tm('pages.horoscope.descriptions') as Record<string, SignDescription>)

/** 真实 SVG 星座图标（替代丑陋的 unicode 字形） */
const signIcons: Record<string, Component> = {
  aries: markRaw(ZodiacAries), taurus: markRaw(ZodiacTaurus), gemini: markRaw(ZodiacGemini),
  cancer: markRaw(ZodiacCancer), leo: markRaw(ZodiacLeo), virgo: markRaw(ZodiacVirgo),
  libra: markRaw(ZodiacLibra), scorpio: markRaw(ZodiacScorpio), sagittarius: markRaw(ZodiacSagittarius),
  capricorn: markRaw(ZodiacCapricorn), aquarius: markRaw(ZodiacAquarius), pisces: markRaw(ZodiacPisces),
}

/** 星座 → 四元素，用于配色分组 */
const signElement: Record<string, 'fire' | 'earth' | 'air' | 'water'> = {
  aries: 'fire', leo: 'fire', sagittarius: 'fire',
  taurus: 'earth', virgo: 'earth', capricorn: 'earth',
  gemini: 'air', libra: 'air', aquarius: 'air',
  cancer: 'water', scorpio: 'water', pisces: 'water',
}

const selectedSign = ref('aries')
const selectedPeriod = ref<HoroscopePeriod>('today')
const detailRef = ref<HTMLElement | null>(null)
const periodOptions: HoroscopePeriod[] = ['today', 'tomorrow', 'week']

const currentSign = computed(() => zodiacList.value.find(z => z.key === selectedSign.value))
const currentMeta = computed(() => signMeta.value[selectedSign.value])
const currentDescription = computed(() => signDescriptions.value[selectedSign.value])
const currentElement = computed(() => signElement[selectedSign.value])
const currentElementLabel = computed(() => t(`pages.horoscope.elements.${currentElement.value}`))
const selectedPeriodLabel = computed(() => t(`pages.horoscope.periods.${selectedPeriod.value}`))

const horoscopeCache = ref<Record<string, HoroscopeResult>>({})
const loadingKey = ref<string | null>(null)
const errorKey = ref<string | null>(null)

function makeCacheKey(sign = selectedSign.value, period = selectedPeriod.value) {
  return `${sign}:${period}`
}

const activeCacheKey = computed(() => makeCacheKey())
const currentHoroscope = computed<HoroscopeResult | null>(() => horoscopeCache.value[activeCacheKey.value] ?? null)
const isLoading = computed(() => loadingKey.value === activeCacheKey.value)
const isError = computed(() => errorKey.value === activeCacheKey.value)

const todayStr = computed(() => new Intl.DateTimeFormat(String(locale.value), {
  year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
}).format(new Date()))

const zodiacNameToKey: Record<string, string> = {
  白羊: 'aries',
  金牛: 'taurus',
  双子: 'gemini',
  巨蟹: 'cancer',
  狮子: 'leo',
  处女: 'virgo',
  天秤: 'libra',
  天蝎: 'scorpio',
  射手: 'sagittarius',
  摩羯: 'capricorn',
  水瓶: 'aquarius',
  双鱼: 'pisces',
}

function keyFromStoredZodiac(value: string) {
  const normalized = value.trim().replace(/座$/, '')
  return zodiacNameToKey[normalized] || ''
}
const storedZodiacKey = computed(() => keyFromStoredZodiac(zodiacSign.value))
const storedZodiacDisplay = computed(() => zodiacList.value.find(z => z.key === storedZodiacKey.value)?.name || '')

/** 综合指数 0-100（后端直接给出，区分度更高） */
const overallPct = computed(() => currentHoroscope.value?.overallScore ?? 0)

interface DimDef { key: keyof HoroscopeResult['sections']; icon: Component }
const dimensionDefs: DimDef[] = [
  { key: 'overall', icon: markRaw(StarIcon) },
  { key: 'love', icon: markRaw(HeartIcon) },
  { key: 'career', icon: markRaw(BriefcaseIcon) },
  { key: 'wealth', icon: markRaw(CoinsIcon) },
  { key: 'health', icon: markRaw(LeafIcon) },
]
const dimensions = computed(() => dimensionDefs.map(d => ({ ...d, title: t(`pages.horoscope.dimensions.${d.key}`) })))

function clampEnergy(value: number) {
  if (!Number.isFinite(value)) return 50
  return Math.max(0, Math.min(100, Math.round(value)))
}

function ratingToEnergy(value?: number) {
  return clampEnergy((value ?? 3) * 18)
}

const energySnapshot = computed<EnergyAxis[]>(() => {
  const horoscope = currentHoroscope.value
  const energy = horoscope?.energy
  const ratings = horoscope?.ratings
  const axes: Array<{ key: keyof NonNullable<HoroscopeResult['energy']>; fallback: number; x: number; y: number }> = [
    { key: 'mood', fallback: ratingToEnergy(ratings?.love), x: 50, y: 14 },
    { key: 'action', fallback: ratingToEnergy(ratings?.career), x: 86, y: 50 },
    { key: 'social', fallback: ratingToEnergy(ratings?.overall), x: 50, y: 86 },
    { key: 'intuition', fallback: ratingToEnergy(ratings?.health), x: 14, y: 50 },
  ]
  return axes.map(axis => ({
    key: axis.key,
    label: t(`pages.horoscope.energyAxes.${axis.key}`),
    value: clampEnergy(energy?.[axis.key] ?? axis.fallback),
    x: axis.x,
    y: axis.y,
  }))
})

const radarPolygon = computed(() => {
  const points = energySnapshot.value.map((axis, index) => {
    const angle = (-90 + index * 90) * (Math.PI / 180)
    const radius = 9 + (axis.value / 100) * 36
    const x = 50 + Math.cos(angle) * radius
    const y = 50 + Math.sin(angle) * radius
    return `${x}% ${y}%`
  })
  return `polygon(${points.join(', ')})`
})

const actionAdvice = computed(() => {
  const advice = currentHoroscope.value?.advice
  if (advice) return advice
  return {
    do: currentHoroscope.value?.sections.overall || '先完成一件最确定的小事',
    avoid: currentHoroscope.value?.sections.health || '避免被临时情绪带走节奏',
    mantra: currentDescription.value?.focus ? `把注意力放回${currentDescription.value.focus}` : '慢一点，判断会更清楚',
    keyword: currentDescription.value?.focus || '觉察',
  }
})

function elementOf(key: string) { return signElement[key] }

function showZodiac(sign: string) {
  selectedSign.value = sign
  const key = makeCacheKey(sign, selectedPeriod.value)
  if (!horoscopeCache.value[key] && errorKey.value !== key) void loadHoroscope(sign, selectedPeriod.value)
  if (window.matchMedia('(max-width: 900px)').matches) {
    nextTick(() => detailRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }
}

function selectPeriod(period: HoroscopePeriod) {
  if (selectedPeriod.value === period) return
  selectedPeriod.value = period
  const key = makeCacheKey(selectedSign.value, period)
  if (!horoscopeCache.value[key] && errorKey.value !== key) void loadHoroscope(selectedSign.value, period)
}

async function loadHoroscope(sign = selectedSign.value, period = selectedPeriod.value) {
  const key = makeCacheKey(sign, period)
  if (loadingKey.value === key) return
  loadingKey.value = key
  errorKey.value = null
  try {
    const data = await getHoroscope(sign, period)
    horoscopeCache.value = { ...horoscopeCache.value, [key]: data }
  } catch {
    errorKey.value = key
  } finally {
    if (loadingKey.value === key) loadingKey.value = null
  }
}

onMounted(() => {
  loadFromStorage()
  const storedKey = storedZodiacKey.value
  if (storedKey) selectedSign.value = storedKey
  void loadHoroscope()
})
</script>

<template>
  <div class="horo-root relative z-10" :data-element="currentElement">
    <!-- 顶部星象看板 -->
    <section class="horo-hero">
      <div class="horo-hero-copy animate-fade-in-up">
        <div class="horo-eyebrow">
          <component :is="SparklesIcon" class="w-3.5 h-3.5" />
          <span>{{ todayStr }}</span>
        </div>
        <h1 class="horo-title">{{ t('pages.horoscope.heroTitle') }}</h1>
        <p class="horo-hero-sub">{{ currentDescription?.brief || t('pages.horoscope.heroSub') }}</p>
        <div class="horo-period-tabs" role="tablist" :aria-label="t('pages.horoscope.periodAria')">
          <button
            v-for="period in periodOptions"
            :key="period"
            class="horo-period-tab"
            :class="{ 'horo-period-tab--active': selectedPeriod === period }"
            type="button"
            role="tab"
            :aria-selected="selectedPeriod === period"
            @click="selectPeriod(period)"
          >
            {{ t(`pages.horoscope.periods.${period}`) }}
          </button>
        </div>
        <div v-if="storedZodiacDisplay" class="horo-personal-chip">
          <span>{{ storedZodiacDisplay }}</span>
          <small>{{ t('pages.horoscope.periodFocus', { period: selectedPeriodLabel }) }} · {{ currentDescription?.focus }}</small>
        </div>
      </div>

      <div v-if="currentSign && currentMeta" class="horo-oracle-card" :data-element="currentElement">
        <div class="horo-oracle-head">
          <div class="horo-oracle-icon">
            <component :is="signIcons[selectedSign]" :size="34" :stroke-width="1.5" />
          </div>
          <div>
            <p class="horo-oracle-kicker">{{ currentElementLabel }} / {{ currentMeta.planet }}</p>
            <h2>{{ currentSign.name }}</h2>
          </div>
        </div>
        <div class="horo-oracle-body">
          <div>
            <span>{{ t('pages.horoscope.periodFocus', { period: selectedPeriodLabel }) }}</span>
            <strong>{{ currentDescription?.focus || currentMeta.traits }}</strong>
          </div>
          <div>
            <span>{{ t('pages.horoscope.periodScore', { period: selectedPeriodLabel }) }}</span>
            <strong>{{ currentHoroscope ? overallPct : '--' }}</strong>
          </div>
          <div>
            <span>{{ t('pages.horoscope.luckyColor') }}</span>
            <strong>{{ currentHoroscope?.luckyColor || '--' }}</strong>
          </div>
        </div>
      </div>
    </section>

    <!-- 星座选择：按元素着色 -->
    <section class="horo-picker">
      <div class="horo-sign-grid">
        <button
          v-for="z in zodiacList"
          :key="z.key"
          class="horo-sign"
          :class="{ 'horo-sign--active': selectedSign === z.key }"
          :data-element="elementOf(z.key)"
          :aria-pressed="selectedSign === z.key"
          @click="showZodiac(z.key)"
        >
          <span class="horo-sign-orb">
            <component :is="signIcons[z.key]" :size="26" :stroke-width="1.6" />
          </span>
          <span class="horo-sign-name">{{ z.name }}</span>
          <span class="horo-sign-date">{{ z.date }}</span>
        </button>
      </div>
    </section>

    <!-- 详情区 -->
    <section ref="detailRef" class="horo-dashboard-wrap scroll-mt-24">
      <!-- 星座档案头 -->
      <div v-if="currentSign && currentMeta" class="horo-profile" :data-element="currentElement">
        <div class="horo-profile-glow" aria-hidden="true" />
        <div class="horo-profile-main">
          <div class="horo-profile-icon">
            <component :is="signIcons[selectedSign]" :size="44" :stroke-width="1.5" />
          </div>
          <div class="min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <h2 class="horo-profile-name">{{ currentSign.name }}</h2>
              <span class="horo-chip">{{ currentElementLabel }}</span>
            </div>
            <p class="horo-profile-date">{{ currentSign.date }}</p>
            <p class="horo-profile-traits">{{ currentMeta.traits }}</p>
          </div>
        </div>
        <div class="horo-profile-meta">
          <div class="horo-meta-cell">
            <span class="horo-meta-label">{{ t('pages.horoscope.planetLabel') }}</span>
            <span class="horo-meta-value">{{ currentMeta.planet }}</span>
          </div>
          <div class="horo-meta-cell">
            <span class="horo-meta-label">{{ t('pages.horoscope.modalityLabel') }}</span>
            <span class="horo-meta-value">{{ currentMeta.modality }}</span>
          </div>
          <div class="horo-meta-cell">
            <span class="horo-meta-label">{{ t('pages.horoscope.bestMatch') }}</span>
            <span class="horo-meta-value">{{ currentMeta.match }}</span>
          </div>
        </div>
      </div>

      <!-- 加载中 -->
      <div v-if="isLoading" class="horo-state horo-state--loading">
        <component :is="OrbitIcon" class="w-8 h-8 text-gold-400 horo-spin" />
        <div class="horo-skeleton">
          <span />
          <span />
          <span />
        </div>
        <p class="text-gray-500 text-sm mt-3">{{ t('pages.horoscope.loading', { period: selectedPeriodLabel }) }}</p>
      </div>

      <!-- 错误 -->
      <div v-else-if="isError" class="horo-state">
        <p class="text-gray-500 text-sm mb-3">{{ t('pages.horoscope.loadError') }}</p>
        <button class="horo-btn-ghost" @click="loadHoroscope()">{{ t('pages.horoscope.retry') }}</button>
      </div>

      <!-- 运势内容 -->
      <template v-else-if="currentHoroscope">
        <div class="horo-dashboard">
          <!-- 综合指数环 + 一句话总结 -->
          <article class="horo-summary" :data-element="currentElement">
            <div class="horo-score">
              <div class="horo-ring" :style="{ '--pct': overallPct }">
                <span class="horo-ring-num">{{ overallPct }}</span>
              </div>
              <span class="horo-score-label">{{ t('pages.horoscope.periodScore', { period: selectedPeriodLabel }) }}</span>
            </div>
            <div class="horo-summary-copy">
              <p class="horo-panel-kicker">{{ currentSign?.name }} / {{ selectedPeriodLabel }}</p>
              <h3 class="horo-panel-title">{{ t('pages.horoscope.summaryTitle') }}</h3>
              <p class="horo-summary-text">{{ currentHoroscope.summary }}</p>
            </div>
          </article>

          <!-- 能量雷达 -->
          <article class="horo-energy" :data-element="currentElement">
            <div class="horo-panel-head">
              <div>
                <p class="horo-panel-kicker">{{ t('pages.horoscope.energyKicker') }}</p>
                <h3 class="horo-panel-title">{{ t('pages.horoscope.energyTitle') }}</h3>
              </div>
            </div>
            <div class="horo-radar-layout">
              <div class="horo-radar" aria-hidden="true">
                <span class="horo-radar-ring horo-radar-ring--outer" />
                <span class="horo-radar-ring horo-radar-ring--mid" />
                <span class="horo-radar-axis horo-radar-axis--v" />
                <span class="horo-radar-axis horo-radar-axis--h" />
                <span class="horo-radar-shape" :style="{ clipPath: radarPolygon }" />
                <span
                  v-for="axis in energySnapshot"
                  :key="axis.key"
                  class="horo-radar-dot"
                  :style="{ left: `${axis.x}%`, top: `${axis.y}%` }"
                />
                <strong>{{ overallPct }}</strong>
              </div>
              <div class="horo-energy-list">
                <div v-for="axis in energySnapshot" :key="axis.key" class="horo-energy-item">
                  <span>{{ axis.label }}</span>
                  <strong>{{ axis.value }}</strong>
                </div>
              </div>
            </div>
          </article>

          <!-- 今日行动建议 -->
          <article class="horo-advice" :data-element="currentElement">
            <div class="horo-panel-head">
              <div>
                <p class="horo-panel-kicker">{{ selectedPeriodLabel }}</p>
                <h3 class="horo-panel-title">{{ t('pages.horoscope.adviceTitle') }}</h3>
              </div>
              <span class="horo-keyword">{{ actionAdvice.keyword }}</span>
            </div>
            <div class="horo-advice-grid">
              <div>
                <span>{{ t('pages.horoscope.adviceDo') }}</span>
                <p>{{ actionAdvice.do }}</p>
              </div>
              <div>
                <span>{{ t('pages.horoscope.adviceAvoid') }}</span>
                <p>{{ actionAdvice.avoid }}</p>
              </div>
              <div>
                <span>{{ t('pages.horoscope.adviceMantra') }}</span>
                <p>{{ actionAdvice.mantra }}</p>
              </div>
            </div>
          </article>

          <!-- 幸运提示 -->
          <div class="horo-lucky">
            <div class="horo-lucky-cell">
              <component :is="GemIcon" class="w-5 h-5 horo-lucky-icon" />
              <div>
                <p class="horo-lucky-label">{{ t('pages.horoscope.luckyColor') }}</p>
                <p class="horo-lucky-value">{{ currentHoroscope.luckyColor }}</p>
              </div>
            </div>
            <div class="horo-lucky-cell">
              <component :is="SparklesIcon" class="w-5 h-5 horo-lucky-icon" />
              <div>
                <p class="horo-lucky-label">{{ t('pages.horoscope.luckyNumber') }}</p>
                <p class="horo-lucky-value">{{ currentHoroscope.luckyNumber }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- 五维度 -->
        <div class="horo-dims">
          <div v-for="dim in dimensions" :key="dim.key" class="horo-dim">
            <div class="horo-dim-head">
              <span class="horo-dim-icon"><component :is="dim.icon" class="w-4 h-4" /></span>
              <h4 class="horo-dim-title">{{ dim.title }}</h4>
              <div class="horo-stars" :aria-label="`${currentHoroscope.ratings[dim.key]}/5`">
                <component
                  :is="StarIcon"
                  v-for="i in 5"
                  :key="i"
                  class="w-3.5 h-3.5"
                  :class="i <= currentHoroscope.ratings[dim.key] ? 'horo-star-on' : 'horo-star-off'"
                  :fill="i <= currentHoroscope.ratings[dim.key] ? 'currentColor' : 'none'"
                />
              </div>
            </div>
            <p class="horo-dim-text">{{ currentHoroscope.sections[dim.key] }}</p>
          </div>
        </div>

        <p class="horo-disclaimer">{{ t('pages.horoscope.disclaimer') }}</p>
      </template>
    </section>

    <!-- 相关入口 -->
    <section class="horo-related-wrap">
      <div class="horo-divider"><span>{{ t('pages.horoscope.relatedTitle') }}</span></div>
      <div class="horo-related-grid">
        <RouterLink to="/daily-fortune" class="horo-related">
          <component :is="StarIcon" class="w-5 h-5 horo-related-icon" />
          <div>
            <h3 class="horo-related-title">{{ t('pages.horoscope.relatedDailyTitle') }}</h3>
            <p class="horo-related-desc">{{ t('pages.horoscope.relatedDailyDesc') }}</p>
          </div>
        </RouterLink>
        <RouterLink to="/tarot" class="horo-related">
          <component :is="SparklesIcon" class="w-5 h-5 horo-related-icon" />
          <div>
            <h3 class="horo-related-title">{{ t('pages.horoscope.relatedTarotTitle') }}</h3>
            <p class="horo-related-desc">{{ t('pages.horoscope.relatedTarotDesc') }}</p>
          </div>
        </RouterLink>
      </div>
    </section>
  </div>
</template>

<style scoped>
/* ── 四元素配色：每个元素一组 OKLCH 强调色，带来色彩节奏 ── */
.horo-root {
  --el: oklch(0.78 0.13 85);        /* 默认金 */
  --el-soft: oklch(0.78 0.13 85 / 0.14);
  --el-line: oklch(0.78 0.13 85 / 0.30);
}
.horo-root[data-element='fire'],
[data-element='fire'] { --el: oklch(0.70 0.17 40); --el-soft: oklch(0.70 0.17 40 / 0.14); --el-line: oklch(0.70 0.17 40 / 0.32); }
.horo-root[data-element='earth'],
[data-element='earth'] { --el: oklch(0.74 0.12 130); --el-soft: oklch(0.74 0.12 130 / 0.13); --el-line: oklch(0.74 0.12 130 / 0.30); }
.horo-root[data-element='air'],
[data-element='air'] { --el: oklch(0.80 0.11 230); --el-soft: oklch(0.80 0.11 230 / 0.14); --el-line: oklch(0.80 0.11 230 / 0.32); }
.horo-root[data-element='water'],
[data-element='water'] { --el: oklch(0.72 0.13 300); --el-soft: oklch(0.72 0.13 300 / 0.14); --el-line: oklch(0.72 0.13 300 / 0.32); }

/* ── 顶部星象看板 ── */
.horo-hero {
  width: min(1240px, calc(100% - 2rem));
  margin: 0 auto;
  padding: clamp(3.6rem, 6vw, 5.1rem) 0 0.85rem;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(300px, 370px);
  gap: clamp(1rem, 3vw, 2rem);
  align-items: center;
}
.horo-hero-copy {
  min-width: 0;
}
.horo-hero-sub {
  max-width: 40rem;
  margin-top: 0.8rem;
  color: oklch(0.68 0.025 280);
  font-size: clamp(0.92rem, 1.5vw, 1.04rem);
  line-height: 1.65;
}
.horo-period-tabs {
  display: inline-flex;
  align-items: center;
  gap: 0.28rem;
  margin-top: 1rem;
  padding: 0.25rem;
  border: 1px solid oklch(0.5 0.02 280 / 0.22);
  border-radius: 999px;
  background: oklch(0.11 0.02 285 / 0.72);
  box-shadow: inset 0 1px 0 oklch(1 0 0 / 0.05);
}
.horo-period-tab {
  min-width: 4.8rem;
  border-radius: 999px;
  padding: 0.48rem 0.9rem;
  color: oklch(0.68 0.025 280);
  font-size: 0.78rem;
  font-weight: 760;
  cursor: pointer;
  transition: transform 0.28s cubic-bezier(0.22,1,0.36,1), color 0.25s, background 0.25s;
}
.horo-period-tab:hover {
  color: oklch(0.92 0.03 90);
  transform: translateY(-1px);
}
.horo-period-tab--active {
  color: oklch(0.12 0.02 285);
  background: linear-gradient(135deg, var(--el), oklch(0.9 0.04 95));
  box-shadow: 0 8px 22px var(--el-soft);
}
.horo-personal-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.65rem;
  margin-top: 1rem;
  border: 1px solid var(--el-line);
  border-radius: 999px;
  background: var(--el-soft);
  padding: 0.42rem 0.82rem;
  color: oklch(0.9 0.03 90);
  font-size: 0.78rem;
}
.horo-personal-chip small {
  color: oklch(0.68 0.025 280);
  font-size: 0.68rem;
}
.horo-oracle-card {
  position: relative;
  overflow: hidden;
  border: 1px solid var(--el-line);
  border-radius: 1.35rem;
  background:
    radial-gradient(circle at 80% 0%, var(--el-soft), transparent 42%),
    linear-gradient(155deg, oklch(0.18 0.03 285 / 0.86), oklch(0.1 0.02 285 / 0.9));
  padding: 1rem;
  box-shadow: 0 28px 72px -52px oklch(0 0 0 / 0.9), inset 0 1px 0 oklch(1 0 0 / 0.06);
}
.horo-oracle-card::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    linear-gradient(120deg, transparent 0 42%, oklch(1 0 0 / 0.065) 50%, transparent 59%),
    radial-gradient(0.8px 0.8px at 18% 25%, oklch(1 0 0 / 0.45), transparent),
    radial-gradient(0.8px 0.8px at 62% 18%, oklch(1 0 0 / 0.32), transparent),
    radial-gradient(0.9px 0.9px at 78% 58%, oklch(1 0 0 / 0.36), transparent);
}
.horo-oracle-head,
.horo-oracle-body {
  position: relative;
  z-index: 1;
}
.horo-oracle-head {
  display: flex;
  align-items: center;
  gap: 0.9rem;
}
.horo-oracle-icon {
  display: grid;
  place-items: center;
  width: 62px;
  height: 62px;
  border-radius: 1rem;
  color: var(--el);
  border: 1px solid var(--el-line);
  background: radial-gradient(circle at 50% 30%, var(--el-soft), oklch(0.1 0.02 285 / 0.6));
  box-shadow: 0 0 28px var(--el-soft);
}
.horo-oracle-kicker {
  color: oklch(0.64 0.025 280);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0;
}
.horo-oracle-head h2 {
  margin-top: 0.1rem;
  color: oklch(0.94 0.03 90);
  font-family: var(--font-cinzel, serif);
  font-size: 1.65rem;
  line-height: 1.1;
}
.horo-oracle-body {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.55rem;
  margin-top: 1rem;
}
.horo-oracle-body div {
  min-width: 0;
  border: 1px solid oklch(0.5 0.02 280 / 0.16);
  border-radius: 0.85rem;
  background: oklch(1 0 0 / 0.035);
  padding: 0.62rem;
}
.horo-oracle-body span {
  display: block;
  margin-bottom: 0.2rem;
  color: oklch(0.56 0.02 280);
  font-size: 0.62rem;
}
.horo-oracle-body strong {
  display: block;
  overflow: hidden;
  color: oklch(0.9 0.03 90);
  font-size: clamp(0.86rem, 1.5vw, 1.12rem);
  font-weight: 760;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── 顶部标题 ── */
.horo-eyebrow {
  display: inline-flex; align-items: center; gap: 0.4rem;
  font-size: 0.7rem; letter-spacing: 0.18em; text-transform: uppercase;
  color: oklch(0.72 0.06 90); padding: 0.3rem 0.85rem; border-radius: 999px;
  border: 1px solid oklch(0.78 0.13 85 / 0.2); background: oklch(0.78 0.13 85 / 0.06);
  margin-bottom: 1rem;
}
.horo-title {
  font-family: var(--font-cinzel, serif);
  font-size: clamp(2.2rem, 4.7vw, 3.8rem); font-weight: 600; line-height: 1.02;
  color: oklch(0.92 0.04 90);
  text-shadow: 0 0 30px oklch(0.78 0.13 85 / 0.25);
}

/* ── 星座选择网格 ── */
.horo-picker {
  width: min(1240px, calc(100% - 2rem));
  margin: 0 auto;
  padding: 0.35rem 0 1.05rem;
}
.horo-sign-grid {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 0.55rem;
}
.horo-sign {
  display: flex; flex-direction: column; align-items: center; gap: 0.35rem;
  padding: 0.7rem 0.34rem 0.62rem; border-radius: 1rem; cursor: pointer;
  border: 1px solid oklch(0.5 0.02 280 / 0.25);
  background: oklch(0.16 0.02 285 / 0.5);
  transition: transform 0.4s cubic-bezier(0.22,1,0.36,1), border-color 0.3s, background 0.3s;
}
.horo-sign:hover { transform: translateY(-3px); border-color: var(--el-line); background: oklch(0.2 0.03 285 / 0.6); }
.horo-sign--active { border-color: var(--el-line); background: var(--el-soft); }
.horo-sign-orb {
  display: grid; place-items: center; width: 42px; height: 42px; border-radius: 50%;
  color: var(--el);
  border: 1px solid var(--el-line);
  background: radial-gradient(circle at 50% 35%, var(--el-soft), transparent 75%);
  transition: box-shadow 0.3s, transform 0.4s cubic-bezier(0.22,1,0.36,1);
}
.horo-sign:hover .horo-sign-orb,
.horo-sign--active .horo-sign-orb {
  box-shadow: 0 0 22px var(--el-soft), inset 0 0 12px var(--el-soft);
}
.horo-sign-name { font-size: 0.8rem; color: oklch(0.86 0.02 280); }
.horo-sign-date { font-size: 0.6rem; color: oklch(0.6 0.02 280); }

/* ── 星座档案头 ── */
.horo-dashboard-wrap {
  width: min(1240px, calc(100% - 2rem));
  margin: 0 auto;
}
.horo-profile {
  position: relative; overflow: hidden;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(300px, 0.78fr);
  align-items: center;
  gap: 1rem;
  border-radius: 1.4rem; padding: 1.05rem 1.15rem; margin-bottom: 0.9rem;
  border: 1px solid var(--el-line);
  background: linear-gradient(160deg, oklch(0.18 0.03 285 / 0.85), oklch(0.12 0.02 285 / 0.9));
}
.horo-profile-glow {
  position: absolute; top: -40%; right: -20%; width: 60%; height: 160%; border-radius: 50%;
  background: radial-gradient(circle, var(--el-soft), transparent 70%);
  pointer-events: none;
}
.horo-profile-main { position: relative; display: flex; align-items: center; gap: 1.1rem; }
.horo-profile-icon {
  flex-shrink: 0; display: grid; place-items: center; width: 68px; height: 68px; border-radius: 1rem;
  color: var(--el); border: 1px solid var(--el-line);
  background: radial-gradient(circle at 50% 30%, var(--el-soft), oklch(0.1 0.02 285 / 0.6));
  box-shadow: 0 0 28px var(--el-soft), inset 0 1px 0 oklch(1 0 0 / 0.05);
}
.horo-profile-name { font-family: var(--font-cinzel, serif); font-size: 1.5rem; color: oklch(0.94 0.03 90); }
.horo-chip {
  font-size: 0.66rem; letter-spacing: 0.08em; padding: 0.15rem 0.6rem; border-radius: 999px;
  color: var(--el); border: 1px solid var(--el-line); background: var(--el-soft);
}
.horo-profile-date { font-size: 0.74rem; color: oklch(0.6 0.02 280); margin-top: 0.2rem; }
.horo-profile-traits { font-size: 0.82rem; color: oklch(0.82 0.03 280); margin-top: 0.45rem; letter-spacing: 0.02em; }
.horo-profile-meta {
  position: relative; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.65rem;
  margin-top: 0; padding-left: 1rem; border-left: 1px solid oklch(0.5 0.02 280 / 0.18);
}
.horo-meta-cell { display: flex; flex-direction: column; gap: 0.25rem; text-align: center; }
.horo-meta-label { font-size: 0.64rem; letter-spacing: 0.1em; color: oklch(0.58 0.02 280); }
.horo-meta-value { font-size: 0.9rem; color: oklch(0.88 0.03 280); font-family: var(--font-cinzel, serif); }

/* ── 状态 ── */
.horo-state { text-align: center; padding: 3rem 1rem; display: flex; flex-direction: column; align-items: center; }
.horo-state--loading {
  border: 1px solid oklch(0.5 0.02 280 / 0.16);
  border-radius: 1.2rem;
  background: oklch(0.15 0.02 285 / 0.45);
}
.horo-spin { animation: horoSpin 1.6s linear infinite; }
@keyframes horoSpin { to { transform: rotate(360deg); } }
.horo-skeleton {
  display: grid;
  gap: 0.55rem;
  width: min(100%, 420px);
  margin-top: 1rem;
}
.horo-skeleton span {
  height: 0.78rem;
  border-radius: 999px;
  background: linear-gradient(90deg, oklch(1 0 0 / 0.05), var(--el-soft), oklch(1 0 0 / 0.05));
  background-size: 220% 100%;
  animation: horoSkeleton 1.4s ease-in-out infinite;
}
.horo-skeleton span:nth-child(2) { width: 82%; margin-inline: auto; }
.horo-skeleton span:nth-child(3) { width: 64%; margin-inline: auto; }
@keyframes horoSkeleton {
  0% { background-position: 0% 50%; }
  100% { background-position: 220% 50%; }
}
.horo-btn-ghost {
  padding: 0.5rem 1.4rem; border-radius: 999px; font-size: 0.85rem; cursor: pointer;
  color: oklch(0.85 0.02 280); border: 1px solid var(--el-line); background: var(--el-soft);
  transition: background 0.25s;
}
.horo-btn-ghost:hover { background: oklch(0.2 0.03 285 / 0.7); }

/* ── 综合指数 + 总结 ── */
.horo-dashboard {
  display: grid;
  grid-template-columns: minmax(0, 1.18fr) minmax(320px, 0.82fr);
  grid-template-areas:
    "summary energy"
    "advice lucky";
  gap: 0.85rem;
}
.horo-summary {
  grid-area: summary;
  display: flex; align-items: center; gap: 1.25rem;
  min-height: 100%;
  border-radius: 1.35rem; padding: 1.2rem 1.35rem; margin-bottom: 0;
  border: 1px solid var(--el-line);
  background: linear-gradient(135deg, var(--el-soft), oklch(0.14 0.02 285 / 0.5));
}
.horo-score {
  flex-shrink: 0; display: flex; flex-direction: column; align-items: center; gap: 0.5rem;
}
.horo-ring {
  position: relative; width: 96px; height: 96px; border-radius: 50%;
  display: grid; place-items: center;
  background:
    radial-gradient(closest-side, oklch(0.12 0.02 285) 72%, transparent 73% 100%),
    conic-gradient(var(--el) calc(var(--pct) * 1%), oklch(0.4 0.02 280 / 0.22) 0);
}
.horo-ring-num { font-family: var(--font-cinzel, serif); font-size: 1.9rem; color: oklch(0.94 0.03 90); line-height: 1; }
.horo-score-label { font-size: 0.66rem; letter-spacing: 0.1em; color: oklch(0.62 0.02 280); white-space: nowrap; }
.horo-summary-copy {
  min-width: 0;
}
.horo-panel-kicker {
  margin-bottom: 0.28rem;
  color: var(--el);
  font-size: 0.68rem;
  font-weight: 760;
  letter-spacing: 0.08em;
}
.horo-panel-title {
  color: oklch(0.94 0.03 90);
  font-family: var(--font-cinzel, serif);
  font-size: 1.22rem;
  line-height: 1.2;
}
.horo-panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.95rem;
}
.horo-summary-text { margin-top: 0.58rem; font-size: 0.94rem; line-height: 1.72; color: oklch(0.88 0.03 280); }

/* ── 能量雷达 ── */
.horo-energy,
.horo-advice {
  position: relative;
  overflow: hidden;
  border: 1px solid oklch(0.5 0.02 280 / 0.18);
  border-radius: 1.35rem;
  background:
    radial-gradient(circle at 90% 10%, var(--el-soft), transparent 34%),
    oklch(0.14 0.02 285 / 0.62);
  padding: 1.1rem;
}
.horo-energy {
  grid-area: energy;
}
.horo-radar-layout {
  display: grid;
  grid-template-columns: 136px minmax(0, 1fr);
  gap: 1rem;
  align-items: center;
}
.horo-radar {
  position: relative;
  width: 136px;
  aspect-ratio: 1;
  border-radius: 50%;
  background:
    radial-gradient(circle at 50% 46%, oklch(1 0 0 / 0.08), transparent 22%),
    radial-gradient(circle, oklch(0.1 0.02 285 / 0.2), oklch(0.07 0.02 285 / 0.72));
  box-shadow: inset 0 0 28px oklch(1 0 0 / 0.035), 0 18px 40px oklch(0 0 0 / 0.26);
}
.horo-radar-ring,
.horo-radar-axis,
.horo-radar-shape,
.horo-radar-dot {
  position: absolute;
  pointer-events: none;
}
.horo-radar-ring {
  inset: 12%;
  border: 1px solid var(--el-line);
  border-radius: 50%;
}
.horo-radar-ring--mid {
  inset: 28%;
  opacity: 0.65;
}
.horo-radar-axis {
  background: linear-gradient(90deg, transparent, var(--el-line), transparent);
  opacity: 0.65;
}
.horo-radar-axis--v {
  left: 50%;
  top: 12%;
  width: 1px;
  height: 76%;
  transform: translateX(-50%);
}
.horo-radar-axis--h {
  left: 12%;
  top: 50%;
  width: 76%;
  height: 1px;
  transform: translateY(-50%);
}
.horo-radar-shape {
  inset: 0;
  background: linear-gradient(135deg, var(--el), oklch(0.86 0.04 95));
  opacity: 0.5;
  filter: drop-shadow(0 0 16px var(--el-soft));
}
.horo-radar-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: oklch(0.96 0.03 92);
  box-shadow: 0 0 12px var(--el);
  transform: translate(-50%, -50%);
}
.horo-radar strong {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: oklch(0.96 0.03 92);
  font-family: var(--font-cinzel, serif);
  font-size: 1.45rem;
}
.horo-energy-list {
  display: grid;
  gap: 0.48rem;
}
.horo-energy-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.8rem;
  min-width: 0;
  border: 1px solid oklch(1 0 0 / 0.055);
  border-radius: 0.85rem;
  padding: 0.5rem 0.62rem;
  background: oklch(1 0 0 / 0.035);
}
.horo-energy-item span {
  color: oklch(0.72 0.025 280);
  font-size: 0.78rem;
}
.horo-energy-item strong {
  color: var(--el);
  font-family: var(--font-cinzel, serif);
  font-size: 1rem;
}

/* ── 行动建议 ── */
.horo-advice {
  grid-area: advice;
}
.horo-keyword {
  flex-shrink: 0;
  max-width: 9rem;
  overflow: hidden;
  border: 1px solid var(--el-line);
  border-radius: 999px;
  background: var(--el-soft);
  padding: 0.32rem 0.7rem;
  color: oklch(0.92 0.03 90);
  font-size: 0.74rem;
  font-weight: 760;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.horo-advice-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.66rem;
}
.horo-advice-grid div {
  min-width: 0;
  border-radius: 1rem;
  border: 1px solid oklch(1 0 0 / 0.065);
  background: oklch(1 0 0 / 0.035);
  padding: 0.82rem;
}
.horo-advice-grid span {
  display: block;
  margin-bottom: 0.42rem;
  color: var(--el);
  font-size: 0.68rem;
  font-weight: 760;
}
.horo-advice-grid p {
  color: oklch(0.82 0.025 280);
  font-size: 0.82rem;
  line-height: 1.62;
}

/* ── 五维度 ── */
.horo-dims {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 0.75rem;
  margin-top: 0.85rem;
}
.horo-dim {
  border-radius: 1.1rem; padding: 0.95rem 1rem;
  border: 1px solid oklch(0.5 0.02 280 / 0.16);
  background: oklch(0.15 0.02 285 / 0.55);
  transition: border-color 0.3s, background 0.3s;
}
.horo-dim:hover { border-color: var(--el-line); background: oklch(0.18 0.03 285 / 0.6); }
.horo-dim-head { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.55rem; }
.horo-dim-icon { display: grid; place-items: center; width: 28px; height: 28px; border-radius: 0.6rem; color: var(--el); background: var(--el-soft); }
.horo-dim-title { font-size: 0.92rem; color: oklch(0.9 0.02 280); flex: 1; }
.horo-stars { display: flex; gap: 0.1rem; color: var(--el); flex-shrink: 0; }
.horo-star-on { color: var(--el); }
.horo-star-off { color: oklch(0.45 0.02 280 / 0.5); }
.horo-dim-text { font-size: 0.82rem; line-height: 1.68; color: oklch(0.74 0.02 280); }

/* ── 幸运提示 ── */
.horo-lucky {
  grid-area: lucky;
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.75rem;
  margin-top: 0;
}
.horo-lucky-cell {
  display: flex; align-items: center; gap: 0.75rem; padding: 1rem 1.25rem; border-radius: 1.1rem;
  border: 1px solid var(--el-line); background: var(--el-soft);
}
.horo-lucky-icon { color: var(--el); flex-shrink: 0; }
.horo-lucky-label { font-size: 0.66rem; letter-spacing: 0.06em; color: oklch(0.6 0.02 280); }
.horo-lucky-value { font-family: var(--font-cinzel, serif); font-size: 1.2rem; color: oklch(0.92 0.03 90); }
.horo-disclaimer { font-size: 0.7rem; text-align: center; color: oklch(0.5 0.02 280); margin-top: 1rem; }

/* ── 相关入口 ── */
.horo-related-wrap {
  width: min(1240px, calc(100% - 2rem));
  margin: 0 auto;
  padding: 2rem 0 3.6rem;
}
.horo-divider { display: flex; align-items: center; gap: 1rem; }
.horo-divider::before, .horo-divider::after { content: ''; flex: 1; height: 1px; background: linear-gradient(90deg, transparent, oklch(0.78 0.13 85 / 0.25), transparent); }
.horo-divider span { font-family: var(--font-cinzel, serif); font-size: 1rem; color: oklch(0.84 0.05 90); white-space: nowrap; }
.horo-related-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.85rem;
  margin-top: 1.1rem;
}
.horo-related {
  display: flex; align-items: center; gap: 0.9rem; padding: 1.1rem 1.25rem; border-radius: 1.1rem;
  border: 1px solid oklch(0.5 0.02 280 / 0.18); background: oklch(0.15 0.02 285 / 0.5);
  transition: transform 0.4s cubic-bezier(0.22,1,0.36,1), border-color 0.3s;
}
.horo-related:hover { transform: translateY(-2px); border-color: oklch(0.78 0.13 85 / 0.3); }
.horo-related-icon { color: oklch(0.78 0.13 85); flex-shrink: 0; }
.horo-related-title { font-size: 0.9rem; color: oklch(0.88 0.02 280); }
.horo-related-desc { font-size: 0.72rem; color: oklch(0.58 0.02 280); margin-top: 0.15rem; }

@media (max-width: 1020px) {
  .horo-hero {
    grid-template-columns: 1fr;
    padding-top: 4.2rem;
  }
  .horo-sign-grid {
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }
  .horo-profile,
  .horo-dashboard {
    grid-template-columns: 1fr;
  }
  .horo-dashboard {
    grid-template-areas:
      "summary"
      "energy"
      "advice"
      "lucky";
  }
  .horo-profile-meta {
    padding-left: 0;
    padding-top: 0.9rem;
    border-left: 0;
    border-top: 1px solid oklch(0.5 0.02 280 / 0.18);
  }
  .horo-dims {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .horo-lucky {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 640px) {
  .horo-hero,
  .horo-picker,
  .horo-dashboard-wrap,
  .horo-related-wrap {
    width: min(100% - 1rem, 1240px);
  }
  .horo-hero {
    padding-top: 3.7rem;
  }
  .horo-title {
    font-size: clamp(2rem, 13vw, 3.2rem);
  }
  .horo-period-tabs {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    width: 100%;
  }
  .horo-period-tab {
    min-width: 0;
    padding-inline: 0.4rem;
  }
  .horo-personal-chip {
    align-items: flex-start;
    flex-direction: column;
    gap: 0.18rem;
    border-radius: 0.9rem;
  }
  .horo-oracle-body {
    grid-template-columns: 1fr;
  }
  .horo-sign-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.45rem;
  }
  .horo-sign {
    border-radius: 0.85rem;
    padding: 0.72rem 0.28rem 0.58rem;
  }
  .horo-sign-orb {
    width: 40px;
    height: 40px;
  }
  .horo-sign-name {
    font-size: 0.74rem;
  }
  .horo-sign-date {
    display: none;
  }
  .horo-profile {
    padding: 1rem;
  }
  .horo-profile-main {
    align-items: flex-start;
  }
  .horo-profile-icon {
    width: 58px;
    height: 58px;
  }
  .horo-profile-meta {
    gap: 0.4rem;
  }
  .horo-meta-label {
    font-size: 0.58rem;
  }
  .horo-meta-value {
    font-size: 0.78rem;
  }
  .horo-summary {
    flex-direction: column;
    align-items: flex-start;
  }
  .horo-score {
    align-self: center;
  }
  .horo-radar-layout {
    grid-template-columns: 1fr;
  }
  .horo-radar {
    margin-inline: auto;
  }
  .horo-advice-grid,
  .horo-dims,
  .horo-lucky,
  .horo-related-grid {
    grid-template-columns: 1fr;
  }
  .horo-panel-head {
    align-items: flex-start;
    flex-direction: column;
    gap: 0.55rem;
  }
  .horo-keyword {
    max-width: 100%;
  }
}
@media (prefers-reduced-motion: reduce) {
  .horo-sign, .horo-related, .horo-period-tab { transition: none; }
  .horo-spin,
  .horo-skeleton span { animation: none; }
}
</style>
