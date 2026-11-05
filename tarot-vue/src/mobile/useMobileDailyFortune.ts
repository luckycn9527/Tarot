import { onScopeDispose, ref, watch, type Ref } from 'vue'
import type { DailyFortuneResponse } from '../services/tarotAiReading'
import { mobileError } from './mobileApi'
import { fetchMobileDailyFortune, generateMobileDailyFortune } from './mobileDailyApi'
import { readMobileValue, writeMobileValue, mobileSite } from './mobileStorage'
import {
  acceptsMobileDailyScope, isCurrentMobileDailyCache, mobileDailyCacheFromResponse,
  mobileDailyResponseFromCache, sameMobileDailyWindow, selectMobileDailyCard,
  type MobileDailyCache, type MobileDailyScope,
} from './mobileDailyModel'
import type { MobileCard } from './types'

interface DailyOptions { owner: Ref<number | null>; ready: Ref<boolean>; online: Ref<boolean>; cardIds: Ref<number[]> }

export function useMobileDailyFortune(options: DailyOptions) {
  const card = ref<MobileCard>({ id: 0, isReversed: false })
  const flipped = ref(false), busy = ref(false), cached = ref(false), error = ref('')
  const response = ref<DailyFortuneResponse | null>(null)
  let cache: MobileDailyCache | null = null, sequence = 0, disposed = false
  let timer: ReturnType<typeof setTimeout> | undefined
  let hydration: Promise<void> | null = null, drawing: Promise<void> | null = null, refreshing: Promise<void> | null = null

  function current(scope: MobileDailyScope) {
    return !disposed && acceptsMobileDailyScope(scope, options.owner.value, sequence, options.ready.value)
  }
  function scope(): MobileDailyScope | null {
    const owner = options.owner.value
    return options.ready.value && Number.isSafeInteger(owner) && Number(owner) > 0 ? { owner: owner!, sequence: ++sequence } : null
  }
  function clearTimer() { if (timer !== undefined) clearTimeout(timer); timer = undefined }
  function reset() {
    clearTimer(); cache = null; card.value = { id: 0, isReversed: false }
    flipped.value = false; busy.value = false; cached.value = false; response.value = null; error.value = ''
  }
  function currentCache() {
    return isCurrentMobileDailyCache(cache, options.owner.value, mobileSite) ? cache : null
  }
  function scheduleExpiry() {
    clearTimer()
    if (!cache) return
    const window = cache.window, owner = cache.owner
    timer = setTimeout(() => {
      if (disposed || owner !== options.owner.value || !cache || !sameMobileDailyWindow(cache.window, window)) return
      if (Date.parse(window.resetsAt) > Date.now()) { scheduleExpiry(); return }
      sequence++; drawing = null; refreshing = null; reset()
      void refresh()
    }, Math.min(2_147_483_647, Math.max(1, Date.parse(window.resetsAt) - Date.now())))
  }
  function present(next: MobileDailyCache, fromCache: boolean) {
    const changedWindow = cache && !sameMobileDailyWindow(cache.window, next.window)
    const lostResult = cache?.result && !next.result
    // A saved result is already revealed, even when this is a fresh app process.
    // A persisted pending card also represents a committed draw: show its original
    // face with a retry action rather than asking the user to draw another card.
    if (next.result || (fromCache && next.pending)) flipped.value = true
    else if (changedWindow || lostResult || !next.pending) flipped.value = false
    cache = next
    response.value = mobileDailyResponseFromCache(next)
    cached.value = fromCache && !!next.result
    card.value = next.card ? { id: next.card.id, isReversed: next.card.isReversed } : next.pending ? { ...next.pending } : { id: 0, isReversed: false }
    if (fromCache && next.pending && !next.result && !busy.value) error.value = '今日的卡牌已为你保留，重试即可继续解读。'
    scheduleExpiry()
  }
  async function save(scope: MobileDailyScope, value: MobileDailyCache) {
    if (!current(scope)) return
    await writeMobileValue(`daily-${scope.owner}`, value)
  }
  async function accept(scope: MobileDailyScope, data: DailyFortuneResponse) {
    if (!current(scope)) return false
    const next = mobileDailyCacheFromResponse(data, scope.owner, mobileSite, currentCache())
    // The response can expire while awaiting native storage or a network result.
    if (!isCurrentMobileDailyCache(next, scope.owner, mobileSite)) return false
    present(next, data.cached)
    response.value = data
    await save(scope, next)
    return current(scope) && !!currentCache()
  }

  async function refresh() {
    if (disposed) return
    if (drawing) return drawing
    if (refreshing) return refreshing
    const owner = options.owner.value, initialSequence = sequence
    const restored = hydration
    const operation = (async () => {
      if (restored) await restored
      if (owner !== options.owner.value || sequence !== initialSequence || disposed || !options.ready.value || drawing) return
      if (!currentCache() && cache) reset()
      if (!options.online.value || owner === null) return
      const active = scope()
      if (!active) return
      try {
        const data = await fetchMobileDailyFortune()
        if (await accept(active, data) && (data.result || !cache?.pending)) error.value = ''
      } catch (cause) {
        if (current(active) && !currentCache()?.result) error.value = mobileError(cause, '今日运势暂时无法加载，请检查网络后重试。')
      }
    })()
    refreshing = operation
    try { await operation } finally { if (refreshing === operation) refreshing = null }
  }

  async function draw() {
    if (disposed) return
    if (drawing) return drawing
    const owner = options.owner.value, restored = hydration, initialSequence = sequence
    const operation = (async () => {
      if (restored) await restored
      if (disposed || owner !== options.owner.value || sequence !== initialSequence) return
      const active = scope()
      if (!active) { error.value = '请先登录后查看今日运势。'; return }
      busy.value = true; error.value = ''
      try {
        const saved = currentCache()
        if (saved?.result) {
          present(saved, true); flipped.value = true
          return
        }
        if (!saved && cache) reset()
        busy.value = true
        if (!options.online.value) { error.value = '当前离线，请联网后抽取今日运势。'; return }
        // Every attempt first recovers a completed server result, including after a timed-out POST.
        const latest = await fetchMobileDailyFortune()
        if (!await accept(active, latest)) return
        if (latest.result) { flipped.value = true; return }
        const confirmed = currentCache()
        if (!confirmed) return
        if (!confirmed.pending && !options.cardIds.value.some(id => Number.isInteger(id) && id >= 0 && id < 78)) {
          error.value = '卡牌资料尚未准备好，请稍后重试。'; return
        }
        const selected = selectMobileDailyCard(confirmed, options.cardIds.value)
        const pending = { ...confirmed, pending: selected }
        present(pending, false)
        // Persist the exact card before generating so retries and cold starts cannot redraw it.
        await save(active, pending)
        if (!current(active) || !currentCache()) return
        flipped.value = true
        try {
          const generated = await generateMobileDailyFortune(selected)
          if (await accept(active, generated)) error.value = ''
        } catch (cause) {
          if (!current(active)) return
          if (options.online.value && currentCache()) {
            try {
              const recovered = await fetchMobileDailyFortune()
              if (!await accept(active, recovered)) return
              if (recovered.result) { error.value = ''; return }
            } catch { /* Keep the persisted selection for an explicit same-card retry. */ }
          }
          if (current(active)) error.value = mobileError(cause, '今日运势尚未生成成功，请重试。已抽取的卡牌会为你保留。')
        }
      } catch (cause) {
        if (current(active)) error.value = mobileError(cause, '今日运势暂时无法加载，请检查网络后重试。')
      } finally { if (current(active)) busy.value = false }
    })()
    drawing = operation
    try { await operation } finally { if (drawing === operation) drawing = null }
  }

  const stop = watch([options.owner, options.ready], () => {
    sequence++; drawing = null; refreshing = null; reset()
    const owner = options.owner.value
    if (!options.ready.value || owner === null) { hydration = null; return }
    const initial: MobileDailyScope = { owner, sequence }
    const operation = (async () => {
      try {
        const saved = await readMobileValue<unknown>(`daily-${owner}`)
        if (current(initial) && isCurrentMobileDailyCache(saved, owner, mobileSite)) present(saved, true)
      } catch { /* Online refresh remains available if native storage cannot be read. */ }
    })()
    hydration = operation
    void operation.finally(() => {
      if (hydration === operation) hydration = null
      if (current(initial)) void refresh()
    })
  }, { immediate: true, flush: 'sync' })
  onScopeDispose(() => { disposed = true; sequence++; clearTimer(); stop() })
  return { card, flipped, busy, response, error, cached, draw, refresh }
}
