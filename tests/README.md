# Trading engine sample-data test suite

This directory contains a deterministic, offline-only validation suite for the app's real signal and backtest logic. The suite intentionally exercises the actual sample-data entry points instead of mocks of the strategy engine itself.

Sample-data entry points exercised by the tests
- backend.engine.build_demo_closes(...)
- backend.engine.latest_crossover(...)
- backend.engine.monte_carlo(...)
- backend.strategies.sample_history(...)
- backend.strategies.backtest(...)

Determinism assumptions
- The sample data generator is deterministic by construction: it derives the trend and price scale from the symbol plus fixed configuration, and it produces the same series for repeated runs.
- The Monte Carlo simulation uses a deterministic seed derived from the ticker, path count, horizon, and return count, so repeated runs are stable unless the underlying price history changes.
- No API-key environment variables are allowed for the suite; the test harness fails immediately if any of the key names are present.

Offline enforcement
- The suite patches socket and urllib boundaries to raise if any code attempts a network call.
- This keeps the suite runnable on a clean machine with outbound network disabled and no secrets.

Blockers / limitations
- No sample-data or strategy blockers were encountered. The repository exposes enough built-in sample history for SMA crossovers and rolling-window checks.
- There is no explicit transaction-cost or slippage model in the current backtest engine; the tests therefore validate that trade-level return calculations are internally consistent with the actual close-to-close logic instead of assuming a hidden cost model that is not present in the code.

How to run
- python -m unittest discover -s tests -p "test_*.py" -v

Expected outcome
- The suite must pass in a clean environment with no API-key environment variables set and with outbound network disabled.
