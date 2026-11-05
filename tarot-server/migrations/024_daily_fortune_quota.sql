-- Give daily fortune its own free allowance so it does not consume a tarot reading.
ALTER TABLE users
  ADD COLUMN remaining_daily_fortune_quota INT NOT NULL DEFAULT 1 AFTER quota_reset_date,
  ADD COLUMN daily_fortune_quota_reset_date DATE NULL AFTER remaining_daily_fortune_quota;
