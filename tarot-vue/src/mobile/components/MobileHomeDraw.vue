<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import TarotCard3D from '@/components/TarotCard3D.vue'
import { mobileCardBackUrl } from '../useMobileCardBack'
import { findOfflineCard, getOfflineCardImageUrl } from '../data/offlineCards'
import type { MobileCard } from '../types'

const props = withDefaults(defineProps<{
  card: MobileCard
  flipped: boolean
  english: boolean
  imageUrl?: string | null
  busy?: boolean
}>(), { imageUrl: null, busy: false })
const emit = defineEmits<{ draw: [] }>()
const failedRemote = ref(false)
const failedOffline = ref(false)
watch(() => [props.card.id, props.imageUrl], () => { failedRemote.value = false; failedOffline.value = false })
const cardData = computed(() => findOfflineCard(props.card.id))
const name = computed(() => props.english ? cardData.value?.nameEn || '' : cardData.value?.name || '')
const direction = computed(() => props.english
  ? props.card.isReversed ? 'Reversed' : 'Upright'
  : props.card.isReversed ? '逆位' : '正位')
const face = computed(() => {
  if (!failedRemote.value && props.imageUrl) return props.imageUrl
  return failedOffline.value || !cardData.value ? undefined : getOfflineCardImageUrl(cardData.value.nameEn)
})
const cardLabel = computed(() => props.flipped ? `${name.value} · ${direction.value}`
  : props.english ? 'Reveal today’s fortune' : '翻开卡牌，查看每日运势')

function imageError(event: Event) {
  const target = event.target
  if (!(target instanceof HTMLImageElement)) return
  if (!target.closest('.tarot-3d-front')) return
  if (props.imageUrl && !failedRemote.value) failedRemote.value = true
  else failedOffline.value = true
}
</script>

<template>
  <section class="mobile-home-draw" :class="flipped ? 'mhd-revealed' : 'mhd-ready'" :aria-label="english ? 'Daily fortune' : '每日运势'" :aria-busy="busy">
    <header class="mhd-intro">
      <h1>{{ english ? 'Daily fortune' : '每日运势' }}</h1>
    </header>

    <div class="mhd-stage" :class="{ 'mhd-waiting': !flipped }">
      <div class="mhd-glow" aria-hidden="true" />
      <button type="button" class="mhd-card-button" :class="{ 'mhd-floating': !flipped }" :disabled="flipped || busy" :aria-label="cardLabel" :aria-pressed="flipped" @click="emit('draw')" @error.capture="imageError">
        <TarotCard3D :card-image-url="face" :card-back-url="mobileCardBackUrl" :is-reversed="card.isReversed" :is-flipped="flipped" :clickable="false" size="lg" class="mhd-card" />
      </button>
    </div>

    <p v-if="!flipped" class="mhd-draw-prompt" :role="busy ? 'status' : undefined">{{ busy ? (english ? 'Preparing today’s fortune…' : '正在准备今日运势…') : (english ? 'Tap to reveal today’s fortune' : '轻触卡牌，开启今日运势') }}</p>
    <div v-else class="mhd-result" aria-live="polite">
      <p class="mhd-card-name">{{ name }}<span> · {{ direction }}</span></p>
    </div>
    <div v-if="flipped" class="mhd-fortune"><slot /></div>
  </section>
</template>

<style scoped>
/* Home main has 12px top / 24px bottom padding; keep the whole waiting state above the fixed nav. */
.mobile-home-draw { --mhd-home-height:calc(min(100svh,100dvh) - var(--m-header-height,76px) - var(--m-nav-height,76px) - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px) - 36px); display:flex; flex-direction:column; align-items:center; width:100%; min-width:0; padding:0 0 8px; color:var(--m-text); text-align:center; }
.mhd-ready { display:grid; grid-template-rows:auto minmax(0,1fr) auto; justify-items:center; row-gap:clamp(16px,2.4svh,24px); min-height:max(0px,var(--mhd-home-height)); padding-bottom:clamp(12px,1.8svh,18px); }
.mhd-intro { width:100%; max-width:360px; margin:0 auto; }
.mhd-intro h1 { margin:0; color:var(--m-text); font-family:inherit; font-size:27px; line-height:1.4; font-weight:600; letter-spacing:.02em; }
.mhd-stage { position:relative; isolation:isolate; display:flex; align-items:center; justify-content:center; width:100%; margin:12px 0 0; padding:4px 0 8px; }
.mhd-ready .mhd-stage { align-self:stretch; min-height:0; margin:0; padding:8px 0 12px; }
.mhd-stage::after { content:""; position:absolute; z-index:-1; bottom:0; left:50%; width:116px; height:14px; border-radius:50%; background:color-mix(in srgb,var(--m-bg) 70%,transparent); filter:blur(10px); transform:translateX(-50%); pointer-events:none; }
.mhd-glow { position:absolute; inset:-12% 4%; z-index:-1; border-radius:50%; background:radial-gradient(ellipse at 50% 45%,color-mix(in srgb,var(--m-accent) 11%,transparent) 0%,color-mix(in srgb,var(--m-accent) 4%,transparent) 42%,transparent 68%); pointer-events:none; }
.mhd-card-button { display:block; position:relative; flex:none; width:min(40vw,21svh,168px); aspect-ratio:941/1672; padding:0; border:0; border-radius:16px; background:transparent; color:inherit; cursor:pointer; touch-action:manipulation; -webkit-tap-highlight-color:transparent; }
/* Reserve title, hint, gaps and stage padding before deriving the back's width from its native ratio. */
.mhd-ready .mhd-card-button { width:max(112px,min(64vw,272px,calc((var(--mhd-home-height) - 124px) * .562799))); }
.mhd-card-button:disabled { cursor:default; opacity:1!important; }
.mhd-card-button:focus-visible { outline:2px solid var(--m-accent); outline-offset:8px; }
.mhd-card-button:not(:disabled):active { scale:.98; }
.mhd-card-button :deep(.mhd-card) { width:100%; height:100%; }
.mhd-card :deep(.tarot-3d-face) { border:1px solid var(--m-line-strong); border-radius:16px; background:var(--m-input-bg); box-shadow:0 13px 27px var(--m-shadow),0 1px 2px var(--m-line-strong),inset 0 0 0 1px var(--m-accent-soft); }
.mhd-card :deep(.tarot-3d-front img) { object-fit:contain; }
.mhd-card :deep(.tarot-3d-back) { background:#291d45; }
.mhd-card :deep(.tarot-3d-back-border) { border-color:var(--m-accent-soft); }
.mhd-card :deep(.tarot-3d-glow) { inset:-11px; background:radial-gradient(ellipse,var(--m-accent-soft),transparent 70%); filter:blur(24px); transform:scale(.95); animation:none; }
.mhd-card :deep(.tarot-3d-back)::after { content:""; position:absolute; inset:0; border-radius:inherit; background:linear-gradient(115deg,transparent 25%,color-mix(in srgb,var(--m-accent) 5%,transparent) 43%,color-mix(in srgb,var(--m-text) 9%,transparent) 50%,color-mix(in srgb,var(--m-accent) 2%,transparent) 57%,transparent 72%); background-size:320% 100%; background-position:100% 0; pointer-events:none; }
.mhd-waiting .mhd-card :deep(.tarot-3d-back)::after { animation:mhd-sheen 9s ease-in-out infinite; }
.mhd-card :deep(.tarot-3d-burst) { display:none; }
.mhd-floating { animation:mhd-float 6s ease-in-out infinite; }
.mhd-draw-prompt { margin:13px 0 0; color:var(--m-muted); font-size:13px; line-height:1.7; letter-spacing:.04em; }
.mhd-ready .mhd-draw-prompt { margin:0; }
.mhd-result { width:100%; max-width:350px; margin:8px auto 0; }
.mhd-card-name { margin:0; color:var(--m-text); font-size:18px; line-height:1.6; }
.mhd-card-name span { color:var(--m-muted); font-size:13px; }
.mhd-fortune { width:100%; min-width:0; margin-top:14px; text-align:left; }
@keyframes mhd-float { 0%,100% { transform:translateY(0) rotate(-.7deg); } 50% { transform:translateY(-6px) rotate(.4deg); } }
@keyframes mhd-sheen { 0%,30%,100% { background-position:100% 0; opacity:0; } 43% { opacity:1; } 68% { background-position:0 0; opacity:0; } }
@media(max-width:360px) { .mhd-intro h1 { font-size:24px; } }
@media(prefers-reduced-motion:reduce) { .mhd-floating,.mhd-waiting .mhd-card :deep(.tarot-3d-back)::after { animation:none; } .mhd-card :deep(.tarot-3d-card),.mhd-card :deep(.tarot-3d-glow) { transition:none!important; animation:none!important; } .mhd-card :deep(.tarot-3d-shine) { transition:none; } }
</style>
