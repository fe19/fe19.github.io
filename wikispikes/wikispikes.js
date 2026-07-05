(function () {
    'use strict';

    const PAGEVIEWS_API = 'https://wikimedia.org/api/rest_v1/metrics/pageviews';
    const SUMMARY_API = 'https://en.wikipedia.org/api/rest_v1/page/summary/';
    const PROJECT = 'en.wikipedia';
    const ACCESS = 'all-access';
    const AGENT = 'user';

    const CANDIDATES = 50;   // top-viewed articles analyzed per day
    const WINDOW_DAYS = 30;  // history window, including the selected day
    const MAX_CARDS = 12;    // spike cards shown
    const POOL_SIZE = 8;     // parallel API requests

    const EXCLUDED_TITLES = new Set(['Main_Page', '-', 'Search']);
    const EXCLUDED_PREFIXES = [
        'Special:', 'Wikipedia:', 'Portal:', 'File:', 'Help:', 'Category:',
        'Template:', 'Talk:', 'User:', 'User_talk:', 'Draft:', 'Module:',
        'MediaWiki:', 'Book:', 'TimedText:',
    ];

    const dom = {
        date: document.getElementById('date-input'),
        factor: document.getElementById('factor-select'),
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

    function articleUrl(title) {
        return 'https://en.wikipedia.org/wiki/' + encodeURIComponent(title);
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

    async function findLatestDate() {
        for (let back = 1; back <= 4; back++) {
            const date = addDays(utcToday(), -back);
            if (await getTop(date)) return date;
        }
        throw new Error('No recent pageview data found.');
    }

    function isRealArticle(title) {
        if (EXCLUDED_TITLES.has(title)) return false;
        return !EXCLUDED_PREFIXES.some((prefix) => title.startsWith(prefix));
    }

    async function getSeries(title, endDate) {
        const start = addDays(endDate, -(WINDOW_DAYS - 1));
        const url = PAGEVIEWS_API + '/per-article/' + PROJECT + '/' + ACCESS + '/' + AGENT + '/'
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

    async function getSummary(title) {
        if (!state.summaries.has(title)) {
            let summary = null;
            try {
                summary = await fetchJson(SUMMARY_API + encodeURIComponent(title));
            } catch (error) {
                // Summaries are decoration only; ignore failures.
            }
            state.summaries.set(title, summary);
        }
        return state.summaries.get(title);
    }

    async function analyze(date) {
        const runId = ++state.runId;
        clearError();
        dom.results.classList.add('is-loading');
        setStatus('Loading top articles…');

        try {
            const top = await getTop(date);
            if (runId !== state.runId) return;
            if (!top) {
                showError('No pageview data for ' + isoDate(date) + ' yet. Data is published with about one day of delay.');
                setStatus('No data.');
                dom.results.classList.remove('is-loading');
                return;
            }

            const candidates = top.items[0].articles
                .filter((entry) => isRealArticle(entry.article))
                .slice(0, CANDIDATES);

            let done = 0;
            const rows = await pool(candidates, POOL_SIZE, async (entry) => {
                let series = null;
                try {
                    series = await getSeries(entry.article, date);
                } catch (error) {
                    // Skip articles whose history cannot be loaded.
                }
                done++;
                if (runId === state.runId) {
                    setStatus('Analyzing ' + done + ' / ' + candidates.length + ' articles…');
                }
                if (!series) return null;

                const views = series.values[series.values.length - 1];
                const baseline = median(series.values.slice(0, -1));
                return {
                    title: entry.article,
                    displayTitle: entry.article.replace(/_/g, ' '),
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
        const threshold = Number(dom.factor.value);
        const spikes = state.rows.filter((row) => row.factor >= threshold);
        const cardRows = spikes.slice(0, MAX_CARDS);

        await pool(cardRows, POOL_SIZE, (row) => getSummary(row.title));
        if (runId !== undefined && runId !== state.runId) return;

        state.charts.forEach((chart) => chart.destroy());
        state.charts = [];

        renderTiles(spikes, threshold);
        renderCards(cardRows, threshold);
        renderTable();

        dom.results.classList.remove('d-none', 'is-loading');
        setStatus(spikes.length + ' of ' + state.rows.length + ' top articles spiking ≥×'
            + threshold + ' on ' + fmtDayLong.format(state.date) + '.');
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

    function renderTiles(spikes, threshold) {
        dom.tiles.replaceChildren();
        const topSpike = spikes[0];
        const busiest = state.rows.slice().sort((a, b) => b.views - a.views)[0];

        dom.tiles.appendChild(tile(
            'Top spike',
            topSpike ? fmtFactor(topSpike.factor) : '—',
            topSpike ? topSpike.displayTitle : 'No article above ×' + threshold
        ));
        dom.tiles.appendChild(tile(
            'Spiking articles',
            String(spikes.length),
            '≥×' + threshold + ' of ' + state.rows.length + ' top articles'
        ));
        dom.tiles.appendChild(tile(
            'Most viewed',
            busiest ? fmtCompact.format(busiest.views) : '—',
            busiest ? busiest.displayTitle : ''
        ));
    }

    function renderCards(rows, threshold) {
        dom.cards.replaceChildren();

        if (!rows.length) {
            const note = el('div', 'col-12');
            note.appendChild(el('p', 'text-muted mb-0',
                'No article in the day’s top ' + CANDIDATES + ' is at ≥×' + threshold
                + ' of its 30-day median. Try a lower threshold.'));
            dom.cards.appendChild(note);
            return;
        }

        rows.forEach((row) => {
            const summary = state.summaries.get(row.title);
            const col = el('div', 'col-12 col-sm-6 col-lg-4');
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
            link.href = articleUrl(row.title);
            link.target = '_blank';
            link.rel = 'noopener';
            link.addEventListener('click', (event) => event.stopPropagation());
            title.appendChild(link);
            headText.appendChild(title);
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

    function renderTable() {
        dom.tableBody.replaceChildren();
        state.rows.forEach((row, index) => {
            const tr = document.createElement('tr');
            tr.appendChild(el('td', 'text-muted', String(index + 1)));

            const tdTitle = document.createElement('td');
            const link = el('a', null, row.displayTitle);
            link.href = articleUrl(row.title);
            link.target = '_blank';
            link.rel = 'noopener';
            tdTitle.appendChild(link);
            tr.appendChild(tdTitle);

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
        dom.detailLink.href = articleUrl(row.title);
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

    dom.factor.addEventListener('change', () => {
        if (state.rows.length) render();
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
