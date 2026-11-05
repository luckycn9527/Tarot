<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import ChevronDown from '@icons/chevron-down.vue'
import MobileFlipCard from './MobileFlipCard.vue'
import { findOfflineCard } from '../data/offlineCards'
import { readingPresentation } from '../mobileReadingPresentation'
import type { MobileHistoryEntry } from '../types'

const props = withDefaults(defineProps<{
  entry: MobileHistoryEntry
  english: boolean
  positions?: string[]
  imageOverrides?: Record<number, string>
}>(), { positions: () => [], imageOverrides: () => ({}) })
const summaryId = `mro-summary-${useId()}`
const summaryExpanded = ref(false)
const presentation = computed(() => readingPresentation(props.entry, props.english))
const summaryCanExpand = computed(() => presentation.value.summary.length > (props.english ? 260 : 100))
const cards = computed(() => (Array.isArray(props.entry.cardIds) ? props.entry.cardIds : []).flatMap((id, index) => {
  const card = findOfflineCard(id)
  if (!card) return []
  return [{ id, index, isReversed: props.entry.orientations?.[index] === 'reversed',
    name: props.english ? card.nameEn : card.name,
    position: props.positions[index] || (props.english ? `Card ${index + 1}` : `第 ${index + 1} 张牌`),
  }]
}))
const single = computed(() => cards.value.length === 1)
const orientation = (reversed: boolean) => props.english ? reversed ? 'Reversed' : 'Upright' : reversed ? '逆位' : '正位'
watch(() => [props.entry.id, presentation.value.summary], () => { summaryExpanded.value = false })
</script>

<template>
  <section class="mobile-reading-overview" :aria-label="english ? 'Your reading result' : '占卜结果'">
    <div class="mro-overview" :class="{ 'mro-single': single, 'mro-without-cards': !cards.length }">
      <div v-if="cards.length" class="mro-cards" :class="{ 'mro-cards-single': single }" role="group" :aria-label="english ? 'The cards in this reading' : '这次抽到的牌'">
        <figure v-for="card in cards" :key="`${entry.id}-${card.index}-${card.id}`" class="mro-card">
          <span v-if="!single" class="mro-position">{{ card.position }}</span>
          <MobileFlipCard :card="card" revealed compact disabled :english="english" :image-url="imageOverrides[card.id]" class="mro-card-art" />
          <figcaption><strong>{{ card.name }}</strong><span class="mro-orientation" :class="{ 'is-reversed': card.isReversed }">{{ orientation(card.isReversed) }}</span></figcaption>
        </figure>
      </div>
      <article class="mro-takeaway">
        <h2>{{ english ? 'Your reading at a glance' : '这次的结论' }}</h2>
        <p v-if="presentation.summary" :id="summaryId" class="mro-summary mobile-summary" :class="{ 'mro-summary-clamped': summaryCanExpand && !summaryExpanded }">{{ presentation.summary }}</p>
        <p v-else class="mro-summary-unavailable">{{ english ? 'This saved reading has no separate summary. Its interpretation is shown below.' : '这条记录没有独立结论，已保存的解读见下方。' }}</p>
        <button v-if="summaryCanExpand" type="button" class="mro-summary-toggle" :aria-expanded="summaryExpanded" :aria-controls="summaryId" @click="summaryExpanded = !summaryExpanded">{{ summaryExpanded ? (english ? 'Show less' : '收起结论') : (english ? 'Read the full conclusion' : '展开完整结论') }}<ChevronDown :size="16" aria-hidden="true" :class="{ 'mro-chevron-up': summaryExpanded }" /></button>
      </article>
    </div>
    <section v-for="section in presentation.sections" :key="section.id" class="mro-section">
      <h3>{{ section.title }}</h3>
      <p v-for="(paragraph, index) in section.paragraphs" :key="`${section.id}-${index}`" class="mro-paragraph">{{ paragraph }}</p>
    </section>
  </section>
</template>
