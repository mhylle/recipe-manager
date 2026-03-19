import { Pipe, PipeTransform } from '@angular/core';

export type ExpiryStatus = 'expired' | 'expiring-soon' | 'fresh' | 'no-expiry';

@Pipe({
  name: 'expiryStatus',
  pure: true,
})
export class ExpiryStatusPipe implements PipeTransform {
  transform(expiryDate: string | undefined): ExpiryStatus {
    if (!expiryDate) {
      return 'no-expiry';
    }

    const now = new Date();
    const expiry = new Date(expiryDate);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const expiryDay = new Date(expiry.getFullYear(), expiry.getMonth(), expiry.getDate());

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
}
