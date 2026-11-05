-- Durable request identity and quota reservations for native app retries.
-- No payment configuration or existing business rows are changed.
CREATE TABLE IF NOT EXISTS mobile_ai_requests (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  request_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  kind ENUM('reading','followup') NOT NULL,
  payload_hash CHAR(64) CHARACTER SET ascii NOT NULL,
  status ENUM('running','succeeded','failed') NOT NULL,
  run_token CHAR(36) CHARACTER SET ascii NOT NULL,
  quota_date VARCHAR(10) NOT NULL,
  quota_charged TINYINT(1) NOT NULL DEFAULT 0,
  quota_refunded TINYINT(1) NOT NULL DEFAULT 0,
  history_id BIGINT UNSIGNED NULL,
  result_metadata JSON NULL,
  error_code VARCHAR(40) NULL,
  error_message VARCHAR(255) NULL,
  lease_expires_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  UNIQUE KEY uk_mobile_request (user_id, request_id),
  INDEX idx_mobile_pending (status, lease_expires_at),
  INDEX idx_mobile_history (history_id),
  CONSTRAINT fk_mobile_request_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_mobile_request_history FOREIGN KEY (history_id) REFERENCES reading_history(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
