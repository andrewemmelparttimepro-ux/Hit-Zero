// DOM HUD: banner, presence pill, coach-present tag, mute + style + action
// buttons, toasts, photo flash, and the avatar customization panel.

import {
  SKINS, HAIR_COLORS, HAIR_STYLES, BOW_SHAPES, BOW_COLORS, UNIFORMS,
  CAPES, TRAILS, NAMEPLATES, COSMETIC_LABELS, createAvatar, sanitizeAvatar,
} from '../world/avatar.js';
import {
  LOOT_ITEMS, MILESTONES, POM_POM_PRIZES, RARITY_LABEL, sanitizeProgress,
  spiritStars, totalFound, SPIRIT_SECONDS_PER_STAR,
} from '../world/loot.js';

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
    <button class="arc-act-btn style-btn" data-act="style" aria-label="Open avatar closet">🎀<small>CLOSET</small></button>
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

  // ── Character Studio ──
  // firstRun: shown automatically the first time a kid ever opens the Arcade.
  // Every tap auto-saves either way, using the same avatar rig as the world.
  let panel = null;
  let panelCleanup = null;

  // The preview Pixi app is created ONCE and reused for every studio open.
  // Destroying an Application corrupts Pixi 8.19's shared batcher pool and
  // throws "Cannot read properties of null (reading 'clear')" in the WORLD
  // app's next render pass — so we park it (stop ticker, detach canvas)
  // instead of destroying it.
  let studioAppPromise = null;
  function getStudioApp() {
    if (!studioAppPromise) {
      studioAppPromise = (async () => {
        const app = new PIXI.Application();
        await app.init({
          width: 168, height: 220, backgroundAlpha: 0,
          antialias: true, resolution: Math.min(2, window.devicePixelRatio || 1), autoDensity: true,
        });
        return app;
      })();
    }
    return studioAppPromise;
  }

  function openStylePanel(current, { firstRun = false, unlocks = null, progress = null } = {}) {
    closeStylePanel();
    let cfg = sanitizeAvatar(current);
    const prog = sanitizeProgress(progress);
    let activeTab = 'base';
    let previewAvatar = null;
    let previewApp = null;

    panel = document.createElement('div');
    panel.className = 'arc-style-panel';

    const cssHex = (n) => '#' + n.toString(16).padStart(6, '0');
    const canUse = (slot, index) => {
      if (index === 0) return true;
      const allowed = unlocks?.allowed?.[slot];
      if (!allowed) return false;
      return Array.isArray(allowed) ? allowed.includes(index) : allowed.has?.(index);
    };
    const lockReason = (slot, index) =>
      unlocks?.reasons?.[slot]?.[index] || 'Unlock from skill progress';
    const progressCopy = (() => {
      const treasure = `${totalFound(prog)} 💎 · ${spiritStars(prog)} ⭐`;
      if (!unlocks?.loaded) return `Skill unlocks are unavailable right now. Free looks still save. ${treasure}`;
      const s = unlocks.stats || {};
      return `${s.mastered || 0} mastered · ${s.solid || 0} solid skills · Pom-Pom best ${prog.games.pomPom.best || 0} · ${treasure}`;
    })();

    panel.innerHTML = `
      <div class="arc-studio-head">
        <div>
          <h3>${firstRun ? 'Build your cheerleader!' : 'Character Studio'}</h3>
          <div class="sub">${firstRun ? 'Pick a look, then come back anytime from CLOSET.' : 'Changes save automatically and teammates see them live.'}</div>
        </div>
        <button class="arc-studio-close" type="button" aria-label="Close Character Studio">&times;</button>
      </div>
      <div class="arc-studio-body">
        <div class="arc-studio-preview">
          <div class="arc-preview-stage"></div>
          <div class="arc-preview-title">Live Preview</div>
          <div class="arc-preview-progress">${escapeHtml(progressCopy)}</div>
        </div>
        <div class="arc-studio-edit">
          <div class="arc-studio-tabs" role="tablist"></div>
          <div class="arc-studio-content"></div>
        </div>
      </div>
      <button class="arc-style-done" type="button">${firstRun ? "LET'S GO!" : 'DONE'}</button>
    `;

    const closeBtn = panel.querySelector('.arc-studio-close');
    closeBtn.addEventListener('click', closeStylePanel);
    panel.querySelector('.arc-style-done').addEventListener('click', closeStylePanel);
    document.body.appendChild(panel);

    const previewHost = panel.querySelector('.arc-preview-stage');
    const content = panel.querySelector('.arc-studio-content');
    const tabs = panel.querySelector('.arc-studio-tabs');

    let previewTick = null;
    async function mountPreview() {
      const app = await getStudioApp();
      if (!panel || !previewHost.isConnected) return; // closed while loading
      previewApp = app;
      previewHost.appendChild(app.canvas);
      previewAvatar = createAvatar({ config: cfg, name: 'You', team: '', theme, isSelf: true });
      previewAvatar.container.position.set(84, 178);
      previewAvatar.container.scale.set(1.14);
      app.stage.addChild(previewAvatar.container);
      previewTick = (t) => previewAvatar?.update(Math.min(0.05, t.deltaMS / 1000));
      app.ticker.add(previewTick);
      app.ticker.start();
    }
    mountPreview();

    panelCleanup = () => {
      // park the shared app — never destroy it (see getStudioApp note)
      if (previewApp) {
        if (previewTick) { previewApp.ticker.remove(previewTick); previewTick = null; }
        if (previewAvatar) {
          previewApp.stage.removeChild(previewAvatar.container);
          previewAvatar.container.destroy({ children: true });
        }
        previewApp.ticker.stop();
        previewApp.canvas.remove();
        previewApp = null;
      }
      previewAvatar = null;
    };

    function updatePreview() { previewAvatar?.setConfig(cfg); }

    function choose(key, value) {
      cfg = sanitizeAvatar({ ...cfg, [key]: value });
      onAvatarChange({ ...cfg });
      updatePreview();
      sfx.tap();
      renderTab(activeTab);
    }

    function colorRow(label, values, key, resolve) {
      const row = document.createElement('div');
      row.className = 'arc-style-row';
      row.innerHTML = `<label>${label}</label>`;
      const wrap = document.createElement('div');
      wrap.className = 'arc-swatches';
      values.forEach((c, i) => {
        const b = document.createElement('button');
        b.className = 'arc-swatch' + (cfg[key] === i ? ' sel' : '');
        b.style.background = resolve ? resolve(c, i) : cssHex(c);
        b.title = COSMETIC_LABELS[key]?.[i] || label;
        b.addEventListener('click', () => choose(key, i));
        wrap.appendChild(b);
      });
      row.appendChild(wrap);
      return row;
    }

    function chipRow(label, values, key, labels = values) {
      const row = document.createElement('div');
      row.className = 'arc-style-row';
      row.innerHTML = `<label>${label}</label>`;
      const wrap = document.createElement('div');
      wrap.className = 'arc-chip-grid';
      values.forEach((value, i) => {
        const b = document.createElement('button');
        b.className = 'arc-chip' + (cfg[key] === value ? ' sel' : '');
        b.textContent = labels[i];
        b.addEventListener('click', () => choose(key, value));
        wrap.appendChild(b);
      });
      row.appendChild(wrap);
      return row;
    }

    function specialGrid(label, slot, values, resolve) {
      const row = document.createElement('div');
      row.className = 'arc-style-row';
      row.innerHTML = `<label>${label}</label>`;
      const wrap = document.createElement('div');
      wrap.className = 'arc-special-grid';
      values.forEach((value, i) => {
        const allowed = canUse(slot, i);
        const b = document.createElement('button');
        b.className = 'arc-special-card' + (cfg[slot] === i ? ' sel' : '') + (!allowed ? ' locked' : '');
        b.type = 'button';
        b.disabled = !allowed;
        const swatch = resolve ? resolve(value, i) : null;
        b.innerHTML = `
          <span class="arc-special-swatch" style="${swatch ? `background:${swatch}` : ''}">${slot === 'trail' && i > 0 ? '*' : ''}</span>
          <span class="arc-special-copy">
            <strong>${escapeHtml(COSMETIC_LABELS[slot][i])}</strong>
            <small>${allowed ? (i === 0 ? 'Always available' : 'Unlocked') : escapeHtml(lockReason(slot, i))}</small>
          </span>
        `;
        b.addEventListener('click', () => choose(slot, i));
        wrap.appendChild(b);
      });
      row.appendChild(wrap);
      return row;
    }

    const tabDefs = [
      { id: 'base', label: 'Base' },
      { id: 'bow', label: 'Bows' },
      { id: 'uniform', label: 'Uniforms' },
      { id: 'special', label: 'Closet' },
      { id: 'loot', label: 'Treasures' },
    ];
    tabDefs.forEach((tab) => {
      const b = document.createElement('button');
      b.className = 'arc-studio-tab';
      b.type = 'button';
      b.textContent = tab.label;
      b.addEventListener('click', () => renderTab(tab.id));
      tabs.appendChild(b);
    });

    function renderTab(id) {
      activeTab = id;
      tabs.querySelectorAll('.arc-studio-tab').forEach((b) => b.classList.toggle('sel', b.textContent === tabDefs.find(t => t.id === id)?.label));
      content.innerHTML = '';
      if (id === 'base') {
        content.appendChild(colorRow('Skin tone', SKINS, 'skin'));
        content.appendChild(chipRow('Hair style', HAIR_STYLES, 'hair', COSMETIC_LABELS.hair));
        content.appendChild(colorRow('Hair color', HAIR_COLORS, 'hairColor'));
      } else if (id === 'bow') {
        content.appendChild(chipRow('Bow shape', BOW_SHAPES.map((_, i) => i), 'bowShape', COSMETIC_LABELS.bowShape));
        content.appendChild(colorRow('Bow color', BOW_COLORS, 'bow',
          (c) => c === null ? `linear-gradient(120deg, ${theme.accent}, ${theme.accent2})` : cssHex(c)));
      } else if (id === 'uniform') {
        content.appendChild(colorRow('Uniform colorway', UNIFORMS, 'uniform',
          (u) => u === null
            ? `linear-gradient(120deg, #14141c 50%, ${theme.accent} 50%)`
            : `linear-gradient(120deg, ${cssHex(u[0])} 50%, ${cssHex(u[1])} 50%)`));
      } else if (id === 'special') {
        content.appendChild(specialGrid('Capes', 'cape', CAPES,
          (c, i) => i === 0 ? 'rgba(255,255,255,0.06)' : cssHex(c ?? theme.accentNum)));
        content.appendChild(specialGrid('Trails', 'trail', TRAILS,
          (_, i) => ['rgba(255,255,255,0.06)', '#ffd166', theme.accent2, '#b387ff', '#ff4f79'][i]));
        content.appendChild(specialGrid('Nameplates', 'nameplate', NAMEPLATES,
          (_, i) => ['rgba(255,255,255,0.06)', '#ffd166', theme.accent2, '#ffffff', theme.accent, '#ffd166'][i]));
      } else {
        renderTreasures();
      }
    }

    // ── Treasure Bag: everything found in Cheer Town + Spirit Star time ──
    function renderTreasures() {
      const stars = spiritStars(prog);
      const found = totalFound(prog);
      const mins = Math.floor((prog.playSeconds || 0) / 60);
      const toNext = Math.ceil((SPIRIT_SECONDS_PER_STAR - ((prog.playSeconds || 0) % SPIRIT_SECONDS_PER_STAR)) / 60);

      const stats = document.createElement('div');
      stats.className = 'arc-style-row';
      stats.innerHTML = `
        <label>Treasure Bag</label>
        <div class="arc-loot-stats">
          <span>💎 <strong>${found}</strong> treasures found</span>
          <span>⭐ <strong>${stars}</strong> Spirit Stars</span>
          <span>⏱️ <strong>${mins}</strong> min played · next ⭐ in ~${toNext} min</span>
        </div>
      `;
      content.appendChild(stats);

      const itemsRow = document.createElement('div');
      itemsRow.className = 'arc-style-row';
      itemsRow.innerHTML = '<label>Collection</label>';
      const grid = document.createElement('div');
      grid.className = 'arc-special-grid';
      for (const it of LOOT_ITEMS) {
        const count = prog.found?.[it.id] || 0;
        const card = document.createElement('div');
        card.className = 'arc-special-card arc-loot-card' + (count === 0 ? ' locked' : '');
        card.innerHTML = count > 0
          ? `
            <span class="arc-special-swatch">${it.emoji}</span>
            <span class="arc-special-copy">
              <strong>${escapeHtml(it.name)} ×${count}</strong>
              <small>${escapeHtml(RARITY_LABEL[it.rarity] || '')}</small>
            </span>`
          : `
            <span class="arc-special-swatch">❓</span>
            <span class="arc-special-copy">
              <strong>???</strong>
              <small>Hidden somewhere in Cheer Town…</small>
            </span>`;
        grid.appendChild(card);
      }
      itemsRow.appendChild(grid);
      content.appendChild(itemsRow);

      const msRow = document.createElement('div');
      msRow.className = 'arc-style-row';
      msRow.innerHTML = '<label>Treasure Rewards</label>';
      const msGrid = document.createElement('div');
      msGrid.className = 'arc-special-grid';
      for (const m of MILESTONES) {
        const met = m.met(prog);
        const rewardName = COSMETIC_LABELS[m.slot]?.[m.index] || 'Reward';
        const card = document.createElement('div');
        card.className = 'arc-special-card arc-loot-card' + (met ? '' : ' locked');
        card.innerHTML = `
          <span class="arc-special-swatch">${met ? '🏅' : '🔒'}</span>
          <span class="arc-special-copy">
            <strong>${escapeHtml(rewardName)}</strong>
            <small>${met ? 'Unlocked! Grab it in the Unlocks tab' : escapeHtml(m.label)}</small>
          </span>`;
        msGrid.appendChild(card);
      }
      msRow.appendChild(msGrid);
      content.appendChild(msRow);

      const pomRow = document.createElement('div');
      pomRow.className = 'arc-style-row';
      pomRow.innerHTML = '<label>Pom-Pom Flight Prizes</label>';
      const pomGrid = document.createElement('div');
      pomGrid.className = 'arc-special-grid';
      const pomBest = prog.games.pomPom.best || 0;
      for (const prize of POM_POM_PRIZES) {
        const met = pomBest >= prize.minScore;
        const card = document.createElement('div');
        card.className = 'arc-special-card arc-loot-card' + (met ? '' : ' locked');
        card.innerHTML = `
          <span class="arc-special-swatch">${met ? 'PP' : prize.minScore}</span>
          <span class="arc-special-copy">
            <strong>${escapeHtml(prize.label)}</strong>
            <small>${met ? 'Won! Equip it in the Closet tab' : `Pass ${prize.minScore} consecutive gates`}</small>
          </span>`;
        pomGrid.appendChild(card);
      }
      pomRow.appendChild(pomGrid);
      content.appendChild(pomRow);
    }
    renderTab(activeTab);
  }

  function closeStylePanel() {
    panelCleanup?.();
    panelCleanup = null;
    panel?.remove();
    panel = null;
  }

  return {
    actions, toast, flash, setBanner, setPresence, setCoachHere,
    openStylePanel, closeStylePanel,
    setMinimapScene, updateMinimap,
    setMuteIcon(muted) { muteBtn.textContent = muted ? '🔇' : '🔊'; },
  };
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}
