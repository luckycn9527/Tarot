import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { getUploadsRoot } from '../config/uploadsRoot.js';

const THUMB_SIZE = 128;

function normalizeUploadPublicPath(value: string): string | null {
  const s = value.trim();
  if (!s) return null;
  if (s.startsWith('/uploads/')) return s.split(/[?#]/, 1)[0] || null;
  if (!/^https?:\/\//i.test(s)) return null;

  try {
    const url = new URL(s);
    return url.pathname.startsWith('/uploads/') ? url.pathname : null;
  } catch {
    return null;
  }
}

/** 原图公开路径 /uploads/admin/xxx.png → 缩略图 /uploads/admin/xxx-thumb.webp */
export function readerAvatarThumbPublicUrl(originalPublicUrl: string): string | null {
  const s = originalPublicUrl.trim();
  const normalized = normalizeUploadPublicPath(originalPublicUrl);
  if (!normalized) return null;
  const prefix = '/uploads/admin/';
  if (!normalized.startsWith(prefix)) return null;
  const base = normalized.slice(prefix.length);
  const stem = base.replace(/\.[^.]+$/, '');
  const thumbPath = `${prefix}${stem}-thumb.webp`;
  if (!/^https?:\/\//i.test(s)) return thumbPath;

  try {
    const url = new URL(s);
    url.pathname = thumbPath;
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return thumbPath;
  }
}

export function publicUploadsToFs(publicPath: string): string | null {
  const normalized = normalizeUploadPublicPath(publicPath);
  if (!normalized) return null;
  const rel = normalized.slice('/uploads/'.length);
  return path.join(getUploadsRoot(), rel);
}

/** 返回对应 thumb URL；本地文件缺失时也交给前端图片加载回退到原图 */
export function resolveReaderAvatarThumbUrl(avatarUrl: string | null | undefined): string | null {
  const a = avatarUrl?.trim();
  if (!a) return null;
  const thumb = readerAvatarThumbPublicUrl(a);
  if (!thumb) return null;
  const fsPath = publicUploadsToFs(thumb);
  if (fsPath && fs.existsSync(fsPath)) return thumb;
  return thumb;
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
