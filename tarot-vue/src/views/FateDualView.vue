<script setup lang="ts">
import { ref, watch, computed, nextTick, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import api from '@/services/api'
import { useAuth } from '@/composables/useAuth'
import { useToast } from '@/composables/useToast'
import { getCardImageUrl } from '@/data/tarotCards'
import { useShuffle } from '@/composables/useShuffle'
import { useCardBack } from '@/composables/useCardBack'
import FateDualAnalyzingRitual from '@/components/FateDualAnalyzingRitual.vue'
import FateSacredDatetime from '@/components/FateSacredDatetime.vue'

const route = useRoute()
const router = useRouter()
const { t, tm } = useI18n()
const toast = useToast()
const { isLoggedIn, isInitialized, user } = useAuth()

type Step = 'form' | 'pick' | 'analyzing' | 'dual' | 'submitting' | 'done'

const step = ref<Step>('form')
const birthDate = ref('')
const birthTime = ref('')
const question = ref('')
const category = ref<'love' | 'career' | 'wealth'>('career')

interface AnalyzePayload {
  conflictId: number
  bazi: {
    keywords: string[]
    luckTrend: string | null
    fiveElements: Record<string, string> | null
    analysis: string
  }
  tarot: {
    cards: { name: string; nameEn: string; position: string; reversed: boolean }[]
    analysis: string
  }
  conflict: { type: string; level: string | null; summary: string }
  branches: { stable: string; adventure: string }
}

const analysis = ref<AnalyzePayload | null>(null)
const finalResult = ref('')
const choiceMade = ref<'stable' | 'adventure' | null>(null)

const { deck, shuffle } = useShuffle()
const { cardBackUrl, loadCardBack } = useCardBack()
const stripRef = ref<HTMLDivElement | null>(null)
const selectedIndices = ref<number[]>([])

const TOTAL_CARDS = computed(() => deck.value.length)
const allThreePicked = computed(() => selectedIndices.value.length >= 3)
const selectedCards = computed(() =>
  selectedIndices.value.map((i) => deck.value[i]).filter(Boolean),
)

type FateCategory = { value: 'love' | 'career' | 'wealth'; label: string; sub: string; aura: 'love' | 'career' | 'wealth' }

const spreadPositions = computed(() => tm('pages.fateDual.spreadPositions') as string[])
const categories = computed(() => tm('pages.fateDual.categories') as FateCategory[])

/** 必须拨动过日期轮轴才视为已择日（避免空白提交） */
const birthDateWheelTouched = ref(false)
const questionFieldFocused = ref(false)
const altarPanelMounted = ref(false)
const ctaInvoking = ref(false)
const ctaBusyLabel = ref(false)

onMounted(() => {
  requestAnimationFrame(() => {
    altarPanelMounted.value = true
  })
})

watch(
  [isInitialized, isLoggedIn],
  ([init, logged]) => {
    if (!init) return
    if (!logged) {
      void router.replace({ path: '/login', query: { redirect: route.fullPath } })
      return
    }
    // 自动填充档案中已保存的生辰（若有）
    if (user.value?.birthday && !birthDate.value) {
      // birthday 可能是 ISO 格式 "1999-04-21T16:00:00.000Z"，截取 YYYY-MM-DD
      birthDate.value = user.value.birthday.slice(0, 10)
      birthDateWheelTouched.value = true
    }
  },
  { immediate: true },
)

function resetFlow() {
  step.value = 'form'
  analysis.value = null
  finalResult.value = ''
  choiceMade.value = null
  selectedIndices.value = []
  birthDateWheelTouched.value = false
  ctaInvoking.value = false
  ctaBusyLabel.value = false
}

function goToPick() {
  if (!birthDateWheelTouched.value || !birthDate.value) {
    toast.error(t('pages.fateDual.toastPickBirth'))
    return
  }
  if (question.value.trim().length < 5) {
    toast.error(t('pages.fateDual.toastQuestionMin'))
    return
  }
  selectedIndices.value = []
  step.value = 'pick'
  ctaInvoking.value = false
  ctaBusyLabel.value = false
  void nextTick(() => {
    shuffle()
    void loadCardBack(true)
  })
}

function onDateWheelCommit() {
  birthDateWheelTouched.value = true
}

function invokeCtaRitual() {
  if (ctaInvoking.value) return
  if (!birthDateWheelTouched.value || !birthDate.value) {
    toast.error(t('pages.fateDual.toastPickBirth'))
    return
  }
  if (question.value.trim().length < 5) {
    toast.error(t('pages.fateDual.toastQuestionMin'))
    return
  }
  ctaInvoking.value = true
  ctaBusyLabel.value = true
  window.setTimeout(() => {
    ctaBusyLabel.value = false
    goToPick()
  }, 1500)
}

function scrollStrip(direction: 'left' | 'right') {
  const el = stripRef.value
  if (!el) return
  const step = Math.min(400, Math.max(160, Math.round(el.clientWidth * 0.65)))
  el.scrollBy({ left: direction === 'left' ? -step : step, behavior: 'smooth' })
}

function selectPickCard(deckIndex: number) {
  if (allThreePicked.value) return
  if (selectedIndices.value.includes(deckIndex)) return
  selectedIndices.value = [...selectedIndices.value, deckIndex]
}

function resetPickSelection() {
  selectedIndices.value = []
}

async function runAnalyzeWithPickedCards() {
  if (!allThreePicked.value || selectedCards.value.length !== 3) {
    toast.error(t('pages.fateDual.toastPickThree'))
    return
  }
  step.value = 'analyzing'
  try {
    const res = await api.post('/fate/analyze', {
      birth_date: birthDate.value,
      birth_time: birthTime.value || undefined,
      question: question.value.trim(),
      category: category.value,
      card_ids: selectedCards.value.map((s) => s.card.id),
      orientations: selectedCards.value.map((s) => (s.isReversed ? 'reversed' : 'upright')),
    })
    if (!res.data.success) {
      toast.error(res.data.message || t('pages.fateDual.toastAnalyzeFail'))
      step.value = 'pick'
      return
    }
    analysis.value = res.data.data as AnalyzePayload
    step.value = 'dual'
  } catch (e: unknown) {
    const msg = (e as { response?: { data?: { message?: string } } }).response?.data?.message
    toast.error(msg || t('pages.fateDual.toastAnalyzeRetry'))
    step.value = 'pick'
  }
}

async function onChoose(choice: 'stable' | 'adventure') {
  if (!analysis.value) return
  step.value = 'submitting'
  choiceMade.value = choice
  try {
    const res = await api.post('/fate/choose', {
      conflict_id: analysis.value.conflictId,
      choice: choice === 'stable' ? 'stable' : 'adventure',
    })
    if (!res.data.success) {
      toast.error(res.data.message || t('pages.fateDual.toastSubmitFail'))
      step.value = 'dual'
      return
    }
    const data = res.data.data as { result: string; alreadyChosen?: boolean }
    finalResult.value = data.result
    step.value = 'done'
    if (data.alreadyChosen) toast.success(t('pages.fateDual.toastHistoryShown'))
  } catch (e: unknown) {
    const msg = (e as { response?: { data?: { message?: string } } }).response?.data?.message
    toast.error(msg || t('pages.fateDual.toastSubmitFail'))
    step.value = 'dual'
  }
}

const categoryLabel = computed(
  () => categories.value.find((c) => c.value === category.value)?.label ?? t('pages.fateDual.categoryDefault'),
)

/** 终页正文：优先按空行分段，否则按单行拆段 */
const finalResultParagraphs = computed(() => {
  const raw = finalResult.value.trim()
  if (!raw) return []
  const byBlank = raw.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean)
  if (byBlank.length > 1) return byBlank
  return raw.split('\n').map((s) => s.trim()).filter(Boolean)
})

/** 五行块配色（与东方栏呼应） */
function elementBlockClass(key: string): string {
  const map: Record<string, string> = {
    金: 'rounded-xl border p-3 bg-gradient-to-b from-amber-500/15 to-amber-950/40 border-amber-500/30',
    木: 'rounded-xl border p-3 bg-gradient-to-b from-emerald-500/12 to-emerald-950/30 border-emerald-500/25',
    水: 'rounded-xl border p-3 bg-gradient-to-b from-sky-500/12 to-sky-950/30 border-sky-500/25',
    火: 'rounded-xl border p-3 bg-gradient-to-b from-rose-500/12 to-orange-950/25 border-rose-500/25',
    土: 'rounded-xl border p-3 bg-gradient-to-b from-yellow-700/15 to-stone-900/40 border-yellow-700/30',
  }
  return map[key] ?? 'rounded-xl border p-3 bg-white/[0.04] border-white/10'
}

function splitDisplayParagraphs(text: string): string[] {
  const raw = text.trim()
  if (!raw) return []
  const byBlank = raw.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean)
  if (byBlank.length > 1) return byBlank
  return [raw]
}

type ShichenKey = 'zi' | 'chou' | 'yin' | 'mao' | 'chen' | 'si' | 'wu' | 'wei' | 'shen' | 'you' | 'xu' | 'hai'

function shichenKeyFromHour(h: number): ShichenKey {
  if (h === 23 || h === 0) return 'zi'
  if (h >= 1 && h < 3) return 'chou'
  if (h >= 3 && h < 5) return 'yin'
  if (h >= 5 && h < 7) return 'mao'
  if (h >= 7 && h < 9) return 'chen'
  if (h >= 9 && h < 11) return 'si'
  if (h >= 11 && h < 13) return 'wu'
  if (h >= 13 && h < 15) return 'wei'
  if (h >= 15 && h < 17) return 'shen'
  if (h >= 17 && h < 19) return 'you'
  if (h >= 19 && h < 21) return 'xu'
  if (h >= 21 && h < 23) return 'hai'
  return 'zi'
}

function shichenLabelForHour(h: number): string {
  const key = shichenKeyFromHour(h)
  return t(`pages.fateDual.shichen.${key}`)
}

/** 生辰展示文案（日期为公历；时辰对照传统十二时辰） */
const birthDateOracle = computed(() => {
  if (!birthDate.value) return t('pages.fateDual.birthDatePending')
  const [y, m, d] = birthDate.value.split('-').map(Number)
  if (!y || !m || !d) return ''
  return t('pages.fateDual.birthDateAnchored', {
    y,
    m: String(m).padStart(2, '0'),
    d: String(d).padStart(2, '0'),
  })
})

const birthTimeOracle = computed(() => {
  if (!birthTime.value) return t('pages.fateDual.birthTimeDefault')
  const [hh, mm] = birthTime.value.split(':')
  const h = Number(hh)
  if (Number.isNaN(h)) return birthTime.value
  const sc = shichenLabelForHour(h)
  return t('pages.fateDual.birthTimeOracle', { hh, mm: mm || '00', sc })
})
</script>

<template>
  <div
    class="fate-altar-page relative min-h-[100dvh] min-h-screen overflow-x-hidden bg-[#0A0512] text-[#E2D9F3]"
    :class="step === 'form' ? 'fate-altar-page--form' : 'fate-altar-page--inner'"
  >
    <!-- 深渊背景：径向渐变 + 星轨微粒 + 巨型罗盘（慢旋） -->
    <div class="pointer-events-none fixed inset-0 -z-20 bg-[radial-gradient(circle_at_50%_42%,#160B24_0%,#0A0512_62%,#050208_100%)]" />
    <div class="pointer-events-none fixed inset-0 -z-20 fate-altar-drift" aria-hidden="true" />
    <div
      class="pointer-events-none fixed inset-0 -z-10 flex items-center justify-center motion-reduce:animate-none"
      aria-hidden="true"
    >
      <svg
        class="fate-mega-wheel w-full max-w-[min(92vw,760px)] text-[#D4AF37] motion-reduce:animate-none sm:max-w-[min(95vw,720px)]"
        viewBox="0 0 400 400"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="fateWheelGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#8A2BE2" stop-opacity="0.35" />
            <stop offset="100%" stop-color="#4169E1" stop-opacity="0.3" />
          </linearGradient>
        </defs>
        <circle cx="200" cy="200" r="188" stroke="currentColor" stroke-opacity="0.11" stroke-width="0.7" />
        <circle cx="200" cy="200" r="152" stroke="url(#fateWheelGrad)" stroke-width="0.55" />
        <circle cx="200" cy="200" r="118" stroke="currentColor" stroke-opacity="0.08" stroke-width="0.45" />
        <circle cx="200" cy="200" r="56" stroke="currentColor" stroke-opacity="0.06" stroke-width="0.4" />
        <g transform="translate(200,200)">
          <g v-for="k in 8" :key="k" :transform="'rotate(' + (k - 1) * 45 + ')'">
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="-186"
              stroke="currentColor"
              stroke-opacity="0.065"
              stroke-width="0.65"
            />
          </g>
        </g>
        <g transform="translate(200,200)" stroke="currentColor" stroke-opacity="0.05" stroke-width="0.5">
          <polygon points="0,-72 62.35,36 -62.35,36" />
          <polygon points="0,72 -62.35,-36 62.35,-36" />
        </g>
      </svg>
    </div>

    <div class="relative z-10 mx-auto max-w-5xl">
      <header
        class="flex flex-col items-center gap-3 text-center"
        :class="step === 'form' ? 'mb-4 sm:mb-5' : 'mb-10 sm:mb-12'"
      >
        <template v-if="step !== 'form'">
          <p class="text-xs tracking-[0.28em] text-[#D4AF37]/55">FATE DUAL</p>
          <h1 class="font-serif text-3xl font-semibold tracking-[0.12em] text-[#E2D9F3] sm:text-4xl">{{ t('pages.fateDual.heroTitle') }}</h1>
          <p class="max-w-lg text-sm leading-relaxed text-[#8A7E9F]">
            {{ t('pages.fateDual.tagline') }}
          </p>
        </template>
        <RouterLink
          v-if="step === 'form'"
          to="/fate-dual/history"
          class="self-end text-xs text-[#8A7E9F] transition-colors hover:text-[#D4AF37]/85"
        >
          {{ t('pages.fateDual.historyLinkForm') }}
        </RouterLink>
        <RouterLink
          v-else
          to="/fate-dual/history"
          class="text-xs text-[#D4AF37]/65 transition-colors hover:text-[#D4AF37]"
        >
          {{ t('pages.fateDual.historyLinkInner') }}
        </RouterLink>
      </header>

      <!-- Step: 祭坛表单（重构：顶部英雄标题 + 三段式布局） -->
      <div
        v-if="step === 'form'"
        class="fate-form-altar relative mx-auto max-w-[min(96vw,1180px)]"
        :class="{ 'fate-altar-panel--entered': altarPanelMounted }"
      >
        <!-- 英雄标题区 -->
        <div class="mb-8 text-center sm:mb-10">
          <p class="mb-3 text-[10px] uppercase tracking-[0.45em] text-[#D4AF37]/60">{{ t('pages.fateDual.formKicker') }}</p>
          <h1 class="font-serif text-3xl font-semibold tracking-[0.18em] text-[#E2D9F3] sm:text-4xl lg:text-5xl">
            {{ t('pages.fateDual.formHeroTitle') }}
          </h1>
          <p class="mx-auto mt-3 max-w-md text-sm leading-relaxed text-[#8A7E9F]/80">
            {{ t('pages.fateDual.tagline') }}
          </p>
          <div class="mx-auto mt-4 h-px w-32 bg-gradient-to-r from-transparent via-[#D4AF37]/40 to-transparent" />
        </div>

        <div
          class="transition-opacity duration-500 ease-out"
          :class="ctaInvoking ? 'pointer-events-none opacity-[0.28]' : 'opacity-100'"
        >
          <!-- 三段式：命盘 | 问题 | 领域 -->
          <div class="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">

            <!-- 左：命盘时空（占 7 列） -->
            <section class="fate-altar-glass min-h-0 min-w-0 rounded-2xl p-4 sm:p-5 lg:col-span-7" aria-labelledby="fate-anchor-title">
              <div class="mb-3 flex items-center gap-2.5">
                <svg class="h-5 w-5 text-[#D4AF37]/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 2v4M12 18v4M2 12h4M18 12h4" stroke-linecap="round" />
                </svg>
                <div>
                  <h2 id="fate-anchor-title" class="font-serif text-base tracking-[0.2em] text-[#E2D9F3] sm:text-lg">
                    {{ t('pages.fateDual.sectionAnchorTitle') }}
                  </h2>
                  <p class="text-[10px] leading-snug text-[#8A7E9F]">{{ t('pages.fateDual.sectionAnchorHint') }}</p>
                </div>
              </div>
              <FateSacredDatetime v-model:birth-date="birthDate" v-model:birth-time="birthTime" @date-commit="onDateWheelCommit" />
            </section>

            <!-- 右：问题 + 领域（占 5 列） -->
            <aside class="flex min-h-0 min-w-0 flex-col gap-5 lg:col-span-5">
              <!-- 问题卡片 -->
              <div class="fate-altar-glass flex-1 rounded-2xl p-4 sm:p-5">
                <div class="mb-3 flex items-center gap-2">
                  <svg class="h-5 w-5 text-[#8A2BE2]/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
                    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                  <label class="text-xs tracking-[0.2em] text-[#E2D9F3]/90">{{ t('pages.fateDual.questionLabel') }}</label>
                </div>
                <textarea
                  v-model="question"
                  rows="4"
                  maxlength="300"
                  :placeholder="t('pages.fateDual.questionPh')"
                  class="fate-question-sink w-full resize-none rounded-xl border border-transparent bg-[rgba(255,255,255,0.02)] px-3 py-3 font-serif text-sm leading-relaxed text-[#E2D9F3] placeholder:text-[#8A7E9F]/55 focus:border-[#8A2BE2]/25 focus:outline-none focus:ring-0"
                  style="min-height: 120px"
                  :class="{ 'fate-question-sink--breath': questionFieldFocused || question.length > 0 }"
                  @focus="questionFieldFocused = true"
                  @blur="questionFieldFocused = false"
                />
              </div>

              <!-- 领域卡片 -->
              <div class="fate-altar-glass rounded-2xl p-4 sm:p-5">
                <div class="mb-3 flex items-center gap-2">
                  <svg class="h-5 w-5 text-[#D4AF37]/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke-linejoin="round" />
                  </svg>
                  <p class="text-xs tracking-[0.2em] text-[#E2D9F3]/90">{{ t('pages.fateDual.domainLabel') }}</p>
                </div>
                <div class="grid grid-cols-3 gap-2.5">
                  <button
                    v-for="c in categories"
                    :key="c.value"
                    type="button"
                    class="fate-mystic-badge group relative flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border px-2 py-4 transition-all duration-200"
                    :class="[
                      category === c.value
                        ? `fate-mystic-badge--on fate-mystic-badge--${c.aura}`
                        : 'fate-mystic-badge--off border-white/[0.06] bg-[#160B24]/40',
                    ]"
                    @click="category = c.value"
                  >
                <!-- 感情：双星 -->
                <svg
                  v-if="c.aura === 'love'"
                  class="h-7 w-7 text-[#E2D9F3]/80"
                  viewBox="0 0 48 48"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle cx="16" cy="24" r="6" stroke="currentColor" stroke-width="1.2" />
                  <circle cx="32" cy="24" r="6" stroke="currentColor" stroke-width="1.2" />
                  <path d="M22 24c2 2 4 2 6 0" stroke="currentColor" stroke-width="1" stroke-linecap="round" />
                </svg>
                <!-- 事业：权杖阶梯 -->
                <svg
                  v-else-if="c.aura === 'career'"
                  class="h-7 w-7 text-[#E2D9F3]/80"
                  viewBox="0 0 48 48"
                  fill="none"
                  aria-hidden="true"
                >
                  <path d="M24 8v32M18 38h12" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
                  <path d="M16 30h4v6h-4zM22 24h4v12h-4zM28 18h4v18h-4z" stroke="currentColor" stroke-width="1" />
                </svg>
                <!-- 财运：金币 -->
                <svg
                  v-else
                  class="h-7 w-7 text-[#E2D9F3]/80"
                  viewBox="0 0 48 48"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle cx="24" cy="24" r="14" stroke="currentColor" stroke-width="1.2" />
                  <circle cx="24" cy="24" r="9" stroke="currentColor" stroke-width="0.9" stroke-opacity="0.5" />
                  <path
                    d="M24 17v14M17 24h14"
                    stroke="currentColor"
                    stroke-width="0.9"
                    stroke-linecap="round"
                    opacity="0.6"
                  />
                </svg>
                <span class="text-center font-serif text-[11px] leading-tight text-[#E2D9F3]">{{ c.label }}</span>
                <span class="hidden text-[9px] text-[#8A7E9F]/80 sm:inline">{{ c.sub }}</span>
              </button>
                </div>
              </div>
            </aside>
          </div>
        </div>

        <!-- 召唤 CTA（全宽贴底，独立于卡片之外） -->
        <div class="relative mt-8 sm:mt-10">
          <div class="mx-auto h-px w-full max-w-lg bg-gradient-to-r from-transparent via-[#D4AF37]/20 to-transparent" />
          <div class="pt-6 sm:pt-8">
          <div
            class="pointer-events-none absolute inset-0 -z-10 rounded-[34px] opacity-0 blur-xl transition-opacity duration-500"
            :class="ctaInvoking ? 'opacity-70 fate-cta-nova' : ''"
            aria-hidden="true"
          />
          <button
            type="button"
            class="fate-cta-summon relative z-[1] flex h-16 w-full cursor-pointer items-center justify-center overflow-hidden rounded-[32px] text-base font-semibold tracking-wide text-[#E2D9F3] transition-all duration-200"
            :class="ctaInvoking ? 'fate-cta-summon--pulse scale-[1.02]' : 'hover:brightness-110'"
            :disabled="ctaInvoking"
            @click="invokeCtaRitual"
          >
            <span class="fate-cta-summon-border motion-reduce:animate-none" aria-hidden="true" />
            <span class="fate-cta-summon-inner relative flex flex-col items-center justify-center gap-0.5 px-4">
              <span class="font-serif text-lg sm:text-[1.15rem]">
                {{ ctaBusyLabel ? t('pages.fateDual.ctaBusy') : t('pages.fateDual.ctaIdle') }}
              </span>
            </span>
          </button>
          <p class="mx-auto mt-4 max-w-sm text-center text-[11px] leading-relaxed text-[#555]">
            {{ t('pages.fateDual.ctaFootnote') }}
          </p>
          </div>
        </div>
      </div>

      <!-- Step: 抽三张（过去 / 现在 / 未来） -->
      <div
        v-else-if="step === 'pick'"
        class="max-w-4xl mx-auto"
      >
        <div class="text-center mb-8">
          <h2 class="text-lg font-serif text-gold-200 mb-2">{{ t('pages.fateDual.pickTitle') }}</h2>
          <p class="text-gray-500 text-sm">
            {{ t('pages.fateDual.pickHint', { n: 3, spread: t('pages.fateDual.pickSpread') }) }}
          </p>
        </div>

        <div v-if="TOTAL_CARDS < 3" class="text-center text-amber-400/90 text-sm py-12">
          {{ t('pages.fateDual.deckLoading') }}
        </div>
        <template v-else>
          <div class="relative mb-10">
            <button type="button" class="strip-nav-btn left-0" @click="scrollStrip('left')">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 18l-6-6 6-6" /></svg>
            </button>
            <button type="button" class="strip-nav-btn right-0" @click="scrollStrip('right')">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 18l6-6-6-6" /></svg>
            </button>
            <div ref="stripRef" class="strip-scroll overflow-x-auto py-6 px-8 min-[400px]:py-8 min-[400px]:px-12 sm:px-14">
              <div class="flex items-end">
                <div
                  v-for="cardIndex in TOTAL_CARDS"
                  :key="cardIndex"
                  class="card-slot flex-shrink-0"
                  :style="{ marginLeft: cardIndex > 1 ? '-16px' : '0', zIndex: cardIndex }"
                  @click="selectPickCard(cardIndex - 1)"
                >
                  <div
                    class="card-back"
                    :class="[
                      selectedIndices.includes(cardIndex - 1) ? 'card-selected' : allThreePicked ? 'card-disabled' : 'card-idle',
                    ]"
                  >
                    <img :src="cardBackUrl" alt="" class="w-full h-full object-cover rounded-[8px]">
                  </div>
                </div>
              </div>
            </div>
            <p class="text-center text-gray-600 text-xs mt-2">{{ t('pages.fateDual.stripSwipe') }}</p>
          </div>

          <div class="mb-10">
            <p class="text-center text-gray-600 text-sm mb-5">{{ t('pages.fateDual.positionsCaption') }}</p>
            <div class="flex flex-wrap justify-center gap-5">
              <div
                v-for="(position, posIndex) in spreadPositions"
                :key="posIndex"
                class="flex flex-col items-center"
              >
                <div
                  class="position-slot"
                  :class="selectedIndices.length > posIndex ? 'position-filled' : 'position-empty'"
                >
                  <template v-if="selectedIndices.length > posIndex && selectedCards[posIndex]">
                    <div class="w-full h-full rounded-lg overflow-hidden">
                      <img
                        :src="getCardImageUrl(selectedCards[posIndex].card.nameEn, selectedCards[posIndex].card)"
                        :alt="selectedCards[posIndex].card.name"
                        class="w-full h-full object-cover"
                        :class="selectedCards[posIndex].isReversed ? 'rotate-180' : ''"
                      >
                    </div>
                  </template>
                  <template v-else>
                    <span class="text-gray-600 text-2xl font-light font-serif">{{ posIndex + 1 }}</span>
                  </template>
                </div>
                <p class="text-gray-500 text-xs mt-2.5 text-center max-w-[100px]">{{ position }}</p>
                <p
                  v-if="selectedIndices.length > posIndex && selectedCards[posIndex]"
                  class="text-gold-300 text-xs mt-1 text-center max-w-[100px] font-medium"
                >
                  {{ selectedCards[posIndex].card.name }}
                  <span class="text-gray-600">{{ selectedCards[posIndex].isReversed ? t('pages.fateDual.reversed') : t('pages.fateDual.upright') }}</span>
                </p>
              </div>
            </div>
          </div>

          <div class="flex flex-col sm:flex-row gap-3 justify-center items-center pb-4">
            <button
              type="button"
              class="cursor-pointer px-6 py-2.5 rounded-full bg-white/4 border border-gold-500/15 text-gray-400 text-sm hover:bg-gold-500/5 transition-colors duration-200"
              @click="step = 'form'"
            >
              {{ t('pages.fateDual.backEditBirth') }}
            </button>
            <button
              v-if="selectedIndices.length > 0 && !allThreePicked"
              type="button"
              class="cursor-pointer px-6 py-2.5 rounded-full bg-white/4 border border-gold-500/15 text-gray-400 text-sm hover:bg-gold-500/5 transition-colors duration-200"
              @click="resetPickSelection"
            >
              {{ t('pages.fateDual.resetPickOrder') }}
            </button>
            <button
              v-if="allThreePicked"
              type="button"
              class="cursor-pointer px-10 py-4 rounded-2xl cta-button text-white font-medium text-lg transition-all duration-200 hover:shadow-[0_0_32px_rgba(138,43,226,0.3)]"
              @click="runAnalyzeWithPickedCards"
            >
              {{ t('pages.fateDual.runAnalyze') }}
            </button>
          </div>
        </template>
      </div>

      <!-- Analyzing：紫色牌灵环绕 + 中心金阴阳鱼 -->
      <FateDualAnalyzingRitual v-else-if="step === 'analyzing'" />

      <!-- Dual + conflict + branches -->
      <div v-else-if="step === 'dual' && analysis" class="space-y-10">
        <!-- 阅盘提要：领域、所问、命盘锚点 + 阅读指引 -->
        <div
          class="relative overflow-hidden rounded-2xl border border-gold-500/20 bg-gradient-to-br from-[#1a1528]/95 via-[#0a0812]/90 to-violet-950/25 px-6 py-8 sm:px-10 sm:py-10 fate-dual-hero"
        >
          <div class="pointer-events-none absolute -right-8 -top-12 h-56 w-56 rounded-full bg-violet-600/15 blur-3xl" />
          <div class="pointer-events-none absolute -bottom-16 -left-10 h-52 w-52 rounded-full bg-amber-600/12 blur-3xl" />
          <div class="relative flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
            <div class="min-w-0 flex-1">
              <p class="mb-3 text-[10px] uppercase tracking-[0.28em] text-gold-500/75">{{ t('pages.fateDual.briefTitle') }}</p>
              <span
                class="mb-4 inline-flex rounded-full border border-gold-500/25 bg-gold-500/10 px-3 py-1 text-xs text-gold-200/95"
              >{{ t('pages.fateDual.briefDomainBadge', { label: categoryLabel }) }}</span>
              <blockquote
                class="fate-dual-question border-l-2 border-gold-500/45 pl-4 font-serif text-base leading-relaxed text-gray-100/95 sm:pl-5 sm:text-lg"
              >
                「{{ question.trim() }}」
              </blockquote>
            </div>
            <div class="shrink-0 space-y-2 border-t border-white/5 pt-6 text-xs text-gray-500 lg:border-t-0 lg:border-l lg:pl-8 lg:pt-0">
              <p class="font-serif tracking-[0.2em] text-amber-200/55">{{ t('pages.fateDual.anchorLabel') }}</p>
              <p class="leading-relaxed text-gray-400">{{ birthDateOracle }}</p>
              <p class="leading-relaxed text-gray-500">{{ birthTimeOracle }}</p>
            </div>
          </div>
          <p class="relative mt-8 max-w-3xl text-xs leading-relaxed text-gray-500">
            {{ t('pages.fateDual.readGuide') }}
          </p>
        </div>

        <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <!-- 东方 -->
          <section
            class="relative overflow-hidden rounded-2xl border border-amber-600/25 bg-gradient-to-br from-amber-950/45 to-black/45 p-6 sm:p-7"
          >
            <div class="pointer-events-none absolute right-0 top-0 h-32 w-32 rounded-full bg-amber-400/5 blur-2xl" />
            <div class="relative">
              <div class="mb-1 flex items-center gap-2.5">
                <svg class="h-6 w-6 text-amber-400/80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
                  <path d="M3 7h18M3 12h18M3 17h18" stroke-linecap="round" />
                </svg>
                <h3 class="font-serif text-lg text-amber-200/90">{{ t('pages.fateDual.eastTitle') }}</h3>
              </div>
              <p class="mb-5 text-xs text-amber-500/55">{{ t('pages.fateDual.eastDisclaimer') }}</p>
              <div v-if="analysis.bazi.luckTrend" class="mb-3 flex items-center gap-2 text-sm text-amber-200/85">
                <span class="rounded-md bg-amber-500/15 px-2 py-0.5 text-[10px] tracking-wider text-amber-400/90">{{ t('pages.fateDual.qiLabel') }}</span>
                <span class="font-medium">{{ analysis.bazi.luckTrend }}</span>
              </div>
              <p class="mb-2 text-[10px] uppercase tracking-widest text-amber-600/50">{{ t('pages.fateDual.kwHeading') }}</p>
              <div class="mb-5 flex flex-wrap gap-2">
                <span
                  v-for="(kw, i) in analysis.bazi.keywords"
                  :key="i"
                  class="rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 text-xs text-amber-200/90"
                >{{ kw }}</span>
              </div>
              <template v-if="analysis.bazi.fiveElements && Object.keys(analysis.bazi.fiveElements).length">
                <p class="mb-2 text-[10px] uppercase tracking-widest text-amber-600/50">{{ t('pages.fateDual.fiveHeading') }}</p>
                <div class="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-5">
                  <div
                    v-for="(v, k) in analysis.bazi.fiveElements"
                    :key="k"
                    :class="elementBlockClass(String(k))"
                  >
                    <p class="text-xs font-medium text-amber-100/90">{{ k }}</p>
                    <p class="mt-1 text-[11px] leading-snug text-gray-400">{{ v }}</p>
                  </div>
                </div>
              </template>
              <div class="space-y-3 border-t border-amber-500/10 pt-5">
                <p
                  v-for="(para, pi) in splitDisplayParagraphs(analysis.bazi.analysis)"
                  :key="pi"
                  class="text-sm leading-[1.75] text-gray-300"
                >
                  {{ para }}
                </p>
              </div>
            </div>
          </section>

          <!-- 西方 -->
          <section
            class="relative overflow-hidden rounded-2xl border border-violet-500/25 bg-gradient-to-br from-violet-950/40 to-black/45 p-6 sm:p-7"
          >
            <div class="pointer-events-none absolute -left-8 bottom-0 h-40 w-40 rounded-full bg-violet-500/10 blur-3xl" />
            <div class="relative">
              <div class="mb-5 flex items-center gap-2.5">
                <svg class="h-6 w-6 text-violet-400/80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
                  <path d="M12 2l2.09 6.26L20.18 9l-5 4.09L16.18 20 12 16.77 7.82 20l1-6.91-5-4.09 6.09-.74L12 2z" stroke-linejoin="round" stroke-linecap="round" />
                </svg>
                <h3 class="font-serif text-lg text-violet-200/90">{{ t('pages.fateDual.westTitle') }}</h3>
              </div>
              <div class="relative mb-6 px-2">
                <div
                  class="pointer-events-none absolute left-[12%] right-[12%] top-[42%] hidden h-px bg-gradient-to-r from-transparent via-violet-500/25 to-transparent sm:block"
                  aria-hidden="true"
                />
                <div class="relative flex justify-center gap-3 sm:gap-5">
                  <div
                    v-for="(c, idx) in analysis.tarot.cards"
                    :key="idx"
                    class="relative flex w-[28%] max-w-[118px] flex-col items-center"
                  >
                    <span
                      class="mb-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-2 py-0.5 text-[10px] text-violet-300/80"
                    >{{ c.position }}</span>
                    <div
                      class="aspect-[2/3] w-full overflow-hidden rounded-lg border border-violet-500/25 shadow-lg shadow-violet-950/30"
                      :class="c.reversed ? 'ring-1 ring-violet-400/35' : ''"
                    >
                      <img
                        :src="getCardImageUrl(c.nameEn)"
                        :alt="c.name"
                        class="h-full w-full object-cover"
                        :class="c.reversed ? 'rotate-180' : ''"
                      >
                    </div>
                    <p class="mt-2 text-center text-xs font-medium text-violet-200/90">{{ c.name }}</p>
                    <p class="text-[10px] text-gray-500">{{ c.reversed ? t('pages.fateDual.reversed') : t('pages.fateDual.upright') }}</p>
                  </div>
                </div>
              </div>
              <div class="space-y-3 border-t border-violet-500/10 pt-5">
                <p
                  v-for="(para, pi) in splitDisplayParagraphs(analysis.tarot.analysis)"
                  :key="pi"
                  class="text-sm leading-[1.75] text-gray-300"
                >
                  {{ para }}
                </p>
              </div>
            </div>
          </section>
        </div>

        <!-- 天平 / 冲突 -->
        <section
          class="relative overflow-hidden rounded-2xl border border-gold-500/25 bg-gradient-to-b from-gold-500/[0.07] via-transparent to-transparent p-8 text-center sm:p-10"
        >
          <div
            class="pointer-events-none absolute inset-0 opacity-40 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(212,175,110,0.22),transparent_55%)]"
          />
          <div class="relative mx-auto max-w-3xl">
            <div class="mb-2 flex flex-col items-center gap-2 sm:flex-row sm:justify-center sm:gap-3">
              <svg class="h-7 w-7 text-gold-400/80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
                <path d="M12 3v18M3 9l3-6h12l3 6M6 9a3 3 0 006 0M12 9a3 3 0 006 0" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              <p class="text-xs tracking-[0.35em] text-gold-500/80">{{ t('pages.fateDual.scaleTitle') }}</p>
            </div>
            <p class="mb-1 font-serif text-xl text-gold-200 sm:text-2xl">{{ analysis.conflict.type }}</p>
            <p v-if="analysis.conflict.level" class="mb-6 text-xs text-gray-500">
              {{ t('pages.fateDual.tensionPrefix') }}<span class="text-gold-500/70">{{ analysis.conflict.level }}</span>
            </p>
            <div
              class="rounded-xl border border-gold-500/15 bg-black/25 px-5 py-6 text-left sm:px-8 sm:text-center"
            >
              <p class="mb-2 text-[10px] uppercase tracking-widest text-gold-600/50">{{ t('pages.fateDual.mergeSummary') }}</p>
              <p
                v-for="(para, pi) in splitDisplayParagraphs(analysis.conflict.summary)"
                :key="pi"
                class="text-base leading-relaxed text-gray-200 sm:text-lg"
                :class="pi > 0 ? 'mt-3' : ''"
              >
                {{ para }}
              </p>
            </div>
          </div>
        </section>

        <!-- 分支 -->
        <section>
          <h3 class="mb-2 text-center font-serif text-lg text-gold-200/85">{{ t('pages.fateDual.forkTitle') }}</h3>
          <p class="mx-auto mb-8 max-w-xl text-center text-xs leading-relaxed text-gray-500">
            {{ t('pages.fateDual.forkIntro') }}
          </p>
          <div class="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div
              class="fate-branch-card rounded-2xl border border-slate-500/30 bg-gradient-to-b from-slate-900/50 to-slate-950/60 p-6"
            >
              <div class="mb-3 h-1 w-12 rounded-full bg-slate-400/40" />
              <p class="mb-1 font-medium text-slate-200">{{ t('pages.fateDual.branchATitle') }}</p>
              <p class="mb-4 text-[11px] leading-relaxed text-slate-500">{{ t('pages.fateDual.branchASub') }}</p>
              <div class="space-y-2.5">
                <p
                  v-for="(para, pi) in splitDisplayParagraphs(analysis.branches.stable)"
                  :key="pi"
                  class="text-sm leading-relaxed text-gray-400"
                >
                  {{ para }}
                </p>
              </div>
            </div>
            <div
              class="fate-branch-card rounded-2xl border border-fuchsia-500/30 bg-gradient-to-b from-fuchsia-950/35 to-black/50 p-6"
            >
              <div class="mb-3 h-1 w-12 rounded-full bg-fuchsia-400/50" />
              <p class="mb-1 font-medium text-fuchsia-100/95">{{ t('pages.fateDual.branchBTitle') }}</p>
              <p class="mb-4 text-[11px] leading-relaxed text-fuchsia-300/40">{{ t('pages.fateDual.branchBSub') }}</p>
              <div class="space-y-2.5">
                <p
                  v-for="(para, pi) in splitDisplayParagraphs(analysis.branches.adventure)"
                  :key="pi"
                  class="text-sm leading-relaxed text-gray-400"
                >
                  {{ para }}
                </p>
              </div>
            </div>
          </div>
        </section>

        <div class="space-y-4 pt-2 text-center">
          <p class="text-sm text-gray-400">{{ t('pages.fateDual.choosePrompt') }}</p>
          <p class="mx-auto max-w-md text-xs text-gray-600">{{ t('pages.fateDual.chooseHint') }}</p>
          <div class="mx-auto flex max-w-xl flex-col gap-4 sm:flex-row">
            <button
              type="button"
              class="flex-1 cursor-pointer rounded-2xl border border-slate-400/35 bg-slate-800/55 py-4 font-medium text-slate-100 transition-all duration-200 hover:bg-slate-700/55 hover:border-slate-300/45 hover:shadow-[0_0_24px_rgba(148,163,184,0.15)]"
              @click="onChoose('stable')"
            >
              {{ t('pages.fateDualHistory.choiceStable') }}
            </button>
            <button
              type="button"
              class="flex-1 cursor-pointer rounded-2xl border border-fuchsia-500/45 bg-fuchsia-900/35 py-4 font-medium text-fuchsia-100 transition-all duration-200 hover:bg-fuchsia-800/45 hover:border-fuchsia-400/55 hover:shadow-[0_0_24px_rgba(192,132,252,0.2)]"
              @click="onChoose('adventure')"
            >
              {{ t('pages.fateDualHistory.choiceAdventure') }}
            </button>
          </div>
        </div>
      </div>

      <!-- Submitting choice -->
      <div v-else-if="step === 'submitting'" class="text-center py-24">
        <div class="inline-block w-10 h-10 border-2 border-fuchsia-500/30 border-t-fuchsia-400 rounded-full animate-spin mb-4" />
        <p class="text-gray-400 text-sm">{{ t('pages.fateDual.inscribing') }}</p>
      </div>

      <!-- Final：分栏 + 侧栏提要，缓解「只有一段字」的单调感 -->
      <div v-else-if="step === 'done'" class="mx-auto max-w-4xl space-y-10">
        <div class="text-center">
          <div class="mx-auto mb-4 h-px max-w-xs bg-gradient-to-r from-transparent via-gold-500/35 to-transparent" />
          <p class="mb-3 text-[10px] uppercase tracking-[0.35em] text-gold-500/65">{{ t('pages.fateDual.sealedChoice') }}</p>
          <span
            class="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium backdrop-blur-sm"
            :class="
              choiceMade === 'stable'
                ? 'border-slate-400/35 bg-slate-500/15 text-slate-100'
                : 'border-fuchsia-500/35 bg-fuchsia-500/10 text-fuchsia-100'
            "
          >
            {{ choiceMade === 'stable' ? t('pages.fateDual.pathStable') : t('pages.fateDual.pathAdventure') }}
          </span>
          <h3 class="mt-6 font-serif text-2xl text-gold-50 sm:text-3xl">{{ t('pages.fateDual.finalTitle') }}</h3>
          <p class="mx-auto mt-2 max-w-lg text-xs leading-relaxed text-gray-500">
            {{ t('pages.fateDual.finalSub') }}
          </p>
        </div>

        <div class="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-10 lg:items-start">
          <aside
            class="order-2 space-y-4 rounded-2xl border border-white/8 bg-white/[0.02] p-5 lg:order-1 lg:col-span-4 lg:sticky lg:top-[calc(6rem+env(safe-area-inset-top,0px))]"
          >
            <p class="text-[10px] uppercase tracking-widest text-gold-600/55">{{ t('pages.fateDual.memoTitle') }}</p>
            <div class="rounded-xl border border-gold-500/15 bg-gold-500/[0.06] px-3 py-2 text-xs text-gold-200/90">
              {{ categoryLabel }}
            </div>
            <blockquote class="border-l-2 border-violet-500/30 pl-3 text-xs leading-relaxed text-gray-500">
              {{ question.trim() }}
            </blockquote>
            <div v-if="analysis" class="space-y-3 border-t border-white/6 pt-4 text-xs text-gray-500">
              <p class="text-[10px] uppercase tracking-wider text-gray-600">{{ t('pages.fateDual.recapTitle') }}</p>
              <ul class="space-y-2">
                <li
                  v-for="(c, idx) in analysis.tarot.cards"
                  :key="idx"
                  class="flex justify-between gap-2 border-b border-white/5 pb-2 last:border-0"
                >
                  <span class="text-violet-300/75">{{ c.position }}</span>
                  <span class="text-right text-gray-400">{{ c.name }}</span>
                </li>
              </ul>
              <div v-if="analysis.bazi.keywords?.length" class="flex flex-wrap gap-1.5 pt-1">
                <span
                  v-for="(kw, i) in analysis.bazi.keywords.slice(0, 6)"
                  :key="i"
                  class="rounded-md bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-200/80"
                >{{ kw }}</span>
              </div>
            </div>
          </aside>

          <div class="order-1 lg:order-2 lg:col-span-8">
            <div class="fate-done-prose relative overflow-hidden rounded-2xl border border-gold-500/20 bg-gradient-to-br from-[#141018]/95 via-black/40 to-violet-950/15 p-8 sm:p-10">
              <span class="fate-done-quote-mark" aria-hidden="true">"</span>
              <div class="relative space-y-5">
                <p
                  v-for="(para, pi) in finalResultParagraphs"
                  :key="pi"
                  class="text-left text-base leading-[1.85] text-gray-200/95 first:font-serif first:text-lg first:text-gold-100/95 sm:text-[1.05rem]"
                  :class="pi === 0 ? 'sm:first-letter:float-left sm:first-letter:mr-2 sm:first-letter:font-serif sm:first-letter:text-4xl sm:first-letter:leading-none sm:first-letter:text-gold-400/90' : ''"
                >
                  {{ para }}
                </p>
              </div>
            </div>
            <p class="mt-5 text-center text-xs leading-relaxed text-gray-600">
              {{ t('pages.fateDual.shareHint') }}
            </p>
            <div class="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
              <button
                type="button"
                class="cursor-pointer rounded-full border border-gold-500/30 px-8 py-3 text-sm text-gold-200 transition-all duration-200 hover:bg-gold-500/10 hover:border-gold-500/50 hover:shadow-[0_0_20px_rgba(212,175,55,0.12)]"
                @click="resetFlow"
              >
                {{ t('pages.fateDual.again') }}
              </button>
              <RouterLink
                to="/fate-dual/history"
                class="cursor-pointer rounded-full border border-white/10 px-8 py-3 text-sm text-gray-400 transition-all duration-200 hover:border-gold-500/20 hover:text-gold-300/90 hover:shadow-[0_0_16px_rgba(212,175,55,0.08)]"
              >
                {{ t('pages.fateDual.historyLinkInner') }}
              </RouterLink>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fate-altar-page {
  padding-left: max(1rem, env(safe-area-inset-left, 0px));
  padding-right: max(1rem, env(safe-area-inset-right, 0px));
  padding-bottom: max(3rem, env(safe-area-inset-bottom, 0px));
}
.fate-altar-page--form {
  padding-top: calc(5rem + env(safe-area-inset-top, 0px));
}
.fate-altar-page--inner {
  padding-top: calc(5rem + env(safe-area-inset-top, 0px));
  padding-bottom: calc(5rem + env(safe-area-inset-bottom, 0px));
}
/* 小屏表单区：不再限制高度，允许自然滚动 */
.fate-birth-realm {
  --fate-gold: rgba(212, 175, 110, 0.88);
  --fate-gold-dim: rgba(212, 175, 110, 0.35);
  --fate-violet-glow: rgba(124, 58, 237, 0.12);
}

.fate-birth-frame {
  position: relative;
  padding: 1.5rem 1.25rem 1.75rem;
  border-radius: 1rem;
  background:
    radial-gradient(ellipse 130% 90% at 50% -20%, rgba(180, 130, 60, 0.14), transparent 55%),
    radial-gradient(ellipse 70% 45% at 100% 100%, var(--fate-violet-glow), transparent 55%),
    radial-gradient(ellipse 50% 40% at 0% 80%, rgba(212, 175, 110, 0.06), transparent 50%),
    linear-gradient(168deg, rgba(22, 16, 32, 0.97), rgba(6, 4, 12, 0.99));
  border: 1px solid rgba(212, 175, 110, 0.22);
  box-shadow:
    inset 0 1px 0 rgba(255, 230, 180, 0.05),
    0 0 0 1px rgba(0, 0, 0, 0.45),
    0 24px 48px -28px rgba(0, 0, 0, 0.75);
}

.fate-corner {
  position: absolute;
  width: 16px;
  height: 16px;
  pointer-events: none;
  border-color: var(--fate-gold-dim);
}

.fate-c-tl {
  top: 12px;
  left: 12px;
  border-top: 2px solid;
  border-left: 2px solid;
  border-top-left-radius: 2px;
}

.fate-c-tr {
  top: 12px;
  right: 12px;
  border-top: 2px solid;
  border-right: 2px solid;
  border-top-right-radius: 2px;
}

.fate-c-bl {
  bottom: 12px;
  left: 12px;
  border-bottom: 2px solid;
  border-left: 2px solid;
  border-bottom-left-radius: 2px;
}

.fate-c-br {
  bottom: 12px;
  right: 12px;
  border-bottom: 2px solid;
  border-right: 2px solid;
  border-bottom-right-radius: 2px;
}

.fate-birth-eyebrow {
  font-family: ui-serif, Georgia, 'Times New Roman', serif;
  letter-spacing: 0.42em;
  font-size: 0.65rem;
  color: var(--fate-gold);
  text-indent: 0.42em;
}

.fate-birth-sub {
  font-size: 0.72rem;
  line-height: 1.65;
  color: rgba(163, 163, 180, 0.92);
  max-width: 22rem;
  margin: 0.6rem auto 0;
}

.fate-birth-divider {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  margin-top: 1rem;
}

.fate-birth-line {
  flex: 1;
  max-width: 5rem;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--fate-gold-dim), transparent);
}

.fate-birth-star {
  color: rgba(212, 175, 110, 0.45);
  font-size: 0.6rem;
}

.fate-birth-glyph {
  color: rgba(212, 175, 110, 0.5);
  font-size: 0.95rem;
  line-height: 1;
}

.fate-label {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.68rem;
  letter-spacing: 0.14em;
  color: rgba(230, 210, 170, 0.92);
  margin-bottom: 0.45rem;
  font-family: ui-serif, Georgia, 'Songti SC', 'Noto Serif SC', serif;
}

.fate-label-icon {
  font-size: 0.85rem;
  opacity: 0.8;
  filter: drop-shadow(0 0 8px rgba(212, 175, 110, 0.25));
}

.fate-moon {
  color: rgba(196, 181, 253, 0.75);
  filter: drop-shadow(0 0 10px rgba(139, 92, 246, 0.2));
}

.fate-label-optional {
  letter-spacing: 0.06em;
  color: rgba(115, 115, 130, 0.95);
  font-size: 0.62rem;
  margin-left: 0.15rem;
}

.fate-input-inner {
  border-radius: 0.65rem;
  padding: 2px;
  background: linear-gradient(
    128deg,
    rgba(212, 175, 110, 0.28),
    rgba(88, 28, 135, 0.18) 45%,
    rgba(212, 175, 110, 0.1)
  );
}

.fate-native-datetime {
  width: 100%;
  box-sizing: border-box;
  color-scheme: dark;
  background: rgba(5, 3, 12, 0.94);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 0.5rem;
  padding: 0.7rem 0.9rem;
  color: rgba(240, 235, 220, 0.96);
  font-size: 0.9rem;
  font-variant-numeric: tabular-nums;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.fate-native-datetime:focus {
  outline: none;
  border-color: rgba(212, 175, 110, 0.5);
  box-shadow:
    0 0 0 2px rgba(212, 175, 110, 0.12),
    inset 0 0 20px rgba(212, 175, 110, 0.03);
}

.fate-native-datetime::-webkit-calendar-picker-indicator {
  filter: invert(0.9) sepia(0.4) saturate(4) hue-rotate(5deg) brightness(0.9);
  cursor: pointer;
  opacity: 0.88;
}

.fate-oracle-line {
  margin-top: 0.55rem;
  min-height: 1.4em;
  font-size: 0.68rem;
  line-height: 1.55;
  color: rgba(150, 148, 168, 0.95);
  font-family: ui-serif, Georgia, 'Songti SC', 'Noto Serif SC', serif;
  letter-spacing: 0.04em;
}

/* 命运双盘 · 抽三牌（与 Reader 抽牌条一致） */
.strip-nav-btn {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 100;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: rgba(3, 1, 8, 0.85);
  border: 1px solid rgba(212, 168, 83, 0.15);
  color: var(--color-gold-300);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  backdrop-filter: blur(8px);
}
.strip-nav-btn:hover {
  background: rgba(3, 1, 8, 0.95);
  border-color: rgba(212, 168, 83, 0.4);
  box-shadow: 0 0 16px rgba(212, 168, 83, 0.1);
}
@media (max-width: 380px) {
  .strip-nav-btn {
    width: 36px;
    height: 36px;
  }
}
.strip-scroll {
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.strip-scroll::-webkit-scrollbar {
  display: none;
}
.card-slot {
  cursor: pointer;
}
.card-back {
  width: 72px;
  height: 112px;
  border-radius: 10px;
  overflow: hidden;
  position: relative;
  transition: all 0.3s ease;
  border: 2px solid rgba(212, 168, 83, 0.2);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.4);
}
@media (min-width: 640px) {
  .card-back {
    width: 80px;
    height: 126px;
  }
}
.card-idle {
  cursor: pointer;
}
.card-idle:hover {
  transform: translateY(-16px);
  border-color: rgba(212, 168, 83, 0.5);
  box-shadow:
    0 10px 28px rgba(212, 168, 83, 0.15),
    0 4px 16px rgba(0, 0, 0, 0.5);
  z-index: 999 !important;
}
.card-selected {
  opacity: 0.15;
  transform: scale(0.88);
  pointer-events: none;
  filter: grayscale(1);
}
.card-disabled {
  opacity: 0.35;
  pointer-events: none;
}
.position-slot {
  width: 80px;
  height: 120px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.5s ease;
}
@media (min-width: 640px) {
  .position-slot {
    width: 96px;
    height: 144px;
  }
}
.position-empty {
  border: 2px dashed rgba(212, 168, 83, 0.15);
  background: rgba(255, 255, 255, 0.01);
}
.position-filled {
  border: 2px solid rgba(212, 168, 83, 0.35);
  background: rgba(212, 168, 83, 0.04);
  box-shadow: 0 0 20px rgba(212, 168, 83, 0.08);
  animation: fate-position-fill-in 0.5s ease-out;
}
@keyframes fate-position-fill-in {
  from {
    opacity: 0;
    transform: scale(0.75);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

/* 结果页：提要区与终页长文 */
.fate-dual-hero {
  box-shadow:
    inset 0 1px 0 rgba(255, 230, 180, 0.04),
    0 20px 50px -24px rgba(0, 0, 0, 0.65);
}
.fate-dual-question {
  text-wrap: pretty;
}
.fate-branch-card {
  box-shadow: 0 12px 40px -20px rgba(0, 0, 0, 0.55);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  cursor: default;
}
.fate-branch-card:hover {
  border-color: rgba(212, 175, 110, 0.22);
  box-shadow:
    0 16px 48px -18px rgba(0, 0, 0, 0.6),
    0 0 24px rgba(212, 175, 110, 0.06);
}
.fate-done-prose {
  box-shadow:
    inset 0 1px 0 rgba(255, 230, 180, 0.05),
    0 24px 56px -28px rgba(0, 0, 0, 0.75);
}
.fate-done-quote-mark {
  position: absolute;
  left: 0.85rem;
  top: 0.5rem;
  font-family: ui-serif, Georgia, 'Times New Roman', serif;
  font-size: 4.5rem;
  line-height: 1;
  color: rgba(212, 175, 110, 0.12);
  pointer-events: none;
  user-select: none;
}
@media (min-width: 640px) {
  .fate-done-quote-mark {
    left: 1.25rem;
    font-size: 5.5rem;
  }
}

/* —— 命运祭坛 · 全页视觉（表单步） —— */
.fate-altar-drift {
  opacity: 0.42;
  background-image:
    radial-gradient(1.5px 1.5px at 8% 18%, rgba(226, 217, 243, 0.55), transparent),
    radial-gradient(1px 1px at 22% 72%, rgba(65, 105, 225, 0.45), transparent),
    radial-gradient(1px 1px at 78% 28%, rgba(212, 175, 55, 0.5), transparent),
    radial-gradient(1.5px 1.5px at 88% 80%, rgba(138, 43, 226, 0.4), transparent),
    radial-gradient(1px 1px at 45% 8%, rgba(226, 217, 243, 0.35), transparent),
    radial-gradient(1px 1px at 55% 92%, rgba(212, 175, 55, 0.35), transparent);
  background-size: 120% 120%;
  animation: fate-altar-drift-move 90s linear infinite;
}
@keyframes fate-altar-drift-move {
  0% {
    background-position: 0% 0%;
  }
  100% {
    background-position: 100% 100%;
  }
}

.fate-mega-wheel {
  opacity: 0.1;
  animation: fate-mega-wheel-spin 120s linear infinite;
}
@keyframes fate-mega-wheel-spin {
  to {
    transform: rotate(360deg);
  }
}

.fate-altar-glass {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(212, 175, 55, 0.14);
  box-shadow:
    0 0 48px rgba(138, 43, 226, 0.1),
    0 24px 80px -32px rgba(0, 0, 0, 0.75),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
}

.fate-altar-panel--entered {
  animation: fate-altar-emerge 1.05s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  opacity: 0;
  filter: blur(18px);
  transform: scale(0.95) translateY(14px);
}
@keyframes fate-altar-emerge {
  to {
    opacity: 1;
    filter: blur(0);
    transform: scale(1) translateY(0);
  }
}

.fate-altar-divider {
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(212, 175, 55, 0.38), transparent);
}

@keyframes fate-altar-glint-pulse {
  0%,
  100% {
    opacity: 0.5;
    filter: drop-shadow(0 0 5px rgba(212, 175, 55, 0.35));
  }
  50% {
    opacity: 1;
    filter: drop-shadow(0 0 14px rgba(212, 175, 55, 0.9));
  }
}
.fate-altar-glint {
  animation: fate-altar-glint-pulse 2.6s ease-in-out infinite;
}

.fate-question-sink {
  box-shadow: inset 0 3px 28px rgba(0, 0, 0, 0.42);
  transition:
    box-shadow 0.35s ease,
    border-color 0.35s ease;
}
.fate-question-sink:focus {
  box-shadow:
    0 0 0 1px rgba(138, 43, 226, 0.22),
    0 0 32px rgba(138, 43, 226, 0.14),
    inset 0 3px 28px rgba(0, 0, 0, 0.45);
}
.fate-question-sink--breath {
  animation: fate-question-breath 4.2s ease-in-out infinite;
}
@keyframes fate-question-breath {
  0%,
  100% {
    box-shadow:
      0 0 0 1px rgba(138, 43, 226, 0.12),
      0 0 22px rgba(65, 105, 225, 0.08),
      inset 0 3px 28px rgba(0, 0, 0, 0.42);
  }
  50% {
    box-shadow:
      0 0 0 1px rgba(138, 43, 226, 0.22),
      0 0 38px rgba(138, 43, 226, 0.14),
      inset 0 3px 28px rgba(0, 0, 0, 0.48);
  }
}

.fate-mystic-badge--off:hover {
  border-color: rgba(212, 175, 55, 0.18);
  background: rgba(22, 11, 36, 0.55);
}
.fate-mystic-badge--on {
  position: relative;
  z-index: 1;
}
.fate-mystic-badge--love.fate-mystic-badge--on {
  border-color: rgba(232, 121, 249, 0.45);
  box-shadow:
    0 0 36px rgba(192, 132, 252, 0.22),
    0 4px 16px -4px rgba(0, 0, 0, 0.55),
    inset 0 1px 0 rgba(232, 121, 249, 0.15);
}
.fate-mystic-badge--career.fate-mystic-badge--on {
  border-color: rgba(212, 175, 55, 0.55);
  box-shadow:
    0 0 32px rgba(212, 175, 55, 0.2),
    0 4px 16px -4px rgba(0, 0, 0, 0.55),
    inset 0 1px 0 rgba(212, 175, 55, 0.15);
}
.fate-mystic-badge--wealth.fate-mystic-badge--on {
  border-color: rgba(251, 191, 36, 0.5);
  box-shadow:
    0 0 34px rgba(251, 191, 36, 0.18),
    0 4px 16px -4px rgba(0, 0, 0, 0.55),
    inset 0 1px 0 rgba(251, 191, 36, 0.15);
}

.fate-cta-summon {
  position: relative;
  isolation: isolate;
  background: transparent;
  border: none;
  padding: 0;
  cursor: pointer;
}
.fate-cta-summon:disabled {
  cursor: wait;
}
.fate-cta-summon-border {
  position: absolute;
  inset: 0;
  border-radius: 32px;
  background: conic-gradient(from 0deg, #8a2be2, #4169e1, #d4af37, #8a2be2);
  animation: fate-cta-border-spin 4.8s linear infinite;
}
.fate-cta-summon-inner {
  position: absolute;
  inset: 2px;
  border-radius: 30px;
  background: #160b24;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow:
    inset 0 0 48px rgba(138, 43, 226, 0.09),
    inset 0 -12px 40px rgba(0, 0, 0, 0.35);
}
.fate-cta-summon--pulse .fate-cta-summon-inner {
  box-shadow:
    inset 0 0 60px rgba(138, 43, 226, 0.22),
    0 0 40px rgba(138, 43, 226, 0.45);
}
@keyframes fate-cta-border-spin {
  to {
    transform: rotate(360deg);
  }
}

.fate-cta-nova {
  background: radial-gradient(circle, rgba(138, 43, 226, 0.55) 0%, transparent 65%);
}

@media (prefers-reduced-motion: reduce) {
  .fate-mega-wheel,
  .fate-altar-drift,
  .fate-cta-summon-border,
  .fate-altar-glint,
  .fate-question-sink--breath {
    animation: none !important;
  }
  .fate-altar-panel--entered {
    animation: none !important;
    opacity: 1 !important;
    filter: none !important;
    transform: none !important;
  }
  .fate-mega-wheel {
    transform: none;
  }
}
</style>
