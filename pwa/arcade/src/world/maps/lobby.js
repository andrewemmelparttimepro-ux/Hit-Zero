// THE LOBBY — the clubhouse map. One interior scene: spring floor, three
// arcade cabinets (center = live Cheer Town portal), tumble strip, spirit
// megaphone, photo booth. Implements the map contract used by the renderer
// and scene manager: { key, cols, rows, spawn, bounds, canStand, build,
// makeInteractables }.

import {
  TILE_W, TILE_H, gridToWorld, makeCanStand, makeBlockedSet, boundsFor,
  inZone, nearGrid,
} from '../tilemap.js';

const { Container, Graphics, Text } = PIXI;

const COLS = 20;
const ROWS = 14;
const WALL_H = 165;
export const WALL_ANGLE = Math.atan2(TILE_H / 2, TILE_W / 2);

// ─── Zones ───
const SPRING_FLOOR = { c0: 4, r0: 4, c1: 15, r1: 10 };   // 12×7 panels
const TUMBLE_TRACK = { c0: 17, r0: 3, c1: 17, r1: 10 };  // vertical strip, east side
const PHOTO_BOOTH  = { c0: 0, r0: 0, c1: 1, r1: 1 };     // NW corner

const CABINETS = [
  { key: 'left',   c0: 4,  c1: 5,  r: 0 },
  { key: 'center', c0: 9,  c1: 10, r: 0 },
  { key: 'right',  c0: 14, c1: 15, r: 0 },
];
const MEGAPHONE = { c: 2, r: 8 };

// ─── Collision ───
const collision = makeBlockedSet(COLS, ROWS);
for (const cab of CABINETS) collision.blockRect(cab.c0, cab.r, cab.c1, cab.r);
collision.block(MEGAPHONE.c, MEGAPHONE.r);
collision.block(0, 0); collision.block(1, 0); collision.block(0, 1); // booth backdrop

export const lobbyMap = {
  key: 'lobby',
  cols: COLS,
  rows: ROWS,
  spawn: { c: 10, r: 12 },
  bounds: boundsFor(COLS, ROWS),
  canStand: makeCanStand(collision.isBlocked),
  build,
  makeInteractables,
};

// ─────────────────────────────────────────────────────────────────────────
// Geometry builders
// ─────────────────────────────────────────────────────────────────────────

function tileDiamond(g, c, r, color, alpha = 1) {
  const p0 = gridToWorld(c, r), p1 = gridToWorld(c + 1, r);
  const p2 = gridToWorld(c + 1, r + 1), p3 = gridToWorld(c, r + 1);
  g.moveTo(p0.x, p0.y).lineTo(p1.x, p1.y).lineTo(p2.x, p2.y).lineTo(p3.x, p3.y).closePath()
    .fill({ color, alpha });
}

function inRect(c, r, z) { return c >= z.c0 && c <= z.c1 && r >= z.r0 && r <= z.r1; }

function wallQuad(g, A, B, yTop, yBottom, color, alpha = 1) {
  g.moveTo(A.x, A.y - yTop).lineTo(B.x, B.y - yTop)
    .lineTo(B.x, B.y - yBottom).lineTo(A.x, A.y - yBottom).closePath()
    .fill({ color, alpha });
}

function build(layers, theme) {
  buildFloor(layers.floor, theme);
  buildWalls(layers.walls, theme);
}

function buildFloor(layer, theme) {
  const g = new Graphics();

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (inRect(c, r, SPRING_FLOOR)) {
        const strip = (c - SPRING_FLOOR.c0) % 2 === 0;
        tileDiamond(g, c, r, strip ? 0x2a3150 : 0x242a45);
      } else if (inRect(c, r, TUMBLE_TRACK)) {
        tileDiamond(g, c, r, 0x352a4a);
      } else if (inRect(c, r, PHOTO_BOOTH)) {
        tileDiamond(g, c, r, 0x241a2c);
      } else {
        tileDiamond(g, c, r, (c + r) % 2 === 0 ? 0x1a1a24 : 0x171720);
      }
    }
  }

  // grout lines
  for (let r = 0; r <= ROWS; r++) {
    const a = gridToWorld(0, r), b = gridToWorld(COLS, r);
    g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ color: 0x000000, width: 1, alpha: 0.25 });
  }
  for (let c = 0; c <= COLS; c++) {
    const a = gridToWorld(c, 0), b = gridToWorld(c, ROWS);
    g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ color: 0x000000, width: 1, alpha: 0.25 });
  }

  // spring floor tape border + center emblem
  const sf = SPRING_FLOOR;
  const q = [gridToWorld(sf.c0, sf.r0), gridToWorld(sf.c1 + 1, sf.r0), gridToWorld(sf.c1 + 1, sf.r1 + 1), gridToWorld(sf.c0, sf.r1 + 1)];
  g.moveTo(q[0].x, q[0].y).lineTo(q[1].x, q[1].y).lineTo(q[2].x, q[2].y).lineTo(q[3].x, q[3].y).closePath()
    .stroke({ color: theme.accentNum, width: 4, alpha: 0.75 });
  const mid = gridToWorld((sf.c0 + sf.c1 + 1) / 2, (sf.r0 + sf.r1 + 1) / 2);
  g.moveTo(mid.x, mid.y - 44).lineTo(mid.x + 88, mid.y).lineTo(mid.x, mid.y + 44).lineTo(mid.x - 88, mid.y).closePath()
    .stroke({ color: theme.accentNum, width: 3, alpha: 0.4 });
  g.moveTo(mid.x, mid.y - 26).lineTo(mid.x + 52, mid.y).lineTo(mid.x, mid.y + 26).lineTo(mid.x - 52, mid.y).closePath()
    .fill({ color: theme.accentNum, alpha: 0.10 });

  // tumble track
  const tt = TUMBLE_TRACK;
  const ta = gridToWorld(tt.c0 + 0.5, tt.r0), tb = gridToWorld(tt.c0 + 0.5, tt.r1 + 1);
  g.moveTo(ta.x, ta.y).lineTo(tb.x, tb.y).stroke({ color: 0xffffff, width: 3, alpha: 0.35 });
  const tq = [gridToWorld(tt.c0, tt.r0), gridToWorld(tt.c1 + 1, tt.r0), gridToWorld(tt.c1 + 1, tt.r1 + 1), gridToWorld(tt.c0, tt.r1 + 1)];
  g.moveTo(tq[0].x, tq[0].y).lineTo(tq[1].x, tq[1].y).lineTo(tq[2].x, tq[2].y).lineTo(tq[3].x, tq[3].y).closePath()
    .stroke({ color: 0xb387ff, width: 3, alpha: 0.55 });

  layer.addChild(g);
}

function buildWalls(layer, theme) {
  const g = new Graphics();

  for (let c = 0; c < COLS; c++) {
    const A = gridToWorld(c, 0), B = gridToWorld(c + 1, 0);
    wallQuad(g, A, B, WALL_H, 0, c % 2 === 0 ? 0x1b1b25 : 0x191922);
    wallQuad(g, A, B, 14, 0, 0x101018);
    wallQuad(g, A, B, WALL_H, WALL_H - 6, 0x22222e);
  }
  for (let r = 0; r < ROWS; r++) {
    const A = gridToWorld(0, r), B = gridToWorld(0, r + 1);
    wallQuad(g, A, B, WALL_H, 0, r % 2 === 0 ? 0x15151d : 0x13131a);
    wallQuad(g, A, B, 14, 0, 0x0d0d13);
    wallQuad(g, A, B, WALL_H, WALL_H - 6, 0x1c1c26);
  }

  const c0 = gridToWorld(0, 0), cE = gridToWorld(COLS, 0), cS = gridToWorld(0, ROWS);
  g.moveTo(c0.x, c0.y).lineTo(cE.x, cE.y).stroke({ color: theme.accentNum, width: 2.5, alpha: 0.5 });
  g.moveTo(c0.x, c0.y).lineTo(cS.x, cS.y).stroke({ color: theme.accent2Num, width: 2.5, alpha: 0.4 });

  const pennantColors = [theme.accentNum, 0xffffff, theme.accent2Num, 0xffd166, 0xb387ff];
  for (let i = 0; i < 14; i++) {
    const t = 2 + i * 1.15;
    const P = gridToWorld(t, 0);
    const sag = Math.sin((i / 13) * Math.PI) * 10;
    const y = P.y - WALL_H + 34 + sag;
    g.moveTo(P.x, y).lineTo(P.x + 11, y + 3).lineTo(P.x + 4, y + 18).closePath()
      .fill(pennantColors[i % pennantColors.length]);
  }

  layer.addChild(g);

  // program banner on the NW wall
  const bannerPos = gridToWorld(0, 4.6);
  const banner = new Container();
  const bw = 300, bh = 62;
  const bg = new Graphics();
  bg.roundRect(-bw / 2, -bh / 2, bw, bh, 10).fill({ color: 0x0e0e15, alpha: 0.96 })
    .stroke({ color: theme.accentNum, width: 2.5 });
  bg.moveTo(-bw / 2 + 12, bh / 2 - 10).lineTo(bw / 2 - 12, bh / 2 - 10)
    .stroke({ color: theme.accent2Num, width: 2, alpha: 0.7 });
  const label = new Text({
    text: theme.name.toUpperCase(),
    style: { fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: 25, fontWeight: '900', fill: 0xffffff, letterSpacing: 3 },
    resolution: 2,
  });
  label.anchor.set(0.5, 0.5); label.position.y = -6;
  if (label.width > bw - 40) label.scale.set((bw - 40) / label.width);
  banner.addChild(bg, label);
  banner.position.set(bannerPos.x, bannerPos.y - WALL_H + 62);
  banner.rotation = -WALL_ANGLE;
  layer.addChild(banner);

  // trophy shelf
  const shelfPos = gridToWorld(0, 8.6);
  const shelf = new Container();
  const sg = new Graphics();
  sg.roundRect(-90, 0, 180, 8, 3).fill(0x2a2a36);
  for (let i = 0; i < 3; i++) {
    const x = -55 + i * 55;
    const h = i === 1 ? 30 : 23;
    sg.moveTo(x - 9, -h).quadraticCurveTo(x, -h + 13, x + 9, -h).lineTo(x + 6, -8).lineTo(x - 6, -8).closePath().fill(0xe8b84b);
    sg.rect(x - 8, -8, 16, 4).fill(0xc9992f);
    sg.rect(x - 10, -4, 20, 4).fill(0x8a6a20);
  }
  shelf.addChild(sg);
  shelf.position.set(shelfPos.x, shelfPos.y - WALL_H + 92);
  shelf.rotation = -WALL_ANGLE;
  layer.addChild(shelf);
}

// ─────────────────────────────────────────────────────────────────────────
// Interactables
// ─────────────────────────────────────────────────────────────────────────

function makeInteractables({ rend, theme, getPlayer, emote, say, toast, flash, sfx, travel }) {
  const updaters = [];

  // ── arcade cabinets ──
  for (const cab of CABINETS) {
    const base = gridToWorld(cab.c0 + 1, cab.r + 0.55);
    const c = new Container();
    c.position.set(base.x, base.y);
    c.rotation = WALL_ANGLE;
    const isPortal = cab.key === 'center';

    const W = 150, H = 190;
    const body = new Graphics();
    body.roundRect(-W / 2, -H, W, H, 12).fill(0x101018).stroke({ color: 0x2c2c3a, width: 3 });
    body.roundRect(-W / 2 + 8, -H + 8, W - 16, 34, 8).fill(0x07070c);
    body.roundRect(-W / 2 + 10, -H + 50, W - 20, 88, 8).fill(0x000000).stroke({ color: 0x333342, width: 2.5 });
    body.roundRect(-W / 2 + 10, -34, W - 20, 24, 8).fill(0x191924);
    body.circle(-24, -22, 7).fill(theme.accentNum);
    body.circle(-2, -22, 7).fill(theme.accent2Num);
    body.roundRect(24, -30, 5, 12, 2.5).fill(0x44445a);
    body.circle(26.5, -32, 6.5).fill(0xd8d8e2);
    c.addChild(body);

    const neon = new Graphics();
    neon.roundRect(-W / 2 - 3, -H + 4, 4, H - 8, 2).fill({ color: theme.accentNum, alpha: 0.85 });
    neon.roundRect(W / 2 - 1, -H + 4, 4, H - 8, 2).fill({ color: theme.accent2Num, alpha: 0.85 });
    c.addChild(neon);

    const marquee = new Text({
      text: isPortal ? 'CHEER TOWN' : 'ARCADE',
      style: {
        fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: 16, fontWeight: '900',
        fill: isPortal ? theme.accentNum : 0xd8d8e2, letterSpacing: 2,
      },
      resolution: 2,
    });
    marquee.anchor.set(0.5);
    marquee.position.set(0, -H + 25);
    c.addChild(marquee);

    const screen = new Container();
    screen.position.set(0, -H + 94);
    c.addChild(screen);
    const scr = new Graphics();
    screen.addChild(scr);
    const scrText = new Text({
      text: isPortal ? 'TAP TO PLAY!' : 'COMING\nSOON',
      style: {
        fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: isPortal ? 14 : 16,
        fontWeight: '900', fill: 0xffffff, align: 'center', letterSpacing: 1.5, lineHeight: 19,
      },
      resolution: 2,
    });
    scrText.anchor.set(0.5);
    scrText.position.y = isPortal ? 30 : 6;
    screen.addChild(scrText);

    const SW = W - 24, SH = 84;
    let t = Math.random() * 10;
    updaters.push((dt) => {
      t += dt;
      scr.clear();
      if (isPortal) {
        // Cheer Town, open for business: night sky, lit gym, no more tape
        scr.roundRect(-SW / 2, -SH / 2, SW, SH, 6).fill(0x0b0f1e);
        for (let i = 0; i < 7; i++) {
          const sx = -SW / 2 + 12 + ((i * 37) % (SW - 24));
          const sy = -SH / 2 + 8 + ((i * 13) % 24);
          const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.8 + i * 1.7));
          scr.circle(sx, sy, 1.4).fill({ color: 0xffffff, alpha: tw });
        }
        scr.roundRect(-34, -12, 68, 30, 3).fill(0x1a2138);
        scr.moveTo(-38, -12).lineTo(0, -28).lineTo(38, -12).closePath().fill(0x232c4a);
        scr.roundRect(-7, 2, 14, 16, 2).fill({ color: 0xffd166, alpha: 0.75 + 0.25 * Math.sin(t * 2.4) });
        scrText.alpha = 0.6 + 0.4 * Math.abs(Math.sin(t * 2.2));
      } else {
        scr.roundRect(-SW / 2, -SH / 2, SW, SH, 6).fill(0x0a0a14);
        const sweep = ((t * 60) % (SW + 80)) - SW / 2 - 40;
        scr.moveTo(sweep, -SH / 2).lineTo(sweep + 26, -SH / 2).lineTo(sweep - 8, SH / 2).lineTo(sweep - 34, SH / 2)
          .closePath().fill({ color: theme.accentNum, alpha: 0.16 });
        scr.moveTo(sweep + 34, -SH / 2).lineTo(sweep + 44, -SH / 2).lineTo(sweep + 10, SH / 2).lineTo(sweep, SH / 2)
          .closePath().fill({ color: theme.accent2Num, alpha: 0.12 });
        scrText.alpha = 0.55 + 0.45 * Math.abs(Math.sin(t * 1.6));
      }
    });

    c.eventMode = 'static';
    c.cursor = 'pointer';
    let wobble = 0;
    c.on('pointertap', () => {
      const p = getPlayer();
      if (p && !nearGrid(p.x, p.y, cab.c0 + 1, cab.r + 1.6, 3.2)) {
        toast('Walk up to the cabinet first!');
        return;
      }
      if (isPortal) {
        if (!p) { toast('Observers ride along automatically — athletes start the trip!'); return; }
        sfx.travel();
        travel('town');
        return;
      }
      wobble = 1;
      sfx.tap();
      rend.fx.burst(base.x, base.y - 130, 'spark', 8);
      toast('New game coming soon!');
    });
    updaters.push((dt) => {
      if (wobble > 0) {
        wobble = Math.max(0, wobble - dt * 2.2);
        c.rotation = WALL_ANGLE + Math.sin(wobble * 18) * 0.03 * wobble;
      }
    });

    rend.addObject(c);
  }

  // ── spirit megaphone ──
  {
    const base = gridToWorld(MEGAPHONE.c + 0.5, MEGAPHONE.r + 0.5);
    const c = new Container();
    c.position.set(base.x, base.y);

    const g = new Graphics();
    g.moveTo(0, -8).lineTo(30, 7).lineTo(0, 22).lineTo(-30, 7).closePath().fill(0x1d1d28);
    g.rect(-30, 7, 60, 10).fill(0x15151e);
    g.moveTo(0, 2).lineTo(30, 17).lineTo(30, 7).lineTo(0, -8).closePath().fill(0x181822);
    g.moveTo(-14, -34).lineTo(12, -46).lineTo(12, -18).lineTo(-14, -26).closePath().fill(theme.accentNum);
    g.roundRect(-22, -33, 10, 10, 3).fill(0xd8d8e2);
    g.moveTo(12, -46).quadraticCurveTo(20, -32, 12, -18).stroke({ color: 0xffffff, width: 3 });
    c.addChild(g);

    const glow = new Graphics();
    glow.circle(0, -30, 34).fill({ color: theme.accentNum, alpha: 0.12 });
    c.addChildAt(glow, 0);

    c.eventMode = 'static';
    c.cursor = 'pointer';
    let cool = 0;
    c.on('pointertap', () => {
      if (cool > 0) return;
      const p = getPlayer();
      if (p && !nearGrid(p.x, p.y, MEGAPHONE.c, MEGAPHONE.r, 2.6)) {
        toast('Get closer to the megaphone!');
        return;
      }
      cool = 1.6;
      sfx.megaphone();
      rend.fx.burst(base.x, base.y - 40, 'confetti', 22);
      rend.fx.text(base.x, base.y - 78, 'HIT ZERO!', 0xffffff);
      say?.('HIT ZERO!');
      emote?.('spirit');
    });

    let t = Math.random() * 10;
    updaters.push((dt) => {
      t += dt;
      cool = Math.max(0, cool - dt);
      glow.alpha = 0.6 + 0.4 * Math.sin(t * 2.2);
      glow.scale.set(1 + 0.08 * Math.sin(t * 2.2));
    });

    rend.addObject(c);
  }

  // ── photo booth ──
  {
    const anchor = gridToWorld(1.1, 1.1);
    const c = new Container();
    c.position.set(anchor.x, anchor.y);

    const g = new Graphics();
    const bw = 132, bh = 104;
    g.roundRect(-bw / 2 - 10, -bh - 34, bw + 20, bh + 14, 10).fill(0x241a30);
    for (let i = 0; i < 12; i++) {
      const sx = -bw / 2 + (i * 29) % bw;
      const sy = -bh - 24 + ((i * 41) % (bh - 6));
      g.star ? g.star(sx, sy, 4, 3.4, 1.6).fill({ color: 0xffd166, alpha: 0.75 })
             : g.circle(sx, sy, 2).fill({ color: 0xffd166, alpha: 0.75 });
    }
    g.roundRect(-bw / 2 - 10, -34, bw + 20, 8, 4).fill(0x191220);
    c.addChild(g);
    c.rotation = -WALL_ANGLE;
    rend.addObject(c);

    const camBase = gridToWorld(2.6, 2.6);
    const cam = new Container();
    cam.position.set(camBase.x, camBase.y);
    const cg = new Graphics();
    cg.moveTo(0, 0).lineTo(-12, 26).moveTo(0, 0).lineTo(12, 26).moveTo(0, 0).lineTo(0, 28)
      .stroke({ color: 0x3a3a4c, width: 4, cap: 'round' });
    cg.roundRect(-16, -22, 32, 22, 6).fill(0x22222e).stroke({ color: 0x3a3a4c, width: 2 });
    cg.circle(-10, -11, 7).fill(0x0a0a10).stroke({ color: theme.accent2Num, width: 2.5 });
    cg.circle(11, -17, 3).fill(0xff5555);
    cam.addChild(cg);
    cam.eventMode = 'static';
    cam.cursor = 'pointer';

    const POSES = ['highv', 'sassy', 'jump'];
    let shooting = false;
    cam.on('pointertap', () => {
      const p = getPlayer();
      if (!p) return;
      if (!nearGrid(p.x, p.y, 1, 1, 2.4)) { toast('Hop into the photo booth first!'); return; }
      if (shooting) return;
      shooting = true;
      const pose = POSES[(Math.random() * POSES.length) | 0];
      p.avatar.setPose(pose);
      toast('Say HIT ZERO!');
      setTimeout(() => {
        sfx.shutter();
        flash();
        rend.fx.burst(p.x, p.y - 90, 'star', 16);
      }, 900);
      setTimeout(() => { p.avatar.setPose(null); shooting = false; }, 2300);
    });
    rend.addObject(cam);

    let hinted = false;
    updaters.push(() => {
      const p = getPlayer();
      if (!p) return;
      const inside = nearGrid(p.x, p.y, 1, 1, 1.1);
      if (inside && !hinted) { hinted = true; toast('Tap the camera to strike a pose! 📸'); }
      if (!inside) hinted = false;
    });
  }

  // ── tumble strip ──
  {
    let cool = 0;
    updaters.push((dt) => {
      cool = Math.max(0, cool - dt);
      const p = getPlayer();
      if (!p || cool > 0) return;
      if (p.moving && inZone(p.x, p.y, TUMBLE_TRACK) && !p.avatar.isEmoting()) {
        cool = 2.4;
        sfx.flip();
        emote?.('backflip');
        setTimeout(() => sfx.land(), 700);
      }
    });
  }

  return {
    update(dt) { for (const fn of updaters) fn(dt); },
  };
}
