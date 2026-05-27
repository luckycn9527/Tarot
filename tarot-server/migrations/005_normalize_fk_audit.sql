-- 005: 规范化「牌面关联」为子表 + 参考表外键 + 全表审计字段
-- 前置: 已执行 001_init, 002_reader_reading, 004_cemetery_lnglat（003 可被 004 替代）
-- 执行: mysql -u root -p tarot_qa < migrations/005_normalize_fk_audit.sql

USE tarot_qa;

SET FOREIGN_KEY_CHECKS = 0;

-- ========== 参考表：塔罗牌 ID（0–77）==========
CREATE TABLE IF NOT EXISTS reference_tarot_cards (
  id SMALLINT UNSIGNED NOT NULL PRIMARY KEY,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO reference_tarot_cards (id)
SELECT seq.n FROM (
  SELECT a.N + b.N * 10 + c.N * 100 AS n FROM
  (SELECT 0 AS N UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) a,
  (SELECT 0 AS N UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) b,
  (SELECT 0 AS N UNION SELECT 1) c
) seq WHERE seq.n BETWEEN 0 AND 77;

-- ========== 参考表：周易卦 1–64 ==========
CREATE TABLE IF NOT EXISTS reference_hexagrams (
  id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO reference_hexagrams (id)
SELECT seq.n FROM (
  SELECT a.N + b.N * 10 AS n FROM
  (SELECT 0 AS N UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) a,
  (SELECT 0 AS N UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7) b
) seq WHERE seq.n BETWEEN 1 AND 64;

-- ========== 参考表：塔罗师（字符串 code → 外键）==========
CREATE TABLE IF NOT EXISTS reference_tarot_readers (
  id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(32) NOT NULL,
  display_name VARCHAR(64) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uk_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO reference_tarot_readers (code, display_name) VALUES
  ('moyi', '茉伊'),
  ('duya', '渡鸦'),
  ('linyao', '林曜'),
  ('sujin', '苏谨'),
  ('yuexi', '月熙'),
  ('vincent', '文森特');

-- ========== 参考表：牌阵 code ==========
CREATE TABLE IF NOT EXISTS reference_spreads (
  id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(64) NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uk_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO reference_spreads (code, display_name) VALUES
  ('single', '单牌占卜'),
  ('timeline', '时间流牌阵'),
  ('problem', '问题解决牌阵'),
  ('diamond', '钻石牌阵'),
  ('core', '直指核心牌阵'),
  ('x-chance', 'X字机会牌阵'),
  ('celtic-cross', '凯尔特十字牌阵'),
  ('hexagram', '六芒星牌阵'),
  ('love-cross', '爱情十字牌阵'),
  ('future-lover', '未来恋人牌阵'),
  ('mirror', '灵感对应牌阵'),
  ('venus', '爱神维纳斯牌阵'),
  ('love-repair', '情感修复牌阵'),
  ('daily', '日运牌阵'),
  ('monthly', '月运牌阵'),
  ('future-dev', '未来发展牌阵'),
  ('mind-body', '身心灵牌阵'),
  ('four-elements', '四元素牌阵'),
  ('self-explore', '自我探索牌阵'),
  ('self-break', '自我突破牌阵'),
  ('career', '事业金字塔牌阵'),
  ('wealth-tree', '财富树牌阵'),
  ('interview', '面试求职牌阵'),
  ('two-choice', '二选一牌阵'),
  ('yes-no', '是否牌阵');

-- ========== 占卜记录 — 每张牌一行（禁止在列内存 JSON 牌 ID 列表）==========
CREATE TABLE IF NOT EXISTS reading_history_cards (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  reading_id BIGINT UNSIGNED NOT NULL,
  position_order TINYINT UNSIGNED NOT NULL COMMENT '从 1 开始，对应牌阵顺位',
  card_id SMALLINT UNSIGNED NOT NULL,
  orientation VARCHAR(20) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uk_reading_position (reading_id, position_order),
  KEY idx_reading (reading_id),
  CONSTRAINT fk_rhc_reading FOREIGN KEY (reading_id) REFERENCES reading_history(id) ON DELETE CASCADE,
  CONSTRAINT fk_rhc_card FOREIGN KEY (card_id) REFERENCES reference_tarot_cards(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 从旧 JSON 列迁移到子表（在删除列之前执行）
INSERT INTO reading_history_cards (reading_id, position_order, card_id, orientation)
SELECT
  rh.id,
  seq.n AS position_order,
  CAST(JSON_UNQUOTE(JSON_EXTRACT(rh.card_ids, CONCAT('$[', seq.n - 1, ']'))) AS UNSIGNED) AS card_id,
  LEFT(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(rh.orientations, CONCAT('$[', seq.n - 1, ']'))), 'upright'), 20) AS orientation
FROM reading_history rh
INNER JOIN (
  SELECT 1 AS n UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5
  UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9 UNION SELECT 10
  UNION SELECT 11 UNION SELECT 12 UNION SELECT 13 UNION SELECT 14 UNION SELECT 15
) seq ON seq.n <= LEAST(JSON_LENGTH(rh.card_ids), JSON_LENGTH(rh.orientations));

-- 删除旧 JSON 列
ALTER TABLE reading_history
  DROP COLUMN card_ids,
  DROP COLUMN orientations;

-- reader_id 字符串 → 外键 reader_ref_id
ALTER TABLE reading_history
  ADD COLUMN reader_ref_id SMALLINT UNSIGNED NULL AFTER answer;

UPDATE reading_history rh
INNER JOIN reference_tarot_readers rr ON rh.reader_id = rr.code
SET rh.reader_ref_id = rr.id
WHERE rh.reader_id IS NOT NULL AND rh.reader_id <> '';

ALTER TABLE reading_history DROP COLUMN reader_id;

-- spread_type 字符串 → spread_id
ALTER TABLE reading_history
  ADD COLUMN spread_id SMALLINT UNSIGNED NULL AFTER reader_ref_id;

UPDATE reading_history rh
INNER JOIN reference_spreads rs ON rh.spread_type = rs.code
SET rh.spread_id = rs.id
WHERE rh.spread_type IS NOT NULL AND rh.spread_type <> '';

ALTER TABLE reading_history DROP COLUMN spread_type;

-- reading_history 审计字段
ALTER TABLE reading_history
  ADD COLUMN updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3);

ALTER TABLE reading_history
  ADD CONSTRAINT fk_rh_reader FOREIGN KEY (reader_ref_id) REFERENCES reference_tarot_readers(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_rh_spread FOREIGN KEY (spread_id) REFERENCES reference_spreads(id) ON DELETE SET NULL;

-- ========== tombstones：类型与参考表一致后再加外键 ==========
ALTER TABLE tombstones
  MODIFY COLUMN tarot_card_id SMALLINT UNSIGNED NULL COMMENT '占卜用塔罗牌ID 0-77',
  MODIFY COLUMN hexagram_id TINYINT UNSIGNED NULL COMMENT '周易卦象ID 1-64';

ALTER TABLE tombstones
  ADD CONSTRAINT fk_tombstone_tarot FOREIGN KEY (tarot_card_id) REFERENCES reference_tarot_cards(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_tombstone_hex FOREIGN KEY (hexagram_id) REFERENCES reference_hexagrams(id) ON DELETE SET NULL;

-- ========== daily_fortune_cache：card_id 与 reference 类型一致 + 审计 + 外键 ==========
ALTER TABLE daily_fortune_cache
  MODIFY COLUMN card_id SMALLINT UNSIGNED NOT NULL,
  ADD COLUMN updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) AFTER created_at;

ALTER TABLE daily_fortune_cache
  ADD CONSTRAINT fk_dfc_card FOREIGN KEY (card_id) REFERENCES reference_tarot_cards(id) ON DELETE RESTRICT;

-- ========== refresh_tokens 审计 ==========
ALTER TABLE refresh_tokens
  ADD COLUMN updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) AFTER created_at;

-- ========== invitation_codes ==========
ALTER TABLE invitation_codes
  ADD COLUMN updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) AFTER created_at;

-- ========== invitation_redemptions ==========
ALTER TABLE invitation_redemptions
  ADD COLUMN updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) AFTER created_at;

-- ========== user_shares ==========
ALTER TABLE user_shares
  ADD COLUMN updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) AFTER created_at;

-- ========== user_settings：补 created_at ==========
ALTER TABLE user_settings
  ADD COLUMN created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) AFTER user_id;

-- ========== feedback：类型补全 suggestion ==========
ALTER TABLE feedback
  MODIFY COLUMN type ENUM('bug','feature','complaint','other','suggestion') NOT NULL DEFAULT 'other';

SET FOREIGN_KEY_CHECKS = 1;
