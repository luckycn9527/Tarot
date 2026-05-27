import { readers as staticReaders } from '../data/readersUi.js';
import type { ReaderInfo } from '../data/readersUi.js';
import type { AdminReaderPrompt } from '../models/admin.model.js';
import { resolveReaderAvatarThumbUrl } from './readerAvatarThumb.js';

function trimOrEmpty(s: string | null | undefined): string {
  if (s == null) return '';
  const t = String(s).trim();
  return t;
}

/** 将静态塔罗师列表与管理端配置合并后下发给前端 */
export function mergeReadersBundle(dbRows: AdminReaderPrompt[]): ReaderInfo[] {
  const byCode = new Map(dbRows.map((r) => [r.reader_code, r]));
  return staticReaders.map((sr) => {
    const db = byCode.get(sr.id);
    const accessLevel = db?.access_level ?? sr.accessLevel;
    const name = trimOrEmpty(db?.display_name) || sr.name;
    const emoji = trimOrEmpty(db?.emoji) || sr.emoji;
    const avatarUrl = trimOrEmpty(db?.avatar_url) || null;
    const avatarThumbUrl = resolveReaderAvatarThumbUrl(avatarUrl);
    return {
      ...sr,
      name,
      emoji,
      accessLevel,
      label: accessLevel === 'vip' ? 'VIP' : '免费',
      avatarUrl,
      avatarThumbUrl,
    };
  });
}
