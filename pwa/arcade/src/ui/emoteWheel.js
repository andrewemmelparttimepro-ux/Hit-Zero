// Radial emote + phrase wheels. Open from the action buttons (tap or hold),
// pick with a tap (or drag-release). Preset content ONLY — the phrase wheel
// is the entire text surface of the Arcade. No free text exists anywhere.

import { EMOTES, PHRASES } from '../net/protocol.js';

const EMOTE_META = {
  hit:        { icon: '💥', label: 'HIT!' },
  spirit:     { icon: '🎀', label: 'SPIRIT' },
  highv:      { icon: '🙌', label: 'HIGH-V' },
  toetouch:   { icon: '⭐', label: 'TOE TOUCH' },
  backflip:   { icon: '🔄', label: 'BACKFLIP' },
  wave:       { icon: '👋', label: 'WAVE' },
  laugh:      { icon: '😄', label: 'LAUGH' },
  hearthands: { icon: '💗', label: 'HEARTS' },
};

export function createWheels({ onEmote, onPhrase, sfx }) {
  let open = null; // { backdrop, wheel }

  function close() {
    if (!open) return;
    open.backdrop.remove();
    open.wheel.remove();
    open = null;
  }

  function openWheel(anchorEl, items, pick) {
    close();
    const backdrop = document.createElement('div');
    backdrop.className = 'arc-wheel-backdrop';
    backdrop.addEventListener('pointerdown', close);
    document.body.appendChild(backdrop);

    const wheel = document.createElement('div');
    wheel.className = 'arc-wheel';
    document.body.appendChild(wheel);

    const rect = anchorEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    // fan items in a staggered arc up-left of the button (bottom-right
    // anchor); alternate radii so 8 chunky items don't crowd, and clamp
    // into the viewport so nothing clips on narrow screens.
    const n = items.length;
    const startA = Math.PI * 1.0;   // pointing left
    const endA = Math.PI * 1.52;    // pointing up
    const rBase = Math.min(210, Math.min(cx, cy) - 44);
    items.forEach((item, i) => {
      const a = startA + (endA - startA) * (n === 1 ? 0.5 : i / (n - 1));
      const radius = i % 2 === 0 ? rBase : rBase * 0.62;
      let x = cx + Math.cos(a) * radius;
      let y = cy + Math.sin(a) * radius * 1.04;
      x = Math.min(window.innerWidth - 52, Math.max(52, x));
      y = Math.min(window.innerHeight - 44, Math.max(44, y));
      const btn = document.createElement('button');
      btn.className = 'arc-wheel-item' + (item.phrase ? ' phrase' : '');
      btn.style.left = x + 'px';
      btn.style.top = y + 'px';
      btn.style.animationDelay = (i * 22) + 'ms';
      btn.innerHTML = item.phrase
        ? escapeHtml(item.label)
        : `${item.icon}<small>${escapeHtml(item.label)}</small>`;
      btn.addEventListener('pointerup', (e) => {
        e.stopPropagation();
        pick(item);
        close();
      });
      wheel.appendChild(btn);
    });

    open = { backdrop, wheel };
  }

  function openEmotes(anchorEl) {
    sfx.tap();
    openWheel(
      anchorEl,
      EMOTES.map(k => ({ key: k, ...EMOTE_META[k] })),
      (item) => onEmote(item.key),
    );
  }

  function openPhrases(anchorEl) {
    sfx.tap();
    openWheel(
      anchorEl,
      PHRASES.map((p, i) => ({ key: i, label: p, phrase: true })),
      (item) => onPhrase(item.key),
    );
  }

  window.addEventListener('keydown', (e) => { if (e.code === 'Escape') close(); });

  return { openEmotes, openPhrases, close };
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}
