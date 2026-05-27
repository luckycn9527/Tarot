<script setup lang="ts">
import { computed } from 'vue'
import type { Tombstone } from '../../composables/useCemetery'
import { generateTombSvg, getTombstoneConfig, getStyleDisplayName } from '../../data/tombstoneStyles'
import { getHexagramById } from '../../data/ichingHexagrams'

const props = defineProps<{
  tombstone: Tombstone | null
}>()

const emit = defineEmits<{
  (e: 'locate'): void
  (e: 'edit'): void
  (e: 'delete'): void
  (e: 'create'): void
}>()

const tombConfig = computed(() => props.tombstone ? getTombstoneConfig(props.tombstone.tombstoneStyle) : null)
const styleDisplayName = computed(() => props.tombstone ? getStyleDisplayName(props.tombstone.tombstoneStyle) : '')
const hexagram = computed(() => props.tombstone?.hexagramId ? getHexagramById(props.tombstone.hexagramId) : null)
const previewSvg = computed(() => props.tombstone ? generateTombSvg(props.tombstone.tombstoneStyle, 56, 84) : '')
</script>

<template>
  <aside class="status-panel cyber-slide-left">
    <!-- 有墓碑 -->
    <template v-if="tombstone && tombConfig">
      <div class="panel-section">
        <div class="section-label">我的墓碑</div>

        <!-- 3D 墓碑预览 -->
        <div class="tomb-preview">
          <div class="tomb-preview-grid" />
          <div
            class="preview-shape"
            :style="{
              filter: `drop-shadow(0 0 10px ${tombConfig.color.glow}) drop-shadow(0 0 20px ${tombConfig.color.glow})`,
            }"
            v-html="previewSvg"
          />
        </div>

        <div class="info-name">{{ tombstone.displayName }}</div>
        <div v-if="tombstone.epitaph" class="info-epitaph">"{{ tombstone.epitaph }}"</div>
      </div>

      <!-- 详细信息 -->
      <div class="panel-section">
        <div class="info-row">
          <span class="info-label">样式</span>
          <span class="info-value" :style="{ color: tombConfig.color.primary }">{{ styleDisplayName }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">坐标</span>
          <span class="info-value">({{ tombstone.longitude }}°, {{ tombstone.latitude }}°)</span>
        </div>
        <div v-if="hexagram" class="info-row">
          <span class="info-label">卦象</span>
          <span class="info-value">{{ hexagram.symbol }} {{ hexagram.name }}卦</span>
        </div>
        <div class="info-row">
          <span class="info-label">拜访</span>
          <span class="info-value">{{ tombstone.viewCount }} 次</span>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="panel-actions">
        <button class="cyber-btn cyber-btn-primary action-btn" @click="emit('locate')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg>
          定位
        </button>
        <button class="cyber-btn action-btn" @click="emit('edit')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
          编辑
        </button>
        <button class="cyber-btn action-btn delete-btn" @click="emit('delete')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
          删除
        </button>
      </div>
    </template>

    <!-- 无墓碑 -->
    <template v-else>
      <div class="empty-state">
        <div class="empty-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3">
            <path d="M3 21h18M9 8h6M12 3v5M5 21V11l7-3 7 3v10"/>
          </svg>
        </div>
        <p class="empty-text">你还没有墓碑</p>
        <p class="empty-hint">通过塔罗牌与周易占卜，在赛博世界中安放你的墓碑</p>
        <button class="cyber-btn cyber-btn-primary" @click="emit('create')" style="width:100%;margin-top:12px">
          占卜选址
        </button>
      </div>
    </template>
  </aside>
</template>

<style scoped>
.status-panel {
  width: 260px;
  height: 100%;
  background: var(--cyber-panel, rgba(13,13,36,0.85));
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-right: 1px solid var(--cyber-border, #1a1a3e);
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.panel-section {
  padding: 12px;
  background: rgba(255,255,255,0.02);
  border: 1px solid var(--cyber-border, #1a1a3e);
  border-radius: 10px;
}

.section-label {
  font-size: 11px;
  color: var(--cyber-neon-purple, #c084fc);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 12px;
}

.tomb-preview {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 16px 0;
  border-radius: 8px;
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
  background-size: 14px 14px;
}
.preview-shape {
  position: relative;
  z-index: 1;
  line-height: 0;
  animation: shapeGlow 3s ease-in-out infinite;
}
@keyframes shapeGlow {
  0%, 100% { opacity: 0.85; }
  50% { opacity: 1; }
}

.info-name {
  font-size: 16px;
  font-weight: 700;
  color: #fff;
  text-align: center;
  margin-top: 8px;
}

.info-epitaph {
  font-size: 12px;
  color: var(--cyber-text-dim, #64748b);
  text-align: center;
  font-style: italic;
  margin-top: 4px;
  line-height: 1.5;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  border-bottom: 1px solid rgba(255,255,255,0.03);
}
.info-row:last-child { border-bottom: none; }

.info-label { font-size: 12px; color: var(--cyber-text-dim, #64748b); }
.info-value { font-size: 12px; color: var(--cyber-text, #e2e8f0); }

.panel-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
}

.delete-btn {
  border-color: rgba(239,68,68,0.2);
  color: #f87171;
}
.delete-btn:hover {
  border-color: rgba(239,68,68,0.4);
  background: rgba(239,68,68,0.08);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  text-align: center;
  padding: 20px;
}

.empty-icon { margin-bottom: 16px; color: var(--cyber-text-dim, #64748b); }
.empty-text { font-size: 14px; color: var(--cyber-text, #e2e8f0); margin-bottom: 8px; }
.empty-hint { font-size: 12px; color: var(--cyber-text-dim, #64748b); line-height: 1.6; }

@media (max-width: 768px) {
  .status-panel {
    width: 100%;
    height: auto;
    max-height: 60vh;
    border-right: none;
    border-bottom: 1px solid var(--cyber-border, #1a1a3e);
  }
}
</style>
