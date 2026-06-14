// ─────────────────────────────────────────────────────────────────────────────
// HIT ZERO WEB — Mock Score
// Split view: USASF-style judging sheet (live from team readiness) + deduction log.
// Tap a deduction button to log it — score drops in real time.
// ─────────────────────────────────────────────────────────────────────────────

const DEDUCTIONS = [
  { id: 'fall_stunt',      label: 'Fall from a Stunt',     value: 0.5,  type: 'minor' },
  { id: 'fall_pyramid',    label: 'Fall from a Pyramid',   value: 0.75, type: 'minor' },
  { id: 'bobble',          label: 'Bobble / Stumble',      value: 0.25, type: 'minor' },
  { id: 'tumbling_fall',   label: 'Tumbling Fall',         value: 0.5,  type: 'minor' },
  { id: 'bf',              label: 'Building Fundamental',  value: 0.25, type: 'minor' },
  { id: 'major_bf',        label: 'Major Building Fund.',  value: 0.5,  type: 'major' },
  { id: 'safety',          label: 'Safety Violation',      value: 1.0,  type: 'major' },
  { id: 'time',            label: 'Time Violation',        value: 0.25, type: 'minor' },
  { id: 'choreo_boundary', label: 'Choreo Boundary',       value: 0.25, type: 'minor' },
];

function mockScoreLiveMode() {
  return Boolean(window.HZsupa && window.HZdb?.auth?._mode?.() === 'live');
}

function mockScoreUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(String(value || ''));
}

async function persistScoreRun(payload) {
  if (mockScoreLiveMode() && mockScoreUuid(payload.team_id)) {
    const { data, error } = await window.HZsupa
      .from('score_runs')
      .insert(payload)
      .select('*')
      .single();
    if (error) return { data: null, error };
    await window.HZdb.from('score_runs').upsert(data || payload, { onConflict: 'id' }); // saveRun follows with HZsel?._refresh + hz:refresh
    return { data: data || payload, error: null };
  }
  return await window.HZdb.from('score_runs').insert(payload).single(); // saveRun follows with HZsel?._refresh + hz:refresh
}

function MockScore({ snap, navigate, pushToast }) {
  const [deductions, setDeductions] = React.useState([]);
  const [note, setNote] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');
  const team = window.HZsel.programTeams?.().find(Boolean) || (snap.teams || []).find(Boolean) || null;
  const teamLabel = team
    ? `${team.name || team.division || 'Team'} · ${team.division || 'Team'}${team.level ? ` · L${team.level}` : ''}`
    : 'Team';
  const routine = window.HZsel.routine?.() || (snap.routines || []).find(r => !team?.id || r.team_id === team.id) || null;

  const predicted = window.HZsel.predictedScore(deductions);

  const addD = (d) => setDeductions(prev => [...prev, { ...d, _id: Math.random().toString(36).slice(2), at: Date.now() }]);
  const removeD = (id) => setDeductions(prev => prev.filter(x => x._id !== id));

  const saveRun = async () => {
    if (!team?.id || saving) return;
    setSaving(true);
    setError('');
    const { error: saveError } = await persistScoreRun({
      team_id: team.id,
      routine_id: routine?.id || null,
      run_at: new Date().toISOString(),
      subtotal: predicted.subtotal,
      deductions: predicted.deductions,
      total: predicted.total,
      note,
    });
    if (saveError) {
      setError(saveError.message || 'Could not save score run.');
      setSaving(false);
      return;
    }
    if (window.HZsel?._refresh) await window.HZsel._refresh();
    window.dispatchEvent(new CustomEvent('hz:refresh', { detail: { table: 'score_runs', action: 'insert' } }));
    pushToast?.({ title: 'Run saved', body: `${predicted.total.toFixed(2)} / 100` });
    setDeductions([]);
    setNote('');
    setSaving(false);
  };

  return (
    <div>
      <SectionHeading eyebrow="USASF judging panel · live prediction" title="Mock Score." trailing={
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="hz-btn" onClick={() => setDeductions([])}><HZIcon name="x" size={13}/> Clear deductions</button>
          <button className="hz-btn hz-btn-primary" onClick={saveRun} disabled={saving || !team?.id}><HZIcon name="check" size={13}/> {saving ? 'Saving...' : 'Save run'}</button>
        </div>
      }/>
      {error && <div className="hz-card" style={{ color: 'var(--hz-red)', marginBottom: 14, padding: 12 }}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: 24 }}>
        {/* Judging sheet */}
        <div className="hz-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 20 }}>
            <div>
              <div className="hz-eyebrow">{teamLabel} · Score rehearsal</div>
              <div className="hz-display" style={{ fontSize: 28, marginTop: 4 }}>Tabulation sheet</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="hz-eyebrow">Total</div>
              <div className="hz-display" style={{ fontSize: 72, lineHeight: 1, color: predicted.total >= 85 ? 'var(--hz-green)' : predicted.total >= 75 ? 'var(--hz-teal)' : 'var(--hz-amber)' }}>
                {predicted.total.toFixed(2)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--hz-dim)' }}>/ 100 possible</div>
            </div>
          </div>

          <table className="hz-table">
            <thead>
              <tr>
                <th>Category</th>
                <th style={{ textAlign: 'right' }}>Readiness</th>
                <th style={{ textAlign: 'right' }}>Coverage</th>
                <th style={{ textAlign: 'right' }}>Score</th>
                <th style={{ textAlign: 'right' }}>Max</th>
              </tr>
            </thead>
            <tbody>
              {predicted.rows.map(r => (
                <tr key={r.id}>
                  <td>{r.label}</td>
                  <td style={{ textAlign: 'right', color: 'var(--hz-dim)', fontFamily: 'var(--hz-mono)' }}>{r.readiness != null ? `${Math.round(r.readiness*100)}%` : '—'}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--hz-mono)', color: r.boost < 1 ? 'var(--hz-amber)' : '#fff' }}>{Math.round(r.boost*100)}%</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--hz-mono)', fontWeight: 700 }}>{r.score.toFixed(2)}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--hz-mono)', color: 'var(--hz-dimmer)' }}>{r.max}</td>
                </tr>
              ))}
              <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                <td style={{ fontWeight: 700 }}>Subtotal</td>
                <td></td><td></td>
                <td style={{ textAlign: 'right', fontFamily: 'var(--hz-mono)', fontWeight: 700 }}>{predicted.subtotal.toFixed(2)}</td>
                <td style={{ textAlign: 'right', fontFamily: 'var(--hz-mono)', color: 'var(--hz-dimmer)' }}>100</td>
              </tr>
              <tr>
                <td style={{ color: 'var(--hz-red)', fontWeight: 700 }}>Deductions ({deductions.length})</td>
                <td></td><td></td>
                <td style={{ textAlign: 'right', fontFamily: 'var(--hz-mono)', fontWeight: 700, color: 'var(--hz-red)' }}>−{predicted.deductions.toFixed(2)}</td>
                <td></td>
              </tr>
            </tbody>
          </table>

          <div style={{ marginTop: 20 }}>
            <div className="hz-eyebrow" style={{ marginBottom: 10 }}>Judges' notes</div>
            <textarea className="hz-input" rows="3" placeholder="What stood out? What to clean up?" value={note} onChange={e => setNote(e.target.value)}/>
          </div>
        </div>

        {/* Deduction palette + log */}
        <div>
          <div className="hz-card" style={{ marginBottom: 16 }}>
            <div className="hz-eyebrow" style={{ marginBottom: 12 }}>Tap a deduction</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {DEDUCTIONS.map(d => (
                <button key={d.id} onClick={() => addD(d)} className="hz-btn" style={{ justifyContent: 'space-between', borderColor: d.type === 'major' ? 'rgba(255,94,108,0.35)' : 'var(--hz-line-2)' }}>
                  <span style={{ fontSize: 11.5, textAlign: 'left' }}>{d.label}</span>
                  <span className="hz-mono" style={{ color: d.type === 'major' ? 'var(--hz-red)' : 'var(--hz-amber)', fontWeight: 700, fontSize: 11 }}>−{d.value}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="hz-card">
            <div className="hz-eyebrow" style={{ marginBottom: 12 }}>Log · {deductions.length} events</div>
            {deductions.length === 0 ? (
              <div style={{ color: 'var(--hz-dim)', fontSize: 13, textAlign: 'center', padding: 24 }}>Clean run so far.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 340, overflowY: 'auto' }} className="hz-scroll">
                {deductions.slice().reverse().map((d) => (
                  <div key={d._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.03)' }}>
                    <div>
                      <div style={{ fontSize: 13 }}>{d.label}</div>
                      <div style={{ fontSize: 10, color: 'var(--hz-dim)', fontFamily: 'var(--hz-mono)' }}>{new Date(d.at).toLocaleTimeString()}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontFamily: 'var(--hz-mono)', color: d.type === 'major' ? 'var(--hz-red)' : 'var(--hz-amber)', fontWeight: 700 }}>−{d.value}</span>
                      <button onClick={() => removeD(d._id)} className="hz-btn hz-btn-ghost hz-btn-xs"><HZIcon name="x" size={11}/></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Saved runs history */}
      {snap.score_runs && snap.score_runs.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <div className="hz-eyebrow" style={{ marginBottom: 14 }}>Recent runs</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
            {[...snap.score_runs].reverse().slice(0, 8).map(r => (
              <div key={r.id} className="hz-card hz-card-dense">
                <div className="hz-display" style={{ fontSize: 32 }}>{(r.total||0).toFixed(1)}</div>
                <div style={{ fontSize: 10, color: 'var(--hz-dim)', marginTop: 4 }}>{new Date(r.run_at).toLocaleString()}</div>
                {r.note && <div style={{ fontSize: 11, color: 'var(--hz-dim)', marginTop: 6, fontStyle: 'italic' }}>"{r.note}"</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
window.MockScore = MockScore;
