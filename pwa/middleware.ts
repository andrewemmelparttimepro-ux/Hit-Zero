// Vercel Edge Middleware — site-wide basic-auth gate for demo lockdown.
// Set DEMO_LOCK=off on Vercel to disable without redeploying.
// Password + username live as DEMO_PASSWORD / DEMO_USERNAME env vars;
// rotated in the Vercel dashboard, no code change required.

export const config = {
  matcher: ['/((?!_next|_vercel|icons|favicon|.*\\.png$|.*\\.svg$).*)']
};

export default function middleware(request: Request) {
  const lockEnabled = (process.env.DEMO_LOCK ?? 'on') !== 'off';
  if (!lockEnabled) return;

  const expectedUser = process.env.DEMO_USERNAME ?? 'coach';
  const expectedPassword = process.env.DEMO_PASSWORD ?? 'magic-city-2026';

  const auth = request.headers.get('authorization') ?? '';
  if (auth.startsWith('Basic ')) {
    try {
      const decoded = atob(auth.slice(6));
      const sep = decoded.indexOf(':');
      const user = decoded.slice(0, sep);
      const pass = decoded.slice(sep + 1);
      if (user === expectedUser && pass === expectedPassword) return; // allow
    } catch { /* fall through to 401 */ }
  }

  return new Response('Authentication required.', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Hit Zero — demo preview", charset="UTF-8"',
      'Content-Type': 'text/plain'
    }
  });
}
