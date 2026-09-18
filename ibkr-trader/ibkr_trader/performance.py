"""Performance statistics computed from the trade log."""

from .trade_log import Trade, CLOSED, OPEN


def summary(trades: list[Trade], current_prices: dict[str, float] | None = None) -> dict:
    """Aggregate performance: realized/unrealized P&L, return %, win rate,
    equity curve, and per-trade details ready for the dashboard/CLI."""
    current_prices = current_prices or {}
    closed = sorted((t for t in trades if t.status == CLOSED), key=lambda t: t.sell_time)
    opened = [t for t in trades if t.status == OPEN]

    realized_pnl = sum(t.realized_pnl for t in closed)
    closed_cost = sum(t.cost for t in closed)
    realized_pct = (realized_pnl / closed_cost * 100) if closed_cost else 0.0
    wins = sum(1 for t in closed if t.realized_pnl > 0)
    win_rate = (wins / len(closed) * 100) if closed else 0.0

    open_cost = sum(t.cost for t in opened)
    unrealized_pnl = None
    if opened and all(t.symbol in current_prices for t in opened):
        unrealized_pnl = sum((current_prices[t.symbol] - t.buy_price) * t.quantity for t in opened)

    # Cumulative realized P&L after each closed trade, in close order.
    equity_curve = []
    cumulative = 0.0
    for t in closed:
        cumulative += t.realized_pnl
        equity_curve.append({"time": t.sell_time, "symbol": t.symbol, "pnl": round(cumulative, 2)})

    def trade_row(t: Trade) -> dict:
        row = {
            "symbol": t.symbol,
            "quantity": t.quantity,
            "buy_time": t.buy_time,
            "buy_price": t.buy_price,
            "sell_time": t.sell_time,
            "sell_price": t.sell_price,
            "status": t.status,
            "cost": round(t.cost, 2),
            "pnl": round(t.realized_pnl, 2) if t.status == CLOSED else None,
            "pnl_pct": round(t.realized_pnl / t.cost * 100, 2) if t.status == CLOSED and t.cost else None,
        }
        price = current_prices.get(t.symbol)
        if t.status == OPEN and price is not None:
            row["current_price"] = price
            row["pnl"] = round((price - t.buy_price) * t.quantity, 2)
            row["pnl_pct"] = round((price - t.buy_price) / t.buy_price * 100, 2) if t.buy_price else None
        return row

    return {
        "realized_pnl": round(realized_pnl, 2),
        "realized_pct": round(realized_pct, 2),
        "win_rate": round(win_rate, 1),
        "wins": wins,
        "closed_count": len(closed),
        "open_count": len(opened),
        "open_cost": round(open_cost, 2),
        "unrealized_pnl": round(unrealized_pnl, 2) if unrealized_pnl is not None else None,
        "equity_curve": equity_curve,
        "trades": [trade_row(t) for t in sorted(trades, key=lambda t: t.buy_time, reverse=True)],
    }


def print_report(stats: dict) -> None:
    print("=" * 52)
    print("  Top Gainers Strategy — Performance")
    print("=" * 52)
    print(f"  Total realized gain : ${stats['realized_pnl']:>10,.2f}")
    print(f"  Realized return     : {stats['realized_pct']:>10.2f} %")
    print(f"  Win rate            : {stats['win_rate']:>10.1f} %  ({stats['wins']}/{stats['closed_count']})")
    print(f"  Closed trades       : {stats['closed_count']:>10}")
    print(f"  Open positions      : {stats['open_count']:>10}  (cost ${stats['open_cost']:,.2f})")
    if stats["unrealized_pnl"] is not None:
        print(f"  Unrealized P&L      : ${stats['unrealized_pnl']:>10,.2f}")
    print("=" * 52)
    if stats["trades"]:
        print(f"  {'Symbol':<8}{'Qty':>5}{'Buy':>10}{'Sell':>10}{'P&L $':>10}{'P&L %':>9}  Status")
        for t in stats["trades"]:
            sell = f"{t['sell_price']:.2f}" if t["status"] == CLOSED else "-"
            pnl = f"{t['pnl']:.2f}" if t["pnl"] is not None else "-"
            pct = f"{t['pnl_pct']:.1f}" if t["pnl_pct"] is not None else "-"
            print(f"  {t['symbol']:<8}{t['quantity']:>5}{t['buy_price']:>10.2f}{sell:>10}{pnl:>10}{pct:>9}  {t['status']}")
