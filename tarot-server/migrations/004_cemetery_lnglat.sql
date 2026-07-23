-- 004: 墓园坐标与墓碑基础表。
-- 这是缺失的 003/004 历史迁移的合并基线；005 会继续规范化牌卡字段并添加参考表外键。

CREATE TABLE IF NOT EXISTS tombstones (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  longitude DECIMAL(6,2) NOT NULL COMMENT '经度 -180.00 ~ 180.00',
  latitude DECIMAL(5,2) NOT NULL COMMENT '纬度 -90.00 ~ 90.00',
  tombstone_style VARCHAR(20) NOT NULL DEFAULT 'cross',
  display_name VARCHAR(50) NOT NULL,
  epitaph VARCHAR(200) NULL COMMENT '墓志铭',
  tarot_card_id INT NULL COMMENT '占卜用塔罗牌ID 0-77',
  hexagram_id INT NULL COMMENT '周易卦象ID 1-64',
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  view_count INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_tombstones_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uk_user (user_id),
  UNIQUE KEY uk_position (longitude, latitude)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
