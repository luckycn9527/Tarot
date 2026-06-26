import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEFAULT_CARD_BACKS = ['pocket.png', 'celestial-gold.png', 'amethyst.png'];

/** 将仓库内默认资源复制到 uploads，避免 DB 中 /uploads/card-backs/*.png 指向不存在的文件 */
export function ensureDefaultUploadAssets(uploadsRoot: string): void {
  const cardBacksDir = path.join(uploadsRoot, 'card-backs');
  fs.mkdirSync(cardBacksDir, { recursive: true });

  for (const filename of DEFAULT_CARD_BACKS) {
    const dest = path.join(cardBacksDir, filename);
    if (fs.existsSync(dest)) continue;

    const src = path.join(__dirname, '..', 'assets', 'card-backs', filename);
    if (!fs.existsSync(src)) {
      console.warn(`⚠️ 默认牌背 ${filename} 未找到:`, src);
      continue;
    }
    fs.copyFileSync(src, dest);
    console.log(`📎 已写入默认文件 uploads/card-backs/${filename}`);
  }
}
