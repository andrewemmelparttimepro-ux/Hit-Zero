// HIT ZERO — Athlete Reel. Personal progress feed + skill tree.
// Stories-style stacked cards at top (new skills unlocked), then personal matrix.

function AthleteReel({ onNav }) {
  const [state, setState] = React.useState(window.HZStore.get());
  React.useEffect(() => window.HZStore.subscribe(setState), []);
  const me = state.roster.find(a => a.id === state.activeAthleteId) || state.roster[0];
  const counts = window.HZSelect.athleteSkillsLearned(me.id);
  const readiness = window.HZSelect.athleteReadiness(me.id);
  const attend = window.HZSelect.attendance(me.id);

  // recent wins FOR ME
  const myRecent = state.recent.filter(r => r.athleteId === me.id).slice(0, 6);
  // next up — skills currently "working"
  const working = [];
  Object.entries(state.skills[me.id] || {}).forEach(([sid, st]) => {
    if (st === 'working') {
      const sk = Object.values(window.HZ_SKILL_TREE).flatMap(c => c.skills).find(x => x.id === sid);
      if (sk) working.push(sk);
    }
  });

  return (
    <div style={{ padding: '0 20px', color: '#fff' }} className="hz-rise">
      {/* Hero */}
      <div style={{ marginTop: 6 }}>
        <div className="hz-eyebrow" style={{ color: 'var(--hz-pink)' }}>Hey {me.name.split(' ')[0]} 👋</div>
        <div className="hz-display" style={{ fontSize: 48, fontStyle: 'italic', fontWeight: 600, lineHeight: 0.95, marginTop: 6 }}>
          You're <span style={{ color: 'var(--hz-teal)' }}>{Math.round(readiness*100)}%</span><br/>of the way<br/>there.
        </div>
      </div>

      {/* Big progress ring */}
      <div style={{ marginTop: 20, display: 'flex', gap: 12 }}>
        <div style={{ flex: 1, padding: 16, borderRadius: 18, background: 'linear-gradient(135deg, rgba(249,127,172,0.1), rgba(249,127,172,0.02))', border: '1px solid rgba(249,127,172,0.2)' }}>
          <div className="hz-serif" style={{ fontSize: 42, fontWeight: 700, fontStyle: 'italic', color: 'var(--hz-pink)', lineHeight: 1 }}>{counts.mastered}</div>
          <div className="hz-eyebrow" style={{ marginTop: 4 }}>Skills Mastered</div>
        </div>
        <div style={{ flex: 1, padding: 16, borderRadius: 18, background: 'linear-gradient(135deg, rgba(39,207,215,0.1), rgba(39,207,215,0.02))', border: '1px solid rgba(39,207,215,0.2)' }}>
          <div className="hz-serif" style={{ fontSize: 42, fontWeight: 700, fontStyle: 'italic', color: 'var(--hz-teal)', lineHeight: 1 }}>{counts.got}</div>
          <div className="hz-eyebrow" style={{ marginTop: 4 }}>Got It · Keep drilling</div>
        </div>
      </div>

      {/* Next up */}
      {working.length > 0 && (
        <>
          <div className="hz-eyebrow" style={{ marginTop: 24 }}>Working On</div>
          <div style={{ marginTop: 10, display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }} className="hz-scroll">
            {working.map(sk => (
              <div key={sk.id} style={{ flexShrink: 0, width: 180, padding: 14, borderRadius: 14, background: 'rgba(255,180,84,0.08)', border: '1px solid rgba(255,180,84,0.25)' }}>
                <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--hz-amber)', letterSpacing: '0.1em' }}>LEVEL {sk.level} · IN PROGRESS</div>
                <div className="hz-display" style={{ fontSize: 22, fontStyle: 'italic', fontWeight: 600, marginTop: 6, lineHeight: 1 }}>{sk.name}</div>
                <button onClick={() => window.HZStore.setSkill(me.id, sk.id, 'got_it')}
                  style={{ marginTop: 10, padding: '6px 10px', borderRadius: 999, background: 'var(--hz-teal)', color: '#000', border: 'none', fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'var(--hz-sans)' }}>
                  I got it →
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Reel feed */}
      <div className="hz-eyebrow" style={{ marginTop: 24 }}>Your Reel</div>
      {myRecent.length === 0 ? (
        <div className="hz-serif" style={{ marginTop: 10, fontStyle: 'italic', color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>
          "Your first win will show up here. Tap a skill above."
        </div>
      ) : (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {myRecent.map((r, i) => {
            const sk = Object.values(window.HZ_SKILL_TREE).flatMap(c => c.skills).find(x => x.id === r.skillId);
            if (!sk) return null;
            const pink = r.to === 'mastered';
            return (
              <div key={i} style={{ padding: 14, borderRadius: 14, background: pink ? 'linear-gradient(90deg, rgba(249,127,172,0.12), rgba(249,127,172,0.02))' : 'rgba(39,207,215,0.06)', border: `1px solid ${pink ? 'rgba(249,127,172,0.3)' : 'rgba(39,207,215,0.15)'}` }}>
                <div className="hz-eyebrow" style={{ color: pink ? 'var(--hz-pink)' : 'var(--hz-teal)' }}>{pink ? '🏆 MASTERED' : '✓ ' + (r.to === 'got_it' ? 'GOT IT' : r.to.toUpperCase())}</div>
                <div className="hz-display" style={{ fontSize: 22, fontStyle: 'italic', fontWeight: 600, marginTop: 4 }}>{sk.name}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>just now · Level {sk.level}</div>
              </div>
            );
          })}
        </div>
      )}

      <div className="hz-eyebrow" style={{ marginTop: 24 }}>Attendance Streak</div>
      <div style={{ marginTop: 8, padding: 14, borderRadius: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span className="hz-display" style={{ fontSize: 36, fontStyle: 'italic', fontWeight: 600, color: 'var(--hz-teal)', lineHeight: 1 }}>{attend.attended}</span>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>of {attend.total} practices · {Math.round(attend.pct*100)}%</span>
        </div>
        <div style={{ display: 'flex', gap: 3, marginTop: 10 }}>
          {state.sessions.filter(s => !s.scheduled).slice(0, 16).map(s => {
            const did = s.attended.includes(me.id);
            return <div key={s.id} style={{ flex: 1, height: 22, borderRadius: 3, background: did ? 'var(--hz-teal)' : 'rgba(255,255,255,0.08)' }}/>;
          })}
        </div>
      </div>
    </div>
  );
}
window.AthleteReel = AthleteReel;

// ─────────────────────────────────────────────────────────────────────────
// Parent Dashboard — computed from shared state. Celebrations + billing.
// ─────────────────────────────────────────────────────────────────────────
function ParentDashboard({ onNav }) {
  const [state, setState] = React.useState(window.HZStore.get());
  React.useEffect(() => window.HZStore.subscribe(setState), []);
  const kid = state.roster.find(a => a.id === state.activeAthleteId) || state.roster[0];
  const counts = window.HZSelect.athleteSkillsLearned(kid.id);
  const readiness = window.HZSelect.athleteReadiness(kid.id);
  const attend = window.HZSelect.attendance(kid.id);
  const recent = state.recent.filter(r => r.athleteId === kid.id).slice(0, 3);
  const Avatar = window.HZAvatar;

  return (
    <div style={{ padding: '0 20px', color: '#fff' }} className="hz-rise">
      <div style={{ marginTop: 6 }}>
        <div className="hz-eyebrow" style={{ color: 'var(--hz-teal)' }}>Parent View</div>
        <div className="hz-display" style={{ fontSize: 32, fontStyle: 'italic', fontWeight: 600, marginTop: 4, lineHeight: 1 }}>
          How's<br/><span style={{ color: 'var(--hz-pink)' }}>{kid.name.split(' ')[0]}</span> doing?
        </div>
      </div>

      {/* Kid card */}
      <div style={{ marginTop: 16, padding: 16, borderRadius: 20, background: 'linear-gradient(135deg, rgba(249,127,172,0.1), rgba(39,207,215,0.08))', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', gap: 14, alignItems: 'center' }}>
        <Avatar athlete={kid} size={64}/>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{kid.name}</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', textTransform: 'capitalize' }}>{kid.role} · Senior Coed 4</div>
          <div style={{ marginTop: 8, height: 4, borderRadius: 2, background: 'rgba(0,0,0,0.3)', overflow: 'hidden' }}>
            <div style={{ width: `${readiness*100}%`, height: '100%', background: 'linear-gradient(90deg, var(--hz-teal), var(--hz-pink))' }}/>
          </div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 4, fontFamily: 'var(--hz-mono)' }}>READY {Math.round(readiness*100)}% · ATT {Math.round(attend.pct*100)}%</div>
        </div>
      </div>

      {/* Recent wins */}
      {recent.length > 0 && (
        <>
          <div className="hz-eyebrow" style={{ marginTop: 22 }}>Recent Wins · Brag-worthy</div>
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {recent.map((r, i) => {
              const sk = Object.values(window.HZ_SKILL_TREE).flatMap(c => c.skills).find(x => x.id === r.skillId);
              if (!sk) return null;
              const pink = r.to === 'mastered';
              return (
                <div key={i} style={{ padding: '10px 12px', borderRadius: 12, background: pink ? 'rgba(249,127,172,0.08)' : 'rgba(39,207,215,0.06)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ fontSize: 20 }}>{pink ? '🏆' : '✨'}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{sk.name}</div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>{pink ? 'Mastered' : 'Got it'} · today</div>
                    </div>
                    <button style={{ padding: '6px 10px', borderRadius: 999, background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', cursor: 'pointer', fontFamily: 'var(--hz-sans)' }}>SHARE</button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Next event */}
      <div className="hz-eyebrow" style={{ marginTop: 22 }}>Next Competition</div>
      <div style={{ marginTop: 8, padding: 16, borderRadius: 16, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(249,127,172,0.2)' }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div className="hz-eyebrow" style={{ color: 'var(--hz-pink)' }}>MAY</div>
            <div className="hz-display" style={{ fontSize: 40, fontStyle: 'italic', fontWeight: 600, lineHeight: 0.9 }}>{state.team.nextComp.daysOut}</div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.08em' }}>DAYS OUT</div>
          </div>
          <div style={{ flex: 1 }}>
            <div className="hz-display" style={{ fontSize: 22, fontStyle: 'italic', fontWeight: 600, lineHeight: 1.1 }}>{state.team.nextComp.name}</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>{state.team.nextComp.city} · Bus leaves 7 AM</div>
          </div>
        </div>
      </div>

      {/* Billing */}
      <div className="hz-eyebrow" style={{ marginTop: 22 }}>Billing · Magic City Allstars</div>
      <div style={{ marginTop: 8, padding: 14, borderRadius: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div>
            <div className="hz-display" style={{ fontSize: 30, fontStyle: 'italic', fontWeight: 600, color: 'var(--hz-teal)', lineHeight: 1 }}>$0.00</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>Balance due · thru May 1</div>
          </div>
          <div className="hz-pill" style={{ background: 'rgba(63,231,160,0.15)', color: 'var(--hz-green)' }}>PAID</div>
        </div>
        <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '12px 0' }}/>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
          <span style={{ color: 'rgba(255,255,255,0.55)' }}>Monthly tuition</span>
          <span style={{ fontWeight: 600 }}>$400.00</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 6 }}>
          <span style={{ color: 'rgba(255,255,255,0.55)' }}>Dream On (May 3)</span>
          <span style={{ fontWeight: 600 }}>$185.00</span>
        </div>
      </div>
    </div>
  );
}
window.ParentDashboard = ParentDashboard;

// ─────────────────────────────────────────────────────────────────────────
// Stub screens (progress, bills, reel tab, etc. map to existing screens)
// ─────────────────────────────────────────────────────────────────────────
window.HZ_ROUTE = {
  coach:   { today: 'CoachToday',    roster: 'Roster', routine: 'RoutineBuilder', score: 'MockScore' },
  owner:   { today: 'CoachToday',    roster: 'Roster', routine: 'RoutineBuilder', score: 'MockScore' },
  athlete: { reel: 'AthleteReel',    skills: 'Roster', team: 'Roster',            today: 'CoachToday' },
  parent:  { today: 'ParentDashboard', progress: 'AthleteReel', reel: 'AthleteReel', bills: 'ParentDashboard' },
};
