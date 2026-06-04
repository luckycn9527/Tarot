/**
 * 一次性脚本：生成几款精美的塔罗牌背 SVG 到 uploads/card-backs/。
 * 全部为原创几何/神秘主题图案 (无版权问题)，矢量清晰、体积小。
 *
 * 运行: npx tsx src/scripts/generateCardBacks.ts
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '..', '..', 'uploads', 'card-backs');

const W = 300;
const H = 500;

/** 公共：外框 + 圆角边 */
function frame(stroke: string, inner: string): string {
  return `
    <rect x="0" y="0" width="${W}" height="${H}" rx="18" fill="url(#bg)"/>
    <rect x="10" y="10" width="${W - 20}" height="${H - 20}" rx="12" fill="none" stroke="${stroke}" stroke-width="2"/>
    <rect x="18" y="18" width="${W - 36}" height="${H - 36}" rx="9" fill="none" stroke="${inner}" stroke-width="1"/>
  `;
}

/** 1. 星轨 · 深紫金 (Celestial) */
function celestial(): string {
  const cx = W / 2;
  const cy = H / 2;
  const rings = [120, 96, 72, 48].map((r, i) =>
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#d4af37" stroke-opacity="${0.5 - i * 0.08}" stroke-width="${1.2 - i * 0.15}"/>`,
  ).join('');
  // 12 条星芒
  const rays = Array.from({ length: 12 }, (_, i) => {
    const a = (i * 30 * Math.PI) / 180;
    const x1 = cx + Math.cos(a) * 48;
    const y1 = cy + Math.sin(a) * 48;
    const x2 = cx + Math.cos(a) * 120;
    const y2 = cy + Math.sin(a) * 120;
    return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#d4af37" stroke-opacity="0.25" stroke-width="0.8"/>`;
  }).join('');
  const stars = Array.from({ length: 40 }, (_, i) => {
    const x = ((i * 73) % 280) + 10;
    const y = ((i * 131) % 460) + 20;
    const r = (i % 3) * 0.6 + 0.6;
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="#f5e9ff" opacity="${0.3 + (i % 4) * 0.15}"/>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <defs>
      <radialGradient id="bg" cx="50%" cy="42%" r="75%">
        <stop offset="0%" stop-color="#2a1a4a"/>
        <stop offset="55%" stop-color="#160b24"/>
        <stop offset="100%" stop-color="#0a0512"/>
      </radialGradient>
    </defs>
    ${frame('#d4af37', 'rgba(212,175,55,0.3)')}
    ${stars}
    ${rays}
    ${rings}
    <circle cx="${cx}" cy="${cy}" r="22" fill="#0a0512" stroke="#d4af37" stroke-width="1.5"/>
    <circle cx="${cx}" cy="${cy}" r="8" fill="#d4af37" opacity="0.85"/>
    <text x="${cx}" y="${cy + 4}" text-anchor="middle" font-size="14" fill="#160b24" font-family="serif">✦</text>
  </svg>`;
}

/** 2. 月相 · 靛蓝银 (Lunar) */
function lunar(): string {
  const cx = W / 2;
  const cy = H / 2;
  const phases = Array.from({ length: 8 }, (_, i) => {
    const a = (i * 45 * Math.PI) / 180 - Math.PI / 2;
    const x = cx + Math.cos(a) * 95;
    const y = cy + Math.sin(a) * 95;
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6" fill="none" stroke="#c4b5fd" stroke-width="1" opacity="0.6"/>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <defs>
      <radialGradient id="bg" cx="50%" cy="45%" r="80%">
        <stop offset="0%" stop-color="#1e2a5a"/>
        <stop offset="60%" stop-color="#0f1430"/>
        <stop offset="100%" stop-color="#070a18"/>
      </radialGradient>
      <radialGradient id="moon" cx="40%" cy="35%" r="70%">
        <stop offset="0%" stop-color="#f5f0ff"/>
        <stop offset="60%" stop-color="#c4b5fd"/>
        <stop offset="100%" stop-color="#6d59b8"/>
      </radialGradient>
    </defs>
    ${frame('#c4b5fd', 'rgba(196,181,253,0.3)')}
    ${phases}
    <circle cx="${cx}" cy="${cy}" r="115" fill="none" stroke="#c4b5fd" stroke-opacity="0.2" stroke-width="1"/>
    <circle cx="${cx}" cy="${cy}" r="46" fill="url(#moon)"/>
    <circle cx="${cx + 14}" cy="${cy - 6}" r="40" fill="#0f1430" opacity="0.55"/>
    <circle cx="${cx - 18}" cy="${cy + 10}" r="4" fill="#6d59b8" opacity="0.5"/>
    <circle cx="${cx - 6}" cy="${cy - 16}" r="3" fill="#6d59b8" opacity="0.4"/>
  </svg>`;
}

/** 3. 神圣几何 · 翡翠金 (Sacred) — 花之生命 */
function sacred(): string {
  const cx = W / 2;
  const cy = H / 2;
  const r = 34;
  const centers: [number, number][] = [[cx, cy]];
  for (let i = 0; i < 6; i++) {
    const a = (i * 60 * Math.PI) / 180;
    centers.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  for (let i = 0; i < 6; i++) {
    const a = (i * 60 * Math.PI) / 180;
    centers.push([cx + Math.cos(a) * r * 2, cy + Math.sin(a) * r * 2]);
    const a2 = ((i * 60 + 30) * Math.PI) / 180;
    centers.push([cx + Math.cos(a2) * r * Math.sqrt(3), cy + Math.sin(a2) * r * Math.sqrt(3)]);
  }
  const circles = centers.map(([x, y]) =>
    `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="none" stroke="#5eead4" stroke-opacity="0.4" stroke-width="0.9"/>`,
  ).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <defs>
      <radialGradient id="bg" cx="50%" cy="50%" r="75%">
        <stop offset="0%" stop-color="#0b2e2a"/>
        <stop offset="60%" stop-color="#08201d"/>
        <stop offset="100%" stop-color="#04110f"/>
      </radialGradient>
    </defs>
    ${frame('#5eead4', 'rgba(94,234,212,0.25)')}
    <circle cx="${cx}" cy="${cy}" r="${r * 3}" fill="none" stroke="#d4af37" stroke-opacity="0.4" stroke-width="1.5"/>
    ${circles}
    <circle cx="${cx}" cy="${cy}" r="5" fill="#d4af37"/>
  </svg>`;
}

/** 4. 玫瑰十字 · 暗红金 (Rosicrucian) — 经典塔罗牌背母题 */
function rose(): string {
  const cx = W / 2;
  const cy = H / 2;
  const lattice = [];
  for (let gx = 40; gx < W - 30; gx += 26) {
    lattice.push(`<line x1="${gx}" y1="30" x2="${gx}" y2="${H - 30}" stroke="#d4af37" stroke-opacity="0.08" stroke-width="0.6"/>`);
  }
  for (let gy = 40; gy < H - 30; gy += 26) {
    lattice.push(`<line x1="30" y1="${gy}" x2="${W - 30}" y2="${gy}" stroke="#d4af37" stroke-opacity="0.08" stroke-width="0.6"/>`);
  }
  const petals = Array.from({ length: 8 }, (_, i) => {
    const a = (i * 45 * Math.PI) / 180;
    const x = cx + Math.cos(a) * 30;
    const y = cy + Math.sin(a) * 30;
    return `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="16" ry="7" fill="#b91c4b" opacity="0.55" transform="rotate(${i * 45} ${x.toFixed(1)} ${y.toFixed(1)})"/>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <defs>
      <radialGradient id="bg" cx="50%" cy="50%" r="75%">
        <stop offset="0%" stop-color="#3a0f1a"/>
        <stop offset="60%" stop-color="#220810"/>
        <stop offset="100%" stop-color="#120308"/>
      </radialGradient>
    </defs>
    ${frame('#d4af37', 'rgba(212,175,55,0.3)')}
    ${lattice.join('')}
    <line x1="${cx}" y1="${cy - 70}" x2="${cx}" y2="${cy + 70}" stroke="#d4af37" stroke-width="3" opacity="0.7"/>
    <line x1="${cx - 70}" y1="${cy}" x2="${cx + 70}" y2="${cy}" stroke="#d4af37" stroke-width="3" opacity="0.7"/>
    ${petals}
    <circle cx="${cx}" cy="${cy}" r="12" fill="#b91c4b"/>
    <circle cx="${cx}" cy="${cy}" r="5" fill="#d4af37"/>
  </svg>`;
}

const designs: { code: string; name: string; description: string; svg: string; sort: number }[] = [
  { code: 'celestial', name: '星轨', description: '深紫金调 · 星轨环绕罗盘', svg: celestial(), sort: 1 },
  { code: 'lunar', name: '月相', description: '靛蓝银调 · 八相月轮', svg: lunar(), sort: 2 },
  { code: 'sacred', name: '生命之花', description: '翡翠金调 · 神圣几何', svg: sacred(), sort: 3 },
  { code: 'rose', name: '玫瑰十字', description: '暗红金调 · 经典玫瑰十字', svg: rose(), sort: 4 },
];

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const d of designs) {
    const file = path.join(OUT_DIR, `${d.code}.svg`);
    fs.writeFileSync(file, d.svg.trim());
    console.log(`  ✓ ${d.code}.svg (${d.name})`);
  }
  // 输出可用于迁移的 SQL 片段
  console.log('\n-- SQL 片段（card_backs 插入）:');
  for (const d of designs) {
    console.log(
      `INSERT INTO card_backs (code, name, description, asset_url, is_active, sort_order, access_type) VALUES ('${d.code}', '${d.name}', '${d.description}', '/uploads/card-backs/${d.code}.svg', 1, ${d.sort}, 'free') ON DUPLICATE KEY UPDATE name=VALUES(name), description=VALUES(description), asset_url=VALUES(asset_url), is_active=1, sort_order=VALUES(sort_order);`,
    );
  }
  console.log(`\n✅ 生成 ${designs.length} 款牌背 -> ${OUT_DIR}`);
}

main();
