"""Dummy GTT records only. This module never talks to Groww."""

from __future__ import annotations

import json
import threading
import uuid
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

IST = ZoneInfo("Asia/Kolkata")
ROOT = Path(__file__).resolve().parent
STORE = ROOT / "data" / "dummy-gtts.json"
_lock = threading.Lock()

READY = "Ready for buy GTT placement."
CREATED = "Dummy buy GTT created. No order sent to Groww. Stoploss planned after buy execution."
SKIP_GTT = "Skipped: buy GTT already active."
SKIP_DUMMY = "Skipped: dummy buy GTT already active."
SKIP_DAY = "Skipped: day BUY order already exists."
SKIP_QTY = "Skipped: existing position/holding quantity is {qty}."
WAIT_LTP = "Waiting for LTP."
NO_PRICE = "Buy price is not available for this row."
BAD_TICK = "Trigger price should be a multiple of tick size."


def round_to_tick(price: float, tick: float) -> float | None:
    try:
        value = Decimal(str(price))
        step = Decimal(str(tick))
    except Exception:
        return None
    if step <= 0 or value <= 0:
        return None
    steps = (value / step).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    rounded = steps * step
    return float(rounded)


def _blank(symbol: str) -> dict[str, Any]:
    return {
        "symbol": symbol,
        "quantity": 1,
        "buy_price": None,
        "stoploss": None,
        "tick_size": None,
        "last_price": None,
        "account_state": "unknown",
        "position_quantity": 0,
        "active_buy_trigger_id": None,
        "active_stoploss_trigger_id": None,
        "day_buy_order_id": None,
        "day_buy_order_status": None,
        "buy_status": "invalid",
        "buy_trigger_id": None,
        "stoploss_status": None,
        "stoploss_trigger_id": None,
        "message": NO_PRICE,
    }


def load_dummies() -> list[dict[str, Any]]:
    if not STORE.exists():
        return []
    try:
        payload = json.loads(STORE.read_text())
    except (OSError, json.JSONDecodeError):
        return []
    if isinstance(payload, list):
        return [row for row in payload if isinstance(row, dict)]
    return []


def _save_dummies(rows: list[dict[str, Any]]) -> None:
    STORE.parent.mkdir(parents=True, exist_ok=True)
    tmp = STORE.with_suffix(".tmp")
    tmp.write_text(json.dumps(rows))
    tmp.replace(STORE)


def _active_dummies(rows: list[dict[str, Any]], symbol: str) -> list[dict[str, Any]]:
    return [
        row
        for row in rows
        if str(row.get("symbol", "")).upper() == symbol
        and str(row.get("status", "")).upper() == "ACTIVE"
        and str(row.get("transaction_type", "")).upper() == "BUY"
    ]


def _symbol_of(row: dict[str, Any]) -> str:
    for key in ("trading_symbol", "tradingSymbol", "symbol"):
        if row.get(key):
            return str(row[key]).strip().upper()
    return ""


def _qty_of(row: dict[str, Any]) -> float:
    for key in ("quantity", "qty", "net_quantity", "net_qty", "holding_quantity", "netQuantity"):
        if row.get(key) is None or row.get(key) == "":
            continue
        try:
            return float(row[key])
        except (TypeError, ValueError):
            continue
    return 0.0


def evaluate(
    candidate: dict[str, Any],
    snapshot: dict[str, Any],
    dummies: list[dict[str, Any]],
    tick: float,
) -> dict[str, Any]:
    symbol = str(candidate.get("symbol") or "").strip().upper()
    row = _blank(symbol)
    row["tick_size"] = tick
    last = candidate.get("last_price")
    try:
        last_price = float(last) if last is not None and last != "" else None
    except (TypeError, ValueError):
        last_price = None
    row["last_price"] = last_price

    raw_buy = candidate.get("buy_price")
    try:
        buy_raw = float(raw_buy) if raw_buy is not None and raw_buy != "" else None
    except (TypeError, ValueError):
        buy_raw = None
    if buy_raw is None or buy_raw <= 0:
        row["buy_status"] = "invalid"
        row["message"] = NO_PRICE
        return row

    buy = round_to_tick(buy_raw, tick)
    if buy is None:
        row["buy_status"] = "invalid"
        row["message"] = BAD_TICK
        return row
    stop = round_to_tick(buy * 0.95, tick)
    if stop is None:
        row["buy_status"] = "invalid"
        row["message"] = BAD_TICK
        return row
    row["buy_price"] = buy
    row["stoploss"] = stop
    row["stoploss_status"] = "planned_after_buy"

    position_qty = 0.0
    for bucket in ("positions", "holdings"):
        for item in snapshot.get(bucket) or []:
            if isinstance(item, dict) and _symbol_of(item) == symbol:
                position_qty += _qty_of(item)
    row["position_quantity"] = position_qty

    real_gtt = None
    for item in snapshot.get("smart_orders") or []:
        if not isinstance(item, dict) or _symbol_of(item) != symbol:
            continue
        status = str(item.get("status") or item.get("smart_order_status") or "").upper()
        side = str(item.get("transaction_type") or item.get("transactionType") or "BUY").upper()
        if status in {"", "ACTIVE"} and side == "BUY":
            real_gtt = item
            break
    if real_gtt:
        trigger_id = str(real_gtt.get("smart_order_id") or real_gtt.get("id") or "")
        row["account_state"] = "blocked"
        row["buy_status"] = "already_active"
        row["active_buy_trigger_id"] = trigger_id or None
        row["message"] = SKIP_GTT
        return row

    dummy = _active_dummies(dummies, symbol)
    if dummy:
        trigger_id = str(dummy[0].get("id"))
        row["account_state"] = "already_active"
        row["buy_status"] = "already_active"
        row["active_buy_trigger_id"] = trigger_id
        row["buy_trigger_id"] = trigger_id
        row["message"] = SKIP_DUMMY
        return row

    for item in snapshot.get("orders") or []:
        if not isinstance(item, dict) or _symbol_of(item) != symbol:
            continue
        side = str(item.get("transaction_type") or item.get("transactionType") or "").upper()
        status = str(item.get("status") or item.get("order_status") or "").upper()
        exchange = str(item.get("exchange") or "NSE").upper()
        product = str(item.get("product") or item.get("product_type") or "CNC").upper()
        if side == "BUY" and exchange == "NSE" and product == "CNC" and status not in {"CANCELLED", "REJECTED", "CANCELED"}:
            order_id = str(item.get("groww_order_id") or item.get("order_id") or item.get("id") or "")
            row["account_state"] = "blocked"
            row["buy_status"] = "blocked"
            row["day_buy_order_id"] = order_id or None
            row["day_buy_order_status"] = status or None
            row["message"] = SKIP_DAY
            return row

    if position_qty > 0:
        row["account_state"] = "blocked"
        row["buy_status"] = "blocked"
        row["message"] = SKIP_QTY.format(qty=_trim(position_qty))
        return row

    if last_price is None or last_price <= 0:
        row["account_state"] = "waiting"
        row["buy_status"] = "waiting"
        row["message"] = WAIT_LTP
        return row

    row["account_state"] = "clear"
    row["buy_status"] = "ready"
    row["message"] = READY
    return row


def _trim(value: float) -> str:
    if float(value).is_integer():
        return str(int(value))
    return str(value)


def create_dummies(candidates: list[dict[str, Any]], snapshot: dict[str, Any], ticks: dict[str, float]) -> list[dict[str, Any]]:
    """Re-check state and insert dummy buys. Atomic under the store lock."""
    results: list[dict[str, Any]] = []
    with _lock:
        dummies = load_dummies()
        for candidate in candidates:
            symbol = str(candidate.get("symbol") or "").strip().upper()
            tick = float(ticks.get(symbol) or candidate.get("tick_size") or 0.05)
            decision = evaluate(candidate, snapshot, dummies, tick)
            if decision["buy_status"] != "ready":
                results.append(decision)
                continue
            trigger_id = "DUMMY-" + uuid.uuid4().hex[:10].upper()
            record = {
                "id": trigger_id,
                "symbol": symbol,
                "trigger_price": decision["buy_price"],
                "order_price": decision["buy_price"],
                "product": "CNC",
                "exchange": "NSE",
                "transaction_type": "BUY",
                "quantity": 1,
                "order_type": "LIMIT",
                "status": "ACTIVE",
                "created_at": datetime.now(IST).isoformat(),
            }
            dummies.append(record)
            decision["buy_status"] = "created"
            decision["buy_trigger_id"] = trigger_id
            decision["active_buy_trigger_id"] = trigger_id
            decision["account_state"] = "already_active"
            decision["stoploss_status"] = "planned_after_buy"
            decision["stoploss_trigger_id"] = None
            decision["message"] = CREATED
            results.append(decision)
        _save_dummies(dummies)
    return results
