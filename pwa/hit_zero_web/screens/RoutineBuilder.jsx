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

function buildProviderBrief({ routine, team, audio, license, countMap }) {
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
  });
  lines.push('');
  lines.push('Provider notes:');
  lines.push(license?.notes || 'Use clear 8-count hits, coach-friendly transitions, and leave space for voiceover cues.');
  return lines.join('\n');
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
  const countConfidence = Math.max(0, Math.min(1, Number(countMap?.confidence || 0)));
  const compliance = license?.proof_status === 'competition_ready' ? 1 : license?.proof_status === 'provider_pending' ? 0.75 : license?.proof_status === 'needs_license_proof' ? 0.45 : 0.2;
  return Math.max(0, Math.min(100, 35 + coverage * 25 + variety * 25 + countConfidence * 8 + compliance * 7));
}

function RoutineBuilder({ snap, navigate, pushToast }) {
  const routine = React.useMemo(() => window.HZsel.routine(), [snap._tick]);
  const team = React.useMemo(() => window.HZsel.team(), [snap._tick]);
  const [selected, setSelected] = React.useState(null);
  const [dragging, setDragging] = React.useState(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = React.useState(null);
  const [saving, setSaving] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const fileInputRef = React.useRef(null);
  const timelineRef = React.useRef(null);

  React.useEffect(() => () => {
    if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
  }, [audioPreviewUrl]);

  if (!routine) return <EmptyState icon="routine" title="No routine yet" body="Start a routine for Magic."/>;

  const predicted = window.HZsel.predictedScore();
  const comp = window.HZsel.daysToComp();
  const audio = routine.audioAssets?.find(a => a.kind === 'primary_music') || routine.audioAssets?.[0] || null;
  const license = routine.licenses?.find(l => !audio || l.audio_asset_id === audio.id) || routine.licenses?.[0] || null;
  const countMap = routine.countMaps?.find(m => !audio || m.audio_asset_id === audio.id) || routine.countMaps?.[0] || { bpm: routine.bpm || 144, first_count_seconds: 0, confidence: 0 };
  const proofState = PROOF_STATES.find(s => s.id === (license?.proof_status || 'needs_license_proof')) || PROOF_STATES[1];
  const mode = MUSIC_MODES.find(m => m.id === (audio?.mode || 'provider_brief')) || MUSIC_MODES[1];
  const suggestions = routineBuilderSuggestions(routine, predicted, countMap, license);

  const cellWidth = 32;
  const gridWidth = routine.length_counts * cellWidth;
  const providerBrief = buildProviderBrief({ routine, team, audio, license, countMap });
  const designReadiness = routineDesignReadiness(routine, countMap, license);

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
      if (patch) window.HZdb.from('routine_sections').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', sec.id);
    };
    const onUp = () => setDragging(null);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [dragging, routine.sections.length, routine.length_counts]);

  const upsertAudio = async (patch) => {
    const base = {
      id: audio?.id || routineUid('ra'),
      routine_id: routine.id,
      kind: 'primary_music',
      mode: audio?.mode || 'provider_brief',
      status: audio?.status || 'metadata_only',
      created_at: audio?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const res = await window.HZdb.from('routine_audio_assets').upsert({ ...base, ...patch }, { onConflict: 'routine_id,kind' });
    if (res.error) throw res.error;
    return res.data?.[0] || { ...base, ...patch };
  };

  const upsertLicense = async (patch, audioId = audio?.id) => {
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
    const res = await window.HZdb.from('music_licenses').upsert({ ...base, ...patch }, { onConflict: 'routine_id,audio_asset_id' });
    if (res.error) throw res.error;
  };

  const upsertCountMap = async (patch, audioId = audio?.id) => {
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
    const res = await window.HZdb.from('routine_count_maps').upsert(payload, { onConflict: 'routine_id,audio_asset_id' });
    if (res.error) throw res.error;
    if (patch.bpm) await window.HZdb.from('routines').update({ bpm: Number(patch.bpm) }).eq('id', routine.id);
  };

  const handleMusicFile = async (file) => {
    if (!file) return;
    setSaving(true);
    try {
      const nextUrl = URL.createObjectURL(file);
      if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
      setAudioPreviewUrl(nextUrl);
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
        mime_type: file.type || 'audio/*',
        size_bytes: file.size,
        duration_seconds: duration,
        local_object_url: nextUrl,
        status: 'local_draft',
      });
      await upsertLicense({ proof_status: 'needs_license_proof' }, savedAudio.id);
      await upsertCountMap({ audio_asset_id: savedAudio.id, confidence: 0.35, source: 'coach_upload' }, savedAudio.id);
      pushToast && pushToast({ kind: 'success', title: 'Music staged', body: 'Track is ready for count mapping. Add proof before calling it competition-ready.' });
    } catch (err) {
      pushToast && pushToast({ kind: 'error', title: 'Music setup failed', body: err.message || 'Try a different audio file.' });
    } finally {
      setSaving(false);
    }
  };

  const addSection = async () => {
    const end = Math.max(...routine.sections.map(s => s.end_count), 0);
    const start = Math.max(1, Math.min(end + 1, Math.max(1, routine.length_counts - 3)));
    const res = await window.HZdb.from('routine_sections').insert({
      routine_id: routine.id,
      section_type: 'transition',
      label: 'New section',
      start_count: start,
      end_count: Math.min(start + 3, routine.length_counts),
      position: routine.sections.length,
      notes: '',
    });
    if (res.error) pushToast && pushToast({ kind: 'error', title: 'Section not added', body: res.error.message });
  };

  const updateSection = async (id, patch) => {
    const res = await window.HZdb.from('routine_sections').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
    if (res.error) pushToast && pushToast({ kind: 'error', title: 'Section not saved', body: res.error.message });
  };

  const deleteSection = async (id) => {
    const res = await window.HZdb.from('routine_sections').delete().eq('id', id);
    if (res.error) pushToast && pushToast({ kind: 'error', title: 'Section not deleted', body: res.error.message });
    else setSelected(null);
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

  const selectedSection = routine.sections.find(s => s.id === selected);
  const coverage = routine.sections.reduce((s, sec) => s + (sec.end_count - sec.start_count + 1), 0) / Math.max(1, routine.length_counts);
  const byType = {};
  routine.sections.forEach(s => { byType[s.section_type] = (byType[s.section_type] || 0) + (s.end_count - s.start_count + 1); });
  const compositionRows = SECTION_TYPES
    .filter(t => !['opening', 'transition'].includes(t.id))
    .map(t => ({ ...t, count: byType[t.id] || 0 }));

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
            <audio controls src={audioPreviewUrl} style={{ width: '100%', marginBottom: 16 }}/>
          ) : (
            <div style={{ padding: 18, border: '1px dashed rgba(255,255,255,0.18)', borderRadius: 14, color: 'var(--hz-dim)', marginBottom: 16 }}>
              Upload an audio file to preview here. Until then, this routine can still be built as a provider brief.
            </div>
          )}

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
        </div>
      </div>

      <div className="routine-builder-main">
        <div className="hz-card">
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
                  <input className="hz-input" value={selectedSection.label || ''} onChange={e => updateSection(selectedSection.id, { label: e.target.value })}/>
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
            <button className="hz-btn hz-btn-primary" style={{ marginTop: 12, width: '100%', justifyContent: 'center' }} onClick={() => pushToast && pushToast({ kind: 'info', title: 'AI generation next', body: 'The data model is now ready for section alternatives and roster-aware prompts.' })}>
              <HZIcon name="bolt" size={13}/> Generate section idea
            </button>
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
