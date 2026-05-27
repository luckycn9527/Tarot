<script setup lang="ts">
import { ref, computed, nextTick, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useDynamicSeoTitle } from '../../composables/useDynamicSeoTitle'
import { getReaderById } from '../../data/readers'
import { getReaderSpreadById } from '../../data/spreadsData'
import { getCardImageUrl } from '../../data/tarotCards'
import { generateReaderReading, type ReaderReadingResult, type ReaderReadingCard } from '../../services/tarotAiReading'
import { useShuffle } from '../../composables/useShuffle'
import ChatBubble from '../../components/ChatBubble.vue'
import TarotCard3D from '../../components/TarotCard3D.vue'
import RitualLoader from '../../components/RitualLoader.vue'
import ReaderAvatarMedia from '../../components/ui/ReaderAvatarMedia.vue'
import { useToast } from '../../composables/useToast'
import { useCardBack } from '../../composables/useCardBack'
import { useStripDeckTilt } from '../../composables/usePointerTilt'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const toast = useToast()
const { deck, shuffle } = useShuffle()
const { cardBackUrl, loadCardBack } = useCardBack()
const deckTilt = useStripDeckTilt()

function onStripPointerMove(e: MouseEvent) {
  deckTilt.onStripMouseMove(e, {
    stripRoot: stripRef.value,
    isIndexBlocked: (i) =>
      selectedIndices.value.includes(i)
      || (allSelected.value && !selectedIndices.value.includes(i)),
  })
}

const readerId = route.params.readerId as string
const reader = computed(() => getReaderById(readerId))
const question = (route.query.q as string) || ''
const category = (route.query.cat as string) || '综合'
const spreadType = (route.query.spread as string) || 'single'
const spread = computed(() => getReaderSpreadById(spreadType))

watch(
  [reader, spread],
  () => {
    const r = reader.value
    const s = spread.value
    if (!r || !question || !s) {
      void router.replace('/tarot')
    }
  },
  { immediate: true },
)

useDynamicSeoTitle(computed(() => {
  const r = reader.value
  if (!r) return null
  return t('seo.dynamic.readerReadingTitle', { name: r.name })
}))

type Phase = 'shuffle' | 'loading' | 'reveal' | 'chat'
const phase = ref<Phase>('shuffle')

const TOTAL_CARDS = 78
const cardCount = computed(() => spread.value?.cardCount || 1)
const selectedIndices = ref<number[]>([])
const allSelected = computed(() => selectedIndices.value.length >= cardCount.value)
const selectedCards = computed(() => selectedIndices.value.map(idx => deck.value[idx]))

const stripRef = ref<HTMLDivElement | null>(null)
const result = ref<ReaderReadingResult | null>(null)
const cards = ref<ReaderReadingCard[]>([])
const revealedCount = ref(0)
const visibleMessages = ref<number>(0)
const showCards = ref(false)
const showActions = ref(false)
const chatContainer = ref<HTMLDivElement | null>(null)
const loadingProgress = ref(0)

const imgErrors = ref<Set<number>>(new Set())
function onImgError(index: number) { imgErrors.value.add(index) }

onMounted(() => {
  void loadCardBack(true)
  shuffle()
})

function selectCard(index: number) {
  if (allSelected.value || selectedIndices.value.includes(index)) return
  selectedIndices.value.push(index)
}

function resetSelection() {
  selectedIndices.value = []
  shuffle()
}

function scrollStrip(direction: 'left' | 'right') {
  stripRef.value?.scrollBy({ left: direction === 'left' ? -400 : 400, behavior: 'smooth' })
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function scrollToBottom() {
  chatContainer.value?.scrollTo({ top: chatContainer.value.scrollHeight, behavior: 'smooth' })
}

async function startReading() {
  phase.value = 'loading'
  loadingProgress.value = 0

  const progressTimer = setInterval(() => {
    if (loadingProgress.value < 85) loadingProgress.value += Math.random() * 8
  }, 700)

  try {
    const cardIds = selectedCards.value.map(sc => sc.card.id)
    const orientations = selectedCards.value.map(sc => sc.isReversed ? 'reversed' : 'upright')

    const data = await generateReaderReading({ readerId, spreadType, question, category, cardIds, orientations })
    result.value = data
    cards.value = data.cards
    clearInterval(progressTimer)
    loadingProgress.value = 100

    await delay(500)
    phase.value = 'reveal'
    await nextTick()
    for (let revealIndex = 0; revealIndex < data.cards.length; revealIndex++) {
      await delay(500)
      revealedCount.value = revealIndex + 1
    }
    await delay(1000)

    phase.value = 'chat'
    await nextTick()

    const messages = data.result.messages
    for (let msgIndex = 0; msgIndex < messages.length; msgIndex++) {
      await delay(800)
      visibleMessages.value = msgIndex + 1
      await nextTick()
      scrollToBottom()

      if (messages[msgIndex].type === 'reveal' && !showCards.value) {
        await delay(400)
        showCards.value = true
        await nextTick()
        scrollToBottom()
      }
    }

    await delay(600)
    showActions.value = true
    await nextTick()
    scrollToBottom()
  } catch (err: unknown) {
    clearInterval(progressTimer)
    phase.value = 'shuffle'
    selectedIndices.value = []
    const axiosErr = err as {
      response?: { status: number; data?: { message?: string } }
      message?: string
    }
    const serverMsg = axiosErr.response?.data?.message
    if (axiosErr.response?.status === 403) {
      toast.error('该塔罗师仅限VIP会员使用')
      router.push('/membership')
    } else if (axiosErr.response?.status === 429) {
      toast.error('今日免费次数已用完')
    } else {
      toast.error(serverMsg || axiosErr.message || '占卜失败，请稍后重试')
    }
  }
}

function goRestart() { router.push({ name: 'reader-ask', params: { readerId } }) }
function goHome() { router.push('/tarot') }

</script>

<template>
  <div class="min-h-screen relative z-10 pt-20 pb-12 px-4">
    <div class="max-w-4xl mx-auto" v-if="reader && spread">

      <!-- SHUFFLE PHASE -->
      <template v-if="phase === 'shuffle'">
        <div class="text-center mb-8 animate-fade-in-up">
          <div class="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gold-500/6 border border-gold-500/15 text-gold-300 text-sm mb-4">
            <ReaderAvatarMedia
              v-if="reader"
              :reader="reader"
              wrapper-class="w-7 h-7 rounded-lg overflow-hidden flex-shrink-0 ring-1 ring-gold-500/20 flex items-center justify-center"
              :use-gradient-fallback="false"
              :avatar-ring="false"
              emoji-class="text-lg leading-none"
            />
            <span>{{ reader?.name }}</span>
            <span class="text-gold-500/30">·</span>
            <span>{{ spread.name }}</span>
          </div>
          <h2 class="text-2xl font-serif text-gold-200 mb-3">选择你的塔罗牌</h2>
          <p class="text-gray-500 text-base">
            <template v-if="allSelected">已选好所有牌，点击下方按钮开始解读</template>
            <template v-else>请从牌堆中选择 <span class="text-gold-400 font-medium">{{ cardCount }}</span> 张牌（已选 {{ selectedIndices.length }}/{{ cardCount }}）</template>
          </p>
        </div>

        <!-- Card Strip -->
        <div class="relative mb-10 animate-fade-in-up">
          <button class="strip-nav-btn left-0" @click="scrollStrip('left')">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <button class="strip-nav-btn right-0" @click="scrollStrip('right')">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 18l6-6-6-6"/></svg>
          </button>

          <div
            ref="stripRef"
            class="strip-scroll overflow-x-auto py-8 px-14"
            @mousemove="onStripPointerMove"
            @mouseleave="deckTilt.clearStripHover"
          >
            <div class="flex items-end">
              <div
                v-for="cardIndex in TOTAL_CARDS"
                :key="cardIndex"
                class="card-slot flex-shrink-0"
                :data-strip-idx="cardIndex - 1"
                :style="{ marginLeft: cardIndex > 1 ? '-16px' : '0', zIndex: cardIndex }"
                @click="selectCard(cardIndex - 1)"
              >
                <div
                  class="card-back"
                  :class="[selectedIndices.includes(cardIndex - 1) ? 'card-selected' : allSelected ? 'card-disabled' : 'card-idle']"
                >
                  <div
                    class="card-back-tilt-target h-full w-full rounded-[8px] relative"
                    :style="deckTilt.stripCardTransform(cardIndex - 1)"
                  >
                    <div
                      class="card-back-shine pointer-events-none absolute inset-0 rounded-[8px] transition-opacity duration-300"
                      :style="deckTilt.stripShineStyle(cardIndex - 1)"
                    />
                    <img :src="cardBackUrl" alt="" class="relative z-0 w-full h-full object-cover rounded-[8px]" />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <p class="text-center text-gray-700 text-xs mt-2">← 滑动浏览牌堆 →</p>
        </div>

        <!-- Spread Positions -->
        <div class="mb-10 animate-fade-in-up" style="animation-delay: 0.15s;">
          <p class="text-center text-gray-600 text-sm mb-5">牌阵位置</p>
          <div class="flex flex-wrap justify-center gap-5">
            <div v-for="(position, posIndex) in spread.positions" :key="posIndex" class="flex flex-col items-center">
              <div class="position-slot" :class="selectedIndices.length > posIndex ? 'position-filled' : 'position-empty'">
                <template v-if="selectedIndices.length > posIndex && selectedCards[posIndex]">
                  <div class="w-full h-full rounded-lg overflow-hidden">
                    <img :src="getCardImageUrl(selectedCards[posIndex].card.nameEn)" :alt="selectedCards[posIndex].card.name" class="w-full h-full object-cover" :class="selectedCards[posIndex].isReversed ? 'rotate-180' : ''" />
                  </div>
                </template>
                <template v-else>
                  <span class="text-gray-600 text-2xl font-light font-serif">{{ posIndex + 1 }}</span>
                </template>
              </div>
              <p class="text-gray-500 text-xs mt-2.5 text-center max-w-[100px]">{{ position }}</p>
              <p v-if="selectedIndices.length > posIndex && selectedCards[posIndex]" class="text-gold-300 text-xs mt-1 text-center max-w-[100px] font-medium">
                {{ selectedCards[posIndex].card.name }}
                <span class="text-gray-600">{{ selectedCards[posIndex].isReversed ? '逆位' : '正位' }}</span>
              </p>
            </div>
          </div>
        </div>

        <!-- Action buttons -->
        <div class="text-center space-y-4 animate-fade-in-up" style="animation-delay: 0.25s;">
          <button v-if="allSelected" class="px-12 py-4 rounded-2xl cta-button text-white text-lg font-medium hover:shadow-xl hover:shadow-gold-500/15 transition-all animate-fade-in-up" @click="startReading">
            {{ reader.emoji }} 请{{ reader.name }}解读
          </button>
          <div v-if="selectedIndices.length > 0 && !allSelected">
            <button class="px-8 py-2.5 rounded-full bg-white/4 border border-gold-500/10 text-gray-400 text-sm hover:bg-gold-500/5 transition-all" @click="resetSelection">重新选牌</button>
          </div>
        </div>
      </template>

      <!-- LOADING PHASE -->
      <template v-if="phase === 'loading'">
        <div class="text-center py-16 animate-fade-in-up">
          <RitualLoader
            :progress="Math.min(loadingProgress, 100)"
            :messages="['感应牌面能量...', `${reader.name}正在冥想...`, '解读星象密码...', '启示即将降临...']"
          />
          <p class="text-gold-200 text-lg font-serif mt-6">{{ reader.emoji }} {{ reader.name }}正在解读...</p>
          <p class="text-gray-600 mt-2">塔罗师正在感应牌面能量，请稍候</p>
        </div>
      </template>

      <!-- REVEAL PHASE -->
      <template v-if="phase === 'reveal' && cards.length">
        <div class="text-center mb-8 animate-fade-in-up">
          <h2 class="text-2xl font-serif text-gold-200 mb-3">牌面揭晓</h2>
          <p class="text-gray-500">{{ spread.name }}</p>
        </div>
        <div class="flex flex-wrap justify-center gap-6 mb-8">
          <div v-for="(revealCard, revealIndex) in cards" :key="revealIndex" class="flex flex-col items-center">
            <TarotCard3D
              :card-image-url="!imgErrors.has(revealIndex) ? getCardImageUrl(revealCard.nameEn) : undefined"
              :card-back-url="cardBackUrl"
              :is-reversed="revealCard.isReversed"
              :is-flipped="revealIndex < revealedCount"
              :clickable="false"
              size="sm"
            />
            <div class="mt-3 text-center" :class="revealIndex < revealedCount ? 'opacity-100' : 'opacity-0'" style="transition: opacity 0.5s;">
              <p class="text-gold-200 text-sm font-medium font-serif">{{ revealCard.name }}</p>
              <p class="text-gold-400 text-xs">{{ revealCard.isReversed ? '逆位' : '正位' }}</p>
              <p class="text-gray-600 text-xs mt-0.5">{{ revealCard.position }}</p>
            </div>
          </div>
        </div>
      </template>

      <!-- CHAT PHASE -->
      <template v-if="phase === 'chat' && result">
        <div ref="chatContainer" class="space-y-5">
          <ChatBubble side="right" avatar="🙋" class="animate-fade-in-up">
            {{ question }}
          </ChatBubble>

          <template v-for="(message, messageIndex) in result.result.messages" :key="messageIndex">
            <ChatBubble v-if="messageIndex < visibleMessages" side="left" :name="reader.name">
              <template #avatar>
                <ReaderAvatarMedia
                  :reader="reader"
                  wrapper-class="w-full h-full flex items-center justify-center overflow-hidden"
                  emoji-class="text-lg leading-none"
                />
              </template>
              {{ message.content }}
            </ChatBubble>

            <div v-if="message.type === 'reveal' && messageIndex < visibleMessages && showCards" class="py-3 chat-bubble-enter">
              <div class="overflow-x-auto pb-3">
                <div class="flex gap-4 min-w-max px-12">
                  <div v-for="(chatCard, chatCardIndex) in result.cards" :key="chatCardIndex" class="flex flex-col items-center">
                    <div class="w-24 h-36 sm:w-28 sm:h-40 rounded-xl overflow-hidden border-2 border-gold-500/20 shadow-lg shadow-gold-500/5">
                      <img v-if="!imgErrors.has(chatCardIndex)" :src="getCardImageUrl(chatCard.nameEn)" :alt="chatCard.name" class="w-full h-full object-cover" :class="chatCard.isReversed ? 'rotate-180' : ''" @error="onImgError(chatCardIndex)" />
                      <div v-else class="w-full h-full bg-gradient-to-br from-obsidian to-void flex flex-col items-center justify-center p-2">
                        <span class="text-gold-300 text-sm font-medium text-center">{{ chatCard.name }}</span>
                        <span class="text-gold-400/60 text-xs mt-1">{{ chatCard.isReversed ? '逆位' : '正位' }}</span>
                      </div>
                    </div>
                    <p class="text-gold-300 text-sm mt-2 text-center max-w-[100px] font-medium">{{ chatCard.name }}</p>
                    <p class="text-gray-500 text-xs">{{ chatCard.isReversed ? '逆位' : '正位' }}</p>
                    <p class="text-gray-700 text-xs">{{ chatCard.position }}</p>
                  </div>
                </div>
              </div>
            </div>
          </template>

          <div v-if="showActions" class="flex flex-col sm:flex-row gap-3 pt-6 chat-bubble-enter">
            <button class="flex-1 py-3.5 rounded-xl cta-button text-white font-medium hover:shadow-lg transition-all" @click="goRestart">重新占卜</button>
            <button class="flex-1 py-3.5 rounded-xl bg-white/4 border border-gold-500/10 text-gray-300 hover:bg-gold-500/5 transition-all" @click="goHome">返回塔罗师选择</button>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.strip-nav-btn {
  position: absolute; top: 50%; transform: translateY(-50%); z-index: 100;
  width: 44px; height: 44px; border-radius: 50%;
  background: rgba(3,1,8,.85); border: 1px solid rgba(212,168,83,.15);
  color: var(--color-gold-300); display: flex; align-items: center; justify-content: center;
  cursor: pointer; transition: all 0.2s; backdrop-filter: blur(8px);
}
.strip-nav-btn:hover {
  background: rgba(3,1,8,.95);
  border-color: rgba(212,168,83,.4);
  box-shadow: 0 0 16px rgba(212,168,83,.1);
}
.strip-scroll { scrollbar-width: none; -ms-overflow-style: none; }
.strip-scroll::-webkit-scrollbar { display: none; }
.card-slot {
  cursor: pointer;
  perspective: 960px;
  transform-style: preserve-3d;
}
.card-back {
  width: 72px; height: 112px; border-radius: 10px; overflow: hidden;
  position: relative; transition: transform 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease, opacity 0.3s ease, filter 0.3s ease;
  border: 2px solid rgba(212,168,83,.2); box-shadow: 0 2px 10px rgba(0,0,0,.4);
}
.card-back-tilt-target {
  transform-style: preserve-3d;
  transition: transform 0.35s ease-out;
  will-change: transform;
}
.card-back-shine {
  z-index: 1;
}
@media (min-width: 640px) { .card-back { width: 80px; height: 126px; } }
.card-idle { cursor: pointer; }
.card-idle:hover {
  transform: translateY(-16px);
  border-color: rgba(212,168,83,.5);
  box-shadow: 0 10px 28px rgba(212,168,83,.15), 0 4px 16px rgba(0,0,0,.5);
  z-index: 999 !important;
}
.card-selected { opacity: 0.15; transform: scale(0.88); pointer-events: none; filter: grayscale(1); }
.card-disabled { opacity: 0.35; pointer-events: none; }
.position-slot {
  width: 80px; height: 120px; border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.5s ease;
}
@media (min-width: 640px) { .position-slot { width: 96px; height: 144px; } }
.position-empty { border: 2px dashed rgba(212,168,83,.15); background: rgba(255,255,255,.01); }
.position-filled {
  border: 2px solid rgba(212,168,83,.35);
  background: rgba(212,168,83,.04);
  box-shadow: 0 0 20px rgba(212,168,83,.08);
  animation: positionFillIn 0.5s ease-out;
}
@keyframes positionFillIn { from { opacity: 0; transform: scale(0.75); } to { opacity: 1; transform: scale(1); } }
.chat-bubble-enter { animation: bubbleFadeIn 0.4s ease-out both; }
@keyframes bubbleFadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
</style>
