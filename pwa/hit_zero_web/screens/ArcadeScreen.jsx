// ─────────────────────────────────────────────────────────────────────────────
// ARCADE — thin wrapper around the standalone game at /arcade/.
// The game is a separate PixiJS bundle (pwa/arcade/) that never imports app
// code; same origin means it reads the session itself. Nothing sensitive is
// passed via URL. View-as preview renders the game in invisible observer mode.
// ─────────────────────────────────────────────────────────────────────────────
function ArcadeScreen({ session }) {
  const { useRef, useState, useEffect } = React;
  const wrapRef = useRef(null);
  const [frame, setFrame] = useState(null);

  // Full-bleed inside .main: cancel the shell padding and stop above the
  // mobile tab bar. Measured (not hardcoded) so desktop + mobile both fit.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const mainEl = el.closest('.main');
      const cs = mainEl ? getComputedStyle(mainEl) : null;
      const padTop = cs ? parseFloat(cs.paddingTop) || 0 : 0;
      const padRight = cs ? parseFloat(cs.paddingRight) || 0 : 0;
      const padLeft = cs ? parseFloat(cs.paddingLeft) || 0 : 0;
      el.style.margin = `${-padTop}px ${-padRight}px 0 ${-padLeft}px`;
      const top = el.getBoundingClientRect().top;
      const tabbar = document.querySelector('.mobile-tabbar');
      const bottom = tabbar ? tabbar.getBoundingClientRect().top : window.innerHeight;
      setFrame({ height: Math.max(320, bottom - top) });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const previewOnly = !!session?.profile?.is_view_as;
  const src = 'arcade/' + (previewOnly ? '?preview=1' : '');

  return (
    <div ref={wrapRef} style={{ background: '#050507' }}>
      {frame && (
        <iframe
          src={src}
          title="Hit Zero Arcade"
          allow="autoplay"
          style={{
            display: 'block', width: '100%', height: frame.height,
            border: 0, background: '#050507',
          }}
        />
      )}
    </div>
  );
}

window.ArcadeScreen = ArcadeScreen;
