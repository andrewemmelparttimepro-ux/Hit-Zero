// ─────────────────────────────────────────────────────────────────────────────
// HIT ZERO WEB — Mock Score
// A usable mock-competition tool, in two parts:
//   1. The SHEET — editable category scores (the coach owns the number;
//      each category starts unscored and is entered by the coach).
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
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
}

// A live run and all deduction details commit together under one retry identity.
async function persistScoreRun(payload, events) {
  if (mockScoreLiveMode()) {
    if (!mockScoreUuid(payload.team_id)) return {data:null,error:{message:'Choose a valid team.'}};
    const {data,error}=await window.HZsupa.rpc('save_observed_score_run_v1', {
      p_request_id:payload.id,p_team_id:payload.team_id,p_routine_id:payload.routine_id,
      p_scores:payload.category_scores,p_events:events.map(e=>({id:e.id,value:e.value,atSec:e.atSec ?? null,label:e.label})),p_note:payload.note,
    });
    if(error)return {data:null,error};
    const raw=window.HZdb?._raw?.();
    if(raw){raw.score_runs=[...(raw.score_runs || []).filter(r=>r.id!==data.id),data];}
    return {data,error:null};
  }
  const res=await window.HZdb.from('score_runs').insert(payload).single();
  if(res.error)return res;
  for(const e of events) {
    const detail=await window.HZdb.from('score_deductions').insert({run_id:res.data.id,code:e.id,value:e.value,at_seconds:e.atSec==null?null:Math.round(e.atSec),note:e.label});
    if(detail.error)return {data:res.data,error:detail.error};
  }
  return res;
}

// press-and-hold stepper button (tap = one step, hold = repeat)
function StepBtn({ dir, onStep, disabled, label }) {
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
      type="button"
      aria-label={(dir > 0 ? 'Increase ' : 'Decrease ') + (label || 'score')}
      onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) {e.preventDefault();onStep(dir);} }}
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
  // smart default: remember the last team you scored
  const [teamId, setTeamId] = useState(() => { try { return localStorage.getItem('hz_mockscore_team') || null; } catch { return null; } });
  const pickTeam = (id) => { if(id!==team?.id){setScores({});setEvents([]);setNote('');resetClock();} setTeamId(id); try { localStorage.setItem('hz_mockscore_team', id); } catch { /* fine */ } };
  const team = teams.find(t => t.id === teamId) || teams.find(Boolean) || null;
  const teamLabel = team
    ? `${team.name || 'Team'}${team.level ? ` · L${team.level}` : ''}`
    : 'Team';
  const routine = window.HZsel.routine?.(team?.id) || (snap.routines || []).find(r => team?.id && r.team_id === team.id) || null;

  const sheet = window.HZsel.SHEET || [];
  // Every category starts unscored. Only the coach's entered values count.
  const [scores, setScores] = useState({});
  const setScore = (row, value) => setScores(prev => ({...prev,[row.id]: value === '' ? null : Math.max(0,Math.min(row.max,Number(value)))}));
  const stepScore = (rowId, dir) => setScores(prev => {
    const row = sheet.find(r => r.id === rowId);
    const next = Math.max(0,Math.min(row.max,Math.round(((prev[rowId] || 0)+dir*0.1)*10)/10));
    return {...prev,[rowId]:next};
  });

  // deduction events (from run mode or quick-tap on the sheet)
  const [events, setEvents] = useState([]);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [pendingSave,setPendingSave]=useState(null);
  const saveInFlight=useRef(false);

  // ── run mode + clock ──
  const [runOpen, setRunOpen] = useState(false);
  // smart default: remember the routine length this program uses
  const [runLen, setRunLenRaw] = useState(() => {
    try { return Number(localStorage.getItem('hz_mockscore_runlen')) || 150; } catch { return 150; }
  });
  const setRunLen = (sec) => { setRunLenRaw(sec); try { localStorage.setItem('hz_mockscore_runlen', String(sec)); } catch { /* fine */ } };
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
  const allScored = sheet.length > 0 && sheet.every(r => typeof scores[r.id] === 'number' && Number.isFinite(scores[r.id]) && scores[r.id] >= 0 && scores[r.id] <= r.max);
  const subtotal = sheet.reduce((s, r) => s + (scores[r.id] || 0), 0);
  const dedTotal = events.reduce((s, e) => s + e.value, 0);
  const total = Math.max(0, subtotal - dedTotal);
  const maxTotal = sheet.reduce((s, r) => s + r.max, 0);

  const scoreDraftKey = () => JSON.stringify({team:team?.id,routine:routine?.id || null,scores,events,note});
  const latestDraftKey=useRef(null);latestDraftKey.current=scoreDraftKey();
  const saveRun = async () => {
    if (saveInFlight.current || (!pendingSave && (!team?.id || !allScored))) return;
    const request=pendingSave || {payload:{id:crypto.randomUUID(),team_id:team.id,routine_id:routine?.id || null,category_scores:{...scores},note,subtotal,deductions:dedTotal,total,created_by:session?.profile?.id || null},events:events.map(e=>({...e})),draftKey:scoreDraftKey()};
    saveInFlight.current=true;setSaving(true);setError('');setPendingSave(request);
    try {
      const result=await persistScoreRun(request.payload,request.events);
      if(result.error)throw result.error;
      setPendingSave(null);
      if(window.HZsel?._refresh)await window.HZsel._refresh();
      window.dispatchEvent(new CustomEvent('hz:refresh',{detail:{table:'score_runs',action:'insert'}}));
      pushToast?.({title:'Run saved',body:`${Number(result.data.total).toFixed(2)} — ${request.events.length} deductions saved together.`});
      // If edits changed during a lost-response retry, keep those newer edits.
      if(latestDraftKey.current===request.draftKey){setEvents([]);setScores({});setNote('');resetClock();}
    } catch(error) {
      if(['23514','42501','22023','22P02'].includes(error?.code))setPendingSave(null);
      setError(error?.message || 'The save could not be confirmed. Check the previous save before starting another.');
    } finally {saveInFlight.current=false;setSaving(false);}
  };

  // history with deltas (oldest → newest for delta math)
  const history = useMemo(() => {
    const runs = [...(snap.score_runs || [])]
      .filter(r => team?.id && r.team_id === team.id)
      .sort((a, b) => new Date(a.run_at) - new Date(b.run_at));
    return runs.map((r, i) => ({
      ...r,
      delta: i > 0 ? (r.total || 0) - (runs[i - 1].total || 0) : null,
    })).reverse().slice(0, 8);
  }, [snap.score_runs, team?.id]);

  // Real progress only — every number below comes from saved runs.
  const progress = useMemo(() => {
    const all = (snap.score_runs || []).filter(r => team?.id && r.team_id === team.id);
    const best = all.reduce((m, r) => Math.max(m, r.total || 0), 0);
    // HIT ZERO streak: consecutive most-recent runs with no deductions
    const newestFirst = [...all].sort((a, b) => new Date(b.run_at) - new Date(a.run_at));
    let streak = 0;
    for (const r of newestFirst) {
      if ((r.deductions || 0) === 0) streak++;
      else break;
    }
    return { count: all.length, best, streak };
  }, [snap.score_runs, team?.id]);
  const comp = window.HZsel.daysToComp?.(team?.id) || null;

  const totalColor = total >= maxTotal * 0.9 ? 'var(--hz-green)' : total >= maxTotal * 0.8 ? 'var(--hz-teal)' : 'var(--hz-amber)';

  return (
    <div>
      <SectionHeading eyebrow={`${teamLabel} · mock competition`} title="Mock Score." trailing={
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="hz-btn hz-btn-primary" onClick={() => { setRunOpen(true); resetClock(); }}>
            <HZIcon name="bolt" size={13}/> Run the routine
          </button>
          <button className="hz-btn" onClick={saveRun} disabled={saving || (!pendingSave && (!team?.id || !allScored))}>
            <HZIcon name="check" size={13}/> {saving ? 'Saving…' : pendingSave ? 'Check previous save' : 'Save run'}
          </button>
        </div>
      }/>
      {error && <div className="hz-card" style={{ color: 'var(--hz-red)', marginBottom: 14, padding: 12 }}>{error}</div>}

      {/* Endowed progress — all real: saved runs, real comp date, real streak */}
      {(progress.count > 0 || comp) && (
        <div className="hz-card" style={{ marginBottom: 16, padding: '12px 16px', display: 'flex', gap: 22, flexWrap: 'wrap', alignItems: 'center' }}>
          {comp && (
            <div>
              <div className="hz-eyebrow">Days to comp</div>
              <div className="hz-display" style={{ fontSize: 26, color: comp.days <= 7 ? 'var(--hz-amber)' : '#fff' }}>{comp.days}</div>
            </div>
          )}
          {progress.count > 0 && (
            <>
              <div>
                <div className="hz-eyebrow">Runs logged</div>
                <div className="hz-display" style={{ fontSize: 26 }}>{progress.count}</div>
              </div>
              <div>
                <div className="hz-eyebrow">Best score</div>
                <div className="hz-display" style={{ fontSize: 26, color: 'var(--hz-teal)' }}>{progress.best.toFixed(1)}</div>
              </div>
              <div>
                <div className="hz-eyebrow">Hit Zero streak</div>
                <div className="hz-display" style={{ fontSize: 26, color: progress.streak > 0 ? 'var(--hz-green)' : 'var(--hz-dim)' }}>
                  {progress.streak > 0 ? `🔥 ${progress.streak}` : '—'}
                </div>
              </div>
              {progress.streak > 0 && (
                <div style={{ fontSize: 12, color: 'var(--hz-dim)', maxWidth: 240 }}>
                  {progress.streak} clean run{progress.streak === 1 ? '' : 's'} in a row — one deduction ends it.
                </div>
              )}
            </>
          )}
          {progress.count === 0 && (
            <div style={{ fontSize: 12.5, color: 'var(--hz-dim)' }}>
              First run starts the record — every full-out from here builds the trend line toward comp.
            </div>
          )}
        </div>
      )}

      {teams.length > 1 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {teams.map(t => (
            <button key={t.id} className="hz-btn" onClick={() => pickTeam(t.id)}
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
              <p style={{fontSize:12,color:'var(--hz-dim)',marginTop:6}}>Internal practice rubric. Enter observed scores; no automatic prediction.</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="hz-eyebrow">Total</div>
              <div className="hz-display" style={{ fontSize: allScored ? 58 : 30, lineHeight: 1, color: totalColor }}>{allScored ? total.toFixed(2) : 'Unscored'}</div>
              <div style={{ fontSize: 11, color: 'var(--hz-dim)' }}>/ {maxTotal} · −{dedTotal.toFixed(2)} deductions</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sheet.map(row => {
              const val = scores[row.id];
              return (
                <div key={row.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.03)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{row.label}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--hz-dim)', fontFamily: 'var(--hz-mono)' }}>
                      max {row.max}
                    </div>
                  </div>
                  <StepBtn dir={-1} label={row.label} onStep={(d) => stepScore(row.id, d)} disabled={val <= 0}/>
                  <input type="number" inputMode="decimal" min="0" max={row.max} step="0.1" aria-label={row.label + ' score'} placeholder="—" value={val ?? ''} onChange={e=>setScore(row,e.target.value)} className="hz-input hz-mono" style={{width:72,textAlign:'center',fontSize:16,padding:'8px 4px'}}/>
                  <StepBtn dir={1} label={row.label} onStep={(d) => stepScore(row.id, d)} disabled={val >= row.max}/>
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
                ? <>Last: <b style={{ color: '#fff' }}>{events[events.length - 1].label}</b>{events[events.length - 1].atSec != null ? ` at ${msFmt(events[events.length - 1].atSec)}` : ''}{progress.streak > 0 ? <span style={{ color: 'var(--hz-amber)' }}> · streak of {progress.streak} ends if this run saves</span> : null}</>
                : progress.streak > 0
                  ? <span style={{ color: 'var(--hz-green)' }}>🔥 Streak of {progress.streak} on the line — keep it clean.</span>
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
