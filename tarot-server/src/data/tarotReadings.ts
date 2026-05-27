import type { TarotCard } from './tarotCards'

export interface ReadingResult {
  answer: '是' | '否'
  answerColor: string
  confidence: string
  interpretation: string
  advice: string
  conclusion: string
}

export interface ThreeCardReadingResult {
  answer: string
  answerColor: string
  confidence: string
  level: 'definite-yes' | 'likely-yes' | 'conditional' | 'likely-no' | 'definite-no'
  interpretation: string
  advice: string
  conclusion: string
  cardReadings: { summary: string }[]
}

export interface DailyFortuneResult {
  cardName: string
  cardNameEn: string
  isReversed: boolean
  sections: {
    intro: string
    overall: string
    love: string
    career: string
    wealth: string
    health: string
    mystery: string
  }
  ratings: {
    overall: number
    love: number
    career: number
    wealth: number
    health: number
  }
}

function getEffectiveTendency(card: TarotCard, isReversed: boolean): 'yes' | 'no' | 'neutral' {
  if (card.yesNoTendency === 'neutral') return 'neutral'
  if (isReversed) {
    if (card.yesNoTendency === 'yes') return 'no'
    return 'yes'
  }
  return card.yesNoTendency
}

const interpretationTemplates = {
  yes: [
    (card: TarotCard, isReversed: boolean, question: string) =>
      `${card.name}${isReversed ? '（逆位）' : '（正位）'}为您的问题「${question}」带来了积极的信号。这张牌象征着${isReversed ? card.reversedKeywords : card.uprightKeywords}，表明当前的能量正在朝着有利的方向流动。\n\n塔罗牌的智慧告诉我们，宇宙正在支持您的方向。${card.name}的出现意味着您目前的道路是正确的，前方有着光明的前景。`,
    (card: TarotCard, isReversed: boolean, question: string) =>
      `抽到${card.name}${isReversed ? '（逆位）' : '（正位）'}，这是一个令人鼓舞的征兆。关于您的问题「${question}」，牌面所展现的${isReversed ? card.reversedKeywords : card.uprightKeywords}的能量指向肯定的答案。\n\n这张牌提醒您，现在正是采取行动的好时机。宇宙的能量与您的意愿相呼应，成功的可能性很大。`,
  ],
  no: [
    (card: TarotCard, isReversed: boolean, question: string) =>
      `${card.name}${isReversed ? '（逆位）' : '（正位）'}为您的问题「${question}」揭示了一些需要注意的挑战。这张牌代表着${isReversed ? card.reversedKeywords : card.uprightKeywords}，暗示当前并非最佳时机。\n\n塔罗牌建议您暂时放慢脚步，重新审视您的计划。这并不意味着永远不行，而是此刻需要更多的准备和耐心。`,
    (card: TarotCard, isReversed: boolean, question: string) =>
      `${card.name}${isReversed ? '（逆位）' : '（正位）'}的出现，关于「${question}」这个问题，牌面显示了${isReversed ? card.reversedKeywords : card.uprightKeywords}的能量。这暗示目前的条件可能尚未成熟。\n\n宇宙并非在阻止您，而是在提醒您可能需要换一个角度来看待这个问题，或者等待更好的时机。`,
  ],
  neutral: [
    (card: TarotCard, isReversed: boolean, question: string) =>
      `${card.name}${isReversed ? '（逆位）' : '（正位）'}为您的问题「${question}」带来了复杂的信息。这张牌象征着${isReversed ? card.reversedKeywords : card.uprightKeywords}，答案取决于您的选择和行动。\n\n塔罗牌告诉我们，结果尚未确定。您当前的决策和态度将直接影响最终的走向，需要仔细权衡各方面因素。`,
  ],
}

const adviceTemplates = {
  yes: [
    '把握当前的积极能量，勇敢地朝着目标前进。信任自己的直觉，同时保持脚踏实地的态度，成功就在不远处。',
    '现在是行动的好时机。保持积极的心态，相信自己的能力。同时也要做好充分的准备，让成功水到渠成。',
  ],
  no: [
    '不要气馁，暂时的否定并不代表永远。利用这段时间来充实自己，调整计划。当时机成熟时，您会更加准备就绪。',
    '耐心是现在最重要的品质。花时间重新评估您的目标和方法，也许换一个方向会带来意想不到的收获。',
  ],
  neutral: [
    '保持开放的心态，同时谨慎地评估各种可能性。倾听内心的声音，但也要结合现实情况做出判断。',
    '现在是反思和收集更多信息的时候。不要急于做决定，让事情自然发展，答案会逐渐清晰。',
  ],
}

const conclusionTemplates = {
  yes: [
    '总体来看，能量流向积极。相信自己的选择，勇敢前行。',
    '宇宙给出了肯定的信号，抓住机遇，展现您的力量。',
  ],
  no: [
    '虽然现在的答案倾向于否定，但这也是成长和反思的机会。',
    '暂时的停滞是为了更好的出发，利用这段时间好好规划未来。',
  ],
  neutral: [
    '结果掌握在您自己手中，认真思考后做出最适合自己的选择。',
    '保持平和的心态，无论结果如何，都将是一次宝贵的经历。',
  ],
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function generateSingleCardReading(
  card: TarotCard,
  isReversed: boolean,
  question: string
): ReadingResult {
  const tendency = getEffectiveTendency(card, isReversed)

  let answer: '是' | '否'
  let answerColor: string
  let confidence: string

  if (tendency === 'yes') {
    answer = '是'
    answerColor = 'text-green-400'
    confidence = '高'
  } else if (tendency === 'no') {
    answer = '否'
    answerColor = 'text-red-400'
    confidence = '高'
  } else {
    answer = Math.random() > 0.5 ? '是' : '否'
    answerColor = 'text-yellow-400'
    confidence = '中等'
  }

  const templateFn = pickRandom(interpretationTemplates[tendency] || interpretationTemplates.neutral)
  const interpretation = templateFn(card, isReversed, question)
  const adviceKey = tendency === 'neutral' ? 'neutral' : answer === '是' ? 'yes' : 'no'
  const advice = pickRandom(adviceTemplates[adviceKey])
  const conclusion = pickRandom(conclusionTemplates[adviceKey])

  return { answer, answerColor, confidence, interpretation, advice, conclusion }
}

export function generateThreeCardReading(
  cards: { card: TarotCard; isReversed: boolean }[],
  question: string
): ThreeCardReadingResult {
  const tendencies = cards.map((c) => getEffectiveTendency(c.card, c.isReversed))
  const yesCount = tendencies.filter((t) => t === 'yes').length
  const noCount = tendencies.filter((t) => t === 'no').length

  let level: ThreeCardReadingResult['level']
  let answer: string
  let answerColor: string
  let confidence: string

  if (yesCount === 3) {
    level = 'definite-yes'
    answer = '明确的「是」'
    answerColor = 'text-green-400'
    confidence = '非常高'
  } else if (yesCount === 2) {
    level = 'likely-yes'
    answer = '可能的「是」'
    answerColor = 'text-emerald-400'
    confidence = '较高'
  } else if (noCount === 3) {
    level = 'definite-no'
    answer = '明确的「否」'
    answerColor = 'text-red-400'
    confidence = '非常高'
  } else if (noCount === 2) {
    level = 'likely-no'
    answer = '可能的「否」'
    answerColor = 'text-orange-400'
    confidence = '较高'
  } else {
    level = 'conditional'
    answer = '有条件的「是」'
    answerColor = 'text-yellow-400'
    confidence = '中等'
  }

  const positionNames = ['支持力量', '挑战力量', '最终结果']
  const cardReadings = cards.map((c, i) => {
    const t = tendencies[i]
    const keywords = c.isReversed ? c.card.reversedKeywords : c.card.uprightKeywords
    return {
      summary: `【${positionNames[i]}】${c.card.name}${c.isReversed ? '（逆位）' : '（正位）'}代表着${keywords}。${
        t === 'yes'
          ? '这张牌为您的问题带来积极的能量支持。'
          : t === 'no'
            ? '这张牌提示存在需要注意的挑战。'
            : '这张牌的影响取决于您如何应对当前的情况。'
      }`,
    }
  })

  const overallTendency = level.includes('yes') ? 'yes' : level.includes('no') ? 'no' : 'neutral'

  const interpretation = `关于您的问题「${question}」，三张牌分别揭示了不同层面的信息：\n\n${cardReadings.map((r) => r.summary).join('\n\n')}\n\n综合三张牌的能量，${
    overallTendency === 'yes'
      ? '整体能量偏向积极，宇宙正在支持您的方向。'
      : overallTendency === 'no'
        ? '整体能量提示需要谨慎，当前可能不是最佳时机。'
        : '能量呈现混合状态，结果将取决于您的选择和行动。'
  }`

  const advice = pickRandom(adviceTemplates[overallTendency])
  const conclusion = pickRandom(conclusionTemplates[overallTendency])

  return { answer, answerColor, confidence, level, interpretation, advice, conclusion, cardReadings }
}

export function generateDailyFortune(
  card: TarotCard,
  isReversed: boolean,
  zodiacSign?: string
): DailyFortuneResult {
  const orientation = isReversed ? '逆位' : '正位'
  const keywords = isReversed ? card.reversedKeywords : card.uprightKeywords
  const zodiacText = zodiacSign ? `作为${zodiacSign}座的你，` : ''

  const tendency = getEffectiveTendency(card, isReversed)
  const baseRating = tendency === 'yes' ? 4 : tendency === 'no' ? 2 : 3
  const randomOffset = () => Math.max(1, Math.min(5, baseRating + Math.floor(Math.random() * 3) - 1))

  return {
    cardName: card.name,
    cardNameEn: card.nameEn,
    isReversed,
    sections: {
      intro: `今天为你抽到的是${card.name}（${orientation}），关键词为${keywords}。${zodiacText}这张牌揭示了今日能量的核心主题。`,
      overall: `${card.name}（${orientation}）为你的今日能量定下了基调。${keywords}的能量将贯穿你的一天。${tendency === 'yes' ? '整体来看，今天的能量是积极向上的，适合主动出击和把握机会。' : tendency === 'no' ? '今天的能量提醒你保持谨慎和内省，不宜冲动行事。' : '今天的能量较为中性，适合观察和准备，保持灵活应变。'}`,
      love: `在感情方面，${card.name}的${orientation}能量${tendency === 'yes' ? '为你的感情生活带来温暖和甜蜜。如果你正在寻觅爱情，今天可能会遇到令人心动的邂逅。' : tendency === 'no' ? '提醒你关注沟通中的细节，避免因误解而产生不必要的摩擦。' : '带来了反思的机会，审视你对感情的真实需求。'}`,
      career: `事业方面，${card.name}（${orientation}）${tendency === 'yes' ? '预示着工作中的积极进展。你的努力正在被看见，今天适合展现你的专业能力和创意想法。' : tendency === 'no' ? '建议你今天低调行事，专注于手头的任务，避免卷入职场纷争。' : '提醒你在工作中保持平衡，既不要过于激进，也不要过于被动。'}`,
      wealth: `财运方面，今日${card.name}的${orientation}能量${tendency === 'yes' ? '为你带来积极的财务信号。可以关注一些投资机会，但也要理性分析再做决定。' : tendency === 'no' ? '建议你今天谨慎理财，避免冲动消费和高风险投资。' : '较为平稳，适合做一些长期的财务规划而非短期操作。'}`,
      health: `健康方面，${card.name}的能量${tendency === 'yes' ? '为你带来充沛的活力。今天适合进行运动或户外活动，让身心都得到充分的释放。' : tendency === 'no' ? '提醒你注意休息和调整，不要过度消耗精力。可以尝试冥想或瑜伽来恢复内在平衡。' : '建议你关注身心的平衡，保持规律的作息和适度的运动。'}`,
      mystery: `${card.name}为你带来的今日神秘指引：${tendency === 'yes' ? '今天的幸运色是紫色和金色，佩戴相关饰品或穿着这些颜色的衣物可以增强你的能量场。' : tendency === 'no' ? '今天适合佩戴一些具有保护意义的物品，如水晶或护身符，帮助你抵御负面能量。' : '今天的能量密码隐藏在"平衡"之中，尝试在一天中找到属于你的宁静时刻。'}`,
    },
    ratings: {
      overall: randomOffset(),
      love: randomOffset(),
      career: randomOffset(),
      wealth: randomOffset(),
      health: randomOffset(),
    },
  }
}
