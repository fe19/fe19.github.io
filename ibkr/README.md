# IBKR Saldo — how it connects

`ibkr.html` shows the current balance ("Saldo") of an Interactive Brokers account:
net liquidation value, cash, available funds, buying power, margin requirements and a
per-currency breakdown.

## Why a local gateway is needed

A static page on GitHub Pages cannot talk to IBKR directly:

- **TWS / IB Gateway** expose the classic TWS API over a raw TCP socket (ports 7496/7497).
  Browsers cannot open raw sockets, so this is unreachable from a web page.
- **The hosted Web API** (`api.ibkr.com`) uses OAuth 1.0a with an RSA private key. Shipping
  that key in a static site would hand anyone who opens the page full access to the account.
- **The Flex Web Service** returns XML but sends no CORS headers, so browsers block it, and
  it only serves end-of-day statements — not a live balance.

The supported route for a browser app is IBKR's **Client Portal Gateway**
(`clientportal.gw`): a small Java process the user runs locally. It performs the login,
holds the session, and exposes the Client Portal Web API on `https://localhost:5000`.
The page reads that API. Credentials stay between the user and the gateway — this page
never sees them, and no account data is sent anywhere.

## Setup

### 1. Run the gateway

1. Download the Client Portal Gateway from IBKR (Java 8+ required).
2. Unzip and start it:
   - macOS / Linux: `bin/run.sh root/conf.yaml`
   - Windows: `bin\run.bat root\conf.yaml`
3. Open <https://localhost:5000>, accept the self-signed certificate, and log in with
   your IBKR credentials. Until the certificate is accepted once, the browser silently
   blocks every request the page makes.

### 2. Let the page reach the gateway

The gateway only answers browser requests from origins it trusts. Add this page's origin
to `root/conf.yaml` and restart the gateway:

```yaml
cors:
  origin.allowed:
    - "https://fe19.github.io"
  allowCredentials: true
```

`allowCredentials: true` matters: the gateway identifies the session by cookie, so the
page sends its requests with `credentials: 'include'`, which a wildcard origin (`"*"`)
cannot satisfy.

**Alternative without any CORS setup:** copy `ibkr.html`, `ibkr.css`, `ibkr.js` and
`demo-data.js` into the gateway's `root/` directory and open
`https://localhost:5000/ibkr.html`. Page and API then share an origin and the browser
raises no cross-origin question at all.

If the gateway listens elsewhere, enter its API base URL in the **Gateway API URL** field
(it is remembered in `localStorage`).

### 3. Connect

Press **Connect**. The **Demo** button loads the synthetic dataset in `demo-data.js` so
the page can be explored with no gateway running.

## Endpoints used

| Endpoint | Purpose |
| --- | --- |
| `POST /iserver/auth/status` | Is there an authenticated session? (falls back to `GET` on older builds) |
| `POST /tickle` | Keepalive, sent once a minute — the gateway drops idle sessions after ~5 minutes |
| `GET /portfolio/accounts` | Account list; must be called before any other portfolio route |
| `GET /portfolio/{accountId}/ledger` | Cash, securities, P&L and net liquidation per currency, plus the `BASE` roll-up |
| `GET /portfolio/{accountId}/summary` | Available funds, excess liquidity, buying power, margin requirements |

All calls are read-only; the page never places, modifies or cancels an order. The summary
call is optional — some gateway builds fail on it, and the page still renders the balance
from the ledger alone.

## Known gateway quirks

- **Competing sessions.** An active gateway session logs the same IBKR user out of TWS,
  IB Gateway and the web portal, and vice versa. The page reports this as a competing
  session when the gateway signals it.
- **Session timeout.** Without the keepalive the session expires after a few minutes; the
  page stops polling while the tab is hidden and reloads when it becomes visible again.
- **Key casing.** Summary keys are lowercase on most builds and camelCase on some, so
  lookups are case-insensitive.
- **Delayed values.** Balances follow the gateway's own refresh cycle; they are not
  tick-by-tick.
