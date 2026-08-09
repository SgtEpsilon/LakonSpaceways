/**
 * rank-names.js — rank index -> display name tables
 *
 * Ported from Elite Explorer (ui/script.js) so both apps agree. The cAPI
 * returns ranks as numeric indexes (or [index, progress] pairs) rather
 * than names, so these tables translate them.
 */

const COMBAT_RANKS  = ['Harmless','Mostly Harmless','Novice','Competent','Expert','Master','Dangerous','Deadly','Elite'];
const TRADE_RANKS   = ['Penniless','Mostly Penniless','Peddler','Dealer','Merchant','Broker','Entrepreneur','Tycoon','Elite'];
const EXPLORE_RANKS = ['Aimless','Mostly Aimless','Scout','Surveyor','Trailblazer','Pathfinder','Ranger','Pioneer','Elite'];
const CQC_RANKS     = ['Helpless','Mostly Helpless','Amateur','Semi-Pro','Professional','Champion','Hero','Gladiator','Elite'];
const EMPIRE_RANKS  = ['None','Outsider','Serf','Master','Squire','Knight','Lord','Baron','Viscount','Count','Earl','Marquis','Duke','Prince','King'];
const FED_RANKS     = ['None','Recruit','Cadet','Midshipman','Petty Officer','Chief Petty Officer','Warrant Officer','Ensign','Lieutenant','Lt. Commander','Post Commander','Post Captain','Rear Admiral','Vice Admiral','Admiral'];

const RANK_TABLES = {
  combat: COMBAT_RANKS,
  trade: TRADE_RANKS,
  explore: EXPLORE_RANKS,
  cqc: CQC_RANKS,
  empire: EMPIRE_RANKS,
  federation: FED_RANKS,
};

// index can be a plain number, or the cAPI's [index, progress] pair, or
// (rarely observed) {rank, progress} — handle all three defensively since
// this is an undocumented, reverse-engineered API and the shape isn't
// guaranteed.
function rankName(category, indexOrPair) {
  const table = RANK_TABLES[category];
  if (!table) return null;
  let idx = indexOrPair;
  if (Array.isArray(indexOrPair)) idx = indexOrPair[0];
  else if (indexOrPair && typeof indexOrPair === 'object') idx = indexOrPair.rank ?? indexOrPair.index;
  if (typeof idx !== 'number' || idx < 0 || idx >= table.length) return null;
  return table[idx];
}

function rankProgress(indexOrPair) {
  if (Array.isArray(indexOrPair)) return typeof indexOrPair[1] === 'number' ? indexOrPair[1] : null;
  if (indexOrPair && typeof indexOrPair === 'object' && typeof indexOrPair.progress === 'number') return indexOrPair.progress;
  return null;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { RANK_TABLES, rankName, rankProgress };
}
