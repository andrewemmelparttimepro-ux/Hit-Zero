/* North Dakota Elite public intake helpers.
 *
 * This mirrors the MCA site contract: every public lead or registration uses
 * the same names Hit Zero expects and resolves through program_slug first.
 */
(function () {
  const SUPABASE_URL = 'https://ldhzkdqznccfgpdvqyfk.supabase.co';
  const SUPABASE_ANON_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkaHprZHF6bmNjZmdwZHZxeWZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMTY1MTksImV4cCI6MjA5MDg5MjUxOX0.yPihX_N734HXTk8mzf-F85W_5j_J7EXe3Dg1U90ZMYI';

  const NDE_SLUG = 'ndelite';
  const CURRENT_NDE_URL = 'https://ndelite.com';
  const HIT_ZERO_URL = 'https://thehitzero.net';
  const HIT_ZERO_SIGNIN_URL = `${HIT_ZERO_URL}/#signin?source=ndelite`;
  const HIT_ZERO_CREATE_ACCOUNT_URL = `${HIT_ZERO_URL}/#signup?gym=${NDE_SLUG}&source=ndelite`;
  const HIT_ZERO_TRIAL_URL = `${HIT_ZERO_URL}/#trial/${NDE_SLUG}`;

  function captureSourceContext() {
    try {
      const cached = sessionStorage.getItem('hz_nde_src_ctx');
      if (cached) return JSON.parse(cached);
      const params = new URLSearchParams(window.location.search);
      const ctx = {
        utm_source: params.get('utm_source') || null,
        utm_campaign: params.get('utm_campaign') || null,
        utm_medium: params.get('utm_medium') || null,
        utm_content: params.get('utm_content') || null,
        utm_term: params.get('utm_term') || null,
        referrer_url: document.referrer || null,
        landing_url: window.location.href,
        captured_at: new Date().toISOString(),
      };
      sessionStorage.setItem('hz_nde_src_ctx', JSON.stringify(ctx));
      return ctx;
    } catch (_) {
      return {};
    }
  }

  async function rest(path, init = {}) {
    const headers = Object.assign(
      {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      init.headers || {}
    );
    const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, { ...init, headers });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      const err = new Error(`Supabase ${res.status}: ${detail || res.statusText}`);
      err.status = res.status;
      err.detail = detail;
      throw err;
    }
    if (res.status === 204) return null;
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  async function intake(payload) {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/public-intake-v1`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    let data = null;
    try { data = await res.json(); } catch (_) {}
    if (!res.ok || !data?.ok) {
      const err = new Error(data?.message || `intake failed (${res.status})`);
      err.status = res.status;
      err.code = data?.code;
      err.detail = data;
      throw err;
    }
    return data;
  }

  async function getProgram(slug) {
    const s = slug || NDE_SLUG;
    const rows = await rest(`/program_public_directory?slug=eq.${encodeURIComponent(s)}&select=*&limit=1`);
    return (rows && rows[0]) || null;
  }

  function normalizePayload(payload, kind) {
    const ctx = captureSourceContext();
    return Object.assign(
      {
        kind,
        program_slug: NDE_SLUG,
        source: payload.source || 'public_website',
        referrer_url: ctx.referrer_url,
        utm_source: ctx.utm_source,
        utm_campaign: ctx.utm_campaign,
      },
      payload,
      {
        metadata: Object.assign(
          {
            white_label_site: 'ndelite',
            current_site_url: CURRENT_NDE_URL,
            landing_url: ctx.landing_url,
            utm_medium: ctx.utm_medium,
            utm_content: ctx.utm_content,
            utm_term: ctx.utm_term,
          },
          payload.metadata || {}
        ),
      }
    );
  }

  async function submitLead(payload) {
    return intake(normalizePayload(payload, 'lead'));
  }

  async function submitRegistration(payload) {
    return intake(normalizePayload(payload, 'registration'));
  }

  if (typeof window !== 'undefined') captureSourceContext();

  window.HZ = {
    SUPABASE_URL,
    NDE_SLUG,
    CURRENT_NDE_URL,
    HIT_ZERO_URL,
    HIT_ZERO_SIGNIN_URL,
    HIT_ZERO_CREATE_ACCOUNT_URL,
    HIT_ZERO_TRIAL_URL,
    getProgram,
    submitLead,
    submitRegistration,
    captureSourceContext,
  };
})();
