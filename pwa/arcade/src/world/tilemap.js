// Generic isometric grid math — map-agnostic. Each map module (maps/*.js)
// owns its own dimensions, zones, collision and builders.
//
//   world.x = (c - r) * TILE_W/2
//   world.y = (c + r) * TILE_H/2      (world y also drives depth sorting)

export const TILE_W = 128;
export const TILE_H = 64;

export function gridToWorld(c, r) {
  return { x: (c - r) * (TILE_W / 2), y: (c + r) * (TILE_H / 2) };
}

export function worldToGrid(x, y) {
  return {
    c: (x / (TILE_W / 2) + y / (TILE_H / 2)) / 2,
    r: (y / (TILE_H / 2) - x / (TILE_W / 2)) / 2,
  };
}

// Avatar collision: 4 sample points so corners can't be clipped.
const PAD = 0.22; // in tile units
export function makeCanStand(isBlocked) {
  return function canStand(x, y) {
    const g = worldToGrid(x, y);
    return !isBlocked(g.c - PAD, g.r - PAD) && !isBlocked(g.c + PAD, g.r - PAD)
        && !isBlocked(g.c - PAD, g.r + PAD) && !isBlocked(g.c + PAD, g.r + PAD);
  };
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

// World-space camera bounds for a cols×rows map.
export function boundsFor(cols, rows, headroom = 260) {
  const corners = [gridToWorld(0, rows), gridToWorld(cols, 0), gridToWorld(0, 0), gridToWorld(cols, rows)];
  return {
    minX: Math.min(...corners.map(p => p.x)) - TILE_W,
    maxX: Math.max(...corners.map(p => p.x)) + TILE_W,
    minY: -headroom,
    maxY: Math.max(...corners.map(p => p.y)) + TILE_H * 1.5,
  };
}

// Helper for map modules: mutable blocked-tile set with bounds check.
export function makeBlockedSet(cols, rows) {
  const set = new Set();
  return {
    block(c, r) { set.add(c + ',' + r); },
    blockRect(c0, r0, c1, r1) {
      for (let c = c0; c <= c1; c++) for (let r = r0; r <= r1; r++) set.add(c + ',' + r);
    },
    isBlocked(c, r) {
      const ci = Math.floor(c), ri = Math.floor(r);
      if (ci < 0 || ri < 0 || ci >= cols || ri >= rows) return true;
      return set.has(ci + ',' + ri);
    },
  };
}
