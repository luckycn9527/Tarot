-- TarotQA Database Schema
-- Execute: mysql -u root -p < migrations/001_init.sql

CREATE DATABASE IF NOT EXISTS tarot_qa CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE tarot_qa;

-- 1. users (核心用户表)
CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  nickname VARCHAR(50) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  avatar VARCHAR(50) DEFAULT '🔮',
  gender ENUM('male','female','other','unset') DEFAULT 'unset',
  birthday DATE NULL,
  zodiac_sign VARCHAR(10) NULL,
  location VARCHAR(255) NULL,
  bio TEXT NULL,
  membership ENUM('free','vip') DEFAULT 'free',
  membership_expires_at DATETIME NULL,
  remaining_free_quota INT DEFAULT 3,
  quota_reset_date DATE NULL,
  google_id VARCHAR(255) NULL UNIQUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_google_id (google_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. refresh_tokens (刷新令牌)
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  token VARCHAR(500) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_token (token),
  INDEX idx_user_id (user_id),
  INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. reading_history (占卜历史)
CREATE TABLE IF NOT EXISTS reading_history (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  type ENUM('single','three-card','daily-fortune') NOT NULL,
  question VARCHAR(500) NULL,
  card_ids JSON NOT NULL,
  orientations JSON NOT NULL,
  answer VARCHAR(50) NULL,
  result_data JSON NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_type (type),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. daily_fortune_cache (每日运势缓存)
CREATE TABLE IF NOT EXISTS daily_fortune_cache (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  fortune_date DATE NOT NULL,
  card_id INT NOT NULL,
  orientation VARCHAR(10) NOT NULL DEFAULT 'upright',
  result_data JSON NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uk_user_date (user_id, fortune_date),
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. invitation_codes (邀请码)
CREATE TABLE IF NOT EXISTS invitation_codes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  type ENUM('quota','vip_days') NOT NULL DEFAULT 'quota',
  value INT NOT NULL DEFAULT 3,
  max_uses INT NOT NULL DEFAULT 1,
  used_count INT NOT NULL DEFAULT 0,
  expires_at DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. invitation_redemptions (邀请码兑换记录)
CREATE TABLE IF NOT EXISTS invitation_redemptions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (code_id) REFERENCES invitation_codes(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uk_code_user (code_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. user_shares (用户分享)
CREATE TABLE IF NOT EXISTS user_shares (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  reading_id BIGINT UNSIGNED NOT NULL,
  share_code VARCHAR(32) NOT NULL UNIQUE,
  view_count INT NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (reading_id) REFERENCES reading_history(id) ON DELETE CASCADE,
  INDEX idx_share_code (share_code),
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. user_settings (用户设置)
CREATE TABLE IF NOT EXISTS user_settings (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL UNIQUE,
  card_back VARCHAR(50) DEFAULT 'classic',
  settings_json JSON NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. feedback (意见反馈)
CREATE TABLE IF NOT EXISTS feedback (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NULL,
  type ENUM('bug','feature','complaint','other') NOT NULL DEFAULT 'other',
  content TEXT NOT NULL,
  contact VARCHAR(255) NULL,
  status ENUM('pending','processing','resolved','closed') DEFAULT 'pending',
  admin_reply TEXT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_user_id (user_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
