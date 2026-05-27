export interface SpreadPosition {
  index: number
  name: string
  description: string
}

export interface Spread {
  id: string
  name: string
  emoji: string
  cardCount: number
  description: string
  whenToUse: string
  positions: SpreadPosition[]
}

export const spreads: Spread[] = [
  {
    id: 'single',
    name: '单张牌阵',
    emoji: '🃏',
    cardCount: 1,
    description: '最简洁直接的塔罗牌阵，抽取一张牌回答你的问题。适合需要快速、明确指引的时刻。',
    whenToUse: '当你需要一个简单的是/否答案，或每日灵感启示时使用。',
    positions: [
      { index: 1, name: '核心答案', description: '代表对问题的直接回应' },
    ],
  },
  {
    id: 'three-card',
    name: '三张牌阵',
    emoji: '🎴',
    cardCount: 3,
    description: '经典的过去-现在-未来牌阵，通过三张牌揭示事件的发展脉络，帮助你理解当前处境的来龙去脉。',
    whenToUse: '当你想了解某个问题的发展趋势，或需要更深入的洞察时使用。',
    positions: [
      { index: 1, name: '过去', description: '影响当前情况的过去因素' },
      { index: 2, name: '现在', description: '当前的状况和挑战' },
      { index: 3, name: '未来', description: '可能的发展方向和结果' },
    ],
  },
  {
    id: 'celtic-cross',
    name: '凯尔特十字牌阵',
    emoji: '✝️',
    cardCount: 10,
    description: '塔罗占卜中最经典、最全面的牌阵。使用十张牌从多个维度分析问题，包括内外因素、希望与恐惧、最终结果。',
    whenToUse: '当你面对复杂的人生抉择，需要全方位深入分析时使用。',
    positions: [
      { index: 1, name: '现状', description: '当前的核心状况' },
      { index: 2, name: '挑战', description: '面临的主要障碍' },
      { index: 3, name: '潜意识', description: '深层的内在因素' },
      { index: 4, name: '过去', description: '近期影响的事件' },
      { index: 5, name: '可能性', description: '最佳可能的结果' },
      { index: 6, name: '未来', description: '近期将发生的事' },
      { index: 7, name: '自我认知', description: '你对自己的看法' },
      { index: 8, name: '外部影响', description: '环境和他人的影响' },
      { index: 9, name: '希望与恐惧', description: '内心的渴望和担忧' },
      { index: 10, name: '最终结果', description: '事件的最终走向' },
    ],
  },
  {
    id: 'relationship',
    name: '关系牌阵',
    emoji: '💕',
    cardCount: 5,
    description: '专为分析两人关系设计的牌阵。分别揭示双方的想法和感受，以及关系的核心动态和发展方向。',
    whenToUse: '当你想了解一段感情关系的现状、双方内心想法，或预测关系走向时使用。',
    positions: [
      { index: 1, name: '你的状态', description: '你在关系中的感受和立场' },
      { index: 2, name: '对方状态', description: '对方在关系中的感受和立场' },
      { index: 3, name: '关系基础', description: '这段关系的核心纽带' },
      { index: 4, name: '挑战', description: '关系中需要面对的问题' },
      { index: 5, name: '发展方向', description: '关系可能的走向' },
    ],
  },
  {
    id: 'career',
    name: '事业牌阵',
    emoji: '💼',
    cardCount: 5,
    description: '专注于职业和事业发展的牌阵。分析你的职业现状、优势劣势，以及未来的发展机遇。',
    whenToUse: '当你面临职业转型、求职抉择，或想了解事业发展前景时使用。',
    positions: [
      { index: 1, name: '当前职业', description: '目前的工作状况' },
      { index: 2, name: '优势', description: '你的职业优势和资源' },
      { index: 3, name: '挑战', description: '需要克服的障碍' },
      { index: 4, name: '建议', description: '塔罗给出的行动指引' },
      { index: 5, name: '前景', description: '事业发展的前景' },
    ],
  },
  {
    id: 'horseshoe',
    name: '马蹄铁牌阵',
    emoji: '🧲',
    cardCount: 7,
    description: '七张牌排列成马蹄铁形状的经典牌阵。从过去到未来全面展开，特别适合分析一个具体问题的各个层面。',
    whenToUse: '当你需要比三张牌更深入，但又不想使用凯尔特十字那么复杂的牌阵时使用。',
    positions: [
      { index: 1, name: '过去', description: '影响问题的历史因素' },
      { index: 2, name: '现在', description: '当前的状况' },
      { index: 3, name: '隐藏因素', description: '你可能忽略的方面' },
      { index: 4, name: '障碍', description: '前进道路上的阻力' },
      { index: 5, name: '外部影响', description: '周围环境的作用' },
      { index: 6, name: '建议', description: '最佳行动方案' },
      { index: 7, name: '结果', description: '最可能的结局' },
    ],
  },
]

// Reader-reading specific spreads (used in reader flow)
export interface ReaderSpread {
  id: string
  name: string
  cardCount: number
  description: string
  emoji: string
  positions: string[]
}

export const readerSpreads: ReaderSpread[] = [
  // === 通用 ===
  { id: 'single', name: '单牌占卜', cardCount: 1, description: '入门级占卜，适用于是非判断和单日运势', emoji: '🎴', positions: ['当前情况'] },
  { id: 'timeline', name: '时间流牌阵', cardCount: 3, description: '从时间维度解读事件发展，适用于单事件解读和预测未来', emoji: '⏳', positions: ['过去', '现在', '未来'] },
  { id: 'problem', name: '问题解决牌阵', cardCount: 3, description: '入门级万能牌阵，简单易用，适用于单事件解读和寻找问题解法', emoji: '🔑', positions: ['问题的起因', '问题的现状', '问题解决方法'] },
  { id: 'diamond', name: '钻石牌阵', cardCount: 4, description: '万能型事物预测牌阵，解读事件起因与现状，预测未来发展', emoji: '💎', positions: ['事情的起因', '事情的现况', '事情的局面', '事情的未来'] },
  { id: 'core', name: '直指核心牌阵', cardCount: 4, description: '升级版问题解决牌阵，直击问题核心，适用于深入解读和突破瓶颈', emoji: '🎯', positions: ['问题的本质', '你的障碍和短处', '解决问题的对策', '你的资源和长处'] },
  { id: 'x-chance', name: 'X字机会牌阵', cardCount: 5, description: '洞察时机与自身能力，帮助做出选择，适用于临场决策', emoji: '✖️', positions: ['自身的心态', '当前的时机', '成功的几率', '影响因素', '最终建议'] },
  { id: 'celtic-cross', name: '凯尔特十字牌阵', cardCount: 10, description: '经典万能牌阵，多角度分析问题，帮助做出决策', emoji: '🌀', positions: ['问题的现状', '目前的阻碍', '你预期的发展', '造成现状的原因', '过去的影响', '未来的走向', '你的态度', '外在环境', '希望与恐惧', '最终结果'] },
  { id: 'hexagram', name: '六芒星牌阵', cardCount: 7, description: '理清来龙去脉、分析现状、预测未来走向并提供应对策略', emoji: '✡️', positions: ['问题的过去情况', '问题的现状', '问题的未来发展', '应采取的策略', '外在环境的影响', '自身的期望', '最终结果'] },
  // === 爱情人际 ===
  { id: 'love-cross', name: '爱情十字牌阵', cardCount: 5, description: '剖析相恋双方的心境，指示亲密关系发展趋势', emoji: '💕', positions: ['你的状态想法', '对方对你的态度', '这段感情的现状', '存在的问题', '发展趋势'] },
  { id: 'future-lover', name: '未来恋人牌阵', cardCount: 7, description: '预测正缘对象，帮助识别正缘，促进美好姻缘到来', emoji: '💘', positions: ['正缘对象ta是怎样的人', 'ta是否已经出现', '遇到ta时会有什么提示', '如何吸引ta向你靠近', '你们的相处模式', '感情发展趋势', '最终结果'] },
  { id: 'mirror', name: '灵感对应牌阵', cardCount: 6, description: '剖析双方关于该段人际关系的真实想法', emoji: '🪞', positions: ['你对对方的想法', '你对此关系的看法', '你对未来发展的期待', '对方对你的想法', '对方对此关系的看法', '对方对未来发展的期待'] },
  { id: 'venus', name: '爱神维纳斯牌阵', cardCount: 8, description: '经典爱情牌阵，细致剖析恋爱双方现状，预测未来变化', emoji: '🌹', positions: ['你的想法', '对方的想法', '你对对方的影响', '对方对你的影响', '你们的关系现状', '外部环境', '双方的未来', '最终走向'] },
  { id: 'love-repair', name: '情感修复牌阵', cardCount: 4, description: '提供情感经营建议，修复情感嫌隙，促进感情正向发展', emoji: '💝', positions: ['行动建议', '语言沟通的对策', '应该采取的态度', '物质方面的处理方式'] },
  // === 运势预测 ===
  { id: 'daily', name: '日运牌阵', cardCount: 4, description: '预测当日运势好坏，提示注意潜在问题', emoji: '☀️', positions: ['运势主题', '运势情况', '潜在问题', '行动建议'] },
  { id: 'monthly', name: '月运牌阵', cardCount: 5, description: '预测未来一月运势和主题，抓住机遇避免麻烦', emoji: '🌙', positions: ['月度第一周', '月度第二周', '月度第三周', '月度第四周', '月度总体建议'] },
  { id: 'future-dev', name: '未来发展牌阵', cardCount: 6, description: '从爱情、事业、财富和成就四方面预测未来发展', emoji: '🔮', positions: ['你的现状', '爱情的发展', '事业或学业的发展', '财富的发展', '个人成就', '综合建议'] },
  // === 自我探索 ===
  { id: 'mind-body', name: '身心灵牌阵', cardCount: 4, description: '向内寻求答案，了解自我、破除迷惘', emoji: '🧘', positions: ['身体', '心灵', '灵性', '可提升的元素'] },
  { id: 'four-elements', name: '四元素牌阵', cardCount: 4, description: '从行动、物质、理性、感性四方面透彻审视自我', emoji: '🌍', positions: ['行动与信心方面', '现实与金钱方面', '理性与决策方面', '感情或感性方面'] },
  { id: 'self-explore', name: '自我探索牌阵', cardCount: 4, description: '自我修行成长牌阵，认识自我、开发潜能、突破瓶颈', emoji: '🧭', positions: ['内心深处', '精神生活', '知识领域', '感情生活'] },
  { id: 'self-break', name: '自我突破牌阵', cardCount: 5, description: '在循环往复的固定模式中寻求突破', emoji: '⚡', positions: ['你的模式', '你的挑战', '你的突破', '你的力量', '行动指引'] },
  // === 事业财富 ===
  { id: 'career', name: '事业金字塔牌阵', cardCount: 4, description: '解析财富运势，明确自身利弊，破除事业瓶颈', emoji: '📊', positions: ['自身的核心竞争力', '自身的缺点', '自身的优点', '未来的成就'] },
  { id: 'wealth-tree', name: '财富树牌阵', cardCount: 5, description: '解析财富运势，梳理财富增长的根基、能量和阻碍', emoji: '🌳', positions: ['财富生长的根基', '财富发展依赖的能量', '财富发展遇到的阻碍', '财富发展的潜在危险', '财富增长的方向'] },
  { id: 'interview', name: '面试求职牌阵', cardCount: 5, description: '洞悉对方需求与自身注意事项，提高面试成功率', emoji: '💼', positions: ['自身的心态及想法', '面试前需注意的事项', '面试将发生的状况', '对方的要求或问题', '最终结果'] },
  // === 选择决策 ===
  { id: 'two-choice', name: '二选一牌阵', cardCount: 5, description: '分析两种选择的利弊和最终结果，帮助做出决策', emoji: '⚖️', positions: ['问题的现状', '选择A的短期发展', '选择B的短期发展', '选择A的最终结果', '选择B的最终结果'] },
  { id: 'yes-no', name: '是否牌阵', cardCount: 3, description: '简单直接的是/否占卜，快速获得明确答案', emoji: '❓', positions: ['卡牌一', '卡牌二', '卡牌三'] },
]

export function getReaderSpreadById(id: string): ReaderSpread | undefined {
  return readerSpreads.find(s => s.id === id)
}
