// ─────────────────────────────────────────────────────────────────────────────
// HIT ZERO — Tiny icon set (inline SVG, no external deps)
// Hand-picked: only what the app actually uses. Each icon follows the same
// 24x24 grid, 1.75 stroke, round caps. Cheer-specific glyphs hand-drawn.
// ─────────────────────────────────────────────────────────────────────────────

const HZIcon = ({ name, size = 20, color = 'currentColor', stroke = 1.75, fill }) => {
  const s = { width: size, height: size, display: 'inline-block', verticalAlign: '-0.15em' };
  const common = { stroke: color, strokeWidth: stroke, strokeLinecap: 'round', strokeLinejoin: 'round', fill: fill || 'none' };
  switch (name) {
    case 'home':       return (<svg style={s} viewBox="0 0 24 24"><path {...common} d="M3 11.5L12 4l9 7.5V20a1 1 0 01-1 1h-5v-6h-6v6H4a1 1 0 01-1-1v-8.5z"/></svg>);
    case 'calendar':   return (<svg style={s} viewBox="0 0 24 24"><rect {...common} x="3" y="5" width="18" height="16" rx="2"/><path {...common} d="M3 10h18M8 3v4M16 3v4"/></svg>);
    case 'roster':     return (<svg style={s} viewBox="0 0 24 24"><circle {...common} cx="9" cy="8" r="3.5"/><path {...common} d="M3 21c0-3 3-5 6-5s6 2 6 5"/><circle {...common} cx="17" cy="10" r="2.5"/><path {...common} d="M15 21c0-2 2-4 4-4s2.5 1 2.5 2"/></svg>);
    case 'routine':    return (<svg style={s} viewBox="0 0 24 24"><path {...common} d="M4 5v14M9 5v14M14 5v14M19 5v14M4 12h15"/></svg>);
    case 'skill':      return (<svg style={s} viewBox="0 0 24 24"><path {...common} d="M12 3v18M3 12h18M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg>);
    case 'score':      return (<svg style={s} viewBox="0 0 24 24"><path {...common} d="M4 20V8l8-4 8 4v12M4 20h16M10 14h4v6h-4z"/></svg>);
    case 'video':      return (<svg style={s} viewBox="0 0 24 24"><rect {...common} x="3" y="6" width="14" height="12" rx="2"/><path {...common} d="M17 10l4-2v8l-4-2"/></svg>);
    case 'play':       return (<svg style={s} viewBox="0 0 24 24"><path {...common} fill={color} d="M6 4v16l14-8z"/></svg>);
    case 'pause':      return (<svg style={s} viewBox="0 0 24 24"><rect {...common} fill={color} x="6" y="4" width="4" height="16"/><rect {...common} fill={color} x="14" y="4" width="4" height="16"/></svg>);
    case 'chev-right': return (<svg style={s} viewBox="0 0 24 24"><path {...common} d="M9 6l6 6-6 6"/></svg>);
    case 'chev-left':  return (<svg style={s} viewBox="0 0 24 24"><path {...common} d="M15 6l-6 6 6 6"/></svg>);
    case 'chev-down':  return (<svg style={s} viewBox="0 0 24 24"><path {...common} d="M6 9l6 6 6-6"/></svg>);
    case 'check':      return (<svg style={s} viewBox="0 0 24 24"><path {...common} d="M4 12l5 5L20 6"/></svg>);
    case 'x':          return (<svg style={s} viewBox="0 0 24 24"><path {...common} d="M6 6l12 12M18 6L6 18"/></svg>);
    case 'plus':       return (<svg style={s} viewBox="0 0 24 24"><path {...common} d="M12 5v14M5 12h14"/></svg>);
    case 'minus':      return (<svg style={s} viewBox="0 0 24 24"><path {...common} d="M5 12h14"/></svg>);
    case 'bolt':       return (<svg style={s} viewBox="0 0 24 24"><path {...common} fill={color} d="M13 2L4 14h6l-1 8 9-12h-6l1-8z"/></svg>);
    case 'star':       return (<svg style={s} viewBox="0 0 24 24"><path {...common} fill={color} d="M12 3l2.8 6.1 6.7.6-5.1 4.5 1.5 6.5L12 17.3 6.1 20.7l1.5-6.5L2.5 9.7l6.7-.6L12 3z"/></svg>);
    case 'dollar':     return (<svg style={s} viewBox="0 0 24 24"><path {...common} d="M12 3v18M16 7.5c-1-1-2.5-1.5-4-1.5-2.5 0-4 1.2-4 3s2 2.5 4 3 4 1.2 4 3-1.5 3-4 3c-1.7 0-3.5-.5-4.5-1.8"/></svg>);
    case 'settings':   return (<svg style={s} viewBox="0 0 24 24"><circle {...common} cx="12" cy="12" r="3"/><path {...common} d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>);
    case 'fire':       return (<svg style={s} viewBox="0 0 24 24"><path {...common} d="M12 3c.5 3 3 5 3 8a3 3 0 01-6 0c0-2 1-3 1-5M7 13c-1 2-1 4 0 6s4 3 7 1 3-5 2-7c-1 2-3 3-4 2s-1-3-1-5c-2 0-3 1-4 3z"/></svg>);
    case 'timer':      return (<svg style={s} viewBox="0 0 24 24"><circle {...common} cx="12" cy="13" r="8"/><path {...common} d="M12 9v4l2.5 2.5M9 3h6"/></svg>);
    case 'users':      return (<svg style={s} viewBox="0 0 24 24"><path {...common} d="M17 21v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2"/><circle {...common} cx="10" cy="8" r="4"/><path {...common} d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>);
    case 'arrow-right':return (<svg style={s} viewBox="0 0 24 24"><path {...common} d="M5 12h14M13 5l7 7-7 7"/></svg>);
    case 'search':     return (<svg style={s} viewBox="0 0 24 24"><circle {...common} cx="11" cy="11" r="7"/><path {...common} d="M20 20l-3.5-3.5"/></svg>);
    case 'hamburger':  return (<svg style={s} viewBox="0 0 24 24"><path {...common} d="M4 6h16M4 12h16M4 18h16"/></svg>);
    case 'flag':       return (<svg style={s} viewBox="0 0 24 24"><path {...common} d="M4 21V4h9l2 2h5v9h-7l-2-2H6v8"/></svg>);
    case 'mic':        return (<svg style={s} viewBox="0 0 24 24"><rect {...common} x="9" y="3" width="6" height="12" rx="3"/><path {...common} d="M5 11a7 7 0 0014 0M12 18v3"/></svg>);
    case 'music':      return (<svg style={s} viewBox="0 0 24 24"><path {...common} d="M9 18V5l12-2v13"/><circle {...common} cx="6" cy="18" r="3"/><circle {...common} cx="18" cy="16" r="3"/></svg>);
    // cheer-specific: megaphone (from the logo)
    case 'megaphone':  return (<svg style={s} viewBox="0 0 24 24"><path {...common} d="M3 11v2a2 2 0 002 2h1v4l3-1v-3l11 4V6L9 10H5a2 2 0 00-2 2z"/></svg>);
    // cheer: pyramid stack
    case 'pyramid':    return (<svg style={s} viewBox="0 0 24 24"><rect {...common} x="10" y="4" width="4" height="4"/><rect {...common} x="5" y="10" width="4" height="4"/><rect {...common} x="10" y="10" width="4" height="4"/><rect {...common} x="15" y="10" width="4" height="4"/><rect {...common} x="2" y="16" width="4" height="4"/><rect {...common} x="7" y="16" width="4" height="4"/><rect {...common} x="13" y="16" width="4" height="4"/><rect {...common} x="18" y="16" width="4" height="4"/></svg>);
    default:           return (<svg style={s} viewBox="0 0 24 24"><circle {...common} cx="12" cy="12" r="8"/></svg>);
  }
};

window.HZIcon = HZIcon;
