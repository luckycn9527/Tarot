import { shallowRef, type ShallowRef } from 'vue'

/** 塔罗师 UI 元数据由 GET /api/reference/bundle 注入 */
export interface ReaderInfo {
  id: string
  name: string
  emoji: string
  gradient: string
  badge: string
  accessLevel: 'free' | 'vip'
  label: string
  desc: string
  likes: string
  /** 管理端头像 URL；无则展示 emoji */
  avatarUrl: string | null
  /** 小图优先用缩略图（减轻流量）；无则回退 avatarUrl */
  avatarThumbUrl?: string | null
}

/** 响应式列表：bundle 异步到达后视图能更新（勿用普通数组，否则 computed 不刷新） */
export const readers: ShallowRef<ReaderInfo[]> = shallowRef([])

export function getReaderById(id: string): ReaderInfo | undefined {
  return readers.value.find(r => r.id === id)
}

export function applyReadersFromApi(list: ReaderInfo[]) {
  readers.value = list.length ? [...list] : []
}
