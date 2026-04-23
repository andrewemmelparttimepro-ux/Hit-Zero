Hit Zero — PWA Bundle
=====================

This folder IS your web app. Drag the entire `pwa` folder (or its
contents) onto netlify.com/drop and you're live in about 20 seconds.

──────────────────────────────────────────
 TONIGHT: ship it to your phone (10 min)
──────────────────────────────────────────

1. Open https://app.netlify.com/drop in your browser.

2. Drag this whole `pwa/` folder onto the drop zone.
   (On Mac: grab the folder icon from Finder — don't zip it.)

3. Netlify gives you a URL like:
      https://hit-zero-abc123.netlify.app

4. Text that URL to yourself.

5. On iPhone:
      Open the URL in Safari (NOT Chrome — only Safari can install PWAs on iOS)
      Tap the Share icon → "Add to Home Screen" → Add
      The Hit Zero icon appears on your home screen. Tap it.
      It opens fullscreen with no browser chrome. That's your app.

   On Android:
      Open the URL in Chrome → menu (⋮) → "Install app" / "Add to Home screen"

6. Share the URL with coaches / trusted parents to test-drive the prototype.
   Every update you deploy replaces it instantly — they just re-open the app.

──────────────────────────────────────────
 What's in this bundle
──────────────────────────────────────────

  index.html                      Entry point (loads React + the app)
  manifest.webmanifest            PWA install metadata
  sw.js                           Service worker (offline cache)
  icons/                          App icons (192 / 512 / maskable / Apple)
  hit_zero_web/                   Web app code (components, screens, db, css)
  hit_zero/data/cheer-data.js     Seed data (rosters, skills, scores)

──────────────────────────────────────────
 After you deploy, to update:
──────────────────────────────────────────

Edit any file in this folder → drag the folder to Netlify Drop again
(same URL). Bump the CACHE_VERSION string in sw.js so phones pull the
new version instead of serving stale cache:

   const CACHE_VERSION = 'hz-v2-2026-04-21';

──────────────────────────────────────────
 Custom domain (later, after you buy hitzero.app)
──────────────────────────────────────────

In the Netlify site dashboard:
  Site settings → Domain management → Add custom domain → hitzero.app

Add these DNS records at your registrar (Cloudflare / Namecheap):
  Type  Name   Value
  A     @      75.2.60.5               (Netlify load balancer)
  CNAME www    <your-site>.netlify.app

Netlify will auto-provision a Let's Encrypt SSL cert (required for PWA).
PWA install works the same — users with the old Netlify URL on their
home screen will keep working.

──────────────────────────────────────────
 Troubleshooting
──────────────────────────────────────────

"Add to Home Screen" doesn't offer install prompt:
  - Must be HTTPS (Netlify gives you this automatically)
  - Must use Safari on iOS / Chrome on Android
  - Fully refresh the page once before tapping Share

App opens as a tab, not fullscreen:
  - Make sure you added it via Share → Add to Home Screen
    (bookmarks go to tabs; home-screen icons go fullscreen)

Changes not showing after re-deploy:
  - Bump CACHE_VERSION in sw.js
  - Or: close the app, long-press the icon → Remove, re-add from Safari
