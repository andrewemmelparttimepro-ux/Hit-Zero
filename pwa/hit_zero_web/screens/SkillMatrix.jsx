// ─────────────────────────────────────────────────────────────────────────────
// HIT ZERO WEB — Skill Matrix
// Full USASF grid: athletes (rows) × skills (columns). Click a cell to cycle
// status. Sticky first column, scrollable right. Filter by category + level.
// ─────────────────────────────────────────────────────────────────────────────

function SkillMatrix({ snap, openAthlete, pushToast }) {
  const [catFilter, setCatFilter] = React.useState('all');
  const [levelMax, setLevelMax] = React.useState(5);

  const cats = ['standing_tumbling','running_tumbling','jumps','stunts','pyramids','baskets'];
  const catLabel = {
    standing_tumbling: 'ST Tumbling', running_tumbling: 'RN Tumbling',
    jumps: 'Jumps', stunts: 'Stunts', pyramids: 'Pyramids', baskets: 'Baskets',
  };

  const skills = snap.skills
    .filter(s => (catFilter === 'all' || s.category === catFilter) && s.level <= levelMax)
    .sort((a,b) => a.category.localeCompare(b.category) || a.level - b.level);

  const statusByAS = {};
  (snap.athlete_skills || []).forEach(r => { statusByAS[r.athlete_id + ':' + r.skill_id] = r.status; });

  const cycle = async (aid, sid) => {
    const order = ['none','working','got_it','mastered'];
    const cur = statusByAS[aid + ':' + sid] || 'none';
    const next = order[(order.indexOf(cur) + 1) % order.length];
    await window.HZdb.from('athlete_skills')
      .upsert({ athlete_id: aid, skill_id: sid, status: next, updated_at: new Date().toISOString() }, { onConflict: 'athlete_id,skill_id' });
  };

  // Category summary for header
  const catSummary = {};
  cats.forEach(c => {
    const cSkills = snap.skills.filter(s => s.category === c && s.level <= levelMax);
    let sum = 0, n = 0;
    snap.athletes.forEach(a => cSkills.forEach(s => { sum += window.HZsel.STATUS_PCT[statusByAS[a.id+':'+s.id] || 'none']; n++; }));
    catSummary[c] = n ? sum/n : 0;
  });

  return (
    <div>
      <SectionHeading eyebrow="Every athlete, every skill" title="Skill Matrix." trailing={
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--hz-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>Level ≤</div>
          <select className="hz-input" style={{ width: 70, padding: '8px 12px' }} value={levelMax} onChange={e => setLevelMax(+e.target.value)}>
            {[3,4,5,6,7].map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          <select className="hz-input" style={{ width: 180, padding: '8px 12px' }} value={catFilter} onChange={e => setCatFilter(e.target.value)}>
            <option value="all">All categories</option>
            {cats.map(c => <option key={c} value={c}>{catLabel[c]}</option>)}
          </select>
        </div>
      }/>

      {/* Category summary tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10, marginBottom: 20 }}>
        {cats.map(c => (
          <div key={c} className="hz-card hz-card-dense" onClick={() => setCatFilter(catFilter === c ? 'all' : c)}
            style={{ cursor: 'pointer', borderColor: catFilter === c ? 'rgba(39,207,215,0.4)' : 'var(--hz-line)' }}>
            <div className="hz-eyebrow" style={{ fontSize: 9 }}>{catLabel[c]}</div>
            <div className="hz-display" style={{ fontSize: 26, marginTop: 2 }}>{Math.round(catSummary[c]*100)}%</div>
          </div>
        ))}
      </div>

      {/* Matrix */}
      <div className="hz-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 340px)' }} className="hz-scroll">
          <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: 'max-content', minWidth: '100%' }}>
            <thead>
              <tr>
                <th style={{ position: 'sticky', left: 0, top: 0, zIndex: 3, background: 'var(--hz-ink-2)', padding: '12px 16px', textAlign: 'left', minWidth: 220, borderBottom: '1px solid var(--hz-line)', borderRight: '1px solid var(--hz-line)' }}>
                  <div className="hz-eyebrow">Athlete</div>
                </th>
                {skills.map(s => (
                  <th key={s.id} style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--hz-ink-2)', padding: 6, borderBottom: '1px solid var(--hz-line)', minWidth: 34 }} title={`${s.name} · ${s.category.replace('_',' ')} · L${s.level}`}>
                    <div style={{
                      writingMode: 'vertical-rl', transform: 'rotate(180deg)',
                      fontSize: 10, color: 'var(--hz-dim)', letterSpacing: 0, fontWeight: 600,
                      height: 120, display: 'inline-flex', alignItems: 'center',
                      whiteSpace: 'nowrap',
                    }}>
                      <span style={{ color: 'var(--hz-dimmer)', marginRight: 6, fontFamily: 'var(--hz-mono)' }}>L{s.level}</span>
                      {s.name}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {snap.athletes.map(a => (
                <tr key={a.id}>
                  <td style={{ position: 'sticky', left: 0, zIndex: 1, background: 'var(--hz-ink-2)', padding: '8px 16px', borderBottom: '1px solid var(--hz-line)', borderRight: '1px solid var(--hz-line)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => openAthlete(a.id)}>
                      <Avatar name={a.display_name} initials={a.initials} color={a.photo_color} src={a.photo_url} size={28}/>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{a.display_name}</div>
                        <div style={{ fontSize: 10, color: 'var(--hz-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>{a.role}</div>
                      </div>
                    </div>
                  </td>
                  {skills.map(s => {
                    const st = statusByAS[a.id + ':' + s.id] || 'none';
                    return (
                      <td key={s.id} style={{ padding: 3, borderBottom: '1px solid var(--hz-line)' }}>
                        <div className={`skill-cell status-${st}`} onClick={() => cycle(a.id, s.id)} title={`${a.display_name} · ${s.name}`}>
                          {st === 'none' ? '' : st === 'working' ? '·' : st === 'got_it' ? '✓' : '★'}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 20, marginTop: 14, fontSize: 11, color: 'var(--hz-dim)' }}>
        <Legend color="rgba(255,255,255,0.04)" label="Not Started"/>
        <Legend color="rgba(255,180,84,0.18)" label="Working"/>
        <Legend color="rgba(39,207,215,0.22)" label="Got It"/>
        <Legend color="linear-gradient(135deg, rgba(39,207,215,0.35), rgba(249,127,172,0.35))" label="Mastered"/>
        <span style={{ marginLeft: 'auto', fontStyle: 'italic' }}>Click any cell to cycle. Everyone else's view updates live.</span>
      </div>
    </div>
  );
}

function Legend({ color, label }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
    <span style={{ width: 16, height: 16, borderRadius: 4, background: color }}/>
    {label}
  </span>;
}
window.SkillMatrix = SkillMatrix;
