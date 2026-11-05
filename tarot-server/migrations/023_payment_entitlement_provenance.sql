-- Track the membership period actually extended by a payment order so a
-- refund, dispute, or pause can safely restore the previous expiry without
-- removing later invitation or administrator grants.
ALTER TABLE payment_orders
  ADD COLUMN membership_restore_expires_at DATETIME NULL AFTER current_period_end_at,
  ADD COLUMN membership_granted_until DATETIME NULL AFTER membership_restore_expires_at,
  ADD COLUMN access_revoked_at DATETIME NULL AFTER membership_granted_until;
