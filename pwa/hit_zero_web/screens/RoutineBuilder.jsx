// ─────────────────────────────────────────────────────────────────────────────
// HIT ZERO WEB — Routine Builder
// Horizontal 8-count timeline. Sections arranged in lanes. Click sections
// to edit start/end. Drag-handle resize at edges. Sidebar shows predicted
// score that recomputes on every edit.
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
];

function RoutineBuilder({ snap, navigate, pushToast }) {
  const routine = React.useMemo(() => window.HZsel.routine(), [snap._tick]);
  const [selected, setSelected] = React.useState(null);
  const [dragging, setDragging] = React.useState(null); // { sectionId, edge: 'start'|'end'|'move', startX, startCount }

  if (!routine) return <EmptyState icon="routine" title="No routine yet" body="Start a routine for Magic."/>;

  const predicted = window.HZsel.predictedScore();
  const comp = window.HZsel.daysToComp();

  const beatsPerCell = 8; // one cell = one 8-count
  const cellWidth = 32;
  const gridWidth = routine.length_counts * cellWidth;
  const timelineRef = React.useRef(null);

  // ─── Mouse drag handling for resize/move ───
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
        const newStart = Math.max(1, Math.min(sec.end_count, dragging.startCount + delta));
        patch = { start_count: newStart };
      } else if (dragging.edge === 'end') {
        const newEnd = Math.max(sec.start_count, Math.min(routine.length_counts, dragging.startCount + delta));
        patch = { end_count: newEnd };
      } else if (dragging.edge === 'move') {
        const span = sec.end_count - sec.start_count;
        const newStart = Math.max(1, Math.min(routine.length_counts - span, dragging.startCount + delta));
        patch = { start_count: newStart, end_count: newStart + span };
      }
      if (patch) {
        window.HZdb.from('routine_sections').update(patch).eq('id', sec.id);
      }
    };
    const onUp = () => setDragging(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging, routine.sections.length]);

  const addSection = async () => {
    // Find a gap at the end
    const end = Math.max(...routine.sections.map(s => s.end_count), 0);
    const start = Math.min(end + 1, routine.length_counts - 3);
    await window.HZdb.from('routine_sections').insert({
      routine_id: routine.id,
      section_type: 'transition',
      label: 'New section',
      start_count: start,
      end_count: Math.min(start + 3, routine.length_counts),
      position: routine.sections.length,
    });
  };

  const updateSection = async (id, patch) => {
    await window.HZdb.from('routine_sections').update(patch).eq('id', id);
  };
  const deleteSection = async (id) => {
    await window.HZdb.from('routine_sections').delete().eq('id', id);
    setSelected(null);
  };

  const selectedSection = routine.sections.find(s => s.id === selected);

  // Coverage % — sum of section lengths / routine length
  const coverage = routine.sections.reduce((s, sec) => s + (sec.end_count - sec.start_count + 1), 0) / routine.length_counts;

  // Section type coverage pie
  const byType = {};
  routine.sections.forEach(s => { byType[s.section_type] = (byType[s.section_type] || 0) + (s.end_count - s.start_count + 1); });

  return (
    <div>
      <SectionHeading eyebrow={`2:30 · ${routine.length_counts} eight-counts · ${routine.bpm} BPM`} title={routine.name + '.'} trailing={
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="hz-btn" onClick={() => window.print()}><HZIcon name="print" size={13}/> Print sheet</button>
          <button className="hz-btn" onClick={addSection}><HZIcon name="plus" size={13}/> Section</button>
          <button className="hz-btn hz-btn-primary" onClick={() => navigate('score')}><HZIcon name="score" size={13}/> Mock Score</button>
        </div>
      }/>

      {/* Timeline */}
      <div className="hz-card" style={{ padding: 24, marginBottom: 24, overflow: 'hidden' }}>
        <div style={{ display: 'flex', gap: 14, marginBottom: 14, alignItems: 'baseline' }}>
          <div>
            <div className="hz-eyebrow">Coverage</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <div className="hz-display" style={{ fontSize: 30 }}>{Math.round(coverage*100)}%</div>
              <div style={{ fontSize: 11, color: 'var(--hz-dim)' }}>{routine.sections.length} sections</div>
            </div>
          </div>
          <div style={{ flex: 1 }}/>
          {Object.entries(byType).map(([type, count]) => (
            <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--hz-dim)' }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: SECTION_COLORS[type]?.dot || '#888' }}/>
              <span style={{ textTransform: 'capitalize' }}>{type.replace('_',' ')}</span>
              <span style={{ fontFamily: 'var(--hz-mono)', color: '#fff' }}>{count}</span>
            </div>
          ))}
        </div>

        <div ref={timelineRef} style={{ overflowX: 'auto', paddingBottom: 8 }} className="hz-scroll">
          <div style={{ width: gridWidth, position: 'relative', userSelect: 'none' }}>
            {/* Count ruler */}
            <div style={{ display: 'flex', height: 20, marginBottom: 6 }}>
              {Array.from({ length: routine.length_counts }).map((_, i) => {
                const isMajor = (i+1) % 8 === 0 || i === 0;
                return (
                  <div key={i} style={{ width: cellWidth, textAlign: 'center', fontSize: 10, fontFamily: 'var(--hz-mono)', color: isMajor ? '#fff' : 'var(--hz-dimmer)', borderLeft: isMajor ? '1px solid rgba(255,255,255,0.1)' : 'none', paddingTop: 4 }}>
                    {i + 1}
                  </div>
                );
              })}
            </div>

            {/* 8-count grid bg */}
            <div style={{ position: 'relative', height: 120, background: 'var(--hz-ink)', borderRadius: 10 }}>
              {/* grid lines */}
              {Array.from({ length: routine.length_counts }).map((_, i) => (
                <div key={i} style={{ position: 'absolute', left: i*cellWidth, top: 0, bottom: 0, width: 1, background: (i+1) % 8 === 0 ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.02)' }}/>
              ))}
              {/* sections */}
              {routine.sections.map((s, i) => {
                const color = SECTION_COLORS[s.section_type] || SECTION_COLORS.transition;
                const left = (s.start_count - 1) * cellWidth;
                const width = (s.end_count - s.start_count + 1) * cellWidth;
                const isSelected = selected === s.id;
                return (
                  <div
                    key={s.id}
                    onClick={() => setSelected(s.id)}
                    style={{
                      position: 'absolute',
                      left, width, top: 6, bottom: 6,
                      background: color.bg,
                      border: `1.5px solid ${isSelected ? '#fff' : color.border}`,
                      borderRadius: 8,
                      padding: '6px 10px',
                      cursor: 'pointer',
                      overflow: 'hidden',
                      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                      transition: 'border-color 120ms',
                    }}
                  >
                    <div onMouseDown={(e) => { e.stopPropagation(); setDragging({ sectionId: s.id, edge: 'move', startX: e.clientX, startCount: s.start_count }); }} style={{ cursor: 'grab', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {s.label || s.section_type}
                    </div>
                    <div style={{ fontSize: 9, fontFamily: 'var(--hz-mono)', color: 'var(--hz-dim)', whiteSpace: 'nowrap' }}>
                      8×{s.end_count - s.start_count + 1} · counts {s.start_count}-{s.end_count}
                    </div>
                    {/* resize handles */}
                    <div onMouseDown={(e) => { e.stopPropagation(); setDragging({ sectionId: s.id, edge: 'start', startX: e.clientX, startCount: s.start_count }); }}
                      style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 6, cursor: 'ew-resize' }}/>
                    <div onMouseDown={(e) => { e.stopPropagation(); setDragging({ sectionId: s.id, edge: 'end', startX: e.clientX, startCount: s.end_count }); }}
                      style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 6, cursor: 'ew-resize' }}/>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Editor + predicted score */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: 24 }}>
        {/* Section editor */}
        <div className="hz-card">
          <div className="hz-eyebrow" style={{ marginBottom: 14 }}>Section</div>
          {selectedSection ? (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--hz-dim)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.1em', marginBottom: 6 }}>Label</div>
                  <input className="hz-input" value={selectedSection.label || ''} onChange={e => updateSection(selectedSection.id, { label: e.target.value })}/>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--hz-dim)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.1em', marginBottom: 6 }}>Type</div>
                  <select className="hz-input" value={selectedSection.section_type} onChange={e => updateSection(selectedSection.id, { section_type: e.target.value })}>
                    {SECTION_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--hz-dim)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.1em', marginBottom: 6 }}>Start count</div>
                  <input type="number" min="1" max={routine.length_counts} className="hz-input" value={selectedSection.start_count} onChange={e => updateSection(selectedSection.id, { start_count: +e.target.value })}/>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--hz-dim)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.1em', marginBottom: 6 }}>End count</div>
                  <input type="number" min={selectedSection.start_count} max={routine.length_counts} className="hz-input" value={selectedSection.end_count} onChange={e => updateSection(selectedSection.id, { end_count: +e.target.value })}/>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="hz-btn hz-btn-danger" onClick={() => deleteSection(selectedSection.id)}><HZIcon name="trash" size={13}/> Delete</button>
              </div>
            </div>
          ) : (
            <div style={{ color: 'var(--hz-dim)', padding: 20, fontSize: 13 }}>
              Click a section on the timeline to edit it. Drag edges to resize.
              Drag the body to move.
            </div>
          )}

          {/* All sections list */}
          <div style={{ marginTop: 28 }}>
            <div className="hz-eyebrow" style={{ marginBottom: 10 }}>All sections</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[...routine.sections].sort((a,b) => a.start_count - b.start_count).map(s => {
                const color = SECTION_COLORS[s.section_type] || SECTION_COLORS.transition;
                return (
                  <div key={s.id} onClick={() => setSelected(s.id)} style={{
                    display: 'grid', gridTemplateColumns: '8px 100px 1fr 90px', alignItems: 'center', gap: 12,
                    padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                    background: selected === s.id ? 'rgba(255,255,255,0.06)' : 'transparent',
                  }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: color.dot }}/>
                    <div style={{ fontSize: 12, textTransform: 'capitalize', color: 'var(--hz-dim)' }}>{s.section_type.replace('_',' ')}</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{s.label}</div>
                    <div style={{ fontFamily: 'var(--hz-mono)', fontSize: 11, color: 'var(--hz-dim)', textAlign: 'right' }}>
                      {s.start_count}→{s.end_count}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Live score */}
        <div className="hz-card" style={{ position: 'sticky', top: 96, height: 'fit-content' }}>
          <div className="hz-eyebrow">Live Prediction</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 6, marginBottom: 18 }}>
            <div className="hz-display" style={{ fontSize: 60 }}>{predicted.total.toFixed(1)}</div>
            <div style={{ fontSize: 14, color: 'var(--hz-dim)' }}>/ 100</div>
          </div>
          {predicted.rows.map(r => (
            <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '1fr 50px', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--hz-line)', fontSize: 12 }}>
              <div>
                <div>{r.label}</div>
                {r.boost < 1 && <div style={{ fontSize: 10, color: 'var(--hz-amber)' }}>Section missing / short</div>}
              </div>
              <div style={{ fontFamily: 'var(--hz-mono)', textAlign: 'right' }}>
                {r.score.toFixed(1)}<span style={{ color: 'var(--hz-dimmer)' }}>/{r.max}</span>
              </div>
            </div>
          ))}
          <div style={{ marginTop: 14, padding: 12, background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
            <div style={{ fontSize: 11, color: 'var(--hz-dim)', lineHeight: 1.5 }}>
              Prediction blends team skill readiness with the section coverage you've built.
              {comp && <> We'd take this <span style={{ color: 'var(--hz-teal)', fontWeight: 600 }}>in {comp.days} days</span> to the next floor moment.</>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
window.RoutineBuilder = RoutineBuilder;
