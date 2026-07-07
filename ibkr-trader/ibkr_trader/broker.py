"""Thin wrapper around ib_async for connecting, scanning, quoting and ordering."""

import logging
import math

from ib_async import IB, MarketOrder, ScannerSubscription, Stock

log = logging.getLogger(__name__)

FILL_TIMEOUT_S = 60


class Broker:
    def __init__(self, config):
        self.config = config
        self.ib = IB()

    def connect(self) -> None:
        c = self.config
        self.ib.connect(c.host, c.port, clientId=c.client_id, timeout=15)
        self.ib.reqMarketDataType(c.market_data_type)
        log.info("Connected to IB at %s:%s (clientId=%s)", c.host, c.port, c.client_id)

    def disconnect(self) -> None:
        if self.ib.isConnected():
            self.ib.disconnect()

    def top_gainers(self, n: int) -> list[str]:
        """Symbols of today's top percentage gainers among major US stocks."""
        sub = ScannerSubscription(
            instrument="STK",
            locationCode="STK.US.MAJOR",
            scanCode="TOP_PERC_GAIN",
            abovePrice=self.config.min_price,
            aboveVolume=self.config.min_volume,
            numberOfRows=max(n * 2, 10),  # extra rows in case some don't qualify
        )
        scan = self.ib.reqScannerData(sub)
        symbols = []
        for item in scan:
            contract = item.contractDetails.contract
            if contract.secType == "STK" and contract.symbol not in symbols:
                symbols.append(contract.symbol)
        log.info("Scanner returned: %s", ", ".join(symbols) or "nothing")
        return symbols[:n]

    def qualify(self, symbol: str) -> Stock | None:
        contract = Stock(symbol, "SMART", "USD")
        qualified = self.ib.qualifyContracts(contract)
        return qualified[0] if qualified else None

    def market_price(self, contract) -> float | None:
        (ticker,) = self.ib.reqTickers(contract)
        for price in (ticker.marketPrice(), ticker.last, ticker.close):
            if price and not math.isnan(price):
                return price
        return None

    def current_prices(self, symbols: list[str]) -> dict[str, float]:
        prices = {}
        for symbol in symbols:
            contract = self.qualify(symbol)
            if contract:
                price = self.market_price(contract)
                if price is not None:
                    prices[symbol] = price
        return prices

    def _execute(self, contract, order) -> float | None:
        """Place an order, wait for it to fill, return the average fill price."""
        trade = self.ib.placeOrder(contract, order)
        waited = 0.0
        while not trade.isDone() and waited < FILL_TIMEOUT_S:
            self.ib.waitOnUpdate(timeout=2)
            waited += 2
        if trade.orderStatus.status == "Filled":
            return trade.orderStatus.avgFillPrice
        log.warning(
            "Order %s %s x%s not filled (status=%s) — is the market open?",
            order.action, contract.symbol, order.totalQuantity, trade.orderStatus.status,
        )
        return None

    def buy_market(self, contract, quantity: int) -> float | None:
        return self._execute(contract, MarketOrder("BUY", quantity))

    def sell_market(self, contract, quantity: int) -> float | None:
        return self._execute(contract, MarketOrder("SELL", quantity))
