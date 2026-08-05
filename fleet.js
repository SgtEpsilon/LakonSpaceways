/**
 * fleet.js — Lakon Spaceways Fleet Renderer
 *
 * Ship data is bundled (coriolis.io DNS is currently down; data doesn't change
 * except on game patches). Stats from EDCD/coriolis-data + INARA cross-check.
 *
 * LIVE DATA — Spansh Station Search (via built-in server proxy)
 * ---------------------------------------------------------------
 * Spansh's API doesn't send CORS headers, so direct browser fetches are blocked.
 * Requests route through server.js's own /api/stations/search route, which
 * forwards the POST to spansh.co.uk server-side. Since the site and the proxy
 * are served from the same origin, there's no CORS issue to work around at all —
 * PROXY_URL just stays empty and the fetch below hits a relative path.
 *
 * If you ever host the static files somewhere separate from server.js (e.g. a
 * CDN), set PROXY_URL to the full origin of wherever server.js is running,
 * e.g. 'https://your-domain-or-tunnel-url.example'.
 *
 * TOOL LINKS
 * ----------
 * Coriolis: https://coriolis.io/outfit/<key>  (Type-11 → beta.coriolis.io)
 * EDSY:     No ship-slug URL exists; links to edsy.org shipyard root.
 */

// ─── SHIP DATA ────────────────────────────────────────────────────────────────
// spanshName: exact string used by Spansh's ships_sold filter (matches in-game name)

const LAKON_FLEET = [
  {
    name: 'Alliance Challenger',
    spanshName: 'Alliance Challenger',
    shipClass: 'Medium Combat Vessel',
    category: 'combat',
    description: "Developed in partnership with Alliance Naval Architects. Combines Lakon's engineering heritage with advanced military specifications and tactical systems.",
    coriolisKey: 'alliance_challenger', coriolisBeta: false,
    specs: { pad: 'M', hardpoints: 6, cargo: null, fsdClass: 5, jumpRange: 42.05,  mass: 450,  crew: 2, price: 30_069_013 },
  },
  {
    name: 'Alliance Chieftain',
    spanshName: 'Alliance Chieftain',
    shipClass: 'Medium Combat Vessel',
    category: 'combat',
    description: 'The premier Alliance combat platform featuring superior firepower distribution and enhanced maneuverability. Designed for tactical superiority in contested space.',
    coriolisKey: 'alliance_chieftain', coriolisBeta: false,
    specs: { pad: 'M', hardpoints: 8, cargo: null, fsdClass: 5, jumpRange: 46.92,  mass: 400,  crew: 2, price: 19_382_250 },
  },
  {
    name: 'Alliance Crusader',
    spanshName: 'Alliance Crusader',
    shipClass: 'Multi-Role Combat Vessel',
    category: 'multi-role',
    description: 'Versatile Alliance warship optimized for extended operations. Features enhanced defensive systems and expanded cargo capacity for sustained military campaigns.',
    coriolisKey: 'alliance_crusader', coriolisBeta: false,
    specs: { pad: 'M', hardpoints: 6, cargo: null, fsdClass: 6, jumpRange: 40.26,  mass: 500,  crew: 2, price: 23_975_290 },
  },
  {
    name: 'ASP Explorer',
    spanshName: 'Asp Explorer',
    shipClass: 'Deep Space Explorer',
    category: 'exploration',
    description: 'Renowned throughout the galaxy for exceptional long-range capabilities. The vessel of choice for professional explorers and scientific expeditions.',
    coriolisKey: 'asp', coriolisBeta: false,
    specs: { pad: 'M', hardpoints: 4, cargo: 28,  fsdClass: 5, jumpRange: 134.33, mass: 280,  crew: 2, price: 6_661_153 },
  },
  {
    name: 'ASP Scout',
    spanshName: 'Asp Scout',
    shipClass: 'Light Explorer',
    category: 'exploration',
    description: 'Compact reconnaissance platform built on the proven ASP architecture. Optimized for rapid deployment and covert operations in unexplored territories.',
    coriolisKey: 'asp_scout', coriolisBeta: false,
    specs: { pad: 'M', hardpoints: 4, cargo: 16,  fsdClass: 5, jumpRange: 96.31,  mass: 234,  crew: 2, price: 3_961_154 },
  },
  {
    name: 'Diamondback Explorer',
    spanshName: 'Diamondback Explorer',
    shipClass: 'Compact Explorer',
    category: 'exploration',
    description: 'Sophisticated exploration platform featuring advanced thermal management and optimized power distribution for extended autonomous operations.',
    coriolisKey: 'diamondback_explorer', coriolisBeta: false,
    specs: { pad: 'S', hardpoints: 4, cargo: 12,  fsdClass: 5, jumpRange: 161.13, mass: 260,  crew: 1, price: 1_894_760 },
  },
  {
    name: 'Diamondback Scout',
    spanshName: 'Diamondback Scout',
    shipClass: 'Light Multi-Role',
    category: 'multi-role',
    description: 'Agile reconnaissance vessel combining exploration capabilities with defensive armament. Features enhanced sensor arrays and stealth characteristics.',
    coriolisKey: 'diamondback', coriolisBeta: false,
    specs: { pad: 'S', hardpoints: 4, cargo: 8,   fsdClass: 4, jumpRange: 94.19,  mass: 170,  crew: 1, price: 564_328 },
  },
  {
    name: 'Keelback',
    spanshName: 'Keelback',
    shipClass: 'Armed Transport',
    category: 'transport',
    description: 'Versatile cargo vessel with defensive capabilities. Features fighter bay compatibility and robust construction for operations in contested trade routes.',
    coriolisKey: 'keelback', coriolisBeta: false,
    specs: { pad: 'M', hardpoints: 4, cargo: 84,  fsdClass: 4, jumpRange: 50.51,  mass: 180,  crew: 2, price: 3_053_050 },
  },
  {
    name: 'Type-6 Transporter',
    spanshName: 'Type-6 Transporter',
    shipClass: 'Light Transport',
    category: 'transport',
    description: 'An accessible entry point into commercial space operations without compromising on the quality and dependability that defines the Lakon brand.',
    coriolisKey: 'type_6_transporter', coriolisBeta: false,
    specs: { pad: 'M', hardpoints: 2, cargo: 106, fsdClass: 5, jumpRange: 113.72, mass: 155,  crew: 1, price: 1_045_945 },
  },
  {
    name: 'Type-7 Transporter',
    spanshName: 'Type-7 Transporter',
    shipClass: 'Medium Transport',
    category: 'transport',
    description: 'The backbone of interstellar commerce. Offers an optimal balance of cargo capacity, operational efficiency, and navigational flexibility for established trade routes.',
    coriolisKey: 'type_7_transport', coriolisBeta: false,
    specs: { pad: 'L', hardpoints: 2, cargo: 302, fsdClass: 6, jumpRange: 76.52,  mass: 420,  crew: 1, price: 17_472_252 },
  },
  {
    name: 'Type-8 Transporter',
    spanshName: 'Type-8 Transporter',
    shipClass: 'Heavy Transport',
    category: 'transport',
    description: 'Advanced cargo platform bridging the gap between medium and super-heavy transport operations. Features enhanced structural integrity and improved fuel efficiency.',
    coriolisKey: 'type_8_transporter', coriolisBeta: false,
    specs: { pad: 'L', hardpoints: 2, cargo: 390, fsdClass: 7, jumpRange: 64.32,  mass: 650,  crew: 2, price: 47_970_000 },
  },
  {
    name: 'Type-9 Heavy',
    spanshName: 'Type-9 Heavy',
    shipClass: 'Super Heavy Transport',
    category: 'transport',
    description: 'The definitive solution for large-scale cargo operations. Engineered for maximum payload capacity while maintaining the structural integrity and reliability standards expected from Lakon Spaceways.',
    coriolisKey: 'type_9_heavy', coriolisBeta: false,
    specs: { pad: 'L', hardpoints: 4, cargo: 758, fsdClass: 6, jumpRange: 48.58,  mass: 1000, crew: 3, price: 76_555_842 },
  },
  {
    name: 'Type-10 Defender',
    spanshName: 'Type-10 Defender',
    shipClass: 'Heavy Combat Transport',
    category: 'combat',
    description: 'Military-grade defensive platform built on the Type-9 chassis. Combines massive firepower with substantial cargo capacity for military supply operations.',
    coriolisKey: 'type_10_defender', coriolisBeta: false,
    specs: { pad: 'L', hardpoints: 9, cargo: 470, fsdClass: 6, jumpRange: 40.19,  mass: 1200, crew: 3, price: 124_755_341 },
  },
  {
    name: 'Type-11 Prospector',
    spanshName: 'Type-11 Prospector',
    shipClass: 'Medium Mining Vessel',
    category: 'mining',
    description: 'Built upon the successful Type-8 platform, the Type-11 is engineered to redefine medium-sized mining efficiency. Bespoke modules, lightweight construction and a reinforced FSD housing grant superior management of overcharged Frame Shift Drives.',
    coriolisKey: 'type_11_prospector', coriolisBeta: true,
    specs: { pad: 'M', hardpoints: 5, cargo: 192, fsdClass: 5, jumpRange: null,   mass: 320,  crew: 3, price: 67_861_850 },
  },
];

// ─── SPANSH STATION LOOKUP ────────────────────────────────────────────────────

// Leave this empty to hit server.js's proxy route on the same origin
// (the normal case). Only set it if the site is hosted separately from
// server.js — see the comment block above for details.
const PROXY_URL = '';

const PAD_LABELS = { S: 'Small', M: 'Medium', L: 'Large' };

async function findNearestStations(spanshName, referenceSystem) {
  const body = {
    filters: {
      ships_sold: { value: [spanshName] },
    },
    sort: [{ distance: { direction: 'asc' } }],
    reference_system: referenceSystem,
    size: 5,
    page: 0,
  };

  const resp = await fetch(`${PROXY_URL}/api/stations/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    throw new Error(`Spansh proxy returned HTTP ${resp.status}${errText ? ` — ${errText}` : ''}`);
  }
  return resp.json();
}

function formatDistance(d) {
  if (d == null) return '—';
  return d < 10 ? `${d.toFixed(2)} ly` : `${Math.round(d)} ly`;
}

function formatAge(updatedAt) {
  if (!updatedAt) return null;
  const days = Math.floor((Date.now() - new Date(updatedAt)) / 86_400_000);
  if (days === 0) return 'updated today';
  if (days === 1) return 'updated yesterday';
  return `updated ${days}d ago`;
}

function renderStationResults(container, data) {
  const results = data?.results ?? [];
  if (!results.length) {
    container.innerHTML = `<div class="spansh-empty">No stations found near this system.</div>`;
    return;
  }

  const rows = results.map(r => {
    const dist = formatDistance(r.distance);
    const pad  = PAD_LABELS[r.max_landing_pad_size] ?? r.max_landing_pad_size ?? '—';
    const age  = formatAge(r.updated_at);
    const stationType = r.type ?? '';
    return `
      <div class="spansh-row">
        <div class="spansh-station">
          <span class="spansh-station-name">${r.name}</span>
          <span class="spansh-system-name">${r.system_name}</span>
        </div>
        <div class="spansh-meta">
          <span class="spansh-dist">${dist}</span>
          <span class="spansh-pad">Pad ${pad}</span>
          ${age ? `<span class="spansh-age">${age}</span>` : ''}
        </div>
      </div>`;
  }).join('');

  container.innerHTML = `
    <div class="spansh-header">Nearest stations selling this ship</div>
    <div class="spansh-results">${rows}</div>
    <div class="spansh-footer">Data via <a href="https://spansh.co.uk/stations" target="_blank" rel="noopener">Spansh</a> · refreshed daily from EDDN</div>
  `;
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

const PAD_SIZE_LABELS = { S: 'Small', M: 'Medium', L: 'Large' };

function buildSpecItems(specs) {
  if (!specs) return [];
  const items = [];
  if (specs.pad != null)        items.push(`Landing Pad: ${PAD_SIZE_LABELS[specs.pad] ?? specs.pad}`);
  if (specs.hardpoints != null) items.push(`Hardpoints: ${specs.hardpoints}`);
  if (specs.cargo != null)      items.push(`Cargo: ${specs.cargo} t`);
  if (specs.fsdClass != null)   items.push(`FSD: Class ${specs.fsdClass}`);
  if (specs.jumpRange != null)  items.push(`Max Jump: ${specs.jumpRange.toFixed(2)} ly`);
  if (specs.mass != null)       items.push(`Hull Mass: ${specs.mass.toLocaleString()} t`);
  if (specs.crew != null)       items.push(`Crew: ${specs.crew}`);
  return items;
}

function formatPrice(p) {
  return p != null ? `${(p / 1_000_000).toFixed(2)}M Cr` : null;
}

function coriolisUrl(ship) {
  const host = ship.coriolisBeta ? 'https://beta.coriolis.io' : 'https://coriolis.io';
  return `${host}/outfit/${ship.coriolisKey}`;
}

const ICON_CORIOLIS = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="8"/><line x1="12" y1="16" x2="12" y2="22"/><line x1="2" y1="12" x2="8" y2="12"/><line x1="16" y1="12" x2="22" y2="12"/></svg>`;
const ICON_EDSY     = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5"/><line x1="12" y1="22" x2="12" y2="15.5"/><polyline points="22 8.5 12 15.5 2 8.5"/></svg>`;
const ICON_LOCATE   = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="9"/></svg>`;

// ─── RENDER ───────────────────────────────────────────────────────────────────

function renderFleet() {
  const grid    = document.getElementById('fleetGrid');
  const filters = document.getElementById('fleetFilters');
  const badge   = document.getElementById('dataStatusBadge');
  if (badge) badge.remove();
  filters.style.display = 'flex';

  // Shared reference system state
  let currentSystem = '';

  function getSystemInput() {
    return document.getElementById('spanshSystemInput');
  }

  function buildCards(filter) {
    grid.innerHTML = '';

    // ── System input bar ──────────────────────────────────────────────────────
    const systemBar = document.createElement('div');
    systemBar.className = 'spansh-system-bar fade-in';
    systemBar.innerHTML = `
      <div class="spansh-bar-inner">
        <label for="spanshSystemInput" class="spansh-bar-label">
          ${ICON_LOCATE} Find nearest station selling each ship — enter your current system:
        </label>
        <div class="spansh-bar-controls">
          <input
            id="spanshSystemInput"
            class="spansh-system-input"
            type="text"
            placeholder="e.g. Sol, Shinrarta Dezhra, Alioth…"
            value="${currentSystem}"
            autocomplete="off"
            spellcheck="false"
          />
        </div>
      </div>
    `;
    grid.appendChild(systemBar);

    // Persist typed value across filter changes
    systemBar.querySelector('#spanshSystemInput').addEventListener('input', e => {
      currentSystem = e.target.value.trim();
    });

    // ── Ship cards ────────────────────────────────────────────────────────────
    const visible = filter === 'all'
      ? LAKON_FLEET
      : LAKON_FLEET.filter(s => s.category === filter);

    if (!visible.length) {
      const empty = document.createElement('div');
      empty.className = 'fleet-loading';
      empty.style.animation = 'none';
      empty.textContent = 'No ships in this category';
      grid.appendChild(empty);
      return;
    }

    visible.forEach((ship, i) => {
      const specs    = buildSpecItems(ship.specs);
      const price    = formatPrice(ship.specs?.price);
      const corLabel = ship.coriolisBeta ? 'Coriolis β' : 'Coriolis';

      const specsHtml = specs.length
        ? `<div class="specifications">
             <div class="spec-title">Specifications</div>
             <div class="spec-list">
               ${specs.map(s => `<div class="spec-item">${s}</div>`).join('')}
             </div>
           </div>`
        : '';

      const card = document.createElement('div');
      card.className = 'ship-card fade-in';
      card.style.animationDelay = `${(i % 4) * 0.08}s`;

      const cardId = `card-${ship.coriolisKey}`;
      card.id = cardId;

      card.innerHTML = `
        <h3>${ship.name}</h3>
        <div class="ship-class">${ship.shipClass}</div>
        <p>${ship.description}</p>
        ${price ? `<div class="ship-price">Base Price: ${price}</div>` : ''}
        ${specsHtml}
        <div class="tool-links">
          <a class="tool-link" href="${coriolisUrl(ship)}" target="_blank" rel="noopener">
            ${ICON_CORIOLIS} ${corLabel}
          </a>
          <a class="tool-link" href="https://edsy.org/" target="_blank" rel="noopener">
            ${ICON_EDSY} EDSY
          </a>
          <button class="tool-link spansh-find-btn" data-ship="${ship.spanshName}">
            ${ICON_LOCATE} Find Nearest
          </button>
        </div>
        <div class="spansh-output" id="spansh-${ship.coriolisKey}"></div>
      `;

      grid.appendChild(card);

      // Wire up the Find Nearest button
      const btn = card.querySelector('.spansh-find-btn');
      const output = card.querySelector('.spansh-output');

      btn.addEventListener('click', async () => {
        const system = getSystemInput()?.value.trim() || currentSystem;
        if (!system) {
          output.innerHTML = `<div class="spansh-error">Enter a reference system above first.</div>`;
          return;
        }
        currentSystem = system;

        btn.disabled = true;
        btn.classList.add('loading');
        output.innerHTML = `<div class="spansh-loading">Querying Spansh…</div>`;

        try {
          const data = await findNearestStations(ship.spanshName, system);
          renderStationResults(output, data);
        } catch (err) {
          console.error('[LakonSpaceways] Spansh query failed:', err);
          output.innerHTML = `<div class="spansh-error">Query failed — check the system name and try again.<br><small>${err.message}</small></div>`;
        } finally {
          btn.disabled = false;
          btn.classList.remove('loading');
        }
      });
    });

    // Re-observe new cards
    if (typeof observer !== 'undefined') {
      document.querySelectorAll('.ship-card.fade-in, .spansh-system-bar.fade-in')
        .forEach(el => observer.observe(el));
    }
  }

  buildCards('all');

  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      buildCards(btn.dataset.filter);
    });
  });
}

renderFleet();
