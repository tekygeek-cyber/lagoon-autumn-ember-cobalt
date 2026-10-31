"""Published long-only rules and a close-to-close backtest.

These are public playbooks (Turtle, Connors, Appel, Bollinger, the golden
cross, and academic momentum). They are not anyone's private fund model.
"""

from __future__ import annotations

import zlib
from typing import Any

import numpy as np

CATALOG: list[dict[str, str]] = [
    {
        "id": "turtle",
        "name": "Turtle breakout",
        "source": "Richard Dennis and William Eckhardt, published 1983 rules",
        "summary": "Buy when the close breaks the prior 20-day high. Sell when it breaks the prior 10-day low.",
    },
    {
        "id": "golden",
        "name": "Golden cross",
        "source": "Classic trend followers, 50-day and 200-day averages",
        "summary": "Buy when the 50-day average crosses above the 200-day. Sell on the reverse cross.",
    },
    {
        "id": "connors",
        "name": "Connors RSI-2",
        "source": "Larry Connors, published short-term mean reversion",
        "summary": "Buy when RSI(2) is under 10 and price is above the 200-day average. Sell when RSI(2) is over 70.",
    },
    {
        "id": "bollinger",
        "name": "Bollinger revert",
        "source": "John Bollinger bands, 20 days and 2 standard deviations",
        "summary": "Buy a close under the lower band. Sell when price is back at the middle band.",
    },
    {
        "id": "macd",
        "name": "MACD cross",
        "source": "Gerald Appel, 12 / 26 / 9",
        "summary": "Buy when the MACD line crosses above its signal line. Sell on the reverse cross.",
    },
    {
        "id": "momentum",
        "name": "Six-month momentum",
        "source": "Jegadeesh and Titman momentum, simplified for one stock",
        "summary": "Buy when the six-month return is positive and price is above the 200-day average. Sell when the six-month return turns negative.",
    },
]

_IDS = {item["id"] for item in CATALOG}


def known(strategy_id: str) -> bool:
    return strategy_id in _IDS


def _ema(values: np.ndarray, span: int) -> np.ndarray:
    out = np.full(len(values), np.nan)
    if len(values) < span or span < 1:
        return out
    alpha = 2.0 / (span + 1.0)
    out[span - 1] = float(np.mean(values[:span]))
    for i in range(span, len(values)):
        out[i] = alpha * values[i] + (1.0 - alpha) * out[i - 1]
    return out


def _rsi(closes: np.ndarray, period: int) -> np.ndarray:
    out = np.full(len(closes), np.nan)
    if len(closes) <= period:
        return out
    diff = np.diff(closes, prepend=closes[0])
    gain = np.where(diff > 0, diff, 0.0)
    loss = np.where(diff < 0, -diff, 0.0)
    avg_gain = float(np.mean(gain[1 : period + 1]))
    avg_loss = float(np.mean(loss[1 : period + 1]))
    out[period] = 100.0 if avg_loss == 0 else 100.0 - 100.0 / (1.0 + avg_gain / avg_loss)
    for i in range(period + 1, len(closes)):
        avg_gain = (avg_gain * (period - 1) + gain[i]) / period
        avg_loss = (avg_loss * (period - 1) + loss[i]) / period
        out[i] = 100.0 if avg_loss == 0 else 100.0 - 100.0 / (1.0 + avg_gain / avg_loss)
    return out


def _prior_extreme(values: np.ndarray, window: int, kind: str) -> np.ndarray:
    out = np.full(len(values), np.nan)
    for i in range(window, len(values)):
        chunk = values[i - window : i]
        out[i] = float(np.max(chunk) if kind == "max" else np.min(chunk))
    return out


def _signals(strategy_id: str, closes: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    n = len(closes)
    enter = np.zeros(n, dtype=bool)
    exit_ = np.zeros(n, dtype=bool)
    if strategy_id == "turtle":
        hi = _prior_extreme(closes, 20, "max")
        lo = _prior_extreme(closes, 10, "min")
        enter = closes > hi
        exit_ = closes < lo
    elif strategy_id == "golden":
        fast = _sma_local(closes, 50)
        slow = _sma_local(closes, 200)
        valid = ~np.isnan(fast) & ~np.isnan(slow)
        enter = valid & (fast > slow)
        exit_ = valid & (fast < slow)
    elif strategy_id == "connors":
        strength = _rsi(closes, 2)
        trend = _sma_local(closes, 200)
        enter = (strength < 10) & (closes > trend)
        exit_ = strength > 70
    elif strategy_id == "bollinger":
        mid = _sma_local(closes, 20)
        lower = np.full(n, np.nan)
        for i in range(19, n):
            sigma = float(np.std(closes[i - 19 : i + 1], ddof=0))
            lower[i] = mid[i] - 2.0 * sigma
        enter = closes < lower
        exit_ = closes >= mid
    elif strategy_id == "macd":
        line = _ema(closes, 12) - _ema(closes, 26)
        signal = _ema_skip_nan(line, 9)
        for i in range(1, n):
            if np.isnan(line[i]) or np.isnan(signal[i]) or np.isnan(line[i - 1]) or np.isnan(signal[i - 1]):
                continue
            if line[i - 1] <= signal[i - 1] and line[i] > signal[i]:
                enter[i] = True
            elif line[i - 1] >= signal[i - 1] and line[i] < signal[i]:
                exit_[i] = True
    elif strategy_id == "momentum":
        trend = _sma_local(closes, 200)
        for i in range(126, n):
            base = closes[i - 126]
            if base <= 0 or np.isnan(trend[i]):
                continue
            gain = closes[i] / base - 1.0
            if gain > 0 and closes[i] > trend[i]:
                enter[i] = True
            if gain < 0:
                exit_[i] = True
    else:
        raise ValueError("Unknown strategy")
    enter = np.where(np.isnan(closes), False, enter)
    exit_ = np.where(np.isnan(closes), False, exit_)
    return enter, exit_


def _sma_local(values: np.ndarray, window: int) -> np.ndarray:
    out = np.full(len(values), np.nan)
    if window <= 1 or len(values) < window:
        return out
    csum = np.cumsum(values, dtype=float)
    prev = np.concatenate(([0.0], csum[:-window]))
    out[window - 1 :] = (csum[window - 1 :] - prev) / window
    return out


def _ema_skip_nan(values: np.ndarray, span: int) -> np.ndarray:
    """EMA that starts once `span` finite values exist."""
    out = np.full(len(values), np.nan)
    buf: list[float] = []
    started = False
    prev = 0.0
    alpha = 2.0 / (span + 1.0)
    for i, value in enumerate(values):
        if np.isnan(value):
            continue
        if not started:
            buf.append(float(value))
            if len(buf) == span:
                prev = float(np.mean(buf))
                out[i] = prev
                started = True
            continue
        prev = alpha * float(value) + (1.0 - alpha) * prev
        out[i] = prev
    return out


def backtest(
    strategy_id: str,
    candles: list[dict[str, Any]],
    commission_bps: float = 0.0,
    slippage_bps: float = 0.0,
) -> dict[str, Any]:
    """Run a long-only close-to-close backtest.

    commission_bps: basis points deducted on each trade entry and exit.
    slippage_bps: adverse basis points applied to entry and exit fill prices.
    The defaults keep legacy behavior identical when both are zero.
    """
    if strategy_id not in _IDS:
        raise ValueError("Unknown strategy")
    rows = [c for c in candles if isinstance(c, dict) and c.get("close")]
    rows.sort(key=lambda item: str(item.get("date", "")))
    if len(rows) < 40:
        raise ValueError("Not enough daily history. Need at least 40 closes.")
    closes = np.array([float(c["close"]) for c in rows], dtype=float)
    dates = [str(c["date"]) for c in rows]
    enter, leave = _signals(strategy_id, closes)

    in_pos = False
    entry_price = 0.0
    entry_date = ""
    trades: list[dict[str, Any]] = []
    equity = 1.0
    peak = 1.0
    max_dd = 0.0
    costs_paid = 0.0
    equity_curve = [1.0]

    for i, price in enumerate(closes):
        if price <= 0:
            continue
        if in_pos and leave[i]:
            entry_fill = entry_price * (1.0 + slippage_bps / 10_000.0)
            exit_fill = price * (1.0 - slippage_bps / 10_000.0)
            gross = exit_fill / entry_fill - 1.0
            fee = abs(entry_fill * commission_bps / 10_000.0) + abs(exit_fill * commission_bps / 10_000.0)
            net = gross - fee / entry_fill
            equity *= 1.0 + net
            costs_paid += fee
            trades.append(
                {
                    "entry_date": entry_date,
                    "exit_date": dates[i],
                    "return": round(net, 4),
                }
            )
            in_pos = False
        elif (not in_pos) and enter[i] and not leave[i]:
            in_pos = True
            entry_price = float(price)
            entry_date = dates[i]

        marked = equity * (price / entry_price) if in_pos and entry_price else equity
        peak = max(peak, marked)
        if peak > 0:
            max_dd = min(max_dd, marked / peak - 1.0)
        if commission_bps or slippage_bps:
            equity_curve.append(float(marked))

    marked = equity * (closes[-1] / entry_price) if in_pos and entry_price else equity
    wins = sum(1 for trade in trades if trade["return"] > 0)
    shown = [dict(trade, open=False) for trade in trades[-5:]]
    if in_pos and entry_price:
        open_row = {
            "entry_date": entry_date,
            "exit_date": None,
            "return": round(float(closes[-1] / entry_price - 1.0), 4),
            "open": True,
        }
        shown = (shown[-4:] if len(shown) == 5 else shown) + [open_row]

    result = {
        "strategy": strategy_id,
        "bars": len(rows),
        "from": dates[0],
        "to": dates[-1],
        "trades": len(trades),
        "win_rate": round(wins / len(trades), 4) if trades else None,
        "total_return": round(float(marked - 1.0), 4),
        "max_drawdown": round(float(max_dd), 4),
        "open": in_pos,
        "stance": "LONG" if in_pos else "FLAT",
        "last_close": round(float(closes[-1]), 2),
        "recent_trades": shown,
    }

    if commission_bps or slippage_bps:
        result["equity"] = round(float(marked), 6)
        result["equity_curve"] = [round(float(value), 6) for value in equity_curve]
        result["costs_paid"] = round(float(costs_paid), 6)
        result["commission_bps"] = float(commission_bps)
        result["slippage_bps"] = float(slippage_bps)

    return result


def sample_history(symbol: str) -> list[dict[str, Any]]:
    """Long enough for a 200-day average. Sample mode only."""
    from engine import build_demo_closes

    kind = "bullish" if zlib.adler32(symbol.encode()) % 2 == 0 else "bearish"
    return build_demo_closes(symbol, kind=kind, days_ago=8, strength="strong", n=420)
