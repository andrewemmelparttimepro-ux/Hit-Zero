// ─────────────────────────────────────────────────────────────────────────────
// HIT ZERO WEB — Athlete Reel + Skill Tree + Parent Dashboard + rest of screens
// ─────────────────────────────────────────────────────────────────────────────

function resolveSessionAthlete(snap, session) {
  const scope = window.HZviewerScope ? window.HZviewerScope(snap, session) : null;
  return scope?.ownAthlete || scope?.visibleAthletes?.[0] || null;
}

function scopedAthleteForFeature(snap, session, selectedId) {
  const scope = window.HZviewerScope ? window.HZviewerScope(snap, session) : null;
  if (!scope) return { scope: null, athlete: resolveSessionAthlete(snap, session), choices: [] };
  if (scope.role === 'parent') {
    const choices = scope.visibleAthletes || [];
    const selected = selectedId ? choices.find(a => a.id === selectedId) : null;
    return { scope, athlete: selected || (choices.length === 1 ? choices[0] : null), choices };
  }
  return { scope, athlete: scope.ownAthlete || scope.visibleAthletes?.[0] || null, choices: scope.visibleAthletes || [] };
}

function AthleteFeatureGate({ choices, feature = 'this area', onPick, navigate }) {
  if (choices.length > 1) {
    return (
      <div>
        <SectionHeading eyebrow="Choose athlete" title="Which athlete?"/>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          {choices.map(athlete => (
            <button key={athlete.id} className="hz-card" style={{ padding: 16, textAlign: 'left', cursor: 'pointer' }} onClick={() => onPick(athlete.id)}>
              <Avatar name={athlete.display_name} initials={athlete.initials} color={athlete.photo_color} src={athlete.photo_url} size={44}/>
              <div style={{ fontWeight: 800, marginTop: 12 }}>{athlete.display_name}</div>
              <div style={{ color: 'var(--hz-dim)', fontSize: 12, marginTop: 4 }}>{athlete.position || athlete.role || 'athlete'}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }
  return (
    <EmptyState
      icon="users"
      title="No athlete linked yet."
      body={`${feature} unlocks after this account is linked to a specific athlete.`}
      action={navigate && <button className="hz-btn hz-btn-primary" onClick={() => navigate('parent')}>Go to Home</button>}
    />
  );
}

function centsToParentMoney(cents) {
  return '$' + ((Number(cents || 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }));
}

function dollarsToParentMoney(value) {
  return '$' + Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function packetStatusForParent(snap, session, programId) {
  const profile = session?.actualProfile || session?.profile || {};
  return (snap.family_info_packets || [])
    .filter(row => row.profile_id === profile.id && (!programId || row.program_id === programId))
    .sort((a, b) => new Date(b.updated_at || b.submitted_at || b.created_at || 0) - new Date(a.updated_at || a.submitted_at || a.created_at || 0))[0] || null;
}

function parentBillingSummary(snap, session) {
  const scope = window.HZviewerScope ? window.HZviewerScope(snap, session) : null;
  const visibleAthleteIds = scope?.visibleAthleteIds || new Set();
  const accounts = (snap.billing_accounts || []).filter(acc => visibleAthleteIds.has(acc.athlete_id));
  const accountIds = new Set(accounts.map(acc => acc.id));
  const charges = (snap.billing_charges || []).filter(charge => accountIds.has(charge.account_id));
  const enrollments = window.HZsel?.classEnrollmentsForParent ? window.HZsel.classEnrollmentsForParent(session) : [];
  const accountPaid = accounts.reduce((sum, acc) => sum + Number(acc.paid || 0), 0);
  const accountTotal = accounts.reduce((sum, acc) => sum + Number(acc.season_total || 0), 0);
  const chargeTotal = charges.reduce((sum, charge) => sum + Number(charge.amount || 0), 0);
  const chargePaid = charges.reduce((sum, charge) => sum + ((charge.paid_at || charge.external_status === 'paid') ? Number(charge.amount || 0) : 0), 0);
  const enrollmentPaid = enrollments.reduce((sum, row) => sum + (row.payment_status === 'paid' ? Number(row.amount_paid_cents || 0) / 100 : 0), 0);
  const enrollmentTotal = enrollments.reduce((sum, row) => {
    const classPrice = Number(row.class?.price_cents || row.metadata?.expected_price_cents || 0) / 100;
    const paid = Number(row.amount_paid_cents || 0) / 100;
    return sum + Math.max(classPrice, paid);
  }, 0);
  const paid = Math.round(Math.max(accountPaid, chargePaid, enrollmentPaid) * 100) / 100;
  const total = Math.round(Math.max(accountTotal, chargeTotal, enrollmentTotal, paid) * 100) / 100;
  const owed = Math.max(0, Math.round((total - paid) * 100) / 100);
  const pendingCount = charges.filter(charge => !(charge.paid_at || charge.external_status === 'paid')).length
    + enrollments.filter(row => row.payment_status !== 'paid' || row.staff_status !== 'accepted').length;
  return { accounts, charges, enrollments, paid, total, owed, pendingCount };
}

function ageFromDobOrNumber(dob, age) {
  if (age !== '' && age != null && Number.isFinite(Number(age))) return Math.round(Number(age));
  if (!dob) return null;
  const parsed = new Date(String(dob) + 'T00:00:00');
  if (Number.isNaN(parsed.getTime())) return null;
  const today = new Date();
  let years = today.getFullYear() - parsed.getFullYear();
  const m = today.getMonth() - parsed.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < parsed.getDate())) years--;
  return years;
}

function classFitsAge(klass, age) {
  if (!klass || age == null) return true;
  const min = klass.age_range_min == null ? null : Number(klass.age_range_min);
  const max = klass.age_range_max == null ? null : Number(klass.age_range_max);
  return (min == null || age >= min) && (max == null || age <= max);
}

function screenLiveMode() {
  return Boolean(window.HZsupa && window.HZdb?.auth?._mode?.() === 'live');
}

function screenUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
}

async function insertLiveThenLocal(table, payload, onConflict = 'id') {
  if (screenLiveMode()) {
    const { data, error } = await window.HZsupa.from(table).insert(payload).select('*').single();
    if (error) return { data: null, error };
    await window.HZdb.from(table).upsert(data || payload, { onConflict });
    return { data: data || payload, error: null };
  }
  return await window.HZdb.from(table).insert(payload);
}

async function updateLiveThenLocal(table, id, patch, onConflict = 'id') {
  if (screenLiveMode() && screenUuid(id)) {
    const { data, error } = await window.HZsupa.from(table).update(patch).eq('id', id).select('*').single();
    if (error) return { data: null, error };
    await window.HZdb.from(table).upsert(data || { ...patch, id }, { onConflict });
    return { data: data || { ...patch, id }, error: null };
  }
  return await window.HZdb.from(table).update(patch).eq('id', id);
}

// ─── Athlete Reel: personal wins feed, next goals ───
function AthleteReel({ snap, session, navigate }) {
  const [selectedAthleteId, setSelectedAthleteId] = React.useState(null);
  const scoped = scopedAthleteForFeature(snap, session, selectedAthleteId);
  const myAthlete = scoped.athlete;
  if (!myAthlete) {
    return <AthleteFeatureGate choices={scoped.choices} feature="Reel" onPick={setSelectedAthleteId} navigate={session?.profile?.role === 'parent' ? navigate : null}/>;
  }
  const readiness = window.HZsel.athleteReadiness(myAthlete.id);
  const summary = window.HZsel.athleteSkillsSummary(myAthlete.id);
  const attendance = window.HZsel.athleteAttendance(myAthlete.id);
  const myCels = (snap.celebrations || []).filter(c => c.athlete_id === myAthlete.id).slice(0, 6);
  const statusMap = {};
  (snap.athlete_skills || []).filter(r => r.athlete_id === myAthlete.id).forEach(r => { statusMap[r.skill_id] = r.status; });
  const nextUp = snap.skills.filter(s => s.level <= 4 && (statusMap[s.id] === 'working' || !statusMap[s.id])).slice(0, 5);
  const isParentViewer = session?.profile?.role === 'parent';
  const reelFirst = myAthlete.display_name.split(' ')[0];
  const reelProgram = (snap.programs || []).find(p => p.id === (session?.actualProfile?.program_id || session?.profile?.program_id)) || (snap.programs || [])[0] || null;
  const reelProgramName = window.HZprogramDisplayName ? window.HZprogramDisplayName(reelProgram, 'your gym') : (reelProgram?.brand_name || reelProgram?.public_name || reelProgram?.name || 'your gym');

  return (
    <div>
      <div style={{ marginBottom: 40 }}>
        <div className="hz-eyebrow" style={{ marginBottom: 10 }}>{isParentViewer ? reelFirst + "'s highlights" : 'My reel'} · {reelProgramName}</div>
        <div className="hz-display" style={{ fontSize: 72, lineHeight: 0.9 }}>
          {isParentViewer
            ? <>{reelFirst}'s <span className="hz-zero">highlights</span>.</>
            : <>Hey {reelFirst}.<br/>Look at you <span className="hz-zero">go</span>.</>}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 24, marginBottom: 24 }}>
        <div className="hz-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 32 }}>
          <Avatar name={myAthlete.display_name} initials={myAthlete.initials} color={myAthlete.photo_color} src={myAthlete.photo_url} size={96}/>
          <div className="hz-display" style={{ fontSize: 32, marginTop: 18 }}>{myAthlete.display_name}</div>
          <div style={{ color: 'var(--hz-dim)', fontSize: 12, marginTop: 6, textTransform: 'capitalize' }}>{myAthlete.role} · Age {myAthlete.age}</div>
          <Dial value={readiness} size={180} label={isParentViewer ? 'Readiness' : 'My Readiness'}/>
        </div>

        <div className="hz-card">
          <div className="hz-eyebrow" style={{ marginBottom: 14 }}>Recent wins</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {myCels.length === 0 && <div style={{ color: 'var(--hz-dim)', padding: 20, fontSize: 13 }}>{isParentViewer ? reelFirst + "'s wins will show up here." : 'Your wins will show up here.'}</div>}
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
        <StatTile
          label="Attendance"
          value={attendance.empty ? 'No logs' : `${Math.round((attendance.pct || 0)*100)}%`}
          sub={attendance.empty ? 'No attendance yet.' : `${attendance.attended} / ${attendance.total} sessions`}
          size="md"
        />
        <StatTile label="Next Up" value={nextUp.length} sub="skills to work" accent="var(--hz-amber)" size="md"/>
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
  return (
    <EmptyState
      icon="star"
      title="Pins are paused."
      body="The athlete pin game is hidden until the production tables, team-safe sharing rules, and approval model are built."
    />
  );
}

function PinsHubScaffold({ snap, session }) {
  const [selectedAthleteId, setSelectedAthleteId] = React.useState(null);
  const scoped = scopedAthleteForFeature(snap, session, selectedAthleteId);
  const myAthlete = scoped.athlete;
  if (!myAthlete) {
    return <AthleteFeatureGate choices={scoped.choices} feature="Pins" onPick={setSelectedAthleteId}/>;
  }
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
  const teamProgramId = (snap.teams || []).find(t => t.id === myAthlete.team_id)?.program_id || null;
  const programId = session?.actualProfile?.program_id || session?.profile?.program_id || myAthlete.program_id || teamProgramId || (snap.programs || [])[0]?.id || 'p_mca';
  const pinProgram = (snap.programs || []).find(p => p.id === programId) || (snap.programs || [])[0] || null;
  const pinProgramName = window.HZprogramDisplayName ? window.HZprogramDisplayName(pinProgram, 'your gym') : (pinProgram?.brand_name || pinProgram?.public_name || pinProgram?.name || 'your gym');
  const pinProgramLocation = window.HZprogramLocationLabel ? window.HZprogramLocationLabel(pinProgram, '') : [pinProgram?.city, pinProgram?.state].filter(Boolean).join(', ');

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
    const drop = {
      id: 'pd_' + Math.random().toString(36).slice(2, 10),
      design_id: row.design_id,
      from_athlete_id: myAthlete.id,
      to_athlete_id: target.id,
      recipient_name: target.display_name,
      recipient_program: pinProgramName,
      recipient_city: pinProgramLocation,
      event_name: 'Team basket drop',
      message: message || 'You made the weekend more fun.',
      status: 'sent',
      created_at: new Date().toISOString(),
    };
    await window.HZdb.from('pin_drops').insert(drop);
    window.dispatchEvent(new CustomEvent('hz:refresh', { detail: { table: 'pin_drops', action: 'insert' } }));
    await window.HZdb.from('athlete_pins').update({ quantity: Math.max(0, Number(row.quantity || 1) - 1) }).eq('id', row.id);
    window.dispatchEvent(new CustomEvent('hz:refresh', { detail: { table: 'athlete_pins', action: 'update' } }));
    await refreshPins();
  }

  async function createPin(dropNow = false) {
    const name = previewName.slice(0, 42);
    const design = {
      id: 'pin_custom_' + Math.random().toString(36).slice(2, 10),
      program_id: programId,
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
    window.dispatchEvent(new CustomEvent('hz:refresh', { detail: { table: 'pin_designs', action: 'insert' } }));
    await window.HZdb.from('athlete_pins').insert(row);
    window.dispatchEvent(new CustomEvent('hz:refresh', { detail: { table: 'athlete_pins', action: 'insert' } }));
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
          Make a pin, keep it in your basket, then share it with a teammate after a standout moment.
          Rewards still exist, but the main game is athlete-created.
        </div>
        <button className="hz-btn hz-btn-primary" onClick={() => setCreatorOpen(v => !v)} style={{ marginTop: 20 }}>
          {creatorOpen ? 'Close creator' : 'Create a pin'} <HZIcon name={creatorOpen ? 'x' : 'plus'} size={13}/>
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <StatTile label="Basket" value={basket.reduce((sum, row) => sum + Number(row.quantity || 0), 0)} sub="ready to pin later" accent="var(--hz-pink)" size="md"/>
        <StatTile label="Sent" value={stats.sent} sub="pins you dropped" accent="var(--hz-teal)" size="md"/>
        <StatTile label="Received" value={stats.received} sub="teammates who pinned you" accent="var(--hz-amber)" size="md"/>
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
  // The parent-home nudge can deep-link a specific kid via HZskillTreeFocus.
  const [selectedAthleteId, setSelectedAthleteId] = React.useState(() => {
    const focus = window.HZskillTreeFocus || null;
    window.HZskillTreeFocus = null;
    return focus;
  });
  const scoped = scopedAthleteForFeature(snap, session, selectedAthleteId);
  const myAthlete = scoped.athlete;
  const athleteId = myAthlete?.id || '';
  const cats = ['standing_tumbling','running_tumbling','jumps','stunts','pyramids','baskets'];
  const CAT_LABEL = { standing_tumbling: 'Standing Tumbling', running_tumbling: 'Running Tumbling', jumps: 'Jumps', stunts: 'Stunts', pyramids: 'Pyramids', baskets: 'Baskets' };
  const STATUS_LABEL = { none: 'Not yet', working: 'Working', got_it: 'Got it', mastered: 'Mastered' };
  const STATUS_HELP = {
    none: 'I have not started this one.',
    working: 'I am learning it.',
    got_it: 'I can do it.',
    mastered: 'I can do it clean and confident.',
  };
  const viewerRole = session?.profile?.role || session?.actualProfile?.role || '';
  const isParentViewer = viewerRole === 'parent';
  const canEdit = viewerRole === 'athlete' || viewerRole === 'coach' || viewerRole === 'owner';
  const firstName = (myAthlete?.display_name || 'Athlete').split(' ')[0];
  const STATUS_PARENT_HELP = {
    none: 'not started yet',
    working: 'learning it now',
    got_it: 'can do it',
    mastered: 'clean and confident',
  };
  const STATUS_TONES = { none: 'rgba(255,255,255,0.04)', working: 'rgba(255,180,84,0.16)', got_it: 'rgba(39,207,215,0.18)', mastered: 'linear-gradient(135deg, rgba(39,207,215,0.3), rgba(249,127,172,0.3))' };
  const statusMap = {};
  (snap.athlete_skills || []).filter(r => r.athlete_id === athleteId).forEach(r => { statusMap[r.skill_id] = r.status; });
  const skillRowMap = {};
  (snap.athlete_skills || []).filter(r => r.athlete_id === athleteId).forEach(r => { skillRowMap[r.skill_id] = r; });
  const [localStatus, setLocalStatus] = React.useState({});
  const [saving, setSaving] = React.useState(null);
  const [error, setError] = React.useState('');
  const [selectedSkillId, setSelectedSkillId] = React.useState('');

  const statusFor = (skillId) => localStatus[skillId] || statusMap[skillId] || 'none';
  const selectedSkill = (snap.skills || []).find(skill => skill.id === selectedSkillId) || null;
  const selectedSkillStatus = selectedSkill ? statusFor(selectedSkill.id) : 'none';
  const selectedSkillNote = selectedSkill ? String(skillRowMap[selectedSkill.id]?.note || '').trim() : '';
  const updateSkill = async (skill, status) => {
    const previous = statusFor(skill.id);
    if (!canEdit || previous === status || saving) return;
    const row = {
      athlete_id: myAthlete.id,
      skill_id: skill.id,
      status,
      // actualProfile first: in kid-login mode the signed-in auth user is the
      // parent, and RLS requires updated_by = auth.uid().
      updated_by: session?.actualProfile?.id || session?.profile?.id || session?.user?.id || null,
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
  React.useEffect(() => {
    if (selectedSkillId || !(snap.skills || []).length) return;
    setSelectedSkillId(snap.skills[0].id);
  }, [selectedSkillId, snap.skills]);
  if (!myAthlete) {
    return <AthleteFeatureGate choices={scoped.choices} feature="Skill tracking" onPick={setSelectedAthleteId}/>;
  }
  const solidCount = Object.values({ ...statusMap, ...localStatus }).filter(s => s === 'mastered' || s === 'got_it').length;

  // Endowed progress — real numbers from real skill rows, never inflated.
  const merged = { ...statusMap, ...localStatus };
  const effective = (id) => merged[id] || 'none';
  const totalSkills = (snap.skills || []).length;
  const workingCount = (snap.skills || []).filter(s => effective(s.id) === 'working').length;
  const solidPct = totalSkills ? Math.round((solidCount / totalSkills) * 100) : 0;
  const ProgressBar = ({ pct, height = 8 }) => (
    <div style={{ height, borderRadius: height / 2, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${Math.min(100, pct)}%`, borderRadius: height / 2, background: 'linear-gradient(90deg, var(--hz-teal), var(--hz-pink))', transition: 'width 400ms ease' }}/>
    </div>
  );
  const progressBlock = (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 7 }}>
        <span style={{ fontSize: 12.5, fontWeight: 700 }}>
          {isParentViewer ? `${firstName} already has` : "You've already got"} <span style={{ color: 'var(--hz-teal)' }}>{solidCount} of {totalSkills}</span> skills solid
        </span>
        <span className="hz-mono" style={{ fontSize: 13, fontWeight: 800, color: 'var(--hz-teal)' }}>{solidPct}%</span>
      </div>
      <ProgressBar pct={solidPct}/>
      {workingCount > 0 && (
        <div style={{ fontSize: 11.5, color: 'var(--hz-dim)', marginTop: 7 }}>
          {workingCount} more already in progress — {isParentViewer ? 'the next ones to land' : 'those are your next wins'}.
        </div>
      )}
    </div>
  );

  return (
    <div>
      <SectionHeading eyebrow={myAthlete.display_name} title={isParentViewer ? `${firstName}'s skill tree.` : 'My skill tree.'} trailing={<Pill tone="teal">{solidCount} solid</Pill>}/>
      {isParentViewer && scoped.choices.length > 1 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          {scoped.choices.map(kid => (
            <button
              key={kid.id}
              type="button"
              className={'hz-btn hz-btn-sm' + (kid.id === myAthlete.id ? ' hz-btn-primary' : '')}
              onClick={() => setSelectedAthleteId(kid.id)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
            >
              <Avatar name={kid.display_name} initials={kid.initials} color={kid.photo_color} src={kid.photo_url} size={20}/>
              {kid.display_name.split(' ')[0]}
            </button>
          ))}
        </div>
      )}
      {isParentViewer ? (
        <div className="hz-card" style={{ marginBottom: 20, borderColor: 'rgba(39,207,215,0.35)' }}>
          <div className="hz-eyebrow" style={{ color: 'var(--hz-teal)', marginBottom: 8 }}>Family tracker</div>
          <div className="hz-display" style={{ fontSize: 32, marginBottom: 8 }}>See what {firstName} can do today.</div>
          <div style={{ color: 'var(--hz-dim)', fontSize: 13, lineHeight: 1.55, maxWidth: 760 }}>
            Coaches manage this skill tree. Tap any skill below to review the current status and coach note so you know what to practice with {firstName} at home.
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
            {['none','working','got_it','mastered'].map(s => (
              <span key={s} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '5px 11px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                background: STATUS_TONES[s], color: s === 'none' ? 'var(--hz-dim)' : '#fff',
                border: '1px solid var(--hz-line)',
              }}>
                {STATUS_LABEL[s]} <span style={{ fontWeight: 500, opacity: 0.75 }}>· {STATUS_PARENT_HELP[s]}</span>
              </span>
            ))}
          </div>
          {progressBlock}
          {error && <div style={{ color: 'var(--hz-pink)', fontSize: 13, marginTop: 12 }}>{error}</div>}
        </div>
      ) : (
        <div className="hz-card" style={{ marginBottom: 20, borderColor: 'rgba(39,207,215,0.35)' }}>
          <div className="hz-eyebrow" style={{ color: 'var(--hz-teal)', marginBottom: 8 }}>Self tracker</div>
          <div className="hz-display" style={{ fontSize: 32, marginBottom: 8 }}>Tap what is true today.</div>
          <div style={{ color: 'var(--hz-dim)', fontSize: 13, lineHeight: 1.55, maxWidth: 760 }}>
            This updates your profile so coaches and parents can see where you are. Pick honestly: Working is still a win.
          </div>
          {progressBlock}
          {error && <div style={{ color: 'var(--hz-pink)', fontSize: 13, marginTop: 12 }}>{error}</div>}
        </div>
      )}
      {selectedSkill && (
        <div className="hz-card" style={{ marginBottom: 20, borderColor: 'rgba(39,207,215,0.28)' }}>
          <div className="hz-eyebrow" style={{ marginBottom: 8 }}>{isParentViewer ? 'Selected skill' : 'Skill detail'}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div>
              <div className="hz-display" style={{ fontSize: 26, marginBottom: 6 }}>{selectedSkill.name}</div>
              <div style={{ color: 'var(--hz-dim)', fontSize: 12 }}>
                Level {selectedSkill.level} · {CAT_LABEL[selectedSkill.category] || selectedSkill.category}
              </div>
            </div>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 800,
              background: STATUS_TONES[selectedSkillStatus],
              color: selectedSkillStatus === 'none' ? 'var(--hz-dim)' : '#fff',
              border: '1px solid var(--hz-line)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}>
              {STATUS_LABEL[selectedSkillStatus]}
            </span>
          </div>
          <div style={{ color: 'var(--hz-dim)', fontSize: 12.5, lineHeight: 1.55, marginTop: 12 }}>
            {isParentViewer ? `${firstName} is currently marked as ${STATUS_PARENT_HELP[selectedSkillStatus]}.` : STATUS_HELP[selectedSkillStatus]}
          </div>
          <div style={{ marginTop: 14 }}>
            <div className="hz-eyebrow" style={{ marginBottom: 8 }}>Coach note</div>
            <div style={{
              padding: 14,
              borderRadius: 12,
              border: '1px solid var(--hz-line)',
              background: 'rgba(255,255,255,0.03)',
              color: selectedSkillNote ? 'var(--hz-text, #fff)' : 'var(--hz-dim)',
              fontSize: 13,
              lineHeight: 1.55,
            }}>
              {selectedSkillNote || `No coach note is saved for ${selectedSkill.name} yet.`}
            </div>
          </div>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {cats.map(cat => {
          const cSkills = snap.skills.filter(s => s.category === cat).sort((a,b) => a.level - b.level);
          return (
            <div key={cat} className="hz-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                <div className="hz-display" style={{ fontSize: 24, whiteSpace: 'nowrap' }}>{CAT_LABEL[cat]}</div>
                {(() => {
                  const solid = cSkills.filter(s => ['got_it','mastered'].includes(statusFor(s.id))).length;
                  const pct = cSkills.length ? (solid / cSkills.length) * 100 : 0;
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, maxWidth: 260 }}>
                      <div style={{ flex: 1 }}><ProgressBar pct={pct} height={6}/></div>
                      <span className="hz-mono" style={{ fontSize: 11, color: pct === 100 ? 'var(--hz-green)' : 'var(--hz-dim)', whiteSpace: 'nowrap' }}>{solid} / {cSkills.length}</span>
                    </div>
                  );
                })()}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
                {cSkills.map(s => {
                  const st = statusFor(s.id);
                  if (isParentViewer) {
                    const hasNote = Boolean(String(skillRowMap[s.id]?.note || '').trim());
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSelectedSkillId(s.id)}
                        style={{
                          padding: 12,
                          borderRadius: 14,
                          fontSize: 12,
                          background: STATUS_TONES[st],
                          color: st === 'none' ? 'var(--hz-dim)' : '#fff',
                          border: selectedSkillId === s.id ? '1px solid rgba(39,207,215,0.45)' : '1px solid var(--hz-line)',
                          textAlign: 'left',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'start', marginBottom: 10 }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>{s.name}</div>
                            <div style={{ fontFamily: 'var(--hz-mono)', fontSize: 10, opacity: 0.7, marginTop: 3 }}>
                              L{s.level} · {STATUS_PARENT_HELP[st]}
                            </div>
                          </div>
                          <div style={{ display: 'grid', gap: 6, justifyItems: 'end' }}>
                            {hasNote && <span className="hz-eyebrow" style={{ color: 'var(--hz-teal)' }}>Coach note</span>}
                            <span className="hz-eyebrow" style={{ color: 'var(--hz-dim)' }}>Tap to review</span>
                          </div>
                        </div>
                      </button>
                    );
                  }
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
                          <div style={{ fontFamily: 'var(--hz-mono)', fontSize: 10, opacity: 0.6, marginTop: 3 }}>L{s.level} · {isParentViewer ? STATUS_PARENT_HELP[st] : STATUS_HELP[st]}</div>
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

// ─── Skill-tree nudge: shows on the parent home every visit until each kid's
// tree has at least one skill marked (by anyone — parent, athlete, or coach).
// "Later" snoozes for the current browser session only, so it comes back on
// the next login. Disappears for good once the tree has real data.
function SkillTreeNudgeCard({ kids, navigate, profileId }) {
  const snoozeKey = 'hz_skillnudge_' + (profileId || 'me');
  const [snoozed, setSnoozed] = React.useState(() => {
    try { return sessionStorage.getItem(snoozeKey) === '1'; } catch { return false; }
  });
  if (!kids.length || snoozed) return null;
  const firsts = kids.map(k => k.display_name.split(' ')[0]);
  const nameList = firsts.length === 1 ? firsts[0] : firsts.slice(0, -1).join(', ') + ' and ' + firsts[firsts.length - 1];
  const openFor = (kid) => {
    window.HZskillTreeFocus = kid.id;
    navigate('skilltree');
  };
  const snooze = () => {
    try { sessionStorage.setItem(snoozeKey, '1'); } catch {}
    setSnoozed(true);
  };
  return (
    <div className="hz-card" style={{ marginBottom: 24, borderColor: 'rgba(39,207,215,0.4)' }}>
      <div className="hz-eyebrow" style={{ color: 'var(--hz-teal)', marginBottom: 8 }}>Skill tree</div>
      <div style={{ fontWeight: 900, fontSize: 18 }}>See what {nameList} can already do.</div>
      <div style={{ color: 'var(--hz-dim)', fontSize: 12.5, marginTop: 5, lineHeight: 1.5 }}>
        Coaches manage the tracker. Open the skill tree to review the current status and coach notes for each athlete in one place.
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
        {kids.map(kid => (
          <button key={kid.id} className="hz-btn hz-btn-primary" onClick={() => openFor(kid)}>
            View {kid.display_name.split(' ')[0]}'s skill tree <HZIcon name="arrow-right" size={13}/>
          </button>
        ))}
        <button className="hz-btn" onClick={snooze}>Later</button>
      </div>
    </div>
  );
}
window.SkillTreeNudgeCard = SkillTreeNudgeCard;

// ─── Parent Dashboard ───
function ParentDashboard({ snap, session, navigate, pushToast }) {
  const [createdKids, setCreatedKids] = React.useState([]);
  const [loginKidId, setLoginKidId] = React.useState(null);
  const scope = window.HZviewerScope ? window.HZviewerScope(snap, session) : null;
  const linkedKids = scope?.linkedAthletes || [];
  const familyKids = [...createdKids, ...linkedKids].filter((kid, idx, arr) => kid && arr.findIndex(x => x.id === kid.id) === idx);
  const myKids = familyKids;
  const parentClassEnrollments = window.HZsel.classEnrollmentsForParent(session);
  const linkedKidIds = new Set(myKids.filter(Boolean).map(kid => kid.id));
  const unlinkedPaidRegistrations = parentClassEnrollments.filter(row => !row.athlete_id || !linkedKidIds.has(row.athlete_id));
  const familyName = (session.profile.display_name || 'Your').split(' ').slice(-1)[0];
  const leadKid = myKids.filter(Boolean)[0] || null;
  const programId = session.actualProfile?.program_id || session.profile.program_id || null;
  const program = (snap.programs || []).find(p => p.id === programId) || (snap.programs || [])[0] || null;
  const programName = window.HZprogramDisplayName ? window.HZprogramDisplayName(program, 'your gym') : (program?.brand_name || program?.public_name || program?.name || 'your gym');
  const familyPacket = packetStatusForParent(snap, session, program?.id || programId);
  const familyFormsComplete = familyPacket?.completion_status === 'complete';
  const moneySummary = parentBillingSummary(snap, session);
  const leadFirst = leadKid ? leadKid.display_name.split(' ')[0] : '';
  const leadHasWins = leadKid ? (snap.celebrations || []).some(c => c.athlete_id === leadKid.id) : false;
  const visibleAnnouncements = (snap.announcements || [])
    .filter(a => !a.deleted_at && (!a.audience || ['all', 'parents'].includes(a.audience)))
    .sort((a, b) => (Number(!!b.pinned) - Number(!!a.pinned)) || (new Date(b.created_at || 0) - new Date(a.created_at || 0)))
    .slice(0, 3);
  const upcomingSessions = (window.HZsel.upcomingSessions ? window.HZsel.upcomingSessions(30) : []) || [];
  const [linkingRegistrationId, setLinkingRegistrationId] = React.useState('');

  async function linkPaidRegistration(row) {
    const name = String(row.athlete_name || '').trim();
    if (!name) return;
    setLinkingRegistrationId(row.id);
    try {
      const age = ageFromDobOrNumber(row.metadata?.athlete_dob || row.athlete_dob, row.metadata?.athlete_age);
      const { data, error: err } = await window.HZdb.auth.createChildAthlete({
        display_name: name,
        age,
        relation: 'parent',
        team_id: row.class?.team_id || snap.teams?.[0]?.id || '',
        position: 'all-around',
        photo_color: '#F97FAC',
        registration_id: row.registration_id || row.id,
      });
      if (err) throw err;
      if (data?.athlete) setCreatedKids(prev => [data.athlete, ...prev.filter(kid => kid.id !== data.athlete.id)]);
      pushToast && pushToast({ eyebrow: 'Registration linked', title: `${name} is on your family roster`, body: 'Schedule and billing will refresh from the paid registration.' });
      if (window.HZmirror?.roster) await window.HZmirror.roster();
      if (window.HZsel?._refresh) await window.HZsel._refresh();
      window.dispatchEvent(new CustomEvent('hz:refresh', { detail: { table: 'parent_links', action: 'registration_link' } }));
    } catch (err) {
      pushToast && pushToast({ kind: 'error', eyebrow: 'Link failed', title: 'Could not link registration', body: err?.message || String(err) });
    } finally {
      setLinkingRegistrationId('');
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <div className="hz-eyebrow" style={{ marginBottom: 10 }}>{familyName} family · {programName}</div>
        <div className="hz-display" style={{ fontSize: 44, lineHeight: 0.95 }}>
          {!leadKid ? <>Add your <span className="hz-zero">athlete</span>.</>
            : leadHasWins ? <>{leadFirst}'s latest <span className="hz-zero">wins</span>.</>
            : <>{leadFirst} at <span className="hz-zero">a glance</span>.</>}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
          <button
            className="hz-btn hz-btn-sm"
            aria-label="View all Gym Feed updates"
            onClick={() => navigate('announcements')}
          >
            View Gym Feed
          </button>
        </div>
      </div>

      {!leadKid && (
        <AddChildCard
          snap={snap}
          session={session}
          pushToast={pushToast}
          onCreated={(athlete) => athlete && setCreatedKids(prev => [athlete, ...prev.filter(k => k.id !== athlete.id)])}
        />
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginBottom: 24 }}>
        <MiniBox label="Schedule" value={parentClassEnrollments.length || upcomingSessions.length || 0} sub={parentClassEnrollments.length ? 'registered classes' : 'team sessions'} accent="var(--hz-teal)"/>
        <MiniBox label="Paid" value={dollarsToParentMoney(moneySummary.paid)} sub={moneySummary.enrollments.length ? 'registrations included' : ''} accent="var(--hz-green)"/>
        <MiniBox label="Balance" value={moneySummary.owed > 0 ? dollarsToParentMoney(moneySummary.owed) : '$0'} sub={moneySummary.pendingCount ? `${moneySummary.pendingCount} pending item${moneySummary.pendingCount === 1 ? '' : 's'}` : 'current'} accent={moneySummary.owed > 0 ? 'var(--hz-amber)' : 'var(--hz-teal)'}/>
        <MiniBox label="Forms" value={familyFormsComplete ? 'Done' : 'Needed'} sub={familyPacket ? 'packet saved' : 'waiver and medical'} accent={familyFormsComplete ? 'var(--hz-green)' : 'var(--hz-amber)'}/>
      </div>

      {!familyFormsComplete && (
        <div className="hz-card" style={{ marginBottom: 24, borderColor: 'rgba(255,180,84,0.32)', display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <div className="hz-eyebrow" style={{ color: 'var(--hz-amber)', marginBottom: 8 }}>Required forms</div>
            <div style={{ fontWeight: 900, fontSize: 18 }}>Finish waiver, emergency, medical, and policy info.</div>
            <div style={{ color: 'var(--hz-dim)', fontSize: 12.5, marginTop: 5 }}>Saved forms become the records staff and coaches use for this family.</div>
          </div>
          <button className="hz-btn hz-btn-primary" onClick={() => navigate('family_forms')}>Open Forms <HZIcon name="arrow-right" size={13}/></button>
        </div>
      )}

      {unlinkedPaidRegistrations.length > 0 && (
        <div className="hz-card" style={{ marginBottom: 24, borderColor: 'rgba(39,207,215,0.32)' }}>
          <div className="hz-eyebrow" style={{ color: 'var(--hz-teal)', marginBottom: 10 }}>Paid registration pending</div>
          <div style={{ display: 'grid', gap: 10 }}>
            {unlinkedPaidRegistrations.map(row => (
              <div key={row.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: 12, border: '1px solid var(--hz-line)', borderRadius: 10 }}>
                <div>
                  <div style={{ fontWeight: 800 }}>{row.athlete_name || 'Athlete'} · {row.class_name}</div>
                  <div style={{ color: 'var(--hz-dim)', fontSize: 12, marginTop: 3 }}>{row.schedule_summary || 'Class schedule pending'}</div>
                  <div style={{ color: 'var(--hz-dim)', fontSize: 12, marginTop: 3 }}>Staff is finishing the roster link.</div>
                </div>
                <div style={{ textAlign: 'right', whiteSpace: 'nowrap', display: 'grid', gap: 8, justifyItems: 'end' }}>
                  <div style={{ color: 'var(--hz-green)', fontWeight: 800 }}>{centsToParentMoney(row.amount_paid_cents)}</div>
                  {row.receipt_url && <a href={row.receipt_url} target="_blank" rel="noreferrer" style={{ color: 'var(--hz-teal)', fontSize: 11 }}>Receipt</a>}
                  <button className="hz-btn hz-btn-primary hz-btn-sm" disabled={linkingRegistrationId === row.id} onClick={() => linkPaidRegistration(row)}>
                    {linkingRegistrationId === row.id ? 'Linking...' : 'Link to family'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {myKids.filter(Boolean).map(kid => {
        const readiness = window.HZsel.athleteReadiness(kid.id);
        const attendance = window.HZsel.athleteAttendance(kid.id);
        const summary = window.HZsel.athleteSkillsSummary(kid.id);
        const billing = window.HZsel.athleteBilling(kid.id);
        const classEnrollments = window.HZsel.classEnrollmentsForAthlete(kid.id);
        const paidClassEnrollments = classEnrollments.filter(row => row.payment_status === 'paid');
        const kidCels = (snap.celebrations || []).filter(c => c.athlete_id === kid.id).slice(0, 4);
        const readinessLabel = summary.notAssessed ? 'Not assessed yet' : `${Math.round(readiness*100)}%`;
        const attendanceLabel = attendance.empty ? 'No attendance yet' : `${Math.round((attendance.pct || 0)*100)}%`;
        const masteredLabel = summary.notAssessed ? 'Not assessed yet' : summary.mastered;
        const nextSession = upcomingSessions.find(s => s.team_id === kid.team_id) || null;
        const nextPracticeLabel = nextSession
          ? 'Next: ' + new Date(nextSession.scheduled_at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
          : paidClassEnrollments.length ? 'Class schedule' : 'Schedule';
        const seasonTotal = Number(billing?.account?.season_total || 0);
        const billingChipLabel = billing
          ? (seasonTotal === 0
              ? (paidClassEnrollments.length ? 'Class paid' : 'Billing pending')
              : billing.account.owed > 0 ? `$${billing.account.owed} due` : 'Paid in full')
          : (paidClassEnrollments.length ? 'Class paid' : 'Billing');
        const latestWin = kidCels[0] || null;
        const assignedTeam = (snap.teams || []).find(t => t.id === kid.team_id && t.builder_enabled && !t.deleted_at) || null;
        const assignedTeamLabel = assignedTeam
          ? (assignedTeam.division ? `${assignedTeam.division} — ${assignedTeam.name}` : assignedTeam.name)
          : '';

        return (
          <div key={kid.id} style={{ marginBottom: 32 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              <div className="hz-card">
                <div
                  style={{ display: 'flex', gap: 18, marginBottom: 20, cursor: 'pointer', alignItems: 'flex-start' }}
                  onClick={() => navigate('athlete/' + kid.id)}
                  role="button"
                  aria-label={'Open ' + kid.display_name + "'s profile"}
                >
                  <Avatar name={kid.display_name} initials={kid.initials} color={kid.photo_color} src={kid.photo_url} size={64}/>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="hz-display" style={{ fontSize: 30 }}>{kid.display_name}</div>
                    <div style={{ fontSize: 12, color: 'var(--hz-dim)', textTransform: 'capitalize', marginTop: 2 }}>
                      {kid.position || kid.role || 'athlete'}{kid.age ? ' · Age ' + kid.age : ''} · Tap for full profile
                    </div>
                    {assignedTeamLabel && <div className="family-team-chip" style={{ '--athlete-team-color': assignedTeam.color || 'var(--hz-teal)' }}><span>◆</span><strong>{assignedTeamLabel}</strong>{assignedTeam.season && <small>{assignedTeam.season}</small>}</div>}
                    <button
                      className="hz-btn"
                      style={{ marginTop: 12, padding: '9px 12px', fontSize: 12 }}
                      onClick={(e) => { e.stopPropagation(); setLoginKidId(v => v === kid.id ? null : kid.id); }}
                    >
                      {kid.profile_id ? 'Reset shared-device login' : 'Set up shared-device login'}
                    </button>
                  </div>
                  <HZIcon name="chev-right" size={16} color="var(--hz-dim)"/>
                </div>
                {loginKidId === kid.id && <AthleteLoginSetup athlete={kid}/>}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                  <MiniBox label="Ready" value={readinessLabel} sub={summary.notAssessed ? 'Coach has not scored skills.' : ''} accent="var(--hz-teal)"/>
                  <MiniBox label="Attend" value={attendanceLabel} sub={attendance.empty ? 'Classes are not logged yet.' : `${attendance.attended}/${attendance.total}`}/>
                  <MiniBox label="Mastered" value={masteredLabel} sub={summary.notAssessed ? `${summary.total} skills loaded.` : ''} accent="var(--hz-pink)"/>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                  <QuickChip icon="calendar" label={nextPracticeLabel} onClick={() => navigate('schedule')}/>
                  <QuickChip icon="billing" label={billingChipLabel} onClick={() => navigate('billing')}/>
                  <QuickChip icon="skills" label={familyFormsComplete ? 'Forms complete' : 'Finish forms'} onClick={() => navigate('family_forms')}/>
                  <QuickChip icon="skills" label="Skill progress" onClick={() => navigate('athlete/' + kid.id + '?tab=skills')}/>
                  <QuickChip icon="megaphone" label={latestWin ? 'Latest win' : 'Gym Feed'} onClick={() => latestWin ? navigate('athlete/' + kid.id) : navigate('announcements')}/>
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

            {(billing || paidClassEnrollments.length > 0) && (
              <div className="hz-card" style={{ marginTop: 16 }}>
                {billing && <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div className="hz-eyebrow">Season balance</div>
                    <div className="hz-display" style={{ fontSize: 40, color: billing.account.owed > 0 ? 'var(--hz-amber)' : 'var(--hz-green)', marginTop: 4 }}>
                      {Number(billing.account.season_total || 0) === 0 ? 'Pending' : billing.account.owed > 0 ? `$${billing.account.owed}` : 'Paid in full'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--hz-dim)', marginTop: 4 }}>
                      {Number(billing.account.season_total || 0) === 0 ? 'Season billing is pending staff setup.' : `$${billing.account.paid} of $${billing.account.season_total} paid`}
                    </div>
                  </div>
                  <button className="hz-btn hz-btn-primary" onClick={() => navigate('billing')}>Manage billing <HZIcon name="arrow-right" size={13}/></button>
                </div>}
                {billing && Number(billing.account.season_total || 0) > 0 && (
                  <div style={{ height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden', marginTop: 14 }}>
                    <div style={{ width: `${(billing.account.paid/billing.account.season_total)*100}%`, height: '100%', background: 'linear-gradient(90deg, var(--hz-teal), var(--hz-pink))' }}/>
                  </div>
                )}
                {paidClassEnrollments.length > 0 && (
                  <div style={{ marginTop: billing ? 16 : 0, display: 'grid', gap: 8 }}>
                    <div className="hz-eyebrow">Paid classes</div>
                    {paidClassEnrollments.map(row => (
                      <div key={row.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: 12, borderRadius: 10, background: 'rgba(39,207,215,0.06)', border: '1px solid rgba(39,207,215,0.22)' }}>
                        <div>
                          <div style={{ fontWeight: 800 }}>{row.class_name}</div>
                          <div style={{ color: 'var(--hz-dim)', fontSize: 12, marginTop: 3 }}>{row.schedule_summary || 'Class schedule pending'}</div>
                          <div style={{ color: 'var(--hz-dim)', fontSize: 12, marginTop: 3 }}>{row.staff_status === 'accepted' ? 'Accepted by staff' : 'Paid registration pending staff review'}</div>
                        </div>
                        <div style={{ color: 'var(--hz-green)', fontWeight: 800, whiteSpace: 'nowrap' }}>{centsToParentMoney(row.amount_paid_cents)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {leadKid && (
        <AddChildCard
          snap={snap}
          session={session}
          pushToast={pushToast}
          collapsed
          onCreated={(athlete) => athlete && setCreatedKids(prev => [athlete, ...prev.filter(k => k.id !== athlete.id)])}
        />
      )}

      {/* Announcements */}
      <div className="hz-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          <div className="hz-eyebrow">From the gym</div>
          <button className="hz-btn hz-btn-ghost hz-btn-sm" aria-label="View all Gym Feed updates" onClick={() => navigate('announcements')}>View Gym Feed</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {visibleAnnouncements.map(a => (
            <div key={a.id} style={{ padding: 14, background: 'rgba(255,255,255,0.03)', borderRadius: 10 }}>
              {a.pinned && <Pill tone="pink" style={{ marginBottom: 6 }}>Pinned</Pill>}
              <div style={{ fontWeight: 600, fontSize: 14 }}>{a.title}</div>
              <div style={{ fontSize: 12.5, color: 'var(--hz-dim)', marginTop: 4, lineHeight: 1.5 }}>{a.body}</div>
            </div>
          ))}
          {visibleAnnouncements.length === 0 && (
            <div style={{ padding: 18, color: 'var(--hz-dim)', fontSize: 13, textAlign: 'center' }}>
              Gym updates will appear here after staff posts them.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
function QuickChip({ icon, label, onClick }) {
  return (
    <button className="hz-btn hz-btn-sm" onClick={onClick} style={{ flex: '1 1 45%', justifyContent: 'flex-start', gap: 8, minWidth: 0 }}>
      <HZIcon name={icon} size={13}/>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
    </button>
  );
}

function MiniBox({ label, value, sub, accent }) {
  const compact = String(value ?? '').length > 8;
  return (
    <div style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
      <div style={{ fontSize: 9, color: 'var(--hz-dim)', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700 }}>{label}</div>
      <div className="hz-display" style={{ fontSize: compact ? 15 : 22, color: accent || '#fff', marginTop: 2, lineHeight: 1.05 }}>{value}</div>
      {sub && <div style={{ fontSize: 10.5, color: 'var(--hz-dim)', marginTop: 5, lineHeight: 1.35 }}>{sub}</div>}
    </div>
  );
}

function AddChildCard({ snap, session, pushToast, onCreated, collapsed }) {
  const teams = snap.teams || [];
  const activeProgramId = session?.actualProfile?.program_id || session?.profile?.program_id || null;
  const defaultTeamId = React.useMemo(() => {
    const scoped = teams.find(team => !activeProgramId || team.program_id === activeProgramId);
    return scoped?.id || '';
  }, [teams, activeProgramId]);
  const [open, setOpen] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);
  const [createdAthlete, setCreatedAthlete] = React.useState(null);
  const [success, setSuccess] = React.useState('');
  const [form, setForm] = React.useState({
    display_name: '',
    age: '',
    position: 'all-around',
    team_id: defaultTeamId,
  });
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (!form.team_id && defaultTeamId) setForm(f => ({ ...f, team_id: defaultTeamId }));
  }, [defaultTeamId, form.team_id]);

  const addChild = async (e) => {
    e.preventDefault();
    const childName = form.display_name.trim();
    if (!childName) {
      setError('Type the athlete name first, then Create / Link will connect their profile.');
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
    setSuccess(`${name} is linked to your parent account. Next, set up a shared-device login.`);
    setForm(f => ({ ...f, display_name: '', age: '' }));
    pushToast && pushToast({
      eyebrow: 'Athlete linked',
      title: `${name} is on your family roster`,
      body: 'Next: create a username and password for shared devices.',
    });
  };

  // Once an athlete is linked, this whole card collapses to a single row so the
  // family's real data stays at the top of the dashboard.
  if (collapsed && !expanded) {
    return (
      <div style={{ marginBottom: 24 }}>
        <button className="hz-btn" onClick={() => { setExpanded(true); setOpen(true); }}>
          <HZIcon name="plus" size={13}/> Add another athlete
        </button>
      </div>
    );
  }

  return (
    <div className="hz-card" style={{ marginBottom: 24, borderColor: open ? 'rgba(39,207,215,0.45)' : 'var(--hz-line)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <div className="hz-eyebrow" style={{ color: 'var(--hz-teal)', marginBottom: 8 }}>Family roster</div>
          <div className="hz-display" style={{ fontSize: 30, marginBottom: 6 }}>Add or link an athlete.</div>
          <div style={{ color: 'var(--hz-dim)', fontSize: 13, lineHeight: 1.55, maxWidth: 680 }}>
            Add athletes under your parent account, then create a simple username and password for shared devices.
          </div>
        </div>
        <button className="hz-btn hz-btn-primary" onClick={() => setOpen(v => !v)}>
          {open ? 'Close' : 'Add athlete'} <HZIcon name={open ? 'x' : 'plus'} size={13}/>
        </button>
      </div>

      {open && (
        <form onSubmit={addChild} style={{ marginTop: 22, display: 'grid', gridTemplateColumns: '2fr 100px 150px 180px auto', gap: 10, alignItems: 'end' }}>
          <label>
            <div className="hz-eyebrow" style={{ marginBottom: 8 }}>Athlete name</div>
            <input
              className="hz-input"
              value={form.display_name}
              onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))}
              placeholder="Athlete name"
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
            If the athlete already exists on the roster, this links them to you instead of creating a duplicate.
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
        <div className="hz-eyebrow" style={{ color: 'var(--hz-pink)', marginBottom: 8 }}>Shared-device login</div>
        <div className="hz-display" style={{ fontSize: 28 }}>Give {athlete.display_name.split(' ')[0]} their own login.</div>
        <div style={{ color: 'var(--hz-dim)', fontSize: 12, marginTop: 6 }}>
          They can sign in on shared gym or home devices with this username and password. No email inbox needed.
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
          Shared-device login ready: username <b style={{ color: '#fff' }}>{done.login_identifier}</b>. Open Hit Zero, choose “Username + password,” and sign in.
        </div>
      )}
    </form>
  );
}
window.ParentDashboard = ParentDashboard;

const MCA_FAMILY_RESOURCES = [
  {
    title: 'Handbook packet',
    detail: 'Current all-star welcome packet',
    href: '/mca-all-star-welcome-packet.pdf',
    ctaLabel: 'Download PDF',
  },
  {
    title: 'Team contract',
    detail: 'This slot stays ready for the signed season contract.',
    href: null,
    ctaLabel: 'Coming soon',
  },
  {
    title: 'Competition schedule',
    detail: 'This will appear here as soon as the comp calendar is finalized.',
    href: null,
    ctaLabel: 'Coming soon',
  },
];

function isMcaProgram(program) {
  const slug = String(program?.slug || '').toLowerCase();
  return slug === 'mca';
}

function FamilyForms({ snap, session, navigate }) {
  const profile = session?.actualProfile || session?.profile || {};
  const rawProgramId = profile.program_id || session?.profile?.program_id || null;
  const profileProgramId = window.HZisPlaceholderProgramId?.(rawProgramId) ? null : rawProgramId;
  const program = window.HZactiveProgramFromSnap
    ? window.HZactiveProgramFromSnap(snap, session)
    : ((profileProgramId ? (snap.programs || []).find(p => p.id === profileProgramId) : null) || (snap.programs || [])[0] || null);
  const programId = program?.id || profileProgramId || null;
  const programName = window.HZprogramDisplayName ? window.HZprogramDisplayName(program, 'your gym') : (program?.brand_name || program?.public_name || program?.name || 'your gym');
  const scope = window.HZviewerScope ? window.HZviewerScope(snap, session) : null;
  const kids = scope?.linkedAthletes || [];
  const packet = packetStatusForParent(snap, session, program?.id || programId);
  const age = ageFromDobOrNumber(packet?.athlete_dob, packet?.athlete_age) || kids.find(kid => kid.age)?.age || null;
  const eligibleClasses = (snap.program_classes || [])
    .filter(klass => (!program?.id || klass.program_id === program.id) && klass.registration_open && klass.is_public !== false && classFitsAge(klass, age))
    .slice()
    .sort((a, b) => (a.display_order ?? 100) - (b.display_order ?? 100) || (a.name || '').localeCompare(b.name || ''))
    .slice(0, 8);
  const enrollments = window.HZsel?.classEnrollmentsForParent ? window.HZsel.classEnrollmentsForParent(session) : [];
  const programResources = isMcaProgram(program) ? MCA_FAMILY_RESOURCES : [];

  function isDropInClass(klass) {
    const text = [klass?.name, klass?.price_unit, klass?.price_unit_label, klass?.schedule_summary, klass?.description]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return /\bdrop[\s-]?in\b/.test(text) || text.includes('per class');
  }

  return (
    <div>
      <SectionHeading eyebrow={`Family forms · ${programName}`} title="Forms."/>
      <div className="family-forms-layout" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.25fr) minmax(280px, 0.75fr)', gap: 20, alignItems: 'start' }}>
        <div className="family-forms-main" style={{ display: 'grid', gap: 18 }}>
          {window.FamilyInfoPacketCard ? (
            <window.FamilyInfoPacketCard session={session} program={program}/>
          ) : (
            <EmptyState icon="skills" title="Forms are loading." body="Refresh if this area does not appear."/>
          )}
          <div className="hz-card">
            <div className="hz-eyebrow" style={{ marginBottom: 12 }}>Saved records</div>
            <div style={{ display: 'grid', gap: 10 }}>
              {kids.map(kid => {
                const medical = window.HZsel.athleteMedical(kid.id);
                const contacts = medical.contacts || [];
                return (
                  <div key={kid.id} style={{ padding: 14, borderRadius: 10, border: '1px solid var(--hz-line)', background: 'rgba(255,255,255,0.03)' }}>
                    <div style={{ fontWeight: 900 }}>{kid.display_name}</div>
                    <div className="family-forms-record-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginTop: 10 }}>
                      <MiniBox label="Medical" value={medical.record ? 'Saved' : 'Needed'} sub={medical.record?.insurance_carrier || ''} accent={medical.record ? 'var(--hz-green)' : 'var(--hz-amber)'}/>
                      <MiniBox label="Contacts" value={contacts.length || 0} sub={contacts[0]?.name || 'emergency'} accent={contacts.length ? 'var(--hz-teal)' : 'var(--hz-amber)'}/>
                      <MiniBox label="Waiver" value={(snap.waiver_signatures || []).some(row => row.athlete_id === kid.id) ? 'Signed' : 'Needed'} sub="liability" accent={(snap.waiver_signatures || []).some(row => row.athlete_id === kid.id) ? 'var(--hz-green)' : 'var(--hz-amber)'}/>
                    </div>
                  </div>
                );
              })}
              {kids.length === 0 && (
                <div style={{ color: 'var(--hz-dim)', fontSize: 13, lineHeight: 1.55 }}>
                  Records attach automatically after this parent account is linked to an athlete.
                </div>
              )}
            </div>
          </div>
        </div>
        <aside className="family-forms-aside" style={{ display: 'grid', gap: 16 }}>
          <div className="hz-card">
            <div className="hz-eyebrow" style={{ marginBottom: 10 }}>Age-eligible classes</div>
            <div style={{ color: 'var(--hz-dim)', fontSize: 12.5, lineHeight: 1.5, marginBottom: 12 }}>
              {age == null ? 'Add athlete age or date of birth in the packet to narrow class options.' : `Showing classes that fit age ${age}.`}
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              {eligibleClasses.map(klass => {
                const dropIn = isDropInClass(klass);
                return (
                  <div key={klass.id} style={{ padding: 12, borderRadius: 10, border: '1px solid var(--hz-line)', background: 'rgba(255,255,255,0.03)' }}>
                    <div style={{ fontWeight: 900 }}>{klass.name}</div>
                    <div style={{ color: 'var(--hz-dim)', fontSize: 12, marginTop: 3 }}>{klass.schedule_summary || 'Schedule pending'}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginTop: 10 }}>
                      <span style={{ color: 'var(--hz-teal)', fontSize: 12, fontWeight: 800 }}>{klass.age_range_min || klass.age_range_max ? `${klass.age_range_min || 0}-${klass.age_range_max || 'up'} yrs` : 'All ages'}</span>
                      <a className="hz-btn hz-btn-primary hz-btn-sm" href={`#/${dropIn ? 'drop-in' : 'book'}/${klass.id}`}>{dropIn ? 'Drop in' : 'Register'}</a>
                    </div>
                  </div>
                );
              })}
              {eligibleClasses.length === 0 && (
                <div style={{ color: 'var(--hz-dim)', fontSize: 13 }}>No open classes match this age yet.</div>
              )}
            </div>
          </div>
          <div className="hz-card">
            <div className="hz-eyebrow" style={{ marginBottom: 10 }}>Registered classes</div>
            <div style={{ display: 'grid', gap: 8 }}>
              {enrollments.map(row => (
                <div key={row.id} style={{ padding: 10, borderRadius: 10, border: '1px solid var(--hz-line)' }}>
                  <div style={{ fontWeight: 800 }}>{row.class_name}</div>
                  <div style={{ color: 'var(--hz-dim)', fontSize: 12, marginTop: 3 }}>{row.schedule_summary || 'Class schedule pending'}</div>
                  <div style={{ color: row.payment_status === 'paid' ? 'var(--hz-green)' : 'var(--hz-amber)', fontSize: 11, marginTop: 4 }}>{row.payment_status}</div>
                </div>
              ))}
              {enrollments.length === 0 && <div style={{ color: 'var(--hz-dim)', fontSize: 13 }}>Paid registrations will appear here.</div>}
            </div>
          </div>
          {programResources.length > 0 && (
            <div className="hz-card">
              <div className="hz-eyebrow" style={{ marginBottom: 10 }}>Program documents</div>
              <div style={{ color: 'var(--hz-dim)', fontSize: 12.5, lineHeight: 1.5, marginBottom: 12 }}>
                Keep the current all-star packet handy here, with the contract and comp schedule ready to drop in when {programName} adds them.
              </div>
              <div style={{ display: 'grid', gap: 10 }}>
                {programResources.map((resource) => (
                  <div key={resource.title} style={{ padding: 12, borderRadius: 10, border: '1px solid var(--hz-line)', background: 'rgba(255,255,255,0.03)' }}>
                    <div style={{ fontWeight: 900 }}>{resource.title}</div>
                    <div style={{ color: 'var(--hz-dim)', fontSize: 12, marginTop: 4 }}>{resource.detail}</div>
                    {resource.href ? (
                      <a
                        className="hz-btn hz-btn-primary hz-btn-sm"
                        href={resource.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ marginTop: 10 }}
                      >
                        {resource.ctaLabel}
                      </a>
                    ) : (
                      <button
                        type="button"
                        className="hz-btn hz-btn-sm"
                        disabled
                        style={{ marginTop: 10, opacity: 0.72 }}
                      >
                        {resource.ctaLabel}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          <button className="hz-btn" onClick={() => navigate('parent')}>Back to family home</button>
        </aside>
      </div>
    </div>
  );
}
window.FamilyForms = FamilyForms;

// ─── Sessions (schedule) ───
function cleanOtherSessionType(value) {
  return String(value || 'Session')
    .replace(new RegExp('^competition\\s*:\\s*' + 'dre' + 'am on$', 'i'), 'Competition')
    .replace(new RegExp('\\bdre' + 'am on\\b', 'ig'), 'Competition')
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
  const program = window.HZsel.programProfile?.() || (snap.programs || [])[0] || {};
  const [draft, setDraft] = React.useState({ title: '', body: '', pinned: false, audience: 'all' });
  const [editingId, setEditingId] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [error, setError] = React.useState('');
  const canPost = ['coach','owner'].includes(session?.actualProfile?.role || session?.profile?.role || '');

  const post = async () => {
    if (!draft.title.trim()) return;
    if (!program.id) { setError('No program loaded.'); return; }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const { error } = await insertLiveThenLocal('announcements', {
        program_id: program.id,
        audience: draft.audience,
        title: draft.title.trim(),
        body: draft.body.trim() || null,
        pinned: draft.pinned,
        created_by: session?.actualProfile?.id || session?.profile?.id || null,
      });
      if (error) throw error;
      await refreshAppData('announcements', 'insert');
      setDraft({ title: '', body: '', pinned: false, audience: 'all' });
      setMessage('Announcement posted.');
    } catch (err) {
      console.error('[announcements] insert', err);
      setError('Could not post: ' + (err?.message || String(err)));
    } finally { setBusy(false); }
  };

  async function patch(id, p) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const { error } = await updateLiveThenLocal('announcements', id, p);
      if (error) throw error;
      await refreshAppData('announcements', 'update');
      setMessage('Announcement saved.');
      return true;
    } catch (err) {
      console.error('[announcements] update', err);
      setError('Could not save: ' + (err?.message || String(err)));
      return false;
    } finally { setBusy(false); }
  }

  async function softDelete(a) {
    if (!confirm(`Delete "${a.title}"?`)) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const { error } = await updateLiveThenLocal('announcements', a.id, { deleted_at: new Date().toISOString() });
      if (error) throw error;
      await refreshAppData('announcements', 'update');
      setMessage('Announcement deleted.');
    } catch (err) {
      console.error('[announcements] soft-delete', err);
      setError('Could not delete: ' + (err?.message || String(err)));
    } finally { setBusy(false); }
  }

  const items = (snap.announcements || [])
    .filter(a => !a.deleted_at)
    .slice()
    .sort((a,b) => (b.pinned - a.pinned) || (new Date(b.created_at) - new Date(a.created_at)));

  return (
    <div>
      <SectionHeading eyebrow="Gym feed" title="Announcements."/>
      {error && <div className="hz-card" style={{ marginBottom: 14, padding: 12, color: 'var(--hz-pink)', borderColor: 'rgba(249,127,172,0.35)' }}>{error}</div>}
      {message && <div className="hz-card" style={{ marginBottom: 14, padding: 12, color: 'var(--hz-teal)', borderColor: 'rgba(39,207,215,0.35)' }}>{message}</div>}
      {canPost && (
        <div className="hz-card" style={{ marginBottom: 24 }}>
          <div className="hz-eyebrow" style={{ marginBottom: 10 }}>Post something</div>
          <input className="hz-input" placeholder="Title" value={draft.title} onChange={e => setDraft({...draft, title: e.target.value})} style={{ marginBottom: 10 }} disabled={busy}/>
          <textarea className="hz-input" rows="3" placeholder="Details — everyone sees this." value={draft.body} onChange={e => setDraft({...draft, body: e.target.value})} disabled={busy}/>
          <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
                <input type="checkbox" checked={draft.pinned} onChange={e => setDraft({...draft, pinned: e.target.checked})} disabled={busy}/>
                Pin to top
              </label>
              <select className="hz-input" value={draft.audience} onChange={e => setDraft({...draft, audience: e.target.value})} disabled={busy} style={{ width: 160, padding: '6px 10px' }}>
                <option value="all">Everyone</option>
                <option value="parents">Parents only</option>
                <option value="athletes">Athletes only</option>
                <option value="coaches">Coaches only</option>
              </select>
            </div>
            <button className="hz-btn hz-btn-primary" onClick={post} disabled={busy || !draft.title.trim()}>Post</button>
          </div>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {items.length === 0 && (
          <div className="hz-card" style={{ padding: 32, textAlign: 'center', color: 'var(--hz-dim)' }}>Nothing posted yet.</div>
        )}
        {items.map(a => editingId === a.id ? (
          <AnnouncementEditor key={a.id} announcement={a} disabled={busy}
            onSave={async (p) => { const ok = await patch(a.id, p); if (ok) setEditingId(null); }}
            onCancel={() => setEditingId(null)}
            onDelete={() => softDelete(a).then(() => setEditingId(null))}/>
        ) : (
          <div key={a.id} className="hz-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                {a.pinned && <Pill tone="pink">Pinned</Pill>}
                <div className="hz-eyebrow">{new Date(a.created_at).toLocaleDateString('default', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Pill>{a.audience}</Pill>
                {canPost && (
                  <button className="hz-btn hz-btn-ghost hz-btn-sm" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => setEditingId(a.id)}>Edit</button>
                )}
              </div>
            </div>
            <div className="hz-display" style={{ fontSize: 28, marginBottom: 8 }}>{a.title}</div>
            <div style={{ color: 'var(--hz-dim)', fontSize: 14, lineHeight: 1.55 }}>{a.body}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AnnouncementEditor({ announcement, disabled, onSave, onCancel, onDelete }) {
  const [title, setTitle] = React.useState(announcement.title || '');
  const [body, setBody] = React.useState(announcement.body || '');
  const [pinned, setPinned] = React.useState(!!announcement.pinned);
  const [audience, setAudience] = React.useState(announcement.audience || 'all');
  return (
    <div className="hz-card">
      <div className="hz-eyebrow" style={{ marginBottom: 10 }}>Editing announcement</div>
      <input className="hz-input" value={title} onChange={e => setTitle(e.target.value)} disabled={disabled} style={{ marginBottom: 10 }}/>
      <textarea className="hz-input" rows="3" value={body} onChange={e => setBody(e.target.value)} disabled={disabled}/>
      <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
            <input type="checkbox" checked={pinned} onChange={e => setPinned(e.target.checked)} disabled={disabled}/>
            Pin to top
          </label>
          <select className="hz-input" value={audience} onChange={e => setAudience(e.target.value)} disabled={disabled} style={{ width: 160, padding: '6px 10px' }}>
            <option value="all">Everyone</option>
            <option value="parents">Parents only</option>
            <option value="athletes">Athletes only</option>
            <option value="coaches">Coaches only</option>
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="hz-btn hz-btn-danger hz-btn-sm" onClick={onDelete} disabled={disabled}>Delete</button>
          <button className="hz-btn hz-btn-ghost hz-btn-sm" onClick={onCancel} disabled={disabled}>Cancel</button>
          <button className="hz-btn hz-btn-primary hz-btn-sm" onClick={() => onSave({ title: title.trim(), body: body.trim() || null, pinned, audience })} disabled={disabled || !title.trim()}>Save</button>
        </div>
      </div>
    </div>
  );
}
window.Announcements = Announcements;

function BirthdayCalendar({ snap }) {
  const dobByName = new Map();
  (snap.family_info_packets || []).forEach(packet => {
    if (packet.athlete_name && packet.athlete_dob) dobByName.set(String(packet.athlete_name).toLowerCase(), packet.athlete_dob);
  });
  (snap.registrations || []).forEach(reg => {
    if (reg.athlete_name && reg.athlete_dob && !dobByName.has(String(reg.athlete_name).toLowerCase())) {
      dobByName.set(String(reg.athlete_name).toLowerCase(), reg.athlete_dob);
    }
  });
  const today = new Date();
  const rows = (snap.athletes || [])
    .filter(a => !a.deleted_at)
    .map(a => {
      const dob = a.athlete_dob || a.date_of_birth || dobByName.get(String(a.display_name || '').toLowerCase());
      if (!dob) return null;
      const parsed = new Date(dob + 'T00:00:00');
      if (Number.isNaN(parsed.getTime())) return null;
      const next = new Date(today.getFullYear(), parsed.getMonth(), parsed.getDate());
      if (next < new Date(today.getFullYear(), today.getMonth(), today.getDate())) next.setFullYear(today.getFullYear() + 1);
      const turning = next.getFullYear() - parsed.getFullYear();
      const days = Math.ceil((next - new Date(today.getFullYear(), today.getMonth(), today.getDate())) / 86400000);
      return { athlete: a, dob: parsed, next, turning, days };
    })
    .filter(Boolean)
    .sort((a, b) => a.next - b.next);

  return (
    <div>
      <SectionHeading eyebrow="Roster birthdays" title="Birthdays."/>
      <div className="hz-card" style={{ padding: 18, marginBottom: 18 }}>
        <div style={{ color: 'var(--hz-dim)', fontSize: 13, lineHeight: 1.55 }}>
          Birthdays are calculated from linked family packets and registration records. Athletes without a DOB stay hidden here until staff links or collects that field.
        </div>
      </div>
      <div style={{ display: 'grid', gap: 12 }}>
        {rows.map(row => (
          <div key={row.athlete.id} className="hz-card" style={{ padding: 16, display: 'grid', gridTemplateColumns: '72px 1fr auto', gap: 14, alignItems: 'center' }}>
            <div style={{ textAlign: 'center', borderRadius: 14, border: '1px solid var(--hz-line)', padding: 10, background: 'rgba(255,255,255,0.03)' }}>
              <div className="hz-eyebrow" style={{ fontSize: 9 }}>{row.next.toLocaleDateString('default', { month: 'short' })}</div>
              <div style={{ fontSize: 28, fontWeight: 900 }}>{row.next.getDate()}</div>
            </div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 900 }}>{row.athlete.display_name}</div>
              <div style={{ color: 'var(--hz-dim)', fontSize: 12, marginTop: 3 }}>
                Turns {row.turning} · DOB {row.dob.toLocaleDateString()}
              </div>
            </div>
            <div className="hz-eyebrow" style={{ color: row.days <= 30 ? 'var(--hz-pink)' : 'var(--hz-teal)' }}>
              {row.days === 0 ? 'Today' : `${row.days} days`}
            </div>
          </div>
        ))}
        {rows.length === 0 && (
          <div className="hz-card" style={{ padding: 32, textAlign: 'center', color: 'var(--hz-dim)' }}>
            No athlete birthdays are available yet.
          </div>
        )}
      </div>
    </div>
  );
}
window.BirthdayCalendar = BirthdayCalendar;

// ─── Admin / Program Console ───
function AdminConsole({ snap, navigate, session }) {
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
        // Dev-only: HZ_FORCE_PROTOTYPE is hard-gated to localhost + ?prototype=1,
        // so this can never render on the shipped domain regardless of what a
        // stored session claims.
        window.HZ_FORCE_PROTOTYPE === true
          ? <button className="hz-btn hz-btn-danger" onClick={() => { if (confirm('Reset all demo data?')) { window.HZdb._reset(); location.reload(); } }}><HZIcon name="trash" size={13}/> Reset demo data</button>
          : null
      }/>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <StatTile label="Athletes" value={snap.athletes.length} sub="across all teams"/>
        <StatTile label="Ready" value={`${Math.round(readiness*100)}%`} accent="var(--hz-teal)"/>
        <StatTile label="Leads Open" value={leads.active} sub={`${leads.converted} converted`} accent="var(--hz-pink)"/>
        <StatTile label="Admissions" value={regs.pending} sub={`${regs.accepted} accepted`} accent={regs.pending ? 'var(--hz-amber)' : 'var(--hz-green)'}/>
      </div>
      <ProgramIdentityCard program={program} paymentSettings={paymentSettings} programLocation={programLocation} directoryUrl={directoryUrl}/>
      <LaunchAccessManager snap={snap} session={session}/>
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

function LaunchAccessManager({ snap, session }) {
  const [queue, setQueue] = React.useState({ requests: [], invites: [], unlinked_parents: [], athletes: [], family_packets: [], incomplete_packets: [], paid_pending_registrations: [] });
  const [loading, setLoading] = React.useState(true);
  const [busyId, setBusyId] = React.useState('');
  const [err, setErr] = React.useState('');
  const [invite, setInvite] = React.useState({ label: '', role: 'parent', email: '', max_uses: 1, expires_in_days: 14 });
  const [createdInvite, setCreatedInvite] = React.useState(null);
  const [linkDrafts, setLinkDrafts] = React.useState({});
  const [showSetup, setShowSetup] = React.useState(false);
  const canManage = ['coach', 'owner'].includes(session?.actualProfile?.role || session?.profile?.role);

  const load = React.useCallback(async () => {
    if (!canManage) return;
    setLoading(true);
    setErr('');
    const { data, error } = await window.HZdb.auth.staffLaunchQueue();
    if (error) setErr(error.message || 'Could not load launch queue.');
    else setQueue({
      requests: data?.requests || [],
      invites: data?.invites || [],
      unlinked_parents: data?.unlinked_parents || [],
      athletes: data?.athletes || (snap?.athletes || []),
      family_packets: data?.family_packets || [],
      incomplete_packets: data?.incomplete_packets || [],
      paid_pending_registrations: data?.paid_pending_registrations || [],
    });
    setLoading(false);
  }, [canManage, snap?.athletes?.length]);

  React.useEffect(() => { load(); }, [load]);

  async function decide(req, status) {
    setBusyId(req.id + status);
    setErr('');
    const { error } = await window.HZdb.auth.approveJoinRequest(req.id, status);
    if (error) setErr(error.message || 'Could not update request.');
    await load();
    setBusyId('');
  }

  async function linkParent(parent, athleteId, packet) {
    const createFromPacket = athleteId === '__create_from_packet__';
    const createFromRegistration = String(athleteId || '').startsWith('__create_from_registration__:');
    const registrationId = createFromRegistration ? String(athleteId).replace('__create_from_registration__:', '') : '';
    const registration = registrationId
      ? (queue.paid_pending_registrations || []).find(reg => reg.id === registrationId)
      : null;
    const createAthlete = createFromPacket || createFromRegistration;
    if (!athleteId) { setErr('Choose an athlete to link, or use Create from packet/registration when the child is not on the roster yet.'); return; }
    setBusyId(parent.id + 'link');
    setErr('');
    const { error } = await window.HZdb.auth.linkParentAthlete(parent.id, createAthlete ? '__create_from_packet__' : athleteId, 'parent', {
      create_athlete: createAthlete,
      athlete_name: packet?.athlete_name || registration?.athlete_name || '',
      athlete_age: packet?.athlete_age || registration?.athlete_age || '',
    });
    if (error) setErr(error.message || 'Could not link parent to athlete.');
    else await load();
    setBusyId('');
  }

  async function createInvite(e) {
    e.preventDefault();
    setBusyId('invite');
    setErr('');
    setCreatedInvite(null);
    const { data, error } = await window.HZdb.auth.createProgramInvite(invite);
    if (error) setErr(error.message || 'Could not create invite.');
    else {
      setCreatedInvite(data);
      setInvite({ label: '', role: 'parent', email: '', max_uses: 1, expires_in_days: 14 });
      await load();
    }
    setBusyId('');
  }

  if (!canManage) return null;
  const packetByProfile = new Map((queue.family_packets || []).map(packet => [packet.profile_id, packet]));
  const healthItems = [
    { label: 'Pending requests', value: queue.requests.length, tone: queue.requests.length ? 'amber' : 'teal' },
    { label: 'Account-only parents', value: queue.unlinked_parents.length, tone: queue.unlinked_parents.length ? 'amber' : 'teal' },
    { label: 'Incomplete packets', value: queue.incomplete_packets.length, tone: queue.incomplete_packets.length ? 'pink' : 'teal' },
    { label: 'Paid to review', value: queue.paid_pending_registrations.length, tone: queue.paid_pending_registrations.length ? 'amber' : 'teal' },
  ];
  const actionCount = healthItems.reduce((sum, item) => sum + Number(item.value || 0), 0);

  return (
    <div className="hz-card" style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', marginBottom: 18 }}>
        <div>
          <div className="hz-eyebrow" style={{ marginBottom: 6 }}>Family setup</div>
          <div style={{ fontSize: 17, fontWeight: 800 }}>Only open this when you need account access tasks.</div>
          <div style={{ color: 'var(--hz-dim)', fontSize: 12, marginTop: 4 }}>Registrations and payments still run through Registration. This section only handles app account approval, optional invites, and parent-to-athlete linking.</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button className="hz-btn" onClick={load} disabled={loading}>Refresh</button>
          <button className="hz-btn hz-btn-primary" onClick={() => setShowSetup(v => !v)}>
            {showSetup ? 'Hide setup queue' : actionCount ? `Open setup queue (${actionCount})` : 'Open setup queue'}
          </button>
        </div>
      </div>
      {err && <div style={{ color: 'var(--hz-pink)', fontSize: 13, marginBottom: 12 }}>{err}</div>}
      <div className="hz-launch-health-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10, marginBottom: showSetup ? 18 : 0 }}>
        {healthItems.map(item => (
          <div key={item.label} style={{ padding: 12, borderRadius: 10, border: '1px solid var(--hz-line)', background: 'rgba(255,255,255,0.025)' }}>
            <div className="hz-eyebrow" style={{ fontSize: 9 }}>{item.label}</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: item.tone === 'pink' ? 'var(--hz-pink)' : item.tone === 'amber' ? 'var(--hz-amber)' : 'var(--hz-teal)' }}>{item.value}</div>
          </div>
        ))}
      </div>
      {showSetup && (
      <div className="hz-launch-setup-grid" style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: 18 }}>
        <div style={{ border: '1px solid var(--hz-line)', borderRadius: 12, padding: 14, background: 'rgba(255,255,255,0.02)' }}>
          <div className="hz-eyebrow" style={{ fontSize: 10, marginBottom: 10 }}>Pending gym requests</div>
          {loading ? (
            <div style={{ color: 'var(--hz-dim)', fontSize: 13 }}>Loading...</div>
          ) : queue.requests.length === 0 ? (
            <div style={{ color: 'var(--hz-dim)', fontSize: 13 }}>No pending access requests.</div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {queue.requests.map(req => {
                const name = req.parent_name || req.profiles?.display_name || req.email || 'New family';
                const packet = packetByProfile.get(req.profile_id);
                return (
                  <div key={req.id} style={{ padding: 12, borderRadius: 10, border: '1px solid var(--hz-line)', background: 'rgba(255,255,255,0.03)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <div>
                        <div style={{ fontWeight: 800 }}>{name}</div>
                        <div style={{ color: 'var(--hz-dim)', fontSize: 12, marginTop: 3 }}>
                          {(window.ROLE_LABELS || {})[req.requested_role] || req.requested_role} · {req.email || req.profiles?.email || 'no email'}{req.phone ? ` · ${req.phone}` : ''}
                        </div>
                        {(req.athlete_name || req.athlete_age) && (
                          <div style={{ color: 'var(--hz-dim)', fontSize: 12, marginTop: 3 }}>Athlete: {req.athlete_name || 'Not named'}{req.athlete_age ? `, ${req.athlete_age}` : ''}</div>
                        )}
                        {req.message && <div style={{ color: 'var(--hz-dim)', fontSize: 12, lineHeight: 1.4, marginTop: 8 }}>{req.message}</div>}
                      </div>
                      <div style={{ display: 'grid', gap: 6, justifyItems: 'end' }}>
                        <Pill tone="amber">pending</Pill>
                        <Pill tone={packet?.completion_status === 'complete' ? 'teal' : 'pink'}>{packet?.completion_status === 'complete' ? 'packet complete' : 'packet missing'}</Pill>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
                      <button className="hz-btn hz-btn-danger hz-btn-sm" disabled={!!busyId} onClick={() => decide(req, 'rejected')}>{busyId === req.id + 'rejected' ? '...' : 'Reject'}</button>
                      <button className="hz-btn hz-btn-primary hz-btn-sm" disabled={!!busyId} onClick={() => decide(req, 'approved')}>{busyId === req.id + 'approved' ? '...' : 'Approve'}</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {!loading && queue.unlinked_parents.length > 0 && (
            <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--hz-line)' }}>
              <div className="hz-eyebrow" style={{ fontSize: 10, marginBottom: 10 }}>Approved parents needing athlete link</div>
              <div style={{ display: 'grid', gap: 10 }}>
	                {queue.unlinked_parents.map(parent => {
	                  const packet = packetByProfile.get(parent.id);
                    const packetAthleteName = String(packet?.athlete_name || '').trim();
                    const parentEmail = String(parent.email || '').trim().toLowerCase();
                    const rosterNames = new Set((queue.athletes || []).map(a => String(a.display_name || '').trim().toLowerCase()));
                    const registrationOptions = (queue.paid_pending_registrations || [])
                      .filter(reg => String(reg.parent_email || '').trim().toLowerCase() === parentEmail)
                      .filter(reg => String(reg.athlete_name || '').trim())
                      .filter(reg => !rosterNames.has(String(reg.athlete_name || '').trim().toLowerCase()));
	                  const selected = linkDrafts[parent.id] ?? (packetAthleteName ? '__create_from_packet__' : (registrationOptions[0] ? `__create_from_registration__:${registrationOptions[0].id}` : ''));
	                  return (
	                    <div key={parent.id} style={{ padding: 12, borderRadius: 10, border: '1px solid rgba(255,180,84,0.28)', background: 'rgba(255,180,84,0.06)' }}>
	                      <div style={{ fontWeight: 800 }}>{parent.display_name || parent.email || 'Approved parent'}</div>
	                      <div style={{ color: 'var(--hz-dim)', fontSize: 12, marginTop: 3 }}>{parent.email || 'No email on profile'} · {packet?.completion_status === 'complete' ? 'packet complete' : 'packet missing'}</div>
                        {packetAthleteName && (
                          <div style={{ color: 'var(--hz-amber)', fontSize: 12, marginTop: 6 }}>Packet athlete: {packetAthleteName}{packet?.athlete_age ? `, age ${packet.athlete_age}` : ''}</div>
                        )}
	                      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, marginTop: 10 }}>
	                        <select className="hz-input" value={selected} onChange={e => setLinkDrafts(d => ({ ...d, [parent.id]: e.target.value }))}>
	                          <option value="">Choose existing athlete...</option>
                            {packetAthleteName && <option value="__create_from_packet__">Create/link from packet: {packetAthleteName}</option>}
                            {registrationOptions.map(reg => (
                              <option key={reg.id} value={`__create_from_registration__:${reg.id}`}>
                                Create/link from paid registration: {reg.athlete_name}
                              </option>
                            ))}
	                          {(queue.athletes || []).map(a => (
	                            <option key={a.id} value={a.id}>{a.display_name}{a.age ? ` · age ${a.age}` : ''}</option>
	                          ))}
	                        </select>
	                        <button className="hz-btn hz-btn-primary hz-btn-sm" disabled={!selected || busyId === parent.id + 'link'} onClick={() => linkParent(parent, selected, packet)}>
	                          {busyId === parent.id + 'link' ? 'Working...' : String(selected).startsWith('__create_from_') ? 'Create / link' : 'Link'}
	                        </button>
	                      </div>
	                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {!loading && queue.paid_pending_registrations.length > 0 && (
            <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--hz-line)' }}>
              <div className="hz-eyebrow" style={{ fontSize: 10, marginBottom: 10 }}>Paid registrations needing review</div>
              <div style={{ display: 'grid', gap: 8 }}>
                {queue.paid_pending_registrations.slice(0, 5).map(reg => (
                  <div key={reg.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, color: 'var(--hz-dim)', fontSize: 12, padding: 10, border: '1px solid var(--hz-line)', borderRadius: 10 }}>
                    <span>{reg.athlete_name || 'Athlete'} · {reg.parent_name || reg.parent_email || 'family'}</span>
                    <span style={{ color: 'var(--hz-teal)', fontWeight: 800 }}>${Math.round(Number(reg.amount_paid_cents || 0) / 100)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div style={{ border: '1px solid var(--hz-line)', borderRadius: 12, padding: 14, background: 'rgba(255,255,255,0.02)' }}>
          <div className="hz-eyebrow" style={{ fontSize: 10, marginBottom: 10 }}>Create invite</div>
          <form onSubmit={createInvite} style={{ display: 'grid', gap: 9 }}>
            <input className="hz-input" value={invite.label} onChange={e => setInvite({ ...invite, label: e.target.value })} placeholder="Label, e.g. Mini families" />
            <select className="hz-input" value={invite.role} onChange={e => setInvite({ ...invite, role: e.target.value })}>
              <option value="parent">Parent</option>
              <option value="athlete">Athlete</option>
              <option value="coach">Coach</option>
              <option value="owner">Owner</option>
            </select>
            <input className="hz-input" type="email" value={invite.email} onChange={e => setInvite({ ...invite, email: e.target.value })} placeholder="Restrict to email (optional)" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <input className="hz-input" type="number" min="1" max="250" value={invite.max_uses} onChange={e => setInvite({ ...invite, max_uses: e.target.value })} />
              <input className="hz-input" type="number" min="1" max="180" value={invite.expires_in_days} onChange={e => setInvite({ ...invite, expires_in_days: e.target.value })} />
            </div>
            <button className="hz-btn hz-btn-primary" disabled={busyId === 'invite'}>{busyId === 'invite' ? 'Creating...' : 'Create invite link'}</button>
          </form>
          {createdInvite?.url && (
            <div style={{ marginTop: 12, padding: 12, borderRadius: 10, background: 'rgba(39,207,215,0.08)', color: 'var(--hz-teal)', fontSize: 12, lineHeight: 1.45, wordBreak: 'break-all' }}>
              <div style={{ fontWeight: 800, marginBottom: 4 }}>Invite code: {createdInvite.code}</div>
              {createdInvite.url}
              <button className="hz-btn hz-btn-sm" style={{ marginTop: 10 }} onClick={() => navigator.clipboard?.writeText(createdInvite.url)}>Copy link</button>
            </div>
          )}
          {!!queue.invites.length && (
            <div style={{ marginTop: 16, display: 'grid', gap: 8 }}>
              <div className="hz-eyebrow" style={{ fontSize: 10 }}>Recent invites</div>
              {queue.invites.slice(0, 5).map(inv => (
                <div key={inv.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, color: 'var(--hz-dim)', padding: '8px 0', borderTop: '1px solid var(--hz-line)' }}>
                  <span>{inv.label || inv.email || (window.ROLE_LABELS || {})[inv.role] || inv.role}</span>
                  <span>{inv.uses_count || 0}/{inv.max_uses || 1}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
}

// ─── Program identity + payment settings card with inline editor ─────
function ProgramIdentityCard({ program, paymentSettings, programLocation, directoryUrl }) {
  const [editing, setEditing] = React.useState(null); // 'identity' | 'payment' | null
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [error, setError] = React.useState('');
  const programName = program.public_name || program.brand_name || program.name || 'Your gym';

  async function saveProgram(patch) {
    if (!program.id) return;
    setBusy(true);
    setMessage('');
    setError('');
    try {
      const { error } = await window.HZdb.from('programs').update(patch).eq('id', program.id);
      if (error) throw error;
      await refreshAppData('programs', 'update');
      setMessage('Program changes saved.');
      setEditing(null);
    } catch (err) {
      console.error('[programs] update', err);
      setError('Could not save: ' + (err?.message || String(err)));
    } finally { setBusy(false); }
  }
  async function savePayment(patch) {
    if (!program.id) return;
    setBusy(true);
    setMessage('');
    setError('');
    try {
      // upsert in case the row doesn't exist yet
      const payload = { program_id: program.id, ...patch };
      const { error } = await window.HZdb.from('program_payment_settings').upsert(payload, { onConflict: 'program_id' });
      if (error) throw error;
      await refreshAppData('program_payment_settings', 'upsert');
      setMessage('Payment settings saved.');
      setEditing(null);
    } catch (err) {
      console.error('[payment_settings] upsert', err);
      setError('Could not save: ' + (err?.message || String(err)));
    } finally { setBusy(false); }
  }

  return (
    <div className="hz-card" style={{ marginBottom: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1.35fr 1fr 1fr', gap: 18, alignItems: 'stretch' }}>
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div className="hz-eyebrow">Gym identity · top of hierarchy</div>
            <button className="hz-btn hz-btn-ghost hz-btn-sm" onClick={() => setEditing(editing === 'identity' ? null : 'identity')} style={{ padding: '4px 10px', fontSize: 11 }}>
              {editing === 'identity' ? 'Cancel' : 'Edit'}
            </button>
          </div>
          <div className="hz-display" style={{ fontSize: 34, marginBottom: 8 }}>{programName}</div>
          <div style={{ color: 'var(--hz-dim)', fontSize: 13, lineHeight: 1.5 }}>
            {program.description || 'This is the business record that owns teams, roster, billing, leads, registrations, and processor connections.'}
          </div>
        </div>
        <div style={{ display: 'grid', gap: 10 }}>
          <MiniStat label="Directory" value={program.is_public ? 'Public' : 'Hidden'} sub={`${directoryUrl} · ${programLocation}`} accent={program.is_public ? 'var(--hz-teal)' : 'var(--hz-amber)'}/>
          <MiniStat label="Lead intake" value={program.is_accepting_leads ? 'Open' : 'Closed'} sub="website forms attach to program_id" accent={program.is_accepting_leads ? 'var(--hz-green)' : 'var(--hz-dim)'}/>
        </div>
        <div style={{ display: 'grid', gap: 10, position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="hz-btn hz-btn-ghost hz-btn-sm" onClick={() => setEditing(editing === 'payment' ? null : 'payment')} style={{ padding: '4px 10px', fontSize: 11, position: 'absolute', top: -2, right: 0 }}>
              {editing === 'payment' ? 'Cancel' : 'Edit'}
            </button>
          </div>
          <MiniStat label="Payment owner" value={(paymentSettings.default_provider || 'square').toUpperCase()} sub={`program_id ${String(program.id || 'unset').slice(0, 8)}`} accent="var(--hz-pink)"/>
          <MiniStat label="Checkout mode" value={(paymentSettings.checkout_mode || 'manual_invoice').replace(/_/g, ' ')} sub={paymentSettings.public_checkout_enabled ? 'public checkout enabled' : 'owner-gated until ready'} accent={paymentSettings.public_checkout_enabled ? 'var(--hz-green)' : 'var(--hz-amber)'}/>
        </div>
      </div>

      <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: 16, paddingTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div className="hz-eyebrow" style={{ fontSize: 10 }}>Your website · what families see first</div>
          <div style={{ fontSize: 13, color: 'var(--hz-dim)', marginTop: 4 }}>Edit your colors, font, and hero photo — published live to your website.</div>
        </div>
        <button className="hz-btn hz-btn-primary hz-btn-sm" onClick={() => setEditing(editing === 'website' ? null : 'website')}>
          {editing === 'website' ? 'Close' : 'Edit'}
        </button>
      </div>

      {editing === 'identity' && (
        <ProgramIdentityEditor program={program} onSave={saveProgram} disabled={busy}/>
      )}
      {editing === 'payment' && (
        <PaymentSettingsEditor settings={paymentSettings} onSave={savePayment} disabled={busy}/>
      )}
      {editing === 'website' && (
        <EditWebsiteEditor program={program} onSave={saveProgram} disabled={busy} programId={program.id}/>
      )}
      {error && <div style={{ marginTop: 12, color: 'var(--hz-pink)', fontSize: 13 }}>{error}</div>}
      {message && <div style={{ marginTop: 12, color: 'var(--hz-teal)', fontSize: 13 }}>{message}</div>}
    </div>
  );
}

function ProgramIdentityEditor({ program, onSave, disabled }) {
  const [publicName, setPublicName] = React.useState(program.public_name || '');
  const [brandName, setBrandName] = React.useState(program.brand_name || '');
  const [description, setDescription] = React.useState(program.description || '');
  const [websiteUrl, setWebsiteUrl] = React.useState(program.website_url || '');
  const [heroImageUrl, setHeroImageUrl] = React.useState(program.public_hero_image_url || '');
  const [logoUrl, setLogoUrl] = React.useState(program.logo_url || '');
  const [publicEmail, setPublicEmail] = React.useState(program.public_email || '');
  const [publicPhone, setPublicPhone] = React.useState(program.public_phone || '');
  const [addressLine1, setAddressLine1] = React.useState(program.address_line1 || '');
  const [city, setCity] = React.useState(program.city || '');
  const [state, setState] = React.useState(program.state || '');
  const [postalCode, setPostalCode] = React.useState(program.postal_code || '');
  const [isPublic, setIsPublic] = React.useState(!!program.is_public);
  const [acceptingLeads, setAcceptingLeads] = React.useState(!!program.is_accepting_leads);

  const save = () => onSave({
    public_name: publicName.trim() || null,
    brand_name: brandName.trim() || null,
    description: description.trim() || null,
    website_url: websiteUrl.trim() || null,
    public_hero_image_url: heroImageUrl.trim() || null,
    logo_url: logoUrl.trim() || null,
    public_email: publicEmail.trim() || null,
    public_phone: publicPhone.trim() || null,
    address_line1: addressLine1.trim() || null,
    city: city.trim() || null,
    state: state.trim() || null,
    postal_code: postalCode.trim() || null,
    is_public: isPublic,
    is_accepting_leads: acceptingLeads,
  });

  return (
    <div style={{ marginTop: 16, padding: 14, background: 'rgba(255,255,255,0.04)', borderRadius: 10, display: 'grid', gap: 10 }}>
      <div className="hz-eyebrow" style={{ fontSize: 10 }}>Edit gym identity · pushes to the website directory</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <FieldRow label="Public name (shown to families)">
          <input className="hz-input" value={publicName} onChange={e => setPublicName(e.target.value)} disabled={disabled}/>
        </FieldRow>
        <FieldRow label="Brand name (header / wordmark)">
          <input className="hz-input" value={brandName} onChange={e => setBrandName(e.target.value)} disabled={disabled}/>
        </FieldRow>
      </div>
      <FieldRow label="Description (one paragraph for the directory + website)">
        <textarea className="hz-input" value={description} onChange={e => setDescription(e.target.value)} rows={3} disabled={disabled}/>
      </FieldRow>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <FieldRow label="Public hero image URL">
          <input className="hz-input" value={heroImageUrl} onChange={e => setHeroImageUrl(e.target.value)} disabled={disabled} placeholder="https://..."/>
        </FieldRow>
        <FieldRow label="Logo image URL">
          <input className="hz-input" value={logoUrl} onChange={e => setLogoUrl(e.target.value)} disabled={disabled} placeholder="https://..."/>
        </FieldRow>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10 }}>
        <FieldRow label="Public email">
          <input className="hz-input" value={publicEmail} onChange={e => setPublicEmail(e.target.value)} disabled={disabled}/>
        </FieldRow>
        <FieldRow label="Phone">
          <input className="hz-input" value={publicPhone} onChange={e => setPublicPhone(e.target.value)} disabled={disabled}/>
        </FieldRow>
        <FieldRow label="Website URL">
          <input className="hz-input" value={websiteUrl} onChange={e => setWebsiteUrl(e.target.value)} disabled={disabled}/>
        </FieldRow>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 0.7fr 0.8fr', gap: 10 }}>
        <FieldRow label="Address">
          <input className="hz-input" value={addressLine1} onChange={e => setAddressLine1(e.target.value)} disabled={disabled} placeholder="111 45th Ave NE"/>
        </FieldRow>
        <FieldRow label="City">
          <input className="hz-input" value={city} onChange={e => setCity(e.target.value)} disabled={disabled}/>
        </FieldRow>
        <FieldRow label="State">
          <input className="hz-input" value={state} onChange={e => setState(e.target.value)} disabled={disabled} placeholder="ND" maxLength={2}/>
        </FieldRow>
        <FieldRow label="Zip">
          <input className="hz-input" value={postalCode} onChange={e => setPostalCode(e.target.value)} disabled={disabled} maxLength={10}/>
        </FieldRow>
      </div>
      <div style={{ display: 'flex', gap: 18, alignItems: 'center', paddingTop: 4 }}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
          <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} disabled={disabled}/>
          Listed in the public directory
        </label>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
          <input type="checkbox" checked={acceptingLeads} onChange={e => setAcceptingLeads(e.target.checked)} disabled={disabled}/>
          Accepting new lead inquiries
        </label>
        <div style={{ flex: 1 }}/>
        <button className="hz-btn hz-btn-primary" onClick={save} disabled={disabled}>Save changes</button>
      </div>
    </div>
  );
}

// ─── "Edit" — owner website knobs (colors / font / hero photo) ──────────────
// Basic, high-value controls that publish straight to the gym's public site.
// Writes theme (jsonb) + public_hero_image_url onto the program record; the
// site reads them via the program_public_directory view.
const HZ_FONT_OPTIONS = [
  { key: 'fraunces', label: 'Fraunces — elegant serif (current)' },
  { key: 'playfair', label: 'Playfair Display — classic serif' },
  { key: 'poppins',  label: 'Poppins — friendly & rounded' },
  { key: 'grotesk',  label: 'Space Grotesk — clean & modern' },
];
const HZ_BRAND_DEFAULT = { primary: '#27CFD7', accent: '#F97FAC', font: 'fraunces' };

function ColorKnob({ label, value, onChange, disabled }) {
  const safe = /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#000000';
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <div style={{ fontSize: 11, color: 'var(--hz-dim)' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input type="color" value={safe} onChange={e => onChange(e.target.value)} disabled={disabled}
          style={{ width: 42, height: 36, border: '1px solid rgba(255,255,255,0.18)', borderRadius: 8, background: 'none', cursor: disabled ? 'default' : 'pointer', padding: 2 }}/>
        <input className="hz-input" value={value} onChange={e => onChange(e.target.value)} disabled={disabled}
          style={{ width: 100, fontFamily: 'monospace', textTransform: 'uppercase' }} maxLength={7}/>
      </div>
    </div>
  );
}

function EditWebsiteEditor({ program, onSave, disabled, programId }) {
  const theme = program.theme || {};
  const themeColors = theme.colors || {};
  const [primary, setPrimary] = React.useState(themeColors.primary || HZ_BRAND_DEFAULT.primary);
  const [accent, setAccent] = React.useState(themeColors.accent || HZ_BRAND_DEFAULT.accent);
  const [font, setFont] = React.useState(theme.font || HZ_BRAND_DEFAULT.font);
  const [heroUrl, setHeroUrl] = React.useState(program.public_hero_image_url || '');
  const [uploading, setUploading] = React.useState(false);
  const [uploadErr, setUploadErr] = React.useState('');
  const fileRef = React.useRef(null);

  async function handleFile(file) {
    setUploadErr('');
    if (!file) return;
    if (!/^image\//.test(file.type)) { setUploadErr('Please choose an image file (JPG or PNG).'); return; }
    if (file.size > 8 * 1024 * 1024) { setUploadErr('That image is over 8 MB — please use a smaller one.'); return; }
    if (!programId) { setUploadErr('Missing program id — reload and try again.'); return; }
    if (!window.HZsupa || !window.HZsupa.storage) { setUploadErr('Upload is only available on the live site.'); return; }
    setUploading(true);
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
      const path = programId + '/hero-' + Date.now() + '.' + ext;
      const { error } = await window.HZsupa.storage.from('posters').upload(path, file, { upsert: true, contentType: file.type, cacheControl: '3600' });
      if (error) throw error;
      const { data } = window.HZsupa.storage.from('posters').getPublicUrl(path);
      if (!data || !data.publicUrl) throw new Error('No public URL returned.');
      setHeroUrl(data.publicUrl);
    } catch (err) {
      console.error('[edit] hero upload', err);
      setUploadErr('Upload failed: ' + (err?.message || String(err)));
    } finally { setUploading(false); }
  }

  const save = () => onSave({
    theme: { colors: { primary, accent }, font },
    public_hero_image_url: heroUrl.trim() || null,
  });
  const resetBrand = () => { setPrimary(HZ_BRAND_DEFAULT.primary); setAccent(HZ_BRAND_DEFAULT.accent); setFont(HZ_BRAND_DEFAULT.font); };

  const labelStyle = { fontSize: 12, fontWeight: 700, marginBottom: 8, color: 'var(--hz-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' };

  return (
    <div style={{ marginTop: 16, padding: 16, background: 'rgba(255,255,255,0.04)', borderRadius: 10, display: 'grid', gap: 18 }}>
      <div className="hz-eyebrow" style={{ fontSize: 10 }}>Edit your website · published live to your public site</div>

      <div>
        <div style={labelStyle}>Colors</div>
        <div style={{ display: 'flex', gap: 26, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <ColorKnob label="Primary" value={primary} onChange={setPrimary} disabled={disabled}/>
          <ColorKnob label="Accent" value={accent} onChange={setAccent} disabled={disabled}/>
          <button className="hz-btn hz-btn-ghost hz-btn-sm" onClick={resetBrand} disabled={disabled}>Reset to MCA brand</button>
        </div>
      </div>

      <FieldRow label="Font">
        <select className="hz-input" value={font} onChange={e => setFont(e.target.value)} disabled={disabled}>
          {HZ_FONT_OPTIONS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
        </select>
      </FieldRow>

      <div>
        <div style={labelStyle}>Hero photo</div>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ width: 156, height: 94, borderRadius: 8, overflow: 'hidden', background: 'rgba(255,255,255,0.06)', flex: 'none', border: '1px solid rgba(255,255,255,0.1)' }}>
            {heroUrl
              ? <img src={heroUrl} alt="Hero preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
              : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 11, color: 'var(--hz-dim)', textAlign: 'center', padding: 6 }}>Using the site&rsquo;s built-in photo</div>}
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleFile(e.target.files && e.target.files[0])}/>
            <button className="hz-btn hz-btn-ghost hz-btn-sm" onClick={() => fileRef.current && fileRef.current.click()} disabled={disabled || uploading}>
              {uploading ? 'Uploading…' : (heroUrl ? 'Replace photo' : 'Upload photo')}
            </button>
            {heroUrl && <button className="hz-btn hz-btn-ghost hz-btn-sm" onClick={() => setHeroUrl('')} disabled={disabled || uploading}>Use default photo</button>}
            <div style={{ fontSize: 11, color: 'var(--hz-dim)' }}>JPG or PNG · landscape looks best.</div>
          </div>
        </div>
        {uploadErr && <div style={{ marginTop: 8, color: 'var(--hz-pink)', fontSize: 12 }}>{uploadErr}</div>}
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', paddingTop: 4, flexWrap: 'wrap' }}>
        <a className="hz-btn hz-btn-ghost hz-btn-sm" href={program.website_url || 'https://mcaminot.com'} target="_blank" rel="noopener">View your site →</a>
        <div style={{ flex: 1 }}/>
        <button className="hz-btn hz-btn-primary" onClick={save} disabled={disabled || uploading}>Save &amp; publish</button>
      </div>
      <div style={{ fontSize: 11, color: 'var(--hz-dim)' }}>Saved changes appear on your website within a few seconds.</div>
    </div>
  );
}

function PaymentSettingsEditor({ settings, onSave, disabled }) {
  const [provider, setProvider] = React.useState(settings.default_provider || 'square');
  const [checkoutMode, setCheckoutMode] = React.useState(settings.checkout_mode || 'manual_invoice');
  const [publicCheckout, setPublicCheckout] = React.useState(!!settings.public_checkout_enabled);
  const [currency, setCurrency] = React.useState(settings.currency || 'USD');
  const [paymentNote, setPaymentNote] = React.useState(settings.public_payment_note || '');

  const save = () => onSave({
    default_provider: provider,
    checkout_mode: checkoutMode,
    public_checkout_enabled: publicCheckout,
    currency: currency.trim().toUpperCase() || 'USD',
    public_payment_note: paymentNote.trim() || null,
  });

  return (
    <div style={{ marginTop: 16, padding: 14, background: 'rgba(255,255,255,0.04)', borderRadius: 10, display: 'grid', gap: 10 }}>
      <div className="hz-eyebrow" style={{ fontSize: 10 }}>Edit payment settings</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 0.6fr', gap: 10 }}>
        <FieldRow label="Default provider">
          <select className="hz-input" value={provider} onChange={e => setProvider(e.target.value)} disabled={disabled}>
            <option value="square">Square</option>
            <option value="stripe">Stripe</option>
            <option value="manual">Manual / off-platform</option>
          </select>
        </FieldRow>
        <FieldRow label="Checkout mode">
          <select className="hz-input" value={checkoutMode} onChange={e => setCheckoutMode(e.target.value)} disabled={disabled}>
            <option value="none">None</option>
            <option value="square_checkout">Square hosted checkout</option>
            <option value="square_web_payments">Square Web Payments</option>
            <option value="manual_invoice">Manual invoice</option>
          </select>
        </FieldRow>
        <FieldRow label="Currency">
          <input className="hz-input" value={currency} onChange={e => setCurrency(e.target.value)} disabled={disabled} maxLength={3}/>
        </FieldRow>
      </div>
      <FieldRow label="Public payment note (shown on website if enabled)">
        <textarea className="hz-input" value={paymentNote} onChange={e => setPaymentNote(e.target.value)} rows={2} disabled={disabled}/>
      </FieldRow>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, paddingTop: 4 }}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
          <input type="checkbox" checked={publicCheckout} onChange={e => setPublicCheckout(e.target.checked)} disabled={disabled}/>
          Allow public checkout from the website
        </label>
        <div style={{ flex: 1 }}/>
        <button className="hz-btn hz-btn-primary" onClick={save} disabled={disabled}>Save settings</button>
      </div>
    </div>
  );
}

// ─── Programs & Classes (Offerings Manager) ─────────────────────────
// Owner-managed: tracks (the 6 marketing categories) + classes (the priced
// items grouped under each track). The website Programs + Pricing pages
// render directly from these tables via public_program_tracks /
// public_program_classes views.
function liveOfferingsMode() {
  return Boolean(window.HZsupa && window.HZdb?.auth?._mode?.() === 'live');
}

function offeringsAuthError(message = 'Your login expired before this change could be saved.') {
  const error = new Error(`${message} Sign in again, then retry the change.`);
  error.code = 'HZ_OFFERINGS_AUTH_REQUIRED';
  return error;
}

function isOfferingsAuthError(error) {
  const code = String(error?.code || '').toUpperCase();
  const message = String(error?.message || '').toLowerCase();
  return error?.status === 401
    || code === 'PGRST301'
    || code === 'JWT_EXPIRED'
    || message.includes('jwt expired')
    || message.includes('invalid jwt')
    || message.includes('refresh token');
}

async function withLiveOfferingsSession(mutation) {
  const auth = window.HZsupa?.auth;
  if (!auth) return { data: null, error: offeringsAuthError('The live database connection is unavailable.') };

  const current = await auth.getSession();
  if (current?.error) return { data: null, error: current.error };
  if (!current?.data?.session?.user) return { data: null, error: offeringsAuthError() };

  let result = await mutation();
  if (!isOfferingsAuthError(result?.error)) return result;

  const refreshed = await auth.refreshSession();
  if (refreshed?.error || !refreshed?.data?.session?.user) {
    return { data: null, error: offeringsAuthError() };
  }
  result = await mutation();
  return result;
}

async function refreshOfferings(table, action) {
  try {
    if (window.HZmirror?.roster) await window.HZmirror.roster();
    if (window.HZsel?._refresh) await window.HZsel._refresh();
  } catch (err) {
    console.warn('[offerings] refresh after mutation failed', err);
  }
  window.dispatchEvent(new CustomEvent('hz:refresh', { detail: { table, action } }));
}

async function writeProgramTrack(id, patch) {
  if (liveOfferingsMode()) {
    const res = await withLiveOfferingsSession(() => window.HZsupa
      .from('program_tracks')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single());
    if (!res?.error) await refreshOfferings('program_tracks', 'update');
    return res;
  }
  const res = await window.HZdb.from('program_tracks').update(patch).eq('id', id);
  if (!res?.error) await refreshOfferings('program_tracks', 'update'); // hz:refresh
  return res;
}

async function writeProgramClass(action, payload, id) {
  if (liveOfferingsMode()) {
    if (action === 'insert') return withLiveOfferingsSession(() => window.HZsupa.from('program_classes').insert(payload).select('*').single());
    if (action === 'update') return withLiveOfferingsSession(() => window.HZsupa.from('program_classes').update(payload).eq('id', id).select('*').single());
    if (action === 'delete') return withLiveOfferingsSession(() => window.HZsupa.from('program_classes').delete().eq('id', id));
  }
  const table = window.HZdb.from('program_classes');
  if (action === 'insert') return table.insert(payload);
  if (action === 'update') return table.update(payload).eq('id', id);
  if (action === 'delete') return table.delete().eq('id', id);
  return { error: new Error(`Unknown class mutation: ${action}`) };
}

async function readClassDiscountCodes(classId) {
  if (!liveOfferingsMode()) return { data: [], error: null };
  return window.HZsupa
    .from('class_discount_codes')
    .select('id, program_id, class_id, code, label, discount_type, discount_value, is_active, starts_at, ends_at, created_at')
    .eq('class_id', classId)
    .order('created_at', { ascending: true });
}

async function writeClassDiscountCode(action, payload, id) {
  if (!liveOfferingsMode()) return { data: null, error: new Error('Discount codes are available in live mode only.') };
  if (action === 'insert') return withLiveOfferingsSession(() => window.HZsupa.from('class_discount_codes').insert(payload).select('*').single());
  if (action === 'update') return withLiveOfferingsSession(() => window.HZsupa.from('class_discount_codes').update(payload).eq('id', id).select('*').single());
  if (action === 'delete') return withLiveOfferingsSession(() => window.HZsupa.from('class_discount_codes').delete().eq('id', id));
  return { data: null, error: new Error(`Unknown discount-code mutation: ${action}`) };
}

function normalizedDiscountCode(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 32);
}

function nullableInt(value) {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizedExternalRegistrationUrl(value) {
  const url = String(value || '').trim();
  if (!url) return null;
  return /^https:\/\//i.test(url) ? url : false;
}

const CLASS_PRICE_UNIT_LABELS = {
  per_month: '/month',
  per_session: '/session',
  per_session_per_month: '/month per session',
  per_athlete: '/athlete',
  flat: null,
};

function normalizedClassPriceUnitLabel(unit, label) {
  if (unit === 'custom') return String(label || '').trim() || null;
  return CLASS_PRICE_UNIT_LABELS[unit] || null;
}

function OfferingsManager({ snap }) {
  const program = window.HZsel.programProfile?.() || (snap.programs || [])[0] || {};
  const programId = program.id;
  const tracks = window.HZsel.programTracks?.() || [];
  const allClasses = window.HZsel.programClasses?.() || [];
  const [editingTrackId, setEditingTrackId] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const [notice, setNotice] = React.useState('');
  const [errorMessage, setErrorMessage] = React.useState('');

  if (!programId) {
    return <div className="hz-card" style={{ marginTop: 24 }}>No program loaded.</div>;
  }

  async function patchTrack(track, patch) {
    setBusy(true);
    setNotice('');
    setErrorMessage('');
    try {
      const { error } = await writeProgramTrack(track.id, patch);
      if (error) {
        console.error('[tracks] update', error);
        setErrorMessage(error.message || 'Track update failed.');
        return false;
      } else {
        setNotice('Track updated on the website.');
        return true;
      }
    } finally { setBusy(false); }
  }

  async function addClass(track) {
    setBusy(true);
    setNotice('');
    setErrorMessage('');
    try {
      const order = (allClasses.filter(c => c.track_id === track.id).length || 0) * 10 + 10;
      const payload = {
        program_id: programId,
        track_id: track.id,
        name: 'New offering',
        price_cents: 0,
        price_unit: 'per_month',
        price_unit_label: '/month',
        display_order: order,
        is_public: true,
        registration_open: true,
      };
      const { error } = await writeProgramClass('insert', payload);
      if (error) {
        console.error('[classes] insert', error);
        setErrorMessage(error.message || 'Class add failed.');
      } else {
        setNotice('Class added. Edit the row below and save it.');
        await refreshOfferings('program_classes', 'insert');
      }
    } finally { setBusy(false); }
  }

  return (
    <div className="hz-card" style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div className="hz-eyebrow" style={{ marginBottom: 6 }}>Programs &amp; Classes · live on the website</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>What you sell.</div>
          <div style={{ color: 'var(--hz-dim)', fontSize: 12, marginTop: 4 }}>
            6 tracks · {allClasses.length} priced offerings · changes here update <code style={{ fontFamily: 'var(--hz-mono)' }}>mcaminot.com</code> instantly.
          </div>
        </div>
      </div>
      {notice && (
        <div style={{ marginBottom: 12, padding: 12, borderRadius: 10, border: '1px solid rgba(56,229,164,0.35)', color: 'var(--hz-green)', background: 'rgba(56,229,164,0.08)', fontSize: 13 }}>
          {notice}
        </div>
      )}
      {errorMessage && (
        <div style={{ marginBottom: 12, padding: 12, borderRadius: 10, border: '1px solid rgba(249,127,172,0.35)', color: 'var(--hz-pink)', background: 'rgba(249,127,172,0.08)', fontSize: 13 }}>
          {errorMessage}
        </div>
      )}

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
                <TrackCopyEditor track={t} onSave={async (patch) => {
                  const saved = await patchTrack(t, patch);
                  if (saved) setEditingTrackId(null);
                }} disabled={busy}/>
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
                  {classes.map(c => (
                    <ClassRow
                      key={c.id}
                      cls={c}
                      disabled={busy}
                      onMutated={(message) => {
                        setNotice(message);
                        setErrorMessage('');
                      }}
                    />
                  ))}
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

function ClassRow({ cls, disabled, onMutated }) {
  const [name, setName] = React.useState(cls.name || '');
  const [priceCents, setPriceCents] = React.useState(cls.price_cents || 0);
  const [priceUnit, setPriceUnit] = React.useState(cls.price_unit || 'per_month');
  const [priceUnitLabel, setPriceUnitLabel] = React.useState(cls.price_unit_label || '');
  const [schedule, setSchedule] = React.useState(cls.schedule_summary || '');
  const [description, setDescription] = React.useState(cls.description || '');
  const [externalRegistrationUrl, setExternalRegistrationUrl] = React.useState(cls.external_registration_url || '');
  const [ageMin, setAgeMin] = React.useState(cls.age_range_min ?? '');
  const [ageMax, setAgeMax] = React.useState(cls.age_range_max ?? '');
  const [capacity, setCapacity] = React.useState(cls.capacity ?? '');
  const [registrationOpen, setRegistrationOpen] = React.useState(!!cls.registration_open);
  const [isPublic, setIsPublic] = React.useState(!!cls.is_public);
  const [dirty, setDirty] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [rowError, setRowError] = React.useState('');
  const [showDiscounts, setShowDiscounts] = React.useState(false);
  const [savedMessage, setSavedMessage] = React.useState('');

  React.useEffect(() => {
    if (dirty || saving) return;
    setName(cls.name || '');
    setPriceCents(cls.price_cents || 0);
    setPriceUnit(cls.price_unit || 'per_month');
    setPriceUnitLabel(cls.price_unit_label || '');
    setSchedule(cls.schedule_summary || '');
    setDescription(cls.description || '');
    setExternalRegistrationUrl(cls.external_registration_url || '');
    setAgeMin(cls.age_range_min ?? '');
    setAgeMax(cls.age_range_max ?? '');
    setCapacity(cls.capacity ?? '');
    setRegistrationOpen(!!cls.registration_open);
    setIsPublic(!!cls.is_public);
  }, [cls.id, cls.updated_at, dirty, saving]);

  function mark() {
    setDirty(true);
    setRowError('');
    setSavedMessage('');
  }

  async function save() {
    setSaving(true);
    setRowError('');
    try {
      const cleanExternalRegistrationUrl = normalizedExternalRegistrationUrl(externalRegistrationUrl);
      if (cleanExternalRegistrationUrl === false) {
        setRowError('External registration links must start with https://');
        return;
      }
      const patch = {
        name: name.trim() || 'Untitled',
        price_cents: Math.max(0, parseInt(priceCents, 10) || 0),
        price_unit: priceUnit,
        price_unit_label: normalizedClassPriceUnitLabel(priceUnit, priceUnitLabel),
        schedule_summary: schedule.trim() || null,
        description: description.trim() || null,
        external_registration_url: cleanExternalRegistrationUrl,
        age_range_min: nullableInt(ageMin),
        age_range_max: nullableInt(ageMax),
        capacity: capacity === '' ? null : Math.max(0, parseInt(capacity, 10) || 0),
        registration_open: !!registrationOpen,
        is_public: !!isPublic,
      };
      const { data, error } = await writeProgramClass('update', patch, cls.id);
      if (error) {
        console.error('[classes] update', error);
        setRowError(error.message || 'Class save failed.');
      } else if (!data?.id) {
        setRowError('The database did not confirm this change. Nothing was marked saved; please retry.');
      } else {
        setDirty(false);
        setSavedMessage('Saved to the website.');
        onMutated?.('Class saved to the website.');
        await refreshOfferings('program_classes', 'update');
      }
    } finally { setSaving(false); }
  }

  async function remove() {
    if (!confirm(`Delete "${name}"? This removes it from the website.`)) return;
    setSaving(true);
    setRowError('');
    try {
      const { error } = await writeProgramClass('delete', null, cls.id);
      if (error) {
        console.error('[classes] delete', error);
        setRowError(error.message || 'Class delete failed.');
      } else {
        onMutated?.('Class removed from the website.');
        await refreshOfferings('program_classes', 'delete');
      }
    } finally { setSaving(false); }
  }

  const dollars = (priceCents / 100).toFixed(2).replace(/\.00$/, '');

  return (
    <div className="class-row" style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: 10 }}>
      {/* Top row: name + price (always together so the row reads as one offering) */}
      <div className="class-row__head">
        <input className="hz-input class-row__name" value={name} onChange={e => { setName(e.target.value); mark(); }} placeholder="Senior" disabled={disabled || saving}/>
        <div className="class-row__price">
          <span style={{ color: 'var(--hz-dim)', fontSize: 13 }}>$</span>
          <input className="hz-input" type="number" value={dollars} onChange={e => { setPriceCents(Math.round(parseFloat(e.target.value || 0) * 100)); mark(); }} disabled={disabled || saving}/>
          <select className="hz-input" value={priceUnit} onChange={e => { setPriceUnit(e.target.value); mark(); }} disabled={disabled || saving}>
            <option value="per_month">/month</option>
            <option value="per_session">/session</option>
            <option value="per_session_per_month">/mo·session</option>
            <option value="per_athlete">/athlete</option>
            <option value="flat">flat</option>
            <option value="custom">custom</option>
          </select>
        </div>
      </div>
      {priceUnit === 'custom' && (
        <input
          className="hz-input"
          value={priceUnitLabel}
          onChange={e => { setPriceUnitLabel(e.target.value); mark(); }}
          placeholder="Custom price label, e.g. TBD or $165-$200/month"
          disabled={disabled || saving}
          style={{ width: '100%', marginTop: 8 }}
        />
      )}
      {/* Bottom row: schedule + capacity + actions */}
      <div className="class-row__meta">
        <input className="hz-input class-row__schedule" value={schedule} onChange={e => { setSchedule(e.target.value); mark(); }} placeholder="Schedule (e.g. 6-week sessions)" disabled={disabled || saving}/>
        <input className="hz-input class-row__capacity" type="number" value={ageMin} onChange={e => { setAgeMin(e.target.value); mark(); }} placeholder="Age min" disabled={disabled || saving}/>
        <input className="hz-input class-row__capacity" type="number" value={ageMax} onChange={e => { setAgeMax(e.target.value); mark(); }} placeholder="Age max" disabled={disabled || saving}/>
        <input className="hz-input class-row__capacity" type="number" value={capacity} onChange={e => { setCapacity(e.target.value); mark(); }} placeholder="Cap ∞" disabled={disabled || saving}/>
      </div>
      <textarea className="hz-input" value={description} onChange={e => { setDescription(e.target.value); mark(); }} placeholder="Details shown with this class" rows={2} disabled={disabled || saving} style={{ width: '100%', marginTop: 8 }}/>
      <input
        className="hz-input"
        type="url"
        value={externalRegistrationUrl}
        onChange={e => { setExternalRegistrationUrl(e.target.value); mark(); }}
        placeholder="External registration URL (optional, https://...)"
        disabled={disabled || saving}
        style={{ width: '100%', marginTop: 8 }}
      />
      <div className="class-row__actions">
        <label className="class-row__public" title="Show on website">
          <input type="checkbox" checked={isPublic} onChange={e => { setIsPublic(e.target.checked); mark(); }} disabled={disabled || saving}/>
          Public
        </label>
        <label className="class-row__public" title="Allow registration/payment from website">
          <input type="checkbox" checked={registrationOpen} onChange={e => { setRegistrationOpen(e.target.checked); mark(); }} disabled={disabled || saving}/>
          Registration open
        </label>
        <div className="class-row__action-buttons">
          <button type="button" className="hz-btn" disabled={saving} onClick={() => setShowDiscounts(value => !value)}>
            {showDiscounts ? 'Hide discounts' : 'Discount codes'}
          </button>
          <button type="button" className="hz-btn hz-btn-primary" disabled={!dirty || saving} onClick={save}>{saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}</button>
          <button type="button" className="hz-btn hz-btn-danger" disabled={saving} onClick={remove} title="Delete">Delete</button>
        </div>
      </div>
      {savedMessage && !dirty && !rowError && <div role="status" style={{ color: 'var(--hz-green)', fontSize: 12 }}>{savedMessage}</div>}
      {rowError && (
        <div style={{ marginTop: 8, padding: 10, borderRadius: 10, border: '1px solid rgba(249,127,172,0.35)', color: 'var(--hz-pink)', background: 'rgba(249,127,172,0.08)', fontSize: 12 }}>
          {rowError}
        </div>
      )}
      {showDiscounts && (
        <ClassDiscountCodesEditor
          cls={cls}
          disabled={disabled || saving}
          onMutated={onMutated}
        />
      )}
    </div>
  );
}

function ClassDiscountCodesEditor({ cls, disabled, onMutated }) {
  const [codes, setCodes] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState('');
  const [code, setCode] = React.useState('');
  const [label, setLabel] = React.useState('');
  const [discountType, setDiscountType] = React.useState('percent');
  const [amount, setAmount] = React.useState('');

  async function load() {
    setLoading(true);
    setErrorMessage('');
    const { data, error } = await readClassDiscountCodes(cls.id);
    if (error) setErrorMessage(error.message || 'Could not load discount codes.');
    else setCodes(data || []);
    setLoading(false);
  }

  React.useEffect(() => { load(); }, [cls.id]);

  function displayValue(row) {
    return row.discount_type === 'percent'
      ? `${row.discount_value}% off`
      : `$${(Number(row.discount_value || 0) / 100).toFixed(Number(row.discount_value || 0) % 100 ? 2 : 0)} off`;
  }

  async function addCode() {
    const cleanCode = normalizedDiscountCode(code);
    const cleanLabel = label.trim();
    const numeric = Number(amount);
    if (cleanCode.length < 3) { setErrorMessage('Code must be at least 3 letters or numbers.'); return; }
    if (!cleanLabel) { setErrorMessage('Add a short label, such as Sibling or Parade handout.'); return; }
    if (!Number.isFinite(numeric) || numeric <= 0) { setErrorMessage('Enter a discount amount greater than zero.'); return; }
    const discountValue = discountType === 'percent' ? Math.round(numeric) : Math.round(numeric * 100);
    if (discountType === 'percent' && (discountValue < 1 || discountValue > 99)) {
      setErrorMessage('Percent discounts must be between 1% and 99%.');
      return;
    }
    if (discountType === 'fixed' && discountValue >= Number(cls.price_cents || 0)) {
      setErrorMessage('Dollar discount must be less than the class price. Use the staff comp workflow for a free registration.');
      return;
    }
    setBusy(true);
    setErrorMessage('');
    const { error } = await writeClassDiscountCode('insert', {
      program_id: cls.program_id,
      class_id: cls.id,
      code: cleanCode,
      label: cleanLabel,
      discount_type: discountType,
      discount_value: discountValue,
      is_active: true,
    });
    if (error) {
      const duplicate = String(error.code || '') === '23505';
      setErrorMessage(duplicate ? 'That code already exists for this gym.' : (error.message || 'Could not add discount code.'));
    } else {
      setCode('');
      setLabel('');
      setAmount('');
      await load();
      onMutated?.(`Discount code added to ${cls.name}.`);
    }
    setBusy(false);
  }

  async function toggleCode(row) {
    setBusy(true);
    setErrorMessage('');
    const { error } = await writeClassDiscountCode('update', { is_active: !row.is_active }, row.id);
    if (error) setErrorMessage(error.message || 'Could not update discount code.');
    else {
      await load();
      onMutated?.(`${row.code} ${row.is_active ? 'paused' : 'activated'}.`);
    }
    setBusy(false);
  }

  async function removeCode(row) {
    if (!confirm(`Delete discount code "${row.code}"? Existing registration price records will be kept.`)) return;
    setBusy(true);
    setErrorMessage('');
    const { error } = await writeClassDiscountCode('delete', null, row.id);
    if (error) setErrorMessage(error.message || 'Could not delete discount code.');
    else {
      await load();
      onMutated?.(`${row.code} deleted.`);
    }
    setBusy(false);
  }

  return (
    <div style={{ marginTop: 12, padding: 12, borderRadius: 10, border: '1px solid rgba(39,207,215,0.22)', background: 'rgba(39,207,215,0.045)' }}>
      <div className="hz-eyebrow" style={{ fontSize: 10, marginBottom: 5 }}>Checkout discount codes</div>
      <div style={{ color: 'var(--hz-dim)', fontSize: 11.5, lineHeight: 1.5, marginBottom: 10 }}>
        Codes apply only to {cls.name}. Square verifies the discounted total from the saved registration, so families cannot change the amount in their browser.
      </div>

      {loading ? <div style={{ color: 'var(--hz-dim)', fontSize: 12 }}>Loading codes…</div> : (
        <div style={{ display: 'grid', gap: 7, marginBottom: 10 }}>
          {codes.map(row => (
            <div key={row.id} style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 9, padding: '8px 10px', borderRadius: 9, border: '1px solid var(--hz-line)', background: 'rgba(0,0,0,0.12)', opacity: row.is_active ? 1 : 0.6 }}>
              <code style={{ fontFamily: 'var(--hz-mono)', fontWeight: 800, color: row.is_active ? 'var(--hz-teal)' : 'var(--hz-dim)' }}>{row.code}</code>
              <span style={{ color: 'var(--hz-dim)', fontSize: 12 }}>{row.label} · {displayValue(row)}</span>
              <div style={{ flex: 1 }}/>
              <button className="hz-btn hz-btn-sm" onClick={() => toggleCode(row)} disabled={disabled || busy}>{row.is_active ? 'Pause' : 'Activate'}</button>
              <button className="hz-btn hz-btn-sm hz-btn-danger" onClick={() => removeCode(row)} disabled={disabled || busy}>Delete</button>
            </div>
          ))}
          {codes.length === 0 && <div style={{ color: 'var(--hz-dim)', fontSize: 12 }}>No codes yet. Add the sibling and parade codes below.</div>}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(128px, 1fr))', gap: 8, alignItems: 'end' }}>
        <FieldRow label="Code">
          <input className="hz-input" value={code} onChange={e => setCode(normalizedDiscountCode(e.target.value))} placeholder="SIBLING" disabled={disabled || busy}/>
        </FieldRow>
        <FieldRow label="Internal label">
          <input className="hz-input" value={label} onChange={e => setLabel(e.target.value)} placeholder="Sibling discount" maxLength={80} disabled={disabled || busy}/>
        </FieldRow>
        <FieldRow label="Type">
          <select className="hz-input" value={discountType} onChange={e => setDiscountType(e.target.value)} disabled={disabled || busy}>
            <option value="percent">Percent</option>
            <option value="fixed">Dollars</option>
          </select>
        </FieldRow>
        <FieldRow label={discountType === 'percent' ? 'Percent off' : 'Dollars off'}>
          <input className="hz-input" type="number" min="1" step={discountType === 'percent' ? '1' : '0.01'} value={amount} onChange={e => setAmount(e.target.value)} placeholder={discountType === 'percent' ? '10' : '15'} disabled={disabled || busy}/>
        </FieldRow>
        <button className="hz-btn hz-btn-primary" onClick={addCode} disabled={disabled || busy || loading}>{busy ? '…' : 'Add code'}</button>
      </div>
      {errorMessage && <div role="alert" style={{ color: 'var(--hz-pink)', fontSize: 12, marginTop: 9 }}>{errorMessage}</div>}
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
  const scope = window.HZviewerScope ? window.HZviewerScope(snap, session) : null;
  const visibleAthleteIds = scope?.visibleAthleteIds || new Set();
  const accounts = (snap.billing_accounts || [])
    .filter(acc => !isParent || visibleAthleteIds.has(acc.athlete_id))
    .map(acc => ({ ...acc, athlete: snap.athletes.find(a => a.id === acc.athlete_id) }))
    .filter(acc => !isParent || acc.athlete);
  const parentClassEnrollments = isParent ? window.HZsel.classEnrollmentsForParent(session) : [];
  const activeParentClassEnrollments = isParent
    ? parentClassEnrollments.filter(row => !window.HZsel.classEnrollmentIsPast(row))
    : [];
  const pastParentClassEnrollments = isParent
    ? parentClassEnrollments.filter(row => window.HZsel.classEnrollmentIsPast(row))
    : [];
  const ownerClassEnrollments = !isParent
    ? (snap.class_enrollments || [])
      .slice()
      .sort((a,b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
      .slice(0, 12)
    : [];
  const parentSummary = isParent ? parentBillingSummary(snap, session) : null;
  const [parentEnrollmentView, setParentEnrollmentView] = React.useState('active');
  const programRef = {
    program_id: (snap.teams || [])[0]?.program_id || program.id || null,
    program_slug: program.slug || 'mca',
  };

  return (
    <div>
      <SectionHeading eyebrow={isParent ? 'My family' : 'Program billing'} title="Billing."/>
      {isParent && (
        <div style={{ display: 'grid', gap: 16, marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
          <StatTile label="Paid" value={dollarsToParentMoney(parentSummary.paid)} sub={`${parentSummary.enrollments.length} registrations`} accent="var(--hz-green)" size="md"/>
          <StatTile label="Total" value={dollarsToParentMoney(parentSummary.total)} sub="tracked charges" accent="var(--hz-teal)" size="md"/>
          <StatTile label="Balance" value={dollarsToParentMoney(parentSummary.owed)} sub={parentSummary.owed > 0 ? 'open' : 'current'} accent={parentSummary.owed > 0 ? 'var(--hz-amber)' : 'var(--hz-green)'} size="md"/>
          <StatTile label="Pending" value={parentSummary.pendingCount} sub="review/payment items" accent={parentSummary.pendingCount ? 'var(--hz-amber)' : 'var(--hz-teal)'} size="md"/>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button
              type="button"
              className={'hz-btn hz-btn-sm' + (parentEnrollmentView === 'active' ? ' hz-btn-primary' : '')}
              onClick={() => setParentEnrollmentView('active')}
            >
              Active enrollments ({activeParentClassEnrollments.length})
            </button>
            <button
              type="button"
              className={'hz-btn hz-btn-sm' + (parentEnrollmentView === 'past' ? ' hz-btn-primary' : '')}
              onClick={() => setParentEnrollmentView('past')}
            >
              Past enrollments ({pastParentClassEnrollments.length})
            </button>
          </div>
        </div>
      )}
      {!isParent && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 16, marginBottom: 24 }}>
            <StatTile label="Collected" value={`$${bill.paid.toLocaleString()}`} sub={`${bill.paidRegistrations || 0} paid regs`} accent="var(--hz-green)" size="md"/>
            <StatTile label="Class Revenue" value={`$${bill.classRevenue.toLocaleString()}`} sub={`${bill.classEnrollments || 0} enrollments`} accent="var(--hz-teal)" size="md"/>
            <StatTile label="Outstanding" value={`$${bill.owed.toLocaleString()}`} accent="var(--hz-amber)" size="md"/>
            <StatTile label="Pending" value={bill.pendingRegistrations || 0} sub="registrations" size="md"/>
            <StatTile label="Accounts" value={bill.nAccounts} sub={`${bill.nCharges || 0} charges`} size="md"/>
            <StatTile
              label="Square Open"
              value={`$${bill.syncedOpen.toLocaleString()}`}
              sub={bill.hasSquareData ? `${bill.syncedAccounts} matched families` : 'run first sync'}
              accent={bill.syncedOpen > 0 ? 'var(--hz-pink)' : 'var(--hz-teal)'}
              size="md"
            />
          </div>
          <SquareBillingPanel programRef={programRef}/>
          {ownerClassEnrollments.length > 0 && (
            <div className="hz-card" style={{ marginBottom: 20, padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--hz-line)' }}>
                <div className="hz-eyebrow" style={{ color: 'var(--hz-teal)' }}>Recent class registrations</div>
              </div>
              <table className="hz-table">
                <thead><tr><th style={{ paddingLeft: 20 }}>Athlete</th><th>Parent</th><th>Class</th><th>Schedule</th><th>Status</th><th>Paid</th></tr></thead>
                <tbody>
                  {ownerClassEnrollments.map(row => {
                    const klass = (snap.program_classes || []).find(c => c.id === row.class_id);
                    return (
                      <tr key={row.id}>
                        <td style={{ paddingLeft: 20, fontWeight: 700 }}>{row.athlete_name || 'Athlete'}</td>
                        <td>
                          <div>{row.parent_name || 'Parent'}</div>
                          <div style={{ color: 'var(--hz-dim)', fontSize: 11 }}>{row.parent_email}</div>
                        </td>
                        <td>{klass?.name || row.metadata?.class_name || 'Class registration'}</td>
                        <td style={{ color: 'var(--hz-dim)', fontSize: 12 }}>{row.schedule_summary || klass?.schedule_summary || 'Schedule pending'}</td>
                        <td><Pill tone={row.staff_status === 'accepted' ? 'teal' : 'amber'}>{row.staff_status}</Pill></td>
                        <td style={{ color: row.payment_status === 'paid' ? 'var(--hz-green)' : 'var(--hz-amber)', fontWeight: 900 }}>
                          {row.payment_status === 'paid' ? centsToParentMoney(row.amount_paid_cents) : row.payment_status}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      {isParent && accounts.length === 0 && parentClassEnrollments.length === 0 && (
        <EmptyState
          icon="billing"
          title="No billing records yet."
          body="Season billing and paid class registrations will appear here as soon as staff or checkout creates them."
        />
      )}
      {isParent && (activeParentClassEnrollments.length > 0 || pastParentClassEnrollments.length > 0) && (
        <div className="hz-card" style={{ marginBottom: 20 }}>
          <div className="hz-eyebrow" style={{ color: 'var(--hz-teal)', marginBottom: 12 }}>
            {parentEnrollmentView === 'past' ? 'Past enrollments' : 'Active enrollments'}
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            {(parentEnrollmentView === 'past' ? pastParentClassEnrollments : activeParentClassEnrollments).map(row => (
              <div key={row.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr) auto', gap: 12, alignItems: 'center', padding: 14, border: '1px solid var(--hz-line)', borderRadius: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 800 }}>{row.class_name}</div>
                  <div style={{ color: 'var(--hz-dim)', fontSize: 12, marginTop: 3 }}>{row.athlete_name || 'Athlete'}</div>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: 'var(--hz-dim)', fontSize: 12 }}>{row.schedule_summary || 'Class schedule pending'}</div>
                  <div style={{ color: row.staff_status === 'accepted' ? 'var(--hz-green)' : 'var(--hz-amber)', fontSize: 11, marginTop: 4 }}>
                    {row.staff_status === 'accepted' ? 'Accepted by staff' : 'Pending staff review'}
                  </div>
                </div>
                <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <div style={{ color: row.payment_status === 'paid' ? 'var(--hz-green)' : 'var(--hz-amber)', fontWeight: 900 }}>{row.payment_status === 'paid' ? centsToParentMoney(row.amount_paid_cents) : row.payment_status}</div>
                  {row.receipt_url && <a href={row.receipt_url} target="_blank" rel="noreferrer" style={{ color: 'var(--hz-teal)', fontSize: 11 }}>Receipt</a>}
                </div>
              </div>
            ))}
            {(parentEnrollmentView === 'active' && activeParentClassEnrollments.length === 0) && (
              <div style={{ color: 'var(--hz-dim)', fontSize: 13 }}>No active class enrollments right now.</div>
            )}
            {(parentEnrollmentView === 'past' && pastParentClassEnrollments.length === 0) && (
              <div style={{ color: 'var(--hz-dim)', fontSize: 13 }}>No past enrollments yet.</div>
            )}
          </div>
        </div>
      )}
      {accounts.length > 0 && (
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
                  <td style={{ fontFamily: 'var(--hz-mono)' }}>{dollarsToParentMoney(a.season_total)}</td>
                  <td style={{ fontFamily: 'var(--hz-mono)', color: 'var(--hz-green)' }}>{dollarsToParentMoney(a.paid)}</td>
                  <td>{a.owed > 0 ? <Pill tone="amber">{dollarsToParentMoney(a.owed)}</Pill> : <span style={{ color: 'var(--hz-dim)' }}>$0</span>}</td>
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
      )}
    </div>
  );
}
window.Billing = Billing;

async function squareAdminHeaders(requireOwner = false) {
  const headers = {};
  if (window.HZ_ANON_KEY) headers.apikey = window.HZ_ANON_KEY;
  let accessToken = '';
  try {
    const { data } = window.HZsupa?.auth?.getSession
      ? await window.HZsupa.auth.getSession()
      : { data: null };
    accessToken = data?.session?.access_token || '';
  } catch {}
  if (accessToken) headers.Authorization = 'Bearer ' + accessToken;
  else if (!requireOwner && window.HZ_ANON_KEY) headers.Authorization = 'Bearer ' + window.HZ_ANON_KEY;
  else throw new Error('Sign in as the gym owner to manage Square.');
  return headers;
}

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
          headers: await squareAdminHeaders(false),
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
          ...(await squareAdminHeaders(true)),
          'Content-Type': 'application/json',
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
      headers: await squareAdminHeaders(false),
    });
    const data = await refreshed.json();
    if (refreshed.ok) setState(prev => ({ ...prev, loading: false, data }));
  }

  async function onDisconnect() {
    if (!confirm('Disconnect Square from this program?')) return;
    await call('disconnect');
    setFlash({ kind: 'info', text: 'Square has been disconnected for this program.' });
    const res = await fetch(`${window.HZ_FN_BASE}/functions/v1/square-admin-v1?program_id=${encodeURIComponent(programRef.program_id || '')}&program_slug=${encodeURIComponent(programRef.program_slug || '')}`, {
      headers: await squareAdminHeaders(false),
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

// ─── Owner Profile / Account hub ───
// Plain-language home for gym owners: change your password, walk through
// connecting Square, and see your account at a glance. Shows up in the
// owner sidebar as "My Account" so it's the first thing a brand-new owner
// sees on first login.
function OwnerProfile({ snap, session, navigate }) {
  const profile = session.profile || {};
  const userMeta = (session.user && session.user.user_metadata) || {};
  const mustChangePassword = userMeta.must_change_password === true;
  const firstName = (profile.display_name || profile.email || 'there').split(' ')[0];
  const program = (snap.programs || []).find(p => p.id === profile.program_id);
  const programName = window.HZprogramDisplayName ? window.HZprogramDisplayName(program, 'your gym') : (program?.brand_name || program?.public_name || program?.name || 'your gym');
  const programRef = { program_id: profile.program_id, program_slug: program?.slug || 'mca' };

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <div className="hz-eyebrow" style={{ marginBottom: 10 }}>Account · {programName}</div>
        <div className="hz-display" style={{ fontSize: 56, lineHeight: 0.95 }}>
          Hey {firstName}.<br/>Let's get you <span className="hz-zero">set up</span>.
        </div>
        <div style={{ color: 'var(--hz-dim)', fontSize: 14, marginTop: 14, maxWidth: 640, lineHeight: 1.5 }}>
          Two quick things on first login: change your password, then connect Square so the gym can take real payments through Hit Zero.
        </div>
      </div>

      {mustChangePassword && (
        <div style={{
          marginBottom: 20, padding: '14px 18px', borderRadius: 12,
          border: '1px solid rgba(255,180,84,0.35)', background: 'rgba(255,180,84,0.08)',
          color: 'var(--hz-amber)', fontSize: 13, lineHeight: 1.5,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <HZIcon name="bolt" size={16}/>
          <div><strong>You're using a default password.</strong> Change it below before you do anything else — it takes 30 seconds.</div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 20, marginBottom: 24 }}>
        <AccountInfoCard profile={profile} session={session} program={program}/>
        <ChangePasswordCard session={session} userMeta={userMeta}/>
      </div>

      {['parent', 'athlete'].includes(profile.role) && window.FamilyInfoPacketCard && (
        <div style={{ marginBottom: 24 }}>
          <window.FamilyInfoPacketCard session={session} program={program}/>
        </div>
      )}

      <SquareSetupWizard programRef={programRef} programName={programName} navigate={navigate}/>

      <div style={{ marginTop: 28, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="hz-btn hz-btn-ghost" onClick={() => navigate('billing')}>Open Billing →</button>
        <button className="hz-btn hz-btn-ghost" onClick={() => navigate('admin')}>Open Program →</button>
        <button
          className="hz-btn hz-btn-ghost"
          onClick={async () => {
            if (!confirm('Sign out of Hit Zero?')) return;
            try { await window.HZsupa.auth.signOut(); } catch {}
            try { await window.HZdb.auth.signOut(); } catch {}
            location.reload();
          }}
        >Sign out</button>
      </div>
    </div>
  );
}
window.OwnerProfile = OwnerProfile;

function AccountInfoCard({ profile, session, program }) {
  const email = profile.email || session.user?.email || '—';
  const initials = (profile.display_name || '?').split(' ').map(s => s[0]).slice(0,2).join('').toUpperCase();
  const programName = window.HZprogramDisplayName ? window.HZprogramDisplayName(program, 'your gym') : (program?.brand_name || program?.public_name || program?.name || 'your gym');
  return (
    <div className="hz-card">
      <div className="hz-eyebrow" style={{ marginBottom: 12 }}>Account</div>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 16 }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--hz-teal), var(--hz-pink))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--hz-display)', fontSize: 22, fontWeight: 700, color: 'white',
        }}>{initials}</div>
        <div>
          <div className="hz-display" style={{ fontSize: 22 }}>{profile.display_name || 'Owner'}</div>
          <div style={{ color: 'var(--hz-dim)', fontSize: 12.5 }}>Gym Owner · {programName}</div>
        </div>
      </div>
      <div style={{ display: 'grid', gap: 8, fontSize: 13 }}>
        <Row label="Email" value={email}/>
        <Row label="Role" value="Owner"/>
        <Row label="Program" value={program?.name || profile.program_id?.slice(0,8) || '—'}/>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0', borderBottom: '1px solid var(--hz-line)' }}>
      <span style={{ color: 'var(--hz-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 11, fontWeight: 700 }}>{label}</span>
      <span style={{ fontFamily: 'var(--hz-mono)', fontSize: 12.5, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</span>
    </div>
  );
}

function ChangePasswordCard({ session, userMeta }) {
  const [next, setNext] = React.useState('');
  const [confirm, setConfirm] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [flash, setFlash] = React.useState(null);

  async function submit(e) {
    e.preventDefault();
    setFlash(null);
    if (next.length < 8) { setFlash({ kind: 'error', text: 'Use at least 8 characters.' }); return; }
    if (next !== confirm) { setFlash({ kind: 'error', text: 'The two passwords don\'t match.' }); return; }
    setBusy(true);
    try {
      const cleared = { ...(userMeta || {}), must_change_password: false };
      const { error } = await window.HZsupa.auth.updateUser({ password: next, data: cleared });
      if (error) throw error;
      setFlash({ kind: 'success', text: 'Password updated. You\'re all set.' });
      setNext(''); setConfirm('');
    } catch (e) {
      setFlash({ kind: 'error', text: e.message || 'Could not update password.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="hz-card">
      <div className="hz-eyebrow" style={{ marginBottom: 12 }}>Password</div>
      <div className="hz-display" style={{ fontSize: 22, marginBottom: 6 }}>Change your password.</div>
      <div style={{ color: 'var(--hz-dim)', fontSize: 12.5, lineHeight: 1.5, marginBottom: 14 }}>
        At least 8 characters. Pick something only you would know.
      </div>
      <form onSubmit={submit} style={{ display: 'grid', gap: 10 }}>
        <input
          className="hz-input"
          type="password"
          placeholder="New password"
          autoComplete="new-password"
          value={next}
          onChange={e => setNext(e.target.value)}
          disabled={busy}
          style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--hz-line)', background: 'rgba(255,255,255,0.04)', color: 'var(--hz-fg)', fontSize: 14 }}
        />
        <input
          className="hz-input"
          type="password"
          placeholder="Confirm new password"
          autoComplete="new-password"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          disabled={busy}
          style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--hz-line)', background: 'rgba(255,255,255,0.04)', color: 'var(--hz-fg)', fontSize: 14 }}
        />
        <button className="hz-btn hz-btn-primary" type="submit" disabled={busy || !next || !confirm}>
          {busy ? 'Saving…' : 'Save new password'}
        </button>
      </form>
      {flash && (
        <div style={{
          marginTop: 12, padding: '10px 12px', borderRadius: 10,
          border: '1px solid ' + (flash.kind === 'success' ? 'rgba(63,231,160,0.25)' : 'rgba(255,94,108,0.3)'),
          background: flash.kind === 'success' ? 'rgba(63,231,160,0.08)' : 'rgba(255,94,108,0.08)',
          color: flash.kind === 'success' ? 'var(--hz-green)' : 'var(--hz-red)',
          fontSize: 12.5,
        }}>{flash.text}</div>
      )}
    </div>
  );
}

// Step-by-step Square connect wizard. Wraps the same square-admin-v1
// endpoints SquareBillingPanel uses, but presents a friendlier first-run
// experience: explain → connect → verify, then collapse to a status card
// that points at the existing Billing screen for ongoing management.
function SquareSetupWizard({ programRef, programName = 'the gym', navigate }) {
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
          ? `Square connected. ${programName} can take real payments through Hit Zero.`
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
          headers: await squareAdminHeaders(false),
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
        headers: { ...(await squareAdminHeaders(true)), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          program_id: programRef.program_id,
          program_slug: programRef.program_slug,
          return_to: `${window.location.origin}/#profile`,
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
    try {
      const out = await call('connect_url');
      if (out?.url) window.location.href = out.url;
    } catch {}
  }

  const data = state.data || {};
  const conn = data.connection;
  const isConnected = conn?.status === 'connected';
  const isConfigured = !!data.configured;

  return (
    <div className="hz-card" style={{ position: 'relative', overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', top: 0, right: 0, width: 240, height: 240,
        background: 'radial-gradient(circle at top right, rgba(63,231,160,0.12), transparent 60%)',
        pointerEvents: 'none',
      }}/>
      <div className="hz-eyebrow" style={{ marginBottom: 10 }}>Step 2 · Take payments</div>
      <div className="hz-display" style={{ fontSize: 30, marginBottom: 8 }}>
        Connect <span className="hz-zero">Square</span>.
      </div>
      <div style={{ color: 'var(--hz-dim)', fontSize: 13.5, lineHeight: 1.55, maxWidth: 640, marginBottom: 18 }}>
        Square is the gym's payment processor. Once you connect the Square account, families can pay tuition with a card and every payment shows up on Hit Zero next to the right athlete.
      </div>

      {flash && (
        <div style={{
          marginBottom: 16, padding: '12px 14px', borderRadius: 10,
          border: '1px solid ' + (flash.kind === 'success' ? 'rgba(63,231,160,0.25)' : flash.kind === 'error' ? 'rgba(255,94,108,0.3)' : 'rgba(255,180,84,0.25)'),
          background: flash.kind === 'success' ? 'rgba(63,231,160,0.08)' : flash.kind === 'error' ? 'rgba(255,94,108,0.08)' : 'rgba(255,180,84,0.08)',
          color: flash.kind === 'success' ? 'var(--hz-green)' : flash.kind === 'error' ? 'var(--hz-red)' : 'var(--hz-amber)',
          fontSize: 12.5, position: 'relative',
        }}>{flash.text}</div>
      )}

      {state.loading && (
        <div style={{ color: 'var(--hz-dim)', fontSize: 13 }}>Checking your Square setup…</div>
      )}

      {!state.loading && !isConfigured && (
        <div style={{ position: 'relative', padding: 16, borderRadius: 12, border: '1px solid rgba(255,180,84,0.25)', background: 'rgba(255,180,84,0.06)' }}>
          <div style={{ color: 'var(--hz-amber)', fontWeight: 600, marginBottom: 6 }}>Platform setup pending</div>
          <div style={{ color: 'var(--hz-dim)', fontSize: 12.5, lineHeight: 1.5 }}>
            Andrew is finishing the Square app credentials on the platform side. The connect button will turn on as soon as that's in place — usually a couple minutes. Refresh this page when he gives the all-clear.
          </div>
        </div>
      )}

      {!state.loading && isConfigured && !isConnected && (
        <div style={{ position: 'relative' }}>
          <ol style={{ listStyle: 'none', padding: 0, margin: '0 0 18px 0', display: 'grid', gap: 12 }}>
            <WizardStep n={1} title="Click the green button below."
              body="It opens Square's secure sign-in page in this same window."/>
            <WizardStep n={2} title="Sign in with the gym's Square account."
              body="Use the same login Brynn or Carissa already use to view payouts. If you don't have one yet, Square will let you create it on that page."/>
            <WizardStep n={3} title="Approve the connection."
              body="Square will ask if you want to share customers, invoices, and payments with Hit Zero. Click 'Allow.' Square sends you back here automatically."/>
            <WizardStep n={4} title="Done — pull your first sync."
              body="Hit Zero will show your Square merchant + locations. From Billing, click 'Sync now' to pull existing customers and invoices in."/>
          </ol>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              className="hz-btn hz-btn-primary"
              onClick={onConnect}
              disabled={state.busy}
              style={{ background: 'linear-gradient(135deg, #3FE7A0, #27CFD7)', border: 'none', color: '#04111A', fontWeight: 700, padding: '12px 22px', fontSize: 14 }}
            >
              {state.busy ? 'Opening Square…' : 'Connect Square →'}
            </button>
            <a
              href="https://squareup.com/login"
              target="_blank" rel="noopener noreferrer"
              style={{ color: 'var(--hz-dim)', fontSize: 12.5, textDecoration: 'underline' }}
            >Don't have a Square account yet?</a>
          </div>
        </div>
      )}

      {!state.loading && isConnected && (
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(63,231,160,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <HZIcon name="check" size={18} color="var(--hz-green)"/>
            </div>
            <div>
              <div style={{ color: 'var(--hz-green)', fontWeight: 700, fontSize: 14 }}>Connected to Square</div>
              <div style={{ color: 'var(--hz-dim)', fontSize: 12.5 }}>{conn.external_business_name || `${programName} Square seller`} · {conn.environment}</div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, marginBottom: 18 }}>
            <MiniStat label="Last sync" value={conn.last_sync_completed_at ? new Date(conn.last_sync_completed_at).toLocaleString() : 'Not yet'} sub={conn.last_sync_status || 'idle'}/>
            <MiniStat label="Location" value={conn.external_location_id ? conn.external_location_id.slice(-6) : '—'} sub="primary location"/>
            <MiniStat label="Permissions" value={String((conn.scopes || []).length)} sub="scopes granted"/>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="hz-btn hz-btn-primary" onClick={() => navigate('billing')}>Manage in Billing →</button>
            <button className="hz-btn" onClick={onConnect} disabled={state.busy}>Reconnect Square</button>
          </div>
        </div>
      )}

      {state.error && !state.loading && (
        <div style={{ marginTop: 14, color: 'var(--hz-red)', fontSize: 12.5 }}>{state.error}</div>
      )}
    </div>
  );
}

function WizardStep({ n, title, body }) {
  return (
    <li style={{ display: 'flex', gap: 14, padding: 14, borderRadius: 12, border: '1px solid var(--hz-line)', background: 'rgba(255,255,255,0.02)' }}>
      <div style={{
        flexShrink: 0, width: 32, height: 32, borderRadius: '50%',
        background: 'linear-gradient(135deg, var(--hz-teal), var(--hz-pink))',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'white', fontWeight: 700, fontSize: 14, fontFamily: 'var(--hz-display)',
      }}>{n}</div>
      <div>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{title}</div>
        <div style={{ color: 'var(--hz-dim)', fontSize: 12.5, lineHeight: 1.5 }}>{body}</div>
      </div>
    </li>
  );
}
