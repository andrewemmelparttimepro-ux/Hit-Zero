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
    setMuteIcon(muted) { muteBtn.textContent = muted ? '🔇' : '🔊'; },
  };
}
