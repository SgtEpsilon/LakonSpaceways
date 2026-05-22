/**
 * Cloudflare Worker — Spansh API Proxy
 * =====================================
 * Routes browser requests to spansh.co.uk/api/stations/search,
 * adding the CORS headers that Spansh's server doesn't return itself.
 *
 * DEPLOY (takes ~2 minutes, free):
 *   1. Go to https://dash.cloudflare.com → Workers & Pages → Create application → Create Worker
 *   2. Paste this entire file into the Quick Edit editor (replace the default hello-world code)
 *   3. Click "Save and Deploy"
 *   4. Copy your worker URL — looks like: https://spansh-proxy.YOUR-SUBDOMAIN.workers.dev
 *   5. Open fleet.js and set the PROXY_URL constant at the top to that URL
 *
 * The free Workers tier gives 100,000 requests/day — plenty for a fan site.
 * No credit card required.
 *
 * Security note: this proxy only forwards POST requests to /api/stations/search.
 * All other paths return 404. You can optionally restrict by Origin header too.
 */

const SPANSH_BASE  = 'https://spansh.co.uk';
const ALLOWED_PATH = '/api/stations/search';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request) {

    // ── CORS preflight ────────────────────────────────────────────────────────
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    // ── Only proxy the one endpoint we actually use ───────────────────────────
    if (url.pathname !== ALLOWED_PATH) {
      return new Response('Not found', { status: 404, headers: CORS_HEADERS });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
    }

    // ── Forward to Spansh ─────────────────────────────────────────────────────
    let upstream;
    try {
      upstream = await fetch(`${SPANSH_BASE}${ALLOWED_PATH}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    request.body,
      });
    } catch (err) {
      return new Response(
        JSON.stringify({ error: 'Upstream fetch failed', detail: err.message }),
        { status: 502, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      );
    }

    // ── Return response with CORS headers injected ────────────────────────────
    const body = await upstream.text();
    return new Response(body, {
      status:  upstream.status,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  },
};
