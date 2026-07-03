// Isometric renderer: builds the clubhouse room, owns the camera, depth
// sorting and the FX particle layer. Static geometry (floor + walls) is
// cached as textures so per-frame draw calls stay low on iPad.

import {
  TILE_W, TILE_H, COLS, ROWS, gridToWorld,
  SPRING_FLOOR, TUMBLE_TRACK, PHOTO_BOOTH, WORLD_BOUNDS,
} from './tilemap.js';

const { Application, Container, Graphics, Text } = PIXI;

const WALL_H = 165;

export async function createRenderer({ theme }) {
  const app = new Application();
  await app.init({
    background: 0x050507,
    resizeTo: window,
    antialias: true,
    resolution: Math.min(2, window.devicePixelRatio || 1),
    autoDensity: true,
  });
  document.getElementById('stage').appendChild(app.canvas);

  const world = new Container();
  app.stage.addChild(world);

  const wallLayer = new Container();
  const floorLayer = new Container();
  const objectLayer = new Container();
  objectLayer.sortableChildren = true;
  const fxLayer = new Container();
  world.addChild(wallLayer, floorLayer, objectLayer, fxLayer);

  buildFloor(floorLayer, theme);
  buildWalls(wallLayer, theme);
  // Cache static geometry to textures (huge draw-call win).
  floorLayer.cacheAsTexture(true);
  wallLayer.cacheAsTexture(true);

  // ─── camera ───
  const center = gridToWorld(COLS / 2, ROWS / 2);
  let camX = center.x, camY = center.y - 60;
  let followFn = null;
  let zoom = fitZoom();
  let targetZoom = zoom;

  function fitZoom() {
    // app.screen is always logical (CSS) pixels. The camera follows the
    // player, so the map may overflow — readability beats fitting it all.
    const w = app.screen.width, h = app.screen.height;
    return Math.max(0.8, Math.min(1.25, Math.max(w / 1500, h / 1000)));
  }
  window.addEventListener('resize', () => { targetZoom = fitZoom(); });

  function follow(fn) { followFn = fn; }

  // drag-to-pan (observers have no avatar to follow)
  let dragging = null;
  function enablePan() {
    app.canvas.addEventListener('pointerdown', (e) => { dragging = { x: e.clientX, y: e.clientY }; });
    window.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      camX -= (e.clientX - dragging.x) / zoom;
      camY -= (e.clientY - dragging.y) / zoom;
      dragging = { x: e.clientX, y: e.clientY };
    });
    window.addEventListener('pointerup', () => { dragging = null; });
  }

  function updateCamera(dt) {
    if (followFn) {
      const t = followFn();
      if (t) {
        const k = Math.min(1, dt * 5.5);
        camX += (t.x - camX) * k;
        camY += ((t.y - 40) - camY) * k;
      }
    }
    zoom += (targetZoom - zoom) * Math.min(1, dt * 4);
    camX = Math.max(WORLD_BOUNDS.minX, Math.min(WORLD_BOUNDS.maxX, camX));
    camY = Math.max(WORLD_BOUNDS.minY, Math.min(WORLD_BOUNDS.maxY, camY));
    world.scale.set(zoom);
    world.position.set(app.screen.width / 2 - camX * zoom, app.screen.height / 2 - camY * zoom);
  }

  // ─── fx particles ───
  const particles = [];
  const FX_COLORS = {
    star: [theme.accentNum, 0xffd166, 0xffffff],
    spark: [0xffffff, theme.accent2Num, theme.accentNum],
    heart: [theme.accentNum, 0xff4f79, 0xffb3cc],
    confetti: [theme.accentNum, theme.accent2Num, 0xffd166, 0xffffff, 0xb387ff],
  };

  function spawnShape(kind, color) {
    const g = new Graphics();
    if (kind === 'heart') {
      g.moveTo(0, 3).bezierCurveTo(-7, -4, -3, -10, 0, -5).bezierCurveTo(3, -10, 7, -4, 0, 3).fill(color);
    } else if (kind === 'star') {
      star(g, 0, 0, 5, 6, 2.6).fill(color);
    } else if (kind === 'confetti') {
      g.rect(-3, -2, 6, 4).fill(color);
    } else {
      g.circle(0, 0, 2.6).fill(color);
    }
    return g;
  }

  const fx = {
    burst(x, y, kind = 'spark', count = 14) {
      const colors = FX_COLORS[kind] || FX_COLORS.spark;
      for (let i = 0; i < count; i++) {
        const g = spawnShape(kind, colors[i % colors.length]);
        g.position.set(x, y);
        const a = Math.random() * Math.PI * 2;
        const sp = 60 + Math.random() * 150;
        particles.push({
          g, x, y,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 70,
          life: 0.75 + Math.random() * 0.5, age: 0,
          spin: (Math.random() - 0.5) * 9,
          grav: kind === 'confetti' ? 260 : 150,
        });
        fxLayer.addChild(g);
      }
    },
    text(x, y, str, color = 0xffffff) {
      const t = new Text({
        text: str,
        style: {
          fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: 30, fontWeight: '900',
          fill: color, stroke: { color: theme.accentNum, width: 4 }, letterSpacing: 1,
        },
        resolution: 2,
      });
      t.anchor.set(0.5);
      t.position.set(x, y);
      particles.push({ g: t, x, y, vx: 0, vy: -55, life: 1.0, age: 0, spin: 0, grav: -20, pop: true });
      fxLayer.addChild(t);
    },
  };

  function updateFx(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.age += dt;
      if (p.age >= p.life) { p.g.destroy(); particles.splice(i, 1); continue; }
      p.vy += p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.g.position.set(p.x, p.y);
      p.g.rotation += p.spin * dt;
      const k = p.age / p.life;
      p.g.alpha = 1 - k * k;
      if (p.pop) p.g.scale.set(0.6 + Math.min(1, p.age * 6) * 0.55);
    }
  }

  // ─── ticker ───
  const tickers = [];
  app.ticker.add((t) => {
    const dt = Math.min(0.05, t.deltaMS / 1000);
    for (const fn of tickers) fn(dt);
    // depth sort: zIndex = world y for everything dynamic
    for (const child of objectLayer.children) {
      if (child._dynamicDepth) child.zIndex = child.y;
    }
    updateCamera(dt);
    updateFx(dt);
  });

  return {
    app, world, objectLayer, fxLayer, fx, theme,
    follow, enablePan,
    onTick(fn) { tickers.push(fn); },
    addObject(container, { dynamic = false } = {}) {
      container._dynamicDepth = dynamic;
      if (!dynamic) container.zIndex = container.y;
      objectLayer.addChild(container);
      return container;
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Room construction
// ─────────────────────────────────────────────────────────────────────────

function tileDiamond(g, c, r, color, alpha = 1) {
  const p0 = gridToWorld(c, r), p1 = gridToWorld(c + 1, r);
  const p2 = gridToWorld(c + 1, r + 1), p3 = gridToWorld(c, r + 1);
  g.moveTo(p0.x, p0.y).lineTo(p1.x, p1.y).lineTo(p2.x, p2.y).lineTo(p3.x, p3.y).closePath()
    .fill({ color, alpha });
}

function inRect(c, r, z) { return c >= z.c0 && c <= z.c1 && r >= z.r0 && r <= z.r1; }

function buildFloor(layer, theme) {
  const g = new Graphics();

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (inRect(c, r, SPRING_FLOOR)) {
        // spring floor: alternating panel strips (classic 9-panel look)
        const strip = (c - SPRING_FLOOR.c0) % 2 === 0;
        tileDiamond(g, c, r, strip ? 0x2a3150 : 0x242a45);
      } else if (inRect(c, r, TUMBLE_TRACK)) {
        tileDiamond(g, c, r, 0x352a4a);
      } else if (inRect(c, r, PHOTO_BOOTH)) {
        tileDiamond(g, c, r, 0x241a2c);
      } else {
        // rubber gym floor: subtle checker
        tileDiamond(g, c, r, (c + r) % 2 === 0 ? 0x1a1a24 : 0x171720);
      }
    }
  }

  // grout lines (very subtle grid)
  for (let r = 0; r <= ROWS; r++) {
    const a = gridToWorld(0, r), b = gridToWorld(COLS, r);
    g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ color: 0x000000, width: 1, alpha: 0.25 });
  }
  for (let c = 0; c <= COLS; c++) {
    const a = gridToWorld(c, 0), b = gridToWorld(c, ROWS);
    g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ color: 0x000000, width: 1, alpha: 0.25 });
  }

  // spring floor accent tape border
  const sf = SPRING_FLOOR;
  const q = [gridToWorld(sf.c0, sf.r0), gridToWorld(sf.c1 + 1, sf.r0), gridToWorld(sf.c1 + 1, sf.r1 + 1), gridToWorld(sf.c0, sf.r1 + 1)];
  g.moveTo(q[0].x, q[0].y).lineTo(q[1].x, q[1].y).lineTo(q[2].x, q[2].y).lineTo(q[3].x, q[3].y).closePath()
    .stroke({ color: theme.accentNum, width: 4, alpha: 0.75 });

  // center mat emblem: soft accent diamond + "HIT ZERO" feel without text clutter
  const mid = gridToWorld((sf.c0 + sf.c1 + 1) / 2, (sf.r0 + sf.r1 + 1) / 2);
  g.moveTo(mid.x, mid.y - 44).lineTo(mid.x + 88, mid.y).lineTo(mid.x, mid.y + 44).lineTo(mid.x - 88, mid.y).closePath()
    .stroke({ color: theme.accentNum, width: 3, alpha: 0.4 });
  g.moveTo(mid.x, mid.y - 26).lineTo(mid.x + 52, mid.y).lineTo(mid.x, mid.y + 26).lineTo(mid.x - 52, mid.y).closePath()
    .fill({ color: theme.accentNum, alpha: 0.10 });

  // tumble track center line
  const tt = TUMBLE_TRACK;
  const ta = gridToWorld(tt.c0 + 0.5, tt.r0), tb = gridToWorld(tt.c0 + 0.5, tt.r1 + 1);
  g.moveTo(ta.x, ta.y).lineTo(tb.x, tb.y).stroke({ color: 0xffffff, width: 3, alpha: 0.35 });
  const tq = [gridToWorld(tt.c0, tt.r0), gridToWorld(tt.c1 + 1, tt.r0), gridToWorld(tt.c1 + 1, tt.r1 + 1), gridToWorld(tt.c0, tt.r1 + 1)];
  g.moveTo(tq[0].x, tq[0].y).lineTo(tq[1].x, tq[1].y).lineTo(tq[2].x, tq[2].y).lineTo(tq[3].x, tq[3].y).closePath()
    .stroke({ color: 0xb387ff, width: 3, alpha: 0.55 });

  layer.addChild(g);
}

// Wall quad helper: edge from grid point A to B, extruded upward.
function wallQuad(g, A, B, yTop, yBottom, color, alpha = 1) {
  g.moveTo(A.x, A.y - yTop).lineTo(B.x, B.y - yTop)
    .lineTo(B.x, B.y - yBottom).lineTo(A.x, A.y - yBottom).closePath()
    .fill({ color, alpha });
}

function buildWalls(layer, theme) {
  const g = new Graphics();

  // NE wall (along r=0) — cabinets hang here; slightly lighter (key light)
  for (let c = 0; c < COLS; c++) {
    const A = gridToWorld(c, 0), B = gridToWorld(c + 1, 0);
    wallQuad(g, A, B, WALL_H, 0, c % 2 === 0 ? 0x1b1b25 : 0x191922);
    wallQuad(g, A, B, 14, 0, 0x101018); // baseboard
    wallQuad(g, A, B, WALL_H, WALL_H - 6, 0x22222e); // crown
  }
  // NW wall (along c=0) — darker (shadow side)
  for (let r = 0; r < ROWS; r++) {
    const A = gridToWorld(0, r), B = gridToWorld(0, r + 1);
    wallQuad(g, A, B, WALL_H, 0, r % 2 === 0 ? 0x15151d : 0x13131a);
    wallQuad(g, A, B, 14, 0, 0x0d0d13);
    wallQuad(g, A, B, WALL_H, WALL_H - 6, 0x1c1c26);
  }

  // accent glow strip where walls meet floor
  const c0 = gridToWorld(0, 0), cE = gridToWorld(COLS, 0), cS = gridToWorld(0, ROWS);
  g.moveTo(c0.x, c0.y).lineTo(cE.x, cE.y).stroke({ color: theme.accentNum, width: 2.5, alpha: 0.5 });
  g.moveTo(c0.x, c0.y).lineTo(cS.x, cS.y).stroke({ color: theme.accent2Num, width: 2.5, alpha: 0.4 });

  // pennant string across the NE wall
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

  // Program banner on the NW wall — flat text rotated to the wall angle.
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
    style: {
      fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: 25, fontWeight: '900',
      fill: 0xffffff, letterSpacing: 3,
    },
    resolution: 2,
  });
  label.anchor.set(0.5, 0.5); label.position.y = -6;
  // scale banner text down if the gym name runs long
  if (label.width > bw - 40) label.scale.set((bw - 40) / label.width);
  banner.addChild(bg, label);
  banner.position.set(bannerPos.x, bannerPos.y - WALL_H + 62);
  banner.rotation = -Math.atan2(TILE_H / 2, TILE_W / 2); // lie on the NW wall plane
  layer.addChild(banner);

  // trophy shelf on NW wall, below the banner
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
  shelf.rotation = -Math.atan2(TILE_H / 2, TILE_W / 2);
  layer.addChild(shelf);
}

function star(g, x, y, points, outer, inner) {
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
