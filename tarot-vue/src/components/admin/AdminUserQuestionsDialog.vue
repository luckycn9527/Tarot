<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import adminApi from '@/services/adminApi'
import { formatAdminApiError } from '@/utils/adminApiError'
import { adminDateTime } from '@/utils/adminDateTime'
import type { AdminUserRow, AdminUserQuestion } from '@/types/adminUsers'

const props = defineProps<{ user: AdminUserRow }>()
const emit = defineEmits<{ close: [] }>()
const { t, locale } = useI18n()
const root = ref<HTMLElement | null>(null)
const items = ref<AdminUserQuestion[]>([])
const total = ref(0)
const page = ref(1)
const totalPages = ref(1)
const keyword = ref('')
const type = ref('')
const loading = ref(false)
const error = ref('')
const lastLoginAt = ref<string | null>(props.user.last_login_at)
const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
const focusReturn = document.activeElement instanceof HTMLElement ? document.activeElement : null
let sequence = 0
let controller: AbortController | null = null
const types = ['single', 'three-card', 'reader-reading', 'fate-dual']
const title = computed(() => t('pages.admin.userQuestionsTitle', { name: props.user.nickname || props.user.email }))
const when = (value: unknown) => adminDateTime(value, String(locale.value), t('pages.admin.noTimeRecord'))

async function loadQuestions(targetPage = 1) {
  const current = ++sequence
  controller?.abort()
  controller = new AbortController()
  loading.value = true
  error.value = ''
  try {
    const response = await adminApi.get(`/users/${props.user.id}/questions`, {
      params: { page: targetPage, pageSize: 15, keyword: keyword.value.trim() || undefined, type: type.value || undefined },
      signal: controller.signal,
    })
    if (current !== sequence) return
    const data = response.data.data
    items.value = data.items
    total.value = data.total
    page.value = data.page
    totalPages.value = Math.max(1, data.totalPages)
    lastLoginAt.value = data.user.lastLoginAt
  } catch (err) {
    if (current === sequence) error.value = formatAdminApiError(err, t('pages.admin.questionsLoadFailed'))
  } finally {
    if (current === sequence) loading.value = false
  }
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') { event.preventDefault(); emit('close'); return }
  if (event.key !== 'Tab' || !root.value) return
  const focusable = Array.from(root.value.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex="0"]'))
    .filter(element => element.getClientRects().length > 0)
  if (!focusable.length) return
  const first = focusable[0]!
  const last = focusable[focusable.length - 1]!
  if (!root.value.contains(document.activeElement)) {
    event.preventDefault(); (event.shiftKey ? last : first).focus(); return
  }
  if (event.shiftKey && (document.activeElement === first || document.activeElement === root.value)) {
    event.preventDefault(); last.focus()
  } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
}

watch(() => props.user.id, () => { items.value = []; void loadQuestions() }, { immediate: true })
onMounted(async () => { document.addEventListener('keydown', onKeydown); await nextTick(); root.value?.focus() })
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  sequence++
  controller?.abort()
  if (focusReturn?.isConnected) focusReturn.focus()
})
</script>

<template>
  <Teleport to="body">
    <div class="user-questions-overlay" @click.self="emit('close')">
      <section ref="root" role="dialog" aria-modal="true" aria-labelledby="admin-user-questions-title" tabindex="-1" class="user-questions-dialog">
        <header class="flex items-start justify-between gap-4 border-b border-white/10 p-5 sm:p-6">
          <div class="min-w-0">
            <h2 id="admin-user-questions-title" class="text-lg font-semibold text-gold-100 break-words">{{ title }}</h2>
            <p class="mt-1 break-all text-xs text-gray-400">#{{ user.id }} · {{ user.email }}</p>
            <p class="mt-2 text-xs text-gray-400">{{ t('pages.admin.thLastLogin') }}：{{ when(lastLoginAt) }}</p>
            <p class="mt-1 text-xs text-gray-500">{{ t('pages.admin.questionsTimeZone', { zone: timeZone }) }}</p>
          </div>
          <button type="button" class="rounded-lg border border-white/15 px-3 py-2 text-sm text-gray-300 hover:bg-white/10 shrink-0" @click="emit('close')">{{ t('pages.admin.close') }}</button>
        </header>
        <form class="flex flex-wrap gap-2 border-b border-white/10 p-4 sm:px-6" @submit.prevent="loadQuestions()">
          <input v-model="keyword" maxlength="200" :aria-label="t('pages.admin.questionsSearchPh')" :placeholder="t('pages.admin.questionsSearchPh')" class="question-control min-w-0 flex-1 basis-52" :disabled="loading">
          <select v-model="type" :aria-label="t('pages.admin.questionsType')" class="question-control" :disabled="loading">
            <option value="">{{ t('pages.admin.questionsTypeAll') }}</option>
            <option v-for="kind in types" :key="kind" :value="kind">{{ t('pages.admin.questionTypes.' + kind) }}</option>
          </select>
          <button type="submit" class="rounded-lg bg-gold-500 px-4 py-2 text-sm font-medium text-black disabled:opacity-50" :disabled="loading">{{ t('pages.admin.search') }}</button>
        </form>
        <div class="min-h-40 flex-1 overflow-auto p-4 sm:p-6" :aria-busy="loading">
          <p v-if="loading" role="status" class="py-8 text-center text-sm text-gray-400">{{ t('pages.admin.questionsLoading') }}</p>
          <div v-else-if="error" role="alert" class="py-8 text-center text-sm text-amber-300">
            <p>{{ error }}</p>
            <button type="button" class="mt-3 rounded-lg border border-white/15 px-4 py-2 text-gray-200" @click="loadQuestions(page)">{{ t('pages.admin.retry') }}</button>
          </div>
          <p v-else-if="!items.length" class="py-8 text-center text-sm text-gray-400">{{ t('pages.admin.questionsEmpty') }}</p>
          <ol v-else class="space-y-3">
            <li v-for="item in items" :key="item.source + ':' + item.id" class="rounded-xl border border-white/10 bg-white/[0.025] p-4">
              <div class="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-400">
                <span class="text-gold-300">{{ t('pages.admin.questionTypes.' + item.type) }}</span>
                <time>{{ when(item.askedAt) }}</time>
              </div>
              <p class="whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-100">{{ item.question }}</p>
              <details v-if="item.followups.length" class="mt-3 border-t border-white/10 pt-3">
                <summary class="cursor-pointer text-xs text-violet-200">{{ t('pages.admin.questionsFollowups', { n: item.followups.length }) }}</summary>
                <ol class="mt-3 space-y-3 border-l border-violet-400/20 pl-3">
                  <li v-for="(turn, index) in item.followups" :key="index">
                    <time v-if="turn.askedAt" class="text-xs text-gray-500">{{ when(turn.askedAt) }}</time>
                    <p class="whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-300">{{ turn.question }}</p>
                  </li>
                </ol>
              </details>
            </li>
          </ol>
        </div>
        <footer class="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-5 py-4 text-xs text-gray-400">
          <span>{{ t('pages.admin.questionsTotal', { n: total }) }}</span>
          <div class="flex items-center gap-2">
            <button type="button" class="rounded-lg border border-white/10 px-3 py-2 disabled:opacity-30" :disabled="loading || page <= 1" @click="loadQuestions(page - 1)">{{ t('pages.admin.prevPage') }}</button>
            <span>{{ page }} / {{ totalPages }}</span>
            <button type="button" class="rounded-lg border border-white/10 px-3 py-2 disabled:opacity-30" :disabled="loading || page >= totalPages" @click="loadQuestions(page + 1)">{{ t('pages.admin.nextPage') }}</button>
          </div>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.user-questions-overlay { position: fixed; inset: 0; z-index: 100; display: flex; align-items: center; justify-content: center; background: rgb(0 0 0 / .72); padding: 16px; }
.user-questions-dialog { width: min(850px, 100%); max-height: calc(100dvh - 32px); display: flex; flex-direction: column; overflow: hidden; border: 1px solid rgb(212 175 55 / .2); border-radius: 20px; background: #100d19; box-shadow: 0 24px 80px rgb(0 0 0 / .5); outline: none; }
.question-control { max-width: 100%; border: 1px solid rgb(255 255 255 / .12); border-radius: 9px; background: #1a1625; color: #e5e7eb; font-size: 13px; padding: 9px 12px; }
.user-questions-dialog :is(button,input,select,summary):focus-visible { outline: 2px solid #d4af37; outline-offset: 3px; }
@media (max-width: 480px) { .user-questions-overlay { padding: 8px; } .user-questions-dialog { max-height: calc(100dvh - 16px); border-radius: 14px; } }
</style>
