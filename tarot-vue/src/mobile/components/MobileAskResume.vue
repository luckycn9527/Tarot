<script setup lang="ts">
import type { AskResumeItem } from '../mobileAskEntry'

defineProps<{ items: AskResumeItem[]; english: boolean }>()
const emit = defineEmits<{ resume: [id: string] }>()
</script>

<template>
  <details v-if="items.length" class="ma-resume">
    <summary class="ma-resume-summary">
      <span class="ma-resume-label">{{ english ? 'Continue a previous reading' : '继续上次问卜' }}</span>
      <span class="ma-resume-count">{{ items.length }}</span>
      <span class="ma-resume-chevron" aria-hidden="true"></span>
    </summary>
    <ol class="ma-resume-list" :aria-label="english ? 'Readings you can continue' : '可继续的问卜'">
      <li v-for="item in items" :key="item.id">
        <button type="button" class="ma-resume-item" :data-kind="item.kind" @click="emit('resume', item.id)">
          <span class="ma-resume-title">{{ item.title }}</span>
          <span class="ma-resume-description">{{ item.description }}</span>
          <span v-if="item.detail" class="ma-resume-detail">{{ item.detail }}</span>
        </button>
      </li>
    </ol>
  </details>
</template>

<style scoped>
.ma-resume {
  min-width: 0;
  margin-bottom: 18px;
  border-block: 1px solid var(--m-line, #cbb0ed2b);
  color: var(--m-text, #f1ecf4);
}
.ma-resume * { box-sizing: border-box; }
.ma-resume-summary {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
  min-height: 48px;
  padding: 10px 3px;
  color: var(--m-muted, #b6a8c6);
  font-size: 13px;
  line-height: 1.6;
  list-style: none;
  cursor: pointer;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}
.ma-resume-summary::-webkit-details-marker { display: none; }
.ma-resume-label { min-width: 0; overflow-wrap: anywhere; }
.ma-resume-count {
  flex: none;
  color: var(--m-accent, #cbb0ed);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
.ma-resume-chevron {
  flex: none;
  width: 7px;
  height: 7px;
  margin: -4px 4px 0 auto;
  border-right: 1.5px solid currentColor;
  border-bottom: 1.5px solid currentColor;
  transform: rotate(45deg);
}
.ma-resume[open] .ma-resume-chevron { margin-top: 4px; transform: rotate(225deg); }
.ma-resume-list {
  display: grid;
  gap: 0;
  max-height: min(340px, 50dvh);
  margin: 0 0 8px;
  padding: 3px;
  overflow-y: auto;
  overscroll-behavior: contain;
  list-style: none;
}
.ma-resume-list li { min-width: 0; }
.ma-resume-list li + li { border-top: 1px solid var(--m-line, #cbb0ed2b); }
.ma-resume-item {
  display: grid;
  gap: 3px;
  width: 100%;
  min-width: 0;
  min-height: 64px;
  padding: 11px 7px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: inherit;
  text-align: left;
  font: inherit;
  cursor: pointer;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}
.ma-resume-item > span { min-width: 0; overflow-wrap: anywhere; }
.ma-resume-title { color: var(--m-accent, #cbb0ed); font-size: 12px; font-weight: 500; line-height: 1.5; }
.ma-resume-description {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-line;
}
.ma-resume-detail { color: var(--m-muted, #b6a8c6); font-size: 11px; line-height: 1.6; }
.ma-resume-summary:focus-visible, .ma-resume-item:focus-visible { outline: 2px solid var(--m-accent, #cbb0ed); outline-offset: -2px; }
@media (hover: hover) { .ma-resume-item:hover { background: var(--m-card-surface, #211b29); } }
</style>
