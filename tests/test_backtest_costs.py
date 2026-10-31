import strategies


def test_backtester_applies_costs_and_slippage():
    """Proves transaction costs and slippage are applied and the equity curve falls when fees are enabled."""
    candles = strategies.sample_history("COSTCHECK")
    assert len(candles) >= 40

    result_a = strategies.backtest("golden", candles, commission_bps=0.0, slippage_bps=0.0)
    result_default = strategies.backtest("golden", candles)
    assert result_default == result_a

    result_b = strategies.backtest("golden", candles, commission_bps=10.0, slippage_bps=5.0)
    assert "equity_curve" in result_b
    assert "costs_paid" in result_b
    assert result_b["costs_paid"] > 0
    assert result_b["equity_curve"][-1] < 1.0 + result_a["total_return"]
