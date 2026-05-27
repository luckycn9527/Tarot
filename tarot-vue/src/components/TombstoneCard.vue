<script setup lang="ts">
import { computed } from 'vue'
import { generateTombSvg, getStyleDisplayName, getTombstoneConfig } from '../data/tombstoneStyles'
import { getHexagramById } from '../data/ichingHexagrams'
import type { Tombstone } from '../composables/useCemetery'

const props = defineProps<{
  tombstone: Tombstone
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const tombConfig = computed(() => getTombstoneConfig(props.tombstone.tombstoneStyle))
const styleDisplayName = computed(() => getStyleDisplayName(props.tombstone.tombstoneStyle))
const hexagram = computed(() =>
  props.tombstone.hexagramId ? getHexagramById(props.tombstone.hexagramId) : null
)
const formattedDate = computed(() => {
  const d = new Date(props.tombstone.createdAt)
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
})

const previewSvg = computed(() => generateTombSvg(props.tombstone.tombstoneStyle, 80, 120))
</script>

<template>
  <div class="tombstone-modal cyber-panel">
    <!-- 关闭按钮 -->
    <button class="close-btn" @click="emit('close')">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
    </button>

    <div class="modal-content">
      <!-- 左栏：墓碑信息 -->
      <div class="info-column">
        <!-- 3D 墓碑预览 -->
        <div class="tomb-preview">
          <div class="tomb-preview-grid" />
          <div
            class="preview-shape"
            :style="{
              filter: `drop-shadow(0 0 12px ${tombConfig.color.glow}) drop-shadow(0 0 24px ${tombConfig.color.glow})`,
            }"
            v-html="previewSvg"
          />
        </div>

        <!-- 名称 + 墓志铭 -->
        <h3 class="tomb-name">{{ tombstone.displayName }}</h3>
        <p v-if="tombstone.epitaph" class="tomb-epitaph">"{{ tombstone.epitaph }}"</p>

        <!-- 详细信息 -->
        <div class="tomb-details">
          <div class="detail-row">
            <span class="detail-label">样式</span>
            <span class="detail-value">
              <span class="style-dot" :style="{ backgroundColor: tombConfig.color.primary }" />
              {{ styleDisplayName }}
            </span>
          </div>
          <div v-if="hexagram" class="detail-row">
            <span class="detail-label">卦象</span>
            <span class="detail-value hexagram-value">
              <span class="hex-symbol">{{ hexagram.symbol }}</span>
              {{ hexagram.name }}卦
              <span class="hex-meaning">{{ hexagram.meaning }}</span>
            </span>
          </div>
          <div class="detail-row">
            <span class="detail-label">坐标</span>
            <span class="detail-value">({{ tombstone.longitude }}°, {{ tombstone.latitude }}°)</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">拜访</span>
            <span class="detail-value">{{ tombstone.viewCount }} 次</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">安葬</span>
            <span class="detail-value">{{ formattedDate }}</span>
          </div>
        </div>
      </div>

      <!-- 右栏：留言区（待开发） -->
      <div class="comment-column">
        <div class="coming-soon">
          <p class="coming-soon-icon">💬</p>
          <p class="coming-soon-text">留言功能即将上线</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tombstone-modal {
  position: relative;
  max-width: 740px;
  width: calc(100% - 32px);
  max-height: calc(100vh - 120px);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 0 1px var(--cyber-neon-purple, #c084fc),
              0 0 20px rgba(192,132,252,0.15),
              0 25px 50px rgba(0,0,0,0.5);
}

.close-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 10;
  background: rgba(255,255,255,0.05);
  border: 1px solid var(--cyber-border, #1a1a3e);
  border-radius: 8px;
  padding: 6px;
  color: var(--cyber-text-dim, #64748b);
  cursor: pointer;
  transition: all 0.15s;
}
.close-btn:hover {
  color: #fff;
  background: rgba(255,255,255,0.08);
  border-color: var(--cyber-neon-purple, #c084fc);
}

.modal-content {
  display: flex;
  height: 100%;
  max-height: calc(100vh - 120px);
}

.info-column {
  width: 300px;
  flex-shrink: 0;
  padding: 24px;
  border-right: 1px solid var(--cyber-border, #1a1a3e);
  overflow-y: auto;
}

.tomb-preview {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 24px 0;
  margin-bottom: 8px;
  border-radius: 12px;
  background: #050510;
  overflow: hidden;
}
.tomb-preview-grid {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image:
    linear-gradient(rgba(99, 102, 241, 0.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(99, 102, 241, 0.06) 1px, transparent 1px);
  background-size: 16px 16px;
}
.preview-shape {
  position: relative;
  z-index: 1;
  line-height: 0;
  animation: previewGlow 3s ease-in-out infinite;
}
@keyframes previewGlow {
  0%, 100% { opacity: 0.85; }
  50% { opacity: 1; }
}

.tomb-name {
  font-size: 20px;
  font-weight: 700;
  color: #fff;
  text-align: center;
  margin-bottom: 8px;
}

.tomb-epitaph {
  font-size: 13px;
  color: var(--cyber-text-dim, #64748b);
  text-align: center;
  font-style: italic;
  line-height: 1.6;
  margin-bottom: 20px;
}

.tomb-details {
  border-top: 1px solid var(--cyber-border, #1a1a3e);
  padding-top: 16px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 8px 0;
  border-bottom: 1px solid rgba(255,255,255,0.03);
}
.detail-row:last-child { border-bottom: none; }

.detail-label {
  font-size: 12px;
  color: var(--cyber-text-dim, #64748b);
  flex-shrink: 0;
}

.detail-value {
  font-size: 12px;
  color: var(--cyber-text, #e2e8f0);
  text-align: right;
  display: flex;
  align-items: center;
  gap: 6px;
}

.style-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.hexagram-value {
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}
.hex-symbol { font-size: 18px; }
.hex-meaning {
  font-size: 10px;
  color: var(--cyber-text-dim, #64748b);
}

.comment-column {
  flex: 1;
  padding: 24px;
  overflow-y: auto;
  min-width: 0;
}

.coming-soon {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 200px;
  gap: 12px;
}
.coming-soon-icon { font-size: 32px; opacity: 0.4; }
.coming-soon-text {
  font-size: 13px;
  color: var(--cyber-text-dim, #64748b);
}

@media (max-width: 640px) {
  .modal-content {
    flex-direction: column;
  }
  .info-column {
    width: 100%;
    border-right: none;
    border-bottom: 1px solid var(--cyber-border, #1a1a3e);
    padding: 16px;
  }
  .tomb-preview { padding: 16px 0; }
  .comment-column {
    padding: 16px;
    max-height: 50vh;
  }
}
</style>
