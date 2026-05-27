<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuth } from '../composables/useAuth'
import { useCemetery, type Tombstone, type TombstoneMarker } from '../composables/useCemetery'
import IsometricMap from '../components/cemetery/IsometricMap.vue'
import CemeteryTopBar from '../components/cemetery/CemeteryTopBar.vue'
import CemeteryStatusPanel from '../components/cemetery/CemeteryStatusPanel.vue'
import MessageHub from '../components/cemetery/MessageHub.vue'
import CemeteryBottomBar from '../components/cemetery/CemeteryBottomBar.vue'
import TombstoneCard from '../components/TombstoneCard.vue'

const router = useRouter()
const { t } = useI18n()
const { isLoggedIn } = useAuth()
const { markers, fetchMarkers, fetchTombstoneById, fetchMyTombstone, myTombstone, deleteMyTombstone, updateMyTombstone } = useCemetery()

const loading = ref(true)
const selectedTombstone = ref<Tombstone | null>(null)
const mapRef = ref<InstanceType<typeof IsometricMap> | null>(null)

// 面板显示状态
const showStatusPanel = ref(true)
const showMessageHub = ref(false)

// 编辑/删除弹窗
const showDeleteConfirm = ref(false)
const showEditModal = ref(false)
const editName = ref('')
const editEpitaph = ref('')
const editLoading = ref(false)

// 缩放百分比（从地图获取）
const zoomPercent = computed(() => mapRef.value?.zoomPercent ?? 100)

onMounted(async () => {
  await fetchMarkers()
  if (isLoggedIn.value) {
    await fetchMyTombstone()
  }
  loading.value = false

  // 加载完成后自动定位到墓碑区域（地图组件内部会在 map:load 后执行）
  await nextTick()
  setTimeout(() => {
    if (markers.value.length > 0 && mapRef.value) {
      mapRef.value.fitMarkers()
    }
  }, 2000)
})

async function onMarkerClick(marker: TombstoneMarker) {
  const detail = await fetchTombstoneById(marker.id)
  if (detail) {
    selectedTombstone.value = detail
  }
}

function closeTombstoneCard() {
  selectedTombstone.value = null
}

function goCreate() {
  if (!isLoggedIn.value) {
    router.push('/login')
    return
  }
  router.push('/cemetery/create')
}

function locateMyTombstone() {
  if (myTombstone.value && mapRef.value) {
    mapRef.value.centerOn(myTombstone.value.longitude, myTombstone.value.latitude, 10)
  }
}

function randomVisit() {
  if (markers.value.length === 0) return
  const random = markers.value[Math.floor(Math.random() * markers.value.length)]
  onMarkerClick(random)
  if (mapRef.value) {
    mapRef.value.centerOn(random.longitude, random.latitude, 8)
  }
}

async function confirmDeleteTombstone() {
  try {
    await deleteMyTombstone()
    showDeleteConfirm.value = false
  } catch {
    // 错误已在 composable 处理
  }
}

function openEditModal() {
  if (!myTombstone.value) return
  editName.value = myTombstone.value.displayName
  editEpitaph.value = myTombstone.value.epitaph || ''
  showEditModal.value = true
}

async function submitEdit() {
  if (!editName.value.trim()) return
  editLoading.value = true
  try {
    await updateMyTombstone({
      displayName: editName.value.trim(),
      epitaph: editEpitaph.value.trim() || null,
    })
    showEditModal.value = false
  } catch {
    // 错误已在 composable 处理
  } finally {
    editLoading.value = false
  }
}

// 移动端面板控制
function toggleStatusPanel() {
  showStatusPanel.value = !showStatusPanel.value
  if (showStatusPanel.value) showMessageHub.value = false
}
function toggleMessageHub() {
  showMessageHub.value = !showMessageHub.value
  if (showMessageHub.value) showStatusPanel.value = false
}
</script>

<template>
  <div class="cemetery-layout">
    <!-- 顶部栏 -->
    <CemeteryTopBar :tombstone-count="markers.length" />

    <!-- 主体区域 -->
    <div class="cemetery-body">
      <!-- 左侧状态面板 -->
      <Transition name="panel-left">
        <CemeteryStatusPanel
          v-if="showStatusPanel"
          :tombstone="myTombstone"
          @locate="locateMyTombstone"
          @edit="openEditModal"
          @delete="showDeleteConfirm = true"
          @create="goCreate"
        />
      </Transition>

      <!-- 中间地图 -->
      <div class="map-area">
        <div v-if="loading" class="map-loading">
          <div class="loading-text">{{ t('pages.cemetery.mapLoading') }}</div>
        </div>
        <IsometricMap
          v-else
          ref="mapRef"
          :markers="markers"
          mode="view"
          @marker-click="onMarkerClick"
        />
      </div>

      <!-- 右侧消息中心 -->
      <Transition name="panel-right">
        <MessageHub v-if="showMessageHub" />
      </Transition>
    </div>

    <!-- 底部操作栏 -->
    <CemeteryBottomBar
      :show-status-panel="showStatusPanel"
      :show-message-hub="showMessageHub"
      :has-tombstone="!!myTombstone"
      :zoom-percent="zoomPercent"
      @toggle-status="toggleStatusPanel"
      @toggle-message="toggleMessageHub"
      @locate-me="locateMyTombstone"
      @create="goCreate"
      @random-visit="randomVisit"
      @zoom-in="mapRef?.zoomIn()"
      @zoom-out="mapRef?.zoomOut()"
    />

    <!-- 墓碑详情弹层 -->
    <Transition name="cyber-fade">
      <div
        v-if="selectedTombstone"
        class="modal-overlay"
        @click.self="closeTombstoneCard"
      >
        <div class="cyber-modal-in">
          <TombstoneCard :tombstone="selectedTombstone" @close="closeTombstoneCard" />
        </div>
      </div>
    </Transition>

    <!-- 删除确认弹窗 -->
    <Transition name="cyber-fade">
      <div
        v-if="showDeleteConfirm"
        class="modal-overlay"
        @click.self="showDeleteConfirm = false"
      >
        <div class="cyber-modal-in confirm-modal cyber-panel">
          <h3 class="confirm-title">{{ t('pages.cemetery.deleteTitle') }}</h3>
          <p class="confirm-text">{{ t('pages.cemetery.deleteBody') }}</p>
          <div class="confirm-actions">
            <button class="cyber-btn" @click="showDeleteConfirm = false">{{ t('pages.cemetery.cancel') }}</button>
            <button class="cyber-btn delete-confirm-btn" @click="confirmDeleteTombstone">{{ t('pages.cemetery.confirmDelete') }}</button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 编辑墓碑弹窗 -->
    <Transition name="cyber-fade">
      <div
        v-if="showEditModal"
        class="modal-overlay"
        @click.self="showEditModal = false"
      >
        <div class="cyber-modal-in edit-modal cyber-panel">
          <h3 class="edit-title">{{ t('pages.cemetery.editTitle') }}</h3>
          <div class="form-group">
            <label class="form-label">{{ t('pages.cemetery.nameLabel') }}</label>
            <input
              v-model="editName"
              type="text"
              maxlength="50"
              :placeholder="t('pages.cemetery.namePh')"
              class="cyber-input"
            />
            <span class="char-count">{{ editName.length }}/50</span>
          </div>
          <div class="form-group">
            <label class="form-label">{{ t('pages.cemetery.epitaphLabel') }}</label>
            <textarea
              v-model="editEpitaph"
              maxlength="200"
              rows="3"
              :placeholder="t('pages.cemetery.epitaphPh')"
              class="cyber-input"
              style="resize:none"
            />
            <span class="char-count">{{ editEpitaph.length }}/200</span>
          </div>
          <div class="confirm-actions">
            <button class="cyber-btn" @click="showEditModal = false">{{ t('pages.cemetery.cancel') }}</button>
            <button
              class="cyber-btn cyber-btn-primary"
              :disabled="!editName.trim() || editLoading"
              @click="submitEdit"
            >
              {{ editLoading ? t('pages.cemetery.saving') : t('pages.cemetery.save') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.cemetery-layout {
  position: fixed;
  top: 56px;  /* AppHeader 高度之下 */
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  background: var(--cyber-bg-deep, #050510);
  z-index: 30;
}

.cemetery-body {
  flex: 1;
  display: flex;
  overflow: hidden;
  position: relative;
}

.map-area {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.map-loading {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--cyber-bg-deep, #050510);
}
.loading-text {
  color: var(--cyber-text-dim, #64748b);
  animation: neonBreath 1.5s ease-in-out infinite;
  font-size: 14px;
}

/* 模态层 */
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0,0,0,0.6);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

/* 删除确认 */
.confirm-modal {
  padding: 28px;
  border-radius: 16px;
  max-width: 360px;
  width: calc(100% - 32px);
  text-align: center;
}
.confirm-title {
  font-size: 16px;
  font-weight: 700;
  color: #fff;
  margin-bottom: 8px;
}
.confirm-text {
  font-size: 13px;
  color: var(--cyber-text-dim, #64748b);
  margin-bottom: 24px;
  line-height: 1.6;
}
.confirm-actions {
  display: flex;
  gap: 12px;
}
.confirm-actions .cyber-btn { flex: 1; }
.delete-confirm-btn {
  background: rgba(239,68,68,0.3) !important;
  border-color: rgba(239,68,68,0.4) !important;
  color: #fca5a5 !important;
}
.delete-confirm-btn:hover {
  background: rgba(239,68,68,0.5) !important;
}

/* 编辑弹窗 */
.edit-modal {
  padding: 28px;
  border-radius: 16px;
  max-width: 440px;
  width: calc(100% - 32px);
}
.edit-title {
  font-size: 16px;
  font-weight: 700;
  color: #fff;
  margin-bottom: 20px;
}
.form-group { margin-bottom: 16px; }
.form-label {
  display: block;
  font-size: 12px;
  color: var(--cyber-text-dim, #64748b);
  margin-bottom: 6px;
}
.char-count {
  display: block;
  text-align: right;
  font-size: 10px;
  color: var(--cyber-text-dim, #64748b);
  margin-top: 4px;
}

/* 面板过渡 */
.panel-left-enter-active { animation: slideInLeft 0.3s ease-out; }
.panel-left-leave-active { animation: slideInLeft 0.25s ease-in reverse; }
.panel-right-enter-active { animation: slideInRight 0.3s ease-out; }
.panel-right-leave-active { animation: slideInRight 0.25s ease-in reverse; }

/* 移动端 */
@media (max-width: 768px) {
  .cemetery-layout { top: 48px; }
  .cemetery-body { flex-direction: column; }
}
</style>
