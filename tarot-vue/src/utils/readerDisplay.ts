import type { ReaderInfo } from '@/data/readers'
import { publicAssetUrl } from '@/utils/publicAssetUrl'

/** 塔罗师列表/阅读页统一：优先缩略图，再原图 */
export function getReaderAvatarSrc(reader: Pick<ReaderInfo, 'avatarUrl' | 'avatarThumbUrl'>): string {
  const raw = reader.avatarThumbUrl || reader.avatarUrl
  if (raw == null || String(raw).trim() === '') return ''
  return publicAssetUrl(String(raw).trim())
}
