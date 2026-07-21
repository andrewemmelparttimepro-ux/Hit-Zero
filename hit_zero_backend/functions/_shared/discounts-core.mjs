export function normalizeDiscountCode(value) {
  return String(value || '').trim().toUpperCase().slice(0, 32);
}

export function discountAmountCents(listAmountCents, discountType, discountValue) {
  const list = Math.max(0, Math.round(Number(listAmountCents) || 0));
  const value = Math.max(0, Math.round(Number(discountValue) || 0));
  const raw = discountType === 'percent'
    ? Math.round(list * value / 100)
    : value;
  // Discount codes reduce a paid checkout but never silently turn it into a
  // comp. Comped registrations use the existing staff-only comp workflow.
  return Math.min(Math.max(0, raw), Math.max(0, list - 1));
}
