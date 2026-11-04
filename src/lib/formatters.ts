// Currency, date, and business promo formatting utilities

const NAIRA_FORMATTER = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function formatNaira(amount: number | string | null | undefined): string {
  const numeric = typeof amount === 'string' ? parseFloat(amount) : (amount ?? 0);
  if (isNaN(numeric)) return '₦0.00';
  return NAIRA_FORMATTER.format(numeric);
}

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '—';
  try {
    const d = new Date(dateString);
    return new Intl.DateTimeFormat('en-NG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Africa/Lagos',
    }).format(d);
  } catch {
    return dateString;
  }
}

export const PROMO_THRESHOLD = 500000; // ₦500,000
export const PROMO_PERCENTAGE = 0.05;  // 5%

export interface PromoPreview {
  qualifies: boolean;
  threshold: number;
  bonusAmount: number;
  remainingToQualify: number;
  statusLabel: string;
}

export function calculatePromoPreview(cartSubtotal: number): PromoPreview {
  const qualifies = cartSubtotal >= PROMO_THRESHOLD;
  const bonusAmount = qualifies ? Math.round(cartSubtotal * PROMO_PERCENTAGE) : 0;
  const remainingToQualify = qualifies ? 0 : Math.max(0, PROMO_THRESHOLD - cartSubtotal);

  return {
    qualifies,
    threshold: PROMO_THRESHOLD,
    bonusAmount,
    remainingToQualify,
    statusLabel: 'pending until payment is verified',
  };
}

// Nigerian phone validation helper: matches +234XXXXXXXXXX, 234XXXXXXXXXX, or 0[789][01]XXXXXXXX
export function isValidNigerianPhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s\-()]/g, '');
  // Matches Nigerian mobile prefixes: 070, 080, 081, 090, 091, 071 etc.
  const regex = /^(?:(?:\+?234)|0)([789][01]\d{8})$/;
  return regex.test(cleaned);
}
