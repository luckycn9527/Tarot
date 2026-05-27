-- 命运双盘：八字侧写 + 塔罗三牌 + 冲突与分支存档
-- 库名由连接/脚本指定；也可手动：mysql -u root -p your_db < 013_fate_dual_engine.sql
-- 推荐：cd tarot-server && npm run migrate:fate-dual

SET @c := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'birth_time'
);
SET @sql := IF(@c = 0,
  'ALTER TABLE users ADD COLUMN birth_time TIME NULL COMMENT ''出生时刻（可选）'' AFTER birthday',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS bazi_results (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  birth_date DATE NOT NULL,
  birth_time TIME NULL,
  five_elements_json JSON NULL,
  luck_trend VARCHAR(100) NULL,
  keywords VARCHAR(255) NULL,
  analysis_text MEDIUMTEXT NOT NULL,
  question VARCHAR(500) NOT NULL,
  category VARCHAR(32) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_bazi_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_bazi_user_created (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tarot_results (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  card_1 VARCHAR(80) NOT NULL,
  card_2 VARCHAR(80) NOT NULL,
  card_3 VARCHAR(80) NOT NULL,
  card_1_en VARCHAR(80) NULL,
  card_2_en VARCHAR(80) NULL,
  card_3_en VARCHAR(80) NULL,
  orient_1 VARCHAR(16) NOT NULL DEFAULT 'upright',
  orient_2 VARCHAR(16) NOT NULL DEFAULT 'upright',
  orient_3 VARCHAR(16) NOT NULL DEFAULT 'upright',
  positions VARCHAR(80) NOT NULL DEFAULT '过去,现在,未来',
  meaning_text MEDIUMTEXT NOT NULL,
  question VARCHAR(500) NOT NULL,
  category VARCHAR(32) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_fate_tarot_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_fate_tarot_user_created (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS fate_conflicts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  bazi_id BIGINT UNSIGNED NOT NULL,
  tarot_id BIGINT UNSIGNED NOT NULL,
  conflict_type VARCHAR(32) NOT NULL,
  conflict_level VARCHAR(32) NULL,
  summary_text TEXT NOT NULL,
  path_stable_text MEDIUMTEXT NOT NULL COMMENT '顺命/稳定路径',
  path_adventure_text MEDIUMTEXT NOT NULL COMMENT '随心/冒险路径',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_fc_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_fc_bazi FOREIGN KEY (bazi_id) REFERENCES bazi_results(id) ON DELETE CASCADE,
  CONSTRAINT fk_fc_tarot FOREIGN KEY (tarot_id) REFERENCES tarot_results(id) ON DELETE CASCADE,
  INDEX idx_fc_user_created (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS fate_choices (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  conflict_id BIGINT UNSIGNED NOT NULL,
  choice_type VARCHAR(16) NOT NULL COMMENT 'stable=相信命 adventure=相信心',
  result_path_text MEDIUMTEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_fch_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_fch_conflict FOREIGN KEY (conflict_id) REFERENCES fate_conflicts(id) ON DELETE CASCADE,
  UNIQUE KEY uk_conflict_choice (conflict_id),
  INDEX idx_fch_user_created (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
