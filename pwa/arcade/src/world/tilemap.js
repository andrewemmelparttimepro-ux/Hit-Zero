// Lobby map: one interior scene — a cheer-gym clubhouse.
// 2:1 isometric, TILE 128×64. Grid coords are (c, r); world coords are px.
//
//   world.x = (c - r) * TILE_W/2
//   world.y = (c + r) * TILE_H/2      (world y also drives depth sorting)

export const TILE_W = 128;
export const TILE_H = 64;
export const COLS = 20;
export const ROWS = 14;

export function gridToWorld(c, r) {
  return { x: (c - r) * (TILE_W / 2), y: (c + r) * (TILE_H / 2) };
}

export function worldToGrid(x, y) {
  return {
    c: (x / (TILE_W / 2) + y / (TILE_H / 2)) / 2,
    r: (y / (TILE_H / 2) - x / (TILE_W / 2)) / 2,
  };
}

// ─── Zones ───
export const SPRING_FLOOR = { c0: 4, r0: 4, c1: 15, r1: 10 };   // 12×7 panels
export const TUMBLE_TRACK = { c0: 17, r0: 3, c1: 17, r1: 10 };  // vertical strip, east side
export const PHOTO_BOOTH  = { c0: 0, r0: 0, c1: 1, r1: 1 };     // NW corner
export const SPAWN = { c: 10, r: 12 };

// Cabinets sit against the north wall (r = 0), each 2 tiles wide.
export const CABINETS = [
  { key: 'left',   c0: 4,  c1: 5,  r: 0, label: 'COMING SOON' },
  { key: 'center', c0: 9,  c1: 10, r: 0, label: 'CHEER TOWN' },
  { key: 'right',  c0: 14, c1: 15, r: 0, label: 'COMING SOON' },
];

export const MEGAPHONE = { c: 2, r: 8 };

// ─── Collision ───
const blockedSet = new Set();
function block(c, r) { blockedSet.add(c + ',' + r); }

// cabinet tiles + the tile in front stays walkable (kids walk up to screens)
for (const cab of CABINETS) for (let c = cab.c0; c <= cab.c1; c++) block(c, cab.r);
// megaphone pedestal
block(MEGAPHONE.c, MEGAPHONE.r);
// photo booth backdrop (the two wall-side tiles); (1,1) stays walkable as the booth interior
block(0, 0); block(1, 0); block(0, 1);

export function isBlocked(c, r) {
  const ci = Math.floor(c), ri = Math.floor(r);
  if (ci < 0 || ri < 0 || ci >= COLS || ri >= ROWS) return true;
  return blockedSet.has(ci + ',' + ri);
}

// Circle-ish collision for an avatar at world (x, y) — checks the tile under
// each of 4 sample points so avatars can't clip corners.
const PAD = 0.22; // in tile units
export function canStand(x, y) {
  const g = worldToGrid(x, y);
  return !isBlocked(g.c - PAD, g.r - PAD) && !isBlocked(g.c + PAD, g.r - PAD)
      && !isBlocked(g.c - PAD, g.r + PAD) && !isBlocked(g.c + PAD, g.r + PAD);
}

export function inZone(x, y, zone) {
  const g = worldToGrid(x, y);
  return g.c >= zone.c0 && g.c <= zone.c1 + 1 && g.r >= zone.r0 && g.r <= zone.r1 + 1;
}

export function nearGrid(x, y, c, r, radiusTiles = 1.8) {
  const g = worldToGrid(x, y);
  const dc = g.c - (c + 0.5), dr = g.r - (r + 0.5);
  return (dc * dc + dr * dr) <= radiusTiles * radiusTiles;
}

// World-space bounds (for camera clamping)
const corners = [gridToWorld(0, ROWS), gridToWorld(COLS, 0), gridToWorld(0, 0), gridToWorld(COLS, ROWS)];
export const WORLD_BOUNDS = {
  minX: Math.min(...corners.map(p => p.x)) - TILE_W,
  maxX: Math.max(...corners.map(p => p.x)) + TILE_W,
  minY: -260, // headroom for walls + banners
  maxY: Math.max(...corners.map(p => p.y)) + TILE_H * 1.5,
};
