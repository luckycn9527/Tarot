<script setup lang="ts">
import { ref } from 'vue'

// 消息类型
interface Activity {
  id: number
  type: 'visit' | 'comment' | 'like' | 'create'
  userName: string
  userAvatar: string
  targetName: string
  content?: string
  createdAt: string
}

// Mock 数据 - 等后端 GET /cemetery/activities API 实现后替换
const activities = ref<Activity[]>([
  { id: 1, type: 'visit', userName: '匿名旅者', userAvatar: '👤', targetName: '某位逝者', createdAt: '刚刚' },
  { id: 2, type: 'create', userName: '赛博行者', userAvatar: '🤖', targetName: '赛博行者的墓碑', createdAt: '5分钟前' },
  { id: 3, type: 'comment', userName: '数字幽灵', userAvatar: '👻', targetName: '电子先驱', content: '安息吧，赛博朋友', createdAt: '10分钟前' },
  { id: 4, type: 'like', userName: '量子猫', userAvatar: '🐱', targetName: '薛定谔之墓', createdAt: '1小时前' },
])

const typeIcons: Record<string, string> = {
  visit: '👁',
  comment: '💬',
  like: '❤',
  create: '🪦',
}

const typeLabels: Record<string, string> = {
  visit: '拜访了',
  comment: '评论了',
  like: '点赞了',
  create: '创建了',
}
</script>

<template>
  <aside class="message-hub cyber-slide-right">
    <div class="hub-header">
      <div class="section-label">最近动态</div>
      <span class="hub-badge">{{ activities.length }}</span>
    </div>

    <div v-if="activities.length === 0" class="empty-hub">
      <p class="empty-text">暂无动态</p>
      <p class="empty-hint">当有人拜访或评论墓碑时，这里会显示通知</p>
    </div>

    <div v-else class="activity-list">
      <div
        v-for="a in activities"
        :key="a.id"
        class="activity-item"
      >
        <div class="activity-avatar">{{ a.userAvatar }}</div>
        <div class="activity-body">
          <div class="activity-line">
            <span class="activity-user">{{ a.userName }}</span>
            <span class="activity-action">{{ typeLabels[a.type] }}</span>
            <span class="activity-target">{{ a.targetName }}</span>
          </div>
          <div v-if="a.content" class="activity-content">"{{ a.content }}"</div>
          <div class="activity-time">
            <span class="type-icon">{{ typeIcons[a.type] }}</span>
            {{ a.createdAt }}
          </div>
        </div>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.message-hub {
  width: 300px;
  height: 100%;
  background: var(--cyber-panel, rgba(13,13,36,0.85));
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-left: 1px solid var(--cyber-border, #1a1a3e);
  overflow-y: auto;
  padding: 16px;
}

.hub-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.section-label {
  font-size: 11px;
  color: var(--cyber-neon-purple, #c084fc);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.hub-badge {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 10px;
  background: rgba(192,132,252,0.12);
  color: var(--cyber-neon-purple, #c084fc);
}

.activity-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.activity-item {
  display: flex;
  gap: 10px;
  padding: 10px 8px;
  border-radius: 8px;
  transition: background 0.15s;
}
.activity-item:hover {
  background: rgba(255,255,255,0.03);
}

.activity-avatar {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: rgba(255,255,255,0.04);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  flex-shrink: 0;
}

.activity-body {
  flex: 1;
  min-width: 0;
}

.activity-line {
  font-size: 12px;
  color: var(--cyber-text, #e2e8f0);
  line-height: 1.5;
}

.activity-user { font-weight: 600; }
.activity-action { color: var(--cyber-text-dim, #64748b); margin: 0 4px; }
.activity-target { color: var(--cyber-neon-cyan, #22d3ee); }

.activity-content {
  font-size: 11px;
  color: var(--cyber-text-dim, #64748b);
  margin-top: 2px;
  font-style: italic;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.activity-time {
  font-size: 10px;
  color: var(--cyber-text-dim, #64748b);
  margin-top: 4px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.type-icon { font-size: 10px; }

.empty-hub {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  text-align: center;
}
.empty-text { font-size: 13px; color: var(--cyber-text, #e2e8f0); margin-bottom: 8px; }
.empty-hint { font-size: 11px; color: var(--cyber-text-dim, #64748b); line-height: 1.5; }

@media (max-width: 768px) {
  .message-hub {
    width: 100%;
    height: auto;
    max-height: 60vh;
    border-left: none;
    border-top: 1px solid var(--cyber-border, #1a1a3e);
  }
}
</style>
