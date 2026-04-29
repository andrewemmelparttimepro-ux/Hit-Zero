// ─────────────────────────────────────────────────────────────────────────────
// HIT ZERO WEB — Roster
// Sortable table + grid toggle. Click a row to open AthleteDrawer.
// ─────────────────────────────────────────────────────────────────────────────

const POSITION_OPTIONS = ['flyer', 'base', 'backspot', 'tumbler', 'all-around'];

function initialsFor(name) {
  if (!name) return '';
  return name.trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();
}

function Roster({ snap, openAthlete, navigate }) {
  const isMobile = (typeof window !== 'undefined' && window.useIsMobile) ? window.useIsMobile() : false;
  const [sort, setSort] = React.useState({ col: 'readiness', dir: 'desc' });
  const [filter, setFilter] = React.useState('all');
  const [view, setView] = React.useState(isMobile ? 'grid' : 'table');
  const [showAdd, setShowAdd] = React.useState(false);
  const [editingId, setEditingId] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const team = (snap.teams || [])[0] || null;
  const teamLabel = team
    ? `${team.division || team.name || 'Team'}${team.level ? ` · L${team.level}` : ''}`
    : 'Team';

  const rows = snap.athletes.map(a => {
    const r = window.HZsel.athleteReadiness(a.id);
    const att = window.HZsel.athleteAttendance(a.id);
    const sum = window.HZsel.athleteSkillsSummary(a.id);
    const bill = window.HZsel.athleteBilling(a.id);
    return { ...a, readiness: r, attendance: att.pct, mastered: sum.mastered, working: sum.working, owed: bill?.account.owed || 0 };
  });

  const filtered = rows.filter(r => filter === 'all' ? true : (r.position || '').toLowerCase() === filter);
  const sorted = [...filtered].sort((a, b) => {
    const av = a[sort.col]; const bv = b[sort.col];
    const v = (av ?? '') > (bv ?? '') ? 1 : (av ?? '') < (bv ?? '') ? -1 : 0;
    return sort.dir === 'asc' ? v : -v;
  });

  const toggle = (col) => setSort(s => ({ col, dir: s.col === col && s.dir === 'desc' ? 'asc' : 'desc' }));

  async function addAthlete(values) {
    if (!team?.id) { alert('No team loaded — please create a team first.'); return; }
    setBusy(true);
    try {
      const payload = {
        team_id: team.id,
        display_name: values.display_name.trim(),
        initials: initialsFor(values.display_name),
        age: values.age ? parseInt(values.age, 10) : null,
        position: values.position || null,
      };
      const { error } = await window.HZdb.from('athletes').insert(payload);
      if (error) { console.error('[athletes] insert', error); alert('Could not add athlete: ' + error.message); return; }
      setShowAdd(false);
    } finally { setBusy(false); }
  }

  async function patchAthlete(id, patch) {
    setBusy(true);
    try {
      const { error } = await window.HZdb.from('athletes').update(patch).eq('id', id);
      if (error) { console.error('[athletes] update', error); alert('Could not save: ' + error.message); return false; }
      return true;
    } finally { setBusy(false); }
  }

  async function removeAthlete(athlete) {
    if (!confirm(`Remove ${athlete.display_name} from the roster?`)) return;
    setBusy(true);
    try {
      const { error } = await window.HZdb.from('athletes').update({ deleted_at: new Date().toISOString() }).eq('id', athlete.id);
      if (error) { console.error('[athletes] soft-delete', error); alert('Could not remove: ' + error.message); }
    } finally { setBusy(false); }
  }

  return (
    <div>
      <SectionHeading eyebrow={`${snap.athletes.length} athletes · ${teamLabel}`} title="The roster." trailing={
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => { setShowAdd(s => !s); setEditingId(null); }} className="hz-btn hz-btn-primary hz-btn-sm">
            {showAdd ? 'Cancel' : '+ Add athlete'}
          </button>
          <select className="hz-input" style={{ width: 160, padding: '8px 12px' }} value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="all">All positions</option>
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

      {showAdd && (
        <AddAthleteCard onSave={addAthlete} onCancel={() => setShowAdd(false)} disabled={busy}/>
      )}

      {view === 'table' ? (
        <div className="hz-card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="hz-table">
            <thead>
              <tr>
                <th style={{ paddingLeft: 20 }}><Th onClick={() => toggle('display_name')} sort={sort} col="display_name">Athlete</Th></th>
                <th><Th onClick={() => toggle('position')} sort={sort} col="position">Position</Th></th>
                <th><Th onClick={() => toggle('age')} sort={sort} col="age">Age</Th></th>
                <th><Th onClick={() => toggle('readiness')} sort={sort} col="readiness">Readiness</Th></th>
                <th><Th onClick={() => toggle('attendance')} sort={sort} col="attendance">Attendance</Th></th>
                <th><Th onClick={() => toggle('mastered')} sort={sort} col="mastered">Mastered</Th></th>
                <th><Th onClick={() => toggle('owed')} sort={sort} col="owed">Balance</Th></th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(r => editingId === r.id ? (
                <EditAthleteRow key={r.id} athlete={r} disabled={busy}
                  onSave={async (patch) => { const ok = await patchAthlete(r.id, patch); if (ok) setEditingId(null); }}
                  onCancel={() => setEditingId(null)}
                  onRemove={() => removeAthlete(r)}/>
              ) : (
                <tr key={r.id} style={{ cursor: 'pointer' }}>
                  <td style={{ paddingLeft: 20 }} onClick={() => openAthlete(r.id)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <Avatar name={r.display_name} initials={r.initials} color={r.photo_color} src={r.photo_url} size={32}/>
                      <div>
                        <div style={{ fontWeight: 600 }}>{r.display_name}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ textTransform: 'capitalize', color: 'var(--hz-dim)' }} onClick={() => openAthlete(r.id)}>{r.position || '—'}</td>
                  <td style={{ fontFamily: 'var(--hz-mono)', color: 'var(--hz-dim)' }} onClick={() => openAthlete(r.id)}>{r.age ?? '—'}</td>
                  <td onClick={() => openAthlete(r.id)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 80, height: 5, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${r.readiness*100}%`, height: '100%', background: 'linear-gradient(90deg, var(--hz-teal), var(--hz-pink))' }}/>
                      </div>
                      <span style={{ fontFamily: 'var(--hz-mono)', fontSize: 12 }}>{Math.round(r.readiness*100)}</span>
                    </div>
                  </td>
                  <td style={{ fontFamily: 'var(--hz-mono)', color: r.attendance < 0.7 ? 'var(--hz-amber)' : '#fff' }} onClick={() => openAthlete(r.id)}>{Math.round(r.attendance*100)}%</td>
                  <td style={{ fontFamily: 'var(--hz-mono)' }} onClick={() => openAthlete(r.id)}>{r.mastered}</td>
                  <td onClick={() => openAthlete(r.id)}>{r.owed > 0 ? <span className="hz-pill hz-pill-amber">${r.owed}</span> : <span style={{ color: 'var(--hz-dim)', fontSize: 12 }}>Paid</span>}</td>
                  <td>
                    <button className="hz-btn hz-btn-ghost hz-btn-sm" onClick={(e) => { e.stopPropagation(); setEditingId(r.id); }} title="Quick edit" style={{ padding: '4px 8px', fontSize: 11 }}>Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }} className="roster-grid">
          {sorted.map(r => editingId === r.id ? (
            <div key={r.id} className="hz-card" style={{ padding: 16 }}>
              <InlineCardEditor athlete={r} disabled={busy}
                onSave={async (patch) => { const ok = await patchAthlete(r.id, patch); if (ok) setEditingId(null); }}
                onCancel={() => setEditingId(null)}
                onRemove={() => removeAthlete(r)}/>
            </div>
          ) : (
            <div key={r.id} className="hz-card roster-card" style={{ padding: 16, cursor: 'pointer' }} onClick={() => openAthlete(r.id)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <Avatar name={r.display_name} initials={r.initials} color={r.photo_color} src={r.photo_url} size={48}/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 16, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.display_name}</div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
                    {r.position && <span className="hz-pill" style={{ fontSize: 9, padding: '2px 8px', textTransform: 'capitalize' }}>{r.position}</span>}
                    {r.age != null && <span style={{ fontSize: 11, color: 'var(--hz-dim)', fontFamily: 'var(--hz-mono)' }}>age {r.age}</span>}
                  </div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                <RosterStat label="Ready" value={Math.round(r.readiness*100)} accent="var(--hz-teal)"/>
                <RosterStat label="Attend" value={Math.round(r.attendance*100)}/>
                <RosterStat label="Skills" value={r.mastered}/>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--hz-line)' }}>
                <button className="hz-btn hz-btn-ghost hz-btn-sm" style={{ flex: 1, fontSize: 12 }} onClick={(e) => { e.stopPropagation(); setEditingId(r.id); }}>Edit</button>
                <button className="hz-btn hz-btn-ghost hz-btn-sm" style={{ flex: 1, fontSize: 12 }} onClick={(e) => { e.stopPropagation(); openAthlete(r.id); }}>Open</button>
                {r.owed > 0 && <span className="hz-pill hz-pill-amber" style={{ alignSelf: 'center', fontSize: 10 }}>${r.owed}</span>}
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

function RosterStat({ label, value, accent }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
      <div style={{ fontSize: 9, color: 'var(--hz-dim)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.08em' }}>{label}</div>
      <div className="hz-display" style={{ fontSize: 18, color: accent || '#fff', marginTop: 2 }}>{value}</div>
    </div>
  );
}

function InlineCardEditor({ athlete, disabled, onSave, onCancel, onRemove }) {
  const [name, setName] = React.useState(athlete.display_name || '');
  const [age, setAge] = React.useState(athlete.age ?? '');
  const [position, setPosition] = React.useState(athlete.position || '');
  const save = () => onSave({
    display_name: name.trim() || athlete.display_name,
    initials: initialsFor(name),
    age: age === '' ? null : parseInt(age, 10),
    position: position || null,
  });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="hz-eyebrow" style={{ fontSize: 10 }}>Edit athlete</div>
      <input className="hz-input" value={name} onChange={e => setName(e.target.value)} disabled={disabled} placeholder="Athlete name"/>
      <div style={{ display: 'flex', gap: 8 }}>
        <input className="hz-input" type="number" value={age} onChange={e => setAge(e.target.value)} disabled={disabled} placeholder="Age" style={{ width: 90 }} min="3" max="30"/>
        <select className="hz-input" value={position} onChange={e => setPosition(e.target.value)} disabled={disabled} style={{ flex: 1 }}>
          <option value="">No position</option>
          {POSITION_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
        <button className="hz-btn hz-btn-primary hz-btn-sm" style={{ flex: 1 }} onClick={save} disabled={disabled}>Save</button>
        <button className="hz-btn hz-btn-ghost hz-btn-sm" onClick={onCancel} disabled={disabled}>Cancel</button>
        <button className="hz-btn hz-btn-danger hz-btn-sm" onClick={onRemove} disabled={disabled}>Remove</button>
      </div>
    </div>
  );
}

function AddAthleteCard({ onSave, onCancel, disabled }) {
  const [name, setName] = React.useState('');
  const [age, setAge] = React.useState('');
  const [position, setPosition] = React.useState('');
  const submit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({ display_name: name, age, position });
  };
  return (
    <form onSubmit={submit} className="hz-card" style={{ padding: 16, marginBottom: 14, display: 'grid', gridTemplateColumns: '2fr 100px 1fr auto auto', gap: 10, alignItems: 'center' }}>
      <input className="hz-input" placeholder="Athlete name (first + last)" value={name} onChange={e => setName(e.target.value)} autoFocus disabled={disabled} required style={{ padding: '8px 12px' }}/>
      <input className="hz-input" type="number" placeholder="Age" value={age} onChange={e => setAge(e.target.value)} disabled={disabled} style={{ padding: '8px 12px' }} min="3" max="30"/>
      <select className="hz-input" value={position} onChange={e => setPosition(e.target.value)} disabled={disabled} style={{ padding: '8px 12px' }}>
        <option value="">No position</option>
        {POSITION_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
      </select>
      <button type="submit" className="hz-btn hz-btn-primary hz-btn-sm" disabled={disabled || !name.trim()}>Save athlete</button>
      <button type="button" className="hz-btn hz-btn-ghost hz-btn-sm" onClick={onCancel} disabled={disabled}>Cancel</button>
    </form>
  );
}

function EditAthleteRow({ athlete, disabled, onSave, onCancel, onRemove }) {
  const [name, setName] = React.useState(athlete.display_name || '');
  const [age, setAge] = React.useState(athlete.age ?? '');
  const [position, setPosition] = React.useState(athlete.position || '');
  const save = (e) => {
    e?.preventDefault?.();
    onSave({
      display_name: name.trim() || athlete.display_name,
      initials: initialsFor(name),
      age: age === '' ? null : parseInt(age, 10),
      position: position || null,
    });
  };
  return (
    <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
      <td style={{ paddingLeft: 20 }} colSpan={2}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Avatar name={name} initials={initialsFor(name)} color={athlete.photo_color} src={athlete.photo_url} size={32}/>
          <input className="hz-input" value={name} onChange={e => setName(e.target.value)} disabled={disabled} style={{ padding: '6px 10px', flex: 1 }}/>
          <select className="hz-input" value={position} onChange={e => setPosition(e.target.value)} disabled={disabled} style={{ padding: '6px 10px', width: 130 }}>
            <option value="">No position</option>
            {POSITION_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </td>
      <td><input className="hz-input" type="number" value={age} onChange={e => setAge(e.target.value)} disabled={disabled} style={{ padding: '6px 10px', width: 70 }} min="3" max="30"/></td>
      <td colSpan={4} style={{ color: 'var(--hz-dim)', fontSize: 11 }}>edits save in place</td>
      <td>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="hz-btn hz-btn-primary hz-btn-sm" onClick={save} disabled={disabled} style={{ padding: '4px 8px', fontSize: 11 }}>Save</button>
          <button className="hz-btn hz-btn-ghost hz-btn-sm" onClick={onCancel} disabled={disabled} style={{ padding: '4px 8px', fontSize: 11 }}>Cancel</button>
          <button className="hz-btn hz-btn-danger hz-btn-sm" onClick={onRemove} disabled={disabled} style={{ padding: '4px 8px', fontSize: 11 }}>Remove</button>
        </div>
      </td>
    </tr>
  );
}

window.Roster = Roster;
