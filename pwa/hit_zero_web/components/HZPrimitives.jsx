// ─────────────────────────────────────────────────────────────────────────────
// HIT ZERO WEB — Shared UI primitives
// Wordmark, Icon, Avatar, StatTile, Pill, Dial, Section header
// ─────────────────────────────────────────────────────────────────────────────

const HZWordmark = ({ size = 22, stacked = false }) => {
  const s = { fontSize: size, lineHeight: stacked ? 0.82 : 0.9 };
  return (
    <div className="hz-nosel" style={{ display: 'inline-block' }}>
      <div className="hz-wordmark" style={s}>
        {stacked
          ? (<><div>HIT</div><div>ZER<span className="hz-zero">O</span></div></>)
          : (<span>HIT ZER<span className="hz-zero">O</span></span>)}
      </div>
    </div>
  );
};
window.HZWordmark = HZWordmark;

// ─── Icon set — 24x24 grid, 1.75 stroke ───
const HZIcon = ({ name, size = 18, color = 'currentColor', stroke = 1.75, fill }) => {
  const s = { width: size, height: size, display: 'inline-block', verticalAlign: '-0.15em', flex: 'none' };
  const C = { stroke: color, strokeWidth: stroke, strokeLinecap: 'round', strokeLinejoin: 'round', fill: fill || 'none' };
  switch (name) {
    case 'home':      return <svg style={s} viewBox="0 0 24 24"><path {...C} d="M3 11.5L12 4l9 7.5V20a1 1 0 01-1 1h-5v-6h-6v6H4a1 1 0 01-1-1v-8.5z"/></svg>;
    case 'today':     return <svg style={s} viewBox="0 0 24 24"><rect {...C} x="3" y="5" width="18" height="16" rx="2"/><path {...C} d="M3 10h18M8 3v4M16 3v4"/><circle {...C} cx="12" cy="15" r="2" fill={color}/></svg>;
    case 'roster':    return <svg style={s} viewBox="0 0 24 24"><circle {...C} cx="9" cy="8" r="3.5"/><path {...C} d="M3 21c0-3 3-5 6-5s6 2 6 5"/><circle {...C} cx="17" cy="10" r="2.5"/><path {...C} d="M15 21c0-2 2-4 4-4s2.5 1 2.5 2"/></svg>;
    case 'skills':    return <svg style={s} viewBox="0 0 24 24"><path {...C} d="M12 3v18M3 12h18M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg>;
    case 'routine':   return <svg style={s} viewBox="0 0 24 24"><path {...C} d="M4 5v14M9 5v14M14 5v14M19 5v14M4 12h15"/></svg>;
    case 'score':     return <svg style={s} viewBox="0 0 24 24"><path {...C} d="M4 20V8l8-4 8 4v12M4 20h16M10 14h4v6h-4z"/></svg>;
    case 'reel':      return <svg style={s} viewBox="0 0 24 24"><rect {...C} x="3" y="6" width="14" height="12" rx="2"/><path {...C} d="M17 10l4-2v8l-4-2"/></svg>;
    case 'billing':   return <svg style={s} viewBox="0 0 24 24"><rect {...C} x="3" y="6" width="18" height="12" rx="2"/><path {...C} d="M3 10h18"/><circle {...C} cx="7" cy="15" r="1" fill={color}/></svg>;
    case 'megaphone': return <svg style={s} viewBox="0 0 24 24"><path {...C} d="M3 11v2a2 2 0 002 2h1v4l3-1v-3l11 4V6L9 10H5a2 2 0 00-2 2z"/></svg>;
    case 'admin':     return <svg style={s} viewBox="0 0 24 24"><circle {...C} cx="12" cy="12" r="3"/><path {...C} d="M12 2v4M12 18v4M2 12h4M18 12h4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8"/></svg>;
    case 'search':    return <svg style={s} viewBox="0 0 24 24"><circle {...C} cx="11" cy="11" r="7"/><path {...C} d="M20 20l-3.5-3.5"/></svg>;
    case 'chev-right':return <svg style={s} viewBox="0 0 24 24"><path {...C} d="M9 6l6 6-6 6"/></svg>;
    case 'chev-left': return <svg style={s} viewBox="0 0 24 24"><path {...C} d="M15 6l-6 6 6 6"/></svg>;
    case 'chev-down': return <svg style={s} viewBox="0 0 24 24"><path {...C} d="M6 9l6 6 6-6"/></svg>;
    case 'chev-up':   return <svg style={s} viewBox="0 0 24 24"><path {...C} d="M18 15l-6-6-6 6"/></svg>;
    case 'check':     return <svg style={s} viewBox="0 0 24 24"><path {...C} d="M4 12l5 5L20 6"/></svg>;
    case 'x':         return <svg style={s} viewBox="0 0 24 24"><path {...C} d="M6 6l12 12M18 6L6 18"/></svg>;
    case 'plus':      return <svg style={s} viewBox="0 0 24 24"><path {...C} d="M12 5v14M5 12h14"/></svg>;
    case 'minus':     return <svg style={s} viewBox="0 0 24 24"><path {...C} d="M5 12h14"/></svg>;
    case 'bolt':      return <svg style={s} viewBox="0 0 24 24"><path {...C} fill={color} d="M13 2L4 14h6l-1 8 9-12h-6l1-8z"/></svg>;
    case 'star':      return <svg style={s} viewBox="0 0 24 24"><path {...C} fill={color} d="M12 3l2.8 6.1 6.7.6-5.1 4.5 1.5 6.5L12 17.3 6.1 20.7l1.5-6.5L2.5 9.7l6.7-.6L12 3z"/></svg>;
    case 'dollar':    return <svg style={s} viewBox="0 0 24 24"><path {...C} d="M12 3v18M16 7.5c-1-1-2.5-1.5-4-1.5-2.5 0-4 1.2-4 3s2 2.5 4 3 4 1.2 4 3-1.5 3-4 3c-1.7 0-3.5-.5-4.5-1.8"/></svg>;
    case 'fire':      return <svg style={s} viewBox="0 0 24 24"><path {...C} d="M12 3c.5 3 3 5 3 8a3 3 0 01-6 0c0-2 1-3 1-5M7 13c-1 2-1 4 0 6s4 3 7 1 3-5 2-7c-1 2-3 3-4 2s-1-3-1-5c-2 0-3 1-4 3z"/></svg>;
    case 'timer':     return <svg style={s} viewBox="0 0 24 24"><circle {...C} cx="12" cy="13" r="8"/><path {...C} d="M12 9v4l2.5 2.5M9 3h6"/></svg>;
    case 'users':     return <svg style={s} viewBox="0 0 24 24"><path {...C} d="M17 21v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2"/><circle {...C} cx="10" cy="8" r="4"/><path {...C} d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>;
    case 'arrow-right':return <svg style={s} viewBox="0 0 24 24"><path {...C} d="M5 12h14M13 5l7 7-7 7"/></svg>;
    case 'arrow-up':  return <svg style={s} viewBox="0 0 24 24"><path {...C} d="M12 19V5M5 12l7-7 7 7"/></svg>;
    case 'play':      return <svg style={s} viewBox="0 0 24 24"><path {...C} fill={color} d="M6 4v16l14-8z"/></svg>;
    case 'pause':     return <svg style={s} viewBox="0 0 24 24"><rect {...C} fill={color} x="6" y="4" width="4" height="16"/><rect {...C} fill={color} x="14" y="4" width="4" height="16"/></svg>;
    case 'print':     return <svg style={s} viewBox="0 0 24 24"><path {...C} d="M6 9V3h12v6M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect {...C} x="6" y="14" width="12" height="8"/></svg>;
    case 'flag':      return <svg style={s} viewBox="0 0 24 24"><path {...C} d="M4 21V4h9l2 2h5v9h-7l-2-2H6v8"/></svg>;
    case 'music':     return <svg style={s} viewBox="0 0 24 24"><path {...C} d="M9 18V5l12-2v13"/><circle {...C} cx="6" cy="18" r="3"/><circle {...C} cx="18" cy="16" r="3"/></svg>;
    case 'pyramid':   return <svg style={s} viewBox="0 0 24 24"><rect {...C} x="10" y="4" width="4" height="4"/><rect {...C} x="5" y="10" width="4" height="4"/><rect {...C} x="10" y="10" width="4" height="4"/><rect {...C} x="15" y="10" width="4" height="4"/><rect {...C} x="2" y="16" width="4" height="4"/><rect {...C} x="7" y="16" width="4" height="4"/><rect {...C} x="13" y="16" width="4" height="4"/><rect {...C} x="18" y="16" width="4" height="4"/></svg>;
    case 'trophy':    return <svg style={s} viewBox="0 0 24 24"><path {...C} d="M6 4h12v4a6 6 0 01-12 0V4zM4 4h2v3a2 2 0 01-2-2V4zM18 4h2v1a2 2 0 01-2 2V4zM9 15h6v6H9z"/></svg>;
    case 'calendar':  return <svg style={s} viewBox="0 0 24 24"><rect {...C} x="3" y="5" width="18" height="16" rx="2"/><path {...C} d="M3 10h18M8 3v4M16 3v4"/></svg>;
    case 'logout':    return <svg style={s} viewBox="0 0 24 24"><path {...C} d="M16 17l5-5-5-5M21 12H9M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/></svg>;
    case 'settings':  return <svg style={s} viewBox="0 0 24 24"><circle {...C} cx="12" cy="12" r="3"/><path {...C} d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>;
    case 'edit':      return <svg style={s} viewBox="0 0 24 24"><path {...C} d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path {...C} d="M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
    case 'trash':     return <svg style={s} viewBox="0 0 24 24"><path {...C} d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>;
    case 'clock':     return <svg style={s} viewBox="0 0 24 24"><circle {...C} cx="12" cy="12" r="9"/><path {...C} d="M12 7v5l3 2"/></svg>;
    case 'ellipsis':  return <svg style={s} viewBox="0 0 24 24"><circle {...C} cx="5" cy="12" r="1" fill={color}/><circle {...C} cx="12" cy="12" r="1" fill={color}/><circle {...C} cx="19" cy="12" r="1" fill={color}/></svg>;
    default:          return <svg style={s} viewBox="0 0 24 24"><circle {...C} cx="12" cy="12" r="8"/></svg>;
  }
};
window.HZIcon = HZIcon;

// ─── Avatar tile ───
const Avatar = ({ name, initials, color = '#27CFD7', size = 32, onClick, src }) => (
  <div
    className="avatar hz-nosel"
    onClick={onClick}
    title={name}
    style={{
      width: size,
      height: size,
      fontSize: size * 0.42,
      background: src ? 'rgba(255,255,255,0.05)' : color,
      cursor: onClick ? 'pointer' : 'default',
      overflow: 'hidden',
    }}
  >
    {src ? (
      <img
        src={src}
        alt={name ? `${name} profile` : 'Profile'}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
    ) : (
      initials || (name || '').split(' ').map(s => s[0]).slice(0,2).join('')
    )}
  </div>
);
window.Avatar = Avatar;

// ─── Pill ───
const Pill = ({ children, tone = 'default', style }) => (
  <span className={`hz-pill ${tone !== 'default' ? 'hz-pill-' + tone : ''}`} style={style}>{children}</span>
);
window.Pill = Pill;

// ─── StatTile ───
const StatTile = ({ label, value, sub, accent, size = 'md' }) => (
  <div className="stat-tile">
    <div className="stat-label">{label}</div>
    <div className="stat-value" style={{ fontSize: size === 'lg' ? 52 : size === 'md' ? 40 : 28, color: accent || '#fff' }}>
      {value}
    </div>
    {sub && <div style={{ marginTop: 6, color: 'var(--hz-dim)', fontSize: 12 }}>{sub}</div>}
  </div>
);
window.StatTile = StatTile;

// ─── Section heading — editorial ───
const SectionHeading = ({ eyebrow, title, trailing }) => (
  <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 20, gap: 20 }}>
    <div>
      {eyebrow && <div className="hz-eyebrow" style={{ marginBottom: 8 }}>{eyebrow}</div>}
      <div className="hz-display" style={{ fontSize: 42, color: '#fff' }}>{title}</div>
    </div>
    {trailing && <div>{trailing}</div>}
  </div>
);
window.SectionHeading = SectionHeading;

// ─── Dial (0-1 value) ───
const Dial = ({ value, size = 140, label, sub }) => (
  <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
    <div className="dial-ring" style={{ width: size, height: size, '--val': Math.max(0, Math.min(1, value)) }}>
      <div className="dial-value" style={{ fontSize: size * 0.28 }}>
        {Math.round(value * 100)}<span style={{ fontSize: size * 0.14, color: 'var(--hz-dim)' }}>%</span>
      </div>
    </div>
    {label && <div className="hz-eyebrow" style={{ marginTop: 12 }}>{label}</div>}
    {sub && <div style={{ color: 'var(--hz-dim)', fontSize: 12, marginTop: 4 }}>{sub}</div>}
  </div>
);
window.Dial = Dial;

// ─── Status chip for skill state ───
const StatusChip = ({ status, size = 'sm' }) => {
  const map = {
    none: { label: 'Not Started', bg: 'rgba(255,255,255,0.06)', fg: 'var(--hz-dim)' },
    working: { label: 'Working', bg: 'rgba(255,180,84,0.16)', fg: 'var(--hz-amber)' },
    got_it: { label: 'Got It', bg: 'rgba(39,207,215,0.18)', fg: 'var(--hz-teal)' },
    mastered: { label: 'Mastered', bg: 'linear-gradient(135deg, rgba(39,207,215,0.25), rgba(249,127,172,0.25))', fg: '#fff' },
  };
  const m = map[status] || map.none;
  const h = size === 'sm' ? 22 : 28;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: size === 'sm' ? '3px 10px' : '5px 14px',
      height: h, borderRadius: 999,
      background: m.bg, color: m.fg,
      fontSize: size === 'sm' ? 10 : 11,
      fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
    }}>{m.label}</span>
  );
};
window.StatusChip = StatusChip;

// ─── Toast system ───
const Toast = ({ toast, onClose }) => {
  React.useEffect(() => {
    const t = setTimeout(() => onClose(toast.id), toast.duration || 4000);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className={`toast ${toast.variant || ''}`}>
      <div style={{ flex: 1 }}>
        <div className="hz-eyebrow" style={{ color: toast.variant === 'mastered' ? 'var(--hz-pink)' : 'var(--hz-teal)' }}>{toast.eyebrow || 'Hit Zero'}</div>
        <div style={{ marginTop: 4, fontWeight: 600, fontSize: 14 }}>{toast.title}</div>
        {toast.body && <div style={{ marginTop: 2, color: 'var(--hz-dim)', fontSize: 12 }}>{toast.body}</div>}
      </div>
      <button onClick={() => onClose(toast.id)} className="hz-btn hz-btn-ghost hz-btn-xs">
        <HZIcon name="x" size={12} />
      </button>
    </div>
  );
};
window.Toast = Toast;

// ─── Empty state ───
const EmptyState = ({ icon = 'star', title, body, action }) => (
  <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--hz-dim)' }}>
    <div style={{ display: 'inline-flex', padding: 18, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', marginBottom: 16 }}>
      <HZIcon name={icon} size={28} color="var(--hz-dimmer)" />
    </div>
    <div className="hz-display" style={{ fontSize: 28, color: '#fff', marginBottom: 8 }}>{title}</div>
    {body && <div style={{ maxWidth: 360, margin: '0 auto', fontSize: 13 }}>{body}</div>}
    {action && <div style={{ marginTop: 20 }}>{action}</div>}
  </div>
);
window.EmptyState = EmptyState;
