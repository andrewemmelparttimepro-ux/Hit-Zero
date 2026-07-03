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

// Soft two-voice pad with a slow sparkle arp — clubhouse vibe, very quiet.
function startAmbient() {
  if (!ctx) return;
  ambient = ctx.createGain();
  ambient.gain.value = 0.05;
  ambient.connect(master);

  const pad = (freq, detune) => {
    const o = ctx.createOscillator();
    o.type = 'triangle'; o.frequency.value = freq; o.detune.value = detune;
    const g = ctx.createGain(); g.gain.value = 0.5;
    const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.07 + Math.abs(detune) * 0.001;
    const lg = ctx.createGain(); lg.gain.value = 0.25;
    lfo.connect(lg); lg.connect(g.gain);
    o.connect(g); g.connect(ambient);
    o.start(); lfo.start();
  };
  pad(146.83, -4); // D3
  pad(220.0, 5);   // A3

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
  step()     { /* intentionally silent — footsteps get annoying fast */ },
};
