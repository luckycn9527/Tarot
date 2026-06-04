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
import { Solar } from 'lunar-javascript'
import { computeZiwei, ZIWEI_GRID_POS, type ZiweiChart } from '@/composables/useZiwei'

void FateSacredDatetime

const route = useRoute()
const router = useRouter()
const { t, tm } = useI18n()
const toast = useToast()
const { isLoggedIn, isInitialized, user } = useAuth()

type Step = 'form' | 'pick' | 'analyzing' | 'dual' | 'submitting' | 'done'

const step = ref<Step>('form')
const birthDate = ref('1999-04-21')
const birthTime = ref('12:00')
const question = ref('')
const category = ref<'love' | 'career' | 'wealth'>('career')

const birthYear = ref<number | null>(1999)
const birthMonth = ref<number | null>(4)
const birthDay = ref<number | null>(21)
const birthHour = ref<number | null>(12)
const birthMinute = ref<number | null>(0)
const birthPlace = ref('中国·北京市')
const gender = ref<'male' | 'female'>('male')
const solarCorrection = ref(false)
const chartType = ref<'bazi' | 'ziwei'>('bazi')

type DomainKey = 'love' | 'career' | 'wealth' | 'health' | 'relationship' | 'decision'
const selectedDomain = ref<DomainKey>('career')
const domainOptions: { key: DomainKey; label: string; sub: string; category: 'love' | 'career' | 'wealth' }[] = [
  { key: 'love', label: '感情', sub: '缠绵情感', category: 'love' },
  { key: 'career', label: '事业', sub: '发展方向', category: 'career' },
  { key: 'wealth', label: '财运', sub: '财富机遇', category: 'wealth' },
  { key: 'health', label: '健康', sub: '身心状态', category: 'wealth' },
  { key: 'relationship', label: '人际', sub: '关系解析', category: 'love' },
  { key: 'decision', label: '抉择', sub: '人生选择', category: 'career' },
]

/** 各领域的问题示例（点选即填入，降低输入门槛） */
const questionSuggestionMap: Record<DomainKey, string[]> = {
  love: ['我的正缘什么时候出现？', '这段感情还有未来吗？', '我和 TA 适合在一起吗？'],
  career: ['我现在适合换工作吗？', '我的事业方向在哪里？', '这个机会值得把握吗？'],
  wealth: ['我今年的财运如何？', '这笔投资值得吗？', '我该如何改善财务状况？'],
  health: ['我近期的身心状态如何？', '我该如何调整作息？', '有什么需要留意的健康信号？'],
  relationship: ['我和家人的关系会改善吗？', '我该如何处理这段人际矛盾？', '谁是我生命中的贵人？'],
  decision: ['我面临的这个选择该怎么定？', '我该坚持还是放手？', '哪条路更适合现在的我？'],
}
const questionSuggestions = computed(() => questionSuggestionMap[selectedDomain.value] ?? [])

/** 流程引导步骤（让多步流程更清晰） */
const flowSteps = ['命盘信息', '直觉选牌', '双盘推演', '命运启示']
const currentStepIndex = computed(() => {
  switch (step.value) {
    case 'form': return 0
    case 'pick': return 1
    case 'analyzing': return 2
    case 'dual': return 2
    case 'submitting': return 3
    case 'done': return 3
    default: return 0
  }
})

type PathScores = Partial<Record<'稳健' | '成长' | '风险' | '回报' | '心力', number>>

interface AnalyzePayload {
  conflictId: number
  bazi: {
    keywords: string[]
    luckTrend: string | null
    fiveElements: Record<string, string> | null
    fiveElementScores: Record<string, number> | null
    dayMaster: string | null
    dayMasterStrength: string | null
    favorable: string[]
    unfavorable: string[]
    pattern: string | null
    advice: string | null
    analysis: string
  }
  tarot: { cards: { name: string; nameEn: string; position: string; reversed: boolean }[]; analysis: string }
  conflict: { type: string; level: string | null; summary: string }
  branches: {
    stable: string
    adventure: string
    stableTag: string | null
    adventureTag: string | null
    stableHorizon: string | null
    adventureHorizon: string | null
    stableScores: PathScores | null
    adventureScores: PathScores | null
  }
}

const analysis = ref<AnalyzePayload | null>(null)
const finalResult = ref('')
const choiceMade = ref<'stable' | 'adventure' | null>(null)

const { deck, shuffle } = useShuffle()
const { cardBackUrl, loadCardBack } = useCardBack()
const stripRef = ref<HTMLDivElement | null>(null)
const askRef = ref<HTMLElement | null>(null)
const selectedIndices = ref<number[]>([])

const TOTAL_CARDS = computed(() => deck.value.length)
const allThreePicked = computed(() => selectedIndices.value.length >= 3)
const selectedCards = computed(() =>
  selectedIndices.value.map((i) => deck.value[i]).filter(Boolean),
)

const spreadPositions = computed(() => tm('pages.fateDual.spreadPositions') as string[])

const birthDateWheelTouched = ref(false)
const questionFieldFocused = ref(false)
const altarPanelMounted = ref(false)
const ctaInvoking = ref(false)
const ctaBusyLabel = ref(false)

onMounted(() => { requestAnimationFrame(() => { altarPanelMounted.value = true }) })

watch(
  [isInitialized, isLoggedIn],
  ([init, logged]) => {
    if (!init) return
    if (!logged) { void router.replace({ path: '/login', query: { redirect: route.fullPath } }); return }
    if (user.value?.birthday && !birthDate.value) {
      birthDate.value = user.value.birthday.slice(0, 10)
      birthDateWheelTouched.value = true
    }
  },
  { immediate: true },
)

function resetFlow() {
  step.value = 'form'; analysis.value = null; finalResult.value = ''; choiceMade.value = null
  selectedIndices.value = []; birthDateWheelTouched.value = false; ctaInvoking.value = false; ctaBusyLabel.value = false
}

function goToPick() {
  const missing = firstMissing()
  if (missing) { toast.error(missing); return }
  selectedIndices.value = []; step.value = 'pick'; ctaInvoking.value = false; ctaBusyLabel.value = false
  void nextTick(() => { shuffle(); void loadCardBack(true) })
}

function onDateWheelCommit() { birthDateWheelTouched.value = true }

function pad2(n: number) { return n < 10 ? `0${n}` : `${n}` }

watch(birthDate, (s) => {
  const [y, m, d] = (s || '').split('-').map(Number)
  if (y && m && d) { if (birthYear.value !== y) birthYear.value = y; if (birthMonth.value !== m) birthMonth.value = m; if (birthDay.value !== d) birthDay.value = d }
}, { immediate: true })

watch(birthTime, (s) => {
  const [hh, mm] = (s || '').split(':').map(Number)
  if (!Number.isNaN(hh) && hh !== undefined) { if (birthHour.value !== hh) birthHour.value = hh; if (birthMinute.value !== (Number.isNaN(mm) ? 0 : mm)) birthMinute.value = Number.isNaN(mm) ? 0 : mm }
}, { immediate: true })

function commitBirthDate() {
  const y = birthYear.value, m = birthMonth.value, d = birthDay.value
  if (y && m && d) { const maxDay = new Date(y, m, 0).getDate(); const safeDay = Math.min(Math.max(1, d), maxDay); if (safeDay !== d) birthDay.value = safeDay; birthDate.value = `${y}-${pad2(m)}-${pad2(safeDay)}`; onDateWheelCommit() }
}

function commitBirthTime() {
  const h = birthHour.value ?? 0, mm = birthMinute.value ?? 0
  const safeH = Math.min(Math.max(0, h), 23), safeM = Math.min(Math.max(0, mm), 59)
  if (safeH !== birthHour.value) birthHour.value = safeH; if (safeM !== birthMinute.value) birthMinute.value = safeM
  birthTime.value = `${pad2(safeH)}:${pad2(safeM)}`
}

const baziPillars = computed(() => {
  const y = birthYear.value, m = birthMonth.value, d = birthDay.value
  if (!y || !m || !d) return null
  try {
    const solar = Solar.fromYmdHms(y, m, d, birthHour.value ?? 12, birthMinute.value ?? 0, 0)
    const ec = solar.getLunar().getEightChar()
    return { year: ec.getYear(), month: ec.getMonth(), day: ec.getDay(), time: ec.getTime() }
  } catch { return null }
})

/** 紫微斗数星盘（按出生信息实时排盘） */
const ziweiChart = computed<ZiweiChart | null>(() => {
  if (chartType.value !== 'ziwei') return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate.value)) return null
  return computeZiwei(birthDate.value, birthHour.value, gender.value)
})

/** 将十二宫按传统棋盘 4×4 坐标排布，供模板渲染 */
const ziweiBoard = computed(() => {
  const chart = ziweiChart.value
  if (!chart) return []
  return chart.palaces.map((p) => ({
    ...p,
    pos: ZIWEI_GRID_POS[p.earthlyBranch] ?? { row: 1, col: 1 },
  }))
})

function selectDomain(opt: { key: DomainKey; category: 'love' | 'career' | 'wealth' }) {
  selectedDomain.value = opt.key
  category.value = opt.category
}

function applySuggestion(text: string) {
  question.value = text
}

/** 校验缺失项：返回第一条缺失提示，无缺失返回 null */
function firstMissing(): string | null {
  if (!birthDate.value || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate.value)) return t('pages.fateDual.toastPickBirth')
  if (question.value.trim().length < 5) return t('pages.fateDual.toastQuestionMin')
  return null
}
const canSubmit = computed(() => firstMissing() === null)

function invokeCtaRitual() {
  if (ctaInvoking.value) return
  const missing = firstMissing()
  if (missing) {
    toast.error(missing)
    void nextTick(() => askRef.value?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
    return
  }
  ctaInvoking.value = true
  ctaBusyLabel.value = true
  // 短暂仪式过场后进入抽牌（缩短等待，避免空耗）
  window.setTimeout(() => { ctaBusyLabel.value = false; goToPick() }, 650)
}

function scrollStrip(direction: 'left' | 'right') {
  const el = stripRef.value; if (!el) return
  const step2 = Math.min(400, Math.max(160, Math.round(el.clientWidth * 0.65)))
  el.scrollBy({ left: direction === 'left' ? -step2 : step2, behavior: 'smooth' })
}

function selectPickCard(deckIndex: number) {
  if (allThreePicked.value) return; if (selectedIndices.value.includes(deckIndex)) return
  selectedIndices.value = [...selectedIndices.value, deckIndex]
}
function resetPickSelection() { selectedIndices.value = [] }
/** 撤销上一张选牌（比整体重选更轻量） */
function undoLastCard() { selectedIndices.value = selectedIndices.value.slice(0, -1) }
/** 重新洗牌并清空已选 */
function reshuffleDeck() { selectedIndices.value = []; shuffle() }

/** 构建发送给后端的紫微斗数精简摘要（命宫/身宫/五行局/命主身主 + 关键宫位主星） */
function buildZiweiSummary() {
  const chart = ziweiChart.value
  if (!chart) return null
  const palaceBrief = chart.palaces.map((p) => {
    const stars = [...p.majorStars, ...p.minorStars]
      .map((s) => s.name + (s.brightness ? `(${s.brightness})` : '') + (s.mutagen ? `[化${s.mutagen}]` : ''))
      .join('、')
    return `${p.name}（${p.heavenlyStem}${p.earthlyBranch}）：${stars || '空宫'}`
  })
  return {
    fiveElementsClass: chart.fiveElementsClass,
    soul: chart.soul,
    body: chart.body,
    soulBranch: chart.soulBranch,
    bodyBranch: chart.bodyBranch,
    zodiac: chart.zodiac,
    sign: chart.sign,
    lunarDate: chart.lunarDate,
    palaces: palaceBrief,
  }
}

async function runAnalyzeWithPickedCards() {
  if (!allThreePicked.value || selectedCards.value.length !== 3) { toast.error(t('pages.fateDual.toastPickThree')); return }
  step.value = 'analyzing'
  try {
    const res = await api.post('/fate/analyze', {
      birth_date: birthDate.value, birth_time: birthTime.value || undefined,
      question: question.value.trim(), category: category.value,
      card_ids: selectedCards.value.map((s) => s.card.id),
      orientations: selectedCards.value.map((s) => (s.isReversed ? 'reversed' : 'upright')),
      chart_type: chartType.value,
      ziwei: chartType.value === 'ziwei' ? buildZiweiSummary() : undefined,
    })
    if (!res.data.success) { toast.error(res.data.message || t('pages.fateDual.toastAnalyzeFail')); step.value = 'pick'; return }
    analysis.value = res.data.data as AnalyzePayload; step.value = 'dual'
  } catch (e: unknown) {
    const msg = (e as { response?: { data?: { message?: string } } }).response?.data?.message
    toast.error(msg || t('pages.fateDual.toastAnalyzeRetry')); step.value = 'pick'
  }
}

async function onChoose(choice: 'stable' | 'adventure') {
  if (!analysis.value) return; step.value = 'submitting'; choiceMade.value = choice
  try {
    const res = await api.post('/fate/choose', { conflict_id: analysis.value.conflictId, choice: choice === 'stable' ? 'stable' : 'adventure' })
    if (!res.data.success) { toast.error(res.data.message || t('pages.fateDual.toastSubmitFail')); step.value = 'dual'; return }
    const data = res.data.data as { result: string; alreadyChosen?: boolean }
    finalResult.value = data.result; step.value = 'done'
    if (data.alreadyChosen) toast.success(t('pages.fateDual.toastHistoryShown'))
  } catch (e: unknown) {
    const msg = (e as { response?: { data?: { message?: string } } }).response?.data?.message
    toast.error(msg || t('pages.fateDual.toastSubmitFail')); step.value = 'dual'
  }
}

const finalResultParagraphs = computed(() => {
  const raw = finalResult.value.trim(); if (!raw) return []
  const byBlank = raw.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean)
  if (byBlank.length > 1) return byBlank
  return raw.split('\n').map((s) => s.trim()).filter(Boolean)
})

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

/** ── 五行条形分布 ── */
const ELEMENT_ORDER = ['木', '火', '土', '金', '水'] as const
const elementBarColor: Record<string, string> = {
  木: '#34D399', 火: '#FB7185', 土: '#D6B36A', 金: '#FBBF24', 水: '#60A5FA',
}
const fiveElementBars = computed(() => {
  const scores = analysis.value?.bazi.fiveElementScores
  if (!scores) return []
  const vals = ELEMENT_ORDER.map((k) => Number(scores[k] ?? 0))
  const max = Math.max(1, ...vals)
  return ELEMENT_ORDER.map((k, i) => ({
    key: k,
    value: Math.round(vals[i]),
    pct: Math.round((vals[i] / max) * 100),
    color: elementBarColor[k],
  }))
})

/** ── 两条路径数值对比 ── */
const SCORE_AXES = ['稳健', '成长', '风险', '回报', '心力'] as const
/** 风险维度越低越好，对比时单独标注 */
const pathComparison = computed(() => {
  const a = analysis.value?.branches
  if (!a?.stableScores || !a?.adventureScores) return []
  return SCORE_AXES.map((axis) => {
    const s = Math.min(100, Math.max(0, Math.round(Number(a.stableScores?.[axis] ?? 0))))
    const v = Math.min(100, Math.max(0, Math.round(Number(a.adventureScores?.[axis] ?? 0))))
    return { axis, stable: s, adventure: v, lowerIsBetter: axis === '风险' }
  })
})
const hasPathScores = computed(() => pathComparison.value.length > 0)

function splitDisplayParagraphs(text: string): string[] {
  const raw = text.trim(); if (!raw) return []
  const byBlank = raw.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean)
  if (byBlank.length > 1) return byBlank; return [raw]
}

</script>

<template>
  <div class="fate-page" :class="step === 'form' ? 'fate-page--form' : 'fate-page--inner'">
    <!-- 深空背景 -->
    <div class="fate-bg-deep" aria-hidden="true" />
    <div class="fate-bg-stars" aria-hidden="true" />

    <!-- ═══════ FORM 步骤：全屏三栏仪表盘 ═══════ -->
    <div v-if="step === 'form'" class="fate-dashboard" :class="{ 'fate-dashboard--entered': altarPanelMounted }">
      <!-- 顶部标题 -->
      <header class="fate-hero-header">
        <h1 class="fate-hero-title">命 运 轨 迹</h1>
        <p class="fate-hero-sub">东方命理 · 西方星象 · AI 洞察</p>
        <!-- 流程引导 -->
        <ol class="fate-steps" aria-label="流程步骤">
          <li
            v-for="(label, i) in flowSteps"
            :key="label"
            class="fate-step"
            :class="{ 'fate-step--active': i === currentStepIndex, 'fate-step--done': i < currentStepIndex }"
          >
            <span class="fate-step-dot">{{ i + 1 }}</span>
            <span class="fate-step-label">{{ label }}</span>
          </li>
        </ol>
      </header>

      <!-- 三栏主体 -->
      <div class="fate-main-grid" :class="ctaInvoking ? 'opacity-30 pointer-events-none' : ''">
        <!-- ─── 左栏：出生信息 ─── -->
        <section class="fate-panel fate-panel-left" aria-labelledby="fate-birth-h">
          <div class="fate-panel-header">
            <h2 id="fate-birth-h" class="fate-panel-title">出生信息</h2>
            <p class="fate-panel-sub">开启你的命运轨迹</p>
          </div>

          <!-- 公历生日 -->
          <div class="fate-field">
            <label class="fate-label">公历生日</label>
            <div class="fate-input-row">
              <input v-model.number="birthYear" type="number" min="1900" max="2100" placeholder="1999" class="fate-input fate-input--year" aria-label="年" @change="commitBirthDate">
              <span class="fate-unit">年</span>
              <input v-model.number="birthMonth" type="number" min="1" max="12" placeholder="04" class="fate-input fate-input--md" aria-label="月" @change="commitBirthDate">
              <span class="fate-unit">月</span>
              <input v-model.number="birthDay" type="number" min="1" max="31" placeholder="21" class="fate-input fate-input--md" aria-label="日" @change="commitBirthDate">
              <span class="fate-unit">日</span>
              <svg class="fate-row-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18" stroke-linecap="round"/></svg>
            </div>
          </div>

          <!-- 出生时间 -->
          <div class="fate-field">
            <label class="fate-label">出生时间</label>
            <div class="fate-input-row">
              <input :value="birthHour ?? ''" type="number" min="0" max="23" placeholder="12" class="fate-input fate-input--md" aria-label="时" @input="birthHour = Number(($event.target as HTMLInputElement).value)" @change="commitBirthTime">
              <span class="fate-colon">:</span>
              <input :value="birthMinute != null ? pad2(birthMinute) : ''" type="text" inputmode="numeric" maxlength="2" placeholder="00" class="fate-input fate-input--md" aria-label="分" @input="birthMinute = Number(($event.target as HTMLInputElement).value)" @change="commitBirthTime">
              <svg class="fate-row-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </div>
          </div>

          <!-- 出生地 -->
          <div class="fate-field">
            <label class="fate-label">出生地</label>
            <div class="fate-input-row">
              <input v-model="birthPlace" type="text" placeholder="中国·北京市" class="fate-input fate-input--text" aria-label="出生地">
              <svg class="fate-row-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 21s7-6.3 7-11a7 7 0 10-14 0c0 4.7 7 11 7 11z" stroke-linejoin="round"/><circle cx="12" cy="10" r="2.5"/></svg>
            </div>
          </div>

          <!-- 性别 -->
          <div class="fate-field">
            <label class="fate-label">性别</label>
            <div class="fate-gender-row">
              <button type="button" class="fate-gender cursor-pointer" :class="gender === 'male' ? 'fate-gender--on' : ''" @click="gender = 'male'">
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="10" cy="14" r="5"/><path d="M15 9l5-5M15 4h5v5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                男
              </button>
              <button type="button" class="fate-gender cursor-pointer" :class="gender === 'female' ? 'fate-gender--on' : ''" @click="gender = 'female'">
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="8" r="5"/><path d="M12 13v8M9 18h6" stroke-linecap="round"/></svg>
                女
              </button>
            </div>
          </div>

          <!-- 真太阳时校正 -->
          <div class="fate-field fate-toggle-field">
            <span class="fate-label mb-0">真太阳时校正</span>
            <button type="button" role="switch" :aria-checked="solarCorrection" class="fate-switch cursor-pointer" :class="solarCorrection ? 'fate-switch--on' : ''" @click="solarCorrection = !solarCorrection">
              <span class="fate-switch-knob" />
            </button>
          </div>

          <!-- CTA -->
          <button type="button" class="fate-cta cursor-pointer" :class="{ 'fate-cta--ready': canSubmit }" :disabled="ctaInvoking" @click="invokeCtaRitual">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 3l2.09 5.26L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.91-.74L12 3z" stroke-linejoin="round"/></svg>
            {{ ctaBusyLabel ? '正在生成…' : '生成命盘' }}
          </button>
          <p class="fate-cta-hint">{{ canSubmit ? '解读你的命运轨迹' : '填写生辰并在右侧写下你的提问' }}</p>
        </section>

        <!-- ─── 中栏：星盘 ─── -->
        <section class="fate-center" aria-label="命运星盘">
          <div v-if="chartType === 'bazi'" class="fate-orrery-container">
            <!-- 四柱徽章 -->
            <div class="fate-pillar fate-pillar--tl">
              <span class="fate-pillar-label">年柱</span>
              <span class="fate-pillar-gz">{{ baziPillars ? baziPillars.year : '—' }}</span>
            </div>
            <div class="fate-pillar fate-pillar--tr">
              <span class="fate-pillar-label">月柱</span>
              <span class="fate-pillar-gz">{{ baziPillars ? baziPillars.month : '—' }}</span>
            </div>
            <div class="fate-pillar fate-pillar--bl">
              <span class="fate-pillar-label">日柱</span>
              <span class="fate-pillar-gz">{{ baziPillars ? baziPillars.day : '—' }}</span>
            </div>
            <div class="fate-pillar fate-pillar--br">
              <span class="fate-pillar-label">时柱</span>
              <span class="fate-pillar-gz">{{ baziPillars ? baziPillars.time : '—' }}</span>
            </div>

            <!-- 星盘本体 -->
            <div class="fate-orrery" aria-hidden="true">
              <!-- 静态星点 -->
              <svg class="fate-stars-svg" viewBox="0 0 400 400" fill="none">
                <g fill="#F5E9FF">
                  <circle cx="24" cy="40" r="1.1" opacity="0.55"/><circle cx="62" cy="18" r="0.8" opacity="0.35"/>
                  <circle cx="96" cy="54" r="1.3" opacity="0.6"/><circle cx="182" cy="44" r="1" opacity="0.5"/>
                  <circle cx="228" cy="22" r="0.9" opacity="0.42"/><circle cx="274" cy="48" r="1.2" opacity="0.58"/>
                  <circle cx="356" cy="58" r="1.1" opacity="0.5"/><circle cx="380" cy="96" r="0.8" opacity="0.36"/>
                  <circle cx="18" cy="148" r="1.2" opacity="0.55"/><circle cx="30" cy="244" r="1" opacity="0.46"/>
                  <circle cx="42" cy="346" r="1.2" opacity="0.54"/><circle cx="150" cy="384" r="1" opacity="0.48"/>
                  <circle cx="262" cy="386" r="1.1" opacity="0.52"/><circle cx="362" cy="338" r="1.2" opacity="0.56"/>
                  <circle cx="388" cy="180" r="1" opacity="0.48"/><circle cx="110" cy="282" r="1" opacity="0.46"/>
                </g>
              </svg>
              <!-- 轨道网格 -->
              <svg class="fate-grid-svg" viewBox="0 0 400 400" fill="none">
                <g stroke="#C4A8FF" stroke-opacity="0.06" stroke-width="0.5">
                  <g v-for="k in 12" :key="'s'+k" :transform="'rotate('+(k-1)*30+' 200 200)'"><line x1="200" y1="22" x2="200" y2="196"/></g>
                </g>
                <ellipse cx="200" cy="200" rx="48" ry="47" stroke="#A78BFA" stroke-opacity="0.18" stroke-width="0.8"/>
                <ellipse cx="200" cy="200" rx="84" ry="81" stroke="#D4AF37" stroke-opacity="0.12" stroke-width="0.7"/>
                <ellipse cx="200" cy="200" rx="120" ry="114" stroke="#A78BFA" stroke-opacity="0.14" stroke-width="0.6"/>
                <ellipse cx="200" cy="200" rx="156" ry="146" stroke="#8A2BE2" stroke-opacity="0.1" stroke-width="0.6"/>
                <ellipse cx="200" cy="200" rx="184" ry="170" stroke="#D4AF37" stroke-opacity="0.1" stroke-width="0.55"/>
                <ellipse cx="200" cy="200" rx="198" ry="186" stroke="#A78BFA" stroke-opacity="0.08" stroke-width="0.5"/>
                <g stroke="#D4AF37" stroke-opacity="0.08" stroke-width="0.5" fill="none">
                  <polyline points="96,54 182,44 274,48 318,28"/><polyline points="30,244 74,300 150,300 206,372"/>
                </g>
              </svg>
              <!-- 中心星球 + 环 -->
              <div class="fate-core"/><div class="fate-ring"/>
              <!-- 公转轨道 -->
              <div class="fate-orb fate-orb--1"><span class="fate-dot fate-dot--gold"/></div>
              <div class="fate-orb fate-orb--2"><span class="fate-dot fate-dot--violet"/><span class="fate-dot fate-dot--mini-gold"/></div>
              <div class="fate-orb fate-orb--3"><span class="fate-dot fate-dot--blue"/></div>
              <div class="fate-orb fate-orb--4"><span class="fate-dot fate-dot--pale"/><span class="fate-dot fate-dot--mini-blue"/></div>
              <div class="fate-orb fate-orb--5"><span class="fate-dot fate-dot--amber"/></div>
              <div class="fate-orb fate-orb--6"><span class="fate-dot fate-dot--violet-sm"/></div>
            </div>
          </div>

          <!-- 紫微斗数命盘 -->
          <div v-else class="fate-ziwei">
            <div v-if="ziweiChart" class="fate-ziwei-board">
              <div
                v-for="p in ziweiBoard"
                :key="p.index"
                class="fate-zw-cell"
                :class="{ 'fate-zw-cell--soul': p.isSoulPalace, 'fate-zw-cell--body': p.isBodyPalace }"
                :style="{ gridRow: p.pos.row, gridColumn: p.pos.col }"
              >
                <div class="fate-zw-stars">
                  <span
                    v-for="(s, si) in p.majorStars"
                    :key="'mj'+si"
                    class="fate-zw-star fate-zw-star--major"
                    :class="s.mutagen ? 'fate-zw-star--hua' : ''"
                  >{{ s.name }}<i v-if="s.brightness" class="fate-zw-bright">{{ s.brightness }}</i><i v-if="s.mutagen" class="fate-zw-hua">化{{ s.mutagen }}</i></span>
                  <span
                    v-for="(s, si) in p.minorStars"
                    :key="'mn'+si"
                    class="fate-zw-star fate-zw-star--minor"
                    :class="s.mutagen ? 'fate-zw-star--hua' : ''"
                  >{{ s.name }}<i v-if="s.mutagen" class="fate-zw-hua">化{{ s.mutagen }}</i></span>
                </div>
                <div class="fate-zw-foot">
                  <span class="fate-zw-name">{{ p.name }}</span>
                  <span class="fate-zw-gz">{{ p.heavenlyStem }}{{ p.earthlyBranch }}</span>
                </div>
              </div>

              <!-- 中宫：命主信息 -->
              <div class="fate-zw-center">
                <p class="fate-zw-center-title">紫微斗数</p>
                <div class="fate-zw-center-grid">
                  <div><span class="fate-zw-c-key">五行局</span>{{ ziweiChart.fiveElementsClass }}</div>
                  <div><span class="fate-zw-c-key">命主</span>{{ ziweiChart.soul }}</div>
                  <div><span class="fate-zw-c-key">身主</span>{{ ziweiChart.body }}</div>
                  <div><span class="fate-zw-c-key">生肖</span>{{ ziweiChart.zodiac }}</div>
                </div>
                <p class="fate-zw-center-lunar">{{ ziweiChart.lunarDate }}</p>
              </div>
            </div>
            <div v-else class="fate-zw-empty">
              <p>填写完整出生信息后，自动为你排出紫微命盘</p>
            </div>
          </div>

          <!-- 命盘类型切换 -->
          <div class="fate-chart-tabs">
            <button type="button" class="fate-tab cursor-pointer" :class="chartType === 'bazi' ? 'fate-tab--on' : ''" @click="chartType = 'bazi'">八字命盘</button>
            <button type="button" class="fate-tab cursor-pointer" :class="chartType === 'ziwei' ? 'fate-tab--on' : ''" @click="chartType = 'ziwei'">紫微斗数</button>
          </div>
        </section>

        <!-- ─── 右栏：AI 命理助手 ─── -->
        <aside class="fate-panel fate-panel-right" aria-labelledby="fate-ai-h">
          <div class="fate-panel-header">
            <h2 id="fate-ai-h" class="fate-panel-title">AI 命理助手</h2>
            <p class="fate-panel-sub">此刻，你最想了解什么？</p>
          </div>

          <!-- 领域 2×3 -->
          <div class="fate-domains">
            <button v-for="opt in domainOptions" :key="opt.key" type="button" class="fate-domain cursor-pointer" :class="selectedDomain === opt.key ? 'fate-domain--on' : ''" @click="selectDomain(opt)">
              <svg v-if="opt.key === 'love'" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 20s-7-4.6-7-9.5A3.5 3.5 0 0112 7a3.5 3.5 0 017 3.5C19 15.4 12 20 12 20z" stroke-linejoin="round"/></svg>
              <svg v-else-if="opt.key === 'career'" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2" stroke-linecap="round"/></svg>
              <svg v-else-if="opt.key === 'wealth'" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="8"/><path d="M12 8v8M9.5 10.5h3.2a1.5 1.5 0 010 3H10m0 0h3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
              <svg v-else-if="opt.key === 'health'" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 12h4l2-5 3 10 2-5h4" stroke-linecap="round" stroke-linejoin="round"/></svg>
              <svg v-else-if="opt.key === 'relationship'" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0112 0M16 7a3 3 0 010 6M18 20a6 6 0 00-3-5.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
              <svg v-else class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 4v6m0 0l-5 10M12 10l5 10" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="4" r="1.6"/></svg>
              <span class="fate-domain-name">{{ opt.label }}</span>
              <span class="fate-domain-desc">{{ opt.sub }}</span>
            </button>
          </div>

          <!-- 向宇宙提问 -->
          <div ref="askRef" class="fate-ask">
            <p class="fate-ask-title">向宇宙提问</p>
            <p class="fate-ask-hint">写下你想了解的问题，或点选下方示例快速开始</p>
            <!-- 问题示例 -->
            <div class="fate-suggestions">
              <button v-for="s in questionSuggestions" :key="s" type="button" class="fate-suggestion cursor-pointer" @click="applySuggestion(s)">{{ s }}</button>
            </div>
            <div class="fate-ask-box" :class="{ 'fate-ask-box--focus': questionFieldFocused }">
              <textarea v-model="question" rows="3" maxlength="200" placeholder="例如：我的正缘什么时候出现？&#10;我的事业适合往哪个方向发展？" class="fate-ask-input" @focus="questionFieldFocused = true" @blur="questionFieldFocused = false"/>
              <div class="fate-ask-bar">
                <span class="fate-ask-count" :class="{ 'fate-ask-count--ok': question.trim().length >= 5 }">{{ question.length }}/200</span>
                <button type="button" class="fate-ask-send cursor-pointer" :class="{ 'fate-ask-send--ready': canSubmit }" :disabled="ctaInvoking" aria-label="生成命盘" @click="invokeCtaRitual">
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </button>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>

    <!-- ═══════ PICK 步骤 ═══════ -->
    <div v-else-if="step === 'pick'" class="fate-inner-wrap">
      <header class="text-center mb-8">
        <p class="text-xs tracking-[0.28em] text-[#D4AF37]/55">FATE DUAL</p>
        <h1 class="font-serif text-3xl font-semibold tracking-[0.12em] text-[#E2D9F3] mt-2">{{ t('pages.fateDual.heroTitle') }}</h1>
      </header>
      <div class="max-w-4xl mx-auto">
        <div class="text-center mb-8">
          <h2 class="text-lg font-serif text-gold-200 mb-2">{{ t('pages.fateDual.pickTitle') }}</h2>
          <p class="text-gray-500 text-sm">{{ t('pages.fateDual.pickHint', { n: 3, spread: t('pages.fateDual.pickSpread') }) }}</p>
          <!-- 选牌进度 -->
          <div class="flex items-center justify-center gap-2 mt-4">
            <span
              v-for="i in 3"
              :key="i"
              class="fate-pick-progress"
              :class="{ 'fate-pick-progress--on': selectedIndices.length >= i }"
            />
            <span class="ml-2 text-xs text-gray-500">{{ selectedIndices.length }} / 3</span>
          </div>
        </div>
        <div v-if="TOTAL_CARDS < 3" class="text-center text-amber-400/90 text-sm py-12">{{ t('pages.fateDual.deckLoading') }}</div>
        <template v-else>
          <div class="relative mb-10">
            <button type="button" class="strip-nav-btn left-0" @click="scrollStrip('left')"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 18l-6-6 6-6"/></svg></button>
            <button type="button" class="strip-nav-btn right-0" @click="scrollStrip('right')"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 18l6-6-6-6"/></svg></button>
            <div ref="stripRef" class="strip-scroll overflow-x-auto py-6 px-8 sm:py-8 sm:px-14">
              <div class="flex items-end">
                <div v-for="cardIndex in TOTAL_CARDS" :key="cardIndex" class="card-slot flex-shrink-0" :style="{ marginLeft: cardIndex > 1 ? '-16px' : '0', zIndex: cardIndex }" @click="selectPickCard(cardIndex - 1)">
                  <div class="card-back" :class="[selectedIndices.includes(cardIndex-1)?'card-selected':allThreePicked?'card-disabled':'card-idle']">
                    <img :src="cardBackUrl" alt="" class="w-full h-full object-cover rounded-[8px]">
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="mb-10">
            <p class="text-center text-gray-600 text-sm mb-5">{{ t('pages.fateDual.positionsCaption') }}</p>
            <div class="flex flex-wrap justify-center gap-5">
              <div v-for="(position, posIndex) in spreadPositions" :key="posIndex" class="flex flex-col items-center">
                <div class="position-slot" :class="selectedIndices.length > posIndex ? 'position-filled' : 'position-empty'">
                  <template v-if="selectedIndices.length > posIndex && selectedCards[posIndex]">
                    <div class="w-full h-full rounded-lg overflow-hidden">
                      <img :src="getCardImageUrl(selectedCards[posIndex].card.nameEn, selectedCards[posIndex].card)" :alt="selectedCards[posIndex].card.name" class="w-full h-full object-cover" :class="selectedCards[posIndex].isReversed ? 'rotate-180' : ''">
                    </div>
                  </template>
                  <template v-else><span class="text-gray-600 text-2xl font-light font-serif">{{ posIndex + 1 }}</span></template>
                </div>
                <p class="text-gray-500 text-xs mt-2.5 text-center max-w-[100px]">{{ position }}</p>
              </div>
            </div>
          </div>
          <div class="flex flex-col sm:flex-row gap-3 justify-center items-center pb-4">
            <button type="button" class="cursor-pointer px-6 py-2.5 rounded-full bg-white/4 border border-gold-500/15 text-gray-400 text-sm hover:bg-gold-500/5 transition-colors" @click="step = 'form'">{{ t('pages.fateDual.backEditBirth') }}</button>
            <button v-if="selectedIndices.length > 0 && !allThreePicked" type="button" class="cursor-pointer px-6 py-2.5 rounded-full bg-white/4 border border-gold-500/15 text-gray-400 text-sm hover:bg-gold-500/5 transition-colors" @click="undoLastCard">撤销上一张</button>
            <button v-if="!allThreePicked" type="button" class="cursor-pointer px-6 py-2.5 rounded-full bg-white/4 border border-gold-500/15 text-gray-400 text-sm hover:bg-gold-500/5 transition-colors" @click="reshuffleDeck">重新洗牌</button>
            <button v-if="allThreePicked" type="button" class="cursor-pointer px-6 py-2.5 rounded-full bg-white/4 border border-gold-500/15 text-gray-400 text-sm hover:bg-gold-500/5 transition-colors" @click="resetPickSelection">{{ t('pages.fateDual.resetPickOrder') }}</button>
            <button v-if="allThreePicked" type="button" class="cursor-pointer px-10 py-4 rounded-2xl cta-button text-white font-medium text-lg" @click="runAnalyzeWithPickedCards">{{ t('pages.fateDual.runAnalyze') }}</button>
          </div>
        </template>
      </div>
    </div>

    <!-- Analyzing -->
    <FateDualAnalyzingRitual v-else-if="step === 'analyzing'" />

    <!-- Dual result -->
    <div v-else-if="step === 'dual' && analysis" class="fate-inner-wrap space-y-10">
      <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section class="relative overflow-hidden rounded-2xl border border-amber-600/25 bg-gradient-to-br from-amber-950/45 to-black/45 p-6">
          <h3 class="font-serif text-lg text-amber-200/90 mb-1">{{ t('pages.fateDual.eastTitle') }}</h3>
          <p class="text-[11px] text-amber-200/40 mb-4">{{ t('pages.fateDual.eastDisclaimer') }}</p>

          <!-- 命格徽章：日主 / 旺衰 / 格局 -->
          <div v-if="analysis.bazi.dayMaster || analysis.bazi.dayMasterStrength || analysis.bazi.pattern" class="flex flex-wrap gap-2 mb-4">
            <span v-if="analysis.bazi.dayMaster" class="fate-bazi-chip fate-bazi-chip--master">
              <span class="fate-bazi-chip-key">{{ t('pages.fateDual.dayMaster') }}</span>{{ analysis.bazi.dayMaster }}
            </span>
            <span v-if="analysis.bazi.dayMasterStrength" class="fate-bazi-chip fate-bazi-chip--strength">
              <span class="fate-bazi-chip-key">{{ t('pages.fateDual.dayMasterStrength') }}</span>{{ analysis.bazi.dayMasterStrength }}
            </span>
            <span v-if="analysis.bazi.pattern" class="fate-bazi-chip fate-bazi-chip--pattern">
              <span class="fate-bazi-chip-key">{{ t('pages.fateDual.pattern') }}</span>{{ analysis.bazi.pattern }}
            </span>
          </div>

          <!-- 喜忌 -->
          <div v-if="analysis.bazi.favorable.length || analysis.bazi.unfavorable.length" class="flex flex-wrap items-center gap-x-5 gap-y-2 mb-4 text-xs">
            <div v-if="analysis.bazi.favorable.length" class="flex items-center gap-1.5">
              <span class="text-emerald-300/70">{{ t('pages.fateDual.favorable') }}</span>
              <span v-for="el in analysis.bazi.favorable" :key="'f'+el" class="fate-elem-tag fate-elem-tag--fav">{{ el }}</span>
            </div>
            <div v-if="analysis.bazi.unfavorable.length" class="flex items-center gap-1.5">
              <span class="text-rose-300/70">{{ t('pages.fateDual.unfavorable') }}</span>
              <span v-for="el in analysis.bazi.unfavorable" :key="'u'+el" class="fate-elem-tag fate-elem-tag--unfav">{{ el }}</span>
            </div>
          </div>

          <!-- 五行强弱条形图 -->
          <div v-if="fiveElementBars.length" class="fate-five-bars mb-5">
            <p class="text-[11px] tracking-widest text-amber-200/50 mb-2.5">{{ t('pages.fateDual.fiveDistribution') }}</p>
            <div v-for="bar in fiveElementBars" :key="bar.key" class="fate-five-row">
              <span class="fate-five-name" :style="{ color: bar.color }">{{ bar.key }}</span>
              <div class="fate-five-track">
                <div class="fate-five-fill" :style="{ width: bar.pct + '%', background: bar.color, boxShadow: `0 0 10px ${bar.color}66` }" />
              </div>
              <span class="fate-five-val" :style="{ color: bar.color }">{{ bar.value }}</span>
            </div>
          </div>

          <!-- 五行意象（无评分时回退到原意象卡） -->
          <div v-else-if="analysis.bazi.fiveElements" class="mb-4 grid grid-cols-5 gap-2">
            <div v-for="(v, k) in analysis.bazi.fiveElements" :key="k" :class="elementBlockClass(String(k))">
              <p class="text-xs font-medium text-amber-100/90">{{ k }}</p><p class="mt-1 text-[11px] text-gray-400">{{ v }}</p>
            </div>
          </div>

          <p v-for="(para, pi) in splitDisplayParagraphs(analysis.bazi.analysis)" :key="pi" class="text-sm leading-[1.75] text-gray-300 mb-2">{{ para }}</p>

          <!-- 一句话建议 -->
          <div v-if="analysis.bazi.advice" class="mt-4 flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-3.5 py-2.5">
            <svg class="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-300/80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 3l2.09 5.26L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.91-.74L12 3z" stroke-linejoin="round"/></svg>
            <p class="text-xs leading-relaxed text-amber-100/85">{{ analysis.bazi.advice }}</p>
          </div>
        </section>
        <section class="relative overflow-hidden rounded-2xl border border-violet-500/25 bg-gradient-to-br from-violet-950/40 to-black/45 p-6">
          <h3 class="font-serif text-lg text-violet-200/90 mb-4">{{ t('pages.fateDual.westTitle') }}</h3>
          <div class="flex justify-center gap-4 mb-5">
            <div v-for="(c, idx) in analysis.tarot.cards" :key="idx" class="flex flex-col items-center w-[28%] max-w-[118px]">
              <span class="mb-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-2 py-0.5 text-[10px] text-violet-300/80">{{ c.position }}</span>
              <div class="aspect-[2/3] w-full overflow-hidden rounded-lg border border-violet-500/25"><img :src="getCardImageUrl(c.nameEn)" :alt="c.name" class="h-full w-full object-cover" :class="c.reversed ? 'rotate-180' : ''"></div>
              <p class="mt-2 text-xs text-violet-200/90">{{ c.name }}</p>
            </div>
          </div>
          <p v-for="(para, pi) in splitDisplayParagraphs(analysis.tarot.analysis)" :key="pi" class="text-sm leading-[1.75] text-gray-300 mb-2">{{ para }}</p>
        </section>
      </div>
      <section class="rounded-2xl border border-gold-500/25 bg-gradient-to-b from-gold-500/[0.07] to-transparent p-8 text-center">
        <p class="font-serif text-xl text-gold-200">{{ analysis.conflict.type }}</p>
        <p class="mt-4 text-base text-gray-200">{{ analysis.conflict.summary }}</p>
      </section>
      <div class="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div class="rounded-2xl border border-slate-500/30 bg-slate-900/50 p-6">
          <div class="flex items-center justify-between gap-2 mb-3">
            <p class="font-medium text-slate-200">{{ t('pages.fateDual.branchATitle') }}</p>
            <span v-if="analysis.branches.stableTag" class="fate-path-tag fate-path-tag--stable">{{ analysis.branches.stableTag }}</span>
          </div>
          <p v-for="(para, pi) in splitDisplayParagraphs(analysis.branches.stable)" :key="pi" class="text-sm text-gray-400 mb-2">{{ para }}</p>
          <p v-if="analysis.branches.stableHorizon" class="mt-3 flex items-center gap-1.5 text-[11px] text-slate-400/70">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            {{ t('pages.fateDual.horizonLabel') }} · {{ analysis.branches.stableHorizon }}
          </p>
        </div>
        <div class="rounded-2xl border border-fuchsia-500/30 bg-fuchsia-950/35 p-6">
          <div class="flex items-center justify-between gap-2 mb-3">
            <p class="font-medium text-fuchsia-100/95">{{ t('pages.fateDual.branchBTitle') }}</p>
            <span v-if="analysis.branches.adventureTag" class="fate-path-tag fate-path-tag--adventure">{{ analysis.branches.adventureTag }}</span>
          </div>
          <p v-for="(para, pi) in splitDisplayParagraphs(analysis.branches.adventure)" :key="pi" class="text-sm text-gray-400 mb-2">{{ para }}</p>
          <p v-if="analysis.branches.adventureHorizon" class="mt-3 flex items-center gap-1.5 text-[11px] text-fuchsia-300/70">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            {{ t('pages.fateDual.horizonLabel') }} · {{ analysis.branches.adventureHorizon }}
          </p>
        </div>
      </div>

      <!-- 两条路径数值对比 -->
      <section v-if="hasPathScores" class="fate-compare rounded-2xl border border-white/10 bg-white/[0.02] p-6 sm:p-7">
        <div class="flex items-center justify-between flex-wrap gap-2 mb-5">
          <h3 class="font-serif text-base text-gold-100/90">{{ t('pages.fateDual.compareTitle') }}</h3>
          <div class="flex items-center gap-4 text-[11px]">
            <span class="flex items-center gap-1.5 text-slate-300/85"><span class="fate-legend-dot fate-legend-dot--stable" />{{ t('pages.fateDual.legendStable') }}</span>
            <span class="flex items-center gap-1.5 text-fuchsia-200/85"><span class="fate-legend-dot fate-legend-dot--adventure" />{{ t('pages.fateDual.legendAdventure') }}</span>
          </div>
        </div>
        <div class="space-y-4">
          <div v-for="row in pathComparison" :key="row.axis" class="fate-cmp-row">
            <div class="fate-cmp-axis">
              {{ row.axis }}
              <span v-if="row.lowerIsBetter" class="fate-cmp-hint">{{ t('pages.fateDual.lowerBetter') }}</span>
            </div>
            <!-- 稳健条（向左） -->
            <div class="fate-cmp-bars">
              <div class="fate-cmp-side fate-cmp-side--left">
                <span class="fate-cmp-num">{{ row.stable }}</span>
                <div class="fate-cmp-track">
                  <div class="fate-cmp-fill fate-cmp-fill--stable" :style="{ width: row.stable + '%' }" />
                </div>
              </div>
              <div class="fate-cmp-side fate-cmp-side--right">
                <div class="fate-cmp-track">
                  <div class="fate-cmp-fill fate-cmp-fill--adventure" :style="{ width: row.adventure + '%' }" />
                </div>
                <span class="fate-cmp-num fate-cmp-num--adv">{{ row.adventure }}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <p class="text-center text-sm text-gold-200/80 font-serif">{{ t('pages.fateDual.choosePrompt') }}</p>
      <div class="flex flex-col sm:flex-row gap-4 justify-center pt-1">
        <button type="button" class="flex-1 max-w-xs cursor-pointer rounded-2xl border border-slate-400/35 bg-slate-800/55 py-4 font-medium text-slate-100 hover:bg-slate-700/55 transition-colors" @click="onChoose('stable')">{{ t('pages.fateDualHistory.choiceStable') }}</button>
        <button type="button" class="flex-1 max-w-xs cursor-pointer rounded-2xl border border-fuchsia-500/45 bg-fuchsia-900/35 py-4 font-medium text-fuchsia-100 hover:bg-fuchsia-800/45 transition-colors" @click="onChoose('adventure')">{{ t('pages.fateDualHistory.choiceAdventure') }}</button>
      </div>
    </div>

    <!-- Submitting -->
    <div v-else-if="step === 'submitting'" class="fate-inner-wrap text-center py-24">
      <div class="inline-block w-10 h-10 border-2 border-fuchsia-500/30 border-t-fuchsia-400 rounded-full animate-spin mb-4"/>
      <p class="text-gray-400 text-sm">{{ t('pages.fateDual.inscribing') }}</p>
    </div>

    <!-- Done -->
    <div v-else-if="step === 'done'" class="fate-inner-wrap max-w-3xl mx-auto space-y-8">
      <div class="text-center">
        <p class="text-[10px] uppercase tracking-[0.35em] text-gold-500/65 mb-3">{{ t('pages.fateDual.sealedChoice') }}</p>
        <h3 class="font-serif text-2xl text-gold-50">{{ t('pages.fateDual.finalTitle') }}</h3>
      </div>
      <div class="rounded-2xl border border-gold-500/20 bg-gradient-to-br from-[#141018]/95 to-violet-950/15 p-8">
        <p v-for="(para, pi) in finalResultParagraphs" :key="pi" class="text-base leading-[1.85] text-gray-200/95 mb-4">{{ para }}</p>
      </div>
      <div class="flex justify-center gap-4">
        <button type="button" class="cursor-pointer rounded-full border border-gold-500/30 px-8 py-3 text-sm text-gold-200 hover:bg-gold-500/10 transition-colors" @click="resetFlow">{{ t('pages.fateDual.again') }}</button>
        <RouterLink to="/fate-dual/history" class="rounded-full border border-white/10 px-8 py-3 text-sm text-gray-400 hover:border-gold-500/20 transition-colors">{{ t('pages.fateDual.historyLinkInner') }}</RouterLink>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ═══════════════════════════════════════════════
   命运双盘 · 全屏仪表盘布局
   ═══════════════════════════════════════════════ */
.fate-page {
  position: relative;
  min-height: 100dvh;
  min-height: 100vh;
  overflow-x: hidden;
  background: #060311;
  color: #E2D9F3;
}
.fate-page--form {
  padding-top: calc(4rem + env(safe-area-inset-top, 0px));
  padding-bottom: 2rem;
}
.fate-page--inner {
  padding-top: calc(5rem + env(safe-area-inset-top, 0px));
  padding-bottom: 3rem;
}

/* 背景层 */
.fate-bg-deep {
  position: fixed; inset: 0; z-index: -2;
  background: radial-gradient(ellipse 80% 60% at 50% 30%, #12082a 0%, #060311 55%, #030108 100%);
}
.fate-bg-stars {
  position: fixed; inset: 0; z-index: -1;
  opacity: 0.5;
  background-image:
    radial-gradient(1.5px 1.5px at 8% 18%, rgba(226,217,243,0.6), transparent),
    radial-gradient(1px 1px at 22% 72%, rgba(65,105,225,0.5), transparent),
    radial-gradient(1px 1px at 78% 28%, rgba(212,175,55,0.5), transparent),
    radial-gradient(1.5px 1.5px at 88% 80%, rgba(138,43,226,0.4), transparent),
    radial-gradient(1px 1px at 45% 8%, rgba(226,217,243,0.4), transparent),
    radial-gradient(1px 1px at 55% 92%, rgba(212,175,55,0.35), transparent),
    radial-gradient(0.8px 0.8px at 32% 55%, rgba(196,168,255,0.4), transparent),
    radial-gradient(0.8px 0.8px at 68% 15%, rgba(255,255,255,0.3), transparent);
}

/* 仪表盘容器 */
.fate-dashboard {
  position: relative;
  z-index: 1;
  max-width: 1560px;
  margin: 0 auto;
  padding: 0 2rem;
}
.fate-dashboard--entered {
  animation: fate-emerge 0.8s ease-out forwards;
  opacity: 0;
  transform: translateY(12px);
}
@keyframes fate-emerge {
  to { opacity: 1; transform: translateY(0); }
}

/* 顶部标题 */
.fate-hero-header {
  text-align: center;
  margin-bottom: 2rem;
}
.fate-hero-title {
  font-family: ui-serif, Georgia, 'Songti SC', 'Noto Serif SC', serif;
  font-size: clamp(2rem, 4vw, 3.2rem);
  font-weight: 600;
  letter-spacing: 0.35em;
  color: #F5F0FF;
  text-shadow: 0 0 32px rgba(196,168,255,0.4), 0 0 64px rgba(138,43,226,0.2);
}
.fate-hero-sub {
  margin-top: 0.75rem;
  font-size: 0.82rem;
  letter-spacing: 0.3em;
  color: rgba(138,126,159,0.85);
}

/* ─── 三栏网格 ─── */
.fate-main-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;
  align-items: start;
  transition: opacity 0.4s ease;
}
@media (min-width: 1024px) {
  .fate-main-grid {
    grid-template-columns: 300px 1fr 320px;
    gap: 1.5rem;
  }
}
@media (min-width: 1280px) {
  .fate-main-grid {
    grid-template-columns: 320px 1fr 340px;
    gap: 2rem;
  }
}

/* ─── 面板通用 ─── */
.fate-panel {
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(212,175,55,0.12);
  border-radius: 1.25rem;
  padding: 1.5rem;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  box-shadow: 0 0 40px rgba(138,43,226,0.08), 0 20px 60px -24px rgba(0,0,0,0.7);
}
.fate-panel-header { margin-bottom: 1.25rem; }
.fate-panel-title {
  font-family: ui-serif, Georgia, 'Songti SC', serif;
  font-size: 1.05rem;
  letter-spacing: 0.1em;
  color: #F5E9FF;
}
.fate-panel-sub {
  margin-top: 0.3rem;
  font-size: 0.68rem;
  letter-spacing: 0.06em;
  color: rgba(138,126,159,0.8);
}

/* ─── 左栏表单 ─── */
.fate-field { margin-bottom: 1rem; }
.fate-label {
  display: block;
  margin-bottom: 0.35rem;
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  color: rgba(212,175,55,0.78);
}
.fate-input-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 0.7rem;
  border-radius: 0.6rem;
  border: 1px solid rgba(167,139,250,0.14);
  background: rgba(8,5,18,0.6);
  transition: border-color 0.2s, box-shadow 0.2s;
}
.fate-input-row:focus-within {
  border-color: rgba(212,175,55,0.4);
  box-shadow: 0 0 0 1px rgba(212,175,55,0.1), 0 0 16px rgba(138,43,226,0.1);
}
.fate-input {
  background: transparent;
  border: none;
  color: #F5E9FF;
  font-size: 0.88rem;
  font-variant-numeric: tabular-nums;
  text-align: center;
  padding: 0.1rem;
  outline: none;
}
.fate-input--year { width: 3.8rem; }
.fate-input--md { width: 2.5rem; }
.fate-input--text { flex: 1; text-align: left; width: 100%; }
.fate-input::placeholder { color: rgba(138,126,159,0.5); }
.fate-input::-webkit-outer-spin-button,
.fate-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.fate-input { -moz-appearance: textfield; appearance: textfield; }
.fate-unit { font-size: 0.68rem; color: rgba(138,126,159,0.8); }
.fate-colon { color: rgba(212,175,55,0.5); font-weight: 600; margin: 0 0.1rem; }
.fate-row-icon { width: 1rem; height: 1rem; flex-shrink: 0; color: rgba(167,139,250,0.55); margin-left: auto; }

/* 性别 */
.fate-gender-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; }
.fate-gender {
  display: flex; align-items: center; justify-content: center; gap: 0.35rem;
  padding: 0.55rem 0; border-radius: 0.6rem; font-size: 0.82rem;
  border: 1px solid rgba(255,255,255,0.08); background: rgba(22,11,36,0.4); color: rgba(226,217,243,0.7);
  transition: all 0.18s;
}
.fate-gender:hover { border-color: rgba(167,139,250,0.3); color: #E2D9F3; }
.fate-gender--on {
  border-color: rgba(212,175,55,0.45);
  background: linear-gradient(135deg, rgba(138,43,226,0.3), rgba(99,102,241,0.22));
  color: #FFF7E2;
  box-shadow: 0 0 16px rgba(138,43,226,0.18);
}

/* Toggle */
.fate-toggle-field { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.25rem; }
.fate-switch {
  position: relative; width: 40px; height: 22px; border-radius: 999px; flex-shrink: 0;
  background: rgba(40,28,58,0.8); border: 1px solid rgba(255,255,255,0.08); transition: all 0.2s;
}
.fate-switch--on {
  background: linear-gradient(135deg, #8A2BE2, #6366F1);
  border-color: rgba(212,175,55,0.35);
  box-shadow: 0 0 12px rgba(138,43,226,0.35);
}
.fate-switch-knob {
  position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%;
  background: #F5E9FF; box-shadow: 0 1px 3px rgba(0,0,0,0.4); transition: transform 0.2s cubic-bezier(0.4,0,0.2,1);
}
.fate-switch--on .fate-switch-knob { transform: translateX(18px); }

/* CTA 按钮 */
.fate-cta {
  display: flex; align-items: center; justify-content: center; gap: 0.5rem;
  width: 100%; padding: 0.85rem 1rem; border-radius: 0.8rem;
  border: 1px solid rgba(212,175,55,0.3);
  background: linear-gradient(135deg, #8A2BE2 0%, #6D28D9 50%, #5B21B6 100%);
  color: #FFF7E2; font-size: 0.95rem; font-weight: 600; letter-spacing: 0.08em;
  box-shadow: 0 8px 24px -8px rgba(138,43,226,0.6), inset 0 1px 0 rgba(255,255,255,0.1);
  transition: filter 0.18s, box-shadow 0.18s;
}
.fate-cta:hover:not(:disabled) {
  filter: brightness(1.12);
  box-shadow: 0 10px 30px -6px rgba(138,43,226,0.75), 0 0 20px rgba(212,175,55,0.15);
}
.fate-cta:disabled { cursor: wait; opacity: 0.7; }
.fate-cta--ready { box-shadow: 0 8px 26px -6px rgba(138,43,226,0.7), 0 0 22px rgba(212,175,55,0.22); }
.fate-cta-hint { margin-top: 0.6rem; text-align: center; font-size: 0.66rem; color: rgba(138,126,159,0.7); }

/* ─── 流程引导步骤 ─── */
.fate-steps {
  display: flex; align-items: center; justify-content: center; flex-wrap: wrap;
  gap: 0.5rem 1.4rem; margin-top: 1.5rem;
}
.fate-step { display: inline-flex; align-items: center; gap: 0.5rem; position: relative; }
.fate-step:not(:last-child)::after {
  content: ''; width: 1.1rem; height: 1px; margin-left: 1rem;
  background: rgba(167,139,250,0.25);
}
.fate-step-dot {
  display: grid; place-items: center; width: 24px; height: 24px; border-radius: 50%;
  font-size: 0.74rem; font-variant-numeric: tabular-nums;
  color: rgba(138,126,159,0.85); border: 1px solid rgba(167,139,250,0.22);
  background: rgba(22,11,36,0.6); transition: all 0.25s;
}
.fate-step-label { font-size: 0.74rem; letter-spacing: 0.04em; color: rgba(138,126,159,0.75); transition: color 0.25s; }
.fate-step--active .fate-step-dot {
  color: #FFF7E2; border-color: rgba(212,175,55,0.55);
  background: linear-gradient(135deg, #8A2BE2, #6366F1);
  box-shadow: 0 0 16px rgba(138,43,226,0.4);
}
.fate-step--active .fate-step-label { color: #F5E9FF; }
.fate-step--done .fate-step-dot { color: #D4AF37; border-color: rgba(212,175,55,0.4); background: rgba(212,175,55,0.08); }
.fate-step--done .fate-step-label { color: rgba(212,175,55,0.85); }

/* ─── 选牌进度点 ─── */
.fate-pick-progress {
  width: 8px; height: 8px; border-radius: 50%;
  background: rgba(167,139,250,0.2); border: 1px solid rgba(167,139,250,0.3); transition: all 0.3s;
}
.fate-pick-progress--on {
  background: linear-gradient(135deg, #8A2BE2, #6366F1); border-color: rgba(212,175,55,0.4);
  box-shadow: 0 0 10px rgba(138,43,226,0.5);
}

/* ─── 中栏：星盘 ─── */
.fate-center {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  min-height: 480px; padding: 0.5rem;
}
@media (min-width: 1024px) {
  .fate-center { min-height: 580px; }
}
.fate-orrery-container {
  position: relative; width: 100%; max-width: 580px; aspect-ratio: 1/1;
}

/* 四柱徽章 */
.fate-pillar {
  position: absolute; z-index: 3;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  width: 82px; height: 82px; border-radius: 50%;
  border: 1px solid rgba(212,175,55,0.35);
  background: radial-gradient(circle at 50% 32%, rgba(40,24,66,0.92), rgba(10,6,22,0.96));
  box-shadow: 0 0 24px rgba(138,43,226,0.22), 0 0 44px rgba(212,175,55,0.1);
}
.fate-pillar--tl { top: 5%; left: 3%; border-color: rgba(212,175,55,0.5); box-shadow: 0 0 24px rgba(212,175,55,0.2), 0 0 48px rgba(212,175,55,0.1); }
.fate-pillar--tr { top: 5%; right: 3%; border-color: rgba(212,175,55,0.5); box-shadow: 0 0 24px rgba(212,175,55,0.2), 0 0 48px rgba(212,175,55,0.1); }
.fate-pillar--bl { bottom: 10%; left: 3%; border-color: rgba(167,139,250,0.5); box-shadow: 0 0 24px rgba(138,43,226,0.28), 0 0 48px rgba(138,43,226,0.12); }
.fate-pillar--br { bottom: 10%; right: 3%; border-color: rgba(167,139,250,0.5); box-shadow: 0 0 24px rgba(138,43,226,0.28), 0 0 48px rgba(138,43,226,0.12); }
.fate-pillar-label {
  font-size: 0.58rem; letter-spacing: 0.12em; color: rgba(212,175,55,0.78);
}
.fate-pillar-gz {
  font-family: ui-serif, Georgia, 'Songti SC', serif;
  font-size: 1.35rem; font-weight: 600; line-height: 1.1; letter-spacing: 0.06em;
  color: #FBF3DC; text-shadow: 0 0 14px rgba(212,175,55,0.4);
}
.fate-pillar--bl .fate-pillar-gz,
.fate-pillar--br .fate-pillar-gz {
  color: #EBE0FF; text-shadow: 0 0 14px rgba(167,139,250,0.5);
}

/* 星盘本体 */
.fate-orrery {
  position: absolute; inset: 5%;
  display: flex; align-items: center; justify-content: center;
  transform: perspective(1000px) rotateX(8deg);
  transform-style: preserve-3d;
}
.fate-stars-svg { position: absolute; inset: -5%; width: 110%; height: 110%; pointer-events: none; }
.fate-grid-svg { position: absolute; inset: 0; width: 100%; height: 100%; }
.fate-core {
  position: absolute; top: 50%; left: 50%; width: 18%; height: 18%;
  transform: translate(-50%, -50%); border-radius: 50%;
  background: radial-gradient(circle at 42% 38%, #E9DBFF 0%, #A78BFA 32%, #8A2BE2 62%, #4C1D95 100%);
  box-shadow: 0 0 40px rgba(138,43,226,0.6), 0 0 80px rgba(167,139,250,0.35);
  animation: core-pulse 5s ease-in-out infinite;
}
@keyframes core-pulse {
  0%, 100% { box-shadow: 0 0 40px rgba(138,43,226,0.6), 0 0 80px rgba(167,139,250,0.35); }
  50% { box-shadow: 0 0 52px rgba(138,43,226,0.8), 0 0 110px rgba(167,139,250,0.5); }
}
.fate-ring {
  position: absolute; top: 50%; left: 50%; width: 48%; height: 48%;
  transform: translate(-50%, -50%) rotateX(74deg) rotateZ(-12deg);
  border-radius: 50%; border: 2.5px solid rgba(196,168,255,0.6);
  box-shadow: 0 0 20px rgba(167,139,250,0.5), 0 0 40px rgba(138,43,226,0.3);
  pointer-events: none;
}
.fate-ring::after {
  content: ''; position: absolute; inset: -6px; border-radius: 50%;
  border: 1.2px solid rgba(212,175,55,0.3);
}

/* 公转轨道 */
.fate-orb {
  position: absolute; top: 50%; left: 50%; border-radius: 50%;
  transform: translate(-50%, -50%);
}
.fate-orb--1 { width: 24%; height: 24%; animation: orb-spin 14s linear infinite; }
.fate-orb--2 { width: 42%; height: 41%; animation: orb-spin 22s linear infinite reverse; }
.fate-orb--3 { width: 60%; height: 57%; animation: orb-spin 30s linear infinite; }
.fate-orb--4 { width: 78%; height: 73%; animation: orb-spin 40s linear infinite reverse; }
.fate-orb--5 { width: 92%; height: 85%; animation: orb-spin 50s linear infinite; }
.fate-orb--6 { width: 99%; height: 93%; animation: orb-spin 60s linear infinite reverse; }
@keyframes orb-spin { to { transform: translate(-50%, -50%) rotate(360deg); } }

.fate-dot {
  position: absolute; top: -4px; left: 50%; border-radius: 50%;
}
.fate-dot--gold { width: 8px; height: 8px; margin-left: -4px; background: #F2D98A; box-shadow: 0 0 12px rgba(242,217,138,0.85); }
.fate-dot--violet { width: 6px; height: 6px; margin-left: -3px; background: #C4A8FF; box-shadow: 0 0 12px rgba(196,168,255,0.85); }
.fate-dot--blue { width: 8px; height: 8px; margin-left: -4px; background: #8AB4FF; box-shadow: 0 0 12px rgba(138,180,255,0.8); }
.fate-dot--pale { width: 6px; height: 6px; margin-left: -3px; background: #F5E9FF; box-shadow: 0 0 10px rgba(245,233,255,0.7); }
.fate-dot--amber { width: 5px; height: 5px; margin-left: -2.5px; background: #FBBF24; box-shadow: 0 0 12px rgba(251,191,36,0.85); }
.fate-dot--violet-sm { width: 4px; height: 4px; margin-left: -2px; background: #A78BFA; box-shadow: 0 0 10px rgba(167,139,250,0.8); }
.fate-dot--mini-gold { width: 4px; height: 4px; margin-left: -2px; background: #F2D98A; box-shadow: 0 0 8px rgba(242,217,138,0.7); top: auto; bottom: -2px; }
.fate-dot--mini-blue { width: 4px; height: 4px; margin-left: -2px; background: #8AB4FF; box-shadow: 0 0 8px rgba(138,180,255,0.7); top: 50%; left: -2px; margin-top: -2px; }

/* 命盘类型切换 */
.fate-chart-tabs { display: flex; gap: 0.5rem; margin-top: 1rem; }
.fate-tab {
  padding: 0.4rem 1.1rem; border-radius: 999px; font-size: 0.78rem; letter-spacing: 0.04em;
  border: 1px solid rgba(255,255,255,0.1); background: rgba(22,11,36,0.5); color: rgba(226,217,243,0.72);
  transition: all 0.18s;
}
.fate-tab--on {
  border-color: rgba(212,175,55,0.45);
  background: linear-gradient(135deg, rgba(138,43,226,0.32), rgba(99,102,241,0.22));
  color: #FFF7E2; box-shadow: 0 0 14px rgba(138,43,226,0.2);
}

/* ─── 右栏：AI 助手 ─── */
.fate-domains {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; margin-bottom: 1.25rem;
}
.fate-domain {
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.2rem;
  padding: 0.75rem 0.3rem; min-height: 80px; border-radius: 0.75rem;
  border: 1px solid rgba(255,255,255,0.07); background: rgba(22,11,36,0.4); color: rgba(226,217,243,0.72);
  transition: all 0.18s;
}
.fate-domain:hover { border-color: rgba(167,139,250,0.3); background: rgba(36,20,60,0.55); color: #E2D9F3; }
.fate-domain--on {
  border-color: rgba(167,139,250,0.55);
  background: linear-gradient(150deg, rgba(138,43,226,0.32), rgba(76,29,149,0.25));
  color: #FFF7E2; box-shadow: 0 0 22px rgba(138,43,226,0.25);
}
.fate-domain-name { font-size: 0.78rem; font-weight: 500; letter-spacing: 0.04em; line-height: 1.2; }
.fate-domain-desc { font-size: 0.58rem; color: rgba(138,126,159,0.7); }
.fate-domain--on .fate-domain-desc { color: rgba(245,233,255,0.7); }

/* 向宇宙提问 */
.fate-ask { margin-top: auto; }
.fate-ask-title { font-size: 0.88rem; letter-spacing: 0.06em; color: #F5E9FF; margin-bottom: 0.3rem; }
.fate-ask-hint { font-size: 0.62rem; color: rgba(138,126,159,0.7); margin-bottom: 0.6rem; line-height: 1.5; }
.fate-ask-box {
  border-radius: 0.75rem; border: 1px solid rgba(167,139,250,0.14);
  background: rgba(8,5,18,0.55); overflow: hidden; transition: border-color 0.2s;
}
.fate-ask-box:focus-within { border-color: rgba(138,43,226,0.4); }
.fate-ask-input {
  width: 100%; resize: none; border: none; background: transparent;
  padding: 0.75rem 0.8rem 0.4rem; font-size: 0.82rem; line-height: 1.55; color: #F5E9FF; outline: none;
}
.fate-ask-input::placeholder { color: rgba(138,126,159,0.5); }
.fate-ask-bar {
  display: flex; align-items: center; justify-content: space-between; padding: 0.3rem 0.6rem 0.5rem;
}
.fate-ask-count { font-size: 0.62rem; color: rgba(138,126,159,0.6); transition: color 0.2s; }
.fate-ask-count--ok { color: rgba(167,139,250,0.95); }
.fate-ask-send {
  width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
  background: rgba(138,43,226,0.35); color: #FFF7E2;
  box-shadow: 0 4px 12px rgba(138,43,226,0.2); transition: filter 0.18s, background 0.25s, box-shadow 0.25s;
}
.fate-ask-send--ready {
  background: linear-gradient(135deg, #8A2BE2, #6366F1);
  box-shadow: 0 4px 14px rgba(138,43,226,0.5);
}
.fate-ask-send:hover:not(:disabled) { filter: brightness(1.15); }

/* 提问示例 chips */
.fate-suggestions { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 0.7rem; }
.fate-suggestion {
  font-size: 0.7rem; line-height: 1.2; padding: 0.32rem 0.7rem; border-radius: 999px;
  color: rgba(212,196,255,0.85); border: 1px solid rgba(167,139,250,0.22);
  background: rgba(138,43,226,0.08); transition: all 0.18s;
}
.fate-suggestion:hover {
  color: #F5E9FF; border-color: rgba(167,139,250,0.5); background: rgba(138,43,226,0.18);
}
.fate-ask-box--focus { border-color: rgba(167,139,250,0.5); box-shadow: 0 0 0 1px rgba(167,139,250,0.18), 0 0 22px rgba(138,43,226,0.12); }

/* ═══════ 紫微斗数命盘 ═══════ */
.fate-ziwei {
  width: 100%;
  max-width: 580px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.fate-ziwei-board {
  width: 100%;
  aspect-ratio: 1 / 1;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-template-rows: repeat(4, 1fr);
  gap: 4px;
  padding: 4px;
  border-radius: 1rem;
  background: rgba(8,5,18,0.5);
  border: 1px solid rgba(212,175,55,0.16);
  box-shadow: 0 0 40px rgba(138,43,226,0.1), inset 0 0 30px rgba(0,0,0,0.4);
}
.fate-zw-cell {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 0.4rem 0.4rem 0.3rem;
  border-radius: 0.5rem;
  border: 1px solid rgba(167,139,250,0.12);
  background: rgba(22,11,36,0.45);
  overflow: hidden;
  min-height: 0;
}
.fate-zw-cell--soul {
  border-color: rgba(212,175,55,0.55);
  background: linear-gradient(150deg, rgba(212,175,55,0.16), rgba(22,11,36,0.6));
  box-shadow: inset 0 0 16px rgba(212,175,55,0.12);
}
.fate-zw-cell--body { border-color: rgba(167,139,250,0.5); }
.fate-zw-stars {
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  gap: 0.15rem 0.3rem;
  line-height: 1.1;
  overflow: hidden;
}
.fate-zw-star {
  display: inline-flex;
  align-items: baseline;
  font-size: 0.66rem;
  letter-spacing: 0.02em;
  white-space: nowrap;
}
.fate-zw-star--major { color: #F5E3B0; font-weight: 600; }
.fate-zw-star--minor { color: rgba(196,168,255,0.78); font-size: 0.6rem; }
.fate-zw-star--hua { text-shadow: 0 0 8px rgba(251,191,36,0.5); }
.fate-zw-bright { font-style: normal; font-size: 0.5rem; color: rgba(212,175,55,0.6); margin-left: 1px; }
.fate-zw-hua {
  font-style: normal; font-size: 0.5rem; color: #0b0820; font-weight: 700;
  background: #FBBF24; border-radius: 3px; padding: 0 2px; margin-left: 2px; line-height: 1.3;
}
.fate-zw-foot {
  display: flex; align-items: baseline; justify-content: space-between; gap: 0.2rem;
  margin-top: 0.25rem; padding-top: 0.2rem; border-top: 1px solid rgba(255,255,255,0.06);
}
.fate-zw-name { font-size: 0.62rem; color: rgba(226,217,243,0.9); font-weight: 500; }
.fate-zw-cell--soul .fate-zw-name { color: #FBE7B0; }
.fate-zw-gz { font-size: 0.56rem; color: rgba(138,126,159,0.8); font-variant-numeric: tabular-nums; }
.fate-zw-center {
  grid-row: 2 / 4;
  grid-column: 2 / 4;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 0.5rem; padding: 0.75rem; text-align: center;
  border-radius: 0.6rem;
  border: 1px solid rgba(212,175,55,0.2);
  background: radial-gradient(circle at 50% 30%, rgba(40,24,66,0.7), rgba(8,5,18,0.55));
}
.fate-zw-center-title {
  font-family: ui-serif, Georgia, 'Songti SC', serif;
  font-size: 0.95rem; letter-spacing: 0.18em; color: #F5E9FF;
  text-shadow: 0 0 16px rgba(196,168,255,0.4);
}
.fate-zw-center-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 0.35rem 0.9rem;
  font-size: 0.72rem; color: #EBE0FF;
}
.fate-zw-center-grid > div { display: flex; flex-direction: column; align-items: center; gap: 0.1rem; }
.fate-zw-c-key { font-size: 0.55rem; letter-spacing: 0.06em; color: rgba(212,175,55,0.7); }
.fate-zw-center-lunar { font-size: 0.6rem; color: rgba(138,126,159,0.85); }
.fate-zw-empty {
  width: 100%; aspect-ratio: 1 / 1; display: flex; align-items: center; justify-content: center;
  border-radius: 1rem; border: 1px dashed rgba(167,139,250,0.2); background: rgba(8,5,18,0.4);
  color: rgba(138,126,159,0.8); font-size: 0.82rem; text-align: center; padding: 2rem;
}

/* ─── 内页通用容器 ─── */
.fate-inner-wrap {
  position: relative; z-index: 1;
  max-width: 1100px; margin: 0 auto; padding: 0 1.5rem;
}

/* ─── Pick 步骤复用样式 ─── */
.strip-nav-btn {
  position: absolute; top: 50%; transform: translateY(-50%); z-index: 100;
  width: 44px; height: 44px; border-radius: 50%;
  background: rgba(3,1,8,0.85); border: 1px solid rgba(212,168,83,0.15);
  color: var(--color-gold-300); display: flex; align-items: center; justify-content: center;
  cursor: pointer; transition: all 0.2s; backdrop-filter: blur(8px);
}
.strip-nav-btn:hover { background: rgba(3,1,8,0.95); border-color: rgba(212,168,83,0.4); }
.strip-scroll { scrollbar-width: none; -ms-overflow-style: none; }
.strip-scroll::-webkit-scrollbar { display: none; }
.card-slot { cursor: pointer; }
.card-back {
  width: 72px; height: 112px; border-radius: 10px; overflow: hidden;
  transition: all 0.3s; border: 2px solid rgba(212,168,83,0.2); box-shadow: 0 2px 10px rgba(0,0,0,0.4);
}
@media (min-width: 640px) { .card-back { width: 80px; height: 126px; } }
.card-idle:hover { transform: translateY(-16px); border-color: rgba(212,168,83,0.5); box-shadow: 0 10px 28px rgba(212,168,83,0.15); z-index: 999 !important; }
.card-selected { opacity: 0.15; transform: scale(0.88); pointer-events: none; filter: grayscale(1); }
.card-disabled { opacity: 0.35; pointer-events: none; }
.position-slot {
  width: 80px; height: 120px; border-radius: 12px;
  display: flex; align-items: center; justify-content: center; transition: all 0.5s;
}
@media (min-width: 640px) { .position-slot { width: 96px; height: 144px; } }
.position-empty { border: 2px dashed rgba(212,168,83,0.15); background: rgba(255,255,255,0.01); }
.position-filled { border: 2px solid rgba(212,168,83,0.35); background: rgba(212,168,83,0.04); box-shadow: 0 0 20px rgba(212,168,83,0.08); }

/* ═══════ 东方命理扩展 ═══════ */
.fate-bazi-chip {
  display: inline-flex; align-items: center; gap: 0.3rem;
  padding: 0.3rem 0.7rem; border-radius: 999px;
  font-size: 0.78rem; font-weight: 500; letter-spacing: 0.02em;
  border: 1px solid rgba(212,175,55,0.28); background: rgba(212,175,55,0.07); color: #F4E3B8;
}
.fate-bazi-chip-key { font-size: 0.62rem; color: rgba(212,175,55,0.6); letter-spacing: 0.06em; }
.fate-bazi-chip--master { border-color: rgba(251,191,36,0.4); background: rgba(251,191,36,0.1); color: #FCE9B8; }
.fate-bazi-chip--strength { border-color: rgba(167,139,250,0.4); background: rgba(138,43,226,0.12); color: #E5D8FF; }
.fate-bazi-chip--strength .fate-bazi-chip-key { color: rgba(167,139,250,0.7); }
.fate-bazi-chip--pattern { border-color: rgba(96,165,250,0.35); background: rgba(96,165,250,0.1); color: #D6E6FF; }
.fate-bazi-chip--pattern .fate-bazi-chip-key { color: rgba(96,165,250,0.7); }

.fate-elem-tag {
  display: inline-flex; align-items: center; justify-content: center;
  width: 1.4rem; height: 1.4rem; border-radius: 0.4rem; font-size: 0.72rem; font-weight: 600;
}
.fate-elem-tag--fav { color: #6EE7B7; border: 1px solid rgba(52,211,153,0.4); background: rgba(52,211,153,0.12); }
.fate-elem-tag--unfav { color: #FDA4AF; border: 1px solid rgba(251,113,133,0.4); background: rgba(251,113,133,0.12); }

/* 五行强弱条形 */
.fate-five-row { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.5rem; }
.fate-five-name { width: 1.1rem; flex-shrink: 0; font-family: ui-serif, Georgia, 'Songti SC', serif; font-size: 0.9rem; font-weight: 600; text-align: center; }
.fate-five-track { flex: 1; height: 7px; border-radius: 999px; background: rgba(255,255,255,0.06); overflow: hidden; }
.fate-five-fill { height: 100%; border-radius: 999px; transition: width 0.9s cubic-bezier(0.22,1,0.36,1); }
.fate-five-val { width: 1.8rem; flex-shrink: 0; text-align: right; font-size: 0.72rem; font-variant-numeric: tabular-nums; }

/* ═══════ 路径对比 ═══════ */
.fate-path-tag {
  flex-shrink: 0; font-size: 0.68rem; font-weight: 500; letter-spacing: 0.04em;
  padding: 0.2rem 0.6rem; border-radius: 999px;
}
.fate-path-tag--stable { color: #CBD5E1; border: 1px solid rgba(148,163,184,0.4); background: rgba(148,163,184,0.12); }
.fate-path-tag--adventure { color: #F5D0FE; border: 1px solid rgba(232,121,249,0.4); background: rgba(232,121,249,0.14); }

.fate-legend-dot { width: 8px; height: 8px; border-radius: 50%; }
.fate-legend-dot--stable { background: #94A3B8; box-shadow: 0 0 8px rgba(148,163,184,0.6); }
.fate-legend-dot--adventure { background: #E879F9; box-shadow: 0 0 8px rgba(232,121,249,0.7); }

.fate-cmp-axis {
  display: flex; align-items: center; gap: 0.5rem;
  font-size: 0.78rem; color: rgba(226,217,243,0.85); letter-spacing: 0.06em; margin-bottom: 0.4rem;
}
.fate-cmp-hint { font-size: 0.6rem; color: rgba(138,126,159,0.7); letter-spacing: 0; }
.fate-cmp-bars { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; }
.fate-cmp-side { display: flex; align-items: center; gap: 0.5rem; }
.fate-cmp-side--left { flex-direction: row-reverse; }
.fate-cmp-track { flex: 1; height: 8px; border-radius: 999px; background: rgba(255,255,255,0.05); overflow: hidden; display: flex; }
.fate-cmp-side--left .fate-cmp-track { justify-content: flex-end; }
.fate-cmp-fill { height: 100%; border-radius: 999px; transition: width 0.9s cubic-bezier(0.22,1,0.36,1); }
.fate-cmp-fill--stable { background: linear-gradient(90deg, rgba(148,163,184,0.5), #94A3B8); box-shadow: 0 0 10px rgba(148,163,184,0.4); }
.fate-cmp-fill--adventure { background: linear-gradient(90deg, #C026D3, #E879F9); box-shadow: 0 0 10px rgba(232,121,249,0.5); }
.fate-cmp-num { width: 1.7rem; flex-shrink: 0; font-size: 0.72rem; font-variant-numeric: tabular-nums; color: #CBD5E1; text-align: right; }
.fate-cmp-num--adv { color: #F5D0FE; text-align: left; }

/* ─── Reduced motion ─── */
@media (prefers-reduced-motion: reduce) {
  .fate-five-fill, .fate-cmp-fill { transition: none !important; }
  .fate-core, .fate-orb--1, .fate-orb--2, .fate-orb--3, .fate-orb--4, .fate-orb--5, .fate-orb--6,
  .fate-dashboard--entered { animation: none !important; }
  .fate-dashboard--entered { opacity: 1 !important; transform: none !important; }
}
</style>
