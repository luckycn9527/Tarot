<script setup lang="ts">
defineProps<{
  tombstoneCount: number
}>()
</script>

<template>
  <header class="cyber-top-bar">
    <div class="top-bar-left">
      <h1 class="top-bar-title">
        CYBER CEMETERY
        <span class="top-bar-subtitle">电子陵墓</span>
      </h1>
    </div>
    <div class="top-bar-center">
      <span class="stat-chip">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 21h18M9 8h6M12 3v5M5 21V11l7-3 7 3v10"/>
        </svg>
        {{ tombstoneCount }} 座墓碑
      </span>
    </div>
    <div class="top-bar-right">
      <slot name="actions" />
    </div>
    <div class="glow-line" />
  </header>
</template>

<style scoped>
.cyber-top-bar {
  position: relative;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  background: var(--cyber-panel, rgba(13,13,36,0.85));
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-bottom: 1px solid var(--cyber-border, #1a1a3e);
  z-index: 20;
}

.top-bar-left { display: flex; align-items: center; gap: 8px; }

.top-bar-title {
  font-size: 15px;
  font-weight: 700;
  color: #fff;
  letter-spacing: 1.5px;
}

.top-bar-subtitle {
  font-size: 11px;
  font-weight: 400;
  color: var(--cyber-neon-purple, #c084fc);
  margin-left: 8px;
  letter-spacing: 0;
}

.top-bar-center {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
}

.stat-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: 20px;
  background: rgba(255,255,255,0.04);
  border: 1px solid var(--cyber-border, #1a1a3e);
  color: var(--cyber-text-dim, #64748b);
  font-size: 12px;
}

.top-bar-right { display: flex; align-items: center; gap: 8px; }

.glow-line {
  position: absolute;
  bottom: 0;
  left: 10%;
  right: 10%;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--cyber-neon-purple, #c084fc), transparent);
  opacity: 0.4;
}

@media (max-width: 640px) {
  .top-bar-center { display: none; }
  .top-bar-title { font-size: 13px; }
}
</style>
