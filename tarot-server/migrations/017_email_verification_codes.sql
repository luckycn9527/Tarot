-- 邮箱验证码表：用于注册、找回密码等场景
CREATE TABLE IF NOT EXISTS email_verification_codes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  code VARCHAR(10) NOT NULL,
  purpose ENUM('register') NOT NULL DEFAULT 'register',
  expires_at DATETIME NOT NULL,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_email_purpose (email, purpose),
  INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
