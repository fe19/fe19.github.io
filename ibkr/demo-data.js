// Synthetic demo data — shaped exactly like the IBKR Client Portal Web API responses,
// so the page can be explored on GitHub Pages without a running gateway.
// Nothing here is real account data.
const IBKR_DEMO = {
    authStatus: {
        authenticated: true,
        competing: false,
        connected: true,
        message: '',
        MAC: '00:0a:95:9d:68:16',
        serverInfo: { serverName: 'DemoGateway', serverVersion: 'Build 10.30.1a' },
    },

    accounts: [
        { id: 'DU1234567', accountId: 'DU1234567', accountVan: 'DU1234567', accountTitle: 'Demo Paper Account', displayName: 'Demo Paper', currency: 'CHF', type: 'DEMO' },
        { id: 'DU7654321', accountId: 'DU7654321', accountVan: 'DU7654321', accountTitle: 'Demo Margin Account', displayName: 'Demo Margin', currency: 'CHF', type: 'DEMO' },
    ],

    // Keyed by account id — ledger responses are keyed by currency, with a BASE roll-up.
    ledgers: {
        DU1234567: {
            BASE: {
                currency: 'BASE', secondkey: 'CHF', exchangerate: 1,
                cashbalance: 48213.44, settledcash: 48213.44, cashbalancefxsegment: 0,
                netliquidationvalue: 187456.09, stockmarketvalue: 138142.65,
                unrealizedpnl: 12874.21, realizedpnl: 3410.55,
                dividends: 214.8, interest: 96.32, funds: 1100, issueroptionsmarketvalue: 0,
                futuremarketvalue: 0, futureoptionmarketvalue: 0, moneyfunds: 0,
                timestamp: 1755960000,
            },
            CHF: {
                currency: 'CHF', exchangerate: 1,
                cashbalance: 21044.1, settledcash: 21044.1,
                netliquidationvalue: 74318.5, stockmarketvalue: 53274.4,
                unrealizedpnl: 2145.9, realizedpnl: 810.25,
                dividends: 60, interest: 41.12, funds: 0,
                timestamp: 1755960000,
            },
            USD: {
                currency: 'USD', exchangerate: 0.7965,
                cashbalance: 29118.7, settledcash: 29118.7,
                netliquidationvalue: 122544.3, stockmarketvalue: 93425.6,
                unrealizedpnl: 12844.5, realizedpnl: 3264.4,
                dividends: 180, interest: 62.4, funds: 1380.9,
                timestamp: 1755960000,
            },
            EUR: {
                currency: 'EUR', exchangerate: 0.9382,
                cashbalance: 5210.35, settledcash: 5210.35,
                netliquidationvalue: 17604.8, stockmarketvalue: 12394.45,
                unrealizedpnl: -724.6, realizedpnl: 120,
                dividends: 0, interest: 0, funds: 0,
                timestamp: 1755960000,
            },
        },
        DU7654321: {
            BASE: {
                currency: 'BASE', secondkey: 'CHF', exchangerate: 1,
                cashbalance: -12400.5, settledcash: -12400.5,
                netliquidationvalue: 64920.75, stockmarketvalue: 77321.25,
                unrealizedpnl: -1840.9, realizedpnl: 640.1,
                dividends: 35.5, interest: -142.6, funds: 0,
                timestamp: 1755960000,
            },
            CHF: {
                currency: 'CHF', exchangerate: 1,
                cashbalance: -12400.5, settledcash: -12400.5,
                netliquidationvalue: 64920.75, stockmarketvalue: 77321.25,
                unrealizedpnl: -1840.9, realizedpnl: 640.1,
                dividends: 35.5, interest: -142.6, funds: 0,
                timestamp: 1755960000,
            },
        },
    },

    summaries: {
        DU1234567: {
            accountready: { amount: 0, currency: null, isNull: false, value: 'true', severity: 0 },
            netliquidation: { amount: 187456.09, currency: 'CHF', isNull: false, value: '', severity: 0 },
            totalcashvalue: { amount: 48213.44, currency: 'CHF', isNull: false, value: '', severity: 0 },
            settledcash: { amount: 48213.44, currency: 'CHF', isNull: false, value: '', severity: 0 },
            availablefunds: { amount: 41880.12, currency: 'CHF', isNull: false, value: '', severity: 0 },
            excessliquidity: { amount: 44210.6, currency: 'CHF', isNull: false, value: '', severity: 0 },
            buyingpower: { amount: 167520.48, currency: 'CHF', isNull: false, value: '', severity: 0 },
            equitywithloanvalue: { amount: 186356.09, currency: 'CHF', isNull: false, value: '', severity: 0 },
            grosspositionvalue: { amount: 138142.65, currency: 'CHF', isNull: false, value: '', severity: 0 },
            initmarginreq: { amount: 44475.97, currency: 'CHF', isNull: false, value: '', severity: 0 },
            maintmarginreq: { amount: 33590.4, currency: 'CHF', isNull: false, value: '', severity: 0 },
        },
        DU7654321: {
            accountready: { amount: 0, currency: null, isNull: false, value: 'true', severity: 0 },
            netliquidation: { amount: 64920.75, currency: 'CHF', isNull: false, value: '', severity: 0 },
            totalcashvalue: { amount: -12400.5, currency: 'CHF', isNull: false, value: '', severity: 0 },
            settledcash: { amount: -12400.5, currency: 'CHF', isNull: false, value: '', severity: 0 },
            availablefunds: { amount: 9840.2, currency: 'CHF', isNull: false, value: '', severity: 0 },
            excessliquidity: { amount: 12760.55, currency: 'CHF', isNull: false, value: '', severity: 0 },
            buyingpower: { amount: 39360.8, currency: 'CHF', isNull: false, value: '', severity: 0 },
            equitywithloanvalue: { amount: 64920.75, currency: 'CHF', isNull: false, value: '', severity: 0 },
            grosspositionvalue: { amount: 77321.25, currency: 'CHF', isNull: false, value: '', severity: 0 },
            initmarginreq: { amount: 55080.55, currency: 'CHF', isNull: false, value: '', severity: 0 },
            maintmarginreq: { amount: 52160.2, currency: 'CHF', isNull: false, value: '', severity: 0 },
        },
    },
};
