CREATE TABLE IF NOT EXISTS admin_config_versions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  scope VARCHAR(32) NOT NULL,
  revision BIGINT UNSIGNED NOT NULL,
  action ENUM('baseline', 'save', 'delete', 'rollback') NOT NULL,
  admin_id BIGINT UNSIGNED NULL,
  operator_name VARCHAR(64) NOT NULL,
  reason VARCHAR(500) NULL,
  rollback_target_id BIGINT UNSIGNED NULL,
  before_snapshot JSON NOT NULL,
  after_snapshot JSON NOT NULL,
  before_hash CHAR(64) NOT NULL,
  after_hash CHAR(64) NOT NULL,
  change_count INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL,
  UNIQUE KEY uk_config_scope_revision (scope, revision),
  INDEX idx_config_history_scope (scope, id),
  CONSTRAINT fk_config_history_admin FOREIGN KEY (admin_id) REFERENCES admin_users(id) ON DELETE SET NULL,
  CONSTRAINT fk_config_history_target FOREIGN KEY (rollback_target_id) REFERENCES admin_config_versions(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_config_heads (
  scope VARCHAR(32) NOT NULL PRIMARY KEY,
  revision BIGINT UNSIGNED NOT NULL DEFAULT 0,
  version_id BIGINT UNSIGNED NULL,
  CONSTRAINT fk_config_head_version FOREIGN KEY (version_id) REFERENCES admin_config_versions(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO admin_config_heads (scope) VALUES
  ('card-backs'), ('cards'), ('readers-prompts'), ('featured-readers');
