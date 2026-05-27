USE tarot_qa;

SET FOREIGN_KEY_CHECKS = 0;

-- ================================================================
-- 牌背系统 v2
--   - 去除渐变/emoji 列
--   - 新增 access_type (free/vip/paid) + price + description
--   - 新增 user_card_backs 中间表（用户 × 牌背 多对多，付费解锁记录）
-- ================================================================

-- 1. card_backs: 新增列
ALTER TABLE card_backs
  ADD COLUMN description VARCHAR(255) NULL AFTER name,
  ADD COLUMN access_type ENUM('free','vip','paid') NOT NULL DEFAULT 'free' AFTER is_active,
  ADD COLUMN price DECIMAL(10,2) UNSIGNED NULL AFTER access_type;

-- 2. 插入默认牌背（先插后删，避免 FK SET NULL 后找不到替代）
INSERT INTO card_backs (code, name, description, asset_url, is_active, sort_order, access_type)
VALUES ('pocket', '经典牌背', '简约经典的塔罗牌背面设计', '/uploads/card-backs/pocket.png', 1, 1, 'free')
ON DUPLICATE KEY UPDATE
  name        = VALUES(name),
  description = VALUES(description),
  asset_url   = VALUES(asset_url),
  is_active   = VALUES(is_active),
  sort_order  = VALUES(sort_order),
  access_type = VALUES(access_type);

-- 3. 将引用旧渐变牌背的 user_settings 指向新的 pocket 牌背
UPDATE user_settings
SET card_back_id = (SELECT id FROM card_backs WHERE code = 'pocket' LIMIT 1)
WHERE card_back_id IN (SELECT id FROM card_backs WHERE asset_url IS NULL);

-- 同时修复所有 NULL 引用
UPDATE user_settings
SET card_back_id = (SELECT id FROM card_backs WHERE code = 'pocket' LIMIT 1)
WHERE card_back_id IS NULL;

-- 4. 删除没有实际图片的旧渐变牌背
DELETE FROM card_backs WHERE asset_url IS NULL;

-- 5. 删除冗余列
ALTER TABLE card_backs
  DROP COLUMN preview_gradient,
  DROP COLUMN preview_emoji;

-- 6. 创建中间表：用户已购买/解锁的付费牌背（多对多）
CREATE TABLE IF NOT EXISTS user_card_backs (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id      BIGINT UNSIGNED NOT NULL,
  card_back_id BIGINT UNSIGNED NOT NULL,
  purchased_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_ucb_user      FOREIGN KEY (user_id)      REFERENCES users(id)      ON DELETE CASCADE,
  CONSTRAINT fk_ucb_card_back FOREIGN KEY (card_back_id)  REFERENCES card_backs(id) ON DELETE CASCADE,

  UNIQUE KEY uk_user_card_back (user_id, card_back_id),
  INDEX idx_ucb_user      (user_id),
  INDEX idx_ucb_card_back (card_back_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
