<script setup lang="ts">
defineProps<{
  showStatusPanel: boolean
  showMessageHub: boolean
  hasTombstone: boolean
  zoomPercent: number
}>()

const emit = defineEmits<{
  (e: 'toggleStatus'): void
  (e: 'toggleMessage'): void
  (e: 'locateMe'): void
  (e: 'create'): void
  (e: 'randomVisit'): void
  (e: 'zoomIn'): void
  (e: 'zoomOut'): void
}>()
</script>

<template>
  <footer class="cyber-bottom-bar">
    <!-- 左：面板切换 -->
    <div class="bar-section bar-left">
      <button
        class="bar-btn"
        :class="{ active: showStatusPanel }"
        title="状态面板"
        @click="emit('toggleStatus')"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="18" rx="1"/><path d="M14 3h7M14 9h7M14 15h5"/></svg>
      </button>
      <button
        class="bar-btn"
        :class="{ active: showMessageHub }"
        title="消息中心"
        @click="emit('toggleMessage')"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>
      </button>
    </div>

    <!-- 中：主操作 -->
    <div class="bar-section bar-center">
      <button
        v-if="hasTombstone"
        class="bar-btn primary-btn"
        @click="emit('locateMe')"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg>
        <span>定位我的墓碑</span>
      </button>
      <button
        v-else
        class="bar-btn primary-btn"
        @click="emit('create')"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
        <span>占卜选址</span>
      </button>
      <button class="bar-btn" @click="emit('randomVisit')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 4l3 3-3 3M2 7h19M6 20l-3-3 3-3M22 17H3"/></svg>
        <span class="btn-label-desktop">随机拜访</span>
      </button>
    </div>

    <!-- 右：缩放控制 -->
    <div class="bar-section bar-right">
      <button class="bar-btn zoom-btn" @click="emit('zoomOut')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"/></svg>
      </button>
      <span class="zoom-label">{{ zoomPercent }}%</span>
      <button class="bar-btn zoom-btn" @click="emit('zoomIn')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
      </button>
    </div>

    <div class="glow-line" />
  </footer>
</template>

<style scoped>
.cyber-bottom-bar {
  position: relative;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  background: var(--cyber-panel, rgba(13,13,36,0.85));
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-top: 1px solid var(--cyber-border, #1a1a3e);
  z-index: 20;
}

.bar-section { display: flex; align-items: center; gap: 6px; }
.bar-left { min-width: 80px; }
.bar-center { justify-content: center; }
.bar-right { min-width: 120px; justify-content: flex-end; }

.bar-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--cyber-text-dim, #64748b);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}

.bar-btn:hover {
  color: var(--cyber-text, #e2e8f0);
  background: rgba(255,255,255,0.04);
}

.bar-btn.active {
  color: var(--cyber-neon-purple, #c084fc);
  background: rgba(192,132,252,0.08);
  border-color: rgba(192,132,252,0.2);
}

.primary-btn {
  background: linear-gradient(135deg, rgba(147,51,234,0.5), rgba(192,132,252,0.3));
  border: 1px solid rgba(192,132,252,0.3);
  color: #fff;
  padding: 6px 16px;
}
.primary-btn:hover {
  background: linear-gradient(135deg, rgba(147,51,234,0.7), rgba(192,132,252,0.5));
  box-shadow: 0 0 12px rgba(192,132,252,0.2);
  color: #fff;
}

.zoom-btn {
  padding: 6px 8px;
}

.zoom-label {
  font-size: 11px;
  color: var(--cyber-text-dim, #64748b);
  min-width: 36px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.glow-line {
  position: absolute;
  top: 0;
  left: 10%;
  right: 10%;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--cyber-neon-purple, #c084fc), transparent);
  opacity: 0.3;
}

@media (max-width: 640px) {
  .btn-label-desktop { display: none; }
  .bar-btn { padding: 6px 8px; }
  .primary-btn { padding: 6px 12px; }
  .bar-right { min-width: auto; }
}
</style>
