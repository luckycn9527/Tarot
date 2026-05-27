USE tarot_qa;

SET FOREIGN_KEY_CHECKS = 0;

-- ========== card_backs 增加渐变和 emoji 列 ==========
ALTER TABLE card_backs
  ADD COLUMN preview_gradient VARCHAR(100) NULL AFTER asset_url,
  ADD COLUMN preview_emoji VARCHAR(20) NULL AFTER preview_gradient;

-- 更新/插入完整的 6 个牌背样式
INSERT INTO card_backs (code, name, asset_url, preview_gradient, preview_emoji, is_active, sort_order) VALUES
  ('classic',  '经典紫',  NULL, 'from-purple-900 to-indigo-900',   '✨', 1, 1),
  ('midnight', '午夜蓝',  NULL, 'from-blue-900 to-slate-900',      '🌙', 1, 2),
  ('ruby',     '红宝石',  NULL, 'from-red-900 to-rose-900',        '💎', 1, 3),
  ('emerald',  '翡翠绿',  NULL, 'from-emerald-900 to-teal-900',    '🍀', 1, 4),
  ('gold',     '黄金',    NULL, 'from-amber-800 to-yellow-900',    '⭐', 1, 5),
  ('cosmic',   '宇宙',    NULL, 'from-violet-900 to-fuchsia-900',  '🌌', 1, 6)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  preview_gradient = VALUES(preview_gradient),
  preview_emoji = VALUES(preview_emoji),
  sort_order = VALUES(sort_order);

-- ========== user_settings：card_back -> card_back_id FK ==========
ALTER TABLE user_settings
  ADD COLUMN card_back_id BIGINT UNSIGNED NULL AFTER card_back;

UPDATE user_settings us
  JOIN card_backs cb ON us.card_back = cb.code
  SET us.card_back_id = cb.id
  WHERE us.card_back IS NOT NULL;

ALTER TABLE user_settings DROP COLUMN card_back;

ALTER TABLE user_settings
  ADD CONSTRAINT fk_user_settings_card_back
    FOREIGN KEY (card_back_id) REFERENCES card_backs(id) ON DELETE SET NULL;

SET FOREIGN_KEY_CHECKS = 1;
