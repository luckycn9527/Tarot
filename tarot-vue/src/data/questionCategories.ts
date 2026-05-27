export interface SubCategory {
  name: string
  suggestions: string[]
}

export interface QuestionCategory {
  id: string
  name: string
  emoji: string
  color: string
  subCategories: SubCategory[]
}

export const questionCategories: QuestionCategory[] = [
  {
    id: 'love',
    name: '感情',
    emoji: '❤️',
    color: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
    subCategories: [
      { name: '单身求缘', suggestions: ['我什么时候能遇到对的人？', '我该主动还是等待缘分？', '我和暧昧对象有发展可能吗？'] },
      { name: '恋爱中', suggestions: ['我和TA的感情未来会怎样？', '我们最近的矛盾该怎么化解？', '对方是真心喜欢我吗？'] },
      { name: '复合挽回', suggestions: ['我和前任还有复合的可能吗？', '分手后该怎么面对这段关系？', '对方现在还想着我吗？'] },
    ],
  },
  {
    id: 'career',
    name: '事业',
    emoji: '💼',
    color: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    subCategories: [
      { name: '求职面试', suggestions: ['我这次面试能成功吗？', '我适合什么类型的工作？', '跳槽时机到了吗？'] },
      { name: '职场人际', suggestions: ['领导对我的印象如何？', '同事关系该怎么改善？', '我在团队中的定位是什么？'] },
      { name: '创业发展', suggestions: ['现在适合创业吗？', '我的项目前景如何？', '事业发展的瓶颈在哪里？'] },
    ],
  },
  {
    id: 'wealth',
    name: '财运',
    emoji: '💰',
    color: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    subCategories: [
      { name: '整体财运', suggestions: ['我近期的财运怎么样？', '如何提升我的财运？', '今年适合做投资吗？'] },
      { name: '投资决策', suggestions: ['这笔投资值得做吗？', '理财方向该怎么调整？', '有没有意外收入的机会？'] },
    ],
  },
  {
    id: 'study',
    name: '学业',
    emoji: '📚',
    color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    subCategories: [
      { name: '考试升学', suggestions: ['这次考试能通过吗？', '我该选择哪个方向深造？', '备考状态该怎么调整？'] },
      { name: '学习方法', suggestions: ['我的学习方法需要改变吗？', '哪方面的知识最需要加强？', '学习效率该怎么提高？'] },
    ],
  },
  {
    id: 'health',
    name: '健康',
    emoji: '🌿',
    color: 'bg-green-500/20 text-green-300 border-green-500/30',
    subCategories: [
      { name: '身心状态', suggestions: ['我目前的身心状态如何？', '压力太大该怎么调节？', '如何改善失眠问题？'] },
      { name: '生活习惯', suggestions: ['我需要改变哪些生活习惯？', '如何找到身心平衡？', '最近需要注意什么健康问题？'] },
    ],
  },
  {
    id: 'general',
    name: '综合',
    emoji: '✨',
    color: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    subCategories: [
      { name: '人生方向', suggestions: ['我目前面临的选择该怎么做？', '未来三个月我需要注意什么？', '我内心真正想要的是什么？'] },
      { name: '人际关系', suggestions: ['如何改善与家人的关系？', '我身边的贵人在哪里？', '最近该远离什么样的人？'] },
    ],
  },
]
