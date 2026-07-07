// Refreshes stockspikes/data-live.js from Yahoo Finance's public chart API.
// Runs in GitHub Actions (see .github/workflows/refresh-stock-data.yml);
// needs Node 20+.
//
// For every ticker in the curated universe below it fetches one month of
// daily closes/volumes and writes them as a global const consumed by
// stockspikes.html via a plain <script> tag (no runtime fetch, no CORS).
// Spike metrics are computed client-side in stockspikes.js.
//
// Usage: node stockspikes/refresh-data.mjs [--out <file>] [--symbols A,B.C]

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const CHART_URL = (symbol) =>
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1mo&interval=1d`;

const POOL_SIZE = 4;           // parallel Yahoo requests
const MIN_CLOSES = 10;         // skip symbols with a thinner series
const MIN_SUCCESS_RATIO = 0.6; // refuse to write below this share of requested symbols
const RETRY_DELAY_MS = 2000;

// Yahoo intermittently 429s requests without a browser-like User-Agent.
const FETCH_HEADERS = {
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    accept: 'application/json',
};

// Curated universe. Yahoo suffixes: (none) US, .L London, .SW SIX, .T Tokyo,
// .HK Hong Kong, .DE/.PA/.AS/.MC/.MI/.CO European exchanges, .VN Ho Chi Minh
// (coverage unreliable — failures are skipped, VFS keeps Vietnam non-empty).
// category: tech | health | infrastructure | energy | insurance | banks
// country: us | uk | eu | switzerland | japan | china | vietnam
const TICKERS = [
    // --- United States ---
    { symbol: 'AAPL', name: 'Apple', category: 'tech', country: 'us' },
    { symbol: 'MSFT', name: 'Microsoft', category: 'tech', country: 'us' },
    { symbol: 'NVDA', name: 'NVIDIA', category: 'tech', country: 'us' },
    { symbol: 'GOOGL', name: 'Alphabet', category: 'tech', country: 'us' },
    { symbol: 'META', name: 'Meta Platforms', category: 'tech', country: 'us' },
    { symbol: 'AMD', name: 'AMD', category: 'tech', country: 'us' },
    { symbol: 'PLTR', name: 'Palantir', category: 'tech', country: 'us' },
    { symbol: 'UNH', name: 'UnitedHealth', category: 'health', country: 'us' },
    { symbol: 'JNJ', name: 'Johnson & Johnson', category: 'health', country: 'us' },
    { symbol: 'LLY', name: 'Eli Lilly', category: 'health', country: 'us' },
    { symbol: 'PFE', name: 'Pfizer', category: 'health', country: 'us' },
    { symbol: 'MRK', name: 'Merck', category: 'health', country: 'us' },
    { symbol: 'CAT', name: 'Caterpillar', category: 'infrastructure', country: 'us' },
    { symbol: 'VMC', name: 'Vulcan Materials', category: 'infrastructure', country: 'us' },
    { symbol: 'PWR', name: 'Quanta Services', category: 'infrastructure', country: 'us' },
    { symbol: 'XOM', name: 'ExxonMobil', category: 'energy', country: 'us' },
    { symbol: 'CVX', name: 'Chevron', category: 'energy', country: 'us' },
    { symbol: 'NEE', name: 'NextEra Energy', category: 'energy', country: 'us' },
    { symbol: 'FSLR', name: 'First Solar', category: 'energy', country: 'us' },
    { symbol: 'PGR', name: 'Progressive', category: 'insurance', country: 'us' },
    { symbol: 'AIG', name: 'AIG', category: 'insurance', country: 'us' },
    { symbol: 'MET', name: 'MetLife', category: 'insurance', country: 'us' },
    { symbol: 'TRV', name: 'Travelers', category: 'insurance', country: 'us' },
    { symbol: 'JPM', name: 'JPMorgan Chase', category: 'banks', country: 'us' },
    { symbol: 'BAC', name: 'Bank of America', category: 'banks', country: 'us' },
    { symbol: 'GS', name: 'Goldman Sachs', category: 'banks', country: 'us' },
    { symbol: 'C', name: 'Citigroup', category: 'banks', country: 'us' },
    { symbol: 'WFC', name: 'Wells Fargo', category: 'banks', country: 'us' },
    // --- United Kingdom ---
    { symbol: 'SGE.L', name: 'Sage Group', category: 'tech', country: 'uk' },
    { symbol: 'ARM', name: 'Arm Holdings', category: 'tech', country: 'uk' },
    { symbol: 'AZN.L', name: 'AstraZeneca', category: 'health', country: 'uk' },
    { symbol: 'GSK.L', name: 'GSK', category: 'health', country: 'uk' },
    { symbol: 'SN.L', name: 'Smith & Nephew', category: 'health', country: 'uk' },
    { symbol: 'NG.L', name: 'National Grid', category: 'infrastructure', country: 'uk' },
    { symbol: 'BBY.L', name: 'Balfour Beatty', category: 'infrastructure', country: 'uk' },
    { symbol: 'SHEL.L', name: 'Shell', category: 'energy', country: 'uk' },
    { symbol: 'BP.L', name: 'BP', category: 'energy', country: 'uk' },
    { symbol: 'SSE.L', name: 'SSE', category: 'energy', country: 'uk' },
    { symbol: 'PRU.L', name: 'Prudential', category: 'insurance', country: 'uk' },
    { symbol: 'AV.L', name: 'Aviva', category: 'insurance', country: 'uk' },
    { symbol: 'LGEN.L', name: 'Legal & General', category: 'insurance', country: 'uk' },
    { symbol: 'HSBA.L', name: 'HSBC', category: 'banks', country: 'uk' },
    { symbol: 'BARC.L', name: 'Barclays', category: 'banks', country: 'uk' },
    { symbol: 'LLOY.L', name: 'Lloyds Banking Group', category: 'banks', country: 'uk' },
    { symbol: 'NWG.L', name: 'NatWest Group', category: 'banks', country: 'uk' },
    // --- European Union ---
    { symbol: 'ASML.AS', name: 'ASML', category: 'tech', country: 'eu' },
    { symbol: 'SAP.DE', name: 'SAP', category: 'tech', country: 'eu' },
    { symbol: 'IFX.DE', name: 'Infineon', category: 'tech', country: 'eu' },
    { symbol: 'ADYEN.AS', name: 'Adyen', category: 'tech', country: 'eu' },
    { symbol: 'SAN.PA', name: 'Sanofi', category: 'health', country: 'eu' },
    { symbol: 'BAYN.DE', name: 'Bayer', category: 'health', country: 'eu' },
    { symbol: 'NOVO-B.CO', name: 'Novo Nordisk', category: 'health', country: 'eu' },
    { symbol: 'DG.PA', name: 'Vinci', category: 'infrastructure', country: 'eu' },
    { symbol: 'HOT.DE', name: 'Hochtief', category: 'infrastructure', country: 'eu' },
    { symbol: 'FER.MC', name: 'Ferrovial', category: 'infrastructure', country: 'eu' },
    { symbol: 'TTE.PA', name: 'TotalEnergies', category: 'energy', country: 'eu' },
    { symbol: 'ENEL.MI', name: 'Enel', category: 'energy', country: 'eu' },
    { symbol: 'IBE.MC', name: 'Iberdrola', category: 'energy', country: 'eu' },
    { symbol: 'RWE.DE', name: 'RWE', category: 'energy', country: 'eu' },
    { symbol: 'ALV.DE', name: 'Allianz', category: 'insurance', country: 'eu' },
    { symbol: 'CS.PA', name: 'AXA', category: 'insurance', country: 'eu' },
    { symbol: 'G.MI', name: 'Generali', category: 'insurance', country: 'eu' },
    { symbol: 'MUV2.DE', name: 'Munich Re', category: 'insurance', country: 'eu' },
    { symbol: 'BNP.PA', name: 'BNP Paribas', category: 'banks', country: 'eu' },
    { symbol: 'SAN.MC', name: 'Banco Santander', category: 'banks', country: 'eu' },
    { symbol: 'INGA.AS', name: 'ING Group', category: 'banks', country: 'eu' },
    { symbol: 'DBK.DE', name: 'Deutsche Bank', category: 'banks', country: 'eu' },
    { symbol: 'ISP.MI', name: 'Intesa Sanpaolo', category: 'banks', country: 'eu' },
    // --- Switzerland ---
    { symbol: 'LOGN.SW', name: 'Logitech', category: 'tech', country: 'switzerland' },
    { symbol: 'TEMN.SW', name: 'Temenos', category: 'tech', country: 'switzerland' },
    { symbol: 'NOVN.SW', name: 'Novartis', category: 'health', country: 'switzerland' },
    { symbol: 'ROG.SW', name: 'Roche', category: 'health', country: 'switzerland' },
    { symbol: 'LONN.SW', name: 'Lonza', category: 'health', country: 'switzerland' },
    { symbol: 'ALC.SW', name: 'Alcon', category: 'health', country: 'switzerland' },
    { symbol: 'ABBN.SW', name: 'ABB', category: 'infrastructure', country: 'switzerland' },
    { symbol: 'SIKA.SW', name: 'Sika', category: 'infrastructure', country: 'switzerland' },
    { symbol: 'HOLN.SW', name: 'Holcim', category: 'infrastructure', country: 'switzerland' },
    { symbol: 'BKW.SW', name: 'BKW', category: 'energy', country: 'switzerland' },
    { symbol: 'ZURN.SW', name: 'Zurich Insurance', category: 'insurance', country: 'switzerland' },
    { symbol: 'SREN.SW', name: 'Swiss Re', category: 'insurance', country: 'switzerland' },
    { symbol: 'SLHN.SW', name: 'Swiss Life', category: 'insurance', country: 'switzerland' },
    { symbol: 'BALN.SW', name: 'Baloise', category: 'insurance', country: 'switzerland' },
    { symbol: 'UBSG.SW', name: 'UBS', category: 'banks', country: 'switzerland' },
    { symbol: 'BAER.SW', name: 'Julius Baer', category: 'banks', country: 'switzerland' },
    // --- Japan ---
    { symbol: '6758.T', name: 'Sony', category: 'tech', country: 'japan' },
    { symbol: '9984.T', name: 'SoftBank Group', category: 'tech', country: 'japan' },
    { symbol: '8035.T', name: 'Tokyo Electron', category: 'tech', country: 'japan' },
    { symbol: '6861.T', name: 'Keyence', category: 'tech', country: 'japan' },
    { symbol: '4502.T', name: 'Takeda', category: 'health', country: 'japan' },
    { symbol: '4568.T', name: 'Daiichi Sankyo', category: 'health', country: 'japan' },
    { symbol: '4519.T', name: 'Chugai Pharmaceutical', category: 'health', country: 'japan' },
    { symbol: '6301.T', name: 'Komatsu', category: 'infrastructure', country: 'japan' },
    { symbol: '1801.T', name: 'Taisei', category: 'infrastructure', country: 'japan' },
    { symbol: '1605.T', name: 'Inpex', category: 'energy', country: 'japan' },
    { symbol: '5020.T', name: 'ENEOS', category: 'energy', country: 'japan' },
    { symbol: '9501.T', name: 'TEPCO', category: 'energy', country: 'japan' },
    { symbol: '8766.T', name: 'Tokio Marine', category: 'insurance', country: 'japan' },
    { symbol: '8750.T', name: 'Dai-ichi Life', category: 'insurance', country: 'japan' },
    { symbol: '8630.T', name: 'Sompo', category: 'insurance', country: 'japan' },
    { symbol: '8306.T', name: 'Mitsubishi UFJ', category: 'banks', country: 'japan' },
    { symbol: '8316.T', name: 'Sumitomo Mitsui', category: 'banks', country: 'japan' },
    { symbol: '8411.T', name: 'Mizuho', category: 'banks', country: 'japan' },
    // --- China ---
    { symbol: '0700.HK', name: 'Tencent', category: 'tech', country: 'china' },
    { symbol: '9988.HK', name: 'Alibaba', category: 'tech', country: 'china' },
    { symbol: '1810.HK', name: 'Xiaomi', category: 'tech', country: 'china' },
    { symbol: '3690.HK', name: 'Meituan', category: 'tech', country: 'china' },
    { symbol: 'BIDU', name: 'Baidu', category: 'tech', country: 'china' },
    { symbol: 'PDD', name: 'PDD Holdings', category: 'tech', country: 'china' },
    { symbol: '2269.HK', name: 'WuXi Biologics', category: 'health', country: 'china' },
    { symbol: '6160.HK', name: 'BeiGene', category: 'health', country: 'china' },
    { symbol: '1093.HK', name: 'CSPC Pharmaceutical', category: 'health', country: 'china' },
    { symbol: '1766.HK', name: 'CRRC', category: 'infrastructure', country: 'china' },
    { symbol: '1186.HK', name: 'China Railway Construction', category: 'infrastructure', country: 'china' },
    { symbol: '0390.HK', name: 'China Railway Group', category: 'infrastructure', country: 'china' },
    { symbol: '0857.HK', name: 'PetroChina', category: 'energy', country: 'china' },
    { symbol: '0386.HK', name: 'Sinopec', category: 'energy', country: 'china' },
    { symbol: '0916.HK', name: 'China Longyuan Power', category: 'energy', country: 'china' },
    { symbol: '2318.HK', name: 'Ping An', category: 'insurance', country: 'china' },
    { symbol: '2628.HK', name: 'China Life', category: 'insurance', country: 'china' },
    { symbol: '1299.HK', name: 'AIA Group', category: 'insurance', country: 'china' },
    { symbol: '1398.HK', name: 'ICBC', category: 'banks', country: 'china' },
    { symbol: '0939.HK', name: 'China Construction Bank', category: 'banks', country: 'china' },
    { symbol: '3988.HK', name: 'Bank of China', category: 'banks', country: 'china' },
    // --- Vietnam ---
    { symbol: 'VFS', name: 'VinFast', category: 'tech', country: 'vietnam' },
    { symbol: 'FPT.VN', name: 'FPT', category: 'tech', country: 'vietnam' },
    { symbol: 'HPG.VN', name: 'Hoa Phat Group', category: 'infrastructure', country: 'vietnam' },
    { symbol: 'VHM.VN', name: 'Vinhomes', category: 'infrastructure', country: 'vietnam' },
    { symbol: 'GAS.VN', name: 'PetroVietnam Gas', category: 'energy', country: 'vietnam' },
    { symbol: 'POW.VN', name: 'PetroVietnam Power', category: 'energy', country: 'vietnam' },
    { symbol: 'BVH.VN', name: 'Bao Viet Holdings', category: 'insurance', country: 'vietnam' },
    { symbol: 'VCB.VN', name: 'Vietcombank', category: 'banks', country: 'vietnam' },
    { symbol: 'BID.VN', name: 'BIDV', category: 'banks', country: 'vietnam' },
    { symbol: 'CTG.VN', name: 'VietinBank', category: 'banks', country: 'vietnam' },
];

const args = process.argv.slice(2);
const argValue = (name) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : null;
};
const OUT_FILE = argValue('--out') ||
    join(dirname(fileURLToPath(import.meta.url)), 'data-live.js');

const symbolFilter = argValue('--symbols');
const tickers = symbolFilter
    ? symbolFilter.split(',').map((s) => {
        const symbol = s.trim();
        return TICKERS.find((t) => t.symbol === symbol) ||
            { symbol, name: symbol, category: 'tech', country: 'us' };
    })
    : TICKERS;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function pool(items, limit, worker) {
    const results = new Array(items.length);
    let next = 0;
    const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (next < items.length) {
            const index = next++;
            results[index] = await worker(items[index], index);
        }
    });
    await Promise.all(runners);
    return results;
}

const round4 = (v) => Number(Number(v).toPrecision(4));

async function fetchChart(symbol) {
    const url = CHART_URL(symbol);
    let res = await fetch(url, { headers: FETCH_HEADERS });
    if (res.status === 429 || res.status >= 500) {
        await sleep(RETRY_DELAY_MS);
        res = await fetch(url, { headers: FETCH_HEADERS });
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const result = data && data.chart && data.chart.result && data.chart.result[0];
    if (!result) {
        const err = data && data.chart && data.chart.error;
        throw new Error(err && err.description ? err.description : 'empty chart result');
    }

    const meta = result.meta || {};
    const timestamps = result.timestamp || [];
    const quote = (result.indicators && result.indicators.quote && result.indicators.quote[0]) || {};
    const closes = quote.close || [];
    const volumes = quote.volume || [];

    // Zip and drop null closes (Yahoo pads holidays and live sessions with nulls).
    const dates = [];
    const outCloses = [];
    const outVolumes = [];
    for (let i = 0; i < timestamps.length; i++) {
        if (closes[i] == null) continue;
        dates.push(new Date(timestamps[i] * 1000).toISOString().slice(0, 10));
        outCloses.push(round4(closes[i]));
        outVolumes.push(volumes[i] == null ? 0 : volumes[i]);
    }
    if (outCloses.length < MIN_CLOSES) {
        throw new Error(`only ${outCloses.length} closes`);
    }
    return {
        currency: meta.currency || 'USD',
        name: meta.shortName || null,
        dates,
        closes: outCloses,
        volumes: outVolumes,
    };
}

async function main() {
    console.log(`Fetching ${tickers.length} symbols from Yahoo Finance…`);
    const results = await pool(tickers, POOL_SIZE, async (ticker) => {
        try {
            const chart = await fetchChart(ticker.symbol);
            return {
                symbol: ticker.symbol,
                name: chart.name || ticker.name,
                category: ticker.category,
                country: ticker.country,
                currency: chart.currency,
                dates: chart.dates,
                closes: chart.closes,
                volumes: chart.volumes,
            };
        } catch (error) {
            console.warn(`Skipping ${ticker.symbol}: ${error.message}`);
            return null;
        }
    });

    const ok = results.filter(Boolean);
    console.log(`Fetched ${ok.length} of ${tickers.length} symbols.`);
    if (ok.length < Math.ceil(tickers.length * MIN_SUCCESS_RATIO)) {
        throw new Error(`Only ${ok.length}/${tickers.length} symbols succeeded ` +
            `(need ${Math.ceil(tickers.length * MIN_SUCCESS_RATIO)}) — refusing to write.`);
    }

    const payload = {
        generatedAt: new Date().toISOString(),
        source: 'Yahoo Finance chart API (query1.finance.yahoo.com, 1mo daily)',
        requested: tickers.length,
        tickers: ok,
    };
    writeFileSync(OUT_FILE,
        '// Generated by stockspikes/refresh-data.mjs — do not edit by hand.\n' +
        `const STOCK_SPIKES_LIVE = ${JSON.stringify(payload, null, 2)};\n`);
    console.log(`Wrote ${OUT_FILE} (${ok.length} tickers).`);
}

main().catch((e) => { console.error('Refresh failed:', e.message); process.exit(1); });
