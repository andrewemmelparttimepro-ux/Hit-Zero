import {
  buildAuthorizeUrl,
  corsHeaders,
  encryptSecret,
  exchangeCodeForToken,
  getSquareConnection,
  getSquareStatus,
  json,
  loadLocations,
  preflight,
  resolveProgramId,
  runSquareSync,
  sanitizeConnection,
  squareConfigured,
  squareConfig,
  supa,
  verifyState,
} from '../_shared/square.ts';

function redirect(url: string) {
  return new Response(null, {
    status: 302,
    headers: { location: url, ...corsHeaders },
  });
}

function addRedirectParams(target: string, params: Record<string, string | null | undefined>) {
  const url = new URL(target);
  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === '') continue;
    url.searchParams.set(key, value);
  }
  return url.toString();
}

async function readBody(req: Request) {
  try { return await req.json(); } catch { return {}; }
}

Deno.serve(async (req) => {
  const pf = preflight(req);
  if (pf) return pf;

  const url = new URL(req.url);

  if (req.method === 'GET' && (url.searchParams.get('code') || url.searchParams.get('error'))) {
    const cfg = squareConfig();
    const error = url.searchParams.get('error');
    const errorDescription = url.searchParams.get('error_description');
    let fallback = `${cfg.appOrigin}/#billing`;

    try {
      const state = await verifyState(url.searchParams.get('state'));
      fallback = state.return_to || fallback;

      if (error) {
        return redirect(addRedirectParams(fallback, {
          square: error,
          message: errorDescription || error,
        }));
      }

      if (!squareConfigured()) {
        return redirect(addRedirectParams(fallback, { square: 'not_configured' }));
      }

      const code = url.searchParams.get('code');
      if (!code) throw new Error('missing Square authorization code');
      const programId = await resolveProgramId({ program_id: state.program_id });
      const token = await exchangeCodeForToken(code);
      const accessToken = String(token.access_token || '');
      const refreshToken = String(token.refresh_token || '');
      if (!accessToken || !refreshToken) throw new Error('Square did not return access and refresh tokens');

      const { data: existing } = await supa
        .from('billing_provider_connections')
        .select('*')
        .eq('program_id', programId)
        .eq('provider', 'square')
        .maybeSingle();

      const tempConnection = existing || {
        environment: cfg.env,
        external_location_id: null,
        external_business_name: null,
      };

      const locations = await loadLocations(tempConnection as any, accessToken);
      const primaryLocation = locations.find((l: any) => l.status === 'ACTIVE') || locations[0] || null;
      const payload = {
        program_id: programId,
        provider: 'square',
        environment: cfg.env,
        status: 'connected',
        external_account_id: token.merchant_id ?? null,
        external_location_id: primaryLocation?.id ?? null,
        external_business_name: primaryLocation?.business_name ?? primaryLocation?.name ?? null,
        scopes: token.scopes ?? [],
        access_token_enc: await encryptSecret(accessToken),
        refresh_token_enc: await encryptSecret(refreshToken),
        token_expires_at: token.expires_at ?? null,
        connected_at: new Date().toISOString(),
        disconnected_at: null,
        last_error: null,
      };

      if (existing?.id) {
        await supa.from('billing_provider_connections').update(payload).eq('id', existing.id);
      } else {
        await supa.from('billing_provider_connections').insert(payload);
      }

      const connection = await getSquareConnection(programId);
      if (connection && (globalThis as any).EdgeRuntime?.waitUntil) {
        (globalThis as any).EdgeRuntime.waitUntil(runSquareSync(connection, { mode: 'oauth_bootstrap' }));
      }

      return redirect(addRedirectParams(fallback, { square: 'connected' }));
    } catch (e) {
      return redirect(addRedirectParams(fallback, {
        square: 'error',
        message: e instanceof Error ? e.message : String(e),
      }));
    }
  }

  try {
    const payload = req.method === 'POST' ? await readBody(req) : {};
    const action = String(
      url.searchParams.get('action')
      || payload.action
      || 'status',
    );
    const programId = await resolveProgramId({
      program_id: url.searchParams.get('program_id') || payload.program_id || null,
      program_slug: url.searchParams.get('program_slug') || payload.program_slug || null,
    });

    if (action === 'status') {
      return json(await getSquareStatus(programId));
    }

    if (action === 'connect_url') {
      if (!squareConfigured()) {
        return json({
          configured: false,
          error: 'Square is not configured on the backend. Set SQUARE_APP_ID, SQUARE_APP_SECRET, and SQUARE_TOKEN_CRYPT_KEY first.',
        }, 400);
      }
      const connectUrl = await buildAuthorizeUrl(programId, payload.return_to || `${squareConfig().appOrigin}/#billing`);
      return json({ configured: true, url: connectUrl, env: squareConfig().env, redirect_uri: squareConfig().redirectUri });
    }

    if (action === 'disconnect') {
      const connection = await getSquareConnection(programId);
      if (!connection) return json({ ok: true, disconnected: false, reason: 'not_connected' });
      await supa.from('billing_provider_connections').update({
        status: 'disconnected',
        disconnected_at: new Date().toISOString(),
        access_token_enc: null,
        refresh_token_enc: null,
        token_expires_at: null,
      }).eq('id', connection.id);
      return json({ ok: true, disconnected: true });
    }

    if (action === 'sync') {
      const connection = await getSquareConnection(programId);
      if (!connection || connection.status !== 'connected') {
        return json({ error: 'Square is not connected for this program yet.' }, 400);
      }
      const summary = await runSquareSync(connection, {
        requestedBy: payload.requested_by || null,
        mode: 'manual',
      });
      return json({
        ok: true,
        connection: sanitizeConnection(await getSquareConnection(programId)),
        preview: summary,
      });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ error: msg }, 500);
  }
});
