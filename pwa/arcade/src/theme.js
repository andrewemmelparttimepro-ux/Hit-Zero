// Program theming: gym name + accent colors pulled from the programs row.
// Falls back to Hit Zero house colors when offline / unreachable.

const HZ_DEFAULTS = {
  name: 'Hit Zero',
  accent: '#f97fac',   // HZ pink
  accent2: '#27cfd7',  // HZ teal
};

export async function loadTheme(supa, programId) {
  const theme = { ...HZ_DEFAULTS };
  if (supa && programId) {
    try {
      const { data } = await supa
        .from('programs')
        .select('name, public_name, brand_name, theme')
        .eq('id', programId)
        .maybeSingle();
      if (data) {
        theme.name = data.brand_name || data.public_name || data.name || theme.name;
        const colors = data.theme?.colors || {};
        if (isHex(colors.accent)) theme.accent = colors.accent;
        if (isHex(colors.primary)) theme.accent2 = colors.primary;
      }
    } catch { /* offline / RLS miss → defaults */ }
  }
  document.body.style.setProperty('--arc-accent', theme.accent);
  document.body.style.setProperty('--arc-accent-2', theme.accent2);
  theme.accentNum = hexNum(theme.accent);
  theme.accent2Num = hexNum(theme.accent2);
  return theme;
}

function isHex(v) { return typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v); }
function hexNum(v) { return parseInt(v.slice(1), 16); }
