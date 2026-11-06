<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UserRound from '@icons/user-round.vue'
import Camera from '@icons/camera.vue'
import ChevronRight from '@icons/chevron-right.vue'
import Globe from '@icons/globe.vue'
import Calendar from '@icons/calendar.vue'
import Settings from '@icons/settings.vue'
import Gift from '@icons/gift.vue'
import BookOpen from '@icons/book-open.vue'
import type { User } from '@/stores/auth'
import { publicAssetUrl } from '@/utils/publicAssetUrl'

const props = defineProps<{
  user: User | null
  activeVip: boolean
  locale: string
  site: string
  sessionReady: boolean
  logoutBusy: boolean
}>()
const emit = defineEmits<{
  login: []
  logout: []
  avatar: []
  birth: []
  history: []
  redeem: []
  benefits: []
  security: [mode: 'password' | 'delete']
  'update:locale': [value: string]
  website: [path: string]
}>()
const english = computed(() => props.locale.startsWith('en'))
const t = (zh: string, en: string) => english.value ? en : zh
const language = computed({ get: () => props.locale, set: value => emit('update:locale', value) })
const unavailable = computed(() => !props.sessionReady || props.logoutBusy)
const imageFailed = ref(false)
const profileExpanded = ref(false)
const preferences = ref<HTMLElement | null>(null)
const languageSelect = ref<HTMLSelectElement | null>(null)
const avatarIsImage = computed(() => /^(?:\/|https?:\/\/)/i.test(props.user?.avatar || ''))
const avatarImage = computed(() => avatarIsImage.value ? publicAssetUrl(props.user?.avatar) : '')
const avatarSymbol = computed(() => !avatarIsImage.value && props.user?.avatar ? props.user.avatar : '')
watch(() => [props.user?.id, props.user?.avatar], () => { imageFailed.value = false })
watch(() => props.user?.id, () => { profileExpanded.value = false })
const birthday = computed(() => props.user?.birthday?.match(/^\d{4}-\d{2}-\d{2}/)?.[0] || '')
const birthTime = computed(() => props.user?.birthTime?.match(/^([01]\d|2[0-3]):[0-5]\d$/)?.[0] || '')
const expiry = computed(() => {
  const value = props.user?.membershipExpiresAt
  if (!value) return null
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date : null
})
const expiredVip = computed(() => !props.activeVip && !!expiry.value && expiry.value.getTime() <= Date.now())
const membershipTitle = computed(() => props.activeVip
  ? t('会员已生效', 'Membership active')
  : expiredVip.value ? t('会员已到期', 'Membership expired') : t('免费账户', 'Free account'))
const membershipDate = computed(() => {
  if (!props.user) return t('登录后查看会员与可用次数', 'Sign in to view membership and credits')
  if (props.activeVip && !props.user.membershipExpiresAt) return t('长期会员 · 无到期日', 'Lifetime membership · No expiry')
  if (expiry.value && (props.activeVip || expiredVip.value)) {
    const date = new Intl.DateTimeFormat(english.value ? 'en-US' : 'zh-CN', { year: 'numeric', month: 'short', day: 'numeric' }).format(expiry.value)
    return (props.activeVip ? t('有效期至 ', 'Valid until ') : t('到期日期：', 'Expired on ')) + date
  }
  return props.activeVip ? t('到期时间暂不可用', 'Expiry date unavailable') : t('解读与追问共用每日免费次数', 'Daily credits are shared by readings and follow-ups')
})
const supportLinks = computed(() => [
  { path: '/privacy', label: t('隐私政策', 'Privacy policy') },
  { path: '/feedback', label: t('问题反馈', 'Feedback') },
  { path: '/terms', label: t('使用条款', 'Terms of use') },
])
function editAvatar() { if (props.user) emit('avatar'); else emit('login') }
function editBirth() { if (props.user) emit('birth'); else emit('login') }
function toggleProfile() {
  if (!props.user) { emit('login'); return }
  profileExpanded.value = !profileExpanded.value
}
function showPreferences() {
  preferences.value?.scrollIntoView({ block: 'center', behavior: 'auto' })
  languageSelect.value?.focus({ preventScroll: true })
}
</script>

<template>
  <section class="account-panel" :aria-label="t('我的账户', 'My account')">
    <header class="account-hero">
      <div class="account-hero-art" aria-hidden="true"><span class="account-orbit-ring" /><span class="account-orbit-disc" /><span class="account-orbit-front" /></div>
      <div class="account-topline">
        <span class="account-brand">E-Tomd</span>
        <button type="button" class="account-settings" :aria-label="t('偏好设置', 'Preferences')" :disabled="unavailable" @click="showPreferences"><Settings :size="23" :stroke-width="1.5" aria-hidden="true" /></button>
      </div>
      <h1 class="account-page-title">{{ t('我的', 'My space') }}</h1>
      <div class="account-identity">
        <button type="button" class="account-avatar" :aria-label="user ? t('更换头像', 'Change profile photo') : t('登录账号', 'Sign in')" :disabled="unavailable" @click="editAvatar">
          <span class="account-avatar-frame">
            <img v-if="avatarImage && !imageFailed" :src="avatarImage" alt="" @error="imageFailed = true" />
            <span v-else-if="avatarSymbol" class="account-avatar-symbol" aria-hidden="true">{{ avatarSymbol }}</span>
            <UserRound v-else :size="30" :stroke-width="1.5" aria-hidden="true" />
          </span>
          <span v-if="user" class="account-avatar-edit" aria-hidden="true"><Camera :size="14" :stroke-width="1.5" /></span>
        </button>
        <div class="account-identity-copy">
          <div class="account-name-row">
            <h2 class="account-nickname" :title="user?.nickname">{{ user?.nickname || t('你好，问卜者', 'Hello, seeker') }}</h2>
            <button v-if="user && activeVip" type="button" class="account-vip-badge" :aria-label="t('VIP 会员，查看权益', 'VIP member, view benefits')" :disabled="unavailable" @click="emit('benefits')"><span>VIP</span></button>
          </div>
          <button type="button" class="account-profile-toggle" :aria-expanded="user ? profileExpanded : undefined" :aria-controls="user ? 'account-profile-details' : undefined" :disabled="unavailable" @click="toggleProfile"><span>{{ user ? t('个人资料', 'Profile details') : t('登录并保存你的问卜', 'Sign in to save your readings') }}</span><ChevronRight :size="16" :stroke-width="1.5" aria-hidden="true" /></button>
        </div>
      </div>
    </header>

    <div v-if="user && profileExpanded" id="account-profile-details" class="account-profile-details" role="region" :aria-label="t('个人资料', 'Profile details')">
      <div class="account-profile-email"><span>{{ t('当前账号', 'Current account') }}</span><span class="account-email">{{ user.email }}</span></div>
      <div class="account-profile-actions"><button type="button" :disabled="unavailable" @click="editAvatar">{{ t('更换头像', 'Change photo') }}</button><button type="button" :disabled="unavailable" @click="editBirth">{{ t('设置生辰', 'Edit birth details') }}</button><button type="button" :disabled="unavailable" @click="emit('security', 'password')">{{ t('修改密码', 'Change password') }}</button><button type="button" :disabled="unavailable" @click="emit('security', 'delete')">{{ t('注销账号', 'Delete account') }}</button></div>
    </div>

    <div v-if="!user" class="account-sign-in">
      <button type="button" class="account-login" :disabled="unavailable" @click="emit('login')">{{ t('使用网站账号登录', 'Sign in to your account') }}<ChevronRight :size="18" aria-hidden="true" /></button>
      <p>{{ t('你的问题与选牌会保留。', 'Your question and selected cards are kept.') }}</p>
    </div>

    <section class="account-membership" :class="{ 'account-is-vip': activeVip, 'account-is-expired': expiredVip }" :aria-label="t('会员与权益', 'Membership and benefits')">
      <div class="account-membership-copy"><h2>{{ user ? membershipTitle : t('会员与权益', 'Membership & benefits') }}</h2><p>{{ membershipDate }}</p></div>
      <button type="button" class="account-benefits-button" :disabled="unavailable" @click="emit('benefits')"><span>{{ t('查看权益', 'View benefits') }}</span><ChevronRight :size="17" :stroke-width="1.5" aria-hidden="true" /></button>
      <div v-if="user && !activeVip" class="account-credit-summary"><span>{{ t('今日可用', 'Available today') }} <strong>{{ Math.max(0, user.remainingFreeQuota) }}</strong> {{ t('次', 'credits') }}</span><span>{{ t('解读与追问共用', 'Shared by readings and follow-ups') }}</span></div>
    </section>

    <nav class="account-group account-main-actions" :aria-label="t('常用入口', 'Quick access')">
      <button type="button" class="account-setting-row account-history" :disabled="unavailable" @click="emit('history')"><BookOpen :size="23" :stroke-width="1.5" aria-hidden="true" /><span class="account-row-copy"><span class="account-row-label">{{ t('我的记录', 'My readings') }}</span><small>{{ t('回看问题与解读', 'Revisit questions and readings') }}</small></span><ChevronRight :size="18" :stroke-width="1.5" aria-hidden="true" /></button>
      <button type="button" class="account-setting-row account-birth" :disabled="unavailable" @click="editBirth"><Calendar :size="23" :stroke-width="1.5" aria-hidden="true" /><span class="account-row-label">{{ t('生辰设置', 'Birth details') }}</span><span class="account-row-value account-birth-value"><template v-if="user && birthday"><span>{{ birthday }}</span><small>{{ birthTime || t('时辰未知', 'Time unknown') }}</small></template><template v-else>{{ user ? t('未设置', 'Not set') : t('登录后设置', 'Sign in to set') }}</template></span><ChevronRight :size="18" :stroke-width="1.5" aria-hidden="true" /></button>
      <button type="button" class="account-setting-row account-redeem" :disabled="unavailable" @click="emit('redeem')"><Gift :size="23" :stroke-width="1.5" aria-hidden="true" /><span class="account-row-copy"><span class="account-row-label">{{ t('兑换会员', 'Redeem membership') }}</span><small>{{ t('使用兑换码', 'Use a redemption code') }}</small></span><ChevronRight :size="18" :stroke-width="1.5" aria-hidden="true" /></button>
    </nav>

    <section ref="preferences" class="account-group account-preferences" :aria-label="t('偏好设置', 'Preferences')">
      <div class="account-setting-row account-language-row"><Globe :size="23" :stroke-width="1.5" aria-hidden="true" /><label for="account-language" class="account-row-label">{{ t('语言', 'Language') }}</label><select id="account-language" ref="languageSelect" v-model="language" :disabled="unavailable"><option value="zh-CN">简体中文</option><option value="en-US">English</option></select><ChevronRight :size="18" :stroke-width="1.5" aria-hidden="true" /></div>
      <div v-if="$slots.updates" class="account-updates"><slot name="updates" /></div>
    </section>

    <nav class="account-support-links" :aria-label="t('支持与关于', 'Support & about')"><button v-for="link in supportLinks" :key="link.path" type="button" class="account-link" :disabled="unavailable" @click="emit('website', link.path)">{{ link.label }}</button></nav>
    <button v-if="user" type="button" class="account-logout" :disabled="unavailable" @click="emit('logout')">{{ logoutBusy ? t('正在退出…', 'Signing out…') : t('退出登录', 'Sign out') }}</button>
    <p class="account-region">{{ t('服务地区', 'Service region') }} · {{ site === 'domestic' ? t('国内站', 'Mainland China') : t('海外站', 'Global') }}</p>
  </section>
</template>

<style scoped>
.account-panel{--account-accent:#d3aff3;--account-muted:#b9b2c2;--account-line:#c7b4d224;position:relative;min-width:0;padding:0 0 8px;color:#f3edf7;font-family:var(--m-body-font,-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif)}
.account-panel :where(button,select){font:inherit;-webkit-tap-highlight-color:transparent;touch-action:manipulation}
.account-hero{position:relative;isolation:isolate;min-width:0;padding:0 0 23px}
.account-hero-art{position:absolute;z-index:-1;pointer-events:none;inset:-34px -20px -12px;overflow:hidden}
.account-orbit-ring,.account-orbit-front{position:absolute;top:31px;right:-52px;width:266px;height:102px;border:1px solid #b28be9a6;border-radius:50%;transform:rotate(-10deg);box-shadow:-1px -1px 3px #e5d0ff27}
.account-orbit-ring{border-left-color:#f1e6ff;border-top-color:#d4b4f6;opacity:.75}
.account-orbit-disc{position:absolute;top:-24px;right:-107px;width:228px;height:228px;border-radius:50%;background:radial-gradient(circle at 25% 20%,#1c1724 0%,#15111b 55%,#110f16 80%);box-shadow:-2px -1px 1px #bda4d064,-6px -1px 17px #9f6dd529,inset 4px 0 16px #a16bd70a}
.account-orbit-front{clip-path:polygon(0 53%,100% 53%,100% 100%,0 100%);opacity:.6;box-shadow:none;border-bottom-color:#9770bd}
.account-topline{position:relative;display:flex;align-items:center;justify-content:space-between;min-height:44px;gap:16px}
.account-brand{font-size:18px;font-weight:400;line-height:1.4;letter-spacing:.02em}
.account-settings{display:grid;place-items:center;flex:none;width:44px;height:44px;margin-right:-7px;padding:0;border:0;border-radius:50%;background:transparent;color:#e4dce9;cursor:pointer}
.account-page-title{position:relative;margin:10px 0 30px;font-size:27px;font-weight:500;line-height:1.35;letter-spacing:.025em}
.account-identity{position:relative;display:grid;grid-template-columns:72px minmax(0,1fr);align-items:center;gap:18px;min-width:0}
.account-avatar{position:relative;display:block;width:72px;height:72px;padding:0;border:0;border-radius:50%;background:transparent;color:#d6bfec;cursor:pointer}
.account-avatar-frame{display:grid;place-items:center;width:100%;height:100%;overflow:hidden;border:1px solid #c3b2d166;border-radius:50%;background:linear-gradient(145deg,#2b2534,#17131e)}
.account-avatar-frame img{display:block;width:100%;height:100%;object-fit:cover}
.account-avatar-symbol{font-size:31px;line-height:1}
.account-avatar-edit{position:absolute;display:grid;place-items:center;right:-2px;bottom:-2px;width:27px;height:27px;border:1px solid #c3b2d199;border-radius:50%;background:#15111c;color:#f2e9f9;box-shadow:0 0 0 2px #15111c}
.account-identity-copy{min-width:0}
.account-name-row{display:flex;align-items:flex-start;gap:7px;min-width:0}
.account-nickname{flex:0 1 auto;min-width:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere;margin:4px 0 0;font-size:23px;font-weight:500;line-height:1.35;letter-spacing:.015em}
.account-vip-badge{display:flex;align-items:center;justify-content:center;flex:none;min-width:49px;min-height:44px;margin:-1px 0 0;padding:0 3px;border:0;background:transparent;color:#f6e7ff;cursor:pointer}
.account-vip-badge>span{display:grid;place-items:center;min-width:42px;min-height:23px;padding:0 8px;border:1px solid #cfa5f2;border-radius:6px;background:linear-gradient(145deg,#57336e,#2b1d3b);box-shadow:inset 0 1px 0 #fff2;font-size:12px;font-weight:500;line-height:1.4;letter-spacing:.025em}
.account-profile-toggle{display:flex;align-items:center;gap:3px;min-height:44px;max-width:100%;margin:-1px 0 -8px;padding:3px 0;border:0;background:transparent;color:#c7bdcf;font-size:12px;line-height:1.5;text-align:left;cursor:pointer}
.account-profile-toggle span{min-width:0;overflow-wrap:anywhere}.account-profile-toggle svg{flex:none}
.account-profile-details{margin:0 0 20px;padding:15px 16px;border:1px solid var(--account-line);border-radius:12px;background:#1c1723}
.account-profile-email{display:flex;flex-direction:column;gap:5px;color:var(--account-muted);font-size:11px;line-height:1.5}
.account-email{color:#eee6f4;font-size:12px;overflow-wrap:anywhere}
.account-profile-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:13px}
.account-profile-actions button{min-height:44px;padding:8px 12px;border:1px solid #b69bc34a;border-radius:8px;background:transparent;color:#e2c8f4;font-size:12px;line-height:1.5;cursor:pointer}
.account-sign-in{margin:0 0 19px}
.account-login{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;min-height:48px;padding:12px 16px;border:0;border-radius:10px;background:var(--account-accent);color:#25172f;font-size:14px;font-weight:600;line-height:1.5;text-align:left;cursor:pointer}.account-login svg{flex:none}
.account-sign-in p{margin:8px 0 0;color:var(--account-muted);font-size:11px;line-height:1.6;text-align:center}
.account-membership{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:12px;min-width:0;padding:13px 5px;margin:0 0 26px;border-top:1px solid #a473d1;border-bottom:1px solid #a473d1;background:linear-gradient(90deg,#9b70ba05,transparent)}
.account-membership-copy{min-width:0}.account-membership-copy h2{margin:0;font-size:15px;font-weight:500;line-height:1.5;overflow-wrap:anywhere}.account-membership-copy p{margin:3px 0 0;color:#c3b8cd;font-size:11px;line-height:1.6;overflow-wrap:anywhere}
.account-benefits-button{display:flex;align-items:center;justify-content:center;gap:6px;min-height:44px;max-width:126px;padding:8px 11px;border:1px solid #b68cdb;border-radius:9px;background:linear-gradient(130deg,#4930524d,#29212f29);color:#f1e2ff;font-size:12px;line-height:1.5;text-align:center;cursor:pointer}.account-benefits-button span{min-width:0;overflow-wrap:anywhere}.account-benefits-button svg{flex:none}
.account-is-expired{border-color:#8d7c9b}.account-is-expired .account-membership-copy h2{color:#cbc0d4}
.account-credit-summary{grid-column:1/-1;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:4px 14px;min-width:0;padding-top:4px;color:var(--account-muted);font-size:11px;line-height:1.6}.account-credit-summary strong{font-size:16px;font-weight:500;color:#e4cef4}
.account-group{min-width:0;overflow:hidden;border:1px solid #c3b2d107;border-radius:11px;background:linear-gradient(118deg,#28232d99,#201c2699)}
.account-main-actions{margin:0 0 17px}
.account-setting-row{display:grid;grid-template-columns:24px minmax(0,1fr) auto 17px;align-items:center;gap:12px;min-width:0;min-height:64px;width:100%;padding:13px 14px;border:0;background:transparent;color:inherit;font-size:14px;line-height:1.5;text-align:left}
.account-setting-row+.account-setting-row{position:relative}.account-setting-row+.account-setting-row::before{content:'';position:absolute;left:14px;right:14px;top:0;border-top:1px solid #c3b2d12b;pointer-events:none}
button.account-setting-row{cursor:pointer}.account-setting-row>svg{color:#e4dce9}.account-setting-row>svg:last-child{color:#c0b4ca}
.account-history,.account-redeem{grid-template-columns:24px minmax(0,1fr) 17px}
.account-row-copy{display:flex;flex-direction:column;gap:2px;min-width:0}.account-row-copy small{color:var(--account-muted);font-size:11px;line-height:1.6;overflow-wrap:anywhere}
.account-row-label{min-width:0;overflow-wrap:anywhere}
.account-row-value{max-width:127px;color:#bfb3c9;font-size:11px;line-height:1.5;text-align:right;overflow-wrap:anywhere}.account-birth-value{display:flex;flex-direction:column;gap:2px}.account-birth-value small{font-size:10px;color:var(--account-muted)}
.account-preferences{scroll-margin-top:24px}
.account-setting-row select{width:auto;min-width:0;max-width:135px;min-height:44px;margin:-5px -5px -5px 0;padding:8px 5px;border:0;border-radius:8px;appearance:none;background:transparent;color:#c4b9ce;font-size:12px;text-align:right;cursor:pointer}.account-setting-row select option{background:#241d2d;color:#f1ecf4}
.account-updates{min-width:0;margin:0 14px;padding:0;border-top:1px solid #c3b2d12b;background:transparent}
.account-updates :deep(.mobile-update-panel){display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px 10px;min-width:0;margin:0;padding:14px 0;border:0;border-radius:0;background:transparent}
.account-updates :deep(.mobile-update-heading){grid-column:1;grid-row:1;align-self:center;align-items:center;flex-wrap:wrap;gap:5px}.account-updates :deep(.mobile-update-heading h2){margin:0;color:#f3edf7;font-size:14px;font-weight:400;line-height:1.5;letter-spacing:0}.account-updates :deep(.mobile-update-heading p){margin-top:3px;color:var(--account-muted);font-size:10px;line-height:1.5;overflow-wrap:anywhere}
.account-updates :deep(.mobile-update-actions){grid-column:2;grid-row:1;align-self:center;justify-content:flex-end;gap:6px;max-width:151px;margin:0}.account-updates :deep(.mobile-update-actions-expanded){grid-column:1/-1;grid-row:auto;max-width:none;justify-content:flex-start;gap:12px}
.account-updates :deep(.mobile-update-check){min-height:44px;padding:8px 9px;border:0;border-radius:8px;background:transparent;color:#cbbad9;font-size:12px;line-height:1.5;text-align:center}
.account-updates :deep(.mobile-update-actions .mobile-primary),.account-updates :deep(.mobile-update-actions .mobile-secondary){min-height:48px;min-width:0;padding:10px 12px;border-radius:9px;font-size:13px!important;line-height:1.5;overflow-wrap:anywhere}
.account-updates :deep(.mobile-update-status){grid-column:1/-1;margin:0;color:var(--account-muted);font-size:11px;line-height:1.7}.account-updates :deep(.mobile-update-release){grid-column:1/-1;margin:0;padding-top:12px;border-color:var(--account-line)}.account-updates :deep(.mobile-update-release-title strong){color:#f3edf7}.account-updates :deep(.mobile-update-release ul){font-size:12px;line-height:1.8}.account-updates :deep(.mobile-update-download){grid-column:1/-1;margin-top:2px}.account-updates :deep(.mobile-update-progress span){background:var(--account-accent)}.account-updates :deep(.mobile-update-badge){border-color:var(--account-line);color:var(--account-accent);font-size:10px}
.account-support-links{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:0;min-width:0;margin:25px 0 5px}
.account-link{position:relative;min-width:0;min-height:44px;padding:8px 4px;border:0;border-radius:6px;background:transparent;color:#c7bdd0;font-size:11px;line-height:1.5;text-align:center;overflow-wrap:anywhere;cursor:pointer}.account-link+.account-link::before{content:'';position:absolute;left:0;top:16px;height:12px;border-left:1px solid #c7b4d254}
.account-logout{display:block;width:100%;min-height:44px;min-width:0;margin:3px 0 0;padding:10px;border:0;border-radius:8px;background:transparent;color:#b4a7be;font-size:12px;line-height:1.5;text-align:center;overflow-wrap:anywhere;cursor:pointer}
.account-region{margin:10px 0 0;color:#9d90a7;font-size:10px;line-height:1.6;text-align:center;overflow-wrap:anywhere}
@media(max-width:360px){.account-hero-art{left:-18px;right:-18px}}
.account-panel :is(button,select):focus-visible{outline:2px solid #dab8f7;outline-offset:3px}.account-group button:focus-visible{outline-offset:-3px}.account-panel :is(button,select):disabled{opacity:.5;cursor:default}
@media(hover:hover){.account-panel button:not(:disabled):hover{color:#f2ddff}.account-setting-row:hover,.account-profile-actions button:hover{background:#c3a3db0c}.account-login:hover{filter:brightness(1.08)}}
@media(prefers-reduced-motion:no-preference){.account-panel button{transition:background-color .15s,color .15s,opacity .15s}.account-panel button:not(:disabled):active{opacity:.72}}
@media(max-width:359px){.account-page-title{font-size:25px;margin-bottom:25px}.account-identity{grid-template-columns:64px minmax(0,1fr);gap:14px}.account-avatar{width:64px;height:64px}.account-nickname{font-size:21px}.account-name-row{gap:4px}.account-vip-badge{min-width:46px}.account-vip-badge>span{min-width:39px;padding-inline:6px;font-size:11px}.account-orbit-ring,.account-orbit-front{right:-74px;top:29px;width:242px;height:95px}.account-orbit-disc{right:-115px;top:-10px;width:204px;height:204px}.account-membership{padding-inline:2px;gap:9px;margin-bottom:21px}.account-membership-copy h2{font-size:14px}.account-membership-copy p{font-size:10px}.account-benefits-button{max-width:108px;padding-inline:8px;font-size:11px;gap:3px}.account-setting-row{padding:12px;gap:9px;font-size:13px}.account-row-value{max-width:105px;font-size:10px}.account-setting-row select{max-width:116px;font-size:11px}.account-row-copy small{font-size:10px}.account-updates{margin-inline:12px}.account-updates :deep(.mobile-update-heading h2){font-size:13px}.account-updates :deep(.mobile-update-actions){max-width:135px}.account-updates :deep(.mobile-update-check){padding-inline:7px;font-size:11px}.account-support-links{margin-top:20px}.account-link{font-size:10px}.account-credit-summary{font-size:10px}}
</style>
