<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuth } from '../composables/useAuth'
import { useCemetery, type DivinationResult } from '../composables/useCemetery'
import { tarotCards, getCardImageUrl } from '../data/tarotCards'
import {
  tombBases,
  tombBodies,
  tombTops,
  tombstoneColors,
  generateTombSvg,
  getStyleDisplayName,
} from '../data/tombstoneStyles'
import IsometricMap from '../components/cemetery/IsometricMap.vue'
import CoinToss from '../components/CoinToss.vue'
import type { CemeteryRegion } from '../components/cemetery/IsometricMap.vue'

const route = useRoute()
const router = useRouter()
const { t, tm } = useI18n()
const { user, isLoggedIn, isInitialized } = useAuth()
const {
  markers,
  myTombstone,
  fetchMarkers,
  fetchMyTombstone,
  performDivination,
  createTombstone,
  checkPosition,
} = useCemetery()

// ===== 8 阶段状态机 =====
type Phase = 'check' | 'intro' | 'tarot-draw' | 'iching-cast' | 'divination-result' | 'map-select' | 'tombstone-config' | 'success'
const phase = ref<Phase>('check')
const loading = ref(false)
const errorMsg = ref('')

// Tarot 阶段状态
const tarotCardId = ref<number | null>(null)
const tarotCardRevealed = ref(false)

// I-Ching 阶段状态
const lines = ref<number[]>([])
const allLinesCast = computed(() => lines.value.length === 6)

// 占卜结果
const divinationResult = ref<DivinationResult | null>(null)

// 选位阶段
const selectedPos = ref<{ lng: number; lat: number } | null>(null)
const posAvailable = ref(false)
const mapRef = ref<InstanceType<typeof IsometricMap> | null>(null)

// 配置阶段 — 4 维 DIY
const selectedBase = ref('standard')
const selectedBody = ref('slab')
const selectedTop = ref('none')
const selectedColor = ref('purple')
const displayName = ref('')
const epitaph = ref('')

const currentStyleStr = computed(() =>
  `${selectedBase.value}-${selectedBody.value}-${selectedTop.value}-${selectedColor.value}`
)

const lineNames = computed(() => tm('pages.cemeteryCreate.lineNames') as string[])

// 成功
const createdTombstone = ref<any>(null)

// ===== 初始化 =====
async function bootstrapCemeteryCreate() {
  loading.value = true
  await fetchMyTombstone()
  if (myTombstone.value) {
    createdTombstone.value = myTombstone.value
    phase.value = 'success'
  } else {
    phase.value = 'intro'
  }
  loading.value = false
}

watch(
  [isInitialized, isLoggedIn],
  ([init, logged]) => {
    if (!init) return
    if (!logged) {
      void router.replace({ path: '/login', query: { redirect: route.fullPath } })
      return
    }
    void bootstrapCemeteryCreate()
  },
  { immediate: true },
)

// ===== Tarot 抽牌 =====
function drawTarotCard() {
  const idx = Math.floor(Math.random() * 78)
  tarotCardId.value = idx
  tarotCardRevealed.value = false

  setTimeout(() => {
    tarotCardRevealed.value = true
  }, 300)
}

function confirmTarot() {
  phase.value = 'iching-cast'
}

// ===== I-Ching 投卦 =====
function onCoinResult(value: number) {
  lines.value.push(value)
}

async function confirmHexagram() {
  if (!allLinesCast.value || tarotCardId.value === null) return
  loading.value = true
  errorMsg.value = ''

  const result = await performDivination(tarotCardId.value, lines.value)
  if (result) {
    divinationResult.value = result
    phase.value = 'divination-result'
  } else {
    errorMsg.value = t('pages.cemeteryCreate.errDivination')
  }
  loading.value = false
}

// ===== 选位 =====
async function enterMapSelect() {
  await fetchMarkers()
  phase.value = 'map-select'
  await nextTick()
  if (mapRef.value && divinationResult.value) {
    const r = divinationResult.value.region
    const centerLng = (r.minLng + r.maxLng) / 2
    const centerLat = (r.minLat + r.maxLat) / 2
    mapRef.value.centerOn(centerLng, centerLat, 6)
  }
}

async function onMapSelect(pos: { lng: number; lat: number }) {
  selectedPos.value = pos
  posAvailable.value = await checkPosition(pos.lng, pos.lat)
}

function confirmPosition() {
  if (!posAvailable.value || !selectedPos.value) return
  displayName.value = user.value?.nickname || ''
  phase.value = 'tombstone-config'
}

// ===== 创建墓碑 =====
async function submitTombstone() {
  if (!selectedPos.value || !displayName.value.trim()) return
  loading.value = true
  errorMsg.value = ''

  try {
    const result = await createTombstone({
      longitude: selectedPos.value.lng,
      latitude: selectedPos.value.lat,
      tombstoneStyle: currentStyleStr.value,
      displayName: displayName.value.trim(),
      epitaph: epitaph.value.trim() || null,
      tarotCardId: tarotCardId.value,
      hexagramId: divinationResult.value?.hexagram.id ?? null,
    })
    createdTombstone.value = result
    phase.value = 'success'
  } catch (err: any) {
    errorMsg.value = err.message || t('pages.cemeteryCreate.errCreate')
  } finally {
    loading.value = false
  }
}

function goToMap() {
  router.push('/cemetery')
}

const recommendedRegion = computed<CemeteryRegion | null>(() => {
  if (!divinationResult.value) return null
  return divinationResult.value.region
})

const hexagram = computed(() => {
  if (!divinationResult.value) return null
  return divinationResult.value.hexagram
})

// ===== 选择器预览 SVG =====
function previewSvg(overrides: { base?: string; body?: string; top?: string; color?: string }, w = 24, h = 36): string {
  const style = `${overrides.base ?? selectedBase.value}-${overrides.body ?? selectedBody.value}-${overrides.top ?? selectedTop.value}-${overrides.color ?? selectedColor.value}`
  return generateTombSvg(style, w, h)
}
</script>

<template>
  <div class="relative z-10 min-h-screen pt-16 pb-12">

    <!-- 窄容器：非地图阶段 -->
    <div v-if="phase !== 'map-select'" class="max-w-2xl mx-auto px-4 sm:px-8">

      <!-- Loading -->
      <div v-if="loading && phase === 'check'" class="flex items-center justify-center py-32">
        <div class="text-gray-400 animate-pulse">{{ t('pages.cemeteryCreate.checking') }}</div>
      </div>

      <!-- ===== INTRO 阶段 ===== -->
      <div v-else-if="phase === 'intro'" class="pt-12 text-center">
        <div class="text-6xl mb-6">🪦</div>
        <h1 class="text-3xl font-bold text-white mb-4">{{ t('pages.cemeteryCreate.title') }}</h1>
        <p class="text-gray-400 leading-relaxed mb-8 max-w-md mx-auto">
          {{ t('pages.cemeteryCreate.intro1') }}<br />
          {{ t('pages.cemeteryCreate.intro2') }}
        </p>
        <div class="space-y-3 text-sm text-gray-500 mb-10">
          <div class="flex items-center justify-center gap-2">
            <span class="w-6 h-6 rounded-full bg-purple-900/50 text-purple-400 flex items-center justify-center text-xs">1</span>
            {{ t('pages.cemeteryCreate.stepTarot') }}
          </div>
          <div class="flex items-center justify-center gap-2">
            <span class="w-6 h-6 rounded-full bg-purple-900/50 text-purple-400 flex items-center justify-center text-xs">2</span>
            {{ t('pages.cemeteryCreate.stepIching') }}
          </div>
          <div class="flex items-center justify-center gap-2">
            <span class="w-6 h-6 rounded-full bg-purple-900/50 text-purple-400 flex items-center justify-center text-xs">3</span>
            {{ t('pages.cemeteryCreate.stepMap') }}
          </div>
          <div class="flex items-center justify-center gap-2">
            <span class="w-6 h-6 rounded-full bg-purple-900/50 text-purple-400 flex items-center justify-center text-xs">4</span>
            {{ t('pages.cemeteryCreate.stepDesign') }}
          </div>
        </div>
        <button
          class="px-8 py-3 rounded-full bg-purple-600 hover:bg-purple-700 text-white font-medium transition-all hover:shadow-lg hover:shadow-purple-500/25"
          @click="phase = 'tarot-draw'"
        >
          {{ t('pages.cemeteryCreate.start') }}
        </button>
      </div>

      <!-- ===== TAROT DRAW 阶段 ===== -->
      <div v-else-if="phase === 'tarot-draw'" class="pt-8 text-center">
        <h2 class="text-xl font-bold text-white mb-2">{{ t('pages.cemeteryCreate.tarotTitle') }}</h2>
        <p class="text-gray-400 text-sm mb-8">{{ t('pages.cemeteryCreate.tarotSub') }}</p>

        <div v-if="tarotCardId === null" class="py-12">
          <button
            class="relative w-32 h-48 rounded-xl border-2 border-purple-500/50 bg-purple-900/20 hover:border-purple-400 hover:bg-purple-800/20 transition-all cursor-pointer group mx-auto block"
            @click="drawTarotCard"
          >
            <div class="absolute inset-0 flex items-center justify-center">
              <span class="text-purple-300 text-4xl group-hover:scale-110 transition-transform">?</span>
            </div>
            <div class="absolute bottom-2 left-0 right-0 text-center text-xs text-purple-400">{{ t('pages.cemeteryCreate.tapDraw') }}</div>
          </button>
        </div>

        <div v-else class="py-8">
          <div class="flex justify-center mb-6">
            <div
              class="relative w-40 h-60 rounded-xl overflow-hidden border-2 transition-all duration-500"
              :class="tarotCardRevealed ? 'border-yellow-400/50' : 'border-purple-500/50'"
            >
              <div
                class="w-full h-full transition-transform duration-500"
                :style="{ transform: tarotCardRevealed ? 'rotateY(0deg)' : 'rotateY(180deg)' }"
              >
                <img
                  v-if="tarotCardRevealed"
                  :src="getCardImageUrl(tarotCards[tarotCardId!]?.nameEn || '')"
                  :alt="tarotCards[tarotCardId]?.name || ''"
                  class="w-full h-full object-cover"
                />
                <div v-else class="w-full h-full bg-purple-900/50 flex items-center justify-center">
                  <span class="text-4xl">🃏</span>
                </div>
              </div>
            </div>
          </div>

          <div v-if="tarotCardRevealed">
            <h3 class="text-lg text-white font-medium mb-1">{{ tarotCards[tarotCardId]?.name }}</h3>
            <p class="text-sm text-gray-400 mb-6">{{ t('pages.cemeteryCreate.tarotLead') }}</p>
            <button
              class="px-6 py-2.5 rounded-full bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium transition-all"
              @click="confirmTarot"
            >
              {{ t('pages.cemeteryCreate.nextIching') }}
            </button>
          </div>
        </div>
      </div>

      <!-- ===== I-CHING CAST 阶段 ===== -->
      <div v-else-if="phase === 'iching-cast'" class="pt-8 text-center">
        <h2 class="text-xl font-bold text-white mb-2">{{ t('pages.cemeteryCreate.ichingTitle') }}</h2>
        <p class="text-gray-400 text-sm mb-8">{{ t('pages.cemeteryCreate.ichingSub') }}</p>

        <div class="flex justify-center gap-4 flex-wrap mb-8">
          <CoinToss
            v-for="i in 6"
            :key="i"
            :line-index="i - 1"
            @result="onCoinResult"
          />
        </div>

        <div v-if="lines.length > 0" class="mb-8">
          <div class="inline-flex flex-col-reverse gap-1.5 p-4 bg-white/5 rounded-xl">
            <div v-for="(line, idx) in lines" :key="idx" class="flex items-center gap-2">
              <span class="text-xs text-gray-500 w-8">{{ lineNames[idx] }}</span>
              <template v-if="line === 1">
                <div class="w-16 h-2 bg-yellow-400 rounded-full" />
              </template>
              <template v-else>
                <div class="w-6 h-2 bg-blue-400 rounded-full" />
                <div class="w-2" />
                <div class="w-6 h-2 bg-blue-400 rounded-full" />
              </template>
            </div>
          </div>
        </div>

        <div v-if="errorMsg" class="text-red-400 text-sm mb-4">{{ errorMsg }}</div>

        <button
          v-if="allLinesCast"
          class="px-6 py-2.5 rounded-full bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium transition-all disabled:opacity-50"
          :disabled="loading"
          @click="confirmHexagram"
        >
          {{ loading ? t('pages.cemeteryCreate.confirmHexBusy') : t('pages.cemeteryCreate.confirmHex') }}
        </button>
      </div>

      <!-- ===== DIVINATION RESULT 阶段 ===== -->
      <div v-else-if="phase === 'divination-result'" class="pt-8 text-center">
        <h2 class="text-xl font-bold text-white mb-6">{{ t('pages.cemeteryCreate.resultTitle') }}</h2>

        <div v-if="hexagram" class="bg-white/5 rounded-2xl p-6 mb-8">
          <div class="text-5xl mb-3">{{ hexagram.symbol }}</div>
          <h3 class="text-2xl text-white font-bold mb-2">{{ t('pages.cemeteryCreate.hexagramNamed', { name: hexagram.name }) }}</h3>
          <p class="text-gray-400">{{ hexagram.meaning }}</p>

          <div class="inline-flex flex-col-reverse gap-1.5 mt-4">
            <div v-for="(line, idx) in hexagram.lines" :key="idx" class="flex items-center gap-2">
              <template v-if="line === 1">
                <div class="w-16 h-2 bg-yellow-400 rounded-full" />
              </template>
              <template v-else>
                <div class="w-6 h-2 bg-blue-400 rounded-full" />
                <div class="w-2" />
                <div class="w-6 h-2 bg-blue-400 rounded-full" />
              </template>
            </div>
          </div>
        </div>

        <p class="text-gray-400 text-sm mb-6">
          {{ t('pages.cemeteryCreate.resultLead') }}
        </p>

        <button
          class="px-6 py-2.5 rounded-full bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium transition-all"
          @click="enterMapSelect"
        >
          {{ t('pages.cemeteryCreate.goMap') }}
        </button>
      </div>

      <!-- ===== TOMBSTONE CONFIG 阶段 ===== -->
      <div v-else-if="phase === 'tombstone-config'" class="pt-8">
        <h2 class="text-xl font-bold text-white mb-6 text-center">{{ t('pages.cemeteryCreate.designTitle') }}</h2>

        <!-- 3D 实时预览 -->
        <div class="flex justify-center mb-8">
          <div class="diy-preview-box">
            <div class="diy-preview-grid" />
            <div class="diy-preview-vignette" />
            <div class="relative flex flex-col items-center" v-html="generateTombSvg(currentStyleStr, 72, 108)" />
            <div
              class="relative mt-2 px-3 py-0.5 rounded text-xs font-semibold text-center"
              :style="{
                background: 'rgba(5, 5, 16, 0.92)',
                color: tombstoneColors.find(c => c.id === selectedColor)?.primary,
                border: `1px solid ${tombstoneColors.find(c => c.id === selectedColor)?.glow}`,
                textShadow: `0 0 8px ${tombstoneColors.find(c => c.id === selectedColor)?.glow}`,
              }"
            >
              {{ displayName || t('pages.cemeteryCreate.previewFallback') }}
            </div>
          </div>
        </div>

        <!-- 底座选择 -->
        <div class="mb-5">
          <label class="text-sm text-gray-400 mb-3 block">{{ t('pages.cemeteryCreate.labelBase') }}</label>
          <div class="grid grid-cols-3 gap-3">
            <button
              v-for="base in tombBases"
              :key="base.id"
              class="flex flex-col items-center gap-2 p-3 rounded-xl border transition-all"
              :class="selectedBase === base.id
                ? 'border-purple-500 bg-purple-900/30'
                : 'border-white/10 bg-white/5 hover:border-white/20'"
              @click="selectedBase = base.id"
            >
              <div class="part-preview" v-html="previewSvg({ base: base.id })" />
              <span class="text-xs" :class="selectedBase === base.id ? 'text-purple-300' : 'text-gray-500'">
                {{ base.name }}
              </span>
            </button>
          </div>
        </div>

        <!-- 主体选择 -->
        <div class="mb-5">
          <label class="text-sm text-gray-400 mb-3 block">{{ t('pages.cemeteryCreate.labelBody') }}</label>
          <div class="grid grid-cols-5 gap-2">
            <button
              v-for="body in tombBodies"
              :key="body.id"
              class="flex flex-col items-center gap-2 p-2 sm:p-3 rounded-xl border transition-all"
              :class="selectedBody === body.id
                ? 'border-purple-500 bg-purple-900/30'
                : 'border-white/10 bg-white/5 hover:border-white/20'"
              @click="selectedBody = body.id"
            >
              <div class="part-preview" v-html="previewSvg({ body: body.id })" />
              <span class="text-[10px] sm:text-xs" :class="selectedBody === body.id ? 'text-purple-300' : 'text-gray-500'">
                {{ body.name }}
              </span>
            </button>
          </div>
        </div>

        <!-- 顶饰选择 -->
        <div class="mb-5">
          <label class="text-sm text-gray-400 mb-3 block">{{ t('pages.cemeteryCreate.labelTop') }}</label>
          <div class="grid grid-cols-4 gap-3">
            <button
              v-for="top in tombTops"
              :key="top.id"
              class="flex flex-col items-center gap-2 p-3 rounded-xl border transition-all"
              :class="selectedTop === top.id
                ? 'border-purple-500 bg-purple-900/30'
                : 'border-white/10 bg-white/5 hover:border-white/20'"
              @click="selectedTop = top.id"
            >
              <div class="part-preview" v-html="previewSvg({ top: top.id })" />
              <span class="text-xs" :class="selectedTop === top.id ? 'text-purple-300' : 'text-gray-500'">
                {{ top.name }}
              </span>
            </button>
          </div>
        </div>

        <!-- 颜色选择 -->
        <div class="mb-6">
          <label class="text-sm text-gray-400 mb-3 block">{{ t('pages.cemeteryCreate.labelColor') }}</label>
          <div class="flex gap-4 flex-wrap justify-center">
            <button
              v-for="color in tombstoneColors"
              :key="color.id"
              class="flex flex-col items-center gap-1.5"
              @click="selectedColor = color.id"
            >
              <div
                class="w-9 h-9 rounded-full border-2 transition-all"
                :style="{
                  background: `linear-gradient(135deg, ${color.gradientFrom}, ${color.primary})`,
                  borderColor: selectedColor === color.id ? color.primary : 'rgba(255,255,255,0.08)',
                  boxShadow: selectedColor === color.id ? `0 0 14px ${color.glow}` : 'none',
                }"
              />
              <span class="text-[10px]" :class="selectedColor === color.id ? 'text-white' : 'text-gray-600'">
                {{ color.name }}
              </span>
            </button>
          </div>
        </div>

        <!-- 名称 -->
        <div class="mb-4">
          <label class="text-sm text-gray-400 mb-2 block">{{ t('pages.cemeteryCreate.labelName') }}</label>
          <input
            v-model="displayName"
            type="text"
            maxlength="50"
            :placeholder="t('pages.cemeteryCreate.namePh')"
            class="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-600 focus:border-purple-500 focus:outline-none transition-colors"
          />
          <span class="text-xs text-gray-600 mt-1 block">{{ displayName.length }}/50</span>
        </div>

        <!-- 墓志铭 -->
        <div class="mb-6">
          <label class="text-sm text-gray-400 mb-2 block">{{ t('pages.cemeteryCreate.labelEpitaph') }}</label>
          <textarea
            v-model="epitaph"
            maxlength="200"
            rows="3"
            :placeholder="t('pages.cemeteryCreate.epitaphPh')"
            class="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-600 focus:border-purple-500 focus:outline-none transition-colors resize-none"
          />
          <span class="text-xs text-gray-600 mt-1 block">{{ epitaph.length }}/200</span>
        </div>

        <div v-if="errorMsg" class="text-red-400 text-sm mb-4 text-center">{{ errorMsg }}</div>

        <div class="flex gap-3">
          <button
            class="flex-1 px-6 py-3 rounded-full border border-white/10 text-gray-300 hover:bg-white/5 transition-colors"
            @click="phase = 'map-select'"
          >
            {{ t('pages.cemeteryCreate.backPick') }}
          </button>
          <button
            class="flex-1 px-6 py-3 rounded-full bg-purple-600 hover:bg-purple-700 text-white font-medium transition-all disabled:opacity-50"
            :disabled="!displayName.trim() || loading"
            @click="submitTombstone"
          >
            {{ loading ? t('pages.cemeteryCreate.createBusy') : t('pages.cemeteryCreate.createSubmit') }}
          </button>
        </div>
      </div>

      <!-- ===== SUCCESS 阶段 ===== -->
      <div v-else-if="phase === 'success'" class="pt-12 text-center">
        <div class="text-6xl mb-6">🪦</div>
        <h2 class="text-2xl font-bold text-white mb-4">{{ t('pages.cemeteryCreate.successTitle') }}</h2>
        <p class="text-gray-400 mb-8">
          {{ t('pages.cemeteryCreate.successBody') }}
        </p>

        <div v-if="createdTombstone" class="bg-white/5 rounded-2xl p-6 mb-8 text-left max-w-sm mx-auto">
          <div class="text-lg text-white font-bold mb-2">{{ createdTombstone.displayName }}</div>
          <div v-if="createdTombstone.epitaph" class="text-sm text-gray-400 italic mb-3">
            "{{ createdTombstone.epitaph }}"
          </div>
          <div class="text-xs text-gray-500 space-y-1">
            <div>{{ t('pages.cemeteryCreate.coordLabel') }}: ({{ createdTombstone.longitude }}°, {{ createdTombstone.latitude }}°)</div>
            <div>{{ t('pages.cemeteryCreate.styleLabel') }}: {{ getStyleDisplayName(createdTombstone.tombstoneStyle) }}</div>
          </div>
        </div>

        <button
          class="px-8 py-3 rounded-full bg-purple-600 hover:bg-purple-700 text-white font-medium transition-all"
          @click="goToMap"
        >
          {{ t('pages.cemeteryCreate.viewMap') }}
        </button>
      </div>

    </div>

    <!-- 宽容器：MAP SELECT 阶段 -->
    <div v-if="phase === 'map-select'" class="px-4 sm:px-8 pt-4">
      <div class="max-w-7xl mx-auto">
        <h2 class="text-lg font-bold text-white mb-2 text-center">{{ t('pages.cemeteryCreate.mapTitle') }}</h2>
        <p class="text-gray-400 text-sm mb-4 text-center">{{ t('pages.cemeteryCreate.mapHint') }}</p>

        <div class="relative h-[500px] sm:h-[600px] rounded-2xl overflow-hidden border border-white/5 mb-4">
          <IsometricMap
            ref="mapRef"
            :markers="markers"
            mode="select"
            :recommended-region="recommendedRegion"
            :selected-position="selectedPos"
            @select="onMapSelect"
          />
        </div>

        <div v-if="selectedPos" class="text-center">
          <div class="text-sm text-gray-400 mb-2">
            {{ t('pages.cemeteryCreate.selectedCoord') }}: ({{ selectedPos.lng.toFixed(2) }}°, {{ selectedPos.lat.toFixed(2) }}°)
            <span v-if="posAvailable" class="text-green-400 ml-2">{{ t('pages.cemeteryCreate.available') }}</span>
            <span v-else class="text-red-400 ml-2">{{ t('pages.cemeteryCreate.occupied') }}</span>
          </div>
          <button
            class="px-6 py-2.5 rounded-full bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium transition-all disabled:opacity-50"
            :disabled="!posAvailable"
            @click="confirmPosition"
          >
            {{ t('pages.cemeteryCreate.confirmPos') }}
          </button>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
.diy-preview-box {
  position: relative;
  padding: 2rem 3rem;
  border-radius: 1rem;
  border: 1px solid rgba(255, 255, 255, 0.05);
  background: #050510;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.diy-preview-grid {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image:
    linear-gradient(rgba(99, 102, 241, 0.07) 1px, transparent 1px),
    linear-gradient(90deg, rgba(99, 102, 241, 0.07) 1px, transparent 1px);
  background-size: 20px 20px;
}
.diy-preview-vignette {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(ellipse at 50% 50%, transparent 25%, rgba(5, 5, 16, 0.65) 100%);
}

.part-preview {
  line-height: 0;
}

@keyframes previewBreath {
  0%, 100% { opacity: 0.85; }
  50% { opacity: 1; }
}
</style>
