import { storeToRefs } from 'pinia'
import { useCemeteryStore } from '@/stores/cemetery'

export type {
  TombstoneMarker,
  Tombstone,
  DivinationResult,
} from '@/stores/cemetery'

export function useCemetery() {
  const s = useCemeteryStore()
  const { markers, myTombstone, markersLoaded } = storeToRefs(s)
  return {
    markers,
    myTombstone,
    markersLoaded,
    fetchMarkers: (force?: boolean) => s.fetchMarkers(force),
    fetchMyTombstone: (force?: boolean) => s.fetchMyTombstone(force),
    fetchTombstoneById: (id: number, force?: boolean) => s.fetchTombstoneById(id, force),
    checkPosition: (lng: number, lat: number, force?: boolean) => s.checkPosition(lng, lat, force),
    performDivination: s.performDivination,
    createTombstone: s.createTombstone,
    updateMyTombstone: s.updateMyTombstone,
    deleteMyTombstone: s.deleteMyTombstone,
  }
}
