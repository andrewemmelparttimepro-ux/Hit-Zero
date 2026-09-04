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
    .replace(new RegExp('^competition\\s*:\\s*' + 'dre' + 'am on$', 'i'), 'Competition')
    .replace(new RegExp('\\bdre' + 'am on\\b', 'ig'), 'Competition')
    .replace(/\bbismarck,\s*nd\b/ig, '')
    .replace(/\s+·\s+$/g, '')
    .trim();
}
function cleanClassScheduleSummary(value) {
  return String(value || '')
    .replace(/\s+-\s+/g, ' · ')
    .replace(/\bTue\s*&\s*Thu\b/ig, 'Tue/Thu')
    .trim();
}
function isUuid(value) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '')); }
function liveMode() { return Boolean(window.HZsupa && window.HZdb?.auth?._mode?.() === 'live'); }
async function refreshAppData(table, action = 'update') {
  if (window.HZsel?._refresh) await window.HZsel._refresh();
  window.dispatchEvent(new CustomEvent('hz:refresh', { detail: { table, action } }));
}
async function updatePersistedRow(table, id, patch, onConflict = 'id') {
  if (liveMode() && isUuid(id)) {
    const { data, error } = await window.HZsupa.from(table).update(patch).eq('id', id).select('*').single();
    if (error) return { data: null, error };
    await window.HZdb.from(table).upsert(data || { ...patch, id }, { onConflict });
    return { data: data || { ...patch, id }, error: null };
  }
  return await window.HZdb.from(table).update(patch).eq('id', id);
}
async function insertPersistedRow(table, payload, onConflict = 'id') {
  if (liveMode()) {
    const { data, error } = await window.HZsupa.from(table).insert(payload).select('*').single();
    if (error) return { data: null, error };
    await window.HZdb.from(table).upsert(data || payload, { onConflict });
    return { data: data || payload, error: null };
  }
  return await window.HZdb.from(table).insert(payload);
}
async function upsertPersistedRow(table, payload, onConflict = 'id') {
  if (liveMode()) {
    const { data, error } = await window.HZsupa
      .from(table)
      .upsert(payload, { onConflict })
      .select('*')
      .maybeSingle();
    if (error) return { data: null, error };
    await window.HZdb.from(table).upsert(data || payload, { onConflict });
    return { data: data || payload, error: null };
  }
  return await window.HZdb.from(table).upsert(payload, { onConflict });
}
function notify(title, body, variant = 'got_it') {
  if (window.HZToast) window.HZToast({ variant, eyebrow: 'Saved', title, body });
}
function isSettledRegistrationPayment(status) {
  return status === 'paid' || status === 'comped';
}
function medicalEditorCanEdit(session) {
  const role = session?.actualProfile?.role || session?.profile?.role || '';
  return role === 'owner' || role === 'coach';
}
function escapePdfHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}
function exportRowsPdf(title, columns, rows, meta = {}) {
  const generated = new Date().toLocaleString();
  const heading = escapePdfHtml(title || 'Hit Zero export');
  const metaRows = Object.entries(meta)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([label, value]) => `<div><strong>${escapePdfHtml(label)}:</strong> ${escapePdfHtml(value)}</div>`)
    .join('');
  const tableRows = (rows || []).map(row => (
    `<tr>${columns.map(col => `<td>${escapePdfHtml(typeof col.value === 'function' ? col.value(row) : row[col.value])}</td>`).join('')}</tr>`
  )).join('');
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${heading}</title>
  <style>
    body { font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #18181b; margin: 32px; }
    h1 { font-size: 24px; margin: 0 0 6px; }
    .meta { color: #52525b; font-size: 12px; display: grid; gap: 3px; margin: 0 0 18px; }
    table { border-collapse: collapse; width: 100%; font-size: 11px; }
    th { background: #111827; color: #fff; text-align: left; padding: 8px; }
    td { border-bottom: 1px solid #e5e7eb; padding: 7px 8px; vertical-align: top; }
    tr:nth-child(even) td { background: #f9fafb; }
    @media print { body { margin: 18mm; } button { display: none; } }
  </style>
</head>
<body>
  <button onclick="window.print()" style="float:right;padding:8px 12px;border:1px solid #d4d4d8;border-radius:8px;background:#fff">Print / Save PDF</button>
  <h1>${heading}</h1>
  <div class="meta"><div><strong>Generated:</strong> ${escapePdfHtml(generated)}</div>${metaRows}<div><strong>Rows:</strong> ${(rows || []).length}</div></div>
  <table>
    <thead><tr>${columns.map(col => `<th>${escapePdfHtml(col.label)}</th>`).join('')}</tr></thead>
    <tbody>${tableRows || `<tr><td colspan="${columns.length}">No rows.</td></tr>`}</tbody>
  </table>
  <script>setTimeout(() => window.print(), 250);</script>
</body>
</html>`;
  const popup = window.open('', '_blank');
  if (popup) {
    popup.document.open();
    popup.document.write(html);
    popup.document.close();
    return;
  }
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${String(title || 'hit-zero-export').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'hit-zero-export'}.html`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
window.HZexportRowsPdf = exportRowsPdf;

// ═══════════════════════════════════════════════════════════════════════════
// Messages — left rail of threads, right pane of conversation
// ═══════════════════════════════════════════════════════════════════════════
function Messages({ snap, session }) {
  const me = session?.actualProfile || session?.profile || { id: 'u_coach', display_name: 'Coach Brynn', role: 'coach' };
  const isMobile = window.useIsMobile ? window.useIsMobile(768) : false;
  const threads = window.HZsel.inboxThreads(me.id);
  const isStaff = ['coach', 'owner'].includes(me.role || '');
  const canStartStaffThread = ['parent', 'athlete'].includes(me.role || '');
  // Phones start on the thread list; desktop preselects the first thread.
  const [activeId, setActiveId] = _useState(() => (typeof window !== 'undefined' && window.innerWidth <= 768) ? null : (threads[0]?.id || null));
  const [draft, setDraft] = _useState('');
  const [busyThread, setBusyThread] = _useState(false);
  const [err, setErr] = _useState('');
  const [staffThreadKind, setStaffThreadKind] = _useState('team');
  const [staffThreadTitle, setStaffThreadTitle] = _useState('');
  const paneRef = _useRef(null);

  const active = threads.find(t => t.id === activeId) || (isMobile ? null : (threads[0] || null));
  const msgs = active ? window.HZsel.threadMessages(active.id) : [];
  const members = active ? window.HZsel.threadMembers(active.id) : [];

  // Mark as read when a thread becomes active
  _useEffect(() => {
    if (!active) return;
    const row = { thread_id: active.id, profile_id: me.id, last_read_at: new Date().toISOString() };
    (async () => {
      if (liveMode() && window.HZsupa) {
        const { data, error } = await window.HZsupa
          .from('message_reads')
          .upsert(row, { onConflict: 'thread_id,profile_id' })
          .select('*')
          .maybeSingle();
        if (!error && data) await window.HZdb.from('message_reads').upsert(data, { onConflict: 'thread_id,profile_id' });
        if (!error) await refreshAppData('message_reads', 'upsert');
        return;
      }
      await window.HZdb.from('message_reads').upsert(row, { onConflict: 'thread_id,profile_id' });
      await refreshAppData('message_reads', 'upsert');
    })();
  }, [active?.id]);

  // Auto-scroll to bottom on new messages
  _useEffect(() => {
    if (paneRef.current) paneRef.current.scrollTop = paneRef.current.scrollHeight;
  }, [msgs.length, activeId]);

  async function send() {
    if (!draft.trim() || !active) return;
    setErr('');
    const { error } = await insertPersistedRow('messages', {
      thread_id: active.id,
      author_id: me.id,
      body: draft.trim(),
      created_at: new Date().toISOString(),
    });
    if (error) {
      setErr(error.message || 'Could not send message.');
      return;
    }
    await refreshAppData('messages', 'insert');
    setDraft('');
  }

  async function startStaffThread() {
    if (!window.HZdb?.auth?.createMessageThread) return;
    setBusyThread(true);
    setErr('');
    try {
      const { data, error } = await window.HZdb.auth.createMessageThread({ kind: 'dm_staff', title: 'Message staff' });
      if (error) throw error;
      if (data?.thread) {
        await window.HZdb.from('message_threads').upsert(data.thread, { onConflict: 'id' });
        for (const member of data.members || []) await window.HZdb.from('thread_members').upsert(member, { onConflict: 'thread_id,profile_id' });
        for (const profile of data.profiles || []) await window.HZdb.from('profiles').upsert(profile, { onConflict: 'id' });
        setActiveId(data.thread.id);
      }
      await refreshAppData('message_threads', 'insert');
    } catch (e) {
      setErr(e.message || 'Could not start a staff message.');
    } finally {
      setBusyThread(false);
    }
  }

  async function startStaffGroupThread() {
    if (!isStaff || !window.HZdb?.auth?.createMessageThread) return;
    setBusyThread(true);
    setErr('');
    try {
      const teams = window.HZsel.programTeams?.() || snap.teams || [];
      const team = teams.find(Boolean) || null;
      const teamAthleteIds = new Set((snap.athletes || []).filter(a => !team?.id || a.team_id === team.id).map(a => a.id));
      const linkedParentIds = new Set((snap.parent_links || []).filter(link => teamAthleteIds.has(link.athlete_id)).map(link => link.parent_id));
      const staffIds = (snap.profiles || []).filter(p => p.program_id === me.program_id && ['owner', 'coach'].includes(p.role)).map(p => p.id);
      const parentIds = (snap.profiles || []).filter(p => linkedParentIds.has(p.id)).map(p => p.id);
      const memberIds = staffThreadKind === 'coaches'
        ? staffIds
        : [...staffIds, ...parentIds];
      const fallbackTitle = staffThreadKind === 'coaches'
        ? 'Coach staff'
        : staffThreadKind === 'parents'
          ? `${team?.name || 'Team'} parents`
          : `${team?.name || 'Team'} team`;
      const { data, error } = await window.HZdb.auth.createMessageThread({
        kind: staffThreadKind,
        title: staffThreadTitle.trim() || fallbackTitle,
        team_id: team?.id || null,
        member_ids: [...new Set(memberIds)].filter(Boolean),
      });
      if (error) throw error;
      if (data?.thread) {
        await window.HZdb.from('message_threads').upsert(data.thread, { onConflict: 'id' });
        for (const member of data.members || []) await window.HZdb.from('thread_members').upsert(member, { onConflict: 'thread_id,profile_id' });
        for (const profile of data.profiles || []) await window.HZdb.from('profiles').upsert(profile, { onConflict: 'id' });
        setActiveId(data.thread.id);
        setStaffThreadTitle('');
      }
      await refreshAppData('message_threads', 'insert');
    } catch (e) {
      setErr(e.message || 'Could not start a group thread.');
    } finally {
      setBusyThread(false);
    }
  }

  const threadButtons = (
    <>
      {threads.length === 0 && (
        <div style={{ padding: 24, color: 'var(--hz-dim)', fontSize: 13 }}>
          No conversations yet. Group chats and direct messages from your gym will appear here.
          {canStartStaffThread && (
            <button className="hz-btn hz-btn-primary hz-btn-sm" onClick={startStaffThread} disabled={busyThread} style={{ marginTop: 14 }}>
              {busyThread ? 'Opening...' : 'Message staff'}
            </button>
          )}
        </div>
      )}
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
    </>
  );

  const conversation = active && (
          <>
            <div style={{ padding: '8px 0 14px', borderBottom: '1px solid var(--hz-line)', display: 'flex', alignItems: 'center', gap: 10 }}>
              {isMobile && (
                <button
                  className="hz-btn hz-btn-ghost hz-btn-sm"
                  onClick={() => setActiveId(null)}
                  aria-label="Back to all messages"
                  style={{ flexShrink: 0, paddingLeft: 8, paddingRight: 10 }}
                >
                  <window.HZIcon name="chev-left" size={16}/> Back
                </button>
              )}
              <div style={{ minWidth: 0 }}>
                <div className="hz-display" style={{ fontSize: 22, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {active.title || threadTitle(active, members, me)}
                </div>
                <div className="hz-eyebrow" style={{ marginTop: 4 }}>{members.length} members · {active.kind}</div>
              </div>
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
            {err && <div style={{ color: 'var(--hz-pink)', fontSize: 12, paddingBottom: 8 }}>{err}</div>}
          </>
  );

  // Phone: one pane at a time — list first, conversation with a Back button.
  if (isMobile) {
    return active ? (
      <section style={{ display: 'flex', flexDirection: 'column', height: 'calc(100dvh - var(--hz-mobile-topbar-h, 52px) - var(--hz-tabbar-h, 60px) - 44px)' }}>
        {conversation}
      </section>
    ) : (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', padding: '2px 2px 14px' }}>
          <div className="hz-display" style={{ fontSize: 28 }}>Messages</div>
          {canStartStaffThread && <button className="hz-btn hz-btn-primary hz-btn-sm" onClick={startStaffThread} disabled={busyThread}>{busyThread ? 'Opening...' : 'Staff'}</button>}
        </div>
        {err && <div style={{ color: 'var(--hz-pink)', fontSize: 12, padding: '0 2px 10px' }}>{err}</div>}
        {threadButtons}
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 0, height: 'calc(100vh - 88px)', marginTop: -16, marginRight: -16 }}>
      {/* Threads list */}
      <aside style={{ borderRight: '1px solid var(--hz-line)', overflow: 'auto', paddingRight: 8 }}>
        <div style={{ padding: '8px 10px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
            <div className="hz-display" style={{ fontSize: 24, fontWeight: 600 }}>Messages</div>
            {canStartStaffThread && <button className="hz-btn hz-btn-primary hz-btn-sm" onClick={startStaffThread} disabled={busyThread}>{busyThread ? 'Opening...' : 'Message staff'}</button>}
          </div>
          {isStaff && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 6, marginTop: 10 }}>
              <select className="hz-input" value={staffThreadKind} onChange={e => setStaffThreadKind(e.target.value)} disabled={busyThread} style={{ padding: '8px 10px' }}>
                <option value="team">Team</option>
                <option value="parents">Parents</option>
                <option value="coaches">Coaches</option>
              </select>
              <input className="hz-input" value={staffThreadTitle} onChange={e => setStaffThreadTitle(e.target.value)} disabled={busyThread} placeholder="Thread title" style={{ padding: '8px 10px' }}/>
              <button className="hz-btn hz-btn-primary hz-btn-sm" onClick={startStaffGroupThread} disabled={busyThread}>
                {busyThread ? 'Opening...' : 'New'}
              </button>
            </div>
          )}
          {err && <div style={{ color: 'var(--hz-pink)', fontSize: 12, marginTop: 8 }}>{err}</div>}
        </div>
        {threadButtons}
      </aside>

      {/* Conversation pane */}
      <section style={{ display: 'flex', flexDirection: 'column', height: '100%', paddingLeft: 16 }}>
        {!active && <div style={{ margin: 'auto', color: 'var(--hz-dim)' }}>Pick a thread to start.</div>}
        {conversation}
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
const MCA_GOOGLE_CALENDAR_URL = 'https://calendar.google.com/calendar/u/0/r?cid=c_01a6fc567e345779502548ef14721ff42467c88f5de852c01faee56cd88e6ad3%40group.calendar.google.com';
const MCA_CALENDAR_CACHE_KEY = 'hz_mca_calendar_cache_v1';

function readMcaCalendarCache() {
  try {
    const value = JSON.parse(localStorage.getItem(MCA_CALENDAR_CACHE_KEY) || 'null');
    return value && Array.isArray(value.events) ? value : { events: [], fetchedAt: null };
  } catch {
    return { events: [], fetchedAt: null };
  }
}

function isMagicCityProgram(snap, session) {
  const programs = snap?.programs || [];
  const programId = session?.actualProfile?.program_id || session?.profile?.program_id || null;
  const activeProgram = window.HZactiveProgramFromSnap?.(snap, session) || null;
  const matchedPrograms = programId ? programs.filter(program => program.id === programId) : programs;
  const candidates = [activeProgram, ...matchedPrograms, ...(matchedPrograms.length ? [] : programs.length === 1 ? programs : [])]
    .filter(Boolean);
  return candidates.some(program => /magic city|\bmca\b/i.test([
    program.slug,
    program.name,
    program.public_name,
    program.brand_name,
  ].filter(Boolean).join(' ')));
}

function staffScheduleSessionsFromSnap(snap, limit = 16) {
  const teamIds = new Set((snap.teams || []).map(t => t.id));
  const rows = (snap.sessions || [])
    .filter(s => (s.scheduled !== false) && (!teamIds.size || teamIds.has(s.team_id)))
    .sort((a,b) => new Date(a.scheduled_at || a.date || 0) - new Date(b.scheduled_at || b.date || 0));
  const now = Date.now();
  const future = rows.filter(s => new Date(s.scheduled_at || s.date || 0).getTime() >= now - 86400000);
  return (future.length ? future.slice(0, limit) : rows.reverse().slice(0, Math.min(limit, 8)));
}

function Schedule({ snap, session, pushToast }) {
  const me = session?.profile || session?.actualProfile || { id: 'u_coach', role: 'coach' };
  const scope = window.HZviewerScope ? window.HZviewerScope(snap, session) : null;
  const canEdit = me.role === 'coach' || me.role === 'owner';
  const selectorUpcoming = canEdit
    ? (window.HZsel.staffScheduleSessions?.(16) || [])
    : window.HZsel.upcomingSessions(12);
  const allUpcoming = canEdit && selectorUpcoming.length === 0
    ? staffScheduleSessionsFromSnap(snap, 16)
    : selectorUpcoming;
  const upcoming = canEdit || !scope
    ? allUpcoming
    : allUpcoming.filter(s => scope.visibleTeamIds.has(s.team_id));
  const classEnrollments = canEdit
    ? (window.HZsel.classEnrollmentsForProgram?.() || [])
    : me.role === 'parent'
      ? window.HZsel.classEnrollmentsForParent(session)
      : scope?.ownAthleteId
        ? window.HZsel.classEnrollmentsForAthlete(scope.ownAthleteId)
        : [];
  const activeClassEnrollments = classEnrollments.filter(row => !window.HZsel.classEnrollmentIsPast?.(row));
  const familyTeamId = !canEdit && scope?.visibleTeamIds?.size === 1
    ? Array.from(scope.visibleTeamIds)[0]
    : null;
  const canSubscribe = canEdit || !!familyTeamId || activeClassEnrollments.length > 0 || upcoming.length > 0;
  const showMcaCalendar = isMagicCityProgram(snap, session);
  const [familyScheduleView, setFamilyScheduleView] = _useState('mine');
  const [adding, setAdding] = _useState(false);
  const [editingId, setEditingId] = _useState(null);
  const [busy, setBusy] = _useState(false);
  const [mcaCalendar, setMcaCalendar] = _useState(readMcaCalendarCache);
  const [mcaCalendarError, setMcaCalendarError] = _useState('');
  const [mcaCalendarLoading, setMcaCalendarLoading] = _useState(true);
  const [mcaLookAheadDays, setMcaLookAheadDays] = _useState(45);
  const mcaCalendarAbort = _useRef(null);
  const team = (snap.teams || [])[0] || null;
  const notifyError = (title, body) => {
    (pushToast || window.HZToast)?.({ kind: 'error', eyebrow: 'Schedule', title, body });
  };

  async function refreshMcaCalendar(force = false) {
    mcaCalendarAbort.current?.abort?.();
    const controller = new AbortController();
    mcaCalendarAbort.current = controller;
    setMcaCalendarLoading(true);
    if (force) setMcaCalendarError('');
    try {
      const base = window.HZ_FN_BASE || 'https://ldhzkdqznccfgpdvqyfk.supabase.co';
      const suffix = force ? `?refresh=${Date.now()}` : '';
      const headers = window.HZ_ANON_KEY ? { apikey: window.HZ_ANON_KEY } : {};
      const response = await fetch(`${base}/functions/v1/mca-calendar-v1${suffix}`, {
        headers,
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'The live MCA calendar did not load.');
      const nextCalendar = {
        events: Array.isArray(payload.events) ? payload.events : [],
        fetchedAt: payload.fetchedAt || new Date().toISOString(),
        sourceFetchedAt: payload.sourceFetchedAt || payload.fetchedAt || new Date().toISOString(),
        stale: !!payload.stale,
      };
      setMcaCalendar(nextCalendar);
      try { localStorage.setItem(MCA_CALENDAR_CACHE_KEY, JSON.stringify(nextCalendar)); } catch {}
      setMcaCalendarError('');
    } catch (error) {
      if (error?.name !== 'AbortError') setMcaCalendarError(error?.message || 'The live MCA calendar did not load.');
    } finally {
      if (mcaCalendarAbort.current === controller) setMcaCalendarLoading(false);
    }
  }

  _useEffect(() => {
    if (!showMcaCalendar) {
      setMcaCalendarLoading(false);
      return undefined;
    }
    refreshMcaCalendar(false);
    const timer = setInterval(() => refreshMcaCalendar(false), 5 * 60 * 1000);
    return () => {
      clearInterval(timer);
      mcaCalendarAbort.current?.abort?.();
    };
  }, [showMcaCalendar]);

  const mcaNow = Date.now();
  const mcaUpcoming = (mcaCalendar.events || []).filter(event => new Date(event.end || event.start).getTime() >= mcaNow - 86400000);
  const mcaVisibleThrough = mcaNow + mcaLookAheadDays * 86400000;
  const mcaVisible = mcaUpcoming.filter(event => new Date(event.start).getTime() <= mcaVisibleThrough);
  const personalScheduleItems = upcoming.map(item => ({ source: 'hit-zero', start: item.scheduled_at, item }));
  const scheduleItems = [
    ...upcoming.map(item => ({ source: 'hit-zero', start: item.scheduled_at, item })),
    ...(showMcaCalendar ? mcaVisible : []).map(item => ({ source: 'mca-google', start: item.start, item })),
  ].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  const viewingAllSchedule = canEdit || !showMcaCalendar || familyScheduleView === 'all';
  const visibleScheduleItems = viewingAllSchedule ? scheduleItems : personalScheduleItems;

  async function addSession(values) {
    if (!team?.id) {
      notifyError('No team loaded', 'Create a team before adding sessions.');
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await window.HZdb.auth.createScheduleSession({
        team_id: team.id,
        title: values.title || null,
        scheduled_at: values.scheduled_at,
        duration_min: values.duration_min,
        type: values.type,
        location: values.location || null,
        is_competition: values.is_competition,
        notes: values.notes || null,
      });
      if (error) {
        console.error('[sessions] insert', error);
        notifyError('Could not save session', error.message);
        return;
      }
      if (data?.session) await window.HZdb.from('sessions').upsert(data.session, { onConflict: 'id' });
      await refreshAppData('sessions', 'insert');
      setAdding(false);
    } finally { setBusy(false); }
  }

  async function patchSession(id, patch) {
    setBusy(true);
    try {
      const { data, error } = await window.HZdb.auth.updateScheduleSession(id, patch);
      if (error) {
        console.error('[sessions] update', error);
        notifyError('Could not save session', error.message);
        return false;
      }
      if (data?.session) await window.HZdb.from('sessions').upsert(data.session, { onConflict: 'id' });
      await refreshAppData('sessions', 'update');
      return true;
    } finally { setBusy(false); }
  }

  async function removeSession(id) {
    if (!confirm('Cancel this session? This removes it from everyone\'s schedule.')) return;
    setBusy(true);
    try {
      const { error } = await window.HZdb.auth.deleteScheduleSession(id);
      if (error) {
        console.error('[sessions] delete', error);
        notifyError('Could not remove session', error.message);
      }
      else await refreshAppData('sessions', 'delete');
    } finally { setBusy(false); }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div className="hz-eyebrow" style={{ marginBottom: 6 }}>{canEdit ? 'Schedule · practice execution' : 'Schedule · next 30 days'}</div>
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
          {canSubscribe && <CalendarSubscribeButton me={me} teamId={familyTeamId}/>}
        </div>
      </div>

      {!canEdit && showMcaCalendar && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          <button
            type="button"
            className={'hz-btn hz-btn-sm' + (familyScheduleView === 'mine' ? ' hz-btn-primary' : '')}
            onClick={() => setFamilyScheduleView('mine')}
          >
            My schedule
          </button>
          <button
            type="button"
            className={'hz-btn hz-btn-sm' + (familyScheduleView === 'all' ? ' hz-btn-primary' : '')}
            onClick={() => setFamilyScheduleView('all')}
          >
            Full gym schedule
          </button>
        </div>
      )}

      {adding && <SessionForm onSave={addSession} onCancel={() => setAdding(false)} disabled={busy}/>}

      {showMcaCalendar && viewingAllSchedule && <div className="hz-card" style={{ padding: 18, marginBottom: 14, borderColor: 'rgba(39,207,215,0.28)', background: 'linear-gradient(135deg, rgba(39,207,215,0.08), rgba(255,255,255,0.025))' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
          <div>
            <div className="hz-eyebrow" style={{ color: 'var(--hz-teal)', marginBottom: 5 }}>Magic City Athletics · live source</div>
            <div style={{ fontSize: 18, fontWeight: 900 }}>The gym's Google Calendar is mirrored here.</div>
            <div style={{ color: 'var(--hz-dim)', fontSize: 12, marginTop: 5, maxWidth: 680, lineHeight: 1.5 }}>
              Practices, classes, open gyms, events, closures, and cancellations refresh automatically. Google Calendar remains the source of truth.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <a className="hz-btn hz-btn-ghost hz-btn-sm" href={MCA_GOOGLE_CALENDAR_URL} target="_blank" rel="noreferrer">Open source</a>
            <button className="hz-btn hz-btn-ghost hz-btn-sm" onClick={() => refreshMcaCalendar(true)} disabled={mcaCalendarLoading}>
              {mcaCalendarLoading ? 'Refreshing...' : 'Refresh now'}
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 12, flexWrap: 'wrap', fontSize: 11, color: 'var(--hz-dim)' }}>
          <span style={{ width: 8, height: 8, borderRadius: 8, background: mcaCalendarError ? 'var(--hz-amber)' : 'var(--hz-teal)', boxShadow: mcaCalendarError ? 'none' : '0 0 12px rgba(39,207,215,.7)' }}/>
          {mcaCalendarError
            ? <span>{mcaCalendarError}{mcaCalendar.events.length ? ' Showing the last successful MCA update.' : ' Hit Zero sessions remain available below.'}</span>
            : mcaCalendar.fetchedAt
              ? <span>{mcaUpcoming.length} upcoming MCA dates · source refreshed {timeAgo(mcaCalendar.sourceFetchedAt || mcaCalendar.fetchedAt)}{mcaCalendar.stale ? ' · cached copy' : ''}</span>
              : <span>Connecting to the MCA calendar...</span>}
        </div>
      </div>}

      <div style={{ display: 'grid', gap: 14 }}>
        {visibleScheduleItems.length === 0 && activeClassEnrollments.length === 0 && !adding && !mcaCalendarLoading && (
          <div className="hz-card" style={{ padding: 40, color: 'var(--hz-dim)', textAlign: 'center' }}>
            Nothing on the books. {canEdit ? 'Click "+ Add session" above to put a team-only practice or competition on the calendar.' : viewingAllSchedule ? 'The MCA calendar will appear here after the live source refresh completes.' : 'Linked team sessions and active class registrations will appear here.'}
          </div>
        )}
        {activeClassEnrollments.length > 0 && (
          <div className="hz-card" style={{ padding: 18, borderColor: 'rgba(39,207,215,0.28)' }}>
            <div className="hz-eyebrow" style={{ color: 'var(--hz-teal)', marginBottom: 12 }}>
              {viewingAllSchedule ? 'Registered classes' : 'My registered classes'}
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              {activeClassEnrollments.map(row => <ClassEnrollmentRow key={row.id} enrollment={row}/>)}
            </div>
          </div>
        )}
        {visibleScheduleItems.map(({ source, item }) => source === 'mca-google'
          ? <McaCalendarRow key={`mca:${item.id}`} event={item}/>
          : editingId === item.id
            ? <SessionForm key={item.id} session={item}
                onSave={async (vals) => { const ok = await patchSession(item.id, vals); if (ok) setEditingId(null); }}
                onCancel={() => setEditingId(null)}
                onRemove={() => removeSession(item.id).then(() => setEditingId(null))}
                disabled={busy}/>
            : <SessionRow key={item.id} session={item} me={me} authSession={session} canEdit={canEdit} snap={snap} onEdit={() => setEditingId(item.id)}/> )}
        {showMcaCalendar && viewingAllSchedule && mcaVisible.length < mcaUpcoming.length && (
          <button className="hz-btn hz-btn-ghost" onClick={() => setMcaLookAheadDays(days => Math.min(days + 45, 540))} style={{ justifySelf: 'center', marginTop: 2 }}>
            Show 45 more days · {mcaUpcoming.length - mcaVisible.length} MCA dates later
          </button>
        )}
      </div>
    </div>
  );
}

function McaCalendarRow({ event }) {
  const start = new Date(event.start);
  const end = new Date(event.end || event.start);
  const dateOptions = event.allDay ? { timeZone: 'UTC' } : {};
  const day = start.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', ...dateOptions });
  const time = event.allDay
    ? 'All day'
    : start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const minutes = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
  const duration = event.allDay
    ? Math.max(1, Math.round(minutes / 1440)) + (minutes > 1440 ? ' days' : ' day')
    : minutes >= 120 && minutes % 60 === 0
      ? `${minutes / 60} hr`
      : `${minutes} min`;
  const title = String(event.title || 'MCA event');
  const kind = /cancel|closed|closure|blocked|no practice/i.test(title)
    ? 'Schedule change'
    : /competition|championship|crown|showcase|spirit|battle/i.test(title)
      ? 'Competition / event'
      : /open gym/i.test(title)
        ? 'Open gym'
        : /practice/i.test(title)
          ? 'Practice'
          : /class|tumbling|cheerabilities|traditional cheer|next level/i.test(title)
            ? 'Class'
            : 'MCA event';

  return (
    <div className="hz-card" style={{ padding: 22, borderColor: 'rgba(39,207,215,0.2)' }}>
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        <div style={{ width: 92, flexShrink: 0 }}>
          <div className="hz-eyebrow">{day.split(',')[0]}</div>
          <div style={{ fontFamily: 'var(--hz-serif)', fontSize: 30, fontStyle: 'italic', fontWeight: 700, lineHeight: 1 }}>
            {day.split(' ').slice(1).join(' ')}
          </div>
          <div style={{ color: 'var(--hz-dim)', fontSize: 13, marginTop: 4 }}>{time}</div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ fontWeight: 800, fontSize: 17 }}>{title}</div>
            <span style={{ padding: '3px 8px', borderRadius: 999, background: 'rgba(39,207,215,0.12)', border: '1px solid rgba(39,207,215,0.28)', color: 'var(--hz-teal)', fontSize: 9, fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase' }}>MCA live</span>
          </div>
          <div style={{ color: 'var(--hz-dim)', fontSize: 12, marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{kind}{event.recurring ? ' · recurring' : ''}</div>
          <div style={{ color: 'var(--hz-dim)', fontSize: 13, marginTop: 5 }}>{duration}{event.location ? ` · ${event.location}` : ''}</div>
          {event.description && <div style={{ color: 'var(--hz-dim)', fontSize: 12, marginTop: 8, lineHeight: 1.5, whiteSpace: 'pre-line' }}>{event.description}</div>}
        </div>
      </div>
    </div>
  );
}

function ClassEnrollmentRow({ enrollment }) {
  const schedule = cleanClassScheduleSummary(enrollment.schedule_summary) || 'Class schedule pending';
  const status = enrollment.staff_status === 'accepted' ? 'Accepted' : 'Pending staff review';
  return (
    <div style={{ display: 'flex', gap: 16, justifyContent: 'space-between', alignItems: 'flex-start', padding: 14, borderRadius: 12, background: 'rgba(255,255,255,0.035)', border: '1px solid var(--hz-line)' }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 15 }}>{enrollment.class_name}</div>
        <div style={{ color: 'var(--hz-dim)', fontSize: 12.5, marginTop: 4 }}>{schedule}</div>
        <div style={{ color: 'var(--hz-dim)', fontSize: 12, marginTop: 4 }}>{enrollment.athlete_name || 'Athlete'}</div>
      </div>
      <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
        <div style={{ color: enrollment.payment_status === 'paid' ? 'var(--hz-green)' : 'var(--hz-amber)', fontWeight: 800, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {enrollment.payment_status === 'paid' ? 'Paid' : enrollment.payment_status}
        </div>
        <div style={{ color: enrollment.staff_status === 'accepted' ? 'var(--hz-green)' : 'var(--hz-amber)', fontSize: 11, marginTop: 4 }}>{status}</div>
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
  const [title, setTitle] = _useState(existing?.title || '');
  const [type, setType] = _useState(existing?.type || 'practice');
  const [duration, setDuration] = _useState(existing?.duration_min || 90);
  const [location, setLocation] = _useState(existing?.location || '');
  const [isCompetition, setIsCompetition] = _useState(!!existing?.is_competition);
  const [notes, setNotes] = _useState(existing?.notes || '');

  const submit = (e) => {
    e?.preventDefault?.();
    onSave({
      title: title.trim() || null,
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
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1.2fr 1fr 0.7fr', gap: 10 }}>
        <FieldRow label="Title">
          <input className="hz-input" value={title} onChange={e => setTitle(e.target.value)} disabled={disabled} placeholder="Cheer Prep Academy"/>
        </FieldRow>
        <FieldRow label="When">
          <input type="datetime-local" className="hz-input" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} disabled={disabled} required/>
        </FieldRow>
        <FieldRow label="Type">
          <input className="hz-input" value={type} onChange={e => setType(e.target.value)} disabled={disabled} placeholder="practice, class, competition"/>
        </FieldRow>
        <FieldRow label="Min">
          <input type="number" className="hz-input" value={duration} onChange={e => setDuration(e.target.value)} disabled={disabled} min="15" max="480" step="15"/>
        </FieldRow>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
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
function SessionRow({ session: s, me, authSession, canEdit, onEdit, snap }) {
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
            {s.title || cleanSessionType(s.type)}
          </div>
          {s.title && (
            <div style={{ color: 'var(--hz-dim)', fontSize: 12, marginTop: 3, textTransform: 'capitalize' }}>{cleanSessionType(s.type)}</div>
          )}
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
        {me.role !== 'coach' && me.role !== 'owner' && <PersonalRsvp session={s} me={me} authSession={authSession}/> }
        {canEdit && onEdit && (
          <button className="hz-btn hz-btn-ghost hz-btn-sm" onClick={onEdit} style={{ padding: '6px 12px', fontSize: 11 }}>Edit</button>
        )}
      </div>
      {canEdit && <AttendancePanel session={s} me={me} snap={snap}/>}
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

function AttendancePanel({ session, me, snap }) {
  const [open, setOpen] = _useState(false);
  const [savingKey, setSavingKey] = _useState('');
  const [error, setError] = _useState('');
  const athletes = (window.HZsel.athletesForTeam?.(session.team_id) || (snap.athletes || []).filter(a => a.team_id === session.team_id))
    .filter(a => !a.deleted_at)
    .sort((a, b) => (a.display_name || '').localeCompare(b.display_name || ''));
  const rows = (snap.attendance || []).filter(row => row.session_id === session.id);
  const byAthlete = rows.reduce((out, row) => { out[row.athlete_id] = row; return out; }, {});
  const present = rows.filter(row => row.status === 'present').length;
  const late = rows.filter(row => row.status === 'late').length;
  const absent = rows.filter(row => row.status === 'absent').length;
  const excused = rows.filter(row => row.status === 'excused').length;

  async function mark(athleteId, status) {
    if (!athleteId || savingKey) return;
    const key = athleteId + ':' + status;
    setSavingKey(key);
    setError('');
    try {
      const payload = {
        session_id: session.id,
        athlete_id: athleteId,
        status,
        recorded_by: me.id || null,
        recorded_at: new Date().toISOString(),
      };
      const { error: saveError } = await upsertPersistedRow('attendance', payload, 'session_id,athlete_id');
      if (saveError) throw saveError;
      await refreshAppData('attendance', 'upsert');
    } catch (err) {
      setError(err?.message || 'Attendance did not save.');
    } finally {
      setSavingKey('');
    }
  }

  return (
    <div style={{ marginTop: 16, borderTop: '1px solid var(--hz-line)', paddingTop: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="hz-eyebrow">Attendance</div>
          <RsvpChip label="Present" value={present} color="var(--hz-teal)"/>
          <RsvpChip label="Late" value={late} color="var(--hz-amber)"/>
          <RsvpChip label="Absent" value={absent} color="var(--hz-red)"/>
          <RsvpChip label="Excused" value={excused} color="var(--hz-dimmer)"/>
        </div>
        <button className="hz-btn hz-btn-ghost hz-btn-sm" onClick={() => setOpen(v => !v)}>
          {open ? 'Hide roster' : 'Take attendance'}
        </button>
      </div>
      {error && <div style={{ color: 'var(--hz-red)', fontSize: 12, marginTop: 10 }}>{error}</div>}
      {open && (
        <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
          {athletes.map(athlete => {
            const current = byAthlete[athlete.id]?.status || 'unmarked';
            return (
              <div key={athlete.id} style={{ display: 'grid', gridTemplateColumns: '1fr repeat(4, auto)', gap: 8, alignItems: 'center', padding: 10, borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--hz-line)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <Avatar name={athlete.display_name} initials={athlete.initials} color={athlete.photo_color} src={athlete.photo_url} size={30}/>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{athlete.display_name}</div>
                    <div style={{ color: 'var(--hz-dim)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>{current}</div>
                  </div>
                </div>
                {['present','late','absent','excused'].map(status => (
                  <button
                    key={status}
                    className={`hz-btn hz-btn-sm ${current === status ? 'hz-btn-primary' : 'hz-btn-ghost'}`}
                    onClick={() => mark(athlete.id, status)}
                    disabled={!!savingKey}
                    style={{ fontSize: 11, padding: '6px 9px', textTransform: 'capitalize' }}
                  >
                    {savingKey === athlete.id + ':' + status ? 'Saving' : status}
                  </button>
                ))}
              </div>
            );
          })}
          {athletes.length === 0 && <div style={{ color: 'var(--hz-dim)', fontSize: 13 }}>No athletes are assigned to this session team.</div>}
        </div>
      )}
    </div>
  );
}
function PersonalRsvp({ session, me, authSession }) {
  const snap = window.HZsel.cache();
  const scope = window.HZviewerScope ? window.HZviewerScope(snap, authSession || { profile: me }) : null;
  const myAthleteId = scope?.ownAthleteId || scope?.visibleAthletes?.[0]?.id || null;
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
      {!myAthleteId && (
        <div style={{ color: 'var(--hz-dim)', fontSize: 11, maxWidth: 220, lineHeight: 1.45 }}>
          Link an athlete before RSVP opens.
        </div>
      )}
      <div style={{ display: 'flex', gap: 6 }}>
        {['going','maybe','no'].map(k => (
          <button key={k} onClick={() => set(k)}
            disabled={!!saving || !myAthleteId}
            className="hz-nosel"
            style={{
              padding: '8px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: !myAthleteId ? 'not-allowed' : saving ? 'wait' : 'pointer',
              border: '1px solid ' + (curr === k ? 'transparent' : 'var(--hz-line)'),
              background: curr === k ? (k === 'going' ? 'var(--hz-teal)' : k === 'maybe' ? 'var(--hz-amber)' : 'var(--hz-red)') : 'transparent',
              color: curr === k ? '#050507' : '#fff', textTransform: 'capitalize', letterSpacing: '0.04em',
              opacity: !myAthleteId || (saving && saving !== k) ? 0.5 : 1,
            }}>
            {saving === k ? 'Saving...' : k}
          </button>
        ))}
      </div>
      {error && <div style={{ color: 'var(--hz-red)', fontSize: 11, marginTop: 8, maxWidth: 260 }}>{error}</div>}
    </div>
  );
}
function CalendarSubscribeButton({ me, teamId = null }) {
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
    const row = {
      profile_id: me.id,
      team_id: me.role === 'coach' || me.role === 'owner' ? null : teamId,
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
function Uniforms({ snap, session, route }) {
  const kits = window.HZsel.uniformsWithItems();
  const scope = window.HZviewerScope ? window.HZviewerScope(snap, session) : null;
  const isStaff = ['coach', 'owner'].includes(session?.profile?.role || '');
  const orders = (snap.uniform_orders || []).filter(order => isStaff || scope?.visibleAthleteIds?.has(order.athlete_id));
  // Tab lives in the hash so the OS back button undoes tab switches.
  const tabParam = new URLSearchParams(String(route || '').split('?')[1] || '').get('tab');
  const tab = ['catalog', 'orders', 'sizes'].includes(tabParam) ? tabParam : 'catalog';
  const setTab = (id) => { location.hash = '#uniforms' + (id !== 'catalog' ? '?tab=' + id : ''); };

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
  const [pipelineBusy, setPipelineBusy] = _useState('');
  const [pipelineError, setPipelineError] = _useState('');
  const active = leads.find(l => l.id === activeId) || leads[0] || null;
  const touches = active ? window.HZsel.leadTouches(active.id) : [];

  async function setStage(lead, next) {
    setPipelineBusy(lead.id + ':stage');
    setPipelineError('');
    try {
      const { error } = await updatePersistedRow('leads', lead.id, {
        stage: next,
        updated_at: new Date().toISOString(),
        ...(next === 'converted' ? { converted_at: new Date().toISOString() } : {}),
      });
      if (error) throw error;
      await refreshAppData('leads', 'update');
    } catch (err) {
      setPipelineError(err?.message || 'Could not update lead stage.');
    } finally {
      setPipelineBusy('');
    }
  }

  async function advance(lead) {
    const order = stages.map(s => s.id);
    const next = order[Math.min(order.length - 1, order.indexOf(lead.stage) + 1)];
    await setStage(lead, next);
  }

  async function assign(leadId, profileId) {
    setPipelineBusy(leadId + ':assign');
    setPipelineError('');
    try {
      const { error } = await updatePersistedRow('leads', leadId, {
        assigned_to: profileId || null,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      await refreshAppData('leads', 'update');
    } catch (err) {
      setPipelineError(err?.message || 'Could not assign lead.');
    } finally {
      setPipelineBusy('');
    }
  }

  async function addTouch() {
    if (!active || !touchBody.trim()) return;
    setPipelineBusy(active.id + ':touch');
    setPipelineError('');
    try {
      const payload = {
        lead_id: active.id,
        kind: touchKind,
        body: touchBody.trim(),
        author_id: me.id,
        created_at: new Date().toISOString(),
      };
      if (!liveMode()) payload.id = 'lt_' + Math.random().toString(36).slice(2, 10);
      const { error } = await insertPersistedRow('lead_touches', payload);
      if (error) throw error;
      await refreshAppData('lead_touches', 'insert');
      setTouchBody('');
      setTouchKind('note');
    } catch (err) {
      setPipelineError(err?.message || 'Could not save lead touch.');
    } finally {
      setPipelineBusy('');
    }
  }

  function exportLeadsPdf() {
    exportRowsPdf('Hit Zero Leads', [
      { label: 'Stage', value: row => stages.find(st => st.id === row.stage)?.label || row.stage },
      { label: 'Athlete', value: row => row.athlete_name || '' },
      { label: 'Parent', value: row => row.parent_name || '' },
      { label: 'Email', value: row => row.parent_email || '' },
      { label: 'Phone', value: row => row.parent_phone || '' },
      { label: 'Interest', value: row => row.interest || '' },
      { label: 'Source', value: row => row.source || '' },
      { label: 'Assigned', value: row => staff.find(p => p.id === row.assigned_to)?.display_name || 'Unassigned' },
      { label: 'Updated', value: row => row.updated_at ? new Date(row.updated_at).toLocaleDateString() : '' },
    ], leads, {
      Program: (snap.programs || [])[0]?.brand_name || (snap.programs || [])[0]?.public_name || (snap.programs || [])[0]?.name || 'Hit Zero',
      Export: 'Leads pipeline',
    });
  }

  return (
    <div>
      <div className="hz-eyebrow">Leads · Gym pipeline</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 20 }}>
        <div className="hz-display" style={{ fontSize: 48, lineHeight: 1 }}>
          {total} families <span className="hz-zero">in motion</span>.
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <div style={{ fontSize: 13, color: 'var(--hz-dim)' }}>
            <span style={{ color: 'var(--hz-green)', fontWeight: 700 }}>{converted}</span> converted · win rate{' '}
            <span style={{ color: '#fff', fontWeight: 700 }}>{total ? Math.round(100*converted/total) : 0}%</span>
          </div>
          <button className="hz-btn hz-btn-sm" onClick={exportLeadsPdf} disabled={!leads.length}>Export PDF</button>
        </div>
      </div>
      {pipelineError && (
        <div className="hz-card" style={{ marginBottom: 14, padding: 12, color: 'var(--hz-pink)', borderColor: 'rgba(249,127,172,0.35)' }}>
          {pipelineError}
        </div>
      )}

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
                          <span onClick={(e) => { e.stopPropagation(); if (!pipelineBusy) advance(l); }}
                            style={{
                              background: 'transparent', color: 'var(--hz-teal)',
                              border: '1px solid rgba(39,207,215,0.3)', borderRadius: 8,
                              padding: '4px 10px', fontSize: 11, fontWeight: 700,
                              letterSpacing: '0.04em', textTransform: 'uppercase',
                            }}>{pipelineBusy === l.id + ':stage' ? 'Saving' : 'Advance'}</span>
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
              <IntakeMetadataPanel title="MCA intake details" metadata={active.metadata}/>

              <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
                <label>
                  <div className="hz-eyebrow" style={{ marginBottom: 6 }}>Stage</div>
                  <select value={active.stage} onChange={(e) => setStage(active, e.target.value)} disabled={!!pipelineBusy}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--hz-line)', borderRadius: 10, padding: '12px 14px', color: '#fff', fontSize: 14, fontFamily: 'var(--hz-sans)' }}>
                    {stages.map(st => <option key={st.id} value={st.id}>{st.label}</option>)}
                  </select>
                </label>

                <label>
                  <div className="hz-eyebrow" style={{ marginBottom: 6 }}>Owner / coach</div>
                  <select value={active.assigned_to || ''} onChange={(e) => assign(active.id, e.target.value)} disabled={!!pipelineBusy}
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
                  <select value={touchKind} onChange={(e) => setTouchKind(e.target.value)} disabled={!!pipelineBusy}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--hz-line)', borderRadius: 10, padding: '10px 12px', color: '#fff', fontSize: 13, fontFamily: 'var(--hz-sans)' }}>
                    {['note','call','email','text','tour','trial','other'].map(k => <option key={k} value={k}>{k}</option>)}
                  </select>
                  <textarea className="hz-input" rows="3" placeholder="What happened? What is the next step?" value={touchBody} onChange={(e) => setTouchBody(e.target.value)} disabled={!!pipelineBusy}/>
                  <button className="hz-btn hz-btn-primary" onClick={addTouch} disabled={!touchBody.trim() || !!pipelineBusy}>{pipelineBusy === active.id + ':touch' ? 'Saving...' : 'Add touch'}</button>
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
function Forms({ snap, session, openAthlete }) {
  const templates = window.HZsel.formTemplatesActive();
  const [activeId, setActiveId] = _useState(templates[0]?.id || null);
  const [athleteId, setAthleteId] = _useState('');
  const [athleteQuery, setAthleteQuery] = _useState('');
  const [score, setScore] = _useState('');
  const [notes, setNotes] = _useState('');
  const [saving, setSaving] = _useState(false);
  const [error, setError] = _useState('');
  const active = templates.find(t => t.id === activeId) || templates[0] || null;
  const responses = active ? window.HZsel.formResponsesForTemplate(active.id) : [];
  const fields = active ? (snap.form_fields || []).filter(f => f.template_id === active.id).sort((a,b) => a.position - b.position) : [];
  const me = session?.actualProfile || session?.profile || {};
  const isStaff = ['coach', 'owner'].includes(me.role || '');
  const athletes = window.HZsel.programAthletes?.() || snap.athletes || [];
  const roster = athletes.filter((athlete) => {
    const needle = athleteQuery.trim().toLowerCase();
    if (!needle) return true;
    return [
      athlete.display_name,
      athlete.initials,
      athlete.position,
      athlete.role,
    ].filter(Boolean).some((value) => String(value).toLowerCase().includes(needle));
  });
  const firstVisibleAthlete = roster.find(Boolean) || athletes.find(Boolean) || null;
  const selectedAthlete = athleteId
    ? athletes.find((athlete) => athlete.id === athleteId) || null
    : firstVisibleAthlete;
  const selectedMedical = selectedAthlete ? window.HZsel.athleteMedical(selectedAthlete.id) : { record: null, contacts: [], injuries: [] };
  const selectedParents = selectedAthlete
    ? (snap.parent_links || [])
      .filter((link) => link.athlete_id === selectedAthlete.id)
      .map((link) => ({
        ...link,
        profile: (snap.profiles || []).find((profile) => profile.id === link.parent_id) || null,
      }))
      .filter((link) => link.profile)
    : [];
  const selectedResponses = selectedAthlete
    ? responses.filter((response) => response.subject_athlete_id === selectedAthlete.id)
    : [];

  React.useEffect(() => {
    const nextAthleteId = firstVisibleAthlete?.id || '';
    if (!nextAthleteId) return;
    if (!athleteId) {
      setAthleteId(nextAthleteId);
      return;
    }
    if (!selectedAthlete && athleteId !== nextAthleteId) setAthleteId(nextAthleteId);
  }, [athleteId, firstVisibleAthlete?.id, selectedAthlete]);

  async function submitEvaluation(e) {
    e?.preventDefault?.();
    if (!active?.id || !athleteId || saving) return;
    setSaving(true);
    setError('');
    try {
      const { error: saveError } = await insertPersistedRow('form_responses', {
        template_id: active.id,
        subject_athlete_id: athleteId,
        submitted_by: me.id || null,
        score_total: score === '' ? null : Number(score),
        notes: notes.trim() || null,
        submitted_at: new Date().toISOString(),
      });
      if (saveError) throw saveError;
      await refreshAppData('form_responses', 'insert');
      setScore('');
      setNotes('');
      notify('Evaluation saved', 'The response is now visible in the coach form history.');
    } catch (err) {
      setError(err?.message || 'Evaluation did not save.');
    } finally {
      setSaving(false);
    }
  }

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
              {isStaff && (
                <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 14, marginTop: 18, marginBottom: 22 }}>
                  <div className="hz-card" style={{ padding: 16, display: 'grid', gap: 12, alignSelf: 'start' }}>
                    <div>
                      <div className="hz-eyebrow" style={{ marginBottom: 8 }}>Athlete quick pick</div>
                      <input
                        className="hz-input"
                        placeholder="Search athlete..."
                        value={athleteQuery}
                        onChange={(event) => setAthleteQuery(event.target.value)}
                      />
                    </div>
                    <div style={{ display: 'grid', gap: 8, maxHeight: 340, overflow: 'auto' }}>
                      {roster.map((athlete) => {
                        const athleteResponses = responses.filter((response) => response.subject_athlete_id === athlete.id);
                        const med = window.HZsel.athleteMedical(athlete.id);
                        const isActive = selectedAthlete?.id === athlete.id;
                        return (
                          <button
                            key={athlete.id}
                            type="button"
                            className="hz-nosel"
                            onClick={() => setAthleteId(athlete.id)}
                            style={{
                              textAlign: 'left',
                              padding: 12,
                              borderRadius: 12,
                              border: '1px solid ' + (isActive ? 'rgba(39,207,215,0.4)' : 'var(--hz-line)'),
                              background: isActive ? 'rgba(39,207,215,0.08)' : 'rgba(255,255,255,0.03)',
                              color: '#fff',
                              cursor: 'pointer',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                                <Avatar name={athlete.display_name} initials={athlete.initials} color={athlete.photo_color} src={athlete.photo_url} size={28}/>
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{athlete.display_name}</div>
                                  <div style={{ fontSize: 10, color: 'var(--hz-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
                                    {(athlete.position || athlete.role || 'athlete')}{athlete.age ? ` · age ${athlete.age}` : ''}
                                  </div>
                                </div>
                              </div>
                              <Pill tone={athleteResponses.length ? 'teal' : 'neutral'}>{athleteResponses.length} eval</Pill>
                            </div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10, fontSize: 11, color: 'var(--hz-dim)' }}>
                              <span>{med.record ? 'Medical on file' : 'Medical empty'}</span>
                              <span>·</span>
                              <span>{med.contacts.length} contacts</span>
                            </div>
                          </button>
                        );
                      })}
                      {roster.length === 0 && <div style={{ color: 'var(--hz-dim)', fontSize: 13 }}>No athletes match that search.</div>}
                    </div>
                  </div>

                  <div className="hz-card" style={{ padding: 16, display: 'grid', gap: 14 }}>
                    {!selectedAthlete ? (
                      <div style={{ color: 'var(--hz-dim)', fontSize: 13 }}>Pick an athlete to load scoring, family, and medical context.</div>
                    ) : (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'start', flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <Avatar name={selectedAthlete.display_name} initials={selectedAthlete.initials} color={selectedAthlete.photo_color} src={selectedAthlete.photo_url} size={40}/>
                            <div>
                              <div style={{ fontWeight: 800, fontSize: 18 }}>{selectedAthlete.display_name}</div>
                              <div style={{ color: 'var(--hz-dim)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
                                {(selectedAthlete.position || selectedAthlete.role || 'athlete')}{selectedAthlete.age ? ` · age ${selectedAthlete.age}` : ''}
                              </div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <button type="button" className="hz-btn hz-btn-sm" onClick={() => openAthlete?.(selectedAthlete.id)}>Open athlete</button>
                            <button type="button" className="hz-btn hz-btn-sm" onClick={() => { location.hash = '#athlete/' + selectedAthlete.id + '?tab=medical'; }}>Medical tab</button>
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
                          <div style={{ padding: 12, borderRadius: 12, border: '1px solid var(--hz-line)', background: 'rgba(255,255,255,0.03)' }}>
                            <div className="hz-eyebrow" style={{ marginBottom: 6 }}>Family</div>
                            <div style={{ fontSize: 18, fontWeight: 800 }}>{selectedParents.length}</div>
                            <div style={{ color: 'var(--hz-dim)', fontSize: 12, marginTop: 4 }}>
                              {selectedParents.length ? selectedParents.map((link) => link.profile.display_name || link.profile.email).join(', ') : 'No linked parents yet.'}
                            </div>
                          </div>
                          <div style={{ padding: 12, borderRadius: 12, border: '1px solid var(--hz-line)', background: 'rgba(255,255,255,0.03)' }}>
                            <div className="hz-eyebrow" style={{ marginBottom: 6 }}>Medical</div>
                            <div style={{ fontSize: 18, fontWeight: 800 }}>{selectedMedical.record ? 'On file' : 'Missing'}</div>
                            <div style={{ color: 'var(--hz-dim)', fontSize: 12, marginTop: 4 }}>
                              {selectedMedical.contacts.length} emergency contact{selectedMedical.contacts.length === 1 ? '' : 's'}
                            </div>
                          </div>
                          <div style={{ padding: 12, borderRadius: 12, border: '1px solid var(--hz-line)', background: 'rgba(255,255,255,0.03)' }}>
                            <div className="hz-eyebrow" style={{ marginBottom: 6 }}>Scoring</div>
                            <div style={{ fontSize: 18, fontWeight: 800 }}>{selectedResponses.length}</div>
                            <div style={{ color: 'var(--hz-dim)', fontSize: 12, marginTop: 4 }}>
                              response{selectedResponses.length === 1 ? '' : 's'} on this template
                            </div>
                          </div>
                        </div>

                        {selectedMedical.record && (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, fontSize: 12 }}>
                            <div style={{ padding: 12, borderRadius: 12, border: '1px solid var(--hz-line)', background: 'rgba(255,255,255,0.02)' }}>
                              <div className="hz-eyebrow" style={{ marginBottom: 6 }}>Allergies / meds</div>
                              <div style={{ color: 'var(--hz-dim)', lineHeight: 1.5 }}>
                                {selectedMedical.record.allergies || 'No allergies listed.'}
                                {selectedMedical.record.medications ? ` Medications: ${selectedMedical.record.medications}` : ''}
                              </div>
                            </div>
                            <div style={{ padding: 12, borderRadius: 12, border: '1px solid var(--hz-line)', background: 'rgba(255,255,255,0.02)' }}>
                              <div className="hz-eyebrow" style={{ marginBottom: 6 }}>Insurance / physician</div>
                              <div style={{ color: 'var(--hz-dim)', lineHeight: 1.5 }}>
                                {selectedMedical.record.insurance_carrier || 'No insurance carrier listed.'}
                                {selectedMedical.record.physician_name ? ` Physician: ${selectedMedical.record.physician_name}` : ''}
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}

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

              {isStaff && (
                <form onSubmit={submitEvaluation} style={{ display: 'grid', gap: 10, marginBottom: 22, padding: 14, borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--hz-line)' }}>
                  <div className="hz-eyebrow">New response</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 120px auto', gap: 10, alignItems: 'end' }}>
                    <FieldRow label="Athlete">
                      <select className="hz-input" value={athleteId} onChange={e => setAthleteId(e.target.value)} disabled={saving} required>
                        <option value="">Choose athlete</option>
                        {athletes.map(a => <option key={a.id} value={a.id}>{a.display_name}</option>)}
                      </select>
                    </FieldRow>
                    <FieldRow label="Score">
                      <input className="hz-input" type="number" min="0" max="100" step="0.1" value={score} onChange={e => setScore(e.target.value)} disabled={saving} placeholder="0-100"/>
                    </FieldRow>
                    <button className="hz-btn hz-btn-primary" type="submit" disabled={saving || !athleteId}>{saving ? 'Saving...' : 'Save response'}</button>
                  </div>
                  <textarea className="hz-input" rows={2} value={notes} onChange={e => setNotes(e.target.value)} disabled={saving} placeholder="Coach notes"/>
                  {error && <div style={{ color: 'var(--hz-red)', fontSize: 12 }}>{error}</div>}
                </form>
              )}

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
  const scope = window.HZviewerScope ? window.HZviewerScope(snap, session) : null;
  const isStaff = ['coach', 'owner'].includes(me.role || '');
  const canClaimVolunteer = isStaff || me.role === 'parent';
  const unlinkedFamily = !isStaff && !scope?.visibleAthletes?.length;
  const comps = (snap.sessions || []).filter(s =>
    s.is_competition && (isStaff || scope?.visibleTeamIds?.has(s.team_id))
  );
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
    if (!canClaimVolunteer) return;
    updateAssignment(assignmentId, {
      profile_id: me.id, status: 'claimed', claimed_at: new Date().toISOString()
    }, 'claim');
  }
  function unclaim(assignmentId) {
    if (!canClaimVolunteer) return;
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
      {unlinkedFamily && (
        <EmptyState
          icon="users"
          title="Link an athlete first."
          body="Volunteer signups unlock after this account is connected to a specific athlete."
        />
      )}
      {!unlinkedFamily && !active && <div className="hz-card" style={{ padding: 40, color: 'var(--hz-dim)', textAlign: 'center' }}>No competitions on the books.</div>}
      {!unlinkedFamily && active && (
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
                    {!claimed && open && canClaimVolunteer && (
                      <button onClick={() => claim(open.id)} disabled={busyId === open.id} className="hz-btn hz-btn-primary">
                        {busyId === open.id ? 'Claiming...' : "I'll do it"}
                      </button>
                    )}
                    {!claimed && open && !canClaimVolunteer && (
                      <Pill tone="amber">Open</Pill>
                    )}
                    {claimed && claimed.profile_id === me.id && canClaimVolunteer && (
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
  const [creating, setCreating] = _useState(false);
  const [busy, setBusy] = _useState(false);
  const [error, setError] = _useState('');
  const [draft, setDraft] = _useState({ title: 'Tonight practice plan', focus: 'Clean routine execution', drillIds: [] });
  const active = plans.find(p => p.id === activeId) || plans[0] || null;
  const blocks = active ? (snap.practice_plan_blocks || []).filter(b => b.plan_id === active.id).sort((a,b) => a.position - b.position) : [];
  const totalMin = blocks.reduce((s, b) => s + (b.duration_min || 0), 0);
  const me = session?.actualProfile || session?.profile || {};
  const canEdit = ['coach', 'owner'].includes(me.role || '');
  const team = window.HZsel.programTeams?.()[0] || (snap.teams || [])[0] || null;
  const drills = (snap.drills || []).filter(d => !team?.program_id || d.program_id === team.program_id);
  const selectedDrillIds = draft.drillIds.length ? draft.drillIds : drills.slice(0, 3).map(d => d.id);

  async function createPlan(e) {
    e?.preventDefault?.();
    if (!canEdit || !team?.id || busy) return;
    setBusy(true);
    setError('');
    try {
      const { data: plan, error: planError } = await insertPersistedRow('practice_plans', {
        team_id: team.id,
        title: draft.title.trim() || 'Practice plan',
        focus: draft.focus.trim() || 'Practice focus',
        created_by: me.id || null,
        created_at: new Date().toISOString(),
      });
      if (planError) throw planError;
      const savedPlan = Array.isArray(plan) ? plan[0] : plan;
      const blockDrills = drills.filter(d => selectedDrillIds.includes(d.id));
      for (let i = 0; i < blockDrills.length; i += 1) {
        const drill = blockDrills[i];
        const { error: blockError } = await insertPersistedRow('practice_plan_blocks', {
          plan_id: savedPlan.id,
          drill_id: drill.id,
          custom_title: null,
          duration_min: drill.duration_min || 10,
          position: i,
          notes: drill.description || null,
        });
        if (blockError) throw blockError;
      }
      await refreshAppData('practice_plans', 'insert');
      await refreshAppData('practice_plan_blocks', 'insert');
      setActiveId(savedPlan.id);
      setCreating(false);
      notify('Practice plan created', 'Saved to the coach plan library.');
    } catch (err) {
      setError(err?.message || 'Practice plan did not save.');
    } finally {
      setBusy(false);
    }
  }

  function toggleDrill(id) {
    setDraft(d => {
      const next = d.drillIds.length ? d.drillIds : drills.slice(0, 3).map(row => row.id);
      return { ...d, drillIds: next.includes(id) ? next.filter(x => x !== id) : [...next, id] };
    });
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-end', marginBottom: 20 }}>
        <div>
          <div className="hz-eyebrow">Practice Plans · Drill library</div>
          <div className="hz-display" style={{ fontSize: 48, lineHeight: 1 }}>
            A plan for every <span className="hz-zero">rep</span>.
          </div>
        </div>
        {canEdit && (
          <button className="hz-btn hz-btn-primary" onClick={() => setCreating(v => !v)}>
            {creating ? 'Close' : 'New plan'} <HZIcon name={creating ? 'x' : 'plus'} size={13}/>
          </button>
        )}
      </div>

      {error && <div className="hz-card" style={{ color: 'var(--hz-red)', marginBottom: 14, padding: 12 }}>{error}</div>}
      {creating && (
        <form onSubmit={createPlan} className="hz-card" style={{ marginBottom: 18, padding: 18, display: 'grid', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10, alignItems: 'end' }}>
            <FieldRow label="Plan title">
              <input className="hz-input" value={draft.title} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} disabled={busy}/>
            </FieldRow>
            <FieldRow label="Focus">
              <input className="hz-input" value={draft.focus} onChange={e => setDraft(d => ({ ...d, focus: e.target.value }))} disabled={busy}/>
            </FieldRow>
            <button className="hz-btn hz-btn-primary" type="submit" disabled={busy || !team?.id}>{busy ? 'Saving...' : 'Save plan'}</button>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {drills.map(drill => (
              <button
                key={drill.id}
                type="button"
                className={`hz-btn hz-btn-sm ${selectedDrillIds.includes(drill.id) ? 'hz-btn-primary' : 'hz-btn-ghost'}`}
                onClick={() => toggleDrill(drill.id)}
                disabled={busy}
              >
                {drill.name}
              </button>
            ))}
          </div>
        </form>
      )}

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
          {!active && (
            <EmptyState
              icon="routine"
              title="No practice plans yet."
              body="Create a plan from the drill library or use the seeded starter plan after production backfill."
            />
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
  const program = window.HZactiveProgramFromSnap ? window.HZactiveProgramFromSnap(snap, session) : (snap.programs || [])[0] || null;
  const programName = window.HZprogramDisplayName ? window.HZprogramDisplayName(program, 'your gym') : (program?.brand_name || program?.public_name || program?.name || 'your gym');
  const programLocation = window.HZprogramLocationLabel ? window.HZprogramLocationLabel(program, '') : [program?.city, program?.state].filter(Boolean).join(', ');

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
      ...form, program_id: program?.id || 'p_mca', status: 'pending', created_at: new Date().toISOString(),
    });
    await refreshAppData('registrations', 'insert');
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
      <div className="hz-eyebrow">{programName}{programLocation ? ` · ${programLocation}` : ''}</div>
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
  const effectiveProfile = session?.profile || {};
  const actualProfile = session?.actualProfile || effectiveProfile;
  const staffRole = actualProfile.role || effectiveProfile.role || '';
  const isStaff = ['owner', 'coach'].includes(staffRole);
  const hasStaffProgram = !!(actualProfile.program_id || effectiveProfile.program_id);
  const isCheckoutHold = window.HZsel?.isCheckoutHold || ((row) => {
    const meta = row?.intake_metadata || {};
    return !isSettledRegistrationPayment(row?.payment_status)
      && (meta.payment_gate_required === true || meta.payment_gate_state === 'checkout_started');
  });
  const checkoutHolds = (snap.registrations || []).filter(isCheckoutHold);
  const allRegs = (snap.registrations || []).filter(r => !isCheckoutHold(r)).slice().sort((a,b) => {
    if (isSettledRegistrationPayment(a.payment_status) && !isSettledRegistrationPayment(b.payment_status)) return -1;
    if (!isSettledRegistrationPayment(a.payment_status) && isSettledRegistrationPayment(b.payment_status)) return 1;
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
  const [query, setQuery] = _useState('');
  const [statusFilter, setStatusFilter] = _useState('all');
  const [payFilter, setPayFilter] = _useState('all');
  const regs = allRegs.filter(r => {
    const q = query.trim().toLowerCase();
    const matchesQuery = !q || [r.athlete_name, r.parent_name, r.parent_email, r.parent_phone, labelFor(r), r.source]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(q);
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    const isUnpaid = ['none', 'pending', 'failed', null, undefined].includes(r.payment_status);
    const matchesPay = payFilter === 'all' || (payFilter === 'settled' ? isSettledRegistrationPayment(r.payment_status) : isUnpaid);
    return matchesQuery && matchesStatus && matchesPay;
  });
  const visibleCheckoutHolds = checkoutHolds.filter(r => {
    const q = query.trim().toLowerCase();
    return !q || [r.athlete_name, r.parent_name, r.parent_email, r.parent_phone, labelFor(r), r.source]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(q);
  });
  const [activeId, setActiveId] = _useState(allRegs[0]?.id || null);
  const active = allRegs.find(r => r.id === activeId) || regs[0] || allRegs[0] || null;
  const [notes, setNotes] = _useState(active?.notes || '');
  const [decisionReason, setDecisionReason] = _useState(active?.decision_reason || '');
  const [assignmentClassId, setAssignmentClassId] = _useState(active?.class_id || '');
  const [busyDecision, setBusyDecision] = _useState('');
  const [decisionError, setDecisionError] = _useState('');
  const [assist, setAssist] = _useState({
    parent_name: '',
    parent_email: '',
    parent_phone: '',
    athlete_name: '',
    athlete_age: '',
    athlete_dob: '',
    interest: '',
    class_id: '',
    notes: '',
    send_email: true,
  });
  const [assistBusy, setAssistBusy] = _useState(false);
  const [assistError, setAssistError] = _useState('');
  const [assistResult, setAssistResult] = _useState(null);
  const [assistCopied, setAssistCopied] = _useState(false);
  const [reminderBusy, setReminderBusy] = _useState('');
  const [reminderResult, setReminderResult] = _useState(null);
  const [reminderError, setReminderError] = _useState('');
  const [reminderCopied, setReminderCopied] = _useState(false);

  _useEffect(() => {
    setNotes(active?.notes || '');
    setDecisionReason(active?.decision_reason || '');
    setAssignmentClassId(active?.class_id || '');
  }, [active?.id]);

  const counts = allRegs.reduce((out, r) => {
    out[r.status] = (out[r.status] || 0) + 1;
    if (r.payment_status === 'paid') out.paid += 1;
    return out;
  }, { pending: 0, accepted: 0, waitlist: 0, rejected: 0, withdrawn: 0, paid: 0 });
  const unpaidRegs = allRegs.filter(r => ['none', 'pending', 'failed', null, undefined].includes(r.payment_status) && ['pending', 'accepted'].includes(r.status));
  const staffMissingScope = isStaff && !hasStaffProgram && !allRegs.length;
  const staffScopedEmpty = isStaff && hasStaffProgram && !allRegs.length;

  async function decide(nextStatus, extra = {}) {
    if (!active) return;
    const busyKey = extra.payment_status === 'comped' ? 'comped' : nextStatus;
    setBusyDecision(busyKey);
    setDecisionError('');
    const { data, error } = window.HZdb.auth?.updateRegistrationDecision
      ? await window.HZdb.auth.updateRegistrationDecision(active.id, nextStatus, notes, {
          decision_reason: decisionReason,
          class_id: assignmentClassId || null,
          ...extra,
        })
      : { data: null, error: new Error('Registration decision service is unavailable.') };
    if (error) {
      setDecisionError(error.message || 'Could not update registration.');
      setBusyDecision('');
      return;
    }
    if (data?.registration) {
      await window.HZdb.from('registrations').update(data.registration).eq('id', data.registration.id);
    }
    await refreshAppData('registrations', 'decision');
    setBusyDecision('');
  }

  async function saveNotes() {
    if (!active) return;
    setBusyDecision('notes');
    setDecisionError('');
    const { data, error } = window.HZdb.auth?.updateRegistrationNotes
      ? await window.HZdb.auth.updateRegistrationNotes(active.id, notes)
      : { data: null, error: new Error('Registration notes service is unavailable.') };
    if (error) {
      setDecisionError(error.message || 'Could not save notes.');
      setBusyDecision('');
      return;
    }
    if (data?.registration) {
      await window.HZdb.from('registrations').update(data.registration).eq('id', data.registration.id);
    }
    await refreshAppData('registrations', 'notes');
    setBusyDecision('');
  }

  async function createAssisted(e) {
    e.preventDefault();
    setAssistBusy(true);
    setAssistError('');
    setAssistCopied(false);
    const payload = {
      ...assist,
      class_id: assist.class_id || null,
      source: 'staff_assisted_meet_greet',
    };
    const { data, error } = window.HZdb.auth?.createAssistedRegistration
      ? await window.HZdb.auth.createAssistedRegistration(payload)
      : { data: null, error: new Error('Assisted registration service is unavailable.') };
    if (error) {
      setAssistError(error.message || 'Could not create assisted registration.');
      setAssistBusy(false);
      return;
    }
    setAssistResult(data);
    setAssist({
      parent_name: '',
      parent_email: '',
      parent_phone: '',
      athlete_name: '',
      athlete_age: '',
      athlete_dob: '',
      interest: '',
      class_id: '',
      notes: '',
      send_email: true,
    });
    await refreshAppData('registrations', 'assisted_create');
    setAssistBusy(false);
  }

  async function copyAssistedLink() {
    if (!assistResult?.url) return;
    try {
      await navigator.clipboard?.writeText(assistResult.url);
      setAssistCopied(true);
    } catch {
      setAssistCopied(false);
    }
  }

  async function sendPaymentReminders(ids, label) {
    setReminderBusy(label);
    setReminderError('');
    setReminderResult(null);
    setReminderCopied(false);
    const { data, error } = window.HZdb.auth?.sendPaymentReminders
      ? await window.HZdb.auth.sendPaymentReminders(ids)
      : { data: null, error: new Error('Payment reminder service is unavailable.') };
    if (error) setReminderError(error.message || 'Could not send payment reminders.');
    else setReminderResult(data);
    setReminderBusy('');
  }

  async function copyReminderLinks() {
    const links = (reminderResult?.results || [])
      .filter(r => r.payment_url)
      .map(r => {
        const amount = r.amount_cents ? ` / $${(Number(r.amount_cents) / 100).toFixed(Number(r.amount_cents) % 100 ? 2 : 0)}` : '';
        return `${r.parent_name || r.email || 'Parent'} / ${r.athlete_name || 'Athlete'}${amount}: ${r.payment_url}`;
      });
    if (!links.length) return;
    try {
      await navigator.clipboard?.writeText(links.join('\n'));
      setReminderCopied(true);
    } catch {
      setReminderCopied(false);
    }
  }

  const assistedClassOptions = [
    { value: '', label: 'No specific class yet' },
    ...(snap.program_classes || [])
      .slice()
      .sort((a,b) => String(a.name).localeCompare(String(b.name)))
      .map(c => ({ value: c.id, label: c.name })),
  ];
  const reminderRows = reminderResult?.results || [];
  const reminderManual = reminderResult
    ? (Number(reminderResult.manual || 0) || reminderRows.filter(r => r.payment_url && r.reason === 'email_not_configured').length)
    : 0;
  const reminderFailed = reminderResult?.email_configured
    ? (Number(reminderResult.failed || 0) || reminderRows.filter(r => !r.ok && !r.skipped && !r.manual).length)
    : 0;
  const reminderHasLinks = reminderRows.some(r => r.payment_url);

  function exportRegistrationsPdf() {
    exportRowsPdf('Hit Zero Registrations', [
      { label: 'Class / Program', value: row => labelFor(row) },
      { label: 'Athlete', value: row => row.athlete_name || '' },
      { label: 'Parent', value: row => row.parent_name || '' },
      { label: 'Email', value: row => row.parent_email || '' },
      { label: 'Phone', value: row => row.parent_phone || '' },
      { label: 'Status', value: row => row.status || '' },
      { label: 'Payment', value: row => paymentSummary(row) },
      { label: 'Paid At', value: row => row.paid_at ? new Date(row.paid_at).toLocaleString() : '' },
      { label: 'Created', value: row => row.created_at ? new Date(row.created_at).toLocaleString() : '' },
    ], regs, {
      Program: (snap.programs || [])[0]?.brand_name || (snap.programs || [])[0]?.public_name || (snap.programs || [])[0]?.name || 'Hit Zero',
      Filter: `${statusFilter} status / ${payFilter} payment`,
    });
  }

  return (
    <div>
      <div className="hz-eyebrow">Registration · Admissions desk</div>
      <div className="hz-display" style={{ fontSize: 48, lineHeight: 1, marginBottom: 20 }}>
        New families, <span className="hz-zero">properly handled</span>.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 20 }}>
        <MiniStat label="Pending" value={counts.pending} accent="var(--hz-amber)"/>
        <MiniStat label="Paid" value={counts.paid} accent="var(--hz-green)"/>
        <MiniStat label="Accepted" value={counts.accepted} accent="var(--hz-green)"/>
        <MiniStat label="Waitlist" value={counts.waitlist} accent="var(--hz-pink)"/>
        <MiniStat label="Rejected" value={counts.rejected} accent="var(--hz-dim)"/>
      </div>

      <div className="hz-card" style={{ padding: 16, marginBottom: 20, display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <div className="hz-eyebrow" style={{ marginBottom: 5 }}>Unpaid registrations</div>
          <div style={{ fontSize: 18, fontWeight: 900 }}>{unpaidRegs.length} need payment follow-up.</div>
          <div style={{ color: 'var(--hz-dim)', fontSize: 12, marginTop: 4 }}>Only submitted/manual registrations appear in the main queue. Checkout starts that stopped before payment are listed below for owner follow-up.</div>
          {checkoutHolds.length > 0 && (
            <div style={{ color: 'var(--hz-amber)', fontSize: 12, marginTop: 5 }}>
              {checkoutHolds.length} checkout {checkoutHolds.length === 1 ? 'start is' : 'starts are'} waiting on parent follow-up.
            </div>
          )}
          {reminderError && <div style={{ color: 'var(--hz-pink)', fontSize: 13, marginTop: 8 }}>{reminderError}</div>}
          {reminderResult && (
            <div style={{ color: 'var(--hz-dim)', fontSize: 12, marginTop: 8 }}>
              {reminderResult.email_configured ? (
                <>Checked {reminderResult.total ?? reminderRows.length}. Sent {reminderResult.sent || 0}. Skipped {reminderResult.skipped || 0}. Failed {reminderFailed}.</>
              ) : (
                <>Checked {reminderResult.total ?? reminderRows.length}. Prepared {reminderManual} payment {reminderManual === 1 ? 'link' : 'links'}. Skipped {reminderResult.skipped || 0}. Email is not configured yet, so nothing was sent automatically.</>
              )}
              {reminderHasLinks && (
                <button type="button" className="hz-btn hz-btn-sm" onClick={copyReminderLinks} style={{ marginLeft: 10 }}>
                  {reminderCopied ? 'Copied payment links' : (reminderResult.email_configured ? 'Copy payment links' : 'Copy manual links')}
                </button>
              )}
            </div>
          )}
        </div>
        <button
          className="hz-btn hz-btn-primary"
          disabled={!unpaidRegs.length || !!reminderBusy}
          onClick={() => sendPaymentReminders([], 'all')}
        >
          {reminderBusy === 'all' ? 'Preparing...' : 'Send payment follow-ups'}
        </button>
      </div>

      {checkoutHolds.length > 0 && (
        <div className="hz-card" style={{ padding: 18, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 14 }}>
            <div>
              <div className="hz-eyebrow" style={{ marginBottom: 5 }}>Owner-only checkout follow-up</div>
              <div style={{ fontSize: 18, fontWeight: 900 }}>{visibleCheckoutHolds.length} family{visibleCheckoutHolds.length === 1 ? '' : 'ies'} started registration and stopped before payment.</div>
              <div style={{ color: 'var(--hz-dim)', fontSize: 12, marginTop: 4 }}>Use this to reach out only when the parent already entered contact info.</div>
            </div>
            <div style={{ color: 'var(--hz-dim)', fontSize: 12 }}>
              {checkoutHolds.length !== visibleCheckoutHolds.length ? `${checkoutHolds.length} total in this gym` : 'Current gym scope'}
            </div>
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            {visibleCheckoutHolds.map((row) => (
              <div
                key={row.id}
                style={{
                  padding: 14,
                  borderRadius: 12,
                  border: '1px solid rgba(255,180,84,0.18)',
                  background: 'rgba(255,180,84,0.06)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <div>
                    <div className="hz-eyebrow">{labelFor(row)}</div>
                    <div style={{ fontWeight: 800, fontSize: 15, marginTop: 4 }}>{row.athlete_name || 'Unnamed athlete'}</div>
                    <div style={{ color: 'var(--hz-dim)', fontSize: 12, marginTop: 6 }}>
                      {row.parent_name || 'Parent name missing'}
                      {row.parent_email ? ` · ${row.parent_email}` : ''}
                      {row.parent_phone ? ` · ${row.parent_phone}` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'grid', gap: 6, justifyItems: 'end' }}>
                    <PaymentStatusBadge row={row}/>
                    <div style={{ color: 'var(--hz-dim)', fontSize: 11 }}>{timeAgo(row.created_at)}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10, fontSize: 11, color: 'var(--hz-dim)' }}>
                  <span>{row.source || 'Unknown source'}</span>
                  {row.level_interest ? <span>· Level {row.level_interest}</span> : null}
                  <span>· Started checkout</span>
                </div>
                {row.notes && (
                  <div style={{ marginTop: 10, color: 'var(--hz-dim)', fontSize: 12, lineHeight: 1.5 }}>
                    {row.notes}
                  </div>
                )}
              </div>
            ))}
            {!visibleCheckoutHolds.length && (
              <div style={{ color: 'var(--hz-dim)', fontSize: 13 }}>No checkout-start follow-ups match the current search.</div>
            )}
          </div>
        </div>
      )}

      <form className="hz-card" onSubmit={createAssisted} style={{ padding: 18, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'flex-start', marginBottom: 14 }}>
          <div>
            <div className="hz-eyebrow" style={{ marginBottom: 5 }}>Staff-assisted signup</div>
            <div style={{ fontSize: 18, fontWeight: 900 }}>Register an athlete in person, then send the parent their setup link.</div>
            <div style={{ color: 'var(--hz-dim)', fontSize: 12, marginTop: 5 }}>Creates a pending registration and a one-use parent invite. Staff still controls approval and athlete linking.</div>
          </div>
          <button className="hz-btn hz-btn-primary" type="submit" disabled={assistBusy}>{assistBusy ? 'Creating...' : 'Create + send'}</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <Input label="Parent name" required value={assist.parent_name} onChange={v => setAssist(a => ({ ...a, parent_name: v }))}/>
          <Input label="Parent email" required type="email" value={assist.parent_email} onChange={v => setAssist(a => ({ ...a, parent_email: v }))}/>
          <Input label="Parent phone" value={assist.parent_phone} onChange={v => setAssist(a => ({ ...a, parent_phone: v }))}/>
          <Input label="Athlete name" required value={assist.athlete_name} onChange={v => setAssist(a => ({ ...a, athlete_name: v }))}/>
          <Input label="Age" value={assist.athlete_age} onChange={v => setAssist(a => ({ ...a, athlete_age: v }))}/>
          <Input label="DOB" type="date" value={assist.athlete_dob} onChange={v => setAssist(a => ({ ...a, athlete_dob: v }))}/>
          <Select label="Class / interest" value={assist.class_id} onChange={v => setAssist(a => ({ ...a, class_id: v }))} options={assistedClassOptions}/>
          <Input label="Interest note" value={assist.interest} onChange={v => setAssist(a => ({ ...a, interest: v }))}/>
        </div>
        <div style={{ marginTop: 12 }}>
          <textarea className="hz-input" rows="3" placeholder="Meet-and-greet notes, placement context, payment notes, or who should follow up." value={assist.notes} onChange={e => setAssist(a => ({ ...a, notes: e.target.value }))}/>
        </div>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 12, color: 'var(--hz-dim)', fontSize: 13 }}>
          <input type="checkbox" checked={assist.send_email} onChange={e => setAssist(a => ({ ...a, send_email: e.target.checked }))}/>
          Email setup link to parent
        </label>
        {assistError && <div style={{ color: 'var(--hz-pink)', fontSize: 13, marginTop: 10 }}>{assistError}</div>}
        {assistResult?.url && (
          <div style={{ marginTop: 12, padding: 12, borderRadius: 12, border: '1px solid rgba(39,220,229,0.32)', background: 'rgba(39,220,229,0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontWeight: 900 }}>Parent setup link ready.</div>
                <div style={{ color: 'var(--hz-dim)', fontSize: 12, marginTop: 3 }}>{assistResult.email_attempted ? 'Email was queued if mail is configured.' : 'Email was not sent, so copy this link for the parent.'}</div>
              </div>
              <button type="button" className="hz-btn hz-btn-sm" onClick={copyAssistedLink}>{assistCopied ? 'Copied' : 'Copy link'}</button>
            </div>
            <input className="hz-input" readOnly value={assistResult.url} style={{ marginTop: 10 }}/>
          </div>
        )}
      </form>

      <div className="hz-card" style={{ padding: 14, marginBottom: 18, display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 10 }}>
        <input className="hz-input" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search athlete, parent, email, phone, class..." />
        <select className="hz-input" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="accepted">Accepted</option>
          <option value="waitlist">Waitlist</option>
          <option value="rejected">Rejected</option>
          <option value="withdrawn">Withdrawn</option>
        </select>
        <select className="hz-input" value={payFilter} onChange={e => setPayFilter(e.target.value)}>
          <option value="all">All payments</option>
          <option value="unpaid">Unpaid</option>
          <option value="settled">Paid / comped</option>
        </select>
        <button className="hz-btn" type="button" onClick={exportRegistrationsPdf} disabled={!regs.length}>Export PDF</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 18 }}>
        <aside style={{ display: 'grid', gap: 8, maxHeight: '72vh', overflowY: 'auto', paddingRight: 4 }}>
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
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <PaymentStatusBadge row={r}/>
                    <StatusBadge status={r.status}/>
                  </div>
                </div>
                <div style={{ fontWeight: 700, fontSize: 14, marginTop: 4 }}>{r.athlete_name}</div>
                <div style={{ fontSize: 11, color: 'var(--hz-dim)', marginTop: 4 }}>{r.parent_name} · {r.parent_email}</div>
                <div style={{ fontSize: 10, color: 'var(--hz-dimmer)', marginTop: 6, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 700 }}>
                  Level {r.level_interest || '—'} · {r.source || 'unknown source'} · {timeAgo(r.created_at)}
                </div>
              </button>
            );
          })}
          {!regs.length && staffMissingScope && (
            <div className="hz-card" style={{ color: 'var(--hz-amber)', fontSize: 13 }}>
              This staff account is missing gym access, so registrations are hidden until the profile is connected to a program.
            </div>
          )}
          {!regs.length && staffScopedEmpty && (
            <div className="hz-card" style={{ color: 'var(--hz-amber)', fontSize: 13 }}>
              No registrations are visible for this gym scope. If existing families should appear, sign out/in and contact support before assuming the roster is empty.
            </div>
          )}
          {!regs.length && !staffMissingScope && !staffScopedEmpty && <div className="hz-card" style={{ color: 'var(--hz-dim)', fontSize: 13 }}>No registrations on file yet.</div>}
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
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <PaymentStatusBadge row={active}/>
                  <StatusBadge status={active.status}/>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 18 }}>
                <DetailCard label="Parent" value={active.parent_name}/>
                <DetailCard label="Email" value={active.parent_email}/>
                <DetailCard label="Phone" value={active.parent_phone || '—'}/>
                <DetailCard label="DOB / level" value={`${active.athlete_dob || '—'} · L${active.level_interest || '—'}`}/>
                <DetailCard label="Payment" value={paymentSummary(active)}/>
                <DetailCard label="Paid at" value={active.paid_at ? new Date(active.paid_at).toLocaleString() : '—'}/>
              </div>
              {active.payment_metadata?.receipt_url && (
                <a className="hz-btn hz-btn-ghost hz-btn-sm" href={active.payment_metadata.receipt_url} target="_blank" rel="noreferrer" style={{ marginTop: 12 }}>
                  Open Square receipt
                </a>
              )}
              <IntakeMetadataPanel title="MCA intake details" metadata={active.intake_metadata}/>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 18 }}>
                <Select label="Move to class / program" value={assignmentClassId} onChange={setAssignmentClassId} options={assistedClassOptions}/>
                <Input label="Decision / move reason" value={decisionReason} onChange={setDecisionReason}/>
              </div>

              <div style={{ marginTop: 18, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="hz-btn hz-btn-primary" disabled={!!busyDecision} onClick={() => decide('accepted')}>{busyDecision === 'accepted' ? 'Saving...' : 'Accept'}</button>
                <button className="hz-btn" disabled={!!busyDecision} onClick={() => decide('accepted', { payment_status: 'comped' })}>{busyDecision === 'comped' ? 'Saving...' : 'Comp'}</button>
                <button className="hz-btn" disabled={!!busyDecision} onClick={() => decide('waitlist')}>{busyDecision === 'waitlist' ? 'Saving...' : 'Waitlist'}</button>
                <button className="hz-btn hz-btn-ghost" disabled={!!busyDecision} onClick={() => decide('rejected')}>{busyDecision === 'rejected' ? 'Saving...' : 'Reject'}</button>
                <button className="hz-btn" disabled={!!busyDecision} onClick={() => decide(active.status || 'pending')}>{busyDecision === (active.status || 'pending') ? 'Saving...' : 'Save class / reason'}</button>
                {!isSettledRegistrationPayment(active.payment_status) && (
                  <button className="hz-btn" disabled={!!reminderBusy} onClick={() => sendPaymentReminders([active.id], active.id)}>
                    {reminderBusy === active.id ? 'Preparing...' : 'Send payment follow-up'}
                  </button>
                )}
              </div>
              {decisionError && <div style={{ marginTop: 10, color: 'var(--hz-pink)', fontSize: 13 }}>{decisionError}</div>}

              <div style={{ marginTop: 18 }}>
                <div className="hz-eyebrow" style={{ marginBottom: 8 }}>Decision notes</div>
                <textarea className="hz-input" rows="6" placeholder="What stood out? Who follows up next? Any placement notes?" value={notes} onChange={(e) => setNotes(e.target.value)}/>
                <div style={{ marginTop: 10 }}>
                  <button className="hz-btn" disabled={!!busyDecision} onClick={saveNotes}>{busyDecision === 'notes' ? 'Saving...' : 'Save notes'}</button>
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
function paymentSummary(row) {
  if (!row) return '—';
  if (row.payment_status === 'paid') {
    const amount = Number(row.amount_paid_cents || 0) / 100;
    return `${amount ? moneyFmt(amount) : 'Paid'}${row.payment_provider ? ` via ${row.payment_provider}` : ''}`;
  }
  if (row.payment_status === 'comped') return 'Comped';
  if (row.payment_status === 'failed') return 'Failed';
  if (row.payment_status === 'pending') return 'Payment pending';
  return 'Unpaid';
}
function PaymentStatusBadge({ row }) {
  if (!row || row.payment_status === 'none' || !row.payment_status) return null;
  const paid = isSettledRegistrationPayment(row.payment_status);
  const failed = row.payment_status === 'failed';
  const fg = paid ? 'var(--hz-green)' : failed ? 'var(--hz-pink)' : 'var(--hz-amber)';
  const bg = paid ? 'rgba(63,231,160,0.14)' : failed ? 'rgba(249,127,172,0.14)' : 'rgba(255,180,84,0.12)';
  return (
    <span style={{ color: fg, background: bg, padding: '4px 10px', borderRadius: 999, fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
      {row.payment_status}
    </span>
  );
}
function IntakeMetadataPanel({ title = 'Intake details', metadata }) {
  if (!metadata || (typeof metadata === 'object' && Object.keys(metadata).length === 0)) return null;
  let text = '';
  try {
    text = JSON.stringify(metadata, null, 2);
  } catch (_) {
    text = String(metadata);
  }
  return (
    <details style={{ marginTop: 14, padding: 12, borderRadius: 12, border: '1px solid var(--hz-line)', background: 'rgba(255,255,255,0.025)' }}>
      <summary className="hz-eyebrow" style={{ cursor: 'pointer' }}>{title}</summary>
      <pre style={{ margin: '12px 0 0', whiteSpace: 'pre-wrap', color: 'var(--hz-dim)', fontSize: 11, lineHeight: 1.45, fontFamily: 'var(--hz-mono)' }}>{text}</pre>
    </details>
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
function MedicalBlock({ athleteId, session }) {
  const snap = window.HZsel.cache();
  const athlete = (snap.athletes || []).find(a => a.id === athleteId);
  if (!athlete) return null;
  const { record, contacts, injuries } = window.HZsel.athleteMedical(athleteId);
  const canEdit = medicalEditorCanEdit(session);
  const actorId = session?.actualProfile?.id || session?.profile?.id || session?.user?.id || null;
  const linkedParents = (snap.parent_links || [])
    .filter((link) => link.athlete_id === athleteId)
    .map((link) => ({
      ...link,
      profile: (snap.profiles || []).find((profile) => profile.id === link.parent_id) || null,
    }))
    .filter((link) => link.profile);
  const [medicalForm, setMedicalForm] = _useState({
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
  const [contactForm, setContactForm] = _useState({ name: '', relation: 'Parent', phone: '', email: '', is_primary: contacts.length === 0 });
  const [savingMedical, setSavingMedical] = _useState(false);
  const [savingContact, setSavingContact] = _useState(false);
  const [saveError, setSaveError] = _useState('');

  _useEffect(() => {
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
        athlete_id: athleteId,
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
      const { error } = await upsertPersistedRow('medical_records', payload, 'athlete_id');
      if (error) throw error;
      await refreshAppData('medical_records', 'update');
      window.HZToast?.({ kind: 'success', eyebrow: 'Medical', title: 'Medical info saved', body: `${athlete.display_name} now has updated medical details.` });
    } catch (error) {
      const message = error?.message || 'Could not save medical info.';
      setSaveError(message);
      window.HZToast?.({ kind: 'error', eyebrow: 'Medical', title: 'Save failed', body: message });
    } finally {
      setSavingMedical(false);
    }
  }

  async function addContact() {
    if (!canEdit || savingContact) return;
    if (!contactForm.name.trim() || !contactForm.phone.trim()) {
      const message = 'Contact name and phone are required.';
      setSaveError(message);
      window.HZToast?.({ kind: 'error', eyebrow: 'Medical', title: 'Contact not saved', body: message });
      return;
    }
    setSaveError('');
    setSavingContact(true);
    try {
      const payload = {
        id: window.crypto?.randomUUID?.() || `contact-${Date.now()}`,
        athlete_id: athleteId,
        name: contactForm.name.trim(),
        relation: contactForm.relation.trim() || 'Parent',
        phone: contactForm.phone.trim(),
        email: contactForm.email.trim() || null,
        is_primary: !!contactForm.is_primary,
      };
      const { error } = await insertPersistedRow('emergency_contacts', payload);
      if (error) throw error;
      await refreshAppData('emergency_contacts', 'insert');
      setContactForm({ name: '', relation: 'Parent', phone: '', email: '', is_primary: false });
      window.HZToast?.({ kind: 'success', eyebrow: 'Medical', title: 'Contact added', body: `${payload.name} is now attached to ${athlete.display_name}.` });
    } catch (error) {
      const message = error?.message || 'Could not save emergency contact.';
      setSaveError(message);
      window.HZToast?.({ kind: 'error', eyebrow: 'Medical', title: 'Contact not saved', body: message });
    } finally {
      setSavingContact(false);
    }
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {(linkedParents.length > 0 || canEdit) && (
        <div className="hz-card" style={{ padding: 18 }}>
          <div className="hz-eyebrow" style={{ marginBottom: 8 }}>Linked parents</div>
          {linkedParents.length === 0 && <div style={{ color: 'var(--hz-dim)', fontSize: 13 }}>No linked parent account is attached yet.</div>}
          {linkedParents.map(link => (
            <div key={link.parent_id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px dashed var(--hz-line)' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{link.profile.display_name || link.profile.email || 'Parent account'}</div>
                <div style={{ color: 'var(--hz-dim)', fontSize: 12, marginTop: 2 }}>{link.relation || (link.is_primary ? 'Primary parent' : 'Linked parent')}</div>
              </div>
              <div style={{ textAlign: 'right', fontSize: 13, color: 'var(--hz-teal)' }}>{link.profile.email || 'No email on file'}</div>
            </div>
          ))}
        </div>
      )}

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
        {canEdit && (
          <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <input className="hz-input" placeholder="Parent/contact name" value={contactForm.name} onChange={e => setContactForm(prev => ({ ...prev, name: e.target.value }))}/>
              <input className="hz-input" placeholder="Relation" value={contactForm.relation} onChange={e => setContactForm(prev => ({ ...prev, relation: e.target.value }))}/>
              <input className="hz-input" placeholder="Phone" value={contactForm.phone} onChange={e => setContactForm(prev => ({ ...prev, phone: e.target.value }))}/>
              <input className="hz-input" placeholder="Email" value={contactForm.email} onChange={e => setContactForm(prev => ({ ...prev, email: e.target.value }))}/>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--hz-dim)' }}>
              <input type="checkbox" checked={!!contactForm.is_primary} onChange={e => setContactForm(prev => ({ ...prev, is_primary: e.target.checked }))}/>
              Mark as primary contact
            </label>
            <div>
              <button className="hz-btn hz-btn-primary hz-btn-sm" onClick={addContact} disabled={savingContact}>
                {savingContact ? 'Saving...' : 'Add emergency contact'}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="hz-card" style={{ padding: 18 }}>
        <div className="hz-eyebrow" style={{ marginBottom: 8 }}>Medical info</div>
        {!record && <div style={{ color: 'var(--hz-dim)', fontSize: 13 }}>No medical record on file.</div>}
        {record && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 13 }}>
            <KV label="Blood type" v={record.blood_type || '—'}/>
            <KV label="Allergies"  v={record.allergies || '—'}/>
            <KV label="Meds"       v={record.medications || '—'}/>
            <KV label="Conditions" v={record.conditions || '—'}/>
            <KV label="Insurance"  v={record.insurance_carrier || '—'}/>
            <KV label="Policy #"   v={record.insurance_member_id || '—'}/>
            <KV label="Physician"  v={record.physician_name || '—'}/>
            <KV label="Dr. phone"  v={record.physician_phone || '—'}/>
            <KV label="Last physical" v={record.last_physical || '—'}/>
            <KV label="Notes"      v={record.notes || '—'}/>
          </div>
        )}
        {canEdit && (
          <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <input className="hz-input" placeholder="Blood type" value={medicalForm.blood_type} onChange={e => setMedicalForm(prev => ({ ...prev, blood_type: e.target.value }))}/>
              <input className="hz-input" placeholder="Last physical (YYYY-MM-DD)" value={medicalForm.last_physical} onChange={e => setMedicalForm(prev => ({ ...prev, last_physical: e.target.value }))}/>
              <textarea className="hz-input" rows={2} placeholder="Allergies" value={medicalForm.allergies} onChange={e => setMedicalForm(prev => ({ ...prev, allergies: e.target.value }))}/>
              <textarea className="hz-input" rows={2} placeholder="Medications" value={medicalForm.medications} onChange={e => setMedicalForm(prev => ({ ...prev, medications: e.target.value }))}/>
              <textarea className="hz-input" rows={2} placeholder="Conditions / restrictions" value={medicalForm.conditions} onChange={e => setMedicalForm(prev => ({ ...prev, conditions: e.target.value }))}/>
              <textarea className="hz-input" rows={2} placeholder="Notes" value={medicalForm.notes} onChange={e => setMedicalForm(prev => ({ ...prev, notes: e.target.value }))}/>
              <input className="hz-input" placeholder="Insurance carrier" value={medicalForm.insurance_carrier} onChange={e => setMedicalForm(prev => ({ ...prev, insurance_carrier: e.target.value }))}/>
              <input className="hz-input" placeholder="Policy / member #" value={medicalForm.insurance_member_id} onChange={e => setMedicalForm(prev => ({ ...prev, insurance_member_id: e.target.value }))}/>
              <input className="hz-input" placeholder="Physician" value={medicalForm.physician_name} onChange={e => setMedicalForm(prev => ({ ...prev, physician_name: e.target.value }))}/>
              <input className="hz-input" placeholder="Physician phone" value={medicalForm.physician_phone} onChange={e => setMedicalForm(prev => ({ ...prev, physician_phone: e.target.value }))}/>
            </div>
            <div>
              <button className="hz-btn hz-btn-primary hz-btn-sm" onClick={saveMedical} disabled={savingMedical}>
                {savingMedical ? 'Saving...' : record ? 'Update medical info' : 'Save medical info'}
              </button>
            </div>
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
      {saveError && <div style={{ color: 'var(--hz-pink)', fontSize: 12.5 }}>{saveError}</div>}
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

// Standalone medical hub: staff browse the roster; families see only linked athletes.
function MedicalHub({ snap, session }) {
  const scope = window.HZviewerScope ? window.HZviewerScope(snap, session) : null;
  const effectiveProfile = session?.actualProfile || session?.profile || {};
  const isStaff = ['coach', 'owner'].includes(effectiveProfile.role || '');
  const athletes = isStaff ? (scope?.visibleAthletes?.length ? scope.visibleAthletes : (window.HZsel.programAthletes?.() || [])) : (scope?.visibleAthletes || []);
  const [selectedId, setSelectedId] = _useState(null);
  const soleAthlete = athletes.length === 1 ? athletes.find(Boolean) : null;
  const aid = athletes.find(a => a.id === selectedId)?.id || soleAthlete?.id || null;
  const medicalRows = athletes.map(a => ({ athlete: a, med: window.HZsel.athleteMedical(a.id) }));
  const emergencyCount = medicalRows.reduce((sum, row) => sum + row.med.contacts.length, 0);
  const recordCount = medicalRows.filter(row => row.med.record).length;
  if (!athletes.length) {
    return (
      <EmptyState
        icon="bolt"
        title="No athlete linked yet."
        body="Medical details unlock after this account is linked to a specific athlete."
      />
    );
  }
  return (
    <div>
      <div className="hz-eyebrow">Medical · Emergency info</div>
      <div className="hz-display" style={{ fontSize: 48, lineHeight: 1, marginBottom: 20 }}>
        Safe, <span className="hz-zero">always</span>.
      </div>
      {isStaff && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, marginBottom: 16 }}>
          <StatTile label="Athletes" value={athletes.length} size="md" accent="var(--hz-teal)"/>
          <StatTile label="Medical records" value={recordCount} size="md"/>
          <StatTile label="Emergency contacts" value={emergencyCount} size="md" accent="var(--hz-amber)"/>
        </div>
      )}
      <div style={athletes.length > 1 ? { display: 'grid', gridTemplateColumns: '240px 1fr', gap: 18 } : undefined}>
        {athletes.length > 1 && (
          <aside style={{ maxHeight: 'calc(100vh - 240px)', overflow: 'auto' }}>
            {athletes.map(a => (
              <button key={a.id} onClick={() => setSelectedId(a.id)}
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
        )}
        <section>{aid && <MedicalBlock athleteId={aid} session={session}/>}</section>
      </div>
    </div>
  );
}
window.MedicalHub = MedicalHub;
