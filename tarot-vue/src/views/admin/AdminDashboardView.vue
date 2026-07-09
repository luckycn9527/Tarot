<script setup lang="ts">
import type { Component } from 'vue'
import { onMounted, onUnmounted, ref, computed, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useEventListener } from '@vueuse/core'
import LayoutDashboard from '@icons/layout-dashboard.vue'
import UsersIcon from '@icons/users.vue'
import Images from '@icons/images.vue'
import Library from '@icons/library.vue'
import Sparkles from '@icons/sparkles.vue'
import MessageSquare from '@icons/message-square.vue'
import Star from '@icons/star.vue'
import TrendingUp from '@icons/trending-up.vue'
import Trash2 from '@icons/trash-2.vue'
import ChevronDown from '@icons/chevron-down.vue'
import LogOut from '@icons/log-out.vue'
import RefreshCw from '@icons/refresh-cw.vue'
import SaveIcon from '@icons/save.vue'
import PlusIcon from '@icons/plus.vue'
import SearchIcon from '@icons/search.vue'
import adminApi, { setAdminToken } from '../../services/adminApi'
import { publicAssetUrl } from '../../utils/publicAssetUrl'
import { formatAdminApiError } from '../../utils/adminApiError'
import { useFetchEpoch } from '../../composables/useFetchEpoch'

type TabKey = 'overview' | 'users' | 'backs' | 'cards' | 'prompts' | 'feedback'
const activeTab = ref<TabKey>('overview')
/** 按 Tab 区分的加载态，避免在「用户」页请求时误禁用「牌背」等按钮 */
const tabLoading = ref<Record<TabKey, boolean>>({
  overview: false,
  users: false,
  backs: false,
  cards: false,
  prompts: false,
  feedback: false,
})
function setTabLoading(tab: TabKey, v: boolean) {
  tabLoading.value[tab] = v
}
const toast = ref('')
const toastType = ref<'ok' | 'err'>('ok')
const router = useRouter()
const { t } = useI18n()
const adminName = ref(localStorage.getItem('admin_display_name') || 'Admin')
const fetchEpoch = useFetchEpoch()

let toastTimer: ReturnType<typeof setTimeout> | null = null
function showToast(msg: string, type: 'ok' | 'err' = 'ok') {
  if (toastTimer) {
    clearTimeout(toastTimer)
    toastTimer = null
  }
  toast.value = msg
  toastType.value = type
  toastTimer = setTimeout(() => {
    toast.value = ''
    toastTimer = null
  }, 3000)
}
onUnmounted(() => {
  if (toastTimer) clearTimeout(toastTimer)
})
// ===== Stats =====
const stats = ref({ totalUsers: 0, todayUsers: 0, totalReadings: 0, todayReadings: 0, totalFeedback: 0, pendingFeedback: 0 })
async function fetchStats() {
  const token = fetchEpoch.begin('overview')
  setTabLoading('overview', true)
  try {
    const r = await adminApi.get('/stats')
    if (fetchEpoch.isStale('overview', token)) return
    stats.value = r.data?.data ?? stats.value
  } catch (e) {
    if (!fetchEpoch.isStale('overview', token)) {
      showToast(formatAdminApiError(e, t('pages.admin.toastStatsFail')), 'err')
    }
  } finally {
    if (!fetchEpoch.isStale('overview', token)) setTabLoading('overview', false)
  }
}

// ===== Users =====
const users = ref<Record<string, unknown>[]>([])
const userTotal = ref(0)
const userPage = ref(1)
const userPageSize = 15
const userKeyword = ref('')
const editUser = ref<Record<string, unknown> | null>(null)
const userForm = ref({ nickname: '', membership: 'free', remaining_free_quota: 0, membership_expires_at: '' })
const userFormIsVip = computed(() => userForm.value.membership === 'vip')
const MS_PER_DAY = 24 * 60 * 60 * 1000

function toLocalDateInput(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function parseAdminDate(value: unknown): Date | null {
  if (!value) return null
  const raw = String(value)
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T23:59:59.999` : raw)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatAdminDate(value: unknown): string {
  const raw = value ? String(value) : ''
  return raw.includes('T') ? raw.slice(0, 10) : raw.slice(0, 10)
}

function isActiveVipUser(u: Record<string, unknown> | null | undefined): boolean {
  if (!u || u.membership !== 'vip') return false
  if (!u.membership_expires_at) return true
  const expiresAt = parseAdminDate(u.membership_expires_at)
  return Boolean(expiresAt && expiresAt.getTime() > Date.now())
}

function adminMembershipLabel(u: Record<string, unknown> | null | undefined): string {
  if (isActiveVipUser(u)) return t('pages.admin.membershipVipActive')
  if (u?.membership === 'vip') return t('pages.admin.membershipVipInactive')
  return t('pages.admin.membershipFree')
}

function adminMembershipClass(u: Record<string, unknown> | null | undefined): string {
  if (isActiveVipUser(u)) return 'bg-amber-500/15 text-amber-300 border-amber-500/25'
  if (u?.membership === 'vip') return 'bg-rose-500/10 text-rose-300 border-rose-500/20'
  return 'bg-gray-500/10 text-gray-500 border-gray-500/15'
}

function adminQuotaText(u: Record<string, unknown>): string {
  if (isActiveVipUser(u)) return t('pages.admin.quotaUnlimited')
  return String(u.remaining_free_quota ?? 0)
}

function adminQuotaClass(u: Record<string, unknown>): string {
  return isActiveVipUser(u)
    ? 'bg-violet-500/12 text-violet-200 border-violet-400/20'
    : 'bg-white/5 text-gray-400 border-white/8'
}

function clearUserSearch() {
  userKeyword.value = ''
  userPage.value = 1
  void fetchUsers()
}

function setVipExpiryDays(days: number) {
  const target = new Date(Date.now() + days * MS_PER_DAY)
  userForm.value.membership_expires_at = toLocalDateInput(target)
}

function clearVipExpiry() {
  userForm.value.membership_expires_at = ''
}

const vipExpiryStatus = computed(() => {
  if (!userForm.value.membership_expires_at) return t('pages.admin.vipNoExpiry')
  const expiresAt = parseAdminDate(userForm.value.membership_expires_at)
  if (!expiresAt) return t('pages.admin.vipNoExpiry')
  if (expiresAt.getTime() <= Date.now()) {
    return t('pages.admin.vipExpiredOn', { date: formatAdminDate(userForm.value.membership_expires_at) })
  }
  return t('pages.admin.vipExpiresOn', { date: formatAdminDate(userForm.value.membership_expires_at) })
})

async function fetchUsers() {
  const token = fetchEpoch.begin('users')
  setTabLoading('users', true)
  try {
    const r = await adminApi.get('/users', { params: { page: userPage.value, pageSize: userPageSize, keyword: userKeyword.value || undefined } })
    if (fetchEpoch.isStale('users', token)) return
    users.value = r.data?.data?.rows ?? []
    userTotal.value = r.data?.data?.total ?? 0
  } catch (e) {
    if (!fetchEpoch.isStale('users', token)) showToast(formatAdminApiError(e, t('pages.admin.errGeneric')), 'err')
  } finally {
    if (!fetchEpoch.isStale('users', token)) setTabLoading('users', false)
  }
}
const userTotalPages = computed(() => Math.max(1, Math.ceil(userTotal.value / userPageSize)))
/** 关闭弹窗后将焦点还给打开弹窗的按钮（键盘/读屏流） */
const editUserFocusReturn = ref<HTMLElement | null>(null)
const replyFocusReturn = ref<HTMLElement | null>(null)

/** 优先用事件的 currentTarget；否则回退到 document.activeElement（程序化打开等） */
function captureFocusReturn(e?: Event): HTMLElement | null {
  const ct = e?.currentTarget
  if (ct instanceof HTMLElement) return ct
  const ae = document.activeElement
  if (ae instanceof HTMLElement && ae !== document.body && document.contains(ae)) return ae
  return null
}

const FOCUSABLE_SELECTOR =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'

function getFocusableElements(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((el) => {
    if (el instanceof HTMLInputElement && el.type === 'hidden') return false
    const s = window.getComputedStyle(el)
    if (s.display === 'none' || s.visibility === 'hidden') return false
    return true
  })
}

/** 将 Tab / Shift+Tab 限制在对话框内（不引入 focus-trap 依赖） */
function trapTabWithin(e: KeyboardEvent, root: HTMLElement | null | undefined) {
  if (e.key !== 'Tab' || !root) return
  const list = getFocusableElements(root)
  if (!list.length) return
  if (list.length === 1) {
    e.preventDefault()
    list[0].focus()
    return
  }
  const first = list[0]
  const last = list[list.length - 1]
  const active = document.activeElement
  if (!active || !root.contains(active)) {
    e.preventDefault()
    first.focus()
    return
  }
  if (e.shiftKey) {
    if (active === first) {
      e.preventDefault()
      last.focus()
    }
  } else if (active === last) {
    e.preventDefault()
    first.focus()
  }
}

const editUserModalEl = ref<HTMLElement | null>(null)
const replyModalEl = ref<HTMLElement | null>(null)

function onEditUserModalKeydown(e: KeyboardEvent) {
  trapTabWithin(e, editUserModalEl.value)
}

function onReplyModalKeydown(e: KeyboardEvent) {
  trapTabWithin(e, replyModalEl.value)
}

function openEditUser(u: Record<string, unknown>, e?: Event) {
  editUserFocusReturn.value = captureFocusReturn(e)
  editUser.value = u
  userForm.value = {
    nickname: (u.nickname as string) ?? '',
    membership: (u.membership as string) ?? 'free',
    remaining_free_quota: Number(u.remaining_free_quota ?? 0),
    membership_expires_at: u.membership_expires_at ? String(u.membership_expires_at).slice(0, 10) : '',
  }
}

function openReplyModal(f: Record<string, unknown>, e?: Event) {
  replyFocusReturn.value = captureFocusReturn(e)
  replyTarget.value = f
  replyText.value = ''
  replyStatus.value = 'resolved'
}
async function saveUser() {
  if (!editUser.value) return
  setTabLoading('users', true)
  try {
    await adminApi.patch(`/users/${editUser.value.id}`, {
      ...userForm.value,
      membership_expires_at: userForm.value.membership_expires_at ? `${userForm.value.membership_expires_at}T23:59:59.999Z` : null,
    })
    showToast(t('pages.admin.toastUserUpdated'))
    editUser.value = null
    await fetchUsers()
  } catch (e) { showToast(formatAdminApiError(e, t('pages.admin.errGeneric')), 'err') }
  finally { setTabLoading('users', false) }
}

// ===== Upload helper =====
async function uploadImage(file: File, type: string): Promise<{ url: string; thumbUrl?: string }> {
  const form = new FormData()
  form.append('file', file)
  const r = await adminApi.post(`/upload?type=${encodeURIComponent(type)}`, form)
  const d = r.data?.data as { url?: string; thumbUrl?: string } | undefined
  const url = typeof d?.url === 'string' ? d.url : ''
  return typeof d?.thumbUrl === 'string' ? { url, thumbUrl: d.thumbUrl } : { url }
}

// ===== Card Backs =====
const cardBacks = ref<Record<string, unknown>[]>([])
async function fetchCardBacks() {
  const token = fetchEpoch.begin('backs')
  setTabLoading('backs', true)
  try {
    const r = await adminApi.get('/config/card-backs')
    if (fetchEpoch.isStale('backs', token)) return
    cardBacks.value = (r.data?.data ?? []).map((b: Record<string, unknown>) => ({ ...b, is_active: !!b.is_active }))
  } catch (e) {
    if (!fetchEpoch.isStale('backs', token)) showToast(formatAdminApiError(e, t('pages.admin.errGeneric')), 'err')
  } finally {
    if (!fetchEpoch.isStale('backs', token)) setTabLoading('backs', false)
  }
}
function addCardBack() {
  cardBacks.value.push({ code: '', name: '', description: '', asset_url: '', is_active: true, access_type: 'free', price: null, sort_order: cardBacks.value.length + 1 })
}
async function uploadCardBackImage(idx: number, event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  try {
    const { url } = await uploadImage(file, 'card-back')
    cardBacks.value[idx].asset_url = url
    showToast(t('pages.admin.toastImageUploaded'))
  } catch (e) { showToast(formatAdminApiError(e, t('pages.admin.errGeneric')), 'err') }
}
async function saveCardBacks() {
  setTabLoading('backs', true)
  try {
    await adminApi.put('/config/card-backs', {
      items: cardBacks.value.map((b) => ({
        code: b.code, name: b.name,
        description: b.description || null,
        assetUrl: b.asset_url || null,
        isActive: !!b.is_active,
        accessType: b.access_type || 'free',
        price: b.access_type === 'paid' ? Number(b.price) || null : null,
        sortOrder: Number(b.sort_order || 0),
      })),
    })
    showToast(t('pages.admin.toastBacksSaved'))
    await fetchCardBacks()
  } catch (e) { showToast(formatAdminApiError(e, t('pages.admin.errGeneric')), 'err') }
  finally { setTabLoading('backs', false) }
}
async function removeCardBack(idx: number) {
  const b = cardBacks.value[idx]
  if (b.id) {
    setTabLoading('backs', true)
    try {
      await adminApi.delete(`/config/card-backs/${b.id}`)
      showToast(t('pages.admin.toastBackDeleted'))
    } catch (e) {
      showToast(formatAdminApiError(e, t('pages.admin.errGeneric')), 'err')
      setTabLoading('backs', false)
      return
    } finally {
      setTabLoading('backs', false)
    }
  }
  cardBacks.value.splice(idx, 1)
}

// ===== Cards =====
const cards = ref<Record<string, unknown>[]>([])
const cardSearch = ref('')
async function fetchCards() {
  const token = fetchEpoch.begin('cards')
  setTabLoading('cards', true)
  try {
    const r = await adminApi.get('/config/cards')
    if (fetchEpoch.isStale('cards', token)) return
    cards.value = (r.data?.data ?? []).map((c: Record<string, unknown>) => ({ ...c, is_active: !!c.is_active }))
  } catch (e) {
    if (!fetchEpoch.isStale('cards', token)) showToast(formatAdminApiError(e, t('pages.admin.errGeneric')), 'err')
  } finally {
    if (!fetchEpoch.isStale('cards', token)) setTabLoading('cards', false)
  }
}
async function uploadCardImage(cardId: number, event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  try {
    const { url } = await uploadImage(file, 'card-face')
    const c = cards.value.find((x) => x.id === cardId)
    if (c) c.image_url = url
    showToast(t('pages.admin.toastImageUploaded'))
  } catch (e) { showToast(formatAdminApiError(e, t('pages.admin.errGeneric')), 'err') }
}
const filteredCards = computed(() => {
  if (!cardSearch.value) return cards.value
  const kw = cardSearch.value.toLowerCase()
  return cards.value.filter((c) => String(c.name ?? '').toLowerCase().includes(kw) || String(c.name_en ?? '').toLowerCase().includes(kw) || String(c.id) === kw)
})
function clearCardSearch() {
  cardSearch.value = ''
}
async function saveCards() {
  setTabLoading('cards', true)
  try {
    await adminApi.put('/config/cards', {
      items: cards.value.map((c) => ({
        id: c.id, name: c.name, nameEn: c.name_en, uprightKeywords: c.upright_keywords,
        reversedKeywords: c.reversed_keywords, yesNoTendency: c.yes_no_tendency,
        imageUrl: c.image_url || null, isActive: !!c.is_active,
      })),
    })
    showToast(t('pages.admin.toastCardsSaved'))
  } catch (e) { showToast(formatAdminApiError(e, t('pages.admin.errGeneric')), 'err') }
  finally { setTabLoading('cards', false) }
}

// ===== Prompts =====
/** 与 GET /config/readers-prompts 返回的合并 DTO 对应（camelCase，含代码内默认值） */
interface ReaderPromptRow {
  readerCode: string
  displayName: string
  avatarUrl: string
  /** 塔罗师头像缩略图（仅站内上传时有）；列表展示优先用 */
  avatarThumbUrl: string
  /** 实际展示头像：后台自定义优先，无自定义时使用后端默认 OSS 头像 */
  effectiveAvatarUrl: string
  effectiveAvatarThumbUrl: string
  emoji: string
  accessLevel: string
  systemPrompt: string
  greeting: string
  defaultDisplayName: string
  defaultEmoji: string
  id?: number
  updatedAt?: string
}

const prompts = ref<ReaderPromptRow[]>([])
const promptSearch = ref('')
const promptAccessFilter = ref<'all' | 'featured' | 'vip' | 'free' | 'default' | 'needsAvatar'>('all')

interface FeaturedReaderRow {
  readerCode: string
  isActive: boolean
  sortOrder: number
}
const featuredList = ref<FeaturedReaderRow[]>([])

const readerMeta = [
  { code: 'qinghe', emoji: '🌿' },
  { code: 'yanxi', emoji: '🏔️' },
  { code: 'haruka', emoji: '🌸' },
  { code: 'xuanyin', emoji: '☯️' },
  { code: 'mirelle', emoji: '🌙' },
  { code: 'lingsha', emoji: '🔥' },
  { code: 'norick', emoji: '📜' },
  { code: 'amara', emoji: '✨' },
  { code: 'vikram', emoji: '🪷' },
  { code: 'catalina', emoji: '🌹' },
  { code: 'kazuki', emoji: '⛩️' },
  { code: 'solveig', emoji: '❄️' },
] as const

function readerLocalizedName(code: string): string {
  const key = `pages.admin.readerNames.${code}`
  const translated = t(key)
  return translated === key ? code : translated
}
const expandedPrompt = ref<string | null>(null)

const promptFilterOptions = computed(() => [
  { value: 'all', label: t('pages.admin.promptFilterAll') },
  { value: 'featured', label: t('pages.admin.promptFilterFeatured') },
  { value: 'vip', label: t('pages.admin.promptFilterVip') },
  { value: 'free', label: t('pages.admin.promptFilterFree') },
  { value: 'default', label: t('pages.admin.promptFilterDefault') },
  { value: 'needsAvatar', label: t('pages.admin.promptFilterNeedsAvatar') },
] as const)

function ensurePromptRow(code: string): ReaderPromptRow {
  let p = prompts.value.find((x) => x.readerCode === code)
  if (!p) {
    const m = readerMeta.find((x) => x.code === code)
    p = {
      readerCode: code,
      displayName: '',
      avatarUrl: '',
      avatarThumbUrl: '',
      effectiveAvatarUrl: '',
      effectiveAvatarThumbUrl: '',
      emoji: '',
      accessLevel: '',
      systemPrompt: '',
      greeting: '',
      defaultDisplayName: readerLocalizedName(code),
      defaultEmoji: m?.emoji ?? '',
    }
    prompts.value.push(p)
  }
  return p
}

function promptRow(code: string): ReaderPromptRow {
  return ensurePromptRow(code)
}

function promptDisplayName(code: string): string {
  const row = promptRow(code)
  return (row.displayName || '').trim() || row.defaultDisplayName || readerLocalizedName(code)
}

function promptAvatarUrl(code: string): string {
  const row = promptRow(code)
  return String(row.effectiveAvatarThumbUrl || row.effectiveAvatarUrl || row.avatarThumbUrl || row.avatarUrl || '')
}

function promptAccessValue(code: string): 'default' | 'free' | 'vip' {
  const access = String(promptRow(code).accessLevel || '')
  if (access === 'free' || access === 'vip') return access
  return 'default'
}

function promptAccessLabel(code: string): string {
  const access = promptAccessValue(code)
  if (access === 'vip') return t('pages.admin.accessVip')
  if (access === 'free') return t('pages.admin.accessFree')
  return t('pages.admin.accessFollowBuiltinShort')
}

function promptAccessClass(code: string): string {
  const access = promptAccessValue(code)
  if (access === 'vip') return 'bg-violet-500/12 text-violet-200 border-violet-400/20'
  if (access === 'free') return 'bg-emerald-500/12 text-emerald-300 border-emerald-400/20'
  return 'bg-white/5 text-gray-500 border-white/8'
}

function isFeaturedReader(code: string): boolean {
  return featuredRow(code).isActive === true
}

function hasCustomPromptConfig(code: string): boolean {
  const row = promptRow(code)
  return Boolean(
    row.displayName?.trim()
    || row.avatarUrl?.trim()
    || row.emoji?.trim()
    || row.accessLevel?.trim()
    || row.systemPrompt?.trim()
    || row.greeting?.trim(),
  )
}

const promptStats = computed(() => {
  const codes = readerMeta.map((r) => r.code)
  return {
    total: codes.length,
    featured: codes.filter((code) => isFeaturedReader(code)).length,
    vip: codes.filter((code) => promptAccessValue(code) === 'vip').length,
    avatar: codes.filter((code) => Boolean(promptAvatarUrl(code))).length,
    custom: codes.filter((code) => hasCustomPromptConfig(code)).length,
  }
})

const filteredReaderMeta = computed(() => {
  const keyword = promptSearch.value.trim().toLowerCase()
  return readerMeta.filter((reader) => {
    const code = reader.code
    const access = promptAccessValue(code)
    const matchesKeyword = !keyword
      || code.toLowerCase().includes(keyword)
      || promptDisplayName(code).toLowerCase().includes(keyword)

    const filter = promptAccessFilter.value
    const matchesFilter = filter === 'all'
      || (filter === 'featured' && isFeaturedReader(code))
      || (filter === 'vip' && access === 'vip')
      || (filter === 'free' && access === 'free')
      || (filter === 'default' && access === 'default')
      || (filter === 'needsAvatar' && !promptAvatarUrl(code))

    return matchesKeyword && matchesFilter
  })
})

const featuredReaderMeta = computed(() => (
  readerMeta
    .filter((reader) => isFeaturedReader(reader.code))
    .slice()
    .sort((a, b) => Number(featuredRow(a.code).sortOrder || 0) - Number(featuredRow(b.code).sortOrder || 0))
))

const selectedReaderCode = computed(() => expandedPrompt.value)

function clearPromptFilters() {
  promptSearch.value = ''
  promptAccessFilter.value = 'all'
}

function selectPromptReader(code: string) {
  expandedPrompt.value = code
}

function selectFirstFilteredReader() {
  const first = filteredReaderMeta.value[0]
  if (first) expandedPrompt.value = first.code
}

function collapsePromptReader() {
  expandedPrompt.value = null
}

watch(expandedPrompt, (code) => {
  if (code) ensurePromptRow(code)
})

watch(filteredReaderMeta, (list) => {
  if (!list.length) {
    expandedPrompt.value = null
    return
  }
  if (!expandedPrompt.value || !list.some((reader) => reader.code === expandedPrompt.value)) {
    expandedPrompt.value = list[0].code
  }
}, { immediate: true })

async function fetchPrompts(opts?: { skipLoading?: boolean }) {
  const token = fetchEpoch.begin('prompts')
  if (!opts?.skipLoading) setTabLoading('prompts', true)
  try {
    const r = await adminApi.get('/config/readers-prompts')
    if (fetchEpoch.isStale('prompts', token)) return
    if (!r.data?.success) {
      showToast(typeof r.data?.message === 'string' ? r.data.message : t('pages.admin.toastPromptsLoadFail'), 'err')
      return
    }
    const rows = (r.data?.data ?? []) as Record<string, unknown>[]
    prompts.value = rows.map((row) => ({
      readerCode: String(row.readerCode ?? ''),
      displayName: row.displayName != null ? String(row.displayName) : '',
      avatarUrl: row.avatarUrl != null ? String(row.avatarUrl) : '',
      avatarThumbUrl: row.avatarThumbUrl != null ? String(row.avatarThumbUrl) : '',
      effectiveAvatarUrl: row.effectiveAvatarUrl != null ? String(row.effectiveAvatarUrl) : '',
      effectiveAvatarThumbUrl: row.effectiveAvatarThumbUrl != null ? String(row.effectiveAvatarThumbUrl) : '',
      emoji: row.emoji != null ? String(row.emoji) : '',
      accessLevel: row.accessLevel != null ? String(row.accessLevel) : '',
      systemPrompt: String(row.systemPrompt ?? ''),
      greeting: String(row.greeting ?? ''),
      defaultDisplayName: String(row.defaultDisplayName ?? ''),
      defaultEmoji: String(row.defaultEmoji ?? ''),
      id: row.id != null ? Number(row.id) : undefined,
      updatedAt: row.updatedAt != null ? String(row.updatedAt) : undefined,
    }))
  } catch (e) {
    if (!fetchEpoch.isStale('prompts', token)) showToast(formatAdminApiError(e, t('pages.admin.errGeneric')), 'err')
  } finally {
    if (!opts?.skipLoading && !fetchEpoch.isStale('prompts', token)) setTabLoading('prompts', false)
  }
}

function onTogglePromptReader(code: string) {
  expandedPrompt.value = expandedPrompt.value === code ? null : code
}

async function uploadReaderAvatar(code: string, event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  try {
    const { url, thumbUrl } = await uploadImage(file, 'reader-avatar')
    const row = ensurePromptRow(code)
    row.avatarUrl = url
    row.avatarThumbUrl = thumbUrl ?? ''
    showToast(t('pages.admin.toastAvatarUploaded'))
  } catch (e) { showToast(formatAdminApiError(e, t('pages.admin.errGeneric')), 'err') }
}

async function savePrompt(code: string) {
  setTabLoading('prompts', true)
  try {
    const p = ensurePromptRow(code)
    const acc = String(p.accessLevel ?? '')
    const accessLevel = acc === 'free' || acc === 'vip' ? acc : null
    await adminApi.put('/config/readers-prompts', {
      items: [{
        readerCode: code,
        displayName: String(p.displayName ?? '').trim() || null,
        avatarUrl: String(p.avatarUrl ?? '').trim() || null,
        emoji: String(p.emoji ?? '').trim() || null,
        accessLevel,
        systemPrompt: String(p.systemPrompt ?? ''),
        greeting: String(p.greeting ?? ''),
      }],
    })
    showToast(t('pages.admin.toastReaderSaved', { name: readerLocalizedName(code) }))
    await fetchPrompts({ skipLoading: true })
  } catch (e) { showToast(formatAdminApiError(e, t('pages.admin.errGeneric')), 'err') }
  finally { setTabLoading('prompts', false) }
}

function ensureFeaturedRow(code: string): FeaturedReaderRow {
  let row = featuredList.value.find((x) => x.readerCode === code)
  if (!row) {
    row = { readerCode: code, isActive: false, sortOrder: 0 }
    featuredList.value.push(row)
  }
  return row
}

function featuredRow(code: string): FeaturedReaderRow {
  return ensureFeaturedRow(code)
}

async function fetchFeatured() {
  try {
    const r = await adminApi.get('/config/featured-readers')
    if (!r.data?.success) {
      showToast(typeof r.data?.message === 'string' ? r.data.message : t('pages.admin.toastFeaturedLoadFail'), 'err')
      return
    }
    const rows = (r.data?.data ?? []) as Record<string, unknown>[]
    const byCode = new Map(rows.map((row) => [String(row.readerCode ?? ''), row]))
    featuredList.value = readerMeta.map((m) => {
      const db = byCode.get(m.code)
      return {
        readerCode: m.code,
        isActive: db?.isActive === true,
        sortOrder: db?.sortOrder != null ? Number(db.sortOrder) : 0,
      }
    })
  } catch (e) { showToast(formatAdminApiError(e, t('pages.admin.errGeneric')), 'err') }
}

async function saveFeatured() {
  setTabLoading('prompts', true)
  try {
    await adminApi.put('/config/featured-readers', {
      items: featuredList.value.map((row) => ({
        readerCode: row.readerCode,
        isActive: Boolean(row.isActive),
        sortOrder: Number(row.sortOrder) || 0,
      })),
    })
    showToast(t('pages.admin.toastFeaturedSaved'))
  } catch (e) { showToast(formatAdminApiError(e, t('pages.admin.errGeneric')), 'err') }
  finally { setTabLoading('prompts', false) }
}

// ===== Feedback =====
const feedbackList = ref<Record<string, unknown>[]>([])
const feedbackTotal = ref(0)
const feedbackPage = ref(1)
const feedbackFilter = ref('')
const replyTarget = ref<Record<string, unknown> | null>(null)
const replyText = ref('')
const replyStatus = ref('resolved')

watch(editUser, (v, prev) => {
  if (v) {
    void nextTick(() => document.getElementById('admin-edit-nickname')?.focus())
    return
  }
  if (prev && editUserFocusReturn.value) {
    const el = editUserFocusReturn.value
    editUserFocusReturn.value = null
    void nextTick(() => {
      try {
        el.focus()
      } catch {
        /* 节点已从文档移除 */
      }
    })
  }
})

watch(replyTarget, (v, prev) => {
  if (v) {
    void nextTick(() => document.getElementById('admin-reply-text')?.focus())
    return
  }
  if (prev && replyFocusReturn.value) {
    const el = replyFocusReturn.value
    replyFocusReturn.value = null
    void nextTick(() => {
      try {
        el.focus()
      } catch {
        /* 节点已从文档移除 */
      }
    })
  }
})

useEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key !== 'Escape') return
  if (replyTarget.value) {
    replyTarget.value = null
    replyText.value = ''
    e.preventDefault()
    return
  }
  if (editUser.value) {
    editUser.value = null
    e.preventDefault()
  }
})

async function fetchFeedback() {
  const token = fetchEpoch.begin('feedback')
  setTabLoading('feedback', true)
  try {
    const r = await adminApi.get('/feedback', { params: { page: feedbackPage.value, pageSize: 15, status: feedbackFilter.value || undefined } })
    if (fetchEpoch.isStale('feedback', token)) return
    feedbackList.value = r.data?.data?.rows ?? []
    feedbackTotal.value = r.data?.data?.total ?? 0
  } catch (e) {
    if (!fetchEpoch.isStale('feedback', token)) showToast(formatAdminApiError(e, t('pages.admin.errGeneric')), 'err')
  } finally {
    if (!fetchEpoch.isStale('feedback', token)) setTabLoading('feedback', false)
  }
}
const feedbackTotalPages = computed(() => Math.max(1, Math.ceil(feedbackTotal.value / 15)))
async function submitReply() {
  if (!replyTarget.value) return
  setTabLoading('feedback', true)
  try {
    await adminApi.patch(`/feedback/${replyTarget.value.id}`, { adminReply: replyText.value, status: replyStatus.value })
    showToast(t('pages.admin.toastReplyOk'))
    replyTarget.value = null
    replyText.value = ''
    await fetchFeedback()
  } catch (e) { showToast(formatAdminApiError(e, t('pages.admin.errGeneric')), 'err') }
  finally { setTabLoading('feedback', false) }
}

function logout() { setAdminToken(null); localStorage.removeItem('admin_display_name'); void router.replace('/admin/login') }

watch(activeTab, (tab, prev) => {
  if (prev) fetchEpoch.invalidate(prev)
  if (tab === 'overview') void fetchStats()
  if (tab === 'users') void fetchUsers()
  if (tab === 'backs') void fetchCardBacks()
  if (tab === 'cards') void fetchCards()
  if (tab === 'prompts') { void fetchPrompts(); void fetchFeatured() }
  if (tab === 'feedback') void fetchFeedback()
})

onMounted(() => { void fetchStats() })

const tabIconComponents: Record<TabKey, Component> = {
  overview: LayoutDashboard,
  users: UsersIcon,
  backs: Images,
  cards: Library,
  prompts: Sparkles,
  feedback: MessageSquare,
}

const tabs = computed(() => [
  { key: 'overview' as TabKey, label: t('pages.admin.tabOverview') },
  { key: 'users' as TabKey, label: t('pages.admin.tabUsers') },
  { key: 'backs' as TabKey, label: t('pages.admin.tabBacks') },
  { key: 'cards' as TabKey, label: t('pages.admin.tabCards') },
  { key: 'prompts' as TabKey, label: t('pages.admin.tabPrompts') },
  { key: 'feedback' as TabKey, label: t('pages.admin.tabFeedback') },
])

const activeTabMeta = computed(() => (
  tabs.value.find((tab) => tab.key === activeTab.value)
  ?? { key: 'overview' as TabKey, label: t('pages.admin.tabOverview') }
))
const activeTabLoading = computed(() => tabLoading.value[activeTab.value])
const activeTabDescription = computed(() => {
  const descriptions: Record<TabKey, string> = {
    overview: t('pages.admin.descOverview'),
    users: t('pages.admin.descUsers'),
    backs: t('pages.admin.descBacks'),
    cards: t('pages.admin.descCards'),
    prompts: t('pages.admin.descPrompts'),
    feedback: t('pages.admin.descFeedback'),
  }
  return descriptions[activeTab.value]
})

function tabBadge(tab: TabKey): string {
  if (tab === 'users' && userTotal.value > 0) return String(userTotal.value)
  if (tab === 'backs' && cardBacks.value.length > 0) return String(cardBacks.value.length)
  if (tab === 'cards' && cards.value.length > 0) return String(cards.value.length)
  if (tab === 'feedback' && stats.value.pendingFeedback > 0) return String(stats.value.pendingFeedback)
  return ''
}

async function refreshCurrentTab() {
  if (activeTab.value === 'overview') return fetchStats()
  if (activeTab.value === 'users') return fetchUsers()
  if (activeTab.value === 'backs') return fetchCardBacks()
  if (activeTab.value === 'cards') return fetchCards()
  if (activeTab.value === 'prompts') {
    await fetchPrompts()
    await fetchFeatured()
    return
  }
  return fetchFeedback()
}

const adminShortcuts = computed(() => [
  { tab: 'users' as TabKey, label: t('pages.admin.shortcutUsers'), desc: t('pages.admin.shortcutUsersDesc') },
  { tab: 'backs' as TabKey, label: t('pages.admin.shortcutBacks'), desc: t('pages.admin.shortcutBacksDesc') },
  { tab: 'prompts' as TabKey, label: t('pages.admin.shortcutPrompts'), desc: t('pages.admin.shortcutPromptsDesc') },
  { tab: 'feedback' as TabKey, label: t('pages.admin.shortcutFeedback'), desc: t('pages.admin.shortcutFeedbackDesc') },
])

const statusLabels = computed<Record<string, string>>(() => ({
  pending: t('pages.admin.statusPending'),
  processing: t('pages.admin.statusProcessing'),
  resolved: t('pages.admin.statusResolved'),
  closed: t('pages.admin.statusClosed'),
}))
const statusColors: Record<string, string> = {
  pending: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  processing: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  resolved: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  closed: 'bg-gray-500/15 text-gray-400 border-gray-500/20',
}

function promptPanelId(code: string): string {
  return `admin-prompt-panel-${code}`
}

function cardBackRowKey(b: Record<string, unknown>, index: number): string {
  const id = b.id
  if (typeof id === 'number' && Number.isFinite(id)) return `back-${id}`
  return `back-new-${index}`
}
</script>

<template>
  <div class="flex min-h-screen bg-[#07060e] text-gray-200">
    <!-- Sidebar -->
    <aside class="w-56 flex-shrink-0 bg-[#0c0a16] border-r border-gold-500/8 flex flex-col">
        <div class="px-5 py-5 border-b border-gold-500/8">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-gold-500 to-gold-600 flex items-center justify-center text-[#07060e]">
            <LayoutDashboard :size="18" />
          </div>
          <span class="font-semibold text-sm text-gold-200 tracking-wide">{{ t('pages.admin.brand') }}</span>
        </div>
      </div>
      <nav class="flex-1 py-3 space-y-0.5">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          type="button"
          class="w-full flex items-center gap-3 px-5 py-2.5 text-sm transition-all duration-150"
          :class="activeTab === tab.key
            ? 'bg-gold-500/8 text-gold-300 border-r-2 border-gold-400'
            : 'text-gray-500 hover:text-gray-300 hover:bg-white/3'"
          :aria-current="activeTab === tab.key ? 'page' : undefined"
          @click="activeTab = tab.key"
        >
          <component
            :is="tabIconComponents[tab.key]"
            :size="18"
            class="shrink-0 opacity-90"
            :class="activeTab === tab.key ? 'text-gold-300' : 'text-gray-500'"
          />
          <span>{{ tab.label }}</span>
          <span v-if="tabBadge(tab.key)" class="ml-auto rounded-md border border-white/8 bg-white/5 px-1.5 py-0.5 text-[10px] text-gray-500">
            {{ tabBadge(tab.key) }}
          </span>
        </button>
      </nav>
      <div class="px-5 py-4 border-t border-gold-500/8 text-xs">
        <p class="text-gray-500">{{ adminName }}</p>
        <button type="button" class="mt-2 inline-flex items-center gap-1.5 text-red-400/70 hover:text-red-300 transition-colors" @click="logout">
          <LogOut :size="14" />
          {{ t('pages.admin.logout') }}
        </button>
      </div>
    </aside>

    <!-- Main -->
    <div class="flex-1 flex flex-col min-w-0">
      <header class="admin-topbar">
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <component :is="tabIconComponents[activeTab]" :size="18" class="text-gold-300" />
            <h2 class="truncate text-base font-medium text-gold-200">{{ activeTabMeta.label }}</h2>
          </div>
          <p class="mt-1 max-w-2xl truncate text-xs text-gray-600">{{ activeTabDescription }}</p>
        </div>
        <div class="flex flex-wrap items-center justify-end gap-2">
          <button type="button" class="admin-btn-ghost inline-flex items-center gap-1.5" :disabled="activeTabLoading" @click="refreshCurrentTab">
            <RefreshCw :size="14" :class="activeTabLoading ? 'motion-safe:animate-spin' : ''" />
            {{ t('pages.admin.refresh') }}
          </button>
          <button v-if="activeTab === 'users'" type="button" class="admin-btn-primary inline-flex items-center gap-1.5" :disabled="tabLoading.users" @click="userPage = 1; fetchUsers()">
            <SearchIcon :size="14" />
            {{ t('pages.admin.search') }}
          </button>
          <button v-if="activeTab === 'backs'" type="button" class="admin-btn-ghost inline-flex items-center gap-1.5" :disabled="tabLoading.backs" @click="addCardBack">
            <PlusIcon :size="14" />
            {{ t('pages.admin.addBackShort') }}
          </button>
          <button v-if="activeTab === 'backs'" type="button" class="admin-btn-primary inline-flex items-center gap-1.5" :disabled="tabLoading.backs" @click="saveCardBacks">
            <SaveIcon :size="14" />
            {{ tabLoading.backs ? t('pages.admin.saving') : t('pages.admin.saveBacksShort') }}
          </button>
          <button v-if="activeTab === 'cards'" type="button" class="admin-btn-primary inline-flex items-center gap-1.5" :disabled="tabLoading.cards" @click="saveCards">
            <SaveIcon :size="14" />
            {{ tabLoading.cards ? t('pages.admin.saving') : t('pages.admin.saveCardsShort') }}
          </button>
          <button v-if="activeTab === 'prompts'" type="button" class="admin-btn-primary inline-flex items-center gap-1.5" :disabled="tabLoading.prompts" @click="saveFeatured">
            <SaveIcon :size="14" />
            {{ tabLoading.prompts ? t('pages.admin.saving') : t('pages.admin.saveFeaturedShort') }}
          </button>
        </div>
      </header>

      <!-- Toast -->
      <Transition name="toast">
        <div
          v-if="toast"
          role="status"
          :aria-live="toastType === 'err' ? 'assertive' : 'polite'"
          class="fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl text-sm shadow-lg backdrop-blur-sm border"
          :class="toastType === 'ok' ? 'bg-emerald-600/90 border-emerald-500/30' : 'bg-red-600/90 border-red-500/30'"
        >{{ toast }}</div>
      </Transition>

      <main class="flex-1 overflow-auto p-6">
        <!-- Overview -->
        <section
          v-if="activeTab === 'overview'"
          :aria-busy="tabLoading.overview"
          :aria-label="t('pages.admin.tabOverview')"
        >
          <p v-if="tabLoading.overview" class="sr-only">{{ t('pages.admin.statsLoading') }}</p>
          <div
            class="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8 transition-opacity duration-200"
            :class="tabLoading.overview ? 'motion-safe:animate-pulse opacity-70' : ''"
          >
            <div class="admin-stat-card">
              <div class="flex items-center justify-between mb-3">
                <p class="text-gray-500 text-xs">{{ t('pages.admin.statTotalUsers') }}</p>
                <div class="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
                  <UsersIcon :size="16" />
                </div>
              </div>
              <p class="text-3xl font-bold text-white">{{ stats.totalUsers }}</p>
              <p class="text-xs text-emerald-400 mt-1.5 flex items-center gap-1">
                <TrendingUp :size="12" :stroke-width="2.5" />
                {{ t('pages.admin.statToday', { n: stats.todayUsers }) }}
              </p>
            </div>
            <div class="admin-stat-card">
              <div class="flex items-center justify-between mb-3">
                <p class="text-gray-500 text-xs">{{ t('pages.admin.statTotalReadings') }}</p>
                <div class="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-violet-300">
                  <Star :size="16" />
                </div>
              </div>
              <p class="text-3xl font-bold text-white">{{ stats.totalReadings }}</p>
              <p class="text-xs text-emerald-400 mt-1.5 flex items-center gap-1">
                <TrendingUp :size="12" :stroke-width="2.5" />
                {{ t('pages.admin.statToday', { n: stats.todayReadings }) }}
              </p>
            </div>
            <div class="admin-stat-card">
              <div class="flex items-center justify-between mb-3">
                <p class="text-gray-500 text-xs">{{ t('pages.admin.statFeedback') }}</p>
                <div class="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
                  <MessageSquare :size="16" />
                </div>
              </div>
              <p class="text-3xl font-bold text-white">{{ stats.totalFeedback }}</p>
              <p class="text-xs mt-1.5" :class="stats.pendingFeedback > 0 ? 'text-amber-400' : 'text-gray-600'">
                {{ t('pages.admin.statPending', { n: stats.pendingFeedback }) }}
              </p>
            </div>
          </div>

          <!-- Quick actions -->
          <h3 class="text-sm font-medium text-gray-400 mb-3">{{ t('pages.admin.quickActions') }}</h3>
          <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <button v-for="shortcut in adminShortcuts" :key="shortcut.tab" type="button" class="admin-action-card" @click="activeTab = shortcut.tab">
              <div class="flex items-center gap-2 mb-0.5 text-gold-400/90">
                <component :is="tabIconComponents[shortcut.tab]" :size="18" />
                <p class="text-sm text-gray-200 font-medium">{{ shortcut.label }}</p>
              </div>
              <p class="text-xs text-gray-600 mt-1">{{ shortcut.desc }}</p>
            </button>
          </div>
        </section>

        <!-- Users -->
        <section
          v-if="activeTab === 'users'"
          :aria-busy="tabLoading.users"
          :aria-label="t('pages.admin.tabUsers')"
        >
          <p v-if="tabLoading.users" class="sr-only">{{ t('pages.admin.tabSectionLoading') }}</p>
          <div class="admin-section-toolbar mb-4">
            <div class="relative flex-1 max-w-sm">
              <SearchIcon :size="14" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
              <input v-model="userKeyword" class="admin-input w-full pl-9 pr-20" :placeholder="t('pages.admin.userSearchPh')" :disabled="tabLoading.users" @keyup.enter="userPage = 1; fetchUsers()" />
              <button v-if="userKeyword" type="button" class="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-300" @click="clearUserSearch">
                {{ t('pages.admin.clearSearch') }}
              </button>
            </div>
            <span class="text-xs text-gray-600">{{ t('pages.admin.totalRows', { n: userTotal }) }}</span>
          </div>
          <div class="admin-config-panel admin-users-note mb-4">
            <div>
              <p class="text-sm font-medium text-gold-100">{{ t('pages.admin.userQuotaRuleTitle') }}</p>
              <p class="mt-1 text-xs leading-relaxed text-gray-500">{{ t('pages.admin.userQuotaRuleBody') }}</p>
            </div>
            <span class="admin-badge bg-violet-500/12 text-violet-200 border-violet-400/20">{{ t('pages.admin.quotaUnlimited') }}</span>
          </div>
          <div class="admin-table-wrap max-h-[62vh]">
            <table class="w-full text-sm" :aria-label="t('pages.admin.tabUsers')">
              <thead class="sticky top-0 bg-[#0c0a16] z-10"><tr class="text-left text-gray-500 border-b border-gold-500/8 text-xs">
                <th class="px-4 py-3">{{ t('pages.admin.thId') }}</th><th>{{ t('pages.admin.thEmail') }}</th><th>{{ t('pages.admin.thNickname') }}</th><th>{{ t('pages.admin.thAvatar') }}</th><th>{{ t('pages.admin.thMembership') }}</th><th>{{ t('pages.admin.thQuota') }}</th><th>{{ t('pages.admin.thCreated') }}</th><th>{{ t('pages.admin.thAction') }}</th>
              </tr></thead>
              <tbody>
                <tr v-for="u in users" :key="(u.id as number)" class="border-b border-white/4 hover:bg-gold-500/3 transition-colors">
                  <td class="px-4 py-2.5 text-gray-500">{{ u.id }}</td>
                  <td class="max-w-[180px] truncate">{{ u.email }}</td>
                  <td>{{ u.nickname }}</td>
                  <td class="text-lg">{{ u.avatar }}</td>
                  <td>
                    <span class="admin-badge border" :class="adminMembershipClass(u)">{{ adminMembershipLabel(u) }}</span>
                    <p v-if="u.membership_expires_at" class="mt-1 text-[11px] text-gray-600">{{ formatAdminDate(u.membership_expires_at) }}</p>
                  </td>
                  <td><span class="admin-badge border" :class="adminQuotaClass(u)">{{ adminQuotaText(u) }}</span></td>
                  <td class="text-xs text-gray-600">{{ (u.created_at as string)?.slice(0, 10) }}</td>
                  <td><button type="button" class="admin-btn-sm" @click="openEditUser(u, $event)">{{ t('pages.admin.edit') }}</button></td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="flex items-center justify-between mt-3 text-sm text-gray-500">
            <span>{{ t('pages.admin.totalRows', { n: userTotal }) }}</span>
            <div class="flex gap-2">
              <button type="button" :disabled="userPage <= 1 || tabLoading.users" class="admin-btn-ghost disabled:opacity-30" @click="userPage--; fetchUsers()">{{ t('pages.admin.prevPage') }}</button>
              <span class="px-2 py-1 text-gray-400">{{ userPage }} / {{ userTotalPages }}</span>
              <button type="button" :disabled="userPage >= userTotalPages || tabLoading.users" class="admin-btn-ghost disabled:opacity-30" @click="userPage++; fetchUsers()">{{ t('pages.admin.nextPage') }}</button>
            </div>
          </div>
          <!-- Edit modal -->
          <Transition name="modal">
            <div v-if="editUser" class="admin-modal-overlay" @click.self="editUser = null">
              <div
                ref="editUserModalEl"
                class="admin-modal admin-modal-wide"
                role="dialog"
                aria-modal="true"
                aria-labelledby="admin-modal-edit-user-title"
                tabindex="-1"
                @keydown="onEditUserModalKeydown"
              >
                <div class="mb-5 flex flex-wrap items-start justify-between gap-3">
                  <div class="min-w-0">
                    <h3 id="admin-modal-edit-user-title" class="text-base font-medium text-gold-200">{{ t('pages.admin.editUserTitle') }} #{{ editUser.id }}</h3>
                    <p class="mt-1 truncate text-xs text-gray-500">{{ editUser.email }}</p>
                  </div>
                  <span class="admin-badge border" :class="adminMembershipClass(editUser)">{{ adminMembershipLabel(editUser) }}</span>
                </div>
                <div class="grid gap-4 text-sm md:grid-cols-2">
                  <div>
                    <label class="admin-label" for="admin-edit-nickname">{{ t('pages.admin.labelNickname') }}</label>
                    <input id="admin-edit-nickname" v-model="userForm.nickname" class="admin-input w-full" />
                  </div>
                  <div>
                    <label class="admin-label" for="admin-edit-membership">{{ t('pages.admin.labelMembership') }}</label>
                    <div class="admin-segment">
                      <button
                        type="button"
                        class="admin-segment-option"
                        :class="!userFormIsVip ? 'admin-segment-option-active' : ''"
                        @click="userForm.membership = 'free'"
                      >
                        {{ t('pages.admin.membershipOptionFree') }}
                      </button>
                      <button
                        type="button"
                        class="admin-segment-option"
                        :class="userFormIsVip ? 'admin-segment-option-active' : ''"
                        @click="userForm.membership = 'vip'"
                      >
                        {{ t('pages.admin.membershipOptionVip') }}
                      </button>
                    </div>
                  </div>
                  <div class="admin-config-panel md:col-span-2">
                    <div class="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <label class="admin-label mb-1" for="admin-edit-expires">{{ t('pages.admin.labelExpires') }}</label>
                        <p class="text-xs text-gray-500">{{ vipExpiryStatus }}</p>
                      </div>
                      <span class="admin-badge border" :class="userFormIsVip ? 'bg-amber-500/15 text-amber-300 border-amber-500/25' : 'bg-gray-500/10 text-gray-500 border-gray-500/15'">
                        {{ userFormIsVip ? t('pages.admin.vipModeLabel') : t('pages.admin.freeModeLabel') }}
                      </span>
                    </div>
                    <div class="mt-3 grid gap-2 md:grid-cols-[1fr_auto]">
                      <input id="admin-edit-expires" v-model="userForm.membership_expires_at" type="date" class="admin-input w-full" />
                      <div class="flex flex-wrap gap-2">
                        <button type="button" class="admin-btn-ghost" @click="setVipExpiryDays(30)">{{ t('pages.admin.vipExpiryQuick30') }}</button>
                        <button type="button" class="admin-btn-ghost" @click="setVipExpiryDays(365)">{{ t('pages.admin.vipExpiryQuick365') }}</button>
                        <button type="button" class="admin-btn-ghost" @click="clearVipExpiry">{{ t('pages.admin.clearExpiry') }}</button>
                      </div>
                    </div>
                    <p class="admin-help mt-3">{{ t('pages.admin.vipQuotaHint') }}</p>
                  </div>
                  <div class="admin-config-panel md:col-span-2" :class="userFormIsVip ? 'admin-config-panel-muted' : ''">
                    <label class="admin-label" for="admin-edit-quota">{{ t('pages.admin.labelQuota') }}</label>
                    <input
                      id="admin-edit-quota"
                      v-model.number="userForm.remaining_free_quota"
                      type="number"
                      min="0"
                      max="999"
                      class="admin-input w-full"
                      :disabled="userFormIsVip"
                    />
                    <p class="admin-help mt-2">{{ t('pages.admin.quotaFreeOnlyHint') }}</p>
                  </div>
                </div>
                <div class="mt-5 flex gap-2 justify-end">
                  <button type="button" class="admin-btn-ghost" @click="editUser = null">{{ t('pages.admin.cancel') }}</button>
                  <button type="button" :disabled="tabLoading.users" class="admin-btn-primary" @click="saveUser">{{ tabLoading.users ? t('pages.admin.saving') : t('pages.admin.save') }}</button>
                </div>
              </div>
            </div>
          </Transition>
        </section>

        <!-- Card Backs -->
        <section
          v-if="activeTab === 'backs'"
          :aria-busy="tabLoading.backs"
          :aria-label="t('pages.admin.tabBacks')"
        >
          <p v-if="tabLoading.backs" class="sr-only">{{ t('pages.admin.tabSectionLoading') }}</p>
          <div class="admin-table-wrap max-h-[66vh]">
            <table class="w-full text-sm" :aria-label="t('pages.admin.tabBacks')">
              <thead class="sticky top-0 bg-[#0c0a16] z-10"><tr class="text-left text-gray-500 border-b border-gold-500/8 text-xs">
                <th class="px-4 py-3 w-16">{{ t('pages.admin.thPreview') }}</th><th>{{ t('pages.admin.thCode') }}</th><th>{{ t('pages.admin.thName') }}</th><th>{{ t('pages.admin.thDesc') }}</th><th>{{ t('pages.admin.thImage') }}</th><th class="w-24">{{ t('pages.admin.thType') }}</th><th class="w-20">{{ t('pages.admin.thPrice') }}</th><th class="w-14">{{ t('pages.admin.thSort') }}</th><th class="w-12">{{ t('pages.admin.thActive') }}</th><th class="w-12"></th>
              </tr></thead>
              <tbody>
                <tr v-for="(b, i) in cardBacks" :key="cardBackRowKey(b, i)" class="border-b border-white/4 hover:bg-gold-500/3 transition-colors">
                  <td class="px-4 py-2 w-16">
                    <div class="w-10 h-14 rounded overflow-hidden flex-shrink-0 bg-black/30">
                      <img
                        v-if="b.asset_url"
                        :src="publicAssetUrl(b.asset_url as string)"
                        :alt="String(b.name || b.code || t('pages.admin.thPreview'))"
                        class="w-full h-full object-cover"
                      />
                      <div v-else class="w-full h-full flex items-center justify-center text-gray-600 text-xs">{{ t('pages.admin.noImage') }}</div>
                    </div>
                  </td>
                  <td><input v-model="(b as Record<string,unknown>).code" class="admin-inline-input" /></td>
                  <td><input v-model="(b as Record<string,unknown>).name" class="admin-inline-input" /></td>
                  <td><input v-model="(b as Record<string,unknown>).description" class="admin-inline-input text-xs" :placeholder="t('pages.admin.descPh')" /></td>
                  <td class="w-40">
                    <div class="flex items-center gap-1">
                      <input v-model="(b as Record<string,unknown>).asset_url" class="admin-inline-input flex-1 min-w-0 text-xs" :placeholder="t('pages.admin.imageUrlPh')" />
                      <label class="admin-btn-sm cursor-pointer flex-shrink-0">
                        {{ t('pages.admin.upload') }}
                        <input type="file" accept="image/*" class="hidden" @change="uploadCardBackImage(i, $event)" />
                      </label>
                    </div>
                  </td>
                  <td class="w-24">
                    <select v-model="(b as Record<string,unknown>).access_type" class="admin-inline-input text-xs">
                      <option value="free">{{ t('pages.admin.accessFree') }}</option>
                      <option value="vip">{{ t('pages.admin.accessVip') }}</option>
                      <option value="paid">{{ t('pages.admin.accessPaid') }}</option>
                    </select>
                  </td>
                  <td class="w-20">
                    <input
                      v-if="b.access_type === 'paid'"
                      v-model.number="(b as Record<string,unknown>).price"
                      type="number" step="0.01" min="0"
                      class="admin-inline-input w-16 text-center text-xs"
                      placeholder="¥"
                    />
                    <span v-else class="text-gray-700 text-xs">-</span>
                  </td>
                  <td class="w-14"><input v-model.number="(b as Record<string,unknown>).sort_order" type="number" class="admin-inline-input w-12 text-center" /></td>
                  <td class="w-12"><input type="checkbox" v-model="(b as Record<string,unknown>).is_active" class="accent-gold-500" /></td>
                  <td class="w-12">
                    <button type="button" class="text-red-400/60 hover:text-red-400 transition-colors text-xs inline-flex" @click="removeCardBack(i)" :title="t('pages.admin.deleteTitle')">
                      <Trash2 :size="14" />
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="mt-3 flex gap-2 justify-between">
            <button type="button" class="admin-btn-ghost" :disabled="tabLoading.backs" @click="addCardBack">{{ t('pages.admin.addBack') }}</button>
            <button type="button" :disabled="tabLoading.backs" class="admin-btn-primary" @click="saveCardBacks">{{ tabLoading.backs ? t('pages.admin.saving') : t('pages.admin.saveBacks') }}</button>
          </div>
        </section>

        <!-- Cards -->
        <section
          v-if="activeTab === 'cards'"
          :aria-busy="tabLoading.cards"
          :aria-label="t('pages.admin.tabCards')"
        >
          <p v-if="tabLoading.cards" class="sr-only">{{ t('pages.admin.tabSectionLoading') }}</p>
          <div class="admin-section-toolbar mb-4">
            <div class="relative flex-1 max-w-sm">
              <SearchIcon :size="14" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
              <input v-model="cardSearch" class="admin-input w-full pl-9 pr-20" :placeholder="t('pages.admin.cardSearchPh')" />
              <button v-if="cardSearch" type="button" class="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-300" @click="clearCardSearch">
                {{ t('pages.admin.clearSearch') }}
              </button>
            </div>
            <span class="text-xs text-gray-600">{{ t('pages.admin.cardFilterCount', { shown: filteredCards.length, total: cards.length }) }}</span>
          </div>
          <div class="admin-table-wrap max-h-[65vh]">
            <table class="w-full text-xs" :aria-label="t('pages.admin.tabCards')">
              <thead class="sticky top-0 bg-[#0c0a16] z-10"><tr class="text-left text-gray-500 border-b border-gold-500/8">
                <th class="px-3 py-2 w-12">{{ t('pages.admin.thId') }}</th><th>{{ t('pages.admin.thNameZh') }}</th><th>{{ t('pages.admin.thNameEn') }}</th><th>{{ t('pages.admin.thCardImage') }}</th><th>{{ t('pages.admin.thUprightKw') }}</th><th>{{ t('pages.admin.thReversedKw') }}</th><th class="w-20">{{ t('pages.admin.thTendency') }}</th><th class="w-12">{{ t('pages.admin.thActive') }}</th>
              </tr></thead>
              <tbody>
                <tr v-for="c in filteredCards" :key="(c.id as number)" class="border-b border-white/4 hover:bg-gold-500/3 transition-colors">
                  <td class="px-3 py-1.5 text-gray-600">{{ c.id }}</td>
                  <td><input v-model="(c as Record<string,unknown>).name" class="admin-inline-input" /></td>
                  <td><input v-model="(c as Record<string,unknown>).name_en" class="admin-inline-input" /></td>
                  <td class="w-36">
                    <div class="flex items-center gap-1">
                      <img
                        v-if="c.image_url"
                        :src="publicAssetUrl(c.image_url as string)"
                        :alt="String(c.name || c.id || '')"
                        class="w-8 h-11 rounded object-cover flex-shrink-0"
                      />
                      <label class="admin-btn-sm cursor-pointer flex-shrink-0">
                        {{ t('pages.admin.upload') }}
                        <input type="file" accept="image/*" class="hidden" @change="uploadCardImage(c.id as number, $event)" />
                      </label>
                    </div>
                  </td>
                  <td><input v-model="(c as Record<string,unknown>).upright_keywords" class="admin-inline-input" /></td>
                  <td><input v-model="(c as Record<string,unknown>).reversed_keywords" class="admin-inline-input" /></td>
                  <td><select v-model="(c as Record<string,unknown>).yes_no_tendency" class="admin-inline-input text-xs"><option value="yes">yes</option><option value="no">no</option><option value="neutral">neutral</option></select></td>
                  <td class="text-center"><input type="checkbox" v-model="(c as Record<string,unknown>).is_active" class="accent-gold-500" /></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- Prompts / 塔罗师资料 -->
        <section
          v-if="activeTab === 'prompts'"
          :aria-busy="tabLoading.prompts"
          :aria-label="t('pages.admin.tabPrompts')"
        >
          <p v-if="tabLoading.prompts" class="sr-only">{{ t('pages.admin.tabSectionLoading') }}</p>
          <div class="grid gap-3 md:grid-cols-4 mb-4">
            <div class="admin-mini-stat">
              <span>{{ t('pages.admin.promptStatReaders') }}</span>
              <strong>{{ promptStats.total }}</strong>
            </div>
            <div class="admin-mini-stat">
              <span>{{ t('pages.admin.promptStatFeatured') }}</span>
              <strong>{{ promptStats.featured }}</strong>
            </div>
            <div class="admin-mini-stat">
              <span>{{ t('pages.admin.promptStatVip') }}</span>
              <strong>{{ promptStats.vip }}</strong>
            </div>
            <div class="admin-mini-stat">
              <span>{{ t('pages.admin.promptStatAvatar') }}</span>
              <strong>{{ promptStats.avatar }}</strong>
            </div>
          </div>

          <div class="admin-section-toolbar mb-4">
            <div class="relative flex-1 max-w-sm">
              <SearchIcon :size="14" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
              <input v-model="promptSearch" class="admin-input w-full pl-9 pr-20" :placeholder="t('pages.admin.promptSearchPh')" />
              <button v-if="promptSearch || promptAccessFilter !== 'all'" type="button" class="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-300" @click="clearPromptFilters">
                {{ t('pages.admin.clearSearch') }}
              </button>
            </div>
            <select v-model="promptAccessFilter" class="admin-input">
              <option v-for="option in promptFilterOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
            <span class="text-xs text-gray-600">{{ t('pages.admin.promptFilterCount', { shown: filteredReaderMeta.length, total: promptStats.total }) }}</span>
          </div>

          <div class="mb-5 admin-config-panel">
            <p class="font-medium text-gold-200 mb-1">{{ t('pages.admin.promptsBoxTitle') }}</p>
            <p class="text-gray-500 text-xs leading-relaxed">{{ t('pages.admin.promptsBoxBody') }}</p>
          </div>

          <div class="admin-config-panel mb-5">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p class="font-medium text-gold-200 text-sm">{{ t('pages.admin.featuredTitle') }}</p>
                <p class="text-gray-500 text-xs mt-0.5">{{ t('pages.admin.featuredHintCompact') }}</p>
              </div>
              <button type="button" :disabled="tabLoading.prompts" class="admin-btn-primary" @click="saveFeatured">
                {{ tabLoading.prompts ? t('pages.admin.saving') : t('pages.admin.saveFeatured') }}
              </button>
            </div>
            <div class="mt-3 flex flex-wrap gap-2">
              <span
                v-for="r in featuredReaderMeta"
                :key="`featured-chip-${r.code}`"
                class="admin-reader-chip"
              >
                {{ promptDisplayName(r.code) }}
                <small>#{{ featuredRow(r.code).sortOrder || 0 }}</small>
              </span>
              <span v-if="!featuredReaderMeta.length" class="text-xs text-gray-600">{{ t('pages.admin.featuredEmpty') }}</span>
            </div>
          </div>

          <!-- 推荐热门塔罗师配置 -->
          <div v-if="false" class="hidden">
            <div class="px-4 py-3 border-b border-gold-500/8">
              <p class="font-medium text-gold-200 text-sm">{{ t('pages.admin.featuredTitle') }}</p>
              <p class="text-gray-500 text-xs mt-0.5">{{ t('pages.admin.featuredHint') }}</p>
            </div>
            <div class="divide-y divide-gold-500/6">
              <div
                v-for="r in readerMeta"
                :key="`featured-${r.code}`"
                class="flex items-center gap-3 px-4 py-3 hover:bg-gold-500/[0.02] transition-colors"
              >
                <span v-if="promptRow(r.code).avatarUrl" class="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 ring-1 ring-gold-500/15">
                  <img
                    :src="publicAssetUrl(promptRow(r.code).avatarUrl || promptRow(r.code).avatarThumbUrl)"
                    :alt="readerLocalizedName(r.code)"
                    class="w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                </span>
                <span v-else class="w-8 h-8 rounded-lg flex items-center justify-center text-base bg-white/5 flex-shrink-0">{{ (promptRow(r.code).emoji || '').trim() || promptRow(r.code).defaultEmoji || r.emoji }}</span>
                <div class="flex-1 min-w-0">
                  <p class="text-sm text-gray-200 truncate">
                    {{ (promptRow(r.code).displayName || '').trim() || promptRow(r.code).defaultDisplayName || readerLocalizedName(r.code) }}
                  </p>
                  <p class="text-xs text-gray-600">{{ r.code }}</p>
                </div>
                <label class="flex items-center gap-2 text-sm text-gray-400 cursor-pointer flex-shrink-0"
                >
                  <input
                    v-model="featuredRow(r.code).isActive"
                    type="checkbox"
                    class="accent-gold-500 w-4 h-4"
                  />
                  {{ t('pages.admin.featuredIsActive') }}
                </label>
                <div class="flex items-center gap-2 flex-shrink-0">
                  <span class="text-xs text-gray-500">{{ t('pages.admin.featuredSort') }}</span>
                  <input
                    v-model.number="featuredRow(r.code).sortOrder"
                    type="number"
                    min="0"
                    max="9999"
                    class="admin-input w-16 text-center"
                  />
                </div>
              </div>
            </div>
            <div class="px-4 py-3 border-t border-gold-500/8 flex justify-end">
              <button
                type="button"
                :disabled="tabLoading.prompts"
                class="admin-btn-primary"
                @click="saveFeatured"
              >
                {{ tabLoading.prompts ? t('pages.admin.saving') : t('pages.admin.saveFeatured') }}
              </button>
            </div>
          </div>

          <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p class="text-xs text-gray-500">{{ t('pages.admin.promptListHint') }}</p>
            <div class="flex gap-2">
              <button type="button" class="admin-btn-ghost" @click="selectFirstFilteredReader">{{ t('pages.admin.selectFirst') }}</button>
              <button type="button" class="admin-btn-ghost" @click="collapsePromptReader">{{ t('pages.admin.collapseAll') }}</button>
            </div>
          </div>

          <div class="admin-reader-board">
            <div class="admin-reader-grid">
              <button
                v-for="r in filteredReaderMeta"
                :key="`reader-card-${r.code}`"
                type="button"
                class="admin-reader-tile"
                :class="selectedReaderCode === r.code ? 'admin-reader-tile-active' : ''"
                @click="selectPromptReader(r.code)"
              >
                <span v-if="promptAvatarUrl(r.code)" class="admin-reader-tile-avatar">
                  <img
                    :src="publicAssetUrl(promptAvatarUrl(r.code))"
                    :alt="readerLocalizedName(r.code)"
                    loading="lazy"
                    decoding="async"
                  />
                </span>
                <span v-else class="admin-reader-tile-avatar admin-reader-tile-emoji">{{ (promptRow(r.code).emoji || '').trim() || promptRow(r.code).defaultEmoji || r.emoji }}</span>
                <span class="min-w-0 flex-1 text-left">
                  <span class="block truncate text-sm font-medium text-gray-200">{{ promptDisplayName(r.code) }}</span>
                  <span class="block text-xs text-gray-600">{{ r.code }}</span>
                </span>
                <span class="admin-reader-tile-badges">
                  <span class="admin-badge border" :class="promptAccessClass(r.code)">{{ promptAccessLabel(r.code) }}</span>
                  <span v-if="isFeaturedReader(r.code)" class="admin-badge bg-gold-500/10 text-gold-300 border-gold-500/20">{{ t('pages.admin.featuredIsActive') }}</span>
                </span>
              </button>
              <p v-if="!filteredReaderMeta.length" class="admin-empty-state md:col-span-2 xl:col-span-3">{{ t('pages.admin.promptEmptyFiltered') }}</p>
            </div>

            <div v-if="selectedReaderCode" class="admin-reader-editor">
              <div class="flex flex-wrap items-center justify-between gap-3 border-b border-gold-500/8 pb-4">
                <div class="flex min-w-0 items-center gap-3">
                  <span v-if="promptAvatarUrl(selectedReaderCode)" class="admin-reader-editor-avatar">
                    <img
                      :src="publicAssetUrl(promptAvatarUrl(selectedReaderCode))"
                      :alt="readerLocalizedName(selectedReaderCode)"
                      loading="lazy"
                      decoding="async"
                    />
                  </span>
                  <span v-else class="admin-reader-editor-avatar admin-reader-tile-emoji">{{ (promptRow(selectedReaderCode).emoji || '').trim() || promptRow(selectedReaderCode).defaultEmoji || readerMeta.find((x) => x.code === selectedReaderCode)?.emoji }}</span>
                  <span class="min-w-0">
                    <span class="block truncate text-base font-medium text-gold-100">{{ promptDisplayName(selectedReaderCode) }}</span>
                    <span class="block text-xs text-gray-600">{{ selectedReaderCode }}</span>
                  </span>
                </div>
                <div class="flex flex-wrap gap-1.5">
                  <span class="admin-badge border" :class="promptAccessClass(selectedReaderCode)">{{ promptAccessLabel(selectedReaderCode) }}</span>
                  <span v-if="isFeaturedReader(selectedReaderCode)" class="admin-badge bg-gold-500/10 text-gold-300 border-gold-500/20">{{ t('pages.admin.featuredIsActive') }}</span>
                  <span v-if="hasCustomPromptConfig(selectedReaderCode)" class="admin-badge bg-white/5 text-gray-400 border-white/8">{{ t('pages.admin.promptCustomBadge') }}</span>
                </div>
              </div>

              <div class="grid gap-4 pt-4 lg:grid-cols-[280px_1fr]">
                <div class="space-y-3">
                  <div class="admin-config-panel">
                    <div class="flex items-center gap-3">
                      <span v-if="promptAvatarUrl(selectedReaderCode)" class="admin-reader-editor-avatar">
                        <img
                          :src="publicAssetUrl(promptAvatarUrl(selectedReaderCode))"
                          :alt="readerLocalizedName(selectedReaderCode)"
                          loading="lazy"
                          decoding="async"
                        />
                      </span>
                      <span v-else class="admin-reader-editor-avatar admin-reader-tile-emoji">{{ (promptRow(selectedReaderCode).emoji || '').trim() || promptRow(selectedReaderCode).defaultEmoji || readerMeta.find((x) => x.code === selectedReaderCode)?.emoji }}</span>
                      <label class="admin-btn-sm inline-flex cursor-pointer">
                        {{ t('pages.admin.uploadAvatar') }}
                        <input type="file" accept="image/*" class="hidden" @change="uploadReaderAvatar(selectedReaderCode, $event)" />
                      </label>
                    </div>
                  </div>
                  <div>
                    <label class="admin-label">{{ t('pages.admin.labelDisplayName') }}</label>
                    <input v-model="promptRow(selectedReaderCode).displayName" class="admin-input w-full" :placeholder="t('pages.admin.displayNamePh')" />
                    <p class="text-xs text-gray-600 mt-1">{{ t('pages.admin.builtinDefault') }}<span class="text-gold-500/80">{{ promptRow(selectedReaderCode).defaultDisplayName }}</span></p>
                  </div>
                  <div>
                    <label class="admin-label">{{ t('pages.admin.labelEmoji') }}</label>
                    <input v-model="promptRow(selectedReaderCode).emoji" class="admin-input w-full" :placeholder="t('pages.admin.emojiPh')" />
                  </div>
                  <div>
                    <label class="admin-label">{{ t('pages.admin.labelAccess') }}</label>
                    <select v-model="promptRow(selectedReaderCode).accessLevel" class="admin-input w-full">
                      <option value="">{{ t('pages.admin.accessFollowBuiltin') }}</option>
                      <option value="free">{{ t('pages.admin.accessFree') }}</option>
                      <option value="vip">{{ t('pages.admin.accessVip') }}</option>
                    </select>
                  </div>
                  <div class="grid grid-cols-[1fr_76px] gap-2 border-t border-gold-500/8 pt-3">
                    <label class="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                      <input
                        v-model="featuredRow(selectedReaderCode).isActive"
                        type="checkbox"
                        class="accent-gold-500 w-4 h-4"
                      />
                      {{ t('pages.admin.featuredIsActive') }}
                    </label>
                    <input
                      v-model.number="featuredRow(selectedReaderCode).sortOrder"
                      type="number"
                      min="0"
                      max="9999"
                      class="admin-input text-center"
                      :aria-label="t('pages.admin.featuredSort')"
                    />
                  </div>
                </div>

                <div class="space-y-3 min-w-0">
                  <div>
                    <label class="admin-label">{{ t('pages.admin.labelSystemPrompt') }}</label>
                    <textarea v-model="promptRow(selectedReaderCode).systemPrompt" rows="11" class="admin-input w-full resize-y font-mono text-xs leading-relaxed"></textarea>
                  </div>
                  <div>
                    <label class="admin-label">{{ t('pages.admin.labelGreeting') }}</label>
                    <textarea v-model="promptRow(selectedReaderCode).greeting" rows="3" class="admin-input w-full resize-y"></textarea>
                  </div>
                  <div class="flex flex-wrap justify-end gap-2">
                    <button type="button" :disabled="tabLoading.prompts" class="admin-btn-ghost" @click="saveFeatured">{{ tabLoading.prompts ? t('pages.admin.saving') : t('pages.admin.saveFeaturedShort') }}</button>
                    <button type="button" :disabled="tabLoading.prompts" class="admin-btn-primary" @click="savePrompt(selectedReaderCode)">{{ tabLoading.prompts ? t('pages.admin.saving') : t('pages.admin.saveReader') }}</button>
                  </div>
                </div>
              </div>
            </div>
            <p v-else class="admin-empty-state">{{ t('pages.admin.promptEmptyFiltered') }}</p>
          </div>

          <div v-if="false" class="space-y-3">
            <div v-for="r in filteredReaderMeta" :key="r.code" class="admin-reader-card">
              <button
                type="button"
                class="w-full flex items-center gap-3 px-5 py-4 hover:bg-gold-500/3 transition-colors text-left"
                :aria-expanded="expandedPrompt === r.code"
                :aria-controls="promptPanelId(r.code)"
                @click="onTogglePromptReader(r.code)"
              >
                <span v-if="promptAvatarUrl(r.code)" class="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 ring-1 ring-gold-500/15">
                  <img
                    :src="publicAssetUrl(promptAvatarUrl(r.code))"
                    :alt="readerLocalizedName(r.code)"
                    class="w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                </span>
                <span v-else class="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-xl flex-shrink-0">{{ (promptRow(r.code).emoji || '').trim() || promptRow(r.code).defaultEmoji || r.emoji }}</span>
                <span class="min-w-0 flex-1">
                  <span class="block font-medium text-gray-200 truncate">{{ promptDisplayName(r.code) }}</span>
                  <span class="block text-xs text-gray-600">{{ r.code }}</span>
                </span>
                <span class="hidden lg:flex items-center gap-1.5">
                  <span class="admin-badge border" :class="promptAccessClass(r.code)">{{ promptAccessLabel(r.code) }}</span>
                  <span v-if="isFeaturedReader(r.code)" class="admin-badge bg-gold-500/10 text-gold-300 border-gold-500/20">{{ t('pages.admin.featuredIsActive') }}</span>
                  <span v-if="hasCustomPromptConfig(r.code)" class="admin-badge bg-white/5 text-gray-400 border-white/8">{{ t('pages.admin.promptCustomBadge') }}</span>
                </span>
                <ChevronDown class="w-4 h-4 ml-auto text-gray-600 transition-transform duration-200" :class="expandedPrompt === r.code ? 'rotate-180' : ''" :size="16" />
              </button>
              <div v-if="expandedPrompt === r.code" :id="promptPanelId(r.code)" class="px-5 pb-5 border-t border-gold-500/6 pt-4">
                <div class="grid gap-4 lg:grid-cols-[280px_1fr]">
                  <div class="admin-config-panel space-y-3">
                    <div class="flex items-center gap-3">
                      <div class="w-16 h-16 rounded-xl overflow-hidden bg-white/5 border border-gold-500/10 flex items-center justify-center text-3xl flex-shrink-0">
                      <img
                        v-if="promptRow(r.code).avatarUrl"
                        :src="publicAssetUrl(promptRow(r.code).avatarUrl || promptRow(r.code).avatarThumbUrl)"
                        :alt="readerLocalizedName(r.code)"
                        class="w-full h-full object-cover"
                        loading="lazy"
                        decoding="async"
                      />
                      <span v-else>{{ (promptRow(r.code).emoji || '').trim() || promptRow(r.code).defaultEmoji || r.emoji }}</span>
                    </div>
                      <div class="min-w-0">
                        <p class="truncate text-sm font-medium text-gray-200">{{ promptDisplayName(r.code) }}</p>
                        <p class="text-xs text-gray-600">{{ r.code }}</p>
                        <label class="admin-btn-sm mt-2 inline-flex cursor-pointer">
                          {{ t('pages.admin.uploadAvatar') }}
                          <input type="file" accept="image/*" class="hidden" @change="uploadReaderAvatar(r.code, $event)" />
                        </label>
                      </div>
                    </div>
                    <div>
                      <label class="admin-label">{{ t('pages.admin.labelDisplayName') }}</label>
                      <input v-model="promptRow(r.code).displayName" class="admin-input w-full" :placeholder="t('pages.admin.displayNamePh')" />
                      <p class="text-xs text-gray-600 mt-1">{{ t('pages.admin.builtinDefault') }}<span class="text-gold-500/80">{{ promptRow(r.code).defaultDisplayName }}</span></p>
                    </div>
                    <div>
                      <label class="admin-label">{{ t('pages.admin.labelEmoji') }}</label>
                      <input v-model="promptRow(r.code).emoji" class="admin-input w-full max-w-xs" :placeholder="t('pages.admin.emojiPh')" />
                    </div>
                    <div>
                      <label class="admin-label">{{ t('pages.admin.labelAccess') }}</label>
                      <select v-model="promptRow(r.code).accessLevel" class="admin-input w-full max-w-xs">
                        <option value="">{{ t('pages.admin.accessFollowBuiltin') }}</option>
                        <option value="free">{{ t('pages.admin.accessFree') }}</option>
                        <option value="vip">{{ t('pages.admin.accessVip') }}</option>
                      </select>
                    </div>
                    <div class="grid grid-cols-[1fr_76px] gap-2 border-t border-gold-500/8 pt-3">
                      <label class="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                        <input
                          v-model="featuredRow(r.code).isActive"
                          type="checkbox"
                          class="accent-gold-500 w-4 h-4"
                        />
                        {{ t('pages.admin.featuredIsActive') }}
                      </label>
                      <input
                        v-model.number="featuredRow(r.code).sortOrder"
                        type="number"
                        min="0"
                        max="9999"
                        class="admin-input text-center"
                        :aria-label="t('pages.admin.featuredSort')"
                      />
                    </div>
                  </div>
                  <div class="space-y-3 min-w-0">
                    <div>
                      <label class="admin-label">{{ t('pages.admin.labelSystemPrompt') }}</label>
                      <textarea v-model="promptRow(r.code).systemPrompt" rows="9" class="admin-input w-full resize-y font-mono text-xs leading-relaxed"></textarea>
                    </div>
                    <div>
                      <label class="admin-label">{{ t('pages.admin.labelGreeting') }}</label>
                      <textarea v-model="promptRow(r.code).greeting" rows="3" class="admin-input w-full resize-y"></textarea>
                    </div>
                    <div class="flex flex-wrap justify-end gap-2">
                      <button type="button" :disabled="tabLoading.prompts" class="admin-btn-ghost" @click="saveFeatured">{{ tabLoading.prompts ? t('pages.admin.saving') : t('pages.admin.saveFeaturedShort') }}</button>
                      <button type="button" :disabled="tabLoading.prompts" class="admin-btn-primary" @click="savePrompt(r.code)">{{ tabLoading.prompts ? t('pages.admin.saving') : t('pages.admin.saveReader') }}</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <p v-if="!filteredReaderMeta.length" class="admin-empty-state">{{ t('pages.admin.promptEmptyFiltered') }}</p>
          </div>
        </section>

        <!-- Feedback -->
        <section
          v-if="activeTab === 'feedback'"
          :aria-label="t('pages.admin.tabFeedback')"
          :aria-busy="tabLoading.feedback"
          class="min-w-0"
        >
          <p v-if="tabLoading.feedback" class="sr-only">{{ t('pages.admin.tabSectionLoading') }}</p>
          <div class="flex items-center gap-3 mb-4">
            <select v-model="feedbackFilter" class="admin-input" :disabled="tabLoading.feedback" @change="feedbackPage = 1; fetchFeedback()">
              <option value="">{{ t('pages.admin.filterAll') }}</option>
              <option value="pending">{{ t('pages.admin.statusPending') }}</option>
              <option value="processing">{{ t('pages.admin.statusProcessing') }}</option>
              <option value="resolved">{{ t('pages.admin.statusResolved') }}</option>
              <option value="closed">{{ t('pages.admin.statusClosed') }}</option>
            </select>
          </div>
          <div class="space-y-3">
            <div v-for="f in feedbackList" :key="(f.id as number)" class="rounded-xl border border-gold-500/8 bg-white/2 p-4">
              <div class="flex items-start justify-between gap-4">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 mb-1.5 text-xs">
                    <span class="admin-badge bg-white/5 text-gray-400 border-white/8">{{ f.type }}</span>
                    <span class="admin-badge border" :class="statusColors[(f.status as string)] || 'bg-gray-500/10 text-gray-400 border-gray-500/15'">{{ statusLabels[f.status as string] || f.status }}</span>
                    <span class="text-gray-700">{{ (f.created_at as string)?.slice(0, 16).replace('T', ' ') }}</span>
                  </div>
                  <p class="text-sm text-gray-300 mb-1">{{ f.content }}</p>
                  <p class="text-xs text-gray-600">{{ t('pages.admin.userLabel') }}: {{ f.user_nickname || f.user_email || t('pages.admin.anonymous') }}<template v-if="f.contact"> | {{ t('pages.admin.contactLabel') }}: {{ f.contact }}</template></p>
                  <p v-if="f.admin_reply" class="mt-2 text-xs text-emerald-400/80 bg-emerald-500/8 rounded-lg px-3 py-2 border border-emerald-500/10">{{ t('pages.admin.adminReply') }}: {{ f.admin_reply }}</p>
                </div>
                <button
                  v-if="f.status !== 'resolved' && f.status !== 'closed'"
                  type="button"
                  class="admin-btn-sm flex-shrink-0"
                  @click="openReplyModal(f, $event)"
                >{{ t('pages.admin.reply') }}</button>
              </div>
            </div>
            <p v-if="!feedbackList.length" class="text-center text-gray-600 py-8">{{ t('pages.admin.emptyFeedback') }}</p>
          </div>
          <div v-if="feedbackTotal > 15" class="flex items-center justify-between mt-3 text-sm text-gray-500">
            <span>{{ t('pages.admin.totalRows', { n: feedbackTotal }) }}</span>
            <div class="flex gap-2">
              <button type="button" :disabled="feedbackPage <= 1 || tabLoading.feedback" class="admin-btn-ghost disabled:opacity-30" @click="feedbackPage--; fetchFeedback()">{{ t('pages.admin.prevPage') }}</button>
              <span class="px-2 py-1 text-gray-400">{{ feedbackPage }} / {{ feedbackTotalPages }}</span>
              <button type="button" :disabled="feedbackPage >= feedbackTotalPages || tabLoading.feedback" class="admin-btn-ghost disabled:opacity-30" @click="feedbackPage++; fetchFeedback()">{{ t('pages.admin.nextPage') }}</button>
            </div>
          </div>
          <!-- Reply modal -->
          <Transition name="modal">
            <div v-if="replyTarget" class="admin-modal-overlay" @click.self="replyTarget = null">
              <div
                ref="replyModalEl"
                class="admin-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="admin-modal-reply-title"
                tabindex="-1"
                @keydown="onReplyModalKeydown"
              >
                <h3 id="admin-modal-reply-title" class="text-base font-medium text-gold-200 mb-2">{{ t('pages.admin.replyModalTitle') }} #{{ replyTarget.id }}</h3>
                <p class="text-sm text-gray-500 mb-4 line-clamp-3">{{ replyTarget.content }}</p>
                <textarea
                  id="admin-reply-text"
                  v-model="replyText"
                  rows="4"
                  class="admin-input w-full mb-3"
                  :placeholder="t('pages.admin.replyPh')"
                  :aria-label="t('pages.admin.replyPh')"
                ></textarea>
                <div class="flex items-center gap-3 mb-4">
                  <label for="admin-reply-status" class="text-xs text-gray-500">{{ t('pages.admin.statusField') }}:</label>
                  <select id="admin-reply-status" v-model="replyStatus" class="admin-input">
                    <option value="processing">{{ t('pages.admin.statusProcessing') }}</option>
                    <option value="resolved">{{ t('pages.admin.statusResolved') }}</option>
                    <option value="closed">{{ t('pages.admin.statusClosed') }}</option>
                  </select>
                </div>
                <div class="flex gap-2 justify-end">
                  <button type="button" class="admin-btn-ghost" @click="replyTarget = null">{{ t('pages.admin.cancel') }}</button>
                  <button type="button" :disabled="tabLoading.feedback || !replyText.trim()" class="admin-btn-primary disabled:opacity-40" @click="submitReply">{{ tabLoading.feedback ? t('pages.admin.submitting') : t('pages.admin.submitReply') }}</button>
                </div>
              </div>
            </div>
          </Transition>
        </section>
      </main>
    </div>
  </div>
</template>

<style scoped>
.admin-topbar {
  min-height: 76px;
  padding: 14px 24px;
  border-bottom: 1px solid rgba(212,168,83,.08);
  background: rgba(12,10,22,.84);
  backdrop-filter: blur(18px);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-shrink: 0;
}
.admin-section-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.admin-stat-card {
  padding: 20px;
  border-radius: 16px;
  background: linear-gradient(145deg, rgba(12,10,22,.9), rgba(7,6,14,.7));
  border: 1px solid rgba(212,168,83,.06);
}
.admin-action-card {
  padding: 16px;
  border-radius: 12px;
  background: rgba(255,255,255,.02);
  border: 1px solid rgba(212,168,83,.06);
  cursor: pointer;
  transition: all .2s;
  text-align: left;
}
.admin-action-card:hover {
  border-color: rgba(212,168,83,.15);
  background: rgba(212,168,83,.03);
}
.admin-mini-stat {
  min-height: 76px;
  border-radius: 12px;
  border: 1px solid rgba(212,168,83,.07);
  background: rgba(255,255,255,.018);
  padding: 14px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}
.admin-mini-stat span {
  color: #6b7280;
  font-size: 12px;
}
.admin-mini-stat strong {
  color: #f3ead7;
  font-size: 24px;
  line-height: 1;
}
.admin-reader-card {
  border-radius: 12px;
  border: 1px solid rgba(212,168,83,.08);
  background: rgba(255,255,255,.018);
  overflow: hidden;
}
.admin-reader-card:hover {
  border-color: rgba(212,168,83,.14);
}
.admin-reader-board {
  display: grid;
  grid-template-columns: minmax(280px, 0.92fr) minmax(360px, 1.28fr);
  gap: 16px;
  align-items: start;
}
.admin-reader-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: 10px;
}
.admin-reader-tile {
  min-height: 92px;
  border-radius: 12px;
  border: 1px solid rgba(212,168,83,.08);
  background: rgba(255,255,255,.018);
  padding: 12px;
  display: flex;
  align-items: center;
  gap: 10px;
  transition: border-color .2s, background .2s, box-shadow .2s;
}
.admin-reader-tile:hover {
  border-color: rgba(212,168,83,.16);
  background: rgba(212,168,83,.035);
}
.admin-reader-tile-active {
  border-color: rgba(212,168,83,.32);
  background: linear-gradient(145deg, rgba(212,168,83,.1), rgba(255,255,255,.025));
  box-shadow: inset 0 0 0 1px rgba(212,168,83,.08), 0 12px 30px rgba(0,0,0,.18);
}
.admin-reader-tile-avatar,
.admin-reader-editor-avatar {
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(212,168,83,.1);
  background: rgba(255,255,255,.05);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.admin-reader-tile-avatar {
  width: 44px;
  height: 44px;
}
.admin-reader-editor-avatar {
  width: 56px;
  height: 56px;
}
.admin-reader-tile-avatar img,
.admin-reader-editor-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.admin-reader-tile-emoji {
  color: #e8e0d4;
  font-size: 22px;
}
.admin-reader-tile-badges {
  width: 100%;
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 8px;
  grid-column: 1 / -1;
}
.admin-reader-tile {
  flex-wrap: wrap;
}
.admin-reader-editor {
  position: sticky;
  top: 16px;
  border-radius: 14px;
  border: 1px solid rgba(212,168,83,.1);
  background:
    linear-gradient(145deg, rgba(255,255,255,.032), rgba(255,255,255,.014)),
    rgba(12,10,22,.72);
  padding: 18px;
  box-shadow: 0 18px 45px rgba(0,0,0,.22);
}
.admin-reader-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border-radius: 8px;
  border: 1px solid rgba(212,168,83,.12);
  background: rgba(212,168,83,.06);
  color: #d9c48d;
  padding: 5px 9px;
  font-size: 12px;
}
.admin-reader-chip small {
  color: #6b7280;
  font-size: 11px;
}
.admin-empty-state {
  border-radius: 12px;
  border: 1px dashed rgba(212,168,83,.12);
  background: rgba(255,255,255,.014);
  color: #6b7280;
  padding: 28px;
  text-align: center;
  font-size: 13px;
}
.admin-table-wrap {
  border-radius: 12px;
  border: 1px solid rgba(212,168,83,.06);
  background: rgba(255,255,255,.015);
  overflow: auto;
}
.admin-input {
  padding: 8px 12px;
  border-radius: 8px;
  background: rgba(255,255,255,.03);
  border: 1px solid rgba(212,168,83,.08);
  color: #e8e0d4;
  font-size: 13px;
  transition: border-color .2s, box-shadow .2s;
}
.admin-input:focus {
  outline: none;
  border-color: rgba(212,168,83,.3);
  box-shadow: 0 0 0 2px rgba(212,168,83,.06);
}
.admin-input:disabled {
  cursor: not-allowed;
  color: #6b7280;
  background: rgba(255,255,255,.018);
}
.admin-inline-input {
  width: 100%;
  background: transparent;
  border-bottom: 1px solid rgba(255,255,255,.06);
  outline: none;
  padding: 4px 0;
  color: #e8e0d4;
  transition: border-color .2s;
}
.admin-inline-input:focus {
  border-color: rgba(212,168,83,.3);
}
.admin-label {
  display: block;
  margin-bottom: 4px;
  color: #6b7280;
  font-size: 12px;
}
.admin-btn-primary {
  padding: 8px 16px;
  border-radius: 8px;
  background: linear-gradient(135deg, var(--color-gold-500), var(--color-gold-600));
  color: #07060e;
  font-size: 13px;
  font-weight: 600;
  transition: all .2s;
}
.admin-btn-primary:hover {
  box-shadow: 0 4px 16px rgba(212,168,83,.2);
}
.admin-btn-ghost {
  padding: 6px 12px;
  border-radius: 8px;
  background: rgba(255,255,255,.04);
  border: 1px solid rgba(255,255,255,.06);
  color: #9ca3af;
  font-size: 13px;
  transition: all .2s;
}
.admin-btn-ghost:hover {
  background: rgba(255,255,255,.08);
  color: #e5e7eb;
}
.admin-btn-sm {
  padding: 4px 10px;
  border-radius: 6px;
  background: rgba(212,168,83,.08);
  color: var(--color-gold-300);
  font-size: 12px;
  transition: all .2s;
}
.admin-btn-sm:hover {
  background: rgba(212,168,83,.15);
}
.admin-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 500;
  border: 1px solid transparent;
}
.admin-config-panel {
  border-radius: 12px;
  border: 1px solid rgba(212,168,83,.08);
  background:
    linear-gradient(145deg, rgba(255,255,255,.035), rgba(255,255,255,.015)),
    rgba(7,6,14,.35);
  padding: 14px;
}
.admin-config-panel-muted {
  border-color: rgba(255,255,255,.055);
  background: rgba(255,255,255,.018);
}
.admin-users-note {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.admin-help {
  color: #6b7280;
  font-size: 12px;
  line-height: 1.6;
}
.admin-segment {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
  padding: 4px;
  border-radius: 10px;
  border: 1px solid rgba(212,168,83,.08);
  background: rgba(255,255,255,.025);
}
.admin-segment-option {
  border-radius: 8px;
  padding: 8px 10px;
  color: #9ca3af;
  font-size: 13px;
  transition: background .2s, color .2s, box-shadow .2s;
}
.admin-segment-option:hover {
  color: #e8e0d4;
  background: rgba(255,255,255,.04);
}
.admin-segment-option-active {
  color: #07060e;
  background: linear-gradient(135deg, var(--color-gold-500), var(--color-gold-600));
  box-shadow: 0 8px 20px rgba(212,168,83,.14);
}
.admin-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 40;
  background: rgba(0,0,0,.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
}
.admin-modal {
  width: 100%;
  max-width: 28rem;
  border-radius: 20px;
  border: 1px solid rgba(212,168,83,.1);
  background: #0c0a16;
  padding: 24px;
}
.admin-modal-wide {
  max-width: 42rem;
}
.modal-enter-active { transition: opacity .2s, transform .2s; }
.modal-leave-active { transition: opacity .15s, transform .15s; }
.modal-enter-from { opacity: 0; transform: scale(.95) translateY(8px); }
.modal-leave-to { opacity: 0; transform: scale(.97) translateY(4px); }
.toast-enter-active { transition: opacity .25s, transform .25s; }
.toast-leave-active { transition: opacity .2s, transform .2s; }
.toast-enter-from { opacity: 0; transform: translateY(-12px); }
.toast-leave-to { opacity: 0; transform: translateY(-8px); }
@media (max-width: 900px) {
  .admin-topbar {
    align-items: flex-start;
    flex-direction: column;
  }
  .admin-section-toolbar {
    align-items: stretch;
    flex-direction: column;
  }
  .admin-reader-board {
    grid-template-columns: 1fr;
  }
  .admin-reader-editor {
    position: static;
  }
}
</style>
