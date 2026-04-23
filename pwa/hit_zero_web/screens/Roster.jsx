// ─────────────────────────────────────────────────────────────────────────────
// HIT ZERO WEB — Roster
// Sortable table + grid toggle. Click a row to open AthleteDrawer.
// ─────────────────────────────────────────────────────────────────────────────

function Roster({ snap, openAthlete, navigate }) {
  const [sort, setSort] = React.useState({ col: 'readiness', dir: 'desc' });
  const [filter, setFilter] = React.useState('all');
  const [view, setView] = React.useState('table');

  const rows = snap.athletes.map(a => {
    const r = window.HZsel.athleteReadiness(a.id);
    const att = window.HZsel.athleteAttendance(a.id);
    const sum = window.HZsel.athleteSkillsSummary(a.id);
    const bill = window.HZsel.athleteBilling(a.id);
    return { ...a, readiness: r, attendance: att.pct, mastered: sum.mastered, working: sum.working, owed: bill?.account.owed || 0 };
  });

  const filtered = rows.filter(r => filter === 'all' ? true : r.role === filter);
  const sorted = [...filtered].sort((a, b) => {
    const v = a[sort.col] > b[sort.col] ? 1 : a[sort.col] < b[sort.col] ? -1 : 0;
    return sort.dir === 'asc' ? v : -v;
  });

  const toggle = (col) => setSort(s => ({ col, dir: s.col === col && s.dir === 'desc' ? 'asc' : 'desc' }));

  return (
    <div>
      <SectionHeading eyebrow={`${snap.athletes.length} athletes · Senior Coed 4`} title="The roster." trailing={
        <div style={{ display: 'flex', gap: 8 }}>
          <select className="hz-input" style={{ width: 160, padding: '8px 12px' }} value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="all">All roles</option>
            <option value="flyer">Flyers</option>
            <option value="base">Bases</option>
            <option value="backspot">Backspots</option>
            <option value="tumbler">Tumblers</option>
            <option value="all-around">All-around</option>
          </select>
          <div style={{ display: 'flex', background: 'var(--hz-ink-3)', borderRadius: 10, padding: 3 }}>
            <button onClick={() => setView('table')} className="hz-btn hz-btn-ghost hz-btn-sm" style={{ background: view==='table'?'rgba(255,255,255,0.08)':'transparent' }}>Table</button>
            <button onClick={() => setView('grid')} className="hz-btn hz-btn-ghost hz-btn-sm" style={{ background: view==='grid'?'rgba(255,255,255,0.08)':'transparent' }}>Grid</button>
          </div>
        </div>
      }/>

      {view === 'table' ? (
        <div className="hz-card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="hz-table">
            <thead>
              <tr>
                <th style={{ paddingLeft: 20 }}><Th onClick={() => toggle('display_name')} sort={sort} col="display_name">Athlete</Th></th>
                <th><Th onClick={() => toggle('role')} sort={sort} col="role">Role</Th></th>
                <th><Th onClick={() => toggle('age')} sort={sort} col="age">Age</Th></th>
                <th><Th onClick={() => toggle('readiness')} sort={sort} col="readiness">Readiness</Th></th>
                <th><Th onClick={() => toggle('attendance')} sort={sort} col="attendance">Attendance</Th></th>
                <th><Th onClick={() => toggle('mastered')} sort={sort} col="mastered">Mastered</Th></th>
                <th><Th onClick={() => toggle('owed')} sort={sort} col="owed">Balance</Th></th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(r => (
                <tr key={r.id} onClick={() => openAthlete(r.id)} style={{ cursor: 'pointer' }}>
                  <td style={{ paddingLeft: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <Avatar name={r.display_name} initials={r.initials} color={r.photo_color} size={32}/>
                      <div>
                        <div style={{ fontWeight: 600 }}>{r.display_name}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ textTransform: 'capitalize', color: 'var(--hz-dim)' }}>{r.role}</td>
                  <td style={{ fontFamily: 'var(--hz-mono)', color: 'var(--hz-dim)' }}>{r.age}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 80, height: 5, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${r.readiness*100}%`, height: '100%', background: 'linear-gradient(90deg, var(--hz-teal), var(--hz-pink))' }}/>
                      </div>
                      <span style={{ fontFamily: 'var(--hz-mono)', fontSize: 12 }}>{Math.round(r.readiness*100)}</span>
                    </div>
                  </td>
                  <td style={{ fontFamily: 'var(--hz-mono)', color: r.attendance < 0.7 ? 'var(--hz-amber)' : '#fff' }}>{Math.round(r.attendance*100)}%</td>
                  <td style={{ fontFamily: 'var(--hz-mono)' }}>{r.mastered}</td>
                  <td>{r.owed > 0 ? <span className="hz-pill hz-pill-amber">${r.owed}</span> : <span style={{ color: 'var(--hz-dim)', fontSize: 12 }}>Paid</span>}</td>
                  <td><HZIcon name="chev-right" size={14} color="var(--hz-dim)"/></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
          {sorted.map(r => (
            <div key={r.id} className="hz-card" onClick={() => openAthlete(r.id)} style={{ cursor: 'pointer', padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <Avatar name={r.display_name} initials={r.initials} color={r.photo_color} size={44}/>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{r.display_name}</div>
                  <div style={{ fontSize: 10, color: 'var(--hz-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>{r.role}</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                <div><div style={{ fontSize: 9, color: 'var(--hz-dim)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.1em' }}>Ready</div><div className="hz-display" style={{ fontSize: 22, color: 'var(--hz-teal)' }}>{Math.round(r.readiness*100)}</div></div>
                <div><div style={{ fontSize: 9, color: 'var(--hz-dim)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.1em' }}>Attend</div><div className="hz-display" style={{ fontSize: 22 }}>{Math.round(r.attendance*100)}</div></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Th({ children, onClick, sort, col }) {
  const active = sort.col === col;
  return (
    <span onClick={onClick} style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, color: active ? '#fff' : 'var(--hz-dim)' }}>
      {children}
      {active && <HZIcon name={sort.dir === 'asc' ? 'chev-up' : 'chev-down'} size={10}/>}
    </span>
  );
}
window.Roster = Roster;
