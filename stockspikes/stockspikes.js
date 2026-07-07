(function () {
    'use strict';

    const TOP_RESULTS = 20;   // winners shown per selection (category / country)

    const CATEGORY_LABELS = {
        tech: 'Tech',
        health: 'Health',
        infrastructure: 'Infrastructure',
        energy: 'Energy',
        insurance: 'Insurance',
        banks: 'Banks',
    };

    const COUNTRY_LABELS = {
        us: 'United States',
        uk: 'United Kingdom',
        eu: 'European Union',
        switzerland: 'Switzerland',
        japan: 'Japan',
        china: 'China',
        vietnam: 'Vietnam',
    };

    const COUNTRY_TAGS = {
        us: 'US', uk: 'UK', eu: 'EU', switzerland: 'CH',
        japan: 'JP', china: 'CN', vietnam: 'VN',
    };

    const dom = {
        category: document.getElementById('category-select'),
        country: document.getElementById('country-select'),
        status: document.getElementById('status'),
        error: document.getElementById('error-box'),
        sample: document.getElementById('sample-box'),
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
    const fmtDay = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' });
    const fmtStamp = new Intl.DateTimeFormat('en', {
        weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });

    const state = {
        rows: [],          // all tickers with computed metrics
        charts: [],
        detailChart: null,
        detailRow: null,
    };

    // ---------- small helpers ----------

    function median(values) {
        if (!values.length) return 0;
        const sorted = values.slice().sort((a, b) => a - b);
        const mid = sorted.length >> 1;
        return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    }

    function fmtFactor(factor) {
        if (!isFinite(factor)) return '×∞';
        return '×' + (factor < 10 ? factor.toFixed(2) : fmtInt.format(Math.round(factor)));
    }

    function fmtPct(pct) {
        return (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%';
    }

    // Yahoo uses non-ISO codes like "GBp" (pence sterling) that Intl rejects.
    function fmtPrice(value, currency) {
        try {
            return new Intl.NumberFormat('en', { style: 'currency', currency }).format(value);
        } catch (error) {
            return fmtInt.format(Math.round(value * 100) / 100) + ' ' + currency;
        }
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

    function quoteUrl(symbol) {
        return 'https://finance.yahoo.com/quote/' + encodeURIComponent(symbol);
    }

    function setStatus(text) {
        dom.status.textContent = text;
    }

    function showError(message) {
        dom.error.textContent = message;
        dom.error.classList.remove('d-none');
    }

    // ---------- analysis ----------

    // Day change, spike vs the window's median close, and volume vs its median.
    function computeRow(ticker) {
        const closes = ticker.closes;
        const volumes = ticker.volumes;
        const last = closes[closes.length - 1];
        const prev = closes[closes.length - 2];
        const baseline = median(closes.slice(0, -1));
        return {
            ...ticker,
            last,
            baseline,
            dayChangePct: ((last - prev) / prev) * 100,
            spikeFactor: last / Math.max(baseline, 1e-9),
            volumeRatio: volumes[volumes.length - 1] / Math.max(median(volumes.slice(0, -1)), 1),
        };
    }

    function filtered() {
        const category = dom.category.value;
        const country = dom.country.value;
        return state.rows
            .filter((row) => (!category || row.category === category)
                && (!country || row.country === country))
            .sort((a, b) => b.dayChangePct - a.dayChangePct);
    }

    // ---------- rendering ----------

    function render() {
        const rows = filtered();                     // sorted by day change desc
        const cardRows = rows.slice(0, TOP_RESULTS);

        state.charts.forEach((chart) => chart.destroy());
        state.charts = [];

        renderTiles(rows);
        renderCards(cardRows);
        renderTable(cardRows);

        dom.results.classList.remove('d-none');
        setStatus('Top ' + cardRows.length + ' of ' + rows.length + ' tickers · data as of '
            + fmtStamp.format(new Date(STOCK_SPIKES_LIVE.generatedAt)));
    }

    function tile(label, value, sub, valueClass) {
        const col = el('div', 'col-12 col-sm-6 col-lg-4');
        const card = el('div', 'card h-100 shadow-sm');
        const body = el('div', 'card-body py-3');
        body.appendChild(el('div', 'tile-label', label));
        body.appendChild(el('div', 'tile-value' + (valueClass ? ' ' + valueClass : ''), value));
        if (sub) body.appendChild(el('div', 'tile-sub', sub));
        card.appendChild(body);
        col.appendChild(card);
        return col;
    }

    function renderTiles(rows) {
        dom.tiles.replaceChildren();
        const top = rows[0];
        const average = rows.length
            ? rows.reduce((sum, row) => sum + row.dayChangePct, 0) / rows.length
            : null;

        dom.tiles.appendChild(tile(
            'Top gainer',
            top ? fmtPct(top.dayChangePct) : '—',
            top ? top.name + ' (' + top.symbol + ')' : 'No ticker matches',
            top && top.dayChangePct >= 0 ? 'delta-up' : top ? 'delta-down' : null
        ));
        dom.tiles.appendChild(tile(
            'Average day change',
            average === null ? '—' : fmtPct(average),
            'across the selection',
            average === null ? null : average >= 0 ? 'delta-up' : 'delta-down'
        ));
        dom.tiles.appendChild(tile(
            'Tickers',
            String(rows.length),
            'top ' + Math.min(TOP_RESULTS, rows.length) + ' shown'
        ));
    }

    function renderCards(rows) {
        dom.cards.replaceChildren();

        if (!rows.length) {
            const category = dom.category.value;
            const country = dom.country.value;
            const note = el('div', 'col-12 w-100');
            note.appendChild(el('p', 'text-muted mb-0',
                'No stocks to show'
                + (category ? ' in ' + CATEGORY_LABELS[category] : '')
                + (country ? ' for ' + COUNTRY_LABELS[country] : '')
                + '. Try another category or country.'));
            dom.cards.appendChild(note);
            return;
        }

        rows.forEach((row) => {
            const col = el('div', 'col');
            const card = el('div', 'card h-100 shadow-sm spike-card');
            card.setAttribute('role', 'button');
            card.setAttribute('tabindex', '0');
            card.setAttribute('aria-label', row.name + ': open detail chart');
            const body = el('div', 'card-body d-flex flex-column');

            const title = el('h5', 'card-title mb-1');
            const link = el('a', null, row.name);
            link.href = quoteUrl(row.symbol);
            link.target = '_blank';
            link.rel = 'noopener';
            link.addEventListener('click', (event) => event.stopPropagation());
            title.appendChild(link);
            body.appendChild(title);

            const meta = el('div', 'spike-meta small text-muted mb-1');
            meta.appendChild(el('span', 'badge rounded-pill stock-cat', CATEGORY_LABELS[row.category]));
            meta.appendChild(el('span', 'stock-tag', COUNTRY_TAGS[row.country]));
            meta.appendChild(el('span', null, row.symbol));
            body.appendChild(meta);

            const sparkWrap = el('div', 'spark-wrap mt-auto');
            const canvas = document.createElement('canvas');
            sparkWrap.appendChild(canvas);
            body.appendChild(sparkWrap);

            const foot = el('div', 'd-flex justify-content-between align-items-baseline small');
            foot.appendChild(el('span', 'spike-value', fmtPrice(row.last, row.currency)));
            foot.appendChild(el('span', row.dayChangePct >= 0 ? 'delta-up' : 'delta-down',
                fmtPct(row.dayChangePct)));
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

            const tdSymbol = document.createElement('td');
            const link = el('a', null, row.symbol);
            link.href = quoteUrl(row.symbol);
            link.target = '_blank';
            link.rel = 'noopener';
            tdSymbol.appendChild(link);
            tr.appendChild(tdSymbol);

            tr.appendChild(el('td', null, row.name));
            tr.appendChild(el('td', 'text-muted small', CATEGORY_LABELS[row.category]));
            tr.appendChild(el('td', 'text-muted small', COUNTRY_TAGS[row.country]));
            tr.appendChild(el('td', 'text-end num', fmtPrice(row.last, row.currency)));
            const tdChange = el('td', 'text-end num', fmtPct(row.dayChangePct));
            tdChange.classList.add(row.dayChangePct >= 0 ? 'delta-up' : 'delta-down');
            tr.appendChild(tdChange);
            tr.appendChild(el('td', 'text-end num', fmtFactor(row.spikeFactor)));
            tr.appendChild(el('td', 'text-end num', fmtFactor(row.volumeRatio)));
            dom.tableBody.appendChild(tr);
        });
    }

    // ---------- charts ----------

    const crosshairPlugin = {
        id: 'sspCrosshair',
        afterDraw(chart) {
            const active = chart.tooltip && chart.tooltip.getActiveElements();
            if (!active || !active.length) return;
            const x = active[0].element.x;
            const { top, bottom } = chart.chartArea;
            const ctx = chart.ctx;
            ctx.save();
            ctx.strokeStyle = cssVar('--ssp-axis');
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x, top);
            ctx.lineTo(x, bottom);
            ctx.stroke();
            ctx.restore();
        },
    };

    function makeChart(canvas, row, detailed) {
        const up = row.dayChangePct >= 0;
        const series = cssVar(up ? '--ssp-up' : '--ssp-down');
        const fill = cssVar(up ? '--ssp-up-fill' : '--ssp-down-fill');
        const surface = cssVar('--ssp-surface');
        const lastIndex = row.closes.length - 1;
        const pointRadius = row.closes.map((v, i) => (i === lastIndex ? 4 : 0));

        return new Chart(canvas, {
            type: 'line',
            data: {
                labels: row.dates.map((d) => fmtDay.format(new Date(d))),
                datasets: [{
                    data: row.closes,
                    borderColor: series,
                    borderWidth: 2,
                    borderJoinStyle: 'round',
                    borderCapStyle: 'round',
                    fill: 'origin',
                    backgroundColor: fill,
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
                            label: (item) => fmtPrice(item.parsed.y, row.currency),
                        },
                    },
                },
                scales: {
                    x: {
                        display: detailed,
                        grid: { display: false },
                        border: { color: cssVar('--ssp-axis') },
                        ticks: { color: cssVar('--ssp-tick'), maxTicksLimit: 8, maxRotation: 0 },
                    },
                    y: {
                        display: detailed,
                        beginAtZero: false,
                        grid: { color: cssVar('--ssp-grid') },
                        border: { display: false },
                        ticks: {
                            color: cssVar('--ssp-tick'),
                            maxTicksLimit: 6,
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
        dom.detailTitle.textContent = row.name + ' (' + row.symbol + ')';
        dom.detailSub.textContent = fmtPrice(row.last, row.currency)
            + ' · ' + fmtPct(row.dayChangePct) + ' on the day'
            + ' · ' + fmtFactor(row.spikeFactor) + ' vs 30-day median'
            + ' · volume ' + fmtFactor(row.volumeRatio);
        dom.detailLink.href = quoteUrl(row.symbol);
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

    dom.category.addEventListener('change', render);
    dom.country.addEventListener('change', render);

    (function init() {
        if (typeof STOCK_SPIKES_LIVE === 'undefined' || !STOCK_SPIKES_LIVE.tickers) {
            showError('No stock data has been generated yet — run the "Refresh stock data" '
                + 'GitHub Actions workflow to create stockspikes/data-live.js.');
            setStatus('No data.');
            return;
        }
        if (STOCK_SPIKES_LIVE.sample) {
            dom.sample.textContent = 'Showing synthetic sample data — real market data appears '
                + 'after the next run of the "Refresh stock data" GitHub Actions workflow.';
            dom.sample.classList.remove('d-none');
        }
        state.rows = STOCK_SPIKES_LIVE.tickers
            .filter((ticker) => ticker.closes && ticker.closes.length >= 2)
            .map(computeRow);
        render();
    })();
})();
