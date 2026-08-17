// Refreshes property/data-live.js from the BFS Swiss Residential Property
// Price Index (IMPI), published on opendata.swiss. Runs in GitHub Actions
// (see .github/workflows/refresh-property-data.yml); needs Node 20+.
//
// The IMPI is the only machine-readable official source for Swiss buy-price
// development. It is an index (no CHF/m², no canton/city breakdown), so this
// script derives national indexation factors relative to the bundled
// snapshot's baseline quarter and the front-end scales the bundled prices.
//
// Usage: node property/refresh-data.mjs [--html <local-file>] [--out <file>]

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

// --- fetching --------------------------------------------------------------

// The upstream encoding is not always UTF-8 and Response.text() would assume
// it is, which mangles the German category labels we match on.
async function decodeResponse(res) {
    const buf = Buffer.from(await res.arrayBuffer());
    const fromHeader = (res.headers.get('content-type') || '').match(/charset=["']?([\w-]+)/i);
    const fromMeta = buf.subarray(0, 4096).toString('latin1').match(/charset=["']?([\w-]+)/i);
    const charset = (fromHeader || fromMeta || [])[1] || 'utf-8';
    try {
        return new TextDecoder(charset).decode(buf);
    } catch {
        return buf.toString('utf-8');
    }
}

// Every HTML resource of the dataset, as lazily loaded candidates — CKAN often
// lists several (table view, publication page), so we try them in turn.
async function htmlCandidates() {
    const local = argValue('--html');
    if (local) return [{ label: local, load: async () => readFileSync(local, 'utf-8') }];

    console.log(`Fetching dataset metadata: ${CKAN_URL}`);
    const res = await fetch(CKAN_URL, { headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`CKAN request failed: HTTP ${res.status}`);
    const pkg = await res.json();
    if (!pkg.success) throw new Error('CKAN response has success=false');

    const resources = pkg.result.resources || [];
    const urls = resources
        .filter(r => /html|xhtml/i.test(r.format || r.media_type || '') ||
            /\.x?html?(\?|#|$)/i.test(r.download_url || r.url || ''))
        .map(r => r.download_url || r.url)
        .filter(Boolean);
    if (!urls.length) {
        throw new Error('No HTML resource found. Available: ' +
            resources.map(r => `${r.format}: ${r.download_url || r.url}`).join(' | '));
    }
    return [...new Set(urls)].map(url => ({
        label: url,
        load: async () => {
            console.log(`Downloading HTML: ${url}`);
            const page = await fetch(url, { headers: { accept: 'text/html,application/xhtml+xml' } });
            if (!page.ok) throw new Error(`HTML download failed: HTTP ${page.status}`);
            return await decodeResponse(page);
        }
    }));
}

// --- HTML table parsing ----------------------------------------------------

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function decodeEntities(s) {
    return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
        if (e[0] === '#') {
            const cp = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
            return Number.isFinite(cp) ? String.fromCodePoint(cp) : m;
        }
        const named = ENTITIES[e.toLowerCase()];
        return named === undefined ? m : named;
    });
}

function cellText(html) {
    return decodeEntities(html.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, ' '))
        .replace(/\s+/g, ' ')
        .trim();
}

// Balanced <table>…</table> regions, so nested tables stay with their parent.
function tableBodies(html) {
    html = html.replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ');
    const tables = [];
    const tagRe = /<\/?table\b[^>]*>/gi;
    let m, depth = 0, start = 0;
    while ((m = tagRe.exec(html))) {
        if (m[0][1] === '/') {
            if (depth && --depth === 0) tables.push(html.slice(start, m.index));
        } else if (depth++ === 0) {
            start = m.index + m[0].length;
        }
    }
    return tables;
}

// One table -> rectangular string matrix, expanding rowspan/colspan so that
// stub columns (which BFS merges vertically) carry their label on every row.
function tableRows(tableHtml) {
    const span = (attrs, name) => {
        const m = attrs.match(new RegExp(`${name}\\s*=\\s*["']?(\\d+)`, 'i'));
        const n = m ? Number(m[1]) : 1;
        return n > 0 && n < 1000 ? n : 1;
    };
    const rows = [];
    const carry = []; // column -> { text, rowsLeft } from an open rowspan
    const rowRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch;
    while ((rowMatch = rowRe.exec(tableHtml))) {
        const row = [];
        let col = 0;
        const placeCarried = () => {
            while (carry[col] && carry[col].rowsLeft > 0) {
                row[col] = carry[col].text;
                carry[col].rowsLeft--;
                col++;
            }
        };
        const cellRe = /<(t[hd])\b([^>]*)>([\s\S]*?)<\/\1>/gi;
        let cellMatch;
        while ((cellMatch = cellRe.exec(rowMatch[1]))) {
            const text = cellText(cellMatch[3]);
            const rowspan = span(cellMatch[2], 'rowspan');
            for (let i = span(cellMatch[2], 'colspan'); i > 0; i--) {
                placeCarried();
                row[col] = text;
                if (rowspan > 1) carry[col] = { text, rowsLeft: rowspan - 1 };
                col++;
            }
        }
        for (let c = col; c < carry.length; c++) {
            if (carry[c] && carry[c].rowsLeft > 0) { row[c] = carry[c].text; carry[c].rowsLeft--; }
        }
        for (let c = 0; c < row.length; c++) if (row[c] == null) row[c] = '';
        if (row.some(f => f.trim() !== '')) rows.push(row);
    }
    const width = rows.reduce((w, r) => Math.max(w, r.length), 0);
    return rows.map(r => Array.from({ length: width }, (_, c) => r[c] ?? ''));
}

// --- series extraction -----------------------------------------------------

// "2026Q1", "2026-Q1", "Q1 2026", "2026/1", "2026.1" -> "2026-Q1"
function normalizeQuarter(s) {
    const m = String(s).match(/(\d{4})\s*[-/. ]?\s*[Qq]?\s*([1-4])(?!\d)/) ||
        String(s).match(/[Qq]\s*([1-4])\s*[-/. ]?\s*(\d{4})/);
    if (!m) return null;
    const [year, q] = m[1].length === 4 ? [m[1], m[2]] : [m[2], m[1]];
    return `${year}-Q${q}`;
}

// Index values arrive as "105.6", "105,6", "1 234.5", "1'234.5", sometimes
// with a footnote marker; placeholders like "..." must come out as NaN.
function toNumber(s) {
    if (s == null) return NaN;
    let t = String(s).replace(/\s*(\*+|\d+\))\s*$/, '')
        .replace(/[\s\u00a0\u202f'’]/g, '')
        .replace(/[–—−]/g, '-');
    if (/^-?\d+,\d+$/.test(t)) t = t.replace(',', '.');
    else t = t.replace(/,/g, '');
    return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : NaN;
}

const numeric = s => Number.isFinite(toNumber(s));

const APT_RE = /eigentumswohn|condomin|owner.occupied|appartement|ppe|stockwerk/i;
const HOUSE_RE = /einfamilienh|single.family|detached|maison|villa/i;
const TOTAL_RE = /^\s*(total|impi|totale?)\s*$/i;
const NATIONAL_RE = /schweiz|suisse|svizzera|switzerland/i;

// Long layout: one row per quarter × category, values in a single column.
function seriesFromLongTable(rows) {
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
        if (otherCols.some(c => !TOTAL_RE.test(r[c] || '') && !NATIONAL_RE.test(r[c] || ''))) continue;
        const entry = series.get(quarter) || {};
        entry[type] = toNumber(r[valueCol]);
        series.set(quarter, entry);
    }
    return series;
}

// Pivoted layout (the usual shape of an HTML table view): one row per quarter,
// the categories spread across columns, possibly under stacked header rows.
function seriesFromWideTable(rows) {
    let firstBody = 0;
    while (firstBody < rows.length &&
        !(rows[firstBody].some(normalizeQuarter) && rows[firstBody].some(numeric))) firstBody++;
    const body = rows.slice(firstBody);
    if (!body.length) throw new Error('No data rows with a quarter and a number.');

    const labels = rows[0].map((_, c) =>
        rows.slice(0, firstBody).map(r => r[c] || '').join(' ').replace(/\s+/g, ' ').trim());
    if (!labels.length) throw new Error('Table has no header rows.');

    let timeCol = -1, bestHits = 0;
    labels.forEach((_, c) => {
        const hits = body.filter(r => normalizeQuarter(r[c])).length;
        if (hits > bestHits) { bestHits = hits; timeCol = c; }
    });
    if (timeCol < 0 || bestHits < 4) {
        throw new Error(`Could not find a quarter column. Header: ${labels.join(' | ')}`);
    }

    // Among columns whose header names the category, prefer the national total
    // over any further breakdown, then the left-most one.
    const pick = re => {
        const cols = labels.map((l, c) => [l, c])
            .filter(([l, c]) => c !== timeCol && re.test(l) && body.some(r => numeric(r[c])));
        if (!cols.length) return -1;
        const totals = cols.filter(([l]) => TOTAL_RE.test(l.replace(re, '').trim()) || NATIONAL_RE.test(l));
        return (totals[0] || cols[0])[1];
    };
    const aptCol = pick(APT_RE), houseCol = pick(HOUSE_RE);
    if (aptCol < 0 || houseCol < 0) {
        throw new Error(`Could not find apartment/house columns. Header: ${labels.join(' | ')}`);
    }

    const series = new Map();
    for (const r of body) {
        const quarter = normalizeQuarter(r[timeCol]);
        if (!quarter) continue;
        const entry = series.get(quarter) || {};
        if (numeric(r[aptCol])) entry.apartment = toNumber(r[aptCol]);
        if (numeric(r[houseCol])) entry.house = toNumber(r[houseCol]);
        if (entry.apartment != null || entry.house != null) series.set(quarter, entry);
    }
    return series;
}

// A series is usable once it covers the baseline and at least one later
// quarter with both categories; longer coverage wins ties between tables.
function score(series) {
    const complete = [...series.entries()]
        .filter(([, v]) => v.apartment != null && v.house != null)
        .map(([q]) => q)
        .sort();
    if (complete.length < 2 || !complete.includes(BASELINE_QUARTER)) return 0;
    return complete.length;
}

function extractSeries(html) {
    const tables = tableBodies(html);
    if (!tables.length) throw new Error('The document contains no <table> element.');
    let best = null, bestScore = 0;
    const errors = [];
    for (const [i, table] of tables.entries()) {
        const rows = tableRows(table);
        if (rows.length < 2) continue;
        for (const parse of [seriesFromWideTable, seriesFromLongTable]) {
            try {
                const series = parse(rows);
                const s = score(series);
                if (s > bestScore) { best = series; bestScore = s; }
            } catch (e) {
                errors.push(`table ${i + 1} (${parse.name}): ${e.message}`);
            }
        }
    }
    if (!best) {
        throw new Error(`No table held the IMPI series (${tables.length} scanned) — the ` +
            'page layout has probably changed.' + errors.map(e => `\n  ${e}`).join(''));
    }
    return best;
}

// --- output ----------------------------------------------------------------

function write(series) {
    const quarters = [...series.keys()]
        .filter(q => series.get(q).apartment != null && series.get(q).house != null)
        .sort();
    const latest = quarters[quarters.length - 1];
    const base = series.get(BASELINE_QUARTER);
    const last = series.get(latest);
    if (!base) {
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

async function refresh() {
    const candidates = await htmlCandidates();
    const errors = [];
    for (const candidate of candidates) {
        try {
            return write(extractSeries(await candidate.load()));
        } catch (e) {
            errors.push(`${candidate.label}: ${e.message}`);
        }
    }
    throw new Error(`No usable IMPI table in ${candidates.length} HTML resource(s).\n` +
        errors.join('\n'));
}

refresh().catch(e => { console.error('Refresh failed:', e.message); process.exit(1); });
