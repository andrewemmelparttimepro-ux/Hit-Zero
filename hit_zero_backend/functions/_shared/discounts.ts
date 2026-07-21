import {
  discountAmountCents,
  normalizeDiscountCode,
} from './discounts-core.mjs';

export { discountAmountCents, normalizeDiscountCode };

export type DiscountQuote = {
  code_id: string;
  code: string;
  label: string;
  discount_type: 'percent' | 'fixed';
  discount_value: number;
  list_amount_cents: number;
  discount_amount_cents: number;
  final_amount_cents: number;
};

export class DiscountCodeError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = 'DiscountCodeError';
    this.code = code;
    this.status = status;
  }
}

export async function quoteClassDiscount(
  client: any,
  args: {
    programId: string;
    classId: string;
    code: unknown;
    listAmountCents: number;
    now?: Date;
  },
): Promise<DiscountQuote> {
  const code = normalizeDiscountCode(args.code);
  if (!code) throw new DiscountCodeError('missing_discount_code', 'Enter a discount code.');
  if (!/^[A-Z0-9][A-Z0-9_-]{2,31}$/.test(code)) {
    throw new DiscountCodeError('invalid_discount_code', 'That discount code is not valid.');
  }

  const { data, error } = await client
    .from('class_discount_codes')
    .select('id, program_id, class_id, code, label, discount_type, discount_value, is_active, starts_at, ends_at')
    .eq('program_id', args.programId)
    .eq('class_id', args.classId)
    .ilike('code', code)
    .maybeSingle();
  if (error) throw error;
  if (!data || !data.is_active) {
    throw new DiscountCodeError('discount_code_not_found', 'That discount code is not valid for this class.', 404);
  }

  const now = (args.now || new Date()).getTime();
  if (data.starts_at && new Date(data.starts_at).getTime() > now) {
    throw new DiscountCodeError('discount_code_not_started', 'That discount code is not active yet.', 409);
  }
  if (data.ends_at && new Date(data.ends_at).getTime() <= now) {
    throw new DiscountCodeError('discount_code_expired', 'That discount code has expired.', 409);
  }

  const listAmountCents = Math.max(0, Math.round(Number(args.listAmountCents) || 0));
  if (listAmountCents <= 1) {
    throw new DiscountCodeError('discount_not_payable', 'This class does not have a discountable online price.', 409);
  }
  const discountAmount = discountAmountCents(listAmountCents, data.discount_type, data.discount_value);
  if (!discountAmount) {
    throw new DiscountCodeError('discount_has_no_value', 'That code does not reduce this class price.', 409);
  }

  return {
    code_id: data.id,
    code: normalizeDiscountCode(data.code),
    label: String(data.label || 'Discount'),
    discount_type: data.discount_type,
    discount_value: Number(data.discount_value),
    list_amount_cents: listAmountCents,
    discount_amount_cents: discountAmount,
    final_amount_cents: listAmountCents - discountAmount,
  };
}
