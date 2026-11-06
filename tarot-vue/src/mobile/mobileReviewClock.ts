type TimerId = unknown

interface MobileReviewClockOptions {
  now?: () => number
  setTimer: (callback: () => void, delay: number) => TimerId
  clearTimer: (id: TimerId) => void
  timeZone: () => string | undefined
  onTick: (now: number) => void
}

function businessDate(timeZone?: string): (time: number) => string {
  if (timeZone) {
    try {
      const formatter = new Intl.DateTimeFormat('en-US-u-ca-gregory-nu-latn', {
        timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
      })
      return time => {
        const parts = formatter.formatToParts(time)
        const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value || ''
        return `${part('year').padStart(4, '0')}-${part('month')}-${part('day')}`
      }
    } catch { /* Older servers may omit the zone or return an unsupported one. */ }
  }
  return time => {
    const date = new Date(time)
    return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  }
}

export function reviewEligibleAt(createdAt: string | undefined, now: number, timeZone?: string): boolean {
  const created = createdAt ? Date.parse(createdAt) : NaN
  if (!Number.isFinite(created) || !Number.isFinite(now) || created > now) return false
  const dateAt = businessDate(timeZone)
  return dateAt(created) < dateAt(now)
}

function nextBusinessDate(time: number, timeZone?: string): number {
  const dateAt = businessDate(timeZone), current = dateAt(time)
  let left = time, right = time + 48 * 60 * 60 * 1000
  // Search timestamps rather than adding a local day: the business zone may
  // differ from the device zone and daylight-saving days need not be 24 hours.
  while (right - left > 1) {
    const middle = Math.floor((left + right) / 2)
    if (dateAt(middle) === current) left = middle
    else right = middle
  }
  return right
}

export function createMobileReviewClock(options: MobileReviewClockOptions) {
  const now = options.now || Date.now
  let timer: TimerId, scheduled = false, disposed = false
  function cancel() {
    if (scheduled) { options.clearTimer(timer); scheduled = false }
  }
  function refresh() {
    if (disposed) return
    cancel()
    const current = now()
    options.onTick(current)
    if (disposed) return
    const delay = Number.isFinite(current)
      ? Math.min(60_000, Math.max(1, nextBusinessDate(current, options.timeZone()) - current + 25))
      : 60_000
    timer = options.setTimer(() => { scheduled = false; refresh() }, delay)
    scheduled = true
  }
  function dispose() { disposed = true; cancel() }
  return { refresh, dispose }
}
