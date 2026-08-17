"""Flask dashboard: stat tiles, cumulative P&L chart, and trade tables."""

import logging

from flask import Flask, jsonify, render_template

from . import trade_log
from .performance import summary

log = logging.getLogger(__name__)


def fetch_open_position_prices(config) -> dict[str, float]:
    """Best effort: quote open positions via IB so the dashboard can show
    unrealized P&L. Returns {} when IB isn't reachable."""
    symbols = sorted({t.symbol for t in trade_log.open_trades(config.trades_file)})
    if not symbols:
        return {}
    from .broker import Broker

    broker = Broker(config)
    try:
        broker.connect()
        return broker.current_prices(symbols)
    except Exception as exc:
        log.warning("Could not fetch live prices (%s) — showing cost basis only.", exc)
        return {}
    finally:
        broker.disconnect()


def create_app(config, current_prices: dict[str, float] | None = None) -> Flask:
    app = Flask(__name__)
    prices = current_prices or {}

    def stats() -> dict:
        return summary(trade_log.load_trades(config.trades_file), prices)

    @app.route("/")
    def index():
        return render_template("dashboard.html", data=stats(), have_prices=bool(prices))

    @app.route("/api/data")
    def api_data():
        return jsonify(stats())

    return app
