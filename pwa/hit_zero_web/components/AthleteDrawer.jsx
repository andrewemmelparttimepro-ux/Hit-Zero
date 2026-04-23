// ─────────────────────────────────────────────────────────────────────────────
// HIT ZERO WEB — Athlete Drawer (tabbed, full-surface)
// Slides in from the right anywhere you click an athlete. This is the "wow"
// moment — one tap, everything about this athlete: skills, medical, uniform,
// billing, timeline. All live via realtime.
// ─────────────────────────────────────────────────────────────────────────────

const { useState: _adUS, useMemo: _adUM } = React;

function AthleteDrawer({ athleteId, snap, onClose, pushToast }) {
  const a = (snap.athletes || []).find(x => x.id === athleteId);
  const [tab, setTab] = _adUS('overview');
  if (!a) return null;

  const readiness  = window.HZsel.athleteReadiness(a.id);
  const summary    = window.HZsel.athleteSkillsSummary(a.id);
  const attendance = window.HZsel.athleteAttendance(a.id);

  const TABS = [
    { id: 'overview', label: 'Overview', icon: 'today' },
    { id: 'skills',   label: 'Skills',   icon: 'skills' },
    { id: 'medical',  label: 'Medical',  icon: 'bolt' },
    { id: 'uniform',  label: 'Uniform',  icon: 'roster' },
    { id: 'billing',  label: 'Billing',  icon: 'billing' },
    { id: 'timeline', label: 'Timeline', icon: 'megaphone' },
  ];

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose}></div>
      <div className="drawer hz-scroll">
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
          <div className="hz-eyebrow">Athlete</div>
          <button className="hz-btn hz-btn-ghost hz-btn-sm" onClick={onClose} aria-label="Close">
            <window.HZIcon name="x" size={14}/>
          </button>
        </div>

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
          <MiniStat label="Readiness"  value={Math.round(readiness*100) + '%'} accent="var(--hz-teal)"/>
          <MiniStat label="Attendance" value={Math.round(attendance.pct*100) + '%'} sub={attendance.attended + '/' + attendance.total}/>
          <MiniStat label="Mastered"   value={summary.mastered} sub={(summary.got + summary.mastered) + '/' + summary.total + ' have it'} accent="var(--hz-pink)"/>
        </div>

        {/* Tabs */}
        <div className="ad-tabs">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={'ad-tab' + (tab === t.id ? ' active' : '')}
              aria-current={tab === t.id}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ marginTop: 20 }}>
          {tab === 'overview' && <OverviewTab a={a} snap={snap}/>}
          {tab === 'skills'   && <SkillsTab   a={a} snap={snap}/>}
          {tab === 'medical'  && <MedicalTab  a={a}/>}
          {tab === 'uniform'  && <UniformTab  a={a} snap={snap}/>}
          {tab === 'billing'  && <BillingTab  a={a}/>}
          {tab === 'timeline' && <TimelineTab a={a} snap={snap}/>}
        </div>
      </div>
    </>
  );
}
window.AthleteDrawer = AthleteDrawer;

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
function SkillsTab({ a, snap }) {
  const skillsByCat = {};
  (snap.skills || []).forEach(s => {
    (skillsByCat[s.category] ||= []).push(s);
  });
  Object.values(skillsByCat).forEach(arr => arr.sort((x, y) => x.level - y.level));

  const statusMap = {};
  (snap.athlete_skills || []).filter(x => x.athlete_id === a.id).forEach(r => { statusMap[r.skill_id] = r.status; });

  const cycle = async (skillId) => {
    const order = ['none','working','got_it','mastered'];
    const cur = statusMap[skillId] || 'none';
    const next = order[(order.indexOf(cur) + 1) % order.length];
    await window.HZdb.from('athlete_skills')
      .upsert({ athlete_id: a.id, skill_id: skillId, status: next, updated_at: new Date().toISOString() }, { onConflict: 'athlete_id,skill_id' });
  };

  const CAT_ORDER = ['standing_tumbling','running_tumbling','jumps','stunts','pyramids','baskets'];
  const CAT_LABEL = { standing_tumbling: 'Standing Tumbling', running_tumbling: 'Running Tumbling', jumps: 'Jumps', stunts: 'Stunts', pyramids: 'Pyramids', baskets: 'Baskets' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {CAT_ORDER.map(cat => (
        <div key={cat}>
          <div className="hz-eyebrow" style={{ marginBottom: 8 }}>{CAT_LABEL[cat]}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {(skillsByCat[cat] || []).map(s => {
              const st = statusMap[s.id] || 'none';
              return (
                <div key={s.id} onClick={() => cycle(s.id)}
                  style={{
                    padding: '6px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
                    background: st === 'mastered' ? 'linear-gradient(135deg, rgba(39,207,215,0.3), rgba(249,127,172,0.3))'
                      : st === 'got_it' ? 'rgba(39,207,215,0.18)'
                      : st === 'working' ? 'rgba(255,180,84,0.16)'
                      : 'rgba(255,255,255,0.04)',
                    color: st === 'mastered' ? '#fff'
                      : st === 'got_it' ? 'var(--hz-teal)'
                      : st === 'working' ? 'var(--hz-amber)'
                      : 'var(--hz-dim)',
                    border: st === 'mastered' ? '1px solid rgba(249,127,172,0.3)' : '1px solid transparent',
                  }}
                  title={s.name + ' · Level ' + s.level + ' — click to cycle'}>
                  <span style={{ opacity: 0.6, fontFamily: 'var(--hz-mono)', fontSize: 9, marginRight: 6 }}>L{s.level}</span>
                  {s.name}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Medical tab ──────────────────────────────────────────────────────────
function MedicalTab({ a }) {
  const { record, contacts, injuries } = window.HZsel.athleteMedical(a.id);
  return (
    <div style={{ display: 'grid', gap: 14 }}>
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
            <KV label="Physician"     v={record.physician_name || '—'}/>
            <KV label="Dr. phone"     v={record.physician_phone || '—'}/>
            <KV label="Last physical" v={record.last_physical || '—'}/>
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
  if (!b) return <div className="hz-card" style={{ padding: 24, color: 'var(--hz-dim)', fontSize: 13, textAlign: 'center' }}>No billing account yet.</div>;
  const paidPct = Math.min(100, Math.round((b.account.paid / b.account.season_total) * 100));
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div className="hz-card" style={{ padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <div className="hz-eyebrow">Balance</div>
            <div className="hz-display" style={{ fontSize: 32, color: b.account.owed > 0 ? 'var(--hz-amber)' : 'var(--hz-green)', marginTop: 2 }}>
              {b.account.owed > 0 ? '$' + b.account.owed : 'Paid'}
            </div>
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

      {b.charges.length > 0 && (
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
  return (
    <div className="hz-card hz-card-dense" style={{ padding: '12px 12px' }}>
      <div className="hz-eyebrow" style={{ fontSize: 9 }}>{label}</div>
      <div className="hz-display" style={{ fontSize: 24, marginTop: 2, color: accent || '#fff' }}>{value}</div>
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
