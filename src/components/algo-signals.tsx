import { useAlgo } from "@/lib/algo-context";
import { inr } from "@/lib/api";

function signed(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function AlgoSignalsPanel() {
  const algo = useAlgo();
  return (
    <section>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">High-volume breakout and retest setups</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted">
            A breakout needs a green close through the prior 20-day high on at least 3× volume, a higher high after
            that candle, and a retest within 1% of the breakout midpoint.
          </p>
        </div>
        <button
          type="button"
          disabled={algo.running || algo.loading}
          onClick={() => void algo.runLive()}
          className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-fg hover:opacity-90 disabled:opacity-50"
        >
          {algo.running ? "Running..." : "Run Live"}
        </button>
      </div>
      {algo.gttError ? (
        <p className="note-down mt-4 rounded-lg border bg-surface px-4 py-3 text-sm text-down" role="alert">
          {algo.gttError}
        </p>
      ) : null}
      <p className="mt-4 text-sm text-muted">
        {algo.hits.length} triggered breakouts · {algo.scanned} stocks scanned · {algo.liveStatus} · {algo.tickStatus}
      </p>
      {algo.error ? (
        <p className="note-down mt-3 rounded-lg border bg-surface px-4 py-3 text-sm text-down" role="alert">
          {algo.error}
        </p>
      ) : null}
      <h2 className="mt-5 text-base font-semibold">Triggered Breakouts</h2>
      <div className="mt-2 overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-max text-left text-xs">
          <thead className="bg-surface tracking-wide text-muted uppercase">
            <tr>
              {["Rank", "Symbol", "Current Price", "Breakout Date", "Age", "Breakout Vol", "Retest Distance", "Peak Gains", "Retracement"].map(
                (label) => (
                  <th key={label} className="px-2 py-2 font-medium whitespace-nowrap">
                    {label}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {algo.loading ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-sm text-muted">
                  Loading scanner cache...
                </td>
              </tr>
            ) : algo.hits.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-sm text-muted">
                  No breakout retest setups match the current parameters.
                </td>
              </tr>
            ) : (
              algo.hits.map((hit, index) => {
                const price = algo.priceFor(hit);
                const selected = algo.selected === hit.symbol;
                return (
                  <tr
                    key={hit.symbol}
                    onClick={() => algo.setSelected(hit.symbol)}
                    className={"cursor-pointer border-t border-border " + (selected ? "bg-surface-2" : "hover:bg-surface")}
                  >
                    <td className="num px-2 py-1.5">{index + 1}</td>
                    <td className="px-2 py-1.5 text-sm font-semibold">{hit.symbol}</td>
                    <td className="num px-2 py-1.5">{price == null ? "Waiting" : inr(price)}</td>
                    <td className="num px-2 py-1.5">{hit.breakoutDate}</td>
                    <td className="num px-2 py-1.5">{hit.daysSince}</td>
                    <td className="num px-2 py-1.5">{hit.volMultiple.toFixed(2)}x</td>
                    <td className="num px-2 py-1.5">{signed(hit.distanceFromMidpoint)}</td>
                    <td className="num px-2 py-1.5">{signed(hit.returnFromCloseToSubHigh)}</td>
                    <td className="num px-2 py-1.5">{signed(hit.retracementHigh)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
