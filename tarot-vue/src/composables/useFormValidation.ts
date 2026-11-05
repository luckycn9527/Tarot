import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'

export interface ValidationOptions {
  minLength?: number
  maxLength?: number
  rejectEmoji?: boolean
}

const EMOJI_REGEX = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u

export function useFormValidation(options: ValidationOptions = {}) {
  const { minLength = 5, maxLength = 200, rejectEmoji = true } = options
  const { t } = useI18n()

  const errorMsg = ref('')

  function validate(text: string): boolean {
    const trimmed = text.trim()
    if (trimmed.length < minLength) {
      errorMsg.value = t('pages.questionForm.validation.minLength', { count: minLength })
      return false
    }
    if (trimmed.length > maxLength) {
      errorMsg.value = t('pages.questionForm.validation.maxLength', { count: maxLength })
      return false
    }
    if (rejectEmoji && EMOJI_REGEX.test(trimmed)) {
      errorMsg.value = t('pages.questionForm.validation.emoji')
      return false
    }
    errorMsg.value = ''
    return true
  }

  function clearError() {
    errorMsg.value = ''
  }

  return { errorMsg, validate, clearError }
}

export function useCharCount(text: () => string, maxLength: number = 200) {
  const charCount = computed(() => text().length)
  const isValid = computed(() => {
    const trimmed = text().trim()
    return trimmed.length >= 5 && trimmed.length <= maxLength
  })
  return { charCount, isValid }
}
