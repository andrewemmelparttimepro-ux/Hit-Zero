// HIT ZERO — App shell. iPhone frame, status bar, bottom tab, admin drawer (left).
// All screens mount inside <HZShell>.

const HZ_TABS = {
  coach: [
    { id: 'today',    label: 'Today',   icon: 'home' },
    { id: 'roster',   label: 'Roster',  icon: 'users' },
    { id: 'routine',  label: 'Routine', icon: 'routine' },
    { id: 'score',    label: 'Score',   icon: 'score' },
  ],
  athlete: [
    { id: 'reel',     label: 'Reel',    icon: 'video' },
    { id: 'skills',   label: 'Skills',  icon: 'skill' },
    { id: 'team',     label: 'Team',    icon: 'users' },
    { id: 'today',    label: 'Today',   icon: 'calendar' },
  ],
  parent: [
    { id: 'today',    label: 'Today',   icon: 'home' },
    { id: 'progress', label: 'Progress',icon: 'skill' },
    { id: 'reel',     label: 'Reel',    icon: 'video' },
    { id: 'bills',    label: 'Bills',   icon: 'dollar' },
  ],
  owner: [
    { id: 'today',    label: 'Today',   icon: 'home' },
    { id: 'roster',   label: 'Roster',  icon: 'users' },
    { id: 'routine',  label: 'Routine', icon: 'routine' },
    { id: 'score',    label: 'Score',   icon: 'score' },
  ],
};

function HZShell({ children, tab, onTab }) {
  const [state, setState] = React.useState(window.HZStore.get());
  React.useEffect(() => window.HZStore.subscribe(setState), []);
  const tabs = HZ_TABS[state.role] || HZ_TABS.coach;

  return (
    <div style={{
      width: 402, height: 874, borderRadius: 48, overflow: 'hidden', position: 'relative',
      background: '#050507', boxShadow: '0 40px 80px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.06)',
      fontFamily: 'var(--hz-sans)',
    }}>
      {/* dynamic island */}
      <div style={{ position: 'absolute', top: 11, left: '50%', transform: 'translateX(-50%)', width: 126, height: 37, borderRadius: 24, background: '#000', zIndex: 50 }} />

      {/* status bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '19px 32px 0', color: '#fff', fontSize: 15, fontWeight: 600, pointerEvents: 'none' }}>
        <span style={{ letterSpacing: '-0.01em' }}>9:41</span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <svg width="18" height="11" viewBox="0 0 18 11"><rect x="0" y="7" width="3" height="4" rx="0.6" fill="#fff"/><rect x="4.5" y="5" width="3" height="6" rx="0.6" fill="#fff"/><rect x="9" y="2.5" width="3" height="8.5" rx="0.6" fill="#fff"/><rect x="13.5" y="0" width="3" height="11" rx="0.6" fill="#fff"/></svg>
          <svg width="26" height="12" viewBox="0 0 26 12"><rect x="0.5" y="0.5" width="22" height="11" rx="3" stroke="#fff" strokeOpacity="0.4" fill="none"/><rect x="2" y="2" width="19" height="8" rx="1.5" fill="#fff"/></svg>
        </div>
      </div>

      {/* admin drawer trigger — LEFT edge, tiny, almost invisible */}
      <button
        onClick={() => window.HZStore.toggleAdmin()}
        aria-label="Admin"
        style={{
          position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
          width: 14, height: 64, borderRadius: '0 8px 8px 0', border: 'none',
          background: 'rgba(255,255,255,0.04)', zIndex: 40, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 0,
        }}
      >
        <div style={{ width: 3, height: 28, borderRadius: 2, background: 'rgba(255,255,255,0.25)' }} />
      </button>

      {/* Admin drawer (left slide-in) */}
      <HZAdminDrawer open={state.adminOpen} />

      {/* content */}
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', paddingTop: 0 }}>
        <div className="hz-scroll" style={{ flex: 1, overflow: 'auto', paddingTop: 54 }}>
          {children}
          <div style={{ height: 110 }} />
        </div>
      </div>

      {/* bottom tab bar — glass */}
      <div style={{
        position: 'absolute', left: 16, right: 16, bottom: 18, zIndex: 30,
        height: 64, borderRadius: 32, overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(10,10,14,0.72)', backdropFilter: 'blur(20px) saturate(160%)', WebkitBackdropFilter: 'blur(20px) saturate(160%)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 32 }} />
        <div style={{ position: 'relative', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '0 8px' }}>
          {tabs.map(t => {
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => onTab(t.id)} className="hz-nosel" style={{
                flex: 1, height: 48, border: 'none', background: 'transparent', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                color: active ? '#fff' : 'rgba(255,255,255,0.45)', gap: 2, transition: 'all 0.2s',
                padding: 0,
              }}>
                <window.HZIcon name={t.icon} size={22} color={active ? (t.id === 'score' || t.id === 'skills' ? 'var(--hz-pink)' : 'var(--hz-teal)') : 'currentColor'} stroke={active ? 2 : 1.75}/>
                <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* home indicator */}
      <div style={{ position: 'absolute', bottom: 6, left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 60, pointerEvents: 'none' }}>
        <div style={{ width: 139, height: 5, borderRadius: 100, background: 'rgba(255,255,255,0.4)' }} />
      </div>
    </div>
  );
}

// ── Admin drawer ───────────────────────────────────────────────────────────
function HZAdminDrawer({ open }) {
  const [state, setState] = React.useState(window.HZStore.get());
  React.useEffect(() => window.HZStore.subscribe(setState), []);

  return (
    <>
      {/* dim overlay */}
      <div
        onClick={() => window.HZStore.toggleAdmin()}
        style={{
          position: 'absolute', inset: 0, zIndex: 45,
          background: 'rgba(0,0,0,0.55)',
          opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 0.3s',
        }}
      />
      {/* panel */}
      <div style={{
        position: 'absolute', top: 0, bottom: 0, left: 0, width: 320, zIndex: 46,
        background: '#0A0A0B',
        borderRight: '1px solid rgba(255,255,255,0.08)',
        transform: open ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1)',
        display: 'flex', flexDirection: 'column',
        paddingTop: 50,
      }}>
        <div style={{ padding: '24px 24px 16px' }}>
          <div className="hz-eyebrow" style={{ color: 'var(--hz-teal)' }}>Admin · Don't need this often</div>
          <div style={{ height: 8 }} />
          <window.HZWordmark size={34} />
          <div style={{ height: 4 }} />
          <div className="hz-eyebrow" style={{ color: 'rgba(255,255,255,0.45)' }}>Magic City Allstars · Minot, ND</div>
        </div>

        <div style={{ padding: '0 24px 8px' }}>
          <div className="hz-eyebrow" style={{ marginBottom: 10 }}>View as</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {['coach','athlete','parent','owner'].map(r => {
              const active = state.role === r;
              return (
                <button key={r} onClick={() => window.HZStore.setRole(r)}
                  style={{
                    padding: '12px 14px', borderRadius: 12, cursor: 'pointer',
                    border: active ? '1px solid var(--hz-teal)' : '1px solid rgba(255,255,255,0.08)',
                    background: active ? 'rgba(39,207,215,0.1)' : 'rgba(255,255,255,0.03)',
                    color: active ? '#fff' : 'rgba(255,255,255,0.7)',
                    textAlign: 'left', fontFamily: 'var(--hz-sans)',
                  }}>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: active ? 'var(--hz-teal)' : 'rgba(255,255,255,0.4)' }}>Role</div>
                  <div style={{ fontSize: 15, fontWeight: 600, textTransform: 'capitalize', marginTop: 2 }}>{r}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="hz-scroll" style={{ flex: 1, overflow: 'auto', padding: '16px 0' }}>
          <AdminSection label="Program">
            <AdminRow label="Gym" value="Magic City Allstars"/>
            <AdminRow label="Teams" value="7 active"/>
            <AdminRow label="Athletes" value={`${state.roster.length} on Magic · 124 total`}/>
            <AdminRow label="Staff" value="4 coaches · 2 admin"/>
          </AdminSection>
          <AdminSection label="Billing">
            <AdminRow label="Monthly tuition" value="$400 · Senior 4"/>
            <AdminRow label="Outstanding" value="$5,700" emph="warn"/>
            <AdminRow label="This month" value="$48,000"/>
          </AdminSection>
          <AdminSection label="Data">
            <button onClick={() => { if (confirm('Reset prototype state?')) window.HZStore.reset(); }}
              style={{ width: '100%', padding: 12, borderRadius: 10, background: 'rgba(255,94,108,0.1)', color: 'var(--hz-red)', border: '1px solid rgba(255,94,108,0.2)', fontFamily: 'var(--hz-sans)', fontWeight: 600, fontSize: 13, cursor: 'pointer', marginLeft: 24, width: 'calc(100% - 48px)' }}>
              Reset prototype data
            </button>
          </AdminSection>
        </div>

        <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="hz-eyebrow">Hit Zero · v0.1 MVP</div>
          <div style={{ fontFamily: 'var(--hz-serif)', fontStyle: 'italic', fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>
            "Zero deductions. Zero drama. Zero excuses."
          </div>
        </div>
      </div>
    </>
  );
}

function AdminSection({ label, children }) {
  return (
    <div style={{ padding: '12px 0' }}>
      <div className="hz-eyebrow" style={{ padding: '0 24px 8px' }}>{label}</div>
      <div>{children}</div>
    </div>
  );
}
function AdminRow({ label, value, emph }) {
  const valColor = emph === 'warn' ? 'var(--hz-amber)' : '#fff';
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 24px', fontSize: 13 }}>
      <span style={{ color: 'rgba(255,255,255,0.55)' }}>{label}</span>
      <span style={{ color: valColor, fontWeight: 600 }}>{value}</span>
    </div>
  );
}

window.HZShell = HZShell;
window.HZ_TABS = HZ_TABS;
