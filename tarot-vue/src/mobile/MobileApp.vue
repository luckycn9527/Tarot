<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { Capacitor, type PluginListenerHandle } from '@capacitor/core'
import { App as NativeApp } from '@capacitor/app'
import { Haptics, ImpactStyle } from '@capacitor/haptics'
import { Browser } from '@capacitor/browser'
import { Network } from '@capacitor/network'
import { Keyboard } from '@capacitor/keyboard'
import Layers from '@icons/layers.vue'
import HistoryIcon from '@icons/history.vue'
import UserRound from '@icons/user-round.vue'
import ChevronLeft from '@icons/chevron-left.vue'
import XIcon from '@icons/x.vue'
import House from '@icons/house.vue'
import ArrowRight from '@icons/arrow-right.vue'
import ArrowUpRight from '@icons/arrow-up-right.vue'
import Moon from '@icons/moon.vue'
import Sparkles from '@icons/sparkles.vue'
import { offlineCards, findOfflineCard, getOfflineCardImageUrl } from './data/offlineCards'
import MobileFlipCard from './components/MobileFlipCard.vue'
import MobileHistory from './components/MobileHistory.vue'
import MobileFollowupComposer from './components/MobileFollowupComposer.vue'
import MobileHomeDraw from './components/MobileHomeDraw.vue'
import MobileReadingConversation from './components/MobileReadingConversation.vue'
import MobileReaderPicker from './components/MobileReaderPicker.vue'
import MobileReaderAvatar from './components/MobileReaderAvatar.vue'
import MobileUpdatePanel from './components/MobileUpdatePanel.vue'
import MobileAccountPanel from './components/MobileAccountPanel.vue'
import MobileAccountAccess from './components/MobileAccountAccess.vue'
import MobileReadingReview from './components/MobileReadingReview.vue'
import { historyFilterError, normalizeMobileOutcome, type MobileHistoryFilters } from './mobileHistoryModel'
import MobileProfileEditor from './components/MobileProfileEditor.vue'
import MobileMembershipRedeem from './components/MobileMembershipRedeem.vue'
import MobileMembershipBenefits from './components/MobileMembershipBenefits.vue'
import { useMobileMembership } from './useMobileMembership'
import type { User } from '@/stores/auth'
import MobileDailyResult from './components/MobileDailyResult.vue'
import MobileYesterdayFortune from './components/MobileYesterdayFortune.vue'
import MobileAskResume from './components/MobileAskResume.vue'
import { askDraftKey, blankAskDraft, hasAskDraftProgress, mergeSavedAskDrafts, validSavedAskDrafts, type AskResumeItem } from './mobileAskEntry'
import { useMobileDailyFortune } from './useMobileDailyFortune'
import { useMobileYesterdayFortune } from './useMobileYesterdayFortune'
import { useMobileCardBack } from './useMobileCardBack'
import { initializeMobileUpdater, refreshMobileUpdater, quietlyCheckMobileUpdate, disposeMobileUpdater } from './mobileUpdater'
import { mobileDeck, questionValid, followupValid, validDraft, validPendingTask, historyObject, savedFollowups } from './mobileModel'
import { readMobileValue, writeMobileValue, mobileSite } from './mobileStorage'
import { mobileUser, mobileSessionReady, initializeMobileSession, loginMobile, logoutMobile, refreshMobileProfile,
  fetchMobileReference, fetchMobileHistory, fetchMobileReading, deleteMobileReading, postMobileTask, fetchMobileTask,
  mobileError, mobileHttpStatus, mobileRetryAfter, mobileWebsiteOrigin, uploadMobileAvatar, fetchMobileBirthInfo, saveMobileBirthInfo, saveMobileReadingOutcome } from './mobileApi'
import type { MobileCard, MobileReader, MobileSpread, MobileDraft, PendingMobileTask, MobileTask, MobileHistoryEntry, MobileReadingPayload, MobileFollowupPayload, MobileReaderPreference } from './types'
import { availableMobileReaders, defaultMobileReaderId, restoredMobileReaderId, resolveReadingReader, validReaderPreference } from './mobileReaderModel'
import type { ReaderReadingResult } from '@/services/tarotAiReading'
import { localizedSpreadPositions } from '@/utils/readerLocalization'
import { applyLocaleToDocument, setStoredLocale } from '@/utils/localeStorage'
import { beginReadingRefresh, completedReadingId, completionIsVisible, consumeFollowupDraft, continueCardSelection, isDrawLocked, persistedDrawPhase, previousDrawPhase, restoredDrawPhase, responseScopeIsCurrent, taskBelongsToReading, taskMatchesDraw, taskReadingId, validCompletionNotice, validHistoryReturn } from './mobileNavigation'
import { loadMobileHistoryPage } from './mobileHistoryLoader'
import type { MobileCompletionNotice, MobileHistoryReturn, MobileTaskFeedback } from './mobileNavigation'
import './mobile.css'
import './mobileReading.css'
import './mobileLunar.css'
import './mobileAsk.css'
import './mobileAccount.css'
import './mobileTheme.css'

const { locale } = useI18n()
const english = computed(() => String(locale.value).startsWith('en'))
const text = (zh: string, en: string) => english.value ? en : zh
const readingLocale = computed<'zh-CN' | 'en-US'>(() => english.value ? 'en-US' : 'zh-CN')
function changeLanguage(value: string) {
  if (value !== 'zh-CN' && value !== 'en-US') return
  locale.value = value
  setStoredLocale(value)
  applyLocaleToDocument(value)
}
type Tab = 'home' | 'ask' | 'history' | 'me'
type Phase = 'question' | 'select' | 'reveal' | 'waiting' | 'result'
const tab = ref<Tab>('home'), phase = ref<Phase>('question')
const startupReady = ref(false)
const question = ref(''), count = ref<1 | 3>(1), readerId = ref('')
const readerPreference = ref<MobileReaderPreference | null>(null)
const deck = ref<MobileCard[]>([]), selected = ref<number[]>([]), revealed = ref<number[]>([]), carried = ref<MobileCard | null>(null)
const nextDraft = ref<MobileDraft | null>(null)
const archivedAskDrafts = ref<MobileDraft[]>([]), recentReading = ref<MobileHistoryEntry | null>(null)
const startingNewQuestion = ref(false)
let askOpened = false, askActionSequence = 0
const referenceReaders = ref<MobileReader[]>([]), referenceSpreads = ref<MobileSpread[]>([])
const positionsFor = (id: 'single' | 'problem') => localizedSpreadPositions(referenceSpreads.value.find(spread => spread.id === id) ?? {
  id, positions: id === 'single' ? ['当前情况'] : ['问题的起因', '问题的现状', '问题解决方法'],
}, String(locale.value))
const threeCardPositions = computed(() => positionsFor('problem'))
const cardPositions = computed(() => count.value === 1 ? positionsFor('single') : threeCardPositions.value)
const activeCardIds = ref<number[]>(offlineCards.map(card => card.id))
const imageOverrides = ref<Record<number, string>>({})
const referenceReady = ref(false), referenceFailed = ref(false), referenceLoading = ref(false), online = ref(navigator.onLine), keyboardOpen = ref(false)
const readersOpen = ref(false), loginOpen = ref(false), loginBusy = ref(false), loginError = ref('')
const loginDialog = ref<HTMLElement | null>(null)
let focusBeforeDialog: HTMLElement | null = null
const identifier = ref(''), password = ref(''), afterLogin = ref<'reading' | 'history' | 'daily' | 'redeem' | 'benefits-redeem' | null>(null)
const pending = ref<PendingMobileTask | null>(null), taskBusy = ref(false), taskError = ref(''), taskNeedsResend = ref(false)
const readingPreparation = ref<symbol | null>(null)
const failedTask = ref<PendingMobileTask | null>(null), completionNotice = ref<MobileCompletionNotice | null>(null)
const current = ref<MobileHistoryEntry | null>(null), currentLoading = ref(false), currentError = ref(''), cachedDetail = ref(false)
const activeReadingId = ref<number | null>(null), followupDrafts = ref<Record<number, string>>({}), historyReturn = ref<MobileHistoryReturn | null>(null)
const followup = ref(''), toast = ref(''), storageError = ref(''), operationError = ref('')
const history = ref<MobileHistoryEntry[]>([]), historyLoading = ref(false), historyError = ref(''), historyPage = ref(1), historyPages = ref(1), historyTotal = ref(0), search = ref(''), historyCached = ref(false)
const historyLoaded = ref(false)
const deletingId = ref<number | null>(null), logoutBusy = ref(false)
const historyFilters = ref<MobileHistoryFilters>({ type: '', from: '', to: '' })
const reviewSaving = ref(false), reviewError = ref('')
const quotaRefreshing = ref(false)
async function refreshQuota() {
  if (quotaRefreshing.value || !mobileUser.value || !online.value) return
  const id = owner.value; quotaRefreshing.value = true
  try { await refreshMobileProfile() }
  catch (error) { if (id === owner.value) notify(mobileError(error)) }
  finally { quotaRefreshing.value = false }
}
let reviewSequence = 0
const readingOutcome = computed(() => normalizeMobileOutcome((current.value?.resultData as { outcome?: unknown } | null)?.outcome))
const reviewEligible = computed(() => {
  const created = new Date(current.value?.createdAt || '')
  return Number.isFinite(created.getTime()) && created.getTime() <= membershipNow.value && created.toDateString() !== new Date(membershipNow.value).toDateString()
})
const accountMode = ref<'register' | 'forgot' | 'password' | 'delete' | null>(null)
const accountAccess = ref<{ requestClose: () => void } | null>(null)
let accountAccessOwner: number | null = null
let disposed = false, historySequence = 0, detailSequence = 0, hydrationSequence = 0, restoringPrivate = true
let readerSelectionSequence = 0
let drawIntentRevision = 0
let referenceRequest: Promise<void> | null = null
let pollingRequest: string | null = null
const readingRefreshVersions = new Map<number, number>()
let historyRefreshNeeded = false
let pollDelay = 5000
let pollTimer: number | undefined, draftTimer: number | undefined, toastTimer: number | undefined, membershipTimer: number | undefined
const handles: PluginListenerHandle[] = []
const membershipNow = ref(Date.now())
const owner = computed(() => mobileUser.value?.id ?? null)
const { open: membershipOpen, code: membershipCode, busy: redemptionBusy, syncing: membershipSyncing,
  error: redemptionError, profileError: membershipProfileError, profileUpdated: membershipProfileUpdated,
  grant: membershipGrant, show: showMembership, close: closeMembership, redeem: redeemMembership, refresh: syncMembership } = useMobileMembership({ owner, ready: startupReady, online, english })
function openMembership() {
  if (!startupReady.value || logoutBusy.value) return
  if (!mobileUser.value) { requestLogin('redeem'); return }
  showMembership()
}
const benefitsOpen = ref(false), membershipReturnsToBenefits = ref(false)
let membershipReturnOwner: number | null = null
function openBenefits() {
  if (!startupReady.value || logoutBusy.value) return
  refreshMembershipClock(); benefitsOpen.value = true
}
function closeBenefits() { benefitsOpen.value = false }
async function redeemFromBenefits() {
  if (!startupReady.value || logoutBusy.value) return
  const fromOwner = owner.value
  benefitsOpen.value = false
  // Unmount the first dialog before the next one takes scroll and focus ownership.
  await nextTick()
  if (disposed || owner.value !== fromOwner || tab.value !== 'me' || !startupReady.value || logoutBusy.value) return
  if (!mobileUser.value) { requestLogin('benefits-redeem'); return }
  membershipReturnsToBenefits.value = true; membershipReturnOwner = fromOwner
  openMembership()
}
watch(owner, () => { benefitsOpen.value = false; membershipReturnsToBenefits.value = false; membershipReturnOwner = null }, { flush: 'sync' })
watch(tab, value => { if (value !== 'me') { benefitsOpen.value = false; membershipReturnsToBenefits.value = false; membershipReturnOwner = null } }, { flush: 'sync' })
watch(membershipOpen, async (open, wasOpen) => {
  if (open || !wasOpen) return
  const resume = membershipReturnsToBenefits.value, returnOwner = membershipReturnOwner
  membershipReturnsToBenefits.value = false; membershipReturnOwner = null
  if (!resume) return
  await nextTick()
  if (!disposed && startupReady.value && tab.value === 'me' && owner.value === returnOwner && !loginOpen.value) openBenefits()
}, { flush: 'post' })
const { backImageUrl: backImage } = useMobileCardBack()
const profileMode = ref<'avatar' | 'birth' | null>(null), profileUser = ref<User | null>(null)
const profileBusy = ref(false), profileLoading = ref(false), profileError = ref('')
let profileSequence = 0
watch(owner, () => { profileSequence++; profileMode.value = null; profileUser.value = null; profileBusy.value = false; profileLoading.value = false; profileError.value = '' }, { flush: 'sync' })
function closeProfile() {
  if (profileBusy.value) return
  profileSequence++; profileMode.value = null; profileUser.value = null; profileLoading.value = false; profileError.value = ''
}
async function loadBirthProfile() {
  if (!mobileUser.value || profileMode.value !== 'birth') return
  const id = owner.value, action = ++profileSequence
  profileLoading.value = true; profileError.value = ''
  try {
    const info = await fetchMobileBirthInfo()
    if (action !== profileSequence || owner.value !== id || disposed || !mobileUser.value) return
    profileUser.value = { ...mobileUser.value, ...info }
  } catch (error) { if (action === profileSequence && owner.value === id) profileError.value = mobileError(error, text('生辰信息读取失败，可重试。', 'Birth details could not be loaded. Try again.')) }
  finally { if (action === profileSequence) profileLoading.value = false }
}
function openProfile(mode: 'avatar' | 'birth') {
  if (!startupReady.value) return
  if (!mobileUser.value) { requestLogin(); return }
  profileSequence++; profileUser.value = { ...mobileUser.value }; profileError.value = ''; profileMode.value = mode
  if (mode === 'birth') void loadBirthProfile()
}
async function updateAvatar(file: File) {
  if (profileBusy.value || profileMode.value !== 'avatar' || !mobileUser.value) return
  const id = owner.value, action = ++profileSequence
  profileBusy.value = true; profileError.value = ''
  try {
    await uploadMobileAvatar(file)
    if (id !== owner.value || action !== profileSequence || disposed) return
    profileMode.value = null; profileUser.value = null
    notify(text('头像已更新。', 'Avatar updated.'))
  } catch (error) { if (id === owner.value && action === profileSequence) profileError.value = mobileError(error, text('头像上传失败，请检查网络后重试。', 'The avatar could not be uploaded. Check your connection and try again.')) }
  finally { if (action === profileSequence) profileBusy.value = false }
}
async function updateBirth(value: { birthday: string | null; birthTime: string | null }) {
  if (profileBusy.value || profileLoading.value || profileMode.value !== 'birth' || !mobileUser.value) return
  const id = owner.value, action = ++profileSequence
  profileBusy.value = true; profileError.value = ''
  try {
    await saveMobileBirthInfo(value)
    if (id !== owner.value || action !== profileSequence || disposed) return
    profileMode.value = null; profileUser.value = null
    notify(text('生辰信息已保存。', 'Birth details saved.'))
  } catch (error) { if (id === owner.value && action === profileSequence) profileError.value = mobileError(error, text('生辰信息保存失败，请重试。', 'Birth details could not be saved. Try again.')) }
  finally { if (action === profileSequence) profileBusy.value = false }
}
const { card: dailyCard, flipped: dailyFlipped, busy: dailyBusy, response: dailyResponse, error: dailyError,
  cached: dailyCached, draw: drawDailyFortune, refresh: refreshDailyFortune } = useMobileDailyFortune({
  owner, ready: startupReady, online, cardIds: activeCardIds,
})
const { open: yesterdayOpen, busy: yesterdayBusy, error: yesterdayError, response: yesterdayResponse,
  cached: yesterdayCached, show: showYesterday, close: closeYesterday, retry: retryYesterday } = useMobileYesterdayFortune({
  owner, ready: startupReady, online, today: dailyResponse,
})
const currentPendingFollowup = computed(() => taskBelongsToReading(pending.value, owner.value, activeReadingId.value) ? pending.value : null)
const currentTaskContext = computed(() => pending.value || failedTask.value)
const currentTaskError = computed(() => {
  const task = currentTaskContext.value
  if (!task || task.owner !== owner.value) return ''
  return task.kind === 'followup' ? taskBelongsToReading(task, owner.value, activeReadingId.value) ? taskError.value : ''
    : !activeReadingId.value && (['waiting', 'reveal'].includes(phase.value) || (phase.value === 'question' && drawLocked.value)) && taskMatchesDraw(task, question.value, readerId.value, chosenCards.value) ? taskError.value : ''
})
const currentTaskNeedsResend = computed(() => !!currentPendingFollowup.value && taskNeedsResend.value)
const pendingReadingQuestion = computed(() => pending.value?.owner === owner.value ? pending.value.payload.question : '')
const pendingElsewhere = computed(() => !!pending.value && pending.value.owner === owner.value && !completionIsVisible(pending.value, owner.value, tab.value, phase.value, activeReadingId.value))
const failedTaskElsewhere = computed(() => !!failedTask.value && failedTask.value.owner === owner.value && !!taskError.value && !currentTaskError.value)
const failedReadingQuestion = computed(() => failedTask.value?.owner === owner.value ? failedTask.value.payload.question : '')
const availableReaders = computed(() => availableMobileReaders(referenceReaders.value, activeVip.value))
const activeVip = computed(() => mobileUser.value?.membership === 'vip' && (!mobileUser.value.membershipExpiresAt || new Date(mobileUser.value.membershipExpiresAt).getTime() > membershipNow.value))
const currentReader = computed(() => availableReaders.value.find(reader => reader.id === readerId.value))
const selectedReaderProfile = computed(() => referenceReaders.value.find(reader => reader.id === readerId.value))
const selectedReaderAvatar = computed(() => selectedReaderProfile.value || (readerId.value ? { id: readerId.value } : undefined))
const readerEntryName = computed(() => selectedReaderProfile.value?.name || (referenceReady.value ? text('请选择塔罗师', 'Choose a reader') : text('正在连接塔罗师…', 'Connecting to readers…')))
const readerLoadError = computed(() => !online.value ? text('当前离线，联网后可刷新塔罗师资料。', 'You are offline. Reconnect to refresh reader details.')
  : referenceFailed.value ? text('塔罗师资料加载失败，请重试。', 'Could not load readers. Please retry.') : '')
const readerUnavailableMessage = computed(() => {
  if (!referenceReady.value) return ''
  if (!availableReaders.value.length) return text('当前账号暂无可用塔罗师，请刷新资料后重试。', 'No readers are available for this account. Refresh and try again.')
  return readerId.value && !currentReader.value ? text('此前选择的塔罗师当前不可用，请重新选择。问题和牌面会保留。', 'Your selected reader is unavailable. Choose another reader; your question and cards are kept.') : ''
})
const chosenCards = computed(() => carried.value ? [carried.value] : selected.value.map(id => deck.value.find(card => card.id === id)!).filter(Boolean))
const allRevealed = computed(() => chosenCards.value.length === count.value && (carried.value !== null || revealed.value.length === count.value))
const drawLocked = computed(() => isDrawLocked(carried.value, selected.value, revealed.value))
const pendingConversationQuestion = computed(() => currentPendingFollowup.value ? (currentPendingFollowup.value.payload as MobileFollowupPayload).question : '')
const readingReader = computed(() => resolveReadingReader(current.value, referenceReaders.value))
const readingReaderName = computed(() => readingReader.value?.name || text('原塔罗师资料暂不可用', 'Original reader details unavailable'))
const followupUnavailableMessage = computed(() => {
  if (current.value?.type !== 'reader-reading' || !referenceReady.value) return ''
  if (!readingReader.value) return text('原塔罗师资料暂不可用，暂时无法继续追问。已保存的解读仍可查看。', 'The original reader is unavailable for follow-ups. Your saved reading is still available.')
  if (readingReader.value.accessLevel === 'vip' && !activeVip.value) return text('当前账号暂不能向这位塔罗师追问，已保存的解读仍可查看。', 'This reader is unavailable for follow-ups with your current account. Your saved reading is still available.')
  return ''
})
const canFollowup = computed(() => current.value?.type === 'reader-reading' && !!mobileUser.value && !followupUnavailableMessage.value)
const readingPositions = computed(() => {
  const spreadType = current.value?.spreadType
  const spread = referenceSpreads.value.find(item => item.id === spreadType)
  if (spread) return localizedSpreadPositions(spread, String(locale.value))
  return spreadType === 'single' || spreadType === 'problem' ? positionsFor(spreadType) : []
})
const navItems = computed(() => [
  { key: 'home' as Tab, name: text('运势', 'Daily'), icon: House }, { key: 'ask' as Tab, name: text('问卜', 'Ask'), icon: Layers },
  { key: 'history' as Tab, name: text('记录', 'History'), icon: HistoryIcon }, { key: 'me' as Tab, name: text('我的', 'Me'), icon: UserRound },
])
const headerTitle = computed(() => {
  if (tab.value === 'home') return text('每日运势', 'Daily fortune')
  if (tab.value === 'history') return text('历史记录', 'Reading history')
  if (tab.value === 'me') return text('我的', 'My account')
  return ({ question: text('问卜', 'Ask'), select: text('选牌', 'Choose cards'), reveal: text('翻牌', 'Reveal cards'),
    waiting: text('正在解读', 'Reading in progress'), result: text('解读与追问', 'Reading & follow-up') })[phase.value]
})
function cardName(card: MobileCard) { const data = findOfflineCard(card.id); return english.value ? data?.nameEn : data?.name }
function orientation(card: MobileCard) { return card.isReversed ? text('逆位', 'Reversed') : text('正位', 'Upright') }
function key(name: string, id: number | null = owner.value) { return `${name}-${id ?? 'guest'}` }
function refreshMembershipClock() {
  membershipNow.value = Date.now(); window.clearTimeout(membershipTimer)
  const expires = mobileUser.value?.membershipExpiresAt ? new Date(mobileUser.value.membershipExpiresAt).getTime() : 0
  if (mobileUser.value?.membership === 'vip' && expires > membershipNow.value) {
    membershipTimer = window.setTimeout(refreshMembershipClock, Math.min(2_147_483_647, expires - membershipNow.value + 5))
  }
}
watch(mobileUser, refreshMembershipClock, { immediate: true })
function ensureInitialReader() {
  if (!restoringPrivate && !readerId.value) readerId.value = readerPreference.value?.readerId || defaultMobileReaderId(referenceReaders.value)
}
watch(availableReaders, ensureInitialReader)
function openReaderPicker() {
  refreshMembershipClock(); readersOpen.value = true
  if (!referenceReady.value || referenceFailed.value) void loadReference()
}
async function selectReader(id: string) {
  refreshMembershipClock()
  if (restoringPrivate || !availableReaders.value.some(reader => reader.id === id)) return
  const selectedOwner = owner.value
  readerSelectionSequence++
  readerId.value = id; readersOpen.value = false; operationError.value = ''
  const preference: MobileReaderPreference = { schema: 1, owner: selectedOwner, site: mobileSite, readerId: id, savedAt: Date.now() }
  readerPreference.value = preference
  await privateWrite('reader-preference', preference, selectedOwner).catch(() => {})
}
function notify(value: string) { toast.value = value; window.clearTimeout(toastTimer); toastTimer = window.setTimeout(() => { toast.value = '' }, 4000) }
function tactile() { if (Capacitor.isNativePlatform()) void Haptics.impact({ style: ImpactStyle.Light }).catch(() => {}) }
function scrollTop() { window.scrollTo({ top: 0, behavior: 'instant' }) }
async function privateWrite(name: string, value: unknown, id = owner.value) {
  try {
    await writeMobileValue(key(name, id), value)
    if (name === 'last' && id === owner.value && !disposed) recentReading.value = value as MobileHistoryEntry | null
  }
  catch { if (id === owner.value) storageError.value = text('本机保存暂时失败，请保持 APP 打开后重试。', 'Local saving failed. Keep the app open and retry.'); throw new Error('Local storage unavailable') }
}
function draftSnapshot(): MobileDraft {
  return { schema: 1, owner: owner.value, question: question.value, count: count.value, readerId: readerId.value, carried: carried.value,
    deck: deck.value, selected: selected.value, revealed: revealed.value, phase: persistedDrawPhase(phase.value, activeReadingId.value),
    readingId: phase.value === 'result' ? activeReadingId.value ?? undefined : undefined, savedAt: Date.now() }
}
async function saveDraft() {
  if (restoringPrivate) return
  if (tab.value === 'history') rememberHistory()
  const id = owner.value, draft = draftSnapshot()
  if (activeReadingId.value) followupDrafts.value[activeReadingId.value] = followup.value
  await privateWrite('draft', draft, id)
  if (id !== null && id === owner.value) {
    if (activeReadingId.value) followupDrafts.value[activeReadingId.value] = followup.value
    await privateWrite('followup-drafts', { ...followupDrafts.value }, id)
  }
}
async function preserveAskContext() {
  const id = owner.value, scope = hydrationSequence
  const incoming: MobileDraft[] = []
  const snapshot = draftSnapshot()
  if (activeReadingId.value === null && phase.value !== 'waiting' && hasAskDraftProgress(snapshot)) incoming.push(snapshot)
  if (nextDraft.value && validDraft(nextDraft.value, id) && hasAskDraftProgress(nextDraft.value)) incoming.push(nextDraft.value)
  if (id !== null && current.value && current.value.id === activeReadingId.value) await privateWrite('last', current.value, id)
  if (id !== owner.value || scope !== hydrationSequence || disposed) return false
  const retained = mergeSavedAskDrafts(archivedAskDrafts.value, incoming, id)
  archivedAskDrafts.value = retained
  await privateWrite('ask-drafts', retained, id)
  if (id !== owner.value || scope !== hydrationSequence || disposed) return false
  await saveDraft()
  return id === owner.value && scope === hydrationSequence && !disposed
}
const askResumeItems = computed<AskResumeItem[]>(() => {
  const items: AskResumeItem[] = []
  if (pending.value?.owner === owner.value) items.push({ id: `pending:${pending.value.requestId}`, kind: 'pending',
    title: pending.value.kind === 'followup' ? text('查看正在追问', 'View follow-up in progress') : text('查看正在解读', 'View reading in progress'), description: pending.value.payload.question })
  if (failedTask.value?.owner === owner.value && failedTask.value.requestId !== pending.value?.requestId) items.push({ id: `failed:${failedTask.value.requestId}`, kind: 'failed', title: text('继续生成未完成的问卜', 'Retry an unfinished reading'), description: failedTask.value.payload.question })
  if (completionNotice.value?.owner === owner.value && completionNotice.value.readingId !== activeReadingId.value) items.push({ id: `completed:${completionNotice.value.requestId}`, kind: 'reading', title: text('查看刚完成的解读', 'Open your completed reading'), description: completionNotice.value.question })
  const snapshot = draftSnapshot()
  const activeKey = activeReadingId.value === null && hasAskDraftProgress(snapshot) ? askDraftKey(snapshot) : null
  for (const draft of validSavedAskDrafts(archivedAskDrafts.value, owner.value)) {
    const id = askDraftKey(draft)
    if (id === activeKey) continue
    items.push({ id: `draft:${id}`, kind: 'draft', title: text('继续未发送的问题', 'Continue an unsent question'),
      description: draft.question.trim() || text('已保留的选牌进度', 'Saved card selection'),
      detail: draft.carried || draft.selected.length ? text('问题、牌面和方向已保留', 'Your question, cards and orientations are kept') : undefined })
  }
  if (recentReading.value && recentReading.value.id !== activeReadingId.value) items.push({ id: `reading:${recentReading.value.id}`, kind: 'reading', title: text('继续上次解读与追问', 'Continue your last reading'), description: recentReading.value.question || text('已保存的解读', 'Saved reading') })
  return items
})
function applyDraft(draft: MobileDraft) {
  question.value = draft.question; count.value = draft.count; readerId.value = draft.readerId; carried.value = draft.carried
  deck.value = draft.deck; selected.value = draft.selected; revealed.value = draft.revealed
  // Old carried-card drafts may have stopped on the redundant reveal confirmation.
  phase.value = restoredDrawPhase(draft)
}
// An edit or navigation cancels a preparation even if the user later restores the same values.
// Reference data may fill an initial reader automatically without changing this draw intent.
watch([question, count, carried, deck, selected, revealed, tab, phase], () => { drawIntentRevision++ }, { deep: true, flush: 'sync' })
watch([question, count, readerId, carried, deck, selected, revealed, phase, followup], () => {
  if (restoringPrivate) return
  window.clearTimeout(draftTimer); draftTimer = window.setTimeout(() => { if (!disposed) void saveDraft().catch(() => {}) }, 250)
}, { deep: true })
function setReadingContext(id: number | null) {
  if (activeReadingId.value !== null) followupDrafts.value[activeReadingId.value] = followup.value
  activeReadingId.value = id
  followup.value = id === null ? '' : followupDrafts.value[id] || ''
}
watch(count, () => {
  if (carried.value) return
  const continued = continueCardSelection(deck.value, selected.value, revealed.value, count.value)
  selected.value = continued.selected; revealed.value = continued.revealed
}, { flush: 'sync' })
watch(carried, (card, previous) => {
  if (!card && previous) revealed.value = revealed.value.filter(id => selected.value.includes(id))
}, { flush: 'sync' })
async function clearCompletionNotice(requestId = completionNotice.value?.requestId) {
  const notice = completionNotice.value
  if (!notice || notice.owner !== owner.value || notice.requestId !== requestId) return
  completionNotice.value = null
  await privateWrite('completion', null, notice.owner).catch(() => {})
}

function loadReference(): Promise<void> {
  if (referenceRequest) return referenceRequest
  if (!online.value) return Promise.resolve()
  referenceLoading.value = true
  referenceRequest = (async () => { try {
    const data = await fetchMobileReference()
    if (disposed) return
    if (!Array.isArray(data.cards) || !data.cards.length || !Array.isArray(data.readers) || !Array.isArray(data.readerSpreads)) throw new Error('Invalid reference data')
    activeCardIds.value = data.cards.map((card: { id: number }) => card.id).filter((id: number) => findOfflineCard(id))
    referenceReaders.value = data.readers; referenceSpreads.value = data.readerSpreads
    const overrides: Record<number, string> = {}
    for (const card of data.cards) {
      if (!card.imageUrl) continue
      try { const url = new URL(card.imageUrl, mobileWebsiteOrigin); if (url.protocol === 'https:' || (!Capacitor.isNativePlatform() && url.origin === window.location.origin)) overrides[card.id] = url.href } catch { /* use offline original */ }
    }
    imageOverrides.value = overrides
    referenceReady.value = true; referenceFailed.value = false
    ensureInitialReader()
  } catch { if (!disposed) referenceFailed.value = true }
  finally { referenceLoading.value = false; referenceRequest = null }
  })()
  return referenceRequest
}
function requestLogin(intent: typeof afterLogin.value = null) { if (!startupReady.value || logoutBusy.value) return; afterLogin.value = intent; loginError.value = ''; password.value = ''; loginOpen.value = true }
function openAccountAccess(mode: NonNullable<typeof accountMode.value>) {
  if (!startupReady.value || loginBusy.value || logoutBusy.value) return
  if ((mode === 'password' || mode === 'delete') && !mobileUser.value) { requestLogin(); return }
  if (pending.value && (mode === 'password' || mode === 'delete')) { notify(text('请等当前问卜完成后再管理账号。', 'Finish the reading in progress before managing your account.')); return }
  accountAccessOwner = owner.value; password.value = ''; accountMode.value = mode
}
function closeAccountAccess() {
  accountMode.value = null
  if (loginOpen.value) void nextTick(() => loginDialog.value?.querySelector<HTMLInputElement>('input')?.focus())
}
function signInToAccount(value: string) {
  closeAccountAccess(); identifier.value = value; password.value = ''; loginError.value = ''
  if (!loginOpen.value) requestLogin()
}
async function accountSessionEnded() {
  const deleted = accountMode.value === 'delete', id = accountAccessOwner
  accountMode.value = null; loginOpen.value = false; tab.value = 'me'
  if (deleted && id !== null) for (const name of ['draft','next-draft','ask-drafts','pending','last','history','completion','history-view','followup-drafts','task-feedback','daily-yesterday','reader-preference']) await privateWrite(name, null, id).catch(() => {})
  notify(deleted ? text('账号已注销。', 'Your account has been deleted.') : text('密码已更新，请重新登录。', 'Password updated. Please sign in again.'))
  if (!deleted) requestLogin()
}
watch(loginOpen, async (login, wasLogin) => {
  if (login && !wasLogin) focusBeforeDialog = document.activeElement instanceof HTMLElement ? document.activeElement : null
  const returnToBenefits = !login && wasLogin && afterLogin.value === 'benefits-redeem'
  if (returnToBenefits) { afterLogin.value = null; openBenefits() }
  await nextTick()
  if (disposed) return
  if (returnToBenefits) { focusBeforeDialog = null; return }
  const dialog = login ? loginDialog.value : null
  if (dialog) (dialog.querySelector<HTMLInputElement>('input') || dialog.querySelector<HTMLButtonElement>('button[aria-pressed="true"]') || dialog.querySelector<HTMLButtonElement>('button'))?.focus()
  else if (wasLogin) {
    const target = focusBeforeDialog?.isConnected ? focusBeforeDialog : document.querySelector<HTMLElement>('.mobile-nav [aria-current="page"]')
    target?.focus(); focusBeforeDialog = null
  }
})
function modalKeydown(event: KeyboardEvent) {
  if (accountMode.value) return
  const dialog = loginOpen.value ? loginDialog.value : null
  if (!dialog) return
  if (event.key === 'Escape') { event.preventDefault(); if (!loginBusy.value) { loginOpen.value = false; readersOpen.value = false } return }
  if (event.key !== 'Tab') return
  const controls = Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),a[href]')).filter(control => control.getClientRects().length > 0)
  const first = controls[0], last = controls[controls.length - 1]
  if (!first || !last) { event.preventDefault(); return }
  if (!dialog.contains(document.activeElement)) { event.preventDefault(); first.focus() }
  else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
}
async function signIn() {
  if (loginBusy.value || logoutBusy.value) return
  loginBusy.value = true; loginError.value = ''
  try {
    if (!identifier.value.trim() || !password.value) { loginError.value = text('请填写邮箱或用户名和密码。', 'Enter your email or username and password.'); return }
    const guestArchives = owner.value === null ? validSavedAskDrafts(archivedAskDrafts.value, null) : []
    const preserveGuest = owner.value === null && (!!question.value.trim() || !!carried.value || !!selected.value.length)
    await loginMobile(identifier.value, password.value)
    const signedOwner = owner.value
    password.value = ''; loginOpen.value = false
    const intent = afterLogin.value; afterLogin.value = null
    await hydratePrivate(intent === 'reading' || preserveGuest)
    if (owner.value !== signedOwner) return
    if (signedOwner !== null && guestArchives.length) {
      archivedAskDrafts.value = mergeSavedAskDrafts(archivedAskDrafts.value, guestArchives.map(draft => ({ ...draft, owner: signedOwner })), signedOwner)
      await privateWrite('ask-drafts', archivedAskDrafts.value, signedOwner)
      if (owner.value !== signedOwner) return
      await privateWrite('ask-drafts', null, null)
      await privateWrite('next-draft', null, null)
    }
    await saveDraft()
    await privateWrite('draft', null, null)
    if (owner.value !== signedOwner) return
    if (intent === 'reading' && !pending.value) await beginReading()
    else if (intent === 'history') { tab.value = 'history'; await loadHistory(1) }
    else if (intent === 'daily') { tab.value = 'home'; await drawDailyFortune() }
    else if (intent === 'redeem' || intent === 'benefits-redeem') {
      tab.value = 'me'
      if (intent === 'benefits-redeem') { membershipReturnsToBenefits.value = true; membershipReturnOwner = signedOwner }
      showMembership()
    }
    else notify(text('已登录，记录将在当前账号同步。', 'Signed in. Your readings sync to this account.'))
    void loadReference()
  } catch (error) { loginError.value = mobileError(error, text('登录失败，请检查账号和网络。', 'Sign-in failed. Check your account and connection.')) }
  finally { loginBusy.value = false }
}
async function signOut() {
  if (logoutBusy.value || !mobileUser.value) return
  if (!window.confirm(text('退出当前账号？云端记录会继续保留。', 'Sign out? Your saved readings remain in your account.'))) return
  logoutBusy.value = true
  const id = owner.value
  try {
    await logoutMobile()
    for (const name of ['draft','next-draft','ask-drafts','pending','last','history','completion','history-view','followup-drafts','task-feedback','daily-yesterday']) await privateWrite(name, null, id).catch(() => {})
    if (owner.value !== null) return
    await privateWrite('draft', null, null).catch(() => {})
    if (owner.value !== null) return
    resetPrivate(); await hydratePrivate()
    if (owner.value === null) tab.value = 'home'
  } catch { notify(text('退出未完成，本机登录信息未能清理，请重试。', 'Sign-out could not finish. Your saved sign-in could not be removed. Please retry.')) }
  finally { logoutBusy.value = false }
}
function resetPrivate() {
  reviewSequence++; reviewSaving.value = false; reviewError.value = ''; historyFilters.value = { type: '', from: '', to: '' }
  window.clearTimeout(pollTimer); window.clearTimeout(draftTimer); historySequence++; detailSequence++; hydrationSequence++; restoringPrivate = true; pollingRequest = null
  readingRefreshVersions.clear(); historyRefreshNeeded = false
  pending.value = null; failedTask.value = null; current.value = null; nextDraft.value = null; taskError.value = ''; currentError.value = ''; followup.value = ''
  archivedAskDrafts.value = []; recentReading.value = null; askOpened = false; askActionSequence++; startingNewQuestion.value = false
  activeReadingId.value = null; followupDrafts.value = {}; historyReturn.value = null; completionNotice.value = null
  history.value = []; historyTotal.value = 0; search.value = ''; historyError.value = ''; taskNeedsResend.value = false
  question.value = ''; count.value = 1; readerId.value = ''; readerPreference.value = null; readersOpen.value = false
  readingPreparation.value = null
  selected.value = []; revealed.value = []; carried.value = null; deck.value = []; phase.value = 'question'
  currentLoading.value = false; historyLoading.value = false; cachedDetail.value = false; historyCached.value = false; historyLoaded.value = false; taskBusy.value = false
  historyPage.value = 1; historyPages.value = 1; operationError.value = ''; storageError.value = ''; taskNeedsResend.value = false
}
watch(owner, (id, previous) => {
  if (previous !== undefined && previous !== null && id !== previous) {
    resetPrivate()
    if (!loginBusy.value && !logoutBusy.value) void hydratePrivate()
  }
}, { flush: 'sync' })
async function hydratePrivate(preserveCurrent = false, landingHome = false) {
  const id = owner.value, sequence = ++hydrationSequence
  restoringPrivate = true; window.clearTimeout(draftTimer)
  try {
    const [draft, savedPending, last, next, notice, historyView, savedFollowupDrafts, feedback, preference, savedAskDrafts] = await Promise.all([
      readMobileValue<MobileDraft>(key('draft', id)), readMobileValue<PendingMobileTask>(key('pending', id)), readMobileValue<MobileHistoryEntry>(key('last', id)), readMobileValue<MobileDraft>(key('next-draft', id)),
      readMobileValue<MobileCompletionNotice>(key('completion', id)), readMobileValue<MobileHistoryReturn>(key('history-view', id)),
      readMobileValue<Record<number, string>>(key('followup-drafts', id)), readMobileValue<MobileTaskFeedback>(key('task-feedback', id)),
      readMobileValue<MobileReaderPreference>(key('reader-preference', id)),
      readMobileValue<unknown>(key('ask-drafts', id)),
    ])
    if (disposed || id !== owner.value || sequence !== hydrationSequence) return
    readerPreference.value = validReaderPreference(preference, id, mobileSite) ? preference : null
    recentReading.value = id !== null && last && Number.isSafeInteger(last.id) && last.id > 0 && (last.question == null || typeof last.question === 'string') ? last : null
    archivedAskDrafts.value = mergeSavedAskDrafts(savedAskDrafts, validDraft(next, id) ? [next] : [], id)
    if (preserveCurrent && validDraft(draft, id) && hasAskDraftProgress(draft)) archivedAskDrafts.value = mergeSavedAskDrafts(archivedAskDrafts.value, [draft], id)
    if (validDraft(next, id) || preserveCurrent) {
      await privateWrite('ask-drafts', archivedAskDrafts.value, id)
      if (disposed || id !== owner.value || sequence !== hydrationSequence) return
      await privateWrite('next-draft', null, id)
      if (disposed || id !== owner.value || sequence !== hydrationSequence) return
    }
    if (id !== null && savedFollowupDrafts && typeof savedFollowupDrafts === 'object' && !Array.isArray(savedFollowupDrafts)) {
      followupDrafts.value = Object.fromEntries(Object.entries(savedFollowupDrafts).filter(([readingId, value]) => Number.isSafeInteger(Number(readingId)) && Number(readingId) > 0 && typeof value === 'string' && value.length <= 200))
    }
    if (validCompletionNotice(notice, id)) completionNotice.value = notice
    if (validHistoryReturn(historyView, id)) { historyReturn.value = historyView; historyPage.value = historyView.page; search.value = historyView.search.slice(0, 100); historyFilters.value = historyView.filters || { type: '', from: '', to: '' } }
    const restoredDraft = !preserveCurrent && validDraft(draft, id) ? draft : null
    if (restoredDraft) applyDraft(restoredDraft)
    else if (!preserveCurrent) readerId.value = restoredMobileReaderId(undefined, readerPreference.value, referenceReaders.value)
    nextDraft.value = null
    if (restoredDraft?.phase === 'result' && restoredDraft.readingId) {
      setReadingContext(restoredDraft.readingId); if (!landingHome) tab.value = 'ask'
      if (last?.id === restoredDraft.readingId) { current.value = last; cachedDetail.value = true }
      void openReading(restoredDraft.readingId, false)
    } else if (restoredDraft && ['select', 'reveal'].includes(restoredDraft.phase)) { setReadingContext(null); if (!landingHome) tab.value = 'ask' }
    if (feedback?.schema === 1 && validPendingTask(feedback.task, id) && typeof feedback.message === 'string') { failedTask.value = feedback.task; taskError.value = feedback.message }
    if (validPendingTask(savedPending, id)) {
      if (preserveCurrent && hasAskDraftProgress(draftSnapshot())) {
        archivedAskDrafts.value = mergeSavedAskDrafts(archivedAskDrafts.value, [draftSnapshot()], id)
        await privateWrite('ask-drafts', archivedAskDrafts.value, id)
      }
      if (disposed || id !== owner.value || sequence !== hydrationSequence) return
      pending.value = savedPending; failedTask.value = null; taskError.value = ''
      // A restored result may be another record the user was browsing while this request ran.
      if (!landingHome && (preserveCurrent || restoredDraft?.phase !== 'result')) await openPendingReading()
      void pollTask()
    }
  } catch { if (id === owner.value && sequence === hydrationSequence) storageError.value = text('本机记录暂时无法读取，请重试。', 'Local records are temporarily unavailable. Please retry.') }
  finally {
    if (id === owner.value && sequence === hydrationSequence) {
      if (landingHome) tab.value = 'home'
      restoringPrivate = false; ensureInitialReader()
    }
  }
}
function rememberHistory() {
  if (owner.value === null || tab.value !== 'history') return
  historyReturn.value = { schema: 1, owner: owner.value, page: historyPage.value, search: search.value, filters: { ...historyFilters.value }, scrollY: Math.max(0, window.scrollY), savedAt: Date.now() }
  void privateWrite('history-view', historyReturn.value).catch(() => {})
}
async function returnToHistory() {
  if (tab.value === 'ask') void saveDraft().catch(() => {})
  const id = owner.value, state = validHistoryReturn(historyReturn.value, id) ? historyReturn.value : null
  tab.value = 'history'; operationError.value = ''
  const targetPage = state?.page ?? historyPage.value, targetSearch = state?.search ?? search.value
  // Returning to a populated list must also pick up readings completed elsewhere.
  const needsLoad = online.value || !history.value.length || historyPage.value !== targetPage || search.value !== targetSearch
  search.value = targetSearch
  if (state?.filters) historyFilters.value = { ...state.filters }
  const loading = id !== null && needsLoad ? loadHistory(targetPage) : Promise.resolve()
  const sequence = historySequence
  await loading
  await nextTick()
  window.requestAnimationFrame(() => { if (!disposed && owner.value === id && sequence === historySequence && tab.value === 'history') window.scrollTo({ top: state?.scrollY ?? 0, behavior: 'instant' }) })
}
async function changeTab(next: Tab) {
  if (!startupReady.value) return
  if (next === 'ask') {
    const fresh = !askOpened || phase.value === 'result' || phase.value === 'waiting' || activeReadingId.value !== null
    if (tab.value === 'history') rememberHistory()
    tab.value = 'ask'; operationError.value = ''
    if (fresh) await startFreshQuestion()
    else { askOpened = true; scrollTop() }
    return
  }
  askActionSequence++; startingNewQuestion.value = false
  if (tab.value === 'ask') void saveDraft().catch(() => {})
  if (tab.value === 'history' && next !== 'history') rememberHistory()
  if (next === 'history') { await returnToHistory(); return }
  tab.value = next; operationError.value = ''; scrollTop()
}
async function startFreshQuestion() {
  if (!startupReady.value || startingNewQuestion.value) return
  const id = owner.value, action = ++askActionSequence
  detailSequence++; currentLoading.value = false; readingPreparation.value = null
  startingNewQuestion.value = true
  try {
    if (!await preserveAskContext() || id !== owner.value || action !== askActionSequence) return
    setReadingContext(null); current.value = null; currentError.value = ''; cachedDetail.value = false
    applyDraft(blankAskDraft(id, restoredMobileReaderId(undefined, readerPreference.value, referenceReaders.value)))
    operationError.value = ''; askOpened = true; tab.value = 'ask'
    // In-flight and failed requests retain their original IDs/payloads in the recovery list.
    await saveDraft()
    if (id === owner.value && action === askActionSequence) scrollTop()
  } catch { if (id === owner.value) notify(text('未能保存上次的进度，请重试。', 'Could not save your previous progress. Please try again.')) }
  finally { if (action === askActionSequence) startingNewQuestion.value = false }
}
async function restoreAskItem(itemId: string) {
  if (!startupReady.value) return
  if (itemId === `pending:${pending.value?.requestId}`) { await openPendingReading(); return }
  if (itemId === `failed:${failedTask.value?.requestId}` && failedTask.value) { await openTaskReading(failedTask.value); return }
  if (itemId === `completed:${completionNotice.value?.requestId}`) { await openCompletedReading(); return }
  if (itemId === `reading:${recentReading.value?.id}` && recentReading.value) { await openReading(recentReading.value.id); return }
  const draft = validSavedAskDrafts(archivedAskDrafts.value, owner.value).find(value => `draft:${askDraftKey(value)}` === itemId)
  if (!draft) return
  const id = owner.value, action = ++askActionSequence
  startingNewQuestion.value = true; detailSequence++; currentLoading.value = false; readingPreparation.value = null
  try {
    if (!await preserveAskContext() || id !== owner.value || action !== askActionSequence) return
    const restored = validSavedAskDrafts([draft], id)[0]
    if (!restored) return
    setReadingContext(null); current.value = null; currentError.value = ''; cachedDetail.value = false
    applyDraft(restored)
    askOpened = true; tab.value = 'ask'; operationError.value = ''
    await saveDraft()
    if (id !== owner.value || action !== askActionSequence) return
    archivedAskDrafts.value = archivedAskDrafts.value.filter(value => askDraftKey(value) !== askDraftKey(draft))
    await privateWrite('ask-drafts', archivedAskDrafts.value, id)
    if (id === owner.value && action === askActionSequence) scrollTop()
  } catch { if (id === owner.value) notify(text('暂时无法恢复进度，请重试。', 'Could not restore your progress. Please retry.')) }
  finally { if (action === askActionSequence) startingNewQuestion.value = false }
}
async function openDailyDraw() {
  if (!startupReady.value || dailyBusy.value) return
  if (owner.value === null) { requestLogin('daily'); return }
  tactile()
  await drawDailyFortune()
}
function startSelection() {
  operationError.value = ''
  if (!questionValid(question.value)) { operationError.value = text('请用 5–200 个字描述你的问题。', 'Describe your question in 5–200 characters.'); return }
  if (pending.value) return
  if (drawLocked.value) {
    if (allRevealed.value) void beginReading()
    else { phase.value = 'reveal'; tactile(); scrollTop() }
    return
  }
  else {
    if (!deck.value.length) deck.value = mobileDeck(activeCardIds.value)
    const continued = continueCardSelection(deck.value, selected.value, revealed.value, count.value)
    selected.value = continued.selected; revealed.value = continued.revealed; phase.value = 'select'
  }
  tactile(); scrollTop()
}
function reshuffleCards() { if (drawLocked.value) return; deck.value = mobileDeck(activeCardIds.value); selected.value = []; revealed.value = []; tactile() }
function chooseCard(id: number) {
  if (drawLocked.value) return
  if (selected.value.includes(id)) selected.value = selected.value.filter(value => value !== id)
  else if (selected.value.length < count.value) { selected.value = [...selected.value, id]; tactile() }
  revealed.value = revealed.value.filter(value => selected.value.includes(value))
}
function flip(id: number) { if (!revealed.value.includes(id)) { revealed.value = [...revealed.value, id]; tactile() } }
function revealAll() { revealed.value = chosenCards.value.map(card => card.id); tactile() }
function goBack() {
  if (accountMode.value) { accountAccess.value?.requestClose(); return }
  if (membershipOpen.value) { closeMembership(); return }
  if (benefitsOpen.value) { closeBenefits(); return }
  if (yesterdayOpen.value) { closeYesterday(); return }
  if (profileMode.value) { closeProfile(); return }
  if (loginOpen.value) { if (!loginBusy.value) loginOpen.value = false; return }
  if (readersOpen.value) { readersOpen.value = false; return }
  if (startingNewQuestion.value) { askActionSequence++; startingNewQuestion.value = false; tab.value = 'home'; scrollTop(); return }
  if (tab.value === 'ask' && (phase.value === 'select' || phase.value === 'reveal')) phase.value = previousDrawPhase(phase.value, !!carried.value, drawLocked.value)
  else if (tab.value === 'ask' && phase.value === 'result') { void returnToHistory(); return }
  else if (tab.value === 'history') { rememberHistory(); tab.value = 'home' }
  else tab.value = 'home'
  scrollTop()
}
async function beginReading() {
  refreshMembershipClock()
  if (readingPreparation.value || taskBusy.value || pending.value) return
  if (!allRevealed.value || !questionValid(question.value)) return
  const intendedPhase = phase.value
  if (intendedPhase !== 'reveal' && !(intendedPhase === 'question' && drawLocked.value)) return
  if (!mobileUser.value) { requestLogin('reading'); return }
  if (!online.value) { operationError.value = text('问卜需要联网，你选好的牌会保留。', 'Connect to begin. Your selected cards are saved.'); return }
  const scope = { owner: owner.value, sequence: hydrationSequence }
  const intendedReader = readerId.value, intendedSelection = readerSelectionSequence
  const intendedRevision = drawIntentRevision
  const drawSignature = () => JSON.stringify([question.value.trim(), count.value, chosenCards.value])
  const intendedDraw = drawSignature()
  const preparation = Symbol('reading-intent')
  readingPreparation.value = preparation
  try {
    if (!referenceReady.value) await loadReference()
    if (!responseScopeIsCurrent(scope, owner.value, hydrationSequence, disposed) || drawIntentRevision !== intendedRevision || tab.value !== 'ask' || phase.value !== intendedPhase || intendedDraw !== drawSignature() ||
      readerSelectionSequence !== intendedSelection || (intendedReader && readerId.value !== intendedReader)) return
    if (!currentReader.value) { operationError.value = readerUnavailableMessage.value || readerLoadError.value || text('请先选择本次塔罗师。', 'Choose a reader for this question.'); openReaderPicker(); return }
    const spread = referenceSpreads.value.find(value => value.id === (count.value === 1 ? 'single' : 'problem'))
    if (!spread || (spread.accessLevel === 'vip' && !activeVip.value)) { operationError.value = text('当前账号无法使用此牌阵，请选择其他牌阵。', 'This spread is unavailable for your account.'); return }
    const payload: MobileReadingPayload = { readerId: readerId.value, spreadType: spread.id, question: question.value.trim(), category: '其他',
      cardIds: chosenCards.value.map(card => card.id), orientations: chosenCards.value.map(card => card.isReversed ? 'reversed' : 'upright'), locale: readingLocale.value }
    await submitNewTask('reading', payload)
  } finally { if (readingPreparation.value === preparation) readingPreparation.value = null }
}
async function submitNewTask(kind: 'reading' | 'followup', payload: MobileReadingPayload | MobileFollowupPayload) {
  if (owner.value === null || pending.value || taskBusy.value) return
  const task: PendingMobileTask = { schema: 1, owner: owner.value, requestId: crypto.randomUUID(), kind, payload, createdAt: Date.now() }
  // Claim synchronously before slow native storage: two taps must share one UUID.
  taskBusy.value = true; pending.value = task
  try { await privateWrite('pending', task) } catch { if (pending.value?.requestId === task.requestId) pending.value = null; taskBusy.value = false; return }
  if (owner.value !== task.owner || pending.value?.requestId !== task.requestId) { taskBusy.value = false; return }
  failedTask.value = null; taskError.value = ''; taskNeedsResend.value = false; pollDelay = 5000
  void privateWrite('task-feedback', null, task.owner).catch(() => {})
  if (kind === 'reading') phase.value = 'waiting'
  taskBusy.value = false
  await transmitTask()
}
async function transmitTask() {
  const task = pending.value
  if (!task || task.owner !== owner.value || taskBusy.value || !online.value) return
  taskBusy.value = true; taskError.value = ''; taskNeedsResend.value = false
  try { await applyTask(await postMobileTask(task.kind, task.requestId, task.payload), task) }
  catch (error) {
    if (pending.value?.requestId !== task.requestId || owner.value !== task.owner) return
    const status = mobileHttpStatus(error)
    if ([400, 403, 422, 429].includes(status ?? 0)) {
      await failSubmittedTask(task, mobileError(error))
    } else {
      taskError.value = text('连接中断，正在核对原请求进度。你选好的牌会保留。', 'Connection interrupted. Checking the original request; your cards are saved.')
      schedulePoll(5000)
    }
  } finally { if (owner.value === task.owner) taskBusy.value = false }
}
function schedulePoll(delay = pollDelay) {
  window.clearTimeout(pollTimer)
  if (pending.value && !disposed && online.value && !document.hidden) pollTimer = window.setTimeout(() => { void pollTask() }, delay)
}
async function pollTask() {
  const task = pending.value
  const token = task ? `${task.owner}:${task.requestId}` : null
  if (!task || task.owner !== owner.value || pollingRequest === token || taskBusy.value || !online.value) { schedulePoll(); return }
  pollingRequest = token
  try { await applyTask(await fetchMobileTask(task.requestId), task) }
  catch (error) {
    if (pending.value?.requestId !== task.requestId || owner.value !== task.owner) return
    if (mobileHttpStatus(error) === 404) {
      taskNeedsResend.value = true
      taskError.value = text('尚未确认提交成功。可安全重试原请求，牌面和请求编号保持不变。', 'Submission is unconfirmed. Retry the same request with the same cards.')
    } else { taskError.value = mobileError(error); schedulePoll(mobileHttpStatus(error) === 429 ? mobileRetryAfter(error) || 60_000 : Math.max(10_000, pollDelay)) }
  } finally { if (pollingRequest === token) pollingRequest = null }
}
function submittedTaskIsCurrent(task: PendingMobileTask) { return !disposed && owner.value === task.owner && pending.value?.requestId === task.requestId }
async function clearSubmittedTask(task: PendingMobileTask) {
  const scope = { owner: task.owner, sequence: hydrationSequence }
  if (!submittedTaskIsCurrent(task)) return false
  await privateWrite('pending', null, task.owner).catch(() => {})
  if (!submittedTaskIsCurrent(task) || !responseScopeIsCurrent(scope, owner.value, hydrationSequence, disposed)) return false
  pending.value = null
  return true
}
async function failSubmittedTask(task: PendingMobileTask, message: string) {
  if (!submittedTaskIsCurrent(task)) return
  const scope = { owner: task.owner, sequence: hydrationSequence }
  await privateWrite('task-feedback', { schema: 1, task, message } satisfies MobileTaskFeedback, task.owner).catch(() => {})
  if (!responseScopeIsCurrent(scope, owner.value, hydrationSequence, disposed)) return
  if (!await clearSubmittedTask(task)) return
  const visible = completionIsVisible(task, owner.value, tab.value, phase.value, activeReadingId.value)
  failedTask.value = task; taskError.value = message; taskNeedsResend.value = false
  if (task.kind === 'reading' && visible) phase.value = carried.value && taskMatchesDraw(task, question.value, readerId.value, chosenCards.value) ? 'question' : 'reveal'
  if (!visible) notify(text('此前请求未完成，可回到原问题查看原因。', 'An earlier request failed. Return to its question for details.'))
}
function resultEntry(result: ReaderReadingResult, payload: MobileReadingPayload): MobileHistoryEntry {
  return { id: result.id, type: 'reader-reading', question: payload.question, cardIds: result.cards.map(card => card.id), orientations: result.cards.map(card => card.isReversed ? 'reversed' : 'upright'),
    answer: result.result.summary, resultData: result.result, readerId: result.reader.id, spreadType: result.spread.type, createdAt: new Date().toISOString() }
}
async function applyTask(status: MobileTask, submitted: PendingMobileTask) {
  if (!submittedTaskIsCurrent(submitted) || status.requestId !== submitted.requestId || status.kind !== submitted.kind) return
  taskError.value = ''; taskNeedsResend.value = false
  if (status.status === 'running') { schedulePoll(); pollDelay = Math.min(15000, Math.round(pollDelay * 1.4)); return }
  window.clearTimeout(pollTimer)
  if (status.status === 'failed') {
    await failSubmittedTask(submitted, status.error?.message || text('本次未生成成功，已退还预扣次数。', 'This request failed. Its reserved credit was returned.'))
    if (owner.value !== submitted.owner || disposed) return
    if (status.error?.code?.toLowerCase().includes('history')) {
      const missingId = taskReadingId(submitted)
      if (current.value?.id === missingId) { detailSequence++; current.value = null; await privateWrite('last', null, submitted.owner).catch(() => {}) }
      await privateWrite('history', null, submitted.owner).catch(() => {})
      if (owner.value === submitted.owner) history.value = history.value.filter(entry => entry.id !== missingId)
    }
    void refreshMobileProfile().catch(() => {})
    return
  }
  const readingId = completedReadingId(status, submitted)
  if (!readingId) { await failSubmittedTask(submitted, text('已收到完成状态，暂时无法定位记录。请稍后刷新记录。', 'The request completed, but its saved record is not available yet. Refresh history shortly.')); return }
  const visible = completionIsVisible(submitted, owner.value, tab.value, phase.value, activeReadingId.value)
  const refreshVersion = beginReadingRefresh(readingRefreshVersions, readingId)
  const completionScope = { owner: submitted.owner, sequence: hydrationSequence }
  const sameCompletionSession = () => responseScopeIsCurrent(completionScope, owner.value, hydrationSequence, disposed) && readingRefreshVersions.get(readingId) === refreshVersion
  if (submitted.kind === 'followup' && activeReadingId.value === readingId) { detailSequence++; currentLoading.value = false; currentError.value = '' }
  let completedEntry: MobileHistoryEntry | undefined
  if (submitted.kind === 'reading' && status.result && 'cards' in status.result) {
    completedEntry = resultEntry(status.result, submitted.payload as MobileReadingPayload)
    if (completedEntry.id !== readingId) completedEntry = undefined
  }
  const completedHomeDraft = tab.value === 'home' && activeReadingId.value === null && taskMatchesDraw(submitted, question.value, readerId.value, chosenCards.value)
  if (submitted.kind === 'reading' && (visible || completedHomeDraft)) {
    detailSequence++; currentLoading.value = false; currentError.value = ''; setReadingContext(readingId)
    current.value = completedEntry ?? null; phase.value = 'result'; cachedDetail.value = false
  }
  if (submitted.kind === 'followup') {
    const payload = submitted.payload as MobileFollowupPayload
    // Only the submitted record's draft is consumed. Another record's input stays untouched.
    const retained = consumeFollowupDraft(followupDrafts.value, activeReadingId.value, followup.value, readingId, payload.question)
    followupDrafts.value = retained.drafts; followup.value = retained.value
    const base = current.value?.id === readingId ? current.value : history.value.find(entry => entry.id === readingId)
    if (base && status.result && 'answer' in status.result && status.result.readingId === readingId) {
      const turns = savedFollowups(base), answer = status.result
      completedEntry = turns[turns.length - 1]?.question === answer.question && turns[turns.length - 1]?.answer === answer.answer ? base
        : { ...base, resultData: { ...historyObject(base), followups: [...turns, { question: answer.question, answer: answer.answer }] } }
      if (current.value?.id === readingId) current.value = completedEntry
      history.value = history.value.map(entry => entry.id === readingId ? completedEntry! : entry)
    }
  }
  if (completedEntry && current.value?.id === readingId) await privateWrite('last', completedEntry, submitted.owner).catch(() => {})
  if (!submittedTaskIsCurrent(submitted) || !sameCompletionSession()) return
  const completionDisplayed = () => owner.value === submitted.owner && tab.value === 'ask' && phase.value === 'result' && activeReadingId.value === readingId
  if (!completionDisplayed()) {
    completionNotice.value = { schema: 1, owner: submitted.owner, requestId: submitted.requestId, kind: submitted.kind, readingId, question: submitted.payload.question, completedAt: Date.now(), entry: completedEntry }
    await privateWrite('completion', completionNotice.value, submitted.owner).catch(() => {})
  }
  if (!await clearSubmittedTask(submitted)) return
  if (!sameCompletionSession()) return
  if (!completionDisplayed() && completionNotice.value?.requestId !== submitted.requestId) {
    completionNotice.value = { schema: 1, owner: submitted.owner, requestId: submitted.requestId, kind: submitted.kind, readingId, question: submitted.payload.question, completedAt: Date.now(), entry: completedEntry }
    await privateWrite('completion', completionNotice.value, submitted.owner).catch(() => {})
    if (!sameCompletionSession()) return
  }
  await privateWrite('followup-drafts', { ...followupDrafts.value }, submitted.owner).catch(() => {})
  if (!sameCompletionSession()) return
  const sequence = detailSequence
  try {
    const entry = await fetchMobileReading(readingId)
    if (!sameCompletionSession()) return
    // Detail requests started by navigation take precedence over this background refresh.
    if (activeReadingId.value === readingId && sequence === detailSequence) {
      current.value = entry; cachedDetail.value = false
      await privateWrite('last', entry, submitted.owner).catch(() => {})
    }
    if (!sameCompletionSession()) return
    history.value = history.value.map(item => item.id === readingId ? entry : item)
    if (completionNotice.value?.requestId === submitted.requestId) {
      completionNotice.value = { ...completionNotice.value, entry }
      await privateWrite('completion', completionNotice.value, submitted.owner).catch(() => {})
    }
  } catch { /* The response snapshot or explicit record reload remains available. */ }
  if (!sameCompletionSession()) return
  if (!visible) notify(submitted.kind === 'followup' ? text('此前记录的追问已完成，点击完成提示查看。', 'A follow-up is ready. Open its completion notice.') : text('解读已完成，点击完成提示查看。', 'Your reading is ready. Open its completion notice.'))
  else notify(text('解读已保存到记录。', 'Your reading has been saved.'))
  tactile(); void refreshMobileProfile().catch(() => {})
  if (tab.value === 'history') {
    if (historyLoading.value) { historyRefreshNeeded = true; return }
    rememberHistory()
    const saved = historyReturn.value
    await loadHistory(historyPage.value)
    await nextTick()
    if (saved && owner.value === submitted.owner && tab.value === 'history') window.scrollTo({ top: saved.scrollY, behavior: 'instant' })
  }
}
async function openCompletedReading() {
  if (!startupReady.value) return
  const notice = completionNotice.value
  if (!validCompletionNotice(notice, owner.value)) return
  await openReading(notice.readingId)
  if (owner.value === notice.owner && activeReadingId.value === notice.readingId) {
    // Keep the notice when there is neither a cached response nor a fetched detail.
    if (current.value?.id === notice.readingId) await clearCompletionNotice(notice.requestId)
  }
}
async function openPendingReading() {
  const task = pending.value || failedTask.value
  if (task) await openTaskReading(task)
}
async function openTaskReading(task: PendingMobileTask) {
  if (!startupReady.value) return
  if (!task || task.owner !== owner.value) return
  if (task.kind === 'followup') { await openReading((task.payload as MobileFollowupPayload).readingId); return }
  const id = owner.value, action = ++askActionSequence
  startingNewQuestion.value = true
  try { if (!await preserveAskContext() || id !== owner.value || action !== askActionSequence) return }
  catch { return }
  finally { if (action === askActionSequence) startingNewQuestion.value = false }
  if (completionNotice.value?.requestId === task.requestId) { await openCompletedReading(); return }
  if (tab.value === 'history') rememberHistory()
  {
    detailSequence++; currentLoading.value = false; currentError.value = ''; current.value = null; setReadingContext(null)
    const payload = task.payload as MobileReadingPayload
    const originalCarried = carried.value && payload.spreadType === 'single' && payload.cardIds[0] === carried.value.id && (payload.orientations[0] === 'reversed') === carried.value.isReversed ? { ...carried.value } : null
    question.value = payload.question; readerId.value = payload.readerId; carried.value = originalCarried; count.value = payload.cardIds.length === 3 ? 3 : 1
    if (!payload.cardIds.every((id, index) => deck.value.some(card => card.id === id && card.isReversed === (payload.orientations[index] === 'reversed')))) {
      deck.value = payload.cardIds.map((id, index) => ({ id, isReversed: payload.orientations[index] === 'reversed' }))
    }
    selected.value = [...payload.cardIds]; revealed.value = [...payload.cardIds]
    askOpened = true; tab.value = 'ask'; phase.value = pending.value?.requestId === task.requestId ? 'waiting' : carried.value ? 'question' : 'reveal'; scrollTop()
  }
}
async function sendFollowup() {
  refreshMembershipClock()
  if (!current.value || !canFollowup.value || !followupValid(followup.value) || pending.value || !online.value) return
  if (!activeVip.value && (mobileUser.value?.remainingFreeQuota ?? 0) <= 0) { notify(text('今日免费次数已用完，请查看会员与可用次数。', 'No free credits left. Check your membership and credits.')); return }
  await submitNewTask('followup', { readingId: current.value.id, question: followup.value.trim(), locale: readingLocale.value })
}
async function loadHistory(targetPage = 1) {
  if (!mobileUser.value) return
  const id = owner.value, sequence = ++historySequence, query = search.value.trim(), filters = { ...historyFilters.value }
  const filtered = !!(query || filters.type || filters.from || filters.to)
  historyLoading.value = true; historyError.value = ''
  try {
    await loadMobileHistoryPage({
      cacheEligible: targetPage === 1 && !filtered,
      connected: online.value,
      isCurrent: () => responseScopeIsCurrent({ owner: id, sequence }, owner.value, historySequence, disposed),
      // Do not replace an already displayed list with an older disk snapshot.
      readCache: () => history.value.length ? Promise.resolve(null) : readMobileValue(key('history', id)),
      fetchPage: () => fetchMobileHistory({ page: targetPage, search: query || undefined, type: filters.type || undefined, dateFrom: filters.from || undefined, dateTo: filters.to || undefined }),
      show: (page, cached) => {
        history.value = page.items; historyTotal.value = page.total; historyPage.value = page.page; historyPages.value = page.totalPages
        historyCached.value = cached; historyLoaded.value = true
      },
      saveCache: page => privateWrite('history', page, id),
      fail: error => { historyError.value = mobileError(error) },
      offline: () => { historyError.value = historyLoaded.value
        ? text('当前离线，可以查看已保存的记录。联网后可同步最新记录。', 'You are offline. Saved readings remain available; reconnect to sync updates.')
        : text('当前离线，暂无符合条件的本机记录。请联网后重试。', 'You are offline and no cached readings are available for this view. Reconnect and retry.') },
    })
  } finally {
    if (sequence === historySequence && id === owner.value) {
      historyLoading.value = false
      if (historyRefreshNeeded && tab.value === 'history') { historyRefreshNeeded = false; void loadHistory(historyPage.value) }
    }
  }
}
function historySearch(value: string) { search.value = value.slice(0, 100); history.value = []; historyCached.value = false; historyLoaded.value = false; void loadHistory(1) }
function applyHistoryFilters(value: MobileHistoryFilters) {
  if (historyFilterError(value, english.value)) return
  historyFilters.value = { ...value }; history.value = []; historyCached.value = false; historyLoaded.value = false; void loadHistory(1)
}
async function saveReadingReview(value: { rating: 'full' | 'partial' | 'none' }) {
  if (!current.value || !mobileUser.value || reviewSaving.value || !online.value || cachedDetail.value || currentLoading.value || !reviewEligible.value) return
  const id = current.value.id, userId = owner.value, sequence = ++reviewSequence
  reviewSaving.value = true; reviewError.value = ''
  try {
    await saveMobileReadingOutcome(id, value.rating)
    if (disposed || sequence !== reviewSequence || userId !== owner.value || current.value?.id !== id) return
    // A confirmed write may be followed by a failed read; never resubmit it automatically.
    const entry = await fetchMobileReading(id)
    if (disposed || sequence !== reviewSequence || userId !== owner.value || current.value?.id !== id) return
    current.value = entry; history.value = history.value.map(item => item.id === id ? entry : item)
    await privateWrite('last', entry, userId).catch(() => {})
    await privateWrite('history', null, userId).catch(() => {})
    notify(text('回顾已保存。', 'Reflection saved.'))
  } catch (error) {
    if (!disposed && sequence === reviewSequence && userId === owner.value && current.value?.id === id) reviewError.value = mobileError(error, text('暂未能确认最新回顾，请重新加载这条记录查看。', 'Reload this reading to check the latest reflection.'))
  } finally { if (sequence === reviewSequence && userId === owner.value) reviewSaving.value = false }
}
async function openReading(id: number, navigate = true) {
  reviewSequence++; reviewSaving.value = false; reviewError.value = ''
  if (navigate && !startupReady.value) return
  const userId = owner.value
  if (userId === null) { requestLogin('history'); return }
  if (navigate) {
    const action = ++askActionSequence
    startingNewQuestion.value = true
    try { if (!await preserveAskContext() || userId !== owner.value || action !== askActionSequence) return }
    catch { return }
    finally { if (action === askActionSequence) startingNewQuestion.value = false }
  }
  const sequence = ++detailSequence
  if (navigate && tab.value === 'history') rememberHistory()
  currentError.value = ''; currentLoading.value = true
  const cached = (current.value?.id === id ? current.value : null) || (recentReading.value?.id === id ? recentReading.value : null) || (completionNotice.value?.owner === userId && completionNotice.value.readingId === id ? completionNotice.value.entry : null) || history.value.find(entry => entry.id === id) || null
  setReadingContext(id)
  current.value = cached; cachedDetail.value = !!cached
  if (navigate) { askOpened = true; tab.value = 'ask'; phase.value = 'result'; scrollTop() }
  try {
    const entry = await fetchMobileReading(id)
    if (!responseScopeIsCurrent({ owner: userId, sequence }, owner.value, detailSequence, disposed)) return
    current.value = entry; cachedDetail.value = false
    await privateWrite('last', entry, userId).catch(() => {})
  } catch (error) {
    if (!responseScopeIsCurrent({ owner: userId, sequence }, owner.value, detailSequence, disposed)) return
    currentError.value = mobileError(error)
    if (mobileHttpStatus(error) === 404) {
      current.value = null; history.value = history.value.filter(entry => entry.id !== id)
      await privateWrite('last', null, userId).catch(() => {})
      await privateWrite('history', null, userId).catch(() => {})
    }
  } finally { if (sequence === detailSequence && owner.value === userId) currentLoading.value = false }
}
async function removeReading(id: number) {
  if (pending.value || deletingId.value) { notify(text('请先等当前解读完成。', 'Wait until the current reading finishes.')); return }
  if (!window.confirm(text('删除这条记录及其追问？此操作无法撤销。', 'Delete this reading and its follow-ups? This cannot be undone.'))) return
  const userId = owner.value, sequence = hydrationSequence
  deletingId.value = id
  try {
    await deleteMobileReading(id)
    if (userId !== owner.value || sequence !== hydrationSequence || disposed) return
    if (activeReadingId.value === id) { detailSequence++; current.value = null; setReadingContext(null); await privateWrite('last', null, userId) }
    else if (recentReading.value?.id === id) await privateWrite('last', null, userId)
    if (completionNotice.value?.readingId === id) await clearCompletionNotice()
    delete followupDrafts.value[id]
    await privateWrite('history', null, userId)
    if (userId !== owner.value || sequence !== hydrationSequence || disposed) return
    await loadHistory(historyPage.value)
    notify(text('记录已删除。', 'Reading deleted.'))
  } catch (error) { if (userId === owner.value && sequence === hydrationSequence) historyError.value = mobileError(error) }
  finally { if (userId === owner.value && sequence === hydrationSequence) deletingId.value = null }
}
async function openWebsite(path: string) {
  const url = new URL(path, mobileWebsiteOrigin).href
  if (Capacitor.isNativePlatform()) await Browser.open({ url })
  else window.open(url, '_blank', 'noopener,noreferrer')
}
function onConnectivity() {
  const reconnected = !online.value && navigator.onLine
  online.value = navigator.onLine
  if (online.value) { void loadReference(); void pollTask(); if (reconnected) refreshVisibleHistory() }
}
function refreshVisibleHistory() {
  if (tab.value !== 'history' || !mobileUser.value || !online.value) return
  if (historyLoading.value) historyRefreshNeeded = true
  else void loadHistory(historyPage.value)
}
function onVisible() {
  if (!document.hidden) { refreshMembershipClock(); void pollTask(); void refreshDailyFortune(); if (mobileUser.value) void refreshMobileProfile().catch(() => {}); void refreshMobileUpdater().then(quietlyCheckMobileUpdate) }
  else { window.clearTimeout(pollTimer); void saveDraft().catch(() => {}) }
}
function viewportChanged() { if (!Capacitor.isNativePlatform() && window.visualViewport) keyboardOpen.value = window.innerHeight - window.visualViewport.height > 140 }
onMounted(async () => {
  document.title = 'E-Tomd · ' + text('抽牌与问卜', 'Draw & Ask')
  window.addEventListener('online', onConnectivity); window.addEventListener('offline', onConnectivity); document.addEventListener('visibilitychange', onVisible)
  window.visualViewport?.addEventListener('resize', viewportChanged)
  window.addEventListener('keydown', modalKeydown)
  if (Capacitor.isNativePlatform()) { try { online.value = (await Network.getStatus()).connected } catch { /* browser connectivity remains available */ } }
  void loadReference()
  void initializeMobileUpdater()
  // Restore local state before allowing interaction; a slow profile request must not overwrite new input.
  try { await initializeMobileSession(false) } catch { if (mobileUser.value) notify(text('本机账号暂时无法恢复，请重新登录。', 'Your saved account could not be restored. Please sign in again.')) }
  await hydratePrivate(false, true)
  if (disposed) return
  startupReady.value = true
  void quietlyCheckMobileUpdate()
  if (online.value && mobileUser.value) void refreshMobileProfile().catch(() => {})
  if (!Capacitor.isNativePlatform() || disposed) return
  const addHandle = async (promise: Promise<PluginListenerHandle>) => { const handle = await promise; if (disposed) await handle.remove(); else handles.push(handle) }
  void addHandle(NativeApp.addListener('appStateChange', state => {
    if (state.isActive) onVisible(); else { window.clearTimeout(pollTimer); void saveDraft().catch(() => {}) }
  })).catch(() => {})
  void addHandle(NativeApp.addListener('backButton', () => {
    if (tab.value === 'home' && !accountMode.value && !loginOpen.value && !readersOpen.value && !yesterdayOpen.value && !membershipOpen.value && !benefitsOpen.value) void NativeApp.exitApp()
    else goBack()
  })).catch(() => {})
  void addHandle(Network.addListener('networkStatusChange', status => { const reconnected = !online.value && status.connected; online.value = status.connected; if (reconnected) { void loadReference(); void pollTask(); refreshVisibleHistory() } })).catch(() => {})
  void addHandle(Keyboard.addListener('keyboardWillShow', () => { keyboardOpen.value = true })).catch(() => {})
  void addHandle(Keyboard.addListener('keyboardWillHide', () => { keyboardOpen.value = false })).catch(() => {})
})
onBeforeUnmount(() => {
  disposeMobileUpdater()
  disposed = true; historySequence++; detailSequence++; window.clearTimeout(pollTimer); window.clearTimeout(draftTimer); window.clearTimeout(toastTimer); window.clearTimeout(membershipTimer)
  window.removeEventListener('online', onConnectivity); window.removeEventListener('offline', onConnectivity); document.removeEventListener('visibilitychange', onVisible)
  window.visualViewport?.removeEventListener('resize', viewportChanged); for (const handle of handles) void handle.remove()
  window.removeEventListener('keydown', modalKeydown)
})
</script>


<template>
  <div class="mobile-shell" :class="[`mobile-tab-${tab}`, `mobile-phase-${phase}`, { 'mobile-keyboard': keyboardOpen, 'mobile-is-home': tab === 'home', 'mobile-web-surface': tab === 'home' || (tab === 'ask' && phase === 'result') }]">
    <header v-if="tab !== 'me'" class="mobile-header">
      <template v-if="tab === 'ask'">
        <button type="button" class="mobile-header-back" @click="goBack"><ChevronLeft :size="23" /><span>{{ text('返回', 'Back') }}</span></button>
        <p class="mobile-header-title">{{ headerTitle }}</p>
        <button type="button" class="mobile-header-new" :disabled="startingNewQuestion || !startupReady" @click="startFreshQuestion">{{ startingNewQuestion ? text('正在开启…', 'Opening…') : text('新问卜', 'New reading') }}</button>
      </template>
      <template v-else-if="tab === 'history'"><p class="mobile-header-title">{{ text('记录', 'Readings') }}</p></template>
      <template v-else>
        <a href="/app" class="mobile-brand" @click.prevent="changeTab('home')">E-Tomd</a>
        <button v-if="tab === 'home'" type="button" class="mobile-account" :disabled="!mobileSessionReady || !startupReady" @click="mobileUser ? changeTab('me') : requestLogin()"><UserRound :size="18" />{{ mobileUser?.nickname || text('登录', 'Sign in') }}</button>
      </template>
    </header>
    <div v-if="!online || (referenceFailed && tab !== 'home')" class="mobile-offline" role="status">{{ tab === 'home' ? text('当前离线，可查看本机保存的今日运势。', 'You are offline. Saved daily fortunes remain available.') : text('离线牌库可用。问卜与云端同步需要网络。', 'Offline cards are ready. Readings and sync need a connection.') }}<button v-if="online" type="button" @click="loadReference">{{ text('重连', 'Retry') }}</button></div>
    <p v-if="storageError && tab !== 'home'" role="alert" class="mobile-error mobile-storage-error">{{ storageError }}</p>
    <div v-if="tab !== 'home' && !(tab === 'ask' && phase === 'question') && (pendingElsewhere || completionNotice || failedTaskElsewhere)" class="mobile-task-notices">
      <button v-if="pendingElsewhere" type="button" class="mobile-pending-link" @click="openPendingReading"><span>{{ text('正在解读', 'Reading in progress') }} · {{ pendingReadingQuestion }}</span><strong>{{ text('查看进度', 'View progress') }} →</strong></button>
      <button v-if="completionNotice" type="button" class="mobile-finished" @click="openCompletedReading"><span>{{ completionNotice.kind === 'followup' ? text('追问已完成', 'Your follow-up is ready') : text('解读已完成', 'Your reading is ready') }} · {{ completionNotice.question }}</span><strong>{{ text('点击查看', 'Open it') }} →</strong></button>
      <button v-if="failedTaskElsewhere" type="button" class="mobile-failed-link" @click="openPendingReading"><span>{{ text('生成未完成', 'Reading could not finish') }} · {{ failedReadingQuestion }}</span><strong>{{ text('查看详情', 'View details') }} →</strong></button>
    </div>
    <main class="mobile-main">
      <section v-if="tab === 'home'" class="mobile-home" :aria-label="text('每日运势', 'Daily fortune')">
        <MobileHomeDraw :card="dailyCard" :flipped="dailyFlipped" :english="english" :image-url="imageOverrides[dailyCard.id]" :busy="!startupReady || dailyBusy" @draw="openDailyDraw">
          <MobileDailyResult :response="dailyResponse" :busy="dailyBusy" :error="dailyError" :english="english" :cached="dailyCached" @retry="openDailyDraw" @yesterday="showYesterday" />
        </MobileHomeDraw>
        <MobileDailyResult v-if="!dailyFlipped && dailyError" :response="null" :busy="dailyBusy" :error="dailyError" :english="english" @retry="openDailyDraw" />
      </section>

      <section v-else-if="tab === 'ask'" :aria-label="text('问卜', 'Ask')" class="mobile-ask">
        <div v-if="startingNewQuestion" class="mobile-ask-opening" role="status">{{ text('正在保存上次进度…', 'Saving your previous progress…') }}</div>
        <template v-else>
        <MobileAskResume :items="askResumeItems" :english="english" @resume="restoreAskItem" />
        <template v-if="phase === 'question'">
          <div class="mobile-question-intro"><h1>{{ text('你想问什么？', 'What is on your mind?') }}</h1><p class="mobile-subtitle">{{ text('从一个具体的问题开始。', 'Begin with one clear question.') }}</p></div>
          <p v-if="pending" class="mobile-ask-pending-note" role="status">{{ text('上一次解读仍在进行，可以先写新问题，完成后继续抽牌。', 'Your previous reading is still running. You can write a new question now and draw once it finishes.') }}</p>
          <form @submit.prevent="startSelection">
            <label class="mobile-label" for="mobile-question">{{ text('你的问题', 'Your question') }}<span>{{ question.trim().length }} / 200</span></label>
            <textarea id="mobile-question" :aria-label="text('你的问题','Your question')" v-model="question" maxlength="200" rows="4" :placeholder="text('例如：面对新的工作机会，我应该关注什么？', 'For example: What should I consider about a new job opportunity?')" class="mobile-input mobile-question" />
            <div class="mobile-examples">
              <button type="button" :aria-pressed="question === text('面对新的工作机会，我应该关注什么？', 'What should I consider about this new job opportunity?')" @click="question = text('面对新的工作机会，我应该关注什么？', 'What should I consider about this new job opportunity?')">{{ text('工作选择', 'Career') }}</button>
              <button type="button" :aria-pressed="question === text('怎样改善我们最近的沟通方式？', 'How can I improve our communication?')" @click="question = text('怎样改善我们最近的沟通方式？', 'How can I improve our communication?')">{{ text('关系沟通', 'Relationships') }}</button>
              <button type="button" :aria-pressed="question === text('我可以从哪件小事找回生活节奏？', 'What small step could help me find my rhythm again?')" @click="question = text('我可以从哪件小事找回生活节奏？', 'What small step could help me find my rhythm again?')">{{ text('自我成长', 'Growth') }}</button>
            </div>
            <div v-if="carried" class="mobile-carried"><img :src="getOfflineCardImageUrl(findOfflineCard(carried.id)!.nameEn)" :alt="`${cardName(carried)} · ${orientation(carried)}`" :style="{ transform: carried.isReversed ? 'rotate(180deg)' : undefined }"><div><strong>{{ cardName(carried) }} · {{ orientation(carried) }}</strong><p>{{ text('已保留刚才翻出的牌，填写问题后直接占卜。', 'Your revealed card is kept. Ask your question to get its reading.') }}</p></div></div>
            <div v-else-if="drawLocked" class="mobile-carried"><div class="mobile-locked-cards"><img v-for="card in chosenCards" :key="card.id" :src="revealed.includes(card.id) ? getOfflineCardImageUrl(findOfflineCard(card.id)!.nameEn) : backImage" :alt="revealed.includes(card.id) ? `${cardName(card)} · ${orientation(card)}` : text('未翻开的牌', 'Unrevealed card')" :style="{ transform: revealed.includes(card.id) && card.isReversed ? 'rotate(180deg)' : undefined }"></div><div><strong>{{ text(`已保留本次 ${count} 张牌`, `${count === 1 ? 'Your card is' : 'Your cards are'} kept`) }}</strong><p>{{ text('可以修改问题，牌面和方向保持不变。', 'You can edit your question. Your cards and orientations stay the same.') }}</p></div></div>
            <fieldset v-else class="mobile-fieldset">
              <legend>{{ text('怎么抽牌', 'Choose your spread') }}</legend>
              <div class="mobile-spread-options">
                <button type="button" :aria-pressed="count === 1" @click="count = 1"><span class="mobile-spread-heading"><span class="mobile-spread-icon" aria-hidden="true"><Moon :size="24" /></span><strong>{{ text('单卡', 'One card') }}</strong></span><span class="mobile-spread-copy">{{ text('一个启发，直面当下', 'A focused insight') }}</span></button>
                <button type="button" :aria-pressed="count === 3" @click="count = 3"><span class="mobile-spread-heading"><span class="mobile-spread-icon" aria-hidden="true"><Layers :size="24" /></span><strong>{{ text('三卡', 'Three cards') }}</strong></span><span class="mobile-spread-copy">{{ threeCardPositions.join(english ? ', ' : '、') }}</span></button>
              </div>
            </fieldset>
            <div class="mobile-reader"><MobileReaderAvatar :reader="selectedReaderAvatar" :name="readerEntryName" /><div class="mobile-reader-copy"><span>{{ text('本次塔罗师', 'Reader for this question') }}</span><strong>{{ readerEntryName }}</strong></div><button type="button" class="mobile-text-button" @click="openReaderPicker">{{ readerId ? text('更换', 'Change') : text('选择', 'Choose') }}<ArrowUpRight :size="17" /></button></div>
            <p v-if="readerUnavailableMessage || readerLoadError" class="mobile-error" role="status">{{ readerUnavailableMessage || readerLoadError }}</p>
            <p v-if="drawLocked && currentTaskError" class="mobile-error" role="alert">{{ currentTaskError }}</p>
            <p v-if="operationError" role="alert" class="mobile-error">{{ operationError }}</p>
            <button type="submit" class="mobile-primary" :disabled="!!readingPreparation || taskBusy || !!pending">{{ readingPreparation || taskBusy ? text('正在提交…', 'Submitting…') : drawLocked ? allRevealed ? text('解读原牌', 'Read these cards') : text('继续翻开原牌', 'Continue revealing') : text('开始抽牌', 'Choose your cards') }}<ArrowRight :size="22" /></button>
            <p class="mobile-credit-note">{{ activeVip ? text('会员解读与追问不消耗每日免费次数。', 'VIP readings and follow-ups do not use daily free credits.') : text('选牌和翻牌免费。免费账号的解读与追问各使用 1 次额度。', 'Choosing and revealing cards is free. Free accounts use one credit per reading or follow-up.') }}</p>
          </form>
        </template>
        <template v-else-if="phase === 'select'">
          <h1>{{ text('挑选与你有缘的牌。', 'Choose the cards that call to you.') }}</h1>
          <p class="mobile-question-summary">{{ question }}</p>
          <p class="mobile-progress" aria-live="polite"><span>{{ text('已选', 'Selected') }} <strong>{{ selected.length }} / {{ count }}</strong></span><small>{{ selected.length < count ? text(`再选 ${count - selected.length} 张`, `Choose ${count - selected.length} more`) : text('已选满，可以翻牌', 'Ready to reveal') }}</small></p>
          <div class="mobile-slots" :aria-label="text('已选牌位', 'Selected card positions')">
            <div v-for="position in count" :key="position" :class="{ 'mobile-slot-filled': selected[position - 1] !== undefined }">
              <div class="mobile-slot-card"><template v-if="selected[position - 1] !== undefined"><img :src="backImage" alt=""><span class="mobile-slot-check" aria-hidden="true">✓</span></template><span v-else>{{ String(position).padStart(2,'0') }}</span></div>
              <small>{{ cardPositions[position - 1] }}</small>
            </div>
          </div>
          <p class="mobile-subtitle mobile-deck-hint">{{ text('左右滑动牌堆，点击选择。再次点击可取消。', 'Swipe the deck and tap a card. Tap again to deselect.') }}</p>
          <div class="mobile-deck" :aria-label="text('待选牌堆', 'Card deck')"><button v-for="(card,index) in deck" :key="card.id" type="button" :aria-label="text(`选择第 ${index + 1} 张牌`, `Choose card ${index + 1}`)" :aria-pressed="selected.includes(card.id)" :disabled="selected.length >= count && !selected.includes(card.id)" @click="chooseCard(card.id)"><img :src="backImage" alt="" draggable="false"><span v-if="selected.includes(card.id)" aria-hidden="true">✓</span></button></div>
          <button type="button" class="mobile-primary" :disabled="selected.length !== count" @click="phase = 'reveal'; scrollTop()">{{ text('选好了，翻开它们', 'Reveal your cards') }}</button>
          <button type="button" class="mobile-text-button mobile-centered" @click="reshuffleCards">{{ text('重新洗牌', 'Shuffle again') }}</button>
          <p class="mobile-credit-note">{{ text('选牌和翻牌免费', 'Choosing and revealing cards is free') }}</p>
        </template>
        <template v-else-if="phase === 'reveal'">
          <p class="mobile-eyebrow">{{ text('不急，听听自己的直觉', 'Take your time') }}</p>
          <h1>{{ carried ? text('带着这张牌，继续。', 'Continue with your card.') : text('一张张，慢慢翻开。', 'Reveal them, one by one.') }}</h1>
          <p class="mobile-question-summary">{{ question }}</p>
          <p class="mobile-progress" aria-live="polite"><span>{{ text('已翻开', 'Revealed') }} <strong>{{ carried ? chosenCards.length : revealed.length }} / {{ count }}</strong></span></p>
          <div class="mobile-reveal-cards">
            <div v-for="(card,index) in chosenCards" :key="card.id"><span class="mobile-position-label">{{ cardPositions[index] }}</span><MobileFlipCard :card="card" :revealed="!!carried || revealed.includes(card.id)" :compact="count === 3" :english="english" :image-url="imageOverrides[card.id]" :label="text(`翻开第 ${index + 1} 张牌`, `Reveal card ${index + 1}`)" @flip="flip(card.id)" /><p v-if="carried || revealed.includes(card.id)">{{ cardName(card) }}<small class="mobile-orientation-chip" :class="{ 'is-reversed': card.isReversed }">{{ orientation(card) }}</small></p><p v-else>{{ text('轻触翻开', 'Tap to reveal') }}</p></div>
          </div>
          <button v-if="!allRevealed" type="button" class="mobile-text-button mobile-centered" @click="revealAll">{{ text('全部翻开', 'Reveal all') }}</button>
          <div class="mobile-reading-reader"><MobileReaderAvatar :reader="selectedReaderAvatar" :name="readerEntryName" :size="36" /><div><span>{{ text('本次塔罗师', 'Reader for this question') }}</span><strong>{{ readerEntryName }}</strong></div><button type="button" class="mobile-text-button" @click="openReaderPicker">{{ text('更换', 'Change') }}</button></div>
          <p v-if="readerUnavailableMessage || readerLoadError" class="mobile-error" role="status">{{ readerUnavailableMessage || readerLoadError }}</p>
          <p v-if="currentTaskError" role="alert" class="mobile-error">{{ currentTaskError }}</p><p v-if="operationError" role="alert" class="mobile-error">{{ operationError }}</p>
          <button type="button" class="mobile-primary" :disabled="!allRevealed || taskBusy || !currentReader" @click="beginReading">{{ taskBusy ? text('正在提交…','Submitting…') : text('查看解读', 'Get your reading') }}<ArrowRight :size="22" /></button>
          <p class="mobile-credit-note">{{ mobileUser ? activeVip ? text('会员权益可用', 'Your membership is active') : text(`今日剩余 ${mobileUser.remainingFreeQuota} 次 · 本次解读使用 1 次`, `${mobileUser.remainingFreeQuota} credits remaining · Uses 1 credit`) : text('登录后解读，你的问题与牌面会完整保留。','Sign in to continue. Your question and cards are kept.') }}</p>
        </template>
        <template v-else-if="phase === 'waiting'">
          <div class="mobile-waiting"><span class="mobile-orbit" aria-hidden="true"><Sparkles :size="44" /></span><h1>{{ text('正在听懂你的问题…', 'Reading your cards…') }}</h1><p>{{ question }}</p><p class="mobile-subtitle">{{ text('可以切到其他页面，回来仍是同一次解读。', 'You can leave this screen and return to the same reading.') }}</p><p v-if="taskError" role="status" class="mobile-error">{{ taskError }}</p><button v-if="taskNeedsResend" type="button" class="mobile-primary" :disabled="taskBusy || !online" @click="transmitTask">{{ text('继续原请求', 'Retry original request') }}</button><button v-else type="button" class="mobile-secondary" :disabled="taskBusy || !online" @click="pollTask">{{ text('查看进度', 'Check progress') }}</button></div>
        </template>
        <template v-else>
          <p v-if="currentLoading" role="status" class="mobile-subtitle">{{ text('正在同步记录…','Syncing your reading…') }}</p><p v-if="currentError" role="alert" class="mobile-error">{{ currentError }}<button v-if="current" type="button" class="mobile-text-button" @click="openReading(current.id)">{{ text('重试','Retry') }}</button></p>
          <template v-if="current">
            <p v-if="cachedDetail" class="mobile-cache-note">{{ text('本机缓存 · 联网后同步最新记录', 'Cached copy · Syncs when connected') }}</p>
            <MobileReadingConversation :key="current.id" :entry="current" :english="english" :reader="readingReader" :reader-name="readingReaderName" :positions="readingPositions" :image-overrides="imageOverrides" :pending-question="pendingConversationQuestion" />
            <button v-if="currentTaskNeedsResend" type="button" class="mobile-text-button" @click="transmitTask">{{ text('继续原请求','Retry original request') }}</button>
            <p v-if="currentTaskError" role="alert" class="mobile-error">{{ currentTaskError }}</p>
            <p v-if="followupUnavailableMessage" class="mobile-credit-note" role="status">{{ followupUnavailableMessage }}</p>
            <p v-else-if="current.type !== 'reader-reading'" class="mobile-credit-note">{{ text('这是一条旧版记录。可回看原文，开启新的问卜继续探索。','This is a legacy reading. You can review it or start a new question.') }}</p>
            <MobileReadingReview v-if="current.question" :key="`review-${current.id}`" :english="english" :value="readingOutcome" :loading="currentLoading" :saving="reviewSaving" :error="reviewError" :eligible="reviewEligible" :online="online && !cachedDetail" @save="saveReadingReview" @retry="openReading(current.id, false)" />
            <MobileFollowupComposer v-if="canFollowup" v-model="followup" :key="current.id" :question="current.question || text('每日启发','Daily guidance')" :reader-name="readingReaderName" :english="english" :busy="!!pending" :pending-for-current="!!currentPendingFollowup" :online="online" :active-vip="activeVip" :remaining-quota="mobileUser?.remainingFreeQuota ?? null" :resets-at="mobileUser?.quotaResetsAt" :quota-refreshing="quotaRefreshing" @refresh-quota="refreshQuota" @submit="sendFollowup" @open-pending="openPendingReading" />
          </template>
          <div v-else-if="!currentLoading" class="mobile-empty"><h1>{{ text('从一个问题开始。','Begin with a question.') }}</h1><button type="button" class="mobile-primary" @click="startFreshQuestion">{{ text('开始问卜','Ask a question') }}</button></div>
        </template>
        </template>
      </section>

      <section v-else-if="tab === 'history'" class="mobile-history-view" :aria-label="text('历史记录','Reading history')">
        <template v-if="mobileUser"><p v-if="historyCached" class="mobile-cache-note">{{ text('正在显示本机缓存，联网后可刷新最新记录。','Showing cached readings. Reconnect to refresh.') }}</p><MobileHistory :entries="history" :readers="referenceReaders" :loading="historyLoading" :loaded="historyLoaded" :error="historyError" :page="historyPage" :total-pages="historyPages" :total="historyTotal" :search="search" :english="english" :deleting-id="deletingId" :filters="historyFilters" @filters="applyHistoryFilters" @search="historySearch" @page="loadHistory" @retry="loadHistory(historyPage)" @open="openReading" @delete="removeReading" /></template>
        <div v-else class="mobile-empty"><span class="mobile-empty-icon" aria-hidden="true"><HistoryIcon :size="30" /></span><h1>{{ text('把启发留在这里。','Keep your insights here.') }}</h1><p>{{ text('登录后，原问题、牌面和追问会同步到你的账号。','Sign in to keep your questions, cards and conversations together.') }}</p><button type="button" class="mobile-primary" :disabled="!mobileSessionReady" @click="requestLogin('history')">{{ text('登录查看记录','Sign in to view history') }}</button></div>
      </section>

      <section v-else :aria-label="text('我的','Me')" class="mobile-me">
        <MobileAccountPanel :user="mobileUser" :active-vip="activeVip" :locale="String(locale)" :site="mobileSite" :session-ready="mobileSessionReady && startupReady" :logout-busy="logoutBusy" @login="requestLogin()" @logout="signOut" @update:locale="changeLanguage" @website="openWebsite" @avatar="openProfile('avatar')" @birth="openProfile('birth')" @history="changeTab('history')" @redeem="openMembership" @benefits="openBenefits" @security="openAccountAccess">
          <template #updates><MobileUpdatePanel :english="english" /></template>
        </MobileAccountPanel>
      </section>
    </main>
    <nav v-show="!keyboardOpen" class="mobile-nav" :aria-label="text('主导航','Main navigation')"><button v-for="item in navItems" :key="item.key" type="button" :disabled="!startupReady" :aria-current="tab === item.key ? 'page' : undefined" @click="changeTab(item.key)"><component :is="item.icon" :size="22" /><span>{{ item.name }}</span><i v-if="item.key === 'ask' && pending" aria-hidden="true" /></button></nav>
    <div v-if="toast" role="status" class="mobile-toast">{{ toast }}</div>
    <MobileYesterdayFortune :open="yesterdayOpen" :busy="yesterdayBusy" :error="yesterdayError" :english="english" :response="yesterdayResponse" :cached="yesterdayCached" @close="closeYesterday" @retry="retryYesterday" />
    <div v-if="loginOpen && !accountMode" class="mobile-modal-backdrop" @click.self="!loginBusy && (loginOpen = false)"><section ref="loginDialog" role="dialog" aria-modal="true" aria-labelledby="mobile-login-title" class="mobile-modal"><button type="button" class="mobile-close" :aria-label="text('关闭','Close')" :disabled="loginBusy" @click="loginOpen = false"><XIcon :size="20" /></button><p class="mobile-eyebrow">E-Tomd</p><h2 id="mobile-login-title">{{ text('欢迎回来。','Welcome back.') }}</h2><p>{{ afterLogin === 'daily' ? text('登录后查看并保存今日运势。', 'Sign in to reveal and save today’s fortune.') : text('使用对应地区的网站账号，你的问题和选牌会保留。','Use your regional website account. Your question and cards are kept.') }}</p><form @submit.prevent="signIn"><label for="mobile-identifier" class="mobile-label">{{ text('邮箱或用户名','Email or username') }}</label><input id="mobile-identifier" v-model="identifier" class="mobile-input" autocomplete="username" autocapitalize="none" :disabled="loginBusy" required><label for="mobile-password" class="mobile-label">{{ text('密码','Password') }}</label><input id="mobile-password" v-model="password" class="mobile-input" type="password" autocomplete="current-password" :disabled="loginBusy" required><p v-if="loginError" class="mobile-error" role="alert">{{ loginError }}</p><button type="submit" class="mobile-primary" :disabled="loginBusy">{{ loginBusy ? text('正在登录…','Signing in…') : text('登录并继续','Sign in and continue') }}</button></form><div class="mobile-auth-links"><button type="button" class="mobile-text-button" :disabled="loginBusy" @click="openAccountAccess('register')">{{ text('创建账号','Create an account') }}</button><button type="button" class="mobile-text-button" :disabled="loginBusy" @click="openAccountAccess('forgot')">{{ text('忘记密码','Forgot password') }}</button></div></section></div>
    <MobileAccountAccess v-if="accountMode" ref="accountAccess" :key="accountMode" :mode="accountMode" :english="english" :online="online" :email="mobileUser?.email || identifier" @close="closeAccountAccess" @signin="signInToAccount" @session-ended="accountSessionEnded" />
    <MobileReaderPicker :open="readersOpen" :readers="availableReaders" :selected-id="readerId" :loading="referenceLoading" :error="readerLoadError" :unavailable-message="readerUnavailableMessage" :english="english" @select="selectReader" @close="readersOpen = false" @retry="loadReference" />
    <MobileProfileEditor v-if="profileMode && profileUser" :key="profileMode" :mode="profileMode" :user="profileUser" :english="english" :busy="profileBusy" :loading="profileLoading" :error="profileError" @close="closeProfile" @avatar="updateAvatar" @birth="updateBirth" @retry="loadBirthProfile" @change="profileError = ''" />
    <MobileMembershipBenefits v-if="benefitsOpen" :user="mobileUser" :active-vip="activeVip" :english="english" :online="online" @close="closeBenefits" @redeem="redeemFromBenefits" />
    <MobileMembershipRedeem v-if="membershipOpen" v-model:code="membershipCode" :english="english" :busy="redemptionBusy" :syncing="membershipSyncing" :error="redemptionError" :profile-error="membershipProfileError" :profile-updated="membershipProfileUpdated" :grant="membershipGrant" :return-to-benefits="membershipReturnsToBenefits" @close="closeMembership" @submit="redeemMembership" @refresh="syncMembership" />
  </div>
</template>
<style scoped>
.mobile-deck button,.mobile-deck img,.mobile-slot-card img { background:#291d45; }
.mobile-locked-cards { display:flex; flex-shrink:0; gap:5px; }
.mobile-carried .mobile-locked-cards img { width:32px; height:55px; flex-shrink:0; }
</style>
