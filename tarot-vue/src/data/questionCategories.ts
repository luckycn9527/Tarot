export interface SubCategory {
  name: string
  nameEn: string
  suggestions: string[]
  suggestionsEn: string[]
}

export interface QuestionCategory {
  id: string
  name: string
  nameEn: string
  emoji: string
  color: string
  subCategories: SubCategory[]
}

export const questionCategories: QuestionCategory[] = [
  {
    id: 'love',
    name: '感情',
    nameEn: 'Love',
    emoji: '❤️',
    color: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
    subCategories: [
      { name: '单身求缘', nameEn: 'Finding love', suggestions: ['我什么时候能遇到对的人？', '我该主动还是等待缘分？', '我和暧昧对象有发展可能吗？'], suggestionsEn: ['When might I meet the right person?', 'Should I make the first move or wait for love?', 'Could this connection become a relationship?'] },
      { name: '恋爱中', nameEn: 'In a relationship', suggestions: ['我和TA的感情未来会怎样？', '我们最近的矛盾该怎么化解？', '对方是真心喜欢我吗？'], suggestionsEn: ['Where is our relationship heading?', 'How can we work through our recent conflict?', 'Are their feelings for me genuine?'] },
      { name: '复合挽回', nameEn: 'Reconciliation', suggestions: ['我和前任还有复合的可能吗？', '分手后该怎么面对这段关系？', '对方现在还想着我吗？'], suggestionsEn: ['Is reconciliation with my ex still possible?', 'How should I move forward after this breakup?', 'Does my ex still think about me?'] },
    ],
  },
  {
    id: 'career',
    name: '事业',
    nameEn: 'Career',
    emoji: '💼',
    color: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    subCategories: [
      { name: '求职面试', nameEn: 'Job search', suggestions: ['我这次面试能成功吗？', '我适合什么类型的工作？', '跳槽时机到了吗？'], suggestionsEn: ['What is the outlook for this interview?', 'What kind of work would suit me best?', 'Is this the right time to change jobs?'] },
      { name: '职场人际', nameEn: 'Work relationships', suggestions: ['领导对我的印象如何？', '同事关系该怎么改善？', '我在团队中的定位是什么？'], suggestionsEn: ['How does my manager currently see me?', 'How can I improve my relationships at work?', 'What role do I play in my team?'] },
      { name: '创业发展', nameEn: 'Business growth', suggestions: ['现在适合创业吗？', '我的项目前景如何？', '事业发展的瓶颈在哪里？'], suggestionsEn: ['Is this a good time to start a business?', 'What is the outlook for my project?', 'What is blocking my career growth?'] },
    ],
  },
  {
    id: 'wealth',
    name: '财运',
    nameEn: 'Money',
    emoji: '💰',
    color: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    subCategories: [
      { name: '整体财运', nameEn: 'Financial outlook', suggestions: ['我近期的财运怎么样？', '如何提升我的财运？', '今年适合做投资吗？'], suggestionsEn: ['What is my near-term financial outlook?', 'How can I improve my financial situation?', 'Is this a suitable year for investing?'] },
      { name: '投资决策', nameEn: 'Investment decisions', suggestions: ['这笔投资值得做吗？', '理财方向该怎么调整？', '有没有意外收入的机会？'], suggestionsEn: ['Is this investment worth considering?', 'How should I adjust my financial plan?', 'Is an unexpected income opportunity likely?'] },
    ],
  },
  {
    id: 'study',
    name: '学业',
    nameEn: 'Study',
    emoji: '📚',
    color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    subCategories: [
      { name: '考试升学', nameEn: 'Exams and education', suggestions: ['这次考试能通过吗？', '我该选择哪个方向深造？', '备考状态该怎么调整？'], suggestionsEn: ['What is the outlook for this exam?', 'Which direction should I pursue in my studies?', 'How should I adjust my exam preparation?'] },
      { name: '学习方法', nameEn: 'Learning methods', suggestions: ['我的学习方法需要改变吗？', '哪方面的知识最需要加强？', '学习效率该怎么提高？'], suggestionsEn: ['Should I change the way I study?', 'Which area of knowledge needs the most attention?', 'How can I study more effectively?'] },
    ],
  },
  {
    id: 'health',
    name: '健康',
    nameEn: 'Well-being',
    emoji: '🌿',
    color: 'bg-green-500/20 text-green-300 border-green-500/30',
    subCategories: [
      { name: '身心状态', nameEn: 'Mind and body', suggestions: ['我目前的身心状态如何？', '压力太大该怎么调节？', '如何改善失眠问题？'], suggestionsEn: ['What does my current well-being need from me?', 'How can I manage the pressure I am under?', 'What could help me improve my sleep routine?'] },
      { name: '生活习惯', nameEn: 'Daily habits', suggestions: ['我需要改变哪些生活习惯？', '如何找到身心平衡？', '最近需要注意什么健康问题？'], suggestionsEn: ['Which daily habits should I reconsider?', 'How can I find better mind-body balance?', 'What aspect of my well-being needs attention now?'] },
    ],
  },
  {
    id: 'general',
    name: '综合',
    nameEn: 'General',
    emoji: '✨',
    color: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    subCategories: [
      { name: '人生方向', nameEn: 'Life direction', suggestions: ['我目前面临的选择该怎么做？', '未来三个月我需要注意什么？', '我内心真正想要的是什么？'], suggestionsEn: ['How should I approach the choice in front of me?', 'What should I pay attention to over the next three months?', 'What do I truly want beneath the surface?'] },
      { name: '人际关系', nameEn: 'Relationships', suggestions: ['如何改善与家人的关系？', '我身边的贵人在哪里？', '最近该远离什么样的人？'], suggestionsEn: ['How can I improve my relationship with my family?', 'Who around me could be a helpful ally?', 'What kind of influence should I keep my distance from?'] },
    ],
  },
]
