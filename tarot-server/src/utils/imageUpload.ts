import fs from 'fs/promises';
import path from 'path';
import type { Request } from 'express';
import sharp from 'sharp';
import { getUploadsRoot } from '../config/uploadsRoot.js';

const SUPPORTED_MIME = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const MAX_IMAGE_PIXELS = 16_000_000;

export interface StoredImage {
  filename: string;
  absPath: string;
  publicUrl: string;
}

interface StoreImageOptions {
  folder: 'avatars' | 'admin';
  prefix: string;
  maxDimension: number;
  quality?: number;
}

function safePrefix(prefix: string): string {
  const cleaned = prefix.toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-');
  return cleaned.replace(/^-|-$/g, '') || 'image';
}

export function imageMimeFilter(_req: Request, file: Express.Multer.File, cb: (err: Error | null, acceptFile?: boolean) => void): void {
  if (SUPPORTED_MIME.has(file.mimetype)) {
    cb(null, true);
    return;
  }
  cb(new Error('仅支持 JPG/PNG/GIF/WebP 图片格式'));
}

export async function storeUploadedImage(file: Express.Multer.File, options: StoreImageOptions): Promise<StoredImage> {
  if (!file.buffer?.length) {
    throw new Error('上传文件为空');
  }

  const uploadsRoot = getUploadsRoot();
  const targetDir = path.join(uploadsRoot, options.folder);
  await fs.mkdir(targetDir, { recursive: true });

  const metadata = await sharp(file.buffer, {
    limitInputPixels: MAX_IMAGE_PIXELS,
    animated: false,
  }).metadata();

  if (!metadata.width || !metadata.height || !metadata.format) {
    throw new Error('无法识别图片内容');
  }
  if (!['jpeg', 'png', 'webp', 'gif'].includes(metadata.format)) {
    throw new Error('仅支持 JPG/PNG/GIF/WebP 图片格式');
  }

  const stem = `${safePrefix(options.prefix)}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const filename = `${stem}.webp`;
  const absPath = path.join(targetDir, filename);

  await sharp(file.buffer, {
    limitInputPixels: MAX_IMAGE_PIXELS,
    animated: false,
  })
    .rotate()
    .resize({
      width: options.maxDimension,
      height: options.maxDimension,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: options.quality ?? 86 })
    .toFile(absPath);

  return {
    filename,
    absPath,
    publicUrl: `/uploads/${options.folder}/${filename}`,
  };
}
