-- 004_cemetery_lnglat.sql
-- 赛博陵墓坐标系迁移: 像素坐标 → 经纬度 (MapLibre GL JS)
-- 全新开始，无需保留现有数据

DROP TABLE IF EXISTS tombstones;

CREATE TABLE tombstones (
  id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id        BIGINT UNSIGNED NOT NULL,
  longitude      DECIMAL(6,2) NOT NULL          COMMENT '经度 -180.00 ~ 180.00',
  latitude       DECIMAL(5,2) NOT NULL          COMMENT '纬度 -90.00 ~ 90.00',
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
  UNIQUE KEY uk_position (longitude, latitude)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 运行命令:
-- mysql -u root -p123456 tarot_qa < migrations/004_cemetery_lnglat.sql
