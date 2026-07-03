// Map-agnostic isometric renderer: owns the Pixi app, layers, camera, depth
// sorting and FX particles. Scenes are loaded via loadMap(map) — the map
// module draws its own geometry into the static layers, which get cached
// as textures so per-frame draw calls stay low on iPad.

const { Application, Container, Graphics, Text } = PIXI;

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

  // ─── camera ───
  let bounds = { minX: -4000, maxX: 4000, minY: -400, maxY: 4000 };
  let camX = 0, camY = 0;
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
    camX = Math.max(bounds.minX, Math.min(bounds.maxX, camX));
    camY = Math.max(bounds.minY, Math.min(bounds.maxY, camY));
    world.scale.set(zoom);
    world.position.set(app.screen.width / 2 - camX * zoom, app.screen.height / 2 - camY * zoom);
  }

  // ─── scene loading ───
  // Clears static geometry + map objects, then lets the map draw itself.
  // Objects flagged persist (avatars) survive scene switches — the caller
  // re-adds them after loadMap. Everything else is destroyed for real so
  // Text textures and Graphics geometry don't pile up across travels.
  function loadMap(map) {
    floorLayer.cacheAsTexture(false);
    wallLayer.cacheAsTexture(false);
    floorLayer.removeChildren().forEach(c => c.destroy({ children: true }));
    wallLayer.removeChildren().forEach(c => c.destroy({ children: true }));
    for (const child of objectLayer.removeChildren()) {
      if (!child._persist) child.destroy({ children: true });
    }
    map.build({ floor: floorLayer, walls: wallLayer }, theme, addObject);
    floorLayer.cacheAsTexture(true);
    wallLayer.cacheAsTexture(true);
    bounds = map.bounds;
  }

  function centerOn(x, y) { camX = x; camY = y; }

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
    for (const child of objectLayer.children) {
      if (child._dynamicDepth) child.zIndex = child.y;
    }
    updateCamera(dt);
    updateFx(dt);
  });

  function addObject(container, { dynamic = false, persist = false, z = null } = {}) {
    container._dynamicDepth = dynamic;
    container._persist = persist;
    if (!dynamic) container.zIndex = z ?? container.y;
    objectLayer.addChild(container);
    return container;
  }

  return {
    app, world, objectLayer, fxLayer, fx, theme,
    follow, enablePan, loadMap, centerOn, addObject,
    onTick(fn) { tickers.push(fn); },
  };
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
