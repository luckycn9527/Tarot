import { onScopeDispose, ref, watch, type Ref } from 'vue'
import type { DailyFortuneResponse } from '../services/tarotAiReading'
import { mobileError } from './mobileApi'
import { fetchMobileYesterdayFortune } from './mobileDailyApi'
import { sameMobileDailyWindow, validMobileDailyWindow, type MobileDailyWindow } from './mobileDailyModel'
import { mobileSite, readMobileValue, writeMobileValue } from './mobileStorage'
import {
  previousMobileBusinessDate, validMobileYesterdayCache,
  type MobileDailySnapshot, type MobileYesterdayCache,
} from './mobileYesterdayModel'

interface YesterdayOptions {
  owner: Ref<number | null>
  ready: Ref<boolean>
  online: Ref<boolean>
  today: Ref<DailyFortuneResponse | null>
}
interface YesterdayScope { owner: number; sequence: number; window: MobileDailyWindow; target: string }

export function useMobileYesterdayFortune(options: YesterdayOptions) {
  const open = ref(false), busy = ref(false), error = ref(''), cached = ref(false)
  const response = ref<MobileDailySnapshot | null>(null)
  let sequence = 0, disposed = false, loading: Promise<void> | null = null

  function close() {
    sequence++; loading = null
    open.value = false; busy.value = false; error.value = ''; response.value = null; cached.value = false
  }
  function current(scope: YesterdayScope) {
    const today = options.today.value
    return !disposed && open.value && scope.sequence === sequence && options.ready.value
      && options.owner.value === scope.owner && validMobileDailyWindow(today)
      && sameMobileDailyWindow(today, scope.window)
  }
  function available(): Omit<YesterdayScope, 'sequence'> | null {
    const owner = options.owner.value, today = options.today.value
    if (disposed || !options.ready.value || !Number.isSafeInteger(owner) || Number(owner) <= 0 || !validMobileDailyWindow(today)) return null
    const target = previousMobileBusinessDate(today.businessDate)
    if (!target) return null
    return { owner: owner!, target, window: { businessDate: today.businessDate, resetsAt: today.resetsAt, timeZone: today.timeZone } }
  }
  async function show() {
    if (loading) return loading
    const selected = available()
    if (!selected) { close(); return }
    const active: YesterdayScope = { ...selected, sequence: ++sequence }
    open.value = true; busy.value = true; error.value = ''; response.value = null; cached.value = false
    const key = `daily-yesterday-${active.owner}`
    const operation = (async () => {
      try {
        // Native cache availability is independent of network availability.
        try {
          const saved = await readMobileValue<unknown>(key)
          if (!current(active)) return
          if (validMobileYesterdayCache(saved, active.owner, mobileSite, active.target, active.window.timeZone)) {
            response.value = saved.snapshot; cached.value = true
          }
        } catch { /* A failed cache read must not prevent an online read. */ }
        if (!current(active)) return
        if (!options.online.value) {
          if (!response.value) error.value = '当前离线，尚无昨日运势缓存，请联网后查看。'
          return
        }
        // This endpoint only reads a previously generated result. It never draws.
        const data = await fetchMobileYesterdayFortune(active.target, active.window.timeZone)
        if (!current(active)) return
        response.value = data; cached.value = false; error.value = ''
        const saved: MobileYesterdayCache | null = data.result ? { schema: 1, owner: active.owner, site: mobileSite, snapshot: data } : null
        try { await writeMobileValue(key, saved) } catch { /* A readable server result remains useful if local persistence fails. */ }
      } catch (cause) {
        if (current(active)) error.value = mobileError(cause, '昨日运势暂时无法加载，请检查网络后重试。')
      } finally {
        if (active.sequence === sequence && !disposed) {
          if (current(active)) busy.value = false
          else close()
        }
      }
    })()
    loading = operation
    try { await operation } finally { if (loading === operation) loading = null }
  }
  const stop = watch([
    options.owner, options.ready,
    () => options.today.value?.businessDate,
    () => options.today.value?.resetsAt,
    () => options.today.value?.timeZone,
  ], close, { flush: 'sync' })
  onScopeDispose(() => { disposed = true; close(); stop() })
  return { open, busy, error, response, cached, show, close, retry: show }
}
