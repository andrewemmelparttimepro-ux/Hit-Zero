import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const migration = read('hit_zero_backend/supabase/migrations/20260721153633_recurring_tuition_schedules.sql');
const checkout = read('hit_zero_backend/supabase/functions/square-checkout-v1/index.ts');
const recurring = read('hit_zero_backend/supabase/functions/_shared/recurring.ts');
const square = read('hit_zero_backend/supabase/functions/_shared/square.ts');
const intake = read('hit_zero_backend/supabase/functions/public-intake-v1/index.ts');
const paymentInfo = read('hit_zero_backend/supabase/functions/join-gym-v1/index.ts');
const booking = read('pwa/hit_zero_web/screens/PublicBooking.jsx');

assert.match(migration, /date '2026-10-01', date '2026-11-01', date '2026-12-01'/);
assert.match(migration, /date '2026-12-15'/);
assert.doesNotMatch(migration, /date '2026-09-01'/);
assert.match(migration, /Second All-Star sibling - 10% every month/);
assert.match(migration, /discount_percent[\s\S]*10/);

assert.match(square, /'ITEMS_WRITE'/);
assert.match(recurring, /periods: terms\.billing_dates\.length/);
assert.match(recurring, /monthly_billing_anchor_date: firstDraftDay/);
assert.match(checkout, /recurring_authorization_required/);
assert.match(checkout, /'CHARGE_AND_STORE'|\/v2\/cards/);
assert.match(checkout, /\/v2\/cards/);
assert.match(checkout, /\/v2\/subscriptions/);
assert.match(checkout, /start_date: recurringSetup\.terms\.billing_dates\[0\]/);

assert.match(intake, /recurring_billing:/);
assert.match(paymentInfo, /recurringSnapshot/);
assert.match(booking, /Authorize the scheduled drafts/);
assert.match(booking, /no further automatic drafts are authorized/);
assert.match(booking, /intent: recurring \? 'CHARGE_AND_STORE' : 'CHARGE'/);

console.log('Recurring tuition contract checks passed.');
