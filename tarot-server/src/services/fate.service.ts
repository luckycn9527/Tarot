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

type ZiweiInput = {
  fiveElementsClass?: string;
  soul?: string;
  body?: string;
  soulBranch?: string;
  bodyBranch?: string;
  zodiac?: string;
  sign?: string;
  lunarDate?: string;
  palaces?: string[];
};

/** 紫微斗数版本的东方命理 system 提示词（输出结构与八字版保持一致，便于前端复用） */
function buildZiweiSystemPrompt(catZh: string): string {
  return `你是一位精通紫微斗数的命理分析师。用户已提供由排盘程序精确计算出的紫微命盘（命宫、身宫、五行局、命主身主与十二宫主辅星），请基于这份**真实命盘数据**，结合其问题领域（${catZh}），给出有紫微质感的运势侧写（侧重心理与象征，避免恐吓性断言）。

请重点参考命宫主星及其三方四正、身宫、以及与问题领域相关的宫位（如事业看官禄宫、财运看财帛宫、感情看夫妻宫），并留意四化（化禄/权/科/忌）的影响。

请尽量充实内容、用词专业而温暖。严格只输出一个 JSON 对象，不要 markdown 代码块，不要其它文字。格式：
{
  "dayMaster": "命宫主星概括（如：紫微天府、武曲贪狼），若命宫无主星则写借对宫主星",
  "dayMasterStrength": "命格强弱，从下列里选一个：身强 / 身弱 / 中和 / 偏强 / 偏弱",
  "fiveElements": {"木":"对应五行在命盘中的意象8-16字","火":"…","土":"…","金":"…","水":"…"},
  "fiveElementScores": {"木":0-100整数,"火":0-100整数,"土":0-100整数,"金":0-100整数,"水":0-100整数},
  "favorable": ["对命主有利的1-2个五行或星曜"],
  "unfavorable": ["需留意的1-2个五行或星曜"],
  "pattern": "命格格局四到八字概括（如：紫府朝垣、机月同梁、杀破狼）",
  "keywords": ["关键词1","关键词2","关键词3","关键词4"],
  "luckTrend": "四到六字的当下趋势",
  "analysis": "命盘断语正文，结合命宫主星、相关宫位与四化，分2-3段，180-260字，有画面感和指导性",
  "advice": "一句话行动建议，30-50字"
}
注意：fiveElementScores 五项要有明显高低差异，参考五行局与星曜分布，体现命局实际强弱。`;
}

/** 将紫微命盘摘要格式化为提示词文本 */
function formatZiweiForPrompt(z: ZiweiInput): string {
  const lines: string[] = ['【紫微命盘（程序精算）】'];
  if (z.lunarDate) lines.push(`农历：${z.lunarDate}`);
  if (z.fiveElementsClass) lines.push(`五行局：${z.fiveElementsClass}`);
  if (z.soul) lines.push(`命主：${z.soul}`);
  if (z.body) lines.push(`身主：${z.body}`);
  if (z.soulBranch) lines.push(`命宫地支：${z.soulBranch}`);
  if (z.bodyBranch) lines.push(`身宫地支：${z.bodyBranch}`);
  if (z.zodiac) lines.push(`生肖：${z.zodiac}`);
  if (Array.isArray(z.palaces) && z.palaces.length) {
    lines.push('十二宫：');
    lines.push(...z.palaces.map((p) => `· ${p}`));
  }
  return lines.join('\n');
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
  dayMaster?: string;
  dayMasterStrength?: string;
  fiveElements?: Record<string, string>;
  fiveElementScores?: Record<string, number>;
  favorable?: string[];
  unfavorable?: string[];
  keywords?: string[];
  luckTrend?: string;
  pattern?: string;
  analysis?: string;
  advice?: string;
}

interface PathScores {
  稳健?: number;
  成长?: number;
  风险?: number;
  回报?: number;
  心力?: number;
}
interface ConflictBranchesJson {
  conflictType?: string;
  conflictLevel?: string;
  summary?: string;
  pathStable?: string;
  pathAdventure?: string;
  stableTag?: string;
  adventureTag?: string;
  stableHorizon?: string;
  adventureHorizon?: string;
  stableScores?: PathScores;
  adventureScores?: PathScores;
}

export async function analyzeFateDual(
  userId: number,  input: {
    birthDate: string;
    birthTime: string | null;
    question: string;
    category: string;
    cardIds: number[];
    orientations: ('upright' | 'reversed')[];
    chartType?: 'bazi' | 'ziwei';
    ziwei?: {
      fiveElementsClass?: string;
      soul?: string;
      body?: string;
      soulBranch?: string;
      bodyBranch?: string;
      zodiac?: string;
      sign?: string;
      lunarDate?: string;
      palaces?: string[];
    } | null;
  },
) {
  const cat = input.category;
  const catZh = categoryLabel(cat);
  const timeStr = input.birthTime ?? '未知（可按日柱推演）';
  const useZiwei = input.chartType === 'ziwei' && input.ziwei != null;

  const baziSystem = useZiwei
    ? buildZiweiSystemPrompt(catZh)
    : `你是一位精通八字命理（子平术）的分析师。请根据用户出生日期与时间，结合其问题领域（${catZh}），给出**意象化但有命理质感**的运势侧写（非严谨排盘软件，侧重心理与象征，避免恐吓性断言）。

请尽量充实内容、用词专业而温暖。严格只输出一个 JSON 对象，不要 markdown 代码块，不要其它文字。格式：
{
  "dayMaster": "日主天干（如：甲木、庚金），结合出生日期意象推断",
  "dayMasterStrength": "日主旺衰，从下列里选一个：身强 / 身弱 / 中和 / 偏强 / 偏弱",
  "fiveElements": {"木":"该五行在命局中的意象描述8-16字","火":"…","土":"…","金":"…","水":"…"},
  "fiveElementScores": {"木":0-100整数,"火":0-100整数,"土":0-100整数,"金":0-100整数,"水":0-100整数},
  "favorable": ["喜用神，1-2个五行字，如 水、木"],
  "unfavorable": ["忌神，1-2个五行字"],
  "pattern": "格局或气象的四到八字概括（如：伤官配印、食神生财、比劫夺财）",
  "keywords": ["关键词1","关键词2","关键词3","关键词4"],
  "luckTrend": "四到六字的当下趋势",
  "analysis": "命理断语正文，结合日主旺衰、喜忌与问题领域，分2-3段，180-260字，有画面感和指导性",
  "advice": "一句话行动建议，30-50字"
}
注意：fiveElementScores 五项要有明显高低差异、加起来不必为100，体现命局五行的实际强弱分布。`;

  const baziUser = useZiwei
    ? `出生日期：${input.birthDate}
出生时间：${timeStr}
${formatZiweiForPrompt(input.ziwei!)}
问题：${input.question}
场景：${catZh}`
    : `出生日期：${input.birthDate}
出生时间：${timeStr}
问题：${input.question}
场景：${catZh}`;

  const baziFallbackJson = JSON.stringify({
    dayMaster: '癸水',
    dayMasterStrength: '中和',
    fiveElements: { 木: '萌动初生', 火: '未炎待引', 土: '厚载守中', 金: '待砺藏锋', 水: '细流通脉' },
    fiveElementScores: { 木: 58, 火: 42, 土: 70, 金: 48, 水: 62 },
    favorable: ['水', '木'],
    unfavorable: ['土'],
    pattern: '气机未定 · 待时而动',
    keywords: ['蓄势', '观望', '转机', '内省'],
    luckTrend: '变动序章',
    analysis:
      '天地气机未明，命局五行各有进退。日主居中，既不躁进亦不固守，正是观照内心、厘清所求的时节。\n\n当下宜向内沉潜，待机而动；外界看似平静，实则暗流酝酿转机。心念所向，即为舵向。',
    advice: '先厘清真正想要的，再决定下一步的取舍。',
  });

  const baziRaw = await deepSeekOr(
    () => callDeepSeek(
      [
        { role: 'system', content: baziSystem },
        { role: 'user', content: baziUser },
      ],
      45000,
      1400,
    ),
    baziFallbackJson,
    '八字侧写',
  );

  let baziParsed = extractJsonBlock<BaziAiJson>(baziRaw);
  if (!baziParsed?.analysis) {
    baziParsed = {
      dayMaster: '癸水',
      dayMasterStrength: '中和',
      keywords: ['蓄势', '观望', '转机', '内省'],
      luckTrend: '变动序章',
      pattern: '气机未定 · 待时而动',
      favorable: ['水', '木'],
      unfavorable: ['土'],
      analysis: '当下宜静观其变，以问心为先；行动前可先厘清真正所求。',
      advice: '先厘清真正想要的，再决定下一步的取舍。',
      fiveElements: { 木: '萌动初生', 火: '未炎待引', 土: '厚载守中', 金: '待砺藏锋', 水: '细流通脉' },
      fiveElementScores: { 木: 58, 火: 42, 土: 70, 金: 48, 水: 62 },
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
3. 生成两条未来路径描述（各 100-160 字）：
   - pathStable：顺从命理节奏、求稳的路径（结果与代价都要提到）
   - pathAdventure：顺从内心冲动、冒险的路径（结果与代价都要提到）
4. 为两条路径各打一组对比分数（0-100 整数），用于可视化对比。两条路径在各维度上要有**明显差异**，体现真实取舍：
   - 稳健（确定性/安全感）、成长（突破/学习）、风险（波动/不确定）、回报（潜在收益上限）、心力（需要投入的心理能量）
5. 各给路径一个 2-4 字的标签（tag）与一个时间尺度提示（horizon，如「3-6个月见效」「1年以上」）。

只输出一个 JSON 对象，不要 markdown：
{
  "conflictType":"一致或冲突",
  "conflictLevel":"低或中或高",
  "summary":"一句话",
  "pathStable":"…",
  "pathAdventure":"…",
  "stableTag":"如 稳中求进",
  "adventureTag":"如 破局重生",
  "stableHorizon":"如 3-6个月见效",
  "adventureHorizon":"如 半年至一年",
  "stableScores":{"稳健":85,"成长":45,"风险":25,"回报":55,"心力":40},
  "adventureScores":{"稳健":40,"成长":85,"风险":75,"回报":85,"心力":75}
}`;

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
    pathStable: '选择稳妥节奏，短期少波澜，但可能延缓真正想做的事；代价是压抑一部分渴望。守住既有的根基，让时间替你筛选风险，适合在不确定时先求站稳。',
    pathAdventure: '追随内心冲动，短期震荡加大，但可能打开新局；代价是要承担不确定与试错成本。以行动改写剧本，把波动当作养分，适合愿意为可能性付出代价的此刻。',
    stableTag: '稳中求进',
    adventureTag: '破局重生',
    stableHorizon: '3-6 个月见效',
    adventureHorizon: '半年至一年',
    stableScores: { 稳健: 85, 成长: 45, 风险: 25, 回报: 55, 心力: 40 },
    adventureScores: { 稳健: 40, 成长: 85, 风险: 75, 回报: 85, 心力: 75 },
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
      conflictType: merge?.conflictType ?? '冲突',
      conflictLevel: merge?.conflictLevel ?? '中',
      summary: merge?.summary ?? '命理求稳，塔罗见心；取舍在你。',
      pathStable: merge?.pathStable ?? '选择稳妥节奏，短期少波澜，但可能延缓真正想做的事；代价是压抑一部分渴望。',
      pathAdventure: merge?.pathAdventure ?? '追随内心冲动，短期震荡加大，但可能打开新局；代价是要承担不确定与试错成本。',
      stableTag: merge?.stableTag ?? '稳中求进',
      adventureTag: merge?.adventureTag ?? '破局重生',
      stableHorizon: merge?.stableHorizon ?? '3-6 个月见效',
      adventureHorizon: merge?.adventureHorizon ?? '半年至一年',
      stableScores: merge?.stableScores,
      adventureScores: merge?.adventureScores,
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

  const normScores = (s: PathScores | undefined): PathScores | null => {
    if (!s || typeof s !== 'object') return null;
    const clamp = (n: unknown) => {
      const v = Math.round(Number(n));
      if (!Number.isFinite(v)) return null;
      return Math.min(100, Math.max(0, v));
    };
    const out: Record<string, number> = {};
    for (const axis of ['稳健', '成长', '风险', '回报', '心力'] as const) {
      const v = clamp((s as Record<string, unknown>)[axis]);
      if (v != null) out[axis] = v;
    }
    return Object.keys(out).length ? out : null;
  };

  const normElementScores = (s: Record<string, number> | undefined): Record<string, number> | null => {
    if (!s || typeof s !== 'object') return null;
    const out: Record<string, number> = {};
    for (const el of ['木', '火', '土', '金', '水'] as const) {
      const v = Math.round(Number((s as Record<string, unknown>)[el]));
      if (Number.isFinite(v)) out[el] = Math.min(100, Math.max(0, v));
    }
    return Object.keys(out).length ? out : null;
  };

  const cleanList = (arr: string[] | undefined): string[] =>
    Array.isArray(arr) ? arr.map((s) => String(s).trim()).filter(Boolean).slice(0, 3) : [];

  return {
    conflictId,
    bazi: {
      keywords: keywordsArr.length ? keywordsArr : keywordsStr.split(/[、,，]/).map((s) => s.trim()).filter(Boolean),
      luckTrend: baziParsed.luckTrend ?? null,
      fiveElements: baziParsed.fiveElements ?? null,
      fiveElementScores: normElementScores(baziParsed.fiveElementScores),
      dayMaster: baziParsed.dayMaster ?? null,
      dayMasterStrength: baziParsed.dayMasterStrength ?? null,
      favorable: cleanList(baziParsed.favorable),
      unfavorable: cleanList(baziParsed.unfavorable),
      pattern: baziParsed.pattern ?? null,
      advice: baziParsed.advice ?? null,
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
      stableTag: merge.stableTag ?? null,
      adventureTag: merge.adventureTag ?? null,
      stableHorizon: merge.stableHorizon ?? null,
      adventureHorizon: merge.adventureHorizon ?? null,
      stableScores: normScores(merge.stableScores),
      adventureScores: normScores(merge.adventureScores),
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
