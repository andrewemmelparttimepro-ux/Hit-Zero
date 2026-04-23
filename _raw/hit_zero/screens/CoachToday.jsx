// HIT ZERO — Coach Today. Flagship screen.
// Editorial hero: date + team name (Fraunces display italic), readiness ring,
// "days out" countdown to next comp, today's practice card, recent skill wins feed.

function CoachToday({ onNav }) {
  const [state, setState] = React.useState(window.HZStore.get());
  React.useEffect(() => window.HZStore.subscribe(setState), []);

  const readiness = window.HZSelect.teamReadiness();
  const attendance = window.HZSelect.teamAttendance();
  const predicted = window.HZSelect.predictedScore();
  const daysOut = state.team.nextComp.daysOut;

  const todaySession = state.sessions.find(s => s.date === '2026-04-19');
  const next3 = state.sessions.filter(s => s.scheduled).slice(0, 4);

  // top 3 "needs work" — athletes with lowest readiness
  const needsWork = [...state.roster]
    .map(a => ({ a, r: window.HZSelect.athleteReadiness(a.id) }))
    .sort((x, y) => x.r - y.r).slice(0, 3);

  const recent = state.recent.slice(0, 5);

  return (
    <div style={{ padding: '0 20px', color: '#fff' }} className="hz-rise">
      {/* Editorial hero */}
      <div style={{ marginTop: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="hz-eyebrow" style={{ color: 'var(--hz-teal)' }}>Sunday · April 19</div>
            <div style={{ height: 8 }} />
            <div className="hz-display" style={{ fontSize: 56, fontWeight: 600, fontStyle: 'italic' }}>
              Magic<br/>
              <span style={{ color: 'var(--hz-pink)' }}>day</span> <span style={{ fontSize: 38, fontStyle: 'italic' }}>{daysOut}</span>
            </div>
          </div>
        </div>
        <div className="hz-serif" style={{ marginTop: 10, fontSize: 15, color: 'rgba(255,255,255,0.55)', fontStyle: 'italic', maxWidth: 300 }}>
          "{daysOut} days until you take the floor at Dream On. Practice like it's today."
        </div>
      </div>

      {/* Readiness ring */}
      <div style={{ marginTop: 26 }}>
        <ReadinessDial readiness={readiness} predicted={predicted.total} />
      </div>

      {/* Today's session card */}
      {todaySession && (
        <div style={{ marginTop: 20, position: 'relative', borderRadius: 22, overflow: 'hidden', background: 'linear-gradient(135deg, #1a0d18 0%, #0a1b1d 100%)', border: '1px solid rgba(249,127,172,0.15)' }}>
          {/* pom burst */}
          <div style={{ position: 'absolute', right: -30, top: -30, width: 160, height: 160, borderRadius: '50%', background: 'radial-gradient(circle, rgba(249,127,172,0.2) 0%, transparent 60%)', pointerEvents: 'none' }} />
          <div style={{ padding: 20, position: 'relative' }}>
            <div className="hz-eyebrow" style={{ color: 'var(--hz-pink)' }}>Today · 6:00 PM · 2h 30m</div>
            <div className="hz-display" style={{ fontSize: 32, marginTop: 6, fontWeight: 500 }}>
              Full-Out<span style={{ color: 'var(--hz-pink)' }}>.</span>
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>
              Run the routine top to bottom. Three times. No stops.
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button onClick={() => onNav('routine')} style={btnPink}>Routine Plan <window.HZIcon name="arrow-right" size={14}/></button>
              <button onClick={() => onNav('roster')} style={btnGhost}>Check In</button>
            </div>
          </div>
        </div>
      )}

      {/* Metrics strip */}
      <div style={{ marginTop: 22, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <MetricCard label="Attendance (30d)" value={Math.round(attendance*100) + '%'} sub={`${state.roster.length} on roster`} color="teal"/>
        <MetricCard label="Predicted Score" value={predicted.total.toFixed(1)} sub={`of 100 · ${predicted.deductions.toFixed(2)} ded`} color="pink"/>
      </div>

      {/* Needs work list */}
      <SectionHeader label="Needs Work" onTap={() => onNav('roster')} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {needsWork.map(({ a, r }) => (
          <div key={a.id} onClick={() => { window.HZStore.setActiveAthlete(a.id); onNav('roster'); }}
            style={{ display: 'flex', alignItems: 'center', padding: 12, borderRadius: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer' }}>
            <Avatar athlete={a} size={44} />
            <div style={{ marginLeft: 12, flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{a.name}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', textTransform: 'capitalize' }}>{a.role} · {Math.round(r*100)}% ready</div>
            </div>
            <div style={{ width: 60, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginRight: 10 }}>
              <div style={{ width: `${r*100}%`, height: '100%', background: r < 0.5 ? 'var(--hz-amber)' : 'var(--hz-teal)' }}/>
            </div>
            <window.HZIcon name="chev-right" size={16} color="rgba(255,255,255,0.4)"/>
          </div>
        ))}
      </div>

      {/* Recent feed — celebration */}
      {recent.length > 0 && (
        <>
          <SectionHeader label="Just Now"/>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {recent.map((r, i) => {
              const a = state.roster.find(x => x.id === r.athleteId);
              const sk = Object.values(window.HZ_SKILL_TREE).flatMap(c => c.skills).find(s => s.id === r.skillId);
              if (!a || !sk) return null;
              const statusLabel = window.HZ_SKILL_STATUS.find(x => x.id === r.to)?.label;
              const pink = r.to === 'mastered';
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 10, background: pink ? 'rgba(249,127,172,0.08)' : 'rgba(39,207,215,0.06)' }}>
                  <Avatar athlete={a} size={24}/>
                  <div style={{ fontSize: 12, flex: 1 }}>
                    <span style={{ fontWeight: 600 }}>{a.name.split(' ')[0]}</span>
                    <span style={{ color: 'rgba(255,255,255,0.5)' }}> · {sk.name} → </span>
                    <span style={{ color: pink ? 'var(--hz-pink)' : 'var(--hz-teal)', fontWeight: 700 }}>{statusLabel}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Upcoming */}
      <SectionHeader label="This Week"/>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {next3.map(s => (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 12, background: s.comp ? 'linear-gradient(90deg, rgba(249,127,172,0.12), rgba(39,207,215,0.08))' : 'rgba(255,255,255,0.03)', border: s.comp ? '1px solid rgba(249,127,172,0.3)' : '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ width: 42, textAlign: 'center' }}>
              <div className="hz-eyebrow" style={{ color: s.comp ? 'var(--hz-pink)' : 'var(--hz-teal)' }}>{new Date(s.date).toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}</div>
              <div className="hz-serif" style={{ fontSize: 22, fontWeight: 600, fontStyle: 'italic' }}>{new Date(s.date).getDate()}</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{s.type}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{s.duration ? `${s.duration} min` : 'All day'} {s.comp ? '· Bismarck, ND' : ''}</div>
            </div>
            {s.comp && <div className="hz-pill" style={{ background: 'rgba(249,127,172,0.2)', color: 'var(--hz-pink)' }}>Comp Day</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

function ReadinessDial({ readiness, predicted }) {
  const size = 220;
  const cx = size / 2, cy = size / 2, r = 92;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - readiness);
  return (
    <div style={{ position: 'relative', height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <defs>
          <linearGradient id="readGrad" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#27CFD7"/>
            <stop offset="100%" stopColor="#F97FAC"/>
          </linearGradient>
        </defs>
        <circle cx={cx} cy={cy} r={r} stroke="rgba(255,255,255,0.06)" strokeWidth="10" fill="none"/>
        <circle cx={cx} cy={cy} r={r} stroke="url(#readGrad)" strokeWidth="10" fill="none"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.2, 0.8, 0.2, 1)' }}/>
      </svg>
      <div style={{ position: 'absolute', textAlign: 'center' }}>
        <div className="hz-eyebrow" style={{ color: 'rgba(255,255,255,0.45)' }}>Team Readiness</div>
        <div className="hz-display" style={{ fontSize: 76, fontWeight: 500, lineHeight: 0.9, margin: '6px 0', fontStyle: 'italic' }}>
          {Math.round(readiness * 100)}<span style={{ color: 'var(--hz-teal)' }}>%</span>
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--hz-mono)' }}>PRED. SCORE <span style={{ color: 'var(--hz-pink)', fontWeight: 600 }}>{predicted.toFixed(1)}</span>/100</div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, sub, color }) {
  const c = color === 'pink' ? 'var(--hz-pink)' : 'var(--hz-teal)';
  return (
    <div style={{ padding: 14, borderRadius: 16, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="hz-eyebrow">{label}</div>
      <div className="hz-display" style={{ fontSize: 36, fontWeight: 500, fontStyle: 'italic', color: c, marginTop: 4, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>{sub}</div>
    </div>
  );
}

function SectionHeader({ label, onTap }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '26px 0 12px' }}>
      <div className="hz-display" style={{ fontSize: 24, fontWeight: 600, fontStyle: 'italic' }}>{label}</div>
      {onTap && <button onClick={onTap} style={{ background: 'transparent', border: 'none', color: 'var(--hz-teal)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--hz-sans)' }}>See all →</button>}
    </div>
  );
}

function Avatar({ athlete, size = 36 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: size/2, flexShrink: 0,
      background: `linear-gradient(135deg, ${athlete.photo} 0%, ${athlete.photo === '#f97fac' ? '#b8567a' : '#1a8f94'} 100%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#0a0a0b', fontWeight: 800, fontSize: size*0.35, fontFamily: 'var(--hz-sans)',
      letterSpacing: '-0.03em',
    }}>{athlete.initials}</div>
  );
}

const btnPink  = { padding: '10px 16px', borderRadius: 999, background: 'var(--hz-pink)', color: '#000', border: 'none', fontWeight: 700, fontSize: 12, letterSpacing: '0.04em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'var(--hz-sans)', display: 'inline-flex', alignItems: 'center', gap: 6 };
const btnGhost = { padding: '10px 16px', borderRadius: 999, background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', fontWeight: 600, fontSize: 12, letterSpacing: '0.04em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'var(--hz-sans)' };

window.CoachToday = CoachToday;
window.HZAvatar = Avatar;
window.HZSectionHeader = SectionHeader;
window.HZMetricCard = MetricCard;
window.hzBtnPink = btnPink;
window.hzBtnGhost = btnGhost;
