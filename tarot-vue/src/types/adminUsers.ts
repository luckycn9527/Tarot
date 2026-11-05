export interface AdminQuestionSummary {
  id: number
  source: 'reading' | 'fate'
  type: string
  question: string
  askedAt: string
}

export interface AdminUserRow {
  [key: string]: unknown
  id: number
  email: string
  username?: string | null
  nickname: string
  last_login_at: string | null
  latestQuestion: AdminQuestionSummary | null
}

export interface AdminUserQuestion extends AdminQuestionSummary {
  followups: { question: string; askedAt: string | null }[]
}
