<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { findOfflineCard, getOfflineCardImageUrl } from '../data/offlineCards'
import type { MobileCard } from '../types'
import { mobileCardBackUrl } from '../useMobileCardBack'
const props = withDefaults(defineProps<{ card: MobileCard; revealed: boolean; english?: boolean; compact?: boolean; label?: string; disabled?: boolean; imageUrl?: string | null }>(), { english: false, compact: false })
const emit = defineEmits<{ flip: [] }>()
const failed = ref(false)
watch(() => props.imageUrl, () => { failed.value = false })
const data = computed(() => findOfflineCard(props.card.id))
const name = computed(() => props.english ? data.value?.nameEn : data.value?.name)
const face = computed(() => !failed.value && props.imageUrl ? props.imageUrl : getOfflineCardImageUrl(data.value?.nameEn || 'The_Fool'))
const accessible = computed(() => props.revealed ? `${name.value} · ${props.english ? props.card.isReversed ? 'Reversed' : 'Upright' : props.card.isReversed ? '逆位' : '正位'}` : props.label || (props.english ? 'Tap to reveal card' : '点击翻开这张牌'))
</script>
<template>
  <button type="button" class="mf-card" :class="{ 'mf-revealed': revealed, 'mf-compact': compact }" :disabled="disabled" :aria-label="accessible" :aria-pressed="revealed" @click="emit('flip')">
    <span class="mf-inner"><span class="mf-face mf-back"><img :src="mobileCardBackUrl" alt="" draggable="false"></span><span class="mf-face mf-front"><img :src="face" alt="" :class="{ 'mf-reversed': card.isReversed }" draggable="false" @error="failed = true"></span></span>
  </button>
</template>
<style scoped>
.mf-card{display:block;position:relative;flex-shrink:0;width:min(46vw,190px);aspect-ratio:350/554;border:0;padding:0;background:transparent;border-radius:13px;perspective:900px;touch-action:manipulation;-webkit-tap-highlight-color:transparent}.mf-inner{display:block;position:absolute;inset:0;transform-style:preserve-3d;transition:transform .5s cubic-bezier(.22,.72,.2,1)}.mf-revealed .mf-inner{transform:rotateY(180deg)}.mf-face{position:absolute;inset:0;border-radius:12px;overflow:hidden;backface-visibility:hidden;-webkit-backface-visibility:hidden;box-shadow:0 10px 25px #0005;border:1px solid #c7afef55;background:#211b2b}.mf-back{background:#291d45}.mf-front{transform:rotateY(180deg)}.mf-face img{display:block;width:100%;height:100%;object-fit:contain;pointer-events:none}.mf-face img.mf-reversed{transform:rotate(180deg)}.mf-compact{width:clamp(74px,23vw,112px)}.mf-card:focus-visible{outline:2px solid #cfb9ff;outline-offset:5px}.mf-card:disabled{cursor:default;opacity:1}@media(prefers-reduced-motion:reduce){.mf-inner{transition:none}}
</style>
