/**
 * 64卦完整数据 — 后端版（用于占卜算法）
 *
 * 每卦: id(1-64), name(卦名), symbol(Unicode), lines[6](0阴/1阳, 从初爻到上爻),
 *        meaning(简短含义), gridCol(0-7), gridRow(0-7)
 */

export interface Hexagram {
  id: number;
  name: string;
  symbol: string;
  lines: [number, number, number, number, number, number]; // 0=阴, 1=阳; 初爻→上爻
  meaning: string;
  gridCol: number; // (id-1) % 8
  gridRow: number; // Math.floor((id-1) / 8)
}

export const hexagrams: Hexagram[] = [
  { id: 1,  name: '乾',   symbol: '☰', lines: [1,1,1,1,1,1], meaning: '天行健，自强不息', gridCol: 0, gridRow: 0 },
  { id: 2,  name: '坤',   symbol: '☷', lines: [0,0,0,0,0,0], meaning: '地势坤，厚德载物', gridCol: 1, gridRow: 0 },
  { id: 3,  name: '屯',   symbol: '䷂', lines: [1,0,0,0,1,0], meaning: '万物始生，艰难初创', gridCol: 2, gridRow: 0 },
  { id: 4,  name: '蒙',   symbol: '䷃', lines: [0,1,0,0,0,1], meaning: '启蒙教化，循序渐进', gridCol: 3, gridRow: 0 },
  { id: 5,  name: '需',   symbol: '䷄', lines: [1,1,1,0,1,0], meaning: '守正待时，蓄势待发', gridCol: 4, gridRow: 0 },
  { id: 6,  name: '讼',   symbol: '䷅', lines: [0,1,0,1,1,1], meaning: '慎争明辨，以和为贵', gridCol: 5, gridRow: 0 },
  { id: 7,  name: '师',   symbol: '䷆', lines: [0,1,0,0,0,0], meaning: '统率有方，纪律严明', gridCol: 6, gridRow: 0 },
  { id: 8,  name: '比',   symbol: '䷇', lines: [0,0,0,0,1,0], meaning: '亲近辅佐，团结合作', gridCol: 7, gridRow: 0 },

  { id: 9,  name: '小畜', symbol: '䷈', lines: [1,1,1,0,1,1], meaning: '积小成大，以柔蓄刚', gridCol: 0, gridRow: 1 },
  { id: 10, name: '履',   symbol: '䷉', lines: [1,1,0,1,1,1], meaning: '谨慎行事，如履薄冰', gridCol: 1, gridRow: 1 },
  { id: 11, name: '泰',   symbol: '䷊', lines: [1,1,1,0,0,0], meaning: '天地交泰，万物通达', gridCol: 2, gridRow: 1 },
  { id: 12, name: '否',   symbol: '䷋', lines: [0,0,0,1,1,1], meaning: '闭塞不通，韬光养晦', gridCol: 3, gridRow: 1 },
  { id: 13, name: '同人', symbol: '䷌', lines: [1,0,1,1,1,1], meaning: '志同道合，和谐共处', gridCol: 4, gridRow: 1 },
  { id: 14, name: '大有', symbol: '䷍', lines: [1,1,1,1,0,1], meaning: '丰盛富有，大吉大利', gridCol: 5, gridRow: 1 },
  { id: 15, name: '谦',   symbol: '䷎', lines: [0,0,1,0,0,0], meaning: '谦虚卑退，吉无不利', gridCol: 6, gridRow: 1 },
  { id: 16, name: '豫',   symbol: '䷏', lines: [0,0,0,1,0,0], meaning: '欢乐豫悦，顺势而为', gridCol: 7, gridRow: 1 },

  { id: 17, name: '随',   symbol: '䷐', lines: [1,0,0,1,1,0], meaning: '随时变通，择善而从', gridCol: 0, gridRow: 2 },
  { id: 18, name: '蛊',   symbol: '䷑', lines: [0,1,1,0,0,1], meaning: '整治积弊，革故鼎新', gridCol: 1, gridRow: 2 },
  { id: 19, name: '临',   symbol: '䷒', lines: [1,1,0,0,0,0], meaning: '居高临下，教民化育', gridCol: 2, gridRow: 2 },
  { id: 20, name: '观',   symbol: '䷓', lines: [0,0,0,0,1,1], meaning: '观察感化，以德服人', gridCol: 3, gridRow: 2 },
  { id: 21, name: '噬嗑', symbol: '䷔', lines: [1,0,0,1,0,1], meaning: '明罚敕法，刚柔相济', gridCol: 4, gridRow: 2 },
  { id: 22, name: '贲',   symbol: '䷕', lines: [1,0,1,0,0,1], meaning: '文饰光彩，适度修饰', gridCol: 5, gridRow: 2 },
  { id: 23, name: '剥',   symbol: '䷖', lines: [0,0,0,0,0,1], meaning: '阴盛阳衰，顺势而止', gridCol: 6, gridRow: 2 },
  { id: 24, name: '复',   symbol: '䷗', lines: [1,0,0,0,0,0], meaning: '一阳复始，万象更新', gridCol: 7, gridRow: 2 },

  { id: 25, name: '无妄', symbol: '䷘', lines: [1,0,0,1,1,1], meaning: '纯真自然，勿行妄为', gridCol: 0, gridRow: 3 },
  { id: 26, name: '大畜', symbol: '䷙', lines: [1,1,1,0,0,1], meaning: '积蓄力量，厚积薄发', gridCol: 1, gridRow: 3 },
  { id: 27, name: '颐',   symbol: '䷚', lines: [1,0,0,0,0,1], meaning: '慎言节食，自求口实', gridCol: 2, gridRow: 3 },
  { id: 28, name: '大过', symbol: '䷛', lines: [0,1,1,1,1,0], meaning: '非常之时，大胆行事', gridCol: 3, gridRow: 3 },
  { id: 29, name: '坎',   symbol: '䷜', lines: [0,1,0,0,1,0], meaning: '重重险阻，信心突破', gridCol: 4, gridRow: 3 },
  { id: 30, name: '离',   symbol: '䷝', lines: [1,0,1,1,0,1], meaning: '光明附丽，文明之象', gridCol: 5, gridRow: 3 },
  { id: 31, name: '咸',   symbol: '䷞', lines: [0,0,1,1,1,0], meaning: '感应相通，心心相印', gridCol: 6, gridRow: 3 },
  { id: 32, name: '恒',   symbol: '䷟', lines: [0,1,1,1,0,0], meaning: '恒久不变，持之以恒', gridCol: 7, gridRow: 3 },

  { id: 33, name: '遁',   symbol: '䷠', lines: [0,0,1,1,1,1], meaning: '退隐遁避，明哲保身', gridCol: 0, gridRow: 4 },
  { id: 34, name: '大壮', symbol: '䷡', lines: [1,1,1,1,0,0], meaning: '刚强壮盛，壮不可妄', gridCol: 1, gridRow: 4 },
  { id: 35, name: '晋',   symbol: '䷢', lines: [0,0,0,1,0,1], meaning: '光明上进，日出地上', gridCol: 2, gridRow: 4 },
  { id: 36, name: '明夷', symbol: '䷣', lines: [1,0,1,0,0,0], meaning: '韬光养晦，暗中蓄力', gridCol: 3, gridRow: 4 },
  { id: 37, name: '家人', symbol: '䷤', lines: [1,0,1,0,1,1], meaning: '家道正则天下定', gridCol: 4, gridRow: 4 },
  { id: 38, name: '睽',   symbol: '䷥', lines: [1,1,0,1,0,1], meaning: '乖违背离，求同存异', gridCol: 5, gridRow: 4 },
  { id: 39, name: '蹇',   symbol: '䷦', lines: [0,0,1,0,1,0], meaning: '险阻在前，见险而止', gridCol: 6, gridRow: 4 },
  { id: 40, name: '解',   symbol: '䷧', lines: [0,1,0,1,0,0], meaning: '排难解纷，百事消散', gridCol: 7, gridRow: 4 },

  { id: 41, name: '损',   symbol: '䷨', lines: [1,1,0,0,0,1], meaning: '有舍有得，损己利人', gridCol: 0, gridRow: 5 },
  { id: 42, name: '益',   symbol: '䷩', lines: [1,0,0,0,1,1], meaning: '损上益下，利民兴业', gridCol: 1, gridRow: 5 },
  { id: 43, name: '夬',   symbol: '䷪', lines: [1,1,1,1,1,0], meaning: '决断果敢，扬善除恶', gridCol: 2, gridRow: 5 },
  { id: 44, name: '姤',   symbol: '䷫', lines: [0,1,1,1,1,1], meaning: '不期而遇，刚柔相遇', gridCol: 3, gridRow: 5 },
  { id: 45, name: '萃',   symbol: '䷬', lines: [0,0,0,1,1,0], meaning: '聚集汇合，团结一心', gridCol: 4, gridRow: 5 },
  { id: 46, name: '升',   symbol: '䷭', lines: [0,1,1,0,0,0], meaning: '积小成大，步步高升', gridCol: 5, gridRow: 5 },
  { id: 47, name: '困',   symbol: '䷮', lines: [0,1,0,1,1,0], meaning: '穷困之境，坚守正道', gridCol: 6, gridRow: 5 },
  { id: 48, name: '井',   symbol: '䷯', lines: [0,1,1,0,1,0], meaning: '养民不穷，取之不竭', gridCol: 7, gridRow: 5 },

  { id: 49, name: '革',   symbol: '䷰', lines: [1,0,1,1,1,0], meaning: '革故鼎新，顺天应人', gridCol: 0, gridRow: 6 },
  { id: 50, name: '鼎',   symbol: '䷱', lines: [0,1,1,1,0,1], meaning: '鼎新革故，文明烹饪', gridCol: 1, gridRow: 6 },
  { id: 51, name: '震',   symbol: '䷲', lines: [1,0,0,1,0,0], meaning: '震惊百里，临危不乱', gridCol: 2, gridRow: 6 },
  { id: 52, name: '艮',   symbol: '䷳', lines: [0,0,1,0,0,1], meaning: '知止则止，适可而止', gridCol: 3, gridRow: 6 },
  { id: 53, name: '渐',   symbol: '䷴', lines: [0,0,1,0,1,1], meaning: '循序渐进，水滴石穿', gridCol: 4, gridRow: 6 },
  { id: 54, name: '归妹', symbol: '䷵', lines: [1,1,0,1,0,0], meaning: '情投意合，归宿安定', gridCol: 5, gridRow: 6 },
  { id: 55, name: '丰',   symbol: '䷶', lines: [1,0,1,1,0,0], meaning: '丰盛盈满，日中则昃', gridCol: 6, gridRow: 6 },
  { id: 56, name: '旅',   symbol: '䷷', lines: [0,0,1,1,0,1], meaning: '旅途在外，柔顺小心', gridCol: 7, gridRow: 6 },

  { id: 57, name: '巽',   symbol: '䷸', lines: [0,1,1,0,1,1], meaning: '柔顺谦逊，风行草偃', gridCol: 0, gridRow: 7 },
  { id: 58, name: '兑',   symbol: '䷹', lines: [1,1,0,1,1,0], meaning: '喜悦和泽，以诚待人', gridCol: 1, gridRow: 7 },
  { id: 59, name: '涣',   symbol: '䷺', lines: [0,1,0,0,1,1], meaning: '涣散流通，化解隔阂', gridCol: 2, gridRow: 7 },
  { id: 60, name: '节',   symbol: '䷻', lines: [1,1,0,0,1,0], meaning: '适度节制，过则反害', gridCol: 3, gridRow: 7 },
  { id: 61, name: '中孚', symbol: '䷼', lines: [1,1,0,0,1,1], meaning: '诚信为本，至诚感化', gridCol: 4, gridRow: 7 },
  { id: 62, name: '小过', symbol: '䷽', lines: [0,0,1,1,0,0], meaning: '小事可过，大事勿为', gridCol: 5, gridRow: 7 },
  { id: 63, name: '既济', symbol: '䷾', lines: [1,0,1,0,1,0], meaning: '万事已成，守成持盈', gridCol: 6, gridRow: 7 },
  { id: 64, name: '未济', symbol: '䷿', lines: [0,1,0,1,0,1], meaning: '事未完成，慎终如始', gridCol: 7, gridRow: 7 },
];

export function getHexagramById(id: number): Hexagram | undefined {
  return hexagrams.find(h => h.id === id);
}

/**
 * 根据 6 爻（阴阳数组）查找对应卦象
 */
export function findHexagramByLines(lines: number[]): Hexagram | undefined {
  return hexagrams.find(h =>
    h.lines.every((l, i) => l === lines[i])
  );
}
