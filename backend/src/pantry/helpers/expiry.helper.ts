export type ExpiryStatus = 'expired' | 'expiring-soon' | 'fresh' | 'no-expiry';

export function getExpiryStatus(
  expiryDate?: string,
  referenceDate?: Date,
): ExpiryStatus {
  if (!expiryDate) {
    return 'no-expiry';
  }

  const now = referenceDate ?? new Date();
  const expiry = new Date(expiryDate);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const expiryDay = new Date(
    expiry.getFullYear(),
    expiry.getMonth(),
    expiry.getDate(),
  );

  const diffMs = expiryDay.getTime() - today.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays < 0) {
    return 'expired';
  }
  if (diffDays <= 3) {
    return 'expiring-soon';
  }
  return 'fresh';
}
