#!/usr/bin/env python3
"""CLI for the IBKR top-gainers trading app.

  python main.py trade              run the strategy once (sell old, buy new)
  python main.py trade --dry-run    show what it would do, place no orders
  python main.py report             print performance summary to the terminal
  python main.py dashboard          serve the web dashboard on :5000
  python main.py demo-data          generate sample trades for trying the dashboard
"""

import argparse
import logging
import random
from datetime import datetime, timedelta, timezone

from ibkr_trader import trade_log
from ibkr_trader.config import Config, DATA_DIR
from ibkr_trader.performance import print_report, summary


def cmd_trade(config, args):
    from ibkr_trader import strategy

    strategy.run(config, dry_run=args.dry_run)


def cmd_report(config, args):
    print_report(summary(trade_log.load_trades(config.trades_file)))


def cmd_dashboard(config, args):
    from ibkr_trader.dashboard import create_app, fetch_open_position_prices

    prices = {} if args.no_ib else fetch_open_position_prices(config)
    app = create_app(config, prices)
    app.run(host=args.host, port=args.port, debug=False)


def cmd_demo_data(config, args):
    """Seed a demo trade log so report/dashboard can be tried without trading."""
    random.seed(19)
    path = config.trades_file
    if path.exists() and not args.force:
        raise SystemExit(f"{path} already exists — pass --force to overwrite it.")
    symbols = ["NVDA", "SMCI", "PLTR", "COIN", "MARA", "RIOT", "SOFI", "AFRM", "UPST", "IONQ"]
    trades = []
    day = datetime.now(timezone.utc) - timedelta(days=45)
    while day < datetime.now(timezone.utc) - timedelta(days=1):
        if day.weekday() < 5:  # trading days only
            for symbol in random.sample(symbols, 5):
                buy = round(random.uniform(8, 120), 2)
                quantity = max(1, int(1000 / buy))
                sell = round(buy * random.uniform(0.90, 1.14), 2)
                trades.append(trade_log.Trade(
                    symbol=symbol, quantity=quantity,
                    buy_time=day.replace(hour=15, minute=35).isoformat(timespec="seconds"),
                    buy_price=buy,
                    sell_time=(day + timedelta(days=1)).replace(hour=15, minute=32).isoformat(timespec="seconds"),
                    sell_price=sell, status=trade_log.CLOSED,
                ))
        day += timedelta(days=1)
    for symbol in random.sample(symbols, 5):  # a few still-open positions
        buy = round(random.uniform(8, 120), 2)
        trades.append(trade_log.Trade(
            symbol=symbol, quantity=max(1, int(1000 / buy)),
            buy_time=datetime.now(timezone.utc).replace(hour=15, minute=35).isoformat(timespec="seconds"),
            buy_price=buy,
        ))
    trade_log.save_trades(path, trades)
    print(f"Wrote {len(trades)} demo trades to {path}")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)

    p_trade = sub.add_parser("trade", help="run the top-gainers strategy once")
    p_trade.add_argument("--dry-run", action="store_true", help="scan and plan, but place no orders")
    p_trade.set_defaults(func=cmd_trade)

    p_report = sub.add_parser("report", help="print performance summary")
    p_report.set_defaults(func=cmd_report)

    p_dash = sub.add_parser("dashboard", help="serve the web dashboard")
    p_dash.add_argument("--host", default="127.0.0.1")
    p_dash.add_argument("--port", type=int, default=5000)
    p_dash.add_argument("--no-ib", action="store_true", help="skip fetching live prices from IB")
    p_dash.set_defaults(func=cmd_dashboard)

    p_demo = sub.add_parser("demo-data", help="generate sample trades")
    p_demo.add_argument("--force", action="store_true", help="overwrite an existing trade log")
    p_demo.set_defaults(func=cmd_demo_data)

    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)-7s %(message)s")
    config = Config()
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    args.func(config, args)


if __name__ == "__main__":
    main()
