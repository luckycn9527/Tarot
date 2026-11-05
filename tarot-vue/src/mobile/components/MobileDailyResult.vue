<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import HistoryIcon from '@icons/history.vue'
import type { DailyFortuneResponse } from '../../services/tarotAiReading'
import { dailyRatingPresentation } from '../mobileDailyPresentation'

const props = withDefaults(defineProps<{
  response: Pick<DailyFortuneResponse, 'businessDate' | 'result'> | null
  busy: boolean
  error: string
  english: boolean
  cached?: boolean
  period?: 'today' | 'yesterday'
  showYesterday?: boolean
  showHeader?: boolean
}>(), { cached: false, period: 'today', showYesterday: true, showHeader: true })
const emit = defineEmits<{ retry: []; yesterday: [] }>()
const instanceId = useId()
const yesterday = computed(() => props.period === 'yesterday')
const title = computed(() => props.english ? (yesterday.value ? 'Yesterday’s fortune' : 'Today’s fortune') : (yesterday.value ? '昨日运势' : '今日运势'))
type Category = 'overall' | 'love' | 'career' | 'wealth' | 'health'
const selected = ref<Category>('overall')
const categories = computed((): { key: Category; label: string }[] => props.english
  ? [{ key: 'overall', label: 'Overall' }, { key: 'love', label: 'Love' }, { key: 'career', label: 'Career' }, { key: 'wealth', label: 'Wealth' }, { key: 'health', label: 'Health' }]
  : [{ key: 'overall', label: '整体' }, { key: 'love', label: '感情' }, { key: 'career', label: '事业' }, { key: 'wealth', label: '财运' }, { key: 'health', label: '身心' }])
const result = computed(() => props.response?.result)
const category = computed(() => categories.value.find(item => item.key === selected.value)!)
const ratings = computed(() => Object.fromEntries(categories.value.map(item => [item.key, dailyRatingPresentation(result.value?.ratings?.[item.key], props.english)])) as Record<Category, ReturnType<typeof dailyRatingPresentation>>)
const rating = computed(() => ratings.value[selected.value])
const errorText = computed(() => props.english ? `${yesterday.value ? 'Yesterday’s' : 'Today’s'} fortune could not be loaded. Check your connection and try again.` : props.error)
watch(() => props.response?.businessDate, () => { selected.value = 'overall' })
function changeCategory(event: KeyboardEvent, index: number) {
  const count = categories.value.length
  const next = event.key === 'ArrowRight' ? (index + 1) % count : event.key === 'ArrowLeft' ? (index + count - 1) % count : event.key === 'Home' ? 0 : event.key === 'End' ? count - 1 : null
  if (next === null) return
  event.preventDefault(); selected.value = categories.value[next]!.key
  const target = event.currentTarget as HTMLButtonElement
  const tabs = target.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
  tabs?.[next]?.focus()
}
</script>

<template>
  <section class="mobile-daily-result" :aria-label="title" :aria-busy="busy">
    <div v-if="busy && !result" class="mdr-status" role="status">
      <span class="mdr-orbit" aria-hidden="true" />
      <p>{{ yesterday ? (english ? 'Loading yesterday’s fortune…' : '正在读取昨日运势…') : (english ? 'Reading today’s fortune…' : '正在解读今日运势…') }}</p>
      <span>{{ yesterday ? (english ? 'Please wait a moment.' : '请稍候。') : (english ? 'Your card is ready. Please wait a moment.' : '今日的卡牌已揭晓，请稍候。') }}</span>
    </div>
    <template v-if="result">
      <header v-if="showHeader" class="mdr-header">
        <div class="mdr-meta"><p>{{ title }}</p>
          <span>{{ response?.businessDate }}<span v-if="cached" class="mdr-saved"> · {{ yesterday ? (english ? 'Saved result' : '已保存') : (english ? 'Saved for today' : '今日已保存') }}</span></span>
        </div>
        <button v-if="showYesterday && !yesterday" class="mdr-yesterday" type="button" aria-haspopup="dialog" @click="emit('yesterday')"><HistoryIcon :size="15" aria-hidden="true" /><span>{{ english ? 'Yesterday’s fortune' : '昨日运势' }}</span></button>
      </header>
      <p class="mdr-intro">{{ result.sections.intro }}</p>
      <div class="mdr-tabs" role="tablist" :aria-label="english ? 'Fortune categories' : '运势分类'">
        <button v-for="(item, index) in categories" :id="`daily-${instanceId}-tab-${item.key}`" :key="item.key" type="button" role="tab" :aria-label="`${item.label}, ${ratings[item.key].ariaLabel}`" :aria-selected="selected === item.key" :aria-controls="`daily-${instanceId}-panel-${item.key}`" :tabindex="selected === item.key ? 0 : -1" :class="{ active: selected === item.key }" @click="selected = item.key" @keydown="changeCategory($event, index)">
          <span aria-hidden="true">{{ item.label }}</span><small aria-hidden="true">{{ ratings[item.key].stars ?? '—' }}</small>
        </button>
      </div>
      <div :id="`daily-${instanceId}-panel-${selected}`" class="mdr-panel" role="tabpanel" :aria-labelledby="`daily-${instanceId}-tab-${selected}`" tabindex="0">
        <div class="mdr-panel-heading">
          <h2>{{ category.label }}</h2>
          <span class="mdr-rating" :class="{ 'mdr-not-rated': !rating.stars }"><span class="mdr-sr-only">{{ rating.ariaLabel }}</span><span aria-hidden="true">{{ rating.text }}</span></span>
        </div>
        <p>{{ result.sections[selected] }}</p>
      </div>
      <aside class="mdr-mystery">
        <h2><span aria-hidden="true">✧</span> {{ yesterday ? (english ? 'A thought from yesterday' : '昨日启示') : (english ? 'A thought for today' : '今日启示') }}</h2>
        <p>{{ result.sections.mystery }}</p>
      </aside>
    </template>
    <div v-if="error" class="mdr-error" role="alert">
      <p>{{ errorText }}</p>
      <button type="button" :disabled="busy" @click="emit('retry')">{{ busy ? (english ? 'Loading…' : '正在加载…') : (english ? 'Try again' : '重试') }}</button>
    </div>
  </section>
</template>

<style scoped>
.mobile-daily-result { width:100%; min-width:0; color:var(--m-text); text-align:left; }
.mdr-header { display:flex; flex-wrap:wrap; gap:8px 12px; align-items:center; justify-content:space-between; }
.mdr-meta { min-width:0; }
.mdr-header p { margin:0; color:var(--m-accent); font-size:12px; line-height:1.8; letter-spacing:.09em; }
.mdr-meta>span { color:var(--m-muted); font-size:11px; }
.mdr-saved { color:var(--m-muted); }
.mdr-yesterday { display:inline-flex; align-items:center; justify-content:center; gap:6px; flex:none; min-height:var(--m-tool-height); padding:8px 10px; border:1px solid var(--m-line-strong); border-radius:var(--m-control-radius); background:var(--m-accent-soft); color:var(--m-accent); font:inherit; font-size:12px; line-height:1.4; cursor:pointer; }
.mdr-intro,.mdr-panel>p,.mdr-mystery p { margin:13px 0 0; font-size:14px; line-height:1.95; white-space:pre-wrap; overflow-wrap:anywhere; }
.mdr-intro { color:var(--m-text); }
.mdr-tabs { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:4px; margin-top:24px; padding:5px; border:1px solid var(--m-line); border-radius:var(--m-control-radius); background:var(--m-card-surface); }
.mdr-tabs button { display:flex; flex-direction:column; align-items:center; gap:5px; min-width:0; min-height:var(--m-tool-height); padding:10px 1px; border:0; border-radius:10px; background:transparent; color:var(--m-muted); font:inherit; font-size:12px; line-height:1.3; cursor:pointer; }
.mdr-tabs button.active { color:var(--m-text); background:var(--m-accent-soft); box-shadow:inset 0 0 0 1px var(--m-line-strong); }
.mdr-tabs small { color:var(--m-rating); font-family:Arial,sans-serif; font-size:9px; line-height:1.5; letter-spacing:0; white-space:nowrap; }
.mdr-tabs button:focus-visible,.mdr-error button:focus-visible,.mdr-yesterday:focus-visible,.mdr-panel:focus-visible { outline:2px solid var(--m-accent); outline-offset:3px; }
.mdr-panel { margin-top:20px; }
.mdr-panel-heading { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:8px; }
.mdr-panel h2,.mdr-mystery h2 { margin:0; font-size:16px; line-height:1.6; font-weight:600; }
.mdr-rating { color:var(--m-rating); font-family:Arial,sans-serif; font-size:17px; line-height:1.5; letter-spacing:2px; white-space:nowrap; }
.mdr-not-rated { color:var(--m-muted); font:inherit; font-size:12px; letter-spacing:0; }
.mdr-sr-only { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip-path:inset(50%); white-space:nowrap; border:0; }
.mdr-panel>p { margin-top:10px; color:var(--m-text); }
.mdr-mystery { margin:25px 0 0; padding:19px 0 0; border-top:1px solid var(--m-line); }
.mdr-mystery h2 { color:var(--m-accent); font-size:14px; }
.mdr-mystery h2 span { display:inline-block; margin-right:4px; }
.mdr-mystery p { margin-top:9px; color:var(--m-muted); font-size:13px; }
.mdr-status { display:flex; flex-direction:column; align-items:center; padding:10px 16px 20px; text-align:center; }
.mdr-status p { margin:15px 0 6px; font-size:14px; }
.mdr-status>span:last-child { color:var(--m-muted); font-size:12px; line-height:1.7; }
.mdr-orbit { width:23px; height:23px; border:1px solid var(--m-line-strong); border-top-color:var(--m-accent); border-radius:50%; animation:mdr-spin 1.2s linear infinite; }
.mdr-error { display:flex; align-items:center; flex-wrap:wrap; gap:12px; margin-top:16px; padding:13px 15px; border:1px solid var(--m-line); border-radius:13px; background:var(--m-accent-soft); }
.mdr-error p { flex:1 1 190px; margin:0; color:var(--m-muted); font-size:12px; line-height:1.8; white-space:pre-wrap; }
.mdr-error button { min-height:var(--m-tool-height); padding:7px 15px; border:1px solid var(--m-line-strong); border-radius:var(--m-control-radius); background:var(--m-accent-soft); color:var(--m-accent); font:inherit; font-size:12px; cursor:pointer; }
.mdr-error button:disabled { opacity:.6; cursor:wait; }
@keyframes mdr-spin { to { transform:rotate(360deg); } }
@media(max-width:350px) { .mdr-tabs { gap:1px; padding:4px; } .mdr-tabs button { font-size:11px; } .mdr-header { align-items:flex-start; } .mdr-yesterday { max-width:140px; } }
@media(prefers-reduced-motion:reduce) { .mdr-orbit { animation:none; } }
</style>
