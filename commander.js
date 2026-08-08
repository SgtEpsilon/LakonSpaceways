/**
 * commander.js — Frontier login + fleet view
 *
 * Talks only to same-origin routes on server.js (/api/cmdr/*, /auth/*).
 * Never touches Frontier or holds any credential — the server does that.
 *
 * This page only works when the site is served by server.js (your
 * self-hosted instance), not on the static GitHub Pages mirror — there's
 * no backend there to talk to. If the API routes 404, we say so plainly
 * instead of failing silently.
 */

const state = document.getElementById('cmdrState');

function showMessage(html) {
  state.innerHTML = `<div class="cmdr-message fade-in">${html}</div>`;
}

function showLoggedOut() {
  showMessage(`
    <p>Log in with your Frontier account to view your current ships and fleet data, pulled live from the Companion API.</p>
    <a href="/auth/login" class="cta-button">Login with Frontier</a>
  `);
}

function showNotConfigured() {
  showMessage(`
    <p>Frontier login isn't set up on this instance yet.</p>
    <p style="opacity:0.6; font-size:0.85rem;">(Server admin: set FRONTIER_CLIENT_ID and FRONTIER_REDIRECT_URI in .env — see .env.example.)</p>
  `);
}

function showUnavailable() {
  showMessage(`
    <p>This feature needs the self-hosted LakonSpaceways server and isn't available on the GitHub Pages version of this site.</p>
  `);
}

function formatCredits(c) {
  if (c == null) return null;
  return `${c.toLocaleString()} Cr`;
}

function renderFleet(data) {
  const credits = formatCredits(data.credits);
  const header = `
    <div class="cmdr-header fade-in">
      <div class="cmdr-name">CMDR ${data.commander ?? 'Unknown'}</div>
      ${credits ? `<div class="cmdr-credits">${credits}</div>` : ''}
      <a href="/auth/logout" class="cmdr-logout">Logout</a>
    </div>
  `;

  if (!data.ships.length) {
    showMessage(`${header}<p>No ships found on file for this commander.</p>`);
    return;
  }

  const cards = data.ships.map((ship, i) => `
    <div class="ship-card fade-in cmdr-ship-card ${ship.isCurrent ? 'cmdr-ship-current' : ''}" style="animation-delay:${(i % 4) * 0.08}s">
      ${ship.isCurrent ? '<div class="cmdr-current-badge">Current Ship</div>' : ''}
      <h3>${ship.name || formatShipType(ship.type)}</h3>
      <div class="ship-class">${formatShipType(ship.type)}</div>
      ${ship.value != null ? `<div class="ship-price">Hull Value: ${(ship.value / 1_000_000).toFixed(2)}M Cr</div>` : ''}
      <div class="specifications">
        <div class="spec-list">
          ${ship.starSystem ? `<div class="spec-item">System: ${ship.starSystem}</div>` : ''}
          ${ship.station ? `<div class="spec-item">Station: ${ship.station}</div>` : ''}
        </div>
      </div>
    </div>
  `).join('');

  state.innerHTML = `
    ${header}
    <div class="fleet-grid cmdr-fleet-grid">${cards}</div>
  `;

  if (typeof observer !== 'undefined') {
    document.querySelectorAll('#cmdrState .fade-in').forEach(el => observer.observe(el));
  }
}

async function init() {
  let status;
  try {
    const resp = await fetch('/api/cmdr/status');
    if (resp.status === 404) return showUnavailable();
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    status = await resp.json();
  } catch (err) {
    console.error('[commander] status check failed:', err);
    return showUnavailable();
  }

  if (!status.configured) return showNotConfigured();
  if (!status.loggedIn) return; // static markup in commander.html already shows the login button — leave it alone, don't re-render

  try {
    showMessage('<p class="fleet-loading" style="animation:none;">Loading your fleet…</p>');
    const resp = await fetch('/api/cmdr/fleet');
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    renderFleet(data);
  } catch (err) {
    console.error('[commander] fleet fetch failed:', err);
    showMessage(`<p>Couldn't load fleet data — try logging in again.</p><a href="/auth/login" class="cta-button">Login with Frontier</a>`);
  }
}

init();
