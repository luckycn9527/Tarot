-- Access Token 吊销支持
-- 在 users 表增加 access_token_revoked_at，用于使该时间之前签发的所有 access token 失效

ALTER TABLE users ADD COLUMN IF NOT EXISTS access_token_revoked_at DATETIME NULL AFTER membership_expires_at;
