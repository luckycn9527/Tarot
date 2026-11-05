-- Track successful sign-ins; historical users deliberately remain NULL.
SET @has_login_column = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'last_login_at');
SET @login_column_sql = IF(@has_login_column = 0,
  'ALTER TABLE users ADD COLUMN last_login_at DATETIME(3) NULL', 'SELECT 1');
PREPARE login_column_stmt FROM @login_column_sql;
EXECUTE login_column_stmt;
DEALLOCATE PREPARE login_column_stmt;

SET @has_login_index = (SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND INDEX_NAME = 'idx_users_last_login');
SET @login_index_sql = IF(@has_login_index = 0,
  'ALTER TABLE users ADD INDEX idx_users_last_login (last_login_at, id), ALGORITHM=INPLACE, LOCK=NONE', 'SELECT 1');
PREPARE login_index_stmt FROM @login_index_sql;
EXECUTE login_index_stmt;
DEALLOCATE PREPARE login_index_stmt;

SET @has_question_index = (SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reading_history' AND INDEX_NAME = 'idx_rh_user_created');
SET @question_index_sql = IF(@has_question_index = 0,
  'ALTER TABLE reading_history ADD INDEX idx_rh_user_created (user_id, created_at, id), ALGORITHM=INPLACE, LOCK=NONE', 'SELECT 1');
PREPARE question_index_stmt FROM @question_index_sql;
EXECUTE question_index_stmt;
DEALLOCATE PREPARE question_index_stmt;
