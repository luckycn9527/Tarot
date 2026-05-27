-- 010: 与 src/data/readers.ts 对齐 reference_tarot_readers（reader_prompts_config 外键依赖）
-- 执行: mysql -u root -p tarot_qa < migrations/010_sync_reference_tarot_readers.sql

USE tarot_qa;

INSERT IGNORE INTO reference_tarot_readers (code, display_name) VALUES
  ('qinghe', '清和'),
  ('yanxi', '岩溪'),
  ('haruka', '遥'),
  ('xuanyin', '玄引'),
  ('mirelle', '米蕾'),
  ('lingsha', '灵砂'),
  ('norick', '诺里克'),
  ('amara', '阿玛拉'),
  ('vikram', '维克拉姆'),
  ('catalina', '卡塔琳娜'),
  ('kazuki', '和树'),
  ('solveig', '索尔维格');
