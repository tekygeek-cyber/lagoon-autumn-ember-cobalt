import engine


def test_signal_priority_conflict_resolution_is_documented_and_applied():
    """Proves the documented priority rule resolves conflicting signals on the same bar."""
    candidates = [
        {"kind": "crossover_down", "name": "down"},
        {"kind": "watch", "name": "watch"},
        {"kind": "crossover_up", "name": "up"},
        {"kind": "hold", "name": "hold"},
    ]
    winner = engine.resolve_conflict(candidates)
    assert winner is not None
    assert winner["name"] == "up"

    sample = engine.build_demo_closes(
        "SIGPRIOR",
        kind="bullish",
        days_ago=8,
        strength="strong",
        n=180,
    )
    crossover = engine.latest_crossover(sample, short_window=6, long_window=30, lookback_days=30)
    assert crossover is not None
    assert crossover["crossover_type"] in {"bullish", "bearish"}
