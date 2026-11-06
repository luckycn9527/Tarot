export function mobileQuotaResetLabel(value: string | undefined, english: boolean, now = Date.now()) {
  const time = value ? Date.parse(value) : NaN
  if (!Number.isFinite(time) || time <= now) return ''
  return new Intl.DateTimeFormat(english ? 'en-US' : 'zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(time)
}
export function followupQuotaNote(vip: boolean, remaining: number | null, resetsAt: string | undefined, english: boolean) {
  if (vip) return english ? 'VIP follow-up · Does not use daily free credits' : '会员追问 · 不消耗每日免费次数'
  if (remaining !== null && remaining <= 0) {
    const reset = mobileQuotaResetLabel(resetsAt, english)
    return english ? `No free credits left today.${reset ? ` Resets ${reset} (local time).` : ' Refresh your account later.'}`
      : `今日免费次数已用完${reset ? `，${reset}恢复（本地时间）。` : '，稍后可刷新账号查看。'}`
  }
  return english ? `Keeps your cards · Uses 1 credit${remaining === null ? '' : ` · ${remaining} available`}`
    : `沿用原牌 · 使用 1 次额度${remaining === null ? '' : ` · 当前可用 ${remaining} 次`}`
}
