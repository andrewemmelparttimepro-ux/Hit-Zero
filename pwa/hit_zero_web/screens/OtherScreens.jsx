// ─────────────────────────────────────────────────────────────────────────────
// HIT ZERO WEB — Athlete Reel + Skill Tree + Parent Dashboard + rest of screens
// ─────────────────────────────────────────────────────────────────────────────

function resolveSessionAthlete(snap, session) {
  const profileId = session?.profile?.id;
  return (snap.athletes || []).find(a => a.profile_id === profileId)
    || (snap.athletes || []).find(a => a.id === 'a01')
    || (snap.athletes || [])[0]
    || null;
}

// ─── Athlete Reel: personal wins feed, next goals ───
function AthleteReel({ snap, session, navigate }) {
  const myAthlete = resolveSessionAthlete(snap, session);
  if (!myAthlete) return null;
  const readiness = window.HZsel.athleteReadiness(myAthlete.id);
  const summary = window.HZsel.athleteSkillsSummary(myAthlete.id);
  const attendance = window.HZsel.athleteAttendance(myAthlete.id);
  const pins = window.HZsel.pinStats(myAthlete.id);
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
          <Avatar name={myAthlete.display_name} initials={myAthlete.initials} color={myAthlete.photo_color} src={myAthlete.photo_url} size={96}/>
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <StatTile label="Mastered" value={summary.mastered} sub="career skills" accent="var(--hz-pink)" size="md"/>
        <StatTile label="Got It" value={summary.got} sub="solid in routine" accent="var(--hz-teal)" size="md"/>
        <StatTile label="Attendance" value={`${Math.round(attendance.pct*100)}%`} sub={`${attendance.attended} / ${attendance.total} sessions`} size="md"/>
        <StatTile label="Pins" value={pins.unique} sub={`${pins.sent} sent · ${pins.received} received`} accent="var(--hz-amber)" size="md"/>
      </div>

      <div className="hz-card" style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <div className="hz-eyebrow" style={{ marginBottom: 8 }}>New side game</div>
          <div className="hz-display" style={{ fontSize: 30, marginBottom: 6 }}>
            Your <span className="hz-zero">pin shelf</span>.
          </div>
          <div style={{ color: 'var(--hz-dim)', fontSize: 13, maxWidth: 560, lineHeight: 1.55 }}>
            Collect decorated comp pins, earn rare clothespins, and drop them on girls who were cool all weekend.
          </div>
        </div>
        <button className="hz-btn hz-btn-primary" onClick={() => navigate && navigate('pins')}>
          Open pins <HZIcon name="arrow-right" size={13}/>
        </button>
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

function PinsHub({ snap, session }) {
  const myAthlete = resolveSessionAthlete(snap, session);
  if (!myAthlete) return null;
  const inventory = window.HZsel.pinInventory(myAthlete.id);
  const drops = window.HZsel.pinDropsForAthlete(myAthlete.id);
  const quests = window.HZsel.pinQuests(myAthlete.id);
  const stats = window.HZsel.pinStats(myAthlete.id);
  const [creatorOpen, setCreatorOpen] = React.useState(false);
  const [draft, setDraft] = React.useState({
    name: '',
    emoji: '🎀',
    message: 'You made the weekend more fun.',
    palette: 'aqua',
    target: '',
  });
  const teammates = (snap.athletes || []).filter(a => a.id !== myAthlete.id);
  const basket = inventory.filter(row => Number(row.quantity || 0) > 0);

  const rarityTone = (rarity) => (
    rarity === 'legendary' ? 'pink' :
    rarity === 'epic' ? 'teal' :
    rarity === 'rare' ? 'amber' :
    undefined
  );
  const palettes = {
    aqua: ['#27CFD7', '#8EE3F0'],
    bow: ['#F97FAC', '#F4B1C8'],
    lucky: ['#FFD76B', '#FF9F6E'],
    mint: ['#88F7B3', '#27CFD7'],
    galaxy: ['#C8A6FF', '#6CE5E8'],
  };
  const selectedPalette = palettes[draft.palette] || palettes.aqua;
  const previewName = draft.name.trim() || `${myAthlete.display_name.split(' ')[0]}'s Pin`;

  async function refreshPins() {
    if (window.HZsel?._refresh) await window.HZsel._refresh();
    window.dispatchEvent(new CustomEvent('hz:refresh', { detail: { table: 'pin_designs' } }));
  }

  async function dropPin(row, targetId, message) {
    const target = teammates.find(a => a.id === targetId) || teammates[0] || null;
    if (!row?.design || !target) return;
    await window.HZdb.from('pin_drops').insert({
      id: 'pd_' + Math.random().toString(36).slice(2, 10),
      design_id: row.design_id,
      from_athlete_id: myAthlete.id,
      to_athlete_id: target.id,
      recipient_name: target.display_name,
      recipient_program: 'Magic City Allstars',
      recipient_city: 'Minot, ND',
      event_name: 'Team basket drop',
      message: message || 'You made the weekend more fun.',
      status: 'sent',
      created_at: new Date().toISOString(),
    });
    await window.HZdb.from('athlete_pins').update({ quantity: Math.max(0, Number(row.quantity || 1) - 1) }).eq('id', row.id);
    await refreshPins();
  }

  async function createPin(dropNow = false) {
    const name = previewName.slice(0, 42);
    const design = {
      id: 'pin_custom_' + Math.random().toString(36).slice(2, 10),
      program_id: 'p_mca',
      name,
      emoji: draft.emoji || '🎀',
      rarity: 'made',
      accent_start: selectedPalette[0],
      accent_end: selectedPalette[1],
      unlock_hint: `Made by ${myAthlete.display_name.split(' ')[0]}.`,
      lore: draft.message || 'A handmade pin from the basket.',
      created_by_athlete_id: myAthlete.id,
      created_at: new Date().toISOString(),
    };
    const row = {
      id: 'ap_' + Math.random().toString(36).slice(2, 10),
      athlete_id: myAthlete.id,
      design_id: design.id,
      quantity: 1,
      favorite: false,
      source: 'athlete_created',
      unlocked_at: new Date().toISOString(),
    };
    await window.HZdb.from('pin_designs').insert(design);
    await window.HZdb.from('athlete_pins').insert(row);
    if (dropNow) await dropPin({ ...row, design }, draft.target || teammates[0]?.id, draft.message);
    else await refreshPins();
    setDraft({ name: '', emoji: '🎀', message: 'You made the weekend more fun.', palette: 'aqua', target: '' });
    setCreatorOpen(false);
  }

  return (
    <div>
      <div style={{ marginBottom: 36 }}>
        <div className="hz-eyebrow" style={{ marginBottom: 10 }}>Pins · Athlete side quest</div>
        <div className="hz-display" style={{ fontSize: 72, lineHeight: 0.9 }}>
          Pin your <span className="hz-zero">people</span>.
        </div>
        <div style={{ color: 'var(--hz-dim)', fontSize: 15, marginTop: 16, maxWidth: 860, lineHeight: 1.6 }}>
          Make a pin, keep it in your basket, then drop it on another girl’s bag, wall, or profile when she does something cool.
          Rewards still exist, but the main game is athlete-created.
        </div>
        <button className="hz-btn hz-btn-primary" onClick={() => setCreatorOpen(v => !v)} style={{ marginTop: 20 }}>
          {creatorOpen ? 'Close creator' : 'Create a pin'} <HZIcon name={creatorOpen ? 'x' : 'plus'} size={13}/>
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <StatTile label="Basket" value={basket.reduce((sum, row) => sum + Number(row.quantity || 0), 0)} sub="ready to pin later" accent="var(--hz-pink)" size="md"/>
        <StatTile label="Sent" value={stats.sent} sub="pins you dropped" accent="var(--hz-teal)" size="md"/>
        <StatTile label="Received" value={stats.received} sub="girls who pinned you" accent="var(--hz-amber)" size="md"/>
        <StatTile label="Designs" value={stats.unique} sub="made or earned" size="md"/>
      </div>

      {creatorOpen && (
        <div className="hz-card" style={{ marginBottom: 24, borderColor: 'rgba(39,207,215,0.45)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 24 }}>
            <div style={{ display: 'grid', placeItems: 'center', minHeight: 300, borderRadius: 24, background: 'rgba(255,255,255,0.03)', border: '1px dashed var(--hz-line-2)' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  width: 150, height: 150, borderRadius: 38, display: 'grid', placeItems: 'center', margin: '0 auto 18px',
                  background: `linear-gradient(135deg, ${selectedPalette[0]}, ${selectedPalette[1]})`,
                  fontSize: 66, boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
                }}>{draft.emoji || '🎀'}</div>
                <div className="hz-display" style={{ fontSize: 28 }}>{previewName}</div>
                <div style={{ color: 'var(--hz-dim)', fontSize: 12, marginTop: 8, lineHeight: 1.5 }}>{draft.message}</div>
              </div>
            </div>
            <div>
              <div className="hz-eyebrow" style={{ color: 'var(--hz-teal)', marginBottom: 8 }}>Pin creator</div>
              <div className="hz-display" style={{ fontSize: 34, marginBottom: 16 }}>Decorate it. Save it. Drop it.</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 92px', gap: 10, marginBottom: 10 }}>
                <label>
                  <div className="hz-eyebrow" style={{ marginBottom: 8 }}>Pin name</div>
                  <input className="hz-input" value={draft.name} maxLength={42} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} placeholder="Warm-up Queen"/>
                </label>
                <label>
                  <div className="hz-eyebrow" style={{ marginBottom: 8 }}>Icon</div>
                  <input className="hz-input" value={draft.emoji} maxLength={2} onChange={e => setDraft(d => ({ ...d, emoji: e.target.value }))}/>
                </label>
              </div>
              <label>
                <div className="hz-eyebrow" style={{ marginBottom: 8 }}>Message</div>
                <input className="hz-input" value={draft.message} maxLength={90} onChange={e => setDraft(d => ({ ...d, message: e.target.value }))} placeholder="You made the weekend more fun."/>
              </label>
              <div style={{ marginTop: 14 }}>
                <div className="hz-eyebrow" style={{ marginBottom: 8 }}>Colors</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {Object.entries(palettes).map(([key, colors]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setDraft(d => ({ ...d, palette: key }))}
                      style={{
                        width: 54, height: 34, borderRadius: 999, border: key === draft.palette ? '2px solid #fff' : '1px solid var(--hz-line)',
                        background: `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`, cursor: 'pointer',
                      }}
                      aria-label={key}
                    />
                  ))}
                </div>
              </div>
              <label style={{ display: 'block', marginTop: 14 }}>
                <div className="hz-eyebrow" style={{ marginBottom: 8 }}>Pin now target</div>
                <select className="hz-input" value={draft.target} onChange={e => setDraft(d => ({ ...d, target: e.target.value }))}>
                  <option value="">Pick a teammate</option>
                  {teammates.map(a => <option key={a.id} value={a.id}>{a.display_name}</option>)}
                </select>
              </label>
              <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
                <button className="hz-btn hz-btn-primary" onClick={() => createPin(false)}>Put in basket</button>
                <button className="hz-btn" onClick={() => createPin(true)} disabled={!draft.target && teammates.length === 0}>Pin someone now</button>
              </div>
              <div style={{ color: 'var(--hz-dim)', fontSize: 12, marginTop: 12 }}>
                Next pass can add parent approval / coach safety review for cross-gym drops. Team-only drops are safe for the prototype loop.
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1.05fr 0.95fr', gap: 20, marginBottom: 24 }}>
        <div className="hz-card">
          <div className="hz-eyebrow" style={{ marginBottom: 12 }}>Your basket</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            {basket.map(row => (
              <div key={row.id} style={{ padding: 14, borderRadius: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--hz-line)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
                  <div style={{
                    width: 54, height: 54, borderRadius: 16, display: 'grid', placeItems: 'center',
                    background: `linear-gradient(135deg, ${row.design.accent_start}, ${row.design.accent_end})`,
                    fontSize: 24,
                  }}>{row.design.emoji}</div>
                  <div style={{ textAlign: 'right' }}>
                    <Pill tone={rarityTone(row.design.rarity)}>{row.design.rarity}</Pill>
                    <div style={{ color: 'var(--hz-dim)', fontSize: 11, marginTop: 8 }}>x{row.quantity}</div>
                  </div>
                </div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{row.design.name}</div>
                <div style={{ color: 'var(--hz-dim)', fontSize: 12, marginTop: 4, lineHeight: 1.5 }}>{row.design.lore}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                  {teammates.slice(0, 3).map(a => (
                    <button key={a.id} className="hz-btn hz-btn-ghost hz-btn-xs" onClick={() => dropPin(row, a.id, row.design.lore)}>
                      Pin {a.display_name.split(' ')[0]}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {basket.length === 0 && (
              <div style={{ gridColumn: '1 / -1', padding: 34, border: '1px dashed var(--hz-line-2)', borderRadius: 18, color: 'var(--hz-dim)', textAlign: 'center' }}>
                Your basket is empty. Create a pin and save it here for later.
              </div>
            )}
          </div>
        </div>

        <div className="hz-card">
          <div className="hz-eyebrow" style={{ marginBottom: 12 }}>Comp trail</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {drops.slice(0, 5).map(drop => {
              const sent = drop.from_athlete_id === myAthlete.id;
              const otherName = sent
                ? (drop.toAthlete?.display_name || drop.recipient_name)
                : (drop.fromAthlete?.display_name || 'Someone');
              return (
                <div key={drop.id} style={{ padding: 14, borderRadius: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--hz-line)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 8, alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 42, height: 42, borderRadius: 12, display: 'grid', placeItems: 'center',
                        background: `linear-gradient(135deg, ${drop.design?.accent_start || '#27CFD7'}, ${drop.design?.accent_end || '#F97FAC'})`,
                        fontSize: 20,
                      }}>{drop.design?.emoji || '📍'}</div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{drop.design?.name || 'Pin drop'}</div>
                        <div style={{ color: 'var(--hz-dim)', fontSize: 11 }}>{sent ? `You pinned ${otherName}` : `${otherName} pinned you`}</div>
                      </div>
                    </div>
                    <Pill tone={sent ? 'teal' : 'pink'}>{sent ? 'Sent' : 'Received'}</Pill>
                  </div>
                  <div style={{ fontSize: 13, lineHeight: 1.5 }}>{drop.message}</div>
                  <div style={{ color: 'var(--hz-dim)', fontSize: 11, marginTop: 8 }}>
                    {drop.event_name} · {drop.recipient_program}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div className="hz-card">
          <div className="hz-eyebrow" style={{ marginBottom: 12 }}>Active quests</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {quests.map(q => {
              const pct = Math.max(0, Math.min(100, Math.round((q.progress / Math.max(1, q.goal)) * 100)));
              return (
                <div key={q.id} style={{ padding: 14, borderRadius: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--hz-line)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 8, alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{q.title}</div>
                      <div style={{ color: 'var(--hz-dim)', fontSize: 12, marginTop: 4 }}>{q.body}</div>
                    </div>
                    {q.design && <Pill tone={rarityTone(q.design.rarity)}>{q.design.name}</Pill>}
                  </div>
                  <div style={{ height: 8, background: 'rgba(255,255,255,0.05)', borderRadius: 999, overflow: 'hidden', marginBottom: 8 }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, var(--hz-teal), var(--hz-pink))' }}/>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--hz-dim)' }}>
                    <span>{q.progress} / {q.goal} complete</span>
                    <span>ends {new Date(q.expires_at).toLocaleDateString('default', { month: 'short', day: 'numeric' })}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="hz-card">
          <div className="hz-eyebrow" style={{ marginBottom: 12 }}>Shelf archive</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            {inventory.map(row => (
              <div key={row.id} style={{ padding: 14, borderRadius: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--hz-line)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 14, display: 'grid', placeItems: 'center',
                    background: `linear-gradient(135deg, ${row.design.accent_start}, ${row.design.accent_end})`,
                    fontSize: 22,
                  }}>{row.design.emoji}</div>
                  <div style={{ textAlign: 'right' }}>
                    <Pill tone={rarityTone(row.design.rarity)}>{row.design.rarity}</Pill>
                    <div style={{ color: 'var(--hz-dim)', fontSize: 11, marginTop: 8 }}>x{row.quantity}</div>
                  </div>
                </div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{row.design.name}</div>
                <div style={{ color: 'var(--hz-dim)', fontSize: 12, marginTop: 4, lineHeight: 1.5 }}>{row.design.lore}</div>
                {row.favorite && <div className="hz-eyebrow" style={{ marginTop: 10, color: 'var(--hz-teal)' }}>On your bag</div>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
window.PinsHub = PinsHub;

// ─── Skill Tree: athlete-scoped, full USASF ───
function SkillTree({ snap, session }) {
  const myAthlete = resolveSessionAthlete(snap, session);
  if (!myAthlete) return null;
  const cats = ['standing_tumbling','running_tumbling','jumps','stunts','pyramids','baskets'];
  const CAT_LABEL = { standing_tumbling: 'Standing Tumbling', running_tumbling: 'Running Tumbling', jumps: 'Jumps', stunts: 'Stunts', pyramids: 'Pyramids', baskets: 'Baskets' };
  const STATUS_LABEL = { none: 'Not yet', working: 'Working', got_it: 'Got it', mastered: 'Mastered' };
  const STATUS_HELP = {
    none: 'I have not started this one.',
    working: 'I am learning it.',
    got_it: 'I can do it.',
    mastered: 'I can do it clean and confident.',
  };
  const STATUS_TONES = { none: 'rgba(255,255,255,0.04)', working: 'rgba(255,180,84,0.16)', got_it: 'rgba(39,207,215,0.18)', mastered: 'linear-gradient(135deg, rgba(39,207,215,0.3), rgba(249,127,172,0.3))' };
  const statusMap = {};
  (snap.athlete_skills || []).filter(r => r.athlete_id === myAthlete.id).forEach(r => { statusMap[r.skill_id] = r.status; });
  const [localStatus, setLocalStatus] = React.useState({});
  const [saving, setSaving] = React.useState(null);
  const [error, setError] = React.useState('');

  const statusFor = (skillId) => localStatus[skillId] || statusMap[skillId] || 'none';
  const updateSkill = async (skill, status) => {
    const previous = statusFor(skill.id);
    if (previous === status || saving) return;
    const row = {
      athlete_id: myAthlete.id,
      skill_id: skill.id,
      status,
      updated_by: session?.profile?.id || session?.user?.id || null,
      updated_at: new Date().toISOString(),
    };
    setError('');
    setSaving(skill.id);
    setLocalStatus(prev => ({ ...prev, [skill.id]: status }));
    try {
      if (window.HZsupa && window.HZdb?.auth?._mode?.() === 'live') {
        const { error: liveError } = await window.HZsupa
          .from('athlete_skills')
          .upsert(row, { onConflict: 'athlete_id,skill_id' });
        if (liveError) throw liveError;
      }
      const { error: localError } = await window.HZdb.from('athlete_skills')
        .upsert(row, { onConflict: 'athlete_id,skill_id' });
      if (localError) throw localError;
      if (window.HZmirror?.roster) await window.HZmirror.roster();
      if (window.HZsel?._refresh) await window.HZsel._refresh();
      window.dispatchEvent(new CustomEvent('hz:refresh', { detail: { table: 'athlete_skills', action: 'athlete_update' } }));
    } catch (err) {
      setLocalStatus(prev => ({ ...prev, [skill.id]: previous }));
      setError(err?.message || 'That skill did not save. Try again.');
    } finally {
      setSaving(null);
    }
  };
  const solidCount = Object.values({ ...statusMap, ...localStatus }).filter(s => s === 'mastered' || s === 'got_it').length;

  return (
    <div>
      <SectionHeading eyebrow={myAthlete.display_name} title="My skill tree." trailing={<Pill tone="teal">{solidCount} solid</Pill>}/>
      <div className="hz-card" style={{ marginBottom: 20, borderColor: 'rgba(39,207,215,0.35)' }}>
        <div className="hz-eyebrow" style={{ color: 'var(--hz-teal)', marginBottom: 8 }}>Self tracker</div>
        <div className="hz-display" style={{ fontSize: 32, marginBottom: 8 }}>Tap what is true today.</div>
        <div style={{ color: 'var(--hz-dim)', fontSize: 13, lineHeight: 1.55, maxWidth: 760 }}>
          This updates your profile so coaches and parents can see where you are. Pick honestly: Working is still a win.
        </div>
        {error && <div style={{ color: 'var(--hz-pink)', fontSize: 13, marginTop: 12 }}>{error}</div>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {cats.map(cat => {
          const cSkills = snap.skills.filter(s => s.category === cat).sort((a,b) => a.level - b.level);
          return (
            <div key={cat} className="hz-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
                <div className="hz-display" style={{ fontSize: 24 }}>{CAT_LABEL[cat]}</div>
                <div style={{ fontSize: 11, color: 'var(--hz-dim)' }}>{cSkills.filter(s => ['got_it','mastered'].includes(statusFor(s.id))).length} / {cSkills.length}</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
                {cSkills.map(s => {
                  const st = statusFor(s.id);
                  return (
                    <div key={s.id} style={{
                      padding: 12, borderRadius: 14, fontSize: 12,
                      background: STATUS_TONES[st],
                      color: st === 'none' ? 'var(--hz-dim)' : '#fff',
                      border: '1px solid var(--hz-line)',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'start', marginBottom: 10 }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>{s.name}</div>
                          <div style={{ fontFamily: 'var(--hz-mono)', fontSize: 10, opacity: 0.6, marginTop: 3 }}>L{s.level} · {STATUS_HELP[st]}</div>
                        </div>
                        {saving === s.id && <div className="hz-eyebrow" style={{ color: 'var(--hz-teal)' }}>Saving</div>}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
                        {['none','working','got_it','mastered'].map(option => (
                          <button
                            key={option}
                            type="button"
                            className={'hz-btn hz-btn-sm' + (st === option ? ' hz-btn-primary' : '')}
                            disabled={saving === s.id}
                            onClick={() => updateSkill(s, option)}
                            style={{ justifyContent: 'center', fontSize: 11, padding: '8px 9px' }}
                          >
                            {STATUS_LABEL[option]}
                          </button>
                        ))}
                      </div>
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
function ParentDashboard({ snap, session, navigate, pushToast }) {
  const [createdKids, setCreatedKids] = React.useState([]);
  const [loginKidId, setLoginKidId] = React.useState(null);
  const links = (snap.parent_links || []).filter(l => l.parent_id === session.profile.id);
  const linkedKids = links.map(l => snap.athletes.find(a => a.id === l.athlete_id)).filter(Boolean);
  const familyKids = [...createdKids, ...linkedKids].filter((kid, idx, arr) => kid && arr.findIndex(x => x.id === kid.id) === idx);
  const myKids = familyKids.length > 0 ? familyKids : [snap.athletes[0]];
  const familyName = (session.profile.display_name || 'Your').split(' ').slice(-1)[0];
  const leadKid = myKids.filter(Boolean)[0] || null;

  return (
    <div>
      <div style={{ marginBottom: 40 }}>
        <div className="hz-eyebrow" style={{ marginBottom: 10 }}>{familyName} family · Magic</div>
        <div className="hz-display" style={{ fontSize: 64, lineHeight: 0.9 }}>
          {leadKid ? leadKid.display_name.split(' ')[0] : 'Add your athlete'} <span className="hz-zero">{leadKid ? 'had' : 'without'}</span><br/>
          {leadKid ? 'a great week.' : 'an email.'}
        </div>
      </div>

      <AddChildCard
        snap={snap}
        session={session}
        pushToast={pushToast}
        onCreated={(athlete) => athlete && setCreatedKids(prev => [athlete, ...prev.filter(k => k.id !== athlete.id)])}
      />

      {myKids.filter(Boolean).map(kid => {
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
                  <Avatar name={kid.display_name} initials={kid.initials} color={kid.photo_color} src={kid.photo_url} size={64}/>
                  <div>
                    <div className="hz-display" style={{ fontSize: 30 }}>{kid.display_name}</div>
                    <div style={{ fontSize: 12, color: 'var(--hz-dim)', textTransform: 'capitalize', marginTop: 2 }}>
                      {kid.position || kid.role || 'athlete'}{kid.age ? ' · Age ' + kid.age : ''}
                    </div>
                    <button
                      className="hz-btn"
                      style={{ marginTop: 12, padding: '9px 12px', fontSize: 12 }}
                      onClick={() => setLoginKidId(v => v === kid.id ? null : kid.id)}
                    >
                      {kid.profile_id ? 'Reset iPad login' : 'Set up iPad login'}
                    </button>
                  </div>
                </div>
                {loginKidId === kid.id && <AthleteLoginSetup athlete={kid}/>}
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

function AddChildCard({ snap, session, pushToast, onCreated }) {
  const teams = snap.teams || [];
  const [open, setOpen] = React.useState(false);
  const [createdAthlete, setCreatedAthlete] = React.useState(null);
  const [success, setSuccess] = React.useState('');
  const [form, setForm] = React.useState({
    display_name: '',
    age: '',
    position: 'all-around',
    team_id: teams[0]?.id || '',
  });
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (!form.team_id && teams[0]?.id) setForm(f => ({ ...f, team_id: teams[0].id }));
  }, [teams.length]);

  const addChild = async (e) => {
    e.preventDefault();
    const childName = form.display_name.trim();
    if (!childName) {
      setError('Type the athlete name first, then Create / Link will connect her profile.');
      return;
    }
    setBusy(true);
    setError('');
    setSuccess('');
    const { data, error: err } = await window.HZdb.auth.createChildAthlete({
      ...form,
      display_name: childName,
      age: form.age ? Number(form.age) : null,
      relation: 'parent',
      photo_color: '#F97FAC',
    });
    setBusy(false);
    if (err) {
      setError(err.message || String(err));
      return;
    }
    const name = data?.athlete?.display_name || form.display_name.trim();
    if (data?.athlete) onCreated && onCreated(data.athlete);
    setCreatedAthlete(data?.athlete || null);
    setSuccess(`${name} is linked to your parent account. Now set up her iPad login.`);
    setForm(f => ({ ...f, display_name: '', age: '' }));
    pushToast && pushToast({
      eyebrow: 'Child linked',
      title: `${name} is on your family roster`,
      body: 'Next: create a username and password for her iPad.',
    });
  };

  return (
    <div className="hz-card" style={{ marginBottom: 24, borderColor: open ? 'rgba(39,207,215,0.45)' : 'var(--hz-line)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <div className="hz-eyebrow" style={{ color: 'var(--hz-teal)', marginBottom: 8 }}>Parent-managed athlete</div>
          <div className="hz-display" style={{ fontSize: 30, marginBottom: 6 }}>Kids do not need inboxes.</div>
          <div style={{ color: 'var(--hz-dim)', fontSize: 13, lineHeight: 1.55, maxWidth: 680 }}>
            Add or link younger athletes under your parent account, then create a username + password for the iPad.
          </div>
        </div>
        <button className="hz-btn hz-btn-primary" onClick={() => setOpen(v => !v)}>
          {open ? 'Close' : 'Add child'} <HZIcon name={open ? 'x' : 'plus'} size={13}/>
        </button>
      </div>

      {open && (
        <form onSubmit={addChild} style={{ marginTop: 22, display: 'grid', gridTemplateColumns: '2fr 100px 150px 180px auto', gap: 10, alignItems: 'end' }}>
          <label>
            <div className="hz-eyebrow" style={{ marginBottom: 8 }}>Child name</div>
            <input
              className="hz-input"
              value={form.display_name}
              onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))}
              placeholder="Type Arlowe Emmel"
            />
          </label>
          <label>
            <div className="hz-eyebrow" style={{ marginBottom: 8 }}>Age</div>
            <input
              className="hz-input"
              type="number"
              min="4"
              max="25"
              value={form.age}
              onChange={e => setForm(f => ({ ...f, age: e.target.value }))}
              placeholder="8"
            />
          </label>
          <label>
            <div className="hz-eyebrow" style={{ marginBottom: 8 }}>Role</div>
            <select className="hz-input" value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))}>
              <option value="all-around">All-around</option>
              <option value="flyer">Flyer</option>
              <option value="base">Base</option>
              <option value="backspot">Backspot</option>
              <option value="tumbler">Tumbler</option>
            </select>
          </label>
          <label>
            <div className="hz-eyebrow" style={{ marginBottom: 8 }}>Team</div>
            <select className="hz-input" value={form.team_id} onChange={e => setForm(f => ({ ...f, team_id: e.target.value }))}>
              {teams.map(t => <option key={t.id} value={t.id}>{t.division || t.name || 'Team'}{t.level ? ` L${t.level}` : ''}</option>)}
            </select>
          </label>
          <button type="submit" className="hz-btn hz-btn-primary" disabled={busy}>
            {busy ? 'Working…' : 'Create / Link'}
          </button>
          {error && <div style={{ gridColumn: '1 / -1', color: 'var(--hz-pink)', fontSize: 13 }}>{error}</div>}
          {success && <div style={{ gridColumn: '1 / -1', color: 'var(--hz-teal)', fontSize: 13 }}>{success}</div>}
          <div style={{ gridColumn: '1 / -1', color: 'var(--hz-dim)', fontSize: 12 }}>
            If the athlete already exists on the roster, this links her to you instead of creating a duplicate.
          </div>
        </form>
      )}
      {createdAthlete && <AthleteLoginSetup athlete={createdAthlete}/>}
    </div>
  );
}

function AthleteLoginSetup({ athlete }) {
  const defaultUsername = (athlete.display_name || 'athlete')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .split('-')[0]
    .slice(0, 24);
  const [username, setUsername] = React.useState(defaultUsername || 'athlete');
  const [password, setPassword] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [done, setDone] = React.useState(null);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { data, error: err } = await window.HZdb.auth.createAthleteLogin({
      athlete_id: athlete.id,
      username,
      password,
    });
    setBusy(false);
    if (err) {
      setError(err.message || String(err));
      return;
    }
    setDone(data);
  };

  return (
    <form onSubmit={save} style={{ marginTop: 22, paddingTop: 20, borderTop: '1px solid var(--hz-line)', display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10, alignItems: 'end' }}>
      <div style={{ gridColumn: '1 / -1' }}>
        <div className="hz-eyebrow" style={{ color: 'var(--hz-pink)', marginBottom: 8 }}>iPad login</div>
        <div className="hz-display" style={{ fontSize: 28 }}>Give {athlete.display_name.split(' ')[0]} her own login.</div>
        <div style={{ color: 'var(--hz-dim)', fontSize: 12, marginTop: 6 }}>
          She can sign in on the iPad with this username and password. No email inbox needed.
        </div>
      </div>
      <label>
        <div className="hz-eyebrow" style={{ marginBottom: 8 }}>Username</div>
        <input className="hz-input" value={username} onChange={e => setUsername(e.target.value)} autoCapitalize="none" autoCorrect="off" required minLength={3}/>
      </label>
      <label>
        <div className="hz-eyebrow" style={{ marginBottom: 8 }}>Password</div>
        <input className="hz-input" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} placeholder="8+ characters"/>
      </label>
      <button type="submit" className="hz-btn hz-btn-primary" disabled={busy || username.length < 3 || password.length < 8}>
        {busy ? 'Saving…' : 'Save login'}
      </button>
      {error && <div style={{ gridColumn: '1 / -1', color: 'var(--hz-pink)', fontSize: 13 }}>{error}</div>}
      {done && (
        <div style={{ gridColumn: '1 / -1', padding: 14, borderRadius: 12, background: 'rgba(39,207,215,0.08)', color: 'var(--hz-dim)', fontSize: 13, lineHeight: 1.5 }}>
          Ready for iPad: username <b style={{ color: '#fff' }}>{done.login_identifier}</b>. Open Hit Zero, choose “Username + password,” and sign in.
        </div>
      )}
    </form>
  );
}
window.ParentDashboard = ParentDashboard;

// ─── Sessions (schedule) ───
function cleanOtherSessionType(value) {
  return String(value || 'Session')
    .replace(/^competition\s*:\s*dream on$/i, 'Competition')
    .replace(/\bdream on\b/ig, 'Competition')
    .replace(/\bbismarck,\s*nd\b/ig, '')
    .trim();
}
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
                  <td><span style={{ fontWeight: 600 }}>{cleanOtherSessionType(s.type)}</span>{s.is_competition && <Pill tone="pink" style={{ marginLeft: 10 }}>COMP</Pill>}</td>
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
  const program = window.HZsel.programProfile?.() || (snap.programs || [])[0] || {};
  const paymentSettings = window.HZsel.programPaymentSettings?.() || (snap.program_payment_settings || [])[0] || {};
  const bill = window.HZsel.programBilling();
  const readiness = window.HZsel.teamReadiness();
  const attendance = window.HZsel.teamAttendance();
  const leads = window.HZsel.leadSummary();
  const regs = window.HZsel.registrationSummary();
  const cashPct = bill.total ? Math.max(0, Math.min(100, (bill.paid / bill.total) * 100)) : 0;
  const programName = program.public_name || program.brand_name || program.name || 'Your gym';
  const programLocation = [program.city, program.state].filter(Boolean).join(', ') || program.city || 'Location not set';
  const directoryUrl = program.slug ? `/gyms/${program.slug}` : 'Slug not set';

  return (
    <div>
      <SectionHeading eyebrow={`Owner · ${programName}`} title="Program." trailing={
        <button className="hz-btn hz-btn-danger" onClick={() => { if (confirm('Reset all demo data?')) { window.HZdb._reset(); location.reload(); } }}><HZIcon name="trash" size={13}/> Reset demo data</button>
      }/>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <StatTile label="Athletes" value={snap.athletes.length} sub="across all teams"/>
        <StatTile label="Ready" value={`${Math.round(readiness*100)}%`} accent="var(--hz-teal)"/>
        <StatTile label="Leads Open" value={leads.active} sub={`${leads.converted} converted`} accent="var(--hz-pink)"/>
        <StatTile label="Admissions" value={regs.pending} sub={`${regs.accepted} accepted`} accent={regs.pending ? 'var(--hz-amber)' : 'var(--hz-green)'}/>
      </div>
      <div className="hz-card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.35fr 1fr 1fr', gap: 18, alignItems: 'stretch' }}>
          <div>
            <div className="hz-eyebrow" style={{ marginBottom: 10 }}>Gym identity · top of hierarchy</div>
            <div className="hz-display" style={{ fontSize: 34, marginBottom: 8 }}>{programName}</div>
            <div style={{ color: 'var(--hz-dim)', fontSize: 13, lineHeight: 1.5 }}>
              {program.description || 'This is the business record that owns teams, roster, billing, leads, registrations, and processor connections.'}
            </div>
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            <MiniStat label="Directory" value={program.is_public ? 'Public' : 'Hidden'} sub={`${directoryUrl} · ${programLocation}`} accent={program.is_public ? 'var(--hz-teal)' : 'var(--hz-amber)'}/>
            <MiniStat label="Lead intake" value={program.is_accepting_leads ? 'Open' : 'Closed'} sub="website forms attach to program_id" accent={program.is_accepting_leads ? 'var(--hz-green)' : 'var(--hz-dim)'}/>
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            <MiniStat label="Payment owner" value={(paymentSettings.default_provider || 'square').toUpperCase()} sub={`program_id ${String(program.id || 'unset').slice(0, 8)}`} accent="var(--hz-pink)"/>
            <MiniStat label="Checkout mode" value={(paymentSettings.checkout_mode || 'manual_invoice').replace(/_/g, ' ')} sub={paymentSettings.public_checkout_enabled ? 'public checkout enabled' : 'owner-gated until ready'} accent={paymentSettings.public_checkout_enabled ? 'var(--hz-green)' : 'var(--hz-amber)'}/>
          </div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div className="hz-card">
          <div className="hz-eyebrow" style={{ marginBottom: 14 }}>Revenue · Season</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 14 }}>
            <div className="hz-display" style={{ fontSize: 60 }}>${(bill.paid/1000).toFixed(1)}<span style={{ fontSize: 28 }}>k</span></div>
            <div style={{ color: 'var(--hz-dim)' }}>of ${(bill.total/1000).toFixed(1)}k</div>
          </div>
          <div style={{ height: 12, background: 'rgba(255,255,255,0.05)', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ width: `${cashPct}%`, height: '100%', background: 'linear-gradient(90deg, var(--hz-teal), var(--hz-pink))' }}/>
          </div>
          <div style={{ display: 'flex', gap: 20, marginTop: 14, fontSize: 12, color: 'var(--hz-dim)' }}>
            <div>Paid <span style={{ color: 'var(--hz-green)', fontFamily: 'var(--hz-mono)', fontWeight: 700 }}>${bill.paid.toLocaleString()}</span></div>
            <div>Owed <span style={{ color: 'var(--hz-amber)', fontFamily: 'var(--hz-mono)', fontWeight: 700 }}>${bill.owed.toLocaleString()}</span></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 18 }}>
            <div style={{ padding: '12px 14px', borderRadius: 12, border: '1px solid var(--hz-line)', background: 'rgba(255,255,255,0.03)' }}>
              <div className="hz-eyebrow" style={{ marginBottom: 6 }}>Attendance</div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{Math.round(attendance*100)}%</div>
              <div style={{ color: 'var(--hz-dim)', fontSize: 11, marginTop: 4 }}>program average</div>
            </div>
            <div style={{ padding: '12px 14px', borderRadius: 12, border: '1px solid var(--hz-line)', background: 'rgba(255,255,255,0.03)' }}>
              <div className="hz-eyebrow" style={{ marginBottom: 6 }}>Square Sync</div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{bill.syncedAccounts}</div>
              <div style={{ color: 'var(--hz-dim)', fontSize: 11, marginTop: 4 }}>
                {bill.hasSquareData ? `$${bill.syncedOpen.toLocaleString()} open` : 'waiting for first sync'}
              </div>
            </div>
          </div>
        </div>
        <div className="hz-card">
          <div className="hz-eyebrow" style={{ marginBottom: 14 }}>Owner radar</div>
          <div style={{ display: 'grid', gap: 12, marginBottom: 18 }}>
            <div style={{ padding: '12px 14px', borderRadius: 12, border: '1px solid var(--hz-line)', background: 'rgba(255,255,255,0.03)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>Lead pipeline</div>
                  <div style={{ color: 'var(--hz-dim)', fontSize: 12, marginTop: 4 }}>
                    {leads.new} new · {leads.tours} tours · {leads.trials} trials
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>{leads.winRate}%</div>
                  <div style={{ color: 'var(--hz-dim)', fontSize: 11 }}>win rate</div>
                </div>
              </div>
            </div>
            <div style={{ padding: '12px 14px', borderRadius: 12, border: '1px solid var(--hz-line)', background: 'rgba(255,255,255,0.03)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>Admissions queue</div>
                  <div style={{ color: 'var(--hz-dim)', fontSize: 12, marginTop: 4 }}>
                    {regs.pending} pending · {regs.waitlist} waitlist
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>{bill.delinquent}</div>
                  <div style={{ color: 'var(--hz-dim)', fontSize: 11 }}>past due families</div>
                </div>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button className="hz-btn" onClick={() => navigate('roster')} style={{ justifyContent: 'space-between' }}>Manage roster <HZIcon name="arrow-right" size={13}/></button>
            <button className="hz-btn" onClick={() => navigate('billing')} style={{ justifyContent: 'space-between' }}>Review billing <HZIcon name="arrow-right" size={13}/></button>
            <button className="hz-btn" onClick={() => navigate('leads')} style={{ justifyContent: 'space-between' }}>Work lead pipeline <HZIcon name="arrow-right" size={13}/></button>
            <button className="hz-btn" onClick={() => navigate('registration')} style={{ justifyContent: 'space-between' }}>Review registrations <HZIcon name="arrow-right" size={13}/></button>
            <button className="hz-btn" onClick={() => navigate('messages')} style={{ justifyContent: 'space-between' }}>Post announcement <HZIcon name="arrow-right" size={13}/></button>
            <button className="hz-btn" onClick={() => navigate('score')} style={{ justifyContent: 'space-between' }}>Run mock score <HZIcon name="arrow-right" size={13}/></button>
          </div>
        </div>
      </div>

      {/* Owner-managed marketing offerings — drives the public website */}
      <OfferingsManager snap={snap}/>
    </div>
  );
}
window.AdminConsole = AdminConsole;

// ─── Programs & Classes (Offerings Manager) ─────────────────────────
// Owner-managed: tracks (the 6 marketing categories) + classes (the priced
// items grouped under each track). The website Programs + Pricing pages
// render directly from these tables via public_program_tracks /
// public_program_classes views.
function OfferingsManager({ snap }) {
  const program = window.HZsel.programProfile?.() || (snap.programs || [])[0] || {};
  const programId = program.id;
  const tracks = window.HZsel.programTracks?.() || [];
  const allClasses = window.HZsel.programClasses?.() || [];
  const [editingTrackId, setEditingTrackId] = React.useState(null);
  const [busy, setBusy] = React.useState(false);

  if (!programId) {
    return <div className="hz-card" style={{ marginTop: 24 }}>No program loaded.</div>;
  }

  async function patchTrack(track, patch) {
    setBusy(true);
    try {
      const { error } = await window.HZdb.from('program_tracks').update(patch).eq('id', track.id);
      if (error) console.error('[tracks] update', error);
    } finally { setBusy(false); }
  }

  async function addClass(track) {
    setBusy(true);
    try {
      const order = (allClasses.filter(c => c.track_id === track.id).length || 0) * 10 + 10;
      const { error } = await window.HZdb.from('program_classes').insert({
        program_id: programId,
        track_id: track.id,
        name: 'New offering',
        price_cents: 0,
        price_unit: 'per_month',
        price_unit_label: '/month',
        display_order: order,
        is_public: true,
      });
      if (error) console.error('[classes] insert', error);
    } finally { setBusy(false); }
  }

  return (
    <div className="hz-card" style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div className="hz-eyebrow" style={{ marginBottom: 6 }}>Programs &amp; Classes · live on the website</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>What you sell.</div>
          <div style={{ color: 'var(--hz-dim)', fontSize: 12, marginTop: 4 }}>
            6 tracks · {allClasses.length} priced offerings · changes here update <code style={{ fontFamily: 'var(--hz-mono)' }}>magic-city-allstars.vercel.app</code> instantly.
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {tracks.map(t => {
          const classes = allClasses.filter(c => c.track_id === t.id);
          const isEditing = editingTrackId === t.id;
          return (
            <div key={t.id} style={{ border: '1px solid var(--hz-line)', borderRadius: 14, padding: 16, background: 'rgba(255,255,255,0.02)' }}>
              {/* Track header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 6, fontSize: 11, fontWeight: 700, background: t.tone === 'pink' ? 'rgba(249,127,172,0.18)' : t.tone === 'teal' ? 'rgba(39,207,215,0.18)' : 'rgba(255,255,255,0.08)', color: t.tone === 'pink' ? 'var(--hz-pink)' : t.tone === 'teal' ? 'var(--hz-teal)' : '#fff' }}>{t.code}</span>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{t.name}</div>
                    {!t.is_public && <span className="hz-eyebrow" style={{ color: 'var(--hz-amber)', fontSize: 10 }}>HIDDEN</span>}
                  </div>
                  {t.eyebrow && <div className="hz-eyebrow" style={{ fontSize: 10, marginBottom: 4 }}>{t.eyebrow}</div>}
                  {t.body && <div style={{ color: 'var(--hz-dim)', fontSize: 12, lineHeight: 1.5 }}>{t.body}</div>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--hz-dim)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!t.is_public} disabled={busy} onChange={e => patchTrack(t, { is_public: e.target.checked })}/>
                    Public
                  </label>
                  <button className="hz-btn" style={{ fontSize: 12, padding: '6px 10px' }} onClick={() => setEditingTrackId(isEditing ? null : t.id)}>
                    {isEditing ? 'Done' : 'Edit copy'}
                  </button>
                </div>
              </div>

              {/* Track copy editor */}
              {isEditing && (
                <TrackCopyEditor track={t} onSave={(patch) => patchTrack(t, patch).then(() => setEditingTrackId(null))} disabled={busy}/>
              )}

              {/* Classes inside this track */}
              <div style={{ marginTop: 14, borderTop: '1px solid var(--hz-line)', paddingTop: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div className="hz-eyebrow" style={{ fontSize: 10 }}>{classes.length} offering{classes.length === 1 ? '' : 's'}</div>
                  <button className="hz-btn hz-btn-primary" style={{ fontSize: 11, padding: '6px 10px' }} disabled={busy} onClick={() => addClass(t)}>
                    + Add class
                  </button>
                </div>
                {classes.length === 0 && (
                  <div style={{ color: 'var(--hz-dim)', fontSize: 12, fontStyle: 'italic', padding: 8 }}>
                    No priced offerings yet — add one to make this track sellable on the website.
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {classes.map(c => <ClassRow key={c.id} cls={c} disabled={busy} onChange={() => {}}/>)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TrackCopyEditor({ track, onSave, disabled }) {
  const [name, setName] = React.useState(track.name || '');
  const [eyebrow, setEyebrow] = React.useState(track.eyebrow || '');
  const [body, setBody] = React.useState(track.body || '');
  const [bullets, setBullets] = React.useState((track.bullets || []).join('\n'));
  const [ctaLabel, setCtaLabel] = React.useState(track.cta_label || '');
  const [ctaKind, setCtaKind] = React.useState(track.cta_kind || 'contact');
  const [tone, setTone] = React.useState(track.tone || 'mix');
  return (
    <div style={{ marginTop: 12, padding: 12, background: 'rgba(255,255,255,0.04)', borderRadius: 10, display: 'grid', gap: 10 }}>
      <FieldRow label="Name">
        <input className="hz-input" value={name} onChange={e => setName(e.target.value)} style={{ width: '100%' }}/>
      </FieldRow>
      <FieldRow label="Eyebrow (small label above)">
        <input className="hz-input" value={eyebrow} onChange={e => setEyebrow(e.target.value)} style={{ width: '100%' }} placeholder="Tiny · Mini · Youth · Junior · Senior"/>
      </FieldRow>
      <FieldRow label="Description (paragraph on the card)">
        <textarea className="hz-input" value={body} onChange={e => setBody(e.target.value)} rows={3} style={{ width: '100%' }}/>
      </FieldRow>
      <FieldRow label="Bullets (one per line)">
        <textarea className="hz-input" value={bullets} onChange={e => setBullets(e.target.value)} rows={3} style={{ width: '100%' }} placeholder="6-month season&#10;One competition performance&#10;Tiny / Mini / Youth / Junior / Senior"/>
      </FieldRow>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10 }}>
        <FieldRow label="CTA button label">
          <input className="hz-input" value={ctaLabel} onChange={e => setCtaLabel(e.target.value)} style={{ width: '100%' }} placeholder="Tryout info"/>
        </FieldRow>
        <FieldRow label="CTA action">
          <select className="hz-input" value={ctaKind} onChange={e => setCtaKind(e.target.value)} style={{ width: '100%' }}>
            <option value="contact">Contact form</option>
            <option value="register">Registration window</option>
            <option value="external">External URL</option>
            <option value="none">None</option>
          </select>
        </FieldRow>
        <FieldRow label="Tone">
          <select className="hz-input" value={tone} onChange={e => setTone(e.target.value)} style={{ width: '100%' }}>
            <option value="pink">Pink</option>
            <option value="teal">Teal</option>
            <option value="mix">Gradient</option>
            <option value="dark">Dark</option>
          </select>
        </FieldRow>
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
        <button className="hz-btn hz-btn-primary" disabled={disabled} onClick={() => onSave({
          name: name.trim(),
          eyebrow: eyebrow.trim() || null,
          body: body.trim() || null,
          bullets: bullets.split('\n').map(s => s.trim()).filter(Boolean),
          cta_label: ctaLabel.trim() || null,
          cta_kind: ctaKind,
          tone,
        })}>Save copy</button>
      </div>
    </div>
  );
}

function ClassRow({ cls, disabled }) {
  const [name, setName] = React.useState(cls.name || '');
  const [priceCents, setPriceCents] = React.useState(cls.price_cents || 0);
  const [priceUnit, setPriceUnit] = React.useState(cls.price_unit || 'per_month');
  const [priceUnitLabel, setPriceUnitLabel] = React.useState(cls.price_unit_label || '');
  const [schedule, setSchedule] = React.useState(cls.schedule_summary || '');
  const [capacity, setCapacity] = React.useState(cls.capacity ?? '');
  const [registrationOpen, setRegistrationOpen] = React.useState(!!cls.registration_open);
  const [isPublic, setIsPublic] = React.useState(!!cls.is_public);
  const [dirty, setDirty] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  function mark() { setDirty(true); }

  async function save() {
    setSaving(true);
    try {
      const patch = {
        name: name.trim() || 'Untitled',
        price_cents: Math.max(0, parseInt(priceCents, 10) || 0),
        price_unit: priceUnit,
        price_unit_label: priceUnitLabel.trim() || null,
        schedule_summary: schedule.trim() || null,
        capacity: capacity === '' ? null : Math.max(0, parseInt(capacity, 10) || 0),
        registration_open: !!registrationOpen,
        is_public: !!isPublic,
      };
      const { error } = await window.HZdb.from('program_classes').update(patch).eq('id', cls.id);
      if (error) console.error('[classes] update', error);
      else setDirty(false);
    } finally { setSaving(false); }
  }

  async function remove() {
    if (!confirm(`Delete "${name}"? This removes it from the website.`)) return;
    setSaving(true);
    try {
      const { error } = await window.HZdb.from('program_classes').delete().eq('id', cls.id);
      if (error) console.error('[classes] delete', error);
    } finally { setSaving(false); }
  }

  const dollars = (priceCents / 100).toFixed(2).replace(/\.00$/, '');

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 100px 1fr 1.4fr 80px auto', gap: 8, alignItems: 'center', padding: '8px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
      <input className="hz-input" value={name} onChange={e => { setName(e.target.value); mark(); }} placeholder="Senior" disabled={disabled || saving} style={{ fontSize: 13, padding: '6px 8px' }}/>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ color: 'var(--hz-dim)', fontSize: 12 }}>$</span>
        <input className="hz-input" type="number" value={dollars} onChange={e => { setPriceCents(Math.round(parseFloat(e.target.value || 0) * 100)); mark(); }} disabled={disabled || saving} style={{ fontSize: 13, padding: '6px 8px', width: '100%' }}/>
      </div>
      <select className="hz-input" value={priceUnit} onChange={e => { setPriceUnit(e.target.value); mark(); }} disabled={disabled || saving} style={{ fontSize: 12, padding: '6px 8px' }}>
        <option value="per_month">/month</option>
        <option value="per_session">/session</option>
        <option value="per_session_per_month">/month per session</option>
        <option value="per_athlete">/athlete</option>
        <option value="flat">flat</option>
        <option value="custom">custom</option>
      </select>
      <input className="hz-input" value={schedule} onChange={e => { setSchedule(e.target.value); mark(); }} placeholder="6-week sessions" disabled={disabled || saving} style={{ fontSize: 12, padding: '6px 8px' }}/>
      <input className="hz-input" type="number" value={capacity} onChange={e => { setCapacity(e.target.value); mark(); }} placeholder="∞" disabled={disabled || saving} style={{ fontSize: 12, padding: '6px 8px' }}/>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <label title="Public on website" style={{ cursor: 'pointer', fontSize: 11 }}>
          <input type="checkbox" checked={isPublic} onChange={e => { setIsPublic(e.target.checked); mark(); }} disabled={disabled || saving}/>
        </label>
        <button className="hz-btn" style={{ fontSize: 11, padding: '4px 8px' }} disabled={!dirty || saving} onClick={save}>{saving ? '…' : dirty ? 'Save' : '✓'}</button>
        <button className="hz-btn hz-btn-danger" style={{ fontSize: 11, padding: '4px 8px' }} disabled={saving} onClick={remove} title="Delete">×</button>
      </div>
    </div>
  );
}

function FieldRow({ label, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span className="hz-eyebrow" style={{ fontSize: 10 }}>{label}</span>
      {children}
    </label>
  );
}

window.OfferingsManager = OfferingsManager;

// ─── Billing ───
function Billing({ snap, session, openAthlete }) {
  const bill = window.HZsel.programBilling();
  const program = window.HZsel.programProfile?.() || (snap.programs || [])[0] || {};
  const isParent = session.profile.role === 'parent';
  const accounts = (snap.billing_accounts || []).map(acc => ({ ...acc, athlete: snap.athletes.find(a => a.id === acc.athlete_id) }));
  const programRef = {
    program_id: (snap.teams || [])[0]?.program_id || program.id || null,
    program_slug: program.slug || 'mca',
  };

  return (
    <div>
      <SectionHeading eyebrow={isParent ? 'My family' : 'Program billing'} title="Billing."/>
      {!isParent && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
            <StatTile label="Collected" value={`$${bill.paid.toLocaleString()}`} accent="var(--hz-green)" size="md"/>
            <StatTile label="Outstanding" value={`$${bill.owed.toLocaleString()}`} accent="var(--hz-amber)" size="md"/>
            <StatTile label="Past Due" value={bill.delinquent} sub={`of ${bill.nAccounts} accounts`} size="md"/>
            <StatTile
              label="Square Open"
              value={`$${bill.syncedOpen.toLocaleString()}`}
              sub={bill.hasSquareData ? `${bill.syncedAccounts} matched families` : 'run first sync'}
              accent={bill.syncedOpen > 0 ? 'var(--hz-pink)' : 'var(--hz-teal)'}
              size="md"
            />
          </div>
          <SquareBillingPanel programRef={programRef}/>
        </>
      )}
      <div className="hz-card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="hz-table">
          <thead><tr><th style={{ paddingLeft: 20 }}>Athlete</th><th>Season</th><th>Paid</th><th>Balance</th>{!isParent && <th>Sync</th>}{!isParent && <th>Square snapshot</th>}<th>Autopay</th></tr></thead>
          <tbody>
            {accounts.map(a => (
              <tr key={a.id} onClick={() => openAthlete && openAthlete(a.athlete_id)} style={{ cursor: 'pointer' }}>
                <td style={{ paddingLeft: 20 }}>
                  {a.athlete && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Avatar name={a.athlete.display_name} initials={a.athlete.initials} color={a.athlete.photo_color} src={a.athlete.photo_url} size={28}/>
                      <span style={{ fontWeight: 600 }}>{a.athlete.display_name}</span>
                    </div>
                  )}
                </td>
                <td style={{ fontFamily: 'var(--hz-mono)' }}>${a.season_total}</td>
                <td style={{ fontFamily: 'var(--hz-mono)', color: 'var(--hz-green)' }}>${a.paid}</td>
                <td>{a.owed > 0 ? <Pill tone="amber">${a.owed}</Pill> : <span style={{ color: 'var(--hz-dim)' }}>$0</span>}</td>
                {!isParent && (
                  <td>
                    {a.sync_status === 'matched' ? <Pill tone="teal">Matched</Pill>
                      : a.sync_status === 'unmatched' ? <Pill tone="amber">Needs match</Pill>
                      : a.sync_status === 'missing_parent_email' ? <Pill tone="pink">Missing email</Pill>
                      : <span style={{ color: 'var(--hz-dim)', fontSize: 11 }}>Not synced</span>}
                  </td>
                )}
                {!isParent && (
                  <td>
                    {a.sync_status === 'matched' ? (
                      <div>
                        <div style={{ fontFamily: 'var(--hz-mono)', color: 'var(--hz-green)' }}>${Number(a.synced_paid || 0).toLocaleString()} paid</div>
                        <div style={{ color: 'var(--hz-dim)', fontSize: 11 }}>${Number(a.synced_open_amount || 0).toLocaleString()} open · {a.synced_open_invoice_count || 0} invoices</div>
                      </div>
                    ) : (
                      <div style={{ color: 'var(--hz-dim)', fontSize: 11 }}>Waiting for Square customer match</div>
                    )}
                  </td>
                )}
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

function SquareBillingPanel({ programRef }) {
  const [state, setState] = React.useState({ loading: true, busy: false, data: null, error: '' });
  const [flash, setFlash] = React.useState(null);

  React.useEffect(() => {
    const url = new URL(window.location.href);
    const square = url.searchParams.get('square');
    const message = url.searchParams.get('message');
    if (square) {
      setFlash({
        kind: square === 'connected' ? 'success' : square === 'error' ? 'error' : 'info',
        text: square === 'connected'
          ? 'Square connected. Pulling the first sync in now will show how families map back into Hit Zero.'
          : message || `Square returned: ${square}`,
      });
      url.searchParams.delete('square');
      url.searchParams.delete('message');
      history.replaceState(null, '', url.toString());
    }
  }, []);

  React.useEffect(() => {
    let dead = false;
    loadStatus();
    return () => { dead = true; };

    async function loadStatus() {
      setState(prev => ({ ...prev, loading: true, error: '' }));
      try {
        const qs = new URLSearchParams();
        if (programRef.program_id) qs.set('program_id', programRef.program_id);
        if (programRef.program_slug) qs.set('program_slug', programRef.program_slug);
        const res = await fetch(`${window.HZ_FN_BASE}/functions/v1/square-admin-v1?${qs.toString()}`, {
          headers: window.HZ_ANON_KEY ? { Authorization: 'Bearer ' + window.HZ_ANON_KEY } : undefined,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load Square status');
        if (!dead) setState({ loading: false, busy: false, data, error: '' });
      } catch (e) {
        if (!dead) setState({ loading: false, busy: false, data: null, error: e.message || String(e) });
      }
    }
  }, [programRef.program_id, programRef.program_slug]);

  async function call(action, extra = {}) {
    setState(prev => ({ ...prev, busy: true, error: '' }));
    try {
      const res = await fetch(`${window.HZ_FN_BASE}/functions/v1/square-admin-v1`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(window.HZ_ANON_KEY ? { Authorization: 'Bearer ' + window.HZ_ANON_KEY } : {}),
        },
        body: JSON.stringify({
          action,
          program_id: programRef.program_id,
          program_slug: programRef.program_slug,
          return_to: `${window.location.origin}/#billing`,
          ...extra,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Square action failed: ${action}`);
      setState(prev => ({ ...prev, busy: false }));
      return data;
    } catch (e) {
      setState(prev => ({ ...prev, busy: false, error: e.message || String(e) }));
      throw e;
    }
  }

  async function onConnect() {
    const out = await call('connect_url');
    if (out?.url) window.location.href = out.url;
  }

  async function onSync() {
    const out = await call('sync');
    setState(prev => ({
      ...prev,
      loading: false,
      data: {
        ...(prev.data || {}),
        ...(out || {}),
        preview: out.preview,
      },
      error: '',
    }));
    const refreshed = await fetch(`${window.HZ_FN_BASE}/functions/v1/square-admin-v1?program_id=${encodeURIComponent(programRef.program_id || '')}&program_slug=${encodeURIComponent(programRef.program_slug || '')}`, {
      headers: window.HZ_ANON_KEY ? { Authorization: 'Bearer ' + window.HZ_ANON_KEY } : undefined,
    });
    const data = await refreshed.json();
    if (refreshed.ok) setState(prev => ({ ...prev, loading: false, data }));
  }

  async function onDisconnect() {
    if (!confirm('Disconnect Square from this program?')) return;
    await call('disconnect');
    setFlash({ kind: 'info', text: 'Square has been disconnected for this program.' });
    const res = await fetch(`${window.HZ_FN_BASE}/functions/v1/square-admin-v1?program_id=${encodeURIComponent(programRef.program_id || '')}&program_slug=${encodeURIComponent(programRef.program_slug || '')}`, {
      headers: window.HZ_ANON_KEY ? { Authorization: 'Bearer ' + window.HZ_ANON_KEY } : undefined,
    });
    const data = await res.json();
    if (res.ok) setState(prev => ({ ...prev, loading: false, data, error: '' }));
  }

  const data = state.data || {};
  const conn = data.connection;
  const preview = data.preview;
  const statusTone = !data.configured ? 'amber' : conn?.status === 'connected' ? 'teal' : conn?.status === 'error' ? 'pink' : 'amber';
  const statusLabel = !data.configured ? 'Needs setup' : conn?.status === 'connected' ? 'Connected' : conn?.status === 'disconnected' ? 'Disconnected' : 'Not connected';

  return (
    <div className="hz-card" style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <div className="hz-eyebrow" style={{ marginBottom: 8 }}>Square integration</div>
          <div className="hz-display" style={{ fontSize: 30, marginBottom: 8 }}>
            Billing with a <span className="hz-zero">real processor</span>.
          </div>
          <div style={{ color: 'var(--hz-dim)', fontSize: 13, maxWidth: 760, lineHeight: 1.5 }}>
            Connect the gym&apos;s Square account, pull live customer + invoice + payment data, and verify which families are matching back into Hit Zero before we let the app become a true billing command center.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Pill tone={statusTone}>{statusLabel}</Pill>
          <button className="hz-btn" onClick={onSync} disabled={state.busy || !data.configured || conn?.status !== 'connected'}>
            {state.busy ? 'Working…' : 'Sync now'}
          </button>
          {conn?.status === 'connected' ? (
            <button className="hz-btn hz-btn-ghost" onClick={onDisconnect} disabled={state.busy}>Disconnect</button>
          ) : (
            <button className="hz-btn hz-btn-primary" onClick={onConnect} disabled={state.busy || !data.configured}>
              Connect Square
            </button>
          )}
        </div>
      </div>

      {flash && (
        <div style={{
          marginTop: 16,
          padding: '12px 14px',
          borderRadius: 10,
          border: '1px solid ' + (flash.kind === 'success' ? 'rgba(63,231,160,0.25)' : flash.kind === 'error' ? 'rgba(255,94,108,0.3)' : 'rgba(255,180,84,0.25)'),
          background: flash.kind === 'success' ? 'rgba(63,231,160,0.08)' : flash.kind === 'error' ? 'rgba(255,94,108,0.08)' : 'rgba(255,180,84,0.08)',
          color: flash.kind === 'success' ? 'var(--hz-green)' : flash.kind === 'error' ? 'var(--hz-red)' : 'var(--hz-amber)',
          fontSize: 12.5,
        }}>{flash.text}</div>
      )}

      {state.error && (
        <div style={{ marginTop: 14, color: 'var(--hz-red)', fontSize: 12.5 }}>{state.error}</div>
      )}

      {!data.configured && !state.loading && (
        <div style={{ marginTop: 16, color: 'var(--hz-dim)', fontSize: 12.5, lineHeight: 1.5 }}>
          Backend wiring is live, but the Square app credentials are not set yet. Add `SQUARE_APP_ID`, `SQUARE_APP_SECRET`, `SQUARE_TOKEN_CRYPT_KEY`, and `SQUARE_WEBHOOK_SIGNATURE_KEY` in Supabase secrets to finish the live connection.
        </div>
      )}

      {conn && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginTop: 18 }}>
          <MiniStat label="Merchant" value={conn.external_business_name || 'Square seller'} sub={conn.environment}/>
          <MiniStat label="Status" value={(conn.last_sync_status || conn.status || 'idle').replace('_', ' ')} sub={conn.last_sync_completed_at ? new Date(conn.last_sync_completed_at).toLocaleString() : 'No sync yet'}/>
          <MiniStat label="Location" value={conn.external_location_id ? conn.external_location_id.slice(-6) : '—'} sub="primary location"/>
          <MiniStat label="Scopes" value={String((conn.scopes || []).length)} sub="granted permissions"/>
        </div>
      )}

      {preview && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginTop: 18 }}>
            <MiniStat label="Matched" value={preview.counts?.matched_accounts ?? 0} sub={`${preview.counts?.accounts ?? 0} billing accounts`} accent="var(--hz-teal)"/>
            <MiniStat label="Unmatched" value={preview.counts?.unmatched_accounts ?? 0} sub="needs cleanup" accent="var(--hz-amber)"/>
            <MiniStat label="Square paid" value={`$${Number(preview.totals?.synced_paid || 0).toLocaleString()}`} sub="rolling sync total" accent="var(--hz-green)"/>
            <MiniStat label="Open invoices" value={preview.totals?.open_invoice_count ?? 0} sub={`$${Number(preview.totals?.open_invoice_amount || 0).toLocaleString()} open`} accent="var(--hz-pink)"/>
          </div>

          <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: '1.25fr 0.75fr', gap: 16 }}>
            <div className="hz-card" style={{ padding: 0, overflow: 'hidden', background: 'rgba(255,255,255,0.02)' }}>
              <table className="hz-table">
                <thead>
                  <tr>
                    <th style={{ paddingLeft: 18 }}>Matched family</th>
                    <th>Square customer</th>
                    <th>Paid</th>
                    <th>Open</th>
                  </tr>
                </thead>
                <tbody>
                  {(preview.accounts || []).slice(0, 8).map(row => (
                    <tr key={row.account_id}>
                      <td style={{ paddingLeft: 18 }}>
                        <div style={{ fontWeight: 600 }}>{row.athlete_name}</div>
                        <div style={{ color: 'var(--hz-dim)', fontSize: 11 }}>{row.parent_email || 'No parent email'}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{row.square_customer_name || '—'}</div>
                        <div style={{ color: 'var(--hz-dim)', fontSize: 11 }}>{row.square_customer_id}</div>
                      </td>
                      <td style={{ color: 'var(--hz-green)', fontFamily: 'var(--hz-mono)' }}>${Number(row.synced_paid || 0).toLocaleString()}</td>
                      <td>
                        <div style={{ fontFamily: 'var(--hz-mono)' }}>${Number(row.open_invoice_amount || 0).toLocaleString()}</div>
                        <div style={{ color: 'var(--hz-dim)', fontSize: 11 }}>{row.open_invoice_count} open</div>
                      </td>
                    </tr>
                  ))}
                  {!(preview.accounts || []).length && (
                    <tr><td colSpan="4" style={{ padding: 18, color: 'var(--hz-dim)' }}>No matched families yet. Connect Square and run the first sync.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="hz-card" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <div className="hz-eyebrow" style={{ marginBottom: 10 }}>Needs attention</div>
              <div style={{ display: 'grid', gap: 8 }}>
                {(preview.unmatched_accounts || []).slice(0, 8).map(row => (
                  <div key={row.athlete_id} style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--hz-line)', background: 'rgba(255,255,255,0.03)' }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{row.athlete_name}</div>
                    <div style={{ color: 'var(--hz-dim)', fontSize: 11, marginTop: 4 }}>
                      {row.parent_email || 'Missing parent email in Hit Zero'}
                    </div>
                  </div>
                ))}
                {!(preview.unmatched_accounts || []).length && (
                  <div style={{ color: 'var(--hz-dim)', fontSize: 12.5 }}>Nothing stuck right now. The family-to-customer matching pass looks clean.</div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {state.loading && (
        <div style={{ marginTop: 16, color: 'var(--hz-dim)', fontSize: 12.5 }}>Loading Square status…</div>
      )}
    </div>
  );
}
