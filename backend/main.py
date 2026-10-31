"""Groww Connect desk API.

The access token is written to backend/data/session.json and is never returned
to the browser. Restarting the dev server reuses that file until 6:00 AM IST.
"""

from __future__ import annotations

import io
import json
import math
import os
import re
import threading
import time
import uuid
import asyncio
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

import pandas as pd
import requests
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field

from engine import (
    IST,
    SIGNAL_GUIDE,
    build_demo_closes,
    latest_crossover,
    monte_carlo,
    parse_candles,
    rank_rows,
)
from strategies import CATALOG, backtest, known, sample_history
from gtt_sim import create_dummies, evaluate, load_dummies
from scanner_book import candles_for_plan, normalize_candles, sample_plans

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
CANDLES = DATA / "candles"
SNAPSHOT = ROOT / "nifty100.snapshot.csv"
NIFTY_URL = "https://www.niftyindices.com/IndexConstituent/ind_nifty100list.csv"
INSTRUMENT_URL = "https://growwapi-assets.groww.in/instruments/instrument.csv"
SESSION_PATH = DATA / "session.json"
UA = {"User-Agent": "Mozilla/5.0 GrowwConnectDesk/1.0", "Accept": "text/csv,*/*"}

app = FastAPI(title="Groww Connect", docs_url=None, redoc_url=None)

_jobs: dict[str, dict[str, Any]] = {}
_jobs_lock = threading.Lock()
_limiter_lock = threading.Lock()
_limiter_next = 0.0
_client_lock = threading.Lock()
_client: Any = None
_client_token: str | None = None
_instruments: dict[str, dict[str, str]] | None = None
_instruments_at = 0.0


class ScanBody(BaseModel):
    short_window: int = Field(default=6)
    long_window: int = Field(default=30)
    lookback_days: int = Field(default=90)
    max_stocks: int = Field(default=25)


class SimBody(BaseModel):
    tickers: list[str] = Field(default_factory=list)
    short_window: int = 6
    long_window: int = 30
    lookback_days: int = 90
    paths: int = 1000
    horizon_days: int = 21
    sample: bool = False


def _check_scan(body: ScanBody) -> None:
    if not (2 <= body.short_window < body.long_window <= 300):
        raise HTTPException(status_code=400, detail="Short SMA must be smaller than long SMA. 6 and 30 is a good start.")
    if not (5 <= body.lookback_days <= 1100):
        raise HTTPException(status_code=400, detail="Lookback days should be between 5 and 1100.")
    if not (1 <= body.max_stocks <= 100):
        raise HTTPException(status_code=400, detail="Max stocks should be between 1 and 100.")


def _check_sim(body: SimBody) -> None:
    if not body.tickers:
        raise HTTPException(status_code=400, detail="Select at least one stock.")
    if len(body.tickers) > 100:
        raise HTTPException(status_code=400, detail="Select at most 100 stocks.")
    if not (2 <= body.short_window < body.long_window <= 300):
        raise HTTPException(status_code=400, detail="Short SMA must be smaller than long SMA.")
    if not (100 <= body.paths <= 5000):
        raise HTTPException(status_code=400, detail="Use between 100 and 5000 simulated paths.")
    if not (5 <= body.horizon_days <= 120):
        raise HTTPException(status_code=400, detail="Horizon should be between 5 and 120 trading days.")
    if not (5 <= body.lookback_days <= 1100):
        raise HTTPException(status_code=400, detail="Lookback days should be between 5 and 1100.")


def _safe(exc: Exception) -> str:
    text = str(getattr(exc, "msg", None) or exc)
    text = re.sub(r"[A-Za-z0-9_\-]{16,}\.[A-Za-z0-9_\-]{8,}\.[A-Za-z0-9_\-]{8,}", "[redacted]", text)
    text = re.sub(r"(?i)(bearer\s+)[A-Za-z0-9._\-]+", r"\1[redacted]", text)
    return text[:220] or "Groww request failed."


def next_expiry(now: datetime | None = None) -> datetime:
    """Groww access tokens stop working at 06:00 IST."""
    current = now or datetime.now(IST)
    if current.tzinfo is None:
        current = current.replace(tzinfo=IST)
    six = current.replace(hour=6, minute=0, second=0, microsecond=0)
    if current >= six:
        six += timedelta(days=1)
    return six


def _read_session() -> dict[str, Any] | None:
    if not SESSION_PATH.exists():
        return None
    try:
        payload = json.loads(SESSION_PATH.read_text())
    except (OSError, json.JSONDecodeError):
        return None
    token = payload.get("access_token")
    expires = payload.get("expires_at")
    if not isinstance(token, str) or not token or not isinstance(expires, str):
        return None
    try:
        expiry = datetime.fromisoformat(expires)
    except ValueError:
        return None
    if expiry.tzinfo is None:
        expiry = expiry.replace(tzinfo=IST)
    if datetime.now(IST) >= expiry:
        SESSION_PATH.unlink(missing_ok=True)
        return None
    return payload


def _public_session(payload: dict[str, Any] | None) -> dict[str, Any]:
    if not payload:
        return {"authenticated": False}
    return {
        "authenticated": True,
        "expires_at": payload.get("expires_at"),
        "flow": payload.get("flow"),
    }


def _write_session(token: str, flow: str) -> dict[str, Any]:
    DATA.mkdir(parents=True, exist_ok=True)
    payload = {
        "access_token": token,
        "flow": flow,
        "created_at": datetime.now(IST).isoformat(),
        "expires_at": next_expiry().isoformat(),
    }
    tmp = SESSION_PATH.with_suffix(".tmp")
    tmp.write_text(json.dumps(payload))
    os.chmod(tmp, 0o600)
    tmp.replace(SESSION_PATH)
    os.chmod(SESSION_PATH, 0o600)
    return payload


def _clear_session() -> None:
    global _client, _client_token
    SESSION_PATH.unlink(missing_ok=True)
    with _client_lock:
        _client = None
        _client_token = None


def require_session() -> dict[str, Any]:
    payload = _read_session()
    if not payload:
        raise HTTPException(
            status_code=401,
            detail="Sign in again. There is no saved Groww access token, or it expired at 6:00 AM IST.",
        )
    return payload


def _groww(token: str) -> Any:
    global _client, _client_token
    with _client_lock:
        if _client is not None and _client_token == token:
            return _client
        from growwapi import GrowwAPI

        _client = GrowwAPI(token)
        _client_token = token
        return _client


def _mint(api_key: str, api_secret: str, request_token: str) -> tuple[str, str]:
    from growwapi import GrowwAPI
    from growwapi.groww.exceptions import GrowwAPIException

    secret = api_secret.strip()
    request = request_token.strip().replace(" ", "")
    if secret and request:
        raise HTTPException(
            status_code=400,
            detail="Use either the API secret or a request token, not both. Groww's SDK takes one of them.",
        )
    if not secret and not request:
        raise HTTPException(
            status_code=400,
            detail="Enter the API secret, or put a 6-digit TOTP in Request token.",
        )
    try:
        if request:
            if request.isdigit() and 6 <= len(request) <= 8:
                totp = request
            else:
                import pyotp

                totp = pyotp.TOTP(request).now()
            token = GrowwAPI.get_access_token(api_key=api_key.strip(), totp=totp)
            flow = "totp"
        else:
            token = GrowwAPI.get_access_token(api_key=api_key.strip(), secret=secret)
            flow = "approval"
    except HTTPException:
        raise
    except GrowwAPIException as exc:
        raise HTTPException(status_code=400, detail=_safe(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=_safe(exc) or "Groww refused the login. Check the key, and approve it on Groww if the key needs a daily approval.",
        ) from exc
    if isinstance(token, dict):
        token = token.get("token") or token.get("access_token") or ""
    if not isinstance(token, str) or len(token) < 12:
        raise HTTPException(status_code=502, detail="Groww did not return an access token.")
    return token, flow


def _download(url: str, dest: Path, referer: str | None = None) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    headers = dict(UA)
    if referer:
        headers["Referer"] = referer
    response = requests.get(url, headers=headers, timeout=90)
    response.raise_for_status()
    dest.write_bytes(response.content)


def load_nifty() -> tuple[list[dict[str, str]], str]:
    live = DATA / "nifty100.csv"
    source = "niftyindices"
    try:
        fresh = live.exists() and time.time() - live.stat().st_mtime < 12 * 3600
        if not fresh:
            _download(NIFTY_URL, live, "https://www.niftyindices.com/")
        text = live.read_text(errors="replace")
    except Exception:
        if SNAPSHOT.exists():
            text = SNAPSHOT.read_text(errors="replace")
            source = "snapshot"
        else:
            raise HTTPException(status_code=502, detail="Could not download the Nifty 100 list from Nifty Indices.")
    rows = _parse_nifty(text)
    if len(rows) < 50 and SNAPSHOT.exists() and source != "snapshot":
        rows = _parse_nifty(SNAPSHOT.read_text(errors="replace"))
        source = "snapshot"
    if len(rows) < 50:
        raise HTTPException(status_code=502, detail="The Nifty 100 list did not look like the official constituent file.")
    return rows, source


def _parse_nifty(text: str) -> list[dict[str, str]]:
    lines = text.splitlines()
    header_at = 0
    for index, line in enumerate(lines):
        if "Symbol" in line and "Company" in line:
            header_at = index
            break
    frame = pd.read_csv(io.StringIO("\n".join(lines[header_at:])))
    frame.columns = [str(col).strip() for col in frame.columns]
    symbol_col = next((col for col in frame.columns if col.lower() == "symbol"), None)
    name_col = next((col for col in frame.columns if "company" in col.lower()), None)
    if not symbol_col or not name_col:
        return []
    out: list[dict[str, str]] = []
    seen: set[str] = set()
    for _, row in frame.iterrows():
        symbol = str(row[symbol_col]).strip().upper()
        company = str(row[name_col]).strip()
        if not symbol or symbol == "NAN" or symbol in seen:
            continue
        seen.add(symbol)
        out.append({"symbol": symbol, "company": company})
    return out


def load_instruments() -> dict[str, dict[str, str]]:
    global _instruments, _instruments_at
    if _instruments is not None and time.time() - _instruments_at < 12 * 3600:
        return _instruments
    path = DATA / "instruments.csv"
    fresh = path.exists() and time.time() - path.stat().st_mtime < 12 * 3600
    if not fresh:
        _download(INSTRUMENT_URL, path)
    wanted = {
        "exchange",
        "exchange_token",
        "trading_symbol",
        "groww_symbol",
        "name",
        "instrument_type",
        "segment",
        "series",
        "tick_size",
    }
    frame = pd.read_csv(path, dtype=str, usecols=lambda col: col in wanted, low_memory=False)
    frame = frame.fillna("")
    cash = frame[(frame["exchange"] == "NSE") & (frame["segment"] == "CASH")]
    mapped: dict[str, dict[str, str]] = {}
    for _, row in cash.iterrows():
        symbol = str(row["trading_symbol"]).strip().upper()
        if not symbol:
            continue
        inst_type = str(row.get("instrument_type", "")).upper()
        series = str(row.get("series", "")).upper()
        if inst_type not in {"", "EQ"} and series not in {"EQ", "BE", "BZ"}:
            continue
        current = mapped.get(symbol)
        prefer = series == "EQ" or inst_type == "EQ"
        if current is not None and not prefer:
            continue
        tick = str(row.get("tick_size", "")).strip() or "0.05"
        token = str(row["exchange_token"]).strip()
        groww_symbol = str(row.get("groww_symbol", "")).strip() or f"NSE-{symbol}"
        mapped[symbol] = {
            "exchange_token": token,
            "groww_symbol": groww_symbol,
            "trading_symbol": symbol,
            "name": str(row.get("name", "")).strip(),
            "tick_size": tick,
        }
    _instruments = mapped
    _instruments_at = time.time()
    return mapped


def _limit() -> None:
    global _limiter_next
    with _limiter_lock:
        now = time.monotonic()
        if now < _limiter_next:
            time.sleep(_limiter_next - now)
        _limiter_next = time.monotonic() + 0.18


def _cache_path(bucket: str, symbol: str) -> Path:
    safe = re.sub(r"[^A-Z0-9&\-]", "", symbol.upper())
    return CANDLES / bucket / f"{safe}.json"


def _read_cache(bucket: str, symbol: str, start: str) -> list[dict[str, Any]] | None:
    path = _cache_path(bucket, symbol)
    if not path.exists():
        return None
    try:
        payload = json.loads(path.read_text())
    except (OSError, json.JSONDecodeError):
        return None
    fetched = float(payload.get("fetched_at") or 0)
    if time.time() - fetched > 12 * 3600:
        return None
    if str(payload.get("start", "")) > start:
        return None
    candles = payload.get("candles")
    if not isinstance(candles, list) or len(candles) < 40:
        return None
    return candles


def _write_cache(bucket: str, symbol: str, start: str, candles: list[dict[str, Any]]) -> None:
    path = _cache_path(bucket, symbol)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({"fetched_at": time.time(), "start": start, "candles": candles}))


def _fetch_candles(token: str, instrument: dict[str, str], start: datetime, end: datetime) -> list[dict[str, Any]]:
    _limit()
    client = _groww(token)
    raw = client.get_historical_candles(
        exchange=client.EXCHANGE_NSE,
        segment=client.SEGMENT_CASH,
        groww_symbol=instrument["groww_symbol"],
        start_time=start.strftime("%Y-%m-%d 09:15:00"),
        end_time=end.strftime("%Y-%m-%d 15:30:00"),
        candle_interval=client.CANDLE_INTERVAL_DAY,
    )
    return parse_candles(raw)


def _history_window(long_window: int, lookback_days: int) -> tuple[datetime, datetime, str]:
    end = datetime.now(IST)
    # Extra calendar days so the long average is valid at the start of the lookback.
    span = lookback_days + long_window * 3 + 30
    span = min(span, 1000)
    start = end - timedelta(days=span)
    return start, end, start.date().isoformat()


def _new_job() -> dict[str, Any]:
    job = {
        "id": uuid.uuid4().hex,
        "status": "running",
        "done": 0,
        "total": 0,
        "message": "Starting",
        "results": None,
        "meta": None,
        "error": None,
    }
    with _jobs_lock:
        _jobs[job["id"]] = job
        if len(_jobs) > 12:
            for key in list(_jobs)[:-12]:
                _jobs.pop(key, None)
    return job


def _update(job_id: str, **fields: Any) -> None:
    with _jobs_lock:
        job = _jobs.get(job_id)
        if job:
            job.update(fields)


def _demo_plan(index: int) -> tuple[str, int, str]:
    """Spread crosses so a short ranked list still shows every label."""
    if index < 5:
        return "bullish", index % 3, "strong"
    if index < 10:
        return "bearish", (index - 5) % 3, "strong"
    if index < 15:
        kind = "bullish" if index % 2 == 0 else "bearish"
        return kind, 5 + (index % 3), "mild"
    kind = "bullish" if index % 2 == 0 else "bearish"
    return kind, 14 + (index % 18), "chop"


def _run_demo(job_id: str, body: ScanBody) -> None:
    try:
        constituents, source = load_nifty()
        rows: list[dict[str, Any]] = []
        _update(job_id, total=len(constituents), message="Building sample candles")
        anchor = datetime.now(IST).date()
        for index, item in enumerate(constituents):
            kind, days_ago, strength = _demo_plan(index)
            candles = build_demo_closes(
                item["symbol"],
                kind=kind,
                days_ago=days_ago,
                strength=strength,
                short_window=body.short_window,
                long_window=body.long_window,
            )
            _write_cache("demo", item["symbol"], candles[0]["date"], candles)
            cross = latest_crossover(candles, body.short_window, body.long_window, body.lookback_days, anchor)
            if cross:
                rows.append(
                    {
                        "ticker": item["symbol"],
                        "company": item["company"],
                        "nse_token": f"SAMPLE-{index + 1}",
                        "crossover_type": cross["crossover_type"],
                        "crossover_date": cross["crossover_date"],
                        "close": cross["close"],
                        "sma_short": cross["sma_short"],
                        "sma_long": cross["sma_long"],
                        "bars_since": cross["bars_since"],
                    }
                )
            if index % 10 == 0:
                _update(job_id, done=index + 1, message=item["symbol"])
        ranked = rank_rows(rows, body.max_stocks)
        _update(
            job_id,
            status="done",
            done=len(constituents),
            message="Done",
            results=ranked,
            meta={
                "sample": True,
                "universe": len(constituents),
                "matched": len(constituents),
                "with_crossover": len(rows),
                "shown": len(ranked),
                "unmapped": [],
                "failed": [],
                "source": source,
                "short_window": body.short_window,
                "long_window": body.long_window,
                "lookback_days": body.lookback_days,
            },
        )
    except HTTPException as exc:
        _update(job_id, status="error", error=str(exc.detail))
    except Exception as exc:
        _update(job_id, status="error", error=_safe(exc))


def _run_live(job_id: str, body: ScanBody, token: str) -> None:
    from growwapi.groww.exceptions import GrowwAPIAuthenticationException

    try:
        _update(job_id, message="Loading the Nifty 100 list")
        constituents, source = load_nifty()
        _update(job_id, message="Mapping symbols to NSE tokens")
        instruments = load_instruments()
        start, end, start_key = _history_window(body.long_window, body.lookback_days)
        rows: list[dict[str, Any]] = []
        unmapped: list[str] = []
        failed: list[str] = []
        auth_hits = 0
        total = len(constituents)
        _update(job_id, total=total, done=0)

        def work(item: dict[str, str]) -> tuple[str, Any]:
            inst = instruments.get(item["symbol"])
            if not inst or not inst.get("exchange_token"):
                return "unmapped", item["symbol"]
            try:
                candles = _read_cache("live", item["symbol"], start_key)
                if candles is None:
                    candles = _fetch_candles(token, inst, start, end)
                    if len(candles) >= 40:
                        _write_cache("live", item["symbol"], start_key, candles)
                cross = latest_crossover(
                    candles,
                    body.short_window,
                    body.long_window,
                    body.lookback_days,
                )
                if not cross:
                    return "none", item["symbol"]
                company = item["company"] or inst.get("name") or item["symbol"]
                return "ok", {
                    "ticker": item["symbol"],
                    "company": company,
                    "nse_token": inst["exchange_token"],
                    "crossover_type": cross["crossover_type"],
                    "crossover_date": cross["crossover_date"],
                    "close": cross["close"],
                    "sma_short": cross["sma_short"],
                    "sma_long": cross["sma_long"],
                    "bars_since": cross["bars_since"],
                }
            except GrowwAPIAuthenticationException:
                return "auth", item["symbol"]
            except Exception as exc:
                text = _safe(exc)
                if "401" in text or "expired" in text.lower() or "Authentication" in text:
                    return "auth", item["symbol"]
                return "fail", f"{item['symbol']}: {text}"

        from concurrent.futures import ThreadPoolExecutor, as_completed

        with ThreadPoolExecutor(max_workers=4) as pool:
            futures = [pool.submit(work, item) for item in constituents]
            done = 0
            for future in as_completed(futures):
                kind, payload = future.result()
                done += 1
                if kind == "ok":
                    rows.append(payload)
                elif kind == "unmapped":
                    unmapped.append(payload)
                elif kind == "auth":
                    auth_hits += 1
                    failed.append(payload)
                elif kind == "fail":
                    failed.append(payload)
                _update(job_id, done=done, message=f"Scanning {done} of {total}")
                if auth_hits >= 3:
                    break

        if auth_hits >= 3 and not rows:
            _clear_session()
            _update(
                job_id,
                status="error",
                error="Groww rejected the saved access token. Sign in again. Daily tokens stop at 6:00 AM IST.",
            )
            return
        ranked = rank_rows(rows, body.max_stocks)
        _update(
            job_id,
            status="done",
            done=total,
            message="Done",
            results=ranked,
            meta={
                "sample": False,
                "universe": total,
                "matched": total - len(unmapped),
                "with_crossover": len(rows),
                "shown": len(ranked),
                "unmapped": unmapped[:12],
                "failed": failed[:8],
                "source": source,
                "short_window": body.short_window,
                "long_window": body.long_window,
                "lookback_days": body.lookback_days,
            },
        )
    except HTTPException as exc:
        _update(job_id, status="error", error=str(exc.detail))
    except Exception as exc:
        _update(job_id, status="error", error=_safe(exc))


def present_profile(raw: dict[str, Any], sample: bool = False) -> dict[str, Any]:
    name = raw.get("user_name") or raw.get("name") or raw.get("userName") or raw.get("full_name")
    user_id = raw.get("ucc") or raw.get("user_id") or raw.get("vendor_user_id")
    products = raw.get("products") or raw.get("active_segments") or []
    if isinstance(products, str):
        products = [products]
    exchanges = raw.get("exchanges")
    if not exchanges:
        exchanges = []
        if raw.get("nse_enabled") is True:
            exchanges.append("NSE")
        if raw.get("bse_enabled") is True:
            exchanges.append("BSE")
        if raw.get("mcx_enabled") is True:
            exchanges.append("MCX")
    ddpi = raw.get("ddpi_enabled") if "ddpi_enabled" in raw else None
    return {
        "user_name": name if isinstance(name, str) and name else None,
        "user_id": str(user_id) if user_id else None,
        "products": [str(item) for item in products],
        "exchanges": [str(item) for item in exchanges],
        "ddpi_enabled": None if ddpi is None else bool(ddpi),
        "sample": sample,
    }


@app.get("/api/health")
def health() -> dict[str, bool]:
    return {"ok": True}


@app.get("/api/auth/status")
def auth_status() -> dict[str, Any]:
    return _public_session(_read_session())


@app.post("/api/auth/login")
async def login(body: dict[str, Any]) -> dict[str, Any]:
    api_key = str(body.get("api_key") or "")
    api_secret = str(body.get("api_secret") or "")
    request_token = str(body.get("request_token") or "")
    if not api_key.strip():
        raise HTTPException(status_code=400, detail="API key is required.")
    token, flow = _mint(api_key, api_secret, request_token)
    saved = _write_session(token, flow)
    # Drop any client built with an older token.
    global _client, _client_token
    with _client_lock:
        _client = None
        _client_token = None
    return {"ok": True, "expires_at": saved["expires_at"], "flow": flow}


@app.post("/api/auth/logout")
def logout() -> dict[str, bool]:
    _clear_session()
    return {"ok": True}


@app.get("/api/profile")
def profile() -> dict[str, Any]:
    session = require_session()
    try:
        raw = _groww(session["access_token"]).get_user_profile()
    except Exception as exc:
        text = _safe(exc)
        if "401" in text or "Authentication" in text or "expired" in text.lower():
            _clear_session()
            raise HTTPException(status_code=401, detail="The saved access token was rejected. Sign in again.") from exc
        raise HTTPException(status_code=502, detail=text) from exc
    if not isinstance(raw, dict):
        raise HTTPException(status_code=502, detail="Groww returned an unexpected profile.")
    return present_profile(raw, sample=False)


@app.get("/api/demo/profile")
def demo_profile() -> dict[str, Any]:
    return present_profile(
        {
            "user_name": "Sample session",
            "ucc": "SAMPLE",
            "active_segments": ["CASH", "FNO"],
            "nse_enabled": True,
            "bse_enabled": True,
            "ddpi_enabled": False,
        },
        sample=True,
    )


@app.post("/api/signals/scan")
def scan(body: ScanBody) -> dict[str, str]:
    _check_scan(body)
    session = require_session()
    job = _new_job()
    threading.Thread(target=_run_live, args=(job["id"], body, session["access_token"]), daemon=True).start()
    return {"id": job["id"]}


@app.post("/api/demo/scan")
def demo_scan(body: ScanBody) -> dict[str, str]:
    _check_scan(body)
    job = _new_job()
    threading.Thread(target=_run_demo, args=(job["id"], body), daemon=True).start()
    return {"id": job["id"]}


@app.get("/api/signals/jobs/{job_id}")
def job(job_id: str) -> dict[str, Any]:
    with _jobs_lock:
        found = _jobs.get(job_id)
        if not found:
            raise HTTPException(status_code=404, detail="That scan is no longer on the server. Generate signals again.")
        return json.loads(json.dumps(found))


@app.post("/api/signals/simulate")
def simulate(body: SimBody) -> dict[str, Any]:
    _check_sim(body)
    bucket = "demo" if body.sample else "live"
    if not body.sample:
        require_session()
    results = []
    missing = []
    anchor = datetime.now(IST).date()
    for ticker in body.tickers:
        symbol = ticker.strip().upper()
        candles = _read_cache(bucket, symbol, "0000-01-01")
        # Cache reader rejects files older than 12h and start mismatches.
        # For simulate, accept any cache written by the scan in this process lifetime window.
        if candles is None:
            path = _cache_path(bucket, symbol)
            if path.exists():
                try:
                    payload = json.loads(path.read_text())
                    candles = payload.get("candles")
                except (OSError, json.JSONDecodeError):
                    candles = None
        if not isinstance(candles, list) or len(candles) < 40:
            missing.append(symbol)
            continue
        cross = latest_crossover(candles, body.short_window, body.long_window, body.lookback_days, anchor)
        if not cross:
            missing.append(symbol)
            continue
        results.append(monte_carlo(symbol, candles, cross, body.paths, body.horizon_days))
    if not results:
        raise HTTPException(
            status_code=400,
            detail="Generate signals first so daily candles are on the server, then run the simulation.",
        )
    return {"results": results, "missing": missing, "guide": SIGNAL_GUIDE, "sample": body.sample}


_auto_lock = threading.Lock()
_auto_started = False


def _auto_path(sample: bool) -> Path:
    return DATA / ("automation-demo.json" if sample else "automation.json")


def _default_auto(sample: bool) -> dict[str, Any]:
    return {
        "enabled": False,
        "mode": "paper",
        "live_armed": False,
        "strategy": "turtle",
        "quantity": 1,
        "max_orders": 3,
        "symbols": [],
        "sample": sample,
        "positions": {},
        "log": [],
        "last_cycle": None,
    }


def _load_auto(sample: bool) -> dict[str, Any]:
    path = _auto_path(sample)
    base = _default_auto(sample)
    if not path.exists():
        return base
    try:
        saved = json.loads(path.read_text())
    except (OSError, json.JSONDecodeError):
        return base
    if isinstance(saved, dict):
        base.update({k: saved[k] for k in base if k in saved})
        if isinstance(saved.get("positions"), dict):
            base["positions"] = saved["positions"]
        if isinstance(saved.get("log"), list):
            base["log"] = saved["log"][-40:]
        if isinstance(saved.get("symbols"), list):
            base["symbols"] = [str(item).upper() for item in saved["symbols"] if str(item).strip()][:25]
    base["sample"] = sample
    if base["mode"] != "live":
        base["mode"] = "paper"
        base["live_armed"] = False
    return base


def _save_auto(state: dict[str, Any]) -> None:
    DATA.mkdir(parents=True, exist_ok=True)
    path = _auto_path(bool(state.get("sample")))
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(state))
    tmp.replace(path)


def _public_auto(state: dict[str, Any]) -> dict[str, Any]:
    return {
        "enabled": bool(state.get("enabled")),
        "mode": state.get("mode"),
        "live_armed": bool(state.get("live_armed")),
        "strategy": state.get("strategy"),
        "quantity": state.get("quantity"),
        "max_orders": state.get("max_orders"),
        "symbols": state.get("symbols") or [],
        "sample": bool(state.get("sample")),
        "positions": state.get("positions") or {},
        "log": state.get("log") or [],
        "last_cycle": state.get("last_cycle"),
    }


def _any_candles(bucket: str, symbol: str) -> list[dict[str, Any]] | None:
    path = _cache_path(bucket, symbol)
    if not path.exists():
        return None
    try:
        payload = json.loads(path.read_text())
    except (OSError, json.JSONDecodeError):
        return None
    candles = payload.get("candles")
    if isinstance(candles, list) and len(candles) >= 40:
        return candles
    return None


def _ensure_candles(symbol: str, sample: bool, token: str | None) -> list[dict[str, Any]]:
    bucket = "demo" if sample else "live"
    cached = _any_candles(bucket, symbol)
    if cached is not None:
        return cached
    if sample:
        candles = build_demo_closes(symbol, kind="bullish", days_ago=4, strength="strong")
        _write_cache(bucket, symbol, candles[0]["date"], candles)
        return candles
    if not token:
        raise HTTPException(status_code=400, detail=f"No saved candles for {symbol}. Generate signals first.")
    instruments = load_instruments()
    inst = instruments.get(symbol)
    if not inst:
        raise HTTPException(status_code=400, detail=f"{symbol} is not an NSE cash symbol in the instrument master.")
    start, end, start_key = _history_window(200, 400)
    candles = _fetch_candles(token, inst, start, end)
    if len(candles) < 40:
        raise HTTPException(status_code=502, detail=f"Groww returned too little history for {symbol}.")
    _write_cache(bucket, symbol, start_key, candles)
    return candles


def _symbols_for_cycle(state: dict[str, Any]) -> list[str]:
    chosen = state.get("symbols")
    if isinstance(chosen, list) and chosen:
        return [str(item).upper() for item in chosen][:25]
    bucket = "demo" if state.get("sample") else "live"
    folder = CANDLES / bucket
    found: list[str] = []
    if folder.exists():
        found = sorted(path.stem for path in folder.glob("*.json"))
    if not found and state.get("sample"):
        try:
            names, _source = load_nifty()
            found = [item["symbol"] for item in names[:8]]
        except Exception:
            found = ["RELIANCE", "TCS", "INFY", "HDFCBANK"]
    return found[:25]


def _log_event(state: dict[str, Any], row: dict[str, Any]) -> None:
    state.setdefault("log", []).append(row)
    state["log"] = state["log"][-40:]


def _run_cycle(state: dict[str, Any], token: str | None) -> dict[str, Any]:
    strategy_id = str(state.get("strategy") or "turtle")
    if not known(strategy_id):
        raise HTTPException(status_code=400, detail="Pick a strategy from the list.")
    qty = int(state.get("quantity") or 1)
    cap = int(state.get("max_orders") or 3)
    sample = bool(state.get("sample"))
    live = state.get("mode") == "live" and state.get("live_armed") and not sample
    if state.get("mode") == "live" and not live:
        _log_event(state, {"at": datetime.now(IST).isoformat(), "note": "Live mode is not armed. Cycle skipped."})
        state["last_cycle"] = datetime.now(IST).isoformat()
        return _public_auto(state)
    orders = 0
    for symbol in _symbols_for_cycle(state):
        if orders >= cap:
            break
        try:
            candles = sample_history(symbol) if sample else _ensure_candles(symbol, False, token)
            study = backtest(strategy_id, candles)
        except Exception as exc:
            _log_event(state, {"at": datetime.now(IST).isoformat(), "ticker": symbol, "note": _safe(exc)})
            continue
        positions: dict[str, Any] = state.setdefault("positions", {})
        held = symbol in positions
        want = study["stance"] == "LONG"
        price = study["last_close"]
        if want and not held:
            side = "BUY"
        elif held and not want:
            side = "SELL"
        else:
            continue
        if live:
            note = "Live sending is off. Paper fill only. No order was sent to Groww."
            status = "paper"
        else:
            note = "Paper fill at the last daily close. No order was sent."
            status = "paper"
        if side == "BUY":
            positions[symbol] = {"qty": qty, "entry": price, "entry_date": study["to"]}
        else:
            positions.pop(symbol, None)
        _log_event(
            state,
            {
                "at": datetime.now(IST).isoformat(),
                "ticker": symbol,
                "side": side,
                "qty": qty,
                "price": price,
                "mode": "live" if live else "paper",
                "status": status,
                "note": note,
            },
        )
        orders += 1
    state["last_cycle"] = datetime.now(IST).isoformat()
    if orders == 0:
        _log_event(
            state,
            {
                "at": state["last_cycle"],
                "note": "Cycle finished. No entry or exit was due.",
                "status": "idle",
            },
        )
    return _public_auto(state)


class BacktestBody(BaseModel):
    strategy: str
    ticker: str
    sample: bool = False


class BoardBody(BaseModel):
    strategy: str
    sample: bool = False
    limit: int = 15


class AutoBody(BaseModel):
    enabled: bool = False
    mode: str = "paper"
    strategy: str = "turtle"
    quantity: int = 1
    max_orders: int = 3
    symbols: str = ""
    confirm: str = ""
    sample: bool = False


def _check_auto(body: AutoBody) -> None:
    if not known(body.strategy):
        raise HTTPException(status_code=400, detail="Pick a strategy from the list.")
    if body.mode not in {"paper", "live"}:
        raise HTTPException(status_code=400, detail="Mode is paper or live.")
    if not 1 <= body.quantity <= 10:
        raise HTTPException(status_code=400, detail="Quantity per order is 1 to 10 shares.")
    if not 1 <= body.max_orders <= 5:
        raise HTTPException(status_code=400, detail="A cycle can send at most 5 orders.")
    if body.mode == "live" and body.sample:
        raise HTTPException(status_code=400, detail="Sample data cannot send live orders. Sign in first.")
    if body.mode == "live" and body.enabled and body.confirm.strip() != "ENABLE LIVE":
        raise HTTPException(
            status_code=400,
            detail='Live orders stay off until you type ENABLE LIVE. Paper mode needs no phrase.',
        )


def _parse_symbols(text: str) -> list[str]:
    out: list[str] = []
    for part in re.split(r"[\s,]+", text.upper()):
        if not part or not re.fullmatch(r"[A-Z0-9&.-]{1,20}", part) or part in out:
            continue
        out.append(part)
        if len(out) >= 25:
            break
    return out


@app.get("/api/strategies")
def strategies() -> dict[str, Any]:
    return {"strategies": CATALOG}


@app.post("/api/strategies/board")
def strategy_board(body: BoardBody) -> dict[str, Any]:
    strategy_id = body.strategy.strip().lower()
    if not known(strategy_id):
        raise HTTPException(status_code=400, detail="Pick a strategy from the list.")
    limit = body.limit if 5 <= body.limit <= 25 else 15
    if not body.sample:
        require_session()
    try:
        names, source = load_nifty()
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=_safe(exc)) from exc
    rows: list[dict[str, Any]] = []
    for item in names[:100]:
        symbol = item["symbol"]
        try:
            candles = sample_history(symbol) if body.sample else _any_candles("live", symbol)
            if not candles:
                continue
            study = backtest(strategy_id, candles)
        except Exception:
            continue
        rows.append(
            {
                "ticker": symbol,
                "company": item["company"],
                "stance": study["stance"],
                "total_return": study["total_return"],
                "max_drawdown": study["max_drawdown"],
                "trades": study["trades"],
                "open": study["open"],
                "win_rate": study["win_rate"],
                "last_close": study["last_close"],
            }
        )
    if not rows:
        raise HTTPException(
            status_code=400,
            detail="No saved daily candles yet. Generate signals, then rank the book.",
        )
    rows.sort(key=lambda row: (-float(row["total_return"]), row["ticker"]))
    rows = rows[:limit]
    for index, row in enumerate(rows, start=1):
        row["rank"] = index
    return {"strategy": strategy_id, "sample": body.sample, "source": source, "rows": rows}


@app.post("/api/strategies/backtest")
def strategy_backtest(body: BacktestBody) -> dict[str, Any]:
    strategy_id = body.strategy.strip().lower()
    symbol = body.ticker.strip().upper()
    if not known(strategy_id):
        raise HTTPException(status_code=400, detail="Pick a strategy from the list.")
    if not symbol or len(symbol) > 20:
        raise HTTPException(status_code=400, detail="Enter one NSE ticker, such as RELIANCE.")
    token = None
    if not body.sample:
        token = require_session()["access_token"]
    try:
        candles = sample_history(symbol) if body.sample else _ensure_candles(symbol, False, token)
        result = backtest(strategy_id, candles)
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=_safe(exc)) from exc
    result["ticker"] = symbol
    result["sample"] = body.sample
    return result


@app.get("/api/automation")
def automation_status(sample: bool = False) -> dict[str, Any]:
    if not sample:
        # Status of a real book is visible only after sign-in. Sample book is open.
        require_session()
    return _public_auto(_load_auto(sample))


@app.post("/api/automation")
def automation_save(body: AutoBody) -> dict[str, Any]:
    _check_auto(body)
    if not body.sample:
        require_session()
    with _auto_lock:
        state = _load_auto(body.sample)
        state["strategy"] = body.strategy
        state["quantity"] = body.quantity
        state["max_orders"] = body.max_orders
        state["symbols"] = _parse_symbols(body.symbols)
        state["mode"] = "live" if body.mode == "live" and body.enabled else "paper"
        state["enabled"] = body.enabled
        state["live_armed"] = body.mode == "live" and body.enabled
        if not body.enabled:
            state["mode"] = "paper"
            state["live_armed"] = False
        _save_auto(state)
        return _public_auto(state)


@app.post("/api/automation/cycle")
def automation_cycle(sample: bool = False) -> dict[str, Any]:
    token = None
    if not sample:
        token = require_session()["access_token"]
    with _auto_lock:
        state = _load_auto(sample)
        if not state.get("enabled"):
            raise HTTPException(status_code=400, detail="Turn automation on before running a cycle.")
        if state.get("mode") == "live":
            token = require_session()["access_token"]
        public = _run_cycle(state, token)
        _save_auto(state)
        return public


def _auto_timer() -> None:
    while True:
        time.sleep(90)
        try:
            for sample in (False, True):
                with _auto_lock:
                    state = _load_auto(sample)
                    if not state.get("enabled"):
                        continue
                    token = None
                    if not sample:
                        session = _read_session()
                        token = session["access_token"] if session else None
                        if state.get("mode") == "live" and not token:
                            continue
                    _run_cycle(state, token)
                    _save_auto(state)
        except Exception:
            continue


def _start_auto_timer() -> None:
    global _auto_started
    if _auto_started:
        return
    _auto_started = True
    threading.Thread(target=_auto_timer, name="groww-auto", daemon=True).start()


_start_auto_timer()


_tape: dict[str, dict[str, Any]] = {}
_tape_lock = threading.Lock()
NIFTY50 = {
    "RELIANCE",
    "TCS",
    "HDFCBANK",
    "INFY",
    "ICICIBANK",
    "SBIN",
    "ITC",
    "LT",
    "BHARTIARTL",
    "HINDUNILVR",
}


def _remember_tape(stocks: list[dict[str, Any]], sample: bool) -> None:
    with _tape_lock:
        for stock in stocks:
            candles = stock.get("candles") or []
            if not candles:
                continue
            last = candles[-1]
            token = str(stock.get("exchange_token") or "")
            if not token:
                continue
            try:
                price = float(last.get("close") or 0)
            except (TypeError, ValueError):
                continue
            if price <= 0:
                continue
            _tape[token] = {"symbol": stock.get("trading_symbol"), "price": price, "sample": sample}


def _ticks_for(tokens: list[str]) -> list[dict[str, Any]]:
    now = time.time()
    rows = []
    with _tape_lock:
        wanted = tokens or list(_tape)
        snapshot = [(token, _tape.get(token)) for token in wanted]
    for token, item in snapshot:
        if not item or not item.get("price"):
            continue
        price = float(item["price"])
        if item.get("sample"):
            price = round(price * (1 + math.sin(now / 3 + (hash(token) % 7)) * 0.0015), 2)
        rows.append({"exchange_token": token, "symbol": item["symbol"], "ltp": price})
    return rows


def _history_rows(raw: Any) -> list[Any]:
    if isinstance(raw, list):
        return raw
    if isinstance(raw, dict):
        for key in ("candles", "data", "payload"):
            value = raw.get(key)
            if isinstance(value, list):
                return value
            if isinstance(value, dict):
                nested = _history_rows(value)
                if nested:
                    return nested
    return []


def _ohlcv_path(symbol: str) -> Path:
    safe = re.sub(r"[^A-Z0-9&\-]", "", symbol.upper())
    return CANDLES / "ohlcv" / f"{safe}.json"


def _read_ohlcv(symbol: str) -> list[dict[str, Any]] | None:
    path = _ohlcv_path(symbol)
    if not path.exists():
        return None
    try:
        payload = json.loads(path.read_text())
    except (OSError, json.JSONDecodeError):
        return None
    candles = payload.get("candles") if isinstance(payload, dict) else None
    if isinstance(candles, list) and len(candles) >= 25:
        return candles
    return None


def _write_ohlcv(symbol: str, candles: list[dict[str, Any]]) -> None:
    path = _ohlcv_path(symbol)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({"fetched_at": time.time(), "candles": candles}))


def _fetch_ohlcv(token: str, instrument: dict[str, str]) -> list[dict[str, Any]]:
    end = datetime.now(IST)
    start = end - timedelta(days=180)
    _limit()
    client = _groww(token)
    raw = client.get_historical_candles(
        exchange=client.EXCHANGE_NSE,
        segment=client.SEGMENT_CASH,
        groww_symbol=instrument["groww_symbol"],
        start_time=start.strftime("%Y-%m-%d 09:15:00"),
        end_time=end.strftime("%Y-%m-%d 15:30:00"),
        candle_interval=client.CANDLE_INTERVAL_DAY,
    )
    candles = normalize_candles(_history_rows(raw))
    if len(candles) >= 25:
        _write_ohlcv(instrument["trading_symbol"], candles)
    return candles


def _stock_row(symbol: str, company: str, instrument: dict[str, str], candles: list[dict[str, Any]]) -> dict[str, Any]:
    try:
        tick = float(instrument.get("tick_size") or 0.05)
    except (TypeError, ValueError):
        tick = 0.05
    return {
        "trading_symbol": symbol,
        "company_name": company,
        "exchange_token": instrument.get("exchange_token") or "",
        "nifty_flags": {"nifty100": True, "nifty50": symbol in NIFTY50},
        "tick_size": tick,
        "candles": candles,
    }


def _sample_scanner() -> dict[str, Any]:
    names, source = load_nifty()
    instruments = load_instruments()
    picked: list[tuple[dict[str, str], dict[str, str]]] = []
    for item in names:
        inst = instruments.get(item["symbol"])
        if not inst:
            continue
        picked.append((item, inst))
        if len(picked) >= 8:
            break
    stocks = []
    for (item, inst), (kind, arg) in zip(picked, sample_plans()):
        stocks.append(_stock_row(item["symbol"], item["company"], inst, candles_for_plan(kind, arg)))
    _remember_tape(stocks, True)
    return {
        "metadata": {
            "sample": True,
            "source": source,
            "universe": len(names),
            "returned": len(stocks),
            "scanned_at": datetime.now(IST).isoformat(),
            "live_status": "Sample tape. Ticks are simulated on this desk.",
            "loading": False,
        },
        "stocks": stocks,
    }


def _live_scanner(refresh: bool) -> dict[str, Any]:
    session = require_session()
    names, source = load_nifty()
    instruments = load_instruments()
    stocks: list[dict[str, Any]] = []
    fetched = 0
    for item in names:
        inst = instruments.get(item["symbol"])
        if not inst:
            continue
        candles = _read_ohlcv(item["symbol"])
        if refresh and fetched < 12:
            try:
                fresh = _fetch_ohlcv(session["access_token"], inst)
                if len(fresh) >= 25:
                    candles = fresh
            except Exception:
                pass
            fetched += 1
        if not candles:
            continue
        stocks.append(_stock_row(item["symbol"], item["company"], inst, candles))
    _remember_tape(stocks, False)
    return {
        "metadata": {
            "sample": False,
            "source": source,
            "universe": len(names),
            "returned": len(stocks),
            "scanned_at": datetime.now(IST).isoformat(),
            "live_status": "Quotes use the saved Groww session. No order is sent.",
            "loading": False,
        },
        "stocks": stocks,
    }


@app.get("/api/scanner-data")
def scanner_data(sample: bool = False, refresh: bool = False) -> dict[str, Any]:
    if sample:
        return _sample_scanner()
    return _live_scanner(refresh)


def _quote_map(payload: Any) -> dict[str, float]:
    found: dict[str, float] = {}

    def walk(node: Any, symbol: str | None = None) -> None:
        if isinstance(node, dict):
            name = symbol
            for key in ("trading_symbol", "tradingSymbol", "symbol"):
                if node.get(key):
                    name = str(node[key]).split(":")[-1].split("_")[-1].upper()
            for key, value in node.items():
                if isinstance(key, str) and key.upper().startswith("NSE") and ("_" in key or ":" in key):
                    walk(value, key.replace(":", "_").split("_")[-1].upper())
                elif key in {"last_price", "ltp", "lastPrice"} and name:
                    try:
                        found[name] = float(value)
                    except (TypeError, ValueError):
                        pass
                else:
                    walk(value, name)
        elif isinstance(node, list):
            for item in node:
                walk(item, symbol)

    walk(payload)
    return found


@app.get("/api/ohlc-snapshot")
def ohlc_snapshot(symbols: str = "", sample: bool = False) -> dict[str, Any]:
    wanted = [part.strip().upper() for part in symbols.split(",") if part.strip()]
    prices: dict[str, Any] = {}
    if sample:
        with _tape_lock:
            by_symbol = {str(item["symbol"]): (token, item) for token, item in _tape.items()}
        for symbol in wanted:
            pair = by_symbol.get(symbol)
            if not pair:
                continue
            token, item = pair
            prices[symbol] = {"last_price": item["price"], "exchange_token": token}
        return {"prices": prices, "sample": True}
    session = require_session()
    client = _groww(session["access_token"])
    batch = tuple(f"NSE_{symbol}" for symbol in wanted[:40])
    try:
        raw = client.get_ohlc(batch, client.SEGMENT_CASH) if batch else {}
        mapped = _quote_map(raw)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=_safe(exc)) from exc
    instruments = load_instruments()
    for symbol in wanted:
        if symbol in mapped:
            prices[symbol] = {
                "last_price": mapped[symbol],
                "exchange_token": (instruments.get(symbol) or {}).get("exchange_token"),
            }
    return {"prices": prices, "sample": False}


def _listify(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]
    if isinstance(payload, dict):
        for key in (
            "orders",
            "order_list",
            "positions",
            "holdings",
            "smart_order_list",
            "smart_orders",
            "data",
            "list",
        ):
            value = payload.get(key)
            if isinstance(value, list):
                return [item for item in value if isinstance(item, dict)]
        inner = payload.get("payload")
        if isinstance(inner, (dict, list)):
            return _listify(inner)
    return []


def _groww_snapshot(token: str) -> dict[str, Any]:
    """Read-only account view. Does not create, modify, or cancel anything."""
    client = _groww(token)
    smart = client.get_smart_order_list(
        smart_order_type="GTT",
        segment=client.SEGMENT_CASH,
        status="ACTIVE",
        page=0,
        page_size=50,
    )
    orders = client.get_order_list(page=0, page_size=50, segment=client.SEGMENT_CASH)
    positions = client.get_positions_for_user(segment=client.SEGMENT_CASH)
    holdings = client.get_holdings_for_user()
    return {
        "smart_orders": _listify(smart),
        "orders": _listify(orders),
        "positions": _listify(positions),
        "holdings": _listify(holdings),
    }


class GttBody(BaseModel):
    confirm_live: bool = False
    sample: bool = False
    candidates: list[dict[str, Any]] = Field(default_factory=list)


def _tick_map(candidates: list[dict[str, Any]]) -> dict[str, float]:
    try:
        instruments = load_instruments()
    except Exception:
        instruments = {}
    ticks: dict[str, float] = {}
    for candidate in candidates:
        symbol = str(candidate.get("symbol") or "").strip().upper()
        inst = instruments.get(symbol) or {}
        raw = candidate.get("tick_size") or inst.get("tick_size") or 0.05
        try:
            ticks[symbol] = float(raw)
        except (TypeError, ValueError):
            ticks[symbol] = 0.05
    return ticks


@app.post("/api/algo-orders/gtt-state")
def gtt_state(body: GttBody) -> dict[str, Any]:
    snapshot: dict[str, Any] = {"smart_orders": [], "orders": [], "positions": [], "holdings": []}
    if not body.sample:
        snapshot = _groww_snapshot(require_session()["access_token"])
    dummies = load_dummies()
    ticks = _tick_map(body.candidates)
    rows = []
    for candidate in body.candidates:
        symbol = str(candidate.get("symbol") or "").strip().upper()
        rows.append(evaluate(candidate, snapshot, dummies, ticks.get(symbol, 0.05)))
    return {"rows": rows, "simulated": True}


@app.post("/api/algo-orders/live-gtt")
def live_gtt(body: GttBody) -> dict[str, Any]:
    if body.confirm_live is not True:
        raise HTTPException(status_code=400, detail="confirm_live must be true. No order was sent.")
    snapshot: dict[str, Any] = {"smart_orders": [], "orders": [], "positions": [], "holdings": []}
    if not body.sample:
        snapshot = _groww_snapshot(require_session()["access_token"])
    ticks = _tick_map(body.candidates)
    rows = create_dummies(body.candidates, snapshot, ticks)
    return {"rows": rows, "simulated": True}


@app.websocket("/ws/ticks")
async def ws_ticks(websocket: WebSocket) -> None:
    await websocket.accept()
    tokens = [part for part in (websocket.query_params.get("tokens") or "").split(",") if part]
    mode = websocket.query_params.get("mode") or "full"
    try:
        while True:
            await websocket.send_json({"mode": mode, "ticks": _ticks_for(tokens)})
            await asyncio.sleep(2)
    except WebSocketDisconnect:
        return


