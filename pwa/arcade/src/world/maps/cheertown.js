// CHEER TOWN — the Brookhaven-style roleplay slice. One outdoor dusk scene:
// the kid's own gym (program-branded) on Main Street with five houses,
// a golf cart, a park, and a gym interior "island" on the same grid
// (teleport doors keep exterior/interior apart without a scene switch).
//
// Grid 40×13:  cols 0-25 = town   cols 26-29 = void   cols 30-39 = gym interior

import {
  TILE_W, TILE_H, gridToWorld, makeCanStand, makeBlockedSet, boundsFor,
  inZone, nearGrid,
} from '../tilemap.js';

const { Container, Graphics, Text } = PIXI;

const COLS = 40;
const ROWS = 13;
const WALL_ANGLE = Math.atan2(TILE_H / 2, TILE_W / 2);

// ─── Layout ───
const STREET      = { c0: 0, r0: 5, c1: 25, r1: 6 };
const SIDEWALK_N  = { c0: 0, r0: 4, c1: 25, r1: 4 };
const SIDEWALK_S  = { c0: 0, r0: 7, c1: 25, r1: 7 };
const GYM         = { c0: 9, r0: 0, c1: 16, r1: 2 };   // building footprint
const GYM_DOOR    = { c: 12, r: 3 };                    // walk-on mat (2 wide)
const HOUSES = [
  { c0: 1,  c1: 3,  color: 0x8f5aa8 },  // purple
  { c0: 5,  c1: 7,  color: 0x4a7fb5 },  // blue
  { c0: 18, c1: 20, color: 0xb5638f },  // rose
  { c0: 22, c1: 24, color: 0x5aa87f },  // green
];
const HOUSE_S = { c0: 2, c1: 4, color: 0xb08a4f };      // tan house in the park row
const PARK        = { c0: 0, r0: 8, c1: 25, r1: 12 };
const PRACTICE_MAT = { c0: 12, r0: 9, c1: 15, r1: 11 }; // outdoor tumbling patch
const PORTAL      = { c0: 0, r0: 5, c1: 0, r1: 6 };     // back to the lobby
const CART_PARK   = { c: 6, r: 6 };

// interior island
const IN = { c0: 30, r0: 0, c1: 39, r1: 12 };
const IN_SPRING = { c0: 32, r0: 3, c1: 38, r1: 8 };
const IN_DOOR   = { c: 31, r: 11 };                     // walk-on mat → outside
const JUDGES    = { c0: 33, c1: 37, r: 0 };             // table along north wall
const PERFORM   = { c: 35, r: 5 };                      // glowing star spot
const PODIUM    = { c: 38, r: 10 };

export const SPAWN_FROM_LOBBY = { c: 3, r: 5.5 };
const SPAWN_INTERIOR = { c: 33, r: 10 };
const SPAWN_GYM_FRONT = { c: 13.5, r: 3.5 };

// ─── Collision ───
const collision = makeBlockedSet(COLS, ROWS);
collision.blockRect(GYM.c0, GYM.r0, GYM.c1, GYM.r1);
for (const h of HOUSES) collision.blockRect(h.c0, 0, h.c1, 1);
collision.blockRect(HOUSE_S.c0, 10, HOUSE_S.c1, 11);
collision.blockRect(26, 0, 29, ROWS - 1);               // void between town + interior
collision.blockRect(JUDGES.c0, 0, JUDGES.c1, 1);        // judges' table
collision.block(PODIUM.c, PODIUM.r);
// park trees
const TREES = [[7, 9], [9, 11], [18, 9], [21, 11], [24, 9], [0, 3], [8, 3], [17, 3], [25, 3]];
for (const [c, r] of TREES) collision.block(c, r);

export const cheertownMap = {
  key: 'town',
  cols: COLS,
  rows: ROWS,
  spawn: SPAWN_FROM_LOBBY,
  bounds: boundsFor(COLS, ROWS),
  canStand: makeCanStand(collision.isBlocked),
  build,
  makeInteractables,
  // Super Squad
  npcs: [
    {
      name: 'Sparkle',
      avatar: { skin: 0, hair: 'long', hairColor: 5, bow: 3, uniform: 2, cape: 2 },
      home: { c0: 3, r0: 4, c1: 22, r1: 7 },
      superset: ['superjump', 'kickdouble'],
    },
    {
      name: 'Miss Flip',
      avatar: { skin: 3, hair: 'ponytail', hairColor: 0, bow: 1, uniform: 1, cape: 3 },
      home: { c0: 32, r0: 4, c1: 38, r1: 8 },
      superset: ['fulltwist', 'doublefull', 'kickdouble'],
      pass: { from: { c: 32.5, r: 8 }, to: { c: 38, r: 4 } },
    },
  ],
  minimap: {
    regions: [
      { c0: 0, r0: 0, c1: 25, r1: ROWS - 1, color: '#18261c' },                          // grass
      { ...SIDEWALK_N, color: '#30303a' }, { ...SIDEWALK_S, color: '#30303a' },
      { ...STREET, color: '#22222c' },
      { ...GYM, color: '#2b2b3d' },
      ...HOUSES.map(h => ({ c0: h.c0, r0: 0, c1: h.c1, r1: 1, color: hex(h.color) })),
      { c0: HOUSE_S.c0, r0: 10, c1: HOUSE_S.c1, r1: 11, color: hex(HOUSE_S.color) },
      { ...PRACTICE_MAT, color: '#2a3150' },
      { c0: IN.c0, r0: 0, c1: IN.c1, r1: ROWS - 1, color: '#1a1a24' },                   // gym interior
      { ...IN_SPRING, color: '#2a3150' },
    ],
    pois: [
      { c: GYM_DOOR.c + 1, r: GYM_DOOR.r + 0.5, color: 'accent' },                       // gym door
      { c: PERFORM.c + 0.5, r: PERFORM.r + 0.5, color: '#ffd166' },                      // comp star
      { c: PORTAL.c0 + 0.5, r: 6, color: '#b387ff' },                                    // lobby portal
      { c: CART_PARK.c + 0.5, r: CART_PARK.r + 0.5, color: '#f4f4f8' },                  // golf cart
    ],
  },
};

function hex(n) { return '#' + n.toString(16).padStart(6, '0'); }

// ─────────────────────────────────────────────────────────────────────────
// Geometry
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

// iso box building: SW + SE faces + roof. Returns roof center for signage.
function boxBuilding(g, c0, r0, c1, r1, h, { face, faceDark, roof }) {
  const A = gridToWorld(c0, r1 + 1), B = gridToWorld(c1 + 1, r1 + 1), C = gridToWorld(c1 + 1, r0);
  wallQuad(g, A, B, h, 0, face);           // SW face (toward camera-left)
  wallQuad(g, B, C, h, 0, faceDark);       // SE face (toward camera-right)
  const R = [gridToWorld(c0, r0), gridToWorld(c1 + 1, r0), gridToWorld(c1 + 1, r1 + 1), gridToWorld(c0, r1 + 1)];
  g.moveTo(R[0].x, R[0].y - h).lineTo(R[1].x, R[1].y - h).lineTo(R[2].x, R[2].y - h).lineTo(R[3].x, R[3].y - h)
    .closePath().fill(roof);
  const mid = gridToWorld((c0 + c1 + 1) / 2, (r0 + r1 + 1) / 2);
  return { x: mid.x, y: mid.y - h };
}

function build(layers, theme, addObject) {
  buildGround(layers.floor, theme);
  buildInteriorWalls(layers.walls, theme);
  buildObjects(addObject, theme);
}

function buildGround(layer, theme) {
  const g = new Graphics();

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (c >= 26 && c <= 29) continue; // void
      if (c >= IN.c0) {
        // gym interior floor
        if (inRect(c, r, IN_SPRING)) {
          const strip = (c - IN_SPRING.c0) % 2 === 0;
          tileDiamond(g, c, r, strip ? 0x2a3150 : 0x242a45);
        } else {
          tileDiamond(g, c, r, (c + r) % 2 === 0 ? 0x1a1a24 : 0x171720);
        }
        continue;
      }
      // town at dusk
      if (inRect(c, r, STREET)) tileDiamond(g, c, r, 0x22222c);
      else if (inRect(c, r, SIDEWALK_N) || inRect(c, r, SIDEWALK_S)) tileDiamond(g, c, r, (c % 2 === 0) ? 0x34343e : 0x30303a);
      else if (inRect(c, r, PRACTICE_MAT)) tileDiamond(g, c, r, (c + r) % 2 === 0 ? 0x2a3150 : 0x242a45);
      else tileDiamond(g, c, r, (c + r) % 2 === 0 ? 0x1b2a20 : 0x18261c); // grass
    }
  }

  // street center dashed line
  for (let c = 0; c < 26; c += 2) {
    const a = gridToWorld(c + 0.2, 6), b = gridToWorld(c + 1.2, 6);
    g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ color: 0xd9b64a, width: 4, alpha: 0.7 });
  }

  // practice mat tape border
  const pm = PRACTICE_MAT;
  const q = [gridToWorld(pm.c0, pm.r0), gridToWorld(pm.c1 + 1, pm.r0), gridToWorld(pm.c1 + 1, pm.r1 + 1), gridToWorld(pm.c0, pm.r1 + 1)];
  g.moveTo(q[0].x, q[0].y).lineTo(q[1].x, q[1].y).lineTo(q[2].x, q[2].y).lineTo(q[3].x, q[3].y).closePath()
    .stroke({ color: theme.accentNum, width: 3.5, alpha: 0.7 });

  // interior spring floor tape + perform star ring
  const sf = IN_SPRING;
  const iq = [gridToWorld(sf.c0, sf.r0), gridToWorld(sf.c1 + 1, sf.r0), gridToWorld(sf.c1 + 1, sf.r1 + 1), gridToWorld(sf.c0, sf.r1 + 1)];
  g.moveTo(iq[0].x, iq[0].y).lineTo(iq[1].x, iq[1].y).lineTo(iq[2].x, iq[2].y).lineTo(iq[3].x, iq[3].y).closePath()
    .stroke({ color: theme.accentNum, width: 4, alpha: 0.75 });
  const ps = gridToWorld(PERFORM.c + 0.5, PERFORM.r + 0.5);
  g.circle(ps.x, ps.y, 30).stroke({ color: 0xffd166, width: 3, alpha: 0.7 });
  starShape(g, ps.x, ps.y, 5, 14, 6).fill({ color: 0xffd166, alpha: 0.85 });

  // flowers along the sidewalks + park
  const FLOWERS = [[1.3, 7.6], [4.7, 7.4], [10.2, 7.7], [16.6, 7.5], [23.3, 7.6], [6.5, 9.3], [11.2, 10.6], [19.5, 10.3], [23, 9.6], [1.5, 9.8]];
  const petals = [0xf27fb2, 0xffd166, 0xb387ff, 0x74d7db];
  FLOWERS.forEach(([c, r], i) => {
    const p = gridToWorld(c, r);
    g.circle(p.x, p.y - 3, 3.2).fill(petals[i % petals.length]);
    g.circle(p.x, p.y - 3, 1.2).fill(0xffe9a8);
    g.moveTo(p.x, p.y - 2).lineTo(p.x, p.y + 4).stroke({ color: 0x3f6b4a, width: 1.6 });
  });

  // teleport mats: gym front door + interior exit (glowing)
  matGlow(g, GYM_DOOR.c, GYM_DOOR.r, 2, theme.accentNum);
  matGlow(g, IN_DOOR.c, IN_DOOR.r, 1, theme.accent2Num);
  // lobby portal
  matGlow(g, PORTAL.c0, PORTAL.r0, 1, 0xb387ff);
  matGlow(g, PORTAL.c0, PORTAL.r1, 1, 0xb387ff);

  layer.addChild(g);
}

function matGlow(g, c, r, w, color) {
  const p0 = gridToWorld(c, r), p1 = gridToWorld(c + w, r);
  const p2 = gridToWorld(c + w, r + 1), p3 = gridToWorld(c, r + 1);
  g.moveTo(p0.x, p0.y).lineTo(p1.x, p1.y).lineTo(p2.x, p2.y).lineTo(p3.x, p3.y).closePath()
    .fill({ color, alpha: 0.22 })
    .stroke({ color, width: 3, alpha: 0.85 });
}

// Interior perimeter walls live in the walls layer (always behind, like the
// lobby) — safe because nothing walkable is screen-above them.
function buildInteriorWalls(layer, theme) {
  const g = new Graphics();
  for (let c = IN.c0; c < COLS; c++) {
    const A = gridToWorld(c, 0), B = gridToWorld(c + 1, 0);
    wallQuad(g, A, B, 150, 0, c % 2 === 0 ? 0x1b1b25 : 0x191922);
    wallQuad(g, A, B, 12, 0, 0x101018);
  }
  for (let r = 0; r < ROWS; r++) {
    const A = gridToWorld(IN.c0, r), B = gridToWorld(IN.c0, r + 1);
    wallQuad(g, A, B, 150, 0, r % 2 === 0 ? 0x15151d : 0x13131a);
    wallQuad(g, A, B, 12, 0, 0x0d0d13);
  }
  layer.addChild(g);

  // "PRETEND COMP" banner hangs on the north wall
  const bp = gridToWorld(35.5, 0);
  const banner = new Container();
  const label = new Text({
    text: '⭐ PRETEND COMP ⭐',
    style: { fontFamily: 'system-ui, sans-serif', fontSize: 20, fontWeight: '900', fill: 0xffffff, letterSpacing: 2 },
    resolution: 2,
  });
  label.anchor.set(0.5);
  const bg2 = new Graphics();
  bg2.roundRect(-150, -24, 300, 48, 10).fill({ color: 0x0e0e15, alpha: 0.96 }).stroke({ color: 0xffd166, width: 2.5 });
  banner.addChild(bg2, label);
  banner.position.set(bp.x, bp.y - 96);
  banner.rotation = WALL_ANGLE;
  layer.addChild(banner);
}

// Everything that stands ON the ground is a depth-sorted object so avatars
// can walk both in front of and behind it. z = the feature's front-edge y.
function buildObjects(addObject, theme) {
  const obj = (z) => {
    const c = new Container();
    addObject(c, { z });
    return c;
  };

  // ── THE GYM — the centerpiece, program-branded ──
  {
    const front = gridToWorld(GYM.c0 + (GYM.c1 - GYM.c0 + 1) / 2, GYM.r1 + 1);
    const c = obj(front.y);
    const g = new Graphics();
    const gymTop = boxBuilding(g, GYM.c0, GYM.r0, GYM.c1, GYM.r1, 150, {
      face: 0x2b2b3d, faceDark: 0x232332, roof: 0x1c1c28,
    });
    c.addChild(g);

    // glass entrance on the SW face above the door mat
    const D = gridToWorld(GYM_DOOR.c + 1, GYM.r1 + 1);
    const door = new Graphics();
    door.roundRect(-46, -74, 92, 74, 6).fill({ color: 0xffd166, alpha: 0.28 })
      .stroke({ color: theme.accentNum, width: 3 });
    door.moveTo(0, -74).lineTo(0, 0).stroke({ color: theme.accentNum, width: 2.5 });
    door.roundRect(-46, -84, 92, 10, 4).fill(theme.accentNum);
    const dc = new Container();
    dc.addChild(door);
    dc.position.set(D.x, D.y);
    dc.rotation = WALL_ANGLE;
    c.addChild(dc);

    // windows strip on SW face
    const W = new Graphics();
    for (let i = 0; i < 5; i++) {
      W.roundRect(i * 88, -128, 56, 30, 4).fill({ color: 0x9fd8ff, alpha: 0.16 })
        .stroke({ color: 0x44445a, width: 2 });
    }
    const wc = new Container();
    wc.addChild(W);
    const P = gridToWorld(GYM.c0 + 0.4, GYM.r1 + 1);
    wc.position.set(P.x, P.y);
    wc.rotation = WALL_ANGLE;
    c.addChild(wc);

    // rooftop sign: program name in lights + giant bow
    const sign = new Container();
    const label = new Text({
      text: theme.name.toUpperCase(),
      style: {
        fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: 30, fontWeight: '900',
        fill: 0xffffff, letterSpacing: 3, stroke: { color: theme.accentNum, width: 5 },
      },
      resolution: 2,
    });
    label.anchor.set(0.5);
    const bw = Math.max(240, label.width + 50);
    const bg = new Graphics();
    bg.roundRect(-bw / 2, -30, bw, 60, 12).fill({ color: 0x10101a, alpha: 0.95 })
      .stroke({ color: theme.accent2Num, width: 3 });
    sign.addChild(bg, label);
    if (label.width > bw - 40) label.scale.set((bw - 40) / label.width);
    sign.position.set(gymTop.x, gymTop.y - 46);
    c.addChild(sign);
    const bow = new Graphics();
    const bx = gymTop.x - bw / 2 - 34, by = gymTop.y - 52;
    bow.moveTo(bx - 4, by).quadraticCurveTo(bx - 26, by - 18, bx - 20, by + 6).quadraticCurveTo(bx - 12, by + 12, bx - 4, by).closePath().fill(theme.accentNum);
    bow.moveTo(bx + 4, by).quadraticCurveTo(bx + 26, by - 18, bx + 20, by + 6).quadraticCurveTo(bx + 12, by + 12, bx + 4, by).closePath().fill(theme.accentNum);
    bow.circle(bx, by + 1, 6).fill(theme.accentNum);
    c.addChild(bow);
  }

  // ── houses ──
  for (const h of HOUSES) addHouse(obj, h.c0, 0, h.c1, 1, h.color);
  addHouse(obj, HOUSE_S.c0, 10, HOUSE_S.c1, 11, HOUSE_S.color);

  // ── trees ──
  for (const [c, r] of TREES) {
    const p = gridToWorld(c + 0.5, r + 0.5);
    const t = obj(p.y + 10);
    const g = new Graphics();
    g.roundRect(p.x - 5, p.y - 34, 10, 34, 4).fill(0x4a3826);
    g.circle(p.x, p.y - 52, 26).fill(0x24402c);
    g.circle(p.x - 16, p.y - 40, 18).fill(0x1f3826);
    g.circle(p.x + 16, p.y - 42, 19).fill(0x28472f);
    g.circle(p.x - 4, p.y - 62, 15).fill(0x2b4c33);
    t.addChild(g);
  }

  // ── streetlights ──
  for (const cc of [3.5, 9.5, 15.5, 21.5]) {
    for (const rr of [4.15, 7.85]) {
      const p = gridToWorld(cc, rr);
      const l = obj(p.y + 2);
      const g = new Graphics();
      g.moveTo(p.x, p.y).lineTo(p.x, p.y - 74).stroke({ color: 0x3a3a4c, width: 4, cap: 'round' });
      g.circle(p.x, p.y - 78, 7).fill({ color: 0xffd166, alpha: 0.95 });
      g.circle(p.x, p.y - 78, 12).fill({ color: 0xffd166, alpha: 0.18 });
      l.addChild(g);
    }
  }

  // ── stop sign ──
  {
    const p = gridToWorld(17.5, 4.15);
    const c = obj(p.y + 2);
    const g = new Graphics();
    g.moveTo(p.x, p.y).lineTo(p.x, p.y - 58).stroke({ color: 0x8a8a96, width: 4, cap: 'round' });
    const s = 13;
    for (let i = 0; i < 8; i++) {
      const a = Math.PI / 8 + i * Math.PI / 4;
      const x = p.x + Math.cos(a) * s, y = p.y - 66 + Math.sin(a) * s;
      i === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
    }
    g.closePath().fill(0xc0392b).stroke({ color: 0xffffff, width: 2 });
    c.addChild(g);
    const st = new Text({
      text: 'STOP',
      style: { fontFamily: 'system-ui, sans-serif', fontSize: 9, fontWeight: '900', fill: 0xffffff },
      resolution: 2,
    });
    st.anchor.set(0.5);
    st.position.set(p.x, p.y - 66);
    c.addChild(st);
  }

  // ── CHEER TOWN park sign ──
  {
    const p = gridToWorld(3.5, 12.1);
    const c = obj(p.y);
    const sign = new Container();
    const label = new Text({
      text: 'CHEER TOWN',
      style: {
        fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: 22, fontWeight: '900',
        fill: 0xffffff, letterSpacing: 4, stroke: { color: 0xb387ff, width: 4 },
      },
      resolution: 2,
    });
    label.anchor.set(0.5);
    const bg = new Graphics();
    bg.roundRect(-110, -26, 220, 52, 10).fill({ color: 0x141420, alpha: 0.95 }).stroke({ color: 0xb387ff, width: 2.5 });
    bg.moveTo(-88, 26).lineTo(-88, 46).moveTo(88, 26).lineTo(88, 46).stroke({ color: 0x4a3826, width: 6 });
    sign.addChild(bg, label);
    sign.position.set(p.x, p.y - 46);
    c.addChild(sign);
  }

  // ── judges' table with three chibi judges (interior) ──
  {
    const jt = gridToWorld((JUDGES.c0 + JUDGES.c1 + 1) / 2, 1.6);
    const c = obj(jt.y + 6);
    const table = new Graphics();
    table.moveTo(-120, -14).lineTo(120, -14).lineTo(140, 4).lineTo(-140, 4).closePath().fill(0x2a2a38);
    table.rect(-140, 4, 280, 26).fill(0x1f1f2c);
    table.moveTo(-136, 16).lineTo(136, 16).stroke({ color: 0xffd166, width: 2, alpha: 0.5 });
    for (let i = -1; i <= 1; i++) {
      const x = i * 82;
      table.circle(x, -34, 15).fill([0xf3c29e, 0xd99e6f, 0xffdbc4][i + 1]);
      table.circle(x, -34, 15.5).stroke({ color: 0xffffff, width: 1, alpha: 0.15 });
      table.moveTo(x - 15, -40).arc(x, -40, 15, Math.PI, 0).closePath().fill([0x2d2019, 0x0e0c0b, 0x8c3f23][i + 1]);
      table.circle(x - 5, -33, 1.8).fill(0x231a18);
      table.circle(x + 5, -33, 1.8).fill(0x231a18);
      table.roundRect(x - 18, -22, 36, 10, 4).fill(0x30304a);
      table.roundRect(x - 10, -8, 20, 13, 2).fill(0xf4f4f8);
      table.moveTo(x - 6, -2).lineTo(x + 6, -2).stroke({ color: 0x14141c, width: 1.6 });
    }
    const tc = new Container();
    tc.addChild(table);
    tc.position.set(jt.x, jt.y);
    c.addChild(tc);
  }

  // ── podium (1-2-3, interior) ──
  {
    const pp = gridToWorld(PODIUM.c + 0.5, PODIUM.r + 0.5);
    const c = obj(pp.y + 14);
    const g = new Graphics();
    g.moveTo(pp.x - 58, pp.y).lineTo(pp.x - 18, pp.y - 20).lineTo(pp.x - 18, pp.y + 10).lineTo(pp.x - 58, pp.y + 26).closePath().fill(0x30304a);
    g.moveTo(pp.x - 18, pp.y - 34).lineTo(pp.x + 22, pp.y - 52).lineTo(pp.x + 22, pp.y - 4).lineTo(pp.x - 18, pp.y + 12).closePath().fill(0x3c3c5c);
    g.moveTo(pp.x + 22, pp.y - 8).lineTo(pp.x + 60, pp.y - 22).lineTo(pp.x + 60, pp.y + 4).lineTo(pp.x + 22, pp.y + 18).closePath().fill(0x28283e);
    c.addChild(g);
  }
}

function addHouse(obj, c0, r0, c1, r1, color) {
  const front = gridToWorld((c0 + c1 + 1) / 2, r1 + 1);
  const c = obj(front.y);
  const g = new Graphics();
  const dark = darken(color, 0.72);
  boxBuilding(g, c0, r0, c1, r1, 96, { face: color, faceDark: dark, roof: 0x262633 });
  c.addChild(g);
  const dg = new Graphics();
  dg.roundRect(-14, -46, 28, 46, 4).fill(0x2a2032).stroke({ color: 0x14141c, width: 2 });
  dg.circle(8, -22, 2.2).fill(0xffd166);
  dg.roundRect(-52, -60, 24, 20, 3).fill({ color: 0xffd166, alpha: 0.55 }).stroke({ color: 0x14141c, width: 2 });
  dg.roundRect(28, -60, 24, 20, 3).fill({ color: 0xffd166, alpha: 0.55 }).stroke({ color: 0x14141c, width: 2 });
  const dc = new Container();
  dc.addChild(dg);
  dc.position.set(front.x, front.y);
  dc.rotation = WALL_ANGLE;
  c.addChild(dc);
}

function darken(hex, k) {
  const r = ((hex >> 16) & 255) * k, g = ((hex >> 8) & 255) * k, b = (hex & 255) * k;
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
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

// ─────────────────────────────────────────────────────────────────────────
// Interactables + town rules
// ─────────────────────────────────────────────────────────────────────────

function makeInteractables({ rend, theme, getPlayer, emote, say, toast, sfx, travel, teleport, setCart }) {
  const updaters = [];

  // ── teleport doors (walk on) + lobby portal ──
  {
    let cool = 0;
    updaters.push((dt) => {
      cool = Math.max(0, cool - dt);
      const p = getPlayer();
      if (!p || cool > 0) return;
      if (inZone(p.x, p.y, { c0: GYM_DOOR.c, r0: GYM_DOOR.r, c1: GYM_DOOR.c + 1, r1: GYM_DOOR.r })) {
        cool = 1.4;
        sfx.travel();
        teleport(SPAWN_INTERIOR.c, SPAWN_INTERIOR.r);
        toast('Welcome to the gym! ⭐ Try the star on the mat');
      } else if (inZone(p.x, p.y, { c0: IN_DOOR.c, r0: IN_DOOR.r, c1: IN_DOOR.c, r1: IN_DOOR.r })) {
        cool = 1.4;
        sfx.travel();
        teleport(SPAWN_GYM_FRONT.c, SPAWN_GYM_FRONT.r);
      } else if (inZone(p.x, p.y, PORTAL)) {
        cool = 2.0;
        sfx.travel();
        travel('lobby');
      }
    });
  }

  // ── golf cart ──
  {
    const base = gridToWorld(CART_PARK.c + 0.5, CART_PARK.r + 0.5);
    const c = new Container();
    c.position.set(base.x, base.y);
    const cg = new Graphics();
    drawCartShape(cg, theme);
    c.addChild(cg);
    c.eventMode = 'static';
    c.cursor = 'pointer';

    let riding = false;
    c.on('pointertap', () => {
      const p = getPlayer();
      if (!p) return;
      if (riding) return; // dismount handled by tapping the CART button that replaces it
      if (!nearGrid(p.x, p.y, CART_PARK.c, CART_PARK.r, 2.4)) { toast('Walk over to the golf cart!'); return; }
      riding = true;
      c.visible = false;           // the parked cart "becomes" your ride
      sfx.cart();
      setCart(true);
      toast('Beep beep! Tap yourself to hop off 🛺');
    });

    // dismount: tapping your own avatar while riding
    updaters.push(() => {
      const p = getPlayer();
      if (!p) return;
      if (riding && !p.cart) {
        // dismounted (from main): re-park the cart where the player left it
        riding = false;
        c.position.set(p.x + 40, p.y + 8);
        c.zIndex = c.position.y;
        c.visible = true;
      }
    });

    rend.addObject(c);
  }

  // ── house doorbells ──
  // door containers were added to the walls layer during build; wire hit
  // areas here instead: proximity + tap anywhere near a door
  {
    const doors = [...HOUSES.map(h => ({ c: (h.c0 + h.c1 + 1) / 2, r: 2 })), { c: (HOUSE_S.c0 + HOUSE_S.c1 + 1) / 2, r: 12 }];
    for (const d of doors) {
      const p = gridToWorld(d.c, d.r);
      const hit = new Container();
      hit.position.set(p.x, p.y - 40);
      const hg = new Graphics();
      hg.circle(0, 0, 44).fill({ color: 0xffffff, alpha: 0.001 }); // invisible tap target
      hit.addChild(hg);
      hit.eventMode = 'static';
      hit.cursor = 'pointer';
      let cool = 0;
      hit.on('pointertap', () => {
        const pl = getPlayer();
        if (!pl || cool > 0) return;
        if (!nearGrid(pl.x, pl.y, d.c - 0.5, d.r - 0.5, 2.2)) { toast('Get closer to ring the doorbell!'); return; }
        cool = 2;
        setTimeout(() => { cool = 0; }, 2000);
        sfx.doorbell();
        rend.fx.text(p.x, p.y - 90, 'ding dong!');
        toast("Nobody's home… yet! Houses open in a future update 🏠");
      });
      rend.addObject(hit);
    }
  }

  // ── practice mat: auto-flip like the lobby tumble strip ──
  {
    let cool = 0;
    updaters.push((dt) => {
      cool = Math.max(0, cool - dt);
      const p = getPlayer();
      if (!p || cool > 0 || p.cart) return;
      if (p.moving && inZone(p.x, p.y, PRACTICE_MAT) && !p.avatar.isEmoting()) {
        cool = 2.4;
        sfx.flip();
        emote?.('backflip');
        setTimeout(() => sfx.land(), 700);
      }
    });
  }

  // ── PRETEND COMP: the star spot ──
  {
    const ps = gridToWorld(PERFORM.c + 0.5, PERFORM.r + 0.5);
    const spot = new Container();
    spot.position.set(ps.x, ps.y);
    const sg = new Graphics();
    sg.circle(0, 0, 34).fill({ color: 0xffd166, alpha: 0.001 });
    spot.addChild(sg);
    spot.eventMode = 'static';
    spot.cursor = 'pointer';

    let performing = false;
    let hinted = false;
    const jt = gridToWorld((JUDGES.c0 + JUDGES.c1 + 1) / 2, 1.2);

    spot.on('pointertap', () => {
      const p = getPlayer();
      if (!p || performing) return;
      if (!nearGrid(p.x, p.y, PERFORM.c, PERFORM.r, 1.6)) { toast('Stand on the star first!'); return; }
      performing = true;
      toast('Judges are watching… HIT YOUR ROUTINE! 📣');
      const routine = ['spirit', 'toetouch', 'backflip', 'hit'];
      routine.forEach((k, i) => setTimeout(() => emote?.(k), i * 1150));
      setTimeout(() => {
        // scores go up
        sfx.score();
        const scores = [
          (9.4 + Math.random() * 0.5).toFixed(1),
          (9.5 + Math.random() * 0.4).toFixed(1),
          Math.random() < 0.35 ? '10!' : (9.6 + Math.random() * 0.3).toFixed(1),
        ];
        scores.forEach((s, i) => setTimeout(() => rend.fx.text(jt.x + (i - 1) * 84, jt.y - 60, s, 0xffd166), i * 260));
        rend.fx.burst(ps.x, ps.y - 40, 'confetti', 26);
        say?.('HIT ZERO!');
        setTimeout(() => { performing = false; }, 2200);
      }, routine.length * 1150 + 300);
    });
    rend.addObject(spot);

    updaters.push(() => {
      const p = getPlayer();
      if (!p) return;
      const onStar = nearGrid(p.x, p.y, PERFORM.c, PERFORM.r, 1.2);
      if (onStar && !hinted && !performing) { hinted = true; toast('Tap the star to perform for the judges! ⭐'); }
      if (!onStar) hinted = false;
    });
  }

  // ── podium: stand in front → champion moment ──
  {
    let cool = 0;
    updaters.push((dt) => {
      cool = Math.max(0, cool - dt);
      const p = getPlayer();
      if (!p || cool > 0) return;
      if (nearGrid(p.x, p.y, PODIUM.c - 1, PODIUM.r, 1.1)) {
        cool = 5;
        const pp = gridToWorld(PODIUM.c + 0.5, PODIUM.r + 0.5);
        sfx.score();
        rend.fx.text(p.x, p.y - 140, 'CHAMPION!', 0xffd166);
        rend.fx.burst(pp.x, pp.y - 60, 'star', 20);
        emote?.('hearthands');
      }
    });
  }

  return {
    update(dt) { for (const fn of updaters) fn(dt); },
  };
}

// small cart drawing shared by the parked prop (avatar.js draws its own copy
// when riding — same silhouette, so the swap reads as "you got in")
function drawCartShape(g, theme) {
  g.ellipse(0, 10, 44, 16).fill({ color: 0x000000, alpha: 0.3 });
  g.roundRect(-38, -26, 76, 26, 8).fill(0xf4f4f8).stroke({ color: 0xc9c9d4, width: 2 });
  g.roundRect(-34, -44, 30, 20, 6).fill(theme.accentNum); // seat back
  g.circle(-24, 4, 9).fill(0x1c1c26).stroke({ color: 0x44445a, width: 3 });
  g.circle(26, 4, 9).fill(0x1c1c26).stroke({ color: 0x44445a, width: 3 });
  g.moveTo(-34, -26).lineTo(-34, -62).moveTo(34, -26).lineTo(34, -62)
    .stroke({ color: 0xc9c9d4, width: 4, cap: 'round' });
  g.roundRect(-42, -70, 84, 10, 5).fill(theme.accentNum);
  g.roundRect(18, -40, 14, 4, 2).fill(0x44445a); // steering
}
