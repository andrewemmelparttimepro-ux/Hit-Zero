// ─────────────────────────────────────────────────────────────────────────────
// HIT ZERO WEB — Mock Score
// A usable mock-competition tool, in two parts:
//   1. The SHEET — editable category scores (the coach owns the number;
//      team readiness is a hint and a seed, never the driver).
//   2. RUN MODE — fullscreen mat-side view: routine clock + giant deduction
//      buttons. Every tap is stamped at its moment in the run.
// Saves the full story: score_runs + one score_deductions row per event
// (at_count = seconds into the run — the schema supported this all along).
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_DEDUCTIONS = [
  { id: 'bobble',          label: 'Bobble / Stumble',      value: 0.25, type: 'minor' },
  { id: 'fall_stunt',      label: 'Fall from a Stunt',     value: 0.5,  type: 'minor' },
  { id: 'fall_pyramid',    label: 'Fall from a Pyramid',   value: 0.75, type: 'minor' },
  { id: 'tumbling_fall',   label: 'Tumbling Fall',         value: 0.5,  type: 'minor' },
  { id: 'bf',              label: 'Building Fundamental',  value: 0.25, type: 'minor' },
  { id: 'major_bf',        label: 'Major Building Fund.',  value: 0.5,  type: 'major' },
  { id: 'safety',          label: 'Safety Violation',      value: 1.0,  type: 'major' },
  { id: 'time',            label: 'Time Violation',        value: 0.25, type: 'minor' },
  { id: 'choreo_boundary', label: 'Choreo Boundary',       value: 0.25, type: 'minor' },
];

const RUN_LENGTHS = [
  { sec: 90,  label: '1:30' },
  { sec: 120, label: '2:00' },
  { sec: 150, label: '2:30' },
];

function msFmt(sec) {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function mockScoreLiveMode() {
  return Boolean(window.HZsupa && window.HZdb?.auth?._mode?.() === 'live');
}
function mockScoreUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(String(value || ''));
}

// Persist the run, then its deduction events. Event persistence is
// best-effort — a failed detail write never loses the run itself.
async function persistScoreRun(payload, events) {
  let run = null;
  if (mockScoreLiveMode() && mockScoreUuid(payload.team_id)) {
    const { data, error } = await window.HZsupa.from('score_runs').insert(payload).select('*').single();
    if (error) return { data: null, error };
    run = data;
    await window.HZdb.from('score_runs').upsert(run, { onConflict: 'id' }); // saveRun follows with HZsel?._refresh + hz:refresh
    if (run?.id && events.length) {
      const rows = events.map(e => ({
        run_id: run.id, code: e.id, value: e.value,
        at_count: e.atSec != null ? Math.round(e.atSec) : null,
        note: e.label,
      }));
      const { error: dErr } = await window.HZsupa.from('score_deductions').insert(rows); // saveRun follows with HZsel?._refresh + hz:refresh
      if (dErr) console.warn('[mockscore] deduction detail save failed', dErr);
    }
  } else {
    const res = await window.HZdb.from('score_runs').insert(payload).single(); // saveRun follows with HZsel?._refresh + hz:refresh
    if (res.error) return res;
    run = res.data || payload;
    try {
      for (const e of events) {
        await window.HZdb.from('score_deductions').insert({ // saveRun follows with HZsel?._refresh + hz:refresh
          run_id: run.id, code: e.id, value: e.value,
          at_count: e.atSec != null ? Math.round(e.atSec) : null,
          note: e.label,
        });
      }
    } catch { /* prototype detail is best-effort */ }
  }
  return { data: run, error: null };
}

// press-and-hold stepper button (tap = one step, hold = repeat)
function StepBtn({ dir, onStep, disabled }) {
  const timer = React.useRef(null);
  const stop = () => { clearInterval(timer.current); clearTimeout(timer.current); timer.current = null; };
  const start = () => {
    onStep(dir);
    timer.current = setTimeout(() => {
      timer.current = setInterval(() => onStep(dir), 70);
    }, 420);
  };
  React.useEffect(() => stop, []);
  return (
    <button
      className="hz-btn hz-btn-ghost"
      disabled={disabled}
      style={{ width: 40, height: 40, padding: 0, justifyContent: 'center', fontSize: 18, fontWeight: 800, touchAction: 'none' }}
      onPointerDown={(e) => { e.preventDefault(); start(); }}
      onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop}
    >{dir > 0 ? '+' : '−'}</button>
  );
}

function MockScore({ session, snap, pushToast }) {
  const { useState, useEffect, useRef, useMemo } = React;

  const teams = window.HZsel.programTeams?.() || snap.teams || [];
  const [teamId, setTeamId] = useState(null);
  const team = teams.find(t => t.id === teamId) || teams.find(Boolean) || null;
  const teamLabel = team
    ? `${team.name || 'Team'}${team.level ? ` · L${team.level}` : ''}`
    : 'Team';
  const routine = window.HZsel.routine?.() || (snap.routines || []).find(r => !team?.id || r.team_id === team.id) || null;

  const sheet = window.HZsel.SHEET || [];
  const prediction = useMemo(() => {
    try { return window.HZsel.predictedScore([]); } catch { return { rows: [] }; }
  }, [snap, teamId]);
  const hintFor = (rowId) => prediction.rows?.find(r => r.id === rowId) || null;

  // Editable category scores. Fresh sheet opens at a neutral solid-run
  // default (86% of max) so it always reads like a real scoresheet; the
  // readiness seed is an explicit action. The coach owns the numbers.
  const seedValue = (row) => {
    const hint = hintFor(row.id);
    const v = hint ? hint.score : row.max * 0.86;
    return Math.round(v * 10) / 10;
  };
  const [scores, setScores] = useState(() => Object.fromEntries(sheet.map(r => [r.id, Math.round(r.max * 0.86 * 10) / 10])));
  const stepScore = (rowId, dir) => setScores(prev => {
    const row = sheet.find(r => r.id === rowId);
    const next = Math.max(0, Math.min(row.max, Math.round(((prev[rowId] || 0) + dir * 0.1) * 10) / 10));
    return { ...prev, [rowId]: next };
  });
  const seedAll = () => {
    setScores(Object.fromEntries(sheet.map(r => [r.id, seedValue(r)])));
    pushToast?.({ title: 'Sheet seeded', body: 'Scores set from team readiness — adjust as you judge.' });
  };

  // deduction events (from run mode or quick-tap on the sheet)
  const [events, setEvents] = useState([]);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // ── run mode + clock ──
  const [runOpen, setRunOpen] = useState(false);
  const [runLen, setRunLen] = useState(150);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const baseRef = useRef({ base: 0, startedAt: 0 });
  useEffect(() => {
    if (!running) return undefined;
    const t = setInterval(() => {
      const e = baseRef.current.base + (performance.now() - baseRef.current.startedAt) / 1000;
      setElapsed(e);
      if (e >= runLen) {
        setRunning(false);
        baseRef.current.base = runLen;
        pushToast?.({ title: 'Time!', body: `Routine length reached (${msFmt(runLen)}).` });
      }
    }, 200);
    return () => clearInterval(t);
  }, [running, runLen]);

  const startPause = () => {
    if (running) {
      baseRef.current.base = elapsed;
      setRunning(false);
    } else {
      baseRef.current.startedAt = performance.now();
      setRunning(true);
    }
  };
  const resetClock = () => { setRunning(false); setElapsed(0); baseRef.current = { base: 0, startedAt: 0 }; };

  const addEvent = (d) => {
    if (!d) return;
    setEvents(prev => [...prev, {
      ...d,
      _id: Math.random().toString(36).slice(2),
      atSec: (runOpen && (running || elapsed > 0)) ? elapsed : null,
    }]);
    if (navigator.vibrate) navigator.vibrate(12);
  };
  const undoEvent = () => setEvents(prev => prev.slice(0, -1));
  const removeEvent = (id) => setEvents(prev => prev.filter(e => e._id !== id));

  // ── totals ──
  const subtotal = sheet.reduce((s, r) => s + (scores[r.id] || 0), 0);
  const dedTotal = events.reduce((s, e) => s + e.value, 0);
  const total = Math.max(0, subtotal - dedTotal);
  const maxTotal = sheet.reduce((s, r) => s + r.max, 0);

  const saveRun = async () => {
    if (!team?.id || saving) return;
    setSaving(true);
    setError('');
    const { error: saveError } = await persistScoreRun({
      team_id: team.id,
      routine_id: routine?.id || null,
      run_at: new Date().toISOString(),
      subtotal: Math.round(subtotal * 100) / 100,
      deductions: Math.round(dedTotal * 100) / 100,
      total: Math.round(total * 100) / 100,
      note,
      created_by: mockScoreUuid(session?.profile?.id) ? session.profile.id : null,
    }, events);
    if (saveError) {
      setError(saveError.message || 'Could not save score run.');
      setSaving(false);
      return;
    }
    if (window.HZsel?._refresh) await window.HZsel._refresh();
    window.dispatchEvent(new CustomEvent('hz:refresh', { detail: { table: 'score_runs', action: 'insert' } }));
    pushToast?.({ title: 'Run saved', body: `${total.toFixed(2)} — ${events.length} deduction${events.length === 1 ? '' : 's'} logged` });
    setEvents([]);
    setNote('');
    resetClock();
    setSaving(false);
  };

  // history with deltas (oldest → newest for delta math)
  const history = useMemo(() => {
    const runs = [...(snap.score_runs || [])]
      .filter(r => !team?.id || r.team_id === team.id)
      .sort((a, b) => new Date(a.run_at) - new Date(b.run_at));
    return runs.map((r, i) => ({
      ...r,
      delta: i > 0 ? (r.total || 0) - (runs[i - 1].total || 0) : null,
    })).reverse().slice(0, 8);
  }, [snap.score_runs, team?.id]);

  const totalColor = total >= maxTotal * 0.9 ? 'var(--hz-green)' : total >= maxTotal * 0.8 ? 'var(--hz-teal)' : 'var(--hz-amber)';

  return (
    <div>
      <SectionHeading eyebrow={`${teamLabel} · mock competition`} title="Mock Score." trailing={
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="hz-btn hz-btn-primary" onClick={() => { setRunOpen(true); resetClock(); }}>
            <HZIcon name="bolt" size={13}/> Run the routine
          </button>
          <button className="hz-btn" onClick={saveRun} disabled={saving || !team?.id}>
            <HZIcon name="check" size={13}/> {saving ? 'Saving…' : 'Save run'}
          </button>
        </div>
      }/>
      {error && <div className="hz-card" style={{ color: 'var(--hz-red)', marginBottom: 14, padding: 12 }}>{error}</div>}

      {teams.length > 1 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {teams.map(t => (
            <button key={t.id} className="hz-btn" onClick={() => setTeamId(t.id)}
              style={{ borderColor: (team?.id === t.id) ? 'var(--hz-pink)' : 'var(--hz-line-2)' }}>
              {t.name}{t.level ? ` · L${t.level}` : ''}
            </button>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))', gap: 20 }}>
        {/* ── The sheet: coach-owned scores, readiness as a hint ── */}
        <div className="hz-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div className="hz-eyebrow">Judging sheet — tap +/− to score</div>
              {prediction.rows?.length > 0 && (
                <button className="hz-btn hz-btn-ghost hz-btn-xs" style={{ marginTop: 6 }} onClick={seedAll}>
                  <HZIcon name="bolt" size={11}/> Seed from team readiness
                </button>
              )}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="hz-eyebrow">Total</div>
              <div className="hz-display" style={{ fontSize: 58, lineHeight: 1, color: totalColor }}>{total.toFixed(2)}</div>
              <div style={{ fontSize: 11, color: 'var(--hz-dim)' }}>/ {maxTotal} · −{dedTotal.toFixed(2)} deductions</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sheet.map(row => {
              const hint = hintFor(row.id);
              const val = scores[row.id] || 0;
              return (
                <div key={row.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.03)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{row.label}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--hz-dim)', fontFamily: 'var(--hz-mono)' }}>
                      max {row.max}{hint && hint.readiness != null ? ` · readiness ${Math.round(hint.readiness * 100)}%` : ''}
                    </div>
                  </div>
                  <StepBtn dir={-1} onStep={(d) => stepScore(row.id, d)} disabled={val <= 0}/>
                  <div className="hz-mono" style={{ width: 52, textAlign: 'center', fontSize: 18, fontWeight: 800, color: val >= row.max * 0.9 ? 'var(--hz-green)' : '#fff' }}>
                    {val.toFixed(1)}
                  </div>
                  <StepBtn dir={1} onStep={(d) => stepScore(row.id, d)} disabled={val >= row.max}/>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: 18 }}>
            <div className="hz-eyebrow" style={{ marginBottom: 8 }}>Judges' notes</div>
            <textarea className="hz-input" rows="3" placeholder="What stood out? What to clean up?" value={note} onChange={e => setNote(e.target.value)}/>
          </div>
        </div>

        {/* ── Deduction log ── */}
        <div className="hz-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div className="hz-eyebrow">Deductions · {events.length} · −{dedTotal.toFixed(2)}</div>
            {events.length > 0 && <button className="hz-btn hz-btn-ghost hz-btn-xs" onClick={() => setEvents([])}><HZIcon name="x" size={11}/> Clear</button>}
          </div>
          {events.length === 0 ? (
            <div style={{ color: 'var(--hz-dim)', fontSize: 13, textAlign: 'center', padding: '28px 12px' }}>
              Clean sheet. Tap <b>Run the routine</b> to score a full-out with the clock —
              every deduction gets stamped at its moment in the run.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 420, overflowY: 'auto' }} className="hz-scroll">
              {events.slice().reverse().map((e) => (
                <div key={e._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.03)' }}>
                  <div>
                    <div style={{ fontSize: 13 }}>{e.label}</div>
                    <div style={{ fontSize: 10, color: 'var(--hz-dim)', fontFamily: 'var(--hz-mono)' }}>
                      {e.atSec != null ? `at ${msFmt(e.atSec)} into the run` : 'added on the sheet'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontFamily: 'var(--hz-mono)', color: e.type === 'major' ? 'var(--hz-red)' : 'var(--hz-amber)', fontWeight: 700 }}>−{e.value}</span>
                    <button onClick={() => removeEvent(e._id)} className="hz-btn hz-btn-ghost hz-btn-xs"><HZIcon name="x" size={11}/></button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
            {MOCK_DEDUCTIONS.slice(0, 4).map(d => (
              <button key={d.id} onClick={() => addEvent(d)} className="hz-btn" style={{ justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11.5 }}>{d.label}</span>
                <span className="hz-mono" style={{ color: 'var(--hz-amber)', fontWeight: 700, fontSize: 11 }}>−{d.value}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── history with deltas ── */}
      {history.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <div className="hz-eyebrow" style={{ marginBottom: 12 }}>Recent runs</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 10 }}>
            {history.map(r => (
              <div key={r.id} className="hz-card hz-card-dense">
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <div className="hz-display" style={{ fontSize: 30 }}>{(r.total || 0).toFixed(1)}</div>
                  {r.delta != null && Math.abs(r.delta) >= 0.05 && (
                    <span className="hz-mono" style={{ fontSize: 12, fontWeight: 800, color: r.delta > 0 ? 'var(--hz-green)' : 'var(--hz-red)' }}>
                      {r.delta > 0 ? '▲' : '▼'}{Math.abs(r.delta).toFixed(1)}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 10, color: 'var(--hz-dim)', marginTop: 4 }}>
                  {new Date(r.run_at).toLocaleString()} · −{(r.deductions || 0).toFixed(2)}
                </div>
                {r.note && <div style={{ fontSize: 11, color: 'var(--hz-dim)', marginTop: 6, fontStyle: 'italic' }}>"{r.note}"</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── RUN MODE — fullscreen mat-side view. Rendered through a portal:
           .main animates with a transform, which would trap position:fixed. ── */}
      {runOpen && ReactDOM.createPortal(
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200, background: 'var(--hz-ink, #050507)',
          display: 'flex', flexDirection: 'column',
          padding: 'calc(14px + env(safe-area-inset-top)) 16px calc(14px + env(safe-area-inset-bottom))',
        }}>
          {/* clock row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div className="hz-eyebrow">{teamLabel} · full-out</div>
              <div className="hz-display" style={{ fontSize: 56, lineHeight: 1, fontVariantNumeric: 'tabular-nums', color: elapsed >= runLen ? 'var(--hz-red)' : '#fff' }}>
                {msFmt(elapsed)}<span style={{ fontSize: 20, color: 'var(--hz-dim)' }}> / {msFmt(runLen)}</span>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="hz-eyebrow">Deductions</div>
              <div className="hz-display" style={{ fontSize: 44, lineHeight: 1, color: 'var(--hz-red)' }}>−{dedTotal.toFixed(2)}</div>
              <div style={{ fontSize: 11, color: 'var(--hz-dim)' }}>{events.length} logged</div>
            </div>
          </div>

          {/* progress bar */}
          <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.08)', margin: '10px 0 14px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min(100, (elapsed / runLen) * 100)}%`, background: elapsed >= runLen ? 'var(--hz-red)' : 'var(--hz-pink, #F97FAC)', transition: 'width 200ms linear' }}/>
          </div>

          {/* timer controls */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            <button className="hz-btn hz-btn-primary" style={{ minHeight: 46, flex: 1 }} onClick={startPause}>
              {running ? '⏸ Pause' : elapsed > 0 ? '▶ Resume' : '▶ Start the music'}
            </button>
            <button className="hz-btn" style={{ minHeight: 46 }} onClick={resetClock}>Reset</button>
            {elapsed === 0 && !running && RUN_LENGTHS.map(l => (
              <button key={l.sec} className="hz-btn" style={{ minHeight: 46, borderColor: runLen === l.sec ? 'var(--hz-pink)' : 'var(--hz-line-2)' }} onClick={() => setRunLen(l.sec)}>{l.label}</button>
            ))}
          </div>

          {/* giant deduction grid */}
          <div style={{ flex: 1, overflowY: 'auto' }} className="hz-scroll">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
              {MOCK_DEDUCTIONS.map(d => {
                const count = events.filter(e => e.id === d.id).length;
                return (
                  <button key={d.id} onClick={() => addEvent(d)} className="hz-btn"
                    style={{
                      minHeight: 74, flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: 4,
                      borderColor: d.type === 'major' ? 'rgba(255,94,108,0.45)' : 'var(--hz-line-2)',
                      position: 'relative',
                    }}>
                    <span style={{ fontSize: 14, fontWeight: 700, textAlign: 'left' }}>{d.label}</span>
                    <span className="hz-mono" style={{ color: d.type === 'major' ? 'var(--hz-red)' : 'var(--hz-amber)', fontWeight: 800, fontSize: 15 }}>−{d.value}</span>
                    {count > 0 && (
                      <span style={{
                        position: 'absolute', top: 8, right: 10, minWidth: 22, height: 22, borderRadius: 11,
                        background: 'var(--hz-red)', color: '#fff', fontSize: 12, fontWeight: 800,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 6px',
                      }}>{count}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* footer: last event + undo + finish */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 14, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 160, fontSize: 12.5, color: 'var(--hz-dim)' }}>
              {events.length > 0
                ? <>Last: <b style={{ color: '#fff' }}>{events[events.length - 1].label}</b>{events[events.length - 1].atSec != null ? ` at ${msFmt(events[events.length - 1].atSec)}` : ''}</>
                : 'Hit zero! No deductions yet.'}
            </div>
            <button className="hz-btn" style={{ minHeight: 52, minWidth: 110 }} onClick={undoEvent} disabled={events.length === 0}>↩ Undo</button>
            <button className="hz-btn hz-btn-primary" style={{ minHeight: 52, minWidth: 150 }} onClick={() => { setRunning(false); baseRef.current.base = elapsed; setRunOpen(false); }}>
              Finish run →
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
window.MockScore = MockScore;
