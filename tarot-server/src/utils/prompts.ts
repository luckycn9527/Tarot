// AI prompt templates (migrated from frontend)

export const SYSTEM_PROMPT = `你是一位经验丰富的塔罗占卜师，拥有深厚的塔罗牌知识和直觉洞察力。你的解读风格温暖而富有智慧，既尊重塔罗传统，又能结合现代生活给出实用建议。

重要规则：
1. 你必须严格按照指定的 JSON 格式返回结果，不要包含任何其他文字
2. 所有内容使用中文
3. 解读要结合用户的具体问题，给出个性化的分析
4. 语气温暖、专业、富有洞察力
5. 不要给出绝对化的预言，而是提供指导性的建议`;

export function buildSingleCardPrompt(
  cardName: string,
  orientation: string,
  keywords: string,
  question: string
): string {
  return `用户问题：「${question}」

抽到的塔罗牌：${cardName}（${orientation}）
关键词：${keywords}

请基于这张牌为用户的问题进行是否占卜解读。

你必须返回以下 JSON 格式（不要包含 markdown 代码块标记）：
{
  "answer": "是" 或 "否",
  "interpretation": "详细的牌面解读，200-300字，结合用户问题和牌面含义进行分析",
  "advice": "针对性的建议，50-100字",
  "conclusion": "简短的总结，30-50字"
}`;
}

export function buildThreeCardPrompt(
  cardDescriptions: string,
  question: string
): string {
  return `用户问题：「${question}」

三卡牌阵：
${cardDescriptions}

牌阵位置说明：
- 支持力量：有利因素和支持能量
- 挑战力量：需要面对的挑战和阻碍
- 最终结果：综合前两张牌得出的最终趋势

请基于三张牌的组合为用户进行是否占卜解读。

你必须返回以下 JSON 格式（不要包含 markdown 代码块标记）：
{
  "answer": "明确的「是」" 或 "可能的「是」" 或 "有条件的「是」" 或 "可能的「否」" 或 "明确的「否」",
  "level": "definite-yes" 或 "likely-yes" 或 "conditional" 或 "likely-no" 或 "definite-no",
  "cardReadings": [
    { "summary": "第1张牌的解读，含【支持力量】前缀，80-120字" },
    { "summary": "第2张牌的解读，含【挑战力量】前缀，80-120字" },
    { "summary": "第3张牌的解读，含【最终结果】前缀，80-120字" }
  ],
  "interpretation": "综合三张牌的整体解读，200-300字",
  "advice": "针对性的建议，50-100字",
  "conclusion": "简短的总结，30-50字"
}`;
}

/**
 * 追问对话：基于已完成的占卜，回答问卜者的进一步提问。
 * 返回纯文本（非 JSON），由 reader 的人格语气作答。
 */
/**
 * 星座每日运势：将外部英文原文「翻译 + 扩展」为结构化中文运势。
 * 若 sourceText 为空（外部源不可用），则退化为基于星座特质的纯生成。
 * 返回严格 JSON：一句话总结 + 五维文字 + 五维星级 + 能量雷达 + 行动建议 + 幸运提示。
 */
export function buildHoroscopePrompt(
  signName: string,
  dateStr: string,
  sourceText?: string,
  periodLabel = '今日',
  locale: 'zh-CN' | 'en-US' = 'zh-CN',
): string {
  if (locale === 'en-US') {
    const sourceBlock = sourceText && sourceText.trim()
      ? `Use the following current English horoscope as the factual and tonal source. Expand it thoughtfully across the requested dimensions without copying it verbatim:
"""
${sourceText.trim()}
"""`
      : `No external source is available. Use the typical traits of ${signName} to create a grounded ${periodLabel.toLowerCase()} outlook.`;

    return `Date range: ${dateStr}. Create the ${periodLabel.toLowerCase()} horoscope for ${signName}.

${sourceBlock}

Requirements:
1. Write every user-facing value in natural English.
2. Keep the tone warm, specific, and non-deterministic. Give practical guidance.
3. Make each dimension distinct while preserving one coherent theme.
4. Ratings must match the tone of their corresponding sections.
5. Return only the JSON object below, with no markdown or extra text.

{
  "summary": "One-sentence overall theme, 12-24 words",
  "overallScore": "integer from 55 to 98",
  "sections": {
    "overall": "Overall outlook, 45-80 words",
    "love": "Love outlook, 35-70 words",
    "career": "Career or study outlook, 35-70 words",
    "wealth": "Money outlook, 35-70 words",
    "health": "Well-being outlook, 35-70 words"
  },
  "energy": { "mood": 0, "action": 0, "social": 0, "intuition": 0 },
  "advice": {
    "do": "A useful action, 6-14 words",
    "avoid": "Something to avoid, 6-14 words",
    "mantra": "A short reminder, 6-14 words",
    "keyword": "One to three words"
  },
  "ratings": { "overall": 1, "love": 1, "career": 1, "wealth": 1, "health": 1 },
  "luckyColor": "A natural English color name",
  "luckyNumber": 0
}

Use the full overallScore range when justified rather than clustering every result in the 70s.`;
  }
  const sourceBlock = sourceText && sourceText.trim()
    ? `以下是该星座${periodLabel}运势的英文原文，请以它为依据进行翻译并合理扩展（不要照搬直译，要符合中文表达习惯）：
"""
${sourceText.trim()}
"""`
    : `（暂无外部原文，请基于「${signName}」的典型星座特质，生成符合${periodLabel}基调的运势。）`;

  return `时间范围：${dateStr}。请输出「${signName}」的${periodLabel}星座运势。

${sourceBlock}

要求：
1. 以英文原文的整体基调为核心，翻译为自然流畅的中文，并在各维度上做合理扩展。
2. 语气温暖、专业、有画面感，不要绝对化预言，给出指导性建议。
3. 各维度内容要具体、不空泛，且彼此呼应原文主旨。
4. 星级评分要与对应维度的文字基调一致（正面高、谨慎低）。
5. 全部使用中文。

你必须只返回以下 JSON 对象（不要包含 markdown 代码块标记，不要输出 JSON 以外的任何字符）：
{
  "summary": "${periodLabel}整体基调一句话，20-35字",
  "overallScore": 55到98的整数,
  "sections": {
    "overall": "综合运势，60-100字",
    "love": "爱情运势，50-90字",
    "career": "事业/学业运势，50-90字",
    "wealth": "财富运势，50-90字",
    "health": "健康运势，50-90字"
  },
  "energy": {
    "mood": 0到100的整数,
    "action": 0到100的整数,
    "social": 0到100的整数,
    "intuition": 0到100的整数
  },
  "advice": {
    "do": "适合做什么，12-24字",
    "avoid": "不适合做什么，12-24字",
    "mantra": "一句提醒，12-24字",
    "keyword": "关键词，2-6字"
  },
  "ratings": {
    "overall": 1到5的整数,
    "love": 1到5的整数,
    "career": 1到5的整数,
    "wealth": 1到5的整数,
    "health": 1到5的整数
  },
  "luckyColor": "幸运色，2-6字",
  "luckyNumber": 0到9的整数
}

关于 overallScore：这是${periodLabel}综合运势指数（55-98）。请依据原文与各维度强弱**真实给分、充分使用区间**，运势好的时候可到 90 以上、平淡或受挫时可低至 60 上下；切忌每次都给 70 多的中间值。`;
}

export function buildReaderFollowupPrompt(
  spreadName: string,
  cardDescriptions: string,
  originalQuestion: string,
  priorReading: string,
  followupQuestion: string,
  locale: 'zh-CN' | 'en-US' = 'zh-CN',
): string {
  if (locale === 'en-US') {
    return `This is a completed Tarot reading. The querent wants to ask a follow-up about the same reading.

[Reading context]
Original question: "${originalQuestion}"
Spread: ${spreadName}
Cards:
${cardDescriptions}

Your earlier reading:
${priorReading}

[Follow-up question]
"${followupQuestion}"

Answer in your established reader persona and stay tightly grounded in the cards and earlier reading.
Requirements:
1. Do not draw new cards or invent new card positions; deepen the existing reading only.
2. Answer the follow-up directly with specific, practical insight.
3. Write entirely in natural English, 150-300 words, in a warm conversational voice. Source card labels may contain Chinese; interpret them internally and never reproduce Chinese in your answer.
4. Return only the answer text. Do not use JSON, headings, list markers, or markdown code fences.`;
  }
  return `这是一次已经完成的塔罗占卜，现在问卜者想就同一次占卜结果继续追问。

【本次占卜背景】
最初的问题：「${originalQuestion}」
使用牌阵：${spreadName}
牌面信息：
${cardDescriptions}

你此前给出的解读：
${priorReading}

【问卜者的追问】
「${followupQuestion}」

请以你一贯的人格与语气，紧扣上面已经抽到的牌面和此前的解读来回答这个追问。
要求：
1. 不要重新抽牌，也不要假设新的牌面；只基于已有牌面深入。
2. 直接回应追问，给出有洞察力且可落地的解读或建议。
3. 中文，150-300 字，自然口语化的对话风格，不要使用 JSON、列表标记或 markdown 代码块。
4. 只输出回答正文本身，不要加前缀或标题。`;
}

export function buildReaderReadingPrompt(
  readerName: string,
  spreadName: string,
  cardDescriptions: string,
  question: string,
  category: string,
  locale: 'zh-CN' | 'en-US' = 'zh-CN',
): string {
  if (locale === 'en-US') {
    return `The querent's question: "${question}"
Category: ${category}
Spread: ${spreadName}

Cards:
${cardDescriptions}

Read for the querent in ${readerName}'s distinct voice and persona. Source card labels or keywords may contain Chinese; interpret them internally, but never reproduce Chinese in the answer.

You must return exactly one JSON object. Do not include an introduction, conclusion outside the JSON, markdown code fences, or any non-JSON text.

Return this exact shape:
{
  "messages": [
    { "type": "greeting", "content": "A 50-80 word opening in your voice that acknowledges the querent and their question" },
    { "type": "reveal", "content": "An 80-120 word first impression of the overall pattern in the cards" },
    { "type": "reading", "content": "A 200-400 word reading of every card position, connected to the querent's question" },
    { "type": "synthesis", "content": "A 150-250 word synthesis with clear, grounded guidance that connects all cards" },
    { "type": "closing", "content": "A 50-80 word closing encouragement in your distinctive voice" }
  ],
  "summary": "A 20-40 word English summary for the reading history"
}

Every value in "content" and "summary" must be natural English only.`;
  }
  return `问卜者的问题：「${question}」
问题分类：${category}
使用牌阵：${spreadName}

牌面信息：
${cardDescriptions}

请以${readerName}的人格和语言风格，为问卜者进行完整的对话式塔罗解读。

你必须只输出一个 JSON 对象：不要写前言/后记，不要用 markdown 代码块包裹，不要输出 JSON 以外的任何字符。

你必须返回以下 JSON 格式：
{
  "messages": [
    { "type": "greeting", "content": "开场白，用你独特的风格打招呼并回应问卜者的问题，50-80字" },
    { "type": "reveal", "content": "牌面第一印象，描述整体牌阵给你的直觉感受，80-120字" },
    { "type": "reading", "content": "逐一解读各牌位的含义，结合问卜者的问题深入分析每张牌，200-400字" },
    { "type": "synthesis", "content": "综合分析与核心建议，将所有牌面信息串联起来给出整体解读和具体建议，150-250字" },
    { "type": "closing", "content": "结语鼓励，用你的风格给出最后的寄语和力量，50-80字" }
  ],
  "summary": "一句话总结本次占卜结果，20-40字，用于历史记录显示"
}`;
}

export function buildDailyFortunePrompt(
  cardName: string,
  cardNameEn: string,
  orientation: string,
  keywords: string,
  zodiacSign?: string
): string {
  const zodiacInfo = zodiacSign ? `\n用户星座：${zodiacSign}座（请结合星座特质进行解读）` : '';

  return `今日运势占卜

抽到的塔罗牌：${cardName}（${cardNameEn}）- ${orientation}
关键词：${keywords}${zodiacInfo}

请为用户生成详细的今日运势解读，覆盖以下维度。

你必须返回以下 JSON 格式（不要包含 markdown 代码块标记）：
{
  "sections": {
    "intro": "开场白，50-80字，简要介绍今天抽到的牌和整体能量基调",
    "overall": "今日能量总览，100-150字，详细分析今天的整体运势走向和能量流动",
    "love": "爱情运势，80-120字，分析今日感情方面的运势和建议",
    "career": "事业运势，80-120字，分析今日工作和事业方面的运势",
    "wealth": "财富运势，80-120字，分析今日财运和理财建议",
    "health": "健康运势，80-120字，分析今日身心健康状况和建议",
    "mystery": "神秘指引，60-100字，提供一条独特的今日灵性指引、幸运色或幸运数字等"
  },
  "ratings": {
    "overall": 1-5的整数评分,
    "love": 1-5的整数评分,
    "career": 1-5的整数评分,
    "wealth": 1-5的整数评分,
    "health": 1-5的整数评分
  }
}`;
}
