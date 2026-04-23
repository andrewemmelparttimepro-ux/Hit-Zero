// ─────────────────────────────────────────────────────────────────────────────
// HIT ZERO WEB — Athlete Reel + Skill Tree + Parent Dashboard + rest of screens
// ─────────────────────────────────────────────────────────────────────────────

// ─── Athlete Reel: personal wins feed, next goals ───
function AthleteReel({ snap, session, navigate }) {
  // For demo: use Kenzie (a01) if the current user has no linked athlete
  const myAthlete = snap.athletes.find(a => a.id === 'a01') || snap.athletes[0];
  const readiness = window.HZsel.athleteReadiness(myAthlete.id);
  const summary = window.HZsel.athleteSkillsSummary(myAthlete.id);
  const attendance = window.HZsel.athleteAttendance(myAthlete.id);
  const myCels = (snap.celebrations || []).filter(c => c.athlete_id === myAthlete.id).slice(0, 6);
  const statusMap = {};
  (snap.athlete_skills || []).filter(r => r.athlete_id === myAthlete.id).forEach(r => { statusMap[r.skill_id] = r.status; });
  const nextUp = snap.skills.filter(s => s.level <= 4 && (statusMap[s.id] === 'working' || !statusMap[s.id])).slice(0, 5);

  return (
    <div>
      <div style={{ marginBottom: 40 }}>
        <div className="hz-eyebrow" style={{ marginBottom: 10 }}>My reel · Magic</div>
        <div className="hz-display" style={{ fontSize: 72, lineHeight: 0.9 }}>
          Hey {myAthlete.display_name.split(' ')[0]}.<br/>Look at you <span className="hz-zero">go</span>.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 24, marginBottom: 24 }}>
        <div className="hz-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 32 }}>
          <Avatar name={myAthlete.display_name} initials={myAthlete.initials} color={myAthlete.photo_color} size={96}/>
          <div className="hz-display" style={{ fontSize: 32, marginTop: 18 }}>{myAthlete.display_name}</div>
          <div style={{ color: 'var(--hz-dim)', fontSize: 12, marginTop: 6, textTransform: 'capitalize' }}>{myAthlete.role} · Age {myAthlete.age}</div>
          <Dial value={readiness} size={180} label="My Readiness"/>
        </div>

        <div className="hz-card">
          <div className="hz-eyebrow" style={{ marginBottom: 14 }}>Recent wins</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {myCels.length === 0 && <div style={{ color: 'var(--hz-dim)', padding: 20, fontSize: 13 }}>Your wins will show up here.</div>}
            {myCels.map(c => {
              const mins = Math.round((Date.now() - new Date(c.created_at).getTime()) / 60000);
              const label = mins < 60 ? `${mins}m` : mins < 60*24 ? `${Math.round(mins/60)}h` : `${Math.round(mins/(60*24))}d`;
              return (
                <div key={c.id} className="celebration">
                  <HZIcon name={c.to_status === 'mastered' ? 'star' : 'bolt'} size={22} color={c.to_status === 'mastered' ? 'var(--hz-pink)' : 'var(--hz-teal)'}/>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>{c.headline}</div>
                    <div style={{ fontSize: 10, color: 'var(--hz-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginTop: 2 }}>{label} ago</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 24 }}>
        <StatTile label="Mastered" value={summary.mastered} sub="career skills" accent="var(--hz-pink)" size="md"/>
        <StatTile label="Got It" value={summary.got} sub="solid in routine" accent="var(--hz-teal)" size="md"/>
        <StatTile label="Attendance" value={`${Math.round(attendance.pct*100)}%`} sub={`${attendance.attended} / ${attendance.total} sessions`} size="md"/>
      </div>

      <div className="hz-card">
        <div className="hz-eyebrow" style={{ marginBottom: 14 }}>What's next</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {nextUp.map(s => (
            <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{s.name}</div>
                <div style={{ fontSize: 10, color: 'var(--hz-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>{s.category.replace('_',' ')} · L{s.level}</div>
              </div>
              <StatusChip status={statusMap[s.id] || 'none'}/>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
window.AthleteReel = AthleteReel;

// ─── Skill Tree: athlete-scoped, full USASF ───
function SkillTree({ snap, session }) {
  const myAthlete = snap.athletes.find(a => a.id === 'a01') || snap.athletes[0];
  const cats = ['standing_tumbling','running_tumbling','jumps','stunts','pyramids','baskets'];
  const CAT_LABEL = { standing_tumbling: 'Standing Tumbling', running_tumbling: 'Running Tumbling', jumps: 'Jumps', stunts: 'Stunts', pyramids: 'Pyramids', baskets: 'Baskets' };
  const statusMap = {};
  (snap.athlete_skills || []).filter(r => r.athlete_id === myAthlete.id).forEach(r => { statusMap[r.skill_id] = r.status; });

  return (
    <div>
      <SectionHeading eyebrow={myAthlete.display_name} title="My skill tree." trailing={<Pill tone="teal">{Object.values(statusMap).filter(s => s === 'mastered' || s === 'got_it').length} solid</Pill>}/>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {cats.map(cat => {
          const cSkills = snap.skills.filter(s => s.category === cat).sort((a,b) => a.level - b.level);
          return (
            <div key={cat} className="hz-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
                <div className="hz-display" style={{ fontSize: 24 }}>{CAT_LABEL[cat]}</div>
                <div style={{ fontSize: 11, color: 'var(--hz-dim)' }}>{cSkills.filter(s => ['got_it','mastered'].includes(statusMap[s.id])).length} / {cSkills.length}</div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {cSkills.map(s => {
                  const st = statusMap[s.id] || 'none';
                  return (
                    <div key={s.id} style={{
                      padding: '8px 14px', borderRadius: 8, fontSize: 12,
                      background: st === 'mastered' ? 'linear-gradient(135deg, rgba(39,207,215,0.3), rgba(249,127,172,0.3))'
                        : st === 'got_it' ? 'rgba(39,207,215,0.18)'
                        : st === 'working' ? 'rgba(255,180,84,0.16)'
                        : 'rgba(255,255,255,0.04)',
                      color: st === 'none' ? 'var(--hz-dim)' : '#fff',
                    }}>
                      <span style={{ fontFamily: 'var(--hz-mono)', fontSize: 10, opacity: 0.6, marginRight: 6 }}>L{s.level}</span>
                      {s.name}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
window.SkillTree = SkillTree;

// ─── Parent Dashboard ───
function ParentDashboard({ snap, session, navigate }) {
  const links = (snap.parent_links || []).filter(l => l.parent_id === session.profile.id);
  const myKids = links.length > 0 ? links.map(l => snap.athletes.find(a => a.id === l.athlete_id)).filter(Boolean) : [snap.athletes[0]];

  return (
    <div>
      <div style={{ marginBottom: 40 }}>
        <div className="hz-eyebrow" style={{ marginBottom: 10 }}>The Rhodes family · Magic</div>
        <div className="hz-display" style={{ fontSize: 64, lineHeight: 0.9 }}>
          {myKids[0].display_name.split(' ')[0]} had a <span className="hz-zero">great</span> week.
        </div>
      </div>

      {myKids.map(kid => {
        const readiness = window.HZsel.athleteReadiness(kid.id);
        const attendance = window.HZsel.athleteAttendance(kid.id);
        const summary = window.HZsel.athleteSkillsSummary(kid.id);
        const billing = window.HZsel.athleteBilling(kid.id);
        const kidCels = (snap.celebrations || []).filter(c => c.athlete_id === kid.id).slice(0, 4);

        return (
          <div key={kid.id} style={{ marginBottom: 32 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              <div className="hz-card">
                <div style={{ display: 'flex', gap: 18, marginBottom: 20 }}>
                  <Avatar name={kid.display_name} initials={kid.initials} color={kid.photo_color} size={64}/>
                  <div>
                    <div className="hz-display" style={{ fontSize: 30 }}>{kid.display_name}</div>
                    <div style={{ fontSize: 12, color: 'var(--hz-dim)', textTransform: 'capitalize', marginTop: 2 }}>{kid.role} · Age {kid.age}</div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                  <MiniBox label="Ready" value={`${Math.round(readiness*100)}%`} accent="var(--hz-teal)"/>
                  <MiniBox label="Attend" value={`${Math.round(attendance.pct*100)}%`}/>
                  <MiniBox label="Mastered" value={summary.mastered} accent="var(--hz-pink)"/>
                </div>
              </div>

              <div className="hz-card">
                <div className="hz-eyebrow" style={{ marginBottom: 14 }}>Wins to brag about</div>
                {kidCels.length === 0 && <div style={{ color: 'var(--hz-dim)', fontSize: 13, padding: 20, textAlign: 'center' }}>Wins will appear here as they happen.</div>}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {kidCels.map(c => (
                    <div key={c.id} style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(249,127,172,0.06)', display: 'flex', alignItems: 'center', gap: 12 }}>
                      <HZIcon name={c.to_status === 'mastered' ? 'star' : 'bolt'} size={18} color={c.to_status === 'mastered' ? 'var(--hz-pink)' : 'var(--hz-teal)'}/>
                      <div style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{c.headline}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {billing && (
              <div className="hz-card" style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div className="hz-eyebrow">Season balance</div>
                    <div className="hz-display" style={{ fontSize: 40, color: billing.account.owed > 0 ? 'var(--hz-amber)' : 'var(--hz-green)', marginTop: 4 }}>
                      {billing.account.owed > 0 ? `$${billing.account.owed}` : 'Paid in full'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--hz-dim)', marginTop: 4 }}>
                      ${billing.account.paid} of ${billing.account.season_total} paid
                    </div>
                  </div>
                  <button className="hz-btn hz-btn-primary" onClick={() => navigate('billing')}>Manage billing <HZIcon name="arrow-right" size={13}/></button>
                </div>
                <div style={{ height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden', marginTop: 14 }}>
                  <div style={{ width: `${(billing.account.paid/billing.account.season_total)*100}%`, height: '100%', background: 'linear-gradient(90deg, var(--hz-teal), var(--hz-pink))' }}/>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Announcements */}
      <div className="hz-card">
        <div className="hz-eyebrow" style={{ marginBottom: 14 }}>From the gym</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(snap.announcements || []).slice(0, 3).map(a => (
            <div key={a.id} style={{ padding: 14, background: 'rgba(255,255,255,0.03)', borderRadius: 10 }}>
              {a.pinned && <Pill tone="pink" style={{ marginBottom: 6 }}>Pinned</Pill>}
              <div style={{ fontWeight: 600, fontSize: 14 }}>{a.title}</div>
              <div style={{ fontSize: 12.5, color: 'var(--hz-dim)', marginTop: 4, lineHeight: 1.5 }}>{a.body}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
function MiniBox({ label, value, accent }) {
  return (
    <div style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
      <div style={{ fontSize: 9, color: 'var(--hz-dim)', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700 }}>{label}</div>
      <div className="hz-display" style={{ fontSize: 22, color: accent || '#fff', marginTop: 2 }}>{value}</div>
    </div>
  );
}
window.ParentDashboard = ParentDashboard;

// ─── Sessions (schedule) ───
function Sessions({ snap }) {
  const sessions = [...(snap.sessions || [])].sort((a,b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));
  return (
    <div>
      <SectionHeading eyebrow="2025 season" title="Schedule."/>
      <div className="hz-card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="hz-table">
          <thead><tr><th style={{ paddingLeft: 20 }}>Date</th><th>Type</th><th>Duration</th><th>Attendance</th><th></th></tr></thead>
          <tbody>
            {sessions.map(s => {
              const d = new Date(s.scheduled_at);
              const att = (snap.attendance || []).filter(a => a.session_id === s.id && a.status === 'present').length;
              return (
                <tr key={s.id}>
                  <td style={{ paddingLeft: 20 }}>
                    <div style={{ fontWeight: 600 }}>{d.toLocaleDateString('default', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                    <div style={{ fontSize: 11, color: 'var(--hz-dim)', fontFamily: 'var(--hz-mono)' }}>{d.toLocaleTimeString('default', { hour: 'numeric', minute: '2-digit' })}</div>
                  </td>
                  <td><span style={{ fontWeight: 600 }}>{s.type}</span>{s.is_competition && <Pill tone="pink" style={{ marginLeft: 10 }}>COMP</Pill>}</td>
                  <td style={{ fontFamily: 'var(--hz-mono)', color: 'var(--hz-dim)' }}>{s.duration_min}m</td>
                  <td style={{ fontFamily: 'var(--hz-mono)' }}>{att}/{snap.athletes.length}</td>
                  <td>{d > new Date() ? <Pill tone="teal">Upcoming</Pill> : <span style={{ color: 'var(--hz-dim)', fontSize: 11 }}>Done</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
window.Sessions = Sessions;

// ─── Announcements ───
function Announcements({ snap, session }) {
  const [draft, setDraft] = React.useState({ title: '', body: '' });
  const canPost = ['coach','owner'].includes(session.profile.role);

  const post = async () => {
    if (!draft.title.trim()) return;
    await window.HZdb.from('announcements').insert({
      program_id: 'p_mca', audience: 'all', title: draft.title, body: draft.body,
      pinned: false, created_by: session.profile.id, created_at: new Date().toISOString(),
    });
    setDraft({ title: '', body: '' });
  };

  return (
    <div>
      <SectionHeading eyebrow="Gym feed" title="Announcements."/>
      {canPost && (
        <div className="hz-card" style={{ marginBottom: 24 }}>
          <div className="hz-eyebrow" style={{ marginBottom: 10 }}>Post something</div>
          <input className="hz-input" placeholder="Title" value={draft.title} onChange={e => setDraft({...draft, title: e.target.value})} style={{ marginBottom: 10 }}/>
          <textarea className="hz-input" rows="3" placeholder="Details — everyone sees this." value={draft.body} onChange={e => setDraft({...draft, body: e.target.value})}/>
          <div style={{ marginTop: 10, textAlign: 'right' }}>
            <button className="hz-btn hz-btn-primary" onClick={post}>Post</button>
          </div>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {(snap.announcements || []).slice().sort((a,b) => new Date(b.created_at) - new Date(a.created_at)).map(a => (
          <div key={a.id} className="hz-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                {a.pinned && <Pill tone="pink">Pinned</Pill>}
                <div className="hz-eyebrow">{new Date(a.created_at).toLocaleDateString('default', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
              </div>
              <Pill>{a.audience}</Pill>
            </div>
            <div className="hz-display" style={{ fontSize: 28, marginBottom: 8 }}>{a.title}</div>
            <div style={{ color: 'var(--hz-dim)', fontSize: 14, lineHeight: 1.55 }}>{a.body}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
window.Announcements = Announcements;

// ─── Admin / Program Console ───
function AdminConsole({ snap, navigate }) {
  const bill = window.HZsel.programBilling();
  const readiness = window.HZsel.teamReadiness();
  const attendance = window.HZsel.teamAttendance();

  return (
    <div>
      <SectionHeading eyebrow="Owner · Magic City Allstars" title="Program." trailing={
        <button className="hz-btn hz-btn-danger" onClick={() => { if (confirm('Reset all demo data?')) { window.HZdb._reset(); location.reload(); } }}><HZIcon name="trash" size={13}/> Reset demo data</button>
      }/>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <StatTile label="Athletes" value={snap.athletes.length} sub="across all teams"/>
        <StatTile label="Ready" value={`${Math.round(readiness*100)}%`} accent="var(--hz-teal)"/>
        <StatTile label="Attendance" value={`${Math.round(attendance*100)}%`}/>
        <StatTile label="Outstanding" value={`$${bill.owed.toLocaleString()}`} accent={bill.owed > 0 ? 'var(--hz-amber)' : 'var(--hz-green)'} sub={`${bill.delinquent} accounts`}/>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div className="hz-card">
          <div className="hz-eyebrow" style={{ marginBottom: 14 }}>Revenue · Season</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 14 }}>
            <div className="hz-display" style={{ fontSize: 60 }}>${(bill.paid/1000).toFixed(1)}<span style={{ fontSize: 28 }}>k</span></div>
            <div style={{ color: 'var(--hz-dim)' }}>of ${(bill.total/1000).toFixed(1)}k</div>
          </div>
          <div style={{ height: 12, background: 'rgba(255,255,255,0.05)', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ width: `${(bill.paid/bill.total)*100}%`, height: '100%', background: 'linear-gradient(90deg, var(--hz-teal), var(--hz-pink))' }}/>
          </div>
          <div style={{ display: 'flex', gap: 20, marginTop: 14, fontSize: 12, color: 'var(--hz-dim)' }}>
            <div>Paid <span style={{ color: 'var(--hz-green)', fontFamily: 'var(--hz-mono)', fontWeight: 700 }}>${bill.paid.toLocaleString()}</span></div>
            <div>Owed <span style={{ color: 'var(--hz-amber)', fontFamily: 'var(--hz-mono)', fontWeight: 700 }}>${bill.owed.toLocaleString()}</span></div>
          </div>
        </div>
        <div className="hz-card">
          <div className="hz-eyebrow" style={{ marginBottom: 14 }}>Quick actions</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button className="hz-btn" onClick={() => navigate('roster')} style={{ justifyContent: 'space-between' }}>Manage roster <HZIcon name="arrow-right" size={13}/></button>
            <button className="hz-btn" onClick={() => navigate('billing')} style={{ justifyContent: 'space-between' }}>Review billing <HZIcon name="arrow-right" size={13}/></button>
            <button className="hz-btn" onClick={() => navigate('messages')} style={{ justifyContent: 'space-between' }}>Post announcement <HZIcon name="arrow-right" size={13}/></button>
            <button className="hz-btn" onClick={() => navigate('score')} style={{ justifyContent: 'space-between' }}>Run mock score <HZIcon name="arrow-right" size={13}/></button>
          </div>
        </div>
      </div>
    </div>
  );
}
window.AdminConsole = AdminConsole;

// ─── Billing ───
function Billing({ snap, session, openAthlete }) {
  const bill = window.HZsel.programBilling();
  const isParent = session.profile.role === 'parent';
  const accounts = (snap.billing_accounts || []).map(acc => ({ ...acc, athlete: snap.athletes.find(a => a.id === acc.athlete_id) }));

  return (
    <div>
      <SectionHeading eyebrow={isParent ? 'My family' : 'Program billing'} title="Billing."/>
      {!isParent && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
          <StatTile label="Collected" value={`$${bill.paid.toLocaleString()}`} accent="var(--hz-green)" size="md"/>
          <StatTile label="Outstanding" value={`$${bill.owed.toLocaleString()}`} accent="var(--hz-amber)" size="md"/>
          <StatTile label="Past Due" value={bill.delinquent} sub={`of ${bill.nAccounts} accounts`} size="md"/>
        </div>
      )}
      <div className="hz-card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="hz-table">
          <thead><tr><th style={{ paddingLeft: 20 }}>Athlete</th><th>Season</th><th>Paid</th><th>Balance</th><th>Autopay</th></tr></thead>
          <tbody>
            {accounts.map(a => (
              <tr key={a.id} onClick={() => openAthlete && openAthlete(a.athlete_id)} style={{ cursor: 'pointer' }}>
                <td style={{ paddingLeft: 20 }}>
                  {a.athlete && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Avatar name={a.athlete.display_name} initials={a.athlete.initials} color={a.athlete.photo_color} size={28}/>
                      <span style={{ fontWeight: 600 }}>{a.athlete.display_name}</span>
                    </div>
                  )}
                </td>
                <td style={{ fontFamily: 'var(--hz-mono)' }}>${a.season_total}</td>
                <td style={{ fontFamily: 'var(--hz-mono)', color: 'var(--hz-green)' }}>${a.paid}</td>
                <td>{a.owed > 0 ? <Pill tone="amber">${a.owed}</Pill> : <span style={{ color: 'var(--hz-dim)' }}>$0</span>}</td>
                <td>{a.autopay ? <Pill tone="teal">On</Pill> : <span style={{ color: 'var(--hz-dim)', fontSize: 11 }}>Off</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
window.Billing = Billing;
