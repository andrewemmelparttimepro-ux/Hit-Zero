// ─────────────────────────────────────────────────────────────────────────────
// HIT ZERO WEB — Roster
// Sortable table + grid toggle. Click a row to open AthleteDrawer.
// ─────────────────────────────────────────────────────────────────────────────

const POSITION_OPTIONS = ['flyer', 'base', 'backspot', 'tumbler', 'all-around'];

function initialsFor(name) {
  if (!name) return '';
  return name.trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();
}

function rosterLiveMode() {
  return Boolean(window.HZsupa && window.HZdb?.auth?._mode?.() === 'live');
}

function rosterIsUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
}

async function refreshRosterData(action) {
  if (window.HZsel?._refresh) await window.HZsel._refresh();
  window.dispatchEvent(new CustomEvent('hz:refresh', { detail: { table: 'athletes', action } }));
}

async function insertRosterAthlete(payload) {
  if (rosterLiveMode()) {
    const { data, error } = await window.HZsupa
      .from('athletes')
      .insert(payload)
      .select('*')
      .single();
    if (error) return { data: null, error };
    await window.HZdb.from('athletes').upsert(data, { onConflict: 'id' });
    // refreshRosterData awaits HZsel?._refresh and emits hz:refresh.
    await refreshRosterData('insert');
    return { data, error: null };
  }
  const out = await window.HZdb.from('athletes').insert(payload);
  // refreshRosterData awaits HZsel?._refresh and emits hz:refresh.
  if (!out.error) await refreshRosterData('insert');
  return out;
}

async function updateRosterAthlete(id, patch) {
  if (rosterLiveMode() && rosterIsUuid(id)) {
    const { data, error } = await window.HZsupa
      .from('athletes')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();
    if (error) return { data: null, error };
    await window.HZdb.from('athletes').upsert(data, { onConflict: 'id' });
    // refreshRosterData awaits HZsel?._refresh and emits hz:refresh.
    await refreshRosterData('update');
    return { data, error: null };
  }
  const out = await window.HZdb.from('athletes').update(patch).eq('id', id);
  // refreshRosterData awaits HZsel?._refresh and emits hz:refresh.
  if (!out.error) await refreshRosterData('update');
  return out;
}

async function refreshTeamBuilderData(table, action) {
  if (window.HZsel?._refresh) await window.HZsel._refresh();
  window.dispatchEvent(new CustomEvent('hz:refresh', { detail: { table, action } }));
}

async function insertBuilderTeam(payload) {
  if (rosterLiveMode()) {
    const { data, error } = await window.HZsupa.from('teams').insert(payload).select('*').single();
    if (error) return { data: null, error };
    await window.HZdb.from('teams').upsert(data, { onConflict: 'id' });
    await refreshTeamBuilderData('teams', 'insert'); // awaits HZsel?._refresh and emits hz:refresh
    return { data, error: null };
  }
  const out = await window.HZdb.from('teams').insert({ id: 'team_' + Date.now(), ...payload });
  if (!out.error) await refreshTeamBuilderData('teams', 'insert'); // awaits HZsel?._refresh and emits hz:refresh
  return out;
}

async function updateBuilderTeam(id, patch) {
  if (rosterLiveMode() && rosterIsUuid(id)) {
    const { data, error } = await window.HZsupa.from('teams').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id).select('*').single();
    if (error) return { data: null, error };
    await window.HZdb.from('teams').upsert(data, { onConflict: 'id' });
    await refreshTeamBuilderData('teams', 'update'); // awaits HZsel?._refresh and emits hz:refresh
    return { data, error: null };
  }
  const out = await window.HZdb.from('teams').update(patch).eq('id', id);
  if (!out.error) await refreshTeamBuilderData('teams', 'update'); // awaits HZsel?._refresh and emits hz:refresh
  return out;
}

function Roster({ snap, openAthlete, navigate, pushToast }) {
  const isMobile = (typeof window !== 'undefined' && window.useIsMobile) ? window.useIsMobile() : false;
  const session = window.HZdb?.auth?._getSession?.() || null;
  const role = session?.profile?.role || session?.actualProfile?.role || '';
  const canManageTeams = role === 'owner' || role === 'coach';
  const hasBuilderTeams = (snap.teams || []).some(t => t.builder_enabled && !t.deleted_at);
  const [workspace, setWorkspace] = React.useState(canManageTeams && hasBuilderTeams ? 'teams' : 'roster');
  const [sort, setSort] = React.useState({ col: 'readiness', dir: 'desc' });
  const [filter, setFilter] = React.useState('all');
  const [view, setView] = React.useState(isMobile ? 'grid' : 'table');
  const [showAdd, setShowAdd] = React.useState(false);
  const [editingId, setEditingId] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const scope = window.HZviewerScope ? window.HZviewerScope(snap, session) : null;
  const visibleAthletes = scope?.visibleAthletes?.length ? scope.visibleAthletes : (window.HZsel.programAthletes?.() || snap.athletes || []);
  const visibleAthleteIds = new Set(visibleAthletes.map(a => a.id));
  const team = scope?.visibleTeams?.[0] || window.HZsel.programTeams?.()[0] || (snap.teams || [])[0] || null;
  const teamLabel = team
    ? `${team.division || team.name || 'Team'}${team.level ? ` · L${team.level}` : ''}`
    : 'Team';
  const classEnrollments = (window.HZsel.classEnrollmentsForProgram?.() || []).filter(row => !row.athlete_id || visibleAthleteIds.has(row.athlete_id));
  const classEnrollmentByAthlete = classEnrollments.reduce((out, row) => {
    if (!row.athlete_id) return out;
    out[row.athlete_id] = out[row.athlete_id] || [];
    out[row.athlete_id].push(row);
    return out;
  }, {});
  const openGymParticipants = window.HZsel.openGymRegistrationsForProgram?.() || [];
  const paidClassCount = classEnrollments.filter(row => row.payment_status === 'paid').length;

  const rows = visibleAthletes.map(a => {
    const r = window.HZsel.athleteReadiness(a.id);
    const att = window.HZsel.athleteAttendance(a.id);
    const sum = window.HZsel.athleteSkillsSummary(a.id);
    const bill = window.HZsel.athleteBilling(a.id);
    const enrollments = classEnrollmentByAthlete[a.id] || [];
    return {
      ...a,
      readiness: r,
      attendance: att.pct,
      attendanceEmpty: att.empty,
      mastered: sum.mastered,
      working: sum.working,
      owed: bill?.account.owed || 0,
      enrollments,
      paidClasses: enrollments.filter(row => row.payment_status === 'paid').length,
    };
  });

  const filtered = rows.filter(r => filter === 'all' ? true : (r.position || '').toLowerCase() === filter);
  const sorted = [...filtered].sort((a, b) => {
    const av = a[sort.col]; const bv = b[sort.col];
    const v = (av ?? '') > (bv ?? '') ? 1 : (av ?? '') < (bv ?? '') ? -1 : 0;
    return sort.dir === 'asc' ? v : -v;
  });

  const toggle = (col) => setSort(s => ({ col, dir: s.col === col && s.dir === 'desc' ? 'asc' : 'desc' }));
  const notifyError = (title, body) => {
    (pushToast || window.HZToast)?.({ kind: 'error', eyebrow: 'Roster', title, body });
  };

  async function addAthlete(values) {
    if (!team?.id) {
      notifyError('No team loaded', 'Create a team before adding athletes.');
      return;
    }
    setBusy(true);
    try {
      const payload = {
        team_id: team.id,
        display_name: values.display_name.trim(),
        initials: initialsFor(values.display_name),
        age: values.age ? parseInt(values.age, 10) : null,
        position: values.position || null,
      };
      const { error } = await insertRosterAthlete(payload);
      if (error) {
        console.error('[athletes] insert', error);
        notifyError('Could not add athlete', error.message);
        return;
      }
      setShowAdd(false);
    } finally { setBusy(false); }
  }

  async function patchAthlete(id, patch) {
    setBusy(true);
    try {
      const { error } = await updateRosterAthlete(id, patch);
      if (error) {
        console.error('[athletes] update', error);
        notifyError('Could not save athlete', error.message);
        return false;
      }
      return true;
    } finally { setBusy(false); }
  }

  async function removeAthlete(athlete) {
    if (!confirm(`Remove ${athlete.display_name} from the roster?`)) return;
    setBusy(true);
    try {
      const { error } = await updateRosterAthlete(athlete.id, { deleted_at: new Date().toISOString() });
      if (error) {
        console.error('[athletes] soft-delete', error);
        notifyError('Could not remove athlete', error.message);
      }
    } finally { setBusy(false); }
  }

  if (workspace === 'teams' && canManageTeams) {
    return <TeamBuilder
      snap={snap}
      rows={rows}
      pushToast={pushToast}
      openAthlete={openAthlete}
      onOpenRoster={() => setWorkspace('roster')}
    />;
  }

  return (
    <div>
      <SectionHeading eyebrow={`${visibleAthletes.length} athletes · ${teamLabel}`} title="The roster." trailing={
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {canManageTeams && <button onClick={() => setWorkspace('teams')} className="hz-btn hz-btn-primary hz-btn-sm">Team builder</button>}
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginBottom: 14 }}>
        <RosterStat label="Roster" value={visibleAthletes.length} accent="var(--hz-teal)"/>
        <RosterStat label="Paid classes" value={paidClassCount}/>
        <RosterStat label="Class rows" value={classEnrollments.length}/>
        <RosterStat label="Open gym" value={openGymParticipants.length} accent="var(--hz-amber)"/>
      </div>

      {openGymParticipants.length > 0 && (
        <div className="hz-card" style={{ marginBottom: 14, padding: 16, borderColor: 'rgba(255,180,84,0.28)' }}>
          <div className="hz-eyebrow" style={{ color: 'var(--hz-amber)', marginBottom: 10 }}>Open gym participants</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {openGymParticipants.slice(0, 8).map(row => (
              <div key={row.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13 }}>
                <strong>{row.athlete_name || 'Participant'}</strong>
                <span style={{ color: 'var(--hz-dim)' }}>{row.parent_name || row.parent_email || 'Contact captured'} · {row.status || 'registered'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

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
                  <td style={{ fontFamily: 'var(--hz-mono)', color: !r.attendanceEmpty && r.attendance < 0.7 ? 'var(--hz-amber)' : '#fff' }} onClick={() => openAthlete(r.id)}>
                    {r.attendanceEmpty ? 'No logs' : `${Math.round((r.attendance || 0)*100)}%`}
                  </td>
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
                <RosterStat label="Attend" value={r.attendanceEmpty ? 'No logs' : Math.round((r.attendance || 0)*100)}/>
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

function teamDisplayName(team) {
  if (!team) return 'Unassigned';
  return team.division ? `${team.division} — ${team.name}` : (team.name || 'Team');
}

function TeamBuilder({ snap, rows, pushToast, openAthlete, onOpenRoster }) {
  const session = window.HZdb?.auth?._getSession?.() || null;
  const programId = window.HZsel?.programProfile?.()?.id || session?.actualProfile?.program_id || session?.profile?.program_id || (snap.programs || [])[0]?.id || null;
  const allTeams = (snap.teams || []).filter(t => !t.deleted_at && (!programId || t.program_id === programId));
  const builderTeams = allTeams.filter(t => t.builder_enabled);
  const seasons = [...new Set(builderTeams.map(t => t.season).filter(Boolean))].sort().reverse();
  const [season, setSeason] = React.useState(seasons[0] || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`);
  const [sourceClassFilter, setSourceClassFilter] = React.useState('all');
  const [query, setQuery] = React.useState('');
  const [draggingId, setDraggingId] = React.useState('');
  const [savingId, setSavingId] = React.useState('');
  const [savedId, setSavedId] = React.useState('');
  const [localTeams, setLocalTeams] = React.useState({});
  const [showTeamForm, setShowTeamForm] = React.useState(false);
  const [editingTeam, setEditingTeam] = React.useState(null);
  const activeTeams = builderTeams.filter(t => t.season === season).sort((a, b) => (a.display_order ?? 100) - (b.display_order ?? 100));
  const poolTeam = allTeams.find(t => !t.builder_enabled) || null;
  const activeIds = new Set(activeTeams.map(t => t.id));
  const normalizedQuery = query.trim().toLowerCase();
  const eligibleIds = new Set((snap.class_enrollments || []).filter(e => sourceClassFilter === 'all' || e.class_id === sourceClassFilter).map(e => e.athlete_id).filter(Boolean));
  const visibleRows = rows.filter(a => (sourceClassFilter === 'all' || eligibleIds.has(a.id)) && (!normalizedQuery || `${a.display_name} ${a.position || ''} ${a.age || ''}`.toLowerCase().includes(normalizedQuery)));
  const teamIdFor = (athlete) => Object.prototype.hasOwnProperty.call(localTeams, athlete.id) ? localTeams[athlete.id] : athlete.team_id;
  const withEffectiveTeam = (athlete) => ({ ...athlete, team_id: teamIdFor(athlete) });
  const unassigned = visibleRows.filter(a => !activeIds.has(teamIdFor(a))).map(withEffectiveTeam);
  const teamRows = (teamId) => visibleRows.filter(a => teamIdFor(a) === teamId).map(withEffectiveTeam);
  const teamById = Object.fromEntries(allTeams.map(t => [t.id, t]));
  const classById = Object.fromEntries((snap.program_classes || []).map(c => [c.id, c]));
  const events = (snap.team_assignment_events || [])
    .filter(e => !programId || e.program_id === programId)
    .slice()
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 12);

  React.useEffect(() => {
    if (!seasons.length || seasons.includes(season)) return;
    setSeason(seasons[0]);
  }, [seasons.join('|'), season]);

  function toast(kind, title, body) {
    (pushToast || window.HZToast)?.({ kind, eyebrow: 'Team builder', title, body });
  }

  async function moveAthlete(athleteId, toTeamId, options = {}) {
    const athlete = rows.find(a => a.id === athleteId);
    const destination = allTeams.find(t => t.id === toTeamId);
    const previousId = teamIdFor(athlete || {});
    if (!athlete || !destination || previousId === toTeamId || savingId) return;
    if (destination.capacity && teamRows(destination.id).length >= destination.capacity) {
      toast('error', 'Team is full', `${teamDisplayName(destination)} has reached its ${destination.capacity}-athlete capacity.`);
      return;
    }
    setSavingId(athleteId);
    setSavedId('');
    setLocalTeams(prev => ({ ...prev, [athleteId]: toTeamId }));
    try {
      const { error } = await updateRosterAthlete(athleteId, { team_id: toTeamId });
      if (error) throw error;
      setSavedId(athleteId);
      window.setTimeout(() => setSavedId(v => v === athleteId ? '' : v), 2200);
      if (options.undo) toast('success', 'Move undone', `${athlete.display_name} is back on ${teamDisplayName(destination)}.`);
    } catch (error) {
      setLocalTeams(prev => ({ ...prev, [athleteId]: previousId }));
      toast('error', 'Placement did not save', error?.message || 'Nothing changed. Try again.');
    } finally {
      setSavingId('');
    }
  }

  async function saveTeam(values) {
    const payload = {
      program_id: programId,
      name: values.name.trim(),
      division: values.division.trim() || null,
      level: Number(values.level || 1),
      season: values.season.trim(),
      season_start: values.season_start || null,
      source_class_id: values.source_class_id || null,
      builder_enabled: true,
      capacity: values.capacity ? Number(values.capacity) : null,
      color: values.color || '#27cfd7',
      display_order: Number(values.display_order || 100),
    };
    const result = editingTeam ? await updateBuilderTeam(editingTeam.id, payload) : await insertBuilderTeam(payload);
    if (result.error) {
      toast('error', 'Team did not save', result.error.message);
      return false;
    }
    setSeason(payload.season);
    setShowTeamForm(false);
    setEditingTeam(null);
    toast('success', editingTeam ? 'Team updated' : 'Team created', `${teamDisplayName(payload)} is ready for placements.`);
    return true;
  }

  async function archiveTeam(team) {
    const count = rows.filter(a => a.team_id === team.id && !a.deleted_at).length;
    if (count) {
      toast('error', 'Move athletes first', `${teamDisplayName(team)} still has ${count} athlete${count === 1 ? '' : 's'}.`);
      return;
    }
    if (!confirm(`Archive ${teamDisplayName(team)}? Its assignment history will be kept.`)) return;
    const { error } = await updateBuilderTeam(team.id, { deleted_at: new Date().toISOString(), builder_enabled: false });
    if (error) toast('error', 'Team did not archive', error.message);
    else toast('success', 'Team archived', 'Past assignment history remains available.');
  }

  function dropOn(teamId, event) {
    event.preventDefault();
    const athleteId = event.dataTransfer?.getData('text/plain') || draggingId;
    setDraggingId('');
    if (athleteId) moveAthlete(athleteId, teamId);
  }

  return (
    <div className="team-builder">
      <div className="team-builder-hero">
        <div>
          <div className="hz-eyebrow" style={{ color: 'var(--hz-teal)' }}>Season placement workspace</div>
          <h1 className="hz-display">Build the teams.</h1>
          <p>Drag athletes on desktop or use Move on mobile. Every placement saves immediately and leaves an audit trail.</p>
        </div>
        <div className="team-builder-actions">
          <span className="team-save-state"><span className="team-save-dot"/> Live · autosaved</span>
          <button className="hz-btn hz-btn-ghost hz-btn-sm" onClick={onOpenRoster}>Roster directory</button>
          <button className="hz-btn hz-btn-primary hz-btn-sm" onClick={() => { setEditingTeam(null); setShowTeamForm(true); }}>+ New team</button>
        </div>
      </div>

      <div className="team-builder-toolbar">
        <label><span>Season</span><select className="hz-input" value={season} onChange={e => setSeason(e.target.value)}>{seasons.map(s => <option key={s}>{s}</option>)}{!seasons.includes(season) && <option>{season}</option>}</select></label>
        <label><span>Eligibility source</span><select className="hz-input" value={sourceClassFilter} onChange={e => setSourceClassFilter(e.target.value)}><option value="all">All roster athletes</option>{[...new Set(activeTeams.map(t => t.source_class_id).filter(Boolean))].map(id => <option key={id} value={id}>{classById[id]?.name || 'Linked class'}</option>)}</select></label>
        <label className="team-search"><span>Find an athlete</span><input className="hz-input" type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Name, position, or age"/></label>
        <div className="team-builder-summary"><strong>{visibleRows.length}</strong><span>eligible athletes</span><strong>{visibleRows.length - unassigned.length}</strong><span>placed this season</span></div>
      </div>

      {showTeamForm && <TeamEditor
        team={editingTeam}
        season={season}
        classes={(snap.program_classes || []).filter(c => !programId || c.program_id === programId)}
        nextOrder={(activeTeams.length + 1) * 10}
        onSave={saveTeam}
        onCancel={() => { setShowTeamForm(false); setEditingTeam(null); }}
      />}

      <div className="team-board" aria-label={`${season} team placement board`}>
        <TeamLane
          title="Placement pool"
          subtitle={`${unassigned.length} not placed this season`}
          emptyLabel={visibleRows.length ? 'Everyone is placed' : 'No eligible athletes match this filter'}
          color="#8a93a6"
          rows={unassigned}
          teams={activeTeams}
          poolTeam={poolTeam}
          currentTeamById={teamById}
          savingId={savingId}
          savedId={savedId}
          onMove={moveAthlete}
          onOpen={openAthlete}
          onDragStart={setDraggingId}
          canDrop={Boolean(poolTeam)}
          onDrop={poolTeam ? (e => dropOn(poolTeam.id, e)) : undefined}
        />
        {activeTeams.map(team => (
          <TeamLane
            key={team.id}
            team={team}
            title={team.name}
            subtitle={`${team.division || 'All Star'} · ${teamRows(team.id).length}${team.capacity ? `/${team.capacity}` : ''}`}
            color={team.color || '#27cfd7'}
            rows={teamRows(team.id)}
            teams={activeTeams}
            poolTeam={poolTeam}
            currentTeamById={teamById}
            savingId={savingId}
            savedId={savedId}
            onMove={moveAthlete}
            onOpen={openAthlete}
            onDragStart={setDraggingId}
            onDrop={(e) => dropOn(team.id, e)}
            onEdit={() => { setEditingTeam(team); setShowTeamForm(true); }}
            onArchive={() => archiveTeam(team)}
            sourceClass={classById[team.source_class_id]}
          />
        ))}
      </div>

      <section className="team-history hz-card">
        <div className="team-history-heading"><div><div className="hz-eyebrow">Placement history</div><h2>Nothing gets lost.</h2></div><span>{events.length ? 'Latest changes' : 'No placements yet'}</span></div>
        {events.map(event => {
          const athlete = rows.find(a => a.id === event.athlete_id);
          const from = teamById[event.from_team_id];
          const to = teamById[event.to_team_id];
          const canUndo = athlete?.team_id === event.to_team_id;
          return <div className="team-history-row" key={event.id}>
            <div><strong>{athlete?.display_name || 'Athlete'}</strong><span>{teamDisplayName(from)} → {teamDisplayName(to)}</span></div>
            <time>{new Date(event.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</time>
            <button className="hz-btn hz-btn-ghost hz-btn-sm" disabled={!canUndo || savingId === event.athlete_id} onClick={() => moveAthlete(event.athlete_id, event.from_team_id, { undo: true })}>Undo</button>
          </div>;
        })}
      </section>
    </div>
  );
}

function TeamLane({ team, title, subtitle, emptyLabel, color, rows, teams, poolTeam, currentTeamById, savingId, savedId, onMove, onOpen, onDragStart, canDrop, onDrop, onEdit, onArchive, sourceClass }) {
  return (
    <section className={'team-lane' + (team ? ' team-lane-destination' : ' team-lane-pool')}
      style={{ '--team-color': color }} onDragOver={(team || canDrop) ? (e => e.preventDefault()) : undefined} onDrop={(team || canDrop) ? onDrop : undefined}>
      <header>
        <div className="team-lane-mark"/>
        <div><h2>{title}</h2><p>{subtitle}</p>{sourceClass && <span className="team-source">Eligibility · {sourceClass.name}</span>}</div>
        {team && <details className="team-menu"><summary aria-label={`Manage ${title}`}>•••</summary><div><button onClick={onEdit}>Edit team</button><button onClick={onArchive}>Archive</button></div></details>}
      </header>
      <div className="team-lane-list">
        {rows.map(athlete => <TeamAthleteCard key={athlete.id} athlete={athlete} teams={teams} poolTeam={poolTeam} currentTeam={currentTeamById[athlete.team_id]} saving={savingId === athlete.id} saved={savedId === athlete.id} onMove={onMove} onOpen={onOpen} onDragStart={onDragStart}/>) }
        {!rows.length && <div className="team-lane-empty">{team ? 'Drop an athlete here' : (emptyLabel || 'Everyone is placed')}</div>}
      </div>
    </section>
  );
}

function TeamAthleteCard({ athlete, teams, poolTeam, currentTeam, saving, saved, onMove, onOpen, onDragStart }) {
  return (
    <article className={'team-athlete' + (saving ? ' is-saving' : '')} draggable={!saving}
      onDragStart={e => { e.dataTransfer.setData('text/plain', athlete.id); e.dataTransfer.effectAllowed = 'move'; onDragStart?.(athlete.id); }}>
      <button className="team-athlete-open" onClick={() => onOpen(athlete.id)} aria-label={`Open ${athlete.display_name}`}>
        <Avatar name={athlete.display_name} initials={athlete.initials} color={athlete.photo_color} src={athlete.photo_url} size={36}/>
        <span><strong>{athlete.display_name}</strong><small>{athlete.position || 'Position not set'}{athlete.age ? ` · age ${athlete.age}` : ''}{currentTeam && !currentTeam.builder_enabled ? ` · ${currentTeam.name}` : ''}</small></span>
      </button>
      <label className="team-move-control"><span>{saving ? 'Saving…' : saved ? 'Saved ✓' : 'Move'}</span><select disabled={saving} value={teams.some(t => t.id === athlete.team_id) ? athlete.team_id : ''} onChange={e => e.target.value && onMove(athlete.id, e.target.value)} aria-label={`Move ${athlete.display_name} to team`}><option value="">Choose team</option>{poolTeam && <option value={poolTeam.id}>Placement pool</option>}{teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
    </article>
  );
}

function TeamEditor({ team, season, classes, nextOrder, onSave, onCancel }) {
  const [form, setForm] = React.useState({
    name: team?.name || '', division: team?.division || '', level: team?.level || 1,
    season: team?.season || season, season_start: team?.season_start || '', source_class_id: team?.source_class_id || '',
    capacity: team?.capacity || '', color: team?.color || '#27cfd7', display_order: team?.display_order || nextOrder,
  });
  const [busy, setBusy] = React.useState(false);
  const submit = async e => { e.preventDefault(); if (!form.name.trim() || !form.season.trim()) return; setBusy(true); const ok = await onSave(form); if (!ok) setBusy(false); };
  return <form className="team-editor hz-card" onSubmit={submit}>
    <div className="team-editor-heading"><div><div className="hz-eyebrow">{team ? 'Team settings' : 'New placement team'}</div><h2>{team ? teamDisplayName(team) : 'Create a reusable team'}</h2></div><button type="button" className="hz-btn hz-btn-ghost hz-btn-sm" onClick={onCancel}>Close</button></div>
    <label><span>Team name</span><input className="hz-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Pink Diamonds" required/></label>
    <label><span>Division / class label</span><input className="hz-input" value={form.division} onChange={e => setForm(f => ({ ...f, division: e.target.value }))} placeholder="Youth Elite Level 1"/></label>
    <label><span>Eligibility source</span><select className="hz-input" value={form.source_class_id} onChange={e => setForm(f => ({ ...f, source_class_id: e.target.value }))}><option value="">Any roster athlete</option>{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    <label><span>Season</span><input className="hz-input" value={form.season} onChange={e => setForm(f => ({ ...f, season: e.target.value }))} placeholder="2026-2027" required/></label>
    <label><span>Season starts</span><input className="hz-input" type="date" value={form.season_start} onChange={e => setForm(f => ({ ...f, season_start: e.target.value }))}/></label>
    <label><span>Level</span><input className="hz-input" type="number" min="1" max="7" value={form.level} onChange={e => setForm(f => ({ ...f, level: e.target.value }))}/></label>
    <label><span>Capacity (optional)</span><input className="hz-input" type="number" min="1" value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))} placeholder="No limit"/></label>
    <label><span>Team color</span><input className="hz-input team-color-input" type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))}/></label>
    <div className="team-editor-actions"><button className="hz-btn hz-btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save team'}</button><span>Changes are available to every authorized owner immediately.</span></div>
  </form>;
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
