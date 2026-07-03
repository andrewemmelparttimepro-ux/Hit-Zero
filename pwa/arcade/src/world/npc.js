// SUPER SQUAD — superhero cheerleader NPCs. They wear capes, throw skills
// far beyond the kids' emote wheel (full twists, doubles, sky-high jumps),
// and above all they are GENEROUS: they greet you, hype your emotes, and a
// high-five gifts you a sparkle trail. Client-local ambient characters —
// never networked, always preset phrases.
//
// Maps declare a roster: map.npcs = [{ name, avatar, home, superset, pass? }]

import { createAvatar, facingFromVector } from './avatar.js';
import { gridToWorld } from './tilemap.js';

const PRAISE = [
  "You've got this!", 'AMAZING!', 'Show me your toe touch!',
  "You're a STAR! ⭐", "Let's HIT ZERO!", 'That was PERFECT!',
  'One more time — full out!', 'Best jumps in the gym!',
];
const GIFT_LINES = ['High five! ✋✨', 'SUPER SPARKLE — go go go!', 'You earned your sparkle!'];

const WALK_SPEED = 150;

export function createNpcDriver({ rend, map, theme, getPlayer, sfx, grantSparkle, toast }) {
  const npcs = (map.npcs || []).map((def, i) => {
    const avatar = createAvatar({
      config: { cape: 1, ...def.avatar },
      name: def.name,
      team: 'Super Squad',
      theme, npc: true, fx: rend.fx,
    });
    const home = def.home;
    const start = gridToWorld(home.c0 + (home.c1 - home.c0) / 2 + i, home.r0 + (home.r1 - home.r0) / 2);
    avatar.container.position.set(start.x, start.y);
    rend.addObject(avatar.container, { dynamic: true }); // map-owned: destroyed on scene switch
    return {
      def, avatar,
      x: start.x, y: start.y, tx: start.x, ty: start.y,
      state: 'idle', timer: 1 + i * 2.2,
      greetCool: 2, giftCool: 6, reactCool: 4, passStep: -1,
    };
  });

  function pickWanderTarget(n) {
    const home = n.def.home;
    for (let tries = 0; tries < 10; tries++) {
      const g = gridToWorld(
        home.c0 + Math.random() * (home.c1 - home.c0 + 1),
        home.r0 + Math.random() * (home.r1 - home.r0 + 1),
      );
      if (map.canStand(g.x, g.y)) { n.tx = g.x; n.ty = g.y; return true; }
    }
    return false;
  }

  function faceToward(n, x, y) {
    n.avatar.setFacing(facingFromVector(x - n.x, y - n.y));
  }

  function update(dt) {
    const player = getPlayer();
    for (const n of npcs) {
      n.greetCool = Math.max(0, n.greetCool - dt);
      n.giftCool = Math.max(0, n.giftCool - dt);
      n.reactCool = Math.max(0, n.reactCool - dt);
      n.timer -= dt;

      // ── generosity: react to the kid ──
      if (player) {
        const d = Math.hypot(player.x - n.x, player.y - n.y);

        // high-five gift: really close → sparkle trail
        if (d < 52 && n.giftCool <= 0 && !n.avatar.isEmoting()) {
          n.giftCool = 34;
          n.greetCool = 10;
          faceToward(n, player.x, player.y);
          n.avatar.playEmote('hearthands');
          n.avatar.say(GIFT_LINES[(Math.random() * GIFT_LINES.length) | 0]);
          rend.fx.burst((player.x + n.x) / 2, player.y - 70, 'heart', 14);
          sfx.score();
          grantSparkle?.(45);
          toast?.('✨ Super sparkle! Your trail lasts a bit — go show off!');
        }
        // greet: nearby → wave + praise
        else if (d < 170 && n.greetCool <= 0 && !n.avatar.isEmoting()) {
          n.greetCool = 11;
          faceToward(n, player.x, player.y);
          n.avatar.playEmote('wave');
          n.avatar.say(PRAISE[(Math.random() * PRAISE.length) | 0]);
        }
        // hype the kid's emotes
        else if (d < 240 && n.reactCool <= 0 && player.avatar.isEmoting()) {
          n.reactCool = 14;
          faceToward(n, player.x, player.y);
          setTimeout(() => {
            if (n.avatar.isEmoting()) return;
            n.avatar.playEmote('hit');
            n.avatar.say('YES! AMAZING!');
            rend.fx.burst(player.x, player.y - 110, 'confetti', 16);
          }, 900);
        }
      }

      // ── state machine ──
      if (n.state === 'idle') {
        if (n.timer <= 0) {
          const roll = Math.random();
          if (n.def.pass && roll < 0.3) {
            // tumbling pass: run the line, chain flips, stick a full twist
            n.state = 'pass';
            n.passStep = 0;
            const from = gridToWorld(n.def.pass.from.c, n.def.pass.from.r);
            n.tx = from.x; n.ty = from.y;
          } else if (roll < 0.62) {
            n.state = 'wander';
            if (!pickWanderTarget(n)) n.state = 'idle';
            n.timer = 6;
          } else {
            // showcase: throw a super move on the spot
            const set = n.def.superset || ['superjump'];
            n.avatar.playEmote(set[(Math.random() * set.length) | 0]);
            n.timer = 3.5 + Math.random() * 3;
          }
        }
      } else if (n.state === 'wander' || n.state === 'pass') {
        const dx = n.tx - n.x, dy = n.ty - n.y;
        const d = Math.hypot(dx, dy);
        if (d > 8) {
          const sp = (n.state === 'pass' && n.passStep > 0 ? WALK_SPEED * 1.7 : WALK_SPEED) * dt;
          n.x += (dx / d) * Math.min(sp, d);
          n.y += (dy / d) * Math.min(sp, d);
          n.avatar.setMoving(true);
          n.avatar.setFacing(facingFromVector(dx, dy));
        } else if (n.state === 'wander') {
          n.avatar.setMoving(false);
          n.state = 'idle';
          n.timer = 1.5 + Math.random() * 3.5;
        } else {
          // pass choreography: arrive → flip-flip-flip → full twist
          n.avatar.setMoving(false);
          if (n.passStep === 0) {
            n.passStep = 1;
            const to = gridToWorld(n.def.pass.to.c, n.def.pass.to.r);
            n.tx = to.x; n.ty = to.y;
            const chain = ['backflip', 'backflip', 'fulltwist'];
            chain.forEach((k, i) => setTimeout(() => n.avatar.playEmote(k), i * 780));
            setTimeout(() => sfx.flip(), 100);
          } else {
            n.state = 'idle';
            n.timer = 2 + Math.random() * 3;
            rend.fx.burst(n.x, n.y - 60, 'star', 12);
          }
        }
      }

      n.avatar.container.position.set(n.x, n.y);
      n.avatar.update(dt);
    }
  }

  return {
    update,
    entities() { return npcs.map(n => ({ x: n.x, y: n.y, kind: 'npc' })); },
  };
}
