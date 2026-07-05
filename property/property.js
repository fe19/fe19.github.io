(function () {
    'use strict';

    const TYPE_LABELS = { apartment: 'Apartment', house: 'House' };
    const SERIES_COLORS = { apartment: '#2a78d6', house: '#1baf7a' };
    const CSV_HEADER = ['canton_code', 'canton', 'city', 'property_type',
        'price_chf_per_m2', 'listings', 'median_price_chf', 'yoy_change_pct'];

    const fmtInt = new Intl.NumberFormat('de-CH', { maximumFractionDigits: 0 });
    const fmtPct = new Intl.NumberFormat('de-CH', { maximumFractionDigits: 1, signDisplay: 'always' });

    // --- dataset handling ------------------------------------------------

    function expandBundled() {
        const records = [];
        SWISS_PROPERTY_DATA.rows.forEach(r => {
            const [code, canton, city, aM2, aN, aMed, aYoy, hM2, hN, hMed, hYoy] = r;
            records.push({ cantonCode: code, canton, city, type: 'apartment', priceM2: aM2, listings: aN, medianPrice: aMed, yoy: aYoy });
            records.push({ cantonCode: code, canton, city, type: 'house', priceM2: hM2, listings: hN, medianPrice: hMed, yoy: hYoy });
        });
        return { meta: SWISS_PROPERTY_DATA.meta, records };
    }

    const bundled = expandBundled();
    let dataset = bundled;
    let lastResult = [];
    let priceChart = null;
    let countChart = null;

    // --- element refs -----------------------------------------------------

    const el = id => document.getElementById(id);
    const cantonSelect = el('canton-select');
    const citySelect = el('city-select');
    const typeSelect = el('type-select');
    const queryBtn = el('query-btn');
    const downloadBtn = el('download-btn');
    const importInput = el('import-input');
    const resetBtn = el('reset-btn');
    const sourceBadge = el('source-badge');
    const resultsSection = el('results-section');
    const emptyHint = el('empty-hint');

    // --- selectors ---------------------------------------------------------

    function rebuildCantonSelect() {
        const cantons = [];
        const seen = new Set();
        dataset.records.forEach(r => {
            if (!seen.has(r.cantonCode)) {
                seen.add(r.cantonCode);
                cantons.push({ code: r.cantonCode, name: r.canton });
            }
        });
        cantons.sort((a, b) => a.name.localeCompare(b.name, 'de-CH'));
        cantonSelect.innerHTML = '<option value="">All cantons</option>' +
            cantons.map(c => `<option value="${c.code}">${c.name} (${c.code})</option>`).join('');
        rebuildCitySelect();
    }

    function rebuildCitySelect() {
        const code = cantonSelect.value;
        let options = '<option value="">All cities / whole canton</option>';
        if (code) {
            const cities = [...new Set(dataset.records
                .filter(r => r.cantonCode === code && r.city)
                .map(r => r.city))].sort((a, b) => a.localeCompare(b, 'de-CH'));
            options += cities.map(c => `<option value="${c}">${c}</option>`).join('');
        }
        citySelect.innerHTML = options;
        citySelect.disabled = !code;
    }

    function updateSourceBadge() {
        sourceBadge.textContent = `Data: ${dataset.meta.source} — as of ${dataset.meta.asOf}`;
    }

    // --- query -------------------------------------------------------------

    function locationLabel(r) {
        return r.city ? r.city : `${r.canton} (canton)`;
    }

    function runQuery() {
        const code = cantonSelect.value;
        const city = citySelect.value;
        const type = typeSelect.value;

        let rows = dataset.records.filter(r => {
            if (type && r.type !== type) return false;
            if (!code) return r.city === '';           // overview: canton aggregates only
            if (r.cantonCode !== code) return false;
            if (city) return r.city === city;
            return true;                                // whole canton incl. its cities
        });

        // imported files may carry no canton aggregates — fall back to all rows
        if (!code && !rows.length) {
            rows = dataset.records.filter(r => !type || r.type === type);
        }

        // rank locations by price for readable bars/table
        const order = new Map();
        rows.forEach(r => {
            const key = locationLabel(r);
            order.set(key, Math.max(order.get(key) || 0, r.priceM2 || 0));
        });
        rows = rows.slice().sort((a, b) =>
            (order.get(locationLabel(b)) - order.get(locationLabel(a))) ||
            a.type.localeCompare(b.type));

        lastResult = rows;
        render(rows);
    }

    // --- rendering ---------------------------------------------------------

    function render(rows) {
        const has = rows.length > 0;
        resultsSection.classList.toggle('d-none', !has);
        emptyHint.classList.toggle('d-none', has);
        downloadBtn.disabled = !has;
        if (!has) return;
        renderTiles(rows);
        renderTable(rows);
        renderCharts(rows);
    }

    function weightedAvg(rows) {
        let sum = 0, weight = 0;
        rows.forEach(r => {
            const w = r.listings || 1;
            if (r.priceM2 != null) { sum += r.priceM2 * w; weight += w; }
        });
        return weight ? sum / weight : null;
    }

    function renderTiles(rows) {
        const apts = rows.filter(r => r.type === 'apartment');
        const houses = rows.filter(r => r.type === 'house');
        const total = rows.reduce((s, r) => s + (r.listings || 0), 0);
        const aAvg = weightedAvg(apts);
        const hAvg = weightedAvg(houses);
        el('tile-apartment').textContent = aAvg ? fmtInt.format(aAvg) : '–';
        el('tile-house').textContent = hAvg ? fmtInt.format(hAvg) : '–';
        el('tile-count').textContent = total ? fmtInt.format(total) : '–';
    }

    function renderTable(rows) {
        const body = el('results-body');
        body.innerHTML = rows.map(r => `
            <tr>
                <td>${escapeHtml(locationLabel(r))}</td>
                <td>${escapeHtml(r.canton)} (${escapeHtml(r.cantonCode)})</td>
                <td><span class="type-dot" style="background:${SERIES_COLORS[r.type] || '#898781'}"></span>${TYPE_LABELS[r.type] || escapeHtml(r.type)}</td>
                <td class="text-end">${r.priceM2 != null ? fmtInt.format(r.priceM2) : '–'}</td>
                <td class="text-end">${r.listings != null ? fmtInt.format(r.listings) : '–'}</td>
                <td class="text-end">${r.medianPrice != null ? fmtInt.format(r.medianPrice) : '–'}</td>
                <td class="text-end">${r.yoy != null ? fmtPct.format(r.yoy) + '%' : '–'}</td>
            </tr>`).join('');
    }

    function chartFrames(rows, field) {
        const labels = [...new Set(rows.map(locationLabel))];
        const types = [...new Set(rows.map(r => r.type))];
        const datasets = types.map(t => ({
            label: TYPE_LABELS[t] || t,
            data: labels.map(l => {
                const rec = rows.find(r => locationLabel(r) === l && r.type === t);
                return rec ? rec[field] : null;
            }),
            backgroundColor: SERIES_COLORS[t] || '#898781',
            borderRadius: 4,
            borderSkipped: 'start',
            barPercentage: 0.7,
            categoryPercentage: 0.65,
            maxBarThickness: 42
        }));
        return { labels, datasets, seriesCount: types.length };
    }

    function barOptions(showLegend, unit) {
        return {
            indexAxis: 'y',
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: showLegend,
                    position: 'top',
                    align: 'start',
                    labels: { boxWidth: 12, boxHeight: 12, color: '#52514e' }
                },
                tooltip: {
                    callbacks: {
                        label: ctx => ` ${ctx.dataset.label}: ${fmtInt.format(ctx.parsed.x)} ${unit}`
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    grid: { color: '#e1e0d9' },
                    border: { color: '#c3c2b7' },
                    ticks: { color: '#898781', callback: v => fmtInt.format(v) }
                },
                y: {
                    grid: { display: false },
                    border: { color: '#c3c2b7' },
                    ticks: { color: '#52514e', autoSkip: false }
                }
            }
        };
    }

    function renderCharts(rows) {
        const price = chartFrames(rows, 'priceM2');
        const count = chartFrames(rows, 'listings');
        const rowHeight = 16 * price.seriesCount + 18;
        const height = Math.max(220, price.labels.length * rowHeight + 80);
        el('price-chart-wrap').style.height = height + 'px';
        el('count-chart-wrap').style.height = height + 'px';

        if (priceChart) priceChart.destroy();
        if (countChart) countChart.destroy();
        priceChart = new Chart(el('price-chart'), {
            type: 'bar',
            data: { labels: price.labels, datasets: price.datasets },
            options: barOptions(price.seriesCount > 1, 'CHF/m²')
        });
        countChart = new Chart(el('count-chart'), {
            type: 'bar',
            data: { labels: count.labels, datasets: count.datasets },
            options: barOptions(count.seriesCount > 1, 'listings')
        });
    }

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, c =>
            ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    // --- CSV export --------------------------------------------------------

    function csvField(v) {
        if (v == null) return '';
        const s = String(v);
        return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }

    function downloadCsv() {
        const lines = [CSV_HEADER.join(',')];
        lastResult.forEach(r => {
            lines.push([r.cantonCode, r.canton, r.city, r.type,
                r.priceM2, r.listings, r.medianPrice, r.yoy].map(csvField).join(','));
        });
        const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `swiss-property-stats-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
    }

    // --- CSV import --------------------------------------------------------

    function parseCsv(text) {
        const rows = [];
        let row = [], field = '', inQuotes = false;
        text = text.replace(/^\ufeff/, '');
        for (let i = 0; i < text.length; i++) {
            const c = text[i];
            if (inQuotes) {
                if (c === '"') {
                    if (text[i + 1] === '"') { field += '"'; i++; }
                    else inQuotes = false;
                } else field += c;
            } else if (c === '"') {
                inQuotes = true;
            } else if (c === ',') {
                row.push(field); field = '';
            } else if (c === '\n' || c === '\r') {
                if (c === '\r' && text[i + 1] === '\n') i++;
                row.push(field); field = '';
                if (row.some(f => f !== '')) rows.push(row);
                row = [];
            } else field += c;
        }
        row.push(field);
        if (row.some(f => f !== '')) rows.push(row);
        return rows;
    }

    function num(s) {
        if (s == null || s === '') return null;
        const n = Number(String(s).replace(/'/g, ''));
        return Number.isFinite(n) ? n : null;
    }

    function importCsv(file) {
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const rows = parseCsv(String(reader.result));
                if (!rows.length) throw new Error('The file is empty.');
                const header = rows[0].map(h => h.trim().toLowerCase());
                const idx = {};
                CSV_HEADER.forEach(col => { idx[col] = header.indexOf(col); });
                const missing = CSV_HEADER.filter(c =>
                    ['canton_code', 'canton', 'city', 'property_type', 'price_chf_per_m2', 'listings'].includes(c) && idx[c] < 0);
                if (missing.length) {
                    throw new Error(`Missing column(s): ${missing.join(', ')}. Expected header: ${CSV_HEADER.join(',')}`);
                }
                const records = rows.slice(1).map(r => ({
                    cantonCode: (r[idx.canton_code] || '').trim().toUpperCase(),
                    canton: (r[idx.canton] || '').trim(),
                    city: (r[idx.city] || '').trim(),
                    type: (r[idx.property_type] || '').trim().toLowerCase(),
                    priceM2: num(r[idx.price_chf_per_m2]),
                    listings: num(r[idx.listings]),
                    medianPrice: idx.median_price_chf >= 0 ? num(r[idx.median_price_chf]) : null,
                    yoy: idx.yoy_change_pct >= 0 ? num(r[idx.yoy_change_pct]) : null
                })).filter(r => r.cantonCode && r.canton);
                if (!records.length) throw new Error('No valid data rows found in the file.');
                dataset = {
                    meta: { source: `Imported file "${file.name}"`, asOf: new Date(file.lastModified).toISOString().slice(0, 10) },
                    records
                };
                resetBtn.classList.remove('d-none');
                updateSourceBadge();
                rebuildCantonSelect();
                runQuery();
                showImportMessage(`Imported ${records.length} rows from ${file.name}.`, 'success');
            } catch (e) {
                showImportMessage(`Import failed: ${e.message}`, 'danger');
            }
            importInput.value = '';
        };
        reader.readAsText(file);
    }

    function showImportMessage(msg, kind) {
        const box = el('import-message');
        box.className = `alert alert-${kind} py-2 my-2`;
        box.textContent = msg;
        box.classList.remove('d-none');
    }

    function resetToBundled() {
        dataset = bundled;
        resetBtn.classList.add('d-none');
        el('import-message').classList.add('d-none');
        updateSourceBadge();
        rebuildCantonSelect();
        runQuery();
    }

    // --- wiring ------------------------------------------------------------

    cantonSelect.addEventListener('change', rebuildCitySelect);
    queryBtn.addEventListener('click', runQuery);
    downloadBtn.addEventListener('click', downloadCsv);
    importInput.addEventListener('change', () => {
        if (importInput.files.length) importCsv(importInput.files[0]);
    });
    resetBtn.addEventListener('click', resetToBundled);

    updateSourceBadge();
    rebuildCantonSelect();
    runQuery();
})();
