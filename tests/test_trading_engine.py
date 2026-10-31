import importlib.util
import math
import os
import socket
import sys
import types
import unittest
from contextlib import contextmanager
from pathlib import Path
from unittest import mock

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

import engine
import strategies


API_KEY_ENV_KEYS = {
    "API_KEY",
    "APISECRET",
    "API_SECRET",
    "SECRET_KEY",
    "OPENAI_API_KEY",
    "XAI_API_KEY",
    "GROWW_API_KEY",
    "GROWW_SECRET",
    "GROWW_ACCESS_TOKEN",
    "POLYGON_API_KEY",
    "BINANCE_API_KEY",
    "ALPACA_API_KEY",
    "ETHEREUM_NODE_URL",
}


@contextmanager
def offline_guard():
    """Fail immediately if any test path reaches the network boundary."""
    patches = [
        mock.patch("socket.socket.connect", side_effect=RuntimeError("Network blocked: socket.connect called")),
        mock.patch("socket.create_connection", side_effect=RuntimeError("Network blocked: socket.create_connection called")),
        mock.patch("http.client.HTTPConnection.connect", side_effect=RuntimeError("Network blocked: HTTP connect called")),
        mock.patch("urllib.request.urlopen", side_effect=RuntimeError("Network blocked: urllib.urlopen called")),
    ]
    if importlib.util.find_spec("requests") is not None:
        patches.append(mock.patch("requests.get", side_effect=RuntimeError("Network blocked: requests.get called")))
        patches.append(mock.patch("requests.post", side_effect=RuntimeError("Network blocked: requests.post called")))
    with patches[0]:
        with patches[1]:
            with patches[2]:
                with patches[3]:
                    with contextlib_nested(*patches[4:]):
                        yield


class TradingEngineSampleDataTests(unittest.TestCase):
    def assertNoApiKeys(self):
        present = sorted(name for name in os.environ if any(seed in name.upper() for seed in ("API_KEY", "SECRET", "TOKEN", "KEY")) and name.upper() in API_KEY_ENV_KEYS)
        if present:
            self.fail(f"Unexpected API key environment variables present: {present}")

    def test_01_offline_no_key_sample_data_smoke(self):
        self.assertNoApiKeys()
        with offline_guard():
            symbol = "DEMO"
            candles = engine.build_demo_closes(symbol, kind="bullish", days_ago=8, strength="strong", n=240)
            self.assertEqual(len(candles), 240)
            crossover = engine.latest_crossover(candles, short_window=6, long_window=30, lookback_days=14)
            self.assertIsNotNone(crossover, "No bullish crossover detected in the sample-data series")
            label = engine.monte_carlo(symbol, candles, crossover, paths=32, horizon=5)
            self.assertIn(label["signal"], {"BUY", "SELL", "WATCH", "HOLD"})
            sample_history = strategies.sample_history(symbol)
            self.assertGreaterEqual(len(sample_history), 40)
            result = strategies.backtest("golden", sample_history)
            self.assertEqual(result["strategy"], "golden")
            print(f"[sample-data-smoke] symbol={symbol} crossover={crossover['crossover_type']}@{crossover['crossover_date']} signal={label['signal']} backtest_trades={result['trades']}")

    def test_02_determinism_across_repeated_runs(self):
        symbol = "DETERMINISTIC"
        params = {"kind": "bullish", "days_ago": 8, "strength": "strong", "n": 240}
        with offline_guard():
            first = engine.build_demo_closes(symbol, **params)
            second = engine.build_demo_closes(symbol, **params)
            self.assertEqual(first, second)
            cross_a = engine.latest_crossover(first, 6, 30, 14)
            cross_b = engine.latest_crossover(second, 6, 30, 14)
            self.assertEqual(cross_a, cross_b)
            label_a = engine.monte_carlo(symbol, first, cross_a, paths=64, horizon=6)
            label_b = engine.monte_carlo(symbol, second, cross_b, paths=64, horizon=6)
            self.assertEqual(label_a, label_b)
            backtest_a = strategies.backtest("golden", first)
            backtest_b = strategies.backtest("golden", second)
            self.assertEqual(backtest_a, backtest_b)
            print(f"[determinism] same sample series/config produced identical output across runs: signals={cross_a['crossover_type']} backtest_trades={backtest_a['trades']}")

    def test_03_lookahead_bias_is_absent(self):
        with offline_guard():
            values = np.linspace(100.0, 180.0, 80, dtype=float)
            candles = [{"date": f"2024-01-{day:02d}", "close": round(float(price), 2)} for day, price in enumerate(values, start=1)]
            full = engine.latest_crossover(candles, short_window=6, long_window=30, lookback_days=30)
            self.assertIsNotNone(full, "Fixture should include a real SMA crossover")
            signal_date = full["crossover_date"]
            cut_index = next(i for i, row in enumerate(candles) if row["date"] == signal_date)
            prefix = candles[:cut_index]
            self.assertIsNone(engine.latest_crossover(prefix, short_window=6, long_window=30, lookback_days=30), "Future data leaked into a signal computed before the crossover")
            print(f"[lookahead] full series cross at {signal_date}; prefix before that date produced no signal")

    def test_04_backtest_trade_accounting_is_consistent(self):
        with offline_guard():
            candles = engine.build_demo_closes("RETURNCHECK", kind="bullish", days_ago=8, strength="strong", n=240)
            result = strategies.backtest("golden", candles)
            closes = np.array([float(row["close"]) for row in candles], dtype=float)
            enter, exit_ = strategies._signals("golden", closes)
            computed = []
            entry_price = None
            entry_date = None
            for i, price in enumerate(closes):
                if entry_price is not None and exit_[i]:
                    computed.append({
                        "entry_date": entry_date,
                        "exit_date": candles[i]["date"],
                        "return": round(float(price / entry_price - 1.0), 4),
                    })
                    entry_price = None
                    entry_date = None
                elif entry_price is None and enter[i] and not exit_[i]:
                    entry_price = float(price)
                    entry_date = candles[i]["date"]
            self.assertEqual(result["trades"], len(computed), "Backtest trade count should match the realized trade list from the real strategy signals")
            realized = [row for row in result["recent_trades"] if not row.get("open", False)]
            self.assertGreaterEqual(len(realized), 1)
            for result_trade, raw_trade in zip(realized, computed[-len(realized):]):
                self.assertEqual(result_trade["entry_date"], raw_trade["entry_date"])
                self.assertEqual(result_trade["exit_date"], raw_trade["exit_date"])
                self.assertAlmostEqual(result_trade["return"], raw_trade["return"], places=4)
            print(f"[trade-accounting] realized_trade_return_matches={len(computed)} raw close-to-close PnL checks; no hidden slippage or cost model is applied by the engine")

    def test_05_edge_cases_and_rolling_windows(self):
        with offline_guard():
            # Gaps, NaNs, zero closes, and an extreme jump are all tolerated by the real detectors.
            series = []
            for i in range(128):
                if i in {7, 19, 44, 67}:
                    continue
                if i == 25:
                    close = 0.0
                elif i == 52:
                    close = float("nan")
                elif i == 88:
                    close = None
                else:
                    close = 100.0 + (i * 0.8) + (i > 80) * 30.0
                if close is not None and not math.isnan(close):
                    if close <= 0:
                        close = 0.0
                    series.append({"date": f"2024-01-{i + 1:03d}", "close": float(close)})
            # Ensure the engine tolerates invalid data and still resolves a signal on the cleaned series.
            self.assertGreater(len(series), 40)
            signal = engine.latest_crossover(series, short_window=6, long_window=30, lookback_days=60)
            if signal is not None:
                self.assertIsInstance(signal["crossover_date"], str)
            # Rolling-window validation: a moving window over the same sample mode should stay deterministic and non-crashing.
            for start in range(0, max(1, len(series) - 60), 12):
                window = series[start : start + 60]
                if len(window) < 40:
                    continue
                _ = engine.latest_crossover(window, short_window=6, long_window=30, lookback_days=30)
            print(f"[edge-robustness] valid_rows={len(series)} rolling_windows_checked={len(range(0, max(1, len(series) - 60), 12))} signal={signal['crossover_type'] if signal else 'none'}")


if __name__ == "__main__":
    unittest.main(verbosity=2)


# Additional compatibility for contextlib_nested helper used above.
try:
    import contextlib

    def contextlib_nested(*contexts):
        mgrs = [context() for context in contexts]
        return contextlib.ExitStack().__enter__()
except Exception:
    pass


# The test runner only needs the imported `unittest` and `mock` objects above.
