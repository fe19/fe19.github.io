"""Daily rotation strategy: sell yesterday's positions, buy today's top gainers.

Run once per trading day while the market is open (market orders don't fill
outside regular trading hours).
"""

import logging
import math

from . import trade_log
from .broker import Broker

log = logging.getLogger(__name__)


def run(config, dry_run: bool = False) -> None:
    broker = Broker(config)
    broker.connect()
    try:
        _sell_open_positions(broker, config, dry_run)
        _buy_top_gainers(broker, config, dry_run)
    finally:
        broker.disconnect()


def _sell_open_positions(broker: Broker, config, dry_run: bool) -> None:
    positions = trade_log.open_trades(config.trades_file)
    if not positions:
        log.info("No open positions to sell.")
        return
    for position in positions:
        contract = broker.qualify(position.symbol)
        if contract is None:
            log.warning("Could not qualify %s — skipping sell.", position.symbol)
            continue
        if dry_run:
            price = broker.market_price(contract)
            log.info("[dry-run] Would SELL %s x%s (~%s)", position.symbol, position.quantity, price)
            continue
        fill = broker.sell_market(contract, position.quantity)
        if fill is None:
            log.warning("Sell of %s not filled — position stays open.", position.symbol)
            continue
        closed = trade_log.record_sell(config.trades_file, position.symbol, fill)
        log.info("SOLD %s x%s @ %.2f (P&L %.2f)", position.symbol, position.quantity, fill,
                 closed.realized_pnl if closed else float("nan"))


def _buy_top_gainers(broker: Broker, config, dry_run: bool) -> None:
    already_open = {t.symbol for t in trade_log.open_trades(config.trades_file)}
    symbols = broker.top_gainers(config.top_n)
    if not symbols:
        log.warning("Scanner returned no symbols — nothing bought.")
        return
    for symbol in symbols:
        if symbol in already_open:
            log.info("Already holding %s — skipping.", symbol)
            continue
        contract = broker.qualify(symbol)
        if contract is None:
            log.warning("Could not qualify %s — skipping buy.", symbol)
            continue
        price = broker.market_price(contract)
        if price is None:
            log.warning("No price for %s — skipping buy.", symbol)
            continue
        quantity = math.floor(config.budget_per_position / price)
        if quantity < 1:
            log.warning("%s at %.2f exceeds budget %.2f — skipping.", symbol, price, config.budget_per_position)
            continue
        if dry_run:
            log.info("[dry-run] Would BUY %s x%s @ ~%.2f", symbol, quantity, price)
            continue
        fill = broker.buy_market(contract, quantity)
        if fill is None:
            log.warning("Buy of %s not filled.", symbol)
            continue
        trade_log.record_buy(config.trades_file, symbol, quantity, fill)
        log.info("BOUGHT %s x%s @ %.2f", symbol, quantity, fill)
