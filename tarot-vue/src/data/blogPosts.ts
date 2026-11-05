export type BlogCategory = 'learning' | 'discussion' | 'experience'

export interface BlogAuthor {
  slug: string
  readerId: string
  name: string
  nameEn: string
  role: string
  roleEn: string
  bio: string
  bioEn: string
  specialties: string[]
  specialtiesEn: string[]
  fallbackMark: string
}

export type BlogContentBlock =
  | { type: 'heading'; id: string; text: string; textEn: string }
  | { type: 'paragraph'; text: string; textEn: string }
  | { type: 'list'; items: string[]; itemsEn: string[] }
  | { type: 'quote'; text: string; textEn: string }
  | { type: 'callout'; title: string; titleEn: string; text: string; textEn: string }

export interface BlogPost {
  slug: string
  title: string
  titleEn: string
  excerpt: string
  excerptEn: string
  category: BlogCategory
  tags: string[]
  tagsEn: string[]
  authorSlug: string
  publishedAt: string
  updatedAt: string
  readingMinutes: number
  coverCardNameEn: string
  coverAlt: string
  coverAltEn: string
  featured?: boolean
  blocks: BlogContentBlock[]
  relatedRoutes: { to: string; label: string; labelEn: string; description: string; descriptionEn: string }[]
}

export const blogAuthors: BlogAuthor[] = [
  {
    slug: 'qinghe',
    readerId: 'qinghe',
    name: '清和',
    nameEn: 'Qinghe',
    role: '直觉与结构派塔罗师',
    roleEn: 'Intuitive and structured Tarot reader',
    bio: '擅长把复杂牌义整理成可以练习的方法，关注提问方式、图像观察与读牌边界。',
    bioEn: 'Turns complex card meanings into practical exercises, with a focus on questions, imagery, and reading boundaries.',
    specialties: ['塔罗入门', '图像读牌', '提问训练'],
    specialtiesEn: ['Tarot foundations', 'Visual reading', 'Question practice'],
    fallbackMark: '清',
  },
  {
    slug: 'yanxi',
    readerId: 'yanxi',
    name: '岩溪',
    nameEn: 'Yanxi',
    role: '关系议题塔罗师',
    roleEn: 'Relationship-focused Tarot reader',
    bio: '重视语境、沟通和现实选择，喜欢讨论同一张牌在不同关系阶段中的变化。',
    bioEn: 'Focuses on context, communication, and real choices, especially how one card shifts across relationship stages.',
    specialties: ['关系沟通', '案例讨论', '多视角解牌'],
    specialtiesEn: ['Relationships', 'Case discussion', 'Multi-angle reading'],
    fallbackMark: '岩',
  },
  {
    slug: 'xuanyin',
    readerId: 'xuanyin',
    name: '玄引',
    nameEn: 'Xuanyin',
    role: '复盘与成长型塔罗师',
    roleEn: 'Reflective Tarot practitioner',
    bio: '长期记录读牌过程，关注怎样从一次占卜里留下可验证的观察，而不是只记住结论。',
    bioEn: 'Keeps long-term reading journals and focuses on testable observations rather than memorable conclusions.',
    specialties: ['读牌复盘', '学习记录', '自我反思'],
    specialtiesEn: ['Reading review', 'Study journals', 'Self-reflection'],
    fallbackMark: '玄',
  },
]

export const blogPosts: BlogPost[] = [
  {
    slug: 'read-reversed-tarot-cards-without-fear',
    title: '逆位牌不是坏消息：四种更可靠的解读方法',
    titleEn: 'Reversed Tarot cards are not bad news: four reliable ways to read them',
    excerpt: '逆位不等于失败、阻塞或灾难。我会先判断能量方向、表达程度和问题语境，再选择一种解释路径，避免把每张逆位牌都读成负面结果。',
    excerptEn: 'A reversal does not automatically mean failure, blockage, or disaster. Use direction, intensity, and context to choose one clear interpretation instead of defaulting to negativity.',
    category: 'learning',
    tags: ['逆位牌', '牌义学习', '塔罗入门'],
    tagsEn: ['Reversals', 'Card meanings', 'Tarot foundations'],
    authorSlug: 'qinghe',
    publishedAt: '2026-07-24',
    updatedAt: '2026-07-24',
    readingMinutes: 7,
    coverCardNameEn: 'The Hanged Man',
    coverAlt: '倒吊人塔罗牌面，用于说明视角与方向的改变',
    coverAltEn: 'The Hanged Man Tarot card, illustrating a change of direction and perspective',
    blocks: [
      {
        type: 'paragraph',
        text: '初学者看到逆位时，最容易做的事是给正位牌义加一个“不”字。但我在实际读牌中发现，逆位更像一个语法提示：这股能量可能向内、过量、不足，或者正处于调整过程。它提醒我放慢判断，而不是立即宣布坏消息。',
        textEn: 'A common beginner habit is to add “not” to the upright meaning. In practice, I find a reversal works better as a grammar cue: the energy may be internal, excessive, insufficient, or being adjusted. It asks me to slow down, not announce bad news.',
      },
      { type: 'heading', id: 'four-reversal-lenses', text: '先尝试四种镜头', textEn: 'Try four lenses first' },
      {
        type: 'list',
        items: [
          '向内：力量正在心理、私人或未表达的层面发生。',
          '不足：这张牌代表的能力尚未被充分使用。',
          '过量：一种原本有帮助的倾向已经走得太远。',
          '调整：旧模式正在松动，但新的表达还不稳定。',
        ],
        itemsEn: [
          'Internal: the energy is active psychologically, privately, or without expression.',
          'Insufficient: the capacity represented by the card is underused.',
          'Excessive: a useful tendency has gone too far.',
          'Adjusting: an old pattern is loosening before a new expression is stable.',
        ],
      },
      { type: 'heading', id: 'choose-one-path', text: '不要同时套用四种解释', textEn: 'Do not use all four at once' },
      {
        type: 'paragraph',
        text: '选择哪一种，要看问题、牌位和相邻牌。例如力量逆位落在“可用资源”，可能更接近信心不足；落在“需要避免”，则可能提醒不要用意志压过真实感受。先说出你选择的路径和依据，解读会更清楚。',
        textEn: 'Choose through the question, position, and neighboring cards. Strength reversed as an available resource may point to low confidence; in a position called “what to avoid,” it may warn against forcing feelings through willpower. State the lens and evidence you chose.',
      },
      { type: 'heading', id: 'reversal-example', text: '用现实动作检验解释', textEn: 'Test the interpretation with real action' },
      {
        type: 'paragraph',
        text: '假设隐士逆位出现在“本周建议”。与其断言孤独或拒绝社交，我会问：你需要的是结束隔离，还是减少外界噪音？答案可以变成一个小行动，比如联系一位可信的人，或留出不被消息打断的半小时。',
        textEn: 'Suppose The Hermit reversed appears as advice for the week. Instead of predicting loneliness, ask whether you need to end isolation or reduce outside noise. Turn the answer into one small action: contact one trusted person, or protect thirty quiet minutes.',
      },
      {
        type: 'callout',
        title: '一张牌的逆位练习',
        titleEn: 'One-card reversal practice',
        text: '选一张熟悉的牌，分别写出它向内、不足、过量和调整时的现实表现。最后为每种表现配一个可观察的行为，不写抽象的“好”或“坏”。',
        textEn: 'Choose a familiar card and write how it looks when internal, insufficient, excessive, and adjusting. Give each version one observable behavior without labeling it simply good or bad.',
      },
      {
        type: 'quote',
        text: '逆位不是判决，而是让你更精确地描述能量怎样出现。',
        textEn: 'A reversal is not a verdict. It helps describe more precisely how an energy appears.',
      },
    ],
    relatedRoutes: [
      { to: '/gallery', label: '对照完整牌面', labelEn: 'Compare the full deck', description: '从熟悉的牌开始建立逆位词汇。', descriptionEn: 'Build a reversal vocabulary from cards you already know.' },
      { to: '/daily-fortune', label: '练习每日一张', labelEn: 'Practice with a daily card', description: '用一天中的现实观察检验解读。', descriptionEn: 'Test an interpretation against observations from your day.' },
    ],
  },
  {
    slug: 'connect-tarot-elements-and-numbers',
    title: '用元素与数字读小阿尔卡那：从单词变成句子',
    titleEn: 'Read the Minor Arcana through elements and numbers',
    excerpt: '不必为四十张数字牌分别背一套孤立牌义。把权杖、圣杯、宝剑、星币的元素主题与数字阶段组合起来，就能形成可解释的阅读框架。',
    excerptEn: 'You do not need forty isolated definitions for the numbered Minor Arcana. Combine each suit’s element with the developmental stage of its number to build a usable framework.',
    category: 'learning',
    tags: ['小阿尔卡那', '四元素', '数字牌义'],
    tagsEn: ['Minor Arcana', 'Four elements', 'Tarot numerology'],
    authorSlug: 'qinghe',
    publishedAt: '2026-07-24',
    updatedAt: '2026-07-24',
    readingMinutes: 8,
    coverCardNameEn: 'Wheel of Fortune',
    coverAlt: '命运之轮塔罗牌面，用于说明循环与阶段',
    coverAltEn: 'Wheel of Fortune Tarot card, illustrating cycles and stages',
    blocks: [
      {
        type: 'paragraph',
        text: '小阿尔卡那常被认为最难记，因为画面相似、数量又多。我的方法是先读两个骨架：花色说明事情发生在哪种领域，数字说明它走到了哪个阶段。两者组合后，再用具体画面校准。',
        textEn: 'The Minor Arcana can feel difficult because there are many similar cards. I start with two structures: the suit shows the field of experience, and the number shows its stage. I then calibrate that combination with the actual image.',
      },
      { type: 'heading', id: 'four-element-questions', text: '把四种花色变成四个问题', textEn: 'Turn the four suits into four questions' },
      {
        type: 'list',
        items: [
          '权杖与火：动力、创造、冒险和“我想推动什么”。',
          '圣杯与水：感受、关系、想象和“我如何回应情绪”。',
          '宝剑与风：语言、判断、冲突和“我怎样理解这件事”。',
          '星币与土：身体、资源、工作和“什么能在现实中持续”。',
        ],
        itemsEn: [
          'Wands and fire: drive, creation, risk, and “What do I want to move?”',
          'Cups and water: feeling, relationship, imagination, and “How do I respond emotionally?”',
          'Swords and air: language, judgment, conflict, and “How do I understand this?”',
          'Pentacles and earth: body, resources, work, and “What can be sustained in reality?”',
        ],
      },
      { type: 'heading', id: 'number-as-stage', text: '把数字看成发展阶段', textEn: 'Read the number as a stage' },
      {
        type: 'paragraph',
        text: '一是种子，二是两极与选择，三是第一次展开，四是稳定，五是摩擦，六是重新协调，七是检验，八是持续运作，九是接近完成，十是一个周期的饱和与转折。这不是唯一体系，但它足够让初学者开始比较。',
        textEn: 'One is a seed; two introduces polarity and choice; three expands; four stabilizes; five creates friction; six coordinates again; seven tests; eight sustains movement; nine approaches completion; ten saturates and turns a cycle. It is not the only system, but it is a useful comparison tool.',
      },
      { type: 'heading', id: 'combine-example', text: '组合示例：圣杯五与星币五', textEn: 'Combination example: Five of Cups and Five of Pentacles' },
      {
        type: 'paragraph',
        text: '两张五都带着失衡，但圣杯五更容易把注意力放在失落和情绪关系，星币五则更接近资源不足、身体压力或支持系统。共同的“五”帮助我们看到摩擦，不同的元素告诉我们摩擦落在哪里。',
        textEn: 'Both fives carry disruption. Five of Cups emphasizes loss and emotional relationship; Five of Pentacles points more readily to resources, physical strain, or support. The shared five names the friction, while the element locates it.',
      },
      {
        type: 'callout',
        title: '四乘十练习表',
        titleEn: 'A four-by-ten practice grid',
        text: '画一个四行十列的表格，行写花色，列写数字。每天只填一个格子：一句组合含义、一个生活例子、一个你仍不确定的问题。',
        textEn: 'Draw a grid with four suits and ten numbers. Fill one cell per day with a combined meaning, one real-life example, and one question you still have.',
      },
      {
        type: 'quote',
        text: '元素决定句子的主题，数字决定句子正在进行到哪里。',
        textEn: 'The element gives the sentence its subject; the number shows where the sentence is going.',
      },
    ],
    relatedRoutes: [
      { to: '/gallery', label: '按花色浏览塔罗牌', labelEn: 'Browse cards by suit', description: '比较相同数字在不同元素中的变化。', descriptionEn: 'Compare the same number across different elements.' },
      { to: '/spreads', label: '把组合放进牌阵', labelEn: 'Put combinations into a spread', description: '用牌位进一步限定元素与数字。', descriptionEn: 'Use positions to refine element and number meanings.' },
    ],
  },
  {
    slug: 'court-cards-people-roles-inner-drives',
    title: '宫廷牌到底指谁？人物、角色与内在动力的三层读法',
    titleEn: 'Who do Court Cards represent? People, roles, and inner drives',
    excerpt: '宫廷牌不必每次都对应某个具体的人。先检查牌阵是否在描述人物、关系角色或当事人的行为方式，能减少性别和外貌上的刻板判断。',
    excerptEn: 'Court Cards do not always point to a specific person. Check whether the spread describes a person, a relational role, or a way of acting before making assumptions about identity.',
    category: 'learning',
    tags: ['宫廷牌', '人物牌', '解牌框架'],
    tagsEn: ['Court Cards', 'People cards', 'Reading framework'],
    authorSlug: 'qinghe',
    publishedAt: '2026-07-24',
    updatedAt: '2026-07-24',
    readingMinutes: 7,
    coverCardNameEn: 'Queen of Swords',
    coverAlt: '宝剑王后塔罗牌面，用于说明宫廷牌的角色表达',
    coverAltEn: 'Queen of Swords Tarot card, illustrating role and Court Card expression',
    blocks: [
      {
        type: 'paragraph',
        text: '我不再用年龄、性别和发色去机械匹配宫廷牌。这样的速记法方便，却容易把现实中的人压成标签。现在遇到宫廷牌，我会依次检查三个层次：具体人物、关系中的角色，以及当事人需要调用的内在能力。',
        textEn: 'I no longer match Court Cards mechanically by age, gender, or hair color. That shortcut is convenient but reduces people to labels. I now check three levels in order: a specific person, a role in the relationship, and an inner capacity the querent may need.',
      },
      { type: 'heading', id: 'three-court-levels', text: '三个层次分别问什么', textEn: 'Questions for the three levels' },
      {
        type: 'list',
        items: [
          '人物：问题里是否已经出现一位行为特征吻合的人？',
          '角色：谁正在发起、照顾、判断或承担责任？',
          '内在动力：当事人此刻需要学习哪种表达方式？',
          '发展阶段：侍从、骑士、王后、国王分别怎样运用同一元素？',
        ],
        itemsEn: [
          'Person: is someone with matching behavior already present in the question?',
          'Role: who is initiating, caring, judging, or taking responsibility?',
          'Inner drive: what mode of expression does the querent need to develop?',
          'Development: how do Page, Knight, Queen, and King use the same element differently?',
        ],
      },
      { type: 'heading', id: 'rank-as-development', text: '把阶级看成元素的学习阶段', textEn: 'See rank as a stage of elemental learning' },
      {
        type: 'paragraph',
        text: '我常把侍从读成发现与学习，骑士读成投入行动，王后读成内在掌握与维持空间，国王读成对外管理与承担后果。它不是地位高低，而是同一种能量从好奇到负责的不同表达。',
        textEn: 'I often read the Page as discovery, the Knight as committed action, the Queen as inner mastery and holding space, and the King as outward stewardship and responsibility. These are not rankings of worth, but different expressions from curiosity to accountability.',
      },
      { type: 'heading', id: 'court-context-example', text: '同一张宝剑王后，可以有三种身份', textEn: 'One Queen of Swords, three possible identities' },
      {
        type: 'paragraph',
        text: '在团队问题中，她可能是一位要求证据的负责人；在关系牌阵里，她可能描述需要清楚界限的一方；在行动建议位，她可能要求当事人把事实和猜测分开。牌位和现实信息应当先于人物猜测。',
        textEn: 'In a team question she may be a leader who expects evidence. In a relationship spread she may describe the partner who needs clear boundaries. As action advice she may ask the querent to separate fact from assumption. Position and context come before guessing a person.',
      },
      {
        type: 'callout',
        title: '去掉外貌后的宫廷牌练习',
        titleEn: 'Court Card practice without appearance',
        text: '随机选一张宫廷牌，只用动词写下它的五种表现，例如观察、邀请、保护、决定、协调。再分别放进工作、关系和自我成长场景。',
        textEn: 'Choose a Court Card and describe it with five verbs only, such as observe, invite, protect, decide, and coordinate. Place those verbs in work, relationship, and personal-growth contexts.',
      },
      {
        type: 'quote',
        text: '宫廷牌首先描述一种与世界相处的方式，然后才可能指向某个人。',
        textEn: 'A Court Card first describes a way of meeting the world, and only then may point to a person.',
      },
    ],
    relatedRoutes: [
      { to: '/gallery', label: '比较十六张宫廷牌', labelEn: 'Compare all sixteen Court Cards', description: '观察不同元素和发展阶段。', descriptionEn: 'Observe differences in element and developmental stage.' },
      { to: '/tarot', label: '在真实问题中练习', labelEn: 'Practice with a real question', description: '先写清语境，再判断宫廷牌的层次。', descriptionEn: 'State the context before choosing a Court Card level.' },
    ],
  },
  {
    slug: 'choose-three-card-or-celtic-cross-spread',
    title: '三张牌还是凯尔特十字？怎样为问题选择合适牌阵',
    titleEn: 'Three cards or Celtic Cross? How to choose the right Tarot spread',
    excerpt: '牌阵越大不代表答案越准确。先判断问题范围、可用信息和你能否区分各牌位，再决定使用轻量三牌阵还是更完整的结构。',
    excerptEn: 'A larger spread is not automatically more accurate. Choose between a compact three-card spread and a fuller structure by question scope, available context, and your ability to distinguish positions.',
    category: 'learning',
    tags: ['牌阵选择', '三牌阵', '凯尔特十字'],
    tagsEn: ['Choosing spreads', 'Three-card spread', 'Celtic Cross'],
    authorSlug: 'qinghe',
    publishedAt: '2026-07-24',
    updatedAt: '2026-07-24',
    readingMinutes: 7,
    coverCardNameEn: 'The World',
    coverAlt: '世界塔罗牌面，用于说明完整结构与全局视角',
    coverAltEn: 'The World Tarot card, illustrating a complete structure and broad perspective',
    blocks: [
      {
        type: 'paragraph',
        text: '有些读牌卡住，不是因为牌义不够，而是问题和牌阵尺寸不匹配。一个具体的本周行动，用十张牌会制造噪音；一个牵涉背景、内外影响与长期方向的转职问题，只用一张牌又可能过度简化。',
        textEn: 'Some readings stall because the spread does not fit the question. Ten cards can create noise around one concrete action for the week, while one card may oversimplify a career transition involving background, internal and external influence, and long-term direction.',
      },
      { type: 'heading', id: 'three-card-fit', text: '三张牌适合什么', textEn: 'When three cards are enough' },
      {
        type: 'list',
        items: [
          '问题有明确范围，例如未来两周怎样准备一次沟通。',
          '你需要比较三个角度，而不是追求完整人生叙事。',
          '牌位可以写成现状、关键影响、下一步行动。',
          '你愿意在行动后回访，而不是不断加抽澄清牌。',
        ],
        itemsEn: [
          'The question has a clear scope, such as preparing for a conversation in the next two weeks.',
          'You need three perspectives rather than a complete life narrative.',
          'Positions can be situation, key influence, and next action.',
          'You are willing to review after acting instead of drawing endless clarifiers.',
        ],
      },
      { type: 'heading', id: 'celtic-cross-fit', text: '凯尔特十字何时值得使用', textEn: 'When a Celtic Cross earns its size' },
      {
        type: 'paragraph',
        text: '凯尔特十字适合结构复杂、已经积累一段时间、需要区分内在态度和外部环境的问题。使用前要能清楚复述每个牌位，并接受其中一些位置提供背景而不是直接答案。若只是因为焦虑想多看几张牌，它通常不会带来更多清晰。',
        textEn: 'A Celtic Cross fits layered situations that have developed over time and require a distinction between inner attitude and outer conditions. You should be able to restate every position and accept that some cards provide context rather than answers. Anxiety alone is not a reason to draw more cards.',
      },
      { type: 'heading', id: 'design-positions', text: '先写牌位，再洗牌', textEn: 'Write positions before shuffling' },
      {
        type: 'paragraph',
        text: '无论使用现成牌阵还是自定义牌阵，我都会先把每个位置写成完整问题，并检查它们是否重复。两个都在问“结果”的牌位会让解读互相竞争；加入“我能采取的行动”通常比再加一个预测位置更有用。',
        textEn: 'Whether using a traditional or custom spread, I write each position as a full question and remove duplicates. Two outcome positions compete with each other. Adding “What action is available to me?” is usually more useful than another prediction slot.',
      },
      {
        type: 'callout',
        title: '三条选阵标准',
        titleEn: 'Three spread-selection checks',
        text: '范围越窄，牌越少；牌位必须各自回答不同问题；你应当能在不加抽牌的情况下，把结果总结成一段现实可用的话。',
        textEn: 'Use fewer cards for a narrower scope. Give every position a distinct job. You should be able to summarize the reading in one practical paragraph without extra draws.',
      },
      {
        type: 'quote',
        text: '牌阵是问题的地图，不是用牌数量证明认真程度。',
        textEn: 'A spread is a map of the question, not proof of seriousness through card count.',
      },
    ],
    relatedRoutes: [
      { to: '/spreads', label: '浏览现有牌阵', labelEn: 'Browse available spreads', description: '先比较牌位结构，再选择牌数。', descriptionEn: 'Compare position structures before choosing card count.' },
      { to: '/tarot', label: '开始一次结构化占卜', labelEn: 'Start a structured reading', description: '带着范围明确的问题进入牌阵。', descriptionEn: 'Enter a spread with a clearly scoped question.' },
    ],
  },
  {
    slug: 'ask-better-tarot-questions-about-relationships',
    title: '感情占卜怎样提问，才能得到可行动的答案',
    titleEn: 'How to ask relationship Tarot questions that lead to action',
    excerpt: '与其反复追问对方心里在想什么，不如把问题转向可观察的互动、自己的需要和下一步沟通。好的提问会把选择权留在你手里。',
    excerptEn: 'Instead of repeatedly asking what another person secretly thinks, focus on observable interaction, your needs, and the next conversation. A useful question keeps agency in your hands.',
    category: 'discussion',
    tags: ['感情占卜', '提问方式', '关系边界'],
    tagsEn: ['Relationship readings', 'Better questions', 'Relationship boundaries'],
    authorSlug: 'yanxi',
    publishedAt: '2026-07-24',
    updatedAt: '2026-07-24',
    readingMinutes: 7,
    coverCardNameEn: 'Two of Cups',
    coverAlt: '圣杯二塔罗牌面，用于说明关系中的双向互动',
    coverAltEn: 'Two of Cups Tarot card, illustrating mutual interaction in relationships',
    blocks: [
      {
        type: 'paragraph',
        text: '关系问题最容易让人想寻找确定答案：“他到底爱不爱我？”“我们是不是注定在一起？”但牌面无法替另一位当事人签署内心证明。我的做法是保留提问背后的真实需要，同时把问题改成可以观察、沟通和选择的方向。',
        textEn: 'Relationship uncertainty invites certainty-seeking: “Do they really love me?” or “Are we destined?” Cards cannot sign a certificate for another person’s inner life. I keep the real need underneath the question while redirecting it toward observation, communication, and choice.',
      },
      { type: 'heading', id: 'question-rewrites', text: '把封闭问题改成开放问题', textEn: 'Rewrite closed questions as open ones' },
      {
        type: 'list',
        items: [
          '“他会不会回来？”改成“如果我等待，这段关系会怎样影响我的生活？”',
          '“她是不是骗我？”改成“目前有哪些信息需要核实，我应怎样建立边界？”',
          '“我们会结婚吗？”改成“双方需要讨论哪些长期承诺与现实条件？”',
          '“我该不该分手？”改成“留下与离开分别要求我承担什么？”',
        ],
        itemsEn: [
          '“Will they return?” becomes “How would waiting affect my life and this relationship?”',
          '“Are they lying?” becomes “What information needs verification, and what boundary can I set?”',
          '“Will we marry?” becomes “What commitments and practical conditions do we need to discuss?”',
          '“Should I leave?” becomes “What would staying and leaving each require me to take responsibility for?”',
        ],
      },
      { type: 'heading', id: 'facts-needs-actions', text: '一个好问题包含事实、需要和行动', textEn: 'A useful question includes facts, needs, and action' },
      {
        type: 'paragraph',
        text: '先写下已经发生的事实，再写自己希望得到什么，最后限定一个时间范围。例如：“我们一个月没有讨论未来，我需要知道双方是否愿意投入。未来两周，我可以怎样发起一次清楚又尊重边界的谈话？”这样的牌阵更容易落地。',
        textEn: 'Write what has happened, what you need, and a time frame. For example: “We have not discussed our future for a month. I need to know whether both of us are willing to invest. How can I begin a clear, respectful conversation in the next two weeks?”',
      },
      { type: 'heading', id: 'do-not-replace-dialogue', text: '占卜不能代替双方沟通', textEn: 'A reading cannot replace mutual conversation' },
      {
        type: 'paragraph',
        text: '如果关系中存在威胁、控制、跟踪或人身安全风险，重点不是继续抽牌确认，而是联系可信支持和当地专业资源。普通关系分歧也应回到当事人的言行：塔罗可以整理你的观察，却不能替对方回应。',
        textEn: 'If a relationship involves threats, coercion, stalking, or physical danger, the priority is trusted support and appropriate local resources, not another draw. In ordinary conflict, return to words and behavior. Tarot can organize your observations; it cannot answer for the other person.',
      },
      {
        type: 'callout',
        title: '提问前的三句自检',
        titleEn: 'Three checks before asking',
        text: '我现在知道哪些事实？我真正需要保护或争取什么？无论抽到什么牌，我可以完成的最小行动是什么？',
        textEn: 'What facts do I know? What do I need to protect or pursue? What is the smallest action I can take regardless of the cards?',
      },
      {
        type: 'quote',
        text: '能帮助你沟通和选择的问题，比替别人猜心的问题更有力量。',
        textEn: 'A question that helps you communicate and choose is stronger than one that guesses another mind.',
      },
    ],
    relatedRoutes: [
      { to: '/tarot', label: '带着清晰问题开始', labelEn: 'Start with a clear question', description: '把事实、需要和时间范围写进问题。', descriptionEn: 'Include facts, needs, and a time frame in your question.' },
      { to: '/feedback', label: '反馈你的使用体验', labelEn: 'Share your experience', description: '告诉我们哪些提问提示最有帮助。', descriptionEn: 'Tell us which question prompts helped most.' },
    ],
  },
  {
    slug: 'lenormand-nine-card-box-first-reading',
    title: '雷诺曼九宫格入门：先读结构，再读牌对',
    titleEn: 'A beginner guide to the Lenormand nine-card box',
    excerpt: '九宫格不是把九张牌逐一解释。先确定中心主题、横纵线与角落，再用相邻牌组成短句，能更接近雷诺曼强调组合与位置的阅读方式。',
    excerptEn: 'A nine-card box is not nine separate definitions. Start with the center, rows, columns, and corners, then build short phrases from neighboring cards to honor Lenormand’s positional language.',
    category: 'learning',
    tags: ['雷诺曼', '九宫格', '组合读牌'],
    tagsEn: ['Lenormand', 'Nine-card box', 'Card combinations'],
    authorSlug: 'qinghe',
    publishedAt: '2026-07-24',
    updatedAt: '2026-07-24',
    readingMinutes: 8,
    coverCardNameEn: 'The Magician',
    coverAlt: '魔术师塔罗牌面，用于说明符号组合与信息连接',
    coverAltEn: 'The Magician Tarot card, illustrating symbolic combinations and connected information',
    blocks: [
      {
        type: 'paragraph',
        text: '第一次读雷诺曼九宫格时，我也曾从左上角开始，一张一张讲到右下角，结果得到九段互不相连的话。九宫格真正的优势是结构：中心给出核心，直线给出过程，相邻牌共同形成描述。',
        textEn: 'In my first Lenormand nine-card box, I explained each card from top left to bottom right and produced nine disconnected statements. The value of the box is structural: the center gives a core, lines show movement, and neighboring cards form descriptions together.',
      },
      { type: 'heading', id: 'nine-card-layout', text: '按四层顺序阅读', textEn: 'Read the layout in four layers' },
      {
        type: 'list',
        items: [
          '中心牌：用一个名词或短句定义整组牌的核心。',
          '中间横线：观察事情从左到右如何展开。',
          '中间竖线：比较背景、当下重点和可能走向。',
          '四角与对角线：检查哪些主题包围中心或形成张力。',
        ],
        itemsEn: [
          'Center: define the core of the box in one noun or short phrase.',
          'Middle row: observe how the situation unfolds from left to right.',
          'Middle column: compare background, present focus, and likely direction.',
          'Corners and diagonals: inspect what surrounds or tensions the center.',
        ],
      },
      { type: 'heading', id: 'build-pairs', text: '把牌对读成修饰关系', textEn: 'Build modifying pairs' },
      {
        type: 'paragraph',
        text: '雷诺曼组合常像简短语句：一张牌提供主题，另一张牌修饰它。例如“信件 + 山”可以先试读为消息延迟或沟通受阻，而不是分别讲一遍信件和障碍。方向仍要由问题与牌位决定。',
        textEn: 'Lenormand pairs often behave like short phrases: one card supplies the subject and another modifies it. Letter plus Mountain may suggest delayed news or obstructed communication, rather than two separate speeches about letters and obstacles. The question still directs the phrase.',
      },
      { type: 'heading', id: 'avoid-tarot-habits', text: '避免把塔罗习惯直接搬过来', textEn: 'Avoid importing every Tarot habit' },
      {
        type: 'paragraph',
        text: '我会暂时放下长篇心理象征和单张牌的正逆位，把注意力放在具体名词、动作、距离和组合。若某个牌对有多种可能，就列出两种并寻找整组牌中的重复证据，不用直觉强行选一个戏剧化结论。',
        textEn: 'I set aside long psychological symbolism and upright-reversed distinctions, focusing on concrete nouns, actions, distance, and combination. When a pair allows several meanings, list two and look for repetition elsewhere instead of forcing the most dramatic option.',
      },
      {
        type: 'callout',
        title: '第一次九宫格的限制条件',
        titleEn: 'Limits for a first nine-card box',
        text: '只问一个有时间范围的问题；每个牌对最多写两种解释；完成中心、两条中线和四角后，用三句话总结，不额外加牌。',
        textEn: 'Ask one time-bounded question. Give each pair no more than two readings. After the center, middle lines, and corners, summarize in three sentences without adding cards.',
      },
      {
        type: 'quote',
        text: '雷诺曼的清晰，常常来自牌与牌之间，而不是某一张牌说得多深。',
        textEn: 'Lenormand clarity often comes from the space between cards, not depth imposed on one card.',
      },
    ],
    relatedRoutes: [
      { to: '/oracle-gallery', label: '浏览雷诺曼与神谕牌', labelEn: 'Browse Lenormand and oracle cards', description: '先熟悉牌面，再练习组合。', descriptionEn: 'Learn the cards before practicing combinations.' },
      { to: '/spreads', label: '比较不同牌阵结构', labelEn: 'Compare spread structures', description: '观察牌位如何改变信息关系。', descriptionEn: 'See how positions change relationships between cards.' },
    ],
  },
  {
    slug: 'use-oracle-cards-with-tarot-clearly',
    title: '塔罗与神谕牌怎样搭配，才不会越抽越混乱',
    titleEn: 'How to combine Tarot and oracle cards without creating confusion',
    excerpt: '两套牌一起使用时，关键不是增加信息量，而是先分配职责。让塔罗处理结构，让神谕牌补充主题或反思提示，可以避免互相覆盖。',
    excerptEn: 'Using two decks is not about maximizing information. Give each system a distinct job: Tarot can hold the structure while an oracle card adds a theme or reflection prompt.',
    category: 'discussion',
    tags: ['神谕牌', '跨体系读牌', '读牌边界'],
    tagsEn: ['Oracle cards', 'Cross-system reading', 'Reading boundaries'],
    authorSlug: 'yanxi',
    publishedAt: '2026-07-24',
    updatedAt: '2026-07-24',
    readingMinutes: 6,
    coverCardNameEn: 'Temperance',
    coverAlt: '节制塔罗牌面，用于说明两套牌之间的平衡与调和',
    coverAltEn: 'Temperance Tarot card, illustrating balance between two card systems',
    blocks: [
      {
        type: 'paragraph',
        text: '把塔罗和神谕牌放在一起很有吸引力，但最常见的问题是每张牌都在回答同一个问题。信息看似更多，实际却难以判断哪一个是主线。我会在洗牌前先写下两套牌各自负责什么。',
        textEn: 'Combining Tarot and oracle cards is appealing, but a common problem is asking every card to answer the same question. There is more information but no clear hierarchy. Before shuffling, I write down the job of each deck.',
      },
      { type: 'heading', id: 'assign-deck-jobs', text: '三种清楚的分工方式', textEn: 'Three clear ways to divide the work' },
      {
        type: 'list',
        items: [
          '塔罗分析现状与行动，神谕牌给出本周反思主题。',
          '塔罗展开三个牌位，神谕牌只为整组牌写一句标题。',
          '先用神谕牌选择主题，再用塔罗回答一个具体问题。',
          '若两套牌冲突，回到原问题，不继续抽第三套牌裁决。',
        ],
        itemsEn: [
          'Tarot examines situation and action; the oracle gives a theme for reflection.',
          'Tarot fills three positions; one oracle card provides a title for the whole spread.',
          'Use an oracle card to choose a theme, then ask Tarot one specific question.',
          'If the decks conflict, return to the question instead of drawing a third deck to judge.',
        ],
      },
      { type: 'heading', id: 'keep-hierarchy', text: '保留主线和补充层', textEn: 'Keep a primary and supporting layer' },
      {
        type: 'paragraph',
        text: '一次阅读最好只有一个主要结构。如果塔罗牌阵是主线，神谕牌就不应推翻每个牌位，而应提供语气、提醒或复盘问题。若补充牌让原本清楚的行动变得含糊，我会先移开它。',
        textEn: 'A reading benefits from one primary structure. If the Tarot spread is primary, the oracle card should not overturn every position; it can provide tone, a reminder, or a review question. If a supporting card obscures a clear action, I set it aside.',
      },
      { type: 'heading', id: 'stop-drawing', text: '设定停止抽牌的规则', textEn: 'Set a stopping rule' },
      {
        type: 'paragraph',
        text: '我通常把上限写在记录里：三张塔罗加一张神谕，完成总结后结束。持续加抽往往不是牌不够，而是我们不喜欢已有答案。先完成一个现实动作，再决定是否需要新的问题。',
        textEn: 'I write the limit in advance: three Tarot cards and one oracle card, then stop after the summary. Repeated draws often mean we dislike the available answer, not that the cards are insufficient. Complete one real action before asking a new question.',
      },
      {
        type: 'callout',
        title: '一主一辅模板',
        titleEn: 'A primary-support template',
        text: '塔罗三牌位：我看见什么、我忽略什么、我能做什么。神谕一张：完成行动时要记住的态度。',
        textEn: 'Three Tarot positions: what I see, what I overlook, and what I can do. One oracle card: the attitude to remember while taking action.',
      },
      {
        type: 'quote',
        text: '搭配的价值来自分工，而不是让更多牌争夺最后一句话。',
        textEn: 'The value of combining decks comes from distinct roles, not more cards competing for the last word.',
      },
    ],
    relatedRoutes: [
      { to: '/oracle-gallery', label: '探索神谕牌与雷诺曼', labelEn: 'Explore oracle and Lenormand cards', description: '了解不同体系的图像与使用方式。', descriptionEn: 'Learn the imagery and use of different systems.' },
      { to: '/tarot', label: '建立一主一辅阅读', labelEn: 'Build a primary-support reading', description: '先为每套牌写下明确职责。', descriptionEn: 'Give each deck a clear role before drawing.' },
    ],
  },
  {
    slug: 'ethical-tarot-reading-consent-repetition-fees',
    title: '一次负责任的塔罗咨询，需要先说清哪些边界',
    titleEn: 'What a responsible Tarot reading should clarify before it begins',
    excerpt: '知情同意、问题范围、收费方式、隐私和停止条件都应在抽牌前明确。读牌伦理不是附加说明，而是让咨询关系保持安全与诚实的基础。',
    excerptEn: 'Consent, scope, fees, privacy, and stopping conditions should be clear before cards are drawn. Reading ethics are the foundation of a safe and honest consultation.',
    category: 'experience',
    tags: ['咨询伦理', '知情同意', '重复占卜'],
    tagsEn: ['Reading ethics', 'Informed consent', 'Repeated readings'],
    authorSlug: 'xuanyin',
    publishedAt: '2026-07-24',
    updatedAt: '2026-07-24',
    readingMinutes: 7,
    coverCardNameEn: 'The Hierophant',
    coverAlt: '教皇塔罗牌面，用于说明咨询规则与共同约定',
    coverAltEn: 'The Hierophant Tarot card, illustrating consultation rules and shared agreements',
    blocks: [
      {
        type: 'paragraph',
        text: '我曾经把“帮助对方”理解为尽量多讲，后来才明白，负责任的咨询首先要让双方知道正在做什么、不会做什么，以及任何一方何时可以停止。清楚的边界不会削弱神秘感，反而让交流更可信。',
        textEn: 'I once thought helping meant saying as much as possible. I later learned that responsible practice begins with shared understanding: what we are doing, what we will not do, and when either person may stop. Clear boundaries make the exchange more trustworthy.',
      },
      { type: 'heading', id: 'before-reading-agreement', text: '开始前应当明确五件事', textEn: 'Clarify five things before the reading' },
      {
        type: 'list',
        items: [
          '问题范围与时长：本次只处理哪些主题。',
          '收费与交付：价格、包含内容、修改或退款规则。',
          '隐私：会记录什么、保存多久、是否用于案例交流。',
          '限制：不替第三方读心，不代替医疗、法律或财务专业意见。',
          '停止条件：当事人不适、信息不足或风险超出能力时及时结束。',
        ],
        itemsEn: [
          'Scope and time: which subjects this session will address.',
          'Fees and delivery: price, included work, revisions, and refund terms.',
          'Privacy: what is recorded, for how long, and whether a case may be discussed.',
          'Limits: no third-party mind reading and no replacement for medical, legal, or financial advice.',
          'Stopping conditions: end when there is distress, insufficient information, or risk beyond competence.',
        ],
      },
      { type: 'heading', id: 'repeated-readings', text: '重复占卜需要冷却期', textEn: 'Repeated readings need a cooling-off period' },
      {
        type: 'paragraph',
        text: '同一个问题在现实没有新信息时反复抽牌，通常只会放大焦虑。我会先问：上次阅读建议的行动完成了吗？情况出现了什么可验证变化？如果都没有，就约定冷却期，并把注意力转向现实支持。',
        textEn: 'Repeated draws without new real-world information usually amplify anxiety. I ask whether the prior action was completed and what verifiable change occurred. If neither exists, I suggest a cooling-off period and redirect attention toward practical support.',
      },
      { type: 'heading', id: 'power-balance', text: '不利用信息与权力差', textEn: 'Do not exploit informational power' },
      {
        type: 'paragraph',
        text: '塔罗师的语气可能被当成权威，因此我会区分牌面观察、个人解释和已知事实，也不会用恐惧推动追加消费。对不确定内容说“不确定”，是专业的一部分。',
        textEn: 'A reader’s tone may be treated as authority. I distinguish card observation, personal interpretation, and known fact, and I do not use fear to encourage another purchase. Saying “I am not sure” is part of professional practice.',
      },
      {
        type: 'callout',
        title: '咨询前确认句',
        titleEn: 'A pre-reading agreement',
        text: '请确认问题、费用、交付方式和隐私范围都已清楚；你可以随时跳过不愿讨论的内容，也可以要求停止本次阅读。',
        textEn: 'Confirm that the question, fee, delivery, and privacy terms are clear. You may skip anything you do not wish to discuss and may ask to stop the reading at any time.',
      },
      {
        type: 'quote',
        text: '伦理不是限制解读，而是限制我们把不确定性包装成权威。',
        textEn: 'Ethics do not restrict interpretation; they restrict turning uncertainty into authority.',
      },
    ],
    relatedRoutes: [
      { to: '/feedback', label: '提交服务反馈', labelEn: 'Submit service feedback', description: '记录边界、沟通或交付中的问题。', descriptionEn: 'Report concerns about boundaries, communication, or delivery.' },
      { to: '/tarot', label: '查看塔罗师与服务', labelEn: 'View readers and services', description: '开始前先确认问题范围与规则。', descriptionEn: 'Confirm scope and terms before beginning.' },
    ],
  },
  {
    slug: 'tarot-boundaries-health-law-money',
    title: '健康、法律与投资问题：塔罗应该在哪里停下来',
    titleEn: 'Health, legal, and financial questions: where Tarot should stop',
    excerpt: '塔罗可以帮助整理感受、准备沟通和辨认选择，却不能诊断疾病、解释法律责任或保证投资结果。明确转介边界，是对使用者真正负责。',
    excerptEn: 'Tarot can organize feelings, prepare conversations, and clarify choices, but it cannot diagnose illness, determine legal liability, or guarantee investment outcomes. Referral boundaries protect the user.',
    category: 'discussion',
    tags: ['专业边界', '风险提示', '负责任占卜'],
    tagsEn: ['Professional boundaries', 'Risk notice', 'Responsible reading'],
    authorSlug: 'yanxi',
    publishedAt: '2026-07-24',
    updatedAt: '2026-07-24',
    readingMinutes: 7,
    coverCardNameEn: 'King of Swords',
    coverAlt: '宝剑国王塔罗牌面，用于说明证据、判断与专业边界',
    coverAltEn: 'King of Swords Tarot card, illustrating evidence, judgment, and professional boundaries',
    blocks: [
      {
        type: 'paragraph',
        text: '有些问题听起来像占卜问题，实际上需要专业判断。“这个症状严重吗”“官司一定能赢吗”“现在买入会赚钱吗”，都包含塔罗无法验证的数据和现实责任。继续给出肯定答案，可能让使用者延误真正需要的帮助。',
        textEn: 'Some prompts sound like divination questions but require professional judgment. “Is this symptom serious?” “Will I win the case?” and “Will this investment profit?” depend on evidence and responsibilities Tarot cannot verify. Confident answers may delay appropriate help.',
      },
      { type: 'heading', id: 'hard-boundaries', text: '三条不能越过的线', textEn: 'Three lines not to cross' },
      {
        type: 'list',
        items: [
          '健康：不做诊断、不建议停药，不把牌面当检查结果。',
          '法律：不判断责任或胜诉概率，提醒咨询当地合格专业人士。',
          '投资：不承诺收益、不替用户选择产品，不用恐惧制造紧迫感。',
          '安全与危机：出现自伤、暴力或人身威胁时，优先联系当地紧急与专业支持。',
        ],
        itemsEn: [
          'Health: do not diagnose, advise stopping medication, or treat cards as test results.',
          'Legal: do not determine liability or odds of success; refer to a qualified local professional.',
          'Financial: do not promise returns, select products for users, or manufacture urgency through fear.',
          'Safety and crisis: when self-harm, violence, or danger appears, prioritize local emergency and professional support.',
        ],
      },
      { type: 'heading', id: 'reflective-reframes', text: '可以保留的反思方向', textEn: 'Reflective questions that remain appropriate' },
      {
        type: 'paragraph',
        text: '停止专业判断，不等于拒绝所有对话。健康问题可以改问“我怎样准备就医时要说明的信息”；法律问题可以改问“我需要整理哪些事实和文件”；投资问题可以改问“我的风险承受和决策盲点是什么”。答案仍需回到专业证据。',
        textEn: 'Stopping professional judgment does not end reflection. A health prompt can become “How can I prepare information for an appointment?” A legal prompt can ask “What facts and documents should I organize?” A financial prompt can explore risk tolerance and decision blind spots. Evidence remains primary.',
      },
      { type: 'heading', id: 'say-limit-clearly', text: '清楚说明限制，不含糊带过', textEn: 'State the limit plainly' },
      {
        type: 'paragraph',
        text: '我会直接说：“这个问题需要相关专业人士判断，我不能用塔罗给出结论。”然后说明我能提供的反思范围。边界提示要出现在解读之前，不能在给完强烈预测后才用一句免责声明抵消。',
        textEn: 'I say directly: “This requires a qualified professional; I cannot use Tarot to provide that conclusion.” I then name the reflective scope I can offer. A disclaimer belongs before the reading, not after a forceful prediction as an attempted cancellation.',
      },
      {
        type: 'callout',
        title: '专业建议免责声明',
        titleEn: 'Professional-advice notice',
        text: '本文及相关占卜仅供自我反思，不构成医疗、心理、法律或投资建议。紧急或高风险情况请联系所在地合格专业人士或紧急服务。',
        textEn: 'This article and related readings are for self-reflection only and are not medical, mental-health, legal, or financial advice. For urgent or high-risk situations, contact qualified local professionals or emergency services.',
      },
      {
        type: 'quote',
        text: '真正负责的解读，知道什么时候应该把位置让给证据和专业支持。',
        textEn: 'Responsible reading knows when to yield to evidence and professional support.',
      },
    ],
    relatedRoutes: [
      { to: '/feedback', label: '报告不当内容', labelEn: 'Report inappropriate content', description: '帮助我们处理越界或误导性表达。', descriptionEn: 'Help us address overreaching or misleading guidance.' },
      { to: '/blog', label: '阅读更多方法文章', labelEn: 'Read more practical articles', description: '用学习与反思替代高风险预测。', descriptionEn: 'Choose learning and reflection over high-risk prediction.' },
    ],
  },
  {
    slug: 'turn-a-tarot-reading-into-an-action-plan',
    title: '从一次占卜到行动计划：我怎样把牌面落到现实',
    titleEn: 'From Tarot reading to action plan: turning cards into real steps',
    excerpt: '一段解读如果只留下情绪，很快就会被忘记。我用“观察、选择、动作、证据、回访”五步，把牌面提示转成能够执行和检验的小计划。',
    excerptEn: 'A reading that leaves only a feeling is quickly forgotten. I use five steps—observation, choice, action, evidence, and review—to turn card insight into a small testable plan.',
    category: 'experience',
    tags: ['行动计划', '案例复盘', '自我反思'],
    tagsEn: ['Action plan', 'Case review', 'Self-reflection'],
    authorSlug: 'xuanyin',
    publishedAt: '2026-07-24',
    updatedAt: '2026-07-24',
    readingMinutes: 8,
    coverCardNameEn: 'Eight of Pentacles',
    coverAlt: '星币八塔罗牌面，用于说明持续练习与现实行动',
    coverAltEn: 'Eight of Pentacles Tarot card, illustrating sustained practice and practical action',
    blocks: [
      {
        type: 'paragraph',
        text: '我复盘过许多当时觉得“很准”的占卜，却发现几周后只记得一种被理解的感觉。后来我要求自己在结束前完成一张行动卡：牌面看见了什么、我有哪些选择、下一步做什么、怎样知道它有效、何时回来检查。',
        textEn: 'I reviewed many readings that felt accurate at the time, only to remember the feeling of being understood a few weeks later. I now complete an action card before ending: what the cards showed, what choices exist, what comes next, what evidence matters, and when to review.',
      },
      { type: 'heading', id: 'five-action-fields', text: '行动卡的五个字段', textEn: 'Five fields on the action card' },
      {
        type: 'list',
        items: [
          '观察：只写牌面与现实都支持的核心模式。',
          '选择：至少列出两个可能方向及各自代价。',
          '动作：限定为一周内可以完成的一步。',
          '证据：提前定义哪些事实说明行动有帮助。',
          '回访：设定日期，不在中途因焦虑重复占卜。',
        ],
        itemsEn: [
          'Observation: keep one core pattern supported by both cards and reality.',
          'Choice: name at least two directions and the cost of each.',
          'Action: choose one step that can be completed within a week.',
          'Evidence: define in advance what facts would show the action helped.',
          'Review: set a date instead of repeating the reading through anxiety.',
        ],
      },
      { type: 'heading', id: 'anonymous-case', text: '一个去标识化的工作案例', textEn: 'An anonymized work example' },
      {
        type: 'paragraph',
        text: '一位来访者在考虑是否接受新职责。牌阵里星币八强调技能投入，权杖十提醒负荷，正义要求条件清楚。我们没有把它总结成“应该接受”，而是列出两个动作：向负责人索取职责范围，并核算未来四周可用时间。',
        textEn: 'A client was considering new responsibilities. Eight of Pentacles emphasized skill investment, Ten of Wands highlighted workload, and Justice asked for clear terms. We did not conclude “accept it.” We chose two actions: request a written scope and calculate available time over the next four weeks.',
      },
      { type: 'heading', id: 'review-outcome', text: '复盘结果，而不是美化准确率', textEn: 'Review the outcome without polishing accuracy' },
      {
        type: 'paragraph',
        text: '后来对方发现职责范围比预期更大，因此提出分阶段承担。这个结果不证明塔罗预测了未来，而是说明牌面促成了两个有用检查。复盘时我也记录遗漏：我们没有提前讨论培训资源，这成为下一次改进。',
        textEn: 'The written scope proved larger than expected, so the client proposed a staged transition. This did not prove Tarot predicted the future; it showed the spread prompted two useful checks. I also recorded what we missed: training resources should have been discussed earlier.',
      },
      {
        type: 'callout',
        title: '把建议缩小到一周',
        titleEn: 'Shrink advice to one week',
        text: '如果行动仍像“相信自己”或“等待机会”，继续追问：本周哪一天、向谁、完成什么可观察动作？越具体，越容易复盘。',
        textEn: 'If the action still sounds like “trust yourself” or “wait for opportunity,” ask: on which day, with whom, and what observable step will be completed? Specific plans are easier to review.',
      },
      {
        type: 'quote',
        text: '占卜的价值不只在解释当下，也在帮助你设计下一次可以观察的现实。',
        textEn: 'A reading has value not only in explaining the present, but in designing the next reality you can observe.',
      },
    ],
    relatedRoutes: [
      { to: '/history', label: '回看占卜记录', labelEn: 'Review reading history', description: '把问题、行动和后续证据放在一起。', descriptionEn: 'Keep the question, action, and later evidence together.' },
      { to: '/tarot', label: '带着行动目标开始', labelEn: 'Start with an action goal', description: '在问题中明确时间范围与可控部分。', descriptionEn: 'Define a time frame and what you can control.' },
    ],
  },
  {
    slug: 'read-tarot-without-memorizing-every-keyword',
    title: '不靠死记牌义，怎样真正读懂一张塔罗牌',
    titleEn: 'How to read Tarot without memorizing every keyword',
    excerpt: '我更建议初学者从图像、问题和牌位开始，再把传统牌义当作校准工具。这里是一套可以每天练习的四步方法。',
    excerptEn: 'Start with imagery, the question, and the card position, then use traditional meanings as calibration. Here is a four-step daily practice.',
    category: 'learning',
    tags: ['塔罗入门', '牌义学习', '图像观察'],
    tagsEn: ['Tarot foundations', 'Card meanings', 'Visual reading'],
    authorSlug: 'qinghe',
    publishedAt: '2026-07-20',
    updatedAt: '2026-07-20',
    readingMinutes: 7,
    coverCardNameEn: 'The High Priestess',
    coverAlt: '女祭司塔罗牌面',
    coverAltEn: 'The High Priestess Tarot card',
    featured: true,
    blocks: [
      {
        type: 'paragraph',
        text: '刚开始学习塔罗时，我也做过厚厚的关键词笔记。后来真正开始为别人读牌，我才发现：记住“女祭司等于直觉”并不等于会读牌。真正的阅读发生在牌面、问题、牌位和当事人的现实处境相遇时。',
        textEn: 'When I started Tarot, I filled notebooks with keywords. Later, reading for others showed me that knowing “The High Priestess means intuition” is not the same as reading. A reading happens where image, question, position, and real context meet.',
      },
      { type: 'heading', id: 'look-before-label', text: '第一步：先看图，再说牌名', textEn: 'Step one: look before you label' },
      {
        type: 'paragraph',
        text: '抽到一张牌后，先给自己十秒钟，不翻书，也不搜索。观察人物朝向、颜色、距离、天气和最先吸引你的细节。问自己：“如果这是一幅正在发生的画面，下一秒会怎样？”这个答案常常比第一个关键词更接近问题。',
        textEn: 'After drawing a card, wait ten seconds before opening a guide. Notice direction, color, distance, weather, and the first detail that catches you. Ask: “If this scene were moving, what happens next?” That answer is often closer to the question than your first keyword.',
      },
      { type: 'heading', id: 'return-to-question', text: '第二步：让牌义回到问题里', textEn: 'Step two: return the meaning to the question' },
      {
        type: 'paragraph',
        text: '同一张隐士牌，放在“是否该主动联系”与“怎样准备转职”里，重点不会相同。前者可能提醒你先辨认自己的需要，后者可能指向独立研究和暂缓公开。不要问“这张牌是什么意思”，而要问“这张牌正在回答问题的哪一部分”。',
        textEn: 'The Hermit will not emphasize the same thing in “Should I contact them?” and “How should I prepare for a career change?” Ask not “What does this card mean?” but “Which part of the question is this card answering?”',
      },
      { type: 'heading', id: 'position-is-grammar', text: '第三步：把牌位当成语法', textEn: 'Step three: treat the position as grammar' },
      {
        type: 'list',
        items: [
          '“现状”牌位描述正在发生什么，不急着给建议。',
          '“阻碍”牌位指出摩擦，不一定代表坏结果。',
          '“行动”牌位要翻译成当事人可以执行的一步。',
          '“结果”牌位呈现当前路径的倾向，不是不可改变的判决。',
        ],
        itemsEn: [
          'A situation position describes what is happening before giving advice.',
          'An obstacle position shows friction, not necessarily a bad outcome.',
          'An action position should become one executable next step.',
          'An outcome position shows the current trajectory, not an unchangeable verdict.',
        ],
      },
      { type: 'heading', id: 'calibrate', text: '第四步：最后再用传统牌义校准', textEn: 'Step four: calibrate with tradition' },
      {
        type: 'paragraph',
        text: '完成自己的观察后，再查阅一到两个可靠来源。比较哪些部分吻合、哪些遗漏、哪些只是你当时的投射。长期看，这种“先观察、再校准”的方法，会让牌义从记忆变成理解。',
        textEn: 'Only after making your own observations, consult one or two reliable sources. Compare what fits, what you missed, and what may have been projection. Over time, observe-then-calibrate turns memory into understanding.',
      },
      {
        type: 'callout',
        title: '今天的 5 分钟练习',
        titleEn: 'A five-minute practice',
        text: '随机抽一张牌，写下三个画面细节、一句正在发生的事和一个可执行动作。最后才对照牌义。连续做七天，比一次背完七十八张牌更有效。',
        textEn: 'Draw one card. Write three visual details, one sentence about what is happening, and one possible action. Check the guide last. Seven days of this is more useful than memorizing all 78 cards at once.',
      },
      {
        type: 'quote',
        text: '牌义不是答案库，而是一种帮助你组织观察的语言。',
        textEn: 'Card meanings are not an answer bank. They are a language for organizing observation.',
      },
    ],
    relatedRoutes: [
      { to: '/gallery', label: '浏览完整塔罗图鉴', labelEn: 'Browse the Tarot gallery', description: '从真实牌面练习图像观察。', descriptionEn: 'Practice visual reading with the full deck.' },
      { to: '/tarot', label: '带着方法开始一次占卜', labelEn: 'Start a reading with this method', description: '选择塔罗师并提出一个清晰问题。', descriptionEn: 'Choose a reader and ask one clear question.' },
    ],
  },
  {
    slug: 'why-two-tarot-readers-see-different-things',
    title: '同一组牌，为什么两位塔罗师会看到不同的重点',
    titleEn: 'Why two Tarot readers can see different things in the same spread',
    excerpt: '解牌出现分歧不一定意味着有人错了。真正需要比较的是依据、语境、边界，以及哪种解释能帮助当事人看清现实选择。',
    excerptEn: 'Different readings do not automatically mean someone is wrong. Compare evidence, context, boundaries, and which interpretation clarifies real choices.',
    category: 'discussion',
    tags: ['解牌交流', '关系议题', '读牌边界'],
    tagsEn: ['Reading discussion', 'Relationships', 'Reading boundaries'],
    authorSlug: 'yanxi',
    publishedAt: '2026-07-19',
    updatedAt: '2026-07-19',
    readingMinutes: 6,
    coverCardNameEn: 'Justice',
    coverAlt: '正义塔罗牌面',
    coverAltEn: 'Justice Tarot card',
    blocks: [
      {
        type: 'paragraph',
        text: '交流解牌时，我经常听到一个问题：“如果两位塔罗师说得不一样，到底该信谁？”我的答案通常不是马上选边，而是先看两种解释分别建立在什么上面。塔罗阅读本来就包含象征、语境和读牌者经验，重点不同并不稀奇。',
        textEn: 'In reading discussions I often hear: “If two readers disagree, whom should I trust?” I do not choose sides first. I ask what each interpretation is built on. Symbol, context, and practitioner experience naturally create different emphasis.',
      },
      { type: 'heading', id: 'layers', text: '分歧通常来自四个层次', textEn: 'Four common sources of difference' },
      {
        type: 'list',
        items: [
          '流派：有人重视元素和数字，有人更依赖图像与牌阵结构。',
          '问题：提问过宽时，塔罗师会主动选择不同的切入点。',
          '语境：当事人提供的信息不同，牌面会被放进不同现实背景。',
          '经验：塔罗师过去遇到的案例会影响其对风险和机会的敏感度。',
        ],
        itemsEn: [
          'Tradition: some readers prioritize elements and numbers; others use imagery and spread structure.',
          'Question: a broad prompt forces each reader to choose a different entry point.',
          'Context: different background information changes the real-world frame.',
          'Experience: prior cases affect how a reader notices risk and opportunity.',
        ],
      },
      { type: 'heading', id: 'evaluate', text: '判断解释质量，而不是寻找唯一答案', textEn: 'Evaluate quality instead of seeking one answer' },
      {
        type: 'paragraph',
        text: '一段可靠的解读应该能指出牌面依据，说明推理过程，也愿意承认不确定性。如果一个结论只能靠“我感觉就是这样”，或者不断用恐惧催促你行动，它就不值得因为语气坚定而被优先相信。',
        textEn: 'A reliable reading points to evidence in the cards, explains its reasoning, and admits uncertainty. A conclusion based only on “I just feel it,” or one that pressures you through fear, does not deserve trust merely because it sounds confident.',
      },
      {
        type: 'quote',
        text: '好的交流不是把不同解释压成一个答案，而是看见每种解释照亮了问题的哪一面。',
        textEn: 'Good discussion does not flatten interpretations into one answer. It shows which side of the question each one illuminates.',
      },
      { type: 'heading', id: 'bring-back-choice', text: '最后要回到现实选择', textEn: 'Bring the reading back to real choices' },
      {
        type: 'paragraph',
        text: '尤其在关系议题里，不要让任何一位塔罗师替你确认他人的内心。更有价值的问题是：两种解释分别提醒了哪些沟通风险？你能验证什么？下一步怎样既保护自己，也尊重对方的边界？',
        textEn: 'Especially in relationships, do not let any reader certify another person’s inner state. Ask what communication risks each view highlights, what you can verify, and how your next step can protect you while respecting boundaries.',
      },
      {
        type: 'callout',
        title: '交流解牌时可以问的三个问题',
        titleEn: 'Three questions for a reading discussion',
        text: '你的判断来自哪张牌、哪个牌位？还有什么合理解释？这个结论可以怎样在现实中验证？',
        textEn: 'Which card and position support this? What other reading is reasonable? How could this be tested in real life?',
      },
    ],
    relatedRoutes: [
      { to: '/spreads', label: '先理解牌阵结构', labelEn: 'Understand spread structure', description: '牌位是解读分歧的重要来源。', descriptionEn: 'Card positions are a major source of different interpretations.' },
      { to: '/feedback', label: '分享你的读牌问题', labelEn: 'Share your reading question', description: '把使用体验和疑问告诉我们。', descriptionEn: 'Tell us about your experience and questions.' },
    ],
  },
  {
    slug: 'tarot-reading-journal-that-actually-helps',
    title: '我怎样用读牌日志，让塔罗经验真正沉淀下来',
    titleEn: 'How I use a Tarot journal to turn readings into experience',
    excerpt: '只记录“抽到什么牌”很难形成经验。我现在会同时记录问题、第一反应、现实行动和后续验证，让每次读牌都留下可以复盘的线索。',
    excerptEn: 'Recording only the cards rarely builds experience. I also track the question, first reaction, real action, and later evidence so each reading leaves something testable.',
    category: 'experience',
    tags: ['经验复盘', '读牌日志', '长期学习'],
    tagsEn: ['Practice review', 'Tarot journal', 'Long-term learning'],
    authorSlug: 'xuanyin',
    publishedAt: '2026-07-18',
    updatedAt: '2026-07-18',
    readingMinutes: 8,
    coverCardNameEn: 'The Hermit',
    coverAlt: '隐士塔罗牌面',
    coverAltEn: 'The Hermit Tarot card',
    blocks: [
      {
        type: 'paragraph',
        text: '我最早的塔罗日志只有日期、牌名和一段抄来的牌义。半年后回看，我几乎无法判断自己有没有进步。后来我把日志改成“可复盘记录”：不仅保存当时怎么读，也保存之后发生了什么。经验就是从这两者之间长出来的。',
        textEn: 'My first journals held only dates, cards, and copied meanings. Six months later, I could not tell whether I had improved. I changed them into reviewable records: not only what I read, but what happened afterward. Experience grows between those two points.',
      },
      { type: 'heading', id: 'five-fields', text: '一条有用记录的五个部分', textEn: 'Five parts of a useful entry' },
      {
        type: 'list',
        items: [
          '问题：写下当时真正想解决的现实困惑。',
          '牌面：记录牌、正逆位和牌位，不急着美化结论。',
          '第一反应：保留最初看到的画面、情绪和身体感受。',
          '行动假设：写出接下来可以做的一件小事。',
          '回访：约定一个日期，记录后来发生的事实和新的理解。',
        ],
        itemsEn: [
          'Question: state the real-world uncertainty you wanted to address.',
          'Cards: record cards, orientation, and position before polishing a conclusion.',
          'First response: keep the first image, emotion, and bodily response.',
          'Action hypothesis: write one small next action.',
          'Follow-up: choose a date to record facts and new understanding.',
        ],
      },
      { type: 'heading', id: 'facts-vs-meaning', text: '把事实和解释分开写', textEn: 'Separate facts from interpretation' },
      {
        type: 'paragraph',
        text: '这是我认为最重要的一步。“对方三天没有回复”是事实，“对方已经不在乎我”是解释。日志里把两者分开，会让你看见牌面究竟帮助了观察，还是只是强化了焦虑。',
        textEn: 'This is the most important step for me. “They have not replied for three days” is a fact. “They no longer care” is an interpretation. Separating them reveals whether the cards supported observation or amplified anxiety.',
      },
      {
        type: 'quote',
        text: '复盘不是验证塔罗有没有预测准确，而是验证这次阅读有没有帮助你更诚实地看见处境。',
        textEn: 'Review is not about proving a prediction. It asks whether the reading helped you see the situation more honestly.',
      },
      { type: 'heading', id: 'protect-privacy', text: '记录他人案例时先保护隐私', textEn: 'Protect privacy in case notes' },
      {
        type: 'paragraph',
        text: '如果日志涉及咨询对象，我不会保留真实姓名、联系方式、单位或原始聊天截图。需要交流案例时，只留下理解牌面所必需的背景，并再次检查组合信息是否仍能识别当事人。',
        textEn: 'When notes involve a client, I do not keep real names, contact details, workplaces, or original chat screenshots. For case discussion, I retain only context necessary to understand the cards and check whether combined details could still identify the person.',
      },
      {
        type: 'callout',
        title: '我的回访节奏',
        titleEn: 'My follow-up rhythm',
        text: '日常情绪在 3 天后回看，短期选择在 2 周后回看，关系和职业议题在 1 至 3 个月后回看。时间要和问题尺度匹配。',
        textEn: 'I revisit daily emotions after three days, short decisions after two weeks, and relationship or career questions after one to three months. Match the review interval to the scale of the question.',
      },
    ],
    relatedRoutes: [
      { to: '/history', label: '查看你的占卜记录', labelEn: 'Review your reading history', description: '登录后回看问题、牌面与结果。', descriptionEn: 'Revisit questions, cards, and results after signing in.' },
      { to: '/daily-fortune', label: '从每日一张开始记录', labelEn: 'Start with one daily card', description: '用更轻的节奏建立观察习惯。', descriptionEn: 'Build an observation habit at a lighter pace.' },
    ],
  },
]

export function getBlogPost(slug: string): BlogPost | undefined {
  return blogPosts.find((post) => post.slug === slug)
}

export function getBlogAuthor(slug: string): BlogAuthor | undefined {
  return blogAuthors.find((author) => author.slug === slug)
}
