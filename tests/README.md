# Offline sample-data validation suite

This suite targets the actual Python signal engine and strategy backtest in the repository without any network access or API keys. It exercises the real sample-data path in `backend.engine.build_demo_closes`, `engine.latest_crossover`, `engine.monte_carlo`, and `strategies.sample_history` / `strategies.backtest`.

## Exact offline run command

```bash
cd /path/to/repo
PYTHONPATH=$PWD/backend pytest -q tests
```

## Three autouse guards

The suite includes three autouse fixtures in `tests/conftest.py`:

1. `_no_api_keys`
   - Fails fast if an API-key-like environment variable is present.
   - It allows CI and interpreter variables such as `GITHUB_ACTIONS`, `PYTHONPATH`, `HOME`, `PATH`, `USER`, `SHELL`, `LANG`, and `LC_*`, while rejecting anything matching `(?i).*(api[_-]?key|secret|token).*` when non-empty.

2. `_no_network`
   - Monkeypatches `socket.socket` and `socket.create_connection` to raise `RuntimeError("network disabled in tests")` if a test tries to open a socket.

3. `_isolate_tmp`
   - Uses pytest's `tmp_path` fixture only and leaves the process-level `TMPDIR`, `TEMP`, and `TMP` variables alone. This avoids cross-test contamination without breaking pytest's own temp-layering.

## Seed / determinism rationale

The deterministic sample-data generator is derived from a fixed symbol and a seeded hash:
- `backend.engine.build_demo_closes` derives its scale factor from `zlib.adler32(symbol.encode())`;
- `engine.monte_carlo` seeds its RNG from `zlib.adler32(f"{ticker}:{paths}:{horizon}:{len(returns)}".encode())`.

Repeated runs therefore return the same synthetic series, the same crossover, and the same Monte Carlo label in the same configuration.

## Signal-priority rule

The conflict-resolution rule is documented in `backend/engine.py`:
- `SIGNAL_PRIORITY = ["crossover_up", "crossover_down", "bullish", "bearish", "signal_buy", "signal_sell", "watch", "hold"]`
- `engine.resolve_conflict(signals)` returns the winner with the smallest rank in that ordered list.
- If a signal has no explicit kind, it is treated as `hold`.

This rule is additive and does not change `engine.latest_crossover()`'s legacy single-signal output.

## Transaction costs and slippage

`backend/strategies.py::backtest` accepts:
- `commission_bps: float = 0.0`
- `slippage_bps: float = 0.0`

When both are zero, the function preserves the legacy behavior exactly. When either is non-zero:
- commission is charged at each trade entry and exit, on the trade notional;
- slippage is applied as adverse fill-price impact at entry and exit;
- a new `costs_paid` field is added to the result;
- `equity_curve` and `equity` are emitted so the final equity reduction is directly testable.

## Source changes in this PR

- `backend/engine.py`
  - Added `SIGNAL_PRIORITY` and `resolve_conflict()`.
  - Documented the precedence rule without altering `latest_crossover()` output.
- `backend/strategies.py`
  - Added `commission_bps` and `slippage_bps` optional keyword arguments.
  - Preserved the exact legacy output when both values are zero.
  - Added cost-aware equity-tracking fields (`costs_paid`, `equity_curve`, `equity`) when costs are enabled.
- `tests/conftest.py`
  - Added the offline/no-key guardrails for the test suite.
- `tests/test_offline_sample_mode.py`
  - Added the smoke test.
- `tests/test_determinism.py`
  - Added determinism and rolling-window checks.
- `tests/test_lookahead_bias.py`
  - Added the lookahead-bias guard.
- `tests/test_edge_cases.py`
  - Added edge-case robustness coverage.
- `tests/test_signal_priority.py`
  - Added the real conflict-resolution test.
- `tests/test_backtest_costs.py`
  - Added the cost/slippage regression test.
