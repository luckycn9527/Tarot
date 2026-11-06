import type { MobileReader } from './types'

interface GuideText { focus: string; voice: string; example: string }
interface ReviewedGuide { intro: { zh: string; en: string }; zh: GuideText; en: GuideText }

// Editorial comparisons reviewed against readersUi.ts and each persona in readers.ts.
// Match the actual intro as well as the ID: a changed catalog must not inherit stale claims.
const reviewedGuides = {
  qinghe: {
    intro: {
      zh: '修习道家易理，将塔罗与五行生克相结合。解读温和有底蕴，擅长用阴阳平衡的视角为你理清当下处境。',
      en: 'A Taoist reader who blends Tarot with I Ching and Five Elements theory, offering calm, grounded insight through the lens of balance.',
    },
    zh: { focus: '五行与平衡 · 梳理当下', voice: '温和从容，用通俗比喻慢慢理清', example: '缘主，权杖二像枝头初生的木芽：有向外生长的心，也需要稳住根。先选一个小方向试行，让行动与休整各得其时。' },
    en: { focus: 'Five Elements · Finding balance', voice: 'Gentle, grounded, with simple metaphors', example: 'The Two of Wands is like a young branch reaching outward while its roots settle. Choose one small direction to explore, and leave room for both action and rest.' },
  },
  yanxi: {
    intro: {
      zh: '话不多但句句到位。不提供情感安慰，专注帮你拆解问题结构，给出清晰的行动方向。',
      en: 'Concise and direct. Yanxi focuses on the structure of your situation and gives clear next steps instead of empty reassurance.',
    },
    zh: { focus: '问题结构 · 行动方向', voice: '冷静直接，少铺陈、先抓关键', example: '权杖二指向规划。你缺的未必是选项，而是比较标准。写下两个方向的成本，各做一次小测试，再决定下一步。' },
    en: { focus: 'Problem structure · Next steps', voice: 'Cool, direct, and concise', example: 'The Two of Wands points to planning. You may need a comparison rule more than another option. List the costs of two paths, test each on a small scale, then decide.' },
  },
  haruka: {
    intro: {
      zh: '京都巫女塔罗师，将万物有灵的思想融入解读。从季节变化和自然意象的角度，揭示问题与天时的呼应。',
      en: 'A Kyoto shrine maiden who reads through seasonal shifts and natural imagery, revealing how your situation moves with the wider moment.',
    },
    zh: { focus: '季节节律 · 自然意象', voice: '轻柔有礼，以花鸟风月作比喻', example: '您看，权杖二像春天站在庭院门前：先辨风向，再迈一步。不妨给自己一周，安静观察哪个方向让您更愿意靠近。' },
    en: { focus: 'Seasonal rhythms · Nature imagery', voice: 'Soft, courteous, and reflective', example: 'The Two of Wands is like standing at a garden gate in spring. Notice the wind before stepping out. Give yourself a week to observe which direction you feel ready to approach.' },
  },
  xuanyin: {
    intro: {
      zh: '精通奇门遁甲与紫微斗数，擅长将东方命理框架与塔罗牌象交叉比对，从格局层面揭示趋势与转折。',
      en: 'A specialist in Qimen Dunjia and Zi Wei who cross-references Eastern metaphysics with Tarot to identify major patterns and turning points.',
    },
    zh: { focus: '整体格局 · 趋势与转折', voice: '从全局拆解，带一点江湖口吻', example: '道友，权杖二这一局，重点在布局。先分清你手里的资源、外部的机会和迟迟未动的那一步，再看何处值得落子。' },
    en: { focus: 'Overall patterns · Turning points', voice: 'Big-picture analysis with a storyteller’s tone', example: 'Friend, the Two of Wands calls for a view of the whole board. Separate your resources, outside opportunities, and the move you keep postponing. Then choose where to place your next piece.' },
  },
  mirelle: {
    intro: {
      zh: '法系神秘主义者，以月相与塔罗结合做解读。风格细腻诗意，擅长剖析情感关系和内心深层的渴望。',
      en: 'A French mystic who blends lunar cycles with Tarot. Her poetic, nuanced readings are especially suited to relationships and inner desires.',
    },
    zh: { focus: '情感关系 · 内心渴望', voice: '细腻感性，常用月光般的意象', example: '亲爱的，权杖二像窗前的一束月光，照见你向往的远方。先问自己：那是你真心想去的地方，还是别人眼中的好选择？' },
    en: { focus: 'Relationships · Inner desires', voice: 'Poetic, sensitive, with lunar imagery', example: 'Dear one, the Two of Wands is a beam of moonlight across a distant path. Ask yourself: is this somewhere you wish to go, or simply a choice that looks right to others?' },
  },
  lingsha: {
    intro: {
      zh: '师承茅山一脉，脾气火爆但看牌极准。解读一针见血，专治各种自我欺骗——骂完你还会给出可操作的建议。',
      en: 'Blunt, fiery, and highly intuitive. Lingsha cuts through self-deception, then follows the truth with practical advice you can use.',
    },
    zh: { focus: '直面回避 · 可操作建议', voice: '热烈直率，先点破再给行动', example: '喂，权杖二提醒你：光在脑子里选，选不出结果。你是不是一直在等一个零风险的答案？今天先做一个能撤回的小尝试。' },
    en: { focus: 'Facing avoidance · Practical action', voice: 'Fiery and blunt, followed by a concrete step', example: 'Look, the Two of Wands asks for more than thinking in circles. Are you waiting for a choice with no risk at all? Make one small, reversible test today.' },
  },
  norick: {
    intro: {
      zh: '马赛塔罗研究者，用象征学和决策分析的框架解读牌面。风格严谨，逻辑清晰，不算命，帮你做分析。',
      en: 'A Marseille Tarot scholar who combines symbolism with decision analysis. Rigorous and logical, he helps you understand choices rather than predict fate.',
    },
    zh: { focus: '牌面象征 · 决策分析', voice: '严谨分层，解释推理过程', example: '权杖二中的远眺与持杖，可以作为规划与行动的象征。先区分已知事实和个人预期，再列出各选项所需验证的信息。' },
    en: { focus: 'Card symbolism · Decision analysis', voice: 'Structured, precise, with explained reasoning', example: 'The distant gaze and held wand can symbolize planning and action. Separate established facts from expectations, then list the information each option still requires.' },
  },
  amara: {
    intro: {
      zh: '约鲁巴传统灵性导师，用河流、种子、风暴的比喻解读牌面。相信祖先的智慧会通过每张牌传递。',
      en: 'A Yoruba spiritual guide who reads through images of rivers, seeds, and storms, drawing on ancestral wisdom in every card.',
    },
    zh: { focus: '自然比喻 · 传统智慧', voice: '有节奏的故事口吻，亲切引导', example: '孩子，权杖二像手里两粒尚未播下的种子。先照看你脚下这片土，再选一粒种下；成长需要你亲手开始。' },
    en: { focus: 'Nature metaphors · Traditional wisdom', voice: 'Warm, rhythmic, and story-led', example: 'Child, the Two of Wands is like holding two seeds you have yet to plant. Tend the soil beneath your feet, then choose one seed. Growth needs your first act of care.' },
  },
  vikram: {
    intro: {
      zh: '瓦拉纳西冥想导师，将脉轮能量体系融入塔罗。关注能量的流动与阻塞，会建议呼吸练习配合牌面指引。',
      en: 'A Varanasi meditation teacher who combines chakra work with Tarot, tracing where energy flows or stalls and suggesting breathwork to support the reading.',
    },
    zh: { focus: '能量与阻塞 · 呼吸觉察', voice: '缓慢沉静，留出停顿与感受', example: '朋友，先缓缓呼吸。权杖二让我们停在行动之前，觉察哪一个方向让你舒展，哪一个让你紧绷。记下感受，再结合现实条件选择。' },
    en: { focus: 'Energy and blocks · Breath awareness', voice: 'Slow, calm, with space to reflect', example: 'Friend, take a gentle breath. The Two of Wands invites a pause before action. Notice which path feels open and which feels tense, then weigh those feelings alongside practical facts.' },
  },
  catalina: {
    intro: {
      zh: '安达卢西亚吉普赛血统，性格热烈奔放。擅长解读爱情和人际关系，会直接告诉你这个人值不值得。',
      en: 'A passionate Andalusian reader with a gift for love and relationship questions. She will tell you plainly whether a connection deserves your energy.',
    },
    zh: { focus: '爱情 · 人际关系', voice: '热情鲜明，像描述电影画面', example: '宝贝，权杖二像电影里推门前的那一幕。先看看这份工作里，谁支持你、谁让你总在退让；你的下一步，也要给自己留位置。' },
    en: { focus: 'Love · Personal relationships', voice: 'Passionate, vivid, and cinematic', example: 'Darling, the Two of Wands is the moment before a film’s door swings open. Who at work supports you, and around whom do you keep shrinking? Leave space for yourself in your next move.' },
  },
  kazuki: {
    intro: {
      zh: '东京的程序员塔罗师，用决策树逻辑拆解牌面关系。不讲玄学只讲分析，每次都给出明确的行动方案。',
      en: 'A Tokyo programmer who maps Tarot through decision-tree logic. His readings are practical, structured, and end with a clear action plan.',
    },
    zh: { focus: '决策树 · 行动方案', voice: '简洁实用，按条件拆分选项', example: '把权杖二当作一个分支节点：如果你缺信息，先访谈一位同行；如果你已有判断，安排一次小规模试做。给这一步设一个完成日期。' },
    en: { focus: 'Decision trees · Action plans', voice: 'Concise, practical, and conditional', example: 'Treat the Two of Wands as a branch in a decision tree. If information is missing, talk to a peer. If you already have a working view, run a small trial. Set a date for that step.' },
  },
  solveig: {
    intro: {
      zh: '北欧神话学者，将卢恩符文传统与塔罗结合。解读带有维京式的直率，用冰川和极光的意象照亮前路。',
      en: 'A Nordic mythology scholar who blends runic tradition with Tarot, using frank language and vivid northern imagery to illuminate the path ahead.',
    },
    zh: { focus: '符文意象 · 方向与主动选择', voice: '冷峻直率，用北地景象讲述', example: '旅人，权杖二像站在林线边缘，前方还没有路标。看清你能携带的补给，选择一段能够走回来的路，先留下自己的第一行足迹。' },
    en: { focus: 'Runic imagery · Choosing a direction', voice: 'Frank, spare, with northern landscapes', example: 'Traveler, the Two of Wands is the edge of a forest without a signpost. Check your supplies and choose a route you can return from. Leave the first line of footprints yourself.' },
  },
} satisfies Record<string, ReviewedGuide>

export const knownMobileReaderGuideIds = Object.freeze(Object.keys(reviewedGuides))

export type MobileReaderGuide = { kind: 'intro'; intro: string } | ({ kind: 'reviewed'; intro: string } & GuideText)

export function getMobileReaderGuide(reader: Pick<MobileReader, 'id' | 'desc'>, english = false): MobileReaderGuide {
  const intro = reader.desc?.trim() || ''
  const guide = Object.prototype.hasOwnProperty.call(reviewedGuides, reader.id) ? reviewedGuides[reader.id as keyof typeof reviewedGuides] : undefined
  // Fail closed even for a familiar ID if its public description has changed.
  if (!guide || (intro !== guide.intro.zh && intro !== guide.intro.en)) return { kind: 'intro', intro }
  return { kind: 'reviewed', intro, ...(english ? guide.en : guide.zh) }
}

export function mobileReaderGuideCopy(english = false) {
  return english ? {
    aiIdentity: 'AI Tarot characters',
    guideNote: 'Style notes are based on each introduction. Written examples help you compare voices.',
    focus: 'Focus', voice: 'Voice', expand: 'View style example', collapse: 'Hide style example',
    sampleLabel: 'Illustrative style example',
    sampleNote: 'Written for comparison. This is not a live reading or a prediction for you.',
    sampleQuestion: 'Example question: I keep hesitating at work. How can I take the next step?',
    sampleCard: 'Assumed card: Two of Wands · Upright',
    noIntro: 'An introduction is not available yet.',
  } : {
    aiIdentity: 'AI 塔罗角色',
    guideNote: '风格依据各自简介整理，编辑撰写的示例帮助你比较表达方式。',
    focus: '解读侧重', voice: '表达方式', expand: '查看风格示例', collapse: '收起风格示例',
    sampleLabel: '风格示例 · 编辑撰写',
    sampleNote: '仅用于比较表达方式，不是实时解读，也不是对你的预测。',
    sampleQuestion: '示例问题：工作上一直犹豫，要怎么迈出下一步？',
    sampleCard: '假设牌面：权杖二 · 正位',
    noIntro: '这位角色的简介暂未提供。',
  }
}
