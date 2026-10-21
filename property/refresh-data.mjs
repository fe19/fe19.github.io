// Refreshes property/data-live.js from the BFS Swiss Residential Property
// Price Index (IMPI). Runs in GitHub Actions
// (see .github/workflows/refresh-property-data.yml); needs Node 20+.
//
// The IMPI is the only machine-readable official source for Swiss buy-price
// development. It is an index (no CHF/m², no canton/city breakdown), so this
// script derives national indexation factors relative to the bundled
// snapshot's baseline quarter and the front-end scales the bundled prices.
//
// The data comes from the BFS asset "Indexwerte (Basis: Q4 2019 = 100)"
// (order number ds-x-05.06.03.01.02), a JSON file that BFS republishes under
// a new asset id every quarter, so the current one is looked up by order
// number through the BFS DAM API. (The opendata.swiss IMPI dataset only links
// methodology PDFs.)
//
// Usage: node property/refresh-data.mjs [--json <local-file>] [--out <file>]

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const BASELINE_QUARTER = '2026-Q1'; // must match SWISS_PROPERTY_DATA.meta.asOf
const ORDER_NR = 'ds-x-05.06.03.01.02';
const DAM_URL = `https://dam-api.bfs.admin.ch/hub/api/dam/assets?orderNr=${ORDER_NR}`;

const args = process.argv.slice(2);
const argValue = name => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : null;
};
const OUT_FILE = argValue('--out') ||
    join(dirname(fileURLToPath(import.meta.url)), 'data-live.js');

async function fetchJson(url) {
    const res = await fetch(url, { headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`Request failed: HTTP ${res.status} for ${url}`);
    return res.json();
}

async function loadIndex() {
    const local = argValue('--json');
    if (local) return JSON.parse(readFileSync(local, 'utf-8'));

    console.log(`Looking up current asset: ${DAM_URL}`);
    const search = await fetchJson(DAM_URL);
    const assets = (search.data || [])
        .filter(a => a.shop?.orderNr === ORDER_NR)
        .sort((a, b) => (b.bfs?.embargo || '').localeCompare(a.bfs?.embargo || ''));
    const asset = assets.find(a => a.bfs?.lifecycleGroup === 'CURRENT') || assets[0];
    const master = asset?.links?.find(l => l.rel === 'master')?.href;
    if (!master) throw new Error(`No downloadable asset with order number ${ORDER_NR} found.`);

    console.log(`Downloading JSON: ${master} (published ${asset.bfs?.embargo})`);
    return fetchJson(master);
}

// The series use the middle month of each quarter: "02.2017" = 2017-Q1,
// "5.2026" = 2026-Q2 (the leading zero is not always there).
function monthToQuarter(s) {
    const m = String(s).match(/^(\d{1,2})\.(\d{4})$/);
    if (!m) return null;
    const month = Number(m[1]);
    return month >= 1 && month <= 12 ? `${m[2]}-Q${Math.ceil(month / 3)}` : null;
}

// data.efh = single-family houses, data.egw = owner-occupied apartments;
// geoscope1 is Switzerland as a whole, geoscope2–6 the municipality types.
function extractSeries(json) {
    const pick = key => {
        const points = json?.data?.[key]?.geoscope1;
        if (!Array.isArray(points) || !points.length) {
            throw new Error(`Missing data.${key}.geoscope1 — the JSON layout has probably changed. ` +
                `Keys: ${Object.keys(json?.data || {}).join(', ')}`);
        }
        return points;
    };
    const series = new Map(); // quarter -> {apartment, house}
    for (const [type, key] of [['house', 'efh'], ['apartment', 'egw']]) {
        for (const p of pick(key)) {
            const quarter = monthToQuarter(p.year);
            if (!quarter || !Number.isFinite(p.value)) continue;
            const entry = series.get(quarter) || {};
            entry[type] = p.value;
            series.set(quarter, entry);
        }
    }
    return series;
}

// "30.07.2026" -> "2026-07-30"; the BFS data date rather than the run date,
// so the file (and the daily commit) only changes when BFS publishes.
function dataDate(json) {
    const m = String(json?.dataStatus || '').match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null;
}

function write(series, updated) {
    const quarters = [...series.keys()]
        .filter(q => series.get(q).apartment != null && series.get(q).house != null)
        .sort();
    const latest = quarters[quarters.length - 1];
    const base = series.get(BASELINE_QUARTER);
    const last = series.get(latest);
    if (!base || base.apartment == null || base.house == null) {
        throw new Error(`Baseline quarter ${BASELINE_QUARTER} not in series (have: ${quarters.join(', ')})`);
    }
    const factors = {
        apartment: last.apartment / base.apartment,
        house: last.house / base.house
    };
    for (const [k, v] of Object.entries(factors)) {
        if (!(v > 0.7 && v < 1.5)) throw new Error(`Implausible ${k} factor ${v} — refusing to write.`);
    }

    const payload = {
        updated,
        source: 'BFS Swiss Residential Property Price Index (IMPI)',
        baselineQuarter: BASELINE_QUARTER,
        latestQuarter: latest,
        factors: {
            apartment: Number(factors.apartment.toFixed(4)),
            house: Number(factors.house.toFixed(4))
        }
    };
    writeFileSync(OUT_FILE,
        '// Generated by property/refresh-data.mjs — do not edit by hand.\n' +
        `const SWISS_PROPERTY_LIVE = ${JSON.stringify(payload, null, 4)};\n`);
    console.log(`Wrote ${OUT_FILE}:`, JSON.stringify(payload));
}

loadIndex()
    .then(json => write(extractSeries(json), dataDate(json)))
    .catch(e => { console.error('Refresh failed:', e.message); process.exit(1); });
