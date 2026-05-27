import { callDeepSeek } from './deepseek.service.js';
import { tarotCards, type TarotCard } from '../data/tarotCards.js';
import * as FateModel from '../models/fate.model.js';

const CATEGORY_LABEL: Record<string, string> = {
  love: '感情',
  career: '事业',
  wealth: '财运',
};

function categoryLabel(cat: string): string {
  return CATEGORY_LABEL[cat] ?? cat;
}

/** 用户选定的 3 张牌（按 过去/现在/未来 顺序），id 为塔罗牌数字 id，须互不相同且在库内 */
function resolvePickedTarot(
  cardIds: number[],
  orientations: ('upright' | 'reversed')[],
): { cards: TarotCard[]; reversed: boolean[] } {
  if (cardIds.length !== 3 || orientations.length !== 3) {
    throw new Error('须提交恰好 3 张牌及 3 个正逆位');
  }
  const uniq = new Set(cardIds);
  if (uniq.size !== 3) {
    throw new Error('三张牌须各不相同');
  }
  const cards: TarotCard[] = [];
  const reversed: boolean[] = [];
  for (let i = 0; i < 3; i++) {
    const id = cardIds[i];
    if (!Number.isInteger(id) || id < 0) {
      throw new Error('无效的牌 id');
    }
    const c = tarotCards.find((t) => t.id === id);
    if (!c) {
      throw new Error(`无效的牌 id: ${id}`);
    }
    cards.push(c);
    reversed.push(orientations[i] === 'reversed');
  }
  return { cards, reversed };
}

async function deepSeekOr(
  fn: () => Promise<string>,
  fallback: string,
  label: string,
): Promise<string> {
  try {
    const t = (await fn()).trim();
    if (t) return t;
  } catch (e) {
    console.warn(`[fate-dual] DeepSeek ${label} 失败，已降级:`, e);
  }
  return fallback;
}

function extractJsonBlock<T extends object>(raw: string): T | null {
  const t = raw.trim();
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(t.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

interface BaziAiJson {
  fiveElements?: Record<string, string>;
  keywords?: string[];
  luckTrend?: string;
  analysis?: string;
}

interface ConflictBranchesJson {
  conflictType?: string;
  conflictLevel?: string;
  summary?: string;
  pathStable?: string;
  pathAdventure?: string;
}

export async function analyzeFateDual(
  userId: number,
  input: {
    birthDate: string;
    birthTime: string | null;
    question: string;
    category: string;
    cardIds: number[];
    orientations: ('upright' | 'reversed')[];
  },
) {
  const cat = input.category;
  const catZh = categoryLabel(cat);
  const timeStr = input.birthTime ?? '未知（可按日柱推演）';

  const baziSystem = `你是一位精通八字命理的分析师。请根据用户出生日期与时间，结合其问题领域（${catZh}），给出**意象化**的运势侧写（非严谨排盘软件，侧重心理与象征，避免恐吓性断言）。
严格只输出一个 JSON 对象，不要 markdown 代码块，不要其它文字。格式：
{"fiveElements":{"木":"…","火":"…","土":"…","金":"…","水":"…"},"keywords":["词1","词2","词3"],"luckTrend":"四字以内趋势","analysis":"断语风格，简洁有力，不超过150字"}`;

  const baziUser = `出生日期：${input.birthDate}
出生时间：${timeStr}
问题：${input.question}
场景：${catZh}`;

  const baziFallbackJson = JSON.stringify({
    fiveElements: { 木: '萌动', 火: '未炎', 土: '守中', 金: '待砺', 水: '细流' },
    keywords: ['蓄势', '观望', '转机'],
    luckTrend: '变动序章',
    analysis: '天地气机未明，宜向内观照、待机而动；心念所向，即为舵向。',
  });

  const baziRaw = await deepSeekOr(
    () => callDeepSeek(
      [
        { role: 'system', content: baziSystem },
        { role: 'user', content: baziUser },
      ],
      45000,
      800,
    ),
    baziFallbackJson,
    '八字侧写',
  );

  let baziParsed = extractJsonBlock<BaziAiJson>(baziRaw);
  if (!baziParsed?.analysis) {
    baziParsed = {
      keywords: ['蓄势', '观望', '转机'],
      luckTrend: '变动序章',
      analysis: '当下宜静观其变，以问心为先；行动前可先厘清真正所求。',
      fiveElements: { 木: '萌动', 火: '未炎', 土: '守中', 金: '待砺', 水: '细流' },
    };
  }

  const keywordsArr = Array.isArray(baziParsed.keywords) ? baziParsed.keywords : [];
  const keywordsStr = keywordsArr.slice(0, 5).join('、') || '未定';

  const { cards, reversed } = resolvePickedTarot(input.cardIds, input.orientations);
  const posLabels = ['过去', '现在', '未来'];
  const lines = cards.map((c, i) => {
    const o = reversed[i] ? '逆位' : '正位';
    return `${posLabels[i]}：${c.name}（${o}）`;
  });

  const tarotSystem = `你是一位塔罗占卜师。根据三张牌（过去/现在/未来）解读用户问题。
要求：强调情绪与潜意识、有画面感、有引导性结论；中文；300字以内。
只输出解读正文，不要 JSON。`;

  const tarotUser = `牌面：\n${lines.join('\n')}\n问题：${input.question}\n场景：${catZh}`;

  const tarotFallback =
    '三张牌在情绪与潜意识层面交织：过去留有未竟之感，现在正站在抉择边缘，未来则指向「由你书写」。请先诚实面对内心真实渴望，再决定下一步。';

  const tarotAnalysis = await deepSeekOr(
    () => callDeepSeek(
      [
        { role: 'system', content: tarotSystem },
        { role: 'user', content: tarotUser },
      ],
      45000,
      900,
    ),
    tarotFallback,
    '塔罗解读',
  );

  const mergeSystem = `你是命运分析官，融合东方命理侧写与塔罗解读。

任务：
1. 判断两边是「一致」还是「冲突」（若轻微分歧可标「冲突」并 level 为「低」）。
2. 用一句话总结核心张力或共识（要有冲击力，30字以内为佳）。
3. 生成两条未来路径描述（各 80-150 字）：
   - pathStable：顺从命理节奏、求稳的路径（结果与代价都要提到）
   - pathAdventure：顺从内心冲动、冒险的路径（结果与代价都要提到）

只输出一个 JSON 对象，不要 markdown：
{"conflictType":"一致或冲突","conflictLevel":"低或中或高","summary":"一句话","pathStable":"…","pathAdventure":"…"}`;

  const mergeUser = `【东方侧写】
关键词：${keywordsStr}
趋势：${baziParsed.luckTrend ?? ''}
正文：${baziParsed.analysis}

【塔罗解读】
${tarotAnalysis}`;

  const mergeFallbackJson = JSON.stringify({
    conflictType: '冲突',
    conflictLevel: '中',
    summary: '命理求稳，塔罗见心；取舍在你。',
    pathStable: '选择稳妥节奏，短期少波澜，但可能延缓真正想做的事；代价是压抑一部分渴望。',
    pathAdventure: '追随内心冲动，短期震荡加大，但可能打开新局；代价是要承担不确定与试错成本。',
  });

  const mergeRaw = await deepSeekOr(
    () => callDeepSeek(
      [
        { role: 'system', content: mergeSystem },
        { role: 'user', content: mergeUser },
      ],
      45000,
      1000,
    ),
    mergeFallbackJson,
    '冲突与分支',
  );

  let merge = extractJsonBlock<ConflictBranchesJson>(mergeRaw);
  if (!merge?.summary || !merge.pathStable || !merge.pathAdventure) {
    merge = {
      conflictType: '冲突',
      conflictLevel: '中',
      summary: '命理求稳，塔罗见心；取舍在你。',
      pathStable: merge?.pathStable ?? '选择稳妥节奏，短期少波澜，但可能延缓真正想做的事；代价是压抑一部分渴望。',
      pathAdventure: merge?.pathAdventure ?? '追随内心冲动，短期震荡加大，但可能打开新局；代价是要承担不确定与试错成本。',
    };
  }

  const baziId = await FateModel.insertBaziResult({
    userId,
    birthDate: input.birthDate,
    birthTime: input.birthTime,
    fiveElementsJson: baziParsed.fiveElements ?? null,
    luckTrend: baziParsed.luckTrend ?? null,
    keywords: keywordsStr,
    analysisText: baziParsed.analysis ?? '',
    question: input.question,
    category: cat,
  });

  const tarotId = await FateModel.insertTarotResult({
    userId,
    card1: cards[0]!.name,
    card2: cards[1]!.name,
    card3: cards[2]!.name,
    card1En: cards[0]!.nameEn,
    card2En: cards[1]!.nameEn,
    card3En: cards[2]!.nameEn,
    orient1: reversed[0] ? 'reversed' : 'upright',
    orient2: reversed[1] ? 'reversed' : 'upright',
    orient3: reversed[2] ? 'reversed' : 'upright',
    positions: posLabels.join(','),
    meaningText: tarotAnalysis,
    question: input.question,
    category: cat,
  });

  const conflictId = await FateModel.insertFateConflict({
    userId,
    baziId,
    tarotId,
    conflictType: merge.conflictType ?? '冲突',
    conflictLevel: merge.conflictLevel ?? null,
    summaryText: merge.summary ?? '',
    pathStableText: merge.pathStable ?? '',
    pathAdventureText: merge.pathAdventure ?? '',
  });

  return {
    conflictId,
    bazi: {
      keywords: keywordsArr.length ? keywordsArr : keywordsStr.split(/[、,，]/).map((s) => s.trim()).filter(Boolean),
      luckTrend: baziParsed.luckTrend ?? null,
      fiveElements: baziParsed.fiveElements ?? null,
      analysis: baziParsed.analysis ?? '',
    },
    tarot: {
      cards: cards.map((c, i) => ({
        name: c.name,
        nameEn: c.nameEn,
        position: posLabels[i],
        reversed: reversed[i]!,
      })),
      analysis: tarotAnalysis,
    },
    conflict: {
      type: merge.conflictType ?? '冲突',
      level: merge.conflictLevel ?? null,
      summary: merge.summary ?? '',
    },
    branches: {
      stable: merge.pathStable ?? '',
      adventure: merge.pathAdventure ?? '',
    },
  };
}

export async function chooseFatePath(
  userId: number,
  conflictId: number,
  choice: 'stable' | 'adventure',
) {
  const row = await FateModel.findConflictForUser(conflictId, userId);
  if (!row) {
    throw new Error('记录不存在或无权访问');
  }

  const existing = await FateModel.getChoiceByConflictId(conflictId);
  if (existing) {
    return {
      result: String(existing.result_path_text),
      alreadyChosen: true as const,
      choiceType: String(existing.choice_type),
    };
  }

  const baseText =
    choice === 'stable'
      ? String(row.path_stable_text)
      : String(row.path_adventure_text);

  const polishSystem =
    '你是命运解说者。用户已做出路径选择。请基于给定「路径正文」写一段收束语：肯定其选择、点出接下来 30 天内可执行的一小步；语气克制、不恐吓；中文 120 字以内。只输出正文。';

  const polishUser = `选择：${choice === 'stable' ? '相信命（顺稳）' : '相信心（冒险）'}\n路径正文：\n${baseText}`;

  let resultText = baseText;
  try {
    resultText = (
      await callDeepSeek(
        [
          { role: 'system', content: polishSystem },
          { role: 'user', content: polishUser },
        ],
        30000,
        400,
      )
    ).trim();
    if (!resultText) resultText = baseText;
  } catch {
    resultText = baseText;
  }

  await FateModel.insertFateChoice({
    userId,
    conflictId,
    choiceType: choice,
    resultPathText: resultText,
  });

  return { result: resultText, alreadyChosen: false as const, choiceType: choice };
}

function sqlDateToIso(v: unknown): string {
  if (v == null) return '';
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

export async function getFateHistory(userId: number, limit: number) {
  const rows = await FateModel.listFateHistory(userId, limit);
  return rows.map((r) => ({
    conflictId: Number(r.conflict_id),
    summary: String(r.summary_text ?? ''),
    conflictType: String(r.conflict_type ?? ''),
    analyzedAt: sqlDateToIso(r.analyzed_at),
    baziKeywords: String(r.bazi_keywords ?? ''),
    cards: [String(r.card_1 ?? ''), String(r.card_2 ?? ''), String(r.card_3 ?? '')],
    choiceType: r.choice_type != null ? String(r.choice_type) : null,
    resultPreview:
      r.result_path_text != null && r.result_path_text !== ''
        ? String(r.result_path_text).slice(0, 160)
        : null,
    chosenAt: r.chosen_at != null ? sqlDateToIso(r.chosen_at) : null,
  }));
}
