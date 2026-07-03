// ─────────────────────────────────────────────────────────────────────────────
// HIT ZERO WEB — Athlete Drawer (tabbed, full-surface)
// Slides in from the right anywhere you click an athlete. This is the "wow"
// moment — one tap, everything about this athlete: skills, medical, uniform,
// billing, timeline. All live via realtime.
// ─────────────────────────────────────────────────────────────────────────────

const { useState: _adUS, useMemo: _adUM } = React;

function adMoneyFromCents(cents) {
  return '$' + ((Number(cents || 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }));
}

const ATHLETE_TABS = [
  { id: 'overview', label: 'Overview', icon: 'today' },
  { id: 'skills',   label: 'Skills',   icon: 'skills' },
  { id: 'medical',  label: 'Medical',  icon: 'bolt' },
  { id: 'uniform',  label: 'Uniform',  icon: 'roster' },
  { id: 'billing',  label: 'Billing',  icon: 'billing' },
  { id: 'timeline', label: 'Timeline', icon: 'megaphone' },
];

function tabsForAthleteViewer(session) {
  const role = session?.profile?.role || session?.actualProfile?.role || '';
  if (role === 'athlete') return ATHLETE_TABS.filter(t => !['medical', 'uniform', 'billing'].includes(t.id));
  return ATHLETE_TABS;
}

function athleteDrawerSkillsLiveMode() {
  return Boolean(window.HZsupa && window.HZdb?.auth?._mode?.() === 'live');
}

function athleteDrawerSkillAthleteIsUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
}

async function persistAthleteDrawerSkill(payload) {
  if (athleteDrawerSkillsLiveMode() && athleteDrawerSkillAthleteIsUuid(payload.athlete_id)) {
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

async function refreshAthleteDrawerSkills() {
  if (window.HZsel?._refresh) await window.HZsel._refresh();
  window.dispatchEvent(new CustomEvent('hz:refresh', { detail: { table: 'athlete_skills', action: 'update' } }));
}

function athleteDrawerMedicalCanEdit(session) {
  const role = session?.profile?.role || session?.actualProfile?.role || '';
  return role === 'owner' || role === 'coach';
}

async function persistAthleteDrawerMedicalRecord(payload) {
  if (athleteDrawerSkillsLiveMode() && athleteDrawerSkillAthleteIsUuid(payload.athlete_id)) {
    const { data, error } = await window.HZsupa
      .from('medical_records')
      .upsert(payload, { onConflict: 'athlete_id' })
      .select('*')
      .single();
    if (error) return { data: null, error };
    await window.HZdb.from('medical_records').upsert(data || payload, { onConflict: 'athlete_id' });
    await refreshAthleteDrawerMedical();
    return { data: data || payload, error: null };
  }
  const result = await window.HZdb.from('medical_records').upsert(payload, { onConflict: 'athlete_id' });
  if (!result.error) await refreshAthleteDrawerMedical();
  return result;
}

async function insertAthleteDrawerEmergencyContact(payload) {
  if (athleteDrawerSkillsLiveMode() && athleteDrawerSkillAthleteIsUuid(payload.athlete_id)) {
    const { data, error } = await window.HZsupa
      .from('emergency_contacts')
      .insert(payload)
      .select('*')
      .single();
    if (error) return { data: null, error };
    await window.HZdb.from('emergency_contacts').upsert(data || payload, { onConflict: 'id' });
    return { data: data || payload, error: null };
  }
  return await window.HZdb.from('emergency_contacts').insert(payload);
}

async function refreshAthleteDrawerMedical() {
  if (window.HZsel?._refresh) await window.HZsel._refresh();
  ['medical_records', 'emergency_contacts'].forEach((table) => {
    window.dispatchEvent(new CustomEvent('hz:refresh', { detail: { table, action: 'update' } }));
  });
}

// Shared athlete view: identity, quick stats, tab strip, tab content.
// Used by the overlay drawer (staff/desktop) and the full-screen
// #athlete/<id> route (parents on phones).
function AthleteCoreView({ a, snap, session, tab, setTab }) {
  const readiness  = window.HZsel.athleteReadiness(a.id);
  const summary    = window.HZsel.athleteSkillsSummary(a.id);
  const attendance = window.HZsel.athleteAttendance(a.id);
  const tabs = tabsForAthleteViewer(session);
  const activeTab = tabs.some(t => t.id === tab) ? tab : 'overview';

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 22 }}>
        <Avatar name={a.display_name} initials={a.initials} color={a.photo_color} src={a.photo_url} size={72}/>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="hz-display" style={{ fontSize: 36, lineHeight: 1 }}>{a.display_name}</div>
          <div style={{ color: 'var(--hz-dim)', fontSize: 12, marginTop: 6, textTransform: 'capitalize', letterSpacing: '0.04em' }}>
            {(a.position || a.role || 'athlete')}{a.age ? ' · Age ' + a.age : ''}{a.joined_at ? ' · since ' + new Date(a.joined_at).toLocaleString('default', { month: 'short', year: 'numeric' }) : ''}
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 22 }}>
        <MiniStat
          label="Readiness"
          value={summary.notAssessed ? 'Not assessed' : Math.round(readiness*100) + '%'}
          sub={summary.notAssessed ? 'coach has not scored yet' : ''}
          accent="var(--hz-teal)"
        />
        <MiniStat
          label="Attendance"
          value={attendance.empty ? 'No attendance' : Math.round((attendance.pct || 0)*100) + '%'}
          sub={attendance.empty ? 'classes not logged yet' : attendance.attended + '/' + attendance.total}
        />
        <MiniStat
          label="Mastered"
          value={summary.notAssessed ? 'Not assessed' : summary.mastered}
          sub={summary.notAssessed ? `${summary.total} skills loaded` : (summary.got + summary.mastered) + '/' + summary.total + ' have it'}
          accent="var(--hz-pink)"
        />
      </div>

      {/* Tabs */}
      <div className="ad-tabs">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={'ad-tab' + (activeTab === t.id ? ' active' : '')}
            aria-current={activeTab === t.id}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ marginTop: 20 }}>
        {activeTab === 'overview' && <OverviewTab a={a} snap={snap}/>}
        {activeTab === 'skills'   && <SkillsTab   a={a} snap={snap} session={session}/>}
        {activeTab === 'medical'  && <MedicalTab  a={a} session={session}/>}
        {activeTab === 'uniform'  && <UniformTab  a={a} snap={snap}/>}
        {activeTab === 'billing'  && <BillingTab  a={a}/>}
        {activeTab === 'timeline' && <TimelineTab a={a} snap={snap}/>}
      </div>
    </>
  );
}

function AthleteDrawer({ athleteId, snap, session, onClose, pushToast }) {
  const scope = window.HZviewerScope ? window.HZviewerScope(snap, session) : null;
  const [tab, setTab] = _adUS('overview');
  if (scope && !scope.visibleAthleteIds.has(athleteId)) {
    return (
      <div className="drawer-backdrop" onClick={onClose}>
        <aside className="athlete-drawer" onClick={e => e.stopPropagation()}>
          <button className="drawer-close" onClick={onClose}>&times;</button>
          <EmptyState
            icon="users"
            title="Athlete not linked."
            body="This account can only open athletes linked to it by the gym."
          />
        </aside>
      </div>
    );
  }
  const a = (snap.athletes || []).find(x => x.id === athleteId);
  if (!a) return null;

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose}></div>
      <div className="drawer hz-scroll">
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
          <div className="hz-eyebrow">Athlete</div>
          <button className="hz-btn hz-btn-ghost hz-btn-sm drawer-close-button" onClick={onClose} aria-label="Close">
            <window.HZIcon name="x" size={14}/>
          </button>
        </div>
        <AthleteCoreView a={a} snap={snap} session={session} tab={tab} setTab={setTab}/>
      </div>
    </>
  );
}
window.AthleteDrawer = AthleteDrawer;

// ─── Full-screen athlete profile route: #athlete/<id>?tab=<tab> ───────────
// Tab changes live in the hash, so the OS back button / swipe walks back
// through tabs and then back to wherever the parent came from.
function AthleteProfile({ route, snap, session, navigate, pushToast }) {
  const [base, query] = String(route || '').split('?');
  const athleteId = base.slice('athlete/'.length);
  const params = new URLSearchParams(query || '');
  const requested = params.get('tab');
  const allowedTabs = tabsForAthleteViewer(session);
  const tab = allowedTabs.some(t => t.id === requested) ? requested : 'overview';
  const setTab = (t) => {
    location.hash = '#athlete/' + athleteId + (t && t !== 'overview' ? '?tab=' + t : '');
  };
  const goBack = () => {
    if (window.history.length > 1) window.history.back();
    else navigate(session?.profile?.role === 'parent' ? 'parent' : 'today');
  };

  const scope = window.HZviewerScope ? window.HZviewerScope(snap, session) : null;
  const a = (snap.athletes || []).find(x => x.id === athleteId);
  const blocked = scope && !scope.visibleAthleteIds.has(athleteId);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <button className="hz-btn hz-btn-ghost hz-btn-sm" onClick={goBack} aria-label="Back" style={{ paddingLeft: 8, paddingRight: 10 }}>
          <window.HZIcon name="chev-left" size={16}/> Back
        </button>
        <div className="hz-eyebrow">Athlete</div>
      </div>
      {blocked || !a ? (
        <EmptyState
          icon="users"
          title={!a && !blocked ? 'Athlete not found.' : 'Athlete not linked.'}
          body="This account can only open athletes linked to it by the gym."
        />
      ) : (
        <AthleteCoreView a={a} snap={snap} session={session} tab={tab} setTab={setTab}/>
      )}
    </div>
  );
}
window.AthleteProfile = AthleteProfile;

// ─── Overview tab ─────────────────────────────────────────────────────────
function OverviewTab({ a, snap }) {
  const recentCels = (snap.celebrations || [])
    .filter(c => c.athlete_id === a.id)
    .sort((x, y) => new Date(y.created_at) - new Date(x.created_at))
    .slice(0, 5);

  const parents = (snap.parent_links || [])
    .filter(l => l.athlete_id === a.id)
    .map(l => (snap.profiles || []).find(p => p.id === l.parent_id))
    .filter(Boolean);

  const contacts = (snap.emergency_contacts || []).filter(c => c.athlete_id === a.id);

  // AI Judge: find the most recent analysis that mentioned this athlete
  const aiHits = (snap.analysis_elements || []).filter(e => e.athlete_id === a.id || (e.athlete_ids || []).includes(a.id));
  const lastAIAnalysis = (() => {
    if (aiHits.length === 0) return null;
    const ids = [...new Set(aiHits.map(h => h.analysis_id))];
    const analyses = (snap.routine_analyses || []).filter(x => ids.includes(x.id));
    return analyses.sort((x, y) => new Date(y.completed_at || y.created_at) - new Date(x.completed_at || x.created_at))[0];
  })();

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {lastAIAnalysis && (
        <div className="hz-card" style={{ padding: 18 }}>
          <div className="hz-eyebrow" style={{ color: 'var(--hz-pink)' }}>AI Judge · most recent</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 6 }}>
            <div style={{ fontFamily: 'var(--hz-serif)', fontStyle: 'italic', fontWeight: 700, fontSize: 32 }}>
              {Number(lastAIAnalysis.scorecard?.pct ?? 0).toFixed(1)}<span style={{ color: 'var(--hz-dim)', fontSize: 14 }}>%</span>
            </div>
            <div style={{ color: 'var(--hz-dim)', fontSize: 11 }}>{aiHits.length} detections for {a.display_name.split(' ')[0]}</div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--hz-dim)', marginTop: 6, fontStyle: 'italic' }}>
            {lastAIAnalysis.summary}
          </div>
        </div>
      )}

      <div className="hz-card" style={{ padding: 18 }}>
        <div className="hz-eyebrow" style={{ marginBottom: 10 }}>Recent wins</div>
        {recentCels.length === 0 && <div style={{ color: 'var(--hz-dim)', fontSize: 13 }}>Nothing logged yet.</div>}
        {recentCels.map(c => {
          const mins = Math.round((Date.now() - new Date(c.created_at).getTime()) / 60000);
          const ago = mins < 60 ? mins + 'm' : mins < 60*24 ? Math.round(mins/60) + 'h' : Math.round(mins/(60*24)) + 'd';
          return (
            <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px dashed var(--hz-line)' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{c.headline}</div>
                {c.body && <div style={{ fontSize: 11, color: 'var(--hz-dim)', marginTop: 2 }}>{c.body}</div>}
              </div>
              <div style={{ fontSize: 10, color: 'var(--hz-dim)', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 700, whiteSpace: 'nowrap' }}>{ago} ago</div>
            </div>
          );
        })}
      </div>

      {(parents.length > 0 || contacts.length > 0) && (
        <div className="hz-card" style={{ padding: 18 }}>
          <div className="hz-eyebrow" style={{ marginBottom: 10 }}>Family</div>
          {parents.map(p => (
            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px dashed var(--hz-line)' }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{p.display_name}</div>
              <div style={{ fontSize: 12, color: 'var(--hz-teal)' }}>{p.email}</div>
            </div>
          ))}
          {contacts.slice(0, 2).map(c => (
            <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px dashed var(--hz-line)' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{c.name}</div>
                <div style={{ fontSize: 11, color: 'var(--hz-dim)' }}>{c.relation}</div>
              </div>
              <a href={'tel:' + c.phone} style={{ fontSize: 12, color: 'var(--hz-teal)', textDecoration: 'none' }}>{c.phone}</a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Skills tab (existing skill tree) ─────────────────────────────────────
function SkillsTab({ a, snap, session }) {
  const skillsByCat = {};
  (snap.skills || []).forEach(s => {
    (skillsByCat[s.category] ||= []).push(s);
  });
  Object.values(skillsByCat).forEach(arr => arr.sort((x, y) => x.level - y.level));

  const statusMap = {};
  const skillRowMap = {};
  (snap.athlete_skills || []).filter(x => x.athlete_id === a.id).forEach(r => {
    statusMap[r.skill_id] = r.status;
    skillRowMap[r.skill_id] = r;
  });
  const summary = window.HZsel.athleteSkillsSummary(a.id);
  const viewerProfile = session?.profile || session?.actualProfile || {};
  const actorProfile = session?.actualProfile || session?.profile || {};
  const canEdit = ['coach', 'owner'].includes(viewerProfile.role || '');
  const [localStatus, setLocalStatus] = _adUS({});
  const [savingSkillId, setSavingSkillId] = _adUS('');
  const [saveError, setSaveError] = _adUS('');
  const [selectedSkillId, setSelectedSkillId] = _adUS('');
  const [noteDraft, setNoteDraft] = _adUS('');
  const [savingNote, setSavingNote] = _adUS(false);

  const statusFor = (skillId) => localStatus[skillId] || statusMap[skillId] || 'none';
  const selectedSkill = (snap.skills || []).find((skill) => skill.id === selectedSkillId) || null;
  const selectedSkillRow = selectedSkillId ? skillRowMap[selectedSkillId] || null : null;
  const selectedSkillStatus = selectedSkillId ? statusFor(selectedSkillId) : 'none';
  const selectedSkillNote = selectedSkillRow?.note || '';

  React.useEffect(() => {
    if (!selectedSkillId) {
      setNoteDraft('');
      return;
    }
    setNoteDraft(selectedSkillNote);
  }, [selectedSkillId, selectedSkillNote]);

  React.useEffect(() => {
    if (selectedSkillId || !(snap.skills || []).length) return;
    setSelectedSkillId(snap.skills[0].id);
  }, [selectedSkillId, snap.skills, setSelectedSkillId]);

  const persistSkill = async (skillId, nextStatus, noteValue) => {
    if (!canEdit || savingSkillId || savingNote) return;
    const updatedAt = new Date().toISOString();
    setSaveError('');
    setSavingSkillId(skillId);
    setSelectedSkillId(skillId);
    const cur = statusFor(skillId);
    setLocalStatus(prev => ({ ...prev, [skillId]: nextStatus }));
    try {
      const { error } = await persistAthleteDrawerSkill({
        athlete_id: a.id,
        skill_id: skillId,
        status: nextStatus,
        note: noteValue,
        updated_by: actorProfile.id || session?.user?.id || null,
        updated_at: updatedAt,
      });
      if (error) throw error;
      await refreshAthleteDrawerSkills();
    } catch (error) {
      setLocalStatus(prev => ({ ...prev, [skillId]: cur }));
      setSaveError(error?.message || 'That skill did not save. Try again.');
    } finally {
      setSavingSkillId('');
    }
  };

  const setSkillStatus = async (skillId, nextStatus) => {
    await persistSkill(skillId, nextStatus, (skillRowMap[skillId]?.note || '').trim() || null);
  };

  const cycle = async (skillId) => {
    if (!canEdit || savingSkillId || savingNote) return;
    const order = ['none','working','got_it','mastered'];
    const cur = statusFor(skillId);
    const next = order[(order.indexOf(cur) + 1) % order.length];
    await persistSkill(skillId, next, (skillRowMap[skillId]?.note || '').trim() || null);
  };

  const saveSkillNote = async () => {
    if (!canEdit || !selectedSkillId || savingSkillId || savingNote) return;
    const updatedAt = new Date().toISOString();
    setSaveError('');
    setSavingNote(true);
    try {
      const { error } = await persistAthleteDrawerSkill({
        athlete_id: a.id,
        skill_id: selectedSkillId,
        status: selectedSkillStatus,
        note: noteDraft.trim() || null,
        updated_by: actorProfile.id || session?.user?.id || null,
        updated_at: updatedAt,
      });
      if (error) throw error;
      await refreshAthleteDrawerSkills();
      window.HZToast?.({
        kind: 'success',
        eyebrow: 'Skill note',
        title: 'Skill note saved',
        body: `${a.display_name} now has a note on ${selectedSkill?.name || 'that skill'}.`,
      });
    } catch (error) {
      const message = error?.message || 'That skill note did not save. Try again.';
      setSaveError(message);
      window.HZToast?.({ kind: 'error', eyebrow: 'Skill note', title: 'Save failed', body: message });
    } finally {
      setSavingNote(false);
    }
  };

  const CAT_ORDER = ['standing_tumbling','running_tumbling','jumps','stunts','pyramids','baskets'];
  const CAT_LABEL = { standing_tumbling: 'Standing Tumbling', running_tumbling: 'Running Tumbling', jumps: 'Jumps', stunts: 'Stunts', pyramids: 'Pyramids', baskets: 'Baskets' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {summary.notAssessed && (
        <div className="hz-card" style={{ padding: 14, borderColor: 'rgba(39,207,215,0.28)', background: 'rgba(39,207,215,0.06)' }}>
          <div className="hz-eyebrow" style={{ color: 'var(--hz-teal)', marginBottom: 6 }}>Not assessed yet</div>
          <div style={{ color: 'var(--hz-dim)', fontSize: 12.5, lineHeight: 1.45 }}>
            The skill tree is loaded, but staff have not marked progress for this athlete yet.
          </div>
        </div>
      )}
      {!canEdit && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <span style={{ color: 'var(--hz-dim)', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Legend</span>
          {[['working','Working','rgba(255,180,84,0.16)','var(--hz-amber)'],['got_it','Got it','rgba(39,207,215,0.18)','var(--hz-teal)'],['mastered','Mastered','linear-gradient(135deg, rgba(39,207,215,0.3), rgba(249,127,172,0.3))','#fff']].map(([id, label, bg, fg]) => (
            <span key={id} style={{ padding: '3px 10px', borderRadius: 999, fontSize: 10.5, fontWeight: 700, background: bg, color: fg }}>{label}</span>
          ))}
          <span style={{ color: 'var(--hz-dim)', fontSize: 11 }}>Dim = not started. Updates live as coaches log progress.</span>
        </div>
      )}
      {saveError && <div style={{ color: 'var(--hz-pink)', fontSize: 12.5 }}>{saveError}</div>}
      {CAT_ORDER.map(cat => (
        <div key={cat}>
          <div className="hz-eyebrow" style={{ marginBottom: 8 }}>{CAT_LABEL[cat]}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {(skillsByCat[cat] || []).length === 0 && (
              <div style={{ color: 'var(--hz-dim)', fontSize: 12 }}>No skills loaded for this category yet.</div>
            )}
            {(skillsByCat[cat] || []).map(s => {
              const st = statusFor(s.id);
              const hasNote = Boolean(String(skillRowMap[s.id]?.note || '').trim());
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => { setSelectedSkillId(s.id); cycle(s.id); }}
                  disabled={!canEdit}
                  style={{
                    padding: '6px 10px', borderRadius: 6, fontSize: 11, cursor: canEdit ? 'pointer' : 'default',
                    background: st === 'mastered' ? 'linear-gradient(135deg, rgba(39,207,215,0.3), rgba(249,127,172,0.3))'
                      : st === 'got_it' ? 'rgba(39,207,215,0.18)'
                      : st === 'working' ? 'rgba(255,180,84,0.16)'
                      : 'rgba(255,255,255,0.04)',
                    color: st === 'mastered' ? '#fff'
                      : st === 'got_it' ? 'var(--hz-teal)'
                      : st === 'working' ? 'var(--hz-amber)'
                      : 'var(--hz-dim)',
                    border: st === 'mastered' ? '1px solid rgba(249,127,172,0.3)' : '1px solid transparent',
                    opacity: savingSkillId === s.id ? 0.72 : 1,
                  }}
                  title={canEdit ? s.name + ' · Level ' + s.level + (hasNote ? ' · note saved' : '') + ' — click to cycle' : s.name + ' · Level ' + s.level}>
                  <span style={{ opacity: 0.6, fontFamily: 'var(--hz-mono)', fontSize: 9, marginRight: 6 }}>L{s.level}</span>
                  {s.name}
                  {hasNote && (
                    <span style={{
                      marginLeft: 6,
                      padding: '1px 4px',
                      borderRadius: 999,
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: '0.06em',
                      background: 'rgba(255,255,255,0.08)',
                      color: '#fff',
                    }}>
                      N
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {selectedSkill && (
        <div className="hz-card" style={{ padding: 16, display: 'grid', gap: 12, borderColor: 'rgba(39,207,215,0.24)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div>
              <div className="hz-eyebrow" style={{ marginBottom: 5 }}>Selected skill</div>
              <div style={{ fontSize: 17, fontWeight: 900 }}>{selectedSkill.name}</div>
              <div style={{ color: 'var(--hz-dim)', fontSize: 12, marginTop: 4 }}>
                {a.display_name} · Level {selectedSkill.level} · {CAT_LABEL[selectedSkill.category] || selectedSkill.category}
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {[
                ['none', 'Not started'],
                ['working', 'Working'],
                ['got_it', 'Got it'],
                ['mastered', 'Mastered'],
              ].map(([statusId, label]) => (
                <button
                  key={statusId}
                  type="button"
                  className="hz-btn hz-btn-sm"
                  disabled={!canEdit || savingSkillId === selectedSkillId || savingNote}
                  onClick={() => setSkillStatus(selectedSkillId, statusId)}
                  style={{
                    borderColor: selectedSkillStatus === statusId ? 'rgba(39,207,215,0.45)' : 'var(--hz-line)',
                    background: selectedSkillStatus === statusId ? 'rgba(39,207,215,0.12)' : undefined,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="hz-eyebrow" style={{ marginBottom: 8 }}>Coach note for this athlete</div>
            <textarea
              className="hz-input"
              rows={3}
              placeholder="Technique reminder, progression cue, safety note, or what to fix next."
              value={noteDraft}
              onChange={(event) => setNoteDraft(event.target.value)}
              disabled={!canEdit || savingNote}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}>
              <div style={{ color: 'var(--hz-dim)', fontSize: 12 }}>
                Notes stay attached to this athlete + skill pairing and follow the saved status.
              </div>
              <button
                type="button"
                className="hz-btn hz-btn-primary hz-btn-sm"
                disabled={!canEdit || savingNote || noteDraft === selectedSkillNote}
                onClick={saveSkillNote}
              >
                {savingNote ? 'Saving note...' : 'Save note'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Medical tab ──────────────────────────────────────────────────────────
function MedicalTab({ a, session }) {
  const { record, contacts, injuries } = window.HZsel.athleteMedical(a.id);
  const canEdit = athleteDrawerMedicalCanEdit(session);
  const actorId = session?.actualProfile?.id || session?.profile?.id || session?.user?.id || null;
  const linkedParents = (() => {
    const snap = window.HZsel?.cache?.() || {};
    return (snap.parent_links || [])
      .filter((link) => link.athlete_id === a.id)
      .map((link) => ({
        ...link,
        profile: (snap.profiles || []).find((profile) => profile.id === link.parent_id) || null,
      }))
      .filter((link) => link.profile);
  })();
  const [medicalForm, setMedicalForm] = React.useState(() => ({
    blood_type: record?.blood_type || '',
    allergies: record?.allergies || '',
    medications: record?.medications || '',
    conditions: record?.conditions || '',
    insurance_carrier: record?.insurance_carrier || '',
    insurance_member_id: record?.insurance_member_id || '',
    physician_name: record?.physician_name || '',
    physician_phone: record?.physician_phone || '',
    last_physical: record?.last_physical || '',
    notes: record?.notes || '',
  }));
  const [contactForm, setContactForm] = React.useState({ name: '', relation: 'Parent', phone: '', email: '', is_primary: contacts.length === 0 });
  const [savingMedical, setSavingMedical] = React.useState(false);
  const [savingContact, setSavingContact] = React.useState(false);
  const [saveError, setSaveError] = React.useState('');

  React.useEffect(() => {
    setMedicalForm({
      blood_type: record?.blood_type || '',
      allergies: record?.allergies || '',
      medications: record?.medications || '',
      conditions: record?.conditions || '',
      insurance_carrier: record?.insurance_carrier || '',
      insurance_member_id: record?.insurance_member_id || '',
      physician_name: record?.physician_name || '',
      physician_phone: record?.physician_phone || '',
      last_physical: record?.last_physical || '',
      notes: record?.notes || '',
    });
  }, [record?.athlete_id, record?.updated_at]);

  async function saveMedical() {
    if (!canEdit || savingMedical) return;
    setSaveError('');
    setSavingMedical(true);
    try {
      const payload = {
        athlete_id: a.id,
        blood_type: medicalForm.blood_type.trim() || null,
        allergies: medicalForm.allergies.trim() || null,
        medications: medicalForm.medications.trim() || null,
        conditions: medicalForm.conditions.trim() || null,
        insurance_carrier: medicalForm.insurance_carrier.trim() || null,
        insurance_member_id: medicalForm.insurance_member_id.trim() || null,
        physician_name: medicalForm.physician_name.trim() || null,
        physician_phone: medicalForm.physician_phone.trim() || null,
        last_physical: medicalForm.last_physical || null,
        notes: medicalForm.notes.trim() || null,
        updated_by: actorId,
        updated_at: new Date().toISOString(),
      };
      const { error } = await persistAthleteDrawerMedicalRecord(payload);
      if (error) throw error;
      await refreshAthleteDrawerMedical();
      window.HZToast?.({ kind: 'success', eyebrow: 'Athlete medical', title: 'Medical info saved', body: `${a.display_name} now has updated medical details.` });
    } catch (error) {
      const message = error?.message || 'Could not save medical info.';
      setSaveError(message);
      window.HZToast?.({ kind: 'error', eyebrow: 'Athlete medical', title: 'Save failed', body: message });
    } finally {
      setSavingMedical(false);
    }
  }

  async function addContact() {
    if (!canEdit || savingContact) return;
    if (!contactForm.name.trim() || !contactForm.phone.trim()) {
      const message = 'Contact name and phone are required.';
      setSaveError(message);
      window.HZToast?.({ kind: 'error', eyebrow: 'Athlete medical', title: 'Contact not saved', body: message });
      return;
    }
    setSaveError('');
    setSavingContact(true);
    try {
      const payload = {
        id: window.crypto?.randomUUID?.() || `contact-${Date.now()}`,
        athlete_id: a.id,
        name: contactForm.name.trim(),
        relation: contactForm.relation.trim() || 'Parent',
        phone: contactForm.phone.trim(),
        email: contactForm.email.trim() || null,
        is_primary: !!contactForm.is_primary,
      };
      const { error } = await insertAthleteDrawerEmergencyContact(payload);
      if (error) throw error;
      await refreshAthleteDrawerMedical();
      setContactForm({ name: '', relation: 'Parent', phone: '', email: '', is_primary: false });
      window.HZToast?.({ kind: 'success', eyebrow: 'Athlete medical', title: 'Contact added', body: `${payload.name} is now attached to ${a.display_name}.` });
    } catch (error) {
      const message = error?.message || 'Could not save emergency contact.';
      setSaveError(message);
      window.HZToast?.({ kind: 'error', eyebrow: 'Athlete medical', title: 'Contact not saved', body: message });
    } finally {
      setSavingContact(false);
    }
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {(linkedParents.length > 0 || canEdit) && (
        <div className="hz-card" style={{ padding: 16 }}>
          <div className="hz-eyebrow" style={{ marginBottom: 8 }}>Linked parents</div>
          {linkedParents.length === 0 && <div style={{ color: 'var(--hz-dim)', fontSize: 13 }}>No linked parent account is attached yet.</div>}
          {linkedParents.map((link) => (
            <div key={link.parent_id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px dashed var(--hz-line)' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{link.profile.display_name || link.profile.email || 'Parent account'}</div>
                <div style={{ fontSize: 11, color: 'var(--hz-dim)', textTransform: 'capitalize' }}>
                  {link.relation || (link.is_primary ? 'primary parent' : 'linked parent')}
                </div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--hz-teal)' }}>{link.profile.email || 'No email on file'}</div>
            </div>
          ))}
        </div>
      )}

      <div className="hz-card" style={{ padding: 16 }}>
        <div className="hz-eyebrow" style={{ marginBottom: 8 }}>Emergency contacts</div>
        {contacts.length === 0 && <div style={{ color: 'var(--hz-dim)', fontSize: 13 }}>None on file.</div>}
        {contacts.map(c => (
          <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px dashed var(--hz-line)' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{c.name}</div>
              <div style={{ fontSize: 11, color: 'var(--hz-dim)', textTransform: 'capitalize' }}>{c.relation}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <a href={'tel:' + c.phone} style={{ color: 'var(--hz-teal)', textDecoration: 'none', fontSize: 13 }}>{c.phone}</a>
              <div style={{ color: 'var(--hz-dim)', fontSize: 11 }}>{c.email}</div>
            </div>
          </div>
        ))}
        {canEdit && (
          <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <input className="hz-input" placeholder="Parent/contact name" value={contactForm.name} onChange={(event) => setContactForm((prev) => ({ ...prev, name: event.target.value }))}/>
              <input className="hz-input" placeholder="Relation" value={contactForm.relation} onChange={(event) => setContactForm((prev) => ({ ...prev, relation: event.target.value }))}/>
              <input className="hz-input" placeholder="Phone" value={contactForm.phone} onChange={(event) => setContactForm((prev) => ({ ...prev, phone: event.target.value }))}/>
              <input className="hz-input" placeholder="Email" value={contactForm.email} onChange={(event) => setContactForm((prev) => ({ ...prev, email: event.target.value }))}/>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--hz-dim)' }}>
              <input type="checkbox" checked={!!contactForm.is_primary} onChange={(event) => setContactForm((prev) => ({ ...prev, is_primary: event.target.checked }))}/>
              Mark as primary contact
            </label>
            <div>
              <button className="hz-btn hz-btn-primary hz-btn-sm" disabled={savingContact} onClick={addContact}>
                {savingContact ? 'Saving...' : 'Add emergency contact'}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="hz-card" style={{ padding: 16 }}>
        <div className="hz-eyebrow" style={{ marginBottom: 8 }}>Medical info</div>
        {!record && <div style={{ color: 'var(--hz-dim)', fontSize: 13 }}>No medical record on file.</div>}
        {record && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 13 }}>
            <KV label="Blood type"    v={record.blood_type || '—'}/>
            <KV label="Allergies"     v={record.allergies || '—'}/>
            <KV label="Medications"   v={record.medications || '—'}/>
            <KV label="Conditions"    v={record.conditions || '—'}/>
            <KV label="Insurance"     v={record.insurance_carrier || '—'}/>
            <KV label="Policy #"      v={record.insurance_member_id || '—'}/>
            <KV label="Physician"     v={record.physician_name || '—'}/>
            <KV label="Dr. phone"     v={record.physician_phone || '—'}/>
            <KV label="Last physical" v={record.last_physical || '—'}/>
            <KV label="Notes"         v={record.notes || '—'}/>
          </div>
        )}
        {canEdit && (
          <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <input className="hz-input" placeholder="Blood type" value={medicalForm.blood_type} onChange={(event) => setMedicalForm((prev) => ({ ...prev, blood_type: event.target.value }))}/>
              <input className="hz-input" placeholder="Last physical (YYYY-MM-DD)" value={medicalForm.last_physical} onChange={(event) => setMedicalForm((prev) => ({ ...prev, last_physical: event.target.value }))}/>
              <textarea className="hz-input" rows={2} placeholder="Allergies" value={medicalForm.allergies} onChange={(event) => setMedicalForm((prev) => ({ ...prev, allergies: event.target.value }))}/>
              <textarea className="hz-input" rows={2} placeholder="Medications" value={medicalForm.medications} onChange={(event) => setMedicalForm((prev) => ({ ...prev, medications: event.target.value }))}/>
              <textarea className="hz-input" rows={2} placeholder="Conditions / restrictions" value={medicalForm.conditions} onChange={(event) => setMedicalForm((prev) => ({ ...prev, conditions: event.target.value }))}/>
              <textarea className="hz-input" rows={2} placeholder="Notes" value={medicalForm.notes} onChange={(event) => setMedicalForm((prev) => ({ ...prev, notes: event.target.value }))}/>
              <input className="hz-input" placeholder="Insurance carrier" value={medicalForm.insurance_carrier} onChange={(event) => setMedicalForm((prev) => ({ ...prev, insurance_carrier: event.target.value }))}/>
              <input className="hz-input" placeholder="Policy / member #" value={medicalForm.insurance_member_id} onChange={(event) => setMedicalForm((prev) => ({ ...prev, insurance_member_id: event.target.value }))}/>
              <input className="hz-input" placeholder="Physician" value={medicalForm.physician_name} onChange={(event) => setMedicalForm((prev) => ({ ...prev, physician_name: event.target.value }))}/>
              <input className="hz-input" placeholder="Physician phone" value={medicalForm.physician_phone} onChange={(event) => setMedicalForm((prev) => ({ ...prev, physician_phone: event.target.value }))}/>
            </div>
            <div>
              <button className="hz-btn hz-btn-primary hz-btn-sm" disabled={savingMedical} onClick={saveMedical}>
                {savingMedical ? 'Saving...' : record ? 'Update medical info' : 'Save medical info'}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="hz-card" style={{ padding: 16 }}>
        <div className="hz-eyebrow" style={{ marginBottom: 8 }}>Injury log</div>
        {injuries.length === 0 && <div style={{ color: 'var(--hz-dim)', fontSize: 13 }}>No injuries logged.</div>}
        {injuries.map(inj => (
          <div key={inj.id} style={{ padding: '10px 0', borderBottom: '1px dashed var(--hz-line)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{inj.body_part}</div>
              <div style={{ fontSize: 11, color: 'var(--hz-dim)' }}>{new Date(inj.occurred_at).toLocaleDateString()}</div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--hz-dim)', marginTop: 4 }}>{inj.description}</div>
            {inj.severity && (
              <div style={{ display: 'inline-block', marginTop: 6, padding: '2px 8px', borderRadius: 999, fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase',
                background: inj.severity === 'severe' ? 'rgba(255,94,108,0.16)' : inj.severity === 'moderate' ? 'rgba(255,180,84,0.16)' : 'rgba(255,255,255,0.06)',
                color: inj.severity === 'severe' ? 'var(--hz-red)' : inj.severity === 'moderate' ? 'var(--hz-amber)' : 'var(--hz-dim)' }}>
                {inj.severity}{inj.resolved_at ? ' · resolved' : ''}
              </div>
            )}
          </div>
        ))}
      </div>
      {saveError && <div style={{ color: 'var(--hz-pink)', fontSize: 12.5 }}>{saveError}</div>}
    </div>
  );
}

// ─── Uniform tab ──────────────────────────────────────────────────────────
function UniformTab({ a, snap }) {
  const orders = (snap.uniform_orders || []).filter(o => o.athlete_id === a.id);
  const uniformLabel = (uid) => (snap.uniforms || []).find(u => u.id === uid)?.name || '—';
  if (orders.length === 0) {
    return <div className="hz-card" style={{ padding: 24, color: 'var(--hz-dim)', fontSize: 13, textAlign: 'center' }}>No uniform orders yet.</div>;
  }
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {orders.map(o => (
        <div key={o.id} className="hz-card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{uniformLabel(o.uniform_id)}</div>
            <UniStatus status={o.status}/>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 12 }}>
            {Object.entries(o.fit_data || {}).map(([k, v]) => (
              <div key={k}>
                <div className="hz-eyebrow">{k}</div>
                <div style={{ fontWeight: 600, marginTop: 2 }}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{ color: 'var(--hz-dim)', fontSize: 11, marginTop: 10 }}>
            {o.ordered_at ? 'Ordered ' + new Date(o.ordered_at).toLocaleDateString() : 'Not yet ordered'}
            {o.delivered_at ? ' · Delivered ' + new Date(o.delivered_at).toLocaleDateString() : ''}
          </div>
        </div>
      ))}
    </div>
  );
}
function UniStatus({ status }) {
  const m = {
    pending:   ['rgba(255,255,255,0.08)', 'var(--hz-dim)'],
    ordered:   ['rgba(39,207,215,0.14)',  'var(--hz-teal)'],
    shipped:   ['rgba(249,127,172,0.14)', 'var(--hz-pink)'],
    delivered: ['rgba(63,231,160,0.16)',  'var(--hz-green)'],
    returned:  ['rgba(255,94,108,0.16)',  'var(--hz-red)'],
  };
  const [bg, fg] = m[status] || m.pending;
  return <span style={{ background: bg, color: fg, padding: '3px 10px', borderRadius: 999, fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{status}</span>;
}

// ─── Billing tab ──────────────────────────────────────────────────────────
function BillingTab({ a }) {
  const b = window.HZsel.athleteBilling(a.id);
  const classEnrollments = window.HZsel.classEnrollmentsForAthlete(a.id);
  if (!b && classEnrollments.length === 0) return <div className="hz-card" style={{ padding: 24, color: 'var(--hz-dim)', fontSize: 13, textAlign: 'center' }}>No billing account or paid class registration yet.</div>;
  const seasonTotal = Number(b?.account?.season_total || 0);
  const paidPct = seasonTotal > 0 ? Math.min(100, Math.round((Number(b.account.paid || 0) / seasonTotal) * 100)) : 0;
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {b && (
        <div className="hz-card" style={{ padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <div className="hz-eyebrow">Balance</div>
              <div className="hz-display" style={{ fontSize: 32, color: b.account.owed > 0 ? 'var(--hz-amber)' : 'var(--hz-green)', marginTop: 2 }}>
                {b.account.owed > 0 ? '$' + b.account.owed : 'Paid'}
              </div>
              {seasonTotal === 0 && <div style={{ color: 'var(--hz-dim)', fontSize: 11, marginTop: 4 }}>Season billing is pending staff setup.</div>}
            </div>
            <div style={{ textAlign: 'right', fontSize: 11, color: 'var(--hz-dim)' }}>
              <div>Season ${b.account.season_total}</div>
              <div>Paid ${b.account.paid}</div>
              <div>Autopay {b.account.autopay ? 'on' : 'off'}</div>
            </div>
          </div>
          <div style={{ height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ width: paidPct + '%', height: '100%', background: 'linear-gradient(90deg, var(--hz-teal), var(--hz-pink))' }}/>
          </div>
        </div>
      )}

      {classEnrollments.length > 0 && (
        <div className="hz-card" style={{ padding: 16 }}>
          <div className="hz-eyebrow" style={{ marginBottom: 10 }}>Paid registrations</div>
          {classEnrollments.map(row => (
            <div key={row.id} style={{ padding: '10px 0', borderBottom: '1px dashed var(--hz-line)', fontSize: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{row.class_name}</div>
                  <div style={{ color: 'var(--hz-dim)', marginTop: 3 }}>{row.schedule_summary || 'Class schedule pending'}</div>
                  <div style={{ color: 'var(--hz-dim)', marginTop: 3 }}>
                    {row.staff_status === 'accepted' ? 'Accepted by staff' : 'Pending staff review'}
                  </div>
                </div>
                <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <div style={{ fontWeight: 800, color: row.payment_status === 'paid' ? 'var(--hz-green)' : 'var(--hz-amber)' }}>
                    {row.payment_status === 'paid' ? adMoneyFromCents(row.amount_paid_cents) : row.payment_status}
                  </div>
                  {row.receipt_url && <a href={row.receipt_url} target="_blank" rel="noreferrer" style={{ color: 'var(--hz-teal)', fontSize: 11 }}>Receipt</a>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {b?.charges?.length > 0 && (
        <div className="hz-card" style={{ padding: 16, maxHeight: 340, overflow: 'auto' }}>
          <div className="hz-eyebrow" style={{ marginBottom: 10 }}>Recent charges</div>
          {b.charges.slice(-10).reverse().map(c => (
            <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed var(--hz-line)', fontSize: 12 }}>
              <div>
                <div style={{ fontWeight: 600, textTransform: 'capitalize' }}>{c.kind}</div>
                <div style={{ color: 'var(--hz-dim)', fontSize: 10 }}>Due {c.due_at}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 600 }}>${c.amount}</div>
                <div style={{ color: c.paid_at ? 'var(--hz-green)' : 'var(--hz-amber)', fontSize: 10 }}>{c.paid_at ? 'paid' : 'due'}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Timeline tab ─────────────────────────────────────────────────────────
function TimelineTab({ a, snap }) {
  // Merge celebrations + AI Judge detections + attendance events into a single sorted list.
  const events = [];

  (snap.celebrations || []).filter(c => c.athlete_id === a.id).forEach(c => events.push({
    id: 'cel_' + c.id, kind: 'celebration',
    t: new Date(c.created_at),
    title: c.headline, body: c.body || '', icon: 'star', color: 'var(--hz-pink)',
  }));

  (snap.analysis_elements || []).filter(e => e.athlete_id === a.id || (e.athlete_ids || []).includes(a.id)).forEach(e => {
    const analysis = (snap.routine_analyses || []).find(x => x.id === e.analysis_id);
    if (!analysis) return;
    events.push({
      id: 'ae_' + e.id, kind: 'ai',
      t: new Date(analysis.completed_at || analysis.created_at),
      title: 'AI Judge detected ' + e.label,
      body: (e.confidence*100).toFixed(0) + '% confidence · ' + e.raw_score.toFixed(1) + ' pts',
      icon: 'bolt', color: 'var(--hz-teal)',
    });
  });

  (snap.injuries || []).filter(i => i.athlete_id === a.id).forEach(i => events.push({
    id: 'inj_' + i.id, kind: 'injury',
    t: new Date(i.occurred_at),
    title: 'Injury · ' + i.body_part, body: i.description, icon: 'x', color: 'var(--hz-red)',
  }));

  events.sort((x, y) => y.t - x.t);

  if (events.length === 0) {
    return <div className="hz-card" style={{ padding: 24, color: 'var(--hz-dim)', fontSize: 13, textAlign: 'center' }}>No events yet.</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {events.slice(0, 40).map(e => (
        <div key={e.id} style={{ display: 'flex', gap: 12, padding: 12, borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--hz-line)' }}>
          <div style={{ width: 6, alignSelf: 'stretch', background: e.color, borderRadius: 3 }}/>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{e.title}</div>
            {e.body && <div style={{ fontSize: 11, color: 'var(--hz-dim)', marginTop: 3 }}>{e.body}</div>}
            <div style={{ fontSize: 10, color: 'var(--hz-dimmer)', marginTop: 6, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 700 }}>
              {e.t.toLocaleDateString()} · {e.kind}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────
function MiniStat({ label, value, sub, accent }) {
  const text = String(value ?? '');
  const compact = text.length > 8;
  return (
    <div className="hz-card hz-card-dense" style={{ padding: '12px 12px' }}>
      <div className="hz-eyebrow" style={{ fontSize: 9 }}>{label}</div>
      <div className="hz-display" style={{ fontSize: compact ? 15 : 24, marginTop: 2, color: accent || '#fff', lineHeight: 1.05 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: 'var(--hz-dim)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}
function KV({ label, v }) {
  return (
    <div>
      <div className="hz-eyebrow">{label}</div>
      <div style={{ fontWeight: 600, marginTop: 3 }}>{v}</div>
    </div>
  );
}
