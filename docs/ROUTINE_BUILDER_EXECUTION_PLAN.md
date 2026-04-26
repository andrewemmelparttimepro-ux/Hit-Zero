# Routine Builder Execution Plan

Last updated: 2026-04-26

## Decision

Build the routine builder as a coach-first choreography operating system, not a generic DAW. The product should help a coach move from blank page to teachable routine through counts, music, formations, roster-aware assignments, AI scoring feedback, and exportable teaching/provider materials.

## Current Build Slice

This slice is the practical V1 foundation:

- Count-first section timeline with drag/resize and editable section metadata.
- Music mode/proof workflow for licensed upload, provider brief, or scratch-practice planning.
- Count map inputs for BPM and count-one timing.
- Formation board with draggable athlete dots.
- Athlete assignment panel tied to the roster and team skill tree.
- Persistent AI suggestion cards with accept/reject states.
- Provider brief export that includes sections, formations, assignments, accepted AI notes, and music compliance status.

Known blocker: the Supabase migration exists locally but the remote DB push is blocked until the correct database password is available. The PWA mock data layer is fully wired so product work can continue safely while that is resolved.

## Phase 1: Make Coaches Comfortable Building

Goal: a coach can create a full teachable routine plan without leaving Hit Zero.

Deliverables:

- Formation snapshots for every section.
- Assignment coverage by athlete, role, skill, and count.
- Section-specific notes, teaching cues, and simplified/upgraded alternatives.
- Quick AI buttons: cleaner, safer, harder, more visual, easier to teach.
- Routine readiness score that considers coverage, scoring variety, formation coverage, assignments, count confidence, and music compliance.

Acceptance:

- Every section can have at least one formation.
- Every athlete assignment appears in the provider brief.
- AI suggestions persist and can be accepted/rejected.
- iPad/PWA pointer interactions work for dragging timeline blocks and formation dots.

## Phase 2: Real Music Workflow

Goal: the coach can plan against music without taking on licensing risk.

Deliverables:

- Private audio upload to Supabase Storage.
- License/certificate metadata and proof status.
- Waveform rendering with a cheer-count ruler.
- Manual first-count correction.
- Section loop playback, slow-down, metronome, and count-in.
- Server-generated peaks/beat map for mobile-friendly playback.

Tech:

- `wavesurfer.js` for waveform and regions.
- Web Audio/Tone-style scheduling for metronome/count-in.
- Server-side ffmpeg for normalization/transcoding.
- Python/librosa worker for beat, onset, and energy analysis.

Acceptance:

- Coaches can upload a licensed track, set count 1, and loop a selected section.
- Practice-only/scratch tracks are visibly labeled as not competition-ready.
- Provider brief includes accurate timestamps from the count map.

## Phase 3: Routine Intelligence

Goal: AI becomes the coach's choreo mentor instead of a generic text generator.

Deliverables:

- Roster-aware section generation from skill tracker, roles, strengths, attendance, and AI Judge history.
- Rules/safety validation for active level and ruleset.
- Score simulation using AI Judge calibration and prior scored routines.
- Fatigue/risk detection by athlete and section density.
- Version comparisons: cleaner vs harder vs safer.

Acceptance:

- AI suggestions explain why they help and what tradeoff they create.
- Warnings are tied to specific counts, athletes, and rules.
- Score simulation changes when formations/assignments/skills change.

## Phase 4: Teach, Share, And Practice

Goal: the routine turns into practice material for coaches, athletes, and parents.

Deliverables:

- Printable 8-count sheet.
- Formation cards by section.
- Athlete-specific "my counts" view.
- Practice plan generated from the routine.
- Assistant coach comment/review flow.
- Parent-friendly routine overview.

Acceptance:

- Coaches can print/share the routine without cleaning up the data manually.
- Athletes see only the assignments and media relevant to them.
- Practice plans update from routine weak spots.

## Phase 5: Provider And Compliance Workflow

Goal: Hit Zero becomes the clean handoff layer between coaches and compliant music providers.

Deliverables:

- Provider status: draft, sent, received, approved.
- Voiceover copy, music-hit list, and transition cue export.
- Final track/certificate storage.
- Optional provider partnership/affiliate workflow.

Acceptance:

- A coach can send a professional brief to a provider from Hit Zero.
- The final track and proof stay attached to the routine.
- Competition-ready status requires proof, not vibes.

## Phase 6: Controlled Music Creation

Goal: add music creation only where compliance is solved.

Deliverables:

- Scratch practice beat generator.
- Licensed loop/voiceover library.
- Provider-backed remix workflow with rights documentation.
- Clear labels separating practice-only from competition-ready outputs.

Acceptance:

- No AI-generated or remixed export is presented as competition-ready without rights proof.
- Coaches can still experiment creatively during practice planning.

## Quality Bar

The builder should be rescored after each phase against:

- Coach usability: can a non-technical coach build without feeling stupid?
- Choreo power: does it help plan counts, formations, assignments, and teaching?
- Music compliance: is proof/risk visible at every step?
- AI usefulness: are suggestions roster-aware, explainable, and actionable?
- Reliability: do edits persist, deploy cleanly, and survive iPad/PWA use?
- Export value: can the output be taught, shared, and sent to providers?

