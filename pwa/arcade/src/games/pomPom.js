// POM-POM — the right-cabinet cheer flight game.
//
// A complete, responsive Flappy-style solo loop built for touch first:
// tap/Space to fly, thread the Spirit Gates, chase medals and keep a durable
// personal best in arcade_profiles.progress (with the Arcade's local fallback).
// The character is a project-owned sprite derived from Andrew's supplied
// cheerleader reference. No extra WebGL context: this cabinet uses a small 2D
// canvas overlay and leaves the shared Pixi world untouched underneath.

import { POM_POM_PRIZES, POM_POM_GOODIES } from '../world/loot.js';

const ASSET_URL = new URL('../../assets/pom-pom-flyer.png', import.meta.url).href;
const FALLBACK_KEY = 'hz_arcade_pom_pom_record';
const GAME_KEY = 'pom_pom';

const DIFFICULTY_PHASES = [
  { min: 20, name: 'CHAMPION FLIGHT' },
  { min: 10, name: 'SPIRIT RUSH' },
  { min: 3, name: 'RALLY MODE' },
  { min: 0, name: 'WARM-UP' },
];

const MEDALS = [
  { min: 40, name: 'ROYAL CROWN', mark: '♛', tier: 'royal' },
  { min: 25, name: 'GOLD POM', mark: '★', tier: 'gold' },
  { min: 12, name: 'SILVER POM', mark: '✦', tier: 'silver' },
  { min: 5, name: 'BRONZE POM', mark: '◆', tier: 'bronze' },
  { min: 0, name: 'ROOKIE RIBBON', mark: '🎀', tier: 'rookie' },
];

const STREAK_MOMENTS = [
  { score: 3,  title: 'SPIRIT STREAK',   call: 'THREE CLEAN GATES',       presentation: 'compact',  duration: 900 },
  { score: 5,  title: 'RALLY ON',        call: 'THE TEAM IS WITH YOU',    presentation: 'sideline', duration: 1100 },
  { score: 8,  title: 'CROWD ROAR',      call: 'HIT IT · HOLD IT',        presentation: 'ribbon',   duration: 1200 },
  { score: 12, title: 'FULL-OUT ENERGY', call: 'OWN THE FLOOR',           presentation: 'trail',    duration: 1350 },
  { score: 20, title: 'CHAMPION FLIGHT', call: 'ZERO DEDUCTIONS',         presentation: 'full',     duration: 1800 },
  { score: 30, title: 'TOP FLYER',       call: 'THE GYM GOES WILD',       presentation: 'ribbon',   duration: 1250 },
].map((moment) => ({
  ...moment,
  prize: POM_POM_PRIZES.find((prize) => prize.minScore === moment.score) || null,
}));

export function medalFor(score) {
  const n = Math.max(0, Math.round(Number(score) || 0));
  return MEDALS.find((medal) => n >= medal.min) || MEDALS[MEDALS.length - 1];
}

// Exported for deterministic tuning checks. The first three points deliberately
// leave room to learn the tap rhythm; speed, gravity and gap pressure then ramp
// continuously instead of jumping to a punishing second mode.
export function difficultyFor(score, width, height) {
  const n = Math.max(0, Math.min(35, Math.round(Number(score) || 0)));
  const progress = n / 35;
  const W = Math.max(320, Number(width) || 320);
  const H = Math.max(420, Number(height) || 420);
  const phase = DIFFICULTY_PHASES.find((item) => n >= item.min) || DIFFICULTY_PHASES.at(-1);
  const baseGap = Math.max(178, Math.min(244, H * 0.35));
  const baseSpeed = Math.max(160, Math.min(238, W * 0.215));

  return {
    phase: phase.name,
    gravity: Math.max(940, H * 1.58) * (1 + progress * 0.22),
    flap: Math.max(322, H * (0.51 + progress * 0.07)),
    gap: Math.max(158, baseGap - progress * 58),
    speed: baseSpeed * (0.9 + progress * 0.34),
    spawnEvery: Math.max(1.3, 1.78 - n * 0.014),
  };
}

// Small milestones rotate through distinct cheer treatments. A true
// full-screen rally is deliberately rare: score 20, then each 50-gate mark.
export function rewardMomentFor(value) {
  const score = Math.max(0, Math.round(Number(value) || 0));
  const planned = STREAK_MOMENTS.find((moment) => moment.score === score);
  if (planned) return planned;
  if (score > 30 && score % 50 === 0) {
    return {
      score,
      title: 'LEGENDARY FLIGHT',
      call: 'THE WHOLE GYM ERUPTS',
      presentation: 'full',
      duration: 1800,
      prize: null,
    };
  }
  if (score > 30 && score % 10 === 0) {
    return {
      score,
      title: 'RALLY ROLLING',
      call: 'KEEP THE STREAK ALIVE',
      presentation: 'ribbon',
      duration: 1150,
      prize: null,
    };
  }
  return null;
}

export function createPomPom({
  mode, theme, sfx, audio, supa, profileId, programId, leaderboardEligible,
  getRecord, checkpointRun, recordRun, collectGoodie, openCloset, onOpenChange,
}) {
  const playable = mode === 'player' || mode === 'offline';
  const sprite = new Image();
  sprite.decoding = 'async';
  sprite.src = ASSET_URL;

  let root = null;
  let stage = null;
  let celebrationEl = null;
  let goodieToastEl = null;
  let canvas = null;
  let ctx = null;
  let raf = 0;
  let lastAt = 0;
  let W = 1;
  let H = 1;
  let dpr = 1;
  let state = 'closed'; // closed | menu | ready | playing | paused | gameover
  let resumeState = null;
  let score = 0;
  let record = readRecord();
  let gates = [];
  let goodies = [];
  let particles = [];
  let spawnIn = 0;
  let spawnedGates = 0;
  let nextGoodieGate = 4;
  let worldT = 0;
  let newBest = false;
  let resultTimer = null;
  let celebrationTimer = null;
  let goodieToastTimer = null;
  let leaderboardTimer = null;
  let autoPaused = false;
  let leaderboard = [];
  let leaderboardState = supa && programId ? 'loading' : 'offline';
  let postingState = 'idle';
  let runStartBest = record.best;
  let earnedRewards = [];
  let ownedGoodieIds = new Set(record.goodies || []);
  let flyer = { x: 0, y: 0, vy: 0, rotation: 0 };

  const clouds = [
    { x: 0.08, y: 0.18, s: 0.8, drift: 6 },
    { x: 0.52, y: 0.30, s: 1.15, drift: 10 },
    { x: 0.86, y: 0.12, s: 0.68, drift: 7 },
  ];
  const stars = Array.from({ length: 34 }, (_, i) => ({
    x: ((i * 47) % 101) / 100,
    y: (8 + ((i * 31) % 52)) / 100,
    r: 0.7 + (i % 4) * 0.35,
    p: i * 0.63,
  }));

  function open() {
    if (root) return;
    onOpenChange?.(true);
    record = readRecord();
    root = document.createElement('div');
    root.className = 'arc-game pom-game';
    root.dataset.state = 'menu';
    root.innerHTML = `
      <div class="arc-game-head">
        <div class="arc-game-title">POM-<b>POM</b><span class="arc-game-sub">SPIRIT FLIGHT</span></div>
        <div class="pom-head-actions">
          <button class="arc-game-close pom-pause-btn" type="button" aria-label="Pause game" hidden>Ⅱ</button>
          <button class="arc-game-close pom-exit-btn" type="button" aria-label="Exit game">✕</button>
        </div>
      </div>
      <div class="arc-game-stage pom-stage" data-testid="pom-pom-stage">
        <canvas class="pom-canvas" aria-label="Pom-Pom flight game"></canvas>
        <div class="pom-hud" aria-live="polite">
          <div class="pom-score" data-testid="pom-pom-score">0</div>
          <div class="pom-best">BEST <b>${record.best}</b></div>
          <div class="pom-phase" data-testid="pom-pom-phase">${phaseCopy(0)}</div>
        </div>
        <div class="pom-celebration" data-pom-celebration aria-live="polite" aria-atomic="true"></div>
        <div class="pom-goodie-toast" data-pom-goodie-toast aria-live="assertive" aria-atomic="true"></div>
        <div class="pom-screen"></div>
      </div>
    `;
    document.body.appendChild(root);
    stage = root.querySelector('.pom-stage');
    celebrationEl = root.querySelector('[data-pom-celebration]');
    goodieToastEl = root.querySelector('[data-pom-goodie-toast]');
    canvas = root.querySelector('.pom-canvas');
    ctx = canvas.getContext('2d', { alpha: false });

    root.querySelector('.pom-exit-btn').addEventListener('click', close);
    root.querySelector('.pom-pause-btn').addEventListener('click', togglePause);
    root.addEventListener('click', onButtonClick);
    stage.addEventListener('pointerdown', onStagePointer, { passive: false });
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', onVisibility);

    resize();
    showMenu();
    loadLeaderboard();
    lastAt = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function close() {
    if (!root) return;
    clearTimeout(resultTimer);
    clearTimeout(celebrationTimer);
    clearTimeout(goodieToastTimer);
    clearTimeout(leaderboardTimer);
    cancelAnimationFrame(raf);
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', resize);
    document.removeEventListener('visibilitychange', onVisibility);
    root.remove();
    root = null;
    stage = null;
    celebrationEl = null;
    goodieToastEl = null;
    canvas = null;
    ctx = null;
    state = 'closed';
    resumeState = null;
    onOpenChange?.(false);
  }

  function resize() {
    if (!stage || !canvas || !ctx) return;
    const rect = stage.getBoundingClientRect();
    W = Math.max(1, Math.round(rect.width));
    H = Math.max(1, Math.round(rect.height));
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (state === 'menu' || state === 'ready') resetFlyer();
  }

  function showMenu() {
    setState('menu');
    resetFlyer();
    gates = [];
    goodies = [];
    particles = [];
    dismissCelebration();
    dismissGoodieToast();
    score = 0;
    newBest = false;
    updateHud();
    const screen = screenEl();
    if (!playable) {
      screen.innerHTML = `
        <div class="pom-card">
          <div class="pom-lock-mark">👀</div>
          <h3>ATHLETES TAKE THE CONTROLS</h3>
          <p>Observers can watch the Arcade, but only an athlete can fly Pom-Pom.</p>
          <button class="arc-game-btn" data-pom="exit">BACK TO ARCADE</button>
        </div>`;
      return;
    }
    screen.innerHTML = `
      <div class="pom-menu-shell">
        <div class="pom-card pom-menu-card">
          <div class="pom-hero-wrap"><img src="${ASSET_URL}" alt="Pom-Pom, the flying cheerleader" /></div>
          <div class="pom-kicker">SPIRIT FLIGHT</div>
          <h3>POM-POM</h3>
          <p>Learn the rhythm through three roomy warm-up gates. Then watch for floating gear—some goodies dare you toward a gate's risky edge.</p>
          <div class="pom-menu-stats">
            <span><b>${record.best}</b> BEST</span>
            <span><b>${record.plays}</b> FLIGHTS</span>
          </div>
          <button class="arc-game-btn primary" data-pom="start" data-testid="pom-pom-start">TAP TO PLAY</button>
          <p class="pom-help">Touch, Space, or ↑ to fly · P to pause</p>
        </div>
        ${leaderboardMarkup()}
      </div>`;
  }

  function startRound() {
    if (!playable) return;
    clearTimeout(resultTimer);
    score = 0;
    newBest = false;
    runStartBest = record.best;
    earnedRewards = [];
    ownedGoodieIds = new Set(record.goodies || []);
    gates = [];
    goodies = [];
    particles = [];
    spawnedGates = 0;
    nextGoodieGate = 4 + Math.floor(Math.random() * 3);
    spawnIn = 0.78;
    postingState = 'idle';
    dismissCelebration();
    dismissGoodieToast();
    resetFlyer();
    updateHud();
    setState('ready');
    screenEl().innerHTML = `
      <div class="pom-ready" data-testid="pom-pom-ready">
        <strong>TAP TO FLY</strong>
        <span>First 3 gates are your warm-up</span>
      </div>`;
    sfx?.tap?.();
  }

  function beginFlight() {
    if (state !== 'ready') return;
    setState('playing');
    clearScreen();
    flap();
  }

  function flap() {
    if (state !== 'playing') return;
    flyer.vy = -difficultyFor(score, W, H).flap;
    flyer.rotation = -0.28;
    spray(flyer.x - characterSize() * 0.25, flyer.y + 4, 5, false);
    sfx?.flip?.();
    if (navigator.vibrate) {
      try { navigator.vibrate(8); } catch { /* optional */ }
    }
  }

  function crash() {
    if (state !== 'playing') return;
    setState('gameover');
    dismissCelebration();
    flyer.vy = Math.max(120, flyer.vy);
    flyer.rotation = 0.65;
    spray(flyer.x, flyer.y, 24, true);
    sfx?.missNote?.();
    if (navigator.vibrate) {
      try { navigator.vibrate([35, 45, 70]); } catch { /* optional */ }
    }
    const before = runStartBest;
    record = writeRecord(score);
    newBest = score > before;
    postingState = newBest
      ? (leaderboardEligible ? 'saving' : (supa ? 'practice' : 'offline'))
      : 'idle';
    if (newBest && leaderboardEligible) scheduleLeaderboardSync(score);
    updateHud();
    resultTimer = setTimeout(showResults, 430);
  }

  function showResults() {
    if (!root || state !== 'gameover') return;
    dismissGoodieToast();
    const medal = medalFor(score);
    const gearActions = earnedRewards.length && openCloset
      ? `
          <button class="arc-game-btn primary pom-equip-btn" data-pom="closet" data-testid="pom-pom-equip">VIEW &amp; EQUIP NEW GEAR</button>
          <button class="arc-game-btn" data-pom="again" data-testid="pom-pom-again">FLY AGAIN</button>`
      : '<button class="arc-game-btn primary" data-pom="again" data-testid="pom-pom-again">FLY AGAIN</button>';
    screenEl().innerHTML = `
      <div class="pom-results-shell">
        <div class="pom-card pom-results" data-testid="pom-pom-results">
          <div class="pom-result-kicker">${newBest ? 'NEW PERSONAL BEST!' : 'FLIGHT COMPLETE'}</div>
          <div class="pom-medal ${medal.tier}" aria-label="${medal.name}">
            <span>${medal.mark}</span><small>${medal.name}</small>
          </div>
          <div class="pom-result-grid">
            <div><span>SCORE</span><b>${score}</b></div>
            <div><span>BEST</span><b>${record.best}</b></div>
          </div>
          <div class="pom-next-medal">${nextMedalCopy(score)}</div>
          ${runPrizeMarkup()}
          <div class="pom-post-status ${postingState}" data-pom-post-status>${postingCopy()}</div>
          <div class="arc-game-btnrow">
            ${gearActions}
            <button class="arc-game-btn" data-pom="exit">EXIT</button>
          </div>
        </div>
        ${leaderboardMarkup()}
      </div>`;
  }

  function togglePause() {
    if (state === 'playing') {
      resumeState = 'playing';
      autoPaused = false;
      setState('paused');
      screenEl().innerHTML = `
        <div class="pom-pause-card">
          <strong>PAUSED</strong>
          <span>Your flight is safe.</span>
          <button class="arc-game-btn primary sm" data-pom="resume">KEEP FLYING</button>
        </div>`;
    } else if (state === 'paused') {
      setState(resumeState || 'playing');
      resumeState = null;
      autoPaused = false;
      clearScreen();
      lastAt = performance.now();
    }
  }

  function onVisibility() {
    if (document.hidden && state === 'playing') {
      resumeState = 'playing';
      autoPaused = true;
      setState('paused');
      screenEl().innerHTML = `
        <div class="pom-pause-card">
          <strong>PAUSED</strong>
          <span>Pom-Pom waited for you.</span>
          <button class="arc-game-btn primary sm" data-pom="resume">KEEP FLYING</button>
        </div>`;
    } else if (!document.hidden && state === 'paused' && autoPaused) {
      lastAt = performance.now();
    }
  }

  function onButtonClick(event) {
    const action = event.target.closest('[data-pom]')?.dataset.pom;
    if (!action) return;
    event.stopPropagation();
    audio?.unlock?.();
    if (action === 'start' || action === 'again') startRound();
    else if (action === 'resume') togglePause();
    else if (action === 'closet') openPrizeCloset();
    else if (action === 'exit') close();
  }

  function openPrizeCloset() {
    if (!openCloset) return;
    const rewards = earnedRewards.map((item) => ({ ...item }));
    close();
    openCloset(rewards);
  }

  function onStagePointer(event) {
    if (event.target.closest('button')) return;
    event.preventDefault();
    audio?.unlock?.();
    if (state === 'ready') beginFlight();
    else if (state === 'playing') flap();
  }

  function onKey(event) {
    if (!root) return;
    if (event.key === 'Escape') { close(); return; }
    if (event.key.toLowerCase() === 'p') { event.preventDefault(); togglePause(); return; }
    if (![' ', 'ArrowUp'].includes(event.key)) return;
    event.preventDefault();
    audio?.unlock?.();
    if (state === 'gameover' && earnedRewards.length && openCloset) openPrizeCloset();
    else if (state === 'menu' || state === 'gameover') startRound();
    else if (state === 'ready') beginFlight();
    else if (state === 'playing') flap();
  }

  function frame(now) {
    if (!root || !ctx) return;
    const dt = Math.min(0.033, Math.max(0, (now - lastAt) / 1000));
    lastAt = now;
    worldT += dt;
    if (state === 'playing') updatePlaying(dt);
    else if (state === 'gameover') updateCrash(dt);
    else updateParticles(dt);
    draw();
    raf = requestAnimationFrame(frame);
  }

  function updatePlaying(dt) {
    const difficulty = difficultyFor(score, W, H);
    flyer.vy += difficulty.gravity * dt;
    flyer.y += flyer.vy * dt;
    flyer.rotation = Math.min(0.78, flyer.rotation + dt * 1.7);

    // The warm-up teaches cadence without punishing an eager extra tap against
    // the ceiling. Ground and gate collisions remain live from the first frame.
    if (score < 3) {
      const warmupCeiling = characterSize() * 0.24 + 5;
      if (flyer.y < warmupCeiling) {
        flyer.y = warmupCeiling;
        flyer.vy = Math.max(36, flyer.vy);
      }
    }

    const speed = difficulty.speed;
    spawnIn -= dt;
    if (spawnIn <= 0) {
      spawnGate();
      spawnIn = difficulty.spawnEvery;
    }
    for (const gate of gates) {
      gate.x -= speed * dt;
      if (!gate.scored && gate.x + gate.w < flyer.x) {
        gate.scored = true;
        score += 1;
        updateHud();
        spray(flyer.x - 10, flyer.y, 10, true);
        pulseScore();
        sfx?.perfect?.();
        const moment = rewardMomentFor(score);
        if (moment) celebrateStreak(moment);
      }
    }
    for (const goodie of goodies) {
      goodie.x -= speed * dt;
      if (!goodie.collected && didCollectGoodie(goodie)) collectFlightGoodie(goodie);
    }
    gates = gates.filter((gate) => gate.x + gate.w > -24);
    goodies = goodies.filter((goodie) => !goodie.collected && goodie.x + goodie.radius > -24);
    updateParticles(dt);
    if (didCollide()) crash();
  }

  function updateCrash(dt) {
    const ground = groundY();
    flyer.vy += Math.max(900, H * 1.6) * dt;
    flyer.y = Math.min(ground - characterSize() * 0.28, flyer.y + flyer.vy * dt);
    flyer.rotation = Math.min(1.18, flyer.rotation + dt * 2.2);
    updateParticles(dt);
  }

  function updateParticles(dt) {
    for (const p of particles) {
      p.age += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.gravity * dt;
      p.rotation += p.spin * dt;
    }
    particles = particles.filter((p) => p.age < p.life);
  }

  function spawnGate() {
    const ground = groundY();
    const gateNumber = spawnedGates++;
    const gateLevel = gateNumber < 3 ? 0 : Math.max(score, gateNumber - 2);
    const gap = difficultyFor(gateLevel, W, H).gap;
    const minY = gap / 2 + 48;
    const maxY = ground - gap / 2 - 52;
    const wave = 0.5 + Math.sin(worldT * 1.37 + score * 0.71) * 0.24;
    const warmupBlend = gateNumber === 0 ? 0.84 : gateNumber === 1 ? 0.58 : gateNumber === 2 ? 0.32 : 0;
    const jitterRange = [8, 28, 50][gateNumber] ?? Math.min(90, H * 0.12);
    const jitter = (Math.random() - 0.5) * jitterRange;
    const proceduralY = minY + (maxY - minY) * wave + jitter;
    const gapY = Math.max(
      minY,
      Math.min(maxY, proceduralY * (1 - warmupBlend) + flyer.y * warmupBlend),
    );
    const gate = {
      x: W + Math.max(36, W * 0.06),
      y: gapY,
      gap,
      w: Math.max(72, Math.min(106, W * 0.13)),
      scored: false,
      palette: (score + gates.length) % 2,
    };
    gates.push(gate);
    maybeSpawnGoodie(gate, gateNumber);
  }

  function maybeSpawnGoodie(gate, gateNumber) {
    if (gateNumber < nextGoodieGate || ownedGoodieIds.size >= POM_POM_GOODIES.length) return;
    const activeIds = new Set(goodies.map((goodie) => goodie.item.id));
    const available = POM_POM_GOODIES.filter((item) => !ownedGoodieIds.has(item.id) && !activeIds.has(item.id));
    if (!available.length) return;
    const item = available[Math.floor(Math.random() * available.length)];
    const risky = Math.random() < 0.62;
    const edgeSign = Math.random() < 0.5 ? -1 : 1;
    const safeEdgeOffset = Math.max(24, gate.gap / 2 - characterSize() * 0.28 - 8);
    const baseY = risky
      ? gate.y + edgeSign * safeEdgeOffset
      : gate.y + (Math.random() - 0.5) * gate.gap * 0.16;
    goodies.push({
      item,
      x: gate.x + gate.w / 2,
      baseY,
      radius: Math.max(16, Math.min(21, W * 0.026)),
      risky,
      edgeSign,
      phase: Math.random() * Math.PI * 2,
      collected: false,
    });
    nextGoodieGate = gateNumber + 4 + Math.floor(Math.random() * 4);
  }

  function goodieY(goodie) {
    return goodie.baseY + Math.sin(worldT * 4.2 + goodie.phase) * 4;
  }

  function didCollectGoodie(goodie) {
    const dx = flyer.x - goodie.x;
    const dy = flyer.y - goodieY(goodie);
    const reach = goodie.radius + characterSize() * 0.1;
    return dx * dx + dy * dy <= reach * reach;
  }

  function collectFlightGoodie(goodie) {
    goodie.collected = true;
    ownedGoodieIds.add(goodie.item.id);
    if (!earnedRewards.some((reward) => reward.id === goodie.item.id)) earnedRewards.push(goodie.item);
    const saved = collectGoodie?.(goodie.item);
    if (saved) record = sanitizeRecord(saved);
    const y = goodieY(goodie);
    spray(goodie.x, y, 34, true);
    sfx?.score?.();
    if (navigator.vibrate) {
      try { navigator.vibrate([12, 24, 12]); } catch { /* optional */ }
    }
    showGoodieToast(goodie.item);
  }

  function didCollide() {
    const size = characterSize();
    const hit = {
      left: flyer.x - size * 0.27,
      right: flyer.x + size * 0.29,
      top: flyer.y - size * 0.23,
      bottom: flyer.y + size * 0.25,
    };
    if (hit.bottom >= groundY()) return true;
    if (hit.top <= 0) return score >= 3;
    for (const gate of gates) {
      if (hit.right <= gate.x + 5 || hit.left >= gate.x + gate.w - 5) continue;
      const gapTop = gate.y - gate.gap / 2;
      const gapBottom = gate.y + gate.gap / 2;
      if (hit.top < gapTop + 4 || hit.bottom > gapBottom - 4) return true;
    }
    return false;
  }

  function draw() {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    drawSky();
    drawClouds();
    drawCity();
    for (const gate of gates) drawGate(gate);
    for (const goodie of goodies) drawGoodie(goodie);
    drawParticles();

    if (state === 'menu') {
      flyer.x = W * 0.24;
      flyer.y = H * 0.45 + Math.sin(worldT * 2.5) * 12;
      flyer.rotation = Math.sin(worldT * 2.5) * 0.05;
    } else if (state === 'ready') {
      flyer.y = H * 0.43 + Math.sin(worldT * 3.2) * 10;
      flyer.rotation = Math.sin(worldT * 3.2) * 0.04;
    }
    drawFlyer();
    drawGround();
  }

  function drawSky() {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#09091d');
    grad.addColorStop(0.48, '#24183f');
    grad.addColorStop(0.78, '#5f2857');
    grad.addColorStop(1, '#f48ab8');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    for (const star of stars) {
      const alpha = 0.36 + 0.52 * Math.abs(Math.sin(worldT * 1.4 + star.p));
      ctx.globalAlpha = alpha;
      ctx.fillStyle = star.p % 2 > 1 ? '#74d7db' : '#ffffff';
      ctx.beginPath();
      ctx.arc(star.x * W, star.y * H, star.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    const moonX = W * 0.78;
    const moonY = H * 0.18;
    const glow = ctx.createRadialGradient(moonX, moonY, 4, moonX, moonY, 74);
    glow.addColorStop(0, 'rgba(255,239,177,0.65)');
    glow.addColorStop(1, 'rgba(255,239,177,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(moonX, moonY, 74, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff1bd';
    ctx.beginPath(); ctx.arc(moonX, moonY, 21, 0, Math.PI * 2); ctx.fill();
  }

  function drawClouds() {
    ctx.save();
    ctx.globalAlpha = 0.10;
    ctx.fillStyle = '#ffffff';
    for (const cloud of clouds) {
      const span = W + 220;
      const x = ((cloud.x * W - worldT * cloud.drift) % span + span) % span - 110;
      const y = cloud.y * H;
      const s = cloud.s * Math.max(0.75, Math.min(1.4, W / 700));
      ctx.beginPath();
      ctx.ellipse(x, y, 54 * s, 17 * s, 0, 0, Math.PI * 2);
      ctx.ellipse(x - 31 * s, y + 3 * s, 29 * s, 13 * s, 0, 0, Math.PI * 2);
      ctx.ellipse(x + 31 * s, y + 4 * s, 34 * s, 14 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawCity() {
    const ground = groundY();
    const base = ground - Math.max(45, H * 0.11);
    ctx.fillStyle = 'rgba(8,8,22,0.58)';
    ctx.beginPath();
    ctx.moveTo(0, ground);
    for (let x = -20; x <= W + 40; x += 54) {
      const h = 22 + ((Math.floor(x / 54) * 17 + 37) % 46);
      ctx.lineTo(x, base - h);
      ctx.lineTo(x + 43, base - h);
      ctx.lineTo(x + 43, ground);
    }
    ctx.lineTo(W, ground); ctx.closePath(); ctx.fill();

    // the lit gym anchors the world as a cheer destination, not a generic sky
    const gymW = Math.min(250, W * 0.33);
    const gymX = W * 0.58;
    ctx.fillStyle = 'rgba(16,18,39,0.88)';
    roundRect(ctx, gymX, base - 18, gymW, 64, 8); ctx.fill();
    ctx.fillStyle = '#ffd166';
    for (let i = 0; i < 4; i++) {
      roundRect(ctx, gymX + 15 + i * (gymW - 30) / 4, base - 4, 22, 18, 3); ctx.fill();
    }
    ctx.fillStyle = '#f97fac';
    ctx.font = `900 ${Math.max(9, Math.min(14, W * 0.018))}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('CHEER TOWN GYM', gymX + gymW / 2, base - 25);
  }

  function drawGate(gate) {
    const topEnd = gate.y - gate.gap / 2;
    const bottomStart = gate.y + gate.gap / 2;
    const ground = groundY();
    const primary = gate.palette ? '#74d7db' : '#f97fac';
    const dark = gate.palette ? '#2aa7b0' : '#c63f7d';
    drawGateTower(gate.x, 0, gate.w, topEnd, primary, dark, true);
    drawGateTower(gate.x, bottomStart, gate.w, ground - bottomStart, primary, dark, false);
  }

  function drawGoodie(goodie) {
    const y = goodieY(goodie);
    const pulse = 1 + Math.sin(worldT * 5 + goodie.phase) * 0.08;
    ctx.save();
    ctx.translate(goodie.x, y);
    ctx.scale(pulse, pulse);
    ctx.shadowColor = goodie.risky ? '#ff8fc4' : '#74d7db';
    ctx.shadowBlur = goodie.risky ? 24 : 17;
    const glow = ctx.createRadialGradient(0, 0, 3, 0, 0, goodie.radius + 9);
    glow.addColorStop(0, 'rgba(255,255,255,0.96)');
    glow.addColorStop(0.48, goodie.risky ? 'rgba(249,127,172,0.88)' : 'rgba(116,215,219,0.86)');
    glow.addColorStop(1, 'rgba(24,12,42,0.16)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, goodie.radius + 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#ffffff';
    ctx.globalAlpha = 0.82;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, goodie.radius + 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.font = `${Math.round(goodie.radius * 1.42)}px "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(goodie.item.emoji, 0, 1);
    if (goodie.risky) {
      ctx.fillStyle = '#ffd166';
      ctx.font = '900 8px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText('DARE', 0, -goodie.radius - 13);
    }
    ctx.restore();
  }

  function drawGateTower(x, y, w, h, primary, dark, upsideDown) {
    if (h <= 0) return;
    const capH = 24;
    const grad = ctx.createLinearGradient(x, 0, x + w, 0);
    grad.addColorStop(0, dark);
    grad.addColorStop(0.22, primary);
    grad.addColorStop(0.76, primary);
    grad.addColorStop(1, dark);
    ctx.fillStyle = grad;
    roundRect(ctx, x + 8, y, w - 16, h, 8); ctx.fill();

    ctx.globalAlpha = 0.22;
    ctx.fillStyle = '#ffffff';
    for (let sy = y + 15; sy < y + h - 8; sy += 34) {
      ctx.save(); ctx.translate(x + w / 2, sy); ctx.rotate(-0.35);
      ctx.fillRect(-w * 0.32, -3, w * 0.64, 6); ctx.restore();
    }
    ctx.globalAlpha = 1;

    const capY = upsideDown ? y + h - capH : y;
    ctx.fillStyle = primary;
    roundRect(ctx, x, capY, w, capH, 7); ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.globalAlpha = 0.58;
    ctx.lineWidth = 2;
    roundRect(ctx, x + 3, capY + 3, w - 6, capH - 6, 5); ctx.stroke();
    ctx.globalAlpha = 1;

    // centered spirit star on the gate lip
    drawStar(ctx, x + w / 2, capY + capH / 2, 5, 7, 3, '#ffd166');
  }

  function drawFlyer() {
    const size = characterSize();
    ctx.save();
    ctx.translate(flyer.x, flyer.y);
    ctx.rotate(flyer.rotation);
    const pulse = state === 'playing' ? 1 + Math.sin(worldT * 14) * 0.018 : 1;
    ctx.scale(pulse, pulse);
    if (sprite.complete && sprite.naturalWidth) {
      ctx.drawImage(sprite, -size / 2, -size / 2, size, size);
    } else {
      // Asset-loading fallback keeps the game playable even on a cold cache.
      ctx.fillStyle = '#f97fac';
      ctx.beginPath(); ctx.arc(0, 0, size * 0.25, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(-size * 0.27, 0, size * 0.16, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(size * 0.27, 0, size * 0.16, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function drawParticles() {
    for (const p of particles) {
      const k = p.age / p.life;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - k * k);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      if (p.star) drawStar(ctx, 0, 0, 5, p.size, p.size * 0.45, p.color);
      else {
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      }
      ctx.restore();
    }
  }

  function drawGround() {
    const y = groundY();
    const grad = ctx.createLinearGradient(0, y, 0, H);
    grad.addColorStop(0, '#171425');
    grad.addColorStop(1, '#080812');
    ctx.fillStyle = grad;
    ctx.fillRect(0, y, W, H - y);
    ctx.fillStyle = '#f97fac';
    ctx.fillRect(0, y, W, 4);
    ctx.fillStyle = '#74d7db';
    ctx.fillRect(0, y + 7, W, 2);
    ctx.globalAlpha = 0.12;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    const shift = (worldT * gateSpeed() * 0.45) % 42;
    for (let x = -42 + shift; x < W + 42; x += 42) {
      ctx.beginPath(); ctx.moveTo(x, H); ctx.lineTo(x + 34, y + 10); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function spray(x, y, count, celebratory) {
    const colors = ['#f97fac', '#74d7db', '#ffd166', '#ffffff', '#b387ff'];
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const speed = (celebratory ? 70 : 35) + Math.random() * (celebratory ? 150 : 75);
      particles.push({
        x, y,
        vx: Math.cos(a) * speed - (celebratory ? 0 : 55),
        vy: Math.sin(a) * speed - 35,
        gravity: 110 + Math.random() * 90,
        rotation: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 10,
        age: 0,
        life: 0.55 + Math.random() * 0.55,
        size: 3 + Math.random() * 4,
        color: colors[i % colors.length],
        star: celebratory && i % 3 === 0,
      });
    }
  }

  function celebrateStreak(moment) {
    if (!celebrationEl || !root) return;
    const newlyUnlocked = Boolean(moment.prize && runStartBest < moment.prize.minScore);
    if (newlyUnlocked) {
      const checkpoint = checkpointRun?.(score);
      if (checkpoint) record = sanitizeRecord(checkpoint);
      earnedRewards.push(moment.prize);
      updateHud();
    }

    clearTimeout(celebrationTimer);
    const rewardCopy = newlyUnlocked
      ? `${moment.prize.label} WON · NOW IN YOUR CLOSET`
      : moment.prize
        ? `${moment.prize.label} CHEER REWARD`
        : 'THE CROWD IS ON ITS FEET';
    const presentation = moment.presentation || 'compact';
    celebrationEl.className = `pom-celebration presentation-${presentation}`;
    celebrationEl.innerHTML = `
      ${presentation === 'full' ? '<div class="pom-celebration-glow"></div>' : ''}
      <div class="pom-celebration-rally">
        <img class="pom-celebration-flyer left" src="${ASSET_URL}" alt="" aria-hidden="true" />
        <div class="pom-celebration-copy">
          <span>${moment.score} GATE STREAK · ${moment.call}</span>
          <strong>${moment.title}</strong>
          <small>${rewardCopy}</small>
        </div>
        <img class="pom-celebration-flyer right" src="${ASSET_URL}" alt="" aria-hidden="true" />
      </div>`;
    celebrationEl.dataset.show = 'true';

    // Each cheer treatment has its own footprint and intensity. None changes
    // flyer physics, gate geometry, hitboxes, speed, or input cadence.
    if (presentation === 'compact') {
      spray(flyer.x + 24, flyer.y - 20, 14, true);
    } else if (presentation === 'sideline') {
      spray(W * 0.86, H * 0.68, 22, true);
    } else if (presentation === 'ribbon') {
      spray(W * 0.18, H * 0.78, 12, true);
      spray(W * 0.82, H * 0.78, 12, true);
    } else if (presentation === 'trail') {
      spray(flyer.x - 18, flyer.y + 4, 34, true);
    } else {
      spray(W * 0.12, H * 0.72, 28, true);
      spray(W * 0.88, H * 0.72, 28, true);
      sfx?.score?.();
    }
    if (navigator.vibrate && presentation === 'full') {
      try { navigator.vibrate([18, 35, 18]); } catch { /* optional */ }
    }
    celebrationTimer = setTimeout(dismissCelebration, moment.duration || 1000);
  }

  function dismissCelebration() {
    clearTimeout(celebrationTimer);
    if (!celebrationEl) return;
    delete celebrationEl.dataset.show;
    celebrationEl.className = 'pom-celebration';
    celebrationEl.innerHTML = '';
  }

  function showGoodieToast(item) {
    if (!goodieToastEl) return;
    clearTimeout(goodieToastTimer);
    goodieToastEl.innerHTML = `
      <span>${escapeHtml(item.emoji || '✦')}</span>
      <div><b>GOODIE FOUND!</b><strong>${escapeHtml(item.label)}</strong><small>YOURS NOW · VIEW &amp; EQUIP AFTER THIS FLIGHT</small></div>`;
    goodieToastEl.dataset.show = 'true';
    goodieToastTimer = setTimeout(dismissGoodieToast, 1900);
  }

  function dismissGoodieToast() {
    clearTimeout(goodieToastTimer);
    if (!goodieToastEl) return;
    delete goodieToastEl.dataset.show;
    goodieToastEl.innerHTML = '';
  }

  function resetFlyer() {
    flyer = { x: W * 0.27, y: H * 0.43, vy: 0, rotation: 0 };
  }

  function setState(next) {
    state = next;
    if (!root) return;
    root.dataset.state = next;
    root.classList.toggle('playing', next === 'playing');
    const pauseBtn = root.querySelector('.pom-pause-btn');
    if (pauseBtn) pauseBtn.hidden = !['playing', 'paused'].includes(next);
  }

  function clearScreen() {
    const screen = screenEl();
    if (screen) screen.innerHTML = '';
  }

  function screenEl() { return root?.querySelector('.pom-screen'); }

  function updateHud() {
    if (!root) return;
    const scoreEl = root.querySelector('.pom-score');
    const bestEl = root.querySelector('.pom-best b');
    const phaseEl = root.querySelector('.pom-phase');
    if (scoreEl) scoreEl.textContent = String(score);
    if (bestEl) bestEl.textContent = String(record.best);
    if (phaseEl) phaseEl.textContent = phaseCopy(score);
  }

  function pulseScore() {
    const el = root?.querySelector('.pom-score');
    if (!el) return;
    el.classList.remove('pop');
    void el.offsetWidth;
    el.classList.add('pop');
  }

  function phaseCopy(value) {
    if (value < 3) return `WARM-UP · ${3 - value} TO GO`;
    return difficultyFor(value, W, H).phase;
  }

  function leaderboardMarkup() {
    return `<section class="pom-board" data-pom-leaderboard aria-label="Pom-Pom gym leaderboard">
      ${leaderboardInnerMarkup()}
    </section>`;
  }

  function leaderboardInnerMarkup() {
    return `
      <div class="pom-board-top">
        <span>TOP FLYERS</span>
        <b>GYM TOP 10</b>
      </div>
      <div class="pom-board-columns"><span>RANK</span><span>PLAYER</span><span>GATES</span></div>
      <div class="pom-board-body">${leaderboardRowsMarkup()}</div>
      <div class="pom-board-foot">AUTO-POSTED PERSONAL BESTS</div>`;
  }

  function leaderboardRowsMarkup() {
    if (leaderboardState === 'loading') {
      return '<div class="pom-board-empty">READING THE GYM BOARD…</div>';
    }
    if (leaderboardState === 'offline') {
      return '<div class="pom-board-empty">SIGN IN AS AN ATHLETE<br>TO JOIN THE GYM BOARD</div>';
    }
    if (leaderboardState === 'error') {
      return '<div class="pom-board-empty">BOARD UNAVAILABLE<br>YOUR PERSONAL BEST STILL SAVES</div>';
    }
    if (!leaderboard.length) {
      return '<div class="pom-board-empty">NO ATHLETE SCORES YET<br>FIRST HIGH SCORE TAKES #1</div>';
    }
    return leaderboard.map((entry, index) => {
      const mine = entry.profile_id === profileId ? ' mine' : '';
      const rank = String(index + 1).padStart(2, '0');
      const gatesPassed = String(entry.score).padStart(3, '0');
      return `<div class="pom-board-row${mine}">
        <span class="pom-board-rank">${rank}</span>
        <span class="pom-board-name">${escapeHtml(entry.display_name)}</span>
        <b>${gatesPassed}</b>
      </div>`;
    }).join('');
  }

  function renderLeaderboard() {
    const board = root?.querySelector('[data-pom-leaderboard]');
    if (board) board.innerHTML = leaderboardInnerMarkup();
  }

  async function loadLeaderboard(expectedScore = null, attempt = 0) {
    if (!supa || !programId) {
      leaderboardState = 'offline';
      renderLeaderboard();
      return;
    }
    if (!leaderboard.length) leaderboardState = 'loading';
    renderLeaderboard();
    try {
      const { data, error } = await supa
        .from('arcade_high_scores')
        .select('profile_id, display_name, score, achieved_at')
        .eq('game_key', GAME_KEY)
        .eq('program_id', programId)
        .order('score', { ascending: false })
        .order('achieved_at', { ascending: true })
        .limit(10);
      if (error) throw error;
      leaderboard = (data || []).map((entry) => ({
        profile_id: String(entry.profile_id || ''),
        display_name: String(entry.display_name || 'PLAYER').slice(0, 80),
        score: Math.max(0, Math.min(9999, Math.round(Number(entry.score) || 0))),
      }));
      leaderboardState = 'ready';
      renderLeaderboard();

      if (expectedScore !== null && leaderboardEligible && profileId) {
        const { data: own, error: ownError } = await supa
          .from('arcade_high_scores')
          .select('score')
          .eq('game_key', GAME_KEY)
          .eq('profile_id', profileId)
          .maybeSingle();
        if (ownError) throw ownError;
        if (Number(own?.score) >= expectedScore) {
          postingState = 'posted';
          updatePostStatus();
        } else if (attempt < 2) {
          clearTimeout(leaderboardTimer);
          leaderboardTimer = setTimeout(
            () => loadLeaderboard(expectedScore, attempt + 1),
            900 + attempt * 800,
          );
        } else {
          postingState = 'queued';
          updatePostStatus();
        }
      }
    } catch (err) {
      console.warn('[pom-pom] leaderboard unavailable', err);
      leaderboardState = 'error';
      renderLeaderboard();
      if (expectedScore !== null) {
        postingState = 'queued';
        updatePostStatus();
      }
    }
  }

  function scheduleLeaderboardSync(expectedScore) {
    clearTimeout(leaderboardTimer);
    leaderboardTimer = setTimeout(() => loadLeaderboard(expectedScore, 0), 1250);
  }

  function updatePostStatus() {
    const status = root?.querySelector('[data-pom-post-status]');
    if (!status) return;
    status.className = `pom-post-status ${postingState}`;
    status.textContent = postingCopy();
  }

  function postingCopy() {
    if (postingState === 'saving') return 'SAVING TO THE GYM BOARD…';
    if (postingState === 'posted') return 'HIGH SCORE POSTED TO THE GYM BOARD';
    if (postingState === 'queued') return 'PERSONAL BEST SAVED · BOARD WILL RETRY';
    if (postingState === 'offline') return 'LOCAL PRACTICE · SIGN IN TO POST';
    if (postingState === 'practice') return 'PRACTICE RUN · ATHLETE HIGHS POST AUTOMATICALLY';
    return 'ATHLETE PERSONAL BESTS POST AUTOMATICALLY';
  }

  function runPrizeMarkup() {
    if (!earnedRewards.length) return '';
    const names = earnedRewards.map((prize) => escapeHtml(`${prize.emoji || '✦'} ${prize.label}`)).join(' · ');
    return `<div class="pom-run-prizes"><b>NEW GEAR READY TO EQUIP</b><span>${names}</span><small>Already saved to your Closet</small></div>`;
  }

  function readRecord() {
    try {
      const live = getRecord?.();
      if (live && typeof live === 'object') return sanitizeRecord(live);
      return sanitizeRecord(JSON.parse(localStorage.getItem(FALLBACK_KEY) || 'null'));
    } catch {
      return { best: 0, plays: 0, goodies: [] };
    }
  }

  function writeRecord(finalScore) {
    const cleanScore = Math.max(0, Math.round(Number(finalScore) || 0));
    try {
      const saved = recordRun?.(cleanScore);
      if (saved) return sanitizeRecord(saved);
    } catch (err) {
      console.warn('[pom-pom] profile record unavailable', err);
    }
    const fallback = {
      best: Math.max(record.best, cleanScore),
      plays: record.plays + 1,
      goodies: [...(record.goodies || [])],
    };
    try { localStorage.setItem(FALLBACK_KEY, JSON.stringify(fallback)); } catch { /* storage optional */ }
    return fallback;
  }

  function sanitizeRecord(value) {
    const best = Math.max(0, Math.min(9999, Math.round(Number(value?.best) || 0)));
    const plays = Math.max(0, Math.min(999999, Math.round(Number(value?.plays) || 0)));
    const knownGoodies = new Set(POM_POM_GOODIES.map((item) => item.id));
    const goodies = Array.isArray(value?.goodies)
      ? [...new Set(value.goodies.map(String).filter((id) => knownGoodies.has(id)))]
      : [];
    return { best, plays, goodies };
  }

  function nextMedalCopy(value) {
    const next = [...MEDALS].reverse().find((medal) => medal.min > value);
    if (!next) return 'You earned every Pom-Pom medal!';
    return `${next.min - value} more gate${next.min - value === 1 ? '' : 's'} to ${next.name}`;
  }

  function groundY() { return H - Math.max(58, Math.min(82, H * 0.105)); }
  function characterSize() { return Math.max(92, Math.min(132, W * 0.12, H * 0.19)); }
  function gateSpeed() { return difficultyFor(score, W, H).speed; }

  return {
    open,
    close,
    get isOpen() { return state !== 'closed'; },
    get state() { return state; },
  };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  return ctx;
}

function drawStar(ctx, x, y, points, outer, inner, color) {
  const step = Math.PI / points;
  ctx.beginPath();
  ctx.moveTo(x, y - outer);
  for (let i = 1; i < points * 2; i++) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + i * step;
    ctx.lineTo(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}
