// ─────────────────────────────────────────────────────────────────────────────
// HIT ZERO WEB — Coach Today
// Desktop dashboard: readiness hero, predicted score, needs-work queue,
// live celebrations feed, today's practice plan, roster pulse.
// ─────────────────────────────────────────────────────────────────────────────

function CoachToday({ snap, openAthlete, navigate, pushToast, session }) {
  // Defensive: don't render until the store has hydrated.
  const athletesArr = (snap && Array.isArray(snap.athletes)) ? snap.athletes : null;
  if (!athletesArr) {
    return (
      <div style={{ padding: 48, color: 'var(--hz-dim)', fontSize: 13 }}>Loading today…</div>
    );
  }

  const safe = (fn, fallback) => { try { const v = fn(); return v == null ? fallback : v; } catch { return fallback; } };
  const readiness      = safe(() => window.HZsel.teamReadiness(), 0);
  const teamAttendance = safe(() => window.HZsel.teamAttendance(), 0);
  const predicted      = safe(() => window.HZsel.predictedScore(), { total: 0, deductions: 0, rows: [] });
  const comp           = safe(() => window.HZsel.daysToComp(), null);
  const needsWork      = safe(() => window.HZsel.needsWorkQueue(), []) || [];
  const today = new Date().toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric' });

  const celebrations = [...(snap.celebrations || [])]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 12);

  const upcoming = [...(snap.sessions || [])]
    .filter(s => new Date(s.scheduled_at) > new Date(Date.now() - 1000 * 60 * 60 * 24))
    .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at))
    .slice(0, 5);

  const mostImproved = [...athletesArr]
    .map(a => ({ a, r: safe(() => window.HZsel.athleteReadiness(a.id), 0) }))
    .sort((x, y) => y.r - x.r)
    .slice(0, 4);

  const needsAttention = [...athletesArr]
    .map(a => ({ a, r: safe(() => window.HZsel.athleteReadiness(a.id), 0), att: safe(() => window.HZsel.athleteAttendance(a.id).pct, 0) }))
    .sort((x, y) => (x.r + x.att) - (y.r + y.att))
    .slice(0, 4);

  return (
    <div>
      {/* Editorial header */}
      <div style={{ marginBottom: 40, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 32 }}>
        <div>
          <div className="hz-eyebrow" style={{ marginBottom: 10 }}>{today}</div>
          <div className="hz-display" style={{ fontSize: 72, lineHeight: 0.9 }}>
            Today we <span className="hz-zero">hit</span> zero.
          </div>
          <div style={{ color: 'var(--hz-dim)', fontSize: 14, marginTop: 14, maxWidth: 540 }}>
            Magic — Senior Coed 4. {comp && comp.days <= 14 ? `${comp.days} days to Dream On. The routine is becoming the routine.` : 'Build every rep like it counts twice.'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="hz-btn" onClick={() => navigate('sessions')}><HZIcon name="calendar" size={14}/> Schedule</button>
          <button className="hz-btn hz-btn-primary" onClick={() => navigate('skills')}><HZIcon name="plus" size={14}/> Check off a skill</button>
        </div>
      </div>

      {/* Hero row — readiness + predicted score */}
      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 24, marginBottom: 24 }}>
        <div className="hz-card" style={{ padding: 30, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <Dial value={readiness} size={180} label="Team Readiness"/>
          <div style={{ marginTop: 20, display: 'flex', gap: 18, fontSize: 11, color: 'var(--hz-dim)' }}>
            <div><span className="hz-teal" style={{ fontFamily: 'var(--hz-mono)', fontWeight: 700 }}>{Math.round(teamAttendance * 100)}%</span> attendance</div>
            <div>·</div>
            <div><span className="hz-pink" style={{ fontFamily: 'var(--hz-mono)', fontWeight: 700 }}>{athletesArr.length}</span> athletes</div>
          </div>
        </div>

        <div className="hz-card" style={{ padding: 30 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
            <div>
              <div className="hz-eyebrow">Predicted Score</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 8 }}>
                <div className="hz-display" style={{ fontSize: 80 }}>
                  {predicted.total.toFixed(1)}
                </div>
                <div style={{ fontSize: 18, color: 'var(--hz-dim)' }}>/ 100</div>
              </div>
              <div style={{ color: 'var(--hz-dim)', fontSize: 12, marginTop: 6 }}>
                If we ran it clean today · {predicted.deductions > 0 ? `−${predicted.deductions.toFixed(2)} deductions` : 'no deductions yet'}
              </div>
            </div>
            <button className="hz-btn hz-btn-sm" onClick={() => navigate('score')}>Open sheet <HZIcon name="arrow-right" size={12}/></button>
          </div>
          {/* Sparkline-ish category bars */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 18 }}>
            {predicted.rows.slice(0, 6).map(r => (
              <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '160px 1fr 60px', gap: 12, alignItems: 'center' }}>
                <div style={{ fontSize: 12, color: 'var(--hz-dim)' }}>{r.label}</div>
                <div style={{ height: 8, background: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{
                    width: `${(r.score / r.max) * 100}%`, height: '100%',
                    background: r.boost < 1 ? 'var(--hz-amber)' : 'linear-gradient(90deg, var(--hz-teal), var(--hz-pink))'
                  }}/>
                </div>
                <div style={{ fontFamily: 'var(--hz-mono)', fontSize: 12, textAlign: 'right' }}>
                  {r.score.toFixed(1)}<span style={{ color: 'var(--hz-dimmer)' }}>/{r.max}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Second row — needs work + live ticker */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
        {/* Needs Work */}
        <div className="hz-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div>
              <div className="hz-eyebrow">Needs Work · Practice Focus</div>
              <div className="hz-display" style={{ fontSize: 22, marginTop: 4 }}>Don't skip these.</div>
            </div>
            <Pill tone="amber">{needsWork.length}</Pill>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {needsWork.map(item => {
              const total = item.working + item.notStarted + item.gotIt + item.mastered;
              return (
                <div key={item.skill.id} onClick={() => navigate('skills')} style={{
                  padding: '12px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.02)',
                  display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 14, alignItems: 'center', cursor: 'pointer',
                  transition: 'background 120ms',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{item.skill.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--hz-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginTop: 3 }}>
                      {item.skill.category.replace('_',' ')} · L{item.skill.level}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {Array(Math.min(6, item.working)).fill(0).map((_,i) => <div key={'w'+i} style={{ width: 6, height: 20, background: 'var(--hz-amber)', borderRadius: 2 }}/>)}
                    {Array(Math.min(6, item.notStarted)).fill(0).map((_,i) => <div key={'n'+i} style={{ width: 6, height: 20, background: 'rgba(255,255,255,0.08)', borderRadius: 2 }}/>)}
                  </div>
                  <div style={{ fontFamily: 'var(--hz-mono)', fontSize: 11, color: 'var(--hz-dim)', minWidth: 52, textAlign: 'right' }}>
                    {item.working + item.notStarted}/{total}
                  </div>
                </div>
              );
            })}
            {needsWork.length === 0 && <EmptyState icon="star" title="Everyone's on pace" body="No skills pulling the team down right now."/>}
          </div>
        </div>

        {/* Live ticker */}
        <div className="hz-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div>
              <div className="hz-eyebrow">Live · Last 24 Hours</div>
              <div className="hz-display" style={{ fontSize: 22, marginTop: 4 }}>The good stuff.</div>
            </div>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--hz-green)', animation: 'hz-pulse-teal 1.6s ease-out infinite' }}/>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 420, overflowY: 'auto' }} className="hz-scroll">
            {celebrations.map(c => {
              const athlete = athletesArr.find(a => a.id === c.athlete_id);
              const mins = Math.round((Date.now() - new Date(c.created_at).getTime()) / 60000);
              const label = mins < 60 ? `${mins}m` : mins < 60*24 ? `${Math.round(mins/60)}h` : `${Math.round(mins/(60*24))}d`;
              return (
                <div key={c.id} className="celebration" onClick={() => athlete && openAthlete(athlete.id)} style={{ cursor: athlete ? 'pointer' : 'default' }}>
                  {athlete && <Avatar name={athlete.display_name} initials={athlete.initials} color={athlete.photo_color} size={36}/>}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{c.headline}</div>
                    <div style={{ fontSize: 10, color: 'var(--hz-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginTop: 3 }}>
                      {c.to_status === 'mastered' ? 'Mastered' : c.to_status === 'got_it' ? 'Got it' : c.kind.replace('_',' ')} · {label} ago
                    </div>
                  </div>
                  {c.to_status === 'mastered' && <HZIcon name="star" size={18} color="var(--hz-pink)"/>}
                </div>
              );
            })}
            {celebrations.length === 0 && <EmptyState icon="bolt" title="No wins yet today" body="Check off a skill to kick things off."/>}
          </div>
        </div>
      </div>

      {/* Third row — upcoming + people */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24 }}>
        <div className="hz-card">
          <div className="hz-eyebrow" style={{ marginBottom: 14 }}>Upcoming</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {upcoming.map(s => {
              const d = new Date(s.scheduled_at);
              return (
                <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '56px 1fr auto', gap: 14, alignItems: 'center' }}>
                  <div style={{ textAlign: 'center', padding: '6px 0', borderRadius: 8, background: s.is_competition ? 'linear-gradient(135deg, rgba(39,207,215,0.2), rgba(249,127,172,0.2))' : 'rgba(255,255,255,0.04)' }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--hz-dim)', textTransform: 'uppercase' }}>{d.toLocaleString('default', { month: 'short' })}</div>
                    <div className="hz-display" style={{ fontSize: 22, lineHeight: 1 }}>{d.getDate()}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{s.type}</div>
                    <div style={{ fontSize: 11, color: 'var(--hz-dim)' }}>{d.toLocaleString('default', { weekday: 'short' })} · {s.duration_min}m</div>
                  </div>
                  {s.is_competition && <Pill tone="pink">COMP</Pill>}
                </div>
              );
            })}
          </div>
        </div>

        <div className="hz-card">
          <div className="hz-eyebrow" style={{ marginBottom: 14 }}>Climbing Fast</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {mostImproved.map(({ a, r }) => (
              <div key={a.id} onClick={() => openAthlete(a.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                <Avatar name={a.display_name} initials={a.initials} color={a.photo_color} size={32}/>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{a.display_name}</div>
                  <div style={{ fontSize: 10, color: 'var(--hz-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>{a.role}</div>
                </div>
                <div style={{ fontFamily: 'var(--hz-serif)', fontStyle: 'italic', fontWeight: 700, fontSize: 22, color: 'var(--hz-teal)' }}>{Math.round(r * 100)}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="hz-card">
          <div className="hz-eyebrow" style={{ marginBottom: 14 }}>Needs a Check-In</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {needsAttention.map(({ a, r, att }) => (
              <div key={a.id} onClick={() => openAthlete(a.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                <Avatar name={a.display_name} initials={a.initials} color={a.photo_color} size={32}/>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{a.display_name}</div>
                  <div style={{ fontSize: 10, color: 'var(--hz-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>
                    {Math.round(att*100)}% att · {Math.round(r*100)}% ready
                  </div>
                </div>
                {att < 0.7 && <Pill tone="amber">LOW</Pill>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
window.CoachToday = CoachToday;
