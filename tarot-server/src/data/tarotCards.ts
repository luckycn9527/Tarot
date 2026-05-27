export interface TarotCard {
  id: number
  name: string
  nameEn: string
  uprightKeywords: string
  reversedKeywords: string
  yesNoTendency: 'yes' | 'no' | 'neutral'
}

export const CDN_BASE = 'https://cdn.tarotqa.com/images-optimized/tarot'

export function getCardImageUrl(nameEn: string): string {
  return `${CDN_BASE}/${nameEn.replace(/ /g, '_')}.webp`
}

export function getCardSlug(nameEn: string): string {
  return nameEn.toLowerCase().replace(/ /g, '-')
}

export function findCardBySlug(slug: string): TarotCard | undefined {
  return tarotCards.find(c => getCardSlug(c.nameEn) === slug)
}

export const tarotCards: TarotCard[] = [
  // === Major Arcana (0-21) ===
  { id: 0, name: '愚者', nameEn: 'The Fool', uprightKeywords: '新的开始、自由精神、无限潜能', reversedKeywords: '鲁莽冲动、缺乏计划、逃避现实', yesNoTendency: 'neutral' },
  { id: 1, name: '魔术师', nameEn: 'The Magician', uprightKeywords: '创造力、资源整合、意志力', reversedKeywords: '精力分散、欺骗操纵、才能滥用', yesNoTendency: 'yes' },
  { id: 2, name: '女祭司', nameEn: 'The High Priestess', uprightKeywords: '直觉、神秘知识、潜意识', reversedKeywords: '隐藏真相、直觉混乱、情绪动荡', yesNoTendency: 'neutral' },
  { id: 3, name: '女皇', nameEn: 'The Empress', uprightKeywords: '丰饶、母性、创造力', reversedKeywords: '过度放纵、创造力阻塞、依赖', yesNoTendency: 'yes' },
  { id: 4, name: '皇帝', nameEn: 'The Emperor', uprightKeywords: '权威、秩序、纪律、领导力', reversedKeywords: '暴政、僵化、权力滥用', yesNoTendency: 'yes' },
  { id: 5, name: '教皇', nameEn: 'The Hierophant', uprightKeywords: '传统、仪式、道德准则', reversedKeywords: '教条主义、思想束缚、反叛传统', yesNoTendency: 'yes' },
  { id: 6, name: '恋人', nameEn: 'The Lovers', uprightKeywords: '爱的连结、关键抉择、灵魂共鸣', reversedKeywords: '关系失衡、优柔寡断、价值冲突', yesNoTendency: 'yes' },
  { id: 7, name: '战车', nameEn: 'The Chariot', uprightKeywords: '意志力胜利、自我控制、目标达成', reversedKeywords: '方向迷失、精力耗尽、控制失败', yesNoTendency: 'yes' },
  { id: 8, name: '力量', nameEn: 'Strength', uprightKeywords: '内在力量、以柔克刚、勇气', reversedKeywords: '权力滥用、自我怀疑、失控', yesNoTendency: 'yes' },
  { id: 9, name: '隐士', nameEn: 'The Hermit', uprightKeywords: '内省、追求智慧、独处成长', reversedKeywords: '自我封闭、逃避现实、过度隐居', yesNoTendency: 'neutral' },
  { id: 10, name: '命运之轮', nameEn: 'Wheel of Fortune', uprightKeywords: '命运转折、机会把握、因果循环', reversedKeywords: '混乱失控、抗拒改变、错失良机', yesNoTendency: 'yes' },
  { id: 11, name: '正义', nameEn: 'Justice', uprightKeywords: '因果报应、公正裁决、道德责任', reversedKeywords: '司法不公、逃避责任、偏见影响', yesNoTendency: 'neutral' },
  { id: 12, name: '倒吊人', nameEn: 'The Hanged Man', uprightKeywords: '牺牲奉献、视角转换、被动成长', reversedKeywords: '徒劳牺牲、抗拒改变、思维僵化', yesNoTendency: 'neutral' },
  { id: 13, name: '死神', nameEn: 'Death', uprightKeywords: '转化性结束、不可避免的改变', reversedKeywords: '抗拒改变、停滞腐朽、未愈创伤', yesNoTendency: 'no' },
  { id: 14, name: '节制', nameEn: 'Temperance', uprightKeywords: '和谐、平衡、转化、适度', reversedKeywords: '失衡、过度、极端、能量阻塞', yesNoTendency: 'yes' },
  { id: 15, name: '恶魔', nameEn: 'The Devil', uprightKeywords: '欲望束缚、物质执着、恐惧', reversedKeywords: '打破枷锁、欲望觉醒、灵魂恢复', yesNoTendency: 'no' },
  { id: 16, name: '塔', nameEn: 'The Tower', uprightKeywords: '突然剧变、范式转移、强制觉醒', reversedKeywords: '抗拒改变、延迟爆发、虚假稳定', yesNoTendency: 'no' },
  { id: 17, name: '星星', nameEn: 'The Star', uprightKeywords: '重新希望、创意流动、情感疗愈', reversedKeywords: '希望消退、创意阻塞、信仰动摇', yesNoTendency: 'yes' },
  { id: 18, name: '月亮', nameEn: 'The Moon', uprightKeywords: '潜意识波动、直觉觉醒、恐惧幻象', reversedKeywords: '真相揭露、恐惧克服、直觉澄清', yesNoTendency: 'no' },
  { id: 19, name: '太阳', nameEn: 'The Sun', uprightKeywords: '喜悦成功、充沛活力、真相揭示', reversedKeywords: '盲目乐观、成长受阻、能量耗竭', yesNoTendency: 'yes' },
  { id: 20, name: '审判', nameEn: 'Judgement', uprightKeywords: '灵魂觉醒、因果清算、关键转折', reversedKeywords: '拒绝召唤、未解因果、自我否定', yesNoTendency: 'yes' },
  { id: 21, name: '世界', nameEn: 'The World', uprightKeywords: '圆满完成、周期完结、宇宙和谐', reversedKeywords: '未完成事务、停滞循环、整合困难', yesNoTendency: 'yes' },

  // === Wands / 权杖 (22-35) ===
  { id: 22, name: '权杖王牌', nameEn: 'Ace of Wands', uprightKeywords: '新机遇、创意爆发、冒险启程', reversedKeywords: '动力丧失、创意枯竭、能量阻塞', yesNoTendency: 'yes' },
  { id: 23, name: '权杖二', nameEn: 'Two of Wands', uprightKeywords: '未来规划、潜在机遇、战略决策', reversedKeywords: '犹豫不决、错失机会、视野受限', yesNoTendency: 'yes' },
  { id: 24, name: '权杖三', nameEn: 'Three of Wands', uprightKeywords: '战略布局、跨领域合作、远见', reversedKeywords: '进展延迟、视野受限、合作崩溃', yesNoTendency: 'yes' },
  { id: 25, name: '权杖四', nameEn: 'Four of Wands', uprightKeywords: '庆祝、家庭和谐、事业稳定', reversedKeywords: '基础不稳、庆祝延迟、家庭不和', yesNoTendency: 'yes' },
  { id: 26, name: '权杖五', nameEn: 'Five of Wands', uprightKeywords: '意见分歧、竞争摩擦、能量碰撞', reversedKeywords: '无谓争端、资源消耗、目标混乱', yesNoTendency: 'no' },
  { id: 27, name: '权杖六', nameEn: 'Six of Wands', uprightKeywords: '公众认可、凯旋胜利、成就庆祝', reversedKeywords: '虚假荣耀、过度傲慢、团队分裂', yesNoTendency: 'yes' },
  { id: 28, name: '权杖七', nameEn: 'Seven of Wands', uprightKeywords: '坚定立场、主动防御、竞争抵抗', reversedKeywords: '立场动摇、回避冲突、不堪重负', yesNoTendency: 'neutral' },
  { id: 29, name: '权杖八', nameEn: 'Eight of Wands', uprightKeywords: '快速推进、信息传递、能量涌动', reversedKeywords: '延迟阻碍、沟通中断、冲动决策', yesNoTendency: 'yes' },
  { id: 30, name: '权杖九', nameEn: 'Nine of Wands', uprightKeywords: '坚守阵地、经验防御、持久耐力', reversedKeywords: '过度防御、精力耗尽、偏执多疑', yesNoTendency: 'neutral' },
  { id: 31, name: '权杖十', nameEn: 'Ten of Wands', uprightKeywords: '超负荷、责任过重、精疲力竭', reversedKeywords: '释放负担、学会委派、恢复平衡', yesNoTendency: 'no' },
  { id: 32, name: '权杖侍者', nameEn: 'Page of Wands', uprightKeywords: '新机遇探索、能量涌动、创意萌芽', reversedKeywords: '冲动鲁莽、半途而废、计划不周', yesNoTendency: 'yes' },
  { id: 33, name: '权杖骑士', nameEn: 'Knight of Wands', uprightKeywords: '迅速行动、冒险精神、热情洋溢', reversedKeywords: '冲动鲁莽、缺乏耐心、精力分散', yesNoTendency: 'yes' },
  { id: 34, name: '权杖皇后', nameEn: 'Queen of Wands', uprightKeywords: '光芒活力、目标导向、自信领导', reversedKeywords: '专横跋扈、精力分散、情绪波动', yesNoTendency: 'yes' },
  { id: 35, name: '权杖国王', nameEn: 'King of Wands', uprightKeywords: '魅力领导、创业驱动、远见激励', reversedKeywords: '独裁专断、精力分散、冲动决策', yesNoTendency: 'yes' },

  // === Cups / 圣杯 (36-49) ===
  { id: 36, name: '圣杯王牌', nameEn: 'Ace of Cups', uprightKeywords: '情感开始、开放接纳、爱与直觉', reversedKeywords: '情感阻塞、精神封闭、孤独', yesNoTendency: 'yes' },
  { id: 37, name: '圣杯二', nameEn: 'Two of Cups', uprightKeywords: '情感共鸣、平衡关系、合作统一', reversedKeywords: '情感失衡、关系紧张、误解', yesNoTendency: 'yes' },
  { id: 38, name: '圣杯三', nameEn: 'Three of Cups', uprightKeywords: '庆祝、友谊、团结、社交', reversedKeywords: '孤立、误解、社交疲劳', yesNoTendency: 'yes' },
  { id: 39, name: '圣杯四', nameEn: 'Four of Cups', uprightKeywords: '情感麻木、忽视机会、自我封闭', reversedKeywords: '重新参与、接受新机会、打破冷漠', yesNoTendency: 'no' },
  { id: 40, name: '圣杯五', nameEn: 'Five of Cups', uprightKeywords: '失去、后悔、悲伤', reversedKeywords: '康复、希望、接受、前行', yesNoTendency: 'no' },
  { id: 41, name: '圣杯六', nameEn: 'Six of Cups', uprightKeywords: '怀旧、童年、纯真、旧友', reversedKeywords: '逃避现实、过度怀旧、拒绝成长', yesNoTendency: 'yes' },
  { id: 42, name: '圣杯七', nameEn: 'Seven of Cups', uprightKeywords: '幻想、选择、可能性、诱惑', reversedKeywords: '清晰、现实、聚焦、选择困难', yesNoTendency: 'neutral' },
  { id: 43, name: '圣杯八', nameEn: 'Eight of Cups', uprightKeywords: '放弃、追寻、转变、内在召唤', reversedKeywords: '逃避、恐惧改变、内心矛盾', yesNoTendency: 'no' },
  { id: 44, name: '圣杯九', nameEn: 'Nine of Cups', uprightKeywords: '满足、愿望实现、成就、幸福', reversedKeywords: '不满足、过度放纵、空虚', yesNoTendency: 'yes' },
  { id: 45, name: '圣杯十', nameEn: 'Ten of Cups', uprightKeywords: '家庭幸福、情感圆满、和谐', reversedKeywords: '家庭不和、情感丧失、短暂幸福', yesNoTendency: 'yes' },
  { id: 46, name: '圣杯侍者', nameEn: 'Page of Cups', uprightKeywords: '新体验、创造力、好奇心', reversedKeywords: '不成熟、创造力阻塞、封闭', yesNoTendency: 'yes' },
  { id: 47, name: '圣杯骑士', nameEn: 'Knight of Cups', uprightKeywords: '浪漫、追梦、情感表达、理想主义', reversedKeywords: '幻想、情绪不稳、逃避现实', yesNoTendency: 'yes' },
  { id: 48, name: '圣杯皇后', nameEn: 'Queen of Cups', uprightKeywords: '情感深度、直觉、同理心', reversedKeywords: '情绪不稳、过度敏感、情感操控', yesNoTendency: 'yes' },
  { id: 49, name: '圣杯国王', nameEn: 'King of Cups', uprightKeywords: '情感平衡、智慧、领导力', reversedKeywords: '情感压抑、操控、情绪不稳', yesNoTendency: 'yes' },

  // === Swords / 宝剑 (50-63) ===
  { id: 50, name: '宝剑王牌', nameEn: 'Ace of Swords', uprightKeywords: '思维清晰、突破、真理', reversedKeywords: '困惑、思维阻塞、误导', yesNoTendency: 'yes' },
  { id: 51, name: '宝剑二', nameEn: 'Two of Swords', uprightKeywords: '抉择、平衡、内心冲突', reversedKeywords: '困惑、逃避、犹豫不决', yesNoTendency: 'neutral' },
  { id: 52, name: '宝剑三', nameEn: 'Three of Swords', uprightKeywords: '心痛、悲伤、分离、失去', reversedKeywords: '疗愈、宽恕、恢复', yesNoTendency: 'no' },
  { id: 53, name: '宝剑四', nameEn: 'Four of Swords', uprightKeywords: '休息、恢复、反思', reversedKeywords: '焦躁不安、倦怠、恢复缓慢', yesNoTendency: 'neutral' },
  { id: 54, name: '宝剑五', nameEn: 'Five of Swords', uprightKeywords: '冲突、胜利的代价、纷争', reversedKeywords: '和解、理解、合作', yesNoTendency: 'no' },
  { id: 55, name: '宝剑六', nameEn: 'Six of Swords', uprightKeywords: '过渡、前行、释放', reversedKeywords: '停滞、困难、逃避', yesNoTendency: 'neutral' },
  { id: 56, name: '宝剑七', nameEn: 'Seven of Swords', uprightKeywords: '策略、隐秘、谨慎', reversedKeywords: '揭露、坦诚、后果', yesNoTendency: 'no' },
  { id: 57, name: '宝剑八', nameEn: 'Eight of Swords', uprightKeywords: '束缚、限制、无助、困境', reversedKeywords: '解放、自由、突破', yesNoTendency: 'no' },
  { id: 58, name: '宝剑九', nameEn: 'Nine of Swords', uprightKeywords: '焦虑、恐惧、失眠、内心冲突', reversedKeywords: '释放、安慰、希望', yesNoTendency: 'no' },
  { id: 59, name: '宝剑十', nameEn: 'Ten of Swords', uprightKeywords: '终结、重生、痛苦、挫折', reversedKeywords: '恢复、希望、重建', yesNoTendency: 'no' },
  { id: 60, name: '宝剑侍者', nameEn: 'Page of Swords', uprightKeywords: '好奇、智慧、探索、学习', reversedKeywords: '不成熟、鲁莽、误解', yesNoTendency: 'neutral' },
  { id: 61, name: '宝剑骑士', nameEn: 'Knight of Swords', uprightKeywords: '行动、决心、专注、果断', reversedKeywords: '冲动、鲁莽、失控', yesNoTendency: 'neutral' },
  { id: 62, name: '宝剑皇后', nameEn: 'Queen of Swords', uprightKeywords: '智慧、独立、理性、客观', reversedKeywords: '冷漠、孤立、偏见', yesNoTendency: 'neutral' },
  { id: 63, name: '宝剑国王', nameEn: 'King of Swords', uprightKeywords: '权威、理性、决策、客观', reversedKeywords: '暴政、冷漠、偏见', yesNoTendency: 'neutral' },

  // === Pentacles / 钱币 (64-77) ===
  { id: 64, name: '钱币王牌', nameEn: 'Ace of Pentacles', uprightKeywords: '新机遇、繁荣、财富、稳定', reversedKeywords: '错失机会、财务不稳', yesNoTendency: 'yes' },
  { id: 65, name: '钱币二', nameEn: 'Two of Pentacles', uprightKeywords: '平衡、适应、灵活、管理', reversedKeywords: '失衡、混乱、压力', yesNoTendency: 'neutral' },
  { id: 66, name: '钱币三', nameEn: 'Three of Pentacles', uprightKeywords: '合作、团队、集体智慧', reversedKeywords: '缺乏合作、团队不和', yesNoTendency: 'yes' },
  { id: 67, name: '钱币四', nameEn: 'Four of Pentacles', uprightKeywords: '控制、保守、安全、稳定', reversedKeywords: '放手、开放、慷慨', yesNoTendency: 'neutral' },
  { id: 68, name: '钱币五', nameEn: 'Five of Pentacles', uprightKeywords: '匮乏、困苦、孤立、挑战', reversedKeywords: '恢复、希望、支持', yesNoTendency: 'no' },
  { id: 69, name: '钱币六', nameEn: 'Six of Pentacles', uprightKeywords: '慷慨、分享、平衡、给予', reversedKeywords: '失衡、自私、吝啬', yesNoTendency: 'yes' },
  { id: 70, name: '钱币七', nameEn: 'Seven of Pentacles', uprightKeywords: '耐心、评估、规划、等待', reversedKeywords: '焦虑、失望、缺乏进展', yesNoTendency: 'neutral' },
  { id: 71, name: '钱币八', nameEn: 'Eight of Pentacles', uprightKeywords: '勤勉、技能提升、专注', reversedKeywords: '懒散、缺乏技能、分心', yesNoTendency: 'yes' },
  { id: 72, name: '钱币九', nameEn: 'Nine of Pentacles', uprightKeywords: '独立、成就、物质丰裕', reversedKeywords: '依赖、物质匮乏、孤独', yesNoTendency: 'yes' },
  { id: 73, name: '钱币十', nameEn: 'Ten of Pentacles', uprightKeywords: '家族繁荣、物质圆满、成就', reversedKeywords: '家庭不和、物质匮乏', yesNoTendency: 'yes' },
  { id: 74, name: '钱币侍者', nameEn: 'Page of Pentacles', uprightKeywords: '新机遇、学习、成长', reversedKeywords: '懒散、缺乏动力、停滞', yesNoTendency: 'yes' },
  { id: 75, name: '钱币骑士', nameEn: 'Knight of Pentacles', uprightKeywords: '勤勉、责任、专注、坚定', reversedKeywords: '懒散、缺乏动力、停滞', yesNoTendency: 'yes' },
  { id: 76, name: '钱币皇后', nameEn: 'Queen of Pentacles', uprightKeywords: '丰裕、关怀、精通、成功', reversedKeywords: '物质匮乏、冷漠、失败', yesNoTendency: 'yes' },
  { id: 77, name: '钱币国王', nameEn: 'King of Pentacles', uprightKeywords: '成功、稳定、精通、目标', reversedKeywords: '物质匮乏、失败、动荡', yesNoTendency: 'yes' },
]
