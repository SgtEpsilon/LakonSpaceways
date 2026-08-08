/**
 * commander.js — Frontier login + fleet view, with tabbed cAPI data
 *
 * Talks only to same-origin routes on server.js (/api/cmdr/*, /auth/*).
 * Never touches Frontier or holds any credential — the server does that.
 *
 * This page only works when the site is served by server.js (your
 * self-hosted instance), not on the static GitHub Pages mirror — there's
 * no backend there to talk to. If the API routes 404, we say so plainly
 * instead of failing silently.
 *
 * Tabs (Fleet / Market / Shipyard / Fleet Carrier / Community Goals) are
 * lazy-loaded: each cAPI endpoint is only fetched the first time its tab
 * is opened, then cached in memory for the rest of the page's life. This
 * matters because Frontier has warned that hammering cAPI can trigger
 * rate limiting — there's no reason to fetch /shipyard or /fleetcarrier
 * for someone who never clicks those tabs.
 */

const state = document.getElementById('cmdrState');

const TABS = [
  { id: 'fleet', label: 'Fleet' },
  { id: 'market', label: 'Market' },
  { id: 'shipyard', label: 'Shipyard' },
  { id: 'carrier', label: 'Fleet Carrier' },
  { id: 'goals', label: 'Community Goals' },
];

// Per-tab cache: { loaded: bool, loading: bool, data: any }
const tabCache = {};

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

// ─── formatting helpers ─────────────────────────────────────────────────────

function formatCredits(c) {
  if (c == null) return null;
  return `${c.toLocaleString()} Cr`;
}

// cAPI numeric fields sometimes arrive as strings; be forgiving.
function fmtNum(n) {
  if (n == null) return '—';
  const num = Number(n);
  return Number.isFinite(num) ? num.toLocaleString() : '—';
}

function fmtCr(n) {
  if (n == null) return '—';
  const num = Number(n);
  return Number.isFinite(num) ? `${num.toLocaleString()} Cr` : '—';
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// ─── shell: header + tab nav + panel container ──────────────────────────────

function renderShell(fleetData) {
  const credits = formatCredits(fleetData.credits);
  const header = `
    <div class="cmdr-header fade-in">
      <div class="cmdr-name">CMDR ${esc(fleetData.commander ?? 'Unknown')}</div>
      ${credits ? `<div class="cmdr-credits">${credits}</div>` : ''}
      <a href="/auth/logout" class="cmdr-logout">Logout</a>
    </div>
  `;

  const tabsNav = `
    <div class="cmdr-tabs">
      ${TABS.map((t, i) => `<button type="button" class="cmdr-tab-btn${i === 0 ? ' active' : ''}" data-tab="${t.id}">${t.label}</button>`).join('')}
    </div>
  `;

  const panels = TABS.map((t, i) => `<div class="cmdr-tab-panel${i === 0 ? ' active' : ''}" id="cmdrPanel-${t.id}"></div>`).join('');

  state.innerHTML = `${header}${tabsNav}<div class="cmdr-tab-panels">${panels}</div>`;

  state.querySelectorAll('.cmdr-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => activateTab(btn.dataset.tab, btn));
  });

  // Fleet tab is already loaded (it's the same /profile data used in the header).
  tabCache.fleet = { loaded: true, loading: false, data: fleetData };
  renderFleetPanel(fleetData);

  if (typeof observer !== 'undefined') {
    document.querySelectorAll('#cmdrState .fade-in').forEach(el => observer.observe(el));
  }
}

function activateTab(tabId, btnEl) {
  state.querySelectorAll('.cmdr-tab-btn').forEach(b => b.classList.remove('active'));
  state.querySelectorAll('.cmdr-tab-panel').forEach(p => p.classList.remove('active'));
  btnEl.classList.add('active');
  document.getElementById(`cmdrPanel-${tabId}`).classList.add('active');

  const cached = tabCache[tabId];
  if (!cached || (!cached.loaded && !cached.loading)) {
    loadTab(tabId);
  }
}

async function loadTab(tabId) {
  const panel = document.getElementById(`cmdrPanel-${tabId}`);
  const endpoints = {
    market: '/api/cmdr/market',
    shipyard: '/api/cmdr/shipyard',
    carrier: '/api/cmdr/fleetcarrier',
    goals: '/api/cmdr/communitygoals',
  };
  const endpoint = endpoints[tabId];
  if (!endpoint) return;

  tabCache[tabId] = { loaded: false, loading: true, data: null };
  panel.innerHTML = `<p class="fleet-loading" style="animation:none;">Loading…</p>`;

  try {
    const resp = await fetch(endpoint);
    const body = await resp.json().catch(() => null);
    if (!resp.ok) {
      const detail = body?.error || `HTTP ${resp.status}`;
      throw new Error(detail);
    }
    tabCache[tabId] = { loaded: true, loading: false, data: body };
    renderTabPanel(tabId, body);
  } catch (err) {
    console.error(`[commander] ${tabId} fetch failed:`, err);
    tabCache[tabId] = { loaded: false, loading: false, data: null };
    panel.innerHTML = `
      <div class="cmdr-panel-message">
        Couldn't load this data.
        <div style="margin-top:0.75rem; font-size:0.8rem; opacity:0.65; word-break:break-word;">${esc(err.message)}</div>
      </div>
    `;
  }
}

function renderTabPanel(tabId, data) {
  if (tabId === 'market') return renderMarketPanel(data);
  if (tabId === 'shipyard') return renderShipyardPanel(data);
  if (tabId === 'carrier') return renderCarrierPanel(data);
  if (tabId === 'goals') return renderGoalsPanel(data);
}

// ─── Fleet panel (from /profile, already fetched) ───────────────────────────

function renderFleetPanel(data) {
  const panel = document.getElementById('cmdrPanel-fleet');
  if (!data.ships.length) {
    panel.innerHTML = `<div class="cmdr-panel-message">No ships found on file for this commander.</div>`;
    return;
  }

  const cards = data.ships.map((ship, i) => `
    <div class="ship-card fade-in cmdr-ship-card ${ship.isCurrent ? 'cmdr-ship-current' : ''}" style="animation-delay:${(i % 4) * 0.08}s">
      ${ship.isCurrent ? '<div class="cmdr-current-badge">Current Ship</div>' : ''}
      <h3>${esc(ship.name || formatShipType(ship.type))}</h3>
      <div class="ship-class">${esc(formatShipType(ship.type))}</div>
      ${ship.value != null ? `<div class="ship-price">Hull Value: ${(ship.value / 1_000_000).toFixed(2)}M Cr</div>` : ''}
      <div class="specifications">
        <div class="spec-list">
          ${ship.starSystem ? `<div class="spec-item">System: ${esc(ship.starSystem)}</div>` : ''}
          ${ship.station ? `<div class="spec-item">Station: ${esc(ship.station)}</div>` : ''}
        </div>
      </div>
    </div>
  `).join('');

  panel.innerHTML = `<div class="fleet-grid cmdr-fleet-grid">${cards}</div>`;
  if (typeof observer !== 'undefined') {
    panel.querySelectorAll('.fade-in').forEach(el => observer.observe(el));
  }
}

// ─── Market panel ────────────────────────────────────────────────────────────

function renderMarketPanel(data) {
  const panel = document.getElementById('cmdrPanel-market');
  if (!data.available || !data.commodities.length) {
    panel.innerHTML = `<div class="cmdr-panel-message">No market data on file — dock at a station's commodity market in-game, then reopen this tab.</div>`;
    return;
  }

  const rows = data.commodities.map(c => `
    <tr>
      <td>${esc(c.name)}</td>
      <td>${esc(c.category ?? '—')}</td>
      <td class="cmdr-num">${fmtCr(c.sellPrice)}</td>
      <td class="cmdr-num">${fmtCr(c.buyPrice)}</td>
      <td class="cmdr-num">${fmtNum(c.demand)}</td>
      <td class="cmdr-num">${fmtNum(c.stock)}</td>
    </tr>
  `).join('');

  panel.innerHTML = `
    <div class="cmdr-subhead">
      <h2>Last Docked Market</h2>
      <span class="cmdr-subhead-meta">${esc(data.station ?? 'Unknown station')}${data.system ? ` · ${esc(data.system)}` : ''}</span>
    </div>
    <div class="cmdr-table-wrap">
      <table class="cmdr-table">
        <thead><tr><th>Commodity</th><th>Category</th><th class="cmdr-num">Sell</th><th class="cmdr-num">Buy</th><th class="cmdr-num">Demand</th><th class="cmdr-num">Stock</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

// ─── Shipyard panel ──────────────────────────────────────────────────────────

function renderShipyardPanel(data) {
  const panel = document.getElementById('cmdrPanel-shipyard');
  if (!data.available) {
    panel.innerHTML = `<div class="cmdr-panel-message">No shipyard data on file — visit a shipyard/outfitting station in-game, then reopen this tab.</div>`;
    return;
  }

  const shipRows = data.ships.map(s => `
    <tr><td>${esc(s.name)}</td><td class="cmdr-num">${fmtCr(s.basevalue)}</td></tr>
  `).join('') || '<tr><td colspan="2">No ships available here.</td></tr>';

  const moduleRows = data.moduleCategories.map(c => `
    <tr>
      <td>${esc(c.category)}</td>
      <td class="cmdr-num">${fmtNum(c.count)}</td>
      <td class="cmdr-num">${c.minCost != null ? fmtCr(c.minCost) : '—'}</td>
      <td class="cmdr-num">${c.maxCost != null ? fmtCr(c.maxCost) : '—'}</td>
    </tr>
  `).join('') || '<tr><td colspan="4">No outfitting data available here.</td></tr>';

  panel.innerHTML = `
    <div class="cmdr-subhead">
      <h2>Shipyard</h2>
      <span class="cmdr-subhead-meta">${esc(data.station ?? 'Unknown station')}${data.system ? ` · ${esc(data.system)}` : ''}</span>
    </div>
    <div class="cmdr-table-wrap">
      <table class="cmdr-table">
        <thead><tr><th>Ship</th><th class="cmdr-num">Base Value</th></tr></thead>
        <tbody>${shipRows}</tbody>
      </table>
    </div>

    <div class="cmdr-subhead"><h2>Outfitting (${fmtNum(data.moduleCount)} modules)</h2></div>
    <div class="cmdr-table-wrap">
      <table class="cmdr-table">
        <thead><tr><th>Category</th><th class="cmdr-num">Count</th><th class="cmdr-num">Min Cost</th><th class="cmdr-num">Max Cost</th></tr></thead>
        <tbody>${moduleRows}</tbody>
      </table>
    </div>
  `;
}

// ─── Fleet Carrier panel ─────────────────────────────────────────────────────

function renderCarrierPanel(data) {
  const panel = document.getElementById('cmdrPanel-carrier');
  if (!data.available) {
    panel.innerHTML = `<div class="cmdr-panel-message">No fleet carrier on file — this shows up once you own a carrier and have opened its management UI in-game at least once.</div>`;
    return;
  }

  const name = data.vanityName || data.callsign || 'Carrier';
  const stats = `
    <div class="cmdr-stat-row">
      <div class="cmdr-stat"><div class="cmdr-stat-value">${esc(data.currentSystem ?? '—')}</div><div class="cmdr-stat-label">Current System</div></div>
      <div class="cmdr-stat"><div class="cmdr-stat-value">${esc(data.dockingAccess ?? '—')}</div><div class="cmdr-stat-label">Docking Access</div></div>
      <div class="cmdr-stat"><div class="cmdr-stat-value">${data.fuel != null ? fmtNum(data.fuel) : '—'}</div><div class="cmdr-stat-label">Tritium Fuel</div></div>
      <div class="cmdr-stat"><div class="cmdr-stat-value">${fmtCr(data.balance)}</div><div class="cmdr-stat-label">Balance</div></div>
    </div>
  `;

  const cargoRows = data.cargo.map(c => `
    <tr><td>${esc(c.name)}${c.stolen ? ' <span style="opacity:0.6">(stolen)</span>' : ''}</td><td class="cmdr-num">${fmtNum(c.qty)}</td></tr>
  `).join('') || '<tr><td colspan="2">Cargo hold is empty.</td></tr>';

  const orderRows = data.orders.map(o => `
    <tr>
      <td>${esc(o.name)}</td>
      <td class="cmdr-num">${fmtCr(o.sellPrice)}</td>
      <td class="cmdr-num">${fmtCr(o.buyPrice)}</td>
      <td class="cmdr-num">${fmtNum(o.stock)}</td>
      <td class="cmdr-num">${fmtNum(o.demand)}</td>
    </tr>
  `).join('') || '<tr><td colspan="5">No active buy/sell orders.</td></tr>';

  panel.innerHTML = `
    <div class="cmdr-subhead"><h2>${esc(name)}</h2>${data.callsign ? `<span class="cmdr-subhead-meta">${esc(data.callsign)}</span>` : ''}</div>
    ${stats}

    <div class="cmdr-subhead"><h2>Cargo Hold</h2></div>
    <div class="cmdr-table-wrap">
      <table class="cmdr-table"><thead><tr><th>Commodity</th><th class="cmdr-num">Qty</th></tr></thead><tbody>${cargoRows}</tbody></table>
    </div>

    <div class="cmdr-subhead"><h2>Buy / Sell Orders</h2></div>
    <div class="cmdr-table-wrap">
      <table class="cmdr-table">
        <thead><tr><th>Commodity</th><th class="cmdr-num">Sell</th><th class="cmdr-num">Buy</th><th class="cmdr-num">Stock</th><th class="cmdr-num">Demand</th></tr></thead>
        <tbody>${orderRows}</tbody>
      </table>
    </div>
  `;
}

// ─── Community Goals panel ───────────────────────────────────────────────────

function renderGoalsPanel(data) {
  const panel = document.getElementById('cmdrPanel-goals');
  if (!data.available || !data.goals.length) {
    panel.innerHTML = `<div class="cmdr-panel-message">No active Community Goals on file right now.</div>`;
    return;
  }

  const cards = data.goals.map(g => {
    const pct = g.target ? Math.min(100, Math.round((g.current ?? 0) / g.target * 100)) : null;
    return `
      <div class="cmdr-goal-card">
        <h3>${esc(g.title)}</h3>
        <div class="cmdr-goal-meta">${esc(g.market ?? '')}${g.market && g.system ? ' · ' : ''}${esc(g.system ?? '')}${g.expiry ? ` · Ends ${esc(g.expiry)}` : ''}</div>
        ${pct != null ? `
          <div class="cmdr-goal-bar-track"><div class="cmdr-goal-bar-fill" style="width:${pct}%"></div></div>
          <div class="cmdr-goal-progress"><span>${fmtNum(g.current)} / ${fmtNum(g.target)}</span><span>${pct}%</span></div>
        ` : ''}
        ${g.contribution != null ? `<div class="cmdr-goal-progress" style="margin-top:0.5rem;"><span>Your contribution</span><span>${fmtNum(g.contribution)}</span></div>` : ''}
        ${g.tierReached ? `<div class="cmdr-goal-progress"><span>Tier reached</span><span>${esc(g.tierReached)}</span></div>` : ''}
      </div>
    `;
  }).join('');

  panel.innerHTML = cards;
}

// ─── init ────────────────────────────────────────────────────────────────────

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
    renderShell(data);
  } catch (err) {
    console.error('[commander] fleet fetch failed:', err);
    showMessage(`<p>Couldn't load fleet data — try logging in again.</p><a href="/auth/login" class="cta-button">Login with Frontier</a>`);
  }
}

init();
