/**
 * 生成高精度像素世界地图数据
 *
 * 使用 Natural Earth (world-atlas) TopoJSON + d3-geo 投影光栅化
 * 输出:
 *   - map-terrain.bin (1800×900 Uint8Array, 每字节=地形分类)
 *   - map-cities.json (筛选后的主要城市列表)
 *
 * 分辨率: 1800×900 (0.2°/像素)
 * 地形编码: 0=海洋, 1=陆地
 * 坐标系: x=0..1799 → lon -180..179.8, y=0..899 → lat 90..-89.8
 *
 * 运行: npx tsx scripts/generateMapTerrain.ts
 */

import { writeFileSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// @ts-ignore - world-atlas ships JSON directly, use 10m for highest detail
import countriesData from 'world-atlas/countries-10m.json' with { type: 'json' };
import { feature, mesh } from 'topojson-client';
import { geoEquirectangular, geoPath, geoContains } from 'd3-geo';

const __dirname = dirname(fileURLToPath(import.meta.url));

const WIDTH = 1800;
const HEIGHT = 900;

// ===== 1. 从 TopoJSON 提取 GeoJSON =====
const land = feature(countriesData as any, (countriesData as any).objects.land);
const countries = feature(countriesData as any, (countriesData as any).objects.countries);

// ===== 2. 设置等距圆柱投影 =====
const projection = geoEquirectangular()
  .scale(WIDTH / (2 * Math.PI))
  .translate([WIDTH / 2, HEIGHT / 2]);

// ===== 3. 光栅化陆地 =====
console.log('🗺️  光栅化陆地 ...');
const terrain = new Uint8Array(WIDTH * HEIGHT);

// 使用 geoContains 逐像素判断
for (let y = 0; y < HEIGHT; y++) {
  for (let x = 0; x < WIDTH; x++) {
    // 像素中心 → 经纬度
    const coords = projection.invert!([x + 0.5, y + 0.5]);
    if (!coords) continue;

    const [lon, lat] = coords;

    // 检查是否在陆地上
    for (const f of (land as any).features || [(land as any)]) {
      if (geoContains(f, [lon, lat])) {
        terrain[y * WIDTH + x] = 1; // 陆地
        break;
      }
    }
  }
  if (y % 90 === 0) {
    console.log(`  进度: ${Math.round((y / HEIGHT) * 100)}%`);
  }
}

// ===== 4. 处理城市数据 =====
console.log('🏙️  处理城市数据 ...');
const citiesRaw = JSON.parse(
  readFileSync(resolve(__dirname, 'ne_50m_populated_places_simple.geojson'), 'utf-8')
);

interface CityOut {
  name: string;
  nameZh?: string;
  lat: number;
  lon: number;
  pop: number;
  capital: boolean;
  scaleRank: number;
  country: string;
  px: number; // 像素X
  py: number; // 像素Y
}

// 中文城市名映射（主要城市）
const cityNameZh: Record<string, string> = {
  'Beijing': '北京', 'Shanghai': '上海', 'Tokyo': '东京', 'Seoul': '首尔',
  'New York': '纽约', 'London': '伦敦', 'Paris': '巴黎', 'Moscow': '莫斯科',
  'Sydney': '悉尼', 'Cairo': '开罗', 'Mumbai': '孟买', 'Delhi': '新德里',
  'Bangkok': '曼谷', 'Singapore': '新加坡', 'Dubai': '迪拜', 'Istanbul': '伊斯坦布尔',
  'Berlin': '柏林', 'Madrid': '马德里', 'Rome': '罗马', 'Toronto': '多伦多',
  'Los Angeles': '洛杉矶', 'Chicago': '芝加哥', 'Houston': '休斯顿',
  'São Paulo': '圣保罗', 'Buenos Aires': '布宜诺斯艾利斯', 'Mexico City': '墨西哥城',
  'Lagos': '拉各斯', 'Johannesburg': '约翰内斯堡', 'Nairobi': '内罗毕',
  'Jakarta': '雅加达', 'Manila': '马尼拉', 'Taipei': '台北',
  'Hong Kong': '香港', 'Osaka': '大阪', 'Guangzhou': '广州', 'Shenzhen': '深圳',
  'Chongqing': '重庆', 'Wuhan': '武汉', 'Chengdu': '成都', 'Hangzhou': '杭州',
  'Washington, D.C.': '华盛顿', 'San Francisco': '旧金山',
  'Melbourne': '墨尔本', 'Auckland': '奥克兰', 'Lima': '利马',
  'Bogota': '波哥大', 'Santiago': '圣地亚哥', 'Riyadh': '利雅得',
  'Tehran': '德黑兰', 'Karachi': '卡拉奇', 'Dhaka': '达卡',
  'Kolkata': '加尔各答', 'Kuala Lumpur': '吉隆坡', 'Ho Chi Minh City': '胡志明市',
  'Hanoi': '河内', 'Yangon': '仰光', 'Addis Ababa': '亚的斯亚贝巴',
  'Kinshasa': '金沙萨', 'Dar es Salaam': '达累斯萨拉姆', 'Casablanca': '卡萨布兰卡',
  'Algiers': '阿尔及尔', 'Accra': '阿克拉', 'Amsterdam': '阿姆斯特丹',
  'Vienna': '维也纳', 'Brussels': '布鲁塞尔', 'Warsaw': '华沙',
  'Prague': '布拉格', 'Budapest': '布达佩斯', 'Athens': '雅典',
  'Lisbon': '里斯本', 'Stockholm': '斯德哥尔摩', 'Oslo': '奥斯陆',
  'Copenhagen': '哥本哈根', 'Helsinki': '赫尔辛基', 'Dublin': '都柏林',
  'Zurich': '苏黎世', 'Barcelona': '巴塞罗那', 'Milan': '米兰',
  'St. Petersburg': '圣彼得堡', 'Kyiv': '基辅', 'Ankara': '安卡拉',
  'Baghdad': '巴格达', 'Kabul': '喀布尔', 'Tashkent': '塔什干',
};

const cities: CityOut[] = [];

for (const f of citiesRaw.features) {
  const p = f.properties;
  const [lon, lat] = f.geometry.coordinates;
  const scaleRank = p.scalerank ?? p.SCALERANK ?? 10;
  const pop = p.pop_max ?? p.POP_MAX ?? 0;
  const name = p.name ?? p.NAME ?? '';
  const country = p.adm0name ?? p.ADM0NAME ?? '';
  const isCapital = !!(p.adm0cap ?? 0);

  // 只保留 scaleRank <= 7 或人口 > 100万的城市
  if (scaleRank > 7 && pop < 1_000_000) continue;

  const projected = projection([lon, lat]);
  if (!projected) continue;

  cities.push({
    name,
    nameZh: cityNameZh[name],
    lat,
    lon,
    pop,
    capital: isCapital,
    scaleRank,
    country,
    px: Math.round(projected[0]),
    py: Math.round(projected[1]),
  });
}

// 按人口排序
cities.sort((a, b) => b.pop - a.pop);

console.log(`  筛选出 ${cities.length} 个城市`);

// ===== 5. 写入文件 =====
const terrainPath = resolve(__dirname, '../../tarot-vue/public/map-terrain.bin');
writeFileSync(terrainPath, Buffer.from(terrain.buffer));
console.log(`✅ map-terrain.bin (${terrain.length} bytes, ${WIDTH}×${HEIGHT}) → ${terrainPath}`);

const citiesPath = resolve(__dirname, '../../tarot-vue/public/map-cities.json');
writeFileSync(citiesPath, JSON.stringify(cities));
console.log(`✅ map-cities.json (${cities.length} cities) → ${citiesPath}`);

// 统计
let landCount = 0;
for (const v of terrain) if (v === 1) landCount++;
console.log(`\n📊 统计:`);
console.log(`  陆地: ${landCount} pixels (${((landCount / terrain.length) * 100).toFixed(1)}%)`);
console.log(`  海洋: ${terrain.length - landCount} pixels (${(((terrain.length - landCount) / terrain.length) * 100).toFixed(1)}%)`);
console.log(`  城市: ${cities.length} (首都 ${cities.filter(c => c.capital).length} 个)`);
