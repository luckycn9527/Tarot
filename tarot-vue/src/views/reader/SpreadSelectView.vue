<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { getReaderById } from '../../data/readers'
import { readerSpreads, type ReaderSpread } from '../../data/spreadsData'
import { useDynamicSeoTitle } from '../../composables/useDynamicSeoTitle'
import ReaderAvatarMedia from '../../components/ui/ReaderAvatarMedia.vue'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()

const readerId = route.params.readerId as string
const reader = computed(() => getReaderById(readerId))
const question = (route.query.q as string) || ''
const category = (route.query.cat as string) || '综合'

const ready = ref(false)

watch(
  [reader],
  () => {
    const r = reader.value
    if (!r || !question) {
      void router.replace('/tarot')
      return
    }
    ready.value = true
  },
  { immediate: true },
)

useDynamicSeoTitle(computed(() => {
  const r = reader.value
  if (!r) return null
  return t('seo.dynamic.spreadSelectTitle', { name: r.name })
}))

const selectedSpread = ref<ReaderSpread | null>(null)

const canProceed = computed(() => selectedSpread.value !== null)

function selectSpread(spread: ReaderSpread) {
  selectedSpread.value = selectedSpread.value?.id === spread.id ? null : spread
}

function goNext() {
  if (!selectedSpread.value || !reader.value) return
  router.push({
    name: 'reader-reading',
    params: { readerId },
    query: {
      q: question,
      cat: category,
      spread: selectedSpread.value.id,
    },
  })
}

</script>

<template>
  <div class="min-h-screen relative z-10 pt-20 pb-12 px-4">
    <div class="max-w-3xl mx-auto" v-if="ready && reader">

      <!-- Header -->
      <div class="mb-8 animate-fade-in-up">
        <div class="flex items-center gap-3 mb-4">
          <ReaderAvatarMedia
            :reader="reader"
            wrapper-class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden"
            emoji-class="text-xl"
          />
          <div>
            <h1 class="text-lg font-bold font-serif text-white">选择牌阵</h1>
            <p class="text-gray-500 text-xs">{{ reader.name }} · {{ category }}</p>
          </div>
        </div>
        <!-- Question echo -->
        <div class="px-4 py-3 rounded-xl bg-gold-500/10 border border-gold-500/20 text-sm text-gold-200">
          "{{ question }}"
        </div>
      </div>

      <!-- Spread grid -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <button
          v-for="spread in readerSpreads"
          :key="spread.id"
          class="text-left p-4 rounded-xl border transition-all"
          :class="selectedSpread?.id === spread.id
            ? 'bg-gold-500/10 border-gold-500/40 shadow-lg shadow-gold-500/10'
            : 'bg-white/[0.03] border-gold-500/10 hover:border-gold-500/20 hover:bg-white/4'"
          @click="selectSpread(spread)"
        >
          <div class="flex items-center gap-3 mb-2">
            <span class="text-2xl">{{ spread.emoji }}</span>
            <div>
              <h3 class="text-white font-medium font-serif text-sm">{{ spread.name }}</h3>
              <span class="text-gray-500 text-xs">{{ spread.cardCount }}张牌</span>
            </div>
            <div v-if="selectedSpread?.id === spread.id" class="ml-auto text-gold-400">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
          </div>
          <p class="text-gray-400 text-xs leading-relaxed">{{ spread.description }}</p>
          <div v-if="selectedSpread?.id === spread.id" class="mt-3 flex flex-wrap gap-1.5">
            <span
              v-for="(pos, i) in spread.positions"
              :key="i"
              class="px-2 py-0.5 rounded-full bg-gold-500/15 text-gold-300 text-xs"
            >
              {{ pos }}
            </span>
          </div>
        </button>
      </div>

      <!-- Submit -->
      <div class="animate-fade-in-up">
        <button
          :disabled="!canProceed"
          class="w-full py-3.5 rounded-xl text-white font-medium transition-all"
          :class="canProceed
            ? 'cta-button hover:shadow-lg hover:shadow-gold-500/20'
            : 'bg-gray-700 text-gray-400 cursor-not-allowed'"
          @click="goNext"
        >
          开始占卜 🔮
        </button>
        <div class="text-center mt-4">
          <button class="text-gray-500 text-sm hover:text-gold-300 transition-colors" @click="router.back()">
            ← 返回修改问题
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
