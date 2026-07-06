// ─────────────────────────────────────────────────────────────────────────────
// HIT ZERO WEB — Coach Today
// Desktop dashboard: readiness hero, predicted score, needs-work queue,
// live celebrations feed, today's practice plan, roster pulse.
// ─────────────────────────────────────────────────────────────────────────────

function cleanCoachSessionType(value) {
  return String(value || 'Session')
    .replace(new RegExp('^competition\\s*:\\s*' + 'dre' + 'am on$', 'i'), 'Competition')
    .replace(new RegExp('\\bdre' + 'am on\\b', 'ig'), 'Competition')
    .replace(/\bbismarck,\s*nd\b/ig, '')
    .trim();
}

function StaffLaunchAlerts({ session, navigate, snap, pushToast }) {
  const [queue, setQueue] = React.useState({ requests: [], unlinked_parents: [] });
  const [loading, setLoading] = React.useState(true);
  const [nudging, setNudging] = React.useState(false);
  const role = session?.actualProfile?.role || session?.profile?.role;
  const canManage = role === 'coach' || role === 'owner';

  // Family packets outstanding — same semantics as the nightly audit
  // (launch-hardening-audit.sql check 6): parents (or self-managed athlete
  // profiles) in the program without a COMPLETE packet on file.
  const packetGaps = React.useMemo(() => {
    const packets = new Map((snap?.family_info_packets || []).map(f => [f.profile_id, f]));
    const parentLinkedAthleteProfiles = new Set(
      (snap?.parent_links || []).map(pl => (snap?.athletes || []).find(a => a.id === pl.athlete_id)?.profile_id).filter(Boolean)
    );
    return (snap?.profiles || []).filter(p => {
      if (!p.program_id) return false;
      const complete = (packets.get(p.id)?.completion_status || 'incomplete') === 'complete';
      if (complete) return false;
      if (p.role === 'parent') return true;
      if (p.role === 'athlete') return !parentLinkedAthleteProfiles.has(p.id);
      return false;
    });
  }, [snap]);

  const nudgePacketFamilies = async () => {
    if (nudging || !packetGaps.length) return;
    setNudging(true);
    const programId = session?.actualProfile?.program_id || session?.profile?.program_id || snap?.programs?.[0]?.id || null;
    const { error } = await window.HZdb.from('announcements').insert({ // followed by HZsel?._refresh + hz:refresh below
      program_id: programId,
      audience: 'parents',
      title: 'Family packet reminder',
      body: 'Quick favor: please finish your family packet (emergency contacts, medical info, and waiver) under Forms in the app. It takes about five minutes and keeps every athlete safe at practice and comps. Thank you!',
      pinned: true,
      created_at: new Date().toISOString(),
      created_by: session?.profile?.id || null,
    });
    if (!error) {
      if (window.HZsel?._refresh) await window.HZsel._refresh();
      window.dispatchEvent(new CustomEvent('hz:refresh', { detail: { table: 'announcements', action: 'insert' } }));
      pushToast?.({ title: 'Reminder posted', body: `Pinned announcement is up for all parents (${packetGaps.length} packet${packetGaps.length === 1 ? '' : 's'} outstanding).` });
    } else {
      pushToast?.({ title: 'Could not post reminder', body: error.message || 'Try again.' });
    }
    setNudging(false);
  };

  React.useEffect(() => {
    let alive = true;
    if (!canManage || !window.HZdb?.auth?.staffLaunchQueue) { setLoading(false); return () => {}; }
    window.HZdb.auth.staffLaunchQueue().then(({ data }) => {
      if (!alive) return;
      setQueue({
        requests: data?.requests || [],
        unlinked_parents: data?.unlinked_parents || [],
      });
      setLoading(false);
    }).catch(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [canManage]);

  const pendingCount = queue.requests.length;
  const linkCount = queue.unlinked_parents.length;
  const packetCount = packetGaps.length;
  if (!canManage || loading || (!pendingCount && !linkCount && !packetCount)) return null;

  return (
    <div className="hz-card" style={{
      marginBottom: 24,
      padding: 18,
      borderColor: 'rgba(255,180,84,0.38)',
      background: 'linear-gradient(135deg, rgba(255,180,84,0.10), rgba(249,127,172,0.08))',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 18,
    }}>
      <div>
        <div className="hz-eyebrow" style={{ color: 'var(--hz-amber)', marginBottom: 6 }}>Action needed</div>
        <div style={{ fontWeight: 900, fontSize: 18 }}>
          {[
            pendingCount ? `${pendingCount} access request${pendingCount === 1 ? '' : 's'} waiting` : null,
            linkCount ? `${linkCount} approved parent${linkCount === 1 ? '' : 's'} need athlete links` : null,
            packetCount ? `${packetCount} family packet${packetCount === 1 ? '' : 's'} outstanding` : null,
          ].filter(Boolean).join(' · ') || 'All caught up'}
        </div>
        <div style={{ color: 'var(--hz-dim)', fontSize: 12, marginTop: 4 }}>
          {packetCount
            ? `Missing packets: ${packetGaps.slice(0, 4).map(p => p.display_name || p.email).join(', ')}${packetCount > 4 ? ` +${packetCount - 4} more` : ''}. Links live under Program → Public launch access.`
            : 'Parent links are managed under Program → Public launch access.'}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {packetCount > 0 && (
          <button className="hz-btn" onClick={nudgePacketFamilies} disabled={nudging}>
            <HZIcon name="megaphone" size={13}/> {nudging ? 'Posting…' : 'Nudge families'}
          </button>
        )}
        <button className="hz-btn hz-btn-primary" onClick={() => navigate('admin')}>
          Review now <HZIcon name="arrow-right" size={13}/>
        </button>
      </div>
    </div>
  );
}

function CoachToday({ snap, openAthlete, navigate, pushToast, session }) {
  // Defensive: don't render until the store has hydrated.
  const athletesArr = (snap && Array.isArray(snap.athletes)) ? snap.athletes : null;
  if (!athletesArr) {
    return (
      <SkeletonCard rows={5} style={{ margin: 48, maxWidth: 620 }} />
    );
  }

  const safe = (fn, fallback) => { try { const v = fn(); return v == null ? fallback : v; } catch { return fallback; } };
  const scope = window.HZviewerScope ? window.HZviewerScope(snap, session) : null;
  const athletes = scope?.visibleAthletes?.length ? scope.visibleAthletes : athletesArr;
  const visibleAthleteIds = new Set(athletes.map(a => a.id));
  const team = scope?.visibleTeams?.[0] || window.HZsel.programTeams?.()[0] || (snap.teams || [])[0] || null;
  const teamLine = team
    ? `${team.name || team.division || 'Team'} — ${team.division || 'Team'}${team.level ? ` L${team.level}` : ''}`
    : 'Team';
  const readiness      = safe(() => window.HZsel.teamReadiness(), 0);
  const teamAttendance = safe(() => window.HZsel.teamAttendance(), 0);
  const predicted      = safe(() => window.HZsel.predictedScore(), { total: 0, deductions: 0, rows: [] });
  const comp           = safe(() => window.HZsel.daysToComp(), null);
  const needsWork      = safe(() => window.HZsel.needsWorkQueue(), []) || [];
  const practicePlans  = safe(() => window.HZsel.allPracticePlans(), []) || [];
  const classEnrollments = safe(() => window.HZsel.classEnrollmentsForProgram(), []) || [];
  const openGymParticipants = safe(() => window.HZsel.openGymRegistrationsForProgram(), []) || [];
  const attendanceRows = (snap.attendance || []).filter(row => visibleAthleteIds.has(row.athlete_id));
  const today = new Date().toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric' });

  const celebrations = [...(snap.celebrations || [])]
    .filter(c => visibleAthleteIds.has(c.athlete_id) && new Date(c.created_at).getTime() >= Date.now() - 1000 * 60 * 60 * 24)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 12);

  const upcoming = safe(() => window.HZsel.staffScheduleSessions(5), []) || [];

  const mostImproved = [...athletes]
    .map(a => ({ a, r: safe(() => window.HZsel.athleteReadiness(a.id), 0) }))
    .sort((x, y) => y.r - x.r)
    .slice(0, 4);

  const needsAttention = [...athletes]
    .map(a => ({ a, r: safe(() => window.HZsel.athleteReadiness(a.id), 0), att: safe(() => window.HZsel.athleteAttendance(a.id).pct, 0) }))
    .sort((x, y) => (x.r + x.att) - (y.r + y.att))
    .slice(0, 4);

  return (
    <div>
      <StaffLaunchAlerts session={session} navigate={navigate} snap={snap} pushToast={pushToast}/>

      {/* Editorial header */}
      <div style={{ marginBottom: 40, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 32 }}>
        <div>
          <div className="hz-eyebrow" style={{ marginBottom: 10 }}>{today}</div>
          <div className="hz-display" style={{ fontSize: 72, lineHeight: 0.9 }}>
            Today we <span className="hz-zero">hit</span> zero.
          </div>
          <div style={{ color: 'var(--hz-dim)', fontSize: 14, marginTop: 14, maxWidth: 540 }}>
            {teamLine}. {comp && comp.days <= 14 ? `${comp.days} days until the next floor moment. The routine is becoming the routine.` : 'Build every rep like it counts twice.'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="hz-btn" onClick={() => navigate('schedule')}><HZIcon name="calendar" size={14}/> Schedule</button>
          <button className="hz-btn" onClick={() => navigate('practice')}><HZIcon name="routine" size={14}/> Practice plans</button>
          <button className="hz-btn hz-btn-primary" onClick={() => navigate('skills')}><HZIcon name="plus" size={14}/> Check off a skill</button>
        </div>
      </div>

      {/* Hero row — readiness + predicted score */}
      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 24, marginBottom: 24 }}>
        <div className="hz-card" style={{ padding: 30, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <Dial value={readiness} size={180} label="Team Readiness"/>
          <div style={{ marginTop: 20, display: 'flex', gap: 18, fontSize: 11, color: 'var(--hz-dim)' }}>
            <div><span className="hz-teal" style={{ fontFamily: 'var(--hz-mono)', fontWeight: 700 }}>{attendanceRows.length ? `${Math.round(teamAttendance * 100)}%` : 'No logs'}</span> attendance</div>
            <div>·</div>
            <div><span className="hz-pink" style={{ fontFamily: 'var(--hz-mono)', fontWeight: 700 }}>{athletes.length}</span> athletes</div>
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
              {(() => {
                // Real mock-run receipts (never predicted): last total, trend, hit-zero streak
                const runs = [...(snap.score_runs || [])]
                  .filter(r => !team?.id || r.team_id === team.id)
                  .sort((a, b) => new Date(a.run_at) - new Date(b.run_at));
                if (!runs.length) {
                  return (
                    <div style={{ fontSize: 12, color: 'var(--hz-dim)', marginTop: 10 }}>
                      No scored full-outs yet — <span style={{ color: 'var(--hz-teal)', cursor: 'pointer', fontWeight: 700 }} onClick={() => navigate('score')}>run one</span> and the real trend starts here.
                    </div>
                  );
                }
                const last = runs[runs.length - 1];
                const delta = runs.length > 1 ? (last.total || 0) - (runs[runs.length - 2].total || 0) : null;
                let streak = 0;
                for (let i = runs.length - 1; i >= 0; i--) {
                  if ((runs[i].deductions || 0) === 0) streak++;
                  else break;
                }
                return (
                  <div style={{ display: 'flex', gap: 14, alignItems: 'baseline', marginTop: 12, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, color: 'var(--hz-dim)' }}>Last full-out:</span>
                    <span className="hz-mono" style={{ fontSize: 16, fontWeight: 800 }}>{(last.total || 0).toFixed(1)}</span>
                    {delta != null && Math.abs(delta) >= 0.05 && (
                      <span className="hz-mono" style={{ fontSize: 12, fontWeight: 800, color: delta > 0 ? 'var(--hz-green)' : 'var(--hz-red)' }}>
                        {delta > 0 ? '▲' : '▼'}{Math.abs(delta).toFixed(1)}
                      </span>
                    )}
                    {streak > 0 && <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--hz-green)' }}>🔥 {streak} clean in a row</span>}
                    <span style={{ fontSize: 11, color: 'var(--hz-dimmer)' }}>{runs.length} run{runs.length === 1 ? '' : 's'} logged</span>
                  </div>
                );
              })()}
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        <StatTile label="Practice plans" value={practicePlans.length} sub="coach-built" size="md" accent="var(--hz-teal)"/>
        <StatTile label="Class enrollments" value={classEnrollments.length} sub={`${classEnrollments.filter(r => r.payment_status === 'paid').length} paid`} size="md"/>
        <StatTile label="Open gym" value={openGymParticipants.length} sub="participant intakes" size="md" accent="var(--hz-amber)"/>
        <StatTile label="Attendance logs" value={attendanceRows.length} sub="saved rows" size="md"/>
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
                  {athlete && <Avatar name={athlete.display_name} initials={athlete.initials} color={athlete.photo_color} src={athlete.photo_url} size={36}/>}
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
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{cleanCoachSessionType(s.type)}</div>
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
                <Avatar name={a.display_name} initials={a.initials} color={a.photo_color} src={a.photo_url} size={32}/>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{a.display_name}</div>
                    <div style={{ fontSize: 10, color: 'var(--hz-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>{a.role || a.position || 'athlete'}</div>
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
                <Avatar name={a.display_name} initials={a.initials} color={a.photo_color} src={a.photo_url} size={32}/>
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
