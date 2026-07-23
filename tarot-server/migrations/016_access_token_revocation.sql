-- Access Token 吊销支持
-- 在 users 表增加 access_token_revoked_at，用于使该时间之前签发的所有 access token 失效

SET @has_access_token_revoked_at = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'access_token_revoked_at'
);
SET @add_access_token_revoked_at = IF(
  @has_access_token_revoked_at = 0,
  'ALTER TABLE users ADD COLUMN access_token_revoked_at DATETIME NULL AFTER membership_expires_at',
  'SELECT 1'
);
PREPARE add_access_token_revoked_at_stmt FROM @add_access_token_revoked_at;
EXECUTE add_access_token_revoked_at_stmt;
DEALLOCATE PREPARE add_access_token_revoked_at_stmt;
