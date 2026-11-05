<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { ConfigDifference } from '@/types/configHistory'
defineProps<{ changes: ConfigDifference[] }>()
const { t } = useI18n()
function text(value: string | number | boolean | null) {
  if (value === null) return t('pages.admin.configHistory.unset')
  if (typeof value === 'boolean') return t(`pages.admin.configHistory.${value ? 'enabled' : 'disabled'}`)
  return String(value)
}
</script>

<template>
  <p v-if="!changes.length" class="py-5 text-sm text-gray-400">{{ t('pages.admin.configHistory.noDifferences') }}</p>
  <div v-else class="space-y-4">
    <article v-for="change in changes" :key="change.key" class="min-w-0 overflow-hidden rounded-xl border border-white/10">
      <header class="flex flex-wrap items-center justify-between gap-2 bg-white/[0.03] px-4 py-3 text-sm">
        <span class="break-words text-gold-100">{{ change.label }} <span class="text-xs text-gray-500">#{{ change.key }}</span></span>
        <span class="text-xs text-violet-200">{{ t('pages.admin.configHistory.operations.' + change.operation) }}</span>
      </header>
      <div v-for="field in change.fields" :key="field.field" class="min-w-0 border-t border-white/10 p-3">
        <p class="mb-2 text-xs font-medium text-gray-300">{{ t('pages.admin.configHistory.fields.' + field.field) }}</p>
        <div class="grid min-w-0 gap-2 sm:grid-cols-2">
          <div v-for="side in (['before', 'after'] as const)" :key="side" class="min-w-0 rounded-lg p-3" :class="side === 'before' ? 'bg-rose-500/[0.05]' : 'bg-emerald-500/[0.05]'">
            <p class="mb-1 text-[11px] text-gray-500">{{ t('pages.admin.configHistory.' + side) }}</p>
            <details v-if="text(field[side]).length > 400">
              <summary class="cursor-pointer text-xs text-gold-200">{{ t('pages.admin.configHistory.expandText', { n: text(field[side]).length }) }}</summary>
              <pre class="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs leading-relaxed text-gray-300">{{ text(field[side]) }}</pre>
            </details>
            <pre v-else class="whitespace-pre-wrap break-words text-xs leading-relaxed text-gray-300">{{ text(field[side]) }}</pre>
          </div>
        </div>
      </div>
    </article>
  </div>
</template>
