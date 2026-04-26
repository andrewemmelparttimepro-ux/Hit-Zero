# Hit Zero Coach Routine Builder Plan

Last updated: 2026-04-26

## Product North Star

The routine builder should become a coach confidence engine: a count-first choreography workspace that helps coaches build, explain, validate, teach, and improve routines without immediately paying an outside choreographer.

The strongest wedge is not "AI makes competition music." That path creates licensing risk and turns Hit Zero into a browser DAW before the coaching workflow is solved. The winning wedge is:

- Import or document licensed music.
- Detect the beat grid and convert it into cheer counts.
- Build routine sections, formations, athlete assignments, skills, transitions, and teaching notes on top of that count map.
- Use AI to suggest options, check legality/safety, estimate scoring impact, and produce coach-ready teaching materials.
- Produce clean handoff artifacts for athletes, assistant coaches, parents, and music providers.

## Current State In Hit Zero

The existing `RoutineBuilder.jsx` is a useful prototype seed:

- It has a horizontal count timeline.
- Coaches can add, move, resize, edit, and delete sections.
- It computes a simple predicted score from routine coverage and skill readiness.

It is not yet a real choreography system:

- No music upload, waveform, count map, downbeat detection, or playback.
- No licensing metadata or proof-of-license storage.
- No formation canvas or athlete position model.
- No versioning, comments, approval, or undo history.
- No AI generation or rules/safety validation loop.
- No export to 8-count sheet, provider brief, athlete view, or practice plan.
- Current PWA architecture is still mostly browser-script based rather than a package-managed editor stack.

## Competitive Research Takeaways

### Cheer-Specific Tools

Cheer Builder proves coaches will pay for drag-and-drop choreography blocks, previews, count-by-count instruction, on-screen formations, and direct-to-athlete lessons. Their product is block-based and content-library driven.

CheerSounds / 8CountMixer proves coaches also need cheer-specific music editing that speaks in 8-counts, sound effects, voiceovers, and instant playback. Their advantage is licensed cheer music plus a workflow that does not require coaches to understand traditional DAW tooling.

Hit Zero should borrow the successful mental models:

- Blocks / sections.
- Count-by-count instruction.
- Formation visuals.
- Music hits mapped to counts.
- Coach-friendly output.

Hit Zero should differentiate with:

- AI scoring and rules validation.
- Roster-aware choreography suggestions.
- Skill readiness and athlete role assignment.
- "Make it cleaner / harder / safer / more visual" iteration.
- Practice plans generated from the routine timeline.
- A calibration loop from AI Judge results back into routine design.

### Music Compliance

USA Cheer guidance is clear enough that our product posture should be conservative:

- Licensed cover recordings can be remixed only if the license explicitly allows alteration/new works.
- Unlicensed samples are not allowed.
- A normal iTunes/Amazon purchase does not grant remix, mashup, or medley rights.
- Teams need written proof/license documentation when using music from providers.

Product implication: Hit Zero should not market pure AI music generation as competition-ready unless or until we have a licensed-rights partner and certificate workflow.

Instead, Hit Zero should support three music modes:

- `licensed_upload`: Coach uploads a competition track plus provider/license metadata.
- `provider_brief`: Coach builds choreo/counts first, then exports a professional music brief for a compliant cheer music provider.
- `scratch_practice`: AI or simple generated beats are allowed for internal planning/practice only and clearly marked not competition-compliant.

### General Music Software Patterns

Online DAWs like Soundtrap and BandLab show useful UX patterns: tracks, regions, tempo, metronome, import audio, loops, recording, and collaboration. We should not copy the whole DAW surface. Coaches need fewer knobs and more cheer-specific structure.

The best routine-builder audio UX should be:

- One primary music waveform.
- Cheer-count ruler above it.
- Markers for 8-counts, sections, formations, stunt hits, jumps, pyramids, and dance moments.
- Simple controls: play, pause, loop section, slow down, metronome, count-in.
- Optional lanes for voiceover notes, sound-effect cues, and music-provider notes.

## Recommended Tech Stack

### Frontend

Short-term, the current PWA can add libraries via CDN/ESM, but the editor will quickly outgrow that. The routine builder should eventually move into a package-managed React/Vite workspace so we can test and bundle editor dependencies reliably.

Recommended frontend pieces:

- `wavesurfer.js` for waveform display, timeline, regions, looping, and markers.
- `Tone.js` or native Web Audio scheduling for metronome, count-in, and count-synced playback cues.
- SVG or Canvas for the count timeline and formation floor.
- `react-konva` or a lightweight custom SVG layer for draggable athlete dots/formations once the app is package-managed.
- Pointer Events instead of mouse-only handlers so iPad/PWA drag works.
- Local autosave draft state plus explicit version snapshots.

Do not build a full multitrack DAW first. If remix/export is needed, keep it constrained to cheer-specific operations.

### Audio Analysis

Use a two-tier strategy:

- Client-side quick pass: decode short/normal tracks, show waveform, let coach manually tap or correct downbeats.
- Server/background pass: run heavier tempo/downbeat/energy analysis and waveform peak generation outside the browser.

Recommended analysis tooling:

- `librosa` in a Python worker for beat tracking, tempo, onset strength, and energy sections.
- Precomputed waveform peaks for large audio so mobile browsers do not have to decode entire files.
- Optional `Essentia.js` later for in-browser MIR experiments, but not as the first production path.

Vercel serverless functions are not ideal for heavy ffmpeg/audio analysis. Use Supabase Storage for assets and a worker service for processing. Good candidates later: Modal, Fly.io, Cloud Run, or a small always-on worker triggered from Supabase.

### Audio Processing / Remix

Use server-side ffmpeg for reliable normalize/trim/transcode/preview exports. `ffmpeg.wasm` can be used later for small local edits, but it is heavy for iOS and requires careful cross-origin isolation if multithreaded.

MVP audio operations:

- Upload MP3/M4A/WAV.
- Normalize playback preview.
- Detect/confirm BPM and first count.
- Loop any selected section.
- Export a music-provider cue sheet.

Later audio operations:

- Trim start/end for practice.
- Slow-down playback without permanent export.
- Add count-in click for teaching.
- Generate scratch practice beat under coach-confirmed counts.
- Provider-partner remix handoff rather than unlicensed competition export.

### Backend / Supabase

Add a private `routine-audio` storage bucket with allowed audio MIME types and size limits appropriate for competition tracks.

Proposed tables:

- `routine_versions`: immutable snapshots of a routine plan.
- `routine_audio_assets`: uploaded tracks, scratch tracks, provider references, storage paths, duration, MIME, and processing status.
- `music_licenses`: provider, license/certificate URL, receipt metadata, permitted uses, expiration, and compliance status.
- `routine_count_maps`: BPM, first downbeat, count-to-time mapping, confidence, manual corrections.
- `routine_events`: timeline events such as section starts, music hits, stunt hits, jumps, tumbling passes, pyramids, transitions, notes, and voiceover cues.
- `routine_formations`: named formation snapshots by count range.
- `routine_positions`: athlete x/y positions per formation.
- `routine_assignments`: athlete-to-skill/role assignments for bases, flyers, backs, tumblers, jump groups, dance groups, and alternates.
- `routine_comments`: coach notes, assistant feedback, and approval discussion.
- `routine_ai_suggestions`: generated alternatives, rationale, rule checks, scoring deltas, and accepted/rejected state.
- `routine_exports`: generated PDFs, count sheets, provider briefs, teaching cards, and athlete packets.

RLS posture:

- Owners and coaches can create/edit routines for their program/team.
- Athletes can view assigned routine material, not private coach planning notes unless shared.
- Parents can view child-facing/parent-facing routine materials.
- Music/license assets should never be public by default.
- Service-role-only processing jobs can update analysis results and generated artifacts.

## Core UX Flow

### 1. Start With Team Reality

Coach chooses:

- Team, division, level, routine length, target event, and ruleset.
- Roster availability and athlete roles.
- Team strengths, weaknesses, must-have skills, injuries/limitations, and confidence level.

AI reads:

- Skill tracker.
- Attendance/practice history.
- AI Judge history.
- Previous score calibration.
- Known rule/rubric constraints.

### 2. Choose Music Mode

Coach chooses one:

- Upload licensed music.
- Build first, export provider brief.
- Scratch practice track.

For licensed upload, require:

- Provider/source.
- License certificate or receipt upload.
- Track title/version.
- Competition/proof status.

The app should label the compliance state clearly:

- `competition_ready`
- `needs_license_proof`
- `practice_only`
- `provider_pending`

### 3. Build / Correct Count Map

The app generates:

- BPM estimate.
- First count / downbeat.
- 8-count ruler.
- Energy peaks.
- Suggested sections.

Coach can correct:

- "Count 1 starts here."
- BPM.
- Section boundaries.
- Tempo drift.
- Music hit markers.

This step is critical. If the count map is wrong, every downstream feature feels dumb.

### 4. Generate Routine Draft

Coach can prompt:

- "Build a Mini Level 1 routine around clean stunts and confidence."
- "More visual, less risky."
- "Add a stronger pyramid moment without illegal inversions."
- "Use Arlowe in front for dance but keep tumbling simple."
- "Give me three versions of counts 33-48."

AI returns:

- Section plan.
- Suggested formations.
- Athlete assignments.
- Skill list.
- Teaching notes.
- Safety/rules warnings.
- Score impact estimate.

### 5. Edit Like A Coach, Not A Producer

Primary editor layers:

- Counts.
- Music waveform.
- Sections.
- Formations.
- Athletes.
- Skills.
- Transitions.
- Notes.
- AI suggestions.

Every AI suggestion should be accept/reject/edit, never silently applied.

### 6. Validate

Validation should show:

- Illegal/risky skills.
- Overloaded athletes.
- Missing required routine variety.
- Weak scoring categories.
- Fatigue clusters.
- Transition dead zones.
- Counts with too much happening.
- Counts with nothing happening.
- Confidence score by section.

Tie directly into AI Judge:

- "This design currently projects 91.2-93.8 if execution is clean."
- "Your weakest scoring risk is pyramid creativity."
- "This version is cleaner than v3 but loses 0.4 in difficulty."

### 7. Teach / Export

Exports:

- Printable 8-count sheet.
- Formation cards.
- Athlete-specific assignments.
- Parent-friendly routine overview.
- Practice plan by section.
- Music provider brief with timestamps/counts/cues.
- Coach video/audio playback mode.

Athlete experience:

- "My counts."
- "My formations."
- "My skills."
- "My section videos."
- "Practice this at home."

## AI Features That Actually Matter

### Choreo Copilot

Roster-aware generation that understands level, skill readiness, and scoring. It should not just write generic cheer motions. It should reason from the actual team.

### Section Alternatives

Coaches often get stuck on one part. Let them regenerate only counts 41-56 with constraints.

### Rules And Safety Guardrails

Always-on validation against the active ruleset. This should be a trust feature, not a scary police feature.

### Score Simulation

Use the AI Judge rubric and historical calibration to estimate score range. Show why the range moved when the routine changes.

### Music Cue Intelligence

AI should identify where the routine wants:

- Stunt hits.
- Pyramid build.
- Jump attack.
- Dance drop.
- Voiceover callout.
- Transition recovery.

Then it should export those notes for the music provider or internal planning.

### Coach Teaching Assistant

For every section, generate:

- How to teach it.
- Common mistakes.
- What to watch on film.
- How to simplify it.
- How to upgrade it.
- Which athletes need extra reps.

This is where Hit Zero can feel like a real mentor, not just a drawing board.

## What Not To Build First

- Full browser DAW.
- Pure AI competition music generator.
- Unlicensed stem separation/remix export.
- Complex 3D animation before the count/formation model works.
- A massive asset marketplace before coaches can build one strong routine.
- Automatic choreography that cannot explain itself.

## Phased Execution Plan

### Phase 0: Stabilize Existing Builder

- Confirm all current routine mutations persist live through Supabase.
- Add loading/error/toast states to all builder actions.
- Convert mouse drag to pointer events for iPad/PWA.
- Add route/action smoke tests.
- Add routine version snapshots before destructive edits.

### Phase 1: Data Model And Versioning

- Add schema for routine versions, events, formations, positions, assignments, audio assets, licenses, and exports.
- Add RLS and storage policies.
- Add selectors that can assemble a routine version from normalized tables.
- Add migrations, seed cleanup, and a reset-safe dev dataset.

### Phase 2: Count-First Editor V1

- Rebuild the current timeline around routine events.
- Add lanes for sections, skills, formations, and notes.
- Add count zoom, loop selection, and print-friendly 8-count sheet.
- Add formation snapshots with draggable athlete dots.
- Add athlete assignment panel tied to roster and skills.

### Phase 3: Music Upload And Count Map

- Add private audio upload.
- Add license/proof metadata flow.
- Add waveform display.
- Add first-count correction and BPM/count map editing.
- Add simple playback, loop section, slow-down, and metronome/count-in.
- Add processing job for peaks and beat/energy analysis.

### Phase 4: AI Routine Copilot

- Add prompt panel with accepted/rejected suggestions.
- Generate section plans from roster/rules/music map.
- Add "make easier/harder/cleaner/more visual" transforms.
- Add safety/rules validation.
- Add score simulation tied to AI Judge calibration.

### Phase 5: Teaching And Sharing

- Generate practice plans from routine sections.
- Generate athlete-specific assignments.
- Add athlete-facing routine view.
- Add coach/assistant comments.
- Add exports for count sheets, formation cards, and provider briefs.

### Phase 6: Music Provider Workflow

- Add provider brief export with count/time markers, desired style, voiceover copy, hit list, and compliance metadata.
- Track provider status: draft, sent, received, approved.
- Store final licensed track and certificate.
- Consider partnerships or affiliate flow with compliant providers.

### Phase 7: Controlled Music Creation

Only after compliance strategy is solved:

- Scratch-track generator for practice.
- Licensed loop library.
- Human-authored/cleared voiceover packs.
- Partner-backed remix generation with rights documentation.
- Export labels that distinguish practice-only from competition-ready.

## First Build Slice Recommendation

Build the smallest version that feels magical to a coach:

- Upload or select a routine song.
- Set count 1.
- See waveform plus 8-count ruler.
- Add sections and formations.
- Assign athletes to skills.
- Ask AI for one section alternative.
- Get rules/scoring feedback.
- Export a count sheet and provider brief.

That slice is enough to prove the core promise: coaches can stop staring at a blank routine and start making confident decisions.

## Research Sources

- USA Cheer Music Provider Directory: https://usacheer.org/music-provider-directory
- USA Cheer music guidelines PDF: https://www.usacheer.org/wp-content/uploads/2020/06/USACheerGuidelines.pdf
- ClicknClear music licensing for performance sports: https://www.clicknclear.com/
- CheerSounds / 8CountMixer: https://www.cheersounds.com/
- Cheer Builder Build A Routine: https://www.cheerbuilder.com/build-a-routine
- WaveSurfer.js docs: https://wavesurfer.xyz/docs/
- Tone.js Transport docs: https://tonejs.github.io/docs/14.7.77/Transport
- ffmpeg.wasm overview: https://ffmpegwasm.netlify.app/docs/overview/
- librosa beat and tempo docs: https://librosa.org/doc/main/beat.html
- U.S. Copyright Office AI initiative: https://www.copyright.gov/ai/
- RIAA Suno/Udio lawsuit announcement: https://www.riaa.com/record-companies-bring-landmark-cases-for-responsible-ai-againstsuno-and-udio-in-boston-and-new-york-federal-courts-respectively/
- BandLab Studio basics: https://help.bandlab.com/hc/en-us/articles/115002945153-Getting-started-with-BandLab-s-Studio
- Soundtrap features: https://www.soundtrap.com/content/features
