USE tarot_qa;

-- 塔罗师后台：展示名、头像、默认 emoji、免费/VIP（NULL 表示沿用静态默认）
ALTER TABLE reader_prompts_config
  ADD COLUMN display_name VARCHAR(100) NULL AFTER reader_code,
  ADD COLUMN avatar_url VARCHAR(255) NULL AFTER display_name,
  ADD COLUMN emoji VARCHAR(32) NULL AFTER avatar_url,
  ADD COLUMN access_level ENUM('free','vip') NULL AFTER emoji;
