import path from 'path';
import { fileURLToPath } from 'url';

/**
 * 解析 tarot-server/uploads 绝对路径（与 process.cwd() 无关）。
 * 本文件位于 dist/config/ 下运行时：dist/config → .. → dist → .. → tarot-server → uploads
 */
export function getUploadsRoot(): string {
  const d = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(d, '..', '..', 'uploads');
}
