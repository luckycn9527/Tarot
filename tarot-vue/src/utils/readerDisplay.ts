import type { ReaderInfo } from '@/data/readers'
import { publicAssetUrl } from '@/utils/publicAssetUrl'

type ReaderAvatarPreference = 'original' | 'thumb'

interface ReaderAvatarSrcOptions {
  prefer?: ReaderAvatarPreference
}

const DEFAULT_READER_AVATAR_PATHS: Record<string, string> = {
  qinghe: '/uploads/admin/reader-avatar-1782960454614-0bfrh1.webp',
  yanxi: '/uploads/admin/reader-avatar-1782959591352-uasai2.webp',
  haruka: '/uploads/admin/reader-avatar-1782959711684-b5ojao.webp',
  xuanyin: '/uploads/admin/reader-avatar-1782960447799-luqziq.webp',
  mirelle: '/uploads/admin/reader-avatar-1782960641249-80wz1i.webp',
  lingsha: '/uploads/admin/reader-avatar-1782960693213-5qgk04.webp',
  norick: '/uploads/admin/reader-avatar-1782455668968-8q3wwt.png',
  amara: '/uploads/admin/reader-avatar-1782455677013-40p1jo.png',
  vikram: '/uploads/admin/reader-avatar-1782455682918-afvb3n.png',
  catalina: '/uploads/admin/reader-avatar-1782455688279-1af74q.png',
  kazuki: '/uploads/admin/reader-avatar-1782455692476-dold9j.png',
  solveig: '/uploads/admin/reader-avatar-1782455696944-o6bgis.png',
}

function toThumbPath(path: string): string {
  if (!path.startsWith('/uploads/admin/')) return path
  return path.replace(/\.[^.]+$/, '-thumb.webp')
}

function defaultReaderAvatarPath(id: string | undefined, prefer: ReaderAvatarPreference): string {
  if (!id) return ''
  const original = DEFAULT_READER_AVATAR_PATHS[id]
  if (!original) return ''
  return prefer === 'thumb' ? toThumbPath(original) : original
}

export function getReaderAvatarSrc(
  reader: Pick<ReaderInfo, 'id' | 'avatarUrl' | 'avatarThumbUrl'>,
  options: ReaderAvatarSrcOptions = {},
): string {
  const prefer = options.prefer ?? 'thumb'
  const raw = prefer === 'thumb'
    ? reader.avatarThumbUrl || reader.avatarUrl || defaultReaderAvatarPath(reader.id, 'thumb')
    : reader.avatarUrl || reader.avatarThumbUrl || defaultReaderAvatarPath(reader.id, 'original')
  if (raw == null || String(raw).trim() === '') return ''
  return publicAssetUrl(String(raw).trim())
}
