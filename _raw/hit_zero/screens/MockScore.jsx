// HIT ZERO — Mock Score Simulator. Live-computed score sheet + deduction tap-list.
// Pulls category readiness from skill matrix, applies routine composition boost,
// subtracts deductions. Everything recomputes on tap.

const HZ_DEDUCTIONS = [
  { id: 'fall',       label: 'Fall from stunt',        value: 0.5 },
  { id: 'bobble',     label: 'Bobble',                 value: 0.25 },
  { id: 'tumble',     label: 'Tumble incomplete',      value: 0.25 },
  { id: 'mismatch',   label: 'Choreo mismatch',        value: 0.1 },
  { id: 'uniform',    label: 'Uniform violation',      value: 0.25 },
  { id: 'boundary',   label: 'Out of bounds',          value: 0.25 },
  { id: 'illegal',    label: 'Illegal skill (safety)', value: 1.5 },
  { id: 'time',       label: 'Over time',              value: 0.5 },
];

function MockScore({ onNav }) {
  const [state, setState] = React.useState(window.HZStore.get());
  React.useEffect(() => window.HZStore.subscribe(setState), []);

  const pred = window.HZSelect.predictedScore();

  return (
    <div style={{ padding: '0 20px', color: '#fff' }} className="hz-rise">
      <div style={{ marginTop: 6 }}>
        <div className="hz-eyebrow" style={{ color: 'var(--hz-pink)' }}>Score Simulator · USASF style</div>
        <div className="hz-display" style={{ fontSize: 46, fontStyle: 'italic', fontWeight: 600, marginTop: 4, lineHeight: 0.95 }}>
          Hit <span style={{ color: 'var(--hz-pink)' }}>zero</span><br/>deductions.
        </div>
      </div>

      {/* BIG SCORE */}
      <div style={{ marginTop: 22, padding: 24, borderRadius: 22, background: 'linear-gradient(135deg, #0a1b1d 0%, #1a0d18 100%)', border: '1px solid rgba(39,207,215,0.2)', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 0%, rgba(39,207,215,0.2) 0%, transparent 60%)', pointerEvents: 'none' }}/>
        <div style={{ position: 'relative' }}>
          <div className="hz-eyebrow" style={{ color: 'var(--hz-teal)' }}>Projected Final</div>
          <div className="hz-display" style={{ fontSize: 100, fontWeight: 600, fontStyle: 'italic', lineHeight: 1, letterSpacing: '-0.05em', margin: '4px 0' }}>
            {pred.total.toFixed(1)}
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--hz-mono)' }}>
            SUB <span style={{ color: 'var(--hz-teal)' }}>{pred.subtotal.toFixed(2)}</span> &nbsp;·&nbsp; DED <span style={{ color: 'var(--hz-red)' }}>-{pred.deductions.toFixed(2)}</span> &nbsp;/&nbsp; 100
          </div>
        </div>
      </div>

      {/* Sheet rows */}
      <div className="hz-eyebrow" style={{ marginTop: 24 }}>Score Sheet</div>
      <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {pred.rows.map(r => {
          const pct = r.score / r.max;
          return (
            <div key={r.id} style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 600, flex: 1 }}>{r.label}</div>
                <div className="hz-serif" style={{ fontSize: 18, fontWeight: 700, fontStyle: 'italic', color: pct > 0.75 ? 'var(--hz-teal)' : pct > 0.5 ? '#fff' : 'var(--hz-amber)' }}>{r.score.toFixed(1)}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--hz-mono)', width: 30, textAlign: 'right' }}>/{r.max}</div>
              </div>
              <div style={{ marginTop: 6, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                <div style={{ width: `${pct*100}%`, height: '100%', background: pct > 0.75 ? 'var(--hz-teal)' : pct > 0.5 ? 'rgba(255,255,255,0.5)' : 'var(--hz-amber)', transition: 'width 0.4s' }}/>
              </div>
            </div>
          );
        })}
      </div>

      {/* Deductions */}
      <div className="hz-eyebrow" style={{ marginTop: 22, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span>Tap a deduction</span>
        {state.mockDeductions.length > 0 && (
          <button onClick={() => window.HZStore.clearDeductions()} style={{ background: 'transparent', border: 'none', color: 'var(--hz-teal)', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', cursor: 'pointer', fontFamily: 'var(--hz-sans)' }}>CLEAR ALL</button>
        )}
      </div>
      <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        {HZ_DEDUCTIONS.map(d => {
          const count = state.mockDeductions.filter(x => x.id === d.id).length;
          return (
            <button key={d.id} onClick={() => window.HZStore.addDeduction(d)}
              style={{
                textAlign: 'left', padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                background: count > 0 ? 'rgba(255,94,108,0.12)' : 'rgba(255,255,255,0.03)',
                border: count > 0 ? '1px solid rgba(255,94,108,0.3)' : '1px solid rgba(255,255,255,0.06)',
                color: '#fff', fontFamily: 'var(--hz-sans)', position: 'relative',
              }}>
              <div style={{ fontSize: 11, fontWeight: 600, lineHeight: 1.2 }}>{d.label}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                <span style={{ fontSize: 10, color: 'var(--hz-red)', fontFamily: 'var(--hz-mono)', fontWeight: 700 }}>-{d.value.toFixed(2)}</span>
                {count > 0 && <span style={{ fontSize: 10, fontWeight: 800, color: '#fff', background: 'var(--hz-red)', padding: '1px 6px', borderRadius: 99 }}>×{count}</span>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
window.MockScore = MockScore;
