/**
 * server.js — LakonSpaceways combined static site + Spansh proxy
 * =================================================================
 * One process, one port:
 *   - Serves the static site (index.html, styles.css, fleet.js, etc.)
 *   - Handles POST /api/stations/search by forwarding to spansh.co.uk
 *     and returning the result, so the browser's fetch() in fleet.js
 *     stays same-origin — no CORS setup needed at all.
 *
 * Spansh requires an EXACT-CASE match for reference_system (it's not a
 * fuzzy/case-insensitive lookup) — procedurally-generated system names
 * end in a lowercase letter + digits (e.g. "b8-4"), easy to mistype as
 * uppercase. Before every request we resolve whatever system name the
 * user typed through EDSM's system endpoint (which IS case-insensitive)
 * and swap in the canonically-cased name Spansh expects. If EDSM doesn't
 * know the system either, we just pass the typed name through as-is.
 *
 * RUN:
 *   npm install
 *   npm start
 *
 * Then open http://localhost:3000 (or whatever PORT you set).
 */

const express = require('express');

const PORT = process.env.PORT || 3000;
const SPANSH_BASE = 'https://spansh.co.uk';
const ALLOWED_PATH = '/api/stations/search';
const EDSM_SYSTEM_URL = 'https://www.edsm.net/api-v1/system';

const app = express();

// Parse the JSON body fleet.js sends, forward it on as-is.
app.use(express.json());

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

// Everything else: serve the static site files from this same folder.
app.use(express.static(__dirname));

app.listen(PORT, () => {
  console.log(`LakonSpaceways running at http://localhost:${PORT}`);
});


