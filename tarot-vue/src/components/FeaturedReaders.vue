<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import type { ReaderInfo } from '../data/readers'
import ReaderAvatarMedia from './ui/ReaderAvatarMedia.vue'
import Flame from '@icons/flame.vue'
import ChevronRight from '@icons/chevron-right.vue'
import Star from '@icons/star.vue'
import Crown from '@icons/crown.vue'

const props = defineProps<{
  readers: ReaderInfo[]
}>()

const emit = defineEmits<{
  (e: 'select', reader: ReaderInfo): void
}>()

const { t } = useI18n()
const router = useRouter()

const topReaders = computed(() => props.readers.slice(0, 3))
const mainReader = computed(() => topReaders.value[0])
const sideReaders = computed(() => topReaders.value.slice(1, 3))

function getTags(reader: ReaderInfo): string[] {
  const tagMap: Record<string, string[]> = {
    '易理·五行': ['恋爱复合', '灵魂伴侣', '情绪疗愈'],
    '冷静派': ['事业决策', '未来规划', '问题解析'],
    '神道·花鸟风月': ['事业财运', '能量净化', '心灵成长'],
    '奇门·紫微': ['命运格局', '事业财运', '情感走向'],
    '月相占卜 · 法国': ['情感疗愈', '亲密关系', '自我探索'],
    '符箓·直觉': ['灵性成长', '能量净化', '破除迷障'],
    '学院派 · 德国': ['事业决策', '理性分析', '未来规划'],
    '伊法占卜 · 西非': ['家族业力', '灵性成长', '祖先智慧'],
    '吠陀·脉轮 · 印度': ['能量疗愈', '冥想指引', '身心平衡'],
    '吉普赛传承 · 西班牙': ['恋爱复合', '情感疗愈', '关系抉择'],
    '逻辑派 · 日本': ['事业决策', '问题解析', '理性分析'],
    '卢恩符文 · 挪威': ['命运趋势', '灵性成长', '能量净化'],
  }
  return tagMap[reader.badge] || [reader.badge, '塔罗解读', '能量指引']
}

function getRating(reader: ReaderInfo): number {
  const map: Record<string, number> = {
    qinghe: 4.9,
    yanxi: 4.8,
    haruka: 4.9,
    xuanyin: 4.9,
    mirelle: 4.8,
    lingsha: 4.9,
    norick: 4.8,
    amara: 4.9,
    vikram: 4.8,
    catalina: 4.9,
    kazuki: 4.8,
    solveig: 4.9,
  }
  return map[reader.id] ?? 4.8
}

function getReads(reader: ReaderInfo): string {
  return `${reader.likes} 次解读`
}

function onSelect(reader: ReaderInfo) {
  emit('select', reader)
}

function viewAll() {
  void router.push('/tarot')
}
</script>

<template>
  <section v-if="topReaders.length" class="w-full max-w-6xl mx-auto px-4 pb-8 animate-fade-in-up">
    <div class="featured-panel">
      <!-- Header -->
      <div class="flex items-center justify-between px-5 pt-5 pb-4">
        <div class="flex items-center gap-2">
          <div class="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Flame class="w-4 h-4 text-white" :size="16" :stroke-width="2" />
          </div>
          <h2 class="text-xl font-serif text-gold-50">{{ t('pages.tarot.featuredEyebrow') }}</h2>
        </div>
        <button
          type="button"
          class="flex items-center gap-0.5 text-xs text-gray-500 hover:text-gold-300 transition-colors cursor-pointer"
          @click="viewAll"
        >
          {{ t('pages.tarot.featuredViewAll') }}
          <ChevronRight class="w-3.5 h-3.5" :size="14" :stroke-width="2" />
        </button>
      </div>

      <!-- Cards Grid -->
      <div class="px-5 pb-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <!-- TOP 1 Main Card -->
        <button
          v-if="mainReader"
          type="button"
          class="featured-main group text-left"
          @click="onSelect(mainReader)"
        >
          <span class="featured-rank featured-rank--main">TOP 1</span>
          <div class="flex flex-col sm:flex-row h-full">
            <div class="featured-avatar-main">
              <ReaderAvatarMedia
                :reader="mainReader"
                wrapper-class="w-full h-full object-cover"
                emoji-class="text-5xl"
                :use-gradient-fallback="true"
                :prefer-original="true"
              />
            </div>
            <div class="flex-1 p-5 flex flex-col justify-between min-w-0">
              <div>
                <div class="flex items-center gap-2 flex-wrap mb-2">
                  <h3 class="text-xl font-serif text-gold-50">{{ mainReader.name }}</h3>
                  <span class="featured-chip featured-chip--gold">首席塔罗师</span>
                  <span
                    class="featured-chip"
                    :class="mainReader.accessLevel === 'free' ? 'featured-chip--free' : 'featured-chip--vip'"
                  >
                    {{ mainReader.label }}
                  </span>
                </div>
                <p class="text-sm text-gold-200/70 mb-3">{{ mainReader.badge }}</p>
                <div class="flex flex-wrap gap-2 mb-4">
                  <span v-for="tag in getTags(mainReader)" :key="tag" class="featured-tag">{{ tag }}</span>
                </div>
              </div>

              <div class="space-y-2">
                <div class="flex items-center gap-4"
                >
                  <div class="flex items-center gap-1">
                    <Star class="w-4 h-4 text-amber-400 fill-amber-400" :size="16" />
                    <span class="text-sm font-medium text-gold-100">{{ getRating(mainReader) }}</span>
                  </div>
                  <span class="text-xs text-gray-500">98% 满意度</span>
                </div>
                <div class="flex items-center gap-4 text-xs text-gray-500"
                >
                  <span>{{ getReads(mainReader) }}</span>
                  <span v-if="mainReader.accessLevel === 'vip'" class="flex items-center gap-1 text-amber-300/80">
                    <Crown class="w-3 h-3" :size="12" /> VIP 专属顾问
                  </span>
                </div>
              </div>

              <button type="button" class="featured-btn featured-btn--primary mt-4"
              >
                <span>{{ t('pages.tarot.featuredCtaPrimary') }}</span>
                <ChevronRight class="w-4 h-4" :size="16" />
              </button>
            </div>
          </div>
        </button>

        <!-- Side Cards -->
        <div class="flex flex-col gap-4"
        >
          <button
            v-for="(reader, index) in sideReaders"
            :key="reader.id"
            type="button"
            class="featured-side group text-left flex-1"
            @click="onSelect(reader)"
          >
            <span class="featured-rank featured-rank--side">TOP {{ index + 2 }}</span>
            <div class="flex items-center gap-3 h-full p-3"
            >
              <div class="featured-avatar-side"
              >
                <ReaderAvatarMedia
                  :reader="reader"
                  wrapper-class="w-full h-full object-cover"
                  emoji-class="text-3xl"
                  :use-gradient-fallback="true"
                />
              </div>
              <div class="flex-1 min-w-0 flex flex-col justify-center"
              >
                <div class="flex items-center gap-2 flex-wrap mb-1"
                >
                  <h3 class="text-base font-serif text-gold-50">{{ reader.name }}</h3>
                  <span
                    class="featured-chip text-[10px] px-1.5 py-0.5"
                    :class="reader.accessLevel === 'free' ? 'featured-chip--free' : 'featured-chip--vip'"
                  >
                    {{ reader.label }}
                  </span>
                </div>
                <p class="text-xs text-gold-200/60 mb-2 truncate">{{ reader.badge }}</p>
                <div class="flex flex-wrap gap-1.5 mb-1.5"
                >
                  <span v-for="tag in getTags(reader).slice(0, 2)" :key="tag" class="featured-tag text-[10px] px-2 py-0.5">{{ tag }}</span>
                </div>
                <div class="flex items-center gap-2 text-[10px] text-gray-500 mb-1"
                >
                  <span class="flex items-center gap-0.5"
                  >
                    <Star class="w-3 h-3 text-amber-400 fill-amber-400" :size="12" />
                    {{ getRating(reader) }}
                  </span>
                  <span>{{ getReads(reader) }}</span>
                </div>
              </div>
              <button type="button" class="featured-btn featured-btn--ghost shrink-0"
              >
                {{ t('pages.tarot.featuredCta') }}
              </button>
            </div>
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.featured-panel {
  border-radius: 24px;
  background: linear-gradient(145deg, rgba(24, 16, 44, 0.95), rgba(10, 8, 22, 0.98));
  border: 1px solid rgba(212, 175, 55, 0.18);
  box-shadow:
    0 0 0 1px rgba(212, 175, 55, 0.06),
    0 24px 70px -20px rgba(0, 0, 0, 0.85),
    0 0 60px rgba(138, 43, 226, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
  overflow: hidden;
}

.featured-main {
  position: relative;
  border-radius: 18px;
  background: linear-gradient(135deg, rgba(124, 58, 237, 0.15), rgba(212, 175, 55, 0.08));
  border: 1px solid rgba(212, 175, 55, 0.22);
  overflow: hidden;
  transition: all 0.3s ease;
  cursor: pointer;
}
.featured-main:hover {
  border-color: rgba(212, 175, 55, 0.45);
  box-shadow:
    0 12px 40px -12px rgba(138, 43, 226, 0.3),
    0 0 40px rgba(212, 175, 55, 0.12);
  transform: translateY(-2px);
}

.featured-side {
  position: relative;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.025);
  border: 1px solid rgba(212, 175, 55, 0.12);
  overflow: hidden;
  transition: all 0.3s ease;
  cursor: pointer;
}
.featured-side:hover {
  border-color: rgba(212, 175, 55, 0.3);
  background: rgba(212, 175, 55, 0.05);
  box-shadow: 0 8px 24px -8px rgba(138, 43, 226, 0.15);
  transform: translateY(-2px);
}

.featured-rank {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 10;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  padding: 4px 10px;
  border-radius: 6px;
  backdrop-filter: blur(8px);
}
.featured-rank--main {
  background: linear-gradient(135deg, rgba(212, 175, 55, 0.9), rgba(180, 130, 60, 0.9));
  color: #0b0b0f;
  box-shadow: 0 4px 12px rgba(212, 175, 55, 0.25);
}
.featured-rank--side {
  background: rgba(255, 255, 255, 0.08);
  color: #f5e9ff;
  border: 1px solid rgba(212, 175, 55, 0.15);
}

.featured-avatar-main {
  width: 100%;
  height: 220px;
  overflow: hidden;
}
@media (min-width: 640px) {
  .featured-avatar-main {
    width: 42%;
    height: auto;
    min-height: 320px;
  }
}
.featured-avatar-main :deep(img),
.featured-avatar-main :deep(div) {
  width: 100%;
  height: 100%;
}
.featured-avatar-main :deep(div) {
  display: flex;
  align-items: center;
  justify-content: center;
}

.featured-avatar-side {
  width: 76px;
  height: 76px;
  border-radius: 14px;
  overflow: hidden;
  flex-shrink: 0;
}
.featured-avatar-side :deep(img),
.featured-avatar-side :deep(div) {
  width: 100%;
  height: 100%;
}

.featured-chip {
  font-size: 10px;
  padding: 3px 8px;
  border-radius: 4px;
  font-weight: 500;
}
.featured-chip--gold {
  background: linear-gradient(135deg, rgba(212, 175, 55, 0.2), rgba(212, 175, 55, 0.08));
  color: #f5e9ff;
  border: 1px solid rgba(212, 175, 55, 0.25);
}
.featured-chip--vip {
  background: rgba(245, 158, 11, 0.12);
  color: #fcd34d;
  border: 1px solid rgba(245, 158, 11, 0.2);
}
.featured-chip--free {
  background: rgba(16, 185, 129, 0.12);
  color: #6ee7b7;
  border: 1px solid rgba(16, 185, 129, 0.2);
}

.featured-tag {
  font-size: 11px;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: rgba(226, 217, 243, 0.75);
}

.featured-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 600;
  transition: all 0.2s ease;
}
.featured-btn--primary {
  width: 100%;
  padding: 8px 16px;
  background: linear-gradient(135deg, #d4af37, #b8860b);
  color: #0b0b0f;
  box-shadow: 0 4px 16px rgba(212, 175, 55, 0.25);
}
.featured-btn--primary:hover {
  background: linear-gradient(135deg, #e0bd4a, #c9971c);
  box-shadow: 0 6px 20px rgba(212, 175, 55, 0.35);
}
.featured-btn--ghost {
  padding: 5px 10px;
  border: 1px solid rgba(212, 175, 55, 0.25);
  background: rgba(212, 175, 55, 0.06);
  color: #f5e9ff;
}
.featured-btn--ghost:hover {
  background: rgba(212, 175, 55, 0.12);
  border-color: rgba(212, 175, 55, 0.4);
}

.group:hover .featured-btn--ghost {
  background: rgba(212, 175, 55, 0.12);
  border-color: rgba(212, 175, 55, 0.4);
}

:deep(.featured-avatar-main img),
:deep(.featured-avatar-side img) {
  object-fit: cover;
}
</style>
