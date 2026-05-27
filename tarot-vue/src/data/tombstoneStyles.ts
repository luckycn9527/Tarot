/**
 * 赛博墓碑 3D 等距部件组合系统
 *
 * 墓碑由 4 个维度自由组合: 底座 × 主体 × 顶饰 × 颜色
 * 样式字符串: "{base}-{body}-{top}-{color}"
 * e.g. "standard-slab-cross-purple"
 *
 * 向后兼容旧格式:
 *   "cross"         → "standard-slab-cross-purple"
 *   "cyber-cyan"    → "tiered-crystal-sphere-cyan"
 */

// ===================== 类型 =====================

interface PathDesc {
  d: string
  face: 'top' | 'left' | 'right' | 'accent'
  opacity?: number
}

export interface TombBase {
  id: string
  name: string
  paths: PathDesc[]
}

export interface TombBody {
  id: string
  name: string
  description: string
  paths: PathDesc[]
}

export interface TombTop {
  id: string
  name: string
  paths: PathDesc[]
}

export interface TombstoneColor {
  id: string
  name: string
  primary: string
  accent: string
  glow: string
  gradientFrom: string
  gradientTo: string
}

export interface ParsedTombStyle {
  baseId: string
  bodyId: string
  topId: string
  colorId: string
}

export interface TombstoneConfig {
  base: TombBase
  body: TombBody
  top: TombTop
  color: TombstoneColor
}

// ===================== 等距 SVG 路径数据 =====================
// ViewBox: 0 0 48 72, 中心 X=24
// 布局: 顶饰 y≈0-15, 主体 y≈17-49, 底座 y≈49-70

// ---------- 底座 ----------
// 所有底座的顶面最高点统一在 y=49，确保主体对齐

export const tombBases: TombBase[] = [
  {
    id: 'standard',
    name: '标准底座',
    paths: [
      { d: 'M24 49 L38 56 L24 63 L10 56 Z', face: 'top' },
      { d: 'M10 56 L24 63 L24 67 L10 60 Z', face: 'left' },
      { d: 'M24 63 L38 56 L38 60 L24 67 Z', face: 'right' },
    ],
  },
  {
    id: 'wide',
    name: '宽底座',
    paths: [
      { d: 'M24 49 L42 58 L24 67 L6 58 Z', face: 'top' },
      { d: 'M6 58 L24 67 L24 70 L6 61 Z', face: 'left' },
      { d: 'M24 67 L42 58 L42 61 L24 70 Z', face: 'right' },
    ],
  },
  {
    id: 'tiered',
    name: '阶梯底座',
    paths: [
      // 下层
      { d: 'M24 53 L40 61 L24 69 L8 61 Z', face: 'top', opacity: 0.6 },
      { d: 'M8 61 L24 69 L24 72 L8 64 Z', face: 'left' },
      { d: 'M24 69 L40 61 L40 64 L24 72 Z', face: 'right' },
      // 上层
      { d: 'M24 49 L36 55 L24 61 L12 55 Z', face: 'top' },
      { d: 'M12 55 L24 61 L24 64 L12 58 Z', face: 'left' },
      { d: 'M24 61 L36 55 L36 58 L24 64 Z', face: 'right' },
    ],
  },
]

// ---------- 主体 ----------
// 所有主体底部对齐 y=49（坐在底座上）, 顶部统一 y≈17

export const tombBodies: TombBody[] = [
  {
    id: 'slab',
    name: '方碑',
    description: '经典方形纪念碑',
    paths: [
      { d: 'M24 17 L34 22 L24 27 L14 22 Z', face: 'top' },
      { d: 'M14 22 L24 27 L24 49 L14 44 Z', face: 'left' },
      { d: 'M24 27 L34 22 L34 44 L24 49 Z', face: 'right' },
    ],
  },
  {
    id: 'pillar',
    name: '柱体',
    description: '纤细的圆柱碑',
    paths: [
      { d: 'M24 17 L30 20 L24 23 L18 20 Z', face: 'top' },
      { d: 'M18 20 L24 23 L24 49 L18 46 Z', face: 'left' },
      { d: 'M24 23 L30 20 L30 46 L24 49 Z', face: 'right' },
    ],
  },
  {
    id: 'obelisk',
    name: '尖碑',
    description: '上窄下宽的方尖碑',
    paths: [
      { d: 'M24 17 L26 18 L24 19 L22 18 Z', face: 'top' },
      { d: 'M22 18 L24 19 L24 49 L14 44 Z', face: 'left' },
      { d: 'M24 19 L26 18 L34 44 L24 49 Z', face: 'right' },
    ],
  },
  {
    id: 'dome',
    name: '穹顶',
    description: '圆润的穹顶建筑',
    paths: [
      // 穹顶曲面
      { d: 'M14 32 C14 20 20 17 24 17 L24 37 Z', face: 'left' },
      { d: 'M24 17 C28 17 34 20 34 32 L24 37 Z', face: 'top' },
      // 方形基座
      { d: 'M14 32 L24 37 L24 49 L14 44 Z', face: 'left' },
      { d: 'M24 37 L34 32 L34 44 L24 49 Z', face: 'right' },
    ],
  },
  {
    id: 'crystal',
    name: '晶体',
    description: '棱形数据水晶',
    paths: [
      { d: 'M24 17 L12 33 L24 38 Z', face: 'top' },
      { d: 'M24 17 L36 33 L24 38 Z', face: 'right', opacity: 0.8 },
      { d: 'M12 33 L24 38 L24 49 Z', face: 'left' },
      { d: 'M36 33 L24 38 L24 49 Z', face: 'right' },
    ],
  },
]

// ---------- 顶饰 ----------
// 位于主体上方, y≈0-15

export const tombTops: TombTop[] = [
  { id: 'none', name: '无', paths: [] },
  {
    id: 'cross',
    name: '十字',
    paths: [
      { d: 'M23 2 L25 2 L25 15 L23 15 Z', face: 'accent' },
      { d: 'M17 6 L31 6 L31 9 L17 9 Z', face: 'accent' },
      { d: 'M23 2 L25 2 L25 3 L23 3 Z', face: 'top', opacity: 0.5 },
    ],
  },
  {
    id: 'sphere',
    name: '能量球',
    paths: [
      { d: 'M24 4 L30 9 L24 14 L18 9 Z', face: 'accent' },
      { d: 'M24 4 L27 7 L24 9 L21 7 Z', face: 'top', opacity: 0.4 },
    ],
  },
  {
    id: 'spike',
    name: '尖顶',
    paths: [
      { d: 'M24 1 L28 15 L20 15 Z', face: 'accent' },
      { d: 'M24 1 L24 15 L20 15 Z', face: 'top', opacity: 0.3 },
    ],
  },
]

// ---------- 颜色 ----------

export const tombstoneColors: TombstoneColor[] = [
  {
    id: 'purple', name: '暗紫',
    primary: '#c084fc', accent: '#e9d5ff', glow: 'rgba(192,132,252,0.5)',
    gradientFrom: '#7c3aed', gradientTo: '#4c1d95',
  },
  {
    id: 'cyan', name: '赛博青',
    primary: '#22d3ee', accent: '#a5f3fc', glow: 'rgba(34,211,238,0.5)',
    gradientFrom: '#06b6d4', gradientTo: '#164e63',
  },
  {
    id: 'pink', name: '霓虹粉',
    primary: '#f472b6', accent: '#fbcfe8', glow: 'rgba(244,114,182,0.5)',
    gradientFrom: '#ec4899', gradientTo: '#831843',
  },
  {
    id: 'amber', name: '琥珀金',
    primary: '#f59e0b', accent: '#fde68a', glow: 'rgba(245,158,11,0.5)',
    gradientFrom: '#d97706', gradientTo: '#78350f',
  },
  {
    id: 'green', name: '矩阵绿',
    primary: '#34d399', accent: '#a7f3d0', glow: 'rgba(52,211,153,0.5)',
    gradientFrom: '#059669', gradientTo: '#064e3b',
  },
  {
    id: 'blue', name: '量子蓝',
    primary: '#60a5fa', accent: '#bfdbfe', glow: 'rgba(96,165,250,0.5)',
    gradientFrom: '#3b82f6', gradientTo: '#1e3a5f',
  },
]

// ===================== 旧格式映射 =====================

const legacyMap: Record<string, ParsedTombStyle> = {
  cross:   { baseId: 'standard', bodyId: 'slab',    topId: 'cross',  colorId: 'purple' },
  obelisk: { baseId: 'standard', bodyId: 'obelisk', topId: 'spike',  colorId: 'amber' },
  round:   { baseId: 'wide',     bodyId: 'dome',    topId: 'none',   colorId: 'green' },
  angel:   { baseId: 'standard', bodyId: 'slab',    topId: 'cross',  colorId: 'pink' },
  gothic:  { baseId: 'tiered',   bodyId: 'pillar',  topId: 'spike',  colorId: 'blue' },
  modern:  { baseId: 'wide',     bodyId: 'slab',    topId: 'none',   colorId: 'purple' },
  cyber:   { baseId: 'tiered',   bodyId: 'crystal', topId: 'sphere', colorId: 'cyan' },
  ancient: { baseId: 'tiered',   bodyId: 'obelisk', topId: 'none',   colorId: 'amber' },
}

// ===================== 查询函数 =====================

export function parseTombstoneStyle(style: string): ParsedTombStyle {
  const parts = style.split('-')
  if (parts.length === 4) {
    return { baseId: parts[0], bodyId: parts[1], topId: parts[2], colorId: parts[3] }
  }
  // 旧 2 段格式 "shape-color"
  if (parts.length === 2 && legacyMap[parts[0]]) {
    return { ...legacyMap[parts[0]], colorId: parts[1] }
  }
  // 旧 1 段格式 "shape"
  if (legacyMap[style]) return legacyMap[style]
  return { baseId: 'standard', bodyId: 'slab', topId: 'none', colorId: 'purple' }
}

export function getBaseById(id: string): TombBase {
  return tombBases.find(b => b.id === id) || tombBases[0]
}
export function getBodyById(id: string): TombBody {
  return tombBodies.find(b => b.id === id) || tombBodies[0]
}
export function getTopById(id: string): TombTop {
  return tombTops.find(t => t.id === id) || tombTops[0]
}
export function getColorById(id: string): TombstoneColor {
  return tombstoneColors.find(c => c.id === id) || tombstoneColors[0]
}

export function getTombstoneConfig(style: string): TombstoneConfig {
  const p = parseTombstoneStyle(style)
  return {
    base: getBaseById(p.baseId),
    body: getBodyById(p.bodyId),
    top: getTopById(p.topId),
    color: getColorById(p.colorId),
  }
}

export function getStyleDisplayName(style: string): string {
  const p = parseTombstoneStyle(style)
  return `${getBodyById(p.bodyId).name} · ${getColorById(p.colorId).name}`
}

// ===================== SVG 渲染 =====================

function getFaceColors(color: TombstoneColor) {
  return {
    top: color.accent,
    left: color.gradientFrom,
    right: color.gradientTo,
    accent: color.primary,
  }
}

export function generateTombSvg(style: string, w = 36, h = 54): string {
  const cfg = getTombstoneConfig(style)
  const fc = getFaceColors(cfg.color)
  const allPaths = [...cfg.base.paths, ...cfg.body.paths, ...cfg.top.paths]
  const ps = allPaths.map(p =>
    `<path d="${p.d}" fill="${fc[p.face]}" opacity="${p.opacity ?? 1}"/>`
  ).join('')
  return `<svg viewBox="0 0 48 72" width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">${ps}</svg>`
}

// ===================== 旧系统（向后兼容） =====================

export interface TombstoneStyle {
  id: string
  name: string
  description: string
  primaryColor: string
  markerColor: string
  pixelPattern: number[][]
}

export const tombstoneStyles: TombstoneStyle[] = [
  { id: 'cross', name: '十字架', description: '经典十字架造型', primaryColor: '#a78bfa', markerColor: '#c4b5fd', pixelPattern: [] },
  { id: 'obelisk', name: '方尖碑', description: '直指苍穹', primaryColor: '#f59e0b', markerColor: '#fbbf24', pixelPattern: [] },
  { id: 'round', name: '圆顶碑', description: '温润圆顶', primaryColor: '#34d399', markerColor: '#6ee7b7', pixelPattern: [] },
  { id: 'angel', name: '天使', description: '天使守护', primaryColor: '#f0abfc', markerColor: '#f5d0fe', pixelPattern: [] },
  { id: 'gothic', name: '哥特', description: '哥特尖拱', primaryColor: '#6366f1', markerColor: '#818cf8', pixelPattern: [] },
  { id: 'modern', name: '极简', description: '现代极简', primaryColor: '#94a3b8', markerColor: '#cbd5e1', pixelPattern: [] },
  { id: 'cyber', name: '赛博', description: '赛博朋克', primaryColor: '#22d3ee', markerColor: '#67e8f9', pixelPattern: [] },
  { id: 'ancient', name: '古文明', description: '远古石碑', primaryColor: '#d97706', markerColor: '#f59e0b', pixelPattern: [] },
]

export function getTombstoneStyleById(id: string): TombstoneStyle | undefined {
  return tombstoneStyles.find(s => s.id === id)
}
