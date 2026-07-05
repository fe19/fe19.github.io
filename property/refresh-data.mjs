// Refreshes property/data-live.js from the BFS Swiss Residential Property
// Price Index (IMPI), published on opendata.swiss. Runs in GitHub Actions
// (see .github/workflows/refresh-property-data.yml); needs Node 20+.
//
// The IMPI is the only machine-readable official source for Swiss buy-price
// development. It is an index (no CHF/m², no canton/city breakdown), so this
// script derives national indexation factors relative to the bundled
// snapshot's baseline quarter and the front-end scales the bundled prices.
//
// Usage: node property/refresh-data.mjs [--csv <local-file>] [--out <file>]

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const BASELINE_QUARTER = '2026-Q1'; // must match SWISS_PROPERTY_DATA.meta.asOf
const DATASET_ID = 'schweizerischer-wohnimmobilienpreisindex-impi';
const CKAN_URL = `https://opendata.swiss/api/3/action/package_show?id=${DATASET_ID}`;

const args = process.argv.slice(2);
const argValue = name => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : null;
};
const OUT_FILE = argValue('--out') ||
    join(dirname(fileURLToPath(import.meta.url)), 'data-live.js');

async function fetchCsvText() {
    const local = argValue('--csv');
    if (local) return readFileSync(local, 'utf-8');

    console.log(`Fetching dataset metadata: ${CKAN_URL}`);
    const res = await fetch(CKAN_URL, { headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`CKAN request failed: HTTP ${res.status}`);
    const pkg = await res.json();
    if (!pkg.success) throw new Error('CKAN response has success=false');

    const resources = pkg.result.resources || [];
    const csvRes = resources.find(r => /csv/i.test(r.format || '') || /\.csv(\?|$)/i.test(r.download_url || r.url || ''));
    if (!csvRes) {
        throw new Error('No CSV resource found. Available: ' +
            resources.map(r => `${r.format}: ${r.download_url || r.url}`).join(' | '));
    }
    const url = csvRes.download_url || csvRes.url;
    console.log(`Downloading CSV: ${url}`);
    const csv = await fetch(url);
    if (!csv.ok) throw new Error(`CSV download failed: HTTP ${csv.status}`);
    return await csv.text();
}

function parseCsv(text) {
    text = text.replace(/^\ufeff/, '');
    const firstLine = text.slice(0, text.indexOf('\n'));
    const delimiter = [';', ',', '\t']
        .map(d => [d, firstLine.split(d).length])
        .sort((a, b) => b[1] - a[1])[0][0];
    const rows = [];
    let row = [], field = '', inQuotes = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (inQuotes) {
            if (c === '"') {
                if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
            } else field += c;
        } else if (c === '"') inQuotes = true;
        else if (c === delimiter) { row.push(field); field = ''; }
        else if (c === '\n' || c === '\r') {
            if (c === '\r' && text[i + 1] === '\n') i++;
            row.push(field); field = '';
            if (row.some(f => f.trim() !== '')) rows.push(row);
            row = [];
        } else field += c;
    }
    row.push(field);
    if (row.some(f => f.trim() !== '')) rows.push(row);
    return rows;
}

// "2026Q1", "2026-Q1", "Q1 2026", "2026/1", "2026.1" -> "2026-Q1"
function normalizeQuarter(s) {
    const m = String(s).match(/(\d{4})\s*[-/. ]?\s*[Qq]?\s*([1-4])(?!\d)/) ||
        String(s).match(/[Qq]\s*([1-4])\s*[-/. ]?\s*(\d{4})/);
    if (!m) return null;
    const [year, q] = m[1].length === 4 ? [m[1], m[2]] : [m[2], m[1]];
    return `${year}-Q${q}`;
}

const APT_RE = /eigentumswohn|condomin|owner.occupied|appartement|ppe|stockwerk/i;
const HOUSE_RE = /einfamilienh|single.family|detached|maison|villa/i;
const TOTAL_RE = /^\s*(total|impi|totale?)\s*$/i;

function extractSeries(rows) {
    const header = rows[0].map(h => h.trim());
    const body = rows.slice(1);

    // time column: most values normalize to a quarter
    let timeCol = -1, bestHits = 0;
    header.forEach((_, c) => {
        const hits = body.filter(r => normalizeQuarter(r[c])).length;
        if (hits > bestHits) { bestHits = hits; timeCol = c; }
    });
    if (timeCol < 0 || bestHits < 4) {
        throw new Error(`Could not find a quarter column. Header: ${header.join(' | ')}`);
    }

    // value column: numeric, not the time column
    const numeric = s => s != null && s.trim() !== '' && Number.isFinite(Number(String(s).replace(',', '.')));
    let valueCol = -1;
    for (let c = header.length - 1; c >= 0; c--) {
        if (c === timeCol) continue;
        const hits = body.filter(r => numeric(r[c])).length;
        if (hits >= body.length * 0.8) { valueCol = c; break; }
    }
    if (valueCol < 0) throw new Error(`Could not find a numeric value column. Header: ${header.join(' | ')}`);

    // category column: contains apartment/house labels
    let catCol = -1;
    header.forEach((_, c) => {
        if (c === timeCol || c === valueCol) return;
        if (body.some(r => APT_RE.test(r[c] || '')) && body.some(r => HOUSE_RE.test(r[c] || ''))) catCol = c;
    });
    if (catCol < 0) {
        throw new Error(`Could not find the apartment/house category column. Header: ${header.join(' | ')}\n` +
            `Sample row: ${(body[0] || []).join(' | ')}`);
    }

    // keep only rows that are not further sliced by other dimensions, i.e. any
    // remaining dimension column must look like a "total" for the row to count
    const otherCols = header.map((_, c) => c)
        .filter(c => c !== timeCol && c !== valueCol && c !== catCol)
        .filter(c => body.some(r => (r[c] || '').trim() !== ''));

    const series = new Map(); // quarter -> {apartment, house}
    for (const r of body) {
        const quarter = normalizeQuarter(r[timeCol]);
        if (!quarter || !numeric(r[valueCol])) continue;
        const cat = r[catCol] || '';
        const type = APT_RE.test(cat) ? 'apartment' : HOUSE_RE.test(cat) ? 'house' : null;
        if (!type) continue;
        if (otherCols.some(c => !TOTAL_RE.test(r[c] || '') && !/schweiz|suisse|switzerland/i.test(r[c] || ''))) continue;
        const entry = series.get(quarter) || {};
        entry[type] = Number(String(r[valueCol]).replace(',', '.'));
        series.set(quarter, entry);
    }
    if (!series.size) throw new Error('Parsed 0 usable rows — the CSV layout has probably changed.');
    return series;
}

function main(series) {
    const quarters = [...series.keys()].sort();
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
        updated: new Date().toISOString().slice(0, 10),
        source: 'BFS Swiss Residential Property Price Index (IMPI) via opendata.swiss',
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

fetchCsvText()
    .then(t => main(extractSeries(parseCsv(t))))
    .catch(e => { console.error('Refresh failed:', e.message); process.exit(1); });
