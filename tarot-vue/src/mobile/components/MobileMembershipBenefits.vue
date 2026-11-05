<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import XIcon from '@icons/x.vue'
import MessageCircle from '@icons/message-circle.vue'
import BookOpen from '@icons/book-open.vue'
import UsersRound from '@icons/users-round.vue'
import Check from '@icons/check.vue'
import ChevronRight from '@icons/chevron-right.vue'
import type { User } from '@/stores/auth'

const props = defineProps<{ user: User | null; activeVip: boolean; english: boolean; online: boolean }>()
const emit = defineEmits<{ close: []; redeem: [] }>()
const t = (zh: string, en: string) => props.english ? en : zh
const dialog = ref<HTMLElement | null>(null)
const viewportHeight = ref(window.visualViewport?.height || window.innerHeight)
const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
let previousOverflow = ''
const expiry = computed(() => {
  const value = props.user?.membershipExpiresAt
  if (!value) return null
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date : null
})
const expired = computed(() => !props.activeVip && !!expiry.value && expiry.value.getTime() <= Date.now())
const status = computed(() => !props.user ? t('登录后查看你的会员状态', 'Sign in to view your membership')
  : props.activeVip ? t('会员已生效', 'Membership active')
  : expired.value ? t('会员已到期', 'Membership expired') : t('免费账户', 'Free account'))
const dateLabel = computed(() => {
  if (!props.user) return t('权益随账号保存', 'Benefits belong to your account')
  if (props.activeVip && !props.user.membershipExpiresAt) return t('长期会员 · 无到期日', 'Lifetime membership · No expiry')
  if (expiry.value && (props.activeVip || expired.value)) {
    const date = new Intl.DateTimeFormat(props.english ? 'en-US' : 'zh-CN', { year: 'numeric', month: 'short', day: 'numeric' }).format(expiry.value)
    return (props.activeVip ? t('有效期至 ', 'Valid until ') : t('到期日期：', 'Expired on ')) + date
  }
  return props.activeVip ? t('到期时间暂不可用', 'Expiry date unavailable') : t('问卜解读与追问共用每日次数', 'Readings and follow-ups share daily credits')
})
const rights = computed(() => [
  { icon: BookOpen, title: t('问卜解读', 'Reading interpretations'), description: t('会员有效期间，生成问卜解读不消耗每日免费次数。', 'While membership is active, reading interpretations do not use your daily free credits.') },
  { icon: MessageCircle, title: t('继续追问', 'Follow-up questions'), description: t('围绕已保存的解读继续提问，不消耗每日免费次数。', 'Continue a saved reading with follow-up questions without using daily free credits.') },
  { icon: UsersRound, title: t('会员塔罗师', 'VIP readers'), description: t('可在问卜页选择已开放的会员塔罗师，以当前可选列表为准。', 'Choose available VIP readers on the Ask page. Availability follows the current reader list.') },
])
function onViewport() { viewportHeight.value = window.visualViewport?.height || window.innerHeight }
function keydown(event: KeyboardEvent) {
  if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); emit('close'); return }
  if (event.key !== 'Tab' || !dialog.value) return
  const controls = Array.from(dialog.value.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],[tabindex="0"]')).filter(node => node.getClientRects().length)
  const first = controls[0], last = controls[controls.length - 1]
  if (!first || !last) { event.preventDefault(); dialog.value.focus(); return }
  if (!dialog.value.contains(document.activeElement) || document.activeElement === dialog.value) { event.preventDefault(); (event.shiftKey ? last : first).focus() }
  else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
}
onMounted(async () => {
  previousOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  document.addEventListener('keydown', keydown, true)
  window.visualViewport?.addEventListener('resize', onViewport)
  await nextTick(); dialog.value?.focus({ preventScroll: true })
})
onBeforeUnmount(() => {
  document.body.style.overflow = previousOverflow
  document.removeEventListener('keydown', keydown, true)
  window.visualViewport?.removeEventListener('resize', onViewport)
  if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
})
</script>

<template>
  <div class="benefits-backdrop" :style="{ '--benefits-viewport': viewportHeight + 'px' }" @click.self="emit('close')">
    <section ref="dialog" class="benefits-dialog" role="dialog" aria-modal="true" aria-labelledby="benefits-title" tabindex="-1">
      <header class="benefits-header"><div><p>E-Tomd</p><h2 id="benefits-title">{{ t('会员权益', 'Membership benefits') }}</h2></div><button type="button" class="benefits-close" :aria-label="t('关闭权益详情', 'Close membership benefits')" @click="emit('close')"><XIcon :size="21" aria-hidden="true" /></button></header>
      <div class="benefits-body">
        <div class="benefits-status" :class="{ 'is-active': activeVip }"><strong>{{ status }}</strong><span class="benefits-date">{{ dateLabel }}</span></div>
        <p v-if="!online" class="benefits-offline" role="status">{{ t('当前离线，显示上次同步的会员资料。', 'You are offline. Showing the last synced membership details.') }}</p>
        <div v-if="user && !activeVip" class="benefits-quota"><span>{{ t('今日可用', 'Available today') }}</span><strong>{{ Math.max(0, user.remainingFreeQuota) }}<small>{{ t('次', 'credits') }}</small></strong></div>
        <div class="benefits-rights">
          <section v-for="right in rights" :key="right.title" class="benefits-right"><component :is="right.icon" :size="20" aria-hidden="true" /><div><h3>{{ right.title }}</h3><p>{{ right.description }}</p></div><span class="benefits-right-state"><Check v-if="activeVip" :size="14" aria-hidden="true" />{{ activeVip ? t('已享有', 'Included') : t('会员权益', 'With VIP') }}</span></section>
        </div>
        <p class="benefits-basic">{{ t('头像上传、生辰设置和已保存历史的查看，均为账户基础功能。', 'Profile photos, birth details and viewing saved history are standard account features.') }}</p>
        <button type="button" class="benefits-redeem" @click="emit('redeem')"><span>{{ user ? t('使用兑换码', 'Use a redemption code') : t('登录并兑换', 'Sign in to redeem') }}</span><ChevronRight :size="18" aria-hidden="true" /></button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.benefits-backdrop{position:fixed;inset:0;z-index:93;display:flex;align-items:flex-end;justify-content:center;padding:max(12px,env(safe-area-inset-top)) 12px max(12px,env(safe-area-inset-bottom));background:#08060ebd;backdrop-filter:blur(7px);overscroll-behavior:contain}
.benefits-dialog{display:flex;flex-direction:column;width:100%;max-width:440px;max-height:calc(var(--benefits-viewport,100dvh) - 24px - env(safe-area-inset-top) - env(safe-area-inset-bottom));min-width:0;overflow:hidden;border:1px solid #72598080;border-radius:24px;background:#19151f;color:#f3edf7;box-shadow:0 24px 80px #0007;outline:none;font-family:var(--m-body-font,-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif)}
.benefits-header{display:flex;flex:none;align-items:center;justify-content:space-between;gap:16px;padding:23px 23px 16px}.benefits-header p{margin:0 0 6px;color:#c7b6d4;font-size:12px;letter-spacing:.06em}.benefits-header h2{margin:0;font-family:inherit;font-size:23px;font-weight:500;line-height:1.4;letter-spacing:0}.benefits-close{display:grid;place-items:center;flex:none;width:44px;height:44px;padding:0;border:1px solid #8f749545;border-radius:50%;background:transparent;color:#e9ddf2;cursor:pointer}
.benefits-body{min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:0 23px 23px}.benefits-status{display:flex;flex-direction:column;gap:4px;padding:0 0 19px}.benefits-status strong{font-size:15px;font-weight:500;color:#c9becf}.benefits-status.is-active strong{color:#e3c7f7}.benefits-date{color:#bdb1c6;font-size:12px;line-height:1.7;overflow-wrap:anywhere;font-variant-numeric:tabular-nums}.benefits-quota{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px;padding:12px 0;border-top:1px solid #c6a6df24;font-size:13px;color:#c5b7cf}.benefits-quota strong{display:flex;align-items:baseline;gap:5px;color:#ede2f6;font-size:23px;font-weight:500}.benefits-quota small{font-size:11px;font-weight:400}
.benefits-right{display:grid;grid-template-columns:21px minmax(0,1fr) auto;align-items:start;gap:10px;padding:19px 0;border-top:1px solid #c6a6df24}.benefits-right>svg{margin-top:1px;color:#c7addb}.benefits-right h3{margin:0;color:#f1e8f7;font-family:inherit;font-size:15px;font-weight:500;line-height:1.5;overflow-wrap:anywhere}.benefits-right p{margin:7px 0 0;color:#bdb1c6;font-size:12px;line-height:1.9;overflow-wrap:anywhere}.benefits-right-state{display:flex;align-items:center;gap:4px;max-width:80px;margin-top:2px;color:#d4b5ea;font-size:11px;line-height:1.7;text-align:right;overflow-wrap:anywhere}.benefits-right-state svg{flex:none}.benefits-basic,.benefits-offline{margin:15px 0 18px;color:#b8aabd;font-size:11px;line-height:1.9;overflow-wrap:anywhere}.benefits-offline{margin:0 0 14px;color:#d1bfde}
.benefits-redeem{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;min-height:49px;padding:12px 16px;border:1px solid #dfbdf5;border-radius:12px;background:#d5b5ec;color:#24132f;font-size:14px;font-weight:600;line-height:1.5;cursor:pointer}.benefits-redeem span{min-width:0;overflow-wrap:anywhere}.benefits-redeem svg{flex:none}.benefits-dialog button{font-family:inherit;touch-action:manipulation;-webkit-tap-highlight-color:transparent}.benefits-dialog button:focus-visible{outline:2px solid #e3c7f7;outline-offset:3px}
@media(max-width:359px){.benefits-header{padding:20px 18px 14px}.benefits-body{padding:0 18px 18px}.benefits-right{grid-template-columns:19px minmax(0,1fr);gap:7px 10px;padding:16px 0}.benefits-right-state{grid-column:2;max-width:none;margin:0;text-align:left}.benefits-right h3{font-size:14px}.benefits-header h2{font-size:21px}}
@media(prefers-reduced-motion:no-preference){.benefits-dialog button:active{opacity:.78}}
</style>
