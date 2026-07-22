-- Cache generated choice guidance so an existing fate choice never calls the AI again.
SET @column_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fate_choices' AND COLUMN_NAME = 'guidance_json'
);
SET @sql := IF(
  @column_exists = 0,
  'ALTER TABLE fate_choices ADD COLUMN guidance_json JSON NULL AFTER result_path_text',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
