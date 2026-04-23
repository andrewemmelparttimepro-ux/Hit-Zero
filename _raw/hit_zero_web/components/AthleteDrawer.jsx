// ─────────────────────────────────────────────────────────────────────────────
// HIT ZERO WEB — Athlete Drawer
// Slides in from the right anywhere you click an athlete. Shows skills,
// attendance, billing, quick actions. Self-updating via realtime.
// ─────────────────────────────────────────────────────────────────────────────

function AthleteDrawer({ athleteId, snap, onClose, pushToast }) {
  const a = snap.athletes.find(x => x.id === athleteId);
  if (!a) return null;

  const skillsByCat = {};
  snap.skills.forEach(s => {
    skillsByCat[s.category] = skillsByCat[s.category] || [];
    skillsByCat[s.category].push(s);
  });
  Object.values(skillsByCat).forEach(arr => arr.sort((x, y) => x.level - y.level));

  const statusMap = {};
  (snap.athlete_skills || []).filter(x => x.athlete_id === a.id).forEach(r => { statusMap[r.skill_id] = r.status; });

  const readiness = window.HZsel.athleteReadiness(a.id);
  const summary = window.HZsel.athleteSkillsSummary(a.id);
  const attendance = window.HZsel.athleteAttendance(a.id);
  const billing = window.HZsel.athleteBilling(a.id);

  const cycle = async (skillId) => {
    const order = ['none','working','got_it','mastered'];
    const cur = statusMap[skillId] || 'none';
    const next = order[(order.indexOf(cur) + 1) % order.length];
    await window.HZdb.from('athlete_skills')
      .upsert({ athlete_id: a.id, skill_id: skillId, status: next, updated_at: new Date().toISOString() }, { onConflict: 'athlete_id,skill_id' });
  };

  const CAT_ORDER = ['standing_tumbling','running_tumbling','jumps','stunts','pyramids','baskets'];
  const CAT_LABEL = {
    standing_tumbling: 'Standing Tumbling', running_tumbling: 'Running Tumbling',
    jumps: 'Jumps', stunts: 'Stunts', pyramids: 'Pyramids', baskets: 'Baskets',
  };

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose}></div>
      <div className="drawer hz-scroll">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div className="hz-eyebrow">Athlete</div>
          <button className="hz-btn hz-btn-ghost hz-btn-sm" onClick={onClose}><HZIcon name="x" size={14}/></button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 28 }}>
          <Avatar name={a.display_name} initials={a.initials} color={a.photo_color} size={72}/>
          <div>
            <div className="hz-display" style={{ fontSize: 44 }}>{a.display_name}</div>
            <div style={{ color: 'var(--hz-dim)', fontSize: 13, marginTop: 4, textTransform: 'capitalize' }}>
              {a.role} · Age {a.age} · joined {new Date(a.joined_at).toLocaleString('default', { month: 'short', year: 'numeric' })}
            </div>
          </div>
        </div>

        {/* Stat row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 28 }}>
          <MiniStat label="Readiness" value={`${Math.round(readiness*100)}%`} accent="var(--hz-teal)"/>
          <MiniStat label="Attendance" value={`${Math.round(attendance.pct*100)}%`} sub={`${attendance.attended}/${attendance.total} sessions`}/>
          <MiniStat label="Mastered" value={summary.mastered} sub={`${summary.got + summary.mastered}/${summary.total} have it`} accent="var(--hz-pink)"/>
        </div>

        {/* Skill tree */}
        <div className="hz-eyebrow" style={{ marginBottom: 10 }}>Skill Tree</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 28 }}>
          {CAT_ORDER.map(cat => (
            <div key={cat}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--hz-dim)', marginBottom: 8, textTransform: 'uppercase' }}>{CAT_LABEL[cat]}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {(skillsByCat[cat] || []).map(s => {
                  const st = statusMap[s.id] || 'none';
                  return (
                    <div
                      key={s.id}
                      onClick={() => cycle(s.id)}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 6,
                        fontSize: 11,
                        cursor: 'pointer',
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
                      title={`${s.name} — Level ${s.level} — click to cycle`}
                    >
                      <span style={{ opacity: 0.6, fontFamily: 'var(--hz-mono)', fontSize: 9, marginRight: 6 }}>L{s.level}</span>
                      {s.name}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Billing */}
        {billing && (
          <>
            <div className="hz-eyebrow" style={{ marginBottom: 10 }}>Billing</div>
            <div className="hz-card hz-card-dense" style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--hz-dim)' }}>Balance</div>
                  <div className="hz-display" style={{ fontSize: 32, color: billing.account.owed > 0 ? 'var(--hz-amber)' : 'var(--hz-green)' }}>
                    {billing.account.owed > 0 ? `$${billing.account.owed}` : 'Paid'}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: 'var(--hz-dim)' }}>Season ${billing.account.season_total}</div>
                  <div style={{ fontSize: 11, color: 'var(--hz-dim)', marginTop: 2 }}>Paid ${billing.account.paid}</div>
                </div>
              </div>
              <div style={{ height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${(billing.account.paid/billing.account.season_total)*100}%`, height: '100%', background: 'linear-gradient(90deg, var(--hz-teal), var(--hz-pink))' }}/>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function MiniStat({ label, value, sub, accent }) {
  return (
    <div className="hz-card hz-card-dense" style={{ padding: '14px 14px' }}>
      <div className="hz-eyebrow" style={{ fontSize: 9 }}>{label}</div>
      <div className="hz-display" style={{ fontSize: 26, marginTop: 2, color: accent || '#fff' }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: 'var(--hz-dim)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

window.AthleteDrawer = AthleteDrawer;
