USE tarot_qa;

-- 首页 /tarot 推荐热门塔罗师位：独立表，便于后续扩展限时推荐、推荐文案等
CREATE TABLE IF NOT EXISTS featured_readers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  reader_code VARCHAR(32) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_featured_reader_code (reader_code),
  CONSTRAINT fk_featured_reader_code
    FOREIGN KEY (reader_code) REFERENCES reference_tarot_readers(code)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
