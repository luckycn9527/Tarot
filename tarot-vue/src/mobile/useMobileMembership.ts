import { onScopeDispose, ref, watch, type Ref } from 'vue'
import { mobileRedemptionError, redeemMobileInvitation, refreshMobileProfile } from './mobileApi'
import { redemptionCodeError, type MobileRedemption } from './mobileMembershipModel'

export function useMobileMembership(options: { owner: Ref<number | null>; ready: Ref<boolean>; online: Ref<boolean>; english: Ref<boolean> }) {
  const open = ref(false), code = ref(''), busy = ref(false), syncing = ref(false)
  const error = ref(''), profileError = ref(''), profileUpdated = ref(false), grant = ref<MobileRedemption | null>(null)
  let sequence = 0, disposed = false
  const text = (zh: string, en: string) => options.english.value ? en : zh
  function reset() {
    sequence++; open.value = false; code.value = ''; busy.value = false; syncing.value = false
    error.value = ''; profileError.value = ''; profileUpdated.value = false; grant.value = null
  }
  function show() {
    if (!options.ready.value || options.owner.value === null) return
    reset(); open.value = true
  }
  function close() { if (!busy.value && !syncing.value) reset() }
  const current = (action: number, owner: number) => !disposed && action === sequence && owner === options.owner.value && open.value
  async function updateProfile(action: number, owner: number) {
    syncing.value = true; profileError.value = ''; profileUpdated.value = false
    try {
      await refreshMobileProfile()
      if (current(action, owner)) profileUpdated.value = true
    } catch {
      if (current(action, owner)) profileError.value = text('权益资料暂未同步，请联网后刷新。已完成的兑换不会重复扣码。', 'Your profile could not be refreshed. Reconnect and refresh; a completed redemption will not be repeated.')
    } finally { if (current(action, owner)) syncing.value = false }
  }
  async function refresh() {
    const owner = options.owner.value
    if (!open.value || busy.value || syncing.value || owner === null) return
    if (!options.online.value) { profileError.value = text('请联网后刷新权益。', 'Connect to refresh your membership.'); return }
    await updateProfile(sequence, owner)
  }
  async function redeem() {
    const owner = options.owner.value
    if (!open.value || busy.value || syncing.value || grant.value || owner === null || !options.ready.value) return
    error.value = redemptionCodeError(code.value, options.english.value); profileError.value = ''; profileUpdated.value = false
    if (error.value) return
    if (!options.online.value) { error.value = text('兑换需要联网，请连接网络后重试。', 'Connect to the internet to redeem your code.'); return }
    const action = ++sequence
    busy.value = true
    try {
      const result = await redeemMobileInvitation(code.value)
      if (!current(action, owner)) return
      grant.value = result; code.value = ''
      // Redemption and profile sync are separate operations. A failed GET must
      // never resend the already successful POST or turn it into a failure.
      await updateProfile(action, owner)
    } catch (cause) {
      if (current(action, owner)) error.value = mobileRedemptionError(cause, options.english.value)
    } finally { if (current(action, owner)) busy.value = false }
  }
  watch(() => [options.owner.value, options.ready.value], reset, { flush: 'sync' })
  watch(code, () => { if (!busy.value && !grant.value) { error.value = ''; profileError.value = ''; profileUpdated.value = false } }, { flush: 'sync' })
  onScopeDispose(() => { disposed = true; reset() })
  return { open, code, busy, syncing, error, profileError, profileUpdated, grant, show, close, redeem, refresh }
}
