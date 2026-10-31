import engine


def test_lookahead_bias_is_absent_before_crossover_date():
    """Proves the signal is only computed from data available at decision time."""
    candles = engine.build_demo_closes(
        "LOOKAHEAD",
        kind="bullish",
        days_ago=8,
        strength="strong",
        n=180,
    )
    assert len(candles) >= 60

    crossover = engine.latest_crossover(candles, short_window=6, long_window=30, lookback_days=30)
    assert crossover is not None

    cutoff_date = crossover["crossover_date"]
    cut_index = next(i for i, item in enumerate(candles) if item["date"] == cutoff_date)
    prefix = candles[:cut_index]

    assert engine.latest_crossover(prefix, short_window=6, long_window=30, lookback_days=30) is None

    full = engine.latest_crossover(candles, short_window=6, long_window=30, lookback_days=30)
    assert full is not None
    assert full["crossover_date"] == cutoff_date
