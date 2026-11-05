-- Keep Fate Dual choice closings and guidance isolated by language.
SET @locale_column_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fate_choices' AND COLUMN_NAME = 'locale'
);
SET @sql := IF(
  @locale_column_exists = 0,
  'ALTER TABLE fate_choices ADD COLUMN locale VARCHAR(10) NOT NULL DEFAULT ''zh-CN'' AFTER guidance_json',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @locale_unique_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fate_choices' AND INDEX_NAME = 'uk_conflict_choice_locale'
);
SET @sql := IF(
  @locale_unique_exists = 0,
  'ALTER TABLE fate_choices ADD UNIQUE KEY uk_conflict_choice_locale (conflict_id, locale)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @old_unique_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fate_choices' AND INDEX_NAME = 'uk_conflict_choice'
);
SET @sql := IF(
  @old_unique_exists > 0,
  'ALTER TABLE fate_choices DROP INDEX uk_conflict_choice',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
