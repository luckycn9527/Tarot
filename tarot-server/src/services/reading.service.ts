import { tarotCards } from '../data/tarotCards.js';
import type { TarotCard } from '../data/tarotCards.js';
import { callDeepSeek } from './deepseek.service.js';
import { SYSTEM_PROMPT, buildSingleCardPrompt, buildThreeCardPrompt, buildDailyFortunePrompt, buildReaderReadingPrompt } from '../utils/prompts.js';
import { getReaderById } from '../data/readers.js';
import * as ReadingModel from '../models/reading.model.js';
import * as UserModel from '../models/user.model.js';
import * as AdminService from './admin.service.js';

function parseJsonResponse(text: string): Record<string, unknown> {
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7).trim();
  else if (cleaned.startsWith('```')) cleaned = cleaned.slice(3).trim();
  if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3).trim();

  const tryParseObject = (s: string): Record<string, unknown> => {
    const o = JSON.parse(s) as unknown;
    if (typeof o !== 'object' || o === null || Array.isArray(o)) {
      throw new Error('不是 JSON 对象');
    }
    return o as Record<string, unknown>;
  };

  try {
    return tryParseObject(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start < 0 || end <= start) {
      throw new Error('AI 返回中未找到可解析的 JSON 对象');
    }
    try {
      return tryParseObject(cleaned.slice(start, end + 1));
    } catch (e2) {
      const hint = e2 instanceof SyntaxError
        ? 'JSON 语法错误（可能被截断或混入了非 JSON 文本）'
        : (e2 instanceof Error ? e2.message : String(e2));
      throw new Error(`AI 返回解析失败：${hint}`);
    }
  }
}

function normalizeReaderReadingPayload(data: Record<string, unknown>): {
  messages: { type: string; content: string }[];
  summary: string;
} {
  const { messages: rawMessages, summary } = data;
  if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
    throw new Error('AI 返回的 messages 无效或为空');
  }
  if (typeof summary !== 'string' || !summary.trim()) {
    throw new Error('AI 返回的 summary 无效');
  }
  const messages = rawMessages.map((m: unknown, i: number) => {
    if (!m || typeof m !== 'object' || Array.isArray(m)) {
      throw new Error(`messages[${i}] 不是对象`);
    }
    const row = m as Record<string, unknown>;
    const type = typeof row.type === 'string' ? row.type : '';
    const content = typeof row.content === 'string' ? row.content : '';
    if (!type || !content.trim()) {
      throw new Error(`messages[${i}] 缺少有效的 type 或 content`);
    }
    return { type, content };
  });
  return { messages, summary: summary.trim() };
}

function randomCard(): { card: TarotCard; isReversed: boolean } {
  const card = tarotCards[Math.floor(Math.random() * tarotCards.length)];
  const isReversed = Math.random() < 0.5;
  return { card, isReversed };
}

function randomCards(count: number): { card: TarotCard; isReversed: boolean }[] {
  const pool = [...tarotCards];
  const result: { card: TarotCard; isReversed: boolean }[] = [];
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    result.push({ card: pool.splice(idx, 1)[0], isReversed: Math.random() < 0.5 });
  }
  return result;
}

export async function singleCardReading(userId: number, question: string, clientCardId?: number, clientOrientation?: string) {
  let card: TarotCard;
  let isReversed: boolean;

  if (clientCardId !== undefined && clientOrientation !== undefined) {
    const found = tarotCards.find(c => c.id === clientCardId);
    if (!found) throw new Error('无效的卡牌ID');
    card = found;
    isReversed = clientOrientation === 'reversed';
  } else {
    const picked = randomCard();
    card = picked.card;
    isReversed = picked.isReversed;
  }
  const orientation = isReversed ? '逆位' : '正位';
  const keywords = isReversed ? card.reversedKeywords : card.uprightKeywords;

  const userPrompt = buildSingleCardPrompt(card.name, orientation, keywords, question);
  const responseText = await callDeepSeek([
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userPrompt },
  ]);
  const data = parseJsonResponse(responseText);

  const answer = (data.answer as string) === '是' ? '是' : '否';
  const tendency = card.yesNoTendency === 'neutral' ? 'neutral' :
    (isReversed ? (card.yesNoTendency === 'yes' ? 'no' : 'yes') : card.yesNoTendency);

  let answerColor: string, confidence: string;
  if (tendency === 'neutral') { answerColor = 'text-yellow-400'; confidence = '中等'; }
  else if (answer === '是') { answerColor = 'text-green-400'; confidence = '高'; }
  else { answerColor = 'text-red-400'; confidence = '高'; }

  const result = {
    answer, answerColor, confidence,
    interpretation: data.interpretation as string,
    advice: data.advice as string,
    conclusion: data.conclusion as string,
  };

  // Decrement quota
  await UserModel.decrementQuota(userId);

  // Save to history
  const historyId = await ReadingModel.create({
    userId,
    type: 'single',
    question,
    cardIds: [card.id],
    orientations: [isReversed ? 'reversed' : 'upright'],
    answer: result.answer,
    resultData: result,
  });

  return {
    id: historyId,
    card: { id: card.id, name: card.name, nameEn: card.nameEn, isReversed },
    result,
  };
}

export async function threeCardReading(userId: number, question: string, clientCardIds?: number[], clientOrientations?: string[]) {
  let cards: { card: TarotCard; isReversed: boolean }[];

  if (clientCardIds && clientOrientations && clientCardIds.length === 3 && clientOrientations.length === 3) {
    cards = clientCardIds.map((id, i) => {
      const card = tarotCards.find(c => c.id === id);
      if (!card) throw new Error('无效的卡牌ID');
      return { card, isReversed: clientOrientations[i] === 'reversed' };
    });
  } else {
    cards = randomCards(3);
  }
  const positionNames = ['支持力量', '挑战力量', '最终结果'];

  const cardDescriptions = cards.map((c, i) => {
    const orientation = c.isReversed ? '逆位' : '正位';
    const keywords = c.isReversed ? c.card.reversedKeywords : c.card.uprightKeywords;
    return `第${i + 1}张（${positionNames[i]}）：${c.card.name}（${orientation}）- 关键词：${keywords}`;
  }).join('\n');

  const userPrompt = buildThreeCardPrompt(cardDescriptions, question);
  const responseText = await callDeepSeek([
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userPrompt },
  ]);
  const data = parseJsonResponse(responseText);

  const level = data.level as string;
  const answerColorMap: Record<string, string> = {
    'definite-yes': 'text-green-400',
    'likely-yes': 'text-emerald-400',
    'conditional': 'text-yellow-400',
    'likely-no': 'text-orange-400',
    'definite-no': 'text-red-400',
  };
  const confidenceMap: Record<string, string> = {
    'definite-yes': '非常高',
    'likely-yes': '较高',
    'conditional': '中等',
    'likely-no': '较高',
    'definite-no': '非常高',
  };

  const result = {
    answer: data.answer as string,
    answerColor: answerColorMap[level] || 'text-yellow-400',
    confidence: confidenceMap[level] || '中等',
    level,
    interpretation: data.interpretation as string,
    advice: data.advice as string,
    conclusion: data.conclusion as string,
    cardReadings: data.cardReadings as { summary: string }[],
  };

  await UserModel.decrementQuota(userId);

  const historyId = await ReadingModel.create({
    userId,
    type: 'three-card',
    question,
    cardIds: cards.map(c => c.card.id),
    orientations: cards.map(c => c.isReversed ? 'reversed' : 'upright'),
    answer: result.answer,
    resultData: result,
  });

  return {
    id: historyId,
    cards: cards.map(c => ({
      id: c.card.id, name: c.card.name, nameEn: c.card.nameEn, isReversed: c.isReversed,
    })),
    result,
  };
}

export async function dailyFortune(userId: number, zodiacSign?: string, clientCardId?: number, clientIsReversed?: boolean) {
  const today = new Date().toISOString().slice(0, 10);

  // Check cache
  const cached = await ReadingModel.getDailyFortuneCache(userId, today);
  if (cached) {
    const resultData = typeof cached.result_data === 'string'
      ? JSON.parse(cached.result_data) : cached.result_data;
    const card = tarotCards.find(c => c.id === cached.card_id);
    return {
      cached: true,
      card: card ? { id: card.id, name: card.name, nameEn: card.nameEn, isReversed: cached.orientation === 'reversed' } : null,
      result: resultData,
    };
  }

  // 优先使用前端传来的牌，保证前后端一致
  let card: typeof tarotCards[0];
  let isReversed: boolean;
  if (clientCardId !== undefined && clientIsReversed !== undefined) {
    const found = tarotCards.find(c => c.id === clientCardId);
    if (found) {
      card = found;
      isReversed = clientIsReversed;
    } else {
      ({ card, isReversed } = randomCard());
    }
  } else {
    ({ card, isReversed } = randomCard());
  }
  const orientation = isReversed ? '逆位' : '正位';
  const keywords = isReversed ? card.reversedKeywords : card.uprightKeywords;

  const userPrompt = buildDailyFortunePrompt(card.name, card.nameEn, orientation, keywords, zodiacSign);
  const responseText = await callDeepSeek([
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userPrompt },
  ]);
  const data = parseJsonResponse(responseText);

  const sections = data.sections as any;
  const ratings = data.ratings as any;
  for (const key of Object.keys(ratings)) {
    ratings[key] = Math.max(1, Math.min(5, Math.round(ratings[key])));
  }

  const result = { cardName: card.name, cardNameEn: card.nameEn, isReversed, sections, ratings };

  // Save cache
  await ReadingModel.saveDailyFortuneCache({
    userId,
    fortuneDate: today,
    cardId: card.id,
    orientation: isReversed ? 'reversed' : 'upright',
    resultData: result,
  });

  // Save history
  await ReadingModel.create({
    userId,
    type: 'daily-fortune',
    question: null,
    cardIds: [card.id],
    orientations: [isReversed ? 'reversed' : 'upright'],
    answer: null,
    resultData: result,
  });

  return {
    cached: false,
    card: { id: card.id, name: card.name, nameEn: card.nameEn, isReversed },
    result,
  };
}

// Spread definitions for reader-reading
const spreadConfigs: Record<string, { name: string; cardCount: number; positions: string[] }> = {
  // 通用
  'single': { name: '单牌占卜', cardCount: 1, positions: ['当前情况'] },
  'timeline': { name: '时间流牌阵', cardCount: 3, positions: ['过去', '现在', '未来'] },
  'problem': { name: '问题解决牌阵', cardCount: 3, positions: ['问题的起因', '问题的现状', '问题解决方法'] },
  'diamond': { name: '钻石牌阵', cardCount: 4, positions: ['事情的起因', '事情的现况', '事情的局面', '事情的未来'] },
  'core': { name: '直指核心牌阵', cardCount: 4, positions: ['问题的本质', '你的障碍和短处', '解决问题的对策', '你的资源和长处'] },
  'x-chance': { name: 'X字机会牌阵', cardCount: 5, positions: ['自身的心态', '当前的时机', '成功的几率', '影响因素', '最终建议'] },
  'celtic-cross': { name: '凯尔特十字牌阵', cardCount: 10, positions: ['问题的现状', '目前的阻碍', '你预期的发展', '造成现状的原因', '过去的影响', '未来的走向', '你的态度', '外在环境', '希望与恐惧', '最终结果'] },
  'hexagram': { name: '六芒星牌阵', cardCount: 7, positions: ['问题的过去情况', '问题的现状', '问题的未来发展', '应采取的策略', '外在环境的影响', '自身的期望', '最终结果'] },
  // 爱情人际
  'love-cross': { name: '爱情十字牌阵', cardCount: 5, positions: ['你的状态想法', '对方对你的态度', '这段感情的现状', '存在的问题', '发展趋势'] },
  'future-lover': { name: '未来恋人牌阵', cardCount: 7, positions: ['正缘对象ta是怎样的人', 'ta是否已经出现', '遇到ta时会有什么提示', '如何吸引ta向你靠近', '你们的相处模式', '感情发展趋势', '最终结果'] },
  'mirror': { name: '灵感对应牌阵', cardCount: 6, positions: ['你对对方的想法', '你对此关系的看法', '你对未来发展的期待', '对方对你的想法', '对方对此关系的看法', '对方对未来发展的期待'] },
  'venus': { name: '爱神维纳斯牌阵', cardCount: 8, positions: ['你的想法', '对方的想法', '你对对方的影响', '对方对你的影响', '你们的关系现状', '外部环境', '双方的未来', '最终走向'] },
  'love-repair': { name: '情感修复牌阵', cardCount: 4, positions: ['行动建议', '语言沟通的对策', '应该采取的态度', '物质方面的处理方式'] },
  // 运势预测
  'daily': { name: '日运牌阵', cardCount: 4, positions: ['运势主题', '运势情况', '潜在问题', '行动建议'] },
  'monthly': { name: '月运牌阵', cardCount: 5, positions: ['月度第一周', '月度第二周', '月度第三周', '月度第四周', '月度总体建议'] },
  'future-dev': { name: '未来发展牌阵', cardCount: 6, positions: ['你的现状', '爱情的发展', '事业或学业的发展', '财富的发展', '个人成就', '综合建议'] },
  // 自我探索
  'mind-body': { name: '身心灵牌阵', cardCount: 4, positions: ['身体', '心灵', '灵性', '可提升的元素'] },
  'four-elements': { name: '四元素牌阵', cardCount: 4, positions: ['行动与信心方面', '现实与金钱方面', '理性与决策方面', '感情或感性方面'] },
  'self-explore': { name: '自我探索牌阵', cardCount: 4, positions: ['内心深处', '精神生活', '知识领域', '感情生活'] },
  'self-break': { name: '自我突破牌阵', cardCount: 5, positions: ['你的模式', '你的挑战', '你的突破', '你的力量', '行动指引'] },
  // 事业财富
  'career': { name: '事业金字塔牌阵', cardCount: 4, positions: ['自身的核心竞争力', '自身的缺点', '自身的优点', '未来的成就'] },
  'wealth-tree': { name: '财富树牌阵', cardCount: 5, positions: ['财富生长的根基', '财富发展依赖的能量', '财富发展遇到的阻碍', '财富发展的潜在危险', '财富增长的方向'] },
  'interview': { name: '面试求职牌阵', cardCount: 5, positions: ['自身的心态及想法', '面试前需注意的事项', '面试将发生的状况', '对方的要求或问题', '最终结果'] },
  // 选择决策
  'two-choice': { name: '二选一牌阵', cardCount: 5, positions: ['问题的现状', '选择A的短期发展', '选择B的短期发展', '选择A的最终结果', '选择B的最终结果'] },
  'yes-no': { name: '是否牌阵', cardCount: 3, positions: ['卡牌一', '卡牌二', '卡牌三'] },
};

export async function readerReading(
  userId: number,
  readerId: string,
  spreadType: string,
  question: string,
  category: string,
  clientCardIds?: number[],
  clientOrientations?: string[]
) {
  const reader = getReaderById(readerId);
  if (!reader) throw new Error('塔罗师不存在');
  const promptOverride = await AdminService.getReaderPromptOverride(readerId);

  // VIP check for non-free readers
  if (reader.accessLevel === 'vip') {
    const user = await UserModel.findById(userId);
    if (!user || user.membership !== 'vip' || !user.membership_expires_at || new Date(user.membership_expires_at) <= new Date()) {
      throw new Error('该塔罗师仅限VIP会员使用');
    }
  }

  const spread = spreadConfigs[spreadType];
  if (!spread) throw new Error('牌阵类型无效');

  // Use client-provided cards if valid, otherwise draw randomly
  let cards: { card: TarotCard; isReversed: boolean }[];
  if (clientCardIds && clientOrientations && clientCardIds.length === spread.cardCount && clientOrientations.length === spread.cardCount) {
    cards = clientCardIds.map((id, i) => {
      const card = tarotCards.find(c => c.id === id);
      if (!card) throw new Error('无效的卡牌ID');
      return { card, isReversed: clientOrientations[i] === 'reversed' };
    });
  } else {
    cards = randomCards(spread.cardCount);
  }

  // Build card descriptions for prompt
  const cardDescriptions = cards.map((c, i) => {
    const orientation = c.isReversed ? '逆位' : '正位';
    const keywords = c.isReversed ? c.card.reversedKeywords : c.card.uprightKeywords;
    return `牌位${i + 1}（${spread.positions[i]}）：${c.card.name}（${orientation}）- 关键词：${keywords}`;
  }).join('\n');

  const userPrompt = buildReaderReadingPrompt(reader.name, spread.name, cardDescriptions, question, category);
  const responseText = await callDeepSeek(
    [
      { role: 'system', content: promptOverride?.system_prompt || reader.systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    90000,
    4096
  );
  const data = parseJsonResponse(responseText);
  const resultData = normalizeReaderReadingPayload(data);

  // Decrement quota
  await UserModel.decrementQuota(userId);

  // Save to history
  const historyId = await ReadingModel.create({
    userId,
    type: 'reader-reading',
    question,
    cardIds: cards.map(c => c.card.id),
    orientations: cards.map(c => c.isReversed ? 'reversed' : 'upright'),
    answer: null,
    resultData,
    readerId,
    spreadType,
  });

  return {
    id: historyId,
    reader: { id: reader.id, name: reader.name, emoji: reader.emoji },
    spread: { type: spreadType, name: spread.name, positions: spread.positions },
    cards: cards.map((c, i) => ({
      id: c.card.id,
      name: c.card.name,
      nameEn: c.card.nameEn,
      isReversed: c.isReversed,
      position: spread.positions[i],
    })),
    result: resultData,
  };
}

export async function getHistory(userId: number, options: {
  page?: number;
  limit?: number;
  type?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  return ReadingModel.findByUserId(userId, options);
}

export async function deleteHistory(userId: number, id: number) {
  const deleted = await ReadingModel.deleteById(id, userId);
  if (!deleted) throw new Error('记录不存在或无权删除');
}
