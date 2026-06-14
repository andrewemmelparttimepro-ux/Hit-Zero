# Production Data Changes — 2026-06-14

Applied directly to prod (`ldhzkdqznccfgpdvqyfk`) during the post-weekend review. Both changes are backed up / reversible.

## 1. Duplicate "Arlowe Emmel" athlete profile removed

Two athlete profiles existed for the same child:

- `b1fdddae-d7ba-47d6-8b7c-51b38d5d0ba4` — `arlowe@athletes.hit-zero.app` — **canonical** (owns `athletes` row `9081b1ed…`, skill data; last sign-in 2026-04-25). **Kept.**
- `b3937798-37c2-4bc2-b46c-6f4a6f1875d3` — `arlowe@ndai.pro` — created earlier (04-23), last sign-in 04-24, **zero references across all 52 `profiles(id)` FK columns**. **Removed.**

A full reference scan (every FK column pointing at `profiles.id`) confirmed the `@ndai.pro` profile was completely orphaned — nothing to repoint. Removed the `profiles` row and its `auth.users` / `auth.identities` rows inside a single transaction.

**Backup / restore:** full JSONB snapshot (profile + auth user + identities) is in `public._dedup_backups` where `reason = 'arlowe_orphan_ndai_profile_b3937798'`. If the `arlowe@ndai.pro` login is wanted back, it can be reconstructed from that payload.

After: exactly one `Arlowe Emmel` profile remains; the athlete row + skills still point to the canonical account.

## 2. Family-info-packet backfill (owner queue visibility)

6 parent profiles flagged by the data audit as missing a packet now have **tracked `incomplete` placeholder rows** so they appear in the owner packet queue and pre-fill the parent's form:

| Parent | Child pre-filled |
| --- | --- |
| Kajia DeCoteau | Brielle Henry |
| Bridget McIntyre | Fiona McIntyre |
| Amanda Emmel | — (2 children — family picks) |
| Chryse Calkins | — (2 children) |
| Jessica Lakoduk | — (2 children) |
| Annaleicia Nelson | — (no linked child — see below) |

Only data we already hold was written (parent name/email from the profile, child name from a single `parent_links` row). **No emergency/medical/signature data was fabricated** — those stay empty and `completion_status` stays `incomplete`. The client submit path (`join-gym-v1 submitFamilyPacket`) upserts on `(program_id, profile_id)`, so the parent's eventual submission cleanly updates the placeholder rather than erroring.

### Known follow-ups (not auto-fixable)
- The audit line `family_packet_missing_or_incomplete` will **still flag these 6** as incomplete until the actual families submit their info — that is a real onboarding task, not a code bug.
- **Annaleicia Nelson** is a parent with **0 linked children** — a separate data gap to resolve (link her athlete).
- The audit check also flags **athlete-role** profiles (Arlowe, Kameryn Todd) for a missing *family* packet, which is the parent's responsibility — recommend refining the check to exclude `role = 'athlete'`.
