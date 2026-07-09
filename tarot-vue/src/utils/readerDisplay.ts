import type { ReaderInfo } from '@/data/readers'
import { publicAssetUrl } from '@/utils/publicAssetUrl'

type ReaderAvatarPreference = 'original' | 'thumb'

interface ReaderAvatarSrcOptions {
  prefer?: ReaderAvatarPreference
}

export function getReaderAvatarSrc(
  reader: Pick<ReaderInfo, 'avatarUrl' | 'avatarThumbUrl'>,
  options: ReaderAvatarSrcOptions = {},
): string {
  const prefer = options.prefer ?? 'thumb'
  const raw = prefer === 'thumb'
    ? reader.avatarThumbUrl || reader.avatarUrl
    : reader.avatarUrl || reader.avatarThumbUrl
  if (raw == null || String(raw).trim() === '') return ''
  return publicAssetUrl(String(raw).trim())
}
