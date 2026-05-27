-- Google 登录允许无本地密码；头像可存 URL；密码重置令牌表
-- mysql -u ... -p tarot_qa < migrations/014_auth_google_password_reset.sql

USE tarot_qa;

-- 允许仅 OAuth 用户 password_hash 为空
ALTER TABLE users
  MODIFY COLUMN password_hash VARCHAR(255) NULL COMMENT 'NULL 表示仅第三方登录（如 Google）',
  MODIFY COLUMN avatar VARCHAR(500) NULL DEFAULT '🔮' COMMENT 'emoji 或站内/外链头像 URL';

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL COMMENT 'SHA-256 hex',
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_token_hash (token_hash),
  INDEX idx_user_created (user_id, created_at),
  CONSTRAINT fk_prt_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
