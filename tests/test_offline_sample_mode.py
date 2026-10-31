import engine
import strategies


def test_offline_sample_mode_smoke_produces_signal_and_backtest():
    """Proves the offline sample-data path emits a valid signal and a backtest with an equity curve."""
    symbol = "DEMO"
    candles = engine.build_demo_closes(
        symbol,
        kind="bullish",
        days_ago=8,
        strength="strong",
        n=240,
    )
    assert len(candles) == 240

    crossover = engine.latest_crossover(candles, short_window=6, long_window=30, lookback_days=14)
    assert crossover is not None
    assert crossover["crossover_type"] in {"bullish", "bearish"}

    signal = engine.monte_carlo(symbol, candles, crossover, paths=32, horizon=5)
    assert signal["signal"] in {"BUY", "SELL", "WATCH", "HOLD"}

    history = strategies.sample_history(symbol)
    assert len(history) >= 40

    result = strategies.backtest("golden", history, commission_bps=5.0, slippage_bps=2.0)
    assert result["strategy"] == "golden"
    assert "equity_curve" in result
    assert "costs_paid" in result
    assert len(result["equity_curve"]) >= 2
    assert result["equity_curve"][-1] > 0
