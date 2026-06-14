// ─────────────────────────────────────────────────────────────────────────────
// HIT ZERO WEB — Skill Matrix
// Full USASF grid: athletes (rows) × skills (columns). Click a cell to cycle
// status. Sticky first column, scrollable right. Filter by category + level.
// ─────────────────────────────────────────────────────────────────────────────

const SKILL_STATUS_ORDER = ['none','working','got_it','mastered'];
const SKILL_STATUS_LABELS = {
  all: 'All statuses',
  none: 'Not started',
  working: 'Working',
  got_it: 'Got it',
  mastered: 'Mastered',
};

function skillMatrixLiveMode() {
  return Boolean(window.HZsupa && window.HZdb?.auth?._mode?.() === 'live');
}

function skillMatrixUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
}

async function persistSkillStatus(payload) {
  if (skillMatrixLiveMode() && skillMatrixUuid(payload.athlete_id)) {
    const { data, error } = await window.HZsupa
      .from('athlete_skills')
      .upsert(payload, { onConflict: 'athlete_id,skill_id' })
      .select('*')
      .single();
    if (error) return { data: null, error };
    await window.HZdb.from('athlete_skills').upsert(data || payload, { onConflict: 'athlete_id,skill_id' });
    return { data: data || payload, error: null };
  }
  return await window.HZdb.from('athlete_skills').upsert(payload, { onConflict: 'athlete_id,skill_id' });
}

async function refreshSkillMatrix() {
  if (window.HZsel?._refresh) await window.HZsel._refresh();
  window.dispatchEvent(new CustomEvent('hz:refresh', { detail: { table: 'athlete_skills', action: 'update' } }));
}

function SkillMatrix({ snap, session, openAthlete, pushToast }) {
  const [catFilter, setCatFilter] = React.useState('all');
  const [levelMax, setLevelMax] = React.useState(5);
  const [query, setQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [savingKey, setSavingKey] = React.useState('');
  const [bulkStatus, setBulkStatus] = React.useState('working');
  const [bulkBusy, setBulkBusy] = React.useState(false);
  const [matrixError, setMatrixError] = React.useState('');
  const [lastSaved, setLastSaved] = React.useState('');

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
  const scope = window.HZviewerScope ? window.HZviewerScope(snap, session) : null;
  const visibleAthletes = scope?.visibleAthletes?.length ? scope.visibleAthletes : (window.HZsel.programAthletes?.() || snap.athletes || []);

  const athletes = visibleAthletes.filter(a => {
    const q = query.trim().toLowerCase();
    const matchesQuery = !q || String(a.display_name || '').toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'all' || skills.some(s => (statusByAS[a.id + ':' + s.id] || 'none') === statusFilter);
    return matchesQuery && matchesStatus;
  });

  const cycle = async (aid, sid) => {
    const cur = statusByAS[aid + ':' + sid] || 'none';
    const next = SKILL_STATUS_ORDER[(SKILL_STATUS_ORDER.indexOf(cur) + 1) % SKILL_STATUS_ORDER.length];
    const key = aid + ':' + sid;
    setSavingKey(key);
    setMatrixError('');
    try {
      const { error } = await persistSkillStatus({
        athlete_id: aid,
        skill_id: sid,
        status: next,
        updated_by: session?.actualProfile?.id || session?.profile?.id || null,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      await refreshSkillMatrix();
      setLastSaved(new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }));
    } catch (err) {
      const message = err?.message || 'Could not save skill status.';
      setMatrixError(message);
      (pushToast || window.HZToast)?.({ kind: 'error', eyebrow: 'Skill Matrix', title: 'Save failed', body: message });
    } finally {
      setSavingKey('');
    }
  };

  const bulkMarkVisible = async () => {
    if (!athletes.length || !skills.length || bulkBusy) return;
    const label = SKILL_STATUS_LABELS[bulkStatus] || bulkStatus;
    if (!confirm(`Mark ${athletes.length} athlete rows across ${skills.length} visible skills as "${label}"?`)) return;
    const updatedBy = session?.actualProfile?.id || session?.profile?.id || null;
    const updatedAt = new Date().toISOString();
    const rows = athletes.flatMap(a => skills.map(s => ({
      athlete_id: a.id,
      skill_id: s.id,
      status: bulkStatus,
      updated_by: updatedBy,
      updated_at: updatedAt,
    })));
    setBulkBusy(true);
    setMatrixError('');
    try {
      if (skillMatrixLiveMode() && rows.every(row => skillMatrixUuid(row.athlete_id))) {
        const { data, error } = await window.HZsupa
          .from('athlete_skills')
          .upsert(rows, { onConflict: 'athlete_id,skill_id' })
          .select('*');
        if (error) throw error;
        await window.HZdb.from('athlete_skills').upsert(data?.length ? data : rows, { onConflict: 'athlete_id,skill_id' });
        await refreshSkillMatrix(); // emits hz:refresh after HZsel?._refresh
      } else {
        const { error } = await window.HZdb.from('athlete_skills').upsert(rows, { onConflict: 'athlete_id,skill_id' });
        if (error) throw error;
        await refreshSkillMatrix(); // emits hz:refresh after HZsel?._refresh
      }
      setLastSaved(new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }));
      (pushToast || window.HZToast)?.({ kind: 'success', eyebrow: 'Skill Matrix', title: 'Bulk update saved', body: `${rows.length} cells marked ${label}.` });
    } catch (err) {
      const message = err?.message || 'Could not bulk update skill statuses.';
      setMatrixError(message);
      (pushToast || window.HZToast)?.({ kind: 'error', eyebrow: 'Skill Matrix', title: 'Bulk update failed', body: message });
    } finally {
      setBulkBusy(false);
    }
  };

  // Category summary for header
  const catSummary = {};
  cats.forEach(c => {
    const cSkills = snap.skills.filter(s => s.category === c && s.level <= levelMax);
    let sum = 0, n = 0;
    visibleAthletes.forEach(a => cSkills.forEach(s => { sum += window.HZsel.STATUS_PCT[statusByAS[a.id+':'+s.id] || 'none']; n++; }));
    catSummary[c] = n ? sum/n : 0;
  });

  const statusSummary = SKILL_STATUS_ORDER.reduce((out, status) => ({ ...out, [status]: 0 }), {});
  visibleAthletes.forEach(a => {
    skills.forEach(s => {
      const st = statusByAS[a.id + ':' + s.id] || 'none';
      statusSummary[st] = (statusSummary[st] || 0) + 1;
    });
  });

  return (
    <div>
      <SectionHeading eyebrow="Every athlete, every skill" title="Skill Matrix." trailing={
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <input className="hz-input" style={{ width: 190, padding: '8px 12px' }} placeholder="Search athletes..." value={query} onChange={e => setQuery(e.target.value)}/>
          <select className="hz-input" style={{ width: 150, padding: '8px 12px' }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            {['all', ...SKILL_STATUS_ORDER].map(st => <option key={st} value={st}>{SKILL_STATUS_LABELS[st]}</option>)}
          </select>
          <div style={{ fontSize: 11, color: 'var(--hz-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>Level ≤</div>
          <select className="hz-input" style={{ width: 70, padding: '8px 12px' }} value={levelMax} onChange={e => setLevelMax(+e.target.value)}>
            {[3,4,5,6,7].map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          <select className="hz-input" style={{ width: 180, padding: '8px 12px' }} value={catFilter} onChange={e => setCatFilter(e.target.value)}>
            <option value="all">All categories</option>
            {cats.map(c => <option key={c} value={c}>{catLabel[c]}</option>)}
          </select>
          <select className="hz-input" style={{ width: 140, padding: '8px 12px' }} value={bulkStatus} onChange={e => setBulkStatus(e.target.value)}>
            {SKILL_STATUS_ORDER.map(st => <option key={st} value={st}>{SKILL_STATUS_LABELS[st]}</option>)}
          </select>
          <button className="hz-btn hz-btn-primary hz-btn-sm" onClick={bulkMarkVisible} disabled={bulkBusy || !athletes.length || !skills.length}>
            {bulkBusy ? 'Saving...' : 'Bulk mark'}
          </button>
        </div>
      }/>

      {matrixError && (
        <div className="hz-card" style={{ marginBottom: 14, padding: 12, color: 'var(--hz-pink)', borderColor: 'rgba(249,127,172,0.35)' }}>
          {matrixError}
        </div>
      )}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14, color: 'var(--hz-dim)', fontSize: 12 }}>
        <Pill>{athletes.length} athletes</Pill>
        <Pill>{skills.length} skills</Pill>
        {SKILL_STATUS_ORDER.map(st => <Pill key={st}>{SKILL_STATUS_LABELS[st]}: {statusSummary[st] || 0}</Pill>)}
        <span style={{ marginLeft: 'auto' }}>{lastSaved ? `Last saved ${lastSaved}` : skillMatrixLiveMode() ? 'Live persistence on' : 'Prototype mode'}</span>
      </div>

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
              {athletes.map(a => (
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
                    const key = a.id + ':' + s.id;
                    return (
                      <td key={s.id} style={{ padding: 3, borderBottom: '1px solid var(--hz-line)' }}>
                        <div
                          className={`skill-cell status-${st}`}
                          onClick={() => savingKey ? null : cycle(a.id, s.id)}
                          title={`${a.display_name} · ${s.name} · ${SKILL_STATUS_LABELS[st]}`}
                          style={{ opacity: savingKey === key ? 0.55 : 1, cursor: savingKey ? 'wait' : 'pointer' }}
                        >
                          {savingKey === key ? '…' : st === 'none' ? '' : st === 'working' ? '·' : st === 'got_it' ? '✓' : '★'}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {athletes.length === 0 && (
            <div style={{ padding: 30, color: 'var(--hz-dim)', textAlign: 'center' }}>
              No athletes match the current Skill Matrix filters.
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 20, marginTop: 14, fontSize: 11, color: 'var(--hz-dim)' }}>
        <Legend color="rgba(255,255,255,0.04)" label="Not Started"/>
        <Legend color="rgba(255,180,84,0.18)" label="Working"/>
        <Legend color="rgba(39,207,215,0.22)" label="Got It"/>
        <Legend color="linear-gradient(135deg, rgba(39,207,215,0.35), rgba(249,127,172,0.35))" label="Mastered"/>
        <span style={{ marginLeft: 'auto', fontStyle: 'italic' }}>Click any cell to cycle. Saved rows refresh across signed-in devices.</span>
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
