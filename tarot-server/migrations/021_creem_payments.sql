-- Creem checkout records and webhook event deduplication.
CREATE TABLE IF NOT EXISTS payment_orders (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  plan_code ENUM('vip_monthly', 'vip_yearly') NOT NULL,
  provider_product_id VARCHAR(128) NOT NULL,
  provider_checkout_id VARCHAR(128) NULL UNIQUE,
  provider_subscription_id VARCHAR(128) NULL UNIQUE,
  provider_customer_id VARCHAR(128) NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'created',
  current_period_end_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_payment_orders_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_payment_orders_user (user_id),
  INDEX idx_payment_orders_subscription (provider_subscription_id),
  INDEX idx_payment_orders_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payment_events (
  provider_event_id VARCHAR(128) NOT NULL PRIMARY KEY,
  event_type VARCHAR(80) NOT NULL,
  payload_json JSON NOT NULL,
  received_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_payment_events_type (event_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
