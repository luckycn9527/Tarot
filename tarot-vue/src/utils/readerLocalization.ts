import type { ReaderInfo } from '../data/readers'
import type { ReaderSpread } from '../data/spreadsData'

export type SupportedLocale = 'zh-CN' | 'en-US'

export function normalizeLocale(locale: string): SupportedLocale {
  return locale.toLowerCase().startsWith('en') ? 'en-US' : 'zh-CN'
}

const readerEnglish: Record<string, Pick<ReaderInfo, 'name' | 'badge' | 'label' | 'desc'>> = {
  qinghe: { name: 'Qinghe', badge: 'I Ching & Five Elements', label: 'Free', desc: 'A Taoist reader who blends Tarot with I Ching and Five Elements theory, offering calm, grounded insight through the lens of balance.' },
  yanxi: { name: 'Yanxi', badge: 'Clear-Eyed Analyst', label: 'Free', desc: 'Concise and direct. Yanxi focuses on the structure of your situation and gives clear next steps instead of empty reassurance.' },
  haruka: { name: 'Haruka', badge: 'Shinto & Nature', label: 'Free', desc: 'A Kyoto shrine maiden who reads through seasonal shifts and natural imagery, revealing how your situation moves with the wider moment.' },
  xuanyin: { name: 'Xuanyin', badge: 'Qimen & Zi Wei', label: 'VIP', desc: 'A specialist in Qimen Dunjia and Zi Wei who cross-references Eastern metaphysics with Tarot to identify major patterns and turning points.' },
  mirelle: { name: 'Mirelle', badge: 'Lunar Divination · France', label: 'VIP', desc: 'A French mystic who blends lunar cycles with Tarot. Her poetic, nuanced readings are especially suited to relationships and inner desires.' },
  lingsha: { name: 'Lingsha', badge: 'Talismans & Intuition', label: 'VIP', desc: 'Blunt, fiery, and highly intuitive. Lingsha cuts through self-deception, then follows the truth with practical advice you can use.' },
  norick: { name: 'Norick', badge: 'Academic Tarot · Germany', label: 'VIP', desc: 'A Marseille Tarot scholar who combines symbolism with decision analysis. Rigorous and logical, he helps you understand choices rather than predict fate.' },
  amara: { name: 'Amara', badge: 'Ifa Divination · West Africa', label: 'VIP', desc: 'A Yoruba spiritual guide who reads through images of rivers, seeds, and storms, drawing on ancestral wisdom in every card.' },
  vikram: { name: 'Vikram', badge: 'Vedic & Chakras · India', label: 'VIP', desc: 'A Varanasi meditation teacher who combines chakra work with Tarot, tracing where energy flows or stalls and suggesting breathwork to support the reading.' },
  catalina: { name: 'Catalina', badge: 'Romani Tradition · Spain', label: 'VIP', desc: 'A passionate Andalusian reader with a gift for love and relationship questions. She will tell you plainly whether a connection deserves your energy.' },
  kazuki: { name: 'Kazuki', badge: 'Analytical · Japan', label: 'VIP', desc: 'A Tokyo programmer who maps Tarot through decision-tree logic. His readings are practical, structured, and end with a clear action plan.' },
  solveig: { name: 'Solveig', badge: 'Runes · Norway', label: 'VIP', desc: 'A Nordic mythology scholar who blends runic tradition with Tarot, using frank language and vivid northern imagery to illuminate the path ahead.' },
}

interface SpreadEnglish {
  name: string
  description: string
  positions: string[]
}

const spreadEnglish: Record<string, SpreadEnglish> = {
  single: { name: 'Single Card', description: 'A focused one-card reading for a direct answer or a quick look at the energy around your question.', positions: ['Current situation'] },
  timeline: { name: 'Past, Present & Future', description: 'Trace how the situation developed and where its current momentum may lead.', positions: ['Past', 'Present', 'Future'] },
  problem: { name: 'Problem Solving', description: 'Clarify what created the issue, where it stands, and how you can move forward.', positions: ['Root cause', 'Current situation', 'Way forward'] },
  diamond: { name: 'Diamond Spread', description: 'Explore the origin and current shape of a situation, then follow its likely development.', positions: ['Origin', 'Current state', 'Emerging pattern', 'Future direction'] },
  core: { name: 'Core Insight', description: 'Move past the surface to identify the central issue, the obstacle, and the resources available to you.', positions: ['Core issue', 'Obstacle', 'Response', 'Your strength'] },
  'x-chance': { name: 'Crossroads Opportunity', description: 'Assess your mindset, timing, odds, and outside influences before making a decision.', positions: ['Your mindset', 'Timing', 'Chance of success', 'Influences', 'Final guidance'] },
  'celtic-cross': { name: 'Celtic Cross', description: 'A classic ten-card spread for a deep, multidimensional view of a complex question.', positions: ['Present', 'Challenge', 'Conscious aim', 'Root cause', 'Past influence', 'Near future', 'Your approach', 'External influences', 'Hopes and fears', 'Outcome'] },
  hexagram: { name: 'Hexagram Spread', description: 'Review the full arc of a situation and identify the most constructive strategy.', positions: ['Past', 'Present', 'Future', 'Strategy', 'External influences', 'Your expectations', 'Outcome'] },
  'love-cross': { name: 'Love Cross', description: 'Understand both people, the present relationship dynamic, its challenge, and its direction.', positions: ['Your feelings', 'Their attitude', 'Relationship now', 'Challenge', 'Direction'] },
  'future-lover': { name: 'Future Partner', description: 'Explore the energy of a potential partner and how a meaningful connection may take shape.', positions: ['Who they are', 'Have you met?', 'How you will recognize them', 'How to draw closer', 'Relationship dynamic', 'Development', 'Outcome'] },
  mirror: { name: 'Relationship Mirror', description: 'Compare how both people see each other, the relationship, and its possible future.', positions: ['Your view of them', 'Your view of the relationship', 'Your hopes', 'Their view of you', 'Their view of the relationship', 'Their hopes'] },
  venus: { name: 'Venus Love Spread', description: 'A detailed relationship spread covering thoughts, influence, current dynamics, and what comes next.', positions: ['Your thoughts', 'Their thoughts', 'Your influence', 'Their influence', 'Current relationship', 'External environment', 'Shared future', 'Final direction'] },
  'love-repair': { name: 'Relationship Repair', description: 'Find practical ways to rebuild trust, communicate clearly, and shift the relationship forward.', positions: ['Action', 'Communication', 'Attitude', 'Practical matters'] },
  daily: { name: 'Daily Outlook', description: 'Read the theme of the day, its opportunities, potential friction, and your best response.', positions: ['Theme', 'Energy', 'Potential issue', 'Action'] },
  monthly: { name: 'Monthly Outlook', description: 'Follow the rhythm of the coming month week by week and identify its overall lesson.', positions: ['Week one', 'Week two', 'Week three', 'Week four', 'Monthly guidance'] },
  'future-dev': { name: 'Future Development', description: 'Explore likely developments across love, work or study, money, and personal achievement.', positions: ['Where you are now', 'Love', 'Work or study', 'Money', 'Personal achievement', 'Overall guidance'] },
  'mind-body': { name: 'Mind, Body & Spirit', description: 'Turn inward to understand your physical, emotional, and spiritual balance.', positions: ['Body', 'Mind', 'Spirit', 'Area to strengthen'] },
  'four-elements': { name: 'Four Elements', description: 'Review your actions, material life, reasoning, and emotions as one connected system.', positions: ['Action and confidence', 'Practical life and money', 'Reason and decisions', 'Feelings and intuition'] },
  'self-explore': { name: 'Self-Discovery', description: 'Understand your inner life, growth edges, and unrealized potential.', positions: ['Inner self', 'Spiritual life', 'Knowledge', 'Emotional life'] },
  'self-break': { name: 'Breaking the Pattern', description: 'Identify a repeating pattern and find the leverage needed to move beyond it.', positions: ['The pattern', 'The challenge', 'The breakthrough', 'Your power', 'Action'] },
  career: { name: 'Career Pyramid', description: 'Assess your professional strengths, weaknesses, and likely path of development.', positions: ['Core advantage', 'Weakness', 'Strength', 'Future achievement'] },
  'wealth-tree': { name: 'Wealth Tree', description: 'Examine the roots, fuel, obstacles, risks, and direction of your financial growth.', positions: ['Foundation', 'Growth energy', 'Obstacle', 'Potential risk', 'Direction'] },
  interview: { name: 'Interview & Job Search', description: 'Understand the employer, prepare for likely challenges, and assess the outcome.', positions: ['Your mindset', 'What to prepare', 'What may happen', 'Their expectations', 'Outcome'] },
  'two-choice': { name: 'Two Choices', description: 'Compare the short- and long-term implications of two possible paths.', positions: ['Current situation', 'Choice A: near term', 'Choice B: near term', 'Choice A: outcome', 'Choice B: outcome'] },
  'yes-no': { name: 'Yes or No', description: 'A clear three-card reading for questions that need a direct directional answer.', positions: ['Card one', 'Card two', 'Card three'] },
}

export function localizedReader(reader: ReaderInfo, locale: string): ReaderInfo {
  if (normalizeLocale(locale) !== 'en-US') return reader
  const translation = readerEnglish[reader.id]
  return translation ? { ...reader, ...translation } : reader
}

export function localizedSpread(spread: ReaderSpread, locale: string): ReaderSpread {
  if (normalizeLocale(locale) !== 'en-US') return spread
  const translation = spreadEnglish[spread.id]
  return translation ? { ...spread, ...translation } : spread
}

export function localizedSpreadPositions(spread: Pick<ReaderSpread, 'id' | 'positions'>, locale: string): string[] {
  if (normalizeLocale(locale) !== 'en-US') return spread.positions
  return spreadEnglish[spread.id]?.positions ?? spread.positions
}
