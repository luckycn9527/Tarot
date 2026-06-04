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

-- 2) 写入 4 款原创牌背 (覆盖式 upsert)
INSERT INTO card_backs (code, name, description, asset_url, is_active, sort_order, access_type) VALUES
  ('celestial', '星轨',     '深紫金调 · 星轨环绕罗盘',   '/uploads/card-backs/celestial.svg', 1, 1, 'free'),
  ('lunar',     '月相',     '靛蓝银调 · 八相月轮',       '/uploads/card-backs/lunar.svg',     1, 2, 'free'),
  ('sacred',    '生命之花', '翡翠金调 · 神圣几何',       '/uploads/card-backs/sacred.svg',    1, 3, 'free'),
  ('rose',      '玫瑰十字', '暗红金调 · 经典玫瑰十字',   '/uploads/card-backs/rose.svg',      1, 4, 'free')
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  description = VALUES(description),
  asset_url = VALUES(asset_url),
  is_active = 1,
  sort_order = VALUES(sort_order),
  access_type = VALUES(access_type);
