<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import api from '@/services/api'
import { useAuth } from '@/composables/useAuth'
import { useToast } from '@/composables/useToast'

const route = useRoute()
const router = useRouter()
const { t, locale } = useI18n()
const toast = useToast()
const { isLoggedIn, isInitialized } = useAuth()

interface Row {
  conflictId: number
  summary: string
  conflictType: string
  analyzedAt: string
  baziKeywords: string
  cards: string[]
  choiceType: string | null
  resultPreview: string | null
  chosenAt: string | null
}

const list = ref<Row[]>([])
const loading = ref(true)
const expandedId = ref<number | null>(null)

watch(
  [isInitialized, isLoggedIn],
  async ([init, logged]) => {
    if (!init) return
    if (!logged) {
      void router.replace({ path: '/login', query: { redirect: route.fullPath } })
      return
    }
    loading.value = true
    expandedId.value = null
    try {
      const res = await api.get('/fate/history', { params: { limit: 30 } })
      if (res.data.success) list.value = res.data.data as Row[]
      else toast.error(res.data.message || t('pages.fateDualHistory.loadFail'))
    } catch {
      toast.error(t('pages.fateDualHistory.loadFail'))
    } finally {
      loading.value = false
      await nextTick()
    }
  },
  { immediate: true },
)

function choiceLabel(choice: string | null) {
  if (!choice) return t('pages.fateDualHistory.choiceUnset')
  if (choice === 'stable') return t('pages.fateDualHistory.choiceStable')
  if (choice === 'adventure') return t('pages.fateDualHistory.choiceAdventure')
  return choice
}

function isConflictAlign(conflictType: string) {
  return /一致|align|agree|harmon/i.test(conflictType)
}

function choiceTone(t: string | null): 'pending' | 'stable' | 'adventure' {
  if (t === 'stable') return 'stable'
  if (t === 'adventure') return 'adventure'
  return 'pending'
}

function formatWhen(iso: string) {
  try {
    const d = new Date(iso)
    return d.toLocaleString(String(locale.value), {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function toggleExpand(id: number) {
  expandedId.value = expandedId.value === id ? null : id
}

function splitKeywords(raw: string) {
  if (!raw) return []
  return raw.split(/[、,，]/).map((s) => s.trim()).filter(Boolean)
}
</script>

<template>
  <div class="fate-history-page">
    <!-- 氛围底 -->
    <div class="fate-history-bg" aria-hidden="true">
      <div class="fate-orb fate-orb-gold" />
      <div class="fate-orb fate-orb-violet" />
      <div class="fate-grid" />
    </div>

    <div class="relative z-10 max-w-3xl mx-auto">
      <!-- 页头 -->
      <header class="text-center mb-12 animate-fade-in-up">
        <p class="text-gold-500/55 text-[0.65rem] tracking-[0.38em] uppercase mb-2 font-medium">
          {{ t('pages.fateDualHistory.heroEyebrow') }}
        </p>
        <h1 class="text-3xl sm:text-4xl font-serif font-bold text-gold-100 mb-2 text-balance">
          {{ t('pages.fateDualHistory.title') }}
        </h1>
        <p class="text-gray-500 text-sm max-w-md mx-auto leading-relaxed">
          {{ t('pages.fateDualHistory.subtitle') }}
        </p>
        <div class="fate-header-divider">
          <span class="fate-div-star">✦</span>
          <span class="fate-div-line" />
          <span class="fate-div-glyph">☯</span>
          <span class="fate-div-line" />
          <span class="fate-div-star">✦</span>
        </div>
        <RouterLink
          to="/fate-dual"
          class="cta-button group relative inline-flex items-center gap-2 px-8 py-3 rounded-full text-white text-sm font-medium mt-6 overflow-hidden"
        >
          <span class="relative z-10">{{ t('pages.fateDualHistory.ctaNew') }}</span>
          <span class="relative z-10 opacity-70 group-hover:translate-x-0.5 transition-transform">→</span>
          <span class="cta-shimmer pointer-events-none" aria-hidden="true" />
        </RouterLink>
      </header>

      <!-- 加载 -->
      <div v-if="loading" class="flex flex-col items-center justify-center py-24 gap-6">
        <div class="fate-loader" aria-hidden="true">
          <span class="fate-loader-ring" />
          <span class="fate-loader-core">☯</span>
        </div>
        <p class="text-gold-200/70 text-sm font-serif tracking-widest animate-pulse">{{ t('pages.fateDualHistory.loading') }}</p>
      </div>

      <!-- 空态 -->
      <div
        v-else-if="list.length === 0"
        class="fate-empty card-glass rounded-3xl p-10 sm:p-14 text-center max-w-lg mx-auto animate-fade-in-up anim-delay-1"
      >
        <div class="text-4xl mb-4 opacity-60 fate-empty-icon">✧</div>
        <p class="text-gold-200/90 font-serif text-lg mb-2">{{ t('pages.fateDualHistory.emptyTitle') }}</p>
        <p class="text-gray-500 text-sm mb-8 leading-relaxed">
          {{ t('pages.fateDualHistory.emptyBody') }}
        </p>
        <RouterLink
          to="/fate-dual"
          class="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-gold-500/35 text-gold-300 text-sm hover:bg-gold-500/10 hover:border-gold-500/50 transition-all duration-300"
        >
          {{ t('pages.fateDualHistory.emptyCta') }}
        </RouterLink>
      </div>

      <!-- 列表 -->
      <ul v-else class="space-y-5 pb-8">
        <li
          v-for="(row, index) in list"
          :key="row.conflictId"
          v-motion
          :initial="{ opacity: 0, y: 36 }"
          :enter="{
            opacity: 1,
            y: 0,
            transition: {
              type: 'spring',
              stiffness: 220,
              damping: 26,
              delay: index * 0.06,
            },
          }"
        >
          <article
            class="fate-scroll-card group relative rounded-2xl overflow-hidden cursor-pointer select-none"
            :class="{ 'fate-scroll-card--open': expandedId === row.conflictId }"
            role="button"
            tabindex="0"
            @click="toggleExpand(row.conflictId)"
            @keydown.enter.prevent="toggleExpand(row.conflictId)"
            @keydown.space.prevent="toggleExpand(row.conflictId)"
          >
            <div class="fate-scroll-accent" aria-hidden="true" />
            <div class="fate-scroll-inner p-5 sm:p-6">
              <div class="flex flex-wrap items-start justify-between gap-3 mb-3">
                <p class="text-gold-100/95 font-serif text-base sm:text-lg leading-snug pr-2 flex-1 min-w-[200px]">
                  {{ row.summary }}
                </p>
                <span
                  class="shrink-0 text-[0.65rem] uppercase tracking-wider px-2.5 py-1 rounded-md border fate-type-pill"
                  :data-type="isConflictAlign(row.conflictType) ? 'align' : 'clash'"
                >
                  {{ row.conflictType }}
                </span>
              </div>

              <p class="text-gray-600 text-xs mb-4 flex items-center gap-2">
                <span class="text-gold-500/40">⏱</span>
                {{ formatWhen(row.analyzedAt) }}
              </p>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                <div class="fate-mini-panel fate-mini-east">
                  <span class="fate-mini-tag">{{ t('pages.fateDualHistory.tagEast') }}</span>
                  <div class="flex flex-wrap gap-1.5 mt-2">
                    <span
                      v-for="(kw, ki) in splitKeywords(row.baziKeywords)"
                      :key="ki"
                      class="text-[0.7rem] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-200/85 border border-amber-500/15"
                    >{{ kw }}</span>
                    <span v-if="!splitKeywords(row.baziKeywords).length" class="text-xs text-gray-600">—</span>
                  </div>
                </div>
                <div class="fate-mini-panel fate-mini-west">
                  <span class="fate-mini-tag">{{ t('pages.fateDualHistory.tagWest') }}</span>
                  <p class="text-xs text-violet-200/80 mt-2 leading-relaxed">
                    {{ row.cards.join(' · ') }}
                  </p>
                </div>
              </div>

              <div class="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-white/[0.06]">
                <span
                  class="fate-choice-badge"
                  :data-choice="choiceTone(row.choiceType)"
                >
                  <span class="fate-choice-dot" aria-hidden="true" />
                  {{ choiceLabel(row.choiceType) }}
                  <template v-if="row.chosenAt">
                    <span class="text-gray-600 font-normal mx-1">·</span>
                    <span class="text-gray-500 font-normal">{{ formatWhen(row.chosenAt) }}</span>
                  </template>
                </span>
                <span class="text-gold-500/50 text-xs flex items-center gap-1 group-hover:text-gold-400/70 transition-colors">
                  {{ expandedId === row.conflictId ? t('pages.fateDualHistory.collapse') : t('pages.fateDualHistory.expand') }}
                  <svg
                    class="w-3.5 h-3.5 transition-transform duration-300"
                    :class="expandedId === row.conflictId ? 'rotate-180' : ''"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </span>
              </div>

              <Transition name="fate-expand">
                <div
                  v-if="expandedId === row.conflictId && row.resultPreview"
                  class="mt-4 pt-4 border-t border-gold-500/10"
                >
                  <p class="text-[0.65rem] text-gold-500/50 tracking-widest mb-2">{{ t('pages.fateDualHistory.echoTitle') }}</p>
                  <p class="text-gray-400 text-sm leading-relaxed whitespace-pre-wrap font-serif">
                    {{ row.resultPreview }}{{ row.resultPreview.length >= 160 ? '…' : '' }}
                  </p>
                  <p v-if="row.resultPreview.length >= 160" class="text-gray-600 text-xs mt-2">
                    {{ t('pages.fateDualHistory.previewNote') }}
                  </p>
                </div>
              </Transition>
            </div>
          </article>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.fate-history-page {
  min-height: 100vh;
  min-height: 100dvh;
  overflow-x: hidden;
  overflow-y: auto;
  padding-top: calc(5rem + env(safe-area-inset-top, 0px));
  padding-bottom: max(5rem, env(safe-area-inset-bottom, 0px));
  padding-left: max(1rem, env(safe-area-inset-left, 0px));
  padding-right: max(1rem, env(safe-area-inset-right, 0px));
  background: linear-gradient(180deg, var(--color-void, #0a0514) 0%, #070510 45%, var(--color-abyss, #030108) 100%);
}

.fate-history-bg {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
}

.fate-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.35;
  animation: fateOrbDrift 18s ease-in-out infinite;
}

.fate-orb-gold {
  width: min(55vw, 420px);
  height: min(55vw, 420px);
  background: radial-gradient(circle, rgba(212, 168, 83, 0.35) 0%, transparent 70%);
  top: -8%;
  right: -15%;
}

.fate-orb-violet {
  width: min(50vw, 380px);
  height: min(50vw, 380px);
  background: radial-gradient(circle, rgba(124, 58, 237, 0.22) 0%, transparent 70%);
  bottom: 5%;
  left: -20%;
  animation-delay: -7s;
}

@keyframes fateOrbDrift {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(-20px, 25px) scale(1.05); }
}

.fate-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(212, 168, 83, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(212, 168, 83, 0.03) 1px, transparent 1px);
  background-size: 48px 48px;
  mask-image: radial-gradient(ellipse 70% 60% at 50% 40%, black 10%, transparent 75%);
  opacity: 0.5;
}

.fate-header-divider {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.65rem;
  margin-top: 1.25rem;
}

.fate-div-line {
  width: 3rem;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(212, 168, 83, 0.35), transparent);
}

.fate-div-star {
  color: rgba(212, 168, 83, 0.4);
  font-size: 0.55rem;
}

.fate-div-glyph {
  color: rgba(212, 168, 83, 0.45);
  font-size: 0.95rem;
}

.fate-loader {
  position: relative;
  width: 72px;
  height: 72px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.fate-loader-ring {
  position: absolute;
  inset: 0;
  border: 2px solid transparent;
  border-top-color: rgba(212, 168, 83, 0.55);
  border-right-color: rgba(124, 58, 237, 0.35);
  border-radius: 50%;
  animation: rotateGlow 1.2s linear infinite;
}

.fate-loader-core {
  font-size: 1.25rem;
  color: rgba(212, 168, 83, 0.5);
  animation: breathe 2s ease-in-out infinite;
}

.fate-empty-icon {
  animation: float 5s ease-in-out infinite;
}

.fate-scroll-card {
  background: linear-gradient(
    145deg,
    rgba(22, 14, 36, 0.92) 0%,
    rgba(8, 5, 16, 0.96) 100%
  );
  border: 1px solid rgba(212, 168, 83, 0.12);
  box-shadow:
    0 4px 24px rgba(0, 0, 0, 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
  transition:
    transform 0.45s cubic-bezier(0.22, 1, 0.36, 1),
    border-color 0.35s ease,
    box-shadow 0.45s ease;
}

.fate-scroll-card:hover {
  transform: translateY(-4px);
  border-color: rgba(212, 168, 83, 0.28);
  box-shadow:
    0 12px 40px rgba(0, 0, 0, 0.45),
    0 0 0 1px rgba(124, 58, 237, 0.08),
    0 0 48px -12px rgba(212, 168, 83, 0.12);
}

.fate-scroll-card:focus-visible {
  outline: none;
  border-color: rgba(212, 168, 83, 0.45);
  box-shadow: 0 0 0 2px rgba(212, 168, 83, 0.15);
}

.fate-scroll-card--open {
  border-color: rgba(212, 168, 83, 0.25);
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.4),
    inset 0 0 60px rgba(124, 58, 237, 0.04);
}

.fate-scroll-accent {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  background: linear-gradient(
    180deg,
    rgba(212, 168, 83, 0.65) 0%,
    rgba(124, 58, 237, 0.35) 50%,
    rgba(212, 168, 83, 0.25) 100%
  );
  opacity: 0.85;
  transition: width 0.35s ease;
}

.fate-scroll-card:hover .fate-scroll-accent {
  width: 5px;
}

.fate-scroll-inner {
  margin-left: 4px;
}

.fate-type-pill[data-type='align'] {
  border-color: rgba(34, 211, 238, 0.25);
  color: rgba(165, 243, 252, 0.85);
  background: rgba(34, 211, 238, 0.06);
}

.fate-type-pill[data-type='clash'] {
  border-color: rgba(212, 168, 83, 0.3);
  color: rgba(245, 217, 140, 0.9);
  background: rgba(212, 168, 83, 0.06);
}

.fate-mini-panel {
  border-radius: 0.75rem;
  padding: 0.65rem 0.85rem;
  border: 1px solid rgba(255, 255, 255, 0.06);
  transition: border-color 0.3s ease, background 0.3s ease;
}

.fate-mini-east {
  background: rgba(180, 130, 60, 0.05);
}

.fate-mini-west {
  background: rgba(124, 58, 237, 0.06);
}

.group:hover .fate-mini-east {
  border-color: rgba(212, 168, 83, 0.12);
}

.group:hover .fate-mini-west {
  border-color: rgba(167, 139, 250, 0.15);
}

.fate-mini-tag {
  font-size: 0.6rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(163, 163, 180, 0.85);
}

.fate-choice-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.75rem;
  font-weight: 500;
  letter-spacing: 0.04em;
}

.fate-choice-badge[data-choice='stable'] {
  color: rgba(203, 213, 225, 0.95);
}

.fate-choice-badge[data-choice='adventure'] {
  color: rgba(232, 121, 249, 0.9);
}

.fate-choice-badge[data-choice='pending'] {
  color: rgba(148, 163, 184, 0.85);
}

.fate-choice-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  opacity: 0.7;
  box-shadow: 0 0 10px currentColor;
  animation: twinkle 2.5s ease-in-out infinite;
}

/* 展开过渡 */
.fate-expand-enter-active,
.fate-expand-leave-active {
  transition: opacity 0.35s ease, transform 0.35s cubic-bezier(0.22, 1, 0.36, 1);
}

.fate-expand-enter-from,
.fate-expand-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

@media (prefers-reduced-motion: reduce) {
  .fate-orb,
  .fate-loader-ring,
  .fate-loader-core,
  .fate-empty-icon,
  .fate-choice-dot {
    animation: none !important;
  }
  .fate-scroll-card:hover {
    transform: none;
  }
}
</style>
