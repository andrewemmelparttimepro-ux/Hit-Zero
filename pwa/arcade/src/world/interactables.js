// Lobby interactables: three arcade cabinets on the north wall (left/right =
// COMING SOON attract mode, center = Cheer Town teaser), the tumble strip,
// the spirit megaphone, and the photo-booth corner.

import {
  TILE_W, TILE_H, gridToWorld, CABINETS, MEGAPHONE, TUMBLE_TRACK, PHOTO_BOOTH,
  nearGrid, inZone,
} from './tilemap.js';

const { Container, Graphics, Text } = PIXI;

const WALL_ANGLE = Math.atan2(TILE_H / 2, TILE_W / 2); // wall plane tilt

export function createInteractables({ rend, theme, getPlayer, emote, say, toast, flash, sfx }) {
  const updaters = [];

  // ─────────────────────────────────────────────────────────────────────
  // Arcade cabinets
  // ─────────────────────────────────────────────────────────────────────
  for (const cab of CABINETS) {
    const base = gridToWorld(cab.c0 + 1, cab.r + 0.55);
    const c = new Container();
    c.position.set(base.x, base.y);
    c.rotation = WALL_ANGLE;

    const W = 150, H = 190;
    const body = new Graphics();
    // cabinet shell
    body.roundRect(-W / 2, -H, W, H, 12).fill(0x101018)
      .stroke({ color: 0x2c2c3a, width: 3 });
    // marquee
    body.roundRect(-W / 2 + 8, -H + 8, W - 16, 34, 8).fill(0x07070c);
    // screen bezel
    body.roundRect(-W / 2 + 10, -H + 50, W - 20, 88, 8).fill(0x000000)
      .stroke({ color: 0x333342, width: 2.5 });
    // control deck: two buttons + stick
    body.roundRect(-W / 2 + 10, -34, W - 20, 24, 8).fill(0x191924);
    body.circle(-24, -22, 7).fill(theme.accentNum);
    body.circle(-2, -22, 7).fill(theme.accent2Num);
    body.roundRect(24, -30, 5, 12, 2.5).fill(0x44445a);
    body.circle(26.5, -32, 6.5).fill(0xd8d8e2);
    c.addChild(body);

    // side neon edge
    const neon = new Graphics();
    neon.roundRect(-W / 2 - 3, -H + 4, 4, H - 8, 2).fill({ color: theme.accentNum, alpha: 0.85 });
    neon.roundRect(W / 2 - 1, -H + 4, 4, H - 8, 2).fill({ color: theme.accent2Num, alpha: 0.85 });
    c.addChild(neon);

    // marquee label
    const marquee = new Text({
      text: cab.key === 'center' ? 'CHEER TOWN' : 'ARCADE',
      style: {
        fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: 16, fontWeight: '900',
        fill: cab.key === 'center' ? theme.accentNum : 0xd8d8e2, letterSpacing: 2,
      },
      resolution: 2,
    });
    marquee.anchor.set(0.5);
    marquee.position.set(0, -H + 25);
    c.addChild(marquee);

    // screen content (redrawn each tick — tiny geometry, 3 cabinets, cheap)
    const screen = new Container();
    screen.position.set(0, -H + 94);
    c.addChild(screen);
    const scr = new Graphics();
    screen.addChild(scr);
    const scrText = new Text({
      text: cab.key === 'center' ? 'UNDER\nCONSTRUCTION' : 'COMING\nSOON',
      style: {
        fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: cab.key === 'center' ? 13 : 16,
        fontWeight: '900', fill: 0xffffff, align: 'center', letterSpacing: 1.5, lineHeight: cab.key === 'center' ? 16 : 19,
      },
      resolution: 2,
    });
    scrText.anchor.set(0.5);
    scrText.position.y = cab.key === 'center' ? 18 : 6;
    screen.addChild(scrText);

    const SW = 150 - 24, SH = 84; // screen inner size
    let t = Math.random() * 10;
    updaters.push((dt) => {
      t += dt;
      scr.clear();
      if (cab.key === 'center') {
        // Cheer Town teaser: night sky, a little gym silhouette, caution tape
        scr.roundRect(-SW / 2, -SH / 2, SW, SH, 6).fill(0x0b0f1e);
        for (let i = 0; i < 7; i++) {
          const sx = -SW / 2 + 12 + ((i * 37) % (SW - 24));
          const sy = -SH / 2 + 8 + ((i * 13) % 24);
          const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.8 + i * 1.7));
          scr.circle(sx, sy, 1.4).fill({ color: 0xffffff, alpha: tw });
        }
        // gym silhouette with lit door
        scr.roundRect(-34, -8, 68, 30, 3).fill(0x1a2138);
        scr.moveTo(-38, -8).lineTo(0, -24).lineTo(38, -8).closePath().fill(0x232c4a);
        scr.roundRect(-7, 6, 14, 16, 2).fill({ color: 0xffd166, alpha: 0.7 + 0.3 * Math.sin(t * 2.4) });
        // caution tape
        scr.rect(-SW / 2, 26, SW, 9).fill(0xffd166);
        for (let i = 0; i < 9; i++) {
          scr.moveTo(-SW / 2 + i * 16, 35).lineTo(-SW / 2 + i * 16 + 8, 26)
            .lineTo(-SW / 2 + i * 16 + 14, 26).lineTo(-SW / 2 + i * 16 + 6, 35).closePath().fill(0x14141c);
        }
        scrText.alpha = 1;
      } else {
        // attract mode: sweeping shimmer + pulsing text
        scr.roundRect(-SW / 2, -SH / 2, SW, SH, 6).fill(0x0a0a14);
        const sweep = ((t * 60) % (SW + 80)) - SW / 2 - 40;
        scr.moveTo(sweep, -SH / 2).lineTo(sweep + 26, -SH / 2).lineTo(sweep - 8, SH / 2).lineTo(sweep - 34, SH / 2)
          .closePath().fill({ color: theme.accentNum, alpha: 0.16 });
        scr.moveTo(sweep + 34, -SH / 2).lineTo(sweep + 44, -SH / 2).lineTo(sweep + 10, SH / 2).lineTo(sweep, SH / 2)
          .closePath().fill({ color: theme.accent2Num, alpha: 0.12 });
        scrText.alpha = 0.55 + 0.45 * Math.abs(Math.sin(t * 1.6));
      }
    });

    // tap: wobble + toast (must be close enough)
    c.eventMode = 'static';
    c.cursor = 'pointer';
    let wobble = 0;
    c.on('pointertap', () => {
      const p = getPlayer();
      if (p && !nearGrid(p.x, p.y, cab.c0 + 1, cab.r + 1.6, 3.2)) {
        toast('Walk up to the cabinet first!');
        return;
      }
      wobble = 1;
      sfx.tap();
      rend.fx.burst(base.x, base.y - 130, 'spark', 8);
      toast(cab.key === 'center'
        ? 'CHEER TOWN — under construction. Opening soon!'
        : 'New game coming soon!');
    });
    updaters.push((dt) => {
      if (wobble > 0) {
        wobble = Math.max(0, wobble - dt * 2.2);
        c.rotation = WALL_ANGLE + Math.sin(wobble * 18) * 0.03 * wobble;
      }
    });

    rend.addObject(c); // static depth: sits against the wall, behind avatars
  }

  // ─────────────────────────────────────────────────────────────────────
  // Spirit megaphone (on a pedestal)
  // ─────────────────────────────────────────────────────────────────────
  {
    const base = gridToWorld(MEGAPHONE.c + 0.5, MEGAPHONE.r + 0.5);
    const c = new Container();
    c.position.set(base.x, base.y);

    const g = new Graphics();
    // pedestal
    g.moveTo(0, -8).lineTo(30, 7).lineTo(0, 22).lineTo(-30, 7).closePath().fill(0x1d1d28);
    g.rect(-30, 7, 60, 10).fill(0x15151e);
    g.moveTo(0, 2).lineTo(30, 17).lineTo(30, 7).lineTo(0, -8).closePath().fill(0x181822);
    // megaphone: cone + handle, accent body
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
      say?.('HIT ZERO!');   // player shouts it (preset phrase — no free text)
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

  // ─────────────────────────────────────────────────────────────────────
  // Photo booth corner (NW): sparkly backdrop + camera tripod
  // ─────────────────────────────────────────────────────────────────────
  {
    const anchor = gridToWorld(1.1, 1.1);
    const c = new Container();
    c.position.set(anchor.x, anchor.y);

    const g = new Graphics();
    // backdrop curtain lies along the NW wall plane
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

    // camera on tripod, one tile out, facing the booth
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

    // gentle hint when a player wanders into the booth
    let hinted = false;
    updaters.push(() => {
      const p = getPlayer();
      if (!p) return;
      const inside = nearGrid(p.x, p.y, 1, 1, 1.1);
      if (inside && !hinted) { hinted = true; toast('Tap the camera to strike a pose! 📸'); }
      if (!inside) hinted = false;
    });
  }

  // ─────────────────────────────────────────────────────────────────────
  // Tumble strip: run onto it → automatic flip
  // ─────────────────────────────────────────────────────────────────────
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
