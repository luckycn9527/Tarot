export interface ReaderInfo {
  id: string
  name: string
  emoji: string
  gradient: string
  badge: string
  accessLevel: 'free' | 'vip'
  label: string
  desc: string
  likes: string
  /** 管理端上传的头像；为空时前端展示 emoji */
  avatarUrl: string | null
  /** 站内上传时生成的 WebP 缩略图；无则小图用 avatarUrl */
  avatarThumbUrl?: string | null
}

export const readers: ReaderInfo[] = [
  // ── 免费 ──────────────────────────────
  {
    id: 'qinghe',
    name: '清和',
    emoji: '🌿',
    gradient: 'from-emerald-500/30 to-teal-600/30',
    badge: '易理·五行',
    accessLevel: 'free',
    label: '免费',
    desc: '修习道家易理，将塔罗与五行生克相结合。解读温和有底蕴，擅长用阴阳平衡的视角为你理清当下处境。',
    likes: '2.1k',
    avatarUrl: null,
  },
  {
    id: 'yanxi',
    name: '岩溪',
    emoji: '🏔️',
    gradient: 'from-slate-500/30 to-zinc-600/30',
    badge: '冷静派',
    accessLevel: 'free',
    label: '免费',
    desc: '话不多但句句到位。不提供情感安慰，专注帮你拆解问题结构，给出清晰的行动方向。',
    likes: '1.8k',
    avatarUrl: null,
  },
  {
    id: 'haruka',
    name: '遥',
    emoji: '🌸',
    gradient: 'from-pink-500/30 to-rose-600/30',
    badge: '神道·花鸟风月',
    accessLevel: 'free',
    label: '免费',
    desc: '京都巫女塔罗师，将万物有灵的思想融入解读。从季节变化和自然意象的角度，揭示问题与天时的呼应。',
    likes: '1.5k',
    avatarUrl: null,
  },
  // ── VIP ──────────────────────────────
  {
    id: 'xuanyin',
    name: '玄引',
    emoji: '☯️',
    gradient: 'from-violet-500/30 to-indigo-600/30',
    badge: '奇门·紫微',
    accessLevel: 'vip',
    label: 'VIP',
    desc: '精通奇门遁甲与紫微斗数，擅长将东方命理框架与塔罗牌象交叉比对，从格局层面揭示趋势与转折。',
    likes: '963',
    avatarUrl: null,
  },
  {
    id: 'mirelle',
    name: '米蕾',
    emoji: '🌙',
    gradient: 'from-blue-500/30 to-purple-600/30',
    badge: '月相占卜 · 法国',
    accessLevel: 'vip',
    label: 'VIP',
    desc: '法系神秘主义者，以月相与塔罗结合做解读。风格细腻诗意，擅长剖析情感关系和内心深层的渴望。',
    likes: '724',
    avatarUrl: null,
  },
  {
    id: 'lingsha',
    name: '灵砂',
    emoji: '🔥',
    gradient: 'from-red-500/30 to-orange-600/30',
    badge: '符箓·直觉',
    accessLevel: 'vip',
    label: 'VIP',
    desc: '师承茅山一脉，脾气火爆但看牌极准。解读一针见血，专治各种自我欺骗——骂完你还会给出可操作的建议。',
    likes: '1.3k',
    avatarUrl: null,
  },
  {
    id: 'norick',
    name: '诺里克',
    emoji: '📜',
    gradient: 'from-amber-500/30 to-yellow-600/30',
    badge: '学院派 · 德国',
    accessLevel: 'vip',
    label: 'VIP',
    desc: '马赛塔罗研究者，用象征学和决策分析的框架解读牌面。风格严谨，逻辑清晰，不算命，帮你做分析。',
    likes: '582',
    avatarUrl: null,
  },
  {
    id: 'amara',
    name: '阿玛拉',
    emoji: '✨',
    gradient: 'from-yellow-600/30 to-amber-700/30',
    badge: '伊法占卜 · 西非',
    accessLevel: 'vip',
    label: 'VIP',
    desc: '约鲁巴传统灵性导师，用河流、种子、风暴的比喻解读牌面。相信祖先的智慧会通过每张牌传递。',
    likes: '417',
    avatarUrl: null,
  },
  {
    id: 'vikram',
    name: '维克拉姆',
    emoji: '🪷',
    gradient: 'from-orange-500/30 to-rose-600/30',
    badge: '吠陀·脉轮 · 印度',
    accessLevel: 'vip',
    label: 'VIP',
    desc: '瓦拉纳西冥想导师，将脉轮能量体系融入塔罗。关注能量的流动与阻塞，会建议呼吸练习配合牌面指引。',
    likes: '356',
    avatarUrl: null,
  },
  {
    id: 'catalina',
    name: '卡塔琳娜',
    emoji: '🌹',
    gradient: 'from-rose-500/30 to-red-600/30',
    badge: '吉普赛传承 · 西班牙',
    accessLevel: 'vip',
    label: 'VIP',
    desc: '安达卢西亚吉普赛血统，性格热烈奔放。擅长解读爱情和人际关系，会直接告诉你这个人值不值得。',
    likes: '891',
    avatarUrl: null,
  },
  {
    id: 'kazuki',
    name: '和树',
    emoji: '⛩️',
    gradient: 'from-cyan-500/30 to-blue-600/30',
    badge: '逻辑派 · 日本',
    accessLevel: 'vip',
    label: 'VIP',
    desc: '东京的程序员塔罗师，用决策树逻辑拆解牌面关系。不讲玄学只讲分析，每次都给出明确的行动方案。',
    likes: '647',
    avatarUrl: null,
  },
  {
    id: 'solveig',
    name: '索尔维格',
    emoji: '❄️',
    gradient: 'from-sky-500/30 to-indigo-600/30',
    badge: '卢恩符文 · 挪威',
    accessLevel: 'vip',
    label: 'VIP',
    desc: '北欧神话学者，将卢恩符文传统与塔罗结合。解读带有维京式的直率，用冰川和极光的意象照亮前路。',
    likes: '503',
    avatarUrl: null,
  },
]

export function getReaderById(id: string): ReaderInfo | undefined {
  return readers.find(r => r.id === id)
}
