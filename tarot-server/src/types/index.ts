export interface DbUser {
  id: number;
  email: string;
  /** 登录用户名（可选，唯一）；历史与仅邮箱/OAuth 用户可为 null */
  username: string | null;
  /** 手机号（可选，唯一），手机号登录预留 */
  phone: string | null;
  nickname: string;
  /** 仅 Google 等 OAuth 注册时可为 null */
  password_hash: string | null;
  avatar: string | null;
  gender: 'male' | 'female' | 'other' | 'unset';
  birthday: string | null;
  zodiac_sign: string | null;
  location: string | null;
  bio: string | null;
  membership: 'free' | 'vip';
  membership_expires_at: string | null;
  remaining_free_quota: number;
  quota_reset_date: string | null;
  google_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PublicUser {
  id: number;
  email: string;
  /** 登录用户名（可选） */
  username: string | null;
  nickname: string;
  /** 可能为 emoji、站内路径或外链 */
  avatar: string;
  gender: string;
  birthday: string | null;
  zodiacSign: string | null;
  location: string | null;
  bio: string | null;
  membership: string;
  membershipExpiresAt: string | null;
  remainingFreeQuota: number;
  createdAt: string;
}

/** 数据库 reading_history 行（牌面在 reading_history_cards 子表） */
export interface ReadingHistory {
  id: number;
  user_id: number;
  type: 'single' | 'three-card' | 'daily-fortune' | 'reader-reading';
  question: string | null;
  answer: string | null;
  result_data: string;
  reader_ref_id: number | null;
  spread_id: number | null;
  created_at: string;
  updated_at: string;
}
