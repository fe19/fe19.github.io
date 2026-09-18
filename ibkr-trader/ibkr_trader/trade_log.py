"""CSV-backed trade log. One row per position: open rows have no sell data yet."""

import csv
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from pathlib import Path

FIELDS = ["symbol", "quantity", "buy_time", "buy_price", "sell_time", "sell_price", "status"]

OPEN = "open"
CLOSED = "closed"


@dataclass
class Trade:
    symbol: str
    quantity: int
    buy_time: str
    buy_price: float
    sell_time: str = ""
    sell_price: float = 0.0
    status: str = OPEN

    @property
    def cost(self) -> float:
        return self.quantity * self.buy_price

    @property
    def proceeds(self) -> float:
        return self.quantity * self.sell_price

    @property
    def realized_pnl(self) -> float:
        return self.proceeds - self.cost if self.status == CLOSED else 0.0


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def load_trades(path: Path) -> list[Trade]:
    if not path.exists():
        return []
    with path.open(newline="") as f:
        return [
            Trade(
                symbol=row["symbol"],
                quantity=int(row["quantity"]),
                buy_time=row["buy_time"],
                buy_price=float(row["buy_price"]),
                sell_time=row["sell_time"],
                sell_price=float(row["sell_price"] or 0),
                status=row["status"],
            )
            for row in csv.DictReader(f)
        ]


def save_trades(path: Path, trades: list[Trade]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(asdict(t) for t in trades)


def record_buy(path: Path, symbol: str, quantity: int, price: float) -> Trade:
    trades = load_trades(path)
    trade = Trade(symbol=symbol, quantity=quantity, buy_time=now_iso(), buy_price=price)
    trades.append(trade)
    save_trades(path, trades)
    return trade


def record_sell(path: Path, symbol: str, price: float) -> Trade | None:
    """Close the oldest open trade for `symbol`. Returns the closed trade."""
    trades = load_trades(path)
    for trade in trades:
        if trade.symbol == symbol and trade.status == OPEN:
            trade.sell_time = now_iso()
            trade.sell_price = price
            trade.status = CLOSED
            save_trades(path, trades)
            return trade
    return None


def open_trades(path: Path) -> list[Trade]:
    return [t for t in load_trades(path) if t.status == OPEN]
