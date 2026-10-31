import engine
import strategies


def test_sample_data_is_deterministic_across_runs():
    """Proves identical sample-data inputs produce identical signal and backtest outputs."""
    symbol = "DETERMINISTIC"
    params = {
        "kind": "bullish",
        "days_ago": 8,
        "strength": "strong",
        "n": 240,
    }

    first = engine.build_demo_closes(symbol, **params)
    second = engine.build_demo_closes(symbol, **params)
    assert first == second

    crossover_a = engine.latest_crossover(first, short_window=6, long_window=30, lookback_days=14)
    crossover_b = engine.latest_crossover(second, short_window=6, long_window=30, lookback_days=14)
    assert crossover_a == crossover_b

    label_a = engine.monte_carlo(symbol, first, crossover_a, paths=64, horizon=6)
    label_b = engine.monte_carlo(symbol, second, crossover_b, paths=64, horizon=6)
    assert label_a == label_b

    result_a = strategies.backtest("golden", first)
    result_b = strategies.backtest("golden", second)
    assert result_a == result_b

    charged_a = strategies.backtest("golden", first, commission_bps=2.5, slippage_bps=1.0)
    charged_b = strategies.backtest("golden", second, commission_bps=2.5, slippage_bps=1.0)
    assert charged_a["costs_paid"] == charged_b["costs_paid"]


def test_sample_data_walk_forward_windows_are_stable():
    """Proves sample-data windows remain stable across sequential walk-forward evaluations."""
    history = strategies.sample_history("WALK")
    assert len(history) >= 240

    windows = [
        history[0:180],
        history[30:210],
        history[60:240],
    ]

    for index, window in enumerate(windows, start=1):
        assert len(window) >= 40, f"window {index} is too short"
        result = strategies.backtest("golden", window)
        assert result["strategy"] == "golden"
        assert result["bars"] == len(window)
        assert "recent_trades" in result
