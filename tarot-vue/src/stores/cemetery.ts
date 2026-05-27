import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '@/services/api'
import { CACHE_TTL_MS, isFresh } from '@/stores/cacheTtl'

export interface TombstoneMarker {
  id: number
  longitude: number
  latitude: number
  style: string
  name: string
}

export interface Tombstone {
  id: number
  userId: number
  longitude: number
  latitude: number
  tombstoneStyle: string
  displayName: string
  epitaph: string | null
  tarotCardId: number | null
  hexagramId: number | null
  isPublic: boolean
  viewCount: number
  createdAt: string
  updatedAt: string
}

export interface DivinationResult {
  hexagram: {
    id: number
    name: string
    symbol: string
    meaning: string
    lines: number[]
  }
  tarotCardId: number
  region: {
    minLng: number
    maxLng: number
    minLat: number
    maxLat: number
  }
}

function positionKey(lng: number, lat: number) {
  return `${lng.toFixed(2)},${lat.toFixed(2)}`
}

export const useCemeteryStore = defineStore('cemetery', () => {
  const markers = ref<TombstoneMarker[]>([])
  const myTombstone = ref<Tombstone | null>(null)
  const markersLoaded = ref(false)
  let markersFetchedAt: number | null = null
  let myTombstoneFetchedAt: number | null = null
  const tombstoneDetailAt = ref<Record<number, number>>({})
  const tombstoneDetailData = ref<Record<number, Tombstone>>({})
  const positionAt = ref<Record<string, number>>({})
  const positionAvailable = ref<Record<string, boolean>>({})

  function invalidateMarkers() {
    markersFetchedAt = null
    markersLoaded.value = false
  }

  function invalidateMyTombstone() {
    myTombstoneFetchedAt = null
  }

  /** 登录态变化时清空用户相关与坐标缓存（避免串数据） */
  function clearUserScoped() {
    myTombstone.value = null
    invalidateMyTombstone()
    tombstoneDetailAt.value = {}
    tombstoneDetailData.value = {}
    positionAt.value = {}
    positionAvailable.value = {}
  }

  async function fetchMarkers(force = false): Promise<TombstoneMarker[]> {
    if (!force && markersFetchedAt != null && isFresh(markersFetchedAt, CACHE_TTL_MS.cemeteryMarkers)) {
      return markers.value
    }
    try {
      const res = await api.get('/cemetery/markers')
      if (res.data.success) {
        markers.value = res.data.data
        markersLoaded.value = true
        markersFetchedAt = Date.now()
        return res.data.data
      }
    } catch {
      /* ignore */
    }
    return []
  }

  async function fetchMyTombstone(force = false): Promise<Tombstone | null> {
    if (!force && myTombstoneFetchedAt != null && isFresh(myTombstoneFetchedAt, CACHE_TTL_MS.cemeteryMyTombstone)) {
      return myTombstone.value
    }
    try {
      const res = await api.get('/cemetery/tombstones/me')
      if (res.data.success) {
        myTombstone.value = res.data.data
        myTombstoneFetchedAt = Date.now()
        return res.data.data
      }
    } catch {
      /* ignore */
    }
    return null
  }

  async function fetchTombstoneById(id: number, force = false): Promise<Tombstone | null> {
    const at = tombstoneDetailAt.value[id]
    if (!force && isFresh(at ?? null, CACHE_TTL_MS.cemeteryTombstoneDetail)) {
      const hit = tombstoneDetailData.value[id]
      if (hit) return hit
    }
    try {
      const res = await api.get(`/cemetery/tombstones/${id}`)
      if (res.data.success) {
        tombstoneDetailData.value[id] = res.data.data
        tombstoneDetailAt.value[id] = Date.now()
        return res.data.data
      }
    } catch {
      /* ignore */
    }
    return null
  }

  async function checkPosition(lng: number, lat: number, force = false): Promise<boolean> {
    const key = positionKey(lng, lat)
    const at = positionAt.value[key]
    if (!force && isFresh(at ?? null, CACHE_TTL_MS.cemeteryPosition) && key in positionAvailable.value) {
      return positionAvailable.value[key]!
    }
    try {
      const res = await api.get(`/cemetery/position-check?lng=${lng.toFixed(2)}&lat=${lat.toFixed(2)}`)
      if (res.data.success) {
        const available = res.data.data.available as boolean
        positionAvailable.value[key] = available
        positionAt.value[key] = Date.now()
        return available
      }
    } catch {
      /* ignore */
    }
    return false
  }

  async function performDivination(tarotCardId: number, lines: number[]): Promise<DivinationResult | null> {
    try {
      const res = await api.post('/cemetery/divination', { tarotCardId, lines })
      if (res.data.success) return res.data.data
    } catch {
      /* ignore */
    }
    return null
  }

  async function createTombstone(data: {
    longitude: number
    latitude: number
    tombstoneStyle: string
    displayName: string
    epitaph: string | null
    tarotCardId: number | null
    hexagramId: number | null
  }): Promise<Tombstone | null> {
    const res = await api.post('/cemetery/tombstones', data)
    if (res.data.success) {
      myTombstone.value = res.data.data
      myTombstoneFetchedAt = Date.now()
      invalidateMarkers()
      await fetchMarkers(true)
      return res.data.data
    }
    throw new Error(res.data.message || '创建失败')
  }

  async function updateMyTombstone(data: {
    displayName?: string
    epitaph?: string | null
  }): Promise<Tombstone | null> {
    const res = await api.put('/cemetery/tombstones/me', data)
    if (res.data.success) {
      myTombstone.value = res.data.data
      invalidateMarkers()
      if (myTombstone.value) {
        tombstoneDetailData.value[myTombstone.value.id] = myTombstone.value
        tombstoneDetailAt.value[myTombstone.value.id] = Date.now()
      }
      await fetchMarkers(true)
      return res.data.data
    }
    throw new Error(res.data.message || '更新失败')
  }

  async function deleteMyTombstone(): Promise<void> {
    const res = await api.delete('/cemetery/tombstones/me')
    if (res.data.success) {
      myTombstone.value = null
      invalidateMarkers()
      invalidateMyTombstone()
      positionAt.value = {}
      positionAvailable.value = {}
      await fetchMarkers(true)
      return
    }
    throw new Error(res.data.message || '删除失败')
  }

  return {
    markers,
    myTombstone,
    markersLoaded,
    invalidateMarkers,
    clearUserScoped,
    fetchMarkers,
    fetchMyTombstone,
    fetchTombstoneById,
    checkPosition,
    performDivination,
    createTombstone,
    updateMyTombstone,
    deleteMyTombstone,
  }
})
