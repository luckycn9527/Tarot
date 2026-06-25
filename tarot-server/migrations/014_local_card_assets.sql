-- ================================================================
-- 014_local_card_assets.sql
-- 将牌面图片改为本地托管 (uploads/cards/*.jpg, 公有领域 RWS 牌面)，
-- 并写入 4 款原创牌背 (uploads/card-backs/*.svg)。
--
-- 背景: 原 cdn.tarotqa.com 证书过期导致牌面无法显示。
-- tarot_cards_config.image_url 为空时前端会回退到 CDN_BASE，
-- 现 CDN_BASE 已改为 /uploads/cards，且此处显式写入每张牌的本地路径。
-- ================================================================

USE tarot_qa;

-- 1) 确保 78 张牌的 config 行存在 (引用 reference_tarot_cards 0-77)
--    若 tarot_cards_config 已由 seedAdminConfig 填充则只更新 image_url。

-- 大阿卡纳 + 小阿卡纳的 image_url 按 name_en 规范化文件名写入。
-- 文件名规则: name_en 中空格替换为下划线 + .jpg
UPDATE tarot_cards_config
SET image_url = CONCAT('/uploads/cards/', REPLACE(name_en, ' ', '_'), '.jpg')
WHERE name_en IS NOT NULL AND name_en <> '';

-- 2) 仅保留经典牌背 pocket，禁用其他牌背
INSERT INTO card_backs (code, name, description, asset_url, is_active, sort_order, access_type) VALUES
  ('pocket', '经典牌背', '简约经典的塔罗牌背面设计', '/uploads/card-backs/pocket.png', 1, 1, 'free')
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  description = VALUES(description),
  asset_url = VALUES(asset_url),
  is_active = 1,
  sort_order = VALUES(sort_order),
  access_type = VALUES(access_type);

UPDATE card_backs SET is_active = 0 WHERE code != 'pocket';
