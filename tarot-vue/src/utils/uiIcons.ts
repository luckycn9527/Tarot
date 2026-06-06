import type { Component } from 'vue'
import HeartIcon from '@icons/heart.vue'
import BriefcaseIcon from '@icons/briefcase.vue'
import CoinsIcon from '@icons/coins.vue'
import BookOpenIcon from '@icons/book-open.vue'
import LeafIcon from '@icons/leaf.vue'
import SparklesIcon from '@icons/sparkles.vue'
import GemIcon from '@icons/gem.vue'
import HourglassIcon from '@icons/hourglass.vue'
import KeyRoundIcon from '@icons/key-round.vue'
import TargetIcon from '@icons/target.vue'
import DicesIcon from '@icons/dices.vue'
import CompassIcon from '@icons/compass.vue'
import HexagonIcon from '@icons/hexagon.vue'
import HeartHandshakeIcon from '@icons/heart-handshake.vue'
import VenetianMaskIcon from '@icons/venetian-mask.vue'
import Flower2Icon from '@icons/flower-2.vue'
import HeartPulseIcon from '@icons/heart-pulse.vue'
import SunIcon from '@icons/sun.vue'
import CalendarDaysIcon from '@icons/calendar-days.vue'
import TrendingUpIcon from '@icons/trending-up.vue'
import BrainIcon from '@icons/brain.vue'
import Grid2x2Icon from '@icons/grid-2x2.vue'
import FootprintsIcon from '@icons/footprints.vue'
import ZapIcon from '@icons/zap.vue'
import TreesIcon from '@icons/trees.vue'
import UserCheckIcon from '@icons/user-check.vue'
import ScaleIcon from '@icons/scale.vue'
import CircleQuestionIcon from '@icons/circle-question-mark.vue'
import SquareIcon from '@icons/square.vue'

/** 灵感分类 id → SVG 图标（取代彩色 emoji，统一线性图标风格） */
const CATEGORY_ICONS: Record<string, Component> = {
  love: HeartIcon,
  career: BriefcaseIcon,
  wealth: CoinsIcon,
  study: BookOpenIcon,
  health: LeafIcon,
  general: SparklesIcon,
}

/** 牌阵 id → SVG 图标 */
const SPREAD_ICONS: Record<string, Component> = {
  single: SquareIcon,
  timeline: HourglassIcon,
  problem: KeyRoundIcon,
  diamond: GemIcon,
  core: TargetIcon,
  'x-chance': DicesIcon,
  'celtic-cross': CompassIcon,
  hexagram: HexagonIcon,
  'love-cross': HeartIcon,
  'future-lover': HeartHandshakeIcon,
  mirror: VenetianMaskIcon,
  venus: Flower2Icon,
  'love-repair': HeartPulseIcon,
  daily: SunIcon,
  monthly: CalendarDaysIcon,
  'future-dev': TrendingUpIcon,
  'mind-body': BrainIcon,
  'four-elements': Grid2x2Icon,
  'self-explore': FootprintsIcon,
  'self-break': ZapIcon,
  career: BriefcaseIcon,
  'wealth-tree': TreesIcon,
  interview: UserCheckIcon,
  'two-choice': ScaleIcon,
  'yes-no': CircleQuestionIcon,
}

export function categoryIcon(id: string): Component {
  return CATEGORY_ICONS[id] ?? SparklesIcon
}

export function spreadIcon(id: string): Component {
  return SPREAD_ICONS[id] ?? SparklesIcon
}
