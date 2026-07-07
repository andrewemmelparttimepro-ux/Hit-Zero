// HIT THE COUNTS — the first real arcade cabinet game.
//
// A count-based rhythm game built on the one asset no competitor has: the
// routine backend. Live athletes play the counts of their own team's actual
// routine music (routine_audio_assets + routine_count_maps, read under the
// athlete's own RLS). No routine music yet / offline mode → a procedural
// 140bpm "practice track" from audio.js so the game is never dead.
//
// Solo: tap the counts, build combos, chase the HIT ZERO! grade.
// Team round: one athlete starts a round; every teammate in the Arcade gets
// invited, everyone plays the same chart at the same moment, live accuracy
// pips show the whole team, and if everybody lands 80%+ the room goes
// TEAM HIT ZERO. Which is literally the sport.
//
// Hard-rule compliance: no free text (labels come from coach-authored DB
// section names), no persistence (scores are ephemeral broadcast, nothing
// written), no new realtime topics (one 'game' event on the existing gym
// channel), observers can't play.

import { buildChart, judge, createScorer, gradeFor, GRADES, JUDGE } from './chart.js';
import { createAvatar } from '../world/avatar.js';

const { Container, Graphics, Text } = PIXI;

const APPROACH = 2.2;      // seconds a note is on screen before its count
const PROG_EVERY_E8 = 1;   // broadcast a progress pip every 8-count
const RESULT_WAIT = 6000;  // ms to hold the board open for teammate results
const TEAM_HIT_ACC = 80;   // everyone at/above this → TEAM HIT ZERO

const JUDGE_COPY = {
  perfect: { txt: 'PERFECT!', color: 0xffd166 },
  great: { txt: 'GREAT', color: 0x74d7db },
  good: { txt: 'OK', color: 0xd8d8e2 },
  miss: { txt: 'MISS', color: 0xff6b81 },
};

// Practice track chart data (synthetic count map, 16 8-counts @140).
const PRACTICE = {
  bpm: 140,
  eightCounts: 16,
  markers: [
    { kind: 'section_start', count: 1, label: 'Warm Up', energy: 0.5 },
    { kind: 'section_start', count: 5, label: 'Jumps', energy: 0.7 },
    { kind: 'section_start', count: 9, label: 'Tumbling', energy: 0.85 },
    { kind: 'major_hit', count: 13, label: 'PYRAMID', energy: 0.92 },
  ],
};

export function createHitTheCounts({
  mode, supa, profile, theme, sfx, audio, net, rend,
  getAthlete, getAvatarCfg, getPeerName, toast, onOpenChange,
}) {
  // IMPORTANT: the game renders inside the WORLD's Pixi app (rend.app) in a
  // container above the world, which is hidden while playing. Creating and
  // destroying a second Application corrupts Pixi 8.19's shared batcher pool
  // (the Character Studio preview app does exactly that — pre-existing, see
  // handoff) and a second WebGL context is a real cost on iPad Safari anyway.
  let root = null;         // overlay DOM
  const app = rend.app;    // the world's Pixi app — never created/destroyed here
  let gameRoot = null;     // everything the game draws lives under this
  let tickFn = null;       // our ticker callback (added on open, removed on close)
  let stageParts = null;   // containers + HUD text refs
  let state = 'closed';    // closed | loading | menu | lobby | countdown | play | results
  let music = null;        // { kind:'routine'|'practice', ... }
  let run = null;          // active play-through state
  let round = null;        // team round state (may exist through play+results)
  let pendingInvite = null; // last invite seen while closed / in menu
  let musicLoad = null;    // promise so we only fetch once per open

  const playable = mode === 'player' || mode === 'offline';

  // ────────────────────────────────────────────────────────────────────
  // Music sources
  // ────────────────────────────────────────────────────────────────────

  async function loadRoutineMusic() {
    const { teamId } = getAthlete();
    if (!supa || !teamId) return null;
    try {
      const { data: routines } = await supa
        .from('routines')
        .select('id, name, bpm, length_counts')
        .eq('team_id', teamId)
        .eq('is_active', true)
        .limit(1);
      const routine = routines?.[0];
      if (!routine) return null;

      const [{ data: map }, { data: assets }] = await Promise.all([
        supa.from('routine_count_maps').select('bpm, first_count_seconds, markers').eq('routine_id', routine.id).maybeSingle(),
        supa.from('routine_audio_assets').select('id, routine_id, storage_path, duration_seconds, status')
          .eq('routine_id', routine.id).eq('kind', 'primary_music').limit(1),
      ]);
      const asset = assets?.[0];
      if (!asset || asset.status !== 'uploaded' || !asset.storage_path) return null;

      const url = await playbackUrl(asset);
      if (!url) return null;

      const el = new window.Audio(url);
      el.preload = 'auto';
      return {
        kind: 'routine',
        title: routine.name || 'Team Routine',
        audioEl: el,
        chartInput: {
          bpm: Number(map?.bpm) || Number(routine.bpm) || 140,
          firstCountSeconds: Number(map?.first_count_seconds) || 0,
          durationSeconds: Number(asset.duration_seconds) || null,
          lengthCounts: Number(routine.length_counts) || null,
          markers: Array.isArray(map?.markers) ? map.markers : [],
        },
      };
    } catch (err) {
      console.warn('[counts] routine music unavailable', err);
      return null;
    }
  }

  async function playbackUrl(asset) {
    // Same broker path the Routine Builder uses; storage signed URL fallback.
    try {
      const { data } = await supa.auth.getSession();
      const token = data?.session?.access_token;
      const base = 'https://ldhzkdqznccfgpdvqyfk.supabase.co'; // same project main.js pins
      if (token) {
        const res = await fetch(`${base}/functions/v1/routine-audio-playback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ audio_asset_id: asset.id, routine_id: asset.routine_id }),
        });
        const payload = await res.json().catch(() => ({}));
        if (res.ok && payload.signed_url) return payload.signed_url;
      }
    } catch { /* fall through to storage */ }
    try {
      const { data, error } = await supa.storage.from('routine-audio').createSignedUrl(asset.storage_path, 60 * 60 * 2);
      if (!error) return data?.signedUrl || data?.signedURL || null;
    } catch { /* no luck */ }
    return null;
  }

  function practiceMusic() {
    return {
      kind: 'practice',
      title: 'Practice Track',
      chartInput: {
        bpm: PRACTICE.bpm,
        firstCountSeconds: 0,
        durationSeconds: PRACTICE.eightCounts * 8 * (60 / PRACTICE.bpm) + 1,
        lengthCounts: PRACTICE.eightCounts,
        markers: PRACTICE.markers,
      },
    };
  }

  async function ensureMusic() {
    if (!musicLoad) {
      musicLoad = (async () => {
        if (mode === 'player' && supa) {
          const routine = await loadRoutineMusic();
          if (routine) return routine;
        }
        return practiceMusic();
      })();
    }
    music = await musicLoad;
    return music;
  }

  // ────────────────────────────────────────────────────────────────────
  // Overlay DOM
  // ────────────────────────────────────────────────────────────────────

  function open() {
    if (root) return;
    onOpenChange(true);
    root = document.createElement('div');
    root.className = 'arc-game';
    root.innerHTML = `
      <div class="arc-game-head">
        <div class="arc-game-title">HIT THE <b>COUNTS</b><span class="arc-game-sub"></span></div>
        <button class="arc-game-close" type="button" aria-label="Exit game">✕</button>
      </div>
      <div class="arc-game-stage"></div>
      <div class="arc-game-panel"></div>
    `;
    document.body.appendChild(root);
    root.querySelector('.arc-game-close').addEventListener('click', close);
    setState('loading');
    boot();
  }

  async function boot() {
    mountStage();
    await ensureMusic();
    if (!root) return; // closed while loading
    root.querySelector('.arc-game-sub').textContent = music.title;
    // an invite may have arrived while the kid was walking to the cabinet
    if (pendingInvite && pendingInvite.startAt - Date.now() > 1500) joinLobbyFromInvite(pendingInvite);
    else setState('menu');
  }

  function close() {
    if (!root) return;
    if (round && round.mine && state !== 'results') netSend('leave', { rid: round.rid });
    stopRun();
    if (round) { clearInterval(round.lobbyTimer); clearInterval(round.boardTimer); }
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', layoutStage);
    round = null;
    if (tickFn) { app.ticker.remove(tickFn); tickFn = null; }
    if (gameRoot) { app.stage.removeChild(gameRoot); gameRoot.destroy({ children: true }); gameRoot = null; }
    rend.world.visible = true;
    stageParts = null;
    root.remove();
    root = null;
    musicLoad = null;
    state = 'closed';
    onOpenChange(false);
  }

  function panel() { return root?.querySelector('.arc-game-panel'); }

  function setState(next) {
    state = next;
    const p = panel();
    if (!p) return;
    p.innerHTML = '';
    p.classList.toggle('clear', next === 'play'); // countdown keeps the panel for the 5-6-7-8
    if (next === 'loading') {
      p.innerHTML = `<div class="arc-game-card"><div class="arc-game-spin"></div><p>Cueing up the music…</p></div>`;
    } else if (next === 'menu') renderMenu(p);
    else if (next === 'results') { /* renderResults fills it */ }
  }

  function renderMenu(p) {
    const isRoutine = music.kind === 'routine';
    const { total8 } = chartPreview();
    const card = document.createElement('div');
    card.className = 'arc-game-card';
    card.innerHTML = `
      <div class="arc-game-logo">⭐</div>
      <h3>${isRoutine ? escapeHtml(music.title) : 'Practice Track'}</h3>
      <p class="dim">${isRoutine
        ? `Your team's real routine — ${total8} eight-counts. Tap every count. Hit the star sections!`
        : `No routine music loaded yet, so we made you a beat. ${total8} eight-counts — tap every count!`}</p>
      <button class="arc-game-btn primary" data-go="solo">▶ PLAY SOLO</button>
      ${playable ? `<button class="arc-game-btn" data-go="team">👯 START TEAM ROUND</button>` : ''}
      <p class="tiny dim">Teammates in the Arcade get invited the moment you start a team round.</p>
    `;
    card.querySelector('[data-go="solo"]').addEventListener('click', () => startSolo());
    card.querySelector('[data-go="team"]')?.addEventListener('click', () => startTeamRound());
    p.appendChild(card);

    if (pendingInvite && pendingInvite.startAt - Date.now() > 1500) showInviteBanner(p, pendingInvite);
  }

  function showInviteBanner(p, invite) {
    const b = document.createElement('div');
    b.className = 'arc-game-invite';
    const update = () => {
      const s = Math.max(0, Math.ceil((invite.startAt - Date.now()) / 1000));
      b.querySelector('.cd').textContent = s;
    };
    b.innerHTML = `
      <span>🎉 ${escapeHtml(invite.fromName)} started a team round! <b class="cd"></b>s</span>
      <button class="arc-game-btn primary sm" type="button">JOIN</button>
    `;
    b.querySelector('button').addEventListener('click', () => joinLobbyFromInvite(invite));
    p.prepend(b);
    update();
    invite.bannerTimer = setInterval(() => {
      update();
      if (invite.startAt - Date.now() <= 0) { clearInterval(invite.bannerTimer); b.remove(); pendingInvite = null; }
    }, 250);
  }

  // ────────────────────────────────────────────────────────────────────
  // Pixi stage: lane, notes, judgments, avatar, particles
  // ────────────────────────────────────────────────────────────────────

  function mountStage() {
    // hide the world, take over its renderer
    rend.world.visible = false;
    gameRoot = new Container();
    app.stage.addChild(gameRoot);

    const bgLayer = new Container();
    const laneLayer = new Container();
    const noteLayer = new Container();
    const fxLayer = new Container();
    const uiLayer = new Container();
    gameRoot.addChild(bgLayer, laneLayer, noteLayer, fxLayer, uiLayer);

    const mkText = (size, weight = '900', fill = 0xffffff) => new Text({
      text: '',
      style: { fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: size, fontWeight: weight, fill, letterSpacing: 1 },
      resolution: 2,
    });

    const comboText = mkText(46);
    comboText.anchor.set(0.5);
    const comboLabel = mkText(13, '800', 0x8a8a96);
    comboLabel.anchor.set(0.5);
    comboLabel.text = 'COMBO';
    comboLabel.alpha = 0; // only visible at 3+ combo
    const scoreText = mkText(26);
    scoreText.anchor.set(1, 0);
    const sectionText = mkText(15, '800', 0xffd166);
    sectionText.anchor.set(0, 0);
    const countText = mkText(84);
    countText.anchor.set(0.5);
    countText.alpha = 0.16;
    const progText = mkText(13, '800', 0x8a8a96);
    progText.anchor.set(1, 0);
    uiLayer.addChild(comboText, comboLabel, scoreText, sectionText, countText, progText);

    // tiny local particle system (the world renderer's fx is bound to the
    // world app, so the game has its own — same visual language)
    const particles = [];
    const FX_COLORS = {
      star: [theme.accentNum, 0xffd166, 0xffffff],
      spark: [0xffffff, theme.accent2Num, theme.accentNum],
      heart: [theme.accentNum, 0xff4f79, 0xffb3cc],
      confetti: [theme.accentNum, theme.accent2Num, 0xffd166, 0xffffff, 0xb387ff],
    };
    const fx = {
      burst(x, y, kind = 'spark', count = 14) {
        const colors = FX_COLORS[kind] || FX_COLORS.spark;
        for (let i = 0; i < count; i++) {
          const g = new Graphics();
          if (kind === 'confetti') g.rect(-3, -2, 6, 4).fill(colors[i % colors.length]);
          else if (kind === 'star') starShape(g, 0, 0, 5, 6, 2.6).fill(colors[i % colors.length]);
          else g.circle(0, 0, 2.6).fill(colors[i % colors.length]);
          g.position.set(x, y);
          const a = Math.random() * Math.PI * 2;
          const sp = 70 + Math.random() * 170;
          particles.push({ g, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 80, life: 0.7 + Math.random() * 0.5, age: 0, spin: (Math.random() - 0.5) * 9 });
          fxLayer.addChild(g);
        }
      },
      text(x, y, str, color = 0xffffff) {
        const t = mkText(30);
        t.style.fill = color;
        t.style.stroke = { color: theme.accentNum, width: 4 };
        t.text = str;
        t.anchor.set(0.5);
        t.position.set(x, y);
        particles.push({ g: t, x, y, vx: 0, vy: -55, life: 0.9, age: 0, spin: 0, pop: true });
        fxLayer.addChild(t);
      },
    };

    // the kid's own avatar cheers under the target ring
    let avatar = null;
    if (playable) {
      avatar = createAvatar({ config: getAvatarCfg(), name: profile?.display_name || 'You', team: '', theme, isSelf: true, fx });
      uiLayer.addChild(avatar.container);
    }

    stageParts = { bgLayer, laneLayer, noteLayer, fxLayer, uiLayer, comboText, comboLabel, scoreText, sectionText, countText, progText, fx, avatar, particles, mkText };
    layoutStage();
    window.addEventListener('resize', layoutStage);

    tickFn = (t) => {
      const dt = Math.min(0.05, t.deltaMS / 1000);
      tickPlay(dt);
      // particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.age += dt;
        if (p.age >= p.life) { p.g.destroy(); particles.splice(i, 1); continue; }
        p.vy = (p.vy ?? 0) + 200 * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.g.position.set(p.x, p.y);
        p.g.rotation += (p.spin || 0) * dt;
        p.g.alpha = 1 - (p.age / p.life) ** 2;
        if (p.pop) p.g.scale.set(0.6 + Math.min(1, p.age * 6) * 0.55);
      }
      avatar?.update(dt);
    };
    app.ticker.add(tickFn);

    // input: the whole stage area (DOM, sits over the canvas) is the drum
    root.querySelector('.arc-game-stage').addEventListener('pointerdown', onTap, { passive: true });
    window.addEventListener('keydown', onKey);
  }

  const HEAD_H = 64; // DOM header overlays the top of the canvas

  function geom() {
    const W = app.screen.width, H = app.screen.height;
    return {
      W, H,
      ringX: Math.max(90, W * 0.17),
      laneY: HEAD_H + (H - HEAD_H) * 0.44,
      speed: (W - Math.max(90, W * 0.17)) / APPROACH, // px per second
    };
  }

  function layoutStage() {
    if (!stageParts) return;
    const { W, H, ringX, laneY } = geom();
    const s = stageParts;
    s.comboText.position.set(W / 2, HEAD_H + (H - HEAD_H) * 0.12);
    s.comboLabel.position.set(W / 2, HEAD_H + (H - HEAD_H) * 0.12 + 34);
    s.scoreText.position.set(W - 16, HEAD_H + 8);
    s.progText.position.set(W - 16, HEAD_H + 40);
    s.sectionText.position.set(16, HEAD_H + 8);
    s.countText.position.set(W / 2, HEAD_H + (H - HEAD_H) * 0.36); // center ghost, clear of the ring
    s.avatar?.container.position.set(ringX, Math.min(H - 24, laneY + 215)); // nameplate clears the ring
    s.avatar?.container.scale.set(Math.min(1.15, H / 640));
    drawLane();
  }

  function drawLane() {
    if (!stageParts) return;
    const s = stageParts;
    s.laneLayer.removeChildren().forEach((c) => c.destroy());
    s.bgLayer.removeChildren().forEach((c) => c.destroy());
    const { W, H, ringX, laneY } = geom();
    const bg = new Graphics();
    bg.rect(0, 0, W, H).fill(0x07070d);
    s.bgLayer.addChild(bg);
    const g = new Graphics();
    // lane guide
    g.moveTo(ringX, laneY).lineTo(W + 40, laneY).stroke({ color: 0xffffff, width: 2, alpha: 0.08 });
    // target ring — the "mat"
    g.circle(ringX, laneY, 46).stroke({ color: theme.accentNum, width: 5, alpha: 0.9 });
    g.circle(ringX, laneY, 34).stroke({ color: 0xffffff, width: 2, alpha: 0.25 });
    g.circle(ringX, laneY, 52).stroke({ color: theme.accent2Num, width: 2, alpha: 0.35 });
    s.laneLayer.addChild(g);
  }

  // ────────────────────────────────────────────────────────────────────
  // A run (one play-through)
  // ────────────────────────────────────────────────────────────────────

  function chartPreview() { return buildChart(music.chartInput); }

  async function startSolo() { await startRun({ team: false }); }

  // iOS: HTMLAudio must be unlocked inside a real tap. Team rounds start from
  // a timer, so both team entry points (start + join) unlock here, on the tap.
  function unlockRoutineAudio() {
    if (music?.kind !== 'routine') return;
    try {
      const el = music.audioEl;
      el.play().then(() => { el.pause(); el.currentTime = 0; }).catch(() => { /* solo path retries */ });
    } catch { /* fine */ }
  }

  async function startTeamRound() {
    if (net.mode !== 'live' && mode !== 'offline') { toast('Team rounds need a live connection.'); return; }
    unlockRoutineAudio();
    const chart = chartPreview();
    const rid = Math.random().toString(36).slice(2, 10);
    const startIn = 9000;
    round = {
      rid, mine: true, startAt: Date.now() + startIn,
      roster: new Map([['me', { name: profile?.display_name || 'You', me: true, acc: 100, score: 0, combo: 0, result: null }]]),
    };
    netSend('invite', { rid, startIn, practice: music.kind === 'practice' ? 1 : 0, total8: chart.total8 });
    enterLobby();
  }

  function joinLobbyFromInvite(invite) {
    clearInterval(invite.bannerTimer);
    unlockRoutineAudio();
    pendingInvite = null;
    round = {
      rid: invite.rid, mine: false, startAt: invite.startAt,
      roster: new Map([
        ['me', { name: profile?.display_name || 'You', me: true, acc: 100, score: 0, combo: 0, result: null }],
        [invite.fromId, { name: invite.fromName, acc: 100, score: 0, combo: 0, result: null }],
      ]),
    };
    netSend('join', { rid: invite.rid });
    enterLobby();
  }

  function enterLobby() {
    setState('lobby');
    const p = panel();
    const card = document.createElement('div');
    card.className = 'arc-game-card';
    card.innerHTML = `
      <h3>TEAM ROUND</h3>
      <div class="arc-game-bigcd">9</div>
      <div class="arc-game-roster"></div>
      <p class="tiny dim">Everyone starts on the same 8-count. HIT ZERO together!</p>
      <button class="arc-game-btn sm" data-go="bail">Cancel</button>
    `;
    p.appendChild(card);
    card.querySelector('[data-go="bail"]').addEventListener('click', () => {
      netSend('leave', { rid: round.rid });
      clearInterval(round.lobbyTimer);
      round = null;
      setState('menu');
    });
    const cd = card.querySelector('.arc-game-bigcd');
    const rosterEl = card.querySelector('.arc-game-roster');
    const refresh = () => {
      const remain = round.startAt - Date.now();
      cd.textContent = Math.max(0, Math.ceil(remain / 1000));
      rosterEl.innerHTML = [...round.roster.values()]
        .map((r) => `<span class="chip${r.me ? ' me' : ''}">${escapeHtml(r.name)}</span>`).join('');
      if (remain <= 0) {
        clearInterval(round.lobbyTimer);
        startRun({ team: true });
      }
    };
    refresh();
    round.lobbyTimer = setInterval(refresh, 200);
  }

  async function startRun({ team }) {
    if (run) stopRun();
    const chart = buildChart(music.chartInput);
    const scorer = createScorer(chart.notes.length);
    run = {
      team, chart, scorer,
      notes: chart.notes.map((n) => ({ ...n, sprite: null, hit: false, missed: false })),
      nextSpawn: 0, nextJudge: 0,
      clock: null, started: false, finished: false,
      lastProgE8: 0, curE8: 0,
    };

    // iOS audio unlock: this call stack began with a user tap (menu button or
    // the lobby timer that a tap armed), so unlock the element now.
    if (music.kind === 'routine') {
      try {
        music.audioEl.currentTime = 0;
        await music.audioEl.play();
        music.audioEl.pause();
        music.audioEl.currentTime = 0;
      } catch { /* count-in tap below will retry */ }
    }

    setState('countdown');
    const beat = chart.beat;
    const p = panel();
    const cd = document.createElement('div');
    cd.className = 'arc-game-countin';
    p.appendChild(cd);
    const seq = ['5', '6', '7', '8'];
    for (let i = 0; i < seq.length; i++) {
      setTimeout(() => {
        if (!run || run.finished) return;
        cd.textContent = seq[i];
        cd.classList.remove('pop'); void cd.offsetWidth; cd.classList.add('pop');
        i < 3 ? sfx.countTick() : sfx.countGo();
      }, i * beat * 1000);
    }
    setTimeout(() => { if (run && !run.finished) beginPlay(); }, seq.length * beat * 1000);
  }

  function beginPlay() {
    setState('play');
    if (music.kind === 'routine') {
      const el = music.audioEl;
      el.currentTime = 0;
      el.play().catch((err) => {
        console.warn('[counts] routine audio failed to start, practice fallback', err);
        music = practiceMusic();
        run.chart = buildChart(music.chartInput);
        run.notes = run.chart.notes.map((n) => ({ ...n, sprite: null, hit: false, missed: false }));
        const track = audio.createPracticeTrack({ bpm: PRACTICE.bpm, eightCounts: PRACTICE.eightCounts, countIn: 0 });
        track.start();
        run.practice = track;
        run.clock = () => track.time();
      });
      run.clock = () => el.currentTime;
    } else {
      const track = audio.createPracticeTrack({ bpm: PRACTICE.bpm, eightCounts: PRACTICE.eightCounts, countIn: 0 });
      track.start();
      run.practice = track;
      run.clock = () => track.time();
    }
    run.started = true;
    if (run.team && round) renderTeamPips();
  }

  function stopRun() {
    if (!run) return;
    if (run.practice) run.practice.stop();
    if (music?.kind === 'routine' && music.audioEl) { try { music.audioEl.pause(); } catch { /* fine */ } }
    for (const n of run.notes) n.sprite?.destroy({ children: true });
    if (stageParts) {
      stageParts.comboText.text = '';
      stageParts.scoreText.text = '';
      stageParts.sectionText.text = '';
      stageParts.countText.text = '';
      stageParts.progText.text = '';
    }
    root?.querySelector('.arc-game-pips')?.remove();
    run = null;
  }

  // ────────────────────────────────────────────────────────────────────
  // Per-frame play update
  // ────────────────────────────────────────────────────────────────────

  function tickPlay(dt) {
    if (!run || !run.started || run.finished || !stageParts) return;
    const t = run.clock();
    const { W, ringX, laneY, speed } = geom();
    const s = stageParts;

    // routine audio element mute follows the arcade mute button
    if (music.kind === 'routine' && music.audioEl) music.audioEl.volume = audio.isMuted() ? 0 : 1;

    // spawn
    while (run.nextSpawn < run.notes.length && run.notes[run.nextSpawn].t - t <= APPROACH) {
      spawnNote(run.notes[run.nextSpawn]);
      run.nextSpawn += 1;
    }

    // move + late-miss
    for (let i = run.nextJudge; i < run.nextSpawn; i++) {
      const n = run.notes[i];
      if (n.hit || n.missed) continue;
      const x = ringX + (n.t - t) * speed;
      n.sprite?.position.set(x, laneY);
      if (t - n.t > JUDGE.good) {
        n.missed = true;
        run.scorer.miss();
        popJudge('miss');
        sfx.missNote();
        fadeNote(n, 0.25);
      }
    }
    while (run.nextJudge < run.notes.length && (run.notes[run.nextJudge].hit || run.notes[run.nextJudge].missed)) run.nextJudge += 1;

    // HUD
    const e8 = Math.max(1, Math.floor((t - run.chart.firstCountSeconds) / run.chart.bar) + 1);
    const countInBar = Math.max(1, (Math.floor((t - run.chart.firstCountSeconds) / run.chart.beat) % 8) + 1);
    if (t >= run.chart.firstCountSeconds) {
      s.countText.text = String(countInBar);
      s.countText.alpha = countInBar === 1 ? 0.34 : 0.15;
    }
    s.comboText.text = run.scorer.combo >= 3 ? String(run.scorer.combo) : '';
    s.comboLabel.alpha = run.scorer.combo >= 3 ? 1 : 0;
    s.scoreText.text = run.scorer.score.toLocaleString();
    s.progText.text = `8-count ${Math.min(e8, run.chart.total8)} / ${run.chart.total8}`;

    // section label from gold notes as they cross
    if (e8 !== run.curE8) {
      run.curE8 = e8;
      const mark = run.notes.find((n) => n.e8 === e8 && n.label);
      if (mark) {
        s.sectionText.text = mark.label.toUpperCase();
        s.fx.burst(16 + 60, 30, 'spark', 6);
      }
      // team progress pip broadcast on the 8-count boundary
      if (run.team && round && e8 - run.lastProgE8 >= PROG_EVERY_E8 && e8 <= run.chart.total8) {
        run.lastProgE8 = e8;
        netSend('prog', {
          rid: round.rid, e8,
          acc: Math.round(run.scorer.accuracy * 100),
          score: run.scorer.score, combo: run.scorer.combo,
        });
        const mine = round.roster.get('me');
        if (mine) { mine.acc = Math.round(run.scorer.accuracy * 100); mine.score = run.scorer.score; mine.combo = run.scorer.combo; }
        renderTeamPips();
      }
    }

    if (t > run.chart.endTime) finishRun();
  }

  function spawnNote(n) {
    const s = stageParts;
    const c = new Container();
    const g = new Graphics();
    if (n.type === 'hitzero') {
      starShape(g, 0, 0, 5, 40, 17).fill(theme.accentNum).stroke({ color: 0xffffff, width: 3 });
    } else if (n.type === 'gold') {
      starShape(g, 0, 0, 5, 30, 13).fill(0xffd166).stroke({ color: 0xffffff, width: 2.5 });
    } else {
      const oddCount = n.count % 2 === 1;
      g.circle(0, 0, 21).fill(oddCount ? theme.accent2Num : 0x3a3a4c).stroke({ color: 0xffffff, width: 2, alpha: 0.8 });
    }
    c.addChild(g);
    const num = s.mkText(n.type === 'tap' ? 19 : 22);
    num.anchor.set(0.5);
    num.text = n.type === 'hitzero' ? 'HIT!' : String(n.count);
    if (n.type === 'hitzero') num.style.fontSize = 15;
    if (n.type !== 'tap') num.style.fill = 0x14141c;
    c.addChild(num);
    if (n.label && n.type !== 'tap') {
      const lbl = s.mkText(12, '800', 0xffd166);
      lbl.anchor.set(0.5);
      lbl.text = n.label.toUpperCase();
      lbl.position.y = -46;
      c.addChild(lbl);
    }
    n.sprite = c;
    s.noteLayer.addChild(c);
  }

  function fadeNote(n, dur = 0.15) {
    const spr = n.sprite;
    if (!spr) return;
    n.sprite = null;
    const t0 = performance.now();
    const fade = () => {
      if (spr.destroyed) return; // game closed mid-fade
      const k = (performance.now() - t0) / (dur * 1000);
      if (k >= 1) { spr.destroy({ children: true }); return; }
      spr.alpha = 1 - k;
      spr.scale.set(1 + k * 0.5);
      requestAnimationFrame(fade);
    };
    fade();
  }

  function onTap() { tryHit(); }
  function onKey(e) {
    if (e.code === 'Space' && state === 'play') { e.preventDefault(); tryHit(); }
  }

  function tryHit() {
    if (!run || !run.started || run.finished) return;
    const t = run.clock();
    let best = null;
    for (let i = run.nextJudge; i < run.nextSpawn; i++) {
      const n = run.notes[i];
      if (n.hit || n.missed) continue;
      const d = Math.abs(t - n.t);
      if (d <= JUDGE.good && (!best || d < Math.abs(t - best.t))) best = n;
      if (n.t - t > JUDGE.good) break;
    }
    if (!best) return; // stray taps are free — kid-friendly
    best.hit = true;
    const j = judge(t - best.t);
    const { combo } = run.scorer.hit(j, best.type);
    popJudge(j);
    sfx[j === 'good' ? 'good' : j]();
    const { ringX, laneY } = geom();
    const s = stageParts;
    if (best.type === 'hitzero') {
      s.fx.burst(ringX, laneY, 'confetti', 26);
      s.fx.text(ringX, laneY - 90, 'HIT ZERO!', 0xffffff);
      s.avatar?.playEmote('hit');
      sfx.hit();
    } else if (best.type === 'gold') {
      s.fx.burst(ringX, laneY, 'star', 14);
      if (j === 'perfect') s.avatar?.playEmote('toetouch');
    } else if (j === 'perfect') {
      s.fx.burst(ringX, laneY, 'spark', 7);
    }
    if (combo > 0 && combo % 25 === 0) {
      s.fx.text(ringX + 130, laneY - 110, `${combo} COMBO!`, 0xffd166);
      s.avatar?.playEmote('spirit');
    }
    fadeNote(best);
  }

  function popJudge(j) {
    const { ringX, laneY } = geom();
    const c = JUDGE_COPY[j];
    stageParts.fx.text(ringX + 8, laneY - 64, c.txt, c.color);
  }

  // ────────────────────────────────────────────────────────────────────
  // Finish + results (+ team board)
  // ────────────────────────────────────────────────────────────────────

  function finishRun() {
    run.finished = true;
    const results = run.scorer.results();
    if (run.practice) run.practice.stop();
    if (music.kind === 'routine' && music.audioEl) { try { music.audioEl.pause(); } catch { /* fine */ } }

    if (run.team && round) {
      const mine = round.roster.get('me');
      if (mine) mine.result = { acc: results.accuracyPct, score: results.score, grade: results.grade };
      netSend('result', {
        rid: round.rid,
        acc: results.accuracyPct,
        score: results.score,
        gradeIndex: GRADES.findIndex((g) => g.label === results.grade),
      });
    }

    if (results.grade === 'HIT ZERO!') { sfx.fanfare(); stageParts.fx.burst(geom().W / 2, geom().H / 3, 'confetti', 40); }
    else if (results.accuracy >= 0.65) sfx.score();

    renderResults(results);
  }

  function renderResults(results) {
    stopRunVisualsOnly();
    setState('results');
    const p = panel();
    const card = document.createElement('div');
    card.className = 'arc-game-card results';
    card.innerHTML = `
      <div class="arc-game-grade${results.grade === 'HIT ZERO!' ? ' hz' : ''}">${escapeHtml(results.grade)}</div>
      <div class="arc-game-scorebig">${results.score.toLocaleString()}</div>
      <div class="arc-game-statrow">
        <span>💛 ${results.counts.perfect} perfect</span>
        <span>💙 ${results.counts.great} great</span>
        <span>🤍 ${results.counts.good} ok</span>
        <span>💔 ${results.counts.miss} miss</span>
      </div>
      <div class="arc-game-statrow"><span>Accuracy ${results.accuracyPct}%</span><span>Best combo ${results.maxCombo}</span></div>
      <div class="arc-game-teamboard" style="display:none"></div>
      <div class="arc-game-btnrow">
        <button class="arc-game-btn primary" data-go="again">↻ PLAY AGAIN</button>
        <button class="arc-game-btn" data-go="exit">EXIT</button>
      </div>
    `;
    p.appendChild(card);
    card.querySelector('[data-go="again"]').addEventListener('click', () => { round = null; startSolo(); });
    card.querySelector('[data-go="exit"]').addEventListener('click', close);

    if (run?.team && round) {
      const board = card.querySelector('.arc-game-teamboard');
      board.style.display = '';
      const refresh = () => renderTeamBoard(board);
      refresh();
      round.boardTimer = setInterval(refresh, 800);
      setTimeout(() => clearInterval(round.boardTimer), RESULT_WAIT * 3);
    }
    run = null;
  }

  function stopRunVisualsOnly() {
    if (!run) return;
    for (const n of run.notes) n.sprite?.destroy({ children: true });
    if (stageParts) {
      stageParts.countText.text = '';
      stageParts.comboText.text = '';
      stageParts.comboLabel.alpha = 0;
    }
    root?.querySelector('.arc-game-pips')?.remove();
  }

  function renderTeamBoard(board) {
    const rows = [...round.roster.values()]
      .sort((a, b) => (b.result?.score ?? b.score) - (a.result?.score ?? a.score));
    const everyoneDone = rows.length >= 2 && rows.every((r) => r.result);
    const teamHit = everyoneDone && rows.every((r) => r.result.acc >= TEAM_HIT_ACC);
    board.innerHTML = `
      <h4>TEAM ROUND</h4>
      ${teamHit ? `<div class="arc-game-teamhit">🎉 TEAM HIT ZERO! 🎉</div>` : ''}
      ${rows.map((r, i) => `
        <div class="row${r.me ? ' me' : ''}">
          <span class="pl">${i + 1}. ${escapeHtml(r.name)}</span>
          <span>${r.result ? `${r.result.acc}% · ${(r.result.score).toLocaleString()}` : 'finishing…'}</span>
        </div>`).join('')}
    `;
    if (teamHit && !round.celebrated) {
      round.celebrated = true;
      sfx.fanfare();
      stageParts?.fx.burst(geom().W / 2, geom().H / 3, 'confetti', 50);
    }
  }

  // live teammate pips during play
  function renderTeamPips() {
    if (!root || !round) return;
    let pips = root.querySelector('.arc-game-pips');
    if (!pips) {
      pips = document.createElement('div');
      pips.className = 'arc-game-pips';
      root.querySelector('.arc-game-stage').appendChild(pips);
    }
    pips.innerHTML = [...round.roster.values()]
      .filter((r) => !r.me)
      .map((r) => `
        <div class="pip">
          <span class="nm">${escapeHtml(r.name)}</span>
          <span class="bar"><i style="width:${r.result ? r.result.acc : r.acc}%"></i></span>
          <span class="pct">${r.result ? r.result.acc : r.acc}%</span>
        </div>`).join('');
  }

  // ────────────────────────────────────────────────────────────────────
  // Multiplayer message routing (called by main.js for every 'game' msg)
  // ────────────────────────────────────────────────────────────────────

  function handleGame(fromId, msg) {
    if (msg.type === 'invite') {
      if (round || (run && !run.finished)) return; // already busy
      const invite = {
        rid: msg.rid, fromId,
        fromName: getPeerName(fromId),
        startAt: Date.now() + msg.startIn,
        practice: msg.practice, total8: msg.total8,
      };
      pendingInvite = invite;
      if (state === 'menu') setState('menu'); // re-render with banner
      else if (state === 'closed') toast(`🎮 ${invite.fromName} started HIT THE COUNTS — tap the arcade cabinet to join!`);
      else toast(`${invite.fromName} started a team round — finish up to catch the next one!`);
      return;
    }
    if (!round || msg.rid !== round.rid) return;
    if (msg.type === 'join') {
      round.roster.set(fromId, { name: getPeerName(fromId), acc: 100, score: 0, combo: 0, result: null });
      if (state === 'lobby') { /* lobby interval re-renders roster */ }
      if (state === 'play') renderTeamPips();
    } else if (msg.type === 'prog') {
      const r = round.roster.get(fromId);
      if (r && !r.result) { r.acc = msg.acc; r.score = msg.score; r.combo = msg.combo; renderTeamPips(); }
    } else if (msg.type === 'result') {
      const r = round.roster.get(fromId) || { name: getPeerName(fromId), me: false };
      r.result = { acc: msg.acc, score: msg.score, grade: GRADES[msg.gradeIndex]?.label || gradeFor(msg.acc / 100) };
      round.roster.set(fromId, r);
      renderTeamPips();
    } else if (msg.type === 'leave') {
      round.roster.delete(fromId);
      if (state === 'play') renderTeamPips();
    }
  }

  function netSend(type, data) { net.sendGame?.(type, data); }

  return {
    open, close, handleGame,
    get isOpen() { return state !== 'closed'; },
  };
}

function starShape(g, x, y, points, outer, inner) {
  const step = Math.PI / points;
  g.moveTo(x, y - outer);
  for (let i = 1; i < points * 2; i++) {
    const rr = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + i * step;
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath();
  return g;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}
