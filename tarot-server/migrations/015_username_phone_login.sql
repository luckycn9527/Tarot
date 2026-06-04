-- 015_username_phone_login.sql
-- 为用户表增加「用户名」与「手机号」两个可选登录标识
--   username：注册时可填，登录支持「用户名或邮箱 + 密码」
--   phone   ：为后续「手机号登录」预留字段（当前接口为占位）
-- 幂等：迁移运行器会跳过已执行项；列已存在时本文件失败也会被记录后跳过
-- mysql -u ... -p tarot_qa < migrations/015_username_phone_login.sql

USE tarot_qa;

-- username：唯一但允许 NULL（历史用户、仅邮箱/Google 用户可为空）
ALTER TABLE users
  ADD COLUMN username VARCHAR(50) NULL UNIQUE COMMENT '登录用户名（可选，唯一）' AFTER email;

-- phone：唯一但允许 NULL，为手机号登录预留
ALTER TABLE users
  ADD COLUMN phone VARCHAR(20) NULL UNIQUE COMMENT '手机号（可选，唯一，预留登录用）' AFTER username;
-- 说明：UNIQUE 约束已自带索引，无需再额外 CREATE INDEX。
