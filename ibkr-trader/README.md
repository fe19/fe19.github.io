# IBKR Top Gainers Trader

A small Python app that trades automatically through Interactive Brokers:
each run it **sells the positions from the previous run** and **buys the top 5
percentage gainers of the day** (equal dollar amounts), found with IB's
`TOP_PERC_GAIN` market scanner. A web dashboard shows total gain, return
percentage, win rate, a cumulative P&L chart, and every trade.

> ⚠️ This is a toy strategy for learning the IB API, configured for **paper
> trading** by default. Chasing yesterday's gainers is not investment advice.

## Prerequisites

1. An Interactive Brokers account with a **paper trading** login.
2. [TWS](https://www.interactivebrokers.com/en/trading/tws.php) or IB Gateway
   running and logged into the paper account.
3. In TWS: *File → Global Configuration → API → Settings* — enable
   **ActiveX and Socket Clients** and note the socket port (paper TWS default
   is **7497**; IB Gateway paper is 4002 — set `IB_PORT` accordingly).

## Setup

```bash
cd ibkr-trader
pip install -r requirements.txt
```

## Usage

```bash
python main.py trade --dry-run   # see what it would buy/sell, no orders placed
python main.py trade             # run the strategy once (market must be open)
python main.py report            # performance summary in the terminal
python main.py dashboard         # web dashboard at http://127.0.0.1:5000
```

Run `trade` once per trading day (e.g. via cron shortly after the US market
opens) — each run closes the previous day's positions and rotates into the
current top gainers.

To try the dashboard without any trading:

```bash
python main.py demo-data         # writes sample trades to data/trades.csv
python main.py dashboard --no-ib
```

## Configuration

Everything is overridable via environment variables (see `ibkr_trader/config.py`):

| Variable | Default | Meaning |
|---|---|---|
| `IB_HOST` | `127.0.0.1` | TWS/Gateway host |
| `IB_PORT` | `7497` | 7497 paper TWS, 7496 live TWS, 4002/4001 Gateway |
| `IB_CLIENT_ID` | `17` | API client id |
| `IB_MARKET_DATA_TYPE` | `3` | 1 = live (needs subscription), 3 = delayed |
| `TRADER_TOP_N` | `5` | how many gainers to buy |
| `TRADER_BUDGET` | `1000` | dollars per position |
| `TRADER_MIN_PRICE` | `5` | scanner: ignore stocks below this price |
| `TRADER_MIN_VOLUME` | `100000` | scanner: ignore illiquid stocks |
| `TRADER_TRADES_FILE` | `data/trades.csv` | trade log location |

## How it works

- `ibkr_trader/broker.py` — connection, scanner, quotes, market orders (`ib_async`)
- `ibkr_trader/strategy.py` — sell yesterday's positions, buy today's top N
- `ibkr_trader/trade_log.py` — every position is a CSV row (open → closed)
- `ibkr_trader/performance.py` — realized P&L, return %, win rate, equity curve
- `ibkr_trader/dashboard.py` + `templates/dashboard.html` — Flask dashboard;
  it also quotes open positions through IB when reachable to show unrealized P&L

Notes:

- Market orders only fill during regular trading hours — run `trade` while the
  US market is open.
- The IB scanner requires market data permissions; with none, delayed data
  (type 3) usually still works on paper accounts.
- The trade log (`data/`) is git-ignored: your trading history stays local.
