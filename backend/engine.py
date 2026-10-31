"""SMA crossover scan and Monte Carlo labels.

Conflict rule:
When multiple internal signal sources fire on the same bar, resolve by the
highest-priority signal in SIGNAL_PRIORITY. This helper is additive and leaves
latest_crossover()'s single-signal behavior unchanged for backward compatibility.
"""

from __future__ import annotations

import zlib
from datetime import date, datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

import numpy as np

IST = ZoneInfo("Asia/Kolkata")

SIGNAL_PRIORITY = [
    "crossover_up",
    "crossover_down",
    "bullish",
    "bearish",
    "signal_buy",
    "signal_sell",
    "watch",
    "hold",
]

SIGNAL_GUIDE = [
    {
        "signal": "BUY",
        "text": "Bullish crossover, at least 58% of simulated paths finish higher, and the median path is up.",
    },
    {
        "signal": "SELL",
        "text": "Bearish crossover, at most 42% of paths finish higher, and the median path is down.",
    },
    {
        "signal": "WATCH",
        "text": "The crossover is four sessions old or newer, but the simulated edge is still too small to act.",
    },
    {
        "signal": "HOLD",
        "text": "A crossover is on the board, yet the simulation does not support buying or selling.",
    },
]


def resolve_conflict(signals: list[dict[str, Any]] | list[str] | None) -> dict[str, Any] | str | None:
    """Return the highest-priority signal from a list of candidates.

    Each item may provide either a `kind`, `signal`, or `name`. The winner is
    chosen by SIGNAL_PRIORITY, with earlier entries outranking later ones.
    """
    if not signals:
        return None

    lookup = {name: index for index, name in enumerate(SIGNAL_PRIORITY)}

    def normalize(candidate: Any) -> str:
        if isinstance(candidate, dict):
            for key in ("kind", "signal", "name"):
                value = candidate.get(key)
                if value is not None:
                    return str(value).strip().lower()
            return "hold"
        if candidate is None:
            return "hold"
        return str(candidate).strip().lower()

    winner: Any = None
    winner_rank: int | None = None
    for candidate in signals:
        key = normalize(candidate)
        rank = lookup.get(key, lookup.get("hold", len(lookup)))
        if winner_rank is None or rank < winner_rank:
            winner = candidate
            winner_rank = rank
    return winner


def sma(values: np.ndarray, window: int) -> np.ndarray:
    out = np.full(len(values), np.nan)
    if window <= 1 or len(values) < window:
        return out
    csum = np.cumsum(values, dtype=float)
    prev = np.concatenate(([0.0], csum[:-window]))
    out[window - 1 :] = (csum[window - 1 :] - prev) / window
    return out


def parse_candle_date(value: Any) -> date:
    if isinstance(value, (int, float)) or (isinstance(value, str) and value.strip().isdigit()):
        n = float(value)
        if n > 10_000_000_000:
            n = n / 1000.0
        return datetime.fromtimestamp(n, tz=IST).date()
    text = str(value).strip().replace("T", " ")[:19]
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    raise ValueError("unrecognized candle time")


def parse_candles(payload: Any) -> list[dict[str, Any]]:
    """Accept Groww historical payloads (epoch or timestamp rows)."""
    if isinstance(payload, dict):
        rows = payload.get("candles") or payload.get("data") or []
    elif isinstance(payload, list):
        rows = payload
    else:
        rows = []
    parsed: list[dict[str, Any]] = []
    for row in rows:
        if isinstance(row, dict):
            raw_t = row.get("timestamp") or row.get("time") or row.get("date")
            close = row.get("close")
        elif isinstance(row, (list, tuple)) and len(row) >= 5:
            raw_t = row[0]
            close = row[4]
        else:
            continue
        try:
            day = parse_candle_date(raw_t)
            price = float(close)
        except (TypeError, ValueError):
            continue
        if price <= 0:
            continue
        parsed.append({"date": day.isoformat(), "close": price})
    parsed.sort(key=lambda item: item["date"])
    dedup: dict[str, dict[str, Any]] = {}
    for item in parsed:
        dedup[item["date"]] = item
    return [dedup[key] for key in sorted(dedup)]


def latest_crossover(
    candles: list[dict[str, Any]],
    short_window: int,
    long_window: int,
    lookback_days: int,
    today: date | None = None,
) -> dict[str, Any] | None:
    if len(candles) < long_window + 2:
        return None
    closes = np.array([c["close"] for c in candles], dtype=float)
    short = sma(closes, short_window)
    long = sma(closes, long_window)
    found: dict[str, Any] | None = None
    for i in range(1, len(closes)):
        if np.isnan(short[i]) or np.isnan(long[i]) or np.isnan(short[i - 1]) or np.isnan(long[i - 1]):
            continue
        prev = float(short[i - 1] - long[i - 1])
        curr = float(short[i] - long[i])
        kind = None
        if prev <= 0 and curr > 0:
            kind = "bullish"
        elif prev >= 0 and curr < 0:
            kind = "bearish"
        if kind is None:
            continue
        found = {
            "index": i,
            "crossover_type": kind,
            "crossover_date": candles[i]["date"],
            "close": round(float(closes[-1]), 2),
            "sma_short": round(float(short[-1]), 2),
            "sma_long": round(float(long[-1]), 2),
            "bars_since": len(closes) - 1 - i,
        }
    if found is None:
        return None
    anchor = today or datetime.now(IST).date()
    cutoff = anchor - timedelta(days=lookback_days)
    if date.fromisoformat(found["crossover_date"]) < cutoff:
        return None
    return found


def monte_carlo(
    ticker: str,
    candles: list[dict[str, Any]],
    crossover: dict[str, Any],
    paths: int,
    horizon: int,
) -> dict[str, Any]:
    closes = np.array([c["close"] for c in candles], dtype=float)
    returns = np.diff(np.log(closes))
    returns = returns[np.isfinite(returns)]
    if len(returns) < 20:
        return _label(
            ticker,
            crossover,
            p_up=0.5,
            median=0.0,
            p05=0.0,
            p95=0.0,
            paths=paths,
            horizon=horizon,
            forced="HOLD",
            reason="Not enough daily history to simulate.",
        )
    seed = zlib.adler32(f"{ticker}:{paths}:{horizon}:{len(returns)}".encode()) & 0xFFFFFFFF
    rng = np.random.default_rng(seed)
    draws = rng.choice(returns, size=(paths, horizon), replace=True)
    terminal = np.expm1(draws.sum(axis=1))
    p_up = float(np.mean(terminal > 0))
    median = float(np.median(terminal))
    p05 = float(np.percentile(terminal, 5))
    p95 = float(np.percentile(terminal, 95))
    return _label(
        ticker,
        crossover,
        p_up=p_up,
        median=median,
        p05=p05,
        p95=p95,
        paths=paths,
        horizon=horizon,
    )


def _label(
    ticker: str,
    crossover: dict[str, Any],
    *,
    p_up: float,
    median: float,
    p05: float,
    p95: float,
    paths: int,
    horizon: int,
    forced: str | None = None,
    reason: str | None = None,
) -> dict[str, Any]:
    kind = crossover["crossover_type"]
    fresh = int(crossover["bars_since"]) <= 4
    if forced:
        signal = forced
    elif kind == "bullish" and p_up >= 0.58 and median > 0:
        signal = "BUY"
    elif kind == "bearish" and p_up <= 0.42 and median < 0:
        signal = "SELL"
    elif fresh:
        signal = "WATCH"
    else:
        signal = "HOLD"
    if reason is None:
        pct = f"{p_up * 100:.0f}%"
        med = f"{median * 100:+.1f}%"
        if signal == "BUY":
            reason = f"{pct} of paths ended higher (median {med})."
        elif signal == "SELL":
            reason = f"Only {pct} of paths ended higher (median {med})."
        elif signal == "WATCH":
            reason = f"Cross is {crossover['bars_since']} session(s) old and the edge is thin ({pct} up, median {med})."
        else:
            reason = f"No strong edge ({pct} up, median {med})."
    return {
        "ticker": ticker,
        "signal": signal,
        "p_up": round(p_up, 4),
        "median_return": round(median, 4),
        "p05": round(p05, 4),
        "p95": round(p95, 4),
        "paths": paths,
        "horizon_days": horizon,
        "reason": reason,
    }


def build_demo_closes(
    symbol: str,
    *,
    kind: str,
    days_ago: int,
    strength: str,
    n: int = 180,
    short_window: int = 6,
    long_window: int = 30,
) -> list[dict[str, Any]]:
    """Daily series with a real SMA cross. Sample mode only.

    Strong trends keep a steady drift, with a short dip so the latest cross
    lands near `days_ago`. Flat series (mild / chop) produce Watch or Hold.
    Tuned for the default 6/30 windows; other windows still use the real detector.
    """
    del short_window, long_window
    if strength == "strong":
        drift = 0.0045 if kind == "bullish" else -0.0045
        dip = 0.9 if kind == "bullish" else 1.1
    else:
        drift = 0.0
        dip = 0.9 if kind == "bullish" else 1.12
    dip_len = 12
    cross_at = max(dip_len + 2, n - 1 - max(0, days_ago))
    closes = np.empty(n, dtype=float)
    price = 100.0
    for i in range(n):
        price *= float(np.exp(drift))
        closes[i] = price
    closes[cross_at - dip_len : cross_at] *= dip
    scale = 0.65 + (zlib.adler32(symbol.encode()) % 280) / 100.0
    closes *= scale

    days: list[date] = []
    cursor = date.today()
    while len(days) < n:
        if cursor.weekday() < 5:
            days.append(cursor)
        cursor -= timedelta(days=1)
    days.reverse()
    return [
        {"date": day.isoformat(), "close": round(float(level), 2)}
        for day, level in zip(days, closes)
    ]


def rank_rows(rows: list[dict[str, Any]], max_stocks: int) -> list[dict[str, Any]]:
    ordered = sorted(rows, key=lambda row: (row["crossover_date"], row["ticker"]), reverse=True)
    ordered.sort(key=lambda row: row["ticker"])
    ordered.sort(key=lambda row: row["crossover_date"], reverse=True)
    trimmed = ordered[:max_stocks]
    for index, row in enumerate(trimmed, start=1):
        row["rank"] = index
    return trimmed
