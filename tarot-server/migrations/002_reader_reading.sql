-- 002: Add reader-reading support to reading_history
-- Execute: mysql -u root -p tarot_qa < migrations/002_reader_reading.sql

USE tarot_qa;

-- Expand type enum to include reader-reading
ALTER TABLE reading_history
  MODIFY COLUMN type ENUM('single','three-card','daily-fortune','reader-reading') NOT NULL;

-- Add reader_id and spread_type columns
ALTER TABLE reading_history
  ADD COLUMN reader_id VARCHAR(20) NULL AFTER answer,
  ADD COLUMN spread_type VARCHAR(20) NULL AFTER reader_id;

-- Index for reader queries
ALTER TABLE reading_history
  ADD INDEX idx_reader_id (reader_id);
