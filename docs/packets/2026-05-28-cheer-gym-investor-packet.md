# Cheer Gym Investor Packet

Prepared: 2026-05-28  
Subject: Magic City Athletics operating model, powered by Hit Zero  
Live references: `https://mcaminot.com`, `https://thehitzero.net`

## Executive Summary

Magic City Athletics is a cheer-focused gym in Minot, North Dakota, with a public website, connected registration/payment workflow, and an operating app stack called Hit Zero.

The investment thesis is that a modern cheer gym can be more than a collection of classes. With the right operating system, it can become a structured youth sports business: recurring tuition, camps, clinics, private lessons, team programs, parent communications, athlete records, waiver/medical compliance, staff workflows, and payment operations in one loop.

Hit Zero is the differentiator. It is being built around the specific operating realities of cheer gyms: classes, teams, athletes, parents, routines, skills, readiness, billing, evaluations, and seasonal programming. MCA is the first live proving ground.

This packet is not an audited financial statement. It is an investor-facing operating overview and diligence map.

## What The Gym Is Selling

MCA currently has multiple monetizable program lines:

| Program line | Revenue type | Notes |
| --- | --- | --- |
| All Star / team cheer | Monthly tuition | Fall classes exist in the system, registration currently closed pending staff timing. |
| Traditional cheer | Monthly tuition | Lower-price recurring team option. |
| Summer skill builder | Flat session fee | Higher-ticket summer intensive. |
| Tumbling/stunts clinics | Flat session fee | Repeatable technique classes. |
| Flex & strength | Flat session fee | Athletic development class. |
| Adult drop-in | Per-class fee | Low-friction community offer. |
| Tiny camp | Camp fee | Small age-group camp offer. |
| School team clinics | Per-athlete fee | Team/group monetization channel. |
| Private lessons | Time-based fee | $30 / 30 min, $55 / 1 hour, $75 / 1.5 hour. |
| Future birthdays/events | Event revenue | Public site has room for a birthday/events section. |

Current open public offerings in Hit Zero include:

- Cheer Skill Builder: $450
- Cheer Prep Academy: $200
- Tumbling/Stunts clinics: $160
- Flex & Strength classes: $160
- Tiny Camp: $50
- School Team Clinics: $50/athlete
- Adult drop-in: $10/class
- Private lessons: $30, $55, $75 based on duration

Fall team/program rows are already represented in the system, including monthly pricing from $100 to $200/month depending on program.

## Why This Matters To An Investor

Traditional small gyms often leak value in predictable places:

- Registration happens in forms, texts, spreadsheets, and DMs.
- Payments get separated from enrollment.
- Staff cannot see which families are pending, paid, linked, missing paperwork, or ready.
- Parents are confused about whether they are signed up, paid, approved, or connected.
- Schedule, roster, medical, waiver, billing, and communication data become fragmented.
- Owners spend high-value time chasing administrative loose ends instead of growing the program.

MCA + Hit Zero is designed to turn those loose ends into operating leverage.

## The Operating System Advantage

Hit Zero currently supports or is being wired for:

- Public family signup
- Gym access requests and approval
- Family info packets
- Parent/athlete linking
- Public class registration
- Square payment handoff
- Paid registration review
- Assisted staff registration
- Payment reminder links
- Program/class editing
- Schedule creation
- Roster and athlete profiles
- Routine and skill tracking
- Billing/Square sync scaffolding
- Staff/owner role views
- Daily quality monitoring

The most important current improvement is payment gating: paid public signups now require Square payment before becoming real registrations. This reduces the "I signed up but did not pay" chase that small gyms often absorb manually.

## Customer And Parent Experience

The intended family journey:

1. Parent finds MCA on `mcaminot.com`.
2. Parent chooses a class or creates a family account.
3. Paid classes send parent to Hit Zero checkout.
4. Parent is told clearly that payment is required to register.
5. Square payment completes through MCA's connected Square account.
6. Hit Zero records the paid registration for staff review.
7. Parent can create/access account, complete family packet, and get connected to the correct athlete.
8. Staff approves and links families intentionally.

This is materially different from a generic website form because payment, family data, and operational review are connected.

## Staff And Owner Experience

The intended staff journey:

1. Staff logs into Hit Zero.
2. Staff sees pending registrations, paid registrations needing review, access requests, parents needing athlete links, and family packet status.
3. Staff can create an assisted registration for someone who signed up in person.
4. Staff can send a parent setup/payment link.
5. Staff can accept, reject, waitlist, move classes, and add notes.
6. Staff can manage offerings that appear on the public site.
7. Staff can use schedule/roster/program tools from one app rather than scattered systems.

Operationally, this is the foundation for scaling beyond founder memory.

## Payment Infrastructure

MCA is connected through Square at the gym/program level.

Current payment posture:

- Public checkout enabled for MCA.
- Checkout mode: Square Web Payments.
- Browser never receives Square secrets.
- Parent card details stay inside Square's secure payment form.
- Hit Zero backend creates the Square payment and records the result.
- Registration payment metadata stores Square references such as payment id, receipt URL, card brand/last4, class, parent, athlete, and registration id.

Current limitation:

- True automatic recurring monthly drafts are not yet implemented in Hit Zero.
- Monthly fall classes show that the initial Square payment is one-time and does not start autopay.
- If recurring billing becomes a priority, the next build should include explicit parent consent, card-on-file/customer mapping, recurring invoice/subscription lifecycle, cancellation, failed-payment handling, and webhooks.

## Technology Stack

| Layer | System | Role |
| --- | --- | --- |
| Public website | MCA site on Vercel / `mcaminot.com` | Marketing, classes, coaches, contact, CTAs. |
| App | Hit Zero PWA / `thehitzero.net` | Families, staff, owner operations. |
| Database/auth | Supabase | Users, roles, classes, registrations, packets, payments, RLS. |
| Payments | Square | Card payments and merchant account. |
| Hosting/deploy | Vercel | Frontend deploys and domains. |
| Email | Resend path where configured | Confirmation/payment reminder emails. |
| Analytics | Vercel analytics/Speed Insights, optional Microsoft Clarity | Traffic and UX visibility, with privacy guardrails needed. |
| Quality | Hit Zero quality runner | Daily audit/report scaffolding. |

## Why A Cheer-Specific Platform Is Valuable

Generic gym software tends to treat cheer like any other class business. Cheer has extra complexity:

- Athletes can be on teams, camps, clinics, private lessons, and evaluations.
- Parents, athletes, coaches, and owners need different views.
- Skills and routine readiness matter.
- Team placement is not always immediate self-service.
- Waivers, medical notes, and emergency contacts matter.
- Seasonality creates surges: tryouts, summer camps, fall launch, competitions.
- Billing may mix one-time payments, monthly tuition, private lessons, and event fees.

Hit Zero is being shaped around those realities.

## Potential Revenue Levers

For the gym:

- Convert website traffic into paid registrations more reliably.
- Reduce unpaid signup leakage.
- Increase camp/clinic/private lesson discoverability.
- Create assisted signup flows for meet-and-greet or in-person events.
- Improve parent confidence through clearer account/payment status.
- Expand into birthdays/events or school clinics.
- Improve staff follow-through on incomplete packets, missing athlete links, and unpaid registrations.

For the platform:

- Per-gym SaaS subscription.
- Payment-adjacent workflow value, without becoming the processor.
- Premium modules for routine builder, AI judge, billing automation, parent communications, and multi-location operations.
- Implementation/onboarding services for new gyms.

## Due Diligence Questions For An Investor

Before investing in a cheer gym or gym-platform rollout, ask:

1. How many active athletes are currently enrolled?
2. How many paid registrations are in the current season/camp cycle?
3. What is monthly recurring tuition at full fall enrollment?
4. What percentage of revenue comes from team tuition vs camps/clinics/private lessons?
5. What is coach payroll as a percentage of revenue?
6. What are facility lease terms and capacity constraints?
7. How many classes can the facility support per week?
8. What is the conversion rate from website visit to paid registration?
9. How many unpaid or incomplete registrations remain in the queue?
10. What family packet / waiver completion rate is required before participation?
11. How much owner time is spent on admin today?
12. Is Square payout/reconciliation clean enough for financial reporting?
13. What competition, uniform, choreography, insurance, and travel costs flow through the gym?
14. What systems still depend on manual work or founder knowledge?
15. What would be required to open a second location or onboard another gym?

## Current Strengths

- MCA has a live branded public website.
- MCA has current class pricing and schedules represented in production data.
- Hit Zero is live as a web PWA.
- Public signup and gym connection flows exist.
- Square payment infrastructure is connected at the program level.
- Paid public booking now blocks "registered but unpaid" leakage.
- Staff-side registration/admin tools exist.
- Family packet infrastructure exists.
- Daily quality monitoring exists, even if it still needs hardening and better credentials/runtime reliability.
- The product is being tested against real operator feedback, not abstract planning.

## Current Risks

- The product is still in early production, not a mature packaged SaaS.
- Some app areas have known prototype or quality-audit findings.
- Demo/stale data must remain quarantined.
- Full recurring autopay is not implemented.
- Some workflows may still need mobile polish for staff.
- Supabase migration history and direct production patches need cleanup.
- Analytics/session recording must be configured carefully to avoid sensitive-data exposure.
- Investor-level financials need real accounting exports, Square reports, payroll, lease, insurance, and enrollment numbers.

## Suggested Investment Framing

If the investor is looking at the gym:

MCA should be evaluated as a local youth sports operating company with a technology-assisted growth path. The upside is not just more athletes; it is better conversion, better retention, more reliable payments, clearer parent experience, and lower owner administrative drag.

If the investor is looking at Hit Zero:

Hit Zero should be evaluated as a vertical operating system for cheer gyms. MCA is the live reference implementation and product proving ground. The opportunity is to turn the exact workflows that are painful at MCA into a repeatable platform for other gyms.

If the investor is looking at both:

The combined thesis is a gym plus software flywheel: the gym exposes the real workflows, the software reduces friction and captures operational know-how, and each new workflow can become repeatable infrastructure for the next gym.

## Immediate Next Milestones

1. Clean up remaining production quality findings.
2. Produce a real enrollment and revenue report from Square/Hit Zero.
3. Finish staff-friendly parent/athlete linking and family packet review.
4. Tighten registration/admin mobile views.
5. Build or explicitly defer autopay.
6. Confirm analytics and privacy masking.
7. Create monthly owner dashboard: paid registrations, unpaid starts, classes, packets, revenue, birthdays, upcoming sessions.
8. Package a second-gym onboarding checklist.

## Materials To Attach For Investor Review

Recommended supporting artifacts:

- MCA current class schedule and pricing.
- Square sales/export report.
- Current active athlete and family count.
- Lease/facility capacity summary.
- Staff/coaching payroll assumptions.
- Insurance and competition cost summary.
- Hit Zero screenshots: public signup, booking/payment, staff registration, family packet, roster, schedule, billing/Square.
- Quality audit summary with current remediation plan.
- Existing PDFs in the repo:
  - `/Users/andrewemmel/Desktop/apps/hitzero/hit_zero_investor_brief.pdf`
  - `/Users/andrewemmel/Desktop/apps/hitzero/hit_zero_financials.pdf`

## Plain-English Pitch

Magic City Athletics is not just launching a website. It is putting the gym's operating model into software.

Parents can find classes, pay, and connect to the gym. Staff can see who paid, who needs review, who needs a family packet, and who needs to be linked to an athlete. Owners can move away from scattered texts and spreadsheets toward a cleaner command center.

For an investor, that matters because operational clarity is what makes a youth sports business easier to grow, easier to audit, and easier to replicate.

