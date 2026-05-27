-- 003_cemetery.sql
-- 电子陵墓 (Cyber Cemetery) 功能 - tombstones 表

CREATE TABLE IF NOT EXISTS tombstones (
  id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id        BIGINT UNSIGNED NOT NULL,
  pixel_x        SMALLINT UNSIGNED NOT NULL     COMMENT '地图X坐标 0-359',
  pixel_y        SMALLINT UNSIGNED NOT NULL     COMMENT '地图Y坐标 0-179',
  tombstone_style VARCHAR(20) NOT NULL DEFAULT 'cross',
  display_name   VARCHAR(50) NOT NULL,
  epitaph        VARCHAR(200) NULL              COMMENT '墓志铭',
  tarot_card_id  SMALLINT NULL                  COMMENT '占卜用塔罗牌ID 0-77',
  hexagram_id    TINYINT UNSIGNED NULL           COMMENT '周易卦象ID 1-64',
  is_public      TINYINT(1) NOT NULL DEFAULT 1,
  view_count     INT UNSIGNED NOT NULL DEFAULT 0,
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uk_user (user_id),
  UNIQUE KEY uk_position (pixel_x, pixel_y)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 运行命令:
-- mysql -u root -p tarot_db < migrations/003_cemetery.sql
