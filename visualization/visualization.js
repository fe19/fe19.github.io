(() => {
    const SERIES = [
        { key: 'ef', label: 'EF (V/m)', color: '#9a5331', canvasId: 'chart-ef' },
        { key: 'rf', label: 'RF Power Density (mW/m²)', color: '#355C7D', canvasId: 'chart-rf' },
        { key: 'emf', label: 'EMF (mG)', color: '#0dcaf0', canvasId: 'chart-emf' },
    ];

    const charts = {};
    let allRows = [];
    let syncing = false;

    Chart.register(window.ChartZoom);

    function parseCsv(text) {
        const lines = text.split(/\r?\n/);
        const rows = [];
        for (let i = 3; i < lines.length; i++) {
            const line = lines[i];
            if (!line) continue;
            const parts = line.split(',');
            if (parts.length < 7) continue;
            const ts = parts[0].replace(/\//g, '-').replace(' ', 'T');
            const t = new Date(ts).getTime();
            if (Number.isNaN(t)) continue;
            rows.push({
                t,
                emf: parseFloat(parts[1]),
                ef: parseFloat(parts[2]),
                rf: parseFloat(parts[3]),
                source: (parts[6] || '').trim(),
            });
        }
        return rows;
    }

    function activeSources() {
        return new Set(
            Array.from(document.querySelectorAll('.source-filters input:checked')).map(el => el.value)
        );
    }

    function visibleRows() {
        const sources = activeSources();
        return allRows.filter(r => sources.has(r.source));
    }

    function readYRange(key) {
        const min = parseFloat(document.querySelector(`input[data-chart="${key}"][data-bound="min"]`).value);
        const max = parseFloat(document.querySelector(`input[data-chart="${key}"][data-bound="max"]`).value);
        return {
            min: Number.isFinite(min) ? min : undefined,
            max: Number.isFinite(max) ? max : undefined,
        };
    }

    function buildChart(series, points) {
        const ctx = document.getElementById(series.canvasId).getContext('2d');
        const yRange = readYRange(series.key);
        return new Chart(ctx, {
            type: 'line',
            data: {
                datasets: [{
                    label: series.label,
                    data: points,
                    borderColor: series.color,
                    backgroundColor: series.color + '33',
                    borderWidth: 1.2,
                    pointRadius: 0,
                    tension: 0,
                }],
            },
            options: {
                parsing: false,
                normalized: true,
                animation: false,
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'nearest', intersect: false, axis: 'x' },
                plugins: {
                    legend: { display: false },
                    decimation: { enabled: true, algorithm: 'lttb', samples: 800 },
                    zoom: {
                        pan: { enabled: true, mode: 'x' },
                        zoom: {
                            wheel: { enabled: true },
                            pinch: { enabled: true },
                            drag: { enabled: false },
                            mode: 'x',
                            onZoom: ({ chart }) => syncRange(chart),
                            onPan: ({ chart }) => syncRange(chart),
                        },
                    },
                    tooltip: { mode: 'nearest', intersect: false },
                },
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            tooltipFormat: 'yyyy-MM-dd HH:mm:ss',
                            displayFormats: {
                                millisecond: 'HH:mm:ss.SSS',
                                second: 'HH:mm:ss',
                                minute: 'HH:mm',
                                hour: 'HH:mm',
                                day: 'MMM d',
                            },
                        },
                        ticks: { maxRotation: 0, autoSkip: true },
                    },
                    y: { min: yRange.min, max: yRange.max },
                },
            },
        });
    }

    function syncRange(sourceChart) {
        if (syncing) return;
        syncing = true;
        const { min, max } = sourceChart.scales.x;
        for (const s of SERIES) {
            const c = charts[s.key];
            if (!c || c === sourceChart) continue;
            c.zoomScale('x', { min, max }, 'none');
        }
        syncing = false;
    }

    function readSmooth(key) {
        const v = parseInt(document.querySelector(`input[data-chart="${key}"][data-bound="smooth"]`).value, 10);
        return Number.isFinite(v) && v >= 1 ? v : 1;
    }

    function pointsFor(rows, key, window) {
        const n = rows.length;
        const out = new Array(n);
        if (!window || window <= 1) {
            for (let i = 0; i < n; i++) out[i] = { x: rows[i].t, y: rows[i][key] };
            return out;
        }
        const half = Math.floor(window / 2);
        let sum = 0, lo = 0, hi = -1;
        for (let i = 0; i < n; i++) {
            const targetHi = Math.min(n - 1, i + half);
            const targetLo = Math.max(0, i - half);
            while (hi < targetHi) { hi++; sum += rows[hi][key]; }
            while (lo < targetLo) { sum -= rows[lo][key]; lo++; }
            out[i] = { x: rows[i].t, y: sum / (hi - lo + 1) };
        }
        return out;
    }

    function renderCharts() {
        const rows = visibleRows();
        for (const s of SERIES) {
            const data = pointsFor(rows, s.key, readSmooth(s.key));
            if (charts[s.key]) {
                charts[s.key].data.datasets[0].data = data;
                charts[s.key].resetZoom('none');
                charts[s.key].update('none');
            } else {
                charts[s.key] = buildChart(s, data);
            }
        }
        renderSummary(rows);
        renderStatus(rows);
    }

    function quantile(sorted, q) {
        if (sorted.length === 0) return NaN;
        const pos = (sorted.length - 1) * q;
        const base = Math.floor(pos);
        const rest = pos - base;
        return sorted[base + 1] !== undefined ? sorted[base] + rest * (sorted[base + 1] - sorted[base]) : sorted[base];
    }

    function fmt(n) {
        if (!Number.isFinite(n)) return '–';
        const a = Math.abs(n);
        if (a >= 1000) return n.toFixed(0);
        if (a >= 1) return n.toFixed(2);
        return n.toFixed(3);
    }

    function statsFor(values) {
        if (values.length === 0) return { count: 0, min: NaN, max: NaN, mean: NaN, median: NaN, p95: NaN };
        const sorted = values.slice().sort((a, b) => a - b);
        let sum = 0;
        for (const v of values) sum += v;
        return {
            count: values.length,
            min: sorted[0],
            max: sorted[sorted.length - 1],
            mean: sum / values.length,
            median: quantile(sorted, 0.5),
            p95: quantile(sorted, 0.95),
        };
    }

    function renderSummary(rows) {
        const tbody = document.getElementById('summary-body');
        const html = SERIES.map(s => {
            const vals = rows.map(r => r[s.key]).filter(Number.isFinite);
            const st = statsFor(vals);
            return `<tr>
                <td>${s.label}</td>
                <td class="text-end">${st.count.toLocaleString()}</td>
                <td class="text-end">${fmt(st.min)}</td>
                <td class="text-end">${fmt(st.max)}</td>
                <td class="text-end">${fmt(st.mean)}</td>
                <td class="text-end">${fmt(st.median)}</td>
                <td class="text-end">${fmt(st.p95)}</td>
            </tr>`;
        }).join('');
        tbody.innerHTML = html;
    }

    function renderStatus(rows) {
        const el = document.getElementById('status');
        if (rows.length === 0) {
            el.textContent = 'No rows match current filters.';
            return;
        }
        const pad = n => String(n).padStart(2, '0');
        const fmtDate = ms => {
            const d = new Date(ms);
            return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        };
        const startDate = fmtDate(rows[0].t);
        const endDate = fmtDate(rows[rows.length - 1].t);
        const dateLabel = startDate === endDate ? startDate : `${startDate} → ${endDate}`;
        const span = (rows[rows.length - 1].t - rows[0].t) / 1000;
        const h = Math.floor(span / 3600);
        const m = Math.floor((span % 3600) / 60);
        const s = Math.floor(span % 60);
        el.textContent = `${dateLabel} • ${rows.length.toLocaleString()} rows • ${pad(h)}:${pad(m)}:${pad(s)} span`;
    }

    function loadText(text) {
        allRows = parseCsv(text);
        renderCharts();
    }

    async function loadDefault() {
        try {
            const res = await fetch('measurements.csv');
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const text = await res.text();
            loadText(text);
        } catch (err) {
            document.getElementById('status').textContent =
                'Could not load measurements.csv (use a local server, or pick a CSV file).';
            console.error(err);
        }
    }

    document.getElementById('file-input').addEventListener('change', e => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => loadText(String(reader.result));
        reader.readAsText(file);
    });

    document.getElementById('reset-btn').addEventListener('click', () => {
        document.getElementById('file-input').value = '';
        loadDefault();
    });

    for (const cb of document.querySelectorAll('.source-filters input')) {
        cb.addEventListener('change', renderCharts);
    }

    for (const input of document.querySelectorAll('.y-range input')) {
        input.addEventListener('input', () => {
            const key = input.dataset.chart;
            const chart = charts[key];
            if (!chart) return;
            if (input.dataset.bound === 'smooth') {
                chart.data.datasets[0].data = pointsFor(visibleRows(), key, readSmooth(key));
            } else {
                const { min, max } = readYRange(key);
                chart.options.scales.y.min = min;
                chart.options.scales.y.max = max;
            }
            chart.update('none');
        });
    }

    loadDefault();
})();
