<script setup lang="ts">
import { ref } from 'vue'
import ChevronDown from '@icons/chevron-down.vue'

export interface FaqItemData {
  question: string
  answer: string
}

defineProps<{
  items: FaqItemData[]
}>()

const openIndex = ref<number | null>(null)

function toggle(index: number) {
  openIndex.value = openIndex.value === index ? null : index
}
</script>

<template>
  <div class="space-y-3">
    <div
      v-for="(item, index) in items"
      :key="index"
      class="faq-item rounded-2xl border border-gold-500/10 overflow-hidden"
      :class="{ open: openIndex === index }"
    >
      <button
        class="faq-toggle w-full flex items-center justify-between p-5 text-left hover:bg-white/4 transition-colors"
        @click="toggle(index)"
      >
        <h3 class="text-base font-semibold text-white pr-4">{{ item.question }}</h3>
        <ChevronDown class="faq-arrow w-5 h-5 text-gray-400 flex-shrink-0 transition-transform duration-300" :size="20" />
      </button>
      <div class="faq-content">
        <div class="px-5 pb-5">
          <p class="text-gray-400 text-sm leading-relaxed">{{ item.answer }}</p>
        </div>
      </div>
    </div>
  </div>
</template>
