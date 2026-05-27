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

export function buildReaderReadingPrompt(
  readerName: string,
  spreadName: string,
  cardDescriptions: string,
  question: string,
  category: string
): string {
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
