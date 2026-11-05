-- Invitation codes can be revoked without deleting redemption history.
ALTER TABLE invitation_codes
  ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1 AFTER expires_at,
  ADD INDEX idx_invitation_codes_active (is_active, expires_at);
