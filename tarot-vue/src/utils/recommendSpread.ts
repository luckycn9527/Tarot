import { getReaderSpreadById, type ReaderSpread } from '../data/spreadsData'

/**
 * 根据用户问题文本 + 灵感分类，推荐最契合的牌阵。
 * 规则：先按问题关键词命中（更具体、优先级最高），再按分类默认，最后兜底通用牌阵。
 * 返回的 id 会用 getReaderSpreadById 过滤，确保只返回当前 API 实际存在的牌阵。
 */

interface KeywordRule {
  test: RegExp
  ids: string[]
}

// 关键词规则：越靠前优先级越高
const KEYWORD_RULES: KeywordRule[] = [
  { test: /(二选一|还是|哪一个|哪个好|哪个更|该选|选哪|两个选择|去还是留|a还是b)/i, ids: ['two-choice'] },
  { test: /(是不是|是否|能不能|会不会|要不要|能否|可不可以|可以吗|行不行|该不该|有没有可能)/, ids: ['yes-no'] },
  { test: /(复合|挽回|前任|分手|和好)/, ids: ['love-repair', 'love-cross'] },
  { test: /(正缘|脱单|单身|对的人|姻缘|另一半|何时.*(恋|遇到)|什么时候.*(遇到|脱单|恋爱))/, ids: ['future-lover'] },
  { test: /(暧昧|喜欢我吗|真心|心动|心意|ta对我|对方.*想法)/, ids: ['mirror', 'love-cross'] },
  { test: /(面试|求职|找工作|应聘|跳槽|入职|offer|录用)/i, ids: ['interview'] },
  { test: /(投资|理财|赚钱|收入|财运|财富|破财|偏财|生意)/, ids: ['wealth-tree', 'career'] },
  { test: /(失眠|压力|焦虑|身心|健康|情绪|疲惫|状态调整)/, ids: ['mind-body', 'four-elements'] },
  { test: /(瓶颈|困境|怎么办|如何解决|为什么|原因|症结)/, ids: ['core', 'problem'] },
  { test: /(未来|前景|发展|走向|趋势|以后|将来|接下来)/, ids: ['future-dev', 'timeline'] },
  { test: /(认识自己|自我|内心|迷茫|方向|该往哪)/, ids: ['self-explore', 'mind-body'] },
]

// 分类默认推荐（无强关键词时）
const CATEGORY_DEFAULT: Record<string, string[]> = {
  love: ['love-cross', 'venus', 'mirror'],
  career: ['career', 'interview', 'future-dev'],
  wealth: ['wealth-tree', 'career', 'future-dev'],
  study: ['problem', 'self-explore', 'timeline'],
  health: ['mind-body', 'four-elements', 'self-explore'],
  general: ['future-dev', 'diamond', 'celtic-cross'],
}

// 兜底：通用万能牌阵
const FALLBACK = ['problem', 'diamond', 'timeline']

function rankedIds(question: string, categoryId: string | null): string[] {
  const q = (question || '').trim()
  const ranked: string[] = []
  const add = (ids: string[]) => {
    for (const id of ids) if (!ranked.includes(id)) ranked.push(id)
  }
  for (const rule of KEYWORD_RULES) {
    if (rule.test.test(q)) add(rule.ids)
  }
  if (categoryId && CATEGORY_DEFAULT[categoryId]) add(CATEGORY_DEFAULT[categoryId])
  add(FALLBACK)
  return ranked
}

export function recommendSpreads(
  question: string,
  categoryId: string | null,
  max = 3,
): ReaderSpread[] {
  const result: ReaderSpread[] = []
  for (const id of rankedIds(question, categoryId)) {
    const sp = getReaderSpreadById(id)
    if (sp && !result.some((s) => s.id === sp.id)) result.push(sp)
    if (result.length >= max) break
  }
  return result
}
