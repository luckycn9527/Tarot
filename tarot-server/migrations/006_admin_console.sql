USE tarot_qa;

-- 管理员账号：用户名仅存哈希，密码存 bcrypt hash
CREATE TABLE IF NOT EXISTS admin_users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username_hash CHAR(64) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(64) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  last_login_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_admin_username_hash (username_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 管理端可配置：牌背
CREATE TABLE IF NOT EXISTS card_backs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  asset_url VARCHAR(255) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_card_back_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 管理端可配置：卡面信息（避免以 JSON/逗号串存关联 ID）
CREATE TABLE IF NOT EXISTS tarot_cards_config (
  id SMALLINT UNSIGNED NOT NULL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  name_en VARCHAR(100) NOT NULL,
  upright_keywords VARCHAR(255) NOT NULL,
  reversed_keywords VARCHAR(255) NOT NULL,
  yes_no_tendency ENUM('yes','no','neutral') NOT NULL DEFAULT 'neutral',
  image_url VARCHAR(255) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_tarot_cards_config_ref FOREIGN KEY (id) REFERENCES reference_tarot_cards(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 管理端可配置：塔罗师提示词（1:1）
CREATE TABLE IF NOT EXISTS reader_prompts_config (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  reader_code VARCHAR(32) NOT NULL,
  system_prompt TEXT NOT NULL,
  greeting TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_reader_prompts_code (reader_code),
  CONSTRAINT fk_reader_prompts_code FOREIGN KEY (reader_code) REFERENCES reference_tarot_readers(code) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 默认牌背
INSERT IGNORE INTO card_backs (code, name, asset_url, is_active, sort_order) VALUES
('classic', '经典牌背', NULL, 1, 1),
('mystic', '神秘牌背', NULL, 1, 2),
('cosmic', '星云牌背', NULL, 1, 3);
