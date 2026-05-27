-- 012: 将主要文本表统一为 utf8mb4，修复历史 latin1/错误连接字符集导致的乱码（执行后已乱码的数据需人工改回或从备份恢复）
-- mysql -u root -p tarot_qa < migrations/012_utf8mb4_text_tables.sql

USE tarot_qa;

ALTER TABLE card_backs CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE reader_prompts_config CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE tarot_cards_config CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE users CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE feedback CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
