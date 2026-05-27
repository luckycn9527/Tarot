<script setup lang="ts">
import { ref } from 'vue'
import LoaderCircle from '@icons/loader-circle.vue'
import { useFormValidation, useCharCount } from '../composables/useFormValidation'
import { sanitizeInput } from '../utils/sanitize'

const props = withDefaults(defineProps<{
  title: string
  subtitle?: string
  placeholder?: string
  maxLength?: number
  examples?: { category: string; items: string[] }[]
  imageUrl?: string
  imageAlt?: string
}>(), {
  placeholder: '请输入您的问题...',
  maxLength: 200,
})

const emit = defineEmits<{
  submit: [question: string]
}>()

const question = ref('')
const isSubmitting = ref(false)
const { errorMsg, validate, clearError } = useFormValidation({ maxLength: props.maxLength })
const { charCount, isValid } = useCharCount(() => question.value, props.maxLength)

function handleSubmit() {
  if (!validate(question.value) || isSubmitting.value) return
  isSubmitting.value = true
  emit('submit', sanitizeInput(question.value))
  setTimeout(() => { isSubmitting.value = false }, 2000)
}

function useExample(text: string) {
  question.value = text
  clearError()
}
</script>

<template>
  <div class="card-glass p-6 sm:p-8">
    <!-- Optional header image -->
    <div v-if="imageUrl" class="mb-6 overflow-hidden rounded-2xl">
      <img :src="imageUrl" :alt="imageAlt || title" class="w-full h-48 sm:h-64 object-cover" loading="lazy" />
    </div>

    <form @submit.prevent="handleSubmit" class="space-y-4">
      <div>
        <label class="block text-gold-200 font-serif font-semibold mb-2">{{ title }}</label>
        <p v-if="subtitle" class="text-gray-500 text-sm mb-3">{{ subtitle }}</p>
        <textarea
          v-model="question"
          :placeholder="placeholder"
          :maxlength="maxLength"
          rows="3"
          class="w-full px-4 py-3 rounded-xl bg-white/4 border border-gold-500/10 text-gray-200 placeholder-gray-600 text-sm resize-none focus:outline-none focus:border-gold-400 focus:shadow-[0_0_0_3px_rgba(212,168,83,.08)] transition-all font-body"
        ></textarea>
        <div class="flex justify-between mt-1">
          <span v-if="errorMsg" class="text-red-400 text-xs">{{ errorMsg }}</span>
          <span v-else class="text-transparent text-xs">.</span>
          <span class="text-gray-600 text-xs">{{ charCount }}/{{ maxLength }}</span>
        </div>
      </div>

      <button
        type="submit"
        :disabled="!isValid || isSubmitting"
        class="w-full py-3 rounded-full bg-gradient-to-r from-gold-500 via-mystic to-gold-500 bg-[length:200%_100%] text-white font-semibold transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:bg-right hover:shadow-lg hover:shadow-gold-500/15"
      >
        <span v-if="isSubmitting" class="flex items-center justify-center gap-2">
          <LoaderCircle class="w-5 h-5 animate-spin" :size="20" />
          准备中...
        </span>
        <span v-else>立即抽取塔罗牌</span>
      </button>
    </form>
  </div>

  <!-- Example questions -->
  <div v-if="examples?.length" class="mt-8">
    <h3 class="text-lg font-serif text-gold-200 mb-4 text-center">需要灵感？试试这些问题</h3>
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div v-for="category in examples" :key="category.category" class="space-y-2">
        <p class="text-sm font-semibold text-gray-300">{{ category.category }}</p>
        <button
          v-for="exampleItem in category.items"
          :key="exampleItem"
          class="w-full text-left px-3 py-2 rounded-lg bg-white/3 border border-gold-500/8 text-gray-400 text-xs hover:border-gold-500/25 hover:text-gold-200 transition-all"
          @click="useExample(exampleItem)"
        >
          {{ exampleItem }}
        </button>
      </div>
    </div>
  </div>
</template>
