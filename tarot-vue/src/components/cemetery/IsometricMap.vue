<script setup lang="ts">
import { ref, watch, onBeforeUnmount, computed } from 'vue'
import {
  MglMap,
  MglNavigationControl,
  MglMarker,
} from '@indoorequal/vue-maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { TombstoneMarker } from '../../composables/useCemetery'
import type { Map as MaplibreMap, MapMouseEvent } from 'maplibre-gl'
import { generateTombSvg, parseTombstoneStyle, getColorById } from '../../data/tombstoneStyles'

export interface CemeteryRegion {
  minLng: number
  maxLng: number
  minLat: number
  maxLat: number
}

const props = withDefaults(defineProps<{
  markers?: TombstoneMarker[]
  mode?: 'view' | 'select'
  recommendedRegion?: CemeteryRegion | null
  selectedPosition?: { lng: number; lat: number } | null
}>(), {
  markers: () => [],
  mode: 'view',
  recommendedRegion: null,
  selectedPosition: null,
})

const emit = defineEmits<{
  (e: 'select', pos: { lng: number; lat: number }): void
  (e: 'markerClick', marker: TombstoneMarker): void
}>()

const mapInstance = ref<MaplibreMap | null>(null)
const mapLoaded = ref(false)
let pendingCenter: { lng: number; lat: number; zoom: number } | null = null

const regionStyle = ref<{ left: string; top: string; width: string; height: string } | null>(null)

const mapStyle = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'

function snapCoord(v: number): number {
  return parseFloat((Math.round(v * 100) / 100).toFixed(2))
}

function getMarkerStyle(style: string): Record<string, string> {
  const { colorId } = parseTombstoneStyle(style)
  const color = getColorById(colorId)
  return {
    '--tomb-glow': color.glow,
    '--tomb-primary': color.primary,
  }
}

function getTombSvgHtml(style: string): string {
  return generateTombSvg(style, 36, 54)
}

// ===== 赛博朋克主题 =====
function applyCyberTheme(map: MaplibreMap) {
  const s = map.getStyle()
  if (!s?.layers) return

  for (const layer of s.layers) {
    try {
      const id = layer.id.toLowerCase()

      if (layer.type === 'background') {
        map.setPaintProperty(layer.id, 'background-color', '#0a0e27')
      } else if (layer.type === 'fill') {
        if (id.includes('water')) {
          map.setPaintProperty(layer.id, 'fill-color', '#0c1445')
        } else if (id.includes('park') || id.includes('green') || id.includes('landuse')) {
          map.setPaintProperty(layer.id, 'fill-color', '#111a3a')
        } else {
          map.setPaintProperty(layer.id, 'fill-color', '#131830')
        }
      } else if (layer.type === 'line') {
        if (id.includes('boundary') || id.includes('admin') || id.includes('border')) {
          map.setPaintProperty(layer.id, 'line-color', 'rgba(168, 85, 247, 0.55)')
          map.setPaintProperty(layer.id, 'line-width', 1)
        } else if (id.includes('road') || id.includes('highway')) {
          map.setPaintProperty(layer.id, 'line-color', 'rgba(99, 102, 241, 0.12)')
          try { map.setPaintProperty(layer.id, 'line-width', 0.4) } catch { /* noop */ }
        } else if (id.includes('tunnel') || id.includes('bridge') || id.includes('rail')) {
          map.setLayoutProperty(layer.id, 'visibility', 'none')
        } else {
          map.setPaintProperty(layer.id, 'line-color', 'rgba(99, 102, 241, 0.08)')
        }
      } else if (layer.type === 'symbol') {
        if (id.includes('country') || id.includes('continent') || id.includes('state')) {
          map.setPaintProperty(layer.id, 'text-color', 'rgba(192, 180, 255, 0.5)')
          try { map.setPaintProperty(layer.id, 'text-halo-color', 'rgba(10, 14, 39, 0.8)') } catch { /* noop */ }
          try { map.setPaintProperty(layer.id, 'text-halo-width', 1) } catch { /* noop */ }
        } else if (id.includes('city') || id.includes('town') || id.includes('capital')) {
          map.setPaintProperty(layer.id, 'text-color', 'rgba(148, 163, 184, 0.3)')
          try { map.setPaintProperty(layer.id, 'text-halo-color', 'transparent') } catch { /* noop */ }
        } else {
          map.setLayoutProperty(layer.id, 'visibility', 'none')
        }
      }
    } catch {
      // skip layers that don't support the property
    }
  }
}

// ===== 推荐区域 overlay =====
function updateRegionOverlay() {
  const m = mapInstance.value
  if (!m || !props.recommendedRegion) {
    regionStyle.value = null
    return
  }
  const r = props.recommendedRegion
  const topLeft = m.project([r.minLng, r.maxLat])
  const bottomRight = m.project([r.maxLng, r.minLat])
  const left = Math.min(topLeft.x, bottomRight.x)
  const top = Math.min(topLeft.y, bottomRight.y)
  const width = Math.abs(bottomRight.x - topLeft.x)
  const height = Math.abs(bottomRight.y - topLeft.y)
  regionStyle.value = { left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` }
}

function bindRegionUpdateEvents() {
  const m = mapInstance.value
  if (!m) return
  m.on('move', updateRegionOverlay)
  m.on('zoom', updateRegionOverlay)
  m.on('resize', updateRegionOverlay)
}

function unbindRegionUpdateEvents() {
  const m = mapInstance.value
  if (!m) return
  m.off('move', updateRegionOverlay)
  m.off('zoom', updateRegionOverlay)
  m.off('resize', updateRegionOverlay)
}

watch(() => props.recommendedRegion, () => updateRegionOverlay(), { deep: true })

function onMapLoaded(e: { map: MaplibreMap; type: string }) {
  const m = e.map
  if (!m) return
  mapInstance.value = m
  mapLoaded.value = true

  applyCyberTheme(m)

  if (pendingCenter) {
    m.flyTo({ center: [pendingCenter.lng, pendingCenter.lat], zoom: pendingCenter.zoom, duration: 1500 })
    pendingCenter = null
  }

  if (props.mode === 'select') {
    m.getCanvas().style.cursor = 'crosshair'
  }

  bindRegionUpdateEvents()
  updateRegionOverlay()

  m.on('click', (e: MapMouseEvent) => {
    if (props.mode !== 'select') return
    const { lng, lat } = e.lngLat
    emit('select', { lng: snapCoord(lng), lat: snapCoord(lat) })
  })
}

watch(() => props.mode, (mode) => {
  const m = mapInstance.value
  if (!m) return
  m.getCanvas().style.cursor = mode === 'select' ? 'crosshair' : ''
})

onBeforeUnmount(() => {
  unbindRegionUpdateEvents()
})

// ===== 公开方法 =====
function centerOn(lng: number, lat: number, zoom = 6) {
  const m = mapInstance.value
  if (!m || !mapLoaded.value) {
    pendingCenter = { lng, lat, zoom }
    return
  }
  m.flyTo({ center: [lng, lat], zoom, duration: 1500 })
}

function fitMarkers() {
  const m = mapInstance.value
  if (!m || props.markers.length === 0) return
  if (props.markers.length === 1) {
    const mk = props.markers[0]
    m.flyTo({ center: [mk.longitude, mk.latitude], zoom: 6, duration: 1500 })
    return
  }
  const lngs = props.markers.map(mk => mk.longitude)
  const lats = props.markers.map(mk => mk.latitude)
  const sw: [number, number] = [Math.min(...lngs) - 1, Math.min(...lats) - 1]
  const ne: [number, number] = [Math.max(...lngs) + 1, Math.max(...lats) + 1]
  m.fitBounds([sw, ne], { padding: 60, duration: 1500 })
}

const zoomPercent = computed(() => {
  const m = mapInstance.value
  if (!m) return 100
  return Math.round((m.getZoom() / 18) * 100)
})

function zoomIn() { mapInstance.value?.zoomIn({ duration: 300 }) }
function zoomOut() { mapInstance.value?.zoomOut({ duration: 300 }) }
function onMarkerClicked(marker: TombstoneMarker) { emit('markerClick', marker) }

defineExpose({ centerOn, zoomIn, zoomOut, zoomPercent, fitMarkers })
</script>

<template>
  <div class="relative w-full h-full cyber-map-wrapper">
    <MglMap
      :map-style="mapStyle"
      :center="[0, 20]"
      :zoom="1.5"
      :min-zoom="1"
      :max-zoom="18"
      height="100%"
      :attribution-control="false"
      @map:load="onMapLoaded"
    >
      <MglNavigationControl position="bottom-right" />

      <!-- 赛博墓碑 3D 标记 -->
      <MglMarker
        v-for="m in markers"
        :key="m.id"
        :coordinates="[m.longitude, m.latitude]"
        anchor="bottom"
      >
        <template #marker>
          <div
            class="cyber-tomb"
            :style="getMarkerStyle(m.style)"
            @click.stop="onMarkerClicked(m)"
          >
            <div class="tomb-svg" v-html="getTombSvgHtml(m.style)" />
            <div class="tomb-label">{{ m.name }}</div>
          </div>
        </template>
      </MglMarker>

      <!-- 选中位置脉冲标记 -->
      <MglMarker
        v-if="selectedPosition"
        :coordinates="[selectedPosition.lng, selectedPosition.lat]"
        anchor="center"
      >
        <template #marker>
          <div class="selected-marker">
            <div class="pulse-ring" />
            <div class="marker-dot" />
          </div>
        </template>
      </MglMarker>
    </MglMap>

    <!-- 推荐区域 overlay -->
    <div
      v-if="regionStyle"
      class="region-overlay"
      :style="regionStyle"
    />

    <!-- 氛围层 -->
    <div class="atmos-scanlines" />
    <div class="atmos-vignette" />

    <!-- 选位模式提示 -->
    <div
      v-if="mode === 'select'"
      class="absolute top-3 left-3 text-xs text-cyan-300 bg-black/70 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-cyan-500/20 z-20"
    >
      在地图上点击选择墓碑位置（高亮区域为推荐位置）
    </div>
  </div>
</template>

<style scoped>
/* 地图控件暗色主题 */
.cyber-map-wrapper :deep(.maplibregl-ctrl-group) {
  background: rgba(13, 13, 36, 0.85);
  border: 1px solid rgba(99, 102, 241, 0.2);
  border-radius: 8px;
  overflow: hidden;
}
.cyber-map-wrapper :deep(.maplibregl-ctrl-group button) {
  width: 32px;
  height: 32px;
  filter: invert(0.8);
}
.cyber-map-wrapper :deep(.maplibregl-ctrl-group button + button) {
  border-top: 1px solid rgba(99, 102, 241, 0.15);
}
.cyber-map-wrapper :deep(.maplibregl-ctrl-attrib) {
  display: none;
}

/* 推荐区域 */
.region-overlay {
  position: absolute;
  pointer-events: none;
  background: rgba(147, 51, 234, 0.2);
  border: 2px dashed rgba(168, 85, 247, 0.6);
  box-shadow: inset 0 0 30px rgba(168, 85, 247, 0.15), 0 0 15px rgba(168, 85, 247, 0.25);
  z-index: 10;
  border-radius: 4px;
}

/* ===== 赛博墓碑 3D 标记 ===== */
.cyber-tomb {
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  transition: transform 0.25s ease, filter 0.25s ease;
  filter:
    drop-shadow(0 0 5px var(--tomb-glow, rgba(192,132,252,0.5)))
    drop-shadow(0 0 10px var(--tomb-glow, rgba(192,132,252,0.3)));
  animation: tombBreath 3s ease-in-out infinite;
}
.cyber-tomb:hover {
  transform: scale(1.2) translateY(-4px);
  filter:
    drop-shadow(0 0 8px var(--tomb-glow, rgba(192,132,252,0.5)))
    drop-shadow(0 0 18px var(--tomb-glow, rgba(192,132,252,0.5)));
  z-index: 10;
}

.tomb-svg {
  pointer-events: none;
  line-height: 0;
}

.tomb-label {
  margin-top: 2px;
  padding: 1px 8px;
  border-radius: 3px;
  background: rgba(5, 5, 16, 0.92);
  color: var(--tomb-primary, #c084fc);
  font-size: 10px;
  font-weight: 600;
  white-space: nowrap;
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  border: 1px solid color-mix(in srgb, var(--tomb-primary, #c084fc) 25%, transparent);
  text-shadow: 0 0 6px var(--tomb-glow, rgba(192,132,252,0.5));
}

/* 选中位置脉冲 */
.selected-marker {
  position: relative;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.marker-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #22d3ee;
  border: 2px solid #fff;
  box-shadow: 0 0 10px rgba(34, 211, 238, 0.8);
  z-index: 1;
}
.pulse-ring {
  position: absolute;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid #22d3ee;
  animation: pulse 1.5s ease-out infinite;
}

/* ===== 氛围层 ===== */
.atmos-scanlines {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 5;
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 4px,
    rgba(100, 80, 255, 0.012) 4px,
    rgba(100, 80, 255, 0.012) 5px
  );
}
.atmos-vignette {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 5;
  background: radial-gradient(
    ellipse at 50% 50%,
    transparent 50%,
    rgba(10, 14, 39, 0.35) 100%
  );
}

/* ===== 动画 ===== */
@keyframes tombBreath {
  0%, 100% {
    filter:
      drop-shadow(0 0 4px var(--tomb-glow, rgba(192,132,252,0.5)))
      drop-shadow(0 0 8px var(--tomb-glow, rgba(192,132,252,0.3)));
  }
  50% {
    filter:
      drop-shadow(0 0 8px var(--tomb-glow, rgba(192,132,252,0.5)))
      drop-shadow(0 0 18px var(--tomb-glow, rgba(192,132,252,0.5)));
  }
}
@keyframes pulse {
  0% { transform: scale(1); opacity: 0.8; }
  100% { transform: scale(2.5); opacity: 0; }
}
</style>
