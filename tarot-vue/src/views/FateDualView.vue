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
import { computeZiwei, ZIWEI_GRID_POS, type ZiweiChart } from '@/composables/useZiwei'

void FateSacredDatetime

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
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
const calibrationOpen = ref(false)

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
const flowSteps = ['提出困惑', '抽取变量', '双盘碰撞', '选择路线']
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

interface ChoiceGuidance {
  title: string
  verdict: string
  whyThisPath: string[]
  actionPlan: {
    now: string[]
    sevenDays: string[]
    thirtyDays: string[]
  }
  risks: string[]
  stopSignals: string[]
  shadowPath: string
  mantra: string
}

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
const choiceGuidance = ref<ChoiceGuidance | null>(null)
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

const fateSpreadPositions = ['当前牵引', '隐藏阻力', '未来变量']

interface ScenarioCard {
  key: DomainKey
  title: string
  sub: string
  question: string
  category: 'love' | 'career' | 'wealth'
  signal: string
}

const scenarioCards: ScenarioCard[] = [
  { key: 'decision', title: '两难抉择', sub: '坚持还是转向', question: '我面前的这个选择，哪条路更适合现在的我？', category: 'career', signal: '分岔' },
  { key: 'career', title: '事业换轨', sub: '机会与风险并存', question: '我现在适合换工作或调整事业方向吗？', category: 'career', signal: '破局' },
  { key: 'love', title: '关系去留', sub: '继续靠近还是放手', question: '这段关系还有值得继续投入的未来吗？', category: 'love', signal: '牵引' },
  { key: 'wealth', title: '财富决策', sub: '投入、守住或等待', question: '这笔投入值得把握，还是应该先稳住现金流？', category: 'wealth', signal: '筹码' },
  { key: 'relationship', title: '人际暗流', sub: '贵人与消耗并行', question: '我该如何处理这段让我反复内耗的人际关系？', category: 'love', signal: '边界' },
  { key: 'health', title: '身心状态', sub: '压力与节奏校准', question: '我近期的身心状态在提醒我调整什么？', category: 'wealth', signal: '节律' },
]

const selectedDomainOption = computed(() => domainOptions.find((d) => d.key === selectedDomain.value) ?? domainOptions[0])
const birthAnchorSummary = computed(() => {
  const y = birthYear.value, m = birthMonth.value, d = birthDay.value
  const day = y && m && d ? `${y}.${pad2(m)}.${pad2(d)}` : '生日待校准'
  const time = birthHour.value != null ? `${pad2(birthHour.value)}:${pad2(birthMinute.value ?? 0)}` : '时辰待校准'
  const sex = gender.value === 'female' ? '女' : '男'
  return `${day} · ${time} · ${sex}`
})
const chartAnchorLabel = computed(() => chartType.value === 'ziwei' ? '紫微斗数' : '八字四柱')

const birthDateWheelTouched = ref(false)
const profilePrefilled = ref(false)
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
    if (!profilePrefilled.value && user.value) {
      profilePrefilled.value = true
      if (user.value.birthday && /^\d{4}-\d{2}-\d{2}/.test(user.value.birthday)) {
        birthDate.value = user.value.birthday.slice(0, 10)
        birthDateWheelTouched.value = true
      }
      if (user.value.gender === 'male' || user.value.gender === 'female') {
        gender.value = user.value.gender
      }
    }
  },
  { immediate: true },
)

function resetFlow() {
  step.value = 'form'; analysis.value = null; finalResult.value = ''; choiceGuidance.value = null; choiceMade.value = null
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

const baziPillars = ref<{ year: string; month: string; day: string; time: string } | null>(null)
let baziComputeSeq = 0
watch([birthYear, birthMonth, birthDay, birthHour, birthMinute], async ([y, m, d, h, mm]) => {
  const seq = ++baziComputeSeq
  if (!y || !m || !d) {
    baziPillars.value = null
    return
  }
  try {
    const { Solar } = await import('lunar-javascript')
    const solar = Solar.fromYmdHms(y, m, d, h ?? 12, mm ?? 0, 0)
    const ec = solar.getLunar().getEightChar()
    if (seq === baziComputeSeq) {
      baziPillars.value = { year: ec.getYear(), month: ec.getMonth(), day: ec.getDay(), time: ec.getTime() }
    }
  } catch {
    if (seq === baziComputeSeq) baziPillars.value = null
  }
}, { immediate: true })

/** 紫微斗数星盘（按出生信息实时排盘，选择紫微时才加载排盘库） */
const ziweiChart = ref<ZiweiChart | null>(null)
let ziweiComputeSeq = 0
watch(
  [chartType, birthDate, birthHour, gender],
  async ([type, date, hour, g]) => {
    const seq = ++ziweiComputeSeq
    if (type !== 'ziwei' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      ziweiChart.value = null
      return
    }
    const chart = await computeZiwei(date, hour, g)
    if (seq === ziweiComputeSeq) ziweiChart.value = chart
  },
  { immediate: true },
)

/** 将十二宫按传统棋盘 4×4 坐标排布，供模板渲染 */
const ziweiBoard = computed(() => {
  const chart = ziweiChart.value
  if (!chart) return []
  return chart.palaces.map((p) => ({
    ...p,
    pos: ZIWEI_GRID_POS[p.earthlyBranch] ?? { row: 1, col: 1 },
  }))
})

function applySuggestion(text: string) {
  question.value = text
}

function applyScenario(card: ScenarioCard) {
  selectedDomain.value = card.key
  category.value = card.category
  question.value = card.question
  void nextTick(() => askRef.value?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
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
    const data = res.data.data as { result: string; guidance?: ChoiceGuidance; alreadyChosen?: boolean; choiceType?: 'stable' | 'adventure' }
    finalResult.value = data.result
    choiceGuidance.value = data.guidance ?? null
    if (data.choiceType === 'stable' || data.choiceType === 'adventure') choiceMade.value = data.choiceType
    step.value = 'done'
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
const finalOpening = computed(() => finalResultParagraphs.value[0] ?? '')
const finalRestParagraphs = computed(() => finalResultParagraphs.value.slice(1))

const chosenBranchText = computed(() => {
  const a = analysis.value
  if (!a || !choiceMade.value) return ''
  return choiceMade.value === 'stable' ? a.branches.stable : a.branches.adventure
})

const unchosenPathLabel = computed(() => {
  if (choiceMade.value === 'stable') return '主动破局'
  if (choiceMade.value === 'adventure') return '守住现在'
  return '未选路线'
})

const fallbackChoiceGuidance = computed<ChoiceGuidance>(() => {
  const a = analysis.value
  const isStable = choiceMade.value === 'stable'
  const pathText = chosenBranchText.value || finalResult.value || '这条路线已经被你选中，接下来重点是把直觉落到可执行的节奏里。'
  const shadow = isStable ? a?.branches.adventure : a?.branches.stable
  const verdictBase = a?.conflict.summary || finalOpening.value || '双盘已经给出分岔，真正的答案会在你接下来的行动里显形。'
  if (isStable) {
    return {
      title: '稳线行动手札',
      verdict: `${verdictBase} 你选择先守住现在，适合把风险拆小，在确认节奏后再扩大投入。`,
      whyThisPath: [
        '它能让你先保留资源和退路，不被一时波动推着走。',
        '它适合用观察和小范围验证，确认这件事是否值得继续加码。',
        pathText,
      ],
      actionPlan: {
        now: ['写下三条必须守住的底线', '把最担心的风险拆成一个可验证问题'],
        sevenDays: ['做一次低成本试探', '复盘哪些压力来自现实，哪些来自想象'],
        thirtyDays: ['设定一个明确观察节点', '只在证据变多时扩大投入'],
      },
      risks: ['稳定可能变成拖延', '过度顾全会压住真实渴望', '错过需要主动争取的窗口'],
      stopSignals: ['同一个问题持续内耗', '机会开始明显流失', '你只是因为害怕而维持现状'],
      shadowPath: shadow ? `未选的「主动破局」仍在提醒你：${shadow}` : '未选路线提醒你，内心的冲动不是噪音，它可能是下一轮行动的火种。',
      mantra: '先稳住，再精准出手',
    }
  }
  return {
    title: '破局行动手札',
    verdict: `${verdictBase} 你选择主动破局，适合用一次可控行动让局面显形，同时保留边界。`,
    whyThisPath: [
      '它回应了内心已经累积很久的推动力。',
      '它能用真实反馈替代反复猜测，让你更快看清局势。',
      pathText,
    ],
    actionPlan: {
      now: ['确定一个最小可行动作', '写清这次冒险可承受的代价'],
      sevenDays: ['完成一次真实推进', '找一个可信的人复盘风险边界'],
      thirtyDays: ['用结果校准方向', '保留一条可退可转的备用路线'],
    },
    risks: ['冲动可能放大成本', '高期待会遮住细节风险', '关系或资源可能短期承压'],
    stopSignals: ['连续投入却没有反馈', '你需要隐瞒关键代价才能继续', '身体和情绪持续过载'],
    shadowPath: shadow ? `未选的「守住现在」仍在提醒你：${shadow}` : '未选路线提醒你，稳定不是退缩，而是为下一次跃迁保存力量。',
    mantra: '带着边界去破局',
  }
})

const guidanceView = computed(() => choiceGuidance.value ?? fallbackChoiceGuidance.value)

const guidancePlanSections = computed(() => {
  const g = guidanceView.value
  return [
    { key: 'now', label: '现在', sub: '先让局面落地', items: g.actionPlan.now },
    { key: 'seven', label: '7 天', sub: '制造一次反馈', items: g.actionPlan.sevenDays },
    { key: 'thirty', label: '30 天', sub: '决定是否加码', items: g.actionPlan.thirtyDays },
  ]
})

const fateVerdict = computed(() => {
  const a = analysis.value
  if (!a) return ''
  return a.bazi.advice || a.conflict.summary || a.conflict.type
})

const chosenPathLabel = computed(() => {
  if (choiceMade.value === 'stable') return '守住现在'
  if (choiceMade.value === 'adventure') return '主动破局'
  return '尚未选择'
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
        <div class="fate-hero-copy">
          <p class="fate-hero-kicker">FATE DUAL ROOM</p>
          <h1 class="fate-hero-title">命运双盘</h1>
          <p class="fate-hero-sub">把一个摇摆不定的念头，交给命盘底色与塔罗变量共同推演。</p>
        </div>
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
        <!-- ─── 左栏：命盘校准 ─── -->
        <section class="fate-panel fate-panel-left" aria-labelledby="fate-birth-h">
          <div class="fate-panel-header">
            <h2 id="fate-birth-h" class="fate-panel-title">命盘校准</h2>
            <p class="fate-panel-sub">已尽量从个人资料预填，可展开微调</p>
          </div>

          <div class="fate-anchor-card">
            <p class="fate-anchor-kicker">当前锚点</p>
            <p class="fate-anchor-main">{{ birthAnchorSummary }}</p>
            <div class="fate-anchor-meta">
              <span>{{ chartAnchorLabel }}</span>
              <span>{{ birthPlace || '出生地待补充' }}</span>
            </div>
            <button type="button" class="fate-anchor-toggle cursor-pointer" @click="calibrationOpen = !calibrationOpen">
              {{ calibrationOpen ? '收起校准' : '展开校准' }}
            </button>
          </div>

          <Transition name="fate-calibration">
            <div v-if="calibrationOpen" class="fate-calibration">
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
            </div>
          </Transition>

          <div class="fate-mini-summary">
            <span>命盘用于判断底色</span>
            <span>塔罗用于捕捉当下变量</span>
          </div>
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
              <div class="fate-astral-aura" />
              <div class="fate-sigil-ring" aria-hidden="true">
                <span
                  v-for="(mark, mi) in ['乾','坤','震','巽','坎','离','艮','兑']"
                  :key="mark"
                  class="fate-sigil-mark"
                  :style="`--i:${mi}`"
                >{{ mark }}</span>
              </div>
              <div class="fate-energy-line fate-energy-line--x" />
              <div class="fate-energy-line fate-energy-line--y" />
              <div class="fate-oracle-mist" />
              <!-- 中心水晶球 + 环 -->
              <div class="fate-crystal-field" aria-hidden="true">
                <span class="fate-crystal-orbit fate-crystal-orbit--one" />
                <span class="fate-crystal-orbit fate-crystal-orbit--two" />
                <span class="fate-crystal-orbit fate-crystal-orbit--three" />
                <span
                  v-for="(rune, ri) in ['✧','☽','◇','✦','☉','✶','✷','✺']"
                  :key="rune + ri"
                  class="fate-crystal-rune"
                  :style="`--r:${ri}`"
                >{{ rune }}</span>
              </div>
              <div class="fate-core fate-crystal-core">
                <div class="fate-crystal-backglow" />
                <div class="fate-crystal-depth" />
                <div class="fate-crystal-mist" />
                <div class="fate-crystal-sigils" aria-hidden="true">
                  <span v-for="(glyph, gi) in ['☽','✦','◇','✧','☉','✶','△','✷']" :key="glyph" :style="`--g:${gi}`">{{ glyph }}</span>
                </div>
                <div class="fate-crystal-lines" />
                <div class="fate-crystal-facet fate-crystal-facet--one" />
                <div class="fate-crystal-facet fate-crystal-facet--two" />
                <div class="fate-crystal-shine" />
              </div>
              <div class="fate-ring"/>
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
            <h2 id="fate-ai-h" class="fate-panel-title">把问题说清楚</h2>
            <p class="fate-panel-sub">先写下此刻最想确认的事，也可以点下面的场景快速套用</p>
          </div>

          <!-- 向宇宙提问 -->
          <div ref="askRef" class="fate-ask">
            <div class="fate-ask-heading">
              <div>
                <p class="fate-ask-title">当前领域：{{ selectedDomainOption.label }}</p>
                <p class="fate-ask-hint">{{ selectedDomainOption.sub }} · 至少写下 5 个字</p>
              </div>
              <span class="fate-domain-pill">{{ selectedDomainOption.label }}</span>
            </div>
            <!-- 问题示例 -->
            <div class="fate-suggestions">
              <button v-for="s in questionSuggestions" :key="s" type="button" class="fate-suggestion cursor-pointer" @click="applySuggestion(s)">{{ s }}</button>
            </div>
            <div class="fate-ask-box" :class="{ 'fate-ask-box--focus': questionFieldFocused }">
              <textarea v-model="question" rows="4" maxlength="200" placeholder="例如：我该守住现在的工作，还是接受那个不确定但更有成长性的机会？" class="fate-ask-input" @focus="questionFieldFocused = true" @blur="questionFieldFocused = false"/>
              <div class="fate-ask-bar">
                <span class="fate-ask-count" :class="{ 'fate-ask-count--ok': question.trim().length >= 5 }">{{ question.length }}/200</span>
                <button type="button" class="fate-ask-send cursor-pointer" :class="{ 'fate-ask-send--ready': canSubmit }" :disabled="ctaInvoking" aria-label="进入抽牌" @click="invokeCtaRitual">
                  {{ ctaBusyLabel ? '校准中' : '进入抽牌' }}
                </button>
              </div>
            </div>
            <p class="fate-cta-hint">{{ canSubmit ? '下一步抽取三张变量牌' : '直接输入，或点击下方场景自动生成问题' }}</p>
          </div>

          <div class="fate-scenario-head">
            <span>快速场景</span>
            <small>点选会自动填入问题</small>
          </div>
          <div class="fate-scenario-grid">
            <button
              v-for="(card, cardIndex) in scenarioCards"
              :key="card.title"
              type="button"
              class="fate-scenario-card cursor-pointer"
              :class="{ 'fate-scenario-card--on': selectedDomain === card.key, 'fate-scenario-card--featured': cardIndex === 0 }"
              :aria-pressed="selectedDomain === card.key"
              @click="applyScenario(card)"
            >
              <span class="fate-scenario-top">
                <span class="fate-scenario-title">{{ card.title }}</span>
                <span class="fate-scenario-signal">{{ card.signal }}</span>
              </span>
              <span class="fate-scenario-sub">{{ card.sub }}</span>
            </button>
          </div>
        </aside>
      </div>
    </div>

    <!-- ═══════ PICK 步骤 ═══════ -->
    <div v-else-if="step === 'pick'" class="fate-inner-wrap">
      <header class="text-center mb-8">
        <p class="text-xs tracking-[0.28em] text-[#D4AF37]/55">FATE DUAL</p>
        <h1 class="font-serif text-3xl font-semibold tracking-[0.12em] text-[#E2D9F3] mt-2">抽取当下变量</h1>
      </header>
      <div class="max-w-4xl mx-auto">
        <div class="text-center mb-8">
          <h2 class="text-lg font-serif text-gold-200 mb-2">让塔罗补上命盘看不见的变量</h2>
          <p class="text-gray-500 text-sm">依直觉抽 3 张牌，对应当前牵引、隐藏阻力、未来变量。</p>
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
            <p class="text-center text-gray-600 text-sm mb-5">三张牌会成为本次双盘碰撞的变量层</p>
            <div class="flex flex-wrap justify-center gap-5">
              <div v-for="(position, posIndex) in fateSpreadPositions" :key="posIndex" class="flex flex-col items-center">
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
            <button v-if="allThreePicked" type="button" class="cursor-pointer px-10 py-4 rounded-2xl cta-button text-white font-medium text-lg" @click="runAnalyzeWithPickedCards">开始双盘碰撞</button>
          </div>
        </template>
      </div>
    </div>

    <!-- Analyzing -->
    <FateDualAnalyzingRitual v-else-if="step === 'analyzing'" />

    <!-- Dual result -->
    <div v-else-if="step === 'dual' && analysis" class="fate-inner-wrap space-y-10">
      <section class="fate-verdict-panel">
        <div>
          <p class="fate-verdict-kicker">双盘碰撞结论</p>
          <h2 class="fate-verdict-title">{{ analysis.conflict.type }}</h2>
        </div>
        <p class="fate-verdict-text">{{ fateVerdict }}</p>
        <div class="fate-verdict-strip">
          <span>命盘底色：{{ analysis.bazi.dayMaster || analysis.bazi.pattern || '气机侧写' }}</span>
          <span>塔罗变量：{{ analysis.tarot.cards.map((c) => c.name).join(' · ') }}</span>
          <span>当前领域：{{ selectedDomainOption.label }}</span>
        </div>
      </section>

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
      <section class="fate-collision-panel">
        <p class="fate-collision-label">命运天平</p>
        <p class="fate-collision-summary">{{ analysis.conflict.summary }}</p>
      </section>
      <div class="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div class="fate-route-card fate-route-card--stable">
          <div class="flex items-center justify-between gap-2 mb-3">
            <div>
              <p class="fate-route-label">路线 A</p>
              <p class="font-medium text-slate-200">守住现在</p>
            </div>
            <span v-if="analysis.branches.stableTag" class="fate-path-tag fate-path-tag--stable">{{ analysis.branches.stableTag }}</span>
          </div>
          <p class="fate-route-sub">更适合需要降低变量、保留资源、等待时机的人。</p>
          <p v-for="(para, pi) in splitDisplayParagraphs(analysis.branches.stable)" :key="pi" class="text-sm text-gray-400 mb-2">{{ para }}</p>
          <p v-if="analysis.branches.stableHorizon" class="mt-3 flex items-center gap-1.5 text-[11px] text-slate-400/70">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            {{ t('pages.fateDual.horizonLabel') }} · {{ analysis.branches.stableHorizon }}
          </p>
        </div>
        <div class="fate-route-card fate-route-card--adventure">
          <div class="flex items-center justify-between gap-2 mb-3">
            <div>
              <p class="fate-route-label">路线 B</p>
              <p class="font-medium text-fuchsia-100/95">主动破局</p>
            </div>
            <span v-if="analysis.branches.adventureTag" class="fate-path-tag fate-path-tag--adventure">{{ analysis.branches.adventureTag }}</span>
          </div>
          <p class="fate-route-sub">更适合愿意承担波动、重写叙事、换取成长的人。</p>
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

      <section class="fate-choice-panel">
        <div>
          <p class="fate-choice-kicker">留下本次命运签章</p>
          <h3>你这次要相信哪一种行动策略？</h3>
        </div>
        <div class="fate-choice-actions">
          <button type="button" class="fate-choice-btn fate-choice-btn--stable cursor-pointer" @click="onChoose('stable')">
            <span>守住现在</span>
            <small>顺势、观察、减少变量</small>
          </button>
          <button type="button" class="fate-choice-btn fate-choice-btn--adventure cursor-pointer" @click="onChoose('adventure')">
            <span>主动破局</span>
            <small>行动、承担、改写路径</small>
          </button>
        </div>
      </section>
    </div>

    <!-- Submitting -->
    <div v-else-if="step === 'submitting'" class="fate-inner-wrap text-center py-24">
      <div class="inline-block w-10 h-10 border-2 border-fuchsia-500/30 border-t-fuchsia-400 rounded-full animate-spin mb-4"/>
      <p class="text-gray-400 text-sm">{{ t('pages.fateDual.inscribing') }}</p>
    </div>

    <!-- Done -->
    <div v-else-if="step === 'done'" class="fate-inner-wrap fate-result-wrap">
      <div class="fate-seal-header fate-seal-header--result">
        <p class="fate-result-kicker">{{ t('pages.fateDual.sealedChoice') }}</p>
        <h3>{{ chosenPathLabel }}</h3>
        <p class="fate-seal-sub">AI 已根据你的双盘分岔，生成这条路线的解析与行动指引。</p>
      </div>

      <section class="fate-guidance-hero">
        <div class="fate-guidance-orb" aria-hidden="true">
          <span class="fate-guidance-ring fate-guidance-ring--one"></span>
          <span class="fate-guidance-ring fate-guidance-ring--two"></span>
          <span class="fate-guidance-rune" style="--i:0">月</span>
          <span class="fate-guidance-rune" style="--i:1">星</span>
          <span class="fate-guidance-rune" style="--i:2">命</span>
          <span class="fate-guidance-rune" style="--i:3">心</span>
          <span class="fate-guidance-core"></span>
        </div>
        <div class="fate-guidance-copy">
          <p class="fate-guidance-label">AI 路线解读</p>
          <h4>{{ guidanceView.title }}</h4>
          <p>{{ guidanceView.verdict }}</p>
          <div class="fate-guidance-mantra">{{ guidanceView.mantra }}</div>
        </div>
      </section>

      <section class="fate-guidance-grid">
        <div class="fate-guidance-card fate-guidance-card--why">
          <p class="fate-card-label">为什么适合这条路</p>
          <ol class="fate-guidance-list fate-guidance-list--numbered">
            <li v-for="(item, idx) in guidanceView.whyThisPath" :key="idx">
              <span>{{ idx + 1 }}</span>
              <p>{{ item }}</p>
            </li>
          </ol>
        </div>

        <div class="fate-guidance-card fate-guidance-card--shadow">
          <p class="fate-card-label">{{ unchosenPathLabel }}的阴影提醒</p>
          <p>{{ guidanceView.shadowPath }}</p>
        </div>
      </section>

      <section class="fate-plan-panel">
        <div class="fate-plan-head">
          <p class="fate-card-label">行动计划</p>
          <h4>把选择变成接下来 30 天的节奏</h4>
        </div>
        <div class="fate-plan-grid">
          <div v-for="section in guidancePlanSections" :key="section.key" class="fate-plan-card">
            <span class="fate-plan-badge">{{ section.label }}</span>
            <p class="fate-plan-sub">{{ section.sub }}</p>
            <ul>
              <li v-for="(item, idx) in section.items" :key="idx">{{ item }}</li>
            </ul>
          </div>
        </div>
      </section>

      <section class="fate-risk-grid">
        <div class="fate-risk-card fate-risk-card--risk">
          <p class="fate-card-label">需要留意的代价</p>
          <ul class="fate-guidance-list">
            <li v-for="(item, idx) in guidanceView.risks" :key="idx">{{ item }}</li>
          </ul>
        </div>
        <div class="fate-risk-card fate-risk-card--signal">
          <p class="fate-card-label">停止或转向信号</p>
          <ul class="fate-guidance-list">
            <li v-for="(item, idx) in guidanceView.stopSignals" :key="idx">{{ item }}</li>
          </ul>
        </div>
      </section>

      <div class="fate-final-card">
        <p class="fate-card-label">命盘回声</p>
        <p v-if="finalOpening" class="fate-final-opening">{{ finalOpening }}</p>
        <p v-for="(para, pi) in finalRestParagraphs" :key="pi" class="fate-final-para">{{ para }}</p>
      </div>

      <div class="fate-result-actions">
        <button type="button" class="fate-result-action fate-result-action--primary cursor-pointer" @click="resetFlow">{{ t('pages.fateDual.again') }}</button>
        <RouterLink to="/fate-dual/history" class="fate-result-action fate-result-action--ghost">{{ t('pages.fateDual.historyLinkInner') }}</RouterLink>
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
    grid-template-columns: 320px minmax(420px, 1fr) 420px;
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

.fate-anchor-card {
  border-radius: 1rem;
  border: 1px solid rgba(212,175,55,0.18);
  background:
    radial-gradient(circle at 24% 0%, rgba(212,175,55,0.12), transparent 42%),
    rgba(8,5,18,0.62);
  padding: 1rem;
}
.fate-anchor-kicker {
  font-size: 0.62rem;
  letter-spacing: 0.12em;
  color: rgba(212,175,55,0.66);
}
.fate-anchor-main {
  margin-top: 0.4rem;
  color: #F5E9FF;
  font-size: 0.95rem;
  line-height: 1.5;
}
.fate-anchor-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: 0.7rem;
}
.fate-anchor-meta span,
.fate-domain-pill {
  border-radius: 999px;
  border: 1px solid rgba(167,139,250,0.16);
  background: rgba(167,139,250,0.08);
  color: rgba(226,217,243,0.76);
  padding: 0.22rem 0.55rem;
  font-size: 0.66rem;
}
.fate-anchor-toggle {
  margin-top: 0.85rem;
  width: 100%;
  border-radius: 0.7rem;
  border: 1px solid rgba(212,175,55,0.22);
  color: #F6E7B6;
  background: rgba(212,175,55,0.06);
  padding: 0.55rem 0.7rem;
  font-size: 0.78rem;
  transition: background 0.18s, border-color 0.18s;
}
.fate-anchor-toggle:hover {
  border-color: rgba(212,175,55,0.42);
  background: rgba(212,175,55,0.1);
}
.fate-calibration {
  margin-top: 1rem;
}
.fate-calibration-enter-active,
.fate-calibration-leave-active {
  transition: opacity 0.22s ease, transform 0.22s ease;
}
.fate-calibration-enter-from,
.fate-calibration-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
.fate-mini-summary {
  display: grid;
  gap: 0.45rem;
  margin-top: 1rem;
  color: rgba(138,126,159,0.82);
  font-size: 0.68rem;
  line-height: 1.5;
}
.fate-mini-summary span {
  border-left: 2px solid rgba(212,175,55,0.34);
  padding-left: 0.6rem;
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

/* ─── 右栏：场景与提问 ─── */
.fate-panel-right {
  display: flex;
  flex-direction: column;
}
.fate-scenario-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.6rem;
  margin-bottom: 1.25rem;
}
.fate-scenario-card {
  min-height: 92px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.28rem;
  border-radius: 0.85rem;
  border: 1px solid rgba(255,255,255,0.08);
  background:
    linear-gradient(145deg, rgba(22,11,36,0.72), rgba(8,5,18,0.76));
  padding: 0.7rem;
  text-align: left;
  transition: border-color 0.18s, background 0.18s, transform 0.18s;
}
.fate-scenario-card:hover {
  transform: translateY(-2px);
  border-color: rgba(212,175,55,0.28);
  background:
    radial-gradient(circle at 0% 0%, rgba(212,175,55,0.1), transparent 45%),
    linear-gradient(145deg, rgba(33,18,52,0.84), rgba(8,5,18,0.8));
}
.fate-scenario-card--on {
  border-color: rgba(212,175,55,0.48);
  box-shadow: 0 0 18px rgba(212,175,55,0.12);
}
.fate-scenario-signal {
  color: rgba(212,175,55,0.76);
  font-size: 0.62rem;
  letter-spacing: 0.08em;
}
.fate-scenario-title {
  color: #F5E9FF;
  font-size: 0.86rem;
  font-weight: 600;
}
.fate-scenario-sub {
  color: rgba(138,126,159,0.78);
  font-size: 0.66rem;
  line-height: 1.35;
}
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
.fate-ask-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.8rem;
  margin-bottom: 0.55rem;
}
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
  display: flex; align-items: center; justify-content: space-between; gap: 0.8rem; padding: 0.3rem 0.6rem 0.6rem;
}
.fate-ask-count { font-size: 0.62rem; color: rgba(138,126,159,0.6); transition: color 0.2s; }
.fate-ask-count--ok { color: rgba(167,139,250,0.95); }
.fate-ask-send {
  min-width: 6.2rem; height: 34px; border-radius: 999px; display: flex; align-items: center; justify-content: center;
  background: rgba(138,43,226,0.35); color: #FFF7E2;
  padding: 0 0.9rem;
  font-size: 0.78rem;
  font-weight: 600;
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

@media (max-width: 520px) {
  .fate-dashboard { padding: 0 1rem; }
  .fate-scenario-grid { grid-template-columns: 1fr; }
  .fate-ask-heading { flex-direction: column; }
}

/* ─── 首页视觉优化：双盘决策台 ─── */
.fate-page--form {
  padding-top: calc(3.25rem + env(safe-area-inset-top, 0px));
  padding-bottom: 2.5rem;
}
.fate-bg-deep {
  background:
    radial-gradient(ellipse 72% 54% at 50% 8%, rgba(67,36,116,0.42), transparent 58%),
    radial-gradient(ellipse 58% 48% at 8% 70%, rgba(14,91,116,0.2), transparent 64%),
    linear-gradient(180deg, #090518 0%, #050310 52%, #020106 100%);
}
.fate-dashboard {
  max-width: 1480px;
}
.fate-hero-header {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1.25rem;
  align-items: end;
  text-align: left;
  margin-bottom: 1.65rem;
  padding: 1.15rem 0 1.25rem;
}
.fate-hero-header::before {
  content: '';
  position: absolute;
  inset: auto 0 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(212,175,55,0.35), rgba(167,139,250,0.26), transparent);
}
.fate-hero-copy {
  max-width: 760px;
}
.fate-hero-kicker {
  margin-bottom: 0.5rem;
  color: rgba(212,175,55,0.72);
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.18em;
}
.fate-hero-title {
  font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', sans-serif;
  font-size: clamp(2.6rem, 6vw, 5.4rem);
  font-weight: 800;
  letter-spacing: 0;
  line-height: 0.95;
  text-shadow: 0 0 34px rgba(196,168,255,0.38), 0 14px 42px rgba(0,0,0,0.42);
}
.fate-hero-sub {
  max-width: 36rem;
  margin-top: 0.9rem;
  font-size: 1rem;
  line-height: 1.7;
  letter-spacing: 0;
  color: rgba(226,217,243,0.78);
}
.fate-steps {
  justify-content: flex-start;
  gap: 0.55rem 0.9rem;
  margin-top: 0;
}
.fate-step {
  border-radius: 999px;
  border: 1px solid rgba(229,217,255,0.08);
  background: rgba(11,7,24,0.56);
  padding: 0.28rem 0.62rem 0.28rem 0.3rem;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
}
.fate-step:not(:last-child)::after {
  display: none;
}
.fate-step-dot {
  width: 22px;
  height: 22px;
  border-color: rgba(212,175,55,0.18);
  background: rgba(255,255,255,0.04);
}
.fate-step-label {
  font-size: 0.72rem;
  letter-spacing: 0;
}
.fate-step--active {
  border-color: rgba(212,175,55,0.32);
  background: linear-gradient(135deg, rgba(212,175,55,0.14), rgba(138,43,226,0.18));
}
.fate-step--active .fate-step-dot {
  background: #D4AF37;
  color: #130817;
  box-shadow: 0 0 18px rgba(212,175,55,0.38);
}
@media (min-width: 980px) {
  .fate-hero-header {
    grid-template-columns: minmax(0, 1fr) auto;
  }
  .fate-steps {
    justify-content: flex-end;
    max-width: 520px;
  }
}

.fate-main-grid {
  gap: 1.1rem;
}
@media (min-width: 1024px) {
  .fate-main-grid {
    grid-template-columns: minmax(260px, 300px) minmax(360px, 1fr) minmax(340px, 380px);
    gap: 1rem;
  }
}
@media (min-width: 1280px) {
  .fate-main-grid {
    grid-template-columns: 320px minmax(450px, 1fr) 440px;
    gap: 1.25rem;
  }
}
.fate-panel {
  position: relative;
  overflow: hidden;
  border-color: rgba(229,217,255,0.1);
  border-radius: 1.35rem;
  background:
    linear-gradient(145deg, rgba(23,14,39,0.78), rgba(5,3,14,0.82)),
    rgba(255,255,255,0.02);
  box-shadow: 0 24px 80px -42px rgba(0,0,0,0.86);
}
.fate-panel::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    linear-gradient(135deg, rgba(255,255,255,0.08), transparent 22%),
    radial-gradient(circle at 8% 0%, rgba(212,175,55,0.08), transparent 34%);
}
.fate-panel > * {
  position: relative;
  z-index: 1;
}
.fate-panel-title {
  font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', sans-serif;
  font-weight: 750;
  letter-spacing: 0;
}
.fate-panel-sub {
  font-size: 0.76rem;
  line-height: 1.45;
  letter-spacing: 0;
  color: rgba(191,181,211,0.72);
}
.fate-anchor-card {
  border-radius: 1.05rem;
  border-color: rgba(212,175,55,0.22);
  background:
    radial-gradient(circle at 20% 0%, rgba(212,175,55,0.18), transparent 42%),
    linear-gradient(155deg, rgba(31,20,48,0.86), rgba(7,5,18,0.88));
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.08);
}
.fate-anchor-main {
  font-size: 1rem;
  font-weight: 650;
}
.fate-anchor-toggle {
  border-radius: 999px;
  background: rgba(212,175,55,0.08);
  font-weight: 650;
  transition: background 0.18s, border-color 0.18s, transform 0.18s;
}
.fate-anchor-toggle:active {
  transform: translateY(1px);
}
.fate-center {
  min-height: 460px;
  border-radius: 1.6rem;
  background:
    radial-gradient(circle at 50% 44%, rgba(212,175,55,0.08), transparent 34%),
    radial-gradient(circle at 50% 48%, rgba(138,43,226,0.14), transparent 58%);
}
@media (min-width: 1024px) {
  .fate-center {
    min-height: 540px;
  }
}
.fate-orrery-container {
  max-width: 540px;
  filter: drop-shadow(0 32px 64px rgba(0,0,0,0.38));
}
.fate-core {
  background: radial-gradient(circle at 42% 38%, #FFF7D7 0%, #D4AF37 30%, #8A5CF6 66%, #2F1768 100%);
  box-shadow: 0 0 42px rgba(212,175,55,0.46), 0 0 90px rgba(138,92,246,0.34);
}
.fate-ring {
  border-color: rgba(212,175,55,0.48);
  box-shadow: 0 0 22px rgba(212,175,55,0.24), 0 0 46px rgba(138,43,226,0.24);
}
.fate-pillar {
  width: 78px;
  height: 78px;
  border-color: rgba(229,217,255,0.16);
  background:
    radial-gradient(circle at 50% 30%, rgba(212,175,55,0.16), transparent 44%),
    rgba(8,5,18,0.82);
  box-shadow: 0 16px 44px -26px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.08);
}
.fate-pillar-label {
  letter-spacing: 0.06em;
}
.fate-pillar-gz {
  font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', sans-serif;
  font-size: 1.18rem;
  font-weight: 780;
  letter-spacing: 0;
}
.fate-chart-tabs {
  align-self: center;
  border-radius: 999px;
  border: 1px solid rgba(229,217,255,0.1);
  background: rgba(5,3,14,0.58);
  padding: 0.25rem;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
}
.fate-tab {
  border: 0;
  border-radius: 999px;
  background: transparent;
  padding: 0.48rem 1rem;
  letter-spacing: 0;
}
.fate-tab--on {
  background: rgba(212,175,55,0.16);
  color: #FFF2C0;
  box-shadow: inset 0 0 0 1px rgba(212,175,55,0.28), 0 10px 28px -20px rgba(212,175,55,0.7);
}

.fate-panel-right {
  min-height: 100%;
}
.fate-scenario-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.7rem;
  margin-bottom: 1rem;
}
.fate-scenario-card {
  position: relative;
  min-height: 104px;
  border-radius: 1rem;
  border-color: rgba(229,217,255,0.1);
  background:
    linear-gradient(150deg, rgba(255,255,255,0.055), rgba(255,255,255,0.015)),
    rgba(10,6,24,0.76);
  padding: 0.86rem;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.05);
  transition: transform 0.18s, border-color 0.18s, background 0.18s, box-shadow 0.18s;
}
.fate-scenario-card::after {
  content: '';
  position: absolute;
  inset: auto 0.85rem 0.72rem;
  height: 1px;
  background: linear-gradient(90deg, rgba(212,175,55,0.42), transparent);
  opacity: 0;
  transition: opacity 0.18s;
}
.fate-scenario-card:hover {
  transform: translateY(-3px);
  border-color: rgba(212,175,55,0.3);
  background:
    radial-gradient(circle at 16% 0%, rgba(212,175,55,0.14), transparent 42%),
    linear-gradient(150deg, rgba(41,25,62,0.84), rgba(9,6,22,0.86));
  box-shadow: 0 18px 42px -30px rgba(212,175,55,0.5);
}
.fate-scenario-card--on {
  border-color: rgba(212,175,55,0.55);
  background:
    radial-gradient(circle at 16% 0%, rgba(212,175,55,0.2), transparent 45%),
    linear-gradient(150deg, rgba(51,32,73,0.92), rgba(13,8,27,0.9));
  box-shadow: 0 0 0 1px rgba(212,175,55,0.08), 0 18px 48px -34px rgba(212,175,55,0.72);
}
.fate-scenario-card--on::after {
  opacity: 1;
}
.fate-scenario-card--featured {
  grid-column: 1 / -1;
  min-height: 118px;
}
.fate-scenario-top {
  display: flex;
  width: 100%;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}
.fate-scenario-title {
  font-size: 0.98rem;
  font-weight: 760;
  letter-spacing: 0;
}
.fate-scenario-signal {
  flex-shrink: 0;
  border-radius: 999px;
  border: 1px solid rgba(212,175,55,0.22);
  background: rgba(212,175,55,0.08);
  padding: 0.16rem 0.46rem;
  color: rgba(245,224,168,0.88);
  font-size: 0.64rem;
  font-weight: 650;
  letter-spacing: 0.04em;
}
.fate-scenario-sub {
  max-width: 15rem;
  color: rgba(214,205,232,0.72);
  font-size: 0.74rem;
  line-height: 1.45;
}

.fate-ask {
  margin-top: 0.25rem;
  border-radius: 1.1rem;
  border: 1px solid rgba(229,217,255,0.1);
  background:
    radial-gradient(circle at 88% 0%, rgba(138,43,226,0.14), transparent 38%),
    rgba(5,3,14,0.5);
  padding: 0.95rem;
}
.fate-ask-title {
  font-size: 1rem;
  font-weight: 760;
  letter-spacing: 0;
}
.fate-ask-hint {
  color: rgba(191,181,211,0.72);
  font-size: 0.72rem;
  letter-spacing: 0;
}
.fate-domain-pill,
.fate-anchor-meta span {
  border-color: rgba(212,175,55,0.18);
  background: rgba(212,175,55,0.08);
  color: rgba(255,242,192,0.82);
}
.fate-suggestions {
  gap: 0.45rem;
  margin-bottom: 0.8rem;
}
.fate-suggestion {
  border-color: rgba(229,217,255,0.12);
  background: rgba(255,255,255,0.045);
  color: rgba(226,217,243,0.78);
}
.fate-suggestion:hover {
  border-color: rgba(212,175,55,0.32);
  background: rgba(212,175,55,0.1);
  color: #FFF2C0;
}
.fate-ask-box {
  border-radius: 1rem;
  border-color: rgba(229,217,255,0.12);
  background:
    linear-gradient(180deg, rgba(255,255,255,0.045), transparent),
    rgba(2,1,8,0.6);
}
.fate-ask-box:focus-within,
.fate-ask-box--focus {
  border-color: rgba(212,175,55,0.45);
  box-shadow: 0 0 0 1px rgba(212,175,55,0.12), 0 20px 50px -36px rgba(212,175,55,0.75);
}
.fate-ask-input {
  min-height: 128px;
  padding: 0.95rem 1rem 0.5rem;
  font-size: 0.9rem;
}
.fate-ask-input::placeholder {
  color: rgba(191,181,211,0.48);
}
.fate-ask-bar {
  padding: 0.4rem 0.7rem 0.7rem 1rem;
}
.fate-ask-send {
  min-width: 7.4rem;
  height: 38px;
  background: rgba(229,217,255,0.1);
  color: rgba(245,233,255,0.8);
  box-shadow: none;
}
.fate-ask-send--ready {
  background: linear-gradient(135deg, #D4AF37, #8A5CF6);
  color: #120817;
  box-shadow: 0 12px 30px -16px rgba(212,175,55,0.9);
}
.fate-ask-send:active {
  transform: translateY(1px);
}
.fate-cta-hint {
  color: rgba(191,181,211,0.66);
}
@media (max-width: 720px) {
  .fate-page--form {
    padding-top: calc(4.6rem + env(safe-area-inset-top, 0px));
  }
  .fate-hero-title {
    font-size: clamp(2.35rem, 15vw, 3.5rem);
  }
  .fate-hero-sub {
    font-size: 0.92rem;
  }
  .fate-main-grid {
    gap: 1rem;
  }
  .fate-center {
    order: -1;
    min-height: auto;
    padding: 0;
  }
  .fate-orrery-container {
    max-width: min(92vw, 420px);
  }
  .fate-panel {
    padding: 1.15rem;
  }
  .fate-scenario-grid {
    grid-template-columns: 1fr;
  }
  .fate-scenario-card--featured {
    min-height: 108px;
  }
  .fate-ask {
    padding: 0.82rem;
  }
}

/* ─── 首页紧凑可用版：输入优先 ─── */
.fate-page--form {
  padding-top: calc(2.85rem + env(safe-area-inset-top, 0px));
}
.fate-dashboard {
  max-width: 1420px;
}
.fate-hero-header {
  grid-template-columns: minmax(0, 1fr);
  gap: 0.7rem;
  margin-bottom: 1rem;
  padding: 0.45rem 0 0.8rem;
}
.fate-hero-header::before {
  background: linear-gradient(90deg, rgba(212,175,55,0.06), rgba(212,175,55,0.42), rgba(138,92,246,0.22), transparent);
}
.fate-hero-copy {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  grid-template-areas:
    "kicker sub"
    "title sub";
  column-gap: 1.2rem;
  align-items: end;
  max-width: none;
}
.fate-hero-kicker {
  grid-area: kicker;
  margin-bottom: 0.18rem;
  font-size: 0.62rem;
  letter-spacing: 0.16em;
}
.fate-hero-title {
  grid-area: title;
  font-size: clamp(2rem, 3.4vw, 3.15rem);
  line-height: 0.98;
}
.fate-hero-sub {
  grid-area: sub;
  max-width: 26rem;
  margin: 0;
  color: rgba(226,217,243,0.66);
  font-size: 0.86rem;
  line-height: 1.55;
}
.fate-steps {
  gap: 0.42rem;
}
.fate-step {
  padding: 0.2rem 0.52rem 0.2rem 0.24rem;
  border-color: rgba(229,217,255,0.07);
  background: rgba(10,7,21,0.44);
}
.fate-step-dot {
  width: 20px;
  height: 20px;
  font-size: 0.68rem;
}
.fate-step-label {
  font-size: 0.68rem;
}
@media (min-width: 980px) {
  .fate-hero-header {
    grid-template-columns: minmax(0, 1fr) auto;
  }
  .fate-steps {
    max-width: none;
  }
}

@media (min-width: 1024px) {
  .fate-main-grid {
    grid-template-columns: minmax(250px, 285px) minmax(330px, 1fr) minmax(390px, 430px);
    gap: 0.9rem;
    align-items: stretch;
  }
}
@media (min-width: 1280px) {
  .fate-main-grid {
    grid-template-columns: 300px minmax(390px, 1fr) 440px;
  }
}
.fate-panel {
  border-radius: 1.15rem;
  padding: 1.15rem;
  background:
    linear-gradient(145deg, rgba(24,17,35,0.9), rgba(6,4,14,0.86)),
    rgba(255,255,255,0.02);
  box-shadow: 0 18px 70px -44px rgba(0,0,0,0.92), inset 0 1px 0 rgba(255,255,255,0.05);
}
.fate-panel::before {
  background:
    linear-gradient(135deg, rgba(255,255,255,0.08), transparent 18%),
    radial-gradient(circle at 88% 8%, rgba(212,175,55,0.08), transparent 32%);
}
.fate-panel-header {
  margin-bottom: 0.8rem;
}
.fate-panel-title {
  font-size: 1rem;
}
.fate-panel-sub {
  font-size: 0.72rem;
}
.fate-anchor-card {
  padding: 0.85rem;
}
.fate-anchor-kicker {
  font-size: 0.58rem;
}
.fate-anchor-main {
  margin-top: 0.26rem;
  font-size: 0.92rem;
}
.fate-anchor-meta {
  margin-top: 0.5rem;
}
.fate-anchor-toggle {
  margin-top: 0.62rem;
  padding: 0.46rem 0.7rem;
}
.fate-mini-summary {
  gap: 0.35rem;
  margin-top: 0.72rem;
  font-size: 0.64rem;
}
.fate-center {
  min-height: 400px;
  padding: 0;
  background:
    radial-gradient(circle at 50% 46%, rgba(212,175,55,0.08), transparent 30%),
    radial-gradient(circle at 50% 50%, rgba(138,92,246,0.13), transparent 54%);
}
@media (min-width: 1024px) {
  .fate-center {
    min-height: 470px;
  }
}
.fate-orrery-container {
  max-width: min(470px, 100%);
}
.fate-pillar {
  width: 66px;
  height: 66px;
}
.fate-pillar-label {
  font-size: 0.52rem;
}
.fate-pillar-gz {
  font-size: 1.02rem;
}
.fate-chart-tabs {
  margin-top: 0.4rem;
  padding: 0.2rem;
}
.fate-tab {
  padding: 0.38rem 0.85rem;
  font-size: 0.72rem;
}

.fate-panel-right {
  display: grid;
  grid-template-rows: auto auto auto 1fr;
  align-content: start;
  gap: 0.8rem;
}
.fate-panel-right .fate-panel-header {
  margin-bottom: 0;
}
.fate-ask {
  margin-top: 0;
  border-radius: 1rem;
  border-color: rgba(212,175,55,0.16);
  background:
    linear-gradient(145deg, rgba(212,175,55,0.07), rgba(138,92,246,0.08) 42%, rgba(255,255,255,0.025)),
    rgba(4,3,10,0.58);
  padding: 0.82rem;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.06), 0 18px 48px -38px rgba(212,175,55,0.72);
}
.fate-ask-heading {
  align-items: center;
  margin-bottom: 0.54rem;
}
.fate-ask-title {
  font-size: 0.92rem;
}
.fate-ask-hint {
  margin-bottom: 0;
  font-size: 0.68rem;
}
.fate-suggestions {
  margin-bottom: 0.6rem;
  gap: 0.34rem;
}
.fate-suggestion {
  max-width: 100%;
  border-radius: 0.68rem;
  padding: 0.28rem 0.54rem;
  font-size: 0.66rem;
}
.fate-ask-input {
  min-height: 88px;
  padding: 0.78rem 0.86rem 0.35rem;
  font-size: 0.84rem;
  line-height: 1.5;
}
.fate-ask-bar {
  padding: 0.28rem 0.55rem 0.55rem 0.78rem;
}
.fate-ask-send {
  min-width: 6.8rem;
  height: 34px;
  font-size: 0.75rem;
}
.fate-cta-hint {
  margin-top: 0.42rem;
  font-size: 0.62rem;
}
.fate-scenario-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.8rem;
  color: rgba(245,233,255,0.9);
  font-size: 0.78rem;
  font-weight: 760;
}
.fate-scenario-head small {
  color: rgba(191,181,211,0.54);
  font-size: 0.64rem;
  font-weight: 500;
}
.fate-scenario-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.48rem;
  margin-bottom: 0;
}
.fate-scenario-card,
.fate-scenario-card--featured {
  grid-column: auto;
  min-height: 66px;
  border-radius: 0.82rem;
  padding: 0.62rem;
}
.fate-scenario-card::after {
  inset: auto 0.62rem 0.48rem;
}
.fate-scenario-card:hover {
  transform: translateY(-1px);
}
.fate-scenario-title {
  font-size: 0.82rem;
}
.fate-scenario-signal {
  padding: 0.12rem 0.34rem;
  font-size: 0.56rem;
}
.fate-scenario-sub {
  max-width: none;
  font-size: 0.64rem;
  line-height: 1.35;
}

@media (min-width: 1440px) and (max-height: 940px) {
  .fate-page--form {
    padding-top: calc(2.55rem + env(safe-area-inset-top, 0px));
  }
  .fate-hero-header {
    margin-bottom: 0.8rem;
    padding-top: 0.2rem;
    padding-bottom: 0.65rem;
  }
  .fate-hero-title {
    font-size: clamp(1.9rem, 3vw, 2.8rem);
  }
  .fate-hero-sub {
    font-size: 0.82rem;
  }
  .fate-center {
    min-height: 430px;
  }
  .fate-orrery-container {
    max-width: 430px;
  }
}

@media (max-width: 720px) {
  .fate-hero-copy {
    display: block;
  }
  .fate-hero-title {
    font-size: clamp(2rem, 13vw, 3rem);
  }
  .fate-hero-sub {
    margin-top: 0.55rem;
  }
  .fate-panel-right {
    display: flex;
  }
  .fate-scenario-head {
    margin-top: 0.2rem;
  }
}

/* ─── 玄幻命盘特效与优雅材质 ─── */
.fate-bg-deep {
  background:
    radial-gradient(ellipse 60% 46% at 52% 10%, rgba(116,86,184,0.24), transparent 62%),
    radial-gradient(ellipse 42% 36% at 50% 58%, rgba(212,175,55,0.08), transparent 60%),
    radial-gradient(ellipse 46% 40% at 10% 80%, rgba(20,97,118,0.14), transparent 66%),
    linear-gradient(180deg, #070411 0%, #03020a 56%, #010104 100%);
}
.fate-bg-stars {
  opacity: 0.72;
  background-image:
    radial-gradient(1.4px 1.4px at 8% 18%, rgba(245,233,255,0.58), transparent),
    radial-gradient(1px 1px at 22% 72%, rgba(95,164,220,0.38), transparent),
    radial-gradient(1.2px 1.2px at 78% 28%, rgba(212,175,55,0.48), transparent),
    radial-gradient(1.5px 1.5px at 88% 80%, rgba(168,136,255,0.38), transparent),
    radial-gradient(1px 1px at 45% 8%, rgba(245,233,255,0.35), transparent),
    radial-gradient(1px 1px at 55% 92%, rgba(212,175,55,0.28), transparent),
    radial-gradient(0.8px 0.8px at 32% 55%, rgba(196,168,255,0.36), transparent),
    radial-gradient(0.8px 0.8px at 68% 15%, rgba(255,255,255,0.24), transparent),
    linear-gradient(110deg, transparent 0 46%, rgba(212,175,55,0.035) 50%, transparent 56% 100%);
}
.fate-panel {
  border-color: rgba(245,233,255,0.11);
  background:
    linear-gradient(150deg, rgba(35,27,45,0.88), rgba(8,6,16,0.86)),
    rgba(255,255,255,0.02);
}
.fate-panel::after {
  content: '';
  position: absolute;
  inset: 1px;
  pointer-events: none;
  border-radius: inherit;
  border: 1px solid rgba(255,255,255,0.035);
}
.fate-hero-title {
  color: #F8F2FF;
  text-shadow:
    0 0 24px rgba(212,175,55,0.16),
    0 12px 36px rgba(0,0,0,0.45);
}
.fate-hero-kicker,
.fate-step--active .fate-step-label,
.fate-panel-title {
  color: #F7E8B4;
}
.fate-center {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  border: 1px solid rgba(245,233,255,0.055);
  background:
    radial-gradient(circle at 50% 47%, rgba(212,175,55,0.105), transparent 31%),
    radial-gradient(circle at 50% 50%, rgba(116,86,184,0.19), transparent 54%),
    radial-gradient(ellipse at 50% 100%, rgba(255,255,255,0.04), transparent 44%);
}
.fate-center::before {
  content: '';
  position: absolute;
  inset: 7% 11%;
  z-index: -1;
  border-radius: 50%;
  background:
    conic-gradient(from 90deg, transparent, rgba(212,175,55,0.11), transparent 22%, rgba(138,92,246,0.14), transparent 46%, rgba(245,233,255,0.08), transparent 72%, rgba(212,175,55,0.1), transparent);
  filter: blur(18px);
  opacity: 0.72;
  animation: fate-nebula-turn 26s linear infinite;
}
.fate-center::after {
  content: '';
  position: absolute;
  inset: 9% 14%;
  z-index: -1;
  border-radius: 50%;
  background: radial-gradient(circle, transparent 55%, rgba(212,175,55,0.12) 56%, transparent 58%);
  opacity: 0.48;
  animation: fate-breathe 5.8s ease-in-out infinite;
}
.fate-orrery-container {
  position: relative;
  z-index: 1;
  filter:
    drop-shadow(0 32px 68px rgba(0,0,0,0.44))
    drop-shadow(0 0 26px rgba(138,92,246,0.16));
}
.fate-orrery {
  transform: perspective(1000px) rotateX(10deg);
}
.fate-grid-svg {
  filter: drop-shadow(0 0 5px rgba(212,175,55,0.12));
}
.fate-stars-svg {
  animation: fate-star-drift 16s ease-in-out infinite alternate;
}
.fate-astral-aura {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 74%;
  height: 74%;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  background:
    radial-gradient(circle, rgba(255,247,215,0.14) 0 8%, transparent 9%),
    radial-gradient(circle, transparent 39%, rgba(212,175,55,0.09) 40%, transparent 42%),
    conic-gradient(from 180deg, transparent, rgba(212,175,55,0.18), transparent 18%, rgba(138,92,246,0.2), transparent 40%, rgba(255,247,215,0.12), transparent 62%, rgba(212,175,55,0.14), transparent);
  filter: blur(1px);
  opacity: 0.72;
  animation: fate-aura-spin 34s linear infinite;
}
.fate-sigil-ring {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 62%;
  height: 62%;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  animation: fate-sigil-spin 42s linear infinite reverse;
}
.fate-sigil-ring::before,
.fate-sigil-ring::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 1px solid rgba(212,175,55,0.16);
  box-shadow: inset 0 0 26px rgba(138,92,246,0.08), 0 0 22px rgba(212,175,55,0.05);
}
.fate-sigil-ring::after {
  inset: 10%;
  border-color: rgba(245,233,255,0.1);
}
.fate-sigil-mark {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 1.45rem;
  height: 1.45rem;
  margin: -0.725rem;
  display: grid;
  place-items: center;
  transform: rotate(calc(var(--i) * 45deg)) translateY(-9.8rem) rotate(calc(var(--i) * -45deg));
  color: rgba(247,232,180,0.46);
  font-family: ui-serif, Georgia, 'Songti SC', serif;
  font-size: 0.72rem;
  text-shadow: 0 0 10px rgba(212,175,55,0.25);
}
.fate-energy-line {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 66%;
  height: 1px;
  transform-origin: center;
  background: linear-gradient(90deg, transparent, rgba(212,175,55,0.36), rgba(245,233,255,0.44), rgba(138,92,246,0.28), transparent);
  opacity: 0.55;
  filter: blur(0.2px);
}
.fate-energy-line--x {
  transform: translate(-50%, -50%) rotate(0deg);
  animation: fate-energy-scan 4.8s ease-in-out infinite;
}
.fate-energy-line--y {
  transform: translate(-50%, -50%) rotate(90deg);
  animation: fate-energy-scan 5.6s ease-in-out infinite reverse;
}
.fate-oracle-mist {
  position: absolute;
  inset: 19%;
  border-radius: 50%;
  background:
    radial-gradient(circle at 40% 45%, rgba(245,233,255,0.14), transparent 16%),
    radial-gradient(circle at 58% 55%, rgba(212,175,55,0.12), transparent 18%),
    radial-gradient(circle at 50% 50%, rgba(138,92,246,0.16), transparent 42%);
  filter: blur(18px);
  mix-blend-mode: screen;
  opacity: 0.55;
  animation: fate-mist-flow 7.5s ease-in-out infinite alternate;
}
.fate-core {
  width: 16%;
  height: 16%;
  background:
    radial-gradient(circle at 38% 33%, #fffbe7 0%, #F5D46A 26%, #A783FF 56%, #3D2075 100%);
  box-shadow:
    0 0 24px rgba(255,247,215,0.42),
    0 0 62px rgba(212,175,55,0.46),
    0 0 112px rgba(138,92,246,0.32);
  animation: fate-core-ritual 4.6s ease-in-out infinite;
}
.fate-core::before {
  content: '';
  position: absolute;
  inset: -42%;
  border-radius: 50%;
  border: 1px solid rgba(245,233,255,0.18);
  background: radial-gradient(circle, rgba(255,255,255,0.12), transparent 52%);
  animation: fate-core-halo 3.8s ease-in-out infinite;
}
.fate-ring {
  width: 54%;
  height: 54%;
  border-width: 1.5px;
  border-color: rgba(247,232,180,0.56);
  box-shadow:
    0 0 20px rgba(212,175,55,0.28),
    0 0 54px rgba(138,92,246,0.22),
    inset 0 0 12px rgba(245,233,255,0.08);
  animation: fate-ring-waver 8s ease-in-out infinite;
}
.fate-ring::after {
  border-color: rgba(138,92,246,0.28);
}
.fate-dot--gold,
.fate-dot--amber {
  box-shadow: 0 0 14px rgba(245,212,106,0.95), 0 0 28px rgba(212,175,55,0.36);
}
.fate-dot--violet,
.fate-dot--violet-sm {
  box-shadow: 0 0 14px rgba(186,160,255,0.9), 0 0 28px rgba(138,92,246,0.36);
}
.fate-dot--blue {
  box-shadow: 0 0 14px rgba(138,180,255,0.9), 0 0 26px rgba(88,166,255,0.28);
}
.fate-pillar {
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border-color: rgba(247,232,180,0.2);
  background:
    radial-gradient(circle at 50% 26%, rgba(247,232,180,0.18), transparent 40%),
    linear-gradient(180deg, rgba(22,16,34,0.88), rgba(5,4,12,0.72));
  box-shadow:
    0 16px 40px -26px rgba(0,0,0,0.92),
    inset 0 1px 0 rgba(255,255,255,0.08),
    0 0 24px rgba(212,175,55,0.08);
}
.fate-pillar-gz {
  color: #FFF2C0;
  text-shadow: 0 0 14px rgba(212,175,55,0.32);
}
.fate-pillar--bl .fate-pillar-gz,
.fate-pillar--br .fate-pillar-gz {
  color: #ECE3FF;
}

@keyframes fate-nebula-turn {
  to { transform: rotate(360deg); }
}
@keyframes fate-breathe {
  0%, 100% { opacity: 0.28; transform: scale(0.98); }
  50% { opacity: 0.62; transform: scale(1.04); }
}
@keyframes fate-aura-spin {
  to { transform: translate(-50%, -50%) rotate(360deg); }
}
@keyframes fate-sigil-spin {
  to { transform: translate(-50%, -50%) rotate(360deg); }
}
@keyframes fate-star-drift {
  0% { transform: translate3d(-3px, 2px, 0) scale(1); opacity: 0.78; }
  100% { transform: translate3d(4px, -3px, 0) scale(1.01); opacity: 1; }
}
@keyframes fate-energy-scan {
  0%, 100% { opacity: 0.18; width: 50%; }
  45%, 55% { opacity: 0.72; width: 72%; }
}
@keyframes fate-mist-flow {
  0% { transform: translate3d(-2%, 1%, 0) scale(0.95); opacity: 0.36; }
  100% { transform: translate3d(2%, -2%, 0) scale(1.08); opacity: 0.62; }
}
@keyframes fate-core-ritual {
  0%, 100% {
    transform: translate(-50%, -50%) scale(1);
    box-shadow:
      0 0 24px rgba(255,247,215,0.42),
      0 0 62px rgba(212,175,55,0.46),
      0 0 112px rgba(138,92,246,0.32);
  }
  50% {
    transform: translate(-50%, -50%) scale(1.08);
    box-shadow:
      0 0 34px rgba(255,247,215,0.58),
      0 0 84px rgba(212,175,55,0.56),
      0 0 142px rgba(138,92,246,0.42);
  }
}
@keyframes fate-core-halo {
  0%, 100% { opacity: 0.18; transform: scale(0.94); }
  50% { opacity: 0.48; transform: scale(1.14); }
}
@keyframes fate-ring-waver {
  0%, 100% { transform: translate(-50%, -50%) rotateX(74deg) rotateZ(-12deg) scale(1); }
  50% { transform: translate(-50%, -50%) rotateX(72deg) rotateZ(-7deg) scale(1.04); }
}

@media (max-width: 720px) {
  .fate-sigil-mark {
    transform: rotate(calc(var(--i) * 45deg)) translateY(-7.2rem) rotate(calc(var(--i) * -45deg));
  }
  .fate-astral-aura {
    width: 78%;
    height: 78%;
  }
}

/* ─── 宽屏沉浸舞台：减少两侧留白，强化命盘主视觉 ─── */
.fate-page--form {
  padding-top: calc(2.45rem + env(safe-area-inset-top, 0px));
}
.fate-dashboard {
  width: min(100%, 1900px);
  max-width: none;
  padding-inline: clamp(1rem, 2.4vw, 3rem);
}
.fate-hero-header {
  margin-bottom: clamp(0.75rem, 1.1vw, 1.35rem);
}
.fate-hero-copy {
  grid-template-columns: minmax(18rem, auto) minmax(20rem, 34rem);
  column-gap: clamp(1.4rem, 3vw, 3.4rem);
}
.fate-hero-title {
  font-size: clamp(2.25rem, 3.1vw, 4rem);
}
.fate-main-grid {
  position: relative;
  gap: clamp(0.9rem, 1.35vw, 1.7rem);
}
.fate-main-grid::before {
  content: '';
  position: absolute;
  inset: 9% 8% 12%;
  z-index: 0;
  pointer-events: none;
  background:
    radial-gradient(ellipse at 50% 50%, rgba(212,175,55,0.12), transparent 34%),
    radial-gradient(ellipse at 50% 46%, rgba(138,92,246,0.18), transparent 58%);
  filter: blur(38px);
  opacity: 0.88;
}
.fate-main-grid > * {
  position: relative;
  z-index: 1;
}
@media (min-width: 1024px) {
  .fate-main-grid {
    grid-template-columns: minmax(260px, 320px) minmax(520px, 1fr) minmax(390px, 460px);
    align-items: stretch;
  }
}
@media (min-width: 1280px) {
  .fate-main-grid {
    grid-template-columns: minmax(290px, 340px) minmax(620px, 1fr) minmax(420px, 500px);
  }
}
@media (min-width: 1600px) {
  .fate-main-grid {
    grid-template-columns: minmax(320px, 380px) minmax(760px, 1fr) minmax(460px, 540px);
  }
}
.fate-panel {
  border-radius: 1.35rem;
}
.fate-center {
  min-height: clamp(510px, 34vw, 660px);
  border-radius: 1.8rem;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.05),
    inset 0 -70px 120px rgba(1,1,6,0.34),
    0 32px 110px -62px rgba(0,0,0,0.95);
}
.fate-center::before {
  inset: 2% 5%;
  opacity: 0.86;
  filter: blur(22px);
}
.fate-center::after {
  inset: 4% 8%;
}
.fate-orrery-container {
  max-width: min(100%, clamp(560px, 42vw, 780px));
  isolation: isolate;
}
.fate-orrery-container::before {
  content: '';
  position: absolute;
  inset: 6% -6% 4%;
  z-index: -1;
  border-radius: 50%;
  background:
    conic-gradient(from 220deg, transparent, rgba(247,232,180,0.16), transparent 18%, rgba(100,181,246,0.11), transparent 40%, rgba(138,92,246,0.18), transparent 72%, rgba(247,232,180,0.12), transparent),
    radial-gradient(circle at 50% 50%, rgba(245,233,255,0.08), transparent 58%);
  filter: blur(20px);
  animation: fate-stage-slow-spin 52s linear infinite;
}
.fate-orrery-container::after {
  content: '';
  position: absolute;
  inset: 17% 2% 11%;
  z-index: -1;
  border-radius: 50%;
  border: 1px solid rgba(247,232,180,0.12);
  box-shadow:
    0 0 34px rgba(212,175,55,0.1),
    inset 0 0 48px rgba(138,92,246,0.08);
}
.fate-orrery {
  inset: 2%;
  transform: perspective(1200px) rotateX(9deg);
}
.fate-stars-svg {
  inset: -8%;
  width: 116%;
  height: 116%;
}
.fate-astral-aura {
  width: 82%;
  height: 82%;
}
.fate-sigil-ring {
  width: 68%;
  height: 68%;
}
.fate-sigil-mark {
  transform: rotate(calc(var(--i) * 45deg)) translateY(clamp(-15.4rem, -13.8vw, -10.8rem)) rotate(calc(var(--i) * -45deg));
}
.fate-energy-line {
  width: 76%;
}
.fate-oracle-mist {
  inset: 14%;
}
.fate-core {
  width: 17%;
  height: 17%;
}
.fate-ring {
  width: 58%;
  height: 58%;
}
.fate-pillar {
  width: clamp(76px, 5.6vw, 96px);
  height: clamp(76px, 5.6vw, 96px);
}
.fate-pillar-label {
  font-size: clamp(0.52rem, 0.48vw, 0.64rem);
}
.fate-pillar-gz {
  font-size: clamp(1.08rem, 1.02vw, 1.42rem);
}
.fate-pillar--tl { top: 3.5%; left: 0.5%; }
.fate-pillar--tr { top: 3.5%; right: 0.5%; }
.fate-pillar--bl { bottom: 8%; left: 0.5%; }
.fate-pillar--br { bottom: 8%; right: 0.5%; }
.fate-chart-tabs {
  margin-top: clamp(0.35rem, 0.8vw, 0.85rem);
}
@keyframes fate-stage-slow-spin {
  to { transform: rotate(360deg); }
}
@media (min-width: 1440px) and (max-height: 940px) {
  .fate-page--form {
    padding-top: calc(2.2rem + env(safe-area-inset-top, 0px));
  }
  .fate-center {
    min-height: clamp(500px, 32vw, 610px);
  }
  .fate-orrery-container {
    max-width: min(100%, clamp(540px, 37vw, 680px));
  }
}
@media (max-width: 1180px) {
  .fate-hero-copy {
    grid-template-columns: auto minmax(0, 1fr);
  }
  .fate-sigil-mark {
    transform: rotate(calc(var(--i) * 45deg)) translateY(-10rem) rotate(calc(var(--i) * -45deg));
  }
}
@media (max-width: 720px) {
  .fate-dashboard {
    padding-inline: 1rem;
  }
  .fate-center {
    min-height: auto;
    border-radius: 1.2rem;
    padding-block: 0.3rem;
  }
  .fate-orrery-container {
    max-width: min(92vw, 430px);
  }
  .fate-sigil-mark {
    transform: rotate(calc(var(--i) * 45deg)) translateY(-7.2rem) rotate(calc(var(--i) * -45deg));
  }
}

/* ═══════ 紫微斗数命盘 ═══════ */
.fate-ziwei {
  width: 100%;
  max-width: min(100%, clamp(560px, 40vw, 720px));
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
.fate-verdict-panel {
  display: grid;
  gap: 1rem;
  border-radius: 1.5rem;
  border: 1px solid rgba(212,175,55,0.25);
  background:
    radial-gradient(circle at 20% 0%, rgba(212,175,55,0.12), transparent 42%),
    linear-gradient(145deg, rgba(18,10,32,0.94), rgba(5,3,14,0.94));
  padding: 1.5rem;
  box-shadow: 0 20px 70px -36px rgba(212,175,55,0.3);
}
@media (min-width: 768px) {
  .fate-verdict-panel {
    grid-template-columns: minmax(220px, 0.8fr) 1.2fr;
    align-items: center;
  }
  .fate-verdict-strip {
    grid-column: 1 / -1;
  }
}
.fate-verdict-kicker,
.fate-collision-label,
.fate-choice-kicker,
.fate-route-label {
  color: rgba(212,175,55,0.62);
  font-size: 0.68rem;
  letter-spacing: 0.14em;
}
.fate-verdict-title {
  margin-top: 0.45rem;
  color: #FFF4CE;
  font-family: ui-serif, Georgia, 'Songti SC', serif;
  font-size: clamp(1.35rem, 3vw, 2.15rem);
  line-height: 1.2;
}
.fate-verdict-text {
  color: rgba(245,233,255,0.92);
  font-size: 1rem;
  line-height: 1.75;
}
.fate-verdict-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
}
.fate-verdict-strip span {
  border-radius: 999px;
  border: 1px solid rgba(167,139,250,0.16);
  background: rgba(167,139,250,0.07);
  color: rgba(226,217,243,0.72);
  padding: 0.28rem 0.68rem;
  font-size: 0.72rem;
  line-height: 1.3;
}
.fate-collision-panel {
  border-radius: 1.25rem;
  border: 1px solid rgba(212,175,55,0.2);
  background:
    linear-gradient(90deg, rgba(212,175,55,0.08), rgba(167,139,250,0.06), transparent);
  padding: 1.4rem;
}
.fate-collision-summary {
  margin-top: 0.5rem;
  color: rgba(229,224,243,0.9);
  font-size: 1rem;
  line-height: 1.7;
}
.fate-route-card {
  min-height: 100%;
  border-radius: 1.25rem;
  padding: 1.4rem;
}
.fate-route-card--stable {
  border: 1px solid rgba(148,163,184,0.28);
  background:
    radial-gradient(circle at 10% 0%, rgba(148,163,184,0.1), transparent 38%),
    rgba(15,23,42,0.5);
}
.fate-route-card--adventure {
  border: 1px solid rgba(232,121,249,0.3);
  background:
    radial-gradient(circle at 10% 0%, rgba(232,121,249,0.12), transparent 38%),
    rgba(74,4,78,0.28);
}
.fate-route-sub {
  margin-bottom: 0.9rem;
  color: rgba(148,163,184,0.78);
  font-size: 0.78rem;
  line-height: 1.55;
}
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

.fate-choice-panel {
  display: grid;
  gap: 1rem;
  border-radius: 1.4rem;
  border: 1px solid rgba(255,255,255,0.1);
  background: rgba(255,255,255,0.025);
  padding: 1.25rem;
}
@media (min-width: 768px) {
  .fate-choice-panel {
    grid-template-columns: 0.9fr 1.3fr;
    align-items: center;
  }
}
.fate-choice-panel h3 {
  margin-top: 0.35rem;
  color: #F5E9FF;
  font-family: ui-serif, Georgia, 'Songti SC', serif;
  font-size: 1.18rem;
}
.fate-choice-actions {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.8rem;
}
@media (min-width: 640px) {
  .fate-choice-actions { grid-template-columns: 1fr 1fr; }
}
.fate-choice-btn {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.28rem;
  border-radius: 1rem;
  padding: 1rem;
  text-align: left;
  transition: transform 0.18s, border-color 0.18s, background 0.18s;
}
.fate-choice-btn:hover {
  transform: translateY(-2px);
}
.fate-choice-btn span {
  color: #fff;
  font-weight: 700;
}
.fate-choice-btn small {
  color: rgba(226,217,243,0.72);
  font-size: 0.74rem;
}
.fate-choice-btn--stable {
  border: 1px solid rgba(148,163,184,0.34);
  background: rgba(30,41,59,0.62);
}
.fate-choice-btn--stable:hover {
  border-color: rgba(203,213,225,0.58);
  background: rgba(51,65,85,0.68);
}
.fate-choice-btn--adventure {
  border: 1px solid rgba(232,121,249,0.42);
  background: rgba(112,26,117,0.38);
}
.fate-choice-btn--adventure:hover {
  border-color: rgba(245,208,254,0.62);
  background: rgba(134,25,143,0.48);
}
.fate-seal-header {
  text-align: center;
}
.fate-seal-header--result {
  max-width: 720px;
  margin: 0 auto;
}
.fate-seal-header--result h3 {
  margin: 0;
  color: #f7f2ff;
  font-family: ui-serif, Georgia, 'Songti SC', serif;
  font-size: clamp(1.9rem, 4vw, 3.4rem);
  font-weight: 600;
  letter-spacing: 0;
  text-shadow:
    0 0 22px rgba(196,181,253,0.28),
    0 0 50px rgba(139,92,246,0.2);
}
.fate-seal-sub {
  margin-top: 0.55rem;
  color: rgba(138,126,159,0.82);
  font-size: 0.86rem;
}
.fate-result-wrap {
  max-width: min(1180px, calc(100vw - 2rem));
  margin: 0 auto;
  display: grid;
  gap: 1.2rem;
}
.fate-result-kicker,
.fate-card-label,
.fate-guidance-label {
  margin: 0;
  color: rgba(196,181,253,0.76);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}
.fate-guidance-hero {
  position: relative;
  display: grid;
  grid-template-columns: minmax(180px, 0.45fr) minmax(0, 1fr);
  gap: clamp(1.2rem, 4vw, 3rem);
  align-items: center;
  min-height: 300px;
  overflow: hidden;
  border: 1px solid rgba(232,231,255,0.13);
  border-radius: 1.35rem;
  background:
    radial-gradient(circle at 22% 45%, rgba(245,243,255,0.12), transparent 25%),
    radial-gradient(circle at 42% 38%, rgba(139,92,246,0.2), transparent 42%),
    linear-gradient(135deg, rgba(14,9,32,0.96), rgba(36,17,76,0.78));
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.08),
    0 24px 70px rgba(0,0,0,0.28),
    0 0 62px rgba(139,92,246,0.08);
  padding: clamp(1.2rem, 3.4vw, 2.3rem);
}
.fate-guidance-hero::before {
  content: '';
  position: absolute;
  inset: -1px;
  background:
    linear-gradient(110deg, transparent 0 36%, rgba(245,243,255,0.1) 47%, transparent 58% 100%),
    radial-gradient(circle at 86% 14%, rgba(232,231,255,0.12), transparent 22%);
  pointer-events: none;
}
.fate-guidance-orb {
  position: relative;
  width: min(230px, 52vw);
  aspect-ratio: 1;
  justify-self: center;
  border-radius: 50%;
  filter:
    drop-shadow(0 22px 34px rgba(0,0,0,0.36))
    drop-shadow(0 0 34px rgba(167,139,250,0.34));
}
.fate-guidance-core {
  position: absolute;
  inset: 27%;
  border-radius: 50%;
  border: 1px solid rgba(245,243,255,0.48);
  background:
    radial-gradient(circle at 30% 22%, rgba(255,255,255,0.96) 0 7%, rgba(245,243,255,0.34) 11% 20%, transparent 30%),
    radial-gradient(circle at 70% 76%, rgba(196,181,253,0.62), transparent 28%),
    radial-gradient(circle at 48% 45%, rgba(124,58,237,0.86), rgba(44,22,96,0.96) 58%, rgba(8,5,22,1) 100%);
  box-shadow:
    inset 12px 14px 26px rgba(255,255,255,0.24),
    inset -18px -22px 34px rgba(6,3,18,0.86),
    0 0 28px rgba(245,243,255,0.45),
    0 0 88px rgba(139,92,246,0.58);
  animation: fate-result-core 5.8s ease-in-out infinite;
}
.fate-guidance-core::before,
.fate-guidance-core::after {
  content: '';
  position: absolute;
  border-radius: inherit;
  pointer-events: none;
}
.fate-guidance-core::before {
  inset: 10%;
  border: 1px solid rgba(245,243,255,0.23);
  background:
    linear-gradient(0deg, transparent 45%, rgba(245,243,255,0.24) 49%, transparent 53%),
    linear-gradient(90deg, transparent 45%, rgba(196,181,253,0.2) 50%, transparent 54%),
    radial-gradient(circle, transparent 36%, rgba(245,243,255,0.16) 39%, transparent 42%, transparent 61%, rgba(167,139,250,0.14) 64%, transparent 67%);
  transform: rotateX(64deg) rotateZ(-12deg);
  animation: fate-result-lines 13s linear infinite;
}
.fate-guidance-core::after {
  inset: 9% 13% auto 20%;
  height: 30%;
  background: linear-gradient(135deg, rgba(255,255,255,0.72), rgba(255,255,255,0.13) 55%, transparent 76%);
  filter: blur(1px);
  transform: rotate(-22deg);
}
.fate-guidance-ring {
  position: absolute;
  inset: 13%;
  border-radius: 50%;
  border: 1px solid rgba(245,243,255,0.22);
  box-shadow:
    inset 0 0 26px rgba(167,139,250,0.12),
    0 0 28px rgba(245,243,255,0.1);
}
.fate-guidance-ring--one {
  transform: rotateX(68deg) rotateZ(-24deg);
  animation: fate-result-ring-one 9s ease-in-out infinite;
}
.fate-guidance-ring--two {
  inset: 5%;
  border-style: dashed;
  border-color: rgba(196,181,253,0.2);
  transform: rotateX(74deg) rotateZ(54deg);
  animation: fate-result-ring-two 18s linear infinite;
}
.fate-guidance-rune {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 1.25rem;
  height: 1.25rem;
  margin: -0.625rem;
  display: grid;
  place-items: center;
  color: rgba(245,243,255,0.74);
  font-family: ui-serif, Georgia, 'Songti SC', serif;
  font-size: 0.8rem;
  text-shadow: 0 0 12px rgba(245,243,255,0.56), 0 0 24px rgba(139,92,246,0.52);
  transform: rotate(calc(var(--i) * 90deg)) translateY(-42%) rotate(calc(var(--i) * -90deg));
  animation: fate-result-rune 4.8s ease-in-out infinite;
  animation-delay: calc(var(--i) * -0.45s);
}
.fate-guidance-copy {
  position: relative;
  z-index: 1;
}
.fate-guidance-copy h4 {
  margin: 0.45rem 0 0.75rem;
  color: #f7f2ff;
  font-family: ui-serif, Georgia, 'Songti SC', serif;
  font-size: clamp(1.45rem, 3vw, 2.55rem);
  font-weight: 600;
  letter-spacing: 0;
}
.fate-guidance-copy > p:last-of-type {
  max-width: 720px;
  color: rgba(232,231,255,0.88);
  font-size: clamp(0.98rem, 1.8vw, 1.16rem);
  line-height: 1.85;
}
.fate-guidance-mantra {
  display: inline-flex;
  align-items: center;
  margin-top: 1rem;
  border: 1px solid rgba(245,243,255,0.2);
  border-radius: 999px;
  background: rgba(245,243,255,0.08);
  padding: 0.58rem 0.9rem;
  color: #f5f3ff;
  font-size: 0.86rem;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.1);
}
.fate-guidance-grid,
.fate-risk-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.18fr) minmax(280px, 0.82fr);
  gap: 1rem;
}
.fate-guidance-card,
.fate-plan-panel,
.fate-risk-card {
  border: 1px solid rgba(232,231,255,0.12);
  border-radius: 1.15rem;
  background:
    radial-gradient(circle at 12% 0%, rgba(196,181,253,0.1), transparent 38%),
    rgba(10,7,24,0.72);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.06);
  padding: 1.2rem;
}
.fate-guidance-card--shadow {
  background:
    radial-gradient(circle at 90% 12%, rgba(148,163,184,0.12), transparent 34%),
    rgba(8,7,18,0.72);
}
.fate-guidance-card--shadow > p:last-child {
  margin-top: 0.85rem;
  color: rgba(226,232,240,0.82);
  font-size: 0.94rem;
  line-height: 1.8;
}
.fate-guidance-list {
  margin: 0.9rem 0 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 0.72rem;
}
.fate-guidance-list li {
  position: relative;
  color: rgba(226,217,243,0.86);
  font-size: 0.92rem;
  line-height: 1.65;
}
.fate-guidance-list:not(.fate-guidance-list--numbered) li {
  padding-left: 1rem;
}
.fate-guidance-list:not(.fate-guidance-list--numbered) li::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0.78em;
  width: 0.34rem;
  height: 0.34rem;
  border-radius: 50%;
  background: rgba(196,181,253,0.72);
  box-shadow: 0 0 10px rgba(196,181,253,0.5);
}
.fate-guidance-list--numbered li {
  display: grid;
  grid-template-columns: 2rem minmax(0, 1fr);
  gap: 0.75rem;
  align-items: start;
}
.fate-guidance-list--numbered span {
  display: grid;
  place-items: center;
  width: 2rem;
  height: 2rem;
  border: 1px solid rgba(245,243,255,0.2);
  border-radius: 50%;
  background: rgba(245,243,255,0.07);
  color: #f5f3ff;
  font-size: 0.78rem;
  font-variant-numeric: tabular-nums;
}
.fate-guidance-list--numbered p {
  margin: 0;
}
.fate-plan-panel {
  padding: 1.25rem;
}
.fate-plan-head {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: end;
  margin-bottom: 1rem;
}
.fate-plan-head h4 {
  margin: 0;
  color: #f7f2ff;
  font-size: 1.05rem;
  font-weight: 650;
}
.fate-plan-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.85rem;
}
.fate-plan-card {
  position: relative;
  overflow: hidden;
  min-height: 210px;
  border: 1px solid rgba(245,243,255,0.12);
  border-radius: 1rem;
  background:
    linear-gradient(180deg, rgba(245,243,255,0.07), rgba(245,243,255,0.025)),
    rgba(255,255,255,0.03);
  padding: 1rem;
}
.fate-plan-card::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 50% 0%, rgba(167,139,250,0.13), transparent 44%);
  pointer-events: none;
}
.fate-plan-badge {
  position: relative;
  display: inline-flex;
  border: 1px solid rgba(196,181,253,0.22);
  border-radius: 999px;
  background: rgba(124,58,237,0.14);
  padding: 0.35rem 0.64rem;
  color: #f5f3ff;
  font-size: 0.76rem;
  font-weight: 700;
}
.fate-plan-sub {
  position: relative;
  margin: 0.85rem 0 0.7rem;
  color: rgba(196,181,253,0.72);
  font-size: 0.8rem;
}
.fate-plan-card ul {
  position: relative;
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 0.58rem;
}
.fate-plan-card li {
  color: rgba(226,232,240,0.86);
  font-size: 0.88rem;
  line-height: 1.62;
}
.fate-risk-card--risk {
  border-color: rgba(251,191,36,0.16);
  background:
    radial-gradient(circle at 12% 0%, rgba(251,191,36,0.11), transparent 38%),
    rgba(16,10,24,0.74);
}
.fate-risk-card--signal {
  border-color: rgba(196,181,253,0.18);
}
.fate-final-card {
  border-radius: 1.35rem;
  border: 1px solid rgba(232,231,255,0.14);
  background:
    radial-gradient(circle at 15% 0%, rgba(196,181,253,0.12), transparent 42%),
    linear-gradient(145deg, rgba(20,16,24,0.9), rgba(46,16,101,0.2));
  padding: 1.35rem;
}
.fate-final-opening {
  margin: 0.85rem 0 1.05rem;
  border-left: 3px solid rgba(196,181,253,0.62);
  padding-left: 1rem;
  color: #f5f3ff;
  font-family: ui-serif, Georgia, 'Songti SC', serif;
  font-size: 1.08rem;
  line-height: 1.75;
}
.fate-final-para {
  margin-bottom: 0.85rem;
  color: rgba(226,232,240,0.84);
  font-size: 0.95rem;
  line-height: 1.8;
}
.fate-result-actions {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0.75rem;
}
.fate-result-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2.8rem;
  border-radius: 999px;
  padding: 0.75rem 1.35rem;
  font-size: 0.9rem;
  transition: transform 0.18s ease, border-color 0.18s ease, background 0.18s ease;
}
.fate-result-action:hover {
  transform: translateY(-1px);
}
.fate-result-action--primary {
  border: 1px solid rgba(196,181,253,0.34);
  background: linear-gradient(135deg, rgba(167,139,250,0.34), rgba(88,28,135,0.4));
  color: #fff;
}
.fate-result-action--ghost {
  border: 1px solid rgba(255,255,255,0.12);
  color: rgba(226,232,240,0.78);
}
.fate-result-action--ghost:hover {
  border-color: rgba(196,181,253,0.3);
  background: rgba(196,181,253,0.06);
}
@media (max-width: 900px) {
  .fate-guidance-hero,
  .fate-guidance-grid,
  .fate-risk-grid,
  .fate-plan-grid {
    grid-template-columns: 1fr;
  }
  .fate-guidance-hero {
    min-height: 0;
  }
  .fate-guidance-orb {
    width: min(190px, 58vw);
  }
  .fate-plan-head {
    display: block;
  }
  .fate-plan-head h4 {
    margin-top: 0.45rem;
  }
}
@keyframes fate-result-core {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-5px) scale(1.035); }
}
@keyframes fate-result-lines {
  to { transform: rotateX(64deg) rotateZ(348deg); }
}
@keyframes fate-result-ring-one {
  0%, 100% { transform: rotateX(68deg) rotateZ(-24deg) scale(1); opacity: 0.72; }
  50% { transform: rotateX(70deg) rotateZ(-8deg) scale(1.06); opacity: 0.95; }
}
@keyframes fate-result-ring-two {
  to { transform: rotateX(74deg) rotateZ(414deg); }
}
@keyframes fate-result-rune {
  0%, 100% { opacity: 0.48; filter: blur(0.2px); }
  50% { opacity: 0.95; filter: blur(0); }
}

/* ─── 首页命盘终版配色：深紫为底，银色微光点亮 ─── */
.fate-page--form .fate-bg-deep {
  background:
    radial-gradient(ellipse 62% 48% at 50% 10%, rgba(88,54,168,0.28), transparent 62%),
    radial-gradient(ellipse 44% 36% at 50% 58%, rgba(232,231,255,0.07), transparent 60%),
    radial-gradient(ellipse 46% 40% at 8% 78%, rgba(72,61,139,0.16), transparent 66%),
    linear-gradient(180deg, #070415 0%, #03020b 58%, #010104 100%);
}
.fate-page--form .fate-bg-stars {
  background-image:
    radial-gradient(1.4px 1.4px at 8% 18%, rgba(232,231,255,0.62), transparent),
    radial-gradient(1px 1px at 22% 72%, rgba(167,139,250,0.4), transparent),
    radial-gradient(1.2px 1.2px at 78% 28%, rgba(245,243,255,0.48), transparent),
    radial-gradient(1.5px 1.5px at 88% 80%, rgba(139,92,246,0.42), transparent),
    radial-gradient(1px 1px at 45% 8%, rgba(232,231,255,0.36), transparent),
    radial-gradient(1px 1px at 55% 92%, rgba(196,181,253,0.3), transparent),
    radial-gradient(0.8px 0.8px at 32% 55%, rgba(221,214,254,0.38), transparent),
    radial-gradient(0.8px 0.8px at 68% 15%, rgba(255,255,255,0.28), transparent),
    linear-gradient(110deg, transparent 0 46%, rgba(232,231,255,0.03) 50%, transparent 56% 100%);
}
.fate-page--form .fate-center {
  border-color: rgba(232,231,255,0.08);
  background:
    radial-gradient(circle at 50% 46%, rgba(232,231,255,0.08), transparent 28%),
    radial-gradient(circle at 50% 48%, rgba(124,58,237,0.22), transparent 55%),
    radial-gradient(ellipse at 50% 100%, rgba(188,180,255,0.055), transparent 44%),
    linear-gradient(180deg, rgba(7,4,18,0.12), rgba(2,1,8,0.34));
}
.fate-page--form .fate-center::before {
  background:
    conic-gradient(from 90deg, transparent, rgba(232,231,255,0.13), transparent 22%, rgba(139,92,246,0.24), transparent 46%, rgba(221,214,254,0.1), transparent 72%, rgba(99,102,241,0.16), transparent);
}
.fate-page--form .fate-center::after {
  background: radial-gradient(circle, transparent 54%, rgba(232,231,255,0.16) 56%, transparent 58%);
}
.fate-page--form .fate-main-grid::before {
  background:
    radial-gradient(ellipse at 50% 50%, rgba(232,231,255,0.08), transparent 34%),
    radial-gradient(ellipse at 50% 46%, rgba(124,58,237,0.22), transparent 58%);
}
.fate-page--form .fate-orrery-container {
  filter:
    drop-shadow(0 34px 70px rgba(0,0,0,0.46))
    drop-shadow(0 0 34px rgba(139,92,246,0.22));
}
.fate-page--form .fate-orrery-container::before {
  background:
    conic-gradient(from 220deg, transparent, rgba(232,231,255,0.18), transparent 18%, rgba(139,92,246,0.18), transparent 42%, rgba(99,102,241,0.18), transparent 70%, rgba(232,231,255,0.12), transparent),
    radial-gradient(circle at 50% 50%, rgba(232,231,255,0.08), transparent 58%);
}
.fate-page--form .fate-orrery-container::after {
  border-color: rgba(232,231,255,0.16);
  box-shadow:
    0 0 36px rgba(232,231,255,0.09),
    inset 0 0 52px rgba(139,92,246,0.1);
}
.fate-page--form .fate-grid-svg {
  filter: drop-shadow(0 0 7px rgba(232,231,255,0.14));
}
.fate-page--form .fate-astral-aura {
  background:
    radial-gradient(circle, rgba(245,243,255,0.15) 0 8%, transparent 9%),
    radial-gradient(circle, transparent 39%, rgba(232,231,255,0.1) 40%, transparent 42%),
    conic-gradient(from 180deg, transparent, rgba(232,231,255,0.18), transparent 18%, rgba(139,92,246,0.26), transparent 42%, rgba(199,210,254,0.14), transparent 62%, rgba(99,102,241,0.18), transparent);
}
.fate-page--form .fate-sigil-ring::before,
.fate-page--form .fate-sigil-ring::after {
  border-color: rgba(232,231,255,0.18);
  box-shadow: inset 0 0 28px rgba(139,92,246,0.12), 0 0 24px rgba(232,231,255,0.06);
}
.fate-page--form .fate-sigil-ring::after {
  border-color: rgba(196,181,253,0.16);
}
.fate-page--form .fate-sigil-mark {
  color: rgba(232,231,255,0.56);
  text-shadow: 0 0 12px rgba(167,139,250,0.34);
}
.fate-page--form .fate-energy-line {
  background: linear-gradient(90deg, transparent, rgba(167,139,250,0.36), rgba(245,243,255,0.52), rgba(99,102,241,0.32), transparent);
}
.fate-page--form .fate-oracle-mist {
  background:
    radial-gradient(circle at 40% 45%, rgba(245,243,255,0.16), transparent 16%),
    radial-gradient(circle at 58% 55%, rgba(167,139,250,0.14), transparent 18%),
    radial-gradient(circle at 50% 50%, rgba(124,58,237,0.2), transparent 42%);
}
.fate-crystal-field {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 32%;
  height: 32%;
  transform: translate(-50%, -50%);
  transform-style: preserve-3d;
  pointer-events: none;
  z-index: 4;
}
.fate-crystal-field::before {
  content: '';
  position: absolute;
  inset: -18%;
  border-radius: 50%;
  background:
    radial-gradient(circle at 50% 44%, rgba(245,243,255,0.28), transparent 26%),
    radial-gradient(circle at 50% 50%, rgba(124,58,237,0.22), transparent 58%);
  filter: blur(13px);
  opacity: 0.78;
  animation: fate-crystal-field-pulse 5.2s ease-in-out infinite;
}
.fate-crystal-field::after {
  content: '';
  position: absolute;
  left: 14%;
  right: 14%;
  bottom: -17%;
  height: 18%;
  border-radius: 50%;
  background: radial-gradient(ellipse, rgba(10,3,24,0.88), rgba(80,46,160,0.24) 46%, transparent 72%);
  filter: blur(8px);
  opacity: 0.78;
}
.fate-crystal-orbit {
  position: absolute;
  inset: 6%;
  border-radius: 50%;
  border: 1px solid rgba(245,243,255,0.2);
  box-shadow:
    0 0 16px rgba(167,139,250,0.18),
    inset 0 0 12px rgba(245,243,255,0.06);
}
.fate-crystal-orbit--one {
  transform: rotateX(68deg) rotateZ(-18deg);
  animation: fate-crystal-orbit-one 10s ease-in-out infinite;
}
.fate-crystal-orbit--two {
  inset: 13%;
  border-color: rgba(167,139,250,0.24);
  transform: rotateX(76deg) rotateZ(66deg);
  animation: fate-crystal-orbit-two 13s linear infinite;
}
.fate-crystal-orbit--three {
  inset: -4%;
  border-color: rgba(232,231,255,0.12);
  border-style: dashed;
  transform: rotateX(62deg) rotateZ(122deg);
  animation: fate-crystal-orbit-three 18s linear infinite reverse;
}
.fate-crystal-rune {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 1rem;
  height: 1rem;
  margin: -0.5rem;
  display: grid;
  place-items: center;
  transform: rotate(calc(var(--r) * 45deg)) translateY(-58%) rotate(calc(var(--r) * -45deg));
  color: rgba(245,243,255,0.66);
  font-family: ui-serif, Georgia, serif;
  font-size: clamp(0.48rem, 0.56vw, 0.76rem);
  text-shadow:
    0 0 8px rgba(245,243,255,0.58),
    0 0 18px rgba(139,92,246,0.5);
  opacity: 0.8;
  animation: fate-crystal-rune-float 4.8s ease-in-out infinite;
  animation-delay: calc(var(--r) * -0.42s);
}
.fate-page--form .fate-core {
  background:
    radial-gradient(circle at 36% 30%, #ffffff 0%, #e8e7ff 18%, #a78bfa 45%, #6d28d9 70%, #1e123f 100%);
  box-shadow:
    0 0 26px rgba(245,243,255,0.48),
    0 0 72px rgba(139,92,246,0.5),
    0 0 124px rgba(99,102,241,0.32);
}
.fate-page--form .fate-core::before {
  border-color: rgba(232,231,255,0.22);
  background: radial-gradient(circle, rgba(245,243,255,0.16), transparent 52%);
}
.fate-page--form .fate-crystal-core {
  overflow: hidden;
  z-index: 6;
  width: 23%;
  height: 23%;
  border: 1px solid rgba(245,243,255,0.42);
  background:
    radial-gradient(circle at 29% 21%, rgba(255,255,255,0.98) 0 5%, rgba(245,243,255,0.38) 7% 15%, transparent 25%),
    radial-gradient(circle at 72% 74%, rgba(139,92,246,0.72), transparent 34%),
    radial-gradient(circle at 38% 50%, rgba(221,214,254,0.4), transparent 30%),
    radial-gradient(circle at 53% 45%, rgba(122,87,224,0.82), rgba(53,31,112,0.9) 54%, rgba(13,7,36,0.98) 100%);
  box-shadow:
    inset 14px 16px 26px rgba(255,255,255,0.27),
    inset -18px -22px 32px rgba(8,4,24,0.88),
    inset -3px 4px 10px rgba(196,181,253,0.22),
    inset 0 0 26px rgba(196,181,253,0.2),
    0 16px 28px rgba(5,2,14,0.48),
    0 0 34px rgba(245,243,255,0.56),
    0 0 86px rgba(139,92,246,0.62),
    0 0 144px rgba(99,102,241,0.38);
  transform: translate(-50%, -50%) translateZ(22px);
  animation: fate-crystal-float 5.8s ease-in-out infinite;
}
.fate-page--form .fate-crystal-core::before {
  inset: -42%;
  border-color: rgba(232,231,255,0.28);
  background:
    radial-gradient(circle at 50% 50%, rgba(245,243,255,0.2), transparent 44%),
    conic-gradient(from 120deg, transparent, rgba(232,231,255,0.28), transparent 22%, rgba(139,92,246,0.18), transparent 62%, rgba(245,243,255,0.2), transparent);
  animation: fate-core-halo 3.8s ease-in-out infinite;
}
.fate-page--form .fate-crystal-core::after {
  content: '';
  position: absolute;
  inset: 7% 12% auto 20%;
  height: 30%;
  border-radius: 999px 999px 60% 60%;
  background: linear-gradient(135deg, rgba(255,255,255,0.72), rgba(255,255,255,0.16) 48%, transparent 72%);
  filter: blur(1px);
  opacity: 0.78;
  transform: rotate(-22deg);
  pointer-events: none;
}
.fate-page--form .fate-crystal-backglow {
  position: absolute;
  inset: -24%;
  border-radius: 50%;
  background:
    radial-gradient(circle at 50% 48%, rgba(245,243,255,0.22), transparent 32%),
    radial-gradient(circle at 50% 50%, rgba(139,92,246,0.38), transparent 66%);
  filter: blur(10px);
  opacity: 0.82;
  animation: fate-crystal-backglow 4.8s ease-in-out infinite;
}
.fate-crystal-depth,
.fate-crystal-mist,
.fate-crystal-sigils,
.fate-crystal-lines,
.fate-crystal-facet,
.fate-crystal-shine {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
}
.fate-crystal-depth {
  background:
    radial-gradient(ellipse at 48% 78%, rgba(255,255,255,0.14), transparent 21%),
    radial-gradient(ellipse at 50% 88%, rgba(0,0,0,0.6), transparent 42%),
    linear-gradient(115deg, transparent 0 39%, rgba(255,255,255,0.11) 44%, transparent 54% 100%),
    linear-gradient(22deg, transparent 0 48%, rgba(167,139,250,0.16) 52%, transparent 61% 100%);
  mix-blend-mode: screen;
  opacity: 0.86;
}
.fate-crystal-mist {
  inset: 10%;
  background:
    radial-gradient(circle at 34% 42%, rgba(255,255,255,0.32), transparent 18%),
    radial-gradient(circle at 66% 58%, rgba(167,139,250,0.4), transparent 23%),
    radial-gradient(circle at 52% 48%, rgba(59,7,100,0.44), transparent 48%);
  filter: blur(8px);
  mix-blend-mode: screen;
  opacity: 0.8;
  animation: fate-crystal-mist 6.4s ease-in-out infinite alternate;
}
.fate-crystal-lines {
  inset: 11%;
  border: 1px solid rgba(245,243,255,0.26);
  background:
    linear-gradient(0deg, transparent 46%, rgba(245,243,255,0.24) 49%, transparent 52%),
    linear-gradient(90deg, transparent 47%, rgba(196,181,253,0.2) 50%, transparent 53%),
    radial-gradient(ellipse at 50% 50%, transparent 30%, rgba(245,243,255,0.16) 33%, transparent 36%, transparent 53%, rgba(167,139,250,0.14) 56%, transparent 59%, transparent 70%, rgba(232,231,255,0.12) 73%, transparent 76%);
  box-shadow: inset 0 0 18px rgba(245,243,255,0.08);
  opacity: 0.8;
  transform: rotateX(62deg) rotateZ(-12deg);
  animation: fate-crystal-lines 12s linear infinite;
}
.fate-crystal-sigils {
  animation: fate-crystal-sigils 18s linear infinite;
}
.fate-crystal-sigils span {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 1rem;
  height: 1rem;
  margin: -0.5rem;
  display: grid;
  place-items: center;
  transform: rotate(calc(var(--g) * 45deg)) translateY(-37%) rotate(calc(var(--g) * -45deg));
  color: rgba(245,243,255,0.78);
  font-family: ui-serif, Georgia, serif;
  font-size: clamp(0.44rem, 0.58vw, 0.74rem);
  text-shadow: 0 0 8px rgba(221,214,254,0.72);
  opacity: 0.82;
}
.fate-crystal-facet--one {
  inset: 20% 18% 45% 42%;
  border-radius: 38% 62% 42% 58%;
  background: linear-gradient(130deg, rgba(255,255,255,0.32), transparent 58%);
  filter: blur(0.6px);
  opacity: 0.58;
  transform: rotate(24deg);
}
.fate-crystal-facet--two {
  inset: 50% 48% 16% 18%;
  border-radius: 58% 42% 62% 38%;
  background: linear-gradient(135deg, rgba(196,181,253,0.24), transparent 60%);
  filter: blur(0.7px);
  opacity: 0.5;
  transform: rotate(-18deg);
}
.fate-crystal-shine {
  background:
    linear-gradient(130deg, transparent 0 27%, rgba(255,255,255,0.28) 36%, transparent 49% 100%),
    radial-gradient(circle at 24% 20%, rgba(255,255,255,0.82), transparent 9%),
    radial-gradient(circle at 70% 28%, rgba(221,214,254,0.28), transparent 10%),
    radial-gradient(circle at 42% 12%, rgba(255,255,255,0.28), transparent 6%);
  mix-blend-mode: screen;
  opacity: 0.84;
  animation: fate-crystal-shine 4.8s ease-in-out infinite;
}
.fate-page--form .fate-ring {
  border-color: rgba(232,231,255,0.58);
  box-shadow:
    0 0 24px rgba(232,231,255,0.24),
    0 0 62px rgba(139,92,246,0.28),
    inset 0 0 14px rgba(245,243,255,0.1);
}
.fate-page--form .fate-ring::after {
  border-color: rgba(167,139,250,0.36);
}
.fate-page--form .fate-dot--gold,
.fate-page--form .fate-dot--amber,
.fate-page--form .fate-dot--pale {
  background: #f5f3ff;
  box-shadow: 0 0 16px rgba(245,243,255,0.95), 0 0 30px rgba(167,139,250,0.34);
}
.fate-page--form .fate-dot--violet,
.fate-page--form .fate-dot--violet-sm,
.fate-page--form .fate-dot--blue,
.fate-page--form .fate-dot--mini-blue,
.fate-page--form .fate-dot--mini-gold {
  background: #a78bfa;
  box-shadow: 0 0 15px rgba(196,181,253,0.92), 0 0 30px rgba(124,58,237,0.38);
}
.fate-page--form .fate-pillar {
  border-color: rgba(232,231,255,0.2);
  background:
    radial-gradient(circle at 50% 26%, rgba(232,231,255,0.13), transparent 42%),
    linear-gradient(180deg, rgba(24,17,48,0.9), rgba(5,4,14,0.74));
  box-shadow:
    0 16px 40px -26px rgba(0,0,0,0.92),
    inset 0 1px 0 rgba(255,255,255,0.09),
    0 0 26px rgba(139,92,246,0.1);
}
.fate-page--form .fate-pillar-label {
  color: rgba(196,181,253,0.72);
}
.fate-page--form .fate-pillar-gz,
.fate-page--form .fate-pillar--bl .fate-pillar-gz,
.fate-page--form .fate-pillar--br .fate-pillar-gz {
  color: #f4f2ff;
  text-shadow: 0 0 16px rgba(167,139,250,0.4);
}
@keyframes fate-crystal-field-pulse {
  0%, 100% { opacity: 0.55; transform: scale(0.92); }
  50% { opacity: 0.9; transform: scale(1.08); }
}
@keyframes fate-crystal-orbit-one {
  0%, 100% { transform: rotateX(68deg) rotateZ(-18deg) scale(1); opacity: 0.72; }
  50% { transform: rotateX(70deg) rotateZ(-6deg) scale(1.07); opacity: 0.92; }
}
@keyframes fate-crystal-orbit-two {
  to { transform: rotateX(76deg) rotateZ(426deg); }
}
@keyframes fate-crystal-orbit-three {
  to { transform: rotateX(62deg) rotateZ(482deg); }
}
@keyframes fate-crystal-rune-float {
  0%, 100% { opacity: 0.48; filter: blur(0.2px); }
  50% { opacity: 0.95; filter: blur(0); }
}
@keyframes fate-crystal-float {
  0%, 100% { transform: translate(-50%, -50%) translateZ(22px) scale(1); }
  50% { transform: translate(-50%, calc(-50% - 4px)) translateZ(32px) scale(1.035); }
}
@keyframes fate-crystal-backglow {
  0%, 100% { opacity: 0.58; transform: scale(0.95); }
  50% { opacity: 0.95; transform: scale(1.08); }
}
@keyframes fate-crystal-mist {
  0% { transform: translate3d(-4%, 2%, 0) scale(0.9); opacity: 0.52; }
  100% { transform: translate3d(4%, -3%, 0) scale(1.12); opacity: 0.82; }
}
@keyframes fate-crystal-lines {
  to { transform: rotateX(62deg) rotateZ(348deg); }
}
@keyframes fate-crystal-sigils {
  to { transform: rotate(360deg); }
}
@keyframes fate-crystal-shine {
  0%, 100% { opacity: 0.48; transform: translateX(-4%) rotate(0deg); }
  50% { opacity: 0.86; transform: translateX(5%) rotate(4deg); }
}

/* ─── Reduced motion ─── */
@media (prefers-reduced-motion: reduce) {
  .fate-five-fill, .fate-cmp-fill { transition: none !important; }
  .fate-core, .fate-orb--1, .fate-orb--2, .fate-orb--3, .fate-orb--4, .fate-orb--5, .fate-orb--6,
  .fate-dashboard--entered, .fate-center::before, .fate-center::after, .fate-astral-aura,
  .fate-sigil-ring, .fate-stars-svg, .fate-energy-line, .fate-oracle-mist,
  .fate-core::before, .fate-ring, .fate-orrery-container::before, .fate-crystal-mist,
  .fate-crystal-lines, .fate-crystal-sigils, .fate-crystal-shine, .fate-crystal-core,
  .fate-crystal-field::before, .fate-crystal-orbit, .fate-crystal-rune,
  .fate-crystal-backglow { animation: none !important; }
  .fate-dashboard--entered { opacity: 1 !important; transform: none !important; }
}
</style>
