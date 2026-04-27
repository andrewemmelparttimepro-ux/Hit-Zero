// ─────────────────────────────────────────────────────────────────────────────
// HIT ZERO WEB - Routine Builder
// Count-first coach workspace: music setup, licensing status, section timeline,
// provider brief, and AI-ready planning cues.
// ─────────────────────────────────────────────────────────────────────────────

const SECTION_COLORS = {
  opening: { bg: 'linear-gradient(135deg, rgba(249,127,172,0.35), rgba(249,127,172,0.18))', border: 'rgba(249,127,172,0.5)', dot: '#F97FAC' },
  standing_tumbling: { bg: 'linear-gradient(135deg, rgba(39,207,215,0.35), rgba(39,207,215,0.18))', border: 'rgba(39,207,215,0.5)', dot: '#27CFD7' },
  running_tumbling: { bg: 'linear-gradient(135deg, rgba(39,207,215,0.35), rgba(39,207,215,0.18))', border: 'rgba(39,207,215,0.5)', dot: '#27CFD7' },
  jumps: { bg: 'linear-gradient(135deg, rgba(255,180,84,0.35), rgba(255,180,84,0.18))', border: 'rgba(255,180,84,0.5)', dot: '#FFB454' },
  stunts: { bg: 'linear-gradient(135deg, rgba(249,127,172,0.35), rgba(249,127,172,0.18))', border: 'rgba(249,127,172,0.5)', dot: '#F97FAC' },
  pyramid: { bg: 'linear-gradient(135deg, rgba(63,231,160,0.35), rgba(63,231,160,0.18))', border: 'rgba(63,231,160,0.5)', dot: '#3FE7A0' },
  baskets: { bg: 'linear-gradient(135deg, rgba(39,207,215,0.35), rgba(39,207,215,0.18))', border: 'rgba(39,207,215,0.5)', dot: '#27CFD7' },
  dance: { bg: 'linear-gradient(135deg, rgba(249,127,172,0.35), rgba(249,127,172,0.18))', border: 'rgba(249,127,172,0.5)', dot: '#F97FAC' },
  transition: { bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.15)', dot: '#888' },
};

const SECTION_TYPES = [
  { id: 'opening', label: 'Opening' },
  { id: 'standing_tumbling', label: 'Standing Tumbling' },
  { id: 'running_tumbling', label: 'Running Tumbling' },
  { id: 'jumps', label: 'Jumps' },
  { id: 'stunts', label: 'Stunts' },
  { id: 'pyramid', label: 'Pyramid' },
  { id: 'baskets', label: 'Baskets' },
  { id: 'dance', label: 'Dance' },
  { id: 'transition', label: 'Transition' },
];

const MUSIC_MODES = [
  { id: 'licensed_upload', label: 'Licensed upload', tone: 'green', help: 'Competition track is uploaded and proof can be attached.' },
  { id: 'provider_brief', label: 'Build first, brief provider', tone: 'teal', help: 'Use counts now, then send a clean cue sheet to a compliant music provider.' },
  { id: 'scratch_practice', label: 'Scratch practice only', tone: 'amber', help: 'Useful for teaching or testing. Do not treat as competition-ready.' },
];

const PROOF_STATES = [
  { id: 'competition_ready', label: 'Competition-ready proof on file', tone: 'green' },
  { id: 'needs_license_proof', label: 'Needs license proof', tone: 'amber' },
  { id: 'practice_only', label: 'Practice only', tone: 'red' },
  { id: 'provider_pending', label: 'Provider pending', tone: 'teal' },
];

const ASSIGNMENT_ROLES = [
  { id: 'front', label: 'Front visual' },
  { id: 'flyer', label: 'Flyer' },
  { id: 'base', label: 'Base' },
  { id: 'backspot', label: 'Backspot' },
  { id: 'tumbler', label: 'Tumbler' },
  { id: 'jumper', label: 'Jumper' },
  { id: 'dancer', label: 'Dancer' },
  { id: 'alternate', label: 'Alternate' },
];

const AI_FLAVORS = [
  { id: 'cleaner', label: 'Cleaner' },
  { id: 'visual', label: 'Visual' },
  { id: 'safer', label: 'Safer' },
  { id: 'harder', label: 'Harder' },
  { id: 'easier', label: 'Easier' },
  { id: 'teach', label: 'Teach it' },
  { id: 'music', label: 'Music cue' },
];

const REMIX_WORKFLOWS = [
  { id: 'provider_handoff', label: 'Provider handoff', compliance: 'proof_required' },
  { id: 'scratch_practice', label: 'Scratch practice', compliance: 'practice_only' },
  { id: 'licensed_remix', label: 'Licensed remix', compliance: 'provider_documented' },
];

function routineUid(prefix) {
  if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function fmtFileSize(bytes) {
  const n = Number(bytes || 0);
  if (!n) return 'No file yet';
  if (n > 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}

function routineAudioMime(file) {
  const raw = String(file?.type || '').toLowerCase();
  if (raw && raw !== 'application/octet-stream') return raw;
  const name = String(file?.name || '').toLowerCase();
  if (name.endsWith('.mp3')) return 'audio/mpeg';
  if (name.endsWith('.m4a')) return 'audio/x-m4a';
  if (name.endsWith('.aac')) return 'audio/aac';
  if (name.endsWith('.wav')) return 'audio/wav';
  if (name.endsWith('.aif') || name.endsWith('.aiff')) return 'audio/aiff';
  if (name.endsWith('.ogg')) return 'audio/ogg';
  if (name.endsWith('.webm')) return 'audio/webm';
  if (name.endsWith('.mp4')) return 'audio/mp4';
  if (name.endsWith('.mov')) return 'video/quicktime';
  return raw || 'application/octet-stream';
}

function routineIsUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || ''));
}

function routineStorageProgramId(team) {
  const liveProfile = window.HZdb?.auth?._getSession?.()?.profile;
  return [liveProfile?.program_id, team?.program_id].find(routineIsUuid) || null;
}

async function invokeRoutineAudioWorker(jobId) {
  if (!window.HZ_FN_BASE || !window.HZ_ANON_KEY) throw new Error('Audio worker endpoint is not configured.');
  const res = await fetch(`${window.HZ_FN_BASE}/functions/v1/routine-audio-worker`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${window.HZ_ANON_KEY}`,
      apikey: window.HZ_ANON_KEY,
    },
    body: JSON.stringify({ job_id: jobId }),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload.error || `Audio worker failed with HTTP ${res.status}`);
  return payload;
}

async function createRoutineAudioSignedUpload(routineId, fileName) {
  if (!window.HZ_FN_BASE || !window.HZ_ANON_KEY) throw new Error('Audio upload broker is not configured.');
  const { data: authData, error: authError } = await window.HZsupa.auth.getSession();
  if (authError) throw authError;
  const token = authData?.session?.access_token;
  if (!token) throw new Error('Your sign-in session expired. Sign in again and retry the upload.');
  const res = await fetch(`${window.HZ_FN_BASE}/functions/v1/routine-audio-upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: window.HZ_ANON_KEY,
    },
    body: JSON.stringify({ routine_id: routineId, file_name: fileName }),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload.error || `Audio upload broker failed with HTTP ${res.status}`);
  return payload;
}

function fmtTime(seconds) {
  const n = Math.max(0, Number(seconds || 0));
  const m = Math.floor(n / 60);
  const s = Math.round(n % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function countToSeconds(count, countMap) {
  const bpm = Math.max(1, Number(countMap?.bpm || 144));
  const first = Number(countMap?.first_count_seconds || 0);
  return first + (Math.max(1, Number(count || 1)) - 1) * 8 * (60 / bpm);
}

function buildProviderBrief({ routine, team, audio, license, countMap, athletes, skills }) {
  const nameFor = (id) => athletes.find(a => a.id === id)?.display_name || athletes.find(a => a.id === id)?.name || 'Open athlete';
  const skillFor = (id) => skills.find(s => s.id === id)?.name || '';
  const lines = [];
  lines.push(`Hit Zero routine brief`);
  lines.push(`Team: ${team?.name || 'Team'} (${team?.division || 'division'} Level ${team?.level || ''})`);
  lines.push(`Routine: ${routine.name}`);
  lines.push(`Length: ${routine.length_counts} eight-counts / target BPM ${countMap?.bpm || routine.bpm || 144}`);
  lines.push(`Music mode: ${MUSIC_MODES.find(m => m.id === audio?.mode)?.label || 'Not selected'}`);
  lines.push(`Proof status: ${PROOF_STATES.find(s => s.id === license?.proof_status)?.label || 'Needs license proof'}`);
  if (license?.provider) lines.push(`Provider/source: ${license.provider}`);
  if (license?.track_title) lines.push(`Track/version: ${license.track_title}`);
  lines.push('');
  lines.push('Section cue sheet:');
  [...(routine.sections || [])].sort((a, b) => a.start_count - b.start_count).forEach((sec) => {
    const start = fmtTime(countToSeconds(sec.start_count, countMap));
    const end = fmtTime(countToSeconds(sec.end_count + 1, countMap));
    lines.push(`- 8-counts ${sec.start_count}-${sec.end_count} (${start}-${end}): ${sec.label || sec.section_type} [${sec.section_type}]`);
    (routine.formations || [])
      .filter(f => f.start_count <= sec.end_count && f.end_count >= sec.start_count)
      .forEach(f => lines.push(`  Formation: ${f.label} (${f.notes || 'coach-managed floor picture'})`));
    (routine.assignments || [])
      .filter(a => a.section_id === sec.id)
      .slice(0, 6)
      .forEach(a => lines.push(`  Assignment: ${nameFor(a.athlete_id)} - ${a.role || 'role'}${skillFor(a.skill_id) ? ` - ${skillFor(a.skill_id)}` : ''}${a.notes ? ` - ${a.notes}` : ''}`));
  });
  const accepted = (routine.aiSuggestions || []).filter(s => s.status === 'accepted');
  if (accepted.length) {
    lines.push('');
    lines.push('Accepted AI coach notes:');
    accepted.slice(0, 6).forEach(s => lines.push(`- ${s.title}: ${s.body}`));
  }
  lines.push('');
  lines.push('Provider notes:');
  lines.push(license?.notes || 'Use clear 8-count hits, coach-friendly transitions, and leave space for voiceover cues.');
  return lines.join('\n');
}

function buildRemixBrief({ routine, team, audio, license, countMap, remixRequest, analysisJob }) {
  const lines = [];
  lines.push('Hit Zero compliant remix handoff');
  lines.push(`Team: ${team?.name || 'Team'} (${team?.division || 'division'} Level ${team?.level || ''})`);
  lines.push(`Routine: ${routine.name}`);
  lines.push(`Workflow: ${REMIX_WORKFLOWS.find(w => w.id === remixRequest?.workflow_type)?.label || 'Provider handoff'}`);
  lines.push(`Compliance mode: ${remixRequest?.compliance_mode || 'proof_required'}`);
  lines.push(`Proof status: ${PROOF_STATES.find(s => s.id === license?.proof_status)?.label || 'Needs license proof'}`);
  if (license?.provider || remixRequest?.provider_name) lines.push(`Provider: ${remixRequest?.provider_name || license?.provider}`);
  if (license?.certificate_url) lines.push(`License/proof: ${license.certificate_url}`);
  lines.push('');
  lines.push('Important compliance guardrail: Hit Zero scratch or AI-generated planning output is practice-only until a provider/license proof is attached.');
  lines.push('');
  lines.push('Music direction:');
  lines.push(remixRequest?.style_prompt || 'High-energy cheer mix with clean 8-count accents, confident youth-friendly voiceover, and clear stunt/pyramid hits.');
  lines.push('');
  lines.push('Voiceover copy:');
  lines.push(remixRequest?.voiceover_script || 'Magic City. Hit Zero. Clean counts, big smiles, no panic.');
  lines.push('');
  lines.push('Count cue map:');
  [...(routine.sections || [])].sort((a, b) => a.start_count - b.start_count).forEach((sec) => {
    lines.push(`- Counts ${sec.start_count}-${sec.end_count} (${fmtTime(countToSeconds(sec.start_count, countMap))}-${fmtTime(countToSeconds(sec.end_count + 1, countMap))}): ${sec.label || sec.section_type}`);
  });
  const markers = analysisJob?.result_payload?.markers || countMap?.markers || [];
  if (markers.length) {
    lines.push('');
    lines.push('Detected/planned music hits:');
    markers.slice(0, 12).forEach((m) => lines.push(`- Count ${m.count}: ${m.kind || 'hit'} at ${fmtTime(m.seconds)}${m.energy ? ` / energy ${Math.round(m.energy * 100)}%` : ''}`));
  }
  return lines.join('\n');
}

function synthesizeAudioAnalysis({ routine, audio, countMap }) {
  const duration = Number(audio?.duration_seconds || countToSeconds(routine.length_counts + 1, countMap));
  const bpm = Number(countMap?.bpm || routine.bpm || 144);
  const eightCountSeconds = 8 * (60 / Math.max(1, bpm));
  const bars = Math.max(1, Math.ceil(Number(routine.length_counts || 0) / 8));
  const peaks = Array.from({ length: Math.min(96, bars * 4) }).map((_, i) => ({
    t: Number(Math.min(duration, i * eightCountSeconds / 4).toFixed(3)),
    value: Number((0.36 + ((i * 37) % 59) / 100).toFixed(2)),
  }));
  const markers = [...(routine.sections || [])].map((sec) => ({
    count: sec.start_count,
    seconds: Number(countToSeconds(sec.start_count, countMap).toFixed(3)),
    kind: sec.section_type === 'stunts' || sec.section_type === 'pyramid' ? 'major_hit' : 'section_start',
    label: sec.label || sec.section_type,
    energy: sec.section_type === 'dance' ? 0.92 : sec.section_type === 'transition' ? 0.45 : 0.76,
  }));
  return {
    engine: 'hit-zero-local-audio-contract-v1',
    duration_seconds: duration,
    bpm,
    first_count_seconds: Number(countMap?.first_count_seconds || 0),
    peaks,
    markers,
    worker_next: 'Replace this deterministic client analysis with a server worker using ffmpeg + librosa/aubio for waveform peaks, beat/downbeat, and energy curves.',
  };
}

function deriveComplianceChecks({ audio, license, remixRequest }) {
  const workflow = remixRequest?.workflow_type || audio?.mode || 'provider_handoff';
  const checks = [
    {
      check_key: 'competition_proof',
      label: 'Competition proof',
      status: license?.proof_status === 'competition_ready' && Boolean(license?.certificate_url) ? 'pass' : 'block',
      body: license?.proof_status === 'competition_ready' && license?.certificate_url
        ? 'License/certificate proof is attached.'
        : 'Do not mark competition-ready until provider/license proof is attached.',
      evidence_url: license?.certificate_url || '',
    },
    {
      check_key: 'provider_source',
      label: 'Provider/source named',
      status: license?.provider || remixRequest?.provider_name ? 'pass' : 'warn',
      body: license?.provider || remixRequest?.provider_name
        ? `Source: ${remixRequest?.provider_name || license?.provider}`
        : 'Name the provider or licensing source before sending this brief.',
      evidence_url: '',
    },
    {
      check_key: 'scratch_label',
      label: 'Scratch/AI label',
      status: workflow === 'scratch_practice' || license?.proof_status === 'practice_only' ? 'warn' : 'pass',
      body: workflow === 'scratch_practice' || license?.proof_status === 'practice_only'
        ? 'This is practice-only and must stay out of competition submission.'
        : 'Workflow is provider/proof oriented.',
      evidence_url: '',
    },
    {
      check_key: 'derivative_rights',
      label: 'Remix/derivative rights',
      status: remixRequest?.workflow_type === 'licensed_remix' && license?.certificate_url ? 'pass' : 'warn',
      body: remixRequest?.workflow_type === 'licensed_remix'
        ? 'Confirm the attached license explicitly allows edits/remix/derivative use.'
        : 'Provider handoff is safest unless remix rights are documented.',
      evidence_url: license?.certificate_url || '',
    },
  ];
  return checks;
}

function routineBuilderSuggestions(routine, predicted, countMap, license) {
  const countsByType = {};
  (routine.sections || []).forEach((s) => {
    countsByType[s.section_type] = (countsByType[s.section_type] || 0) + (s.end_count - s.start_count + 1);
  });
  const missing = ['standing_tumbling', 'running_tumbling', 'jumps', 'stunts', 'pyramid', 'dance'].filter(t => !countsByType[t]);
  const ideas = [];
  if (missing.length) {
    ideas.push({
      title: 'Close the scoring holes',
      body: `Missing lanes: ${missing.map(x => x.replace('_', ' ')).join(', ')}. Add short, clean blocks before chasing difficulty.`,
      tone: 'amber',
    });
  }
  if ((license?.proof_status || 'needs_license_proof') !== 'competition_ready') {
    ideas.push({
      title: 'Keep music compliance visible',
      body: 'This routine should stay provider-brief or practice-only until proof is attached. That protects the gym on competition day.',
      tone: 'red',
    });
  }
  if (Number(countMap?.confidence || 0) < 0.6) {
    ideas.push({
      title: 'Lock count 1 before choreo gets deep',
      body: 'The count map is still coach-seeded. Confirm the first downbeat and BPM so sections line up with the track.',
      tone: 'teal',
    });
  }
  const weak = [...(predicted?.rows || [])].sort((a, b) => a.score / a.max - b.score / b.max)[0];
  if (weak) {
    ideas.push({
      title: `AI focus: ${weak.label}`,
      body: `This is currently the softest score lane. Ask for a cleaner option here before adding flash somewhere else.`,
      tone: 'green',
    });
  }
  return ideas.slice(0, 4);
}

function routineDesignReadiness(routine, countMap, license) {
  const required = ['standing_tumbling', 'running_tumbling', 'jumps', 'stunts', 'pyramid', 'dance'];
  const byType = {};
  (routine.sections || []).forEach((s) => { byType[s.section_type] = true; });
  const variety = required.filter(t => byType[t]).length / required.length;
  const coverage = (routine.sections || []).reduce((sum, sec) => sum + (sec.end_count - sec.start_count + 1), 0) / Math.max(1, routine.length_counts || 1);
  const formationCoverage = (routine.formations || []).reduce((sum, f) => sum + (f.end_count - f.start_count + 1), 0) / Math.max(1, routine.length_counts || 1);
  const assignmentCoverage = Math.min(1, (routine.assignments || []).length / Math.max(1, (routine.sections || []).length));
  const countConfidence = Math.max(0, Math.min(1, Number(countMap?.confidence || 0)));
  const compliance = license?.proof_status === 'competition_ready' ? 1 : license?.proof_status === 'provider_pending' ? 0.75 : license?.proof_status === 'needs_license_proof' ? 0.45 : 0.2;
  return Math.max(0, Math.min(100, 28 + coverage * 20 + variety * 20 + formationCoverage * 10 + assignmentCoverage * 9 + countConfidence * 7 + compliance * 6));
}

function buildCountSheet({ routine, countMap, athletes, skills }) {
  const nameFor = (id) => athletes.find(a => a.id === id)?.display_name || 'Open athlete';
  const skillFor = (id) => skills.find(s => s.id === id)?.name || '';
  const lines = [`${routine.name} - 8-count sheet`, ''];
  [...(routine.sections || [])].sort((a, b) => a.start_count - b.start_count).forEach((sec) => {
    const time = `${fmtTime(countToSeconds(sec.start_count, countMap))}-${fmtTime(countToSeconds(sec.end_count + 1, countMap))}`;
    lines.push(`${sec.start_count}-${sec.end_count} | ${sec.label || sec.section_type} | ${time}`);
    if (sec.notes) lines.push(`Coach: ${sec.notes}`);
    (routine.assignments || []).filter(a => a.section_id === sec.id).forEach((a) => {
      lines.push(`  - ${nameFor(a.athlete_id)}: ${a.role || 'role'}${skillFor(a.skill_id) ? ` / ${skillFor(a.skill_id)}` : ''}${a.notes ? ` / ${a.notes}` : ''}`);
    });
    lines.push('');
  });
  return lines.join('\n');
}

function buildAthletePacket({ routine, athletes, skills }) {
  const skillFor = (id) => skills.find(s => s.id === id)?.name || '';
  const lines = [`${routine.name} - athlete packets`, ''];
  athletes.forEach((athlete) => {
    const rows = (routine.assignments || []).filter(a => a.athlete_id === athlete.id);
    if (!rows.length) return;
    lines.push(`${athlete.display_name}`);
    rows.forEach((a) => {
      const sec = (routine.sections || []).find(s => s.id === a.section_id);
      lines.push(`  Counts ${sec?.start_count || a.count_index}-${sec?.end_count || a.count_index}: ${a.role || 'role'}${skillFor(a.skill_id) ? ` - ${skillFor(a.skill_id)}` : ''}${a.notes ? ` (${a.notes})` : ''}`);
    });
    lines.push('');
  });
  return lines.join('\n');
}

function buildFormationCards({ routine, athletes }) {
  const nameFor = (id) => athletes.find(a => a.id === id)?.display_name || 'Athlete';
  const lines = [`${routine.name} - formation cards`, ''];
  [...(routine.formations || [])].sort((a, b) => a.start_count - b.start_count).forEach((formation) => {
    lines.push(`${formation.label || 'Formation'} | Counts ${formation.start_count}-${formation.end_count}`);
    if (formation.notes) lines.push(`Coach note: ${formation.notes}`);
    (routine.positions || []).filter(p => p.formation_id === formation.id).sort((a, b) => Number(a.y || 0) - Number(b.y || 0)).forEach((pos) => {
      lines.push(`  - ${nameFor(pos.athlete_id)}: ${Math.round(Number(pos.x || 0.5) * 100)}% across / ${Math.round(Number(pos.y || 0.5) * 100)}% depth${pos.role ? ` / ${pos.role}` : ''}`);
    });
    lines.push('');
  });
  return lines.join('\n') || `${routine.name} - formation cards\n\nNo formations created yet.`;
}

function buildPracticePlan({ routine, predicted, validation }) {
  const weakRows = [...(predicted?.rows || [])].sort((a, b) => (a.score / a.max) - (b.score / b.max)).slice(0, 3);
  const lines = [`Practice plan from ${routine.name}`, ''];
  lines.push('Warm-up: 12 min - jumps, motions, and count-in discipline.');
  weakRows.forEach((row, i) => {
    const section = (routine.sections || []).find(s => s.section_type === row.id || (row.id === 'routine' && s.section_type === 'transition'));
    lines.push(`${i + 1}. ${row.label}: 15 min - ${section ? `counts ${section.start_count}-${section.end_count}` : 'build or clean this lane'} - target ${(row.score / row.max * 100).toFixed(0)}% readiness.`);
  });
  validation.slice(0, 3).forEach((issue, i) => lines.push(`Fix ${i + 1}: ${issue.title} - ${issue.body}`));
  lines.push('Full-out close: 2 marked reps, 1 music rep, film the weakest section.');
  return lines.join('\n');
}

function validateRoutinePlan({ routine, countMap, license, athletes }) {
  const issues = [];
  const sectionIdsWithFormations = new Set();
  (routine.formations || []).forEach((f) => {
    (routine.sections || []).forEach((s) => {
      if (f.start_count <= s.end_count && f.end_count >= s.start_count) sectionIdsWithFormations.add(s.id);
    });
  });
  (routine.sections || []).forEach((s) => {
    if (!sectionIdsWithFormations.has(s.id)) issues.push({ severity: 'amber', title: `No formation for ${s.label || s.section_type}`, body: `Counts ${s.start_count}-${s.end_count} need a teachable floor picture.` });
    if (!(routine.assignments || []).some(a => a.section_id === s.id)) issues.push({ severity: 'amber', title: `No athlete ownership`, body: `${s.label || s.section_type} has no role/skill assignments yet.` });
  });
  if ((license?.proof_status || 'needs_license_proof') !== 'competition_ready' || !license?.certificate_url || !license?.provider) issues.push({ severity: 'red', title: 'Music proof not competition-ready', body: 'Attach provider/source and license proof before calling this routine complete.' });
  if (Number(countMap?.confidence || 0) < 0.6) issues.push({ severity: 'teal', title: 'Count map needs confirmation', body: 'Confirm BPM and count 1 so provider notes and teaching packets line up.' });
  const byAthlete = {};
  (routine.assignments || []).forEach(a => { byAthlete[a.athlete_id] = (byAthlete[a.athlete_id] || 0) + 1; });
  const heavy = Object.entries(byAthlete).filter(([, n]) => n >= 4).map(([id]) => athletes.find(a => a.id === id)?.display_name || 'Athlete');
  if (heavy.length) issues.push({ severity: 'amber', title: 'Fatigue watch', body: `${heavy.slice(0, 3).join(', ')} carry several moments. Check stamina and backup options.` });
  return issues.slice(0, 8);
}

function RoutineBuilder({ snap, navigate, pushToast }) {
  const routine = React.useMemo(() => window.HZsel.routine(), [snap._tick]);
  const team = React.useMemo(() => window.HZsel.team(), [snap._tick]);
  const [selected, setSelected] = React.useState(null);
  const [selectedFormationId, setSelectedFormationId] = React.useState(null);
  const [selectedPositionId, setSelectedPositionId] = React.useState(null);
  const [dragging, setDragging] = React.useState(null);
  const [positionDrag, setPositionDrag] = React.useState(null);
  const [assignmentDraft, setAssignmentDraft] = React.useState({ athlete_id: '', role: 'tumbler', skill_id: '', notes: '' });
  const [commentDraft, setCommentDraft] = React.useState('');
  const [activeOutput, setActiveOutput] = React.useState('count_sheet');
  const [loopingSection, setLoopingSection] = React.useState(false);
  const [remixDraft, setRemixDraft] = React.useState({
    workflow_type: 'provider_handoff',
    title: '',
    style_prompt: 'Bright, energetic all-star cheer mix with clear 8-count accents, sharp stunt hits, playful youth-friendly voiceover, and a confident dance finish.',
    voiceover_script: 'Magic City. Hit Zero. Tiny team, huge energy.',
    provider_name: '',
    provider_contact: '',
  });
  const [audioPreviewUrl, setAudioPreviewUrl] = React.useState(null);
  const [musicNotice, setMusicNotice] = React.useState(null);
  const [audioTime, setAudioTime] = React.useState(0);
  const [audioPlaying, setAudioPlaying] = React.useState(false);
  const [quickAthleteCount, setQuickAthleteCount] = React.useState(8);
  const [saving, setSaving] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [sectionEditorPulse, setSectionEditorPulse] = React.useState(false);
  const fileInputRef = React.useRef(null);
  const audioRef = React.useRef(null);
  const timelineRef = React.useRef(null);
  const formationBoardRef = React.useRef(null);
  const sectionEditorRef = React.useRef(null);
  const sectionLabelInputRef = React.useRef(null);

  React.useEffect(() => () => {
    if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
  }, [audioPreviewUrl]);

  if (!routine) return <EmptyState icon="routine" title="No routine yet" body="Start a routine for Magic."/>;

  const predicted = window.HZsel.predictedScore();
  const comp = window.HZsel.daysToComp();
  const audio = routine.audioAssets?.find(a => a.kind === 'primary_music') || routine.audioAssets?.[0] || null;
  const license = routine.licenses?.find(l => !audio || l.audio_asset_id === audio.id) || routine.licenses?.[0] || null;
  const countMap = routine.countMaps?.find(m => !audio || m.audio_asset_id === audio.id) || routine.countMaps?.[0] || { bpm: routine.bpm || 144, first_count_seconds: 0, confidence: 0 };
  const athletes = snap.athletes || [];
  const skills = snap.skills || [];
  const proofState = PROOF_STATES.find(s => s.id === (license?.proof_status || 'needs_license_proof')) || PROOF_STATES[1];
  const mode = MUSIC_MODES.find(m => m.id === (audio?.mode || 'provider_brief')) || MUSIC_MODES[1];
  const suggestions = routineBuilderSuggestions(routine, predicted, countMap, license);

  const cellWidth = 32;
  const gridWidth = routine.length_counts * cellWidth;
  const providerBrief = buildProviderBrief({ routine, team, audio, license, countMap, athletes, skills });
  const designReadiness = routineDesignReadiness(routine, countMap, license);
  const athleteName = (id) => athletes.find(a => a.id === id)?.display_name || athletes.find(a => a.id === id)?.name || 'Open athlete';
  const athleteInitials = (athlete) => athlete?.initials || String(athlete?.display_name || athlete?.name || '?').split(/\s+/).map(x => x[0]).join('').slice(0, 2).toUpperCase();
  const skillName = (id) => skills.find(s => s.id === id)?.name || '';
  const sectionForFormation = (formation) => (routine.sections || []).find(s => formation && formation.start_count <= s.end_count && formation.end_count >= s.start_count);
  const formationForSection = (section) => {
    if (!section) return null;
    return (routine.formations || [])
      .filter(f => f.start_count <= section.end_count && f.end_count >= section.start_count)
      .sort((a, b) => (b.end_count - b.start_count) - (a.end_count - a.start_count))[0] || null;
  };
  React.useEffect(() => {
    if (!dragging) return;
    const onMove = (e) => {
      const dx = e.clientX - dragging.startX;
      const delta = Math.round(dx / cellWidth);
      if (delta === 0) return;
      const sec = routine.sections.find(s => s.id === dragging.sectionId);
      if (!sec) return;
      let patch;
      if (dragging.edge === 'start') {
        patch = { start_count: Math.max(1, Math.min(sec.end_count, dragging.startCount + delta)) };
      } else if (dragging.edge === 'end') {
        patch = { end_count: Math.max(sec.start_count, Math.min(routine.length_counts, dragging.startCount + delta)) };
      } else if (dragging.edge === 'move') {
        const span = sec.end_count - sec.start_count;
        const newStart = Math.max(1, Math.min(routine.length_counts - span, dragging.startCount + delta));
        patch = { start_count: newStart, end_count: newStart + span };
      }
      if (patch) persistUpdate('routine_sections', sec.id, { ...patch, updated_at: new Date().toISOString() });
    };
    const onUp = () => setDragging(null);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [dragging, routine.sections.length, routine.length_counts]);

  React.useEffect(() => {
    if (!positionDrag) return;
    const onMove = (e) => {
      const board = formationBoardRef.current;
      if (!board) return;
      const rect = board.getBoundingClientRect();
      const x = Math.max(0.03, Math.min(0.97, (e.clientX - rect.left) / Math.max(1, rect.width)));
      const y = Math.max(0.05, Math.min(0.95, (e.clientY - rect.top) / Math.max(1, rect.height)));
      persistUpdate('routine_positions', positionDrag.positionId, { x, y });
    };
    const onUp = () => setPositionDrag(null);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [positionDrag]);

  const hasLiveSupabase = () => Boolean(window.HZsupa && window.HZdb?.auth?._getSession?.()?.mode === 'live');
  const remotePayload = (table, payload) => {
    const clean = { ...(payload || {}) };
    delete clean.local_object_url;
    if (table === 'routine_sections') delete clean.updated_at;
    if (table === 'routine_positions') delete clean.updated_at;
    return clean;
  };
  const syncRemote = async (table, action, payload, options = {}) => {
    if (!hasLiveSupabase()) return { data: null, error: null };
    try {
      const clean = remotePayload(table, payload);
      let req;
      if (action === 'insert') req = window.HZsupa.from(table).insert(clean);
      if (action === 'upsert') req = window.HZsupa.from(table).upsert(clean, options.onConflict ? { onConflict: options.onConflict } : undefined);
      if (action === 'update') req = window.HZsupa.from(table).update(clean).eq('id', options.id);
      if (action === 'delete') req = window.HZsupa.from(table).delete().eq('id', options.id);
      if (!req) return { data: null, error: null };
      const res = await req;
      if (res.error) throw res.error;
      return res;
    } catch (err) {
      console.warn(`[HZ] live sync failed for ${table}`, err);
      if (!options.silent) pushToast && pushToast({ kind: 'error', title: 'Supabase sync failed', body: `${table}: ${err.message || 'remote write failed'}` });
      return { data: null, error: err };
    }
  };
  const persistInsert = async (table, payload, options = {}) => {
    const res = await window.HZdb.from(table).insert(payload);
    const remote = !res.error ? await syncRemote(table, 'insert', payload, options) : null;
    return { ...res, remoteError: remote?.error || null };
  };
  const persistUpdate = async (table, id, patch, options = {}) => {
    const res = await window.HZdb.from(table).update(patch).eq('id', id);
    const remote = !res.error ? await syncRemote(table, 'update', patch, { ...options, id }) : null;
    return { ...res, remoteError: remote?.error || null };
  };
  const persistUpsert = async (table, payload, onConflict, options = {}) => {
    const res = await window.HZdb.from(table).upsert(payload, onConflict ? { onConflict } : undefined);
    const remote = !res.error ? await syncRemote(table, 'upsert', payload, { ...options, onConflict }) : null;
    return { ...res, remoteError: remote?.error || null };
  };
  const persistDelete = async (table, id, options = {}) => {
    const res = await window.HZdb.from(table).delete().eq('id', id);
    const remote = !res.error ? await syncRemote(table, 'delete', null, { ...options, id }) : null;
    return { ...res, remoteError: remote?.error || null };
  };

  const upsertAudio = async (patch, options = {}) => {
    const base = {
      id: audio?.id || routineUid('ra'),
      routine_id: routine.id,
      kind: 'primary_music',
      mode: audio?.mode || 'provider_brief',
      status: audio?.status || 'metadata_only',
      created_at: audio?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const res = await persistUpsert('routine_audio_assets', { ...base, ...patch }, 'routine_id,kind', options);
    if (res.error) throw res.error;
    const row = res.data?.[0] || { ...base, ...patch };
    if (res.remoteError) row._remoteError = res.remoteError;
    return row;
  };

  const upsertLicense = async (patch, audioId = audio?.id, options = {}) => {
    const base = {
      id: license?.id || routineUid('ml'),
      routine_id: routine.id,
      audio_asset_id: audioId || audio?.id || null,
      provider: license?.provider || '',
      track_title: license?.track_title || '',
      certificate_url: license?.certificate_url || '',
      proof_status: license?.proof_status || 'needs_license_proof',
      notes: license?.notes || '',
      created_at: license?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const res = await persistUpsert('music_licenses', { ...base, ...patch }, 'routine_id,audio_asset_id', options);
    if (res.error) throw res.error;
    return res;
  };

  const upsertCountMap = async (patch, audioId = audio?.id, options = {}) => {
    const base = {
      id: countMap?.id || routineUid('cm'),
      routine_id: routine.id,
      audio_asset_id: audioId || audio?.id || null,
      bpm: Number(countMap?.bpm || routine.bpm || 144),
      first_count_seconds: Number(countMap?.first_count_seconds || 0),
      confidence: Number(countMap?.confidence || 0.2),
      source: countMap?.source || 'coach_seed',
      corrections: countMap?.corrections || {},
      created_at: countMap?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const payload = { ...base, ...patch };
    const res = await persistUpsert('routine_count_maps', payload, 'routine_id,audio_asset_id', options);
    if (res.error) throw res.error;
    if (patch.bpm) await persistUpdate('routines', routine.id, { bpm: Number(patch.bpm) });
    return res;
  };

  const handleMusicFile = async (file) => {
    if (!file) return;
    setSaving(true);
    setMusicNotice(null);
    try {
      const issues = [];
      const nextUrl = URL.createObjectURL(file);
      if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
      setAudioPreviewUrl(nextUrl);
      const mime = routineAudioMime(file);
      const duration = await new Promise((resolve) => {
        const el = document.createElement('audio');
        el.preload = 'metadata';
        el.onloadedmetadata = () => resolve(Number.isFinite(el.duration) ? el.duration : null);
        el.onerror = () => resolve(null);
        el.src = nextUrl;
      });
      const savedAudio = await upsertAudio({
        mode: 'licensed_upload',
        original_filename: file.name,
        mime_type: mime,
        size_bytes: file.size,
        duration_seconds: duration,
        local_object_url: nextUrl,
        status: 'local_draft',
      }, { silent: true });
      if (savedAudio._remoteError) issues.push(`metadata sync: ${savedAudio._remoteError.message || 'remote write failed'}`);
      if (hasLiveSupabase() && file.size > 524288000) {
        issues.push('storage upload: file is over the 500 MB routine-audio limit');
      }
      if (hasLiveSupabase() && file.size <= 524288000) {
        const broker = await createRoutineAudioSignedUpload(routine.id, file.name);
        const storagePath = broker.path;
        const upload = await window.HZsupa.storage.from(broker.bucket || 'routine-audio').uploadToSignedUrl(storagePath, broker.token, file, {
          contentType: mime,
        });
        if (!upload.error) {
          const storageRes = await upsertAudio({ id: savedAudio.id, storage_path: storagePath, status: 'uploaded', mime_type: mime }, { silent: true });
          if (storageRes._remoteError) issues.push(`storage metadata sync: ${storageRes._remoteError.message || 'remote write failed'}`);
        } else {
          issues.push(`storage upload: ${upload.error.message}`);
        }
      }
      const licenseRes = await upsertLicense({ proof_status: 'needs_license_proof' }, savedAudio.id, { silent: true });
      if (licenseRes.remoteError) issues.push(`license sync: ${licenseRes.remoteError.message || 'remote write failed'}`);
      const countMapRes = await upsertCountMap({ audio_asset_id: savedAudio.id, confidence: 0.35, source: 'coach_upload' }, savedAudio.id, { silent: true });
      if (countMapRes.remoteError) issues.push(`count map sync: ${countMapRes.remoteError.message || 'remote write failed'}`);
      if (issues.length) {
        const body = issues.slice(0, 4).join(' | ');
        setMusicNotice({ kind: 'error', title: 'Music staged locally, cloud sync needs attention', body });
        pushToast && pushToast({ kind: 'error', title: 'Music staged locally, cloud sync needs attention', body, duration: 16000 });
      } else {
        setMusicNotice({ kind: 'success', title: 'Music staged', body: 'Track is uploaded, count mapping is ready, and proof still needs to be attached before competition use.' });
        pushToast && pushToast({ kind: 'success', title: 'Music staged', body: 'Track is ready for count mapping. Add proof before calling it competition-ready.' });
      }
    } catch (err) {
      const body = err.message || 'Try a different audio file.';
      setMusicNotice({ kind: 'error', title: 'Music setup failed', body });
      pushToast && pushToast({ kind: 'error', title: 'Music setup failed', body, duration: 16000 });
    } finally {
      setSaving(false);
    }
  };

  const runAudioAnalysis = async (jobType = 'beat_map') => {
    setSaving(true);
    try {
      const analysis = synthesizeAudioAnalysis({ routine, audio, countMap });
      const now = new Date().toISOString();
      const job = {
        id: routineUid('aaj'),
        routine_id: routine.id,
        audio_asset_id: audio?.id || null,
        job_type: jobType,
        status: hasLiveSupabase() ? 'queued' : 'ready',
        request_payload: {
          audio_asset_id: audio?.id || null,
          storage_path: audio?.storage_path || null,
          bpm: countMap?.bpm || routine.bpm || 144,
          first_count_seconds: countMap?.first_count_seconds || 0,
          sections: (routine.sections || []).map(s => ({ id: s.id, label: s.label, start_count: s.start_count, end_count: s.end_count, section_type: s.section_type })),
        },
        result_payload: analysis,
        created_at: now,
        updated_at: now,
      };
      const res = await persistInsert('routine_audio_analysis_jobs', job);
      if (res.error) throw res.error;
      let finalJob = job;
      if (hasLiveSupabase() && window.HZsupa?.auth) {
        try {
          const worker = await invokeRoutineAudioWorker(job.id);
          if (worker?.job) {
            finalJob = worker.job;
            await window.HZdb.from('routine_audio_analysis_jobs').update(finalJob).eq('id', finalJob.id);
          }
        } catch (workerErr) {
          finalJob = { ...job, status: 'ready', error_message: null, result_payload: analysis, updated_at: new Date().toISOString() };
          await persistUpdate('routine_audio_analysis_jobs', job.id, finalJob);
          console.warn('[HZ] audio worker fallback used', workerErr);
        }
      }
      const finalAnalysis = finalJob.result_payload || analysis;
      await upsertCountMap({
        confidence: Math.max(0.72, Number(countMap?.confidence || 0)),
        source: 'analysis',
        markers: finalAnalysis.markers,
        corrections: { ...(countMap?.corrections || {}), last_analysis_job_id: finalJob.id },
      }, audio?.id);
      pushToast && pushToast({ kind: 'success', title: 'Audio map ready', body: `${finalAnalysis.engine || 'Audio worker'} attached beat/energy markers to the routine.` });
    } catch (err) {
      pushToast && pushToast({ kind: 'error', title: 'Audio analysis failed', body: err.message || 'Could not create analysis job.' });
    } finally {
      setSaving(false);
    }
  };

  const saveRemixRequest = async (status = 'draft') => {
    const workflow = REMIX_WORKFLOWS.find(w => w.id === remixDraft.workflow_type) || REMIX_WORKFLOWS[0];
    const latestAnalysis = (routine.audioJobs || [])[0];
    const payload = {
      id: routineUid('rr'),
      routine_id: routine.id,
      audio_asset_id: audio?.id || null,
      music_license_id: license?.id || null,
      title: remixDraft.title || `${routine.name} ${workflow.label}`,
      workflow_type: workflow.id,
      status,
      compliance_mode: workflow.compliance,
      style_prompt: remixDraft.style_prompt,
      voiceover_script: remixDraft.voiceover_script,
      music_hit_map: latestAnalysis?.result_payload?.markers || countMap?.markers || [],
      provider_name: remixDraft.provider_name || license?.provider || '',
      provider_contact: remixDraft.provider_contact || '',
      payload: {
        routine_length_counts: routine.length_counts,
        proof_status: license?.proof_status || 'needs_license_proof',
        certificate_url: license?.certificate_url || '',
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const res = await persistInsert('routine_remix_requests', payload);
    if (res.error) {
      pushToast && pushToast({ kind: 'error', title: 'Remix request not saved', body: res.error.message });
      return null;
    }
    pushToast && pushToast({ kind: 'success', title: status === 'provider_ready' ? 'Provider handoff ready' : 'Remix workflow saved', body: payload.title });
    return payload;
  };

  const saveComplianceSnapshot = async (remixRequest = (routine.remixRequests || [])[0]) => {
    const checks = deriveComplianceChecks({ audio, license, remixRequest });
    const results = [];
    for (const check of checks) {
      const existing = (routine.complianceChecks || []).find(c => c.remix_request_id === (remixRequest?.id || null) && c.check_key === check.check_key);
      const payload = {
        id: existing?.id || routineUid('mcc'),
        routine_id: routine.id,
        remix_request_id: remixRequest?.id || null,
        ...check,
        updated_at: new Date().toISOString(),
        created_at: existing?.created_at || new Date().toISOString(),
      };
      const res = await persistUpsert('routine_music_compliance_checks', payload, 'routine_id,remix_request_id,check_key');
      results.push(res);
    }
    const failed = results.find(r => r.error);
    if (failed) pushToast && pushToast({ kind: 'error', title: 'Compliance snapshot failed', body: failed.error.message });
    else pushToast && pushToast({ kind: 'success', title: 'Compliance snapshot saved', body: 'Proof gates are attached to this routine workflow.' });
  };

  const addSection = async () => {
    const end = Math.max(...routine.sections.map(s => s.end_count), 0);
    const start = Math.max(1, Math.min(end + 1, Math.max(1, routine.length_counts - 3)));
    const payload = {
      id: routineUid('rs'),
      routine_id: routine.id,
      section_type: 'transition',
      label: 'New section',
      start_count: start,
      end_count: Math.min(start + 3, routine.length_counts),
      position: routine.sections.length,
      notes: '',
    };
    const res = await persistInsert('routine_sections', payload);
    if (res.error) pushToast && pushToast({ kind: 'error', title: 'Section not added', body: res.error.message });
  };

  const updateSection = async (id, patch) => {
    const res = await persistUpdate('routine_sections', id, { ...patch, updated_at: new Date().toISOString() });
    if (res.error) pushToast && pushToast({ kind: 'error', title: 'Section not saved', body: res.error.message });
  };

  const deleteSection = async (id) => {
    const res = await persistDelete('routine_sections', id);
    if (res.error) pushToast && pushToast({ kind: 'error', title: 'Section not deleted', body: res.error.message });
    else setSelected(null);
  };

  const addFormationFromSection = async (section = selectedSection) => {
    if (!section) {
      pushToast && pushToast({ kind: 'info', title: 'Pick a section first', body: 'Select a timeline block, then create a formation for those counts.' });
      return null;
    }
    setSelected(section.id);
    const existing = formationForSection(section);
    if (existing) {
      setSelectedFormationId(existing.id);
      return existing;
    }
    const payload = {
      id: routineUid('rf'),
      routine_id: routine.id,
      label: `${section.label || 'Section'} formation`,
      start_count: section.start_count,
      end_count: section.end_count,
      floor_width: 54,
      floor_depth: 42,
      notes: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const res = await persistInsert('routine_formations', payload);
    if (res.error) {
      pushToast && pushToast({ kind: 'error', title: 'Formation not created', body: res.error.message });
      return null;
    }
    setSelectedFormationId(payload.id);
    pushToast && pushToast({ kind: 'success', title: 'Formation added', body: 'Now drop athletes onto the mat and drag them into place.' });
    return payload;
  };

  const openSectionEditor = (section = selectedSection || liveSection) => {
    if (!section) {
      pushToast && pushToast({ kind: 'info', title: 'Pick a section first', body: 'Choose a section before editing its counts and notes.' });
      return;
    }
    setAudioPlaying(false);
    setSelected(section.id);
    const existing = formationForSection(section);
    setSelectedFormationId(existing?.id || '');
    setSectionEditorPulse(true);
    window.setTimeout(() => {
      sectionEditorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      sectionEditorRef.current?.focus?.({ preventScroll: true });
      window.setTimeout(() => sectionLabelInputRef.current?.focus?.({ preventScroll: true }), 260);
      window.setTimeout(() => setSectionEditorPulse(false), 1400);
    }, 0);
  };

  const updateFormation = async (id, patch) => {
    const res = await persistUpdate('routine_formations', id, { ...patch, updated_at: new Date().toISOString() });
    if (res.error) pushToast && pushToast({ kind: 'error', title: 'Formation not saved', body: res.error.message });
  };

  const addAthleteToFormation = async (athlete) => {
    let formation = selectedFormation;
    if (!formation) formation = await addFormationFromSection();
    if (!formation || !athlete) return;
    const already = (routine.positions || []).some(p => p.formation_id === formation.id && p.athlete_id === athlete.id);
    if (already) {
      pushToast && pushToast({ kind: 'info', title: 'Already on this mat', body: `${athlete.display_name} is already placed in this formation.` });
      return;
    }
    const used = (routine.positions || []).filter(p => p.formation_id === formation.id).length;
    const x = 0.18 + (used % 5) * 0.16;
    const y = 0.28 + Math.floor(used / 5) * 0.24;
    const res = await persistInsert('routine_positions', {
      id: routineUid('rp'),
      formation_id: formation.id,
      athlete_id: athlete.id,
      label: athleteInitials(athlete),
      x: Math.max(0.08, Math.min(0.92, x)),
      y: Math.max(0.10, Math.min(0.90, y)),
      role: athlete.role || 'athlete',
      created_at: new Date().toISOString(),
    });
    if (res.error) pushToast && pushToast({ kind: 'error', title: 'Athlete not placed', body: res.error.message });
  };

  const quickSpot = (index, total) => {
    const columns = Math.min(6, Math.max(3, Math.ceil(Math.sqrt(total))));
    const rows = Math.max(1, Math.ceil(total / columns));
    const col = index % columns;
    const row = Math.floor(index / columns);
    const stagger = row % 2 ? 0.5 / columns : 0;
    return {
      x: Math.max(0.09, Math.min(0.91, (col + 1 + stagger) / (columns + 1))),
      y: Math.max(0.12, Math.min(0.88, (row + 1) / (rows + 1))),
    };
  };

  const clampSpot = (spot) => ({
    x: Math.max(0.08, Math.min(0.92, Number(spot.x || 0.5))),
    y: Math.max(0.10, Math.min(0.90, Number(spot.y || 0.5))),
  });

  const cheerFlowSpot = (index, total, sectionType = 'transition') => {
    const type = String(sectionType || '').toLowerCase();
    if (type.includes('stunt') || type.includes('basket')) {
      const podSize = 4;
      const pod = Math.floor(index / podSize);
      const slot = index % podSize;
      const pods = Math.max(1, Math.ceil(total / podSize));
      const podX = (pod + 1) / (pods + 1);
      const podOffsets = [
        { x: 0, y: -0.09 },
        { x: -0.055, y: 0.035 },
        { x: 0.055, y: 0.035 },
        { x: 0, y: 0.13 },
      ];
      return clampSpot({
        x: podX + podOffsets[slot].x,
        y: 0.43 + podOffsets[slot].y + (pod % 2 ? 0.05 : 0),
      });
    }
    if (type.includes('pyramid')) {
      const center = Math.floor(total / 2);
      const side = index - center;
      const row = Math.min(3, Math.abs(side));
      return clampSpot({
        x: 0.5 + side * 0.07,
        y: 0.30 + row * 0.12 + (index % 2 ? 0.02 : 0),
      });
    }
    if (type.includes('tumbling')) {
      const columns = Math.min(6, Math.max(3, Math.ceil(total / 2)));
      const lane = index % columns;
      const wave = Math.floor(index / columns);
      return clampSpot({
        x: 0.12 + lane * (0.76 / Math.max(1, columns - 1)),
        y: type.includes('running') ? 0.25 + wave * 0.18 + (lane % 2 ? 0.08 : 0) : 0.30 + wave * 0.16,
      });
    }
    if (type.includes('jump')) {
      const columns = Math.min(7, Math.max(3, total));
      return clampSpot({
        x: 0.12 + (index % columns) * (0.76 / Math.max(1, columns - 1)),
        y: 0.44 + (index % 2 ? 0.14 : -0.06) + Math.floor(index / columns) * 0.12,
      });
    }
    const columns = Math.min(6, Math.max(3, Math.ceil(Math.sqrt(total))));
    const row = Math.floor(index / columns);
    const col = index % columns;
    const centered = col - (columns - 1) / 2;
    const vShape = Math.abs(centered) * 0.045;
    return clampSpot({
      x: 0.5 + centered * 0.13 + (row % 2 ? 0.055 : 0),
      y: 0.28 + row * 0.16 + vShape,
    });
  };

  const athleteRoleForSection = (athlete, section) => {
    const assignment = (routine.assignments || []).find(a => a.section_id === section?.id && a.athlete_id === athlete?.id);
    return String(assignment?.role || athlete?.role || 'athlete').toLowerCase();
  };

  const sectionRoleRank = (athlete, section) => {
    const role = athleteRoleForSection(athlete, section);
    const type = String(section?.section_type || '').toLowerCase();
    if (type.includes('stunt') || type.includes('basket') || type.includes('pyramid')) {
      if (role.includes('fly')) return 0;
      if (role.includes('back')) return 1;
      if (role.includes('base')) return 2;
      return 3;
    }
    if (type.includes('tumbling')) {
      if (role.includes('tumb')) return 0;
      if (role.includes('jump')) return 1;
      return 2;
    }
    return role.includes('dance') ? 0 : role.includes('jump') ? 1 : 2;
  };

  const pickOpenCheerSpot = (candidateIndex, projectedTotal, section, usedSpots) => {
    const candidates = [];
    for (let i = 0; i < Math.max(projectedTotal + 8, 12); i += 1) {
      candidates.push(cheerFlowSpot(candidateIndex + i, Math.max(projectedTotal, candidateIndex + i + 1), section?.section_type));
    }
    const open = candidates.find(spot => !usedSpots.some(used => Math.hypot(Number(used.x || 0.5) - spot.x, Number(used.y || 0.5) - spot.y) < 0.085));
    return open || candidates[0] || quickSpot(candidateIndex, projectedTotal);
  };

  const autoFlowOpenAthletes = async (section = selectedSection || liveSection) => {
    if (!section) {
      pushToast && pushToast({ kind: 'info', title: 'Pick a section first', body: 'Choose the section that needs a cheer-logical floor flow.' });
      return;
    }
    setSaving(true);
    try {
      const formation = await addFormationFromSection(section);
      if (!formation) return;
      const existingPositions = (routine.positions || []).filter(p => p.formation_id === formation.id);
      const existingAthleteIds = new Set(existingPositions.map(p => p.athlete_id).filter(Boolean));
      const missing = athletes
        .filter(a => !existingAthleteIds.has(a.id))
        .sort((a, b) => sectionRoleRank(a, section) - sectionRoleRank(b, section) || String(a.display_name || a.name || '').localeCompare(String(b.display_name || b.name || '')));
      if (!missing.length) {
        pushToast && pushToast({ kind: 'info', title: 'Everyone has a spot', body: `${formation.label || 'This formation'} already has every rostered athlete placed.` });
        return;
      }
      const projectedTotal = existingPositions.length + missing.length;
      const usedSpots = existingPositions.map(p => ({ x: Number(p.x || 0.5), y: Number(p.y || 0.5) }));
      for (let i = 0; i < missing.length; i += 1) {
        const athlete = missing[i];
        const spot = pickOpenCheerSpot(existingPositions.length + i, projectedTotal, section, usedSpots);
        usedSpots.push(spot);
        const res = await persistInsert('routine_positions', {
          id: routineUid('rp'),
          formation_id: formation.id,
          athlete_id: athlete.id,
          label: athleteInitials(athlete),
          x: spot.x,
          y: spot.y,
          role: athlete.role || athleteRoleForSection(athlete, section) || 'athlete',
          created_at: new Date().toISOString(),
        });
        if (res.error) throw res.error;
      }
      pushToast && pushToast({ kind: 'success', title: 'Auto-flow placed open athletes', body: `${missing.length} unassigned athletes moved into a ${section.label || section.section_type || 'section'} floor picture. Existing coach placements stayed put.` });
    } catch (err) {
      pushToast && pushToast({ kind: 'error', title: 'Auto-flow failed', body: err.message || 'Could not place open athletes.' });
    } finally {
      setSaving(false);
    }
  };

  const autoPopulateFormation = async (count = quickAthleteCount, section = selectedSection || liveSection) => {
    if (!section) {
      pushToast && pushToast({ kind: 'info', title: 'Pick a section first', body: 'Choose which part of the routine this floor picture belongs to.' });
      return;
    }
    setSaving(true);
    try {
      const formation = await addFormationFromSection(section);
      if (!formation) return;
      const existing = new Set((routine.positions || []).filter(p => p.formation_id === formation.id).map(p => p.athlete_id).filter(Boolean));
      const existingCount = existing.size;
      const chosen = athletes.filter(a => !existing.has(a.id)).slice(0, Math.max(0, Math.min(Number(count || 0), athletes.length) - existingCount));
      if (!chosen.length) {
        pushToast && pushToast({ kind: 'info', title: 'Formation already filled', body: `${formation.label || 'This formation'} already has ${existingCount} athletes on the mat.` });
        return;
      }
      for (let i = 0; i < chosen.length; i += 1) {
        const athlete = chosen[i];
        const spot = quickSpot(existingCount + i, Math.max(Number(count || 0), existingCount + chosen.length));
        const res = await persistInsert('routine_positions', {
          id: routineUid('rp'),
          formation_id: formation.id,
          athlete_id: athlete.id,
          label: athleteInitials(athlete),
          x: spot.x,
          y: spot.y,
          role: athlete.role || 'athlete',
          created_at: new Date().toISOString(),
        });
        if (res.error) throw res.error;
      }
      pushToast && pushToast({ kind: 'success', title: 'Floor picture created', body: `${Math.min(Number(count || 0), athletes.length)} athletes are staged for ${section.label || 'this section'}. Drag dots to fine-tune.` });
    } catch (err) {
      pushToast && pushToast({ kind: 'error', title: 'Formation not populated', body: err.message || 'Could not auto-place athletes.' });
    } finally {
      setSaving(false);
    }
  };

  const updatePosition = async (id, patch) => {
    const res = await persistUpdate('routine_positions', id, patch);
    if (res.error) pushToast && pushToast({ kind: 'error', title: 'Position not saved', body: res.error.message });
  };

  const removePosition = async (id) => {
    const res = await persistDelete('routine_positions', id);
    if (res.error) pushToast && pushToast({ kind: 'error', title: 'Position not removed', body: res.error.message });
    else setSelectedPositionId(null);
  };

  const saveAssignment = async () => {
    if (!selectedSection) {
      pushToast && pushToast({ kind: 'info', title: 'Pick a section first', body: 'Assignments attach to a routine section.' });
      return;
    }
    if (!assignmentDraft.athlete_id) {
      pushToast && pushToast({ kind: 'info', title: 'Choose an athlete', body: 'Select who owns this skill or role.' });
      return;
    }
    const res = await persistInsert('routine_assignments', {
      id: routineUid('ras'),
      routine_id: routine.id,
      section_id: selectedSection.id,
      athlete_id: assignmentDraft.athlete_id,
      skill_id: assignmentDraft.skill_id || null,
      role: assignmentDraft.role || 'athlete',
      count_index: selectedSection.start_count,
      notes: assignmentDraft.notes || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    if (res.error) pushToast && pushToast({ kind: 'error', title: 'Assignment not saved', body: res.error.message });
    else {
      setAssignmentDraft({ athlete_id: '', role: assignmentDraft.role || 'tumbler', skill_id: '', notes: '' });
      pushToast && pushToast({ kind: 'success', title: 'Assignment saved', body: 'That athlete now has clear ownership for this section.' });
    }
  };

  const generateSectionIdea = async (flavor = 'cleaner') => {
    if (!selectedSection) {
      pushToast && pushToast({ kind: 'info', title: 'Pick a section first', body: 'AI section ideas work best when they are scoped to specific counts.' });
      return;
    }
    const byFlavor = {
      cleaner: {
        title: `Cleaner ${selectedSection.label || 'section'} option`,
        body: `Simplify counts ${selectedSection.start_count}-${selectedSection.end_count} by reducing travel on the entry and using the strongest athletes as timing anchors.`,
        kind: 'section_alt',
        delta: 0.15,
        payload: { action: 'cleaner', counts: `${selectedSection.start_count}-${selectedSection.end_count}` },
      },
      visual: {
        title: `More visual picture`,
        body: `Add a two-count hold, then open the formation downstage so the judges get a clear picture before the transition.`,
        kind: 'formation_alt',
        delta: 0.25,
        payload: { action: 'more_visual', counts: `${selectedSection.start_count}-${selectedSection.end_count}` },
      },
      safer: {
        title: `Safer version to teach first`,
        body: `Teach this as a low-risk version first, then upgrade after two clean reps. This keeps confidence high without losing the count structure.`,
        kind: 'rules_check',
        delta: -0.1,
        payload: { action: 'safer', counts: `${selectedSection.start_count}-${selectedSection.end_count}` },
      },
      harder: {
        title: `Higher-difficulty option`,
        body: `Add one controlled upgrade only after the entry hits clean: make the end picture sharper before increasing travel or release difficulty.`,
        kind: 'score_note',
        delta: 0.35,
        payload: { action: 'harder', counts: `${selectedSection.start_count}-${selectedSection.end_count}` },
      },
      easier: {
        title: `Easier first-teach version`,
        body: `Keep the same counts but remove one transition layer so new athletes can learn the shape without panic.`,
        kind: 'teaching_note',
        delta: -0.15,
        payload: { action: 'easier', counts: `${selectedSection.start_count}-${selectedSection.end_count}` },
      },
      teach: {
        title: `Teaching progression`,
        body: `Teach counts ${selectedSection.start_count}-${selectedSection.end_count} in three chunks: mark positions, add skills without music, then loop the section with count-in.`,
        kind: 'teaching_note',
        delta: 0,
        payload: { action: 'teach', counts: `${selectedSection.start_count}-${selectedSection.end_count}` },
      },
      music: {
        title: `Music hit cue`,
        body: `Ask the provider for a clean accent at count ${selectedSection.start_count} and a lift/drop moment near count ${Math.min(selectedSection.end_count, selectedSection.start_count + 7)}.`,
        kind: 'music_cue',
        delta: 0.1,
        payload: { action: 'music_cue', counts: `${selectedSection.start_count}-${selectedSection.end_count}` },
      },
    };
    const idea = byFlavor[flavor] || byFlavor.cleaner;
    const res = await persistInsert('routine_ai_suggestions', {
      id: routineUid('rai'),
      routine_id: routine.id,
      section_id: selectedSection.id,
      kind: idea.kind,
      prompt: `Make counts ${selectedSection.start_count}-${selectedSection.end_count} ${flavor}.`,
      title: idea.title,
      body: idea.body,
      payload: idea.payload,
      score_delta: idea.delta,
      status: 'proposed',
      created_at: new Date().toISOString(),
    });
    if (res.error) pushToast && pushToast({ kind: 'error', title: 'AI idea not saved', body: res.error.message });
  };

  const resolveSuggestion = async (idea, status) => {
    const res = await persistUpdate('routine_ai_suggestions', idea.id, {
      status,
      resolved_at: new Date().toISOString(),
    });
    if (res.error) {
      pushToast && pushToast({ kind: 'error', title: 'Suggestion not updated', body: res.error.message });
      return;
    }
    if (status === 'accepted' && idea.section_id) {
      const sec = routine.sections.find(s => s.id === idea.section_id);
      if (sec) await updateSection(sec.id, { notes: `${sec.notes || ''}${sec.notes ? '\n' : ''}Accepted AI: ${idea.body}` });
    }
  };

  const copyBrief = async () => {
    try {
      await navigator.clipboard.writeText(providerBrief);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
      pushToast && pushToast({ kind: 'success', title: 'Provider brief copied', body: 'Counts, timing, and licensing notes are ready to send.' });
    } catch {
      pushToast && pushToast({ kind: 'error', title: 'Copy failed', body: 'Clipboard access was blocked by the browser.' });
    }
  };

  const saveExport = async (exportType, title, body) => {
    const payload = {
      id: routineUid('re'),
      routine_id: routine.id,
      export_type: exportType,
      title,
      payload: { body, generated_at: new Date().toISOString() },
      created_at: new Date().toISOString(),
    };
    const res = await persistInsert('routine_exports', payload);
    if (res.error) pushToast && pushToast({ kind: 'error', title: 'Export not saved', body: res.error.message });
    else pushToast && pushToast({ kind: 'success', title: 'Artifact saved', body: `${title} is now attached to this routine.` });
  };

  const createVersionSnapshot = async (status = 'draft') => {
    const nextNumber = (routine.versions || []).length + 1;
    const payload = {
      id: routineUid('rv'),
      routine_id: routine.id,
      title: `${routine.name} v${nextNumber}`,
      version_number: nextNumber,
      status,
      payload: {
        routine,
        readiness: designReadiness,
        created_from: 'routine_builder',
      },
      created_at: new Date().toISOString(),
      approved_at: status === 'approved' ? new Date().toISOString() : null,
    };
    const res = await persistInsert('routine_versions', payload);
    if (res.error) pushToast && pushToast({ kind: 'error', title: 'Version not saved', body: res.error.message });
    else pushToast && pushToast({ kind: 'success', title: status === 'approved' ? 'Routine approved' : 'Version snapshot saved', body: `${payload.title} captured with sections, formations, assignments, and notes.` });
  };

  const addRoutineComment = async () => {
    const body = commentDraft.trim();
    if (!body) return;
    const res = await persistInsert('routine_comments', {
      id: routineUid('rc'),
      routine_id: routine.id,
      section_id: selectedSection?.id || null,
      author_label: window.HZdb?.auth?._getSession?.()?.profile?.display_name || 'Coach',
      body,
      status: 'open',
      created_at: new Date().toISOString(),
    });
    if (res.error) pushToast && pushToast({ kind: 'error', title: 'Comment not saved', body: res.error.message });
    else setCommentDraft('');
  };

  const resolveComment = async (comment) => {
    await persistUpdate('routine_comments', comment.id, { status: 'resolved', resolved_at: new Date().toISOString() });
  };

  const selectedSection = routine.sections.find(s => s.id === selected);
  const selectedFormation = (routine.formations || []).find(f => f.id === selectedFormationId) || formationForSection(selectedSection) || (routine.formations || [])[0] || null;
  const selectedSectionAssignments = selectedSection ? (routine.assignments || []).filter(a => a.section_id === selectedSection.id) : [];
  const formationPositions = selectedFormation ? (routine.positions || []).filter(p => p.formation_id === selectedFormation.id) : [];
  const selectedPosition = (routine.positions || []).find(p => p.id === selectedPositionId) || null;
  const placedAthleteIds = new Set(formationPositions.map(p => p.athlete_id).filter(Boolean));
  const availableAthletes = athletes.filter(a => !placedAthleteIds.has(a.id));
  const activeSuggestions = (routine.aiSuggestions || []).filter(s => !selectedSection || s.section_id === selectedSection.id || !s.section_id);
  const coverage = routine.sections.reduce((s, sec) => s + (sec.end_count - sec.start_count + 1), 0) / Math.max(1, routine.length_counts);
  const byType = {};
  routine.sections.forEach(s => { byType[s.section_type] = (byType[s.section_type] || 0) + (s.end_count - s.start_count + 1); });
  const compositionRows = SECTION_TYPES
    .filter(t => !['opening', 'transition'].includes(t.id))
    .map(t => ({ ...t, count: byType[t.id] || 0 }));
  const validationIssues = validateRoutinePlan({ routine, countMap, license, athletes });
  const latestAnalysis = (routine.audioJobs || [])[0] || null;
  const latestRemixRequest = (routine.remixRequests || [])[0] || null;
  const countFromSeconds = (seconds) => {
    const bpm = Math.max(1, Number(countMap?.bpm || routine.bpm || 144));
    const first = Number(countMap?.first_count_seconds || 0);
    return Math.max(1, Math.min(routine.length_counts || 1, Math.floor((Number(seconds || 0) - first) / (8 * (60 / bpm))) + 1));
  };
  const liveCount = countFromSeconds(audioTime);
  const playheadSection = (routine.sections || []).find(s => liveCount >= s.start_count && liveCount <= s.end_count) || (routine.sections || [])[0] || null;
  const liveSection = audioPlaying ? playheadSection : (selectedSection || playheadSection);
  const liveDisplayCount = audioPlaying ? liveCount : Number(liveSection?.start_count || liveCount);
  const liveFormation = formationForSection(liveSection) || null;
  const liveFormationPositions = liveFormation ? (routine.positions || []).filter(p => p.formation_id === liveFormation.id) : [];
  const liveMarkers = (countMap?.markers || latestAnalysis?.result_payload?.markers || []).filter(m => Math.abs(Number(m.count || 0) - liveDisplayCount) <= 1).slice(0, 3);
  const audioProgress = Math.max(0, Math.min(1, Number(audioTime || 0) / Math.max(1, Number(audio?.duration_seconds || countToSeconds(routine.length_counts + 1, countMap)))));
  const quickFloorPresets = [8, 12, 16, 20].filter(n => n <= athletes.length);
  const quickFloorCount = Math.min(quickAthleteCount, athletes.length || quickAthleteCount);
  const complianceChecklist = deriveComplianceChecks({ audio, license, remixRequest: latestRemixRequest });
  const countSheet = buildCountSheet({ routine, countMap, athletes, skills });
  const athletePacket = buildAthletePacket({ routine, athletes, skills });
  const formationCards = buildFormationCards({ routine, athletes });
  const practicePlan = buildPracticePlan({ routine, predicted, validation: validationIssues });
  const remixBrief = buildRemixBrief({ routine, team, audio, license, countMap, remixRequest: latestRemixRequest || remixDraft, analysisJob: latestAnalysis });
  const analysisReport = latestAnalysis
    ? JSON.stringify(latestAnalysis.result_payload, null, 2)
    : 'No audio analysis job yet. Run Audio map to create waveform peaks, beat/count markers, and the worker-ready result contract.';
  const outputMap = {
    count_sheet: { title: 'Printable 8-count sheet', exportType: 'count_sheet', body: countSheet },
    formation_cards: { title: 'Formation cards', exportType: 'formation_cards', body: formationCards },
    athlete_packet: { title: 'Athlete packet', exportType: 'athlete_packet', body: athletePacket || 'No athlete assignments yet.' },
    practice_plan: { title: 'Practice plan', exportType: 'practice_plan', body: practicePlan },
    provider_brief: { title: 'Music provider brief', exportType: 'provider_brief', body: providerBrief },
    remix_brief: { title: 'Compliant remix brief', exportType: 'remix_brief', body: remixBrief },
    audio_analysis_report: { title: 'Audio analysis report', exportType: 'audio_analysis_report', body: analysisReport },
  };
  const activeArtifact = outputMap[activeOutput] || outputMap.count_sheet;
  const scoreLow = Math.max(0, predicted.total - validationIssues.length * 0.25 - (license?.proof_status === 'competition_ready' ? 0 : 0.75));
  const scoreHigh = Math.min(100, predicted.total + designReadiness / 100 * 2.4);

  return (
    <div>
      <SectionHeading eyebrow={`Coach routine lab - ${routine.length_counts} eight-counts - ${countMap.bpm || routine.bpm || 144} BPM`} title={routine.name + '.'} trailing={
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="hz-btn" onClick={() => fileInputRef.current?.click()} disabled={saving}><HZIcon name="music" size={13}/> Music</button>
          <button className="hz-btn" onClick={() => window.print()}><HZIcon name="print" size={13}/> Print sheet</button>
          <button className="hz-btn" onClick={addSection}><HZIcon name="plus" size={13}/> Section</button>
          <button className="hz-btn hz-btn-primary" onClick={() => navigate('score')}><HZIcon name="score" size={13}/> Mock Score</button>
          <input ref={fileInputRef} type="file" accept="audio/*" style={{ display: 'none' }} onChange={e => handleMusicFile(e.target.files?.[0])}/>
        </div>
      }/>

      <div className="routine-builder-setup" style={{ marginBottom: 24 }}>
        <div className="hz-card" style={{ padding: 24, overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', marginBottom: 18 }}>
            <div>
              <div className="hz-eyebrow">Music and count map</div>
              <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.04em', marginTop: 6 }}>{audio?.original_filename || 'No track attached yet'}</div>
              <div style={{ color: 'var(--hz-dim)', fontSize: 13, marginTop: 4 }}>{fmtFileSize(audio?.size_bytes)} {audio?.duration_seconds ? `- ${fmtTime(audio.duration_seconds)}` : ''}</div>
            </div>
            <span className={`hz-pill hz-pill-${proofState.tone}`}>{proofState.label}</span>
          </div>

              <div className="routine-builder-music-grid" style={{ marginBottom: 18 }}>
            <div>
              <div className="hz-label" style={{ color: 'var(--hz-dim)', marginBottom: 6 }}>Music mode</div>
              <select className="hz-input" value={audio?.mode || 'provider_brief'} onChange={async e => {
                const saved = await upsertAudio({ mode: e.target.value });
                await upsertLicense({ proof_status: e.target.value === 'scratch_practice' ? 'practice_only' : (license?.proof_status || 'needs_license_proof') }, saved.id);
              }}>
                {MUSIC_MODES.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <div className="hz-label" style={{ color: 'var(--hz-dim)', marginBottom: 6 }}>BPM</div>
              <input className="hz-input" type="number" min="60" max="220" value={countMap.bpm || routine.bpm || 144} onChange={e => upsertCountMap({ bpm: Number(e.target.value), confidence: 0.45, source: 'coach_edit' })}/>
            </div>
            <div>
              <div className="hz-label" style={{ color: 'var(--hz-dim)', marginBottom: 6 }}>Count 1 at</div>
              <input className="hz-input" type="number" min="0" step="0.1" value={countMap.first_count_seconds || 0} onChange={e => upsertCountMap({ first_count_seconds: Number(e.target.value), confidence: 0.55, source: 'coach_edit' })}/>
            </div>
          </div>

          {audioPreviewUrl ? (
            <audio
              ref={audioRef}
              controls
              src={audioPreviewUrl}
              style={{ width: '100%', marginBottom: 16 }}
              onTimeUpdate={e => setAudioTime(e.currentTarget.currentTime || 0)}
              onSeeked={e => setAudioTime(e.currentTarget.currentTime || 0)}
              onLoadedMetadata={e => setAudioTime(e.currentTarget.currentTime || 0)}
              onPlay={() => setAudioPlaying(true)}
              onPause={() => setAudioPlaying(false)}
              onEnded={() => setAudioPlaying(false)}
            />
          ) : (
            <div style={{ padding: 18, border: '1px dashed rgba(255,255,255,0.18)', borderRadius: 14, color: 'var(--hz-dim)', marginBottom: 16 }}>
              Upload an audio file to preview here. Until then, this routine can still be built as a provider brief.
            </div>
          )}

          <div className="routine-live-visualizer">
            <div className="routine-live-head">
              <div>
                <div className="hz-eyebrow">Live formation visualizer</div>
                <div className="routine-live-title">
                  Count {liveDisplayCount} · {liveSection?.label || 'No section selected'}
                </div>
                <div className="routine-live-sub">
                  {liveFormation ? `${liveFormation.label || 'Formation'} · ${liveFormationPositions.length} athletes on mat` : 'Create a formation below, then this mat follows the music.'}
                </div>
              </div>
              <div className="routine-live-clock">
                <b>{fmtTime(audioTime)}</b>
                <span>{Math.round(audioProgress * 100)}%</span>
              </div>
            </div>
            <div className="routine-live-progress">
              <span style={{ width: `${audioProgress * 100}%` }}/>
            </div>
            <div className="routine-live-controls">
              <div>
                <div className="hz-label" style={{ color: 'var(--hz-dim)', marginBottom: 6 }}>Build this section</div>
                <select className="hz-input" value={liveSection?.id || ''} onChange={e => {
                  setAudioPlaying(false);
                  setSelected(e.target.value);
                  const next = (routine.sections || []).find(s => s.id === e.target.value);
                  const existing = formationForSection(next);
                  setSelectedFormationId(existing?.id || '');
                  if (next && audioRef.current) {
                    audioRef.current.currentTime = countToSeconds(next.start_count, countMap);
                    setAudioTime(audioRef.current.currentTime || 0);
                  }
                }}>
                  {(routine.sections || []).map(s => <option key={s.id} value={s.id}>{s.label || s.section_type} · counts {s.start_count}-{s.end_count}</option>)}
                </select>
              </div>
              <div>
                <div className="hz-label" style={{ color: 'var(--hz-dim)', marginBottom: 6 }}>Quick floor</div>
                <div className="routine-quick-counts">
                  {quickFloorPresets.map(n => (
                    <button key={n} className={`hz-btn hz-btn-xs ${quickAthleteCount === n ? 'hz-btn-primary' : ''}`} onClick={() => setQuickAthleteCount(n)}>{n}</button>
                  ))}
                  <button className={`hz-btn hz-btn-xs ${quickAthleteCount === athletes.length ? 'hz-btn-primary' : ''}`} onClick={() => setQuickAthleteCount(athletes.length)}>{quickFloorPresets.length ? 'All' : Math.max(athletes.length, 1)}</button>
                </div>
              </div>
              <div className="routine-live-action-stack">
                <button className="hz-btn hz-btn-primary routine-live-build-btn" onClick={() => autoPopulateFormation(quickAthleteCount, liveSection)} disabled={saving || !liveSection}>
                  Auto-place {quickFloorCount}
                </button>
                <button className="hz-btn routine-live-build-btn" onClick={() => autoFlowOpenAthletes(liveSection)} disabled={saving || !liveSection || !athletes.length}>
                  Auto-flow open athletes
                </button>
              </div>
            </div>
            <div className="routine-live-stage">
              <div className="routine-formation-centerline"/>
              <div className="routine-formation-front">Front / judges</div>
              {liveFormationPositions.map((pos) => {
                const athlete = athletes.find(a => a.id === pos.athlete_id);
                return (
                  <button
                    key={pos.id}
                    className="routine-athlete-dot routine-athlete-dot-live"
                    onClick={() => { setSelectedFormationId(liveFormation.id); setSelectedPositionId(pos.id); }}
                    style={{ left: `${Number(pos.x || 0.5) * 100}%`, top: `${Number(pos.y || 0.5) * 100}%` }}
                    title={`${athleteName(pos.athlete_id)} - ${pos.role || 'athlete'}`}
                  >
                    {pos.label || athleteInitials(athlete)}
                  </button>
                );
              })}
              {!liveFormationPositions.length && (
                <div className="routine-live-empty">
                  Select a section and add athletes to its formation board. This space becomes the coach view for where every girl should be on the music.
                </div>
              )}
            </div>
            <div className="routine-live-footer">
              <span>{liveMarkers.length ? liveMarkers.map(m => `${m.kind || 'hit'} @ ${fmtTime(m.seconds || countToSeconds(m.count, countMap))}`).join(' · ') : 'No music hit marker on this count yet.'}</span>
              <button className="hz-btn hz-btn-xs" onClick={() => openSectionEditor(liveSection)}>Edit this section</button>
            </div>
          </div>

          {musicNotice && (
            <div className={`routine-upload-notice routine-upload-notice-${musicNotice.kind}`} style={{ marginBottom: 16 }}>
              <b>{musicNotice.title}</b>
              <span>{musicNotice.body}</span>
            </div>
          )}

          <div className="routine-music-console">
            <div>
              <div className="hz-eyebrow">Playback planning</div>
              <div style={{ color: 'var(--hz-dim)', fontSize: 12, marginTop: 4 }}>
                {selectedSection ? `Loop ${selectedSection.label || 'selected section'} at ${fmtTime(countToSeconds(selectedSection.start_count, countMap))}` : 'Select a section to loop, slow down, and teach against counts.'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className={`hz-btn hz-btn-sm ${loopingSection ? 'hz-btn-primary' : ''}`} onClick={() => setLoopingSection(!loopingSection)} disabled={!selectedSection}>Loop section</button>
              <button className="hz-btn hz-btn-sm" onClick={() => pushToast && pushToast({ kind: 'info', title: 'Count-in', body: 'Count-in/metronome is staged here; server/audio worker is the next infrastructure step.' })}>8-count in</button>
              <button className="hz-btn hz-btn-sm" onClick={() => generateSectionIdea('music')} disabled={!selectedSection}>Mark music hit</button>
              <button className="hz-btn hz-btn-sm hz-btn-primary" onClick={() => runAudioAnalysis('beat_map')} disabled={saving}>Audio map</button>
            </div>
            <div className="routine-waveform-strip">
              {Array.from({ length: 48 }).map((_, i) => (
                <span key={i} style={{ height: `${18 + ((i * 17) % 38)}px`, opacity: (i + 1) % 8 === 0 ? 0.95 : 0.42 }}/>
              ))}
            </div>
          </div>

          <div ref={timelineRef} className="hz-scroll" style={{ overflowX: 'auto', paddingBottom: 8 }}>
            <div style={{ width: gridWidth, minWidth: '100%', position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'end', height: 54, gap: 0, padding: '0 0 8px' }}>
                {Array.from({ length: routine.length_counts }).map((_, i) => {
                  const h = 12 + Math.round((Math.sin((i + 1) * 1.7) + 1) * 14) + (((i + 1) % 8 === 0) ? 10 : 0);
                  return <div key={i} style={{ width: cellWidth, height: h, borderRadius: '4px 4px 0 0', background: (i + 1) % 8 === 0 ? 'rgba(39,207,215,0.48)' : 'rgba(255,255,255,0.12)' }}/>;
                })}
              </div>
              <div style={{ display: 'flex', height: 20, marginBottom: 6 }}>
                {Array.from({ length: routine.length_counts }).map((_, i) => {
                  const isMajor = (i + 1) % 8 === 0 || i === 0;
                  return (
                    <div key={i} style={{ width: cellWidth, textAlign: 'center', fontSize: 10, fontFamily: 'var(--hz-mono)', color: isMajor ? '#fff' : 'var(--hz-dimmer)', borderLeft: isMajor ? '1px solid rgba(255,255,255,0.1)' : 'none', paddingTop: 4 }}>
                      {i + 1}
                    </div>
                  );
                })}
              </div>

              <div style={{ position: 'relative', height: 136, background: 'var(--hz-ink)', borderRadius: 14 }}>
                {Array.from({ length: routine.length_counts }).map((_, i) => (
                  <div key={i} style={{ position: 'absolute', left: i * cellWidth, top: 0, bottom: 0, width: 1, background: (i + 1) % 8 === 0 ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.02)' }}/>
                ))}
                {routine.sections.map((s) => {
                  const color = SECTION_COLORS[s.section_type] || SECTION_COLORS.transition;
                  const left = (s.start_count - 1) * cellWidth;
                  const width = (s.end_count - s.start_count + 1) * cellWidth;
                  const isSelected = selected === s.id;
                  const timeRange = `${fmtTime(countToSeconds(s.start_count, countMap))}-${fmtTime(countToSeconds(s.end_count + 1, countMap))}`;
                  return (
                    <div
                      key={s.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelected(s.id)}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setSelected(s.id); }}
                      style={{
                        position: 'absolute',
                        left, width, top: 8, bottom: 8,
                        background: color.bg,
                        border: `1.5px solid ${isSelected ? '#fff' : color.border}`,
                        borderRadius: 10,
                        padding: '8px 10px',
                        cursor: 'pointer',
                        overflow: 'hidden',
                        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                        transition: 'border-color 120ms',
                      }}
                    >
                      <div onPointerDown={(e) => { e.stopPropagation(); setDragging({ sectionId: s.id, edge: 'move', startX: e.clientX, startCount: s.start_count }); }} style={{ cursor: 'grab', fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {s.label || s.section_type}
                      </div>
                      <div style={{ fontSize: 9, fontFamily: 'var(--hz-mono)', color: 'var(--hz-dim)', whiteSpace: 'nowrap' }}>
                        8-counts {s.start_count}-{s.end_count} - {timeRange}
                      </div>
                      <div onPointerDown={(e) => { e.stopPropagation(); setDragging({ sectionId: s.id, edge: 'start', startX: e.clientX, startCount: s.start_count }); }}
                        style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 9, cursor: 'ew-resize', touchAction: 'none' }}/>
                      <div onPointerDown={(e) => { e.stopPropagation(); setDragging({ sectionId: s.id, edge: 'end', startX: e.clientX, startCount: s.end_count }); }}
                        style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 9, cursor: 'ew-resize', touchAction: 'none' }}/>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="hz-card" style={{ padding: 22 }}>
          <div className="hz-eyebrow">Compliance and handoff</div>
          <div style={{ marginTop: 12, display: 'grid', gap: 12 }}>
            <div>
              <div className="hz-label" style={{ color: 'var(--hz-dim)', marginBottom: 6 }}>Proof status</div>
              <select className="hz-input" value={license?.proof_status || 'needs_license_proof'} onChange={e => upsertLicense({ proof_status: e.target.value })}>
                {PROOF_STATES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <div className="hz-label" style={{ color: 'var(--hz-dim)', marginBottom: 6 }}>Provider / source</div>
              <input className="hz-input" placeholder="CheerSounds, ClicknClear, IPP..." value={license?.provider || ''} onChange={e => upsertLicense({ provider: e.target.value })}/>
            </div>
            <div>
              <div className="hz-label" style={{ color: 'var(--hz-dim)', marginBottom: 6 }}>Track / version</div>
              <input className="hz-input" placeholder="Mini L1 comp mix v1" value={license?.track_title || ''} onChange={e => upsertLicense({ track_title: e.target.value })}/>
            </div>
            <div>
              <div className="hz-label" style={{ color: 'var(--hz-dim)', marginBottom: 6 }}>Certificate / receipt URL</div>
              <input className="hz-input" placeholder="Paste proof link when available" value={license?.certificate_url || ''} onChange={e => upsertLicense({ certificate_url: e.target.value })}/>
            </div>
            <div>
              <div className="hz-label" style={{ color: 'var(--hz-dim)', marginBottom: 6 }}>Provider notes</div>
              <textarea className="hz-input" rows="4" placeholder="Voiceover, hit accents, style notes..." value={license?.notes || ''} onChange={e => upsertLicense({ notes: e.target.value })}/>
            </div>
          </div>
          <div style={{ marginTop: 14, padding: 12, background: 'rgba(255,255,255,0.035)', borderRadius: 12, color: 'var(--hz-dim)', fontSize: 12, lineHeight: 1.5 }}>
            <b style={{ color: '#fff' }}>{mode.label}:</b> {mode.help}
          </div>

          <div className="routine-remix-console">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'start' }}>
              <div>
                <div className="hz-eyebrow">Audio worker contract</div>
                <div style={{ color: 'var(--hz-dim)', fontSize: 12, marginTop: 4 }}>
                  {latestAnalysis ? `${latestAnalysis.job_type} ${latestAnalysis.status} - ${latestAnalysis.result_payload?.markers?.length || 0} markers` : 'No analysis job yet. Create a beat/energy map before provider handoff.'}
                </div>
              </div>
              <button className="hz-btn hz-btn-sm" onClick={() => runAudioAnalysis('remix_prep')} disabled={saving}>Prep worker job</button>
            </div>
            <div className="routine-compliance-grid">
              <div>
                <div className="hz-label" style={{ color: 'var(--hz-dim)', marginBottom: 6 }}>Workflow</div>
                <select className="hz-input" value={remixDraft.workflow_type} onChange={e => {
                  const workflow = REMIX_WORKFLOWS.find(w => w.id === e.target.value) || REMIX_WORKFLOWS[0];
                  setRemixDraft({ ...remixDraft, workflow_type: workflow.id });
                  if (workflow.id === 'scratch_practice') upsertLicense({ proof_status: 'practice_only' });
                  if (workflow.id === 'provider_handoff' && license?.proof_status === 'practice_only') upsertLicense({ proof_status: 'provider_pending' });
                }}>
                  {REMIX_WORKFLOWS.map(w => <option key={w.id} value={w.id}>{w.label}</option>)}
                </select>
              </div>
              <div>
                <div className="hz-label" style={{ color: 'var(--hz-dim)', marginBottom: 6 }}>Provider contact</div>
                <input className="hz-input" placeholder="music@provider.com" value={remixDraft.provider_contact} onChange={e => setRemixDraft({ ...remixDraft, provider_contact: e.target.value })}/>
              </div>
            </div>
            <div style={{ marginTop: 10 }}>
              <div className="hz-label" style={{ color: 'var(--hz-dim)', marginBottom: 6 }}>Remix direction</div>
              <textarea className="hz-input" rows="3" value={remixDraft.style_prompt} onChange={e => setRemixDraft({ ...remixDraft, style_prompt: e.target.value })}/>
            </div>
            <div style={{ marginTop: 10 }}>
              <div className="hz-label" style={{ color: 'var(--hz-dim)', marginBottom: 6 }}>Voiceover script</div>
              <textarea className="hz-input" rows="2" value={remixDraft.voiceover_script} onChange={e => setRemixDraft({ ...remixDraft, voiceover_script: e.target.value })}/>
            </div>
            <div className="routine-compliance-grid" style={{ marginTop: 10 }}>
              <button className="hz-btn" onClick={() => saveRemixRequest('draft')}>Save remix workflow</button>
              <button className="hz-btn hz-btn-primary" onClick={async () => {
                const req = await saveRemixRequest('provider_ready');
                if (req) {
                  await saveComplianceSnapshot(req);
                  await saveExport('remix_brief', 'Compliant remix brief', buildRemixBrief({ routine, team, audio, license, countMap, remixRequest: req, analysisJob: latestAnalysis }));
                }
              }}>Generate provider packet</button>
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <div className="hz-eyebrow" style={{ marginBottom: 8 }}>Compliance gates</div>
            <div style={{ display: 'grid', gap: 8 }}>
              {complianceChecklist.map((check) => (
                <div key={check.check_key} className={`routine-validation-row routine-validation-${check.status === 'block' ? 'red' : check.status === 'pass' ? 'green' : 'amber'}`}>
                  <b>{check.label}</b>
                  <span>{check.body}</span>
                </div>
              ))}
            </div>
            <button className="hz-btn hz-btn-sm" style={{ marginTop: 10 }} onClick={() => saveComplianceSnapshot()}>Save compliance snapshot</button>
          </div>
        </div>
      </div>

      <div className="routine-builder-main">
        <div style={{ display: 'grid', gap: 18, alignContent: 'start' }}>
        <div ref={sectionEditorRef} tabIndex={-1} className={`hz-card routine-section-editor-card ${sectionEditorPulse ? 'routine-section-editor-card-active' : ''}`} data-testid="routine-section-editor">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'center', marginBottom: 16 }}>
            <div>
              <div className="hz-eyebrow">Section editor</div>
              <div style={{ color: 'var(--hz-dim)', fontSize: 12, marginTop: 4 }}>Coverage {Math.round(coverage * 100)}% - {routine.sections.length} sections</div>
            </div>
            <button className="hz-btn hz-btn-sm" onClick={addSection}><HZIcon name="plus" size={12}/> Add block</button>
          </div>

          {selectedSection ? (
            <div>
              <div className="routine-builder-section-form" style={{ marginBottom: 16 }}>
                <div>
                  <div className="hz-label" style={{ color: 'var(--hz-dim)', marginBottom: 6 }}>Label</div>
                  <input ref={sectionLabelInputRef} className="hz-input" value={selectedSection.label || ''} onChange={e => updateSection(selectedSection.id, { label: e.target.value })}/>
                </div>
                <div>
                  <div className="hz-label" style={{ color: 'var(--hz-dim)', marginBottom: 6 }}>Type</div>
                  <select className="hz-input" value={selectedSection.section_type} onChange={e => updateSection(selectedSection.id, { section_type: e.target.value })}>
                    {SECTION_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <div className="hz-label" style={{ color: 'var(--hz-dim)', marginBottom: 6 }}>Start count</div>
                  <input type="number" min="1" max={routine.length_counts} className="hz-input" value={selectedSection.start_count} onChange={e => updateSection(selectedSection.id, { start_count: +e.target.value })}/>
                </div>
                <div>
                  <div className="hz-label" style={{ color: 'var(--hz-dim)', marginBottom: 6 }}>End count</div>
                  <input type="number" min={selectedSection.start_count} max={routine.length_counts} className="hz-input" value={selectedSection.end_count} onChange={e => updateSection(selectedSection.id, { end_count: +e.target.value })}/>
                </div>
              </div>
              <div>
                <div className="hz-label" style={{ color: 'var(--hz-dim)', marginBottom: 6 }}>Coach notes</div>
                <textarea className="hz-input" rows="3" placeholder="Teaching cues, formation notes, music hit..." value={selectedSection.notes || ''} onChange={e => updateSection(selectedSection.id, { notes: e.target.value })}/>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                <button className="hz-btn hz-btn-danger" onClick={() => deleteSection(selectedSection.id)}><HZIcon name="trash" size={13}/> Delete</button>
              </div>
            </div>
          ) : (
            <div style={{ color: 'var(--hz-dim)', padding: 20, fontSize: 13, background: 'rgba(255,255,255,0.025)', borderRadius: 12 }}>
              Click a block on the timeline to edit it. Drag the body to move. Drag edges to resize. Works with pointer events for iPad/PWA.
            </div>
          )}

          <div style={{ marginTop: 28 }}>
            <div className="hz-eyebrow" style={{ marginBottom: 10 }}>All sections</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[...routine.sections].sort((a,b) => a.start_count - b.start_count).map(s => {
                const color = SECTION_COLORS[s.section_type] || SECTION_COLORS.transition;
                return (
                  <button key={s.id} onClick={() => setSelected(s.id)} className="hz-btn" style={{
                    display: 'grid', gridTemplateColumns: '8px 118px 1fr 104px', alignItems: 'center', gap: 12,
                    padding: '10px 12px', borderRadius: 10, width: '100%', textAlign: 'left',
                    background: selected === s.id ? 'rgba(255,255,255,0.06)' : 'transparent',
                  }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: color.dot }}/>
                    <span style={{ fontSize: 12, textTransform: 'capitalize', color: 'var(--hz-dim)' }}>{s.section_type.replace('_',' ')}</span>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{s.label}</span>
                    <span style={{ fontFamily: 'var(--hz-mono)', fontSize: 11, color: 'var(--hz-dim)', textAlign: 'right' }}>
                      {s.start_count}-{s.end_count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

          <div className="hz-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'center', marginBottom: 16 }}>
              <div>
                <div className="hz-eyebrow">Formation board</div>
                <div style={{ color: 'var(--hz-dim)', fontSize: 12, marginTop: 4 }}>
                  {selectedFormation ? `Counts ${selectedFormation.start_count}-${selectedFormation.end_count} - ${formationPositions.length} athletes placed` : 'Create a formation from the selected section.'}
                </div>
              </div>
              <button className="hz-btn hz-btn-sm" onClick={addFormationFromSection}><HZIcon name="plus" size={12}/> Formation</button>
            </div>

            {selectedFormation ? (
              <>
                <div className="routine-builder-section-form" style={{ marginBottom: 14 }}>
                  <div>
                    <div className="hz-label" style={{ color: 'var(--hz-dim)', marginBottom: 6 }}>Formation name</div>
                    <input className="hz-input" value={selectedFormation.label || ''} onChange={e => updateFormation(selectedFormation.id, { label: e.target.value })}/>
                  </div>
                  <div>
                    <div className="hz-label" style={{ color: 'var(--hz-dim)', marginBottom: 6 }}>Counts</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <input className="hz-input" type="number" min="1" max={routine.length_counts} value={selectedFormation.start_count} onChange={e => updateFormation(selectedFormation.id, { start_count: +e.target.value })}/>
                      <input className="hz-input" type="number" min={selectedFormation.start_count} max={routine.length_counts} value={selectedFormation.end_count} onChange={e => updateFormation(selectedFormation.id, { end_count: +e.target.value })}/>
                    </div>
                  </div>
                </div>

                <div
                  ref={formationBoardRef}
                  className="routine-formation-board"
                  aria-label="Routine formation mat"
                >
                  <div className="routine-formation-centerline"/>
                  <div className="routine-formation-front">Front / judges</div>
                  {formationPositions.map((pos) => {
                    const athlete = athletes.find(a => a.id === pos.athlete_id);
                    const active = selectedPositionId === pos.id;
                    return (
                      <button
                        key={pos.id}
                        className={`routine-athlete-dot ${active ? 'active' : ''}`}
                        onClick={() => setSelectedPositionId(pos.id)}
                        onPointerDown={(e) => { e.preventDefault(); setSelectedPositionId(pos.id); setPositionDrag({ positionId: pos.id }); }}
                        style={{ left: `${Number(pos.x || 0.5) * 100}%`, top: `${Number(pos.y || 0.5) * 100}%` }}
                        title={`${athleteName(pos.athlete_id)} - ${pos.role || 'athlete'}`}
                      >
                        {pos.label || athleteInitials(athlete)}
                      </button>
                    );
                  })}
                </div>

                <div className="routine-roster-tray">
                  {availableAthletes.slice(0, 14).map(a => (
                    <button key={a.id} className="routine-roster-chip" onClick={() => addAthleteToFormation(a)}>
                      <span>{athleteInitials(a)}</span>{a.display_name}
                    </button>
                  ))}
                  {!availableAthletes.length && <span style={{ color: 'var(--hz-dim)', fontSize: 12 }}>Everyone is already on this formation.</span>}
                </div>

                <div style={{ marginTop: 14 }}>
                  <div className="hz-label" style={{ color: 'var(--hz-dim)', marginBottom: 6 }}>Formation notes</div>
                  <textarea className="hz-input" rows="2" value={selectedFormation.notes || ''} onChange={e => updateFormation(selectedFormation.id, { notes: e.target.value })} placeholder="Spacing, transition, judge-facing picture..."/>
                </div>

                {selectedPosition && (
                  <div className="routine-position-inspector">
                    <div>
                      <div style={{ fontWeight: 900 }}>{athleteName(selectedPosition.athlete_id)}</div>
                      <div style={{ color: 'var(--hz-dim)', fontSize: 12 }}>Mat position {Math.round((selectedPosition.x || 0) * 100)}%, {Math.round((selectedPosition.y || 0) * 100)}%</div>
                    </div>
                    <select className="hz-input" value={selectedPosition.role || ''} onChange={e => updatePosition(selectedPosition.id, { role: e.target.value })}>
                      <option value="">Role</option>
                      {ASSIGNMENT_ROLES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                    </select>
                    <button className="hz-btn hz-btn-danger hz-btn-sm" onClick={() => removePosition(selectedPosition.id)}>Remove</button>
                  </div>
                )}
              </>
            ) : (
              <div style={{ color: 'var(--hz-dim)', padding: 20, fontSize: 13, background: 'rgba(255,255,255,0.025)', borderRadius: 12 }}>
                Select a section, create a formation, then drop roster chips onto the mat. This is the first practical step toward coach-owned choreo.
              </div>
            )}
          </div>

          <div className="hz-card">
            <div className="hz-eyebrow">Athlete assignments</div>
            <div style={{ color: 'var(--hz-dim)', fontSize: 12, marginTop: 4, marginBottom: 14 }}>
              Tie skills and roles to a section so athletes eventually get a clean "my counts" view.
            </div>
            {selectedSection ? (
              <>
                <div className="routine-builder-assignment-form">
                  <select className="hz-input" value={assignmentDraft.athlete_id} onChange={e => setAssignmentDraft({ ...assignmentDraft, athlete_id: e.target.value })}>
                    <option value="">Athlete</option>
                    {athletes.map(a => <option key={a.id} value={a.id}>{a.display_name}</option>)}
                  </select>
                  <select className="hz-input" value={assignmentDraft.role} onChange={e => setAssignmentDraft({ ...assignmentDraft, role: e.target.value })}>
                    {ASSIGNMENT_ROLES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                  </select>
                  <select className="hz-input" value={assignmentDraft.skill_id} onChange={e => setAssignmentDraft({ ...assignmentDraft, skill_id: e.target.value })}>
                    <option value="">Skill optional</option>
                    {skills.filter(s => !team?.level || s.level <= team.level).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <input className="hz-input" placeholder="Notes for this athlete" value={assignmentDraft.notes} onChange={e => setAssignmentDraft({ ...assignmentDraft, notes: e.target.value })}/>
                  <button className="hz-btn hz-btn-primary" onClick={saveAssignment}><HZIcon name="plus" size={12}/> Add</button>
                </div>
                <div style={{ display: 'grid', gap: 8, marginTop: 14 }}>
                  {selectedSectionAssignments.map(a => (
                    <div key={a.id} className="routine-assignment-row">
                      <div>
                        <b>{athleteName(a.athlete_id)}</b>
                        <div style={{ color: 'var(--hz-dim)', fontSize: 12 }}>{a.role || 'role'}{skillName(a.skill_id) ? ` - ${skillName(a.skill_id)}` : ''}</div>
                      </div>
                      <div style={{ color: 'var(--hz-dim)', fontSize: 12 }}>{a.notes || `Starts count ${a.count_index || selectedSection.start_count}`}</div>
                    </div>
                  ))}
                  {!selectedSectionAssignments.length && <div style={{ color: 'var(--hz-dim)', fontSize: 12 }}>No assignments yet for this section.</div>}
                </div>
              </>
            ) : (
              <div style={{ color: 'var(--hz-dim)', fontSize: 13 }}>Select a section to add athlete assignments.</div>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gap: 18, alignContent: 'start' }}>
          <div className="hz-card">
            <div className="hz-eyebrow">AI coach notes</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 6, marginBottom: 16 }}>
              <div className="hz-display" style={{ fontSize: 54 }}>{designReadiness.toFixed(1)}</div>
              <div style={{ fontSize: 14, color: 'var(--hz-dim)' }}>/ 100 design readiness</div>
            </div>
            {suggestions.map((idea, i) => (
              <div key={i} style={{ padding: '12px 0', borderTop: i ? '1px solid var(--hz-line)' : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <b>{idea.title}</b>
                  <span className={`hz-pill hz-pill-${idea.tone}`}>{idea.tone}</span>
                </div>
                <div style={{ color: 'var(--hz-dim)', fontSize: 12, lineHeight: 1.45, marginTop: 5 }}>{idea.body}</div>
              </div>
            ))}
            <div className="routine-ai-flavor-grid">
              {AI_FLAVORS.map(f => (
                <button key={f.id} className="hz-btn hz-btn-sm" onClick={() => generateSectionIdea(f.id)}>{f.label}</button>
              ))}
            </div>
            <div style={{ marginTop: 14 }}>
              <div className="hz-eyebrow" style={{ marginBottom: 8 }}>Saved AI ideas</div>
              <div style={{ display: 'grid', gap: 8 }}>
                {activeSuggestions.slice(0, 5).map((idea) => (
                  <div key={idea.id} className={`routine-ai-card routine-ai-card-${idea.status || 'proposed'}`}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'start' }}>
                      <div>
                        <b>{idea.title}</b>
                        <div style={{ color: 'var(--hz-dim)', fontSize: 12, lineHeight: 1.45, marginTop: 4 }}>{idea.body}</div>
                      </div>
                      <span className="hz-pill">{idea.status || 'proposed'}</span>
                    </div>
                    {idea.status === 'proposed' && (
                      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                        <button className="hz-btn hz-btn-sm" onClick={() => resolveSuggestion(idea, 'accepted')}><HZIcon name="check" size={12}/> Accept</button>
                        <button className="hz-btn hz-btn-sm" onClick={() => resolveSuggestion(idea, 'rejected')}>Reject</button>
                      </div>
                    )}
                  </div>
                ))}
                {!activeSuggestions.length && <div style={{ color: 'var(--hz-dim)', fontSize: 12 }}>Generate a scoped idea after selecting a section.</div>}
              </div>
            </div>
          </div>

          <div className="hz-card">
            <div className="hz-eyebrow">Rules, safety, and score simulation</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 8 }}>
              <div className="hz-display" style={{ fontSize: 42 }}>{scoreLow.toFixed(1)}-{scoreHigh.toFixed(1)}</div>
              <div style={{ color: 'var(--hz-dim)', fontSize: 12 }}>projected if execution is clean</div>
            </div>
            <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
              {validationIssues.slice(0, 5).map((issue, i) => (
                <div key={i} className={`routine-validation-row routine-validation-${issue.severity}`}>
                  <b>{issue.title}</b>
                  <span>{issue.body}</span>
                </div>
              ))}
              {!validationIssues.length && <div className="routine-validation-row routine-validation-green"><b>Builder checks clean</b><span>Formations, ownership, count map, and compliance are in a strong place.</span></div>}
            </div>
          </div>

          <div className="hz-card">
            <div className="hz-eyebrow">Teach and export</div>
            <div className="routine-output-tabs">
              {Object.entries(outputMap).map(([key, value]) => (
                <button key={key} className={activeOutput === key ? 'active' : ''} onClick={() => setActiveOutput(key)}>{value.title.replace('Printable ', '').replace('Music ', '')}</button>
              ))}
            </div>
            <pre className="routine-output-preview">{activeArtifact.body}</pre>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button className="hz-btn" onClick={async () => { try { await navigator.clipboard.writeText(activeArtifact.body); pushToast && pushToast({ kind: 'success', title: 'Copied', body: activeArtifact.title }); } catch (err) { pushToast && pushToast({ kind: 'error', title: 'Copy failed', body: err.message }); } }}><HZIcon name="copy" size={13}/> Copy</button>
              <button className="hz-btn hz-btn-primary" onClick={() => saveExport(activeArtifact.exportType, activeArtifact.title, activeArtifact.body)}>Save artifact</button>
            </div>
          </div>

          <div className="hz-card">
            <div className="hz-eyebrow">Versions and coach review</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
              <button className="hz-btn" onClick={() => createVersionSnapshot('draft')}>Snapshot v{(routine.versions || []).length + 1}</button>
              <button className="hz-btn hz-btn-primary" onClick={() => createVersionSnapshot('approved')}>Approve routine</button>
            </div>
            <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
              {(routine.versions || []).slice(0, 3).map(v => (
                <div key={v.id} className="routine-review-row">
                  <b>{v.title}</b>
                  <span>{v.status} - {new Date(v.created_at).toLocaleDateString()}</span>
                </div>
              ))}
              {!(routine.versions || []).length && <div style={{ color: 'var(--hz-dim)', fontSize: 12 }}>No snapshots yet. Capture one before major edits.</div>}
            </div>
            <div style={{ marginTop: 14 }}>
              <textarea className="hz-input" rows="2" placeholder={selectedSection ? `Comment on ${selectedSection.label}` : 'General coach comment'} value={commentDraft} onChange={e => setCommentDraft(e.target.value)}/>
              <button className="hz-btn hz-btn-sm" style={{ marginTop: 8 }} onClick={addRoutineComment}>Add comment</button>
            </div>
            <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
              {(routine.comments || []).slice(0, 4).map(c => (
                <div key={c.id} className={`routine-review-row ${c.status === 'resolved' ? 'resolved' : ''}`}>
                  <b>{c.author_label}</b>
                  <span>{c.body}</span>
                  {c.status === 'open' && <button className="hz-btn hz-btn-xs" onClick={() => resolveComment(c)}>Resolve</button>}
                </div>
              ))}
            </div>
          </div>

          <div className="hz-card">
            <div className="hz-eyebrow">Provider brief</div>
            <pre style={{ margin: '12px 0', whiteSpace: 'pre-wrap', fontSize: 11, lineHeight: 1.45, color: 'var(--hz-dim)', maxHeight: 260, overflow: 'auto', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--hz-line)', borderRadius: 12, padding: 12 }}>{providerBrief}</pre>
            <button className="hz-btn" style={{ width: '100%', justifyContent: 'center' }} onClick={copyBrief}>
              <HZIcon name={copied ? 'check' : 'copy'} size={13}/> {copied ? 'Copied' : 'Copy brief'}
            </button>
          </div>

          <div className="hz-card">
            <div className="hz-eyebrow">Composition lanes</div>
            {compositionRows.map(r => (
              <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '1fr 82px', gap: 8, padding: '7px 0', borderBottom: '1px solid var(--hz-line)', fontSize: 12 }}>
                <div>
                  <div>{r.label}</div>
                  {!r.count && <div style={{ fontSize: 10, color: 'var(--hz-amber)' }}>Not built yet</div>}
                </div>
                <div style={{ fontFamily: 'var(--hz-mono)', textAlign: 'right', color: r.count ? 'var(--hz-green)' : 'var(--hz-dim)' }}>
                  {r.count ? `${r.count} x8` : 'missing'}
                </div>
              </div>
            ))}
            <div style={{ marginTop: 14, color: 'var(--hz-dim)', fontSize: 11, lineHeight: 1.5 }}>
              Prediction blends team skill readiness with the section coverage built here.
              {comp && <> Next floor moment is in <span style={{ color: 'var(--hz-teal)', fontWeight: 700 }}>{comp.days} days</span>.</>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
window.RoutineBuilder = RoutineBuilder;
