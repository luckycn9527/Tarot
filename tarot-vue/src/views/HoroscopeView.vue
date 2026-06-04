<script setup lang="ts">
import { ref, computed, nextTick, markRaw, onMounted, type Component } from 'vue'
import { useI18n } from 'vue-i18n'
import { useScrollReveal } from '../composables/useScrollReveal'
import { getHoroscope, type HoroscopeResult } from '../services/tarotAiReading'
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

interface ZodiacSign { key: string; icon: string; name: string; date: string }
interface SignMeta { planet: string; modality: string; traits: string; match: string }

const zodiacList = computed(() => tm('pages.horoscope.signs') as ZodiacSign[])
const signMeta = computed(() => tm('pages.horoscope.meta') as Record<string, SignMeta>)

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
const detailRef = ref<HTMLElement | null>(null)

const currentSign = computed(() => zodiacList.value.find(z => z.key === selectedSign.value))
const currentMeta = computed(() => signMeta.value[selectedSign.value])
const currentElement = computed(() => signElement[selectedSign.value])
const currentElementLabel = computed(() => t(`pages.horoscope.elements.${currentElement.value}`))

const horoscopeCache = ref<Record<string, HoroscopeResult>>({})
const loadingSign = ref<string | null>(null)
const errorSign = ref<string | null>(null)

const currentHoroscope = computed<HoroscopeResult | null>(() => horoscopeCache.value[selectedSign.value] ?? null)
const isLoading = computed(() => loadingSign.value === selectedSign.value)
const isError = computed(() => errorSign.value === selectedSign.value)

const todayStr = computed(() => new Intl.DateTimeFormat(String(locale.value), {
  year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
}).format(new Date()))

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

function elementOf(key: string) { return signElement[key] }

function showZodiac(sign: string) {
  selectedSign.value = sign
  if (!horoscopeCache.value[sign] && errorSign.value !== sign) void loadHoroscope()
  nextTick(() => detailRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
}

async function loadHoroscope() {
  const sign = selectedSign.value
  if (loadingSign.value === sign) return
  loadingSign.value = sign
  errorSign.value = null
  try {
    const data = await getHoroscope(sign)
    horoscopeCache.value = { ...horoscopeCache.value, [sign]: data }
  } catch {
    errorSign.value = sign
  } finally {
    loadingSign.value = null
  }
}

onMounted(() => { void loadHoroscope() })
</script>

<template>
  <div class="horo-root relative z-10" :data-element="currentElement">
    <!-- 顶部：标题 + 日期 -->
    <section class="w-full flex flex-col items-center px-4 pt-24 pb-6 text-center">
      <div class="animate-fade-in-up flex flex-col items-center">
        <div class="horo-eyebrow">
          <component :is="SparklesIcon" class="w-3.5 h-3.5" />
          <span>{{ todayStr }}</span>
        </div>
        <h1 class="horo-title">{{ t('pages.horoscope.heroTitle') }}</h1>
        <p class="text-gray-500 text-sm max-w-md mx-auto mt-2">{{ t('pages.horoscope.heroSub') }}</p>
      </div>
    </section>

    <!-- 星座选择：环形发光按钮，按元素着色 -->
    <section class="w-full max-w-5xl mx-auto px-4 pb-10">
      <div class="grid grid-cols-4 sm:grid-cols-6 gap-2.5 sm:gap-3">
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
    <section ref="detailRef" class="w-full max-w-3xl mx-auto px-4 scroll-mt-24">
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
      <div v-if="isLoading" class="horo-state">
        <component :is="OrbitIcon" class="w-9 h-9 text-gold-400 horo-spin" />
        <p class="text-gray-500 text-sm mt-3">{{ t('pages.horoscope.loading') }}</p>
      </div>

      <!-- 错误 -->
      <div v-else-if="isError" class="horo-state">
        <p class="text-gray-500 text-sm mb-3">{{ t('pages.horoscope.loadError') }}</p>
        <button class="horo-btn-ghost" @click="loadHoroscope">{{ t('pages.horoscope.retry') }}</button>
      </div>

      <!-- 运势内容 -->
      <template v-else-if="currentHoroscope">
        <!-- 综合指数环 + 一句话总结 -->
        <div class="horo-summary" :data-element="currentElement">
          <div class="horo-score">
            <div class="horo-ring" :style="{ '--pct': overallPct }">
              <span class="horo-ring-num">{{ overallPct }}</span>
            </div>
            <span class="horo-score-label">{{ t('pages.horoscope.overallScore') }}</span>
          </div>
          <p class="horo-summary-text">{{ currentHoroscope.summary }}</p>
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

        <p class="horo-disclaimer">{{ t('pages.horoscope.disclaimer') }}</p>
      </template>
    </section>

    <!-- 相关入口 -->
    <section class="w-full max-w-3xl mx-auto px-4 pt-12 pb-16">
      <div class="horo-divider"><span>{{ t('pages.horoscope.relatedTitle') }}</span></div>
      <div class="grid sm:grid-cols-2 gap-3 mt-6">
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
  font-size: clamp(2rem, 5vw, 3rem); font-weight: 600; line-height: 1.05;
  color: oklch(0.92 0.04 90);
  text-shadow: 0 0 30px oklch(0.78 0.13 85 / 0.25);
}

/* ── 星座选择网格 ── */
.horo-sign {
  display: flex; flex-direction: column; align-items: center; gap: 0.35rem;
  padding: 0.85rem 0.4rem 0.7rem; border-radius: 1rem; cursor: pointer;
  border: 1px solid oklch(0.5 0.02 280 / 0.25);
  background: oklch(0.16 0.02 285 / 0.5);
  transition: transform 0.4s cubic-bezier(0.22,1,0.36,1), border-color 0.3s, background 0.3s;
}
.horo-sign:hover { transform: translateY(-3px); border-color: var(--el-line); background: oklch(0.2 0.03 285 / 0.6); }
.horo-sign--active { border-color: var(--el-line); background: var(--el-soft); }
.horo-sign-orb {
  display: grid; place-items: center; width: 46px; height: 46px; border-radius: 50%;
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
.horo-profile {
  position: relative; overflow: hidden;
  border-radius: 1.5rem; padding: 1.5rem; margin-bottom: 1.25rem;
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
  flex-shrink: 0; display: grid; place-items: center; width: 76px; height: 76px; border-radius: 1.1rem;
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
  position: relative; display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem;
  margin-top: 1.25rem; padding-top: 1.1rem; border-top: 1px solid oklch(0.5 0.02 280 / 0.18);
}
.horo-meta-cell { display: flex; flex-direction: column; gap: 0.25rem; text-align: center; }
.horo-meta-label { font-size: 0.64rem; letter-spacing: 0.1em; color: oklch(0.58 0.02 280); }
.horo-meta-value { font-size: 0.9rem; color: oklch(0.88 0.03 280); font-family: var(--font-cinzel, serif); }

/* ── 状态 ── */
.horo-state { text-align: center; padding: 3rem 1rem; display: flex; flex-direction: column; align-items: center; }
.horo-spin { animation: horoSpin 1.6s linear infinite; }
@keyframes horoSpin { to { transform: rotate(360deg); } }
.horo-btn-ghost {
  padding: 0.5rem 1.4rem; border-radius: 999px; font-size: 0.85rem; cursor: pointer;
  color: oklch(0.85 0.02 280); border: 1px solid var(--el-line); background: var(--el-soft);
  transition: background 0.25s;
}
.horo-btn-ghost:hover { background: oklch(0.2 0.03 285 / 0.7); }

/* ── 综合指数 + 总结 ── */
.horo-summary {
  display: flex; align-items: center; gap: 1.25rem;
  border-radius: 1.5rem; padding: 1.25rem 1.5rem; margin-bottom: 1.25rem;
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
.horo-summary-text { font-size: 0.95rem; line-height: 1.7; color: oklch(0.88 0.03 280); }

/* ── 五维度 ── */
.horo-dims { display: flex; flex-direction: column; gap: 0.75rem; }
.horo-dim {
  border-radius: 1.1rem; padding: 1.1rem 1.25rem;
  border: 1px solid oklch(0.5 0.02 280 / 0.16);
  background: oklch(0.15 0.02 285 / 0.55);
  transition: border-color 0.3s, background 0.3s;
}
.horo-dim:hover { border-color: var(--el-line); background: oklch(0.18 0.03 285 / 0.6); }
.horo-dim-head { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.55rem; }
.horo-dim-icon { display: grid; place-items: center; width: 28px; height: 28px; border-radius: 0.6rem; color: var(--el); background: var(--el-soft); }
.horo-dim-title { font-size: 0.92rem; color: oklch(0.9 0.02 280); flex: 1; }
.horo-stars { display: flex; gap: 0.1rem; color: var(--el); }
.horo-star-on { color: var(--el); }
.horo-star-off { color: oklch(0.45 0.02 280 / 0.5); }
.horo-dim-text { font-size: 0.86rem; line-height: 1.75; color: oklch(0.74 0.02 280); }

/* ── 幸运提示 ── */
.horo-lucky { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-top: 0.75rem; }
.horo-lucky-cell {
  display: flex; align-items: center; gap: 0.75rem; padding: 1rem 1.25rem; border-radius: 1.1rem;
  border: 1px solid var(--el-line); background: var(--el-soft);
}
.horo-lucky-icon { color: var(--el); flex-shrink: 0; }
.horo-lucky-label { font-size: 0.66rem; letter-spacing: 0.06em; color: oklch(0.6 0.02 280); }
.horo-lucky-value { font-family: var(--font-cinzel, serif); font-size: 1.2rem; color: oklch(0.92 0.03 90); }
.horo-disclaimer { font-size: 0.7rem; text-align: center; color: oklch(0.5 0.02 280); margin-top: 1rem; }

/* ── 相关入口 ── */
.horo-divider { display: flex; align-items: center; gap: 1rem; }
.horo-divider::before, .horo-divider::after { content: ''; flex: 1; height: 1px; background: linear-gradient(90deg, transparent, oklch(0.78 0.13 85 / 0.25), transparent); }
.horo-divider span { font-family: var(--font-cinzel, serif); font-size: 1rem; color: oklch(0.84 0.05 90); white-space: nowrap; }
.horo-related {
  display: flex; align-items: center; gap: 0.9rem; padding: 1.1rem 1.25rem; border-radius: 1.1rem;
  border: 1px solid oklch(0.5 0.02 280 / 0.18); background: oklch(0.15 0.02 285 / 0.5);
  transition: transform 0.4s cubic-bezier(0.22,1,0.36,1), border-color 0.3s;
}
.horo-related:hover { transform: translateY(-2px); border-color: oklch(0.78 0.13 85 / 0.3); }
.horo-related-icon { color: oklch(0.78 0.13 85); flex-shrink: 0; }
.horo-related-title { font-size: 0.9rem; color: oklch(0.88 0.02 280); }
.horo-related-desc { font-size: 0.72rem; color: oklch(0.58 0.02 280); margin-top: 0.15rem; }

@media (max-width: 640px) {
  .horo-summary { flex-direction: column; text-align: center; }
  .horo-profile-meta { gap: 0.4rem; }
}
@media (prefers-reduced-motion: reduce) {
  .horo-sign, .horo-related { transition: none; }
  .horo-spin { animation: none; }
}
</style>
