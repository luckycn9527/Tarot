<script setup lang="ts">
import { computed, ref } from 'vue'
const props = defineProps<{ question: string; english: boolean }>()
const expanded = ref(false)
const canCollapse = computed(() => props.question.length > 64 || props.question.includes('\n'))
</script>

<template>
  <div class="mobile-reading-question-block">
    <h1 id="mobile-reading-question-text" class="mobile-reading-question" :class="{ 'mobile-question-collapsed': canCollapse && !expanded }">{{ question }}</h1>
    <button v-if="canCollapse" type="button" class="mobile-question-toggle" :aria-expanded="expanded" aria-controls="mobile-reading-question-text" @click="expanded = !expanded">{{ english ? expanded ? 'Show less' : 'Read the full question' : expanded ? '收起问题' : '展开完整问题' }} <span aria-hidden="true">{{ expanded ? '↑' : '↓' }}</span></button>
  </div>
</template>

<style scoped>
.mobile-reading-question-block { margin-bottom: 18px; }
.mobile-reading-question { margin-bottom: 0 !important; }
.mobile-question-collapsed { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden; }
.mobile-question-toggle { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; margin-top: 2px; padding: 6px 0; border: 0; background: transparent; color: #cfb9ff; font-size: 12px !important; }
</style>
