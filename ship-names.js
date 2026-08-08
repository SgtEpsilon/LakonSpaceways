/**
 * ship-names.js — Frontier journal "Ship" symbol -> display name
 *
 * Ported from Elite Explorer (ui/script.js) so both apps stay consistent.
 * The Companion API's /profile endpoint returns each stored ship's type as
 * Frontier's raw internal symbol, and those are inconsistent — some are
 * readable ("FerDeLance"), most aren't ("diamondbackxl", "empire_courier",
 * "explorer_nx" for the Caspian Explorer). Notably typex/typex_2/typex_3
 * do NOT map to Alliance ships in numeric order — typex is the Chieftain,
 * typex_2 is the Crusader, typex_3 is the Challenger. So the type must
 * always be looked up here rather than shown as-is. Keys are lower-cased.
 */

const SHIP_NAMES = {
  sidewinder: 'Sidewinder',
  eagle: 'Eagle',
  empire_eagle: 'Imperial Eagle',
  hauler: 'Hauler',
  adder: 'Adder',
  viper: 'Viper Mk III',
  viper_mkiv: 'Viper Mk IV',
  cobramkiii: 'Cobra Mk III',
  cobramkiv: 'Cobra Mk IV',
  cobramkv: 'Cobra Mk V',
  type6: 'Type-6 Transporter',
  type7: 'Type-7 Transporter',
  type8: 'Type-8 Transporter',
  type9: 'Type-9 Heavy',
  type9_military: 'Type-10 Defender',
  dolphin: 'Dolphin',
  asp: 'Asp Explorer',
  asp_scout: 'Asp Scout',
  vulture: 'Vulture',
  federation_dropship: 'Federal Dropship',
  federation_dropship_mkii: 'Federal Assault Ship',
  federation_gunship: 'Federal Gunship',
  federation_corvette: 'Federal Corvette',
  independant_trader: 'Keelback',
  orca: 'Orca',
  empire_courier: 'Imperial Courier',
  empire_trader: 'Imperial Clipper',
  corsair: 'Corsair',
  panthermkii: 'Panther Clipper Mk II',
  lakonminer: 'Type-11 Prospector',
  mediumtransport01: 'Lynx Highliner',
  smallcombat01_nx: 'Kestrel Mk II',
  cutter: 'Imperial Cutter',
  diamondback: 'Diamondback Scout',
  diamondbackxl: 'Diamondback Explorer',
  ferdelance: 'Fer-de-Lance',
  python: 'Python',
  python_nx: 'Python Mk II',
  typex: 'Alliance Chieftain',
  typex_2: 'Alliance Crusader',
  typex_3: 'Alliance Challenger',
  belugaliner: 'Beluga Liner',
  anaconda: 'Anaconda',
  krait_light: 'Krait Phantom',
  krait_mkii: 'Krait Mk II',
  mamba: 'Mamba',
  mandalay: 'Mandalay',
  explorer_nx: 'Caspian Explorer',
};

// Fallback for anything not in the map above (brand-new ships this list
// hasn't been updated for yet). Turns a raw symbol into a readable guess
// instead of showing it verbatim, e.g. "type11_prospector" -> "Type11 Prospector".
function formatShipType(raw) {
  if (!raw) return '\u2014';
  const known = SHIP_NAMES[String(raw).toLowerCase()];
  if (known) return known;
  const s = String(raw).replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').trim();
  return s.split(' ').filter(Boolean).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}
