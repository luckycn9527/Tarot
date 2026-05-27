<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { getReaderById } from '../../data/readers'
import { questionCategories, type QuestionCategory, type SubCategory } from '../../data/questionCategories'
import { useAuth } from '../../composables/useAuth'
import { useDynamicSeoTitle } from '../../composables/useDynamicSeoTitle'
import ReaderAvatarMedia from '../../components/ui/ReaderAvatarMedia.vue'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const { user, isLoggedIn } = useAuth()

const readerId = route.params.readerId as string
const reader = computed(() => getReaderById(readerId))

const ready = ref(true)

watch(
  reader,
  (r) => {
    if (!r) void router.replace('/tarot')
  },
  { immediate: true },
)

useDynamicSeoTitle(computed(() => {
  const r = reader.value
  if (!r) return null
  return t('seo.dynamic.askQuestionTitle', { name: r.name })
}))

const needsVip = computed(() => {
  const r = reader.value
  if (!r || r.accessLevel === 'free') return false
  if (!isLoggedIn.value) return true
  return user.value?.membership !== 'vip'
})

const question = ref('')
const selectedCategory = ref<QuestionCategory | null>(null)
const selectedSub = ref<SubCategory | null>(null)

const questionValid = computed(() => question.value.length >= 5 && question.value.length <= 200)

function selectCategory(cat: QuestionCategory) {
  if (selectedCategory.value?.id === cat.id) {
    selectedCategory.value = null
    selectedSub.value = null
  } else {
    selectedCategory.value = cat
    selectedSub.value = null
  }
}

function selectSub(sub: SubCategory) {
  selectedSub.value = selectedSub.value === sub ? null : sub
}

function useSuggestion(text: string) {
  question.value = text
}

function goNext() {
  if (!questionValid.value || !reader.value) return
  router.push({
    name: 'reader-spread',
    params: { readerId },
    query: {
      q: question.value,
      cat: selectedCategory.value?.name || '综合',
    },
  })
}

</script>

<template>
  <div class="min-h-screen relative z-10 pt-20 pb-12 px-4">
    <div class="max-w-2xl mx-auto">

      <!-- VIP gate -->
      <div v-if="needsVip && ready" class="text-center py-20">
        <div class="text-6xl mb-4">{{ reader?.emoji }}</div>
        <h2 class="text-xl font-bold font-serif text-white mb-2">{{ reader?.name }} 是VIP专属塔罗师</h2>
        <p class="text-gray-400 mb-6">升级会员即可解锁全部塔罗师</p>
        <RouterLink to="/membership" class="inline-block px-8 py-3 rounded-full bg-gradient-to-r from-amber-600 to-yellow-500 text-white font-medium hover:shadow-lg transition-all">
          升级VIP
        </RouterLink>
        <div class="mt-4">
          <RouterLink to="/tarot" class="text-gray-400 text-sm hover:text-gold-300 transition-colors">← 返回选择塔罗师</RouterLink>
        </div>
      </div>

      <!-- Main content -->
      <template v-else-if="reader && ready">
        <!-- Reader info card -->
        <div class="flex items-center gap-4 mb-8 animate-fade-in-up">
          <ReaderAvatarMedia
            :reader="reader"
            wrapper-class="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0 overflow-hidden"
            emoji-class="text-3xl"
          />
          <div>
            <h1 class="text-xl font-bold font-serif text-white">向 {{ reader.name }} 提问</h1>
            <span class="text-xs px-2 py-0.5 rounded-full" :class="reader.accessLevel === 'free' ? 'bg-gold-500/20 text-gold-300' : 'bg-amber-500/20 text-amber-300'">
              {{ reader.badge }}
            </span>
          </div>
        </div>

        <!-- Question input -->
        <div class="mb-6 animate-fade-in-up anim-delay-1">
          <label class="text-gray-300 text-sm mb-2 block">描述你的问题</label>
          <textarea
            v-model="question"
            rows="4"
            maxlength="200"
            placeholder="请输入你想问的问题，比如：我和TA的关系未来会怎样？"
            class="w-full px-4 py-3 rounded-xl bg-white/4 border border-gold-500/10 text-white placeholder-gray-500 text-sm resize-none focus:border-gold-400/80 focus:outline-none transition-colors"
          />
          <div class="flex justify-between mt-1">
            <span :class="question.length < 5 ? 'text-gray-500' : 'text-green-400'" class="text-xs">
              {{ question.length < 5 ? `还需${5 - question.length}字` : '✓ 有效问题' }}
            </span>
            <span class="text-gray-500 text-xs">{{ question.length }}/200</span>
          </div>
        </div>

        <!-- Inspiration categories -->
        <div class="mb-6 animate-fade-in-up anim-delay-2">
          <p class="text-gray-400 text-sm mb-3">灵感分类 <span class="text-gray-600">（可选，帮助AI更精准解读）</span></p>
          <div class="flex flex-wrap gap-2 mb-3">
            <button
              v-for="cat in questionCategories"
              :key="cat.id"
              class="px-3 py-1.5 rounded-full text-xs border transition-all"
              :class="selectedCategory?.id === cat.id
                ? cat.color + ' border-current'
                : 'bg-white/4 text-gray-400 border-gold-500/10 hover:border-gold-500/20'"
              @click="selectCategory(cat)"
            >
              {{ cat.emoji }} {{ cat.name }}
            </button>
          </div>

          <!-- Sub-categories -->
          <div v-if="selectedCategory" class="space-y-3">
            <div class="flex flex-wrap gap-2">
              <button
                v-for="sub in selectedCategory.subCategories"
                :key="sub.name"
                class="px-3 py-1 rounded-lg text-xs transition-all"
                :class="selectedSub === sub
                  ? 'bg-gold-500/20 text-gold-300 border border-gold-500/30'
                  : 'bg-white/4 text-gray-400 hover:bg-white/10'"
                @click="selectSub(sub)"
              >
                {{ sub.name }}
              </button>
            </div>

            <!-- Suggestions -->
            <div v-if="selectedSub" class="space-y-2">
              <p class="text-gray-500 text-xs">点击填入问题框：</p>
              <button
                v-for="s in selectedSub.suggestions"
                :key="s"
                class="block w-full text-left px-3 py-2 rounded-lg bg-white/[0.03] border border-gold-500/10 text-gray-300 text-sm hover:border-gold-500/30 hover:bg-gold-500/5 transition-all"
                @click="useSuggestion(s)"
              >
                "{{ s }}"
              </button>
            </div>
          </div>
        </div>

        <!-- Submit button -->
        <div class="animate-fade-in-up anim-delay-3">
          <button
            :disabled="!questionValid"
            class="w-full py-3.5 rounded-xl text-white font-medium transition-all"
            :class="questionValid
              ? 'cta-button hover:shadow-lg hover:shadow-gold-500/20'
              : 'bg-gray-700 text-gray-400 cursor-not-allowed'"
            @click="goNext"
          >
            选择牌阵 →
          </button>
          <div class="text-center mt-4">
            <RouterLink to="/tarot" class="text-gray-500 text-sm hover:text-gold-300 transition-colors">← 返回选择塔罗师</RouterLink>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
