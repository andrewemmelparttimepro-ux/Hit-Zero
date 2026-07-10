// Procedural audio — WebAudio only, zero downloads (keeps the <4MB budget).
// iOS requires a user gesture to start audio: unlock() is wired to the ENTER tap.

let ctx = null;
let master = null;
let ambient = null;
let muted = false;

export function unlock() {
  if (ctx) { ctx.resume?.(); return; }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.8;
    master.connect(ctx.destination);
    startAmbient();
  } catch { /* no audio — fine */ }
}

export function setMuted(m) {
  muted = !!m;
  if (master) master.gain.linearRampToValueAtTime(muted ? 0 : 0.8, (ctx?.currentTime || 0) + 0.15);
}
export function isMuted() { return muted; }

// Soft sine pad with a slow sparkle arp — clubhouse vibe, very quiet.
function startAmbient() {
  if (!ctx) return;
  ambient = ctx.createGain();
  ambient.gain.value = 0.05;
  ambient.connect(master);

  // ONE shared, slow, shallow "breath" so the whole pad rises and falls as a
  // unit. The old build gave each voice its own tremolo; the two drifted in and
  // out of phase, and that fight is the unpleasant "worse-then-better" drone.
  const breath = ctx.createOscillator();
  breath.type = 'sine';
  breath.frequency.value = 0.05;      // ~20s, barely-there swell
  const breathAmt = ctx.createGain();
  breathAmt.gain.value = 0.006;
  breath.connect(breathAmt); breathAmt.connect(ambient.gain);
  breath.start();

  // Pure sines at exact whole-number ratios (D3–A3–D4): no detune and no
  // harmonics means there is nothing to beat against, so it stays smooth.
  const voice = (freq, level) => {
    const o = ctx.createOscillator();
    o.type = 'sine'; o.frequency.value = freq;
    const g = ctx.createGain(); g.gain.value = level;
    o.connect(g); g.connect(ambient);
    o.start();
  };
  voice(146.83, 0.5);  // D3 root
  voice(220.00, 0.32); // A3 fifth
  voice(293.66, 0.22); // D4 octave

  // gentle pentatonic sparkle every few seconds
  const NOTES = [587.33, 659.25, 783.99, 880.0, 1046.5];
  const tick = () => {
    if (!ctx || ctx.state !== 'running') { setTimeout(tick, 4000); return; }
    if (!muted && Math.random() < 0.75) {
      const f = NOTES[(Math.random() * NOTES.length) | 0];
      tone(f, 0.9, 0.018, 'sine');
    }
    setTimeout(tick, 2800 + Math.random() * 3200);
  };
  setTimeout(tick, 2500);
}

function tone(freq, dur = 0.15, vol = 0.12, type = 'square', slide = 0) {
  if (!ctx || muted) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.02);
}

// ─────────────────────────────────────────────────────────────────────────
// HIT THE COUNTS — procedural "practice track" for offline mode / teams
// without uploaded routine music yet. A cheer-mix style beat: kick on every
// count, accent + crash on 1, clap on 5, riser into each section. Scheduled
// with a small lookahead so timing is sample-accurate (WebAudio clock), which
// the rhythm game depends on.
// Returns { start(), stop(), time(), duration } — time() is seconds since
// count 1 of 8-count 1 (negative during the count-in).
export function createPracticeTrack({ bpm = 140, eightCounts = 16, countIn = 4 } = {}) {
  if (!ctx) unlock();
  const beat = 60 / bpm;
  const totalBeats = eightCounts * 8;
  const duration = totalBeats * beat;
  let t0 = null;          // ctx time of count 1
  let nextBeat = -countIn; // beat index being scheduled (negative = count-in)
  let timer = null;
  let bus = null;

  function kick(t, vol = 0.30) {
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(48, t + 0.11);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t + 0.2);
  }
  function clap(t, vol = 0.16) {
    const len = 0.09;
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * len), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1900; f.Q.value = 0.8;
    const g = ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(bus); src.start(t);
  }
  function pluck(t, freq, vol = 0.07) {
    const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t + 0.25);
  }
  // E minor pentatonic bounce — poppy without being melodic enough to clash
  const RIFF = [329.63, 392.0, 440.0, 493.88, 440.0, 392.0, 329.63, 246.94];

  function scheduleBeat(b, t) {
    if (b < 0) { // count-in: 5-6-7-8 sticks
      pluck(t, b % 2 === 0 ? 880 : 660, 0.12);
      return;
    }
    const inBar = b % 8;             // 0..7 → counts 1..8
    const e8 = Math.floor(b / 8) + 1;
    kick(t, inBar === 0 ? 0.34 : 0.24);
    if (inBar === 4) clap(t);
    if (inBar === 0) { clap(t, 0.10); pluck(t, RIFF[0] * 2, 0.05); }
    pluck(t, RIFF[inBar] * (e8 % 4 === 0 ? 2 : 1));
    // little riser on the last 2 counts of every 4th 8-count
    if (e8 % 4 === 0 && inBar >= 6) pluck(t + beat / 2, 1200 + inBar * 220, 0.05);
  }

  return {
    duration,
    countInSeconds: countIn * beat,
    start() {
      if (!ctx) return 0;
      bus = ctx.createGain(); bus.gain.value = 0.8; bus.connect(master);
      t0 = ctx.currentTime + countIn * beat + 0.08;
      nextBeat = -countIn;
      const tick = () => {
        if (!ctx || t0 === null) return;
        while (nextBeat < totalBeats && t0 + nextBeat * beat < ctx.currentTime + 0.35) {
          scheduleBeat(nextBeat, t0 + nextBeat * beat);
          nextBeat += 1;
        }
        if (nextBeat < totalBeats) timer = setTimeout(tick, 90);
      };
      tick();
      return t0;
    },
    time() { return ctx && t0 !== null ? ctx.currentTime - t0 : 0; },
    stop() {
      clearTimeout(timer);
      t0 = null;
      if (bus) {
        try {
          bus.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.12);
          setTimeout(() => { try { bus.disconnect(); } catch { /* gone */ } }, 200);
        } catch { /* gone */ }
        bus = null;
      }
    },
  };
}

// ─── One-shot cues ───
export const sfx = {
  tap()      { tone(660, 0.06, 0.05); },
  join()     { tone(523.25, 0.1, 0.06); setTimeout(() => tone(659.25, 0.1, 0.06), 90); setTimeout(() => tone(783.99, 0.16, 0.06), 180); },
  leave()    { tone(659.25, 0.1, 0.045); setTimeout(() => tone(523.25, 0.14, 0.045), 100); },
  emote()    { tone(880, 0.09, 0.055); setTimeout(() => tone(1174.66, 0.12, 0.05), 70); },
  hit()      { tone(392, 0.05, 0.09); setTimeout(() => tone(783.99, 0.22, 0.09, 'square', 400), 60); },
  flip()     { tone(300, 0.3, 0.05, 'sine', 500); },
  land()     { tone(196, 0.08, 0.07, 'triangle'); },
  phrase()   { tone(740, 0.07, 0.045); },
  shutter()  { tone(1400, 0.04, 0.08, 'square'); setTimeout(() => tone(900, 0.05, 0.06, 'square'), 50); },
  megaphone(){ tone(494, 0.12, 0.07, 'sawtooth'); setTimeout(() => tone(740, 0.18, 0.06, 'sawtooth'), 110); },
  travel()   { tone(392, 0.14, 0.06, 'sine', 300); setTimeout(() => tone(587.33, 0.14, 0.06, 'sine', 300), 130); setTimeout(() => tone(880, 0.22, 0.06, 'sine'), 260); },
  doorbell() { tone(659.25, 0.22, 0.07, 'sine'); setTimeout(() => tone(523.25, 0.3, 0.07, 'sine'), 240); },
  score()    { tone(523.25, 0.1, 0.07); setTimeout(() => tone(659.25, 0.1, 0.07), 100); setTimeout(() => tone(783.99, 0.1, 0.07), 200); setTimeout(() => tone(1046.5, 0.3, 0.08), 300); },
  cart()     { tone(220, 0.18, 0.06, 'sawtooth', 60); },
  step()     { /* intentionally silent — footsteps get annoying fast */ },
  // Hit the Counts judgments — short and satisfying, quiet enough to sit
  // under the music.
  perfect()  { tone(1318.5, 0.09, 0.075); setTimeout(() => tone(1760, 0.14, 0.06), 45); },
  great()    { tone(1046.5, 0.1, 0.06); },
  good()     { tone(783.99, 0.09, 0.05, 'triangle'); },
  missNote() { tone(180, 0.12, 0.05, 'triangle', -40); },
  countTick(){ tone(880, 0.06, 0.1, 'square'); },
  countGo()  { tone(1174.66, 0.2, 0.1, 'square'); },
  fanfare()  { [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => setTimeout(() => tone(f, 0.22, 0.08), i * 110)); },
};
