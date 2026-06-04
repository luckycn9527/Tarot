/**
 * 一次性脚本：从公有领域的 Rider-Waite-Smith 牌面仓库 (metabismuth/tarot-json, 经 jsDelivr CDN)
 * 下载全部 78 张牌面到本地 uploads/cards/，文件名按 nameEn 规范化 (与 getCardImageUrl 对齐)。
 *
 * 运行: npx tsx src/scripts/downloadTarotImages.ts
 *
 * 映射规则 (源仓库命名):
 *   - 大阿卡纳 id 0-21  -> m00.jpg .. m21.jpg
 *   - 权杖 Wands     id 22-35 -> w01.jpg .. w14.jpg
 *   - 圣杯 Cups      id 36-49 -> c01.jpg .. c14.jpg
 *   - 宝剑 Swords    id 50-63 -> s01.jpg .. s14.jpg
 *   - 钱币 Pentacles id 64-77 -> p01.jpg .. p14.jpg
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { tarotCards } from '../data/tarotCards.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '..', '..', 'uploads', 'cards');
const CDN = 'https://cdn.jsdelivr.net/gh/metabismuth/tarot-json@master/cards';

/** 把 nameEn 规范成文件名 stem，与前后端 getCardImageUrl 的 `nameEn.replace(/ /g,'_')` 对齐 */
function stem(nameEn: string): string {
  return nameEn.replace(/ /g, '_');
}

/** 由牌 id 推出源仓库文件名 (m=major, w=wands, c=cups, s=swords, p=pentacles) */
function sourceFile(id: number): string {
  if (id <= 21) return `m${String(id).padStart(2, '0')}.jpg`;
  const minorIndex = id - 22; // 0..55
  const suit = Math.floor(minorIndex / 14); // 0=wands,1=cups,2=swords,3=pentacles
  const rank = (minorIndex % 14) + 1; // 1..14
  const prefix = ['w', 'c', 's', 'p'][suit];
  return `${prefix}${String(rank).padStart(2, '0')}.jpg`;
}

async function downloadOne(url: string, dest: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest, buf);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log(`📥 下载 ${tarotCards.length} 张牌面到 ${OUT_DIR}`);

  let ok = 0;
  let fail = 0;
  for (const card of tarotCards) {
    const src = `${CDN}/${sourceFile(card.id)}`;
    const dest = path.join(OUT_DIR, `${stem(card.nameEn)}.jpg`);
    try {
      await downloadOne(src, dest);
      ok += 1;
      process.stdout.write(`\r  [${ok + fail}/${tarotCards.length}] ${card.nameEn} ✓   `);
    } catch (e) {
      fail += 1;
      console.error(`\n  ✗ ${card.nameEn} (id=${card.id}) <- ${src}: ${(e as Error).message}`);
    }
  }
  console.log(`\n✅ 完成: 成功 ${ok}, 失败 ${fail}`);
}

void main();
