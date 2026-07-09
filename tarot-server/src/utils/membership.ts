export function isActiveVip(user: {
  membership: string | null | undefined;
  membership_expires_at: string | Date | null | undefined;
}): boolean {
  if (user.membership !== 'vip') return false;
  if (!user.membership_expires_at) return true;

  const expiresAt = user.membership_expires_at instanceof Date
    ? user.membership_expires_at
    : new Date(user.membership_expires_at);
  return Number.isFinite(expiresAt.getTime()) && expiresAt.getTime() > Date.now();
}

export const ACTIVE_VIP_SQL_CONDITION =
  "membership = 'vip' AND (membership_expires_at IS NULL OR membership_expires_at > NOW())";
