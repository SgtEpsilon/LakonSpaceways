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
  frontier.clearProfileCache(req);
  req.session.frontier = null;
  res.redirect('/commander.html');
});

// ─── Commander data (proxied cAPI calls) ───────────────────────────────────
//
// /profile is the one call shared by status/overview/fleet, so it goes
// through frontier.getProfileCached() everywhere — that caches it for a
// few seconds server-side so opening several tabs in a row doesn't send
// several near-simultaneous /profile requests to Frontier.
//
// Ranks are looked up via rank-names.js (Node's `require` also works on
// that file since it guards its `module.exports` — see the file itself).
const { rankName, rankProgress } = require('./rank-names.js');

// GET /api/cmdr/status — is this browser session logged in, and as whom?
app.get('/api/cmdr/status', async (req, res) => {
  if (!frontier.isConfigured()) {
    return res.json({ configured: false, loggedIn: false });
  }
  if (!req.session.frontier) {
    return res.json({ configured: true, loggedIn: false });
  }
  try {
    const profile = await frontier.getProfileCached(req);
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
    const profile = await frontier.getProfileCached(req);
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

// GET /api/cmdr/ranks — combat/trade/exploration/CQC + Empire/Federation
// reputation ranks and progress toward the next rank.
//
// NB: the exact shape of `commander.rank.*` in the cAPI response isn't
// officially documented (this is a reverse-engineered API) — most sources
// agree it's a [rankIndex, progressPercent] pair, but rankName()/
// rankProgress() in rank-names.js handle a plain number or {rank,progress}
// object too, so this degrades to "name only, no progress bar" rather than
// breaking if Frontier's actual shape differs.
app.get('/api/cmdr/ranks', async (req, res) => {
  try {
    const profile = await frontier.getProfileCached(req);
    const rank = profile.commander?.rank || {};
    const categories = ['combat', 'trade', 'explore', 'cqc', 'empire', 'federation'];
    const ranks = categories.map(cat => ({
      category: cat,
      name: rankName(cat, rank[cat]),
      progress: rankProgress(rank[cat]),
    }));
    res.json({ ranks });
  } catch (err) {
    console.error('[cmdr] ranks fetch failed:', err);
    res.status(err.status === 401 ? 401 : 502).json({ error: err.message });
  }
});

// GET /api/cmdr/location — last known system/station, and whether the
// commander is currently docked there.
app.get('/api/cmdr/location', async (req, res) => {
  try {
    const profile = await frontier.getProfileCached(req);
    res.json({
      docked: !!profile.commander?.docked,
      system: profile.lastSystem?.name ?? null,
      station: profile.lastStarport?.name ?? null,
      allegiance: profile.lastSystem?.faction ?? null,
    });
  } catch (err) {
    console.error('[cmdr] location fetch failed:', err);
    res.status(err.status === 401 ? 401 : 502).json({ error: err.message });
  }
});

// GET /api/cmdr/loadout — fitted modules on the CURRENT ship. cAPI already
// includes a localised human-readable name per module (locName), so unlike
// ship type/name we don't need our own symbol-to-name table here.
app.get('/api/cmdr/loadout', async (req, res) => {
  try {
    const profile = await frontier.getProfileCached(req);
    const ship = profile.ship || {};
    const modulesRaw = ship.modules || {};

    const modules = Object.entries(modulesRaw)
      .filter(([, m]) => m && m.module)
      .map(([slot, m]) => ({
        slot,
        name: m.module.locName || m.module.name || 'Unknown',
        engineering: m.engineer ? {
          engineer: m.engineer.engineerName ?? null,
          blueprint: m.engineer.recipeLocName || m.engineer.recipeName || null,
          level: m.engineer.recipeLevel ?? null,
        } : null,
        on: m.module.on !== false,
      }))
      .sort((a, b) => a.slot.localeCompare(b.slot));

    res.json({
      shipType: ship.name || null,
      shipName: ship.shipName || null,
      health: ship.health || null,
      modules,
    });
  } catch (err) {
    console.error('[cmdr] loadout fetch failed:', err);
    res.status(err.status === 401 ? 401 : 502).json({ error: err.message });
  }
});

// GET /api/cmdr/carrier — fleet carrier summary. A 204 from cAPI means the
// commander simply doesn't own one, which is a normal (not error) state.
// Frontier asks integrators not to poll this endpoint frequently, so it's
// only ever called when the person actually opens this tab — never
// pre-fetched — and isn't covered by the /profile cache above (separate
// endpoint entirely).
app.get('/api/cmdr/carrier', async (req, res) => {
  try {
    const resp = await frontier.capiRequest(req, '/fleetcarrier');
    if (resp.status === 204) {
      return res.json({ owned: false });
    }
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      const err = new Error(`cAPI /fleetcarrier returned ${resp.status}${text ? `: ${text}` : ''}`);
      err.status = resp.status;
      throw err;
    }
    const data = await resp.json();
    const decodeName = (hex) => {
      if (!hex) return null;
      try { return Buffer.from(hex, 'hex').toString('utf8'); } catch { return null; }
    };
    res.json({
      owned: true,
      callsign: data.name?.callsign ?? null,
      vanityName: decodeName(data.name?.vanityName),
      currentSystem: data.currentStarSystem ?? null,
      balance: data.balance ?? null,
      fuel: data.fuel ?? null,
      state: data.state ?? null,
      dockingAccess: data.dockingAccess ?? null,
      notoriousAccess: !!data.notoriousAccess,
      capacity: data.capacity ? {
        cargoForSale: data.capacity.cargoForSale ?? null,
        cargoNotForSale: data.capacity.cargoNotForSale ?? null,
        freeSpace: data.capacity.freeSpace ?? null,
      } : null,
      finance: data.finance ? {
        bankBalance: data.finance.bankBalance ?? null,
        bankReservedBalance: data.finance.bankReservedBalance ?? null,
        maintenance: data.finance.maintenance ?? null,
        coreCost: data.finance.coreCost ?? null,
        servicesCost: data.finance.servicesCost ?? null,
        debtThreshold: data.finance.debtThreshold ?? null,
      } : null,
    });
  } catch (err) {
    console.error('[cmdr] carrier fetch failed:', err);
    res.status(err.status === 401 ? 401 : 502).json({ error: err.message });
  }
});

// GET /api/cmdr/communitygoals — active CGs and this commander's own
// contribution/percentile in each, where Frontier reports one.
app.get('/api/cmdr/communitygoals', async (req, res) => {
  try {
    const data = await frontier.capiFetch(req, '/communitygoals');
    const goalsRaw = Array.isArray(data) ? data : (data.communitygoals || data.goals || []);
    const goals = goalsRaw.map(g => ({
      name: g.title || g.name || 'Community Goal',
      system: g.market_name ? null : (g.systemName ?? null),
      market: g.market_name ?? null,
      expiry: g.expiry ?? null,
      currentTotal: g.current_total ?? g.currentTotal ?? null,
      targetTotal: g.target_total ?? g.targetTotal ?? null,
      contribution: g.contribution ?? null,
      percentileBand: g.percentile_band ?? g.percentileBand ?? null,
      tierReached: g.tier_reached ?? g.tierReached ?? null,
      isComplete: !!(g.is_complete ?? g.isComplete),
    }));
    res.json({ goals });
  } catch (err) {
    console.error('[cmdr] community goals fetch failed:', err);
    res.status(err.status === 401 ? 401 : 502).json({ error: err.message });
  }
});

// Everything else: serve the static site files from this same folder.
app.use(express.static(__dirname));

app.listen(PORT, () => {
  console.log(`LakonSpaceways running at http://localhost:${PORT}`);
});


