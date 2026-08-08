/**
 * frontier-auth.js — Frontier Developments cAPI login (OAuth2 + PKCE)
 * =====================================================================
 * Everything Frontier-account-related lives in this one file:
 *   - Building the PKCE authorize URL
 *   - Exchanging the authorization code for tokens
 *   - Refreshing an expired access token
 *   - Calling the Companion API (cAPI) with the current session's token
 *
 * SECRETS
 * -------
 * The only credential this needs is FRONTIER_CLIENT_ID, read from
 * environment variables (see .env.example). PKCE means no client secret
 * is required at all. The client ID/redirect URI live in your own
 * untracked .env file — never in this file, never committed, never
 * shipped to the GitHub Pages static mirror.
 *
 * Tokens are kept server-side only, in the Express session (see
 * server.js). The browser only ever holds a session cookie.
 *
 * Register an app (and set its redirect URI) at:
 *   https://user.frontierstore.net/dev
 */

const crypto = require('crypto');

const AUTH_HOST = 'https://auth.frontierstore.net';
const AUTHORIZE_URL = `${AUTH_HOST}/auth`;
const TOKEN_URL = `${AUTH_HOST}/token`;
const CAPI_HOST = 'https://companion.orerve.net';

const CLIENT_ID = process.env.FRONTIER_CLIENT_ID;
const REDIRECT_URI = process.env.FRONTIER_REDIRECT_URI;

function isConfigured() {
  return Boolean(CLIENT_ID && REDIRECT_URI);
}

// ─── PKCE helpers ───────────────────────────────────────────────────────────

function base64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function generateVerifier() {
  return base64url(crypto.randomBytes(32)); // 43-char base64url string
}

function challengeFromVerifier(verifier) {
  return base64url(crypto.createHash('sha256').update(verifier).digest());
}

function generateState() {
  return base64url(crypto.randomBytes(16));
}

// ─── Authorize URL ──────────────────────────────────────────────────────────

function buildAuthorizeUrl({ verifier, state }) {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: 'auth capi',
    state,
    code_challenge: challengeFromVerifier(verifier),
    code_challenge_method: 'S256',
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

// ─── Token exchange / refresh ───────────────────────────────────────────────

async function postToken(body) {
  const resp = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
  });
  const text = await resp.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!resp.ok) {
    const detail = data.error_description || data.error || text || resp.statusText;
    throw new Error(`Frontier token endpoint returned ${resp.status}: ${detail}`);
  }
  return data;
}

// Exchange an authorization code for an initial token set.
async function exchangeCode(code, verifier) {
  const data = await postToken({
    grant_type: 'authorization_code',
    client_id: CLIENT_ID,
    code,
    redirect_uri: REDIRECT_URI,
    code_verifier: verifier,
  });
  return toTokenSet(data);
}

// Use a refresh token to get a new access token.
async function refreshTokens(refresh_token) {
  const data = await postToken({
    grant_type: 'refresh_token',
    client_id: CLIENT_ID,
    refresh_token,
  });
  return toTokenSet(data, refresh_token);
}

function toTokenSet(data, fallbackRefreshToken) {
  return {
    access_token: data.access_token,
    // Frontier issues a new refresh token on every refresh; fall back to
    // the old one only if the response somehow omits it.
    refresh_token: data.refresh_token || fallbackRefreshToken,
    token_type: data.token_type || 'Bearer',
    // expires_in is in seconds; store an absolute expiry with a 60s buffer.
    expires_at: Date.now() + (Math.max(Number(data.expires_in) || 0, 0) * 1000) - 60_000,
  };
}

// ─── cAPI calls (with automatic refresh-on-expiry) ─────────────────────────

// req.session.frontier holds { access_token, refresh_token, token_type, expires_at }
async function capiFetch(req, path) {
  const tokens = req.session.frontier;
  if (!tokens || !tokens.refresh_token) {
    const err = new Error('Not logged in to Frontier');
    err.status = 401;
    throw err;
  }

  if (Date.now() >= tokens.expires_at) {
    req.session.frontier = await refreshTokens(tokens.refresh_token);
  }

  const doFetch = () => fetch(`${CAPI_HOST}${path}`, {
    headers: {
      Authorization: `${req.session.frontier.token_type} ${req.session.frontier.access_token}`,
    },
  });

  let resp = await doFetch();

  // 401/422 can mean the access token expired early — try one refresh+retry.
  if (resp.status === 401 || resp.status === 422) {
    req.session.frontier = await refreshTokens(req.session.frontier.refresh_token);
    resp = await doFetch();
  }

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    const err = new Error(`cAPI ${path} returned ${resp.status}${text ? `: ${text}` : ''}`);
    err.status = resp.status;
    throw err;
  }

  return resp.json();
}

module.exports = {
  isConfigured,
  generateVerifier,
  generateState,
  buildAuthorizeUrl,
  exchangeCode,
  refreshTokens,
  capiFetch,
};
