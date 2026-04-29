// ─────────────────────────────────────────────────────────────────────────────
// HIT ZERO WEB — Tier 1 + Tier 2 screens
// Messages, Schedule (RSVP + iCal), Uniforms, Medical drawer tab, Leads (CRM),
// Forms/Evaluations, Volunteers, Practice Plans, Registration.
// Everything binds to window.HZsel + window.HZdb.
// ─────────────────────────────────────────────────────────────────────────────
const { useState: _useState, useEffect: _useEffect, useMemo: _useMemo, useRef: _useRef } = React;

// Small local utilities — lean on existing HZPrimitives where possible
function timeAgo(iso) {
  if (!iso) return '';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (mins < 60*24) return `${Math.round(mins/60)}h ago`;
  return `${Math.round(mins/(60*24))}d ago`;
}
function formatSessionTime(iso) {
  const d = new Date(iso);
  const day = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return { day, time };
}
function initialsOf(name) { return (name || '?').split(' ').map(n => n[0]).filter(Boolean).slice(0,2).join('').toUpperCase(); }
function moneyFmt(n) { return '$' + (Math.round((n||0)*100)/100).toLocaleString(); }
function cleanSessionType(value) {
  return String(value || 'Session')
    .replace(/^competition\s*:\s*dream on$/i, 'Competition')
    .replace(/\bdream on\b/ig, 'Competition')
    .replace(/\bbismarck,\s*nd\b/ig, '')
    .replace(/\s+·\s+$/g, '')
    .trim();
}
function isUuid(value) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '')); }
function liveMode() { return Boolean(window.HZsupa && window.HZdb?.auth?._mode?.() === 'live'); }
async function refreshAppData(table, action = 'update') {
  if (window.HZsel?._refresh) await window.HZsel._refresh();
  window.dispatchEvent(new CustomEvent('hz:refresh', { detail: { table, action } }));
}
function notify(title, body, variant = 'got_it') {
  if (window.HZToast) window.HZToast({ variant, eyebrow: 'Saved', title, body });
}

// ═══════════════════════════════════════════════════════════════════════════
// Messages — left rail of threads, right pane of conversation
// ═══════════════════════════════════════════════════════════════════════════
function Messages({ snap, session }) {
  const me = session?.profile || { id: 'u_coach', display_name: 'Coach Brynn', role: 'coach' };
  const threads = window.HZsel.inboxThreads(me.id);
  const [activeId, setActiveId] = _useState(threads[0]?.id || null);
  const [draft, setDraft] = _useState('');
  const paneRef = _useRef(null);

  const active = threads.find(t => t.id === activeId) || threads[0] || null;
  const msgs = active ? window.HZsel.threadMessages(active.id) : [];
  const members = active ? window.HZsel.threadMembers(active.id) : [];

  // Mark as read when a thread becomes active
  _useEffect(() => {
    if (!active) return;
    window.HZdb.from('message_reads')
      .upsert({ thread_id: active.id, profile_id: me.id, last_read_at: new Date().toISOString() }, { onConflict: 'thread_id,profile_id' });
  }, [active?.id]);

  // Auto-scroll to bottom on new messages
  _useEffect(() => {
    if (paneRef.current) paneRef.current.scrollTop = paneRef.current.scrollHeight;
  }, [msgs.length, activeId]);

  function send() {
    if (!draft.trim() || !active) return;
    window.HZdb.from('messages').insert({
      thread_id: active.id,
      author_id: me.id,
      body: draft.trim(),
      created_at: new Date().toISOString(),
    });
    setDraft('');
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 0, height: 'calc(100vh - 88px)', marginTop: -16, marginRight: -16 }}>
      {/* Threads list */}
      <aside style={{ borderRight: '1px solid var(--hz-line)', overflow: 'auto', paddingRight: 8 }}>
        <div style={{ padding: '8px 10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="hz-display" style={{ fontSize: 24, fontWeight: 600 }}>Messages</div>
          <button className="hz-btn hz-btn-ghost" onClick={() => alert('New thread picker coming soon')}>
            <window.HZIcon name="plus" size={16}/> New
          </button>
        </div>
        {threads.length === 0 && <div style={{ padding: 24, color: 'var(--hz-dim)', fontSize: 13 }}>No threads yet.</div>}
        {threads.map(t => (
          <button key={t.id} onClick={() => setActiveId(t.id)}
            className="hz-nosel"
            style={{
              display: 'block', width: '100%', textAlign: 'left', padding: '12px 14px',
              borderRadius: 12, background: t.id === activeId ? 'rgba(255,255,255,0.05)' : 'transparent',
              border: '1px solid transparent', color: '#fff', cursor: 'pointer', marginBottom: 4,
            }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {t.title || threadTitle(t, members, me)}
              </div>
              {t.unread > 0 && (
                <div style={{ background: 'var(--hz-pink)', color: '#050507', fontSize: 10, fontWeight: 800, borderRadius: 999, padding: '2px 7px', letterSpacing: '0.02em' }}>
                  {t.unread}
                </div>
              )}
            </div>
            <div style={{ color: 'var(--hz-dim)', fontSize: 12, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {t.last ? t.last.body : '—'}
            </div>
            <div style={{ color: 'var(--hz-dimmer)', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700, marginTop: 6 }}>
              {timeAgo(t.last_message_at || t.created_at)} · {t.kind}
            </div>
          </button>
        ))}
      </aside>

      {/* Conversation pane */}
      <section style={{ display: 'flex', flexDirection: 'column', height: '100%', paddingLeft: 16 }}>
        {!active && <div style={{ margin: 'auto', color: 'var(--hz-dim)' }}>Pick a thread to start.</div>}
        {active && (
          <>
            <div style={{ padding: '8px 0 14px', borderBottom: '1px solid var(--hz-line)' }}>
              <div className="hz-display" style={{ fontSize: 22, fontWeight: 600 }}>
                {active.title || threadTitle(active, members, me)}
              </div>
              <div className="hz-eyebrow" style={{ marginTop: 4 }}>{members.length} members · {active.kind}</div>
            </div>
            <div ref={paneRef} style={{ flex: 1, overflow: 'auto', padding: '16px 0' }}>
              {msgs.map(m => {
                const author = (snap.profiles || []).find(p => p.id === m.author_id);
                const mine = m.author_id === me.id;
                return (
                  <div key={m.id} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start', marginBottom: 12 }}>
                    <div style={{ maxWidth: '72%' }}>
                      {!mine && (
                        <div style={{ fontSize: 10, color: 'var(--hz-dim)', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>
                          {author?.display_name || 'Unknown'} · {timeAgo(m.created_at)}
                        </div>
                      )}
                      <div style={{
                        background: mine ? 'linear-gradient(135deg, rgba(39,207,215,0.22), rgba(249,127,172,0.22))' : 'rgba(255,255,255,0.05)',
                        border: '1px solid var(--hz-line)',
                        borderRadius: 14, padding: '10px 14px', fontSize: 14, lineHeight: 1.45,
                      }}>
                        {m.body}
                      </div>
                      {mine && <div style={{ fontSize: 10, color: 'var(--hz-dim)', textAlign: 'right', marginTop: 4 }}>{timeAgo(m.created_at)}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ borderTop: '1px solid var(--hz-line)', padding: '12px 0', display: 'flex', gap: 8 }}>
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder={`Message ${active.title || 'thread'}…`}
                style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--hz-line)', borderRadius: 12, padding: '12px 14px', color: '#fff', fontSize: 14, fontFamily: 'var(--hz-sans)' }}
              />
              <button className="hz-btn hz-btn-primary" onClick={send} disabled={!draft.trim()}>
                <window.HZIcon name="bolt" size={14}/> Send
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
function threadTitle(t, members, me) {
  if (t.title) return t.title;
  if (t.kind === 'dm') {
    const other = members.find(m => m.profile_id !== me.id);
    return other?.profile?.display_name || 'Direct message';
  }
  return t.kind.charAt(0).toUpperCase() + t.kind.slice(1);
}
window.Messages = Messages;

// ═══════════════════════════════════════════════════════════════════════════
// Schedule — upcoming sessions, RSVP + iCal feed
// ═══════════════════════════════════════════════════════════════════════════
function Schedule({ snap, session }) {
  const me = session?.profile || { id: 'u_coach', role: 'coach' };
  const upcoming = window.HZsel.upcomingSessions(12);
  const canEdit = me.role === 'coach' || me.role === 'owner';
  const [adding, setAdding] = _useState(false);
  const [editingId, setEditingId] = _useState(null);
  const [busy, setBusy] = _useState(false);
  const team = (snap.teams || [])[0] || null;

  async function addSession(values) {
    if (!team?.id) { alert('No team loaded.'); return; }
    setBusy(true);
    try {
      const { error } = await window.HZdb.from('sessions').insert({
        team_id: team.id,
        scheduled_at: values.scheduled_at,
        duration_min: values.duration_min,
        type: values.type,
        location: values.location || null,
        is_competition: values.is_competition,
        notes: values.notes || null,
      });
      if (error) { console.error('[sessions] insert', error); alert('Could not save: ' + error.message); return; }
      setAdding(false);
    } finally { setBusy(false); }
  }

  async function patchSession(id, patch) {
    setBusy(true);
    try {
      const { error } = await window.HZdb.from('sessions').update(patch).eq('id', id);
      if (error) { console.error('[sessions] update', error); alert('Could not save: ' + error.message); return false; }
      return true;
    } finally { setBusy(false); }
  }

  async function removeSession(id) {
    if (!confirm('Cancel this session? This removes it from everyone\'s schedule.')) return;
    setBusy(true);
    try {
      const { error } = await window.HZdb.from('sessions').delete().eq('id', id);
      if (error) { console.error('[sessions] delete', error); alert('Could not remove: ' + error.message); }
    } finally { setBusy(false); }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div className="hz-eyebrow" style={{ marginBottom: 6 }}>Schedule · next 30 days</div>
          <div className="hz-display" style={{ fontSize: 48, lineHeight: 1 }}>
            What's <span className="hz-zero">next</span>.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {canEdit && (
            <button onClick={() => { setAdding(a => !a); setEditingId(null); }} className="hz-btn hz-btn-primary hz-btn-sm">
              {adding ? 'Cancel' : '+ Add session'}
            </button>
          )}
          <CalendarSubscribeButton me={me}/>
        </div>
      </div>

      {adding && <SessionForm onSave={addSession} onCancel={() => setAdding(false)} disabled={busy}/>}

      <div style={{ display: 'grid', gap: 14 }}>
        {upcoming.length === 0 && !adding && (
          <div className="hz-card" style={{ padding: 40, color: 'var(--hz-dim)', textAlign: 'center' }}>
            Nothing on the books. {canEdit ? 'Click "+ Add session" above to put a practice or competition on the calendar.' : 'Check back later.'}
          </div>
        )}
        {upcoming.map(s => editingId === s.id
          ? <SessionForm key={s.id} session={s}
              onSave={async (vals) => { const ok = await patchSession(s.id, vals); if (ok) setEditingId(null); }}
              onCancel={() => setEditingId(null)}
              onRemove={() => removeSession(s.id).then(() => setEditingId(null))}
              disabled={busy}/>
          : <SessionRow key={s.id} session={s} me={me} canEdit={canEdit} onEdit={() => setEditingId(s.id)}/> )}
      </div>
    </div>
  );
}

function SessionForm({ session: existing, onSave, onCancel, onRemove, disabled }) {
  // datetime-local needs a value like "2026-04-29T18:00"
  const initialIso = existing?.scheduled_at ? new Date(existing.scheduled_at) : new Date(Date.now() + 24*3600*1000);
  const pad = (n) => String(n).padStart(2, '0');
  const formatLocal = (d) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

  const [scheduledAt, setScheduledAt] = _useState(formatLocal(initialIso));
  const [type, setType] = _useState(existing?.type || 'practice');
  const [duration, setDuration] = _useState(existing?.duration_min || 90);
  const [location, setLocation] = _useState(existing?.location || '');
  const [isCompetition, setIsCompetition] = _useState(!!existing?.is_competition);
  const [notes, setNotes] = _useState(existing?.notes || '');

  const submit = (e) => {
    e?.preventDefault?.();
    onSave({
      scheduled_at: new Date(scheduledAt).toISOString(),
      type,
      duration_min: parseInt(duration, 10) || 60,
      location: location.trim() || null,
      is_competition: isCompetition,
      notes: notes.trim() || null,
    });
  };

  return (
    <form onSubmit={submit} className="hz-card" style={{ padding: 18, marginBottom: 14, display: 'grid', gap: 10 }}>
      <div className="hz-eyebrow" style={{ fontSize: 10 }}>{existing ? 'Edit session' : 'New session'}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 0.7fr 1.4fr', gap: 10 }}>
        <FieldRow label="When">
          <input type="datetime-local" className="hz-input" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} disabled={disabled} required/>
        </FieldRow>
        <FieldRow label="Type">
          <select className="hz-input" value={type} onChange={e => setType(e.target.value)} disabled={disabled}>
            <option value="practice">Practice</option>
            <option value="tumbling">Tumbling</option>
            <option value="stunting">Stunting</option>
            <option value="conditioning">Conditioning</option>
            <option value="choreo">Choreo</option>
            <option value="competition">Competition</option>
            <option value="open_gym">Open Gym</option>
            <option value="meeting">Meeting</option>
          </select>
        </FieldRow>
        <FieldRow label="Min">
          <input type="number" className="hz-input" value={duration} onChange={e => setDuration(e.target.value)} disabled={disabled} min="15" max="480" step="15"/>
        </FieldRow>
        <FieldRow label="Location">
          <input className="hz-input" value={location} onChange={e => setLocation(e.target.value)} disabled={disabled} placeholder="Main floor"/>
        </FieldRow>
      </div>
      <FieldRow label="Notes (optional)">
        <textarea className="hz-input" rows={2} value={notes} onChange={e => setNotes(e.target.value)} disabled={disabled} placeholder="Bring poms, light makeup, etc."/>
      </FieldRow>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingTop: 4 }}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
          <input type="checkbox" checked={isCompetition} onChange={e => setIsCompetition(e.target.checked)} disabled={disabled}/>
          This is a competition
        </label>
        <div style={{ flex: 1 }}/>
        {existing && onRemove && (
          <button type="button" className="hz-btn hz-btn-danger hz-btn-sm" onClick={onRemove} disabled={disabled}>Cancel session</button>
        )}
        <button type="button" className="hz-btn hz-btn-ghost hz-btn-sm" onClick={onCancel} disabled={disabled}>Close</button>
        <button type="submit" className="hz-btn hz-btn-primary hz-btn-sm" disabled={disabled}>{existing ? 'Save' : 'Add to calendar'}</button>
      </div>
    </form>
  );
}

// Tiny field wrapper used by SessionForm + others (mirrors OtherScreens.jsx FieldRow)
function FieldRow({ label, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span className="hz-eyebrow" style={{ fontSize: 10 }}>{label}</span>
      {children}
    </label>
  );
}
function SessionRow({ session: s, me, canEdit, onEdit }) {
  const { day, time } = formatSessionTime(s.scheduled_at);
  const rsvp = window.HZsel.sessionRsvp(s.id);
  const volRows = window.HZsel.volunteerRolesAndAssignments(s.id);
  const openVols = volRows.filter(r => r.assignments.every(a => a.status !== 'claimed')).length;

  return (
    <div className="hz-card" style={{ padding: 22 }}>
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        <div style={{ width: 92 }}>
          <div className="hz-eyebrow">{day.split(',')[0]}</div>
          <div style={{ fontFamily: 'var(--hz-serif)', fontSize: 32, fontStyle: 'italic', fontWeight: 700, lineHeight: 1 }}>
            {day.split(' ').slice(1).join(' ')}
          </div>
          <div style={{ color: 'var(--hz-dim)', fontSize: 13, marginTop: 4 }}>{time}</div>
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 17 }}>
            {s.is_competition && <span style={{ marginRight: 8 }}>🏆</span>}
            {cleanSessionType(s.type)}
          </div>
          <div style={{ color: 'var(--hz-dim)', fontSize: 13, marginTop: 4 }}>
            {s.duration_min}min{s.location ? ' · ' + s.location : ''}
          </div>
          <div style={{ display: 'flex', gap: 14, marginTop: 14, flexWrap: 'wrap' }}>
            <RsvpChip label="Going" value={rsvp.going} color="var(--hz-teal)"/>
            <RsvpChip label="Maybe" value={rsvp.maybe} color="var(--hz-amber)"/>
            <RsvpChip label="No"    value={rsvp.no}    color="var(--hz-red)"/>
            <RsvpChip label="No response" value={rsvp.unknown} color="var(--hz-dimmer)"/>
            {s.is_competition && openVols > 0 && (
              <div style={{ background: 'rgba(249,127,172,0.14)', border: '1px solid rgba(249,127,172,0.3)', color: 'var(--hz-pink)', borderRadius: 999, padding: '4px 12px', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                {openVols} volunteer role{openVols > 1 ? 's' : ''} open
              </div>
            )}
          </div>
        </div>

        {/* Personal RSVP for athletes/parents; edit button for staff */}
        {me.role !== 'coach' && me.role !== 'owner' && <PersonalRsvp session={s} me={me}/> }
        {canEdit && onEdit && (
          <button className="hz-btn hz-btn-ghost hz-btn-sm" onClick={onEdit} style={{ padding: '6px 12px', fontSize: 11 }}>Edit</button>
        )}
      </div>
    </div>
  );
}
function RsvpChip({ label, value, color }) {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, fontWeight: 700, color: 'var(--hz-dim)' }}>
      <span style={{ width: 8, height: 8, borderRadius: 4, background: color }}/>
      {value} <span style={{ fontWeight: 500, color: 'var(--hz-dimmer)', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 10 }}>{label}</span>
    </div>
  );
}
function PersonalRsvp({ session, me }) {
  const snap = window.HZsel.cache();
  const myAthleteId = (snap.athletes || []).find(a => a.profile_id === me.id)?.id
    || (snap.parent_links || []).find(l => l.parent_id === me.id)?.athlete_id
    || (snap.athletes || [])[0]?.id;
  const row = (snap.session_availability || []).find(r => r.session_id === session.id && r.athlete_id === myAthleteId);
  const [optimistic, setOptimistic] = _useState(null);
  const [saving, setSaving] = _useState(null);
  const [error, setError] = _useState('');
  const curr = optimistic || row?.status || 'unknown';

  async function set(status) {
    if (!myAthleteId || saving) return;
    const previous = curr;
    const payload = {
      session_id: session.id,
      athlete_id: myAthleteId,
      status,
      responder_id: me.id,
      updated_at: new Date().toISOString(),
    };
    setError('');
    setSaving(status);
    setOptimistic(status);
    try {
      // Remote writes only run when the current row IDs are real Supabase UUIDs.
      // Seed/prototype rows still update locally instead of throwing UUID errors.
      if (liveMode() && isUuid(session.id) && isUuid(myAthleteId)) {
        const { error: liveError } = await window.HZsupa
          .from('session_availability')
          .upsert(payload, { onConflict: 'session_id,athlete_id' });
        if (liveError) throw liveError;
      }
      const { error: localError } = await window.HZdb
        .from('session_availability')
        .upsert(payload, { onConflict: 'session_id,athlete_id' });
      if (localError) throw localError;
      await refreshAppData('session_availability', 'rsvp');
      notify('RSVP updated', `Marked ${status}.`);
    } catch (err) {
      setOptimistic(previous === 'unknown' ? null : previous);
      setError(err?.message || 'RSVP did not save. Try again.');
    } finally {
      setSaving(null);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 6 }}>
        {['going','maybe','no'].map(k => (
          <button key={k} onClick={() => set(k)}
            disabled={!!saving}
            className="hz-nosel"
            style={{
              padding: '8px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: saving ? 'wait' : 'pointer',
              border: '1px solid ' + (curr === k ? 'transparent' : 'var(--hz-line)'),
              background: curr === k ? (k === 'going' ? 'var(--hz-teal)' : k === 'maybe' ? 'var(--hz-amber)' : 'var(--hz-red)') : 'transparent',
              color: curr === k ? '#050507' : '#fff', textTransform: 'capitalize', letterSpacing: '0.04em',
              opacity: saving && saving !== k ? 0.5 : 1,
            }}>
            {saving === k ? 'Saving...' : k}
          </button>
        ))}
      </div>
      {error && <div style={{ color: 'var(--hz-red)', fontSize: 11, marginTop: 8, maxWidth: 260 }}>{error}</div>}
    </div>
  );
}
function CalendarSubscribeButton({ me }) {
  const [busy, setBusy] = _useState(false);
  const [error, setError] = _useState('');

  async function ensureToken() {
    const cache = window.HZsel.cache();
    const existing = (cache.calendar_tokens || []).find(t => t.profile_id === me.id && !t.revoked_at);
    if (existing?.token && !String(existing.token).startsWith('demo-')) return existing.token;
    if (!liveMode() || !isUuid(me.id)) return existing?.token || null;
    const { data: liveExisting, error: readError } = await window.HZsupa
      .from('calendar_tokens')
      .select('*')
      .eq('profile_id', me.id)
      .is('revoked_at', null)
      .limit(1);
    if (readError) throw readError;
    if (liveExisting?.[0]?.token) return liveExisting[0].token;
    const token = `hz_${crypto.randomUUID().replaceAll('-', '')}`;
    const team = (cache.teams || [])[0];
    const row = {
      profile_id: me.id,
      team_id: me.role === 'coach' || me.role === 'owner' ? null : team?.id || null,
      token,
      label: 'Hit Zero schedule',
    };
    const { data, error: insertError } = await window.HZsupa
      .from('calendar_tokens')
      .insert(row)
      .select('*')
      .single();
    if (insertError) throw insertError;
    await window.HZdb.from('calendar_tokens').upsert(data || row, { onConflict: 'id' });
    await refreshAppData('calendar_tokens', 'create');
    return token;
  }

  async function subscribe() {
    setBusy(true);
    setError('');
    try {
      const token = await ensureToken();
      if (!token) throw new Error('No calendar token is available for this account yet.');
      const base = window.HZ_FN_BASE || 'https://ldhzkdqznccfgpdvqyfk.supabase.co';
      const httpsUrl = `${base}/functions/v1/calendar-ics?t=${encodeURIComponent(token)}`;
      const webcalUrl = httpsUrl.replace(/^https?:\/\//, 'webcal://');
      try { await navigator.clipboard?.writeText(httpsUrl); } catch {}
      notify('Calendar link ready', 'Copied the subscription link and opening Calendar.');
      window.location.href = webcalUrl;
    } catch (err) {
      setError(err?.message || 'Calendar link could not be created.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
      <button className="hz-btn hz-btn-ghost" onClick={subscribe} disabled={busy}>
        <window.HZIcon name="calendar" size={14}/> {busy ? 'Preparing...' : 'Subscribe in Calendar'}
      </button>
      {error && <div style={{ color: 'var(--hz-red)', fontSize: 11, maxWidth: 280, textAlign: 'right' }}>{error}</div>}
    </div>
  );
}
window.Schedule = Schedule;

// ═══════════════════════════════════════════════════════════════════════════
// Uniforms
// ═══════════════════════════════════════════════════════════════════════════
function Uniforms({ snap, session }) {
  const kits = window.HZsel.uniformsWithItems();
  const orders = snap.uniform_orders || [];
  const [tab, setTab] = _useState('catalog');

  return (
    <div>
      <div className="hz-eyebrow">Uniforms</div>
      <div className="hz-display" style={{ fontSize: 48, lineHeight: 1, marginBottom: 20 }}>
        Cut, fit, <span className="hz-zero">sized</span>.
      </div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 18 }}>
        {[['catalog','Catalog'],['orders','Orders'],['sizes','Fit sheet']].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className="hz-nosel"
            style={{
              padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              border: '1px solid ' + (tab === id ? 'transparent' : 'var(--hz-line)'),
              background: tab === id ? '#fff' : 'transparent',
              color: tab === id ? '#050507' : '#fff',
              letterSpacing: '0.06em', textTransform: 'uppercase',
            }}>{label}</button>
        ))}
      </div>

      {tab === 'catalog' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
          {kits.map(k => {
            const total = k.items.reduce((s, i) => s + Number(i.price || 0), 0);
            return (
              <div key={k.id} className="hz-card" style={{ padding: 22 }}>
                <div className="hz-eyebrow">{k.vendor} · {k.season}</div>
                <div className="hz-display" style={{ fontSize: 24, marginTop: 4 }}>{k.name}</div>
                <div style={{ marginTop: 14, display: 'grid', gap: 6 }}>
                  {k.items.map(i => (
                    <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '6px 0', borderBottom: '1px dashed var(--hz-line)' }}>
                      <span style={{ textTransform: 'capitalize' }}>{i.item_type}{!i.required && <span style={{ color: 'var(--hz-dim)', marginLeft: 6 }}>(opt)</span>}</span>
                      <span style={{ fontWeight: 600 }}>{moneyFmt(i.price)}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontSize: 14 }}>
                  <span className="hz-eyebrow">Total</span>
                  <span style={{ fontFamily: 'var(--hz-serif)', fontStyle: 'italic', fontWeight: 700, fontSize: 22 }}>{moneyFmt(total)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'orders' && (
        <div className="hz-card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ color: 'var(--hz-dim)', fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 700 }}>
                {['Athlete','Top','Skirt','Shoes','Status','Ordered','Delivered'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '14px 16px', borderBottom: '1px solid var(--hz-line)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map(o => {
                const a = (snap.athletes || []).find(x => x.id === o.athlete_id);
                return (
                  <tr key={o.id} style={{ borderBottom: '1px solid var(--hz-line)', fontSize: 13 }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>{a?.display_name}</td>
                    <td style={{ padding: '12px 16px' }}>{o.fit_data?.top || '—'}</td>
                    <td style={{ padding: '12px 16px' }}>{o.fit_data?.skirt || '—'}</td>
                    <td style={{ padding: '12px 16px' }}>{o.fit_data?.shoes || '—'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <StatusPill status={o.status}/>
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--hz-dim)' }}>{o.ordered_at ? new Date(o.ordered_at).toLocaleDateString() : '—'}</td>
                    <td style={{ padding: '12px 16px', color: 'var(--hz-dim)' }}>{o.delivered_at ? new Date(o.delivered_at).toLocaleDateString() : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'sizes' && (
        <div className="hz-card" style={{ padding: 22, color: 'var(--hz-dim)' }}>
          Fit sheet editor — full rebuild after the data structure lands. Today the fit info lives per-order under the Orders tab.
        </div>
      )}
    </div>
  );
}
function StatusPill({ status }) {
  const palette = {
    pending:   ['var(--hz-dim)',  'rgba(255,255,255,0.08)'],
    ordered:   ['var(--hz-teal)', 'rgba(39,207,215,0.14)'],
    shipped:   ['var(--hz-pink)', 'rgba(249,127,172,0.14)'],
    delivered: ['var(--hz-green)','rgba(63,231,160,0.16)'],
    returned:  ['var(--hz-red)',  'rgba(255,94,108,0.16)'],
  };
  const [fg, bg] = palette[status] || palette.pending;
  return <span style={{ color: fg, background: bg, padding: '4px 10px', borderRadius: 999, fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{status}</span>;
}
window.Uniforms = Uniforms;

// ═══════════════════════════════════════════════════════════════════════════
// Leads — CRM pipeline board
// ═══════════════════════════════════════════════════════════════════════════
function Leads({ snap, session }) {
  const me = session?.profile || { id: 'u_owner', role: 'owner' };
  const grouped = window.HZsel.leadsByStage();
  const stages = [
    { id: 'new',       label: 'New',        color: 'var(--hz-dim)' },
    { id: 'contacted', label: 'Contacted',  color: 'var(--hz-teal)' },
    { id: 'tour',      label: 'Tour',       color: 'var(--hz-teal)' },
    { id: 'trial',     label: 'Trial',      color: 'var(--hz-amber)' },
    { id: 'converted', label: 'Converted',  color: 'var(--hz-green)' },
    { id: 'lost',      label: 'Lost',       color: 'var(--hz-red)' },
  ];
  const leads = (snap.leads || []).slice().sort((a,b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));
  const staff = (snap.profiles || []).filter(p => p.role === 'owner' || p.role === 'coach');
  const total = (snap.leads || []).length;
  const converted = grouped.converted?.length || 0;
  const [activeId, setActiveId] = _useState(leads[0]?.id || null);
  const [touchKind, setTouchKind] = _useState('note');
  const [touchBody, setTouchBody] = _useState('');
  const active = leads.find(l => l.id === activeId) || leads[0] || null;
  const touches = active ? window.HZsel.leadTouches(active.id) : [];

  function setStage(lead, next) {
    window.HZdb.from('leads').update({
      stage: next,
      updated_at: new Date().toISOString(),
      ...(next === 'converted' ? { converted_at: new Date().toISOString() } : {}),
    }).eq('id', lead.id);
  }

  function advance(lead) {
    const order = stages.map(s => s.id);
    const next = order[Math.min(order.length - 1, order.indexOf(lead.stage) + 1)];
    setStage(lead, next);
  }

  function assign(leadId, profileId) {
    window.HZdb.from('leads').update({
      assigned_to: profileId || null,
      updated_at: new Date().toISOString(),
    }).eq('id', leadId);
  }

  function addTouch() {
    if (!active || !touchBody.trim()) return;
    window.HZdb.from('lead_touches').insert({
      id: 'lt_' + Math.random().toString(36).slice(2, 10),
      lead_id: active.id,
      kind: touchKind,
      body: touchBody.trim(),
      author_id: me.id,
      created_at: new Date().toISOString(),
    });
    setTouchBody('');
    setTouchKind('note');
  }

  return (
    <div>
      <div className="hz-eyebrow">Leads · Gym pipeline</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 20 }}>
        <div className="hz-display" style={{ fontSize: 48, lineHeight: 1 }}>
          {total} families <span className="hz-zero">in motion</span>.
        </div>
        <div style={{ fontSize: 13, color: 'var(--hz-dim)' }}>
          <span style={{ color: 'var(--hz-green)', fontWeight: 700 }}>{converted}</span> converted · win rate{' '}
          <span style={{ color: '#fff', fontWeight: 700 }}>{total ? Math.round(100*converted/total) : 0}%</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.45fr 0.9fr', gap: 16, alignItems: 'start' }}>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${stages.length}, minmax(200px, 1fr))`, gap: 12, overflowX: 'auto' }}>
          {stages.map(st => (
            <div key={st.id} className="hz-card" style={{ padding: 14, minWidth: 220 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div className="hz-eyebrow" style={{ color: st.color }}>{st.label}</div>
                <div style={{ color: 'var(--hz-dim)', fontSize: 11, fontWeight: 700 }}>{grouped[st.id]?.length || 0}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(grouped[st.id] || []).map(l => {
                  const assignee = staff.find(p => p.id === l.assigned_to);
                  return (
                    <button key={l.id} onClick={() => setActiveId(l.id)}
                      className="hz-nosel"
                      style={{
                        padding: 10, borderRadius: 10, background: active?.id === l.id ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
                        border: '1px solid ' + (active?.id === l.id ? 'var(--hz-line-2)' : 'var(--hz-line)'),
                        textAlign: 'left', color: '#fff', cursor: 'pointer',
                      }}>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{l.athlete_name || l.parent_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--hz-dim)', marginTop: 2 }}>
                        {l.parent_name} · age {l.athlete_age || '—'}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--hz-dimmer)', marginTop: 4, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 700 }}>
                        {l.interest} · {l.source}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                        <div style={{ fontSize: 10, color: 'var(--hz-dim)' }}>{assignee?.display_name || 'Unassigned'}</div>
                        {st.id !== 'converted' && st.id !== 'lost' && (
                          <span onClick={(e) => { e.stopPropagation(); advance(l); }}
                            style={{
                              background: 'transparent', color: 'var(--hz-teal)',
                              border: '1px solid rgba(39,207,215,0.3)', borderRadius: 8,
                              padding: '4px 10px', fontSize: 11, fontWeight: 700,
                              letterSpacing: '0.04em', textTransform: 'uppercase',
                            }}>Advance</span>
                        )}
                      </div>
                    </button>
                  );
                })}
                {(grouped[st.id] || []).length === 0 && (
                  <div style={{ fontSize: 11, color: 'var(--hz-dimmer)', textAlign: 'center', padding: '12px 0' }}>Empty</div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="hz-card" style={{ padding: 18, position: 'sticky', top: 88 }}>
          {!active && <div style={{ color: 'var(--hz-dim)', fontSize: 13 }}>Select a family to see the pipeline details.</div>}
          {active && (
            <>
              <div className="hz-eyebrow" style={{ marginBottom: 6 }}>Lead detail</div>
              <div className="hz-display" style={{ fontSize: 26 }}>{active.athlete_name || active.parent_name}</div>
              <div style={{ marginTop: 12, display: 'grid', gap: 10, fontSize: 12.5 }}>
                <DetailRow label="Parent" value={active.parent_name}/>
                <DetailRow label="Email" value={active.parent_email || '—'}/>
                <DetailRow label="Phone" value={active.parent_phone || '—'}/>
                <DetailRow label="Interest" value={active.interest || '—'}/>
                <DetailRow label="Source" value={active.source || '—'}/>
              </div>

              <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
                <label>
                  <div className="hz-eyebrow" style={{ marginBottom: 6 }}>Stage</div>
                  <select value={active.stage} onChange={(e) => setStage(active, e.target.value)}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--hz-line)', borderRadius: 10, padding: '12px 14px', color: '#fff', fontSize: 14, fontFamily: 'var(--hz-sans)' }}>
                    {stages.map(st => <option key={st.id} value={st.id}>{st.label}</option>)}
                  </select>
                </label>

                <label>
                  <div className="hz-eyebrow" style={{ marginBottom: 6 }}>Owner / coach</div>
                  <select value={active.assigned_to || ''} onChange={(e) => assign(active.id, e.target.value)}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--hz-line)', borderRadius: 10, padding: '12px 14px', color: '#fff', fontSize: 14, fontFamily: 'var(--hz-sans)' }}>
                    <option value="">Unassigned</option>
                    {staff.map(p => <option key={p.id} value={p.id}>{p.display_name}</option>)}
                  </select>
                </label>
              </div>

              <div style={{ marginTop: 18 }}>
                <div className="hz-eyebrow" style={{ marginBottom: 8 }}>Touch log</div>
                <div style={{ display: 'grid', gap: 8, maxHeight: 200, overflow: 'auto', marginBottom: 10 }}>
                  {touches.map(t => {
                    const author = staff.find(p => p.id === t.author_id);
                    return (
                      <div key={t.id} style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--hz-line)', background: 'rgba(255,255,255,0.03)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                          <div style={{ fontSize: 10, color: 'var(--hz-teal)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800 }}>{t.kind}</div>
                          <div style={{ fontSize: 10, color: 'var(--hz-dim)' }}>{timeAgo(t.created_at)}</div>
                        </div>
                        <div style={{ fontSize: 12.5, marginTop: 6, lineHeight: 1.45 }}>{t.body}</div>
                        <div style={{ fontSize: 10, color: 'var(--hz-dim)', marginTop: 6 }}>{author?.display_name || 'Staff'}</div>
                      </div>
                    );
                  })}
                  {!touches.length && <div style={{ color: 'var(--hz-dim)', fontSize: 12.5 }}>No touches logged yet.</div>}
                </div>

                <div style={{ display: 'grid', gap: 8 }}>
                  <select value={touchKind} onChange={(e) => setTouchKind(e.target.value)}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--hz-line)', borderRadius: 10, padding: '10px 12px', color: '#fff', fontSize: 13, fontFamily: 'var(--hz-sans)' }}>
                    {['note','call','email','text','tour','trial','other'].map(k => <option key={k} value={k}>{k}</option>)}
                  </select>
                  <textarea className="hz-input" rows="3" placeholder="What happened? What is the next step?" value={touchBody} onChange={(e) => setTouchBody(e.target.value)}/>
                  <button className="hz-btn hz-btn-primary" onClick={addTouch} disabled={!touchBody.trim()}>Add touch</button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
window.Leads = Leads;

// ═══════════════════════════════════════════════════════════════════════════
// Forms / Evaluations
// ═══════════════════════════════════════════════════════════════════════════
function Forms({ snap, session }) {
  const templates = window.HZsel.formTemplatesActive();
  const [activeId, setActiveId] = _useState(templates[0]?.id || null);
  const active = templates.find(t => t.id === activeId) || templates[0] || null;
  const responses = active ? window.HZsel.formResponsesForTemplate(active.id) : [];
  const fields = active ? (snap.form_fields || []).filter(f => f.template_id === active.id).sort((a,b) => a.position - b.position) : [];

  return (
    <div>
      <div className="hz-eyebrow">Evaluations · Tryouts · Report cards</div>
      <div className="hz-display" style={{ fontSize: 48, lineHeight: 1, marginBottom: 20 }}>
        Build the rubric, <span className="hz-zero">not</span> the stress.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 18 }}>
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {templates.map(t => (
            <button key={t.id} onClick={() => setActiveId(t.id)}
              className="hz-nosel"
              style={{
                textAlign: 'left', padding: 14, borderRadius: 12, cursor: 'pointer',
                background: t.id === active?.id ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)',
                border: '1px solid ' + (t.id === active?.id ? 'var(--hz-line-2)' : 'var(--hz-line)'),
                color: '#fff',
              }}>
              <div className="hz-eyebrow" style={{ color: t.kind === 'tryout' ? 'var(--hz-teal)' : 'var(--hz-pink)' }}>{t.kind.replace('_',' ')}</div>
              <div style={{ fontWeight: 700, fontSize: 14, marginTop: 4 }}>{t.title}</div>
              <div style={{ fontSize: 11, color: 'var(--hz-dim)', marginTop: 4 }}>{t.description}</div>
            </button>
          ))}
        </aside>

        <section className="hz-card" style={{ padding: 22 }}>
          {active && (
            <>
              <div className="hz-eyebrow">{active.kind.replace('_',' ')}</div>
              <div className="hz-display" style={{ fontSize: 24, fontWeight: 600 }}>{active.title}</div>
              <div style={{ marginTop: 16, marginBottom: 22 }}>
                <div className="hz-eyebrow" style={{ marginBottom: 8 }}>Rubric</div>
                <div style={{ display: 'grid', gap: 8 }}>
                  {fields.map(f => (
                    <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--hz-line)' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{f.label}</div>
                        <div style={{ fontSize: 10, color: 'var(--hz-dim)', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 700, marginTop: 3 }}>
                          {f.kind} · weight {f.weight}
                        </div>
                      </div>
                      {f.required && <div style={{ fontSize: 10, color: 'var(--hz-pink)', fontWeight: 800, letterSpacing: '0.06em' }}>REQ</div>}
                    </div>
                  ))}
                </div>
              </div>

              <div className="hz-eyebrow" style={{ marginBottom: 10 }}>Recent responses</div>
              <div style={{ display: 'grid', gap: 8 }}>
                {responses.length === 0 && <div style={{ color: 'var(--hz-dim)', fontSize: 13 }}>No submissions yet.</div>}
                {responses.map(r => {
                  const a = (snap.athletes || []).find(x => x.id === r.subject_athlete_id);
                  return (
                    <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--hz-line)' }}>
                      <div>
                        <div style={{ fontWeight: 600 }}>{a?.display_name || '—'}</div>
                        <div style={{ fontSize: 11, color: 'var(--hz-dim)', marginTop: 2 }}>{timeAgo(r.submitted_at)}</div>
                      </div>
                      <div style={{ fontFamily: 'var(--hz-serif)', fontStyle: 'italic', fontWeight: 700, fontSize: 22 }}>
                        {r.score_total}<span style={{ color: 'var(--hz-dim)', fontSize: 13 }}>/100</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
window.Forms = Forms;

// ═══════════════════════════════════════════════════════════════════════════
// Volunteers (by competition session)
// ═══════════════════════════════════════════════════════════════════════════
function Volunteers({ snap, session }) {
  const me = session?.profile || { id: 'u_parent', role: 'parent' };
  const comps = (snap.sessions || []).filter(s => s.is_competition);
  const [activeId, setActiveId] = _useState(comps[0]?.id || null);
  const [busyId, setBusyId] = _useState(null);
  const [error, setError] = _useState('');
  const active = comps.find(s => s.id === activeId) || comps[0] || null;

  async function updateAssignment(assignmentId, patch, action) {
    if (busyId) return;
    setError('');
    setBusyId(assignmentId);
    try {
      if (liveMode() && isUuid(assignmentId)) {
        const { error: liveError } = await window.HZsupa
          .from('volunteer_assignments')
          .update(patch)
          .eq('id', assignmentId);
        if (liveError) throw liveError;
      }
      const { error: localError } = await window.HZdb
        .from('volunteer_assignments')
        .update(patch)
        .eq('id', assignmentId);
      if (localError) throw localError;
      await refreshAppData('volunteer_assignments', action);
      notify(action === 'claim' ? 'Volunteer role claimed' : 'Volunteer role released', action === 'claim' ? 'Thanks for grabbing it.' : 'That role is open again.');
    } catch (err) {
      setError(err?.message || 'Volunteer role did not save. Try again.');
    } finally {
      setBusyId(null);
    }
  }
  function claim(assignmentId) {
    updateAssignment(assignmentId, {
      profile_id: me.id, status: 'claimed', claimed_at: new Date().toISOString()
    }, 'claim');
  }
  function unclaim(assignmentId) {
    updateAssignment(assignmentId, {
      profile_id: null, status: 'open', claimed_at: null
    }, 'release');
  }

  return (
    <div>
      <div className="hz-eyebrow">Volunteers</div>
      <div className="hz-display" style={{ fontSize: 48, lineHeight: 1, marginBottom: 18 }}>
        It takes a <span className="hz-zero">village</span>.
      </div>
      {!active && <div className="hz-card" style={{ padding: 40, color: 'var(--hz-dim)', textAlign: 'center' }}>No competitions on the books.</div>}
      {active && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
            {comps.map(c => (
              <button key={c.id} onClick={() => setActiveId(c.id)}
                className="hz-nosel"
                style={{
                  padding: '8px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  border: '1px solid ' + (c.id === active.id ? 'transparent' : 'var(--hz-line)'),
                  background: c.id === active.id ? '#fff' : 'transparent',
                  color: c.id === active.id ? '#050507' : '#fff',
                }}>
                {cleanSessionType(c.type)} · {new Date(c.scheduled_at).toLocaleDateString()}
              </button>
            ))}
          </div>
          {error && <div style={{ color: 'var(--hz-red)', fontSize: 13, marginBottom: 14 }}>{error}</div>}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
            {window.HZsel.volunteerRolesAndAssignments(active.id).map(({ role, assignments }) => {
              const claimed = assignments.find(a => a.status === 'claimed');
              const open = assignments.find(a => a.status === 'open');
              const claimer = claimed ? (snap.profiles || []).find(p => p.id === claimed.profile_id) : null;
              return (
                <div key={role.id} className="hz-card" style={{ padding: 18 }}>
                  <div className="hz-eyebrow">{claimed ? 'Claimed' : 'Open'}</div>
                  <div style={{ fontWeight: 700, fontSize: 17, marginTop: 4 }}>{role.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--hz-dim)', marginTop: 6 }}>{role.description}</div>
                  <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 13, color: claimed ? 'var(--hz-green)' : 'var(--hz-amber)', fontWeight: 600 }}>
                      {claimed ? `✓ ${claimer?.display_name || 'Claimed'}` : '○ Needs a volunteer'}
                    </div>
                    {!claimed && open && (
                      <button onClick={() => claim(open.id)} disabled={busyId === open.id} className="hz-btn hz-btn-primary">
                        {busyId === open.id ? 'Claiming...' : "I'll do it"}
                      </button>
                    )}
                    {claimed && claimed.profile_id === me.id && (
                      <button onClick={() => unclaim(claimed.id)} disabled={busyId === claimed.id} className="hz-btn hz-btn-ghost">
                        {busyId === claimed.id ? 'Releasing...' : 'Release'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
window.Volunteers = Volunteers;

// ═══════════════════════════════════════════════════════════════════════════
// Practice Plans
// ═══════════════════════════════════════════════════════════════════════════
function PracticePlans({ snap, session }) {
  const plans = window.HZsel.allPracticePlans();
  const [activeId, setActiveId] = _useState(plans[0]?.id || null);
  const active = plans.find(p => p.id === activeId) || plans[0] || null;
  const blocks = active ? (snap.practice_plan_blocks || []).filter(b => b.plan_id === active.id).sort((a,b) => a.position - b.position) : [];
  const totalMin = blocks.reduce((s, b) => s + (b.duration_min || 0), 0);

  return (
    <div>
      <div className="hz-eyebrow">Practice Plans · Drill library</div>
      <div className="hz-display" style={{ fontSize: 48, lineHeight: 1, marginBottom: 20 }}>
        A plan for every <span className="hz-zero">rep</span>.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 18 }}>
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {plans.map(p => (
            <button key={p.id} onClick={() => setActiveId(p.id)}
              className="hz-nosel"
              style={{
                textAlign: 'left', padding: 14, borderRadius: 12, cursor: 'pointer',
                background: p.id === active?.id ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)',
                border: '1px solid ' + (p.id === active?.id ? 'var(--hz-line-2)' : 'var(--hz-line)'),
                color: '#fff',
              }}>
              <div className="hz-eyebrow">Practice plan</div>
              <div style={{ fontWeight: 700, fontSize: 14, marginTop: 4 }}>{p.title}</div>
              <div style={{ fontSize: 11, color: 'var(--hz-dim)', marginTop: 4 }}>{p.focus}</div>
            </button>
          ))}
          {plans.length === 0 && <div style={{ color: 'var(--hz-dim)', fontSize: 13, padding: 14 }}>No plans yet.</div>}
        </aside>

        <section className="hz-card" style={{ padding: 22 }}>
          {active && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <div className="hz-eyebrow">{active.focus}</div>
                  <div className="hz-display" style={{ fontSize: 24, fontWeight: 600 }}>{active.title}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="hz-eyebrow">Total</div>
                  <div style={{ fontFamily: 'var(--hz-serif)', fontStyle: 'italic', fontWeight: 700, fontSize: 28 }}>{totalMin}<span style={{ color: 'var(--hz-dim)', fontSize: 14 }}>min</span></div>
                </div>
              </div>

              <div style={{ marginTop: 18, display: 'grid', gap: 8 }}>
                {blocks.map(b => {
                  const drill = b.drill_id ? (snap.drills || []).find(d => d.id === b.drill_id) : null;
                  return (
                    <div key={b.id} style={{ display: 'flex', gap: 14, padding: '12px 14px', borderRadius: 10, border: '1px solid var(--hz-line)', background: 'rgba(255,255,255,0.03)' }}>
                      <div style={{ width: 68, color: 'var(--hz-teal)', fontWeight: 800, fontSize: 20, fontFamily: 'var(--hz-serif)', fontStyle: 'italic' }}>
                        {b.duration_min}<span style={{ fontSize: 10, color: 'var(--hz-dim)', marginLeft: 2 }}>min</span>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{drill?.name || b.custom_title}</div>
                        <div style={{ fontSize: 11, color: 'var(--hz-dim)', marginTop: 3, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 700 }}>
                          {drill?.category || 'custom'}
                        </div>
                        {(drill?.description || b.notes) && (
                          <div style={{ fontSize: 12, color: 'var(--hz-dim)', marginTop: 6, fontStyle: 'italic' }}>
                            {drill?.description || b.notes}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
window.PracticePlans = PracticePlans;

// ═══════════════════════════════════════════════════════════════════════════
// Registration (public-ish page — accessed via ?p=register, not sidebar)
// ═══════════════════════════════════════════════════════════════════════════
function Registration({ snap, session }) {
  const role = session?.profile?.role || 'parent';
  if (role === 'owner' || role === 'coach') {
    return <RegistrationInbox snap={snap} session={session}/>;
  }

  const windows = (snap.registration_windows || []).filter(w => w.is_public);
  const [form, setForm] = _useState({
    window_id: windows[0]?.id || '',
    athlete_name: '', athlete_dob: '',
    parent_name: '', parent_email: '', parent_phone: '',
    level_interest: 2, source: 'google',
  });
  const [status, setStatus] = _useState('idle');  // idle, submitting, done

  async function submit(e) {
    e.preventDefault();
    setStatus('submitting');
    await window.HZdb.from('registrations').insert({
      ...form, program_id: 'p_mca', status: 'pending', created_at: new Date().toISOString(),
    });
    setStatus('done');
  }

  if (status === 'done') {
    return (
      <div style={{ maxWidth: 520, margin: '80px auto', textAlign: 'center' }}>
        <div className="hz-display" style={{ fontSize: 64 }}>Thank <span className="hz-zero">you</span>.</div>
        <div style={{ color: 'var(--hz-dim)', fontSize: 16, marginTop: 18, lineHeight: 1.5 }}>
          Your registration is in. Coach Brynn or Carlie Wilson will email you within 48 hours with next steps.
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 640, margin: '40px auto' }}>
      <div className="hz-eyebrow">Magic City Allstars · Minot, ND</div>
      <div className="hz-display" style={{ fontSize: 56, lineHeight: 1 }}>
        Ready to <span className="hz-zero">hit zero</span>?
      </div>

      <form onSubmit={submit} style={{ marginTop: 28, display: 'grid', gap: 14 }}>
        <Select label="Registering for" value={form.window_id} onChange={(v) => setForm({...form, window_id: v})}
                options={windows.map(w => ({ value: w.id, label: `${w.title} · ${moneyFmt(w.fee_amount)}` }))} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Input label="Athlete name"     value={form.athlete_name}  onChange={(v) => setForm({...form, athlete_name: v})} required/>
          <Input label="Athlete DOB"       value={form.athlete_dob}   onChange={(v) => setForm({...form, athlete_dob: v})} type="date"/>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Input label="Parent name"       value={form.parent_name}   onChange={(v) => setForm({...form, parent_name: v})} required/>
          <Input label="Parent email"      value={form.parent_email}  onChange={(v) => setForm({...form, parent_email: v})} type="email" required/>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
          <Input label="Parent phone"      value={form.parent_phone}  onChange={(v) => setForm({...form, parent_phone: v})}/>
          <Select label="Level interest"   value={form.level_interest} onChange={(v) => setForm({...form, level_interest: Number(v)})}
                  options={[1,2,3,4,5,6].map(i => ({ value: i, label: 'Level ' + i }))}/>
          <Select label="How'd you hear?"  value={form.source}         onChange={(v) => setForm({...form, source: v})}
                  options={[['google','Google'],['instagram','Instagram'],['facebook','Facebook'],['referral','Referral'],['walk-in','Walk-in']].map(([value,label]) => ({ value, label }))}/>
        </div>
        <div style={{ marginTop: 12 }}>
          <button className="hz-btn hz-btn-primary" type="submit" disabled={status === 'submitting' || !form.athlete_name || !form.parent_name || !form.parent_email}>
            {status === 'submitting' ? 'Submitting…' : 'Submit registration'}
          </button>
        </div>
      </form>
    </div>
  );
}
function RegistrationInbox({ snap, session }) {
  const regs = (snap.registrations || []).slice().sort((a,b) => {
    if (a.status === 'pending' && b.status !== 'pending') return -1;
    if (a.status !== 'pending' && b.status === 'pending') return 1;
    return new Date(b.created_at) - new Date(a.created_at);
  });
  const windows = new Map((snap.registration_windows || []).map(w => [w.id, w]));
  const classes = new Map((snap.program_classes || []).map(c => [c.id, c]));
  const tracks = new Map((snap.program_tracks || []).map(t => [t.id, t]));
  const labelFor = (r) => {
    if (r.class_id && classes.has(r.class_id)) {
      const c = classes.get(r.class_id);
      const trackName = c.track_id && tracks.has(c.track_id) ? tracks.get(c.track_id).name : null;
      return trackName ? `${trackName} · ${c.name}` : c.name;
    }
    if (r.window_id && windows.has(r.window_id)) return windows.get(r.window_id).title;
    return 'Registration';
  };
  const [activeId, setActiveId] = _useState(regs[0]?.id || null);
  const active = regs.find(r => r.id === activeId) || regs[0] || null;
  const [notes, setNotes] = _useState(active?.notes || '');

  _useEffect(() => {
    setNotes(active?.notes || '');
  }, [active?.id]);

  const counts = regs.reduce((out, r) => {
    out[r.status] = (out[r.status] || 0) + 1;
    return out;
  }, { pending: 0, accepted: 0, waitlist: 0, rejected: 0, withdrawn: 0 });

  function decide(nextStatus) {
    if (!active) return;
    window.HZdb.from('registrations').update({
      status: nextStatus,
      notes,
      decided_at: new Date().toISOString(),
      decided_by: session.profile.id,
    }).eq('id', active.id);
  }

  function saveNotes() {
    if (!active) return;
    window.HZdb.from('registrations').update({
      notes,
      updated_at: new Date().toISOString(),
    }).eq('id', active.id);
  }

  return (
    <div>
      <div className="hz-eyebrow">Registration · Admissions desk</div>
      <div className="hz-display" style={{ fontSize: 48, lineHeight: 1, marginBottom: 20 }}>
        New families, <span className="hz-zero">properly handled</span>.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        <MiniStat label="Pending" value={counts.pending} accent="var(--hz-amber)"/>
        <MiniStat label="Accepted" value={counts.accepted} accent="var(--hz-green)"/>
        <MiniStat label="Waitlist" value={counts.waitlist} accent="var(--hz-pink)"/>
        <MiniStat label="Rejected" value={counts.rejected} accent="var(--hz-dim)"/>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 18 }}>
        <aside style={{ display: 'grid', gap: 8 }}>
          {regs.map(r => {
            return (
              <button key={r.id} onClick={() => setActiveId(r.id)}
                className="hz-nosel"
                style={{
                  textAlign: 'left', padding: 14, borderRadius: 12, cursor: 'pointer',
                  background: active?.id === r.id ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)',
                  border: '1px solid ' + (active?.id === r.id ? 'var(--hz-line-2)' : 'var(--hz-line)'),
                  color: '#fff',
                }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <div className="hz-eyebrow">{labelFor(r)}</div>
                  <StatusBadge status={r.status}/>
                </div>
                <div style={{ fontWeight: 700, fontSize: 14, marginTop: 4 }}>{r.athlete_name}</div>
                <div style={{ fontSize: 11, color: 'var(--hz-dim)', marginTop: 4 }}>{r.parent_name} · {r.parent_email}</div>
                <div style={{ fontSize: 10, color: 'var(--hz-dimmer)', marginTop: 6, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 700 }}>
                  Level {r.level_interest || '—'} · {r.source || 'unknown source'} · {timeAgo(r.created_at)}
                </div>
              </button>
            );
          })}
          {!regs.length && <div className="hz-card" style={{ color: 'var(--hz-dim)', fontSize: 13 }}>No registrations on file yet.</div>}
        </aside>

        <section className="hz-card" style={{ padding: 22 }}>
          {!active && <div style={{ color: 'var(--hz-dim)', fontSize: 13 }}>Select a registration to review it.</div>}
          {active && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                <div>
                  <div className="hz-eyebrow">{labelFor(active)}</div>
                  <div className="hz-display" style={{ fontSize: 28 }}>{active.athlete_name}</div>
                </div>
                <StatusBadge status={active.status}/>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 18 }}>
                <DetailCard label="Parent" value={active.parent_name}/>
                <DetailCard label="Email" value={active.parent_email}/>
                <DetailCard label="Phone" value={active.parent_phone || '—'}/>
                <DetailCard label="DOB / level" value={`${active.athlete_dob || '—'} · L${active.level_interest || '—'}`}/>
              </div>

              <div style={{ marginTop: 18, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="hz-btn hz-btn-primary" onClick={() => decide('accepted')}>Accept</button>
                <button className="hz-btn" onClick={() => decide('waitlist')}>Waitlist</button>
                <button className="hz-btn hz-btn-ghost" onClick={() => decide('rejected')}>Reject</button>
              </div>

              <div style={{ marginTop: 18 }}>
                <div className="hz-eyebrow" style={{ marginBottom: 8 }}>Decision notes</div>
                <textarea className="hz-input" rows="6" placeholder="What stood out? Who follows up next? Any placement notes?" value={notes} onChange={(e) => setNotes(e.target.value)}/>
                <div style={{ marginTop: 10 }}>
                  <button className="hz-btn" onClick={saveNotes}>Save notes</button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
function Input({ label, value, onChange, type = 'text', required }) {
  return (
    <label style={{ display: 'block' }}>
      <div className="hz-eyebrow" style={{ marginBottom: 6 }}>{label}{required && ' *'}</div>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} required={required}
        style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--hz-line)', borderRadius: 10, padding: '12px 14px', color: '#fff', fontSize: 14, fontFamily: 'var(--hz-sans)' }}/>
    </label>
  );
}
function Select({ label, value, onChange, options }) {
  return (
    <label style={{ display: 'block' }}>
      <div className="hz-eyebrow" style={{ marginBottom: 6 }}>{label}</div>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--hz-line)', borderRadius: 10, padding: '12px 14px', color: '#fff', fontSize: 14, fontFamily: 'var(--hz-sans)' }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}
function DetailRow({ label, value }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '84px 1fr', gap: 10 }}>
      <div style={{ color: 'var(--hz-dim)', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700 }}>{label}</div>
      <div style={{ fontWeight: 600 }}>{value}</div>
    </div>
  );
}
function DetailCard({ label, value }) {
  return (
    <div style={{ padding: '12px 14px', borderRadius: 12, border: '1px solid var(--hz-line)', background: 'rgba(255,255,255,0.03)' }}>
      <div style={{ color: 'var(--hz-dim)', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700 }}>{label}</div>
      <div style={{ fontWeight: 600, marginTop: 6 }}>{value}</div>
    </div>
  );
}
function StatusBadge({ status }) {
  const palette = {
    pending: ['var(--hz-amber)', 'rgba(255,180,84,0.12)'],
    accepted: ['var(--hz-green)', 'rgba(63,231,160,0.14)'],
    waitlist: ['var(--hz-pink)', 'rgba(249,127,172,0.14)'],
    rejected: ['var(--hz-dim)', 'rgba(255,255,255,0.08)'],
    withdrawn: ['var(--hz-dim)', 'rgba(255,255,255,0.08)'],
  };
  const [fg, bg] = palette[status] || palette.pending;
  return <span style={{ color: fg, background: bg, padding: '4px 10px', borderRadius: 999, fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{status}</span>;
}
window.Registration = Registration;

// ═══════════════════════════════════════════════════════════════════════════
// Medical — designed as a drop-in content block inside the athlete drawer,
// but also works as a standalone "Medical hub" for the owner role.
// ═══════════════════════════════════════════════════════════════════════════
function MedicalBlock({ athleteId }) {
  const snap = window.HZsel.cache();
  const athlete = (snap.athletes || []).find(a => a.id === athleteId);
  if (!athlete) return null;
  const { record, contacts, injuries } = window.HZsel.athleteMedical(athleteId);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="hz-card" style={{ padding: 18 }}>
        <div className="hz-eyebrow" style={{ marginBottom: 8 }}>Emergency contacts</div>
        {contacts.length === 0 && <div style={{ color: 'var(--hz-dim)', fontSize: 13 }}>None on file.</div>}
        {contacts.map(c => (
          <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px dashed var(--hz-line)' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{c.name}</div>
              <div style={{ color: 'var(--hz-dim)', fontSize: 12, marginTop: 2 }}>{c.relation}</div>
            </div>
            <div style={{ textAlign: 'right', fontSize: 13 }}>
              <a href={`tel:${c.phone}`} style={{ color: 'var(--hz-teal)', textDecoration: 'none' }}>{c.phone}</a>
              <div style={{ color: 'var(--hz-dim)', fontSize: 11, marginTop: 2 }}>{c.email}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="hz-card" style={{ padding: 18 }}>
        <div className="hz-eyebrow" style={{ marginBottom: 8 }}>Medical info</div>
        {!record && <div style={{ color: 'var(--hz-dim)', fontSize: 13 }}>No medical record on file.</div>}
        {record && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 13 }}>
            <KV label="Blood type" v={record.blood_type}/>
            <KV label="Allergies"  v={record.allergies || '—'}/>
            <KV label="Meds"       v={record.medications || '—'}/>
            <KV label="Conditions" v={record.conditions || '—'}/>
            <KV label="Insurance"  v={record.insurance_carrier || '—'}/>
            <KV label="Physician"  v={record.physician_name || '—'}/>
            <KV label="Dr. phone"  v={record.physician_phone || '—'}/>
            <KV label="Last physical" v={record.last_physical || '—'}/>
          </div>
        )}
      </div>

      <div className="hz-card" style={{ padding: 18 }}>
        <div className="hz-eyebrow" style={{ marginBottom: 8 }}>Injury log</div>
        {injuries.length === 0 && <div style={{ color: 'var(--hz-dim)', fontSize: 13 }}>No injuries logged.</div>}
        {injuries.map(inj => (
          <div key={inj.id} style={{ padding: '10px 0', borderBottom: '1px dashed var(--hz-line)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{inj.body_part}</div>
              <div style={{ fontSize: 11, color: 'var(--hz-dim)' }}>{new Date(inj.occurred_at).toLocaleDateString()}</div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--hz-dim)', marginTop: 4 }}>{inj.description}</div>
            {inj.severity && (
              <div style={{ display: 'inline-block', marginTop: 6, padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase',
                background: inj.severity === 'severe' ? 'rgba(255,94,108,0.16)' : inj.severity === 'moderate' ? 'rgba(255,180,84,0.16)' : 'rgba(255,255,255,0.06)',
                color: inj.severity === 'severe' ? 'var(--hz-red)' : inj.severity === 'moderate' ? 'var(--hz-amber)' : 'var(--hz-dim)' }}>
                {inj.severity}{inj.resolved_at ? ' · resolved' : ''}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
function KV({ label, v }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: 'var(--hz-dim)', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700 }}>{label}</div>
      <div style={{ fontWeight: 600, marginTop: 3 }}>{v}</div>
    </div>
  );
}
window.MedicalBlock = MedicalBlock;

// Standalone medical hub (owner role): browse athletes + open their medical
function MedicalHub({ snap }) {
  const [aid, setAid] = _useState((snap.athletes || [])[0]?.id || null);
  const athletes = snap.athletes || [];
  return (
    <div>
      <div className="hz-eyebrow">Medical · Emergency info</div>
      <div className="hz-display" style={{ fontSize: 48, lineHeight: 1, marginBottom: 20 }}>
        Safe, <span className="hz-zero">always</span>.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 18 }}>
        <aside style={{ maxHeight: 'calc(100vh - 240px)', overflow: 'auto' }}>
          {athletes.map(a => (
            <button key={a.id} onClick={() => setAid(a.id)}
              className="hz-nosel"
              style={{
                display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px',
                borderRadius: 10, background: a.id === aid ? 'rgba(255,255,255,0.06)' : 'transparent',
                border: '1px solid transparent', color: '#fff', cursor: 'pointer', marginBottom: 2, fontSize: 13,
              }}>
              {a.display_name}
            </button>
          ))}
        </aside>
        <section>{aid && <MedicalBlock athleteId={aid}/>}</section>
      </div>
    </div>
  );
}
window.MedicalHub = MedicalHub;
