-- 命运双盘：记录出生地、性别、真太阳时校正和程序排出的四柱

ALTER TABLE bazi_results
  ADD COLUMN birth_place VARCHAR(120) NULL AFTER birth_time,
  ADD COLUMN gender ENUM('male','female') NULL AFTER birth_place,
  ADD COLUMN solar_correction TINYINT(1) NOT NULL DEFAULT 0 AFTER gender,
  ADD COLUMN birth_longitude DECIMAL(8,4) NULL AFTER solar_correction,
  ADD COLUMN corrected_birth_date DATE NULL AFTER birth_longitude,
  ADD COLUMN corrected_birth_time TIME NULL AFTER corrected_birth_date,
  ADD COLUMN solar_offset_minutes SMALLINT NULL AFTER corrected_birth_time,
  ADD COLUMN bazi_pillars_json JSON NULL AFTER solar_offset_minutes;
