import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** 将仓库内默认资源复制到 uploads，避免 DB 中 /uploads/card-backs/pocket.png 指向不存在的文件 */
export function ensureDefaultUploadAssets(uploadsRoot: string): void {
  const pocketDest = path.join(uploadsRoot, 'card-backs', 'pocket.png');
  if (fs.existsSync(pocketDest)) return;

  const pocketSrc = path.join(__dirname, '..', 'assets', 'card-backs', 'pocket.png');
  if (!fs.existsSync(pocketSrc)) {
    console.warn('⚠️ 默认牌背 pocket.png 未找到:', pocketSrc);
    return;
  }
  fs.copyFileSync(pocketSrc, pocketDest);
  console.log('📎 已写入默认文件 uploads/card-backs/pocket.png');
}
