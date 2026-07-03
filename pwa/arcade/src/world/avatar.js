// Chibi cheerleader avatar rig — parts-based (shadow / legs / torso / arms /
// head / hair / bow) so palette-swap customization is free and future
// cosmetic slots are drop-in. All art is procedural PIXI.Graphics: one
// consistent style, crisp at retina, zero texture downloads.
//
// Facing: 8 directions, 0=S 1=SE 2=E 3=NE 4=N 5=NW 6=W 7=SW.
// The rig draws 3 head views (front / side / back) and mirrors for west.

const { Container, Graphics, Text } = PIXI;

export const SKINS = [0xffdbc4, 0xf3c29e, 0xd99e6f, 0xa96f45, 0x7c4b2a];
export const HAIR_COLORS = [0x2d2019, 0x0e0c0b, 0xe8c56a, 0x8c3f23, 0xf1a7c8, 0x74d7db];
export const HAIR_STYLES = ['ponytail', 'bun', 'long', 'short'];
// bow index 0 = program accent (resolved at draw time)
export const BOW_COLORS = [null, 0xffffff, 0xff4f79, 0x35c2ff, 0xb387ff, 0xffd166, 0x43e97b, 0x14141c];
// uniform colorway: [top, trim] — index 0 = program colors
export const UNIFORMS = [null, [0x14141c, 0xf97fac], [0x27334d, 0x74d7db], [0x4b2a5e, 0xffffff]];

export const DEFAULT_AVATAR = { skin: 1, hair: 'ponytail', hairColor: 0, bow: 0, uniform: 0 };

export function sanitizeAvatar(cfg) {
  const a = { ...DEFAULT_AVATAR, ...(cfg && typeof cfg === 'object' ? cfg : {}) };
  a.skin = idx(a.skin, SKINS.length);
  a.hairColor = idx(a.hairColor, HAIR_COLORS.length);
  a.bow = idx(a.bow, BOW_COLORS.length);
  a.uniform = idx(a.uniform, UNIFORMS.length);
  if (!HAIR_STYLES.includes(a.hair)) a.hair = 'ponytail';
  return a;
}
function idx(v, n) { const i = Math.round(Number(v)); return Number.isFinite(i) && i >= 0 && i < n ? i : 0; }

const FACING_BACK = new Set([3, 4, 5]);
const FACING_WEST = new Set([5, 6, 7]);
const FACING_SIDE = new Set([2, 6]);

export function facingFromVector(vx, vy) {
  // screen-space angle → 8-way (0=S, going clockwise from south)
  const a = Math.atan2(vy, vx); // -π..π, 0 = east
  const oct = Math.round((a - Math.PI / 2) / (Math.PI / 4)) & 7; // 0 = south
  return [0, 7, 6, 5, 4, 3, 2, 1][oct]; // flip to our clockwise S→SE… order
}

export function createAvatar({ config, name, team, theme, isSelf = false, fx = null }) {
  const root = new Container();
  root.cullable = true;
  let cfg = sanitizeAvatar(config);

  const shadow = new Graphics();
  shadow.ellipse(0, 0, 26, 11).fill({ color: 0x000000, alpha: 0.34 });
  root.addChild(shadow);

  const rig = new Container();       // vertical offset for jumps
  root.addChild(rig);

  const legL = new Graphics(), legR = new Graphics();
  const torso = new Graphics();
  const armL = new Graphics(), armR = new Graphics();
  const head = new Container();
  const hairBack = new Graphics();   // ponytail / long masses — BEHIND the head
  const headBase = new Graphics();   // face + skin
  const hair = new Graphics();       // crown + fringe — in front
  const bow = new Graphics();
  const face = new Graphics();       // eyes + mouth (hidden from behind)
  head.addChild(hairBack, headBase, hair, face, bow);

  legL.position.set(-9, -30); legR.position.set(9, -30);
  armL.position.set(-17, -49); armR.position.set(17, -49);
  head.position.set(0, -64);
  rig.addChild(legL, legR, torso, armL, armR, head);

  // ── name tag ──
  const tag = new Container();
  const tagText = new Text({
    text: team ? `${name} · ${team}` : (name || ''),
    style: {
      fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: 12.5, fontWeight: '800',
      fill: isSelf ? 0xffffff : 0xd8d8e2, align: 'center',
    },
    resolution: 2,
  });
  tagText.anchor.set(0.5);
  const tagBg = new Graphics();
  const tw = tagText.width + 16, th = 20;
  tagBg.roundRect(-tw / 2, -th / 2, tw, th, 10).fill({ color: 0x0a0a10, alpha: 0.72 });
  if (isSelf) tagBg.roundRect(-tw / 2, -th / 2, tw, th, 10).stroke({ color: theme.accentNum, width: 1.4, alpha: 0.9 });
  tag.addChild(tagBg, tagText);
  tag.position.set(0, -128);
  root.addChild(tag);

  // ── speech bubble (preset phrases only) ──
  const bubble = new Container();
  bubble.visible = false;
  root.addChild(bubble);
  let bubbleTimer = 0;

  // ── state ──
  let facing = 0;
  let moving = false;
  let walkPhase = Math.random() * 10;
  let idlePhase = Math.random() * 10;
  let emote = null; // { key, t, dur }
  let pose = null;  // held photo-booth pose key

  function colors() {
    const uni = UNIFORMS[cfg.uniform] || [0x14141c, theme.accentNum];
    return {
      skin: SKINS[cfg.skin],
      hair: HAIR_COLORS[cfg.hairColor],
      bow: BOW_COLORS[cfg.bow] ?? theme.accentNum,
      top: cfg.uniform === 0 ? 0x14141c : uni[0],
      trim: cfg.uniform === 0 ? theme.accentNum : uni[1],
    };
  }

  function redraw() {
    const C = colors();
    const back = FACING_BACK.has(facing);
    const side = FACING_SIDE.has(facing);

    // legs: skin with white shoes
    for (const leg of [legL, legR]) {
      leg.clear();
      leg.roundRect(-4.5, 0, 9, 24, 4.5).fill(C.skin);
      leg.roundRect(-5.5, 19, 11, 9, 4.5).fill(0xffffff);
      leg.roundRect(-5.5, 23, 11, 5, 2.5).fill(0xe8e8ee);
    }

    // torso: shell top + flared skirt with trim stripe. A faint light rim
    // keeps the silhouette readable on the dark gym floor.
    torso.clear();
    torso.roundRect(-15, -56, 30, 26, 9).fill(C.top)
      .stroke({ color: 0xffffff, width: 1.4, alpha: 0.16 });                // shell
    torso.moveTo(-14, -32).lineTo(14, -32).lineTo(20, -17).lineTo(-20, -17) // skirt
      .closePath().fill(C.top)
      .stroke({ color: 0xffffff, width: 1.4, alpha: 0.14 });
    torso.moveTo(-18.6, -21.5).lineTo(18.6, -21.5).lineTo(20, -17).lineTo(-20, -17)
      .closePath().fill(C.trim);
    // shoulder stripes
    torso.roundRect(-15, -56, 5, 22, 4).fill({ color: C.trim, alpha: 0.9 });
    torso.roundRect(10, -56, 5, 22, 4).fill({ color: C.trim, alpha: 0.9 });
    if (!back) { // big chest chevron
      torso.moveTo(-12, -54).lineTo(0, -42).lineTo(12, -54).lineTo(12, -47)
        .lineTo(0, -35).lineTo(-12, -47).closePath().fill(C.trim);
    }

    // arms: skin, small white wrist cuff
    for (const arm of [armL, armR]) {
      arm.clear();
      arm.roundRect(-3.8, -2, 7.6, 22, 3.8).fill(C.skin);
      arm.roundRect(-4.4, 15, 8.8, 6, 3).fill(0xffffff);
    }

    // head: big chibi ball with a soft rim
    headBase.clear();
    headBase.circle(0, 0, 24).fill(C.skin)
      .stroke({ color: 0xffffff, width: 1.4, alpha: 0.12 });

    // face (front + side only)
    face.clear();
    if (!back) {
      const ex = side ? 9 : 0;                 // profile shifts features
      const spread = side ? 4.5 : 8.5;
      face.circle(ex - spread, 1, 2.7).fill(0x231a18);
      face.circle(ex + spread, 1, 2.7).fill(0x231a18);
      face.circle(ex - spread + 1, 0, 0.9).fill(0xffffff);
      face.circle(ex + spread + 1, 0, 0.9).fill(0xffffff);
      face.moveTo(ex - 4, 9).quadraticCurveTo(ex, 12.5, ex + 4, 9).stroke({ color: 0x9c5a4a, width: 1.8, cap: 'round' });
      face.circle(ex - spread - 5.5, 6, 3.2).fill({ color: 0xf78fb3, alpha: 0.35 }); // blush
      face.circle(ex + spread + 5.5, 6, 3.2).fill({ color: 0xf78fb3, alpha: 0.35 });
    }

    // hair: back mass sits BEHIND the head so tails read as tails
    const H = C.hair;
    hairBack.clear();
    if (cfg.hair === 'ponytail') {
      // high pony swinging out behind the crown
      hairBack.moveTo(2, -20).quadraticCurveTo(24, -30, 22, -6)
        .quadraticCurveTo(26, 12, 14, 22).quadraticCurveTo(20, 0, 8, -12)
        .closePath().fill(H);
      hairBack.circle(6, -19, 5).fill(H); // gathered base
    } else if (cfg.hair === 'bun') {
      hairBack.circle(0, -27, 10).fill(H);
      hairBack.circle(0, -27, 10).stroke({ color: 0xffffff, width: 1.2, alpha: 0.12 });
    } else if (cfg.hair === 'long') {
      hairBack.moveTo(-22, -8).quadraticCurveTo(-31, 16, -22, 32).quadraticCurveTo(-14, 22, -16, 2).closePath().fill(H);
      hairBack.moveTo(22, -8).quadraticCurveTo(31, 16, 22, 32).quadraticCurveTo(14, 22, 16, 2).closePath().fill(H);
    }

    hair.clear();
    if (back) {
      hair.circle(0, -1, 24.8).fill(H); // full back of head
    } else {
      hair.moveTo(-24, 2).arc(0, 0, 24.6, Math.PI, 0).lineTo(20, -2)
        .quadraticCurveTo(12, -12, 0, -13).quadraticCurveTo(-14, -12, -20, -2)
        .closePath().fill(H); // crown + fringe
      hair.moveTo(-24.5, 0).quadraticCurveTo(-26, 10, -21, 16).lineTo(-19, 4).closePath().fill(H);
      hair.moveTo(24.5, 0).quadraticCurveTo(26, 10, 21, 16).lineTo(19, 4).closePath().fill(H);
    }

    // bow: two loops + knot, sits high on the crown
    bow.clear();
    const B = C.bow;
    const by = cfg.hair === 'bun' ? -33 : -23;
    bow.moveTo(-3, by).quadraticCurveTo(-16, by - 10, -13, by + 3).quadraticCurveTo(-8, by + 7, -3, by).closePath().fill(B);
    bow.moveTo(3, by).quadraticCurveTo(16, by - 10, 13, by + 3).quadraticCurveTo(8, by + 7, 3, by).closePath().fill(B);
    bow.circle(0, by + 1, 4).fill(B);
    bow.circle(-1.4, by - 0.4, 1.4).fill({ color: 0xffffff, alpha: 0.55 });

    // mirror for west-facing
    rig.scale.x = FACING_WEST.has(facing) ? -1 : 1;
  }

  // ── speech ──
  function say(text) {
    bubble.removeChildren();
    const t = new Text({
      text, style: {
        fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: 13.5, fontWeight: '800',
        fill: 0x14141c, align: 'center',
      }, resolution: 2,
    });
    t.anchor.set(0.5);
    const w = t.width + 22, h = 30;
    const bg = new Graphics();
    bg.roundRect(-w / 2, -h / 2, w, h, 14).fill(0xffffff);
    bg.moveTo(-6, h / 2 - 1).lineTo(6, h / 2 - 1).lineTo(0, h / 2 + 8).closePath().fill(0xffffff);
    bubble.addChild(bg, t);
    bubble.position.set(0, -158);
    bubble.visible = true;
    bubble.alpha = 0;
    bubbleTimer = 2.6;
  }

  // ── emotes ──
  const EMOTE_DUR = {
    wave: 1.0, hit: 1.05, spirit: 1.3, highv: 1.0,
    toetouch: 1.1, backflip: 1.05, laugh: 1.1, hearthands: 1.3,
  };
  function playEmote(key) {
    if (!(key in EMOTE_DUR)) return;
    emote = { key, t: 0, dur: EMOTE_DUR[key], fired: false };
  }
  function setPose(key) { pose = key; if (key) emote = null; applyNeutral(); }

  function applyNeutral() {
    legL.rotation = legR.rotation = 0;
    armL.rotation = 0.18; armR.rotation = -0.18;
    rig.y = 0; rig.rotation = 0; rig.scale.y = 1;
    head.rotation = 0;
    shadow.scale.set(1);
  }

  const easeOut = (t) => 1 - (1 - t) * (1 - t);
  const jumpArc = (t) => Math.sin(Math.PI * Math.min(1, t)) ** 0.9;

  function updateEmote(dt) {
    const e = emote;
    e.t += dt;
    const p = Math.min(1, e.t / e.dur);
    const wx = root.x, wy = root.y;
    switch (e.key) {
      case 'wave':
        armR.rotation = -2.5 + Math.sin(p * Math.PI * 5) * 0.35;
        break;
      case 'hit': {
        rig.y = -jumpArc(p * 1.15) * 50;
        armL.rotation = -2.9; armR.rotation = 2.9; // high-V punch
        if (!e.fired && p > 0.28) { e.fired = true; fx?.burst(wx, wy - 120, 'star'); fx?.text(wx, wy - 150, 'HIT!'); }
        break;
      }
      case 'spirit':
        armL.rotation = -2.7 + Math.sin(p * 40) * 0.12;
        armR.rotation = 2.7 - Math.sin(p * 40 + 1) * 0.12;
        rig.y = -Math.abs(Math.sin(p * Math.PI * 3)) * 6;
        if (!e.fired && p > 0.2) { e.fired = true; fx?.burst(wx, wy - 118, 'spark'); }
        break;
      case 'highv':
        armL.rotation = -2.6; armR.rotation = 2.6;
        rig.y = -jumpArc(Math.min(1, p * 2.4)) * 14;
        break;
      case 'toetouch': {
        const j = jumpArc(p);
        rig.y = -j * 58;
        const split = Math.max(0, Math.sin(p * Math.PI)) ;
        legL.rotation = -1.35 * split; legR.rotation = 1.35 * split;
        armL.rotation = -2.4 * split; armR.rotation = 2.4 * split;
        if (!e.fired && p > 0.4) { e.fired = true; fx?.burst(wx, wy - 90, 'spark'); }
        break;
      }
      case 'backflip': {
        rig.y = -jumpArc(p) * 62;
        rig.pivot.y = -46; // rotate around body center, not the feet
        rig.rotation = -Math.PI * 2 * easeOut(p);
        if (p >= 1) { rig.pivot.y = 0; rig.rotation = 0; }
        break;
      }
      case 'laugh': {
        const s = 1 + Math.sin(p * Math.PI * 6) * 0.08;
        rig.scale.y = s; rig.y = -Math.abs(Math.sin(p * Math.PI * 3)) * 8;
        head.rotation = Math.sin(p * Math.PI * 6) * 0.12;
        if (!e.fired && p > 0.15) { e.fired = true; fx?.text(wx, wy - 145, 'ha ha!'); }
        break;
      }
      case 'hearthands':
        armL.rotation = -2.1; armR.rotation = 2.1;
        if (!e.fired && p > 0.3) { e.fired = true; fx?.burst(wx, wy - 132, 'heart'); }
        break;
    }
    shadow.scale.set(1 - Math.min(0.35, -rig.y / 160));
    if (p >= 1) { emote = null; rig.pivot.y = 0; applyNeutral(); }
  }

  // ── poses (photo booth) ──
  function updatePose() {
    switch (pose) {
      case 'highv': armL.rotation = -2.6; armR.rotation = 2.6; break;
      case 'sassy': armL.rotation = 0.9; armR.rotation = -2.5; head.rotation = -0.12; break;
      case 'jump': rig.y = -26; armL.rotation = -2.9; armR.rotation = 2.9; break;
      default: applyNeutral();
    }
  }

  function update(dt) {
    idlePhase += dt;
    if (bubble.visible) {
      bubbleTimer -= dt;
      bubble.alpha = Math.min(1, bubble.alpha + dt * 8);
      if (bubbleTimer <= 0) bubble.visible = false;
      else if (bubbleTimer < 0.3) bubble.alpha = bubbleTimer / 0.3;
    }
    if (emote) { updateEmote(dt); return; }
    if (pose) { updatePose(); return; }

    if (moving) {
      walkPhase += dt * 11;
      const s = Math.sin(walkPhase);
      legL.rotation = s * 0.62;
      legR.rotation = -s * 0.62;
      armL.rotation = 0.18 - s * 0.5;
      armR.rotation = -0.18 + s * 0.5;
      rig.y = -Math.abs(Math.sin(walkPhase)) * 3.4;
      head.rotation = s * 0.03;
    } else {
      legL.rotation = legR.rotation = 0;
      const b = Math.sin(idlePhase * 1.6);
      rig.y = b * 1.6;
      armL.rotation = 0.18 + b * 0.03;
      armR.rotation = -0.18 - b * 0.03;
      head.rotation = Math.sin(idlePhase * 0.8) * 0.02;
    }
  }

  redraw();
  applyNeutral();

  return {
    container: root,
    get facing() { return facing; },
    setFacing(f) { const nf = f & 7; if (nf !== facing) { const wasBack = FACING_BACK.has(facing), wasSide = FACING_SIDE.has(facing); facing = nf; if (FACING_BACK.has(nf) !== wasBack || FACING_SIDE.has(nf) !== wasSide) redraw(); else rig.scale.x = FACING_WEST.has(nf) ? -1 : 1; } },
    setMoving(m) { moving = !!m; },
    setConfig(next) { cfg = sanitizeAvatar(next); redraw(); },
    getConfig() { return { ...cfg }; },
    playEmote, say, setPose, update,
    isEmoting() { return !!emote; },
  };
}
