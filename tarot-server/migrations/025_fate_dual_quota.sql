-- Give Fate Dual its own once-per-day free allowance.
ALTER TABLE users
  ADD COLUMN remaining_fate_dual_quota INT NOT NULL DEFAULT 1 AFTER daily_fortune_quota_reset_date,
  ADD COLUMN fate_dual_quota_reset_date DATE NULL AFTER remaining_fate_dual_quota;
