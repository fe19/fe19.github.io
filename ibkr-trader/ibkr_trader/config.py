"""App configuration. Every value can be overridden with an environment variable."""

import os
from dataclasses import dataclass, field
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"


def _env(name: str, default, cast=str):
    raw = os.environ.get(name)
    return cast(raw) if raw is not None else default


@dataclass
class Config:
    # Connection — 7497 is the TWS paper-trading port (7496 live,
    # 4002/4001 for IB Gateway paper/live).
    host: str = field(default_factory=lambda: _env("IB_HOST", "127.0.0.1"))
    port: int = field(default_factory=lambda: _env("IB_PORT", 7497, int))
    client_id: int = field(default_factory=lambda: _env("IB_CLIENT_ID", 17, int))
    # 1=live, 3=delayed, 4=delayed-frozen. Delayed works without a paid
    # market-data subscription.
    market_data_type: int = field(default_factory=lambda: _env("IB_MARKET_DATA_TYPE", 3, int))

    # Strategy
    top_n: int = field(default_factory=lambda: _env("TRADER_TOP_N", 5, int))
    budget_per_position: float = field(default_factory=lambda: _env("TRADER_BUDGET", 1000.0, float))
    min_price: float = field(default_factory=lambda: _env("TRADER_MIN_PRICE", 5.0, float))
    min_volume: int = field(default_factory=lambda: _env("TRADER_MIN_VOLUME", 100_000, int))

    # Persistence
    trades_file: Path = field(default_factory=lambda: Path(_env("TRADER_TRADES_FILE", DATA_DIR / "trades.csv")))
