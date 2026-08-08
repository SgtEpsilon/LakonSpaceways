/**
 * server.js — LakonSpaceways combined static site + Spansh proxy + Frontier login
 * =================================================================================
 * One process, one port:
 *   - Serves the static site (index.html, styles.css, fleet.js, etc.)
 *   - Handles POST /api/stations/search by forwarding to spansh.co.uk
 *     and returning the result, so the browser's fetch() in fleet.js
 *     stays same-origin — no CORS setup needed at all.
 *   - Handles Frontier Developments cAPI login (OAuth2 + PKCE) so
 *     commanders can view their own ships/fleet data. All of the
 *     Frontier-specific logic lives in frontier-auth.js; this file just
 *     wires up the routes and the session.
 *
 * Spansh requires an EXACT-CASE match for reference_system (it's not a
 * fuzzy/case-insensitive lookup) — procedurally-generated system names
 * end in a lowercase letter + digits (e.g. "b8-4"), easy to mistype as
 * uppercase. Before every request we resolve whatever system name the
 * user typed through EDSM's system endpoint (which IS case-insensitive)
 * and swap in the canonically-cased name Spansh expects. If EDSM doesn't
 * know the system either, we just pass the typed name through as-is.
 *
 * SECRETS
 * -------
 * Frontier login needs FRONTIER_CLIENT_ID, FRONTIER_REDIRECT_URI, and a
 * SESSION_SECRET. These are read from a local .env file that is NOT
 * committed to git (see .env.example for the template). If they're not
 * set, the site still runs fine — the /auth and /api/cmdr routes just
 * respond that login isn't configured, and the rest of the site
 * (fleet catalogue, Spansh search) works exactly as before.
 *
 * RUN:
 *   npm install
 *   cp .env.example .env   # then fill in your values
 *   npm start
 *
 * Then open http://localhost:3000 (or whatever PORT you set).
 */

require('dotenv').config();

const express = require('express');
const session = require('express-session');
const frontier = require('./frontier-auth');
const {
  normalizeMarket,
  normalizeShipyard,
  normalizeFleetCarrier,
  normalizeCommunityGoals,
} = require('./capi-normalize');

const PORT = process.env.PORT || 3000;
const SPANSH_BASE = 'https://spansh.co.uk';
const ALLOWED_PATH = '/api/stations/search';
const EDSM_SYSTEM_URL = 'https://www.edsm.net/api-v1/system';

const app = express();

// Behind the Cloudflare tunnel we're still the origin server as far as
// Express is concerned, but this lets `secure` cookies work correctly if
// you ever put another reverse proxy in front.
app.set('trust proxy', 1);

// Parse the JSON body fleet.js sends, forward it on as-is.
app.use(express.json());

// Sessions hold the Frontier token set server-side. The cookie itself only
// ever contains a session ID — never a client ID, secret, or token.
if (!process.env.SESSION_SECRET) {
  console.warn('[server] SESSION_SECRET is not set in .env — using a random one-off secret. '
    + 'Sessions (and Frontier logins) will not survive a server restart. See .env.example.');
}
app.use(session({
  secret: process.env.SESSION_SECRET || require('crypto').randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    // Only mark cookies secure-only when the redirect URI is https, so
    // this still works over plain http://localhost during local testing.
    secure: (process.env.FRONTIER_REDIRECT_URI || '').startsWith('https://'),
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  },
}));

// Case-insensitive system name lookup via EDSM. Returns the canonically
// cased name, or null if EDSM doesn't know the system either.
async function getCanonicalSystemName(name) {
  try {
    const url = `${EDSM_SYSTEM_URL}?systemName=${encodeURIComponent(name)}&showId=1`;
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const data = await resp.json();
    return data && data.name ? data.name : null;
  } catch {
    return null;
  }
}

app.post(ALLOWED_PATH, async (req, res) => {
  try {
    const body = { ...req.body };

    if (body.reference_system) {
      const canonical = await getCanonicalSystemName(body.reference_system);
      if (canonical && canonical !== body.reference_system) {
        console.log(`[spansh-proxy] "${body.reference_system}" -> "${canonical}"`);
        body.reference_system = canonical;
      }
    }

    console.log('[spansh-proxy] outgoing request body:', JSON.stringify(body));

    const upstream = await fetch(`${SPANSH_BASE}${ALLOWED_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const text = await upstream.text();
    console.log(`[spansh-proxy] upstream responded ${upstream.status}:`, text);
    res.status(upstream.status).type('application/json').send(text);
  } catch (err) {
    console.error('[spansh-proxy] fetch failed:', err);
    res.status(502).type('application/json').send(
      JSON.stringify({ error: 'Upstream fetch failed', detail: err.message })
    );
  }
});

// ─── Frontier cAPI login (OAuth2 + PKCE) ───────────────────────────────────

// GET /auth/login — kick off the OAuth flow by redirecting to Frontier.
app.get('/auth/login', (req, res) => {
  if (!frontier.isConfigured()) {
    return res.status(503).send(
      'Frontier login isn\'t configured on this server. Set FRONTIER_CLIENT_ID and '
      + 'FRONTIER_REDIRECT_URI in .env — see .env.example.'
    );
  }
  const verifier = frontier.generateVerifier();
  const state = frontier.generateState();
  req.session.pkce = { verifier, state };
  res.redirect(frontier.buildAuthorizeUrl({ verifier, state }));
});

// GET /auth/callback — Frontier redirects back here with ?code=&state=
app.get('/auth/callback', async (req, res) => {
  const { code, state, error, error_description } = req.query;
  const pending = req.session.pkce;
  req.session.pkce = null;

  if (error) {
    return res.status(400).send(`Frontier login failed: ${error_description || error}`);
  }
  if (!pending || !state || state !== pending.state) {
    return res.status(400).send('Login state mismatch — please try logging in again.');
  }
  if (!code) {
    return res.status(400).send('No authorization code received from Frontier.');
  }

  try {
    req.session.frontier = await frontier.exchangeCode(code, pending.verifier);
    res.redirect('/commander.html');
  } catch (err) {
    console.error('[frontier-auth] token exchange failed:', err);
    res.status(502).send(`Could not complete Frontier login: ${err.message}`);
  }
});

// GET /auth/logout — drop the stored tokens for this session.
app.get('/auth/logout', (req, res) => {
  req.session.frontier = null;
  res.redirect('/commander.html');
});

// ─── Commander data (proxied cAPI calls) ───────────────────────────────────

// GET /api/cmdr/status — is this browser session logged in, and as whom?
app.get('/api/cmdr/status', async (req, res) => {
  if (!frontier.isConfigured()) {
    return res.json({ configured: false, loggedIn: false });
  }
  if (!req.session.frontier) {
    return res.json({ configured: true, loggedIn: false });
  }
  try {
    const profile = await frontier.capiFetch(req, '/profile');
    res.json({
      configured: true,
      loggedIn: true,
      commander: profile.commander?.name ?? null,
      credits: profile.commander?.credits ?? null,
    });
  } catch (err) {
    console.error('[cmdr] status check failed:', err);
    req.session.frontier = null;
    res.json({ configured: true, loggedIn: false });
  }
});

// GET /api/cmdr/fleet — current ship + all stored ships, trimmed to what
// the frontend actually renders.
app.get('/api/cmdr/fleet', async (req, res) => {
  try {
    const profile = await frontier.capiFetch(req, '/profile');
    const shipsRaw = profile.ships || {};

    const ships = Object.values(shipsRaw)
      .filter(Boolean)
      .map(s => ({
        id: s.id,
        name: s.shipName || null,
        type: s.name || s.shipType || 'Unknown',
        value: s.value?.hull ?? null,
        starSystem: s.starsystem?.name ?? null,
        station: s.station?.name ?? null,
        isCurrent: profile.commander?.currentShipId === s.id,
      }))
      .sort((a, b) => (b.isCurrent ? 1 : 0) - (a.isCurrent ? 1 : 0));

    res.json({
      commander: profile.commander?.name ?? null,
      credits: profile.commander?.credits ?? null,
      ships,
    });
  } catch (err) {
    console.error('[cmdr] fleet fetch failed:', err);
    res.status(err.status === 401 ? 401 : 502).json({ error: err.message });
  }
});

// Shared handler for the read-only cAPI tabs below: fetch, normalize, and
// treat "no data yet" (404 — e.g. never docked, or no carrier owned) as a
// normal { available: false } response rather than an error, since that's
// an expected state, not a failure.
function cmdrCapiRoute(path, normalize) {
  return async (req, res) => {
    try {
      const raw = await frontier.capiFetch(req, path);
      res.json(normalize(raw));
    } catch (err) {
      if (err.status === 404) return res.json({ available: false });
      console.error(`[cmdr] ${path} fetch failed:`, err);
      res.status(err.status === 401 ? 401 : 502).json({ error: err.message });
    }
  };
}

// GET /api/cmdr/market — commodities at the last station docked at.
app.get('/api/cmdr/market', cmdrCapiRoute('/market', normalizeMarket));

// GET /api/cmdr/shipyard — ships + outfitting modules at the last station docked at.
app.get('/api/cmdr/shipyard', cmdrCapiRoute('/shipyard', normalizeShipyard));

// GET /api/cmdr/fleetcarrier — carrier status, cargo, buy/sell orders, finances.
// NB: Frontier only refreshes this on CarrierBuy / opening the carrier UI
// in-game, with a ~15 min cooldown server-side, so don't poll this often.
app.get('/api/cmdr/fleetcarrier', cmdrCapiRoute('/fleetcarrier', normalizeFleetCarrier));

// GET /api/cmdr/communitygoals — active CGs and this commander's contribution.
app.get('/api/cmdr/communitygoals', cmdrCapiRoute('/communitygoals', normalizeCommunityGoals));

// Everything else: serve the static site files from this same folder.
app.use(express.static(__dirname));

app.listen(PORT, () => {
  console.log(`LakonSpaceways running at http://localhost:${PORT}`);
});


