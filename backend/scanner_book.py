"""High-volume breakout and retest rules, plus sample candles.

The same rules are implemented in src/lib/breakout.ts. Keep the two in step.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

IST = ZoneInfo("Asia/Kolkata")

VOLUME_LOOKBACK = 20
VOLUME_MULTIPLE = 3
PRICE_LOOKBACK = 20
MAX_AGE = 20
MIDPOINT_TOLERANCE = 1.0


def normalize_candles(raw: list[Any]) -> list[dict[str, float | str]]:
    parsed: list[dict[str, float | str]] = []
    for row in raw:
        if isinstance(row, dict):
            raw_t = row.get("date") or row.get("timestamp") or row.get("time")
            try:
                candle = {
                    "date": _date_text(raw_t),
                    "open": float(row["open"]),
                    "high": float(row["high"]),
                    "low": float(row["low"]),
                    "close": float(row["close"]),
                    "volume": float(row.get("volume") or 0),
                }
            except (KeyError, TypeError, ValueError):
                continue
        elif isinstance(row, (list, tuple)) and len(row) >= 5:
            try:
                candle = {
                    "date": _date_text(row[0]),
                    "open": float(row[1]),
                    "high": float(row[2]),
                    "low": float(row[3]),
                    "close": float(row[4]),
                    "volume": float(row[5]) if len(row) > 5 and row[5] is not None else 0.0,
                }
            except (TypeError, ValueError):
                continue
        else:
            continue
        parsed.append(candle)
    parsed.sort(key=lambda item: str(item["date"]))
    dedup: dict[str, dict[str, float | str]] = {}
    for item in parsed:
        dedup[str(item["date"])] = item
    return [dedup[key] for key in sorted(dedup)]


def _date_text(value: Any) -> str:
    if isinstance(value, (int, float)) or (isinstance(value, str) and str(value).strip().isdigit()):
        n = float(value)
        if n > 10_000_000_000:
            n = n / 1000.0
        return datetime.fromtimestamp(n, tz=IST).date().isoformat()
    text = str(value).strip().replace("T", " ")[:10]
    datetime.strptime(text, "%Y-%m-%d")
    return text


def scan_stock(raw: list[Any]) -> dict[str, Any] | None:
    candles = normalize_candles(raw)
    count = len(candles)
    if count < 25:
        return None
    latest = count - 1
    earliest = max(PRICE_LOOKBACK, latest - MAX_AGE)
    for index in range(count - 2, earliest - 1, -1):
        window = candles[index - PRICE_LOOKBACK : index]
        if len(window) < PRICE_LOOKBACK:
            continue
        average = sum(float(item["volume"]) for item in window) / PRICE_LOOKBACK
        previous_high = max(float(item["high"]) for item in window)
        candle = candles[index]
        if not average:
            continue
        if float(candle["close"]) <= float(candle["open"]):
            continue
        if float(candle["volume"]) < VOLUME_MULTIPLE * average:
            continue
        if float(candle["close"]) <= previous_high:
            continue
        after = candles[index + 1 :]
        if not after:
            continue
        max_after = max(float(item["high"]) for item in after)
        if max_after <= float(candle["high"]):
            continue
        midpoint = (float(candle["high"]) + float(candle["low"])) / 2
        if midpoint == 0:
            continue
        current = float(candles[latest]["close"])
        distance = ((current - midpoint) / midpoint) * 100
        age = latest - index
        if abs(distance) > MIDPOINT_TOLERANCE or age > MAX_AGE:
            continue
        close = float(candle["close"])
        return {
            "breakoutDate": candle["date"],
            "bIndex": index,
            "daysSince": age,
            "breakoutLow": round(float(candle["low"]), 4),
            "breakoutHigh": round(float(candle["high"]), 4),
            "midpoint": round(midpoint, 4),
            "distanceFromMidpoint": round(distance, 4),
            "volMultiple": round(float(candle["volume"]) / average, 4),
            "prevHigh": round(previous_high, 4),
            "maxPriceAfter": round(max_after, 4),
            "returnFromCloseToSubHigh": round(((max_after - close) / close) * 100, 4) if close else 0,
            "retracementHigh": round(((current - max_after) / max_after) * 100, 4) if max_after else 0,
            "currentPrice": round(current, 4),
        }
    return None


def _dates(count: int) -> list[str]:
    day = datetime.now(IST).date()
    found: list[str] = []
    while len(found) < count:
        if day.weekday() < 5:
            found.append(day.isoformat())
        day -= timedelta(days=1)
    return list(reversed(found))


def _bar(day: str, open_: float, high: float, low: float, close: float, volume: float) -> dict[str, float | str]:
    return {"date": day, "open": open_, "high": high, "low": low, "close": close, "volume": volume}


def make_setup(age: int, distance_pct: float, count: int = 50) -> list[dict[str, float | str]]:
    dates = _dates(count)
    breakout = count - 1 - age
    rows: list[dict[str, float | str]] = []
    for index, day in enumerate(dates):
        if index < breakout:
            rows.append(_bar(day, 100, 101, 99, 100.2, 1000))
        elif index == breakout:
            rows.append(_bar(day, 101, 112, 106, 110, 5000))
        else:
            high = 118 if index == breakout + 1 else 114
            rows.append(_bar(day, 111, high, 108, 111, 800))
    last = round(109 * (1 + distance_pct / 100), 2)
    rows[-1]["close"] = last
    rows[-1]["high"] = max(float(rows[-1]["high"]), last)
    rows[-1]["low"] = min(float(rows[-1]["low"]), last)
    return rows


def make_quiet(count: int = 50) -> list[dict[str, float | str]]:
    return [_bar(day, 100, 101, 99, 100.2, 1000) for day in _dates(count)]


def make_no_follow(count: int = 50) -> list[dict[str, float | str]]:
    dates = _dates(count)
    breakout = count - 6
    rows = []
    for index, day in enumerate(dates):
        if index == breakout:
            rows.append(_bar(day, 101, 112, 106, 110, 5000))
        else:
            rows.append(_bar(day, 100, 111, 99, 100.2, 1000))
    rows[-1]["close"] = 109
    return rows


def sample_plans() -> list[tuple[str, str]]:
    return [
        ("setup", "2:0.20"),
        ("setup", "5:-0.40"),
        ("setup", "9:0.80"),
        ("setup", "14:0.00"),
        ("quiet", ""),
        ("quiet", ""),
        ("nofollow", ""),
        ("far", "5.00"),
    ]


def candles_for_plan(kind: str, arg: str) -> list[dict[str, float | str]]:
    if kind == "setup":
        age_text, distance_text = arg.split(":")
        return make_setup(int(age_text), float(distance_text))
    if kind == "nofollow":
        return make_no_follow()
    if kind == "far":
        return make_setup(4, float(arg or "5"))
    return make_quiet()
