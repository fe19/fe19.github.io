(function () {
    'use strict';

    // Talks to a locally running IBKR Client Portal Gateway (clientportal.gw).
    // The gateway proxies the Client Portal Web API and holds the authenticated
    // session, so every request here is a plain REST call against it.

    const SETTINGS_KEY = 'ibkr.settings.v1';
    const DEFAULT_BASE_URL = 'https://localhost:5000/v1/api';
    const REQUEST_TIMEOUT_MS = 15000;
    const TICKLE_INTERVAL_MS = 60000;   // gateway drops idle sessions after ~5 min

    // Ledger keys rendered in the per-currency table, in display order.
    const LEDGER_COLUMNS = [
        { key: 'cashbalance', label: 'Cash' },
        { key: 'settledcash', label: 'Settled cash' },
        { key: 'stockmarketvalue', label: 'Securities' },
        { key: 'unrealizedpnl', label: 'Unrealized P&L', signed: true },
        { key: 'realizedpnl', label: 'Realized P&L', signed: true },
        { key: 'netliquidationvalue', label: 'Net liquidation' },
    ];

    // Summary keys shown as tiles. The gateway spells them lowercase; some
    // builds use camelCase, so lookups are case-insensitive (see summaryValue).
    const SUMMARY_TILES = [
        { key: 'totalcashvalue', label: 'Total cash', hint: 'Cash across all currencies, in base currency' },
        { key: 'availablefunds', label: 'Available funds', hint: 'Equity with loan value minus initial margin' },
        { key: 'excessliquidity', label: 'Excess liquidity', hint: 'Equity with loan value minus maintenance margin' },
        { key: 'buyingpower', label: 'Buying power', hint: 'Maximum position value that can be bought' },
        { key: 'grosspositionvalue', label: 'Positions', hint: 'Gross value of all open positions' },
        { key: 'maintmarginreq', label: 'Maintenance margin', hint: 'Margin required to keep positions open' },
    ];

    const dom = {
        baseUrl: document.getElementById('base-url'),
        connectBtn: document.getElementById('connect-btn'),
        disconnectBtn: document.getElementById('disconnect-btn'),
        refreshBtn: document.getElementById('refresh-btn'),
        demoBtn: document.getElementById('demo-btn'),
        accountWrap: document.getElementById('account-wrap'),
        account: document.getElementById('account-select'),
        interval: document.getElementById('interval-select'),
        statusBadge: document.getElementById('status-badge'),
        demoBox: document.getElementById('demo-box'),
        errorBox: document.getElementById('error-box'),
        errorText: document.getElementById('error-text'),
        errorHelp: document.getElementById('error-help'),
        gatewayLink: document.getElementById('gateway-link'),
        results: document.getElementById('results'),
        saldoValue: document.getElementById('saldo-value'),
        saldoCurrency: document.getElementById('saldo-currency'),
        saldoAccount: document.getElementById('saldo-account'),
        saldoChange: document.getElementById('saldo-change'),
        updated: document.getElementById('updated'),
        tiles: document.getElementById('tiles'),
        tableBody: document.getElementById('ledger-body'),
        tableHead: document.getElementById('ledger-head'),
        accruals: document.getElementById('accruals'),
    };

    const state = {
        settings: loadSettings(),
        demo: false,
        connected: false,
        accounts: [],
        accountId: null,
        baseCurrency: 'USD',
        refreshTimer: null,
        tickleTimer: null,
        loading: false,
        status: { kind: 'off', text: 'Disconnected' },
    };

    // ---------- settings ----------

    function loadSettings() {
        const defaults = { baseUrl: DEFAULT_BASE_URL, accountId: null, intervalSec: 30 };
        try {
            const raw = localStorage.getItem(SETTINGS_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed === 'object') return Object.assign(defaults, parsed);
            }
        } catch (e) { /* corrupted storage: fall back to defaults */ }
        return defaults;
    }

    function saveSettings() {
        try {
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
        } catch (e) { /* private mode: settings simply do not persist */ }
    }

    // ---------- formatting ----------

    const fmtStamp = new Intl.DateTimeFormat('en', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
    });

    function isNum(v) {
        return typeof v === 'number' && isFinite(v);
    }

    function fmtMoney(amount, currency, opts) {
        if (!isNum(amount)) return '—';
        const options = Object.assign({
            minimumFractionDigits: 2, maximumFractionDigits: 2,
        }, opts || {});
        // 'BASE' is IBKR's roll-up pseudo-currency, not an ISO code.
        if (currency && currency !== 'BASE' && /^[A-Z]{3}$/.test(currency)) {
            try {
                return new Intl.NumberFormat('en', Object.assign({ style: 'currency', currency }, options)).format(amount);
            } catch (e) { /* unknown code: fall through to plain number */ }
        }
        return new Intl.NumberFormat('en', options).format(amount);
    }

    function fmtSigned(amount, currency) {
        if (!isNum(amount)) return '—';
        return (amount > 0 ? '+' : '') + fmtMoney(amount, currency);
    }

    function signClass(amount) {
        if (!isNum(amount) || amount === 0) return '';
        return amount > 0 ? 'ibkr-pos' : 'ibkr-neg';
    }

    // ---------- API ----------

    function apiBase() {
        return (state.settings.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
    }

    function gatewayRoot() {
        try {
            return new URL(apiBase()).origin;
        } catch (e) {
            return 'https://localhost:5000';
        }
    }

    async function api(path, method) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        try {
            const response = await fetch(apiBase() + path, {
                method: method || 'GET',
                // The gateway identifies the session by cookie, so it must ride along.
                credentials: 'include',
                headers: { 'Accept': 'application/json' },
                signal: controller.signal,
            });
            if (!response.ok) {
                const body = await response.text().catch(() => '');
                throw apiError(`${method || 'GET'} ${path} failed (HTTP ${response.status})`, response.status, body);
            }
            const text = await response.text();
            if (!text) return null;
            try {
                return JSON.parse(text);
            } catch (e) {
                throw apiError(`${path} returned a non-JSON response.`, response.status, text);
            }
        } finally {
            clearTimeout(timer);
        }
    }

    function apiError(message, status, body) {
        const err = new Error(message);
        err.status = status;
        err.body = body;
        return err;
    }

    // The gateway answers /iserver/auth/status on POST; older builds also accept GET.
    async function authStatus() {
        try {
            return await api('/iserver/auth/status', 'POST');
        } catch (e) {
            if (e.status === 404 || e.status === 405) return api('/iserver/auth/status', 'GET');
            throw e;
        }
    }

    // ---------- connection ----------

    async function connect() {
        state.demo = false;
        dom.demoBox.classList.add('d-none');
        state.settings.baseUrl = dom.baseUrl.value.trim() || DEFAULT_BASE_URL;
        saveSettings();
        setBusy(true, 'Connecting…');
        try {
            const status = await authStatus();
            if (!status || status.authenticated !== true) {
                setStatus(status && status.connected ? 'warn' : 'off',
                    status && status.competing ? 'Competing session' : 'Not logged in');
                showError('The gateway is reachable but no authenticated session exists.',
                    buildLoginHelp(status));
                stopTimers();
                state.connected = false;
                return;
            }
            state.connected = true;
            hideError();
            setStatus('on', 'Connected');
            await keepAlive();
            await loadAccounts();
            await loadBalances();
            startTimers();
        } catch (e) {
            state.connected = false;
            stopTimers();
            setStatus('off', 'Disconnected');
            showError(describeError(e), buildConnectionHelp(e));
        } finally {
            setBusy(false);
        }
    }

    function disconnect() {
        stopTimers();
        state.connected = false;
        state.demo = false;
        setStatus('off', 'Disconnected');
        dom.results.classList.add('d-none');
        dom.accountWrap.classList.add('d-none');
        dom.demoBox.classList.add('d-none');
        hideError();
        syncButtons();
    }

    async function loadAccounts() {
        // /portfolio/accounts must be called once before any other portfolio route.
        const accounts = await api('/portfolio/accounts');
        state.accounts = Array.isArray(accounts) ? accounts : [];
        if (!state.accounts.length) throw new Error('The gateway returned no portfolio accounts for this login.');
        renderAccountOptions();
    }

    function renderAccountOptions() {
        const previous = state.settings.accountId;
        dom.account.innerHTML = '';
        state.accounts.forEach(acct => {
            const id = acct.accountId || acct.id;
            const option = document.createElement('option');
            option.value = id;
            const title = acct.accountTitle || acct.displayName || acct.accountVan || '';
            option.textContent = title && title !== id ? `${id} — ${title}` : id;
            dom.account.appendChild(option);
        });
        const ids = state.accounts.map(a => a.accountId || a.id);
        state.accountId = ids.indexOf(previous) >= 0 ? previous : ids[0];
        dom.account.value = state.accountId;
        dom.accountWrap.classList.toggle('d-none', state.accounts.length === 0);
        dom.account.disabled = state.accounts.length < 2;
        updateBaseCurrency();
    }

    function updateBaseCurrency() {
        const acct = state.accounts.find(a => (a.accountId || a.id) === state.accountId);
        state.baseCurrency = (acct && acct.currency) || state.baseCurrency || 'USD';
    }

    async function keepAlive() {
        try {
            await api('/tickle', 'POST');
        } catch (e) { /* keepalive is best effort; the next poll surfaces real failures */ }
    }

    // ---------- data ----------

    async function loadBalances() {
        if (!state.accountId || state.loading) return;
        state.loading = true;
        setBusy(true, 'Loading…');
        try {
            const account = encodeURIComponent(state.accountId);
            // The summary is optional — some gateway builds 500 on it while the
            // ledger works fine, and the ledger alone already carries the saldo.
            const [ledger, summary] = await Promise.all([
                api(`/portfolio/${account}/ledger`),
                api(`/portfolio/${account}/summary`).catch(() => null),
            ]);
            hideError();
            render(ledger, summary);
        } catch (e) {
            showError(describeError(e), buildConnectionHelp(e));
            if (e.status === 401 || e.status === 403) {
                state.connected = false;
                stopTimers();
                setStatus('off', 'Session expired');
            }
        } finally {
            state.loading = false;
            setBusy(false);
        }
    }

    function loadDemo() {
        stopTimers();
        state.demo = true;
        state.connected = false;
        state.accounts = IBKR_DEMO.accounts;
        const ids = state.accounts.map(a => a.accountId || a.id);
        if (ids.indexOf(state.accountId) < 0) state.accountId = ids[0];
        renderAccountOptions();
        setStatus('demo', 'Demo data');
        hideError();
        dom.demoBox.classList.remove('d-none');
        render(IBKR_DEMO.ledgers[state.accountId], IBKR_DEMO.summaries[state.accountId]);
        syncButtons();
    }

    // ---------- rendering ----------

    function render(ledger, summary) {
        const rows = ledgerRows(ledger);
        const base = rows.find(r => r.key === 'BASE') || rows[0] || null;
        const baseCurrency = (base && base.secondkey) || state.baseCurrency;

        const netLiquidation = pickNumber(
            base && base.netliquidationvalue,
            summaryValue(summary, 'netliquidation'),
            summaryValue(summary, 'equitywithloanvalue')
        );

        dom.saldoValue.textContent = fmtMoney(netLiquidation, baseCurrency);
        dom.saldoValue.className = 'ibkr-saldo ' + (isNum(netLiquidation) && netLiquidation < 0 ? 'ibkr-neg' : '');
        dom.saldoCurrency.textContent = baseCurrency && baseCurrency !== 'BASE' ? baseCurrency : '';
        dom.saldoAccount.textContent = accountLabel();

        const unrealized = base && base.unrealizedpnl;
        dom.saldoChange.textContent = isNum(unrealized)
            ? `${fmtSigned(unrealized, baseCurrency)} unrealized P&L`
            : '';
        dom.saldoChange.className = 'ibkr-subline ' + signClass(unrealized);

        renderTiles(summary, base, baseCurrency);
        renderLedgerTable(rows, baseCurrency);
        renderAccruals(base, baseCurrency);

        const stamp = base && isNum(base.timestamp) ? new Date(base.timestamp * 1000) : new Date();
        dom.updated.textContent = 'Updated ' + fmtStamp.format(stamp);
        dom.results.classList.remove('d-none');
    }

    function ledgerRows(ledger) {
        if (!ledger || typeof ledger !== 'object') return [];
        return Object.keys(ledger)
            .filter(key => ledger[key] && typeof ledger[key] === 'object')
            .map(key => Object.assign({ key }, ledger[key]))
            .sort((a, b) => {
                if (a.key === 'BASE') return -1;
                if (b.key === 'BASE') return 1;
                return Math.abs(b.netliquidationvalue || 0) - Math.abs(a.netliquidationvalue || 0);
            });
    }

    // Summary values arrive as { amount, currency, value, isNull } and key casing
    // varies between gateway builds, so match keys case-insensitively.
    function summaryValue(summary, key) {
        if (!summary || typeof summary !== 'object') return undefined;
        const match = Object.keys(summary).find(k => k.toLowerCase() === key.toLowerCase());
        if (!match) return undefined;
        const entry = summary[match];
        if (entry === null || entry === undefined) return undefined;
        if (typeof entry === 'number') return entry;
        if (typeof entry === 'object') {
            if (entry.isNull) return undefined;
            if (isNum(entry.amount)) return entry.amount;
            const parsed = parseFloat(entry.value);
            return isFinite(parsed) ? parsed : undefined;
        }
        const parsed = parseFloat(entry);
        return isFinite(parsed) ? parsed : undefined;
    }

    function pickNumber() {
        for (let i = 0; i < arguments.length; i++) {
            if (isNum(arguments[i])) return arguments[i];
        }
        return undefined;
    }

    function renderTiles(summary, base, currency) {
        dom.tiles.innerHTML = '';
        const fallbacks = {
            totalcashvalue: base && base.cashbalance,
            grosspositionvalue: base && base.stockmarketvalue,
        };
        SUMMARY_TILES.forEach(tile => {
            const amount = pickNumber(summaryValue(summary, tile.key), fallbacks[tile.key]);
            if (amount === undefined) return;
            const col = document.createElement('div');
            col.className = 'col-6 col-lg-4 col-xl-2';
            col.innerHTML =
                '<div class="card h-100 shadow-sm ibkr-tile" title="' + escapeHtml(tile.hint) + '">'
                + '<div class="card-body py-3">'
                + '<div class="ibkr-tile-label">' + escapeHtml(tile.label) + '</div>'
                + '<div class="ibkr-tile-value ' + signClass(amount) + '">' + escapeHtml(fmtMoney(amount, currency)) + '</div>'
                + '</div></div>';
            dom.tiles.appendChild(col);
        });
    }

    function renderLedgerTable(rows, baseCurrency) {
        dom.tableHead.innerHTML = '<tr><th scope="col">Currency</th>'
            + LEDGER_COLUMNS.map(c => '<th scope="col" class="text-end">' + escapeHtml(c.label) + '</th>').join('')
            + '<th scope="col" class="text-end">FX rate</th></tr>';

        dom.tableBody.innerHTML = '';
        rows.forEach(row => {
            const isBase = row.key === 'BASE';
            const currency = isBase ? (row.secondkey || baseCurrency) : (row.currency || row.key);
            const tr = document.createElement('tr');
            if (isBase) tr.className = 'ibkr-base-row';

            const label = isBase
                ? '<strong>Total</strong> <span class="text-muted">(' + escapeHtml(currency || 'base') + ')</span>'
                : '<strong>' + escapeHtml(currency) + '</strong>';
            let html = '<th scope="row" class="fw-normal">' + label + '</th>';

            LEDGER_COLUMNS.forEach(col => {
                const value = row[col.key];
                const text = col.signed ? fmtSigned(value, currency) : fmtMoney(value, currency);
                const cls = col.signed ? signClass(value) : (isNum(value) && value < 0 ? 'ibkr-neg' : '');
                html += '<td class="text-end ' + cls + '">' + escapeHtml(text) + '</td>';
            });

            const rate = row.exchangerate;
            html += '<td class="text-end text-muted">'
                + (isBase || !isNum(rate) ? '—' : escapeHtml(new Intl.NumberFormat('en', { maximumFractionDigits: 5 }).format(rate)))
                + '</td>';

            tr.innerHTML = html;
            dom.tableBody.appendChild(tr);
        });
    }

    function renderAccruals(base, currency) {
        if (!base) { dom.accruals.textContent = ''; return; }
        const parts = [];
        if (isNum(base.dividends) && base.dividends !== 0) parts.push('Accrued dividends ' + fmtMoney(base.dividends, currency));
        if (isNum(base.interest) && base.interest !== 0) parts.push('Accrued interest ' + fmtMoney(base.interest, currency));
        if (isNum(base.funds) && base.funds !== 0) parts.push('Funds ' + fmtMoney(base.funds, currency));
        dom.accruals.textContent = parts.join(' · ');
    }

    function accountLabel() {
        const acct = state.accounts.find(a => (a.accountId || a.id) === state.accountId);
        if (!acct) return state.accountId || '';
        const title = acct.accountTitle || acct.displayName;
        return title && title !== state.accountId ? `${state.accountId} · ${title}` : state.accountId;
    }

    function escapeHtml(value) {
        return String(value === undefined || value === null ? '' : value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    // ---------- status, errors, timers ----------

    const STATUS_CLASSES = { on: 'text-bg-success', warn: 'text-bg-warning', off: 'text-bg-secondary', demo: 'text-bg-info' };

    function setStatus(kind, text) {
        state.status = { kind, text };
        paintStatus(kind, text);
        syncButtons();
    }

    function paintStatus(kind, text) {
        dom.statusBadge.className = 'badge ' + (STATUS_CLASSES[kind] || STATUS_CLASSES.off);
        dom.statusBadge.textContent = text;
    }

    // Busy shows a transient badge; when it clears, the real status comes back.
    function setBusy(busy, text) {
        dom.connectBtn.disabled = busy;
        dom.refreshBtn.disabled = busy || !(state.connected || state.demo);
        if (busy) paintStatus('off', text || 'Loading\u2026');
        else paintStatus(state.status.kind, state.status.text);
    }

    function syncButtons() {
        dom.disconnectBtn.classList.toggle('d-none', !state.connected && !state.demo);
        dom.refreshBtn.disabled = !(state.connected || state.demo);
    }

    function describeError(e) {
        if (e && e.name === 'AbortError') {
            return 'The gateway did not answer within ' + (REQUEST_TIMEOUT_MS / 1000) + ' seconds.';
        }
        if (e instanceof TypeError) {
            // Browsers hide the cause of network-level failures; all three are likely.
            return 'Could not reach ' + apiBase() + ' — the gateway is not running, its '
                + 'certificate is not trusted yet, or it is refusing this origin (CORS).';
        }
        if (e && e.status === 401) return 'The gateway rejected the request (HTTP 401) — the session is no longer authenticated.';
        if (e && e.status === 403) return 'The gateway refused the request (HTTP 403) — check the "ips.allow" list in conf.yaml.';
        return (e && e.message) || 'Unknown error.';
    }

    function buildConnectionHelp(e) {
        const root = gatewayRoot();
        if (e && (e.status === 401 || e.status === 403)) return buildLoginHelp(null);
        return [
            'Start the gateway: <code>bin/run.sh root/conf.yaml</code> (Windows: <code>bin\\run.bat root\\conf.yaml</code>).',
            'Open <a href="' + escapeHtml(root) + '" target="_blank" rel="noopener">' + escapeHtml(root) + '</a> once and accept the self-signed certificate.',
            'Log in there with your IBKR credentials, then press Connect again.',
            'Allow this page in <code>root/conf.yaml</code> — see the setup notes below.',
        ];
    }

    function buildLoginHelp(status) {
        const root = gatewayRoot();
        const help = [
            'Log in at <a href="' + escapeHtml(root) + '" target="_blank" rel="noopener">' + escapeHtml(root) + '</a>, then press Connect again.',
        ];
        if (status && status.competing) {
            help.push('A competing session is active — the same IBKR user is logged in elsewhere (TWS, IB Gateway or the web portal). Close it and log in again.');
        }
        return help;
    }

    function showError(message, help) {
        dom.errorText.textContent = message;
        dom.errorHelp.innerHTML = (help || []).map(item => '<li>' + item + '</li>').join('');
        dom.gatewayLink.href = gatewayRoot();
        dom.errorBox.classList.remove('d-none');
    }

    function hideError() {
        dom.errorBox.classList.add('d-none');
    }

    function startTimers() {
        stopTimers();
        state.tickleTimer = setInterval(keepAlive, TICKLE_INTERVAL_MS);
        const seconds = Number(state.settings.intervalSec);
        if (seconds > 0) state.refreshTimer = setInterval(loadBalances, seconds * 1000);
    }

    function stopTimers() {
        if (state.refreshTimer) clearInterval(state.refreshTimer);
        if (state.tickleTimer) clearInterval(state.tickleTimer);
        state.refreshTimer = null;
        state.tickleTimer = null;
    }

    // ---------- wiring ----------

    dom.baseUrl.value = state.settings.baseUrl;
    dom.interval.value = String(state.settings.intervalSec);
    setStatus('off', 'Disconnected');

    dom.connectBtn.addEventListener('click', connect);
    dom.disconnectBtn.addEventListener('click', disconnect);
    dom.demoBtn.addEventListener('click', loadDemo);
    dom.refreshBtn.addEventListener('click', () => (state.demo ? loadDemo() : loadBalances()));

    dom.baseUrl.addEventListener('keydown', event => {
        if (event.key === 'Enter') connect();
    });

    dom.baseUrl.addEventListener('change', () => {
        state.settings.baseUrl = dom.baseUrl.value.trim() || DEFAULT_BASE_URL;
        saveSettings();
    });

    dom.account.addEventListener('change', () => {
        state.accountId = dom.account.value;
        state.settings.accountId = state.accountId;
        saveSettings();
        updateBaseCurrency();
        if (state.demo) loadDemo(); else if (state.connected) loadBalances();
    });

    dom.interval.addEventListener('change', () => {
        state.settings.intervalSec = Number(dom.interval.value);
        saveSettings();
        if (state.connected) startTimers();
    });

    // Stop polling while the tab is hidden so the gateway session is not
    // refreshed needlessly, and catch up as soon as it comes back.
    document.addEventListener('visibilitychange', () => {
        if (!state.connected) return;
        if (document.hidden) stopTimers();
        else { startTimers(); loadBalances(); }
    });

    window.addEventListener('beforeunload', stopTimers);
})();
