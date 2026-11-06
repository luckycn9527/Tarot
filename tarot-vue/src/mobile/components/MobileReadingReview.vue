<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import { normalizeMobileOutcome, type MobileOutcomeRating } from '../mobileHistoryModel'

const props = defineProps<{
  english: boolean
  loading: boolean
  saving: boolean
  error: string
  value: unknown
  eligible: boolean
  online: boolean
}>()
const emit = defineEmits<{
  save: [value: { rating: MobileOutcomeRating }]
  retry: []
}>()

const id = `mr-review-${useId()}`
const saved = computed(() => normalizeMobileOutcome(props.value))
const selected = ref<MobileOutcomeRating | ''>(saved.value?.rating ?? '')
watch(saved, value => { selected.value = value?.rating ?? '' }, { deep: true })
const disabled = computed(() => props.loading || props.saving || !props.online || !props.eligible)
const canSave = computed(() => !disabled.value && Boolean(selected.value) && selected.value !== saved.value?.rating)
const options = ['full', 'partial', 'none'] as const

function label(rating: MobileOutcomeRating) {
  if (props.english) return { full: 'Strongly resonated', partial: 'Somewhat resonated', none: 'Not yet resonating' }[rating]
  return { full: '很有共鸣', partial: '部分有共鸣', none: '暂未有共鸣' }[rating]
}
function save() {
  if (canSave.value && selected.value) emit('save', { rating: selected.value })
}
</script>

<template>
  <section class="mr-review" :aria-labelledby="`${id}-title`" :aria-busy="loading || saving">
    <h2 :id="`${id}-title`">{{ english ? 'A moment to reflect' : '回访复盘' }}</h2>
    <p class="mr-copy">{{ english ? 'Looking back, how much did this reading resonate with your experience or feelings? This records your personal reflection.' : '再回头看，这次解读与你的经历或感受有多少共鸣？这里记录的是你的个人感受。' }}</p>

    <p v-if="loading" class="mr-status" role="status">{{ english ? 'Loading your reflection…' : '正在读取你的复盘…' }}</p>
    <template v-else>
      <p v-if="saved" class="mr-saved" role="status">{{ english ? 'Saved reflection: ' : '已记录：' }}{{ label(saved.rating) }}</p>
      <div v-if="error" class="mr-error" role="alert">
        <p>{{ error }}</p>
        <button type="button" class="mr-retry" :disabled="saving || !online" @click="emit('retry')">{{ english ? 'Try again' : '重试' }}</button>
      </div>
      <p v-if="!online" class="mr-status" role="status">{{ english ? 'Connect to the internet to save your reflection.' : '连接网络后即可保存复盘。' }}</p>
      <p v-if="!eligible" class="mr-status">{{ english ? 'Come back from the next day to record your reflection.' : '从次日起，可以回来记录自己的感受。' }}</p>
      <form v-else @submit.prevent="save">
        <fieldset :disabled="disabled">
          <legend class="mr-sr-only">{{ english ? 'How much did this reading resonate?' : '这次解读有多少共鸣？' }}</legend>
          <label v-for="rating in options" :key="rating" class="mr-option" :class="{ 'is-selected': selected === rating }">
            <input v-model="selected" type="radio" :name="id" :value="rating">
            <span>{{ label(rating) }}</span>
          </label>
        </fieldset>
        <div class="mr-actions">
          <span v-if="saving" class="mr-status" role="status">{{ english ? 'Saving reflection…' : '正在保存复盘…' }}</span>
          <span v-else class="mr-hint">{{ english ? 'You can update this later.' : '之后也可以更新感受。' }}</span>
          <button type="submit" class="mr-save" :disabled="!canSave">{{ english ? (saved ? 'Update reflection' : 'Save reflection') : (saved ? '更新复盘' : '保存复盘') }}</button>
        </div>
      </form>
    </template>
  </section>
</template>

<style scoped>
.mr-review { min-width: 0; margin-top: 22px; padding: 18px; border: 1px solid var(--m-line, #cbb0ed2b); border-radius: 18px; background: var(--m-card-surface, #211b29); color: var(--m-text, #f1ecf4); }
.mr-review * { box-sizing: border-box; }
.mr-review h2 { margin: 0 0 8px; font-size: 18px; font-weight: 600; line-height: 1.5; }
.mr-copy { margin: 0; color: var(--m-muted, #b6a8c6); font-size: 13px; line-height: 1.8; }
.mr-saved { margin: 13px 0 0; color: var(--m-accent, #cbb0ed); font-size: 14px; line-height: 1.6; }
.mr-status { margin: 12px 0 0; color: var(--m-muted, #b6a8c6); font-size: 13px; line-height: 1.7; }
.mr-review fieldset { display: grid; gap: 8px; min-width: 0; margin: 15px 0 0; padding: 0; border: 0; }
.mr-option { display: flex; align-items: center; gap: 9px; min-width: 0; min-height: 44px; padding: 10px 12px; border: 1px solid var(--m-line, #cbb0ed2b); border-radius: 11px; color: var(--m-text, #f1ecf4); font-size: 14px; line-height: 1.6; cursor: pointer; }
.mr-option.is-selected { border-color: var(--m-accent, #cbb0ed); background: #cbb0ed12; }
.mr-option input { flex: 0 0 auto; width: 17px; height: 17px; margin: 0; accent-color: var(--m-accent, #cbb0ed); }
.mr-option span { min-width: 0; overflow-wrap: anywhere; }
.mr-review fieldset:disabled .mr-option { cursor: not-allowed; opacity: .55; }
.mr-actions { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; margin-top: 13px; }
.mr-hint { color: var(--m-muted, #b6a8c6); font-size: 12px; line-height: 1.6; }
.mr-actions .mr-status { margin: 0; }
.mr-review button { min-height: 44px; min-width: 0; padding: 10px 13px; border: 0; border-radius: 11px; font: inherit; font-size: 14px; line-height: 1.5; cursor: pointer; touch-action: manipulation; }
.mr-save { margin-left: auto; background: var(--m-accent, #cbb0ed); color: var(--m-accent-ink, #291d35); font-weight: 600; }
.mr-review button:disabled { cursor: not-allowed; opacity: .45; }
.mr-review :is(input, button):focus-visible { outline: 2px solid var(--m-accent, #cbb0ed); outline-offset: 4px; }
.mr-error { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-top: 12px; padding: 11px; border: 1px solid #ecc1b14d; border-radius: 12px; background: #513a3b55; }
.mr-error p { flex: 1; min-width: min(100%, 150px); margin: 0; color: #f2d3c9; font-size: 13px; line-height: 1.7; overflow-wrap: anywhere; }
.mr-error .mr-retry { background: transparent; color: var(--m-text, #f1ecf4); border: 1px solid var(--m-line, #cbb0ed2b); }
.mr-sr-only { position: absolute; width: 1px; height: 1px; padding: 0; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
@media (min-width: 500px) { .mr-review fieldset { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (max-width: 360px) { .mr-review { padding: 15px; } }
</style>
