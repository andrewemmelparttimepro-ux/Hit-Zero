// HIT ZERO — Roster. List view → detail view with full skill matrix.
// Tap a skill cell → cycles status (none → working → got_it → mastered → none).

function Roster({ onNav }) {
  const [state, setState] = React.useState(window.HZStore.get());
  React.useEffect(() => window.HZStore.subscribe(setState), []);
  const [detailId, setDetailId] = React.useState(null);
  const [sort, setSort] = React.useState('role');
  const [query, setQuery] = React.useState('');

  const Avatar = window.HZAvatar;

  if (detailId) {
    return <AthleteDetail id={detailId} onBack={() => setDetailId(null)} />;
  }

  // sort+filter
  let list = [...state.roster];
  if (query) list = list.filter(a => a.name.toLowerCase().includes(query.toLowerCase()));
  if (sort === 'role') list.sort((a, b) => a.role.localeCompare(b.role) || a.name.localeCompare(b.name));
  if (sort === 'readiness') list.sort((a, b) => window.HZSelect.athleteReadiness(b.id) - window.HZSelect.athleteReadiness(a.id));
  if (sort === 'attendance') list.sort((a, b) => window.HZSelect.attendance(b.id).pct - window.HZSelect.attendance(a.id).pct);

  return (
    <div style={{ padding: '0 20px', color: '#fff' }} className="hz-rise">
      <div style={{ marginTop: 6 }}>
        <div className="hz-eyebrow" style={{ color: 'var(--hz-teal)' }}>Magic · Senior Coed 4 · Level 4</div>
        <div className="hz-display" style={{ fontSize: 52, fontStyle: 'italic', fontWeight: 600, marginTop: 4 }}>Roster<span style={{ color: 'var(--hz-pink)' }}>.</span></div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{state.roster.length} athletes. Zero passengers.</div>
      </div>

      {/* search */}
      <div style={{ marginTop: 18, position: 'relative' }}>
        <window.HZIcon name="search" size={16} color="rgba(255,255,255,0.45)"/>
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name..."
          style={{ position: 'absolute', inset: 0, paddingLeft: 38, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, color: '#fff', fontSize: 14, outline: 'none', fontFamily: 'var(--hz-sans)' }}/>
        <div style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }}>
          <window.HZIcon name="search" size={16} color="rgba(255,255,255,0.45)"/>
        </div>
        <div style={{ height: 44 }}/>
      </div>

      {/* sort chips */}
      <div style={{ display: 'flex', gap: 6, marginTop: 12, overflowX: 'auto' }} className="hz-scroll">
        {[['role','By Role'],['readiness','Readiness'],['attendance','Attendance']].map(([id, label]) => (
          <button key={id} onClick={() => setSort(id)}
            style={{ padding: '6px 12px', borderRadius: 999, border: 'none', cursor: 'pointer', fontFamily: 'var(--hz-sans)',
              background: sort === id ? 'var(--hz-teal)' : 'rgba(255,255,255,0.05)',
              color: sort === id ? '#000' : 'rgba(255,255,255,0.7)',
              fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
              whiteSpace: 'nowrap',
            }}>{label}</button>
        ))}
      </div>

      {/* list */}
      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {list.map(a => {
          const readiness = window.HZSelect.athleteReadiness(a.id);
          const attend = window.HZSelect.attendance(a.id);
          return (
            <div key={a.id} onClick={() => setDetailId(a.id)}
              style={{ display: 'flex', alignItems: 'center', padding: 12, borderRadius: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer' }}>
              <Avatar athlete={a} size={48} />
              <div style={{ marginLeft: 12, flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 15, letterSpacing: '-0.01em' }}>{a.name}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 3 }}>
                  <span className="hz-pill" style={{ textTransform: 'capitalize', background: a.photo === '#f97fac' ? 'rgba(249,127,172,0.15)' : 'rgba(39,207,215,0.15)', color: a.photo === '#f97fac' ? 'var(--hz-pink)' : 'var(--hz-teal)' }}>{a.role}</span>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{a.age}y</span>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="hz-serif" style={{ fontSize: 22, fontWeight: 700, fontStyle: 'italic', color: readiness > 0.7 ? 'var(--hz-teal)' : readiness > 0.5 ? '#fff' : 'var(--hz-amber)' }}>{Math.round(readiness*100)}%</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--hz-mono)' }}>ATT {Math.round(attend.pct*100)}%</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Athlete detail — full skill matrix ─────────────────────────────────────
function AthleteDetail({ id, onBack }) {
  const [state, setState] = React.useState(window.HZStore.get());
  React.useEffect(() => window.HZStore.subscribe(setState), []);
  const a = state.roster.find(x => x.id === id);
  if (!a) return null;

  const readiness = window.HZSelect.athleteReadiness(a.id);
  const attend = window.HZSelect.attendance(a.id);
  const counts = window.HZSelect.athleteSkillsLearned(a.id);
  const Avatar = window.HZAvatar;

  return (
    <div style={{ padding: '0 20px', color: '#fff' }} className="hz-rise">
      {/* back */}
      <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: 600, padding: '6px 0', cursor: 'pointer', fontFamily: 'var(--hz-sans)' }}>
        <window.HZIcon name="chev-left" size={16}/> Roster
      </button>

      {/* hero */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginTop: 12 }}>
        <Avatar athlete={a} size={80}/>
        <div style={{ flex: 1 }}>
          <div className="hz-eyebrow" style={{ color: 'var(--hz-teal)', textTransform: 'capitalize', letterSpacing: '0.16em' }}>{a.role} · {a.age} YRS</div>
          <div className="hz-display" style={{ fontSize: 34, fontWeight: 600, fontStyle: 'italic', marginTop: 2, lineHeight: 1 }}>{a.name.split(' ')[0]}<br/><span style={{ color: 'var(--hz-pink)' }}>{a.name.split(' ').slice(1).join(' ')}</span></div>
        </div>
      </div>

      {/* stat strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 18 }}>
        <StatBlock label="Ready" value={Math.round(readiness*100)+'%'} color="teal"/>
        <StatBlock label="Mastered" value={counts.mastered}/>
        <StatBlock label="Working" value={counts.working} color="amber"/>
        <StatBlock label="Att." value={Math.round(attend.pct*100)+'%'}/>
      </div>

      <div className="hz-eyebrow" style={{ marginTop: 22, color: 'var(--hz-dim)' }}>Skill Matrix · Tap to cycle</div>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 4, fontFamily: 'var(--hz-mono)' }}>
        · NONE &nbsp; <span style={{ color: 'var(--hz-amber)' }}>WIP WORKING</span> &nbsp; <span style={{ color: 'var(--hz-teal)' }}>GOT IT</span> &nbsp; <span style={{ color: 'var(--hz-pink)' }}>HIT MASTERED</span>
      </div>

      {/* Skill categories */}
      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {Object.entries(window.HZ_SKILL_TREE).map(([catId, cat]) => (
          <SkillCategory key={catId} catId={catId} cat={cat} athleteId={a.id}/>
        ))}
      </div>
    </div>
  );
}

function StatBlock({ label, value, color }) {
  const c = color === 'teal' ? 'var(--hz-teal)' : color === 'amber' ? 'var(--hz-amber)' : '#fff';
  return (
    <div style={{ padding: 10, borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
      <div className="hz-serif" style={{ fontSize: 22, fontWeight: 700, fontStyle: 'italic', color: c, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>{label}</div>
    </div>
  );
}

function SkillCategory({ catId, cat, athleteId }) {
  const [state, setState] = React.useState(window.HZStore.get());
  React.useEffect(() => window.HZStore.subscribe(setState), []);
  const [expanded, setExpanded] = React.useState(true);

  const statusColor = {
    none: 'rgba(255,255,255,0.06)',
    working: 'rgba(255,180,84,0.15)',
    got_it: 'rgba(39,207,215,0.18)',
    mastered: 'rgba(249,127,172,0.2)',
  };
  const statusBorder = {
    none: 'rgba(255,255,255,0.08)',
    working: 'rgba(255,180,84,0.4)',
    got_it: 'rgba(39,207,215,0.45)',
    mastered: 'rgba(249,127,172,0.55)',
  };
  const statusText = {
    none: 'rgba(255,255,255,0.5)',
    working: 'var(--hz-amber)',
    got_it: 'var(--hz-teal)',
    mastered: 'var(--hz-pink)',
  };

  return (
    <div>
      <button onClick={() => setExpanded(!expanded)} style={{ display: 'flex', alignItems: 'center', width: '100%', background: 'transparent', border: 'none', padding: '0 0 10px 0', cursor: 'pointer', color: '#fff', fontFamily: 'var(--hz-sans)' }}>
        <div className="hz-display" style={{ fontSize: 20, fontWeight: 600, fontStyle: 'italic', flex: 1, textAlign: 'left' }}>{cat.label}</div>
        <window.HZIcon name={expanded ? 'chev-down' : 'chev-right'} size={16} color="rgba(255,255,255,0.4)"/>
      </button>
      {expanded && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {cat.skills.map(sk => {
            const st = state.skills[athleteId]?.[sk.id] || 'none';
            const s = window.HZ_SKILL_STATUS.find(x => x.id === st);
            return (
              <button key={sk.id} onClick={() => window.HZStore.cycleSkill(athleteId, sk.id)}
                style={{
                  textAlign: 'left', padding: '10px 12px', borderRadius: 12,
                  background: statusColor[st], border: `1px solid ${statusBorder[st]}`,
                  cursor: 'pointer', fontFamily: 'var(--hz-sans)', color: '#fff',
                  transition: 'all 0.2s',
                }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.08em' }}>LVL {sk.level}</span>
                  <span style={{ fontSize: 9, fontWeight: 800, color: statusText[st], letterSpacing: '0.06em' }}>{s.short}</span>
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, marginTop: 4, lineHeight: 1.2 }}>{sk.name}</div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

window.Roster = Roster;
window.AthleteDetail = AthleteDetail;
