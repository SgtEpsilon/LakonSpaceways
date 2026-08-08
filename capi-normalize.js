/**
 * capi-normalize.js — flattens raw Frontier cAPI payloads into shapes the
 * frontend can render without knowing Frontier's (undocumented, and
 * occasionally inconsistent) field names.
 *
 * IMPORTANT: Frontier does not publish an official schema for /market,
 * /shipyard, /fleetcarrier, or /communitygoals. Everything below is based
 * on community documentation (EDCD/FDevIDs, EDMarketConnector's parsing
 * code) rather than a spec. Each normalizer is defensive — it tries a
 * couple of known-plausible key names and falls back to null/empty rather
 * than throwing — but treat the exact field names as "best guess until
 * verified against a live response", the same way Elite Explorer's
 * Guardian Sites work is waiting on a live probeSystem() call before the
 * UI gets finalized. If a section renders empty/odd for your account,
 * log `raw` in the relevant route in server.js and adjust the lookups
 * here — the shape almost certainly just needs a key added.
 */

// ─── shared helpers ─────────────────────────────────────────────────────────

// cAPI numeric fields sometimes arrive as strings — coerce, never throw.
function numOrNull(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function strOrNull(v) {
  return typeof v === 'string' && v.length ? v : null;
}

// Try several possible key names on an object, return the first hit.
function pick(obj, keys) {
  if (!obj) return undefined;
  for (const k of keys) {
    if (obj[k] !== undefined) return obj[k];
  }
  return undefined;
}

// ─── /market ────────────────────────────────────────────────────────────────

function normalizeMarket(raw) {
  const list = Array.isArray(raw?.commodities) ? raw.commodities : [];
  const commodities = list.filter(Boolean).map(c => ({
    name: strOrNull(pick(c, ['name', 'locName'])) || 'Unknown commodity',
    category: strOrNull(pick(c, ['category', 'categoryname'])),
    buyPrice: numOrNull(c.buyPrice),
    sellPrice: numOrNull(c.sellPrice),
    demand: numOrNull(c.demand),
    stock: numOrNull(c.stock),
  })).filter(c => c.buyPrice != null || c.sellPrice != null);

  return {
    available: commodities.length > 0,
    station: strOrNull(pick(raw, ['name', 'stationName'])),
    system: strOrNull(pick(raw, ['starsystem', 'systemName'])),
    commodities: commodities.sort((a, b) => a.name.localeCompare(b.name)),
  };
}

// ─── /shipyard ──────────────────────────────────────────────────────────────

function normalizeShipyard(raw) {
  const shipList = raw?.ships?.shipyard_list || {};
  const ships = Object.values(shipList)
    .filter(Boolean)
    .map(s => ({
      name: strOrNull(pick(s, ['name', 'localised'])) || 'Unknown ship',
      basevalue: numOrNull(pick(s, ['basevalue', 'value'])),
    }));

  const modulesRaw = raw?.modules || {};
  const modules = Object.values(modulesRaw).filter(Boolean).map(m => ({
    name: strOrNull(pick(m, ['name', 'locName'])) || 'Unknown module',
    category: strOrNull(pick(m, ['category', 'categoryname'])) || 'Uncategorized',
    cost: numOrNull(m.cost),
  }));

  // Group modules by category with a count + cheapest/most-expensive range,
  // rather than dumping (often several hundred) individual rows.
  const byCategory = {};
  for (const m of modules) {
    if (!byCategory[m.category]) byCategory[m.category] = { category: m.category, count: 0, costs: [] };
    byCategory[m.category].count += 1;
    if (m.cost != null) byCategory[m.category].costs.push(m.cost);
  }
  const moduleCategories = Object.values(byCategory).map(c => ({
    category: c.category,
    count: c.count,
    minCost: c.costs.length ? Math.min(...c.costs) : null,
    maxCost: c.costs.length ? Math.max(...c.costs) : null,
  })).sort((a, b) => a.category.localeCompare(b.category));

  return {
    available: ships.length > 0 || modules.length > 0,
    station: strOrNull(pick(raw, ['name', 'stationName'])),
    system: strOrNull(pick(raw, ['starsystem', 'systemName'])),
    ships: ships.sort((a, b) => a.name.localeCompare(b.name)),
    moduleCategories,
    moduleCount: modules.length,
  };
}

// ─── /fleetcarrier ──────────────────────────────────────────────────────────

function normalizeFleetCarrier(raw) {
  if (!raw || typeof raw !== 'object' || (!raw.name && !raw.market && !raw.cargo)) {
    return { available: false };
  }

  const cargoRaw = Array.isArray(raw.cargo) ? raw.cargo : [];
  const cargo = cargoRaw.filter(Boolean).map(c => ({
    name: strOrNull(pick(c, ['commodity', 'name', 'locName'])) || 'Unknown',
    qty: numOrNull(pick(c, ['qty', 'quantity', 'stock'])),
    stolen: Boolean(c.stolen),
  })).filter(c => c.qty);

  const ordersRaw = raw.orders?.commodities || raw.market?.commodities || [];
  const orders = (Array.isArray(ordersRaw) ? ordersRaw : []).filter(Boolean).map(o => ({
    name: strOrNull(pick(o, ['name', 'locName'])) || 'Unknown',
    buyPrice: numOrNull(o.buyPrice),
    sellPrice: numOrNull(o.sellPrice),
    stock: numOrNull(o.stock),
    demand: numOrNull(o.demand),
  })).filter(o => o.buyPrice != null || o.sellPrice != null);

  const finance = raw.finance || {};

  return {
    available: true,
    callsign: strOrNull(pick(raw.name || {}, ['callsign'])),
    vanityName: strOrNull(pick(raw.name || {}, ['vanityName', 'name'])),
    currentSystem: strOrNull(pick(raw, ['currentStarSystem', 'currentSystem'])),
    dockingAccess: strOrNull(raw.dockingAccess),
    notoriousAccess: Boolean(raw.notoriousAccess),
    fuel: numOrNull(pick(raw, ['fuel', 'fuelLevel'])),
    balance: numOrNull(pick(finance, ['availableBalance', 'balance', 'availableForConsumption'])),
    reserveBalance: numOrNull(pick(finance, ['reserveBalance', 'reserve'])),
    cargo: cargo.sort((a, b) => b.qty - a.qty),
    orders: orders.sort((a, b) => a.name.localeCompare(b.name)),
  };
}

// ─── /communitygoals ────────────────────────────────────────────────────────

function normalizeCommunityGoals(raw) {
  const list = Array.isArray(raw?.goals) ? raw.goals
    : Array.isArray(raw?.communitygoals) ? raw.communitygoals
    : Array.isArray(raw) ? raw
    : [];

  const goals = list.filter(Boolean).map(g => ({
    title: strOrNull(pick(g, ['title', 'name'])) || 'Community Goal',
    system: strOrNull(pick(g, ['system_name', 'systemName', 'starsystem'])),
    market: strOrNull(pick(g, ['market_name', 'marketName', 'station'])),
    target: numOrNull(pick(g, ['target', 'total'])),
    current: numOrNull(pick(g, ['currentTotal', 'current', 'progress'])),
    contribution: numOrNull(pick(g, ['contribution', 'playerContribution'])),
    tierReached: strOrNull(pick(g, ['tierReached', 'tier'])),
    isCompleted: Boolean(pick(g, ['isCompleted', 'completed'])),
    expiry: strOrNull(pick(g, ['expiry', 'expiryDate'])),
  }));

  return { available: goals.length > 0, goals };
}

module.exports = {
  numOrNull,
  strOrNull,
  normalizeMarket,
  normalizeShipyard,
  normalizeFleetCarrier,
  normalizeCommunityGoals,
};
