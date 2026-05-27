import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { getUploadsRoot } from '../config/uploadsRoot.js';

const THUMB_SIZE = 128;

/** 原图公开路径 /uploads/admin/xxx.png → 缩略图 /uploads/admin/xxx-thumb.webp */
export function readerAvatarThumbPublicUrl(originalPublicUrl: string): string | null {
  const prefix = '/uploads/admin/';
  if (!originalPublicUrl.startsWith(prefix)) return null;
  const base = originalPublicUrl.slice(prefix.length);
  const stem = base.replace(/\.[^.]+$/, '');
  return `${prefix}${stem}-thumb.webp`;
}

export function publicUploadsToFs(publicPath: string): string | null {
  if (!publicPath.startsWith('/uploads/')) return null;
  const rel = publicPath.slice('/uploads/'.length);
  return path.join(getUploadsRoot(), rel);
}

/** 若磁盘上存在对应 thumb 文件则返回其 URL，否则 null（列表用小图时回退原图） */
export function resolveReaderAvatarThumbUrl(avatarUrl: string | null | undefined): string | null {
  const a = avatarUrl?.trim();
  if (!a) return null;
  const thumb = readerAvatarThumbPublicUrl(a);
  if (!thumb) return null;
  const fsPath = publicUploadsToFs(thumb);
  if (fsPath && fs.existsSync(fsPath)) return thumb;
  return null;
}

/**
 * 在源文件同目录生成 {stem}-thumb.webp
 * @returns 缩略图公开路径，失败返回 null
 */
export async function writeReaderAvatarThumbFile(sourceAbsPath: string, originalFilename: string): Promise<string | null> {
  try {
    const stem = originalFilename.replace(/\.[^.]+$/, '');
    const destName = `${stem}-thumb.webp`;
    const destAbs = path.join(path.dirname(sourceAbsPath), destName);
    await sharp(sourceAbsPath)
      .rotate()
      .resize(THUMB_SIZE, THUMB_SIZE, { fit: 'cover', position: 'attention' })
      .webp({ quality: 82 })
      .toFile(destAbs);
    return `/uploads/admin/${destName}`;
  } catch (e) {
    console.warn('[readerAvatarThumb] generate failed:', e);
    return null;
  }
}
