import { useAlgo, type GttRow } from "@/lib/algo-context";
import { inr } from "@/lib/api";

function money(value: number | null): string {
  return value == null ? "—" : inr(value);
}

export function GttPanel() {
  const algo = useAlgo();
  const bySymbol = new Map(algo.gttRows.map((row) => [row.symbol, row]));
  const visible = algo.hits.map((hit) => {
    const known = bySymbol.get(hit.symbol);
    if (known) return known;
    const last = algo.ltpFor(hit);
    const waiting = last == null;
    return {
      symbol: hit.symbol,
      quantity: 1,
      buy_price: hit.breakoutLow,
      stoploss: null,
      tick_size: null,
      last_price: last,
      account_state: waiting ? "waiting" : "clear",
      position_quantity: 0,
      active_buy_trigger_id: null,
      active_stoploss_trigger_id: null,
      day_buy_order_id: null,
      day_buy_order_status: null,
      buy_status: waiting ? "waiting" : "ready",
      buy_trigger_id: null,
      stoploss_status: "planned_after_buy",
      stoploss_trigger_id: null,
      message: waiting ? "Waiting for LTP." : "Run Live on Algo Signals to create a dummy GTT.",
    } satisfies GttRow;
  });

  return (
    <section>
      <h1 className="text-2xl font-semibold tracking-tight">GTT Order Placement</h1>
      <p className="mt-1 max-w-3xl text-sm text-muted">
        Read-only status from Algo Signals · Qty 1 · Buy GTT at breakout candle low · Stoploss 5% below buy · State
        from Groww orders, positions, holdings, and GTTs
      </p>
      {algo.gttError ? (
        <p className="note-down mt-4 rounded-lg border bg-surface px-4 py-3 text-sm text-down" role="alert">
          {algo.gttError}
        </p>
      ) : null}
      <h2 className="mt-5 text-base font-semibold">Groww GTT Placement</h2>
      <p className="mt-1 text-xs text-muted">
        Simulation only. Run Live writes a local DUMMY- record and does not send an order to Groww.
      </p>
      <div className="mt-3 overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-max text-left text-xs">
          <thead className="bg-surface tracking-wide text-muted uppercase">
            <tr>
              {[
                "Rank",
                "Symbol",
                "Qty",
                "Buy",
                "Stoploss",
                "Last Price",
                "Account State",
                "Buy Status",
                "Buy Trigger",
                "Day Buy Order",
                "Position Qty",
                "Stoploss Status",
                "Stoploss Trigger",
                "Message",
              ].map((label) => (
                <th key={label} className="px-2 py-2 font-medium whitespace-nowrap">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {algo.loading ? (
              <tr>
                <td colSpan={14} className="px-3 py-8 text-center text-sm text-muted">
                  Loading scanner cache...
                </td>
              </tr>
            ) : visible.length === 0 ? (
              <tr>
                <td colSpan={14} className="px-3 py-8 text-center text-sm text-muted">
                  No breakout retest setups match the current parameters.
                </td>
              </tr>
            ) : (
              visible.map((row, index) => {
                const hit = algo.hits.find((item) => item.symbol === row.symbol);
                const live = hit ? algo.ltpFor(hit) : null;
                const last = live ?? row.last_price;
                return (
                <tr
                  key={row.symbol}
                  onClick={() => algo.setSelected(row.symbol)}
                  className={
                    "border-t border-border " + (algo.selected === row.symbol ? "bg-surface-2" : "hover:bg-surface")
                  }
                >
                  <td className="num px-2 py-1.5">{index + 1}</td>
                  <td className="px-2 py-1.5 text-sm font-semibold">{row.symbol}</td>
                  <td className="num px-2 py-1.5">{row.quantity}</td>
                  <td className="num px-2 py-1.5">{money(row.buy_price)}</td>
                  <td className="num px-2 py-1.5">{money(row.stoploss)}</td>
                  <td className="num px-2 py-1.5">{last == null ? "Waiting" : inr(last)}</td>
                  <td className="px-2 py-1.5">{row.account_state}</td>
                  <td className="px-2 py-1.5">{row.buy_status}</td>
                  <td className="num px-2 py-1.5">{row.buy_trigger_id ?? "—"}</td>
                  <td className="num px-2 py-1.5">{row.day_buy_order_id ?? "—"}</td>
                  <td className="num px-2 py-1.5">{row.position_quantity}</td>
                  <td className="px-2 py-1.5">{row.stoploss_status ?? "—"}</td>
                  <td className="num px-2 py-1.5">{row.stoploss_trigger_id ?? "—"}</td>
                  <td className="max-w-[18rem] px-2 py-1.5 text-muted">{row.message}</td>
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
