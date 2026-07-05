(function () {
    'use strict';

    const PAGEVIEWS_API = 'https://wikimedia.org/api/rest_v1/metrics/pageviews';
    const PROJECT = 'en.wikipedia';   // data source for the global (all-countries) view
    const ACCESS = 'all-access';
    const AGENT = 'user';

    const CANDIDATES = 50;    // top-viewed articles analyzed when no category is chosen
    const CATEGORY_POOL = 250;// candidates classified to dig out a chosen category
    const SERIES_LIMIT = 60;  // max articles we fetch 30-day history for
    const WINDOW_DAYS = 30;   // history window, including the selected day
    const TOP_RESULTS = 20;   // spikes shown per selection (day / category / country)
    const POOL_SIZE = 8;      // parallel API requests

    // Non-article pages that show up in top lists, in every language we surface.
    const EXCLUDED_TITLES = new Set([
        'Main_Page', '-', 'Search', 'メインページ', 'Pagina_principale', 'Wikipedia',
    ]);
    // Namespace names (the part before the first ":") to drop, across en/de/fr/it/ja/zh.
    const EXCLUDED_NS = new Set([
        'Special', 'Spezial', 'Spécial', 'Speciale', '特別', '特殊', 'Especial',
        'Wikipedia', 'Wikipédia', 'Help', 'Hilfe', 'Aide', 'Aiuto', 'ヘルプ', '帮助', '幫助',
        'Portal', 'Portale', 'Portail', 'ポータル', 'File', 'Datei', 'Fichier', 'ファイル', '文件',
        'Category', 'Kategorie', 'Catégorie', 'Categoria', 'カテゴリ', '分类', '分類',
        'Template', 'Vorlage', 'Modèle', 'Modello', 'テンプレート', '模板', 'Module', 'Modul',
        'User', 'Benutzer', 'Utilisateur', 'Utente', '利用者', '用户', 'User_talk', 'Benutzer_Diskussion',
        'Talk', 'Diskussion', 'Discussion', 'Discussione', 'ノート', 'Draft', 'MediaWiki',
        'Book', 'TimedText', 'Wikt', 'Wiktionary',
    ]);

    // Countries offered in the filter: ISO 3166-1 alpha-2 code → label. Order drives the dropdown.
    const COUNTRIES = [
        { code: 'US', label: 'United States' },
        { code: 'GB', label: 'United Kingdom' },
        { code: 'CH', label: 'Switzerland' },
        { code: 'CN', label: 'China' },
        { code: 'JP', label: 'Japan' },
        { code: 'DE', label: 'Germany' },
    ];

    // ---------- Wikidata classification ----------

    const WIKIDATA_API = 'https://www.wikidata.org/w/api.php';
    const WD_BATCH = 50;     // entities per wbgetentities request

    // Category options live in the markup; classify() must emit exactly those labels (plus 'Other').
    // When several buckets match an article, the first present here wins (AI/Persons are checked earlier).
    const CATEGORY_PRIORITY = ['Companies', 'Places', 'Science', 'Culture', 'Technology'];

    // Wikidata "instance of" (P31) Q-ids that mark an AI system/model — checked before everything else.
    const AI_SET = new Set([
        'Q115305900', // large language model
        'Q116777014', // generative pre-trained transformer
        'Q133284163', // generative artificial intelligence chatbot
        'Q117349473', // artificial intelligence model
        'Q117349475', // artificial intelligence model type
        'Q114617315', // diffusion model
        'Q113940039', // text-to-image model
        'Q1057059',   // chatbot
    ]);

    // Wikidata "instance of" (P31) Q-ids → category bucket.
    const CATEGORY_MAP = {
        // Places
        Q515: 'Places', Q6256: 'Places', Q3957: 'Places', Q486972: 'Places', Q532: 'Places',
        Q23442: 'Places', Q8502: 'Places', Q4022: 'Places', Q23397: 'Places', Q1549591: 'Places',
        Q82794: 'Places', Q35657: 'Places', Q5119: 'Places', Q33837: 'Places', Q3624078: 'Places',
        // Culture (creative works; people go to Persons)
        Q11424: 'Culture', Q5398426: 'Culture', Q7889: 'Culture', Q7725634: 'Culture',
        Q571: 'Culture', Q482994: 'Culture', Q134556: 'Culture', Q7366: 'Culture',
        Q207628: 'Culture', Q2431196: 'Culture', Q1259759: 'Culture', Q15416: 'Culture',
        Q24856: 'Culture', Q3464665: 'Culture', Q3305213: 'Culture', Q838948: 'Culture',
        Q4502142: 'Culture',
        // Technology (products; AI handled separately, companies go to Companies)
        Q7397: 'Technology', Q9143: 'Technology', Q9135: 'Technology', Q620615: 'Technology',
        Q35127: 'Technology', Q19967801: 'Technology', Q3966: 'Technology', Q11661: 'Technology',
        Q1301371: 'Technology',
        // Science & nature
        Q16521: 'Science', Q11344: 'Science', Q8054: 'Science', Q7187: 'Science',
        Q12136: 'Science', Q18123741: 'Science', Q634: 'Science', Q3863: 'Science',
        Q523: 'Science', Q2996394: 'Science', Q55983715: 'Science',
        // Companies & organizations
        Q4830453: 'Companies', Q6881511: 'Companies', Q783794: 'Companies', Q891723: 'Companies',
        Q167037: 'Companies', Q18388277: 'Companies', Q129238: 'Companies', Q219577: 'Companies',
        Q161380: 'Companies', Q431289: 'Companies', Q2085381: 'Companies',
    };

    const dom = {
        date: document.getElementById('date-input'),
        category: document.getElementById('category-select'),
        country: document.getElementById('country-select'),
        status: document.getElementById('status'),
        error: document.getElementById('error-box'),
        results: document.getElementById('results'),
        tiles: document.getElementById('tiles'),
        cards: document.getElementById('cards'),
        tableBody: document.getElementById('table-body'),
        modalEl: document.getElementById('detail-modal'),
        detailTitle: document.getElementById('detail-title'),
        detailSub: document.getElementById('detail-sub'),
        detailLink: document.getElementById('detail-link'),
        detailCanvas: document.getElementById('detail-canvas'),
    };

    const fmtInt = new Intl.NumberFormat('en');
    const fmtCompact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
    const fmtDay = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' });
    const fmtDayLong = new Intl.DateTimeFormat('en', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });

    const state = {
        date: null,        // Date (UTC midnight) of the analyzed day
        rows: [],          // analysis results, sorted by spike factor desc
        summaries: new Map(),
        charts: [],
        detailChart: null,
        detailRow: null,
        runId: 0,
    };
    const topCache = new Map();

    // ---------- small helpers ----------

    function utcToday() {
        const now = new Date();
        return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    }

    function addDays(date, days) {
        return new Date(date.getTime() + days * 86400000);
    }

    function pad2(n) {
        return String(n).padStart(2, '0');
    }

    function isoDate(date) {
        return date.getUTCFullYear() + '-' + pad2(date.getUTCMonth() + 1) + '-' + pad2(date.getUTCDate());
    }

    function pathDate(date) {
        return date.getUTCFullYear() + '/' + pad2(date.getUTCMonth() + 1) + '/' + pad2(date.getUTCDate());
    }

    function stampDate(date) {
        return '' + date.getUTCFullYear() + pad2(date.getUTCMonth() + 1) + pad2(date.getUTCDate()) + '00';
    }

    function median(values) {
        if (!values.length) return 0;
        const sorted = values.slice().sort((a, b) => a - b);
        const mid = sorted.length >> 1;
        return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    }

    function fmtFactor(factor) {
        if (!isFinite(factor)) return '×∞';
        return '×' + (factor < 10 ? factor.toFixed(1) : fmtInt.format(Math.round(factor)));
    }

    function cssVar(name) {
        return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    }

    function el(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }

    function articleUrl(title, project) {
        return 'https://' + project + '.org/wiki/' + encodeURIComponent(title);
    }

    // 'de.wikipedia' → 'dewiki' (Wikidata site id); null for non-Wikipedia projects.
    function wikiSite(project) {
        const [lang, family] = project.split('.');
        return family === 'wikipedia' ? lang + 'wiki' : null;
    }

    async function fetchJson(url) {
        const response = await fetch(url);
        if (response.status === 404) return null;
        if (!response.ok) throw new Error('HTTP ' + response.status + ' for ' + url);
        return response.json();
    }

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

    function setStatus(text) {
        dom.status.textContent = text;
    }

    function showError(message) {
        dom.error.textContent = message;
        dom.error.classList.remove('d-none');
    }

    function clearError() {
        dom.error.classList.add('d-none');
    }

    // ---------- data ----------

    async function getTop(date) {
        const key = isoDate(date);
        if (!topCache.has(key)) {
            topCache.set(key, await fetchJson(
                PAGEVIEWS_API + '/top/' + PROJECT + '/' + ACCESS + '/' + pathDate(date)
            ));
        }
        return topCache.get(key);
    }

    async function getTopPerCountry(country, date) {
        const key = country + '@' + isoDate(date);
        if (!topCache.has(key)) {
            topCache.set(key, await fetchJson(
                PAGEVIEWS_API + '/top-per-country/' + country + '/' + ACCESS + '/' + pathDate(date)
            ));
        }
        return topCache.get(key);
    }

    async function findLatestDate() {
        for (let back = 1; back <= 4; back++) {
            const date = addDays(utcToday(), -back);
            if (await getTop(date)) return date;
        }
        throw new Error('No recent pageview data found.');
    }

    function isRealArticle(title) {
        if (EXCLUDED_TITLES.has(title)) return false;
        const colon = title.indexOf(':');
        return !(colon > 0 && EXCLUDED_NS.has(title.slice(0, colon)));
    }

    // Candidate {article, project} list for the day: the global top-50, or a
    // country's most-viewed Wikipedia articles when a country is selected.
    async function getCandidates(date, country, limit) {
        const toCandidate = (entry) => ({
            article: entry.article,
            displayTitle: entry.article.replace(/_/g, ' '),
            project: entry.project || PROJECT,
        });
        if (!country) {
            const top = await getTop(date);
            if (!top) return null;
            return top.items[0].articles
                .filter((entry) => isRealArticle(entry.article))
                .slice(0, limit)
                .map(toCandidate);
        }
        const top = await getTopPerCountry(country, date);
        if (!top) return null;
        return top.items[0].articles
            .filter((entry) => wikiSite(entry.project) && isRealArticle(entry.article))
            .slice(0, limit)
            .map(toCandidate);
    }

    async function getSeries(title, endDate, project) {
        const start = addDays(endDate, -(WINDOW_DAYS - 1));
        const url = PAGEVIEWS_API + '/per-article/' + project + '/' + ACCESS + '/' + AGENT + '/'
            + encodeURIComponent(title) + '/daily/' + stampDate(start) + '/' + stampDate(endDate);
        const data = await fetchJson(url);
        if (!data || !data.items) return null;

        const byStamp = new Map(data.items.map((item) => [item.timestamp, item.views]));
        const dates = [];
        const values = [];
        for (let i = 0; i < WINDOW_DAYS; i++) {
            const day = addDays(start, i);
            dates.push(day);
            values.push(byStamp.get(stampDate(day)) || 0);
        }
        return { dates, values };
    }

    function summaryKey(title, project) {
        return project + '|' + title;
    }

    async function getSummary(title, project) {
        const key = summaryKey(title, project);
        if (!state.summaries.has(key)) {
            let summary = null;
            try {
                summary = await fetchJson(
                    'https://' + project + '.org/api/rest_v1/page/summary/' + encodeURIComponent(title)
                );
            } catch (error) {
                // Summaries are decoration only; ignore failures.
            }
            state.summaries.set(key, summary);
        }
        return state.summaries.get(key);
    }

    function claimIds(entity, prop) {
        const claims = entity && entity.claims && entity.claims[prop];
        if (!claims) return [];
        const ids = [];
        for (const claim of claims) {
            const value = claim.mainsnak && claim.mainsnak.datavalue && claim.mainsnak.datavalue.value;
            if (value && value.id) ids.push(value.id);
        }
        return ids;
    }

    function classify(instanceIds) {
        if (instanceIds.some((id) => AI_SET.has(id))) return 'AI';
        if (instanceIds.includes('Q5')) return 'Persons';
        const buckets = instanceIds.map((id) => CATEGORY_MAP[id]).filter(Boolean);
        for (const bucket of CATEGORY_PRIORITY) {
            if (buckets.includes(bucket)) return bucket;
        }
        return 'Other';
    }

    async function wikidataEntities(params) {
        const url = WIKIDATA_API + '?action=wbgetentities&format=json&origin=*&languages=en&' + params;
        try {
            const data = await fetchJson(url);
            return (data && data.entities) || {};
        } catch (error) {
            return {};
        }
    }

    // Attach a `category` to each candidate from Wikidata (P31 instance-of). Candidates may
    // span several language projects, so we query one Wikidata site at a time.
    async function classifyCandidates(items, runId) {
        items.forEach((item) => { item.category = 'Other'; });
        if (!items.length) return;
        setStatus('Classifying articles…');

        const bySite = new Map();      // Wikidata site id → candidates on that wiki
        items.forEach((item) => {
            const site = wikiSite(item.project);
            if (!site) return;
            if (!bySite.has(site)) bySite.set(site, []);
            bySite.get(site).push(item);
        });

        for (const [site, siteItems] of bySite) {
            for (let i = 0; i < siteItems.length; i += WD_BATCH) {
                const batch = siteItems.slice(i, i + WD_BATCH);
                const entities = await wikidataEntities(
                    'props=claims|sitelinks&sitefilter=' + site + '&sites=' + site
                    + '&titles=' + batch.map((item) => encodeURIComponent(item.displayTitle)).join('|')
                );
                if (runId !== state.runId) return;

                const byTitle = new Map();
                for (const id in entities) {
                    const entity = entities[id];
                    if (!entity || entity.missing !== undefined) continue;
                    const link = entity.sitelinks && entity.sitelinks[site];
                    if (!link) continue;
                    byTitle.set(link.title, classify(claimIds(entity, 'P31')));
                }
                for (const item of batch) {
                    if (byTitle.has(item.displayTitle)) item.category = byTitle.get(item.displayTitle);
                }
            }
        }
    }

    async function analyze(date) {
        const runId = ++state.runId;
        clearError();
        dom.results.classList.add('is-loading');
        setStatus('Loading top articles…');

        try {
            const country = dom.country.value;
            const category = dom.category.value;

            // Pull a wide candidate pool when a category is selected, then classify and narrow.
            const candidates = await getCandidates(date, country, category ? CATEGORY_POOL : CANDIDATES);
            if (runId !== state.runId) return;
            if (!candidates) {
                showError('No pageview data for ' + isoDate(date)
                    + (country ? ' in the selected country' : '')
                    + ' yet. Data is published with about one day of delay.');
                setStatus('No data.');
                dom.results.classList.remove('is-loading');
                return;
            }

            await classifyCandidates(candidates, runId);
            if (runId !== state.runId) return;

            const selected = (category ? candidates.filter((c) => c.category === category) : candidates)
                .slice(0, SERIES_LIMIT);

            let done = 0;
            const rows = await pool(selected, POOL_SIZE, async (entry) => {
                let series = null;
                try {
                    series = await getSeries(entry.article, date, entry.project);
                } catch (error) {
                    // Skip articles whose history cannot be loaded.
                }
                done++;
                if (runId === state.runId) {
                    setStatus('Analyzing ' + done + ' / ' + selected.length + ' articles…');
                }
                if (!series) return null;

                const views = series.values[series.values.length - 1];
                const baseline = median(series.values.slice(0, -1));
                return {
                    title: entry.article,
                    displayTitle: entry.displayTitle,
                    project: entry.project,
                    lang: entry.project.split('.')[0],
                    category: entry.category,
                    views,
                    baseline,
                    factor: views / Math.max(baseline, 1),
                    total: series.values.reduce((sum, v) => sum + v, 0),
                    dates: series.dates,
                    values: series.values,
                };
            });
            if (runId !== state.runId) return;

            state.date = date;
            state.rows = rows.filter(Boolean).sort((a, b) => b.factor - a.factor);
            await render(runId);
        } catch (error) {
            if (runId !== state.runId) return;
            showError('Could not load data from the Wikimedia API: ' + error.message);
            setStatus('Failed.');
            dom.results.classList.remove('is-loading');
        }
    }

    // ---------- rendering ----------

    async function render(runId) {
        const rows = state.rows;                     // already sorted by spike factor desc
        const cardRows = rows.slice(0, TOP_RESULTS);

        await pool(cardRows, POOL_SIZE, (row) => getSummary(row.title, row.project));
        if (runId !== undefined && runId !== state.runId) return;

        state.charts.forEach((chart) => chart.destroy());
        state.charts = [];

        renderTiles(rows);
        renderCards(cardRows);
        renderTable(cardRows);

        dom.results.classList.remove('d-none', 'is-loading');
        setStatus('Top ' + cardRows.length + ' spikes of ' + rows.length
            + ' analyzed articles on ' + fmtDayLong.format(state.date) + '.');
    }

    function tile(label, value, sub) {
        const col = el('div', 'col-12 col-sm-6 col-lg-4');
        const card = el('div', 'card h-100 shadow-sm');
        const body = el('div', 'card-body py-3');
        body.appendChild(el('div', 'tile-label', label));
        body.appendChild(el('div', 'tile-value', value));
        if (sub) body.appendChild(el('div', 'tile-sub', sub));
        card.appendChild(body);
        col.appendChild(card);
        return col;
    }

    function renderTiles(rows) {
        dom.tiles.replaceChildren();
        const topSpike = rows[0];
        const busiest = rows.slice().sort((a, b) => b.views - a.views)[0];

        dom.tiles.appendChild(tile(
            'Top spike',
            topSpike ? fmtFactor(topSpike.factor) : '—',
            topSpike ? topSpike.displayTitle : 'No spiking article'
        ));
        dom.tiles.appendChild(tile(
            'Analyzed articles',
            String(rows.length),
            'top ' + Math.min(TOP_RESULTS, rows.length) + ' shown'
        ));
        dom.tiles.appendChild(tile(
            'Most viewed',
            busiest ? fmtCompact.format(busiest.views) : '—',
            busiest ? busiest.displayTitle : ''
        ));
    }

    function renderCards(rows) {
        dom.cards.replaceChildren();

        if (!rows.length) {
            const note = el('div', 'col-12 w-100');
            note.appendChild(el('p', 'text-muted mb-0',
                'No articles to show for this selection'
                + (dom.category.value ? ' in the ' + dom.category.value + ' category' : '')
                + '. Try another day, category, or country.'));
            dom.cards.appendChild(note);
            return;
        }

        rows.forEach((row) => {
            const summary = state.summaries.get(summaryKey(row.title, row.project));
            const col = el('div', 'col');
            const card = el('div', 'card h-100 shadow-sm spike-card');
            card.setAttribute('role', 'button');
            card.setAttribute('tabindex', '0');
            card.setAttribute('aria-label', row.displayTitle + ': open detail chart');
            const body = el('div', 'card-body d-flex flex-column');

            const head = el('div', 'd-flex gap-3 align-items-start');
            if (summary && summary.thumbnail && summary.thumbnail.source) {
                const img = el('img', 'spike-thumb');
                img.src = summary.thumbnail.source;
                img.alt = '';
                img.loading = 'lazy';
                head.appendChild(img);
            }
            const headText = el('div', 'min-w-0');
            const title = el('h5', 'card-title mb-1');
            const link = el('a', null, row.displayTitle);
            link.href = articleUrl(row.title, row.project);
            link.target = '_blank';
            link.rel = 'noopener';
            link.addEventListener('click', (event) => event.stopPropagation());
            title.appendChild(link);
            headText.appendChild(title);
            const meta = el('div', 'spike-meta small text-muted mb-1');
            meta.appendChild(el('span', 'badge rounded-pill spike-cat', row.category));
            if (row.lang !== 'en') {
                meta.appendChild(el('span', 'spike-lang', row.lang.toUpperCase() + '.wiki'));
            }
            headText.appendChild(meta);
            if (summary && summary.description) {
                headText.appendChild(el('p', 'spike-desc small text-muted mb-0', summary.description));
            }
            head.appendChild(headText);
            body.appendChild(head);

            const sparkWrap = el('div', 'spark-wrap mt-auto');
            const canvas = document.createElement('canvas');
            sparkWrap.appendChild(canvas);
            body.appendChild(sparkWrap);

            const foot = el('div', 'd-flex justify-content-between align-items-baseline small');
            const left = el('div');
            left.appendChild(el('span', 'spike-value', fmtCompact.format(row.views)));
            left.appendChild(el('span', 'text-muted', ' views ' + fmtDay.format(state.date)));
            const right = el('div');
            right.appendChild(el('span', 'spike-value', fmtFactor(row.factor)));
            right.appendChild(el('span', 'text-muted', ' vs median'));
            foot.appendChild(left);
            foot.appendChild(right);
            body.appendChild(foot);

            card.appendChild(body);
            card.addEventListener('click', () => openDetail(row));
            card.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    openDetail(row);
                }
            });
            col.appendChild(card);
            dom.cards.appendChild(col);

            state.charts.push(makeChart(canvas, row, false));
        });
    }

    function renderTable(rows) {
        dom.tableBody.replaceChildren();
        rows.forEach((row, index) => {
            const tr = document.createElement('tr');
            tr.appendChild(el('td', 'text-muted', String(index + 1)));

            const tdTitle = document.createElement('td');
            const link = el('a', null, row.displayTitle);
            link.href = articleUrl(row.title, row.project);
            link.target = '_blank';
            link.rel = 'noopener';
            tdTitle.appendChild(link);
            tr.appendChild(tdTitle);

            tr.appendChild(el('td', 'text-muted small', row.category));
            tr.appendChild(el('td', 'text-muted small', row.lang.toUpperCase()));

            tr.appendChild(el('td', 'text-end num', fmtInt.format(row.views)));
            tr.appendChild(el('td', 'text-end num', fmtInt.format(Math.round(row.baseline))));
            tr.appendChild(el('td', 'text-end num', fmtFactor(row.factor)));
            tr.appendChild(el('td', 'text-end num', fmtInt.format(row.total)));
            dom.tableBody.appendChild(tr);
        });
    }

    // ---------- charts ----------

    const crosshairPlugin = {
        id: 'wspCrosshair',
        afterDraw(chart) {
            const active = chart.tooltip && chart.tooltip.getActiveElements();
            if (!active || !active.length) return;
            const x = active[0].element.x;
            const { top, bottom } = chart.chartArea;
            const ctx = chart.ctx;
            ctx.save();
            ctx.strokeStyle = cssVar('--wsp-axis');
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x, top);
            ctx.lineTo(x, bottom);
            ctx.stroke();
            ctx.restore();
        },
    };

    function makeChart(canvas, row, detailed) {
        const series = cssVar('--wsp-series');
        const surface = cssVar('--wsp-surface');
        const lastIndex = row.values.length - 1;
        const pointRadius = row.values.map((v, i) => (i === lastIndex ? 4 : 0));

        return new Chart(canvas, {
            type: 'line',
            data: {
                labels: row.dates.map((d) => fmtDay.format(d)),
                datasets: [{
                    data: row.values,
                    borderColor: series,
                    borderWidth: 2,
                    borderJoinStyle: 'round',
                    borderCapStyle: 'round',
                    fill: 'origin',
                    backgroundColor: cssVar('--wsp-series-fill'),
                    tension: 0.2,
                    pointRadius,
                    pointHoverRadius: 5,
                    pointBackgroundColor: series,
                    pointBorderColor: surface,
                    pointBorderWidth: 2,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                layout: detailed ? {} : { padding: 6 },
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        displayColors: false,
                        callbacks: {
                            label: (item) => fmtInt.format(item.parsed.y) + ' views',
                        },
                    },
                },
                scales: {
                    x: {
                        display: detailed,
                        grid: { display: false },
                        border: { color: cssVar('--wsp-axis') },
                        ticks: { color: cssVar('--wsp-tick'), maxTicksLimit: 8, maxRotation: 0 },
                    },
                    y: {
                        display: detailed,
                        beginAtZero: true,
                        grid: { color: cssVar('--wsp-grid') },
                        border: { display: false },
                        ticks: {
                            color: cssVar('--wsp-tick'),
                            maxTicksLimit: 6,
                            callback: (value) => fmtCompact.format(value),
                        },
                    },
                },
            },
            plugins: [crosshairPlugin],
        });
    }

    // ---------- detail modal ----------

    function openDetail(row) {
        state.detailRow = row;
        dom.detailTitle.textContent = row.displayTitle;
        dom.detailSub.textContent = fmtInt.format(row.views) + ' views on ' + fmtDayLong.format(state.date)
            + ' · ' + fmtFactor(row.factor) + ' vs 30-day median of ' + fmtInt.format(Math.round(row.baseline));
        dom.detailLink.href = articleUrl(row.title, row.project);
        bootstrap.Modal.getOrCreateInstance(dom.modalEl).show();
    }

    dom.modalEl.addEventListener('shown.bs.modal', () => {
        if (state.detailChart) state.detailChart.destroy();
        state.detailChart = makeChart(dom.detailCanvas, state.detailRow, true);
    });

    dom.modalEl.addEventListener('hidden.bs.modal', () => {
        if (state.detailChart) {
            state.detailChart.destroy();
            state.detailChart = null;
        }
    });

    // ---------- wiring ----------

    dom.category.addEventListener('change', () => {
        if (state.date) analyze(state.date);
    });

    dom.country.addEventListener('change', () => {
        if (state.date) analyze(state.date);
    });

    dom.date.addEventListener('change', () => {
        const parts = dom.date.value.split('-').map(Number);
        if (parts.length !== 3 || parts.some(isNaN)) return;
        analyze(new Date(Date.UTC(parts[0], parts[1] - 1, parts[2])));
    });

    (async function init() {
        try {
            const latest = await findLatestDate();
            dom.date.max = isoDate(latest);
            dom.date.value = isoDate(latest);
            await analyze(latest);
        } catch (error) {
            showError('Could not reach the Wikimedia API: ' + error.message);
            setStatus('Failed.');
        }
    })();
})();
