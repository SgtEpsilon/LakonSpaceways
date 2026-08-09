/**
 * commander.js — Frontier login + tabbed commander data
 *
 * Talks only to same-origin routes on server.js (/api/cmdr/*, /auth/*).
 * Never touches Frontier or holds any credential — the server does that.
 *
 * This page only works when the site is served by server.js (your
 * self-hosted instance), not on the static GitHub Pages mirror — there's
 * no backend there to talk to. If the API routes 404, we say so plainly
 * instead of failing silently.
 *
 * Each tab lazy-loads its own data on first click and caches it in
 * `tabCache` for the rest of the page's lifetime, so switching back and
 * forth doesn't re-hit the cAPI (server.js also caches /profile briefly,
 * but /fleetcarrier and /communitygoals are separate endpoints not
 * covered by that, and Frontier asks integrators not to poll them).
 */

const stateEl = document.getElementById('cmdrState');
const tabsEl = document.getElementById('cmdrTabs');
const panelEl = document.getElementById('cmdrTabPanel');
const tabCache = {};

function showMessage(html) {
  stateEl.innerHTML = `<div class="cmdr-message fade-in">${html}</div>`;
  stateEl.style.display = '';
  tabsEl.style.display = 'none';
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

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ─── Tabs ───────────────────────────────────────────────────────────────

const TAB_LOADERS = {
  fleet: loadFleet,
  ranks: loadRanks,
  location: loadLocation,
  loadout: loadLoadout,
  carrier: loadCarrier,
  communitygoals: loadCommunityGoals,
};

function initTabs() {
  stateEl.style.display = 'none';
  tabsEl.style.display = '';
  document.querySelectorAll('.cmdr-tab').forEach(btn => {
    btn.addEventListener('click', () => activateTab(btn.dataset.tab));
  });
  activateTab('fleet');
}

function activateTab(tab) {
  document.querySelectorAll('.cmdr-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  if (tabCache[tab]) {
    paintPanel(tabCache[tab]);
    return;
  }
  panelEl.innerHTML = '<p class="fleet-loading" style="animation:none; text-align:center;">Loading…</p>';
  TAB_LOADERS[tab]();
}

// Injected content's .fade-in elements start at opacity:0 (see styles.css)
// and are normally only revealed by the page-load-time IntersectionObserver
// in scripts.js scrolling them into view. That observer never sees content
// injected after the fact, so anything painted here has to be (re-)observed
// explicitly — otherwise it renders but stays invisible forever, which is
// exactly what "empty" tabs actually were: real content, opacity 0.
function paintPanel(html) {
  panelEl.innerHTML = html;
  if (typeof observer !== 'undefined') {
    panelEl.querySelectorAll('.fade-in').forEach(el => observer.observe(el));
  } else {
    // Fallback in case the shared observer isn't available for some reason
    // (e.g. script load order) — better to show it immediately than risk
    // the same invisible-content bug again.
    panelEl.querySelectorAll('.fade-in').forEach(el => el.classList.add('visible'));
  }
}

function renderTab(tab, html) {
  tabCache[tab] = html;
  // Only paint if this tab is still the active one (guards against a slow
  // request finishing after the person has already clicked elsewhere).
  const activeBtn = document.querySelector('.cmdr-tab.active');
  if (activeBtn && activeBtn.dataset.tab === tab) paintPanel(html);
}

function renderTabError(tab, message) {
  renderTab(tab, `<p style="text-align:center; color:rgba(232,234,237,0.6);">${escapeHtml(message)}</p>`);
}

// ─── Fleet tab ──────────────────────────────────────────────────────────

async function loadFleet() {
  try {
    const resp = await fetch('/api/cmdr/fleet');
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    renderTab('fleet', renderFleetHtml(data));
  } catch (err) {
    console.error('[commander] fleet fetch failed:', err);
    renderTabError('fleet', "Couldn't load fleet data.");
  }
}

function renderFleetHtml(data) {
  const credits = formatCredits(data.credits);
  const header = `
    <div class="cmdr-header">
      <div class="cmdr-name">CMDR ${escapeHtml(data.commander ?? 'Unknown')}</div>
      ${credits ? `<div class="cmdr-credits">${credits}</div>` : ''}
      <a href="/auth/logout" class="cmdr-logout">Logout</a>
    </div>
  `;
  if (!data.ships.length) return `${header}<p style="text-align:center;">No ships found on file for this commander.</p>`;

  const cards = data.ships.map((ship, i) => `
    <div class="ship-card fade-in cmdr-ship-card ${ship.isCurrent ? 'cmdr-ship-current' : ''}" style="animation-delay:${(i % 4) * 0.08}s">
      ${ship.isCurrent ? '<div class="cmdr-current-badge">Current Ship</div>' : ''}
      <h3>${escapeHtml(ship.name || formatShipType(ship.type))}</h3>
      <div class="ship-class">${escapeHtml(formatShipType(ship.type))}</div>
      ${ship.value != null ? `<div class="ship-price">Hull Value: ${(ship.value / 1_000_000).toFixed(2)}M Cr</div>` : ''}
      <div class="specifications">
        <div class="spec-list">
          ${ship.starSystem ? `<div class="spec-item">System: ${escapeHtml(ship.starSystem)}</div>` : ''}
          ${ship.station ? `<div class="spec-item">Station: ${escapeHtml(ship.station)}</div>` : ''}
        </div>
      </div>
    </div>
  `).join('');

  return `${header}<div class="fleet-grid cmdr-fleet-grid">${cards}</div>`;
}

// ─── Ranks tab ──────────────────────────────────────────────────────────

async function loadRanks() {
  try {
    const resp = await fetch('/api/cmdr/ranks');
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    renderTab('ranks', renderRanksHtml(data));
  } catch (err) {
    console.error('[commander] ranks fetch failed:', err);
    renderTabError('ranks', "Couldn't load rank data.");
  }
}

const RANK_LABELS = { combat: 'Combat', trade: 'Trade', explore: 'Exploration', cqc: 'CQC', empire: 'Empire', federation: 'Federation' };

function renderRanksHtml(data) {
  const cards = data.ranks.map(r => `
    <div class="cmdr-rank-card fade-in">
      <h4>${RANK_LABELS[r.category] || r.category}</h4>
      <div class="cmdr-rank-name">${escapeHtml(r.name || '\u2014')}</div>
      ${r.progress != null ? `
        <div class="cmdr-rank-bar"><div class="cmdr-rank-bar-fill" style="width:${Math.max(0, Math.min(100, r.progress))}%;"></div></div>
        <div class="cmdr-rank-pct">${r.progress}% to next rank</div>
      ` : ''}
    </div>
  `).join('');
  return `<div class="cmdr-rank-grid">${cards}</div>`;
}

// ─── Location tab ───────────────────────────────────────────────────────

async function loadLocation() {
  try {
    const resp = await fetch('/api/cmdr/location');
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    renderTab('location', renderLocationHtml(data));
  } catch (err) {
    console.error('[commander] location fetch failed:', err);
    renderTabError('location', "Couldn't load location data.");
  }
}

function renderLocationHtml(data) {
  return `
    <div class="cmdr-location-card fade-in">
      <div class="cmdr-location-system">${escapeHtml(data.system || 'Unknown System')}</div>
      ${data.station ? `<div class="cmdr-location-station">${escapeHtml(data.station)}</div>` : ''}
      <div class="cmdr-location-docked">${data.docked ? 'Docked' : 'In Space'}</div>
    </div>
  `;
}

// ─── Loadout tab ────────────────────────────────────────────────────────

async function loadLoadout() {
  try {
    const resp = await fetch('/api/cmdr/loadout');
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    renderTab('loadout', renderLoadoutHtml(data));
  } catch (err) {
    console.error('[commander] loadout fetch failed:', err);
    renderTabError('loadout', "Couldn't load loadout data.");
  }
}

function renderLoadoutHtml(data) {
  const header = `
    <div class="cmdr-loadout-header">
      <strong>${escapeHtml(data.shipName || formatShipType(data.shipType))}</strong>
      ${data.shipName ? ` — ${escapeHtml(formatShipType(data.shipType))}` : ''}
    </div>
  `;
  if (!data.modules.length) return `${header}<p style="text-align:center;">No module data available.</p>`;

  const rows = data.modules.map(m => `
    <div class="cmdr-module-row">
      <span class="cmdr-module-slot">${escapeHtml(m.slot)}</span>
      <span class="cmdr-module-name">${escapeHtml(m.name)}${m.on === false ? ' (off)' : ''}</span>
      ${m.engineering ? `<span class="cmdr-module-eng">${escapeHtml(m.engineering.blueprint || 'Engineered')}${m.engineering.level ? ` G${m.engineering.level}` : ''}</span>` : ''}
    </div>
  `).join('');

  return `${header}<div class="cmdr-message" style="text-align:left;">${rows}</div>`;
}

// ─── Fleet carrier tab ──────────────────────────────────────────────────

async function loadCarrier() {
  try {
    const resp = await fetch('/api/cmdr/carrier');
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    renderTab('carrier', renderCarrierHtml(data));
  } catch (err) {
    console.error('[commander] carrier fetch failed:', err);
    renderTabError('carrier', "Couldn't load fleet carrier data.");
  }
}

function renderCarrierHtml(data) {
  if (!data.owned) {
    return `<p style="text-align:center;">No fleet carrier on file for this commander.</p>`;
  }
  const stats = [
    ['Current System', data.currentSystem],
    ['Balance', formatCredits(data.balance)],
    ['Fuel', data.fuel != null ? `${data.fuel} / 1000 T` : null],
    ['State', data.state],
    ['Docking Access', data.dockingAccess],
  ].filter(([, v]) => v != null);

  const financeStats = data.finance ? [
    ['Bank Balance', formatCredits(data.finance.bankBalance)],
    ['Weekly Upkeep', formatCredits(data.finance.coreCost)],
    ['Services Cost', formatCredits(data.finance.servicesCost)],
  ].filter(([, v]) => v != null) : [];

  return `
    <div class="cmdr-carrier-header fade-in">
      <div class="cmdr-carrier-callsign">${escapeHtml(data.callsign || 'Unknown Carrier')}</div>
      ${data.vanityName ? `<div class="cmdr-carrier-name">${escapeHtml(data.vanityName)}</div>` : ''}
    </div>
    <div class="cmdr-stat-grid">
      ${stats.map(([label, value]) => `
        <div class="cmdr-stat"><div class="cmdr-stat-label">${label}</div><div class="cmdr-stat-value">${escapeHtml(value)}</div></div>
      `).join('')}
      ${financeStats.map(([label, value]) => `
        <div class="cmdr-stat"><div class="cmdr-stat-label">${label}</div><div class="cmdr-stat-value">${escapeHtml(value)}</div></div>
      `).join('')}
    </div>
  `;
}

// ─── Community goals tab ────────────────────────────────────────────────

async function loadCommunityGoals() {
  try {
    const resp = await fetch('/api/cmdr/communitygoals');
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    renderTab('communitygoals', renderCommunityGoalsHtml(data));
  } catch (err) {
    console.error('[commander] community goals fetch failed:', err);
    renderTabError('communitygoals', "Couldn't load community goals.");
  }
}

function renderCommunityGoalsHtml(data) {
  if (!data.goals.length) return `<p style="text-align:center;">No active community goals joined.</p>`;
  return data.goals.map(g => `
    <div class="cmdr-cg-card fade-in">
      <div class="cmdr-cg-name">${escapeHtml(g.name)}${g.isComplete ? ' <span class="cmdr-cg-complete">(Complete)</span>' : ''}</div>
      <div class="cmdr-cg-meta">
        ${g.market ? `${escapeHtml(g.market)} &middot; ` : ''}
        ${g.contribution != null ? `Your contribution: ${g.contribution.toLocaleString()}` : 'No contribution on file'}
        ${g.percentileBand != null ? ` &middot; Top ${g.percentileBand}%` : ''}
      </div>
    </div>
  `).join('');
}

// ─── Init ───────────────────────────────────────────────────────────────

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
  if (!status.loggedIn) return; // static markup in commander.html already shows the login button — leave it alone

  initTabs();
}

init();
