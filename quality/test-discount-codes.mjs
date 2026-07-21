import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  discountAmountCents,
  normalizeDiscountCode,
} from '../hit_zero_backend/functions/_shared/discounts-core.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

assert.equal(normalizeDiscountCode('  sibling-10  '), 'SIBLING-10');
assert.equal(discountAmountCents(10_000, 'percent', 10), 1_000);
assert.equal(discountAmountCents(10_000, 'percent', 15), 1_500);
assert.equal(discountAmountCents(10_000, 'fixed', 2_500), 2_500);
assert.equal(discountAmountCents(10_000, 'fixed', 20_000), 9_999, 'a public discount cannot silently create a comp');

const intake = fs.readFileSync(path.join(root, 'hit_zero_backend/functions/public-intake-v1/index.ts'), 'utf8');
const checkout = fs.readFileSync(path.join(root, 'hit_zero_backend/functions/square-checkout-v1/index.ts'), 'utf8');
const paymentInfo = fs.readFileSync(path.join(root, 'hit_zero_backend/functions/join-gym-v1/index.ts'), 'utf8');
const booking = fs.readFileSync(path.join(root, 'pwa/hit_zero_web/screens/PublicBooking.jsx'), 'utf8');
const owner = fs.readFileSync(path.join(root, 'pwa/hit_zero_web/screens/OtherScreens.jsx'), 'utf8');

assert.match(intake, /kind === 'discount_quote'/);
assert.match(intake, /final_amount_cents: pricing\?\.final_amount_cents/);
assert.match(checkout, /row\.final_amount_cents/);
assert.match(checkout, /amount_mismatch/);
assert.match(paymentInfo, /final_amount_cents/);
assert.match(booking, /Discount code \(optional\)/);
assert.match(booking, /amount_cents: Number\(klass\.price_cents \|\| 0\)/);
assert.match(owner, /ClassDiscountCodesEditor/);
assert.match(owner, /Square verifies the discounted total/);

console.log('discount-code tests passed');
