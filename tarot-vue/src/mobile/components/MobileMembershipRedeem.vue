<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import XIcon from '@icons/x.vue'
import Ticket from '@icons/ticket.vue'
import Check from '@icons/check.vue'
import type { MobileRedemption } from '../mobileMembershipModel'

const props = defineProps<{ english: boolean; code: string; busy: boolean; syncing: boolean; error: string; profileError: string; profileUpdated: boolean; grant: MobileRedemption | null; returnToBenefits?: boolean }>()
const emit = defineEmits<{ close: []; submit: []; refresh: []; 'update:code': [value: string] }>()
const t = (zh: string, en: string) => props.english ? en : zh
const locked = computed(() => props.busy || props.syncing)
const dialog = ref<HTMLElement | null>(null)
const previousFocus = document.activeElement as HTMLElement | null
let previousOverflow = ''
const close = () => { if (!locked.value) emit('close') }
function keydown(event: KeyboardEvent) {
  if (event.key === 'Escape') { event.preventDefault(); close(); return }
  if (event.key !== 'Tab' || !dialog.value) return
  const controls = Array.from(dialog.value.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),[tabindex="0"]')).filter(node => node.getClientRects().length)
  const first = controls[0], last = controls[controls.length - 1]
  if (!first || !last) { event.preventDefault(); dialog.value.focus(); return }
  if (!dialog.value.contains(document.activeElement) || document.activeElement === dialog.value) { event.preventDefault(); (event.shiftKey ? last : first).focus() }
  else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
}
onMounted(async () => { previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; document.addEventListener('keydown', keydown); await nextTick(); dialog.value?.focus() })
onBeforeUnmount(() => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', keydown); if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true }) })
</script>

<template>
  <div class="membership-backdrop" @click.self="close">
    <section ref="dialog" class="membership-dialog" role="dialog" aria-modal="true" aria-labelledby="membership-title" tabindex="-1">
      <header><span class="membership-mark" aria-hidden="true"><Check v-if="grant" :size="25" /><Ticket v-else :size="25" /></span><button type="button" class="membership-close" :disabled="locked" :aria-label="t('关闭', 'Close')" @click="close"><XIcon :size="21" /></button></header>
      <h2 id="membership-title">{{ grant ? t('兑换成功', 'Code redeemed') : t('兑换会员', 'Redeem membership') }}</h2>
      <template v-if="grant">
        <p class="membership-reward">{{ grant.type === 'vip_days' ? t(`${grant.value} 天 VIP 会员`, `${grant.value} days of VIP membership`) : t(`${grant.value} 次额外问卜`, `${grant.value} extra reading credits`) }}</p>
        <p class="membership-description">{{ grant.type === 'vip_days' ? t('有效会员的时长会顺延，长期会员权益保持有效。', 'Time is added to an active membership. Lifetime membership stays active.') : t('额度已计入当前账号，解读与追问共用。', 'Credits have been added to your account for readings and follow-ups.') }}</p>
      </template>
      <form v-else @submit.prevent="emit('submit')">
        <p class="membership-description">{{ t('输入兑换码，会员权益将绑定当前账号。', 'Enter your code to activate membership on this account.') }}</p>
        <label for="mobile-redemption-code">{{ t('兑换码', 'Redemption code') }}</label>
        <input id="mobile-redemption-code" :value="code" :disabled="locked" :aria-invalid="!!error" :aria-describedby="error ? 'membership-error' : undefined" type="text" maxlength="50" autocomplete="off" autocapitalize="characters" autocorrect="off" :spellcheck="false" placeholder="ETOMD-…" @input="emit('update:code', ($event.target as HTMLInputElement).value)">
        <p v-if="error" id="membership-error" class="membership-error" role="alert">{{ error }}</p>
        <button type="submit" class="membership-primary" :disabled="locked || !code.trim()">{{ busy ? t('正在兑换…', 'Redeeming…') : t('确认兑换', 'Redeem code') }}</button>
      </form>
      <p v-if="syncing" class="membership-status" role="status">{{ t('正在同步权益…', 'Updating membership…') }}</p>
      <p v-else-if="profileError" class="membership-error" role="alert">{{ profileError }}</p>
      <p v-else-if="profileUpdated" class="membership-status" role="status">{{ t('个人中心的权益已更新。', 'Your account benefits are up to date.') }}</p>
      <button v-if="profileError || (error && !grant)" type="button" class="membership-secondary" :disabled="locked" @click="emit('refresh')">{{ t('刷新权益', 'Refresh benefits') }}</button>
      <button v-if="grant" type="button" class="membership-primary" :disabled="locked" @click="close">{{ returnToBenefits ? t('返回权益详情', 'Back to benefits') : t('返回个人中心', 'Back to my account') }}</button>
      <p v-if="!grant" class="membership-footnote">{{ t('每个兑换码在同一账号仅可使用一次。', 'Each code can be redeemed once per account.') }}</p>
    </section>
  </div>
</template>

<style scoped>
.membership-backdrop{position:fixed;inset:0;z-index:92;display:flex;align-items:center;justify-content:center;padding:max(18px,env(safe-area-inset-top)) 18px max(18px,env(safe-area-inset-bottom));overflow-y:auto;overscroll-behavior:contain;background:var(--m-overlay,#0a0711cc);backdrop-filter:blur(8px)}
.membership-dialog{width:100%;max-width:430px;min-width:0;max-height:calc(100dvh - 36px - env(safe-area-inset-top) - env(safe-area-inset-bottom));overflow-y:auto;box-sizing:border-box;padding:26px;border:1px solid var(--m-line-strong,#cbb0ed45);border-radius:24px;outline:none;background:var(--m-panel,#211b29);color:var(--m-text,#f1ecf4);box-shadow:0 24px 90px #0008}
.membership-dialog header{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:22px}.membership-mark{display:grid;place-items:center;width:52px;height:52px;border:1px solid var(--m-line-strong);border-radius:17px;background:var(--m-accent-soft);color:var(--m-accent)}
.membership-dialog button,.membership-dialog input{font:inherit}.membership-dialog button{cursor:pointer;touch-action:manipulation}.membership-dialog button:disabled{opacity:.5;cursor:default}.membership-close{display:grid;place-items:center;width:44px;height:44px;padding:0;border:1px solid var(--m-line);border-radius:12px;background:transparent;color:var(--m-text)}
.membership-dialog h2{margin:0;font:500 26px/1.4 var(--m-heading-font);letter-spacing:.04em}.membership-description{margin:12px 0 22px;color:var(--m-muted);font-size:13px;line-height:1.9;overflow-wrap:anywhere}.membership-dialog label{display:block;margin-bottom:10px;font-size:13px;color:var(--m-muted)}
.membership-dialog input{width:100%;min-width:0;box-sizing:border-box;min-height:54px;padding:12px 14px;border:1px solid var(--m-line-strong);border-radius:12px;background:var(--m-input-bg);color:var(--m-text);font-size:16px;letter-spacing:.07em}.membership-dialog input::placeholder{color:var(--m-muted);opacity:.65}.membership-dialog :is(button,input):focus-visible{outline:2px solid var(--m-accent);outline-offset:3px}
.membership-primary,.membership-secondary{display:block;width:100%;min-height:48px;box-sizing:border-box;margin-top:20px;padding:12px 14px;border:1px solid transparent;border-radius:12px;font-size:14px!important;line-height:1.6}.membership-primary{background:var(--m-accent);color:var(--m-accent-ink);font-weight:600!important}.membership-secondary{margin-top:12px;border-color:var(--m-line-strong);background:transparent;color:var(--m-text)}
.membership-error{margin:13px 0 0;color:var(--m-error);font-size:12px;line-height:1.8;overflow-wrap:anywhere}.membership-status{margin:15px 0 0;color:var(--m-muted);font-size:12px;line-height:1.8}.membership-footnote{margin:16px 0 0;color:var(--m-muted);font-size:11px;line-height:1.8;text-align:center}.membership-reward{margin:18px 0 0;color:var(--m-accent);font-size:22px;line-height:1.6;font-weight:500;overflow-wrap:anywhere}
@media(max-height:550px){.membership-backdrop{align-items:flex-start;padding-block:12px}.membership-dialog{padding:20px;max-height:calc(100dvh - 24px)}.membership-dialog header{margin-bottom:14px}}
@media(prefers-reduced-motion:no-preference){.membership-dialog button{transition:opacity .15s,background-color .15s}.membership-dialog button:not(:disabled):active{opacity:.75}}
</style>
