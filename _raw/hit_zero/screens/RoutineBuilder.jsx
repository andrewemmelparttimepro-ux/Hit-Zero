// HIT ZERO — Routine Builder. Timeline of 45 eight-counts (2:30 @ 144 BPM).
// Horizontal grid of blocks you can reassign by tapping a section, then
// choose type. Sections recompute predicted score via selectors.

const HZ_SECTION_TYPES = [
  { id: 'opening',          label: 'Opening',    short: 'OPEN', color: '#F97FAC' },
  { id: 'standing_tumbling',label: 'Std Tumble', short: 'STND', color: '#27CFD7' },
  { id: 'running_tumbling', label: 'Run Tumble', short: 'RUN',  color: '#27CFD7' },
  { id: 'jumps',            label: 'Jumps',      short: 'JMP',  color: '#FFB454' },
  { id: 'stunts',           label: 'Stunts',     short: 'STNT', color: '#F97FAC' },
  { id: 'baskets',          label: 'Baskets',    short: 'BSKT', color: '#F97FAC' },
  { id: 'pyramid',          label: 'Pyramid',    short: 'PYR',  color: '#ffb0f9' },
  { id: 'dance',            label: 'Dance',      short: 'DNC',  color: '#81ffff' },
  { id: 'transition',       label: 'Transition', short: '→',    color: 'rgba(255,255,255,0.3)' },
];

function RoutineBuilder({ onNav }) {
  const [state, setState] = React.useState(window.HZStore.get());
  React.useEffect(() => window.HZStore.subscribe(setState), []);
  const [selected, setSelected] = React.useState(null);

  const routine = state.routine;
  const predicted = window.HZSelect.predictedScore();

  // build count→section map
  const countMap = {};
  routine.sections.forEach(s => {
    for (let c = s.start; c <= s.end; c++) countMap[c] = s;
  });

  const TOTAL = 45;
  const gridCells = [];
  for (let c = 1; c <= TOTAL; c++) {
    const s = countMap[c];
    const type = s ? HZ_SECTION_TYPES.find(t => t.id === s.type) : null;
    gridCells.push({ count: c, section: s, type });
  }

  return (
    <div style={{ padding: '0 20px', color: '#fff' }} className="hz-rise">
      <div style={{ marginTop: 6 }}>
        <div className="hz-eyebrow" style={{ color: 'var(--hz-pink)' }}>Routine · 2:30 @ 144 BPM · 45 × 8-count</div>
        <div className="hz-display" style={{ fontSize: 48, fontStyle: 'italic', fontWeight: 600, marginTop: 4, lineHeight: 0.95 }}>
          Build<br/>the <span style={{ color: 'var(--hz-teal)' }}>mix</span>.
        </div>
      </div>

      {/* Predicted score banner */}
      <div style={{ marginTop: 18, display: 'flex', gap: 10 }}>
        <div style={{ flex: 1, padding: '12px 14px', borderRadius: 14, background: 'linear-gradient(90deg, rgba(39,207,215,0.12), rgba(249,127,172,0.1))', border: '1px solid rgba(39,207,215,0.2)' }}>
          <div className="hz-eyebrow">Predicted</div>
          <div className="hz-display" style={{ fontSize: 30, fontStyle: 'italic', fontWeight: 600, lineHeight: 1 }}>{predicted.total.toFixed(1)}<span style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>/100</span></div>
        </div>
        <button onClick={() => onNav('score')} style={{ ...window.hzBtnPink, flex: 0 }}>Score Sim →</button>
      </div>

      {/* Music waveform sketch */}
      <div style={{ marginTop: 18, padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <window.HZIcon name="music" size={16} color="var(--hz-teal)"/>
          <div style={{ fontSize: 12, fontWeight: 600, flex: 1 }}>"Magic City Anthem" · v4 Final</div>
          <window.HZIcon name="play" size={14} color="var(--hz-pink)"/>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1, marginTop: 8, height: 32 }}>
          {Array.from({length: 60}).map((_, i) => {
            const h = 6 + Math.abs(Math.sin(i * 0.5)) * 20 + Math.abs(Math.sin(i * 0.23)) * 8;
            return <div key={i} style={{ flex: 1, height: h, background: i < 40 ? 'linear-gradient(180deg, var(--hz-teal), var(--hz-pink))' : 'rgba(255,255,255,0.15)', borderRadius: 1 }}/>;
          })}
        </div>
      </div>

      {/* Timeline grid */}
      <div className="hz-eyebrow" style={{ marginTop: 22 }}>8-Count Map · Tap to reassign</div>
      <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(9, 1fr)', gap: 3 }}>
        {gridCells.map(cell => {
          const isSelected = selected && cell.section && selected === cell.section.id;
          const isFirst = cell.section && cell.count === cell.section.start;
          return (
            <button key={cell.count} onClick={() => cell.section && setSelected(cell.section.id)}
              style={{
                aspectRatio: '1', borderRadius: 6, border: 'none', padding: 0,
                background: cell.type ? (cell.type.id === 'transition' ? 'rgba(255,255,255,0.04)' : cell.type.color + '30') : 'rgba(255,255,255,0.03)',
                color: '#fff', cursor: cell.section ? 'pointer' : 'default',
                fontSize: 8, fontWeight: 700, fontFamily: 'var(--hz-mono)',
                outline: isSelected ? '2px solid #fff' : 'none',
                position: 'relative', overflow: 'hidden',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
              {isFirst && cell.type && <span style={{ color: cell.type.color, textTransform: 'uppercase', fontSize: 7 }}>{cell.type.short}</span>}
              {!isFirst && <span style={{ color: 'rgba(255,255,255,0.3)' }}>{cell.count}</span>}
            </button>
          );
        })}
      </div>

      {/* Section list */}
      <div className="hz-eyebrow" style={{ marginTop: 22 }}>Sections</div>
      <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {routine.sections.map(s => {
          const type = HZ_SECTION_TYPES.find(t => t.id === s.type);
          const counts = s.end - s.start + 1;
          const readiness = type && type.id !== 'transition' && type.id !== 'opening' ? window.HZSelect.categoryReadiness(s.type) : null;
          const isSelected = selected === s.id;
          return (
            <div key={s.id} onClick={() => setSelected(isSelected ? null : s.id)}
              style={{ padding: 12, borderRadius: 12, background: isSelected ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)', border: '1px solid ' + (isSelected ? 'var(--hz-teal)' : 'rgba(255,255,255,0.06)'), cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 4, height: 28, borderRadius: 2, background: type?.color || 'rgba(255,255,255,0.2)' }}/>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{type?.label || s.type}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', fontFamily: 'var(--hz-mono)' }}>8-CTS {s.start}–{s.end} · {counts} counts</div>
                </div>
                {readiness != null && (
                  <div style={{ textAlign: 'right' }}>
                    <div className="hz-serif" style={{ fontSize: 16, fontWeight: 700, fontStyle: 'italic', color: readiness > 0.7 ? 'var(--hz-teal)' : 'var(--hz-amber)' }}>{Math.round(readiness*100)}%</div>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Ready</div>
                  </div>
                )}
              </div>
              {isSelected && (
                <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {HZ_SECTION_TYPES.map(t => (
                    <button key={t.id} onClick={(e) => { e.stopPropagation(); window.HZStore.updateSection(s.id, { type: t.id }); }}
                      style={{
                        padding: '6px 10px', borderRadius: 999, border: 'none', cursor: 'pointer', fontFamily: 'var(--hz-sans)',
                        background: s.type === t.id ? t.color : 'rgba(255,255,255,0.06)',
                        color: s.type === t.id ? '#000' : '#fff',
                        fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
                      }}>{t.label}</button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
window.RoutineBuilder = RoutineBuilder;
