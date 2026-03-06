/**
 * fleet.js — Lakon Spaceways Fleet Renderer
 *
 * Ship data is bundled here rather than fetched from coriolis.io.
 * Why: coriolis.io has been intermittently down (DNS failing as of early 2026)
 * and serves its data files without CORS headers even when up, so browser
 * fetches are blocked regardless. Bundling the data removes the dependency
 * entirely and makes the fleet section load instantly.
 *
 * Stats are stock (unengineered) values sourced from the coriolis-data GitHub
 * repo (github.com/EDCD/coriolis-data) and cross-checked against INARA.
 * Update this file when ships are added or stats change.
 *
 * TOOL LINKS
 * ----------
 * Coriolis: https://coriolis.io/outfit/<key>
 *           Type-11 links to beta.coriolis.io (not yet on main site).
 *
 * EDSY:     EDSY has no ship-slug URL — all builds are opaque hash fragments.
 *           Links go to edsy.org (the shipyard root); users select their hull.
 */

// ─── SHIP DATA ────────────────────────────────────────────────────────────────

const LAKON_FLEET = [
  {
    name: 'Alliance Challenger',
    shipClass: 'Medium Combat Vessel',
    category: 'combat',
    description: "Developed in partnership with Alliance Naval Architects. Combines Lakon's engineering heritage with advanced military specifications and tactical systems.",
    coriolisKey: 'alliance_challenger',
    coriolisBeta: false,
    specs: { hardpoints: 6, cargo: null, fsdClass: 5, jumpRange: 42.05,  mass: 450,  crew: 2, price: 30_069_013  },
  },
  {
    name: 'Alliance Chieftain',
    shipClass: 'Medium Combat Vessel',
    category: 'combat',
    description: 'The premier Alliance combat platform featuring superior firepower distribution and enhanced maneuverability. Designed for tactical superiority in contested space.',
    coriolisKey: 'alliance_chieftain',
    coriolisBeta: false,
    specs: { hardpoints: 8, cargo: null, fsdClass: 5, jumpRange: 46.92,  mass: 400,  crew: 2, price: 19_382_250  },
  },
  {
    name: 'Alliance Crusader',
    shipClass: 'Multi-Role Combat Vessel',
    category: 'multi-role',
    description: 'Versatile Alliance warship optimized for extended operations. Features enhanced defensive systems and expanded cargo capacity for sustained military campaigns.',
    coriolisKey: 'alliance_crusader',
    coriolisBeta: false,
    specs: { hardpoints: 6, cargo: null, fsdClass: 6, jumpRange: 40.26,  mass: 500,  crew: 2, price: 23_975_290  },
  },
  {
    name: 'ASP Explorer',
    shipClass: 'Deep Space Explorer',
    category: 'exploration',
    description: 'Renowned throughout the galaxy for exceptional long-range capabilities. The vessel of choice for professional explorers and scientific expeditions.',
    coriolisKey: 'asp',
    coriolisBeta: false,
    specs: { hardpoints: 4, cargo: 28,   fsdClass: 5, jumpRange: 134.33, mass: 280,  crew: 2, price: 6_661_153   },
  },
  {
    name: 'ASP Scout',
    shipClass: 'Light Explorer',
    category: 'exploration',
    description: 'Compact reconnaissance platform built on the proven ASP architecture. Optimized for rapid deployment and covert operations in unexplored territories.',
    coriolisKey: 'asp_scout',
    coriolisBeta: false,
    specs: { hardpoints: 4, cargo: 16,   fsdClass: 5, jumpRange: 96.31,  mass: 234,  crew: 2, price: 3_961_154   },
  },
  {
    name: 'Diamondback Explorer',
    shipClass: 'Compact Explorer',
    category: 'exploration',
    description: 'Sophisticated exploration platform featuring advanced thermal management and optimized power distribution for extended autonomous operations.',
    coriolisKey: 'diamondback_explorer',
    coriolisBeta: false,
    specs: { hardpoints: 4, cargo: 12,   fsdClass: 5, jumpRange: 161.13, mass: 260,  crew: 1, price: 1_894_760   },
  },
  {
    name: 'Diamondback Scout',
    shipClass: 'Light Multi-Role',
    category: 'multi-role',
    description: 'Agile reconnaissance vessel combining exploration capabilities with defensive armament. Features enhanced sensor arrays and stealth characteristics.',
    coriolisKey: 'diamondback',
    coriolisBeta: false,
    specs: { hardpoints: 4, cargo: 8,    fsdClass: 4, jumpRange: 94.19,  mass: 170,  crew: 1, price: 564_328     },
  },
  {
    name: 'Keelback',
    shipClass: 'Armed Transport',
    category: 'transport',
    description: 'Versatile cargo vessel with defensive capabilities. Features fighter bay compatibility and robust construction for operations in contested trade routes.',
    coriolisKey: 'keelback',
    coriolisBeta: false,
    specs: { hardpoints: 4, cargo: 84,   fsdClass: 4, jumpRange: 50.51,  mass: 180,  crew: 2, price: 3_053_050   },
  },
  {
    name: 'Type-6 Transporter',
    shipClass: 'Light Transport',
    category: 'transport',
    description: 'An accessible entry point into commercial space operations without compromising on the quality and dependability that defines the Lakon brand.',
    coriolisKey: 'type_6_transporter',
    coriolisBeta: false,
    specs: { hardpoints: 2, cargo: 106,  fsdClass: 5, jumpRange: 113.72, mass: 155,  crew: 1, price: 1_045_945   },
  },
  {
    name: 'Type-7 Transporter',
    shipClass: 'Medium Transport',
    category: 'transport',
    description: 'The backbone of interstellar commerce. Offers an optimal balance of cargo capacity, operational efficiency, and navigational flexibility for established trade routes.',
    coriolisKey: 'type_7_transport',
    coriolisBeta: false,
    specs: { hardpoints: 2, cargo: 302,  fsdClass: 6, jumpRange: 76.52,  mass: 420,  crew: 1, price: 17_472_252  },
  },
  {
    name: 'Type-8 Transporter',
    shipClass: 'Heavy Transport',
    category: 'transport',
    description: 'Advanced cargo platform bridging the gap between medium and super-heavy transport operations. Features enhanced structural integrity and improved fuel efficiency.',
    coriolisKey: 'type_8_transporter',
    coriolisBeta: false,
    specs: { hardpoints: 2, cargo: 390,  fsdClass: 7, jumpRange: 64.32,  mass: 650,  crew: 2, price: 47_970_000  },
  },
  {
    name: 'Type-9 Heavy',
    shipClass: 'Super Heavy Transport',
    category: 'transport',
    description: 'The definitive solution for large-scale cargo operations. Engineered for maximum payload capacity while maintaining the structural integrity and reliability standards expected from Lakon Spaceways.',
    coriolisKey: 'type_9_heavy',
    coriolisBeta: false,
    specs: { hardpoints: 4, cargo: 758,  fsdClass: 6, jumpRange: 48.58,  mass: 1000, crew: 3, price: 76_555_842  },
  },
  {
    name: 'Type-10 Defender',
    shipClass: 'Heavy Combat Transport',
    category: 'combat',
    description: 'Military-grade defensive platform built on the Type-9 chassis. Combines massive firepower with substantial cargo capacity for military supply operations.',
    coriolisKey: 'type_10_defender',
    coriolisBeta: false,
    specs: { hardpoints: 9, cargo: 470,  fsdClass: 6, jumpRange: 40.19,  mass: 1200, crew: 3, price: 124_755_341 },
  },
  {
    name: 'Type-11 Prospector',
    shipClass: 'Medium Mining Vessel',
    category: 'mining',
    description: 'Built upon the successful Type-8 platform, the Type-11 is engineered to redefine medium-sized mining efficiency. Bespoke modules, lightweight construction and a reinforced FSD housing grant superior management of overcharged Frame Shift Drives.',
    coriolisKey: 'type_11_prospector',
    // Type-11 is only on beta.coriolis.io as of early 2026
    coriolisBeta: true,
    specs: { hardpoints: 5, cargo: 192,  fsdClass: 5, jumpRange: null,   mass: 320,  crew: 3, price: 67_861_850  },
  },
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function buildSpecItems(specs) {
  if (!specs) return [];
  const items = [];
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

// ─── RENDER ───────────────────────────────────────────────────────────────────

function renderFleet() {
  const grid    = document.getElementById('fleetGrid');
  const filters = document.getElementById('fleetFilters');

  // Remove the live data status badge entirely — data is now bundled
  const badge = document.getElementById('dataStatusBadge');
  if (badge) badge.remove();

  filters.style.display = 'flex';

  function buildCards(filter) {
    grid.innerHTML = '';
    const visible = filter === 'all'
      ? LAKON_FLEET
      : LAKON_FLEET.filter(s => s.category === filter);

    if (!visible.length) {
      grid.innerHTML = `<div class="fleet-loading" style="animation:none;">No ships in this category</div>`;
      return;
    }

    visible.forEach((ship, i) => {
      const specs    = buildSpecItems(ship.specs);
      const price    = formatPrice(ship.specs?.price);
      const corLabel = ship.coriolisBeta ? 'Coriolis β' : 'Coriolis';
      const corTitle = ship.coriolisBeta
        ? `Configure ${ship.name} in Coriolis (beta — not yet on main site)`
        : `Configure ${ship.name} in Coriolis`;

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

      card.innerHTML = `
        <h3>${ship.name}</h3>
        <div class="ship-class">${ship.shipClass}</div>
        <p>${ship.description}</p>
        ${price ? `<div class="ship-price">Base Price: ${price}</div>` : ''}
        ${specsHtml}
        <div class="tool-links">
          <a class="tool-link" href="${coriolisUrl(ship)}" target="_blank" rel="noopener" title="${corTitle}">
            ${ICON_CORIOLIS} ${corLabel}
          </a>
          <a class="tool-link" href="https://edsy.org/" target="_blank" rel="noopener" title="Open EDSY — select ${ship.name} in the shipyard">
            ${ICON_EDSY} EDSY
          </a>
        </div>
      `;

      grid.appendChild(card);
    });

    if (typeof observer !== 'undefined') {
      document.querySelectorAll('.ship-card.fade-in').forEach(el => observer.observe(el));
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
