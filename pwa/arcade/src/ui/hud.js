// DOM HUD: banner, presence pill, coach-present tag, mute + style + action
// buttons, toasts, photo flash, and the avatar customization panel.

import { SKINS, HAIR_COLORS, HAIR_STYLES, BOW_COLORS, UNIFORMS, sanitizeAvatar } from '../world/avatar.js';

export function createHud({ theme, sfx, onToggleMute, onAvatarChange }) {
  // ── top-right stack: presence pill, coach tag, mute ──
  const tr = document.createElement('div');
  tr.className = 'arc-hud-tr';
  document.body.appendChild(tr);

  const pill = document.createElement('div');
  pill.className = 'arc-pill';
  pill.innerHTML = '<span class="dot"></span><span class="txt">Connecting…</span>';
  tr.appendChild(pill);

  const coachTag = document.createElement('div');
  coachTag.className = 'arc-coach-tag';
  coachTag.style.display = 'none';
  coachTag.textContent = '👀 Coach is here';
  tr.appendChild(coachTag);

  const muteBtn = document.createElement('button');
  muteBtn.className = 'arc-icon-btn';
  muteBtn.textContent = '🔊';
  muteBtn.addEventListener('click', () => {
    const muted = onToggleMute();
    muteBtn.textContent = muted ? '🔇' : '🔊';
  });
  tr.appendChild(muteBtn);

  // ── persistent minimap (top-left) ──
  // Schematic top-down view in plain grid space: regions from the map spec,
  // live dots for you / teammates / Super Squad. Redrawn ~10Hz by main.
  const mini = document.createElement('div');
  mini.className = 'arc-minimap';
  const miniCanvas = document.createElement('canvas');
  mini.appendChild(miniCanvas);
  const miniLabel = document.createElement('div');
  miniLabel.className = 'arc-minimap-label';
  mini.appendChild(miniLabel);
  document.body.appendChild(mini);

  const MINI_W = 150;
  let miniDims = null;   // {cols, rows, W, H}
  let miniBase = null;   // prerendered regions+pois

  function resolveColor(c) { return c === 'accent' ? theme.accent : c; }

  function setMinimapScene(spec, cols, rows, label) {
    if (!spec) { mini.style.display = 'none'; miniBase = null; return; }
    mini.style.display = '';
    miniLabel.textContent = label || '';
    const H = Math.max(52, Math.round(MINI_W * (rows / cols)));
    miniDims = { cols, rows, W: MINI_W, H };
    miniCanvas.width = MINI_W * 2; miniCanvas.height = H * 2;
    miniCanvas.style.width = MINI_W + 'px'; miniCanvas.style.height = H + 'px';

    miniBase = document.createElement('canvas');
    miniBase.width = MINI_W * 2; miniBase.height = H * 2;
    const b = miniBase.getContext('2d');
    b.scale(2, 2);
    const sx = MINI_W / cols, sy = H / rows;
    for (const r of spec.regions) {
      b.fillStyle = resolveColor(r.color);
      b.fillRect(r.c0 * sx, r.r0 * sy, (r.c1 - r.c0 + 1) * sx, (r.r1 - r.r0 + 1) * sy);
    }
    for (const p of spec.pois || []) {
      b.fillStyle = resolveColor(p.color);
      b.beginPath();
      b.arc(p.c * sx, p.r * sy, 2.6, 0, Math.PI * 2);
      b.fill();
    }
  }

  const DOT_COLORS = { me: null /* accent */, peer: '#f4f4f8', npc: '#ffd166' };
  function updateMinimap(entities) {
    if (!miniBase || !miniDims) return;
    const ctx = miniCanvas.getContext('2d');
    ctx.clearRect(0, 0, miniCanvas.width, miniCanvas.height);
    ctx.drawImage(miniBase, 0, 0);
    ctx.save();
    ctx.scale(2, 2);
    const sx = miniDims.W / miniDims.cols, sy = miniDims.H / miniDims.rows;
    for (const e of entities) {
      const x = e.c * sx, y = e.r * sy;
      if (e.kind === 'me') {
        ctx.fillStyle = theme.accent;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      } else {
        ctx.fillStyle = DOT_COLORS[e.kind] || '#f4f4f8';
        ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
  }

  // ── banner (observer / offline) ──
  let banner = null;
  function setBanner(html) {
    if (banner) { banner.remove(); banner = null; }
    if (!html) return;
    banner = document.createElement('div');
    banner.className = 'arc-banner';
    banner.innerHTML = html;
    document.body.appendChild(banner);
  }

  // ── bottom-right action cluster (emote / phrase / style) ──
  const actions = document.createElement('div');
  actions.className = 'arc-actions';
  actions.innerHTML = `
    <button class="arc-act-btn style-btn" data-act="style" aria-label="Customize avatar">🎀<small>STYLE</small></button>
    <button class="arc-act-btn" data-act="phrase" aria-label="Say a phrase">💬<small>SAY</small></button>
    <button class="arc-act-btn" data-act="emote" aria-label="Emote">⭐<small>EMOTE</small></button>
  `;
  document.body.appendChild(actions);

  // ── toast ──
  let toastEl = null;
  function toast(msg) {
    if (toastEl) toastEl.remove();
    toastEl = document.createElement('div');
    toastEl.className = 'arc-toast';
    toastEl.textContent = msg;
    document.body.appendChild(toastEl);
    setTimeout(() => { toastEl?.remove(); toastEl = null; }, 2500);
  }

  // ── photo flash ──
  function flash() {
    const f = document.createElement('div');
    f.className = 'arc-flash';
    document.body.appendChild(f);
    setTimeout(() => f.remove(), 600);
  }

  // ── presence pill state ──
  function setPresence(state, count, observer = false) {
    const txt = pill.querySelector('.txt');
    pill.classList.toggle('offline', state !== 'live');
    if (state === 'live') {
      txt.textContent = count === 0
        ? (observer ? 'No athletes in the Arcade yet' : 'Just you — invite the team!')
        : `${count} ${observer ? 'athlete' : 'teammate'}${count === 1 ? '' : 's'} here`;
    } else if (state === 'offline') {
      txt.textContent = 'Offline preview';
    } else if (state === 'error') {
      txt.textContent = 'Reconnecting…';
    } else {
      txt.textContent = 'Connecting…';
    }
  }
  function setCoachHere(on) { coachTag.style.display = on ? '' : 'none'; }

  // ── avatar style panel ──
  // firstRun: shown automatically the first time a kid ever opens the
  // Arcade — same panel, warmer copy. Every tap auto-saves either way.
  let panel = null;
  function openStylePanel(current, { firstRun = false } = {}) {
    closeStylePanel();
    let cfg = sanitizeAvatar(current);
    panel = document.createElement('div');
    panel.className = 'arc-style-panel';

    const cssHex = (n) => '#' + n.toString(16).padStart(6, '0');
    const swatchRow = (label, colors, key, resolve) => {
      const row = document.createElement('div');
      row.className = 'arc-style-row';
      row.innerHTML = `<label>${label}</label>`;
      const wrap = document.createElement('div');
      wrap.className = 'arc-swatches';
      colors.forEach((c, i) => {
        const b = document.createElement('button');
        b.className = 'arc-swatch' + (cfg[key] === i ? ' sel' : '');
        b.style.background = resolve ? resolve(c, i) : cssHex(c);
        b.addEventListener('click', () => {
          cfg[key] = i;
          wrap.querySelectorAll('.arc-swatch').forEach((el, j) => el.classList.toggle('sel', j === i));
          onAvatarChange({ ...cfg });
          sfx.tap();
        });
        wrap.appendChild(b);
      });
      row.appendChild(wrap);
      return row;
    };

    panel.innerHTML = firstRun
      ? `<h3>Build your cheerleader! 🎀</h3><div class="sub">Pick your look — you can change it anytime from the STYLE button. Everything saves automatically.</div>`
      : `<h3>Your Look</h3><div class="sub">Changes save automatically — teammates see them live.</div>`;

    panel.appendChild(swatchRow('Skin tone', SKINS, 'skin'));

    // hair style chips
    const hs = document.createElement('div');
    hs.className = 'arc-style-row';
    hs.innerHTML = '<label>Hair style</label>';
    const hsWrap = document.createElement('div');
    hsWrap.className = 'arc-swatches';
    HAIR_STYLES.forEach((style) => {
      const chip = document.createElement('button');
      chip.className = 'arc-chip' + (cfg.hair === style ? ' sel' : '');
      chip.textContent = style[0].toUpperCase() + style.slice(1);
      chip.addEventListener('click', () => {
        cfg.hair = style;
        hsWrap.querySelectorAll('.arc-chip').forEach(el => el.classList.toggle('sel', el === chip));
        onAvatarChange({ ...cfg });
        sfx.tap();
      });
      hsWrap.appendChild(chip);
    });
    hs.appendChild(hsWrap);
    panel.appendChild(hs);

    panel.appendChild(swatchRow('Hair color', HAIR_COLORS, 'hairColor'));
    panel.appendChild(swatchRow('Bow', BOW_COLORS, 'bow',
      (c) => c === null ? `linear-gradient(120deg, ${theme.accent}, ${theme.accent2})` : cssHex(c)));
    panel.appendChild(swatchRow('Uniform', UNIFORMS, 'uniform',
      (u) => u === null
        ? `linear-gradient(120deg, #14141c 50%, ${theme.accent} 50%)`
        : `linear-gradient(120deg, ${cssHex(u[0])} 50%, ${cssHex(u[1])} 50%)`));

    const done = document.createElement('button');
    done.className = 'arc-style-done';
    done.textContent = firstRun ? "LET'S GO!" : 'DONE';
    done.addEventListener('click', closeStylePanel);
    panel.appendChild(done);

    document.body.appendChild(panel);
  }
  function closeStylePanel() { panel?.remove(); panel = null; }

  return {
    actions, toast, flash, setBanner, setPresence, setCoachHere,
    openStylePanel, closeStylePanel,
    setMinimapScene, updateMinimap,
    setMuteIcon(muted) { muteBtn.textContent = muted ? '🔇' : '🔊'; },
  };
}
