import { useEffect, useState } from "react";
import { api, inr, pct } from "@/lib/api";

type Strategy = { id: string; name: string; source: string; summary: string };

type Trade = { entry_date: string; exit_date: string | null; return: number; open?: boolean };

type Study = {
  ticker: string;
  strategy: string;
  bars: number;
  from: string;
  to: string;
  trades: number;
  win_rate: number | null;
  total_return: number;
  max_drawdown: number;
  open: boolean;
  stance: "LONG" | "FLAT";
  last_close: number;
  sample: boolean;
  recent_trades: Trade[];
};

type BoardRow = {
  rank: number;
  ticker: string;
  company: string;
  stance: "LONG" | "FLAT";
  total_return: number;
  max_drawdown: number;
  trades: number;
  open: boolean;
  win_rate: number | null;
  last_close: number;
};

type AutoLog = {
  at?: string;
  ticker?: string;
  side?: string;
  qty?: number;
  price?: number;
  mode?: string;
  status?: string;
  note?: string;
};

type AutoState = {
  enabled: boolean;
  mode: "paper" | "live" | string;
  live_armed: boolean;
  strategy: string;
  quantity: number;
  max_orders: number;
  symbols: string[];
  sample: boolean;
  positions: Record<string, { qty: number; entry: number; entry_date: string }>;
  log: AutoLog[];
  last_cycle: string | null;
};

const fieldClass =
  "h-11 w-full rounded-lg border border-border bg-bg px-3 text-sm text-fg outline-none focus-visible:ring-2 focus-visible:ring-primary";

export function StrategiesPanel({ sample }: { sample: boolean }) {
  const [list, setList] = useState<Strategy[]>([]);
  const [strategy, setStrategy] = useState("turtle");
  const [ticker, setTicker] = useState("RELIANCE");
  const [study, setStudy] = useState<Study | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [auto, setAuto] = useState<AutoState | null>(null);
  const [mode, setMode] = useState<"paper" | "live">("paper");
  const [quantity, setQuantity] = useState(1);
  const [maxOrders, setMaxOrders] = useState(3);
  const [book, setBook] = useState("");
  const [confirm, setConfirm] = useState("");
  const [autoError, setAutoError] = useState<string | null>(null);
  const [cycling, setCycling] = useState(false);
  const [board, setBoard] = useState<BoardRow[]>([]);
  const [ranking, setRanking] = useState(false);

  useEffect(() => {
    let cancel = false;
    api<{ strategies: Strategy[] }>("/api/strategies")
      .then((payload) => {
        if (!cancel) setList(payload.strategies);
      })
      .catch(() => {
        if (!cancel) setError("Could not load the strategy list.");
      });
    const query = sample ? "?sample=true" : "?sample=false";
    api<AutoState>(`/api/automation${query}`)
      .then((state) => {
        if (cancel) return;
        setAuto(state);
        setStrategy(state.strategy || "turtle");
        setQuantity(state.quantity || 1);
        setMaxOrders(state.max_orders || 3);
        setBook((state.symbols || []).join(", "));
        setMode(state.mode === "live" ? "live" : "paper");
      })
      .catch(() => {
        /* unsigned sample still has the catalog */
      });
    return () => {
      cancel = true;
    };
  }, [sample]);

  async function runBacktest() {
    setBusy(true);
    setError(null);
    try {
      const result = await api<Study>("/api/strategies/backtest", {
        method: "POST",
        body: JSON.stringify({ strategy, ticker, sample }),
      });
      setStudy(result);
    } catch (err) {
      setStudy(null);
      setError(err instanceof Error ? err.message : "Backtest failed.");
    } finally {
      setBusy(false);
    }
  }

  async function rankBook() {
    setRanking(true);
    setError(null);
    try {
      const payload = await api<{ rows: BoardRow[] }>("/api/strategies/board", {
        method: "POST",
        body: JSON.stringify({ strategy, sample, limit: 15 }),
      });
      setBoard(payload.rows);
    } catch (err) {
      setBoard([]);
      setError(err instanceof Error ? err.message : "Could not rank the book.");
    } finally {
      setRanking(false);
    }
  }

  function useLongs() {
    const longs = board.filter((row) => row.stance === "LONG").map((row) => row.ticker);
    if (longs.length) setBook(longs.join(", "));
  }

  async function saveAuto(enabled: boolean) {
    setAutoError(null);
    try {
      const next = await api<AutoState>("/api/automation", {
        method: "POST",
        body: JSON.stringify({
          enabled,
          mode: sample ? "paper" : mode,
          strategy,
          quantity,
          max_orders: maxOrders,
          symbols: book,
          confirm,
          sample,
        }),
      });
      setAuto(next);
      if (!enabled) setConfirm("");
    } catch (err) {
      setAutoError(err instanceof Error ? err.message : "Could not update automation.");
    }
  }

  async function runCycle() {
    setCycling(true);
    setAutoError(null);
    try {
      const next = await api<AutoState>(`/api/automation/cycle?sample=${sample ? "true" : "false"}`, {
        method: "POST",
      });
      setAuto(next);
    } catch (err) {
      setAutoError(err instanceof Error ? err.message : "Cycle failed.");
    } finally {
      setCycling(false);
    }
  }

  const positions = auto ? Object.entries(auto.positions) : [];

  return (
    <section>
      <h1 className="text-2xl font-semibold tracking-tight">Strategies</h1>
      <p className="mt-1 max-w-3xl text-sm text-muted">
        Published playbooks from Dennis, Connors, Appel, Bollinger, and the momentum research of Jegadeesh and
        Titman. These are not a private fund's model. The study uses daily closes. Nothing is ordered until you
        arm automation.
      </p>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {list.map((item) => {
          const selected = strategy === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={selected}
              onClick={() => setStrategy(item.id)}
              className={
                "rounded-lg border p-4 text-left " +
                (selected ? "border-primary bg-surface-2" : "border-border bg-surface hover:bg-surface-2")
              }
            >
              <span className="block text-sm font-semibold">{item.name}</span>
              <span className="mt-1 block text-xs text-primary">{item.source}</span>
              <span className="mt-2 block text-sm text-muted">{item.summary}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-5 grid gap-3 rounded-lg border border-border bg-surface p-4 sm:grid-cols-3">
        <label className="block text-sm sm:col-span-1">
          <span className="mb-1.5 block text-xs font-medium tracking-wide text-muted uppercase">Ticker</span>
          <input
            className={fieldClass + " num"}
            value={ticker}
            spellCheck={false}
            onChange={(event) => setTicker(event.target.value.toUpperCase())}
          />
        </label>
        <div className="flex flex-col items-stretch justify-end gap-2 sm:col-span-2 sm:flex-row">
          <button
            type="button"
            disabled={busy}
            onClick={() => void runBacktest()}
            className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-fg hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Running study…" : "Run backtest"}
          </button>
          <button
            type="button"
            disabled={ranking}
            onClick={() => void rankBook()}
            className="inline-flex h-11 items-center justify-center rounded-lg border border-border bg-bg px-4 text-sm font-medium text-fg hover:bg-surface-2 disabled:opacity-50"
          >
            {ranking ? "Ranking…" : "Rank the book"}
          </button>
        </div>
      </div>
      {error ? (
        <p className="note-down mt-3 rounded-lg border bg-surface px-4 py-3 text-sm text-down" role="alert">
          {error}
        </p>
      ) : null}
      {study ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Total return" value={pct(study.total_return)} />
          <Metric label="Max drawdown" value={pct(study.max_drawdown)} />
          <Metric label="Closed trades" value={String(study.trades)} />
          <Metric label="Win rate" value={study.win_rate === null ? "—" : `${Math.round(study.win_rate * 100)}%`} />
          <p className="text-sm text-muted sm:col-span-2 lg:col-span-4">
            {study.ticker} is <span className="text-fg">{study.stance}</span> on this rule. Last close{" "}
            <span className="num text-fg">{inr(study.last_close)}</span>. {study.bars} daily bars, {study.from} to{" "}
            {study.to}.
            {study.open ? " One trade is still open, so its result is inside the total return." : ""}
            {study.sample ? " Sample prices, not the live tape." : ""}
          </p>
          {study.recent_trades.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-border sm:col-span-2 lg:col-span-4">
              <table className="w-full min-w-max text-left text-sm">
                <thead className="bg-bg text-xs tracking-wide text-muted uppercase">
                  <tr>
                    <th className="px-3 py-2 font-medium">Entered</th>
                    <th className="px-3 py-2 font-medium">Exited</th>
                    <th className="px-3 py-2 text-right font-medium">Return</th>
                  </tr>
                </thead>
                <tbody>
                  {study.recent_trades.map((trade) => (
                    <tr key={`${trade.entry_date}-${trade.exit_date ?? "open"}`} className="border-t border-border">
                      <td className="num px-3 py-2">{trade.entry_date}</td>
                      <td className="num px-3 py-2">{trade.open ? "Open" : trade.exit_date}</td>
                      <td className="num px-3 py-2 text-right">{pct(trade.return)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}
      {board.length > 0 ? (
        <div className="mt-4 overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-max text-left text-sm">
            <thead className="bg-surface text-xs tracking-wide text-muted uppercase">
              <tr>
                <th className="px-3 py-3 font-medium">Rank</th>
                <th className="px-3 py-3 font-medium">Ticker</th>
                <th className="px-3 py-3 font-medium">Company</th>
                <th className="px-3 py-3 font-medium">Stance</th>
                <th className="px-3 py-3 text-right font-medium">Return</th>
                <th className="px-3 py-3 text-right font-medium">Drawdown</th>
                <th className="px-3 py-3 text-right font-medium">Trades</th>
                <th className="px-3 py-3 text-right font-medium">Close</th>
              </tr>
            </thead>
            <tbody>
              {board.map((row) => (
                <tr key={row.ticker} className="border-t border-border">
                  <td className="num px-3 py-2">{row.rank}</td>
                  <td className="px-3 py-2 font-medium">{row.ticker}</td>
                  <td className="max-w-[16rem] truncate px-3 py-2 text-muted">{row.company}</td>
                  <td className="px-3 py-2">{row.stance}</td>
                  <td className="num px-3 py-2 text-right">{pct(row.total_return)}</td>
                  <td className="num px-3 py-2 text-right">{pct(row.max_drawdown)}</td>
                  <td className="num px-3 py-2 text-right">
                    {row.trades}
                    {row.open ? " + open" : ""}
                  </td>
                  <td className="num px-3 py-2 text-right">{inr(row.last_close)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="mt-6 rounded-lg border border-border bg-surface p-4">
        <h2 className="text-base font-semibold">Automated trading</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          While this is on, the desk checks the saved names about every 90 seconds and also when you run a cycle.
          Every fill stays on the paper ledger. Live sending is off, including when the mode says Live. No order is
          sent to Groww.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-sm">
            <span className="mb-1.5 block text-xs font-medium tracking-wide text-muted uppercase">Mode</span>
            <select
              className={fieldClass}
              value={sample ? "paper" : mode}
              disabled={sample}
              onChange={(event) => setMode(event.target.value === "live" ? "live" : "paper")}
            >
              <option value="paper">Paper</option>
              <option value="live">Live</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block text-xs font-medium tracking-wide text-muted uppercase">Shares</span>
            <input
              className={fieldClass + " num"}
              type="number"
              min={1}
              max={10}
              value={quantity}
              onChange={(event) => setQuantity(Number(event.target.value))}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block text-xs font-medium tracking-wide text-muted uppercase">Max orders</span>
            <input
              className={fieldClass + " num"}
              type="number"
              min={1}
              max={5}
              value={maxOrders}
              onChange={(event) => setMaxOrders(Number(event.target.value))}
            />
          </label>
          <label className="block text-sm lg:col-span-2">
            <span className="mb-1.5 block text-xs font-medium tracking-wide text-muted uppercase">
              Book, blank uses scanned names
            </span>
            <input
              className={fieldClass + " num"}
              value={book}
              spellCheck={false}
              placeholder="RELIANCE, TCS, INFY"
              onChange={(event) => setBook(event.target.value.toUpperCase())}
            />
          </label>
          {!sample && mode === "live" ? (
            <label className="block text-sm lg:col-span-2">
              <span className="mb-1.5 block text-xs font-medium tracking-wide text-muted uppercase">
                Type ENABLE LIVE
              </span>
              <input
                className={fieldClass + " num"}
                value={confirm}
                spellCheck={false}
                onChange={(event) => setConfirm(event.target.value)}
              />
            </label>
          ) : null}
        </div>
        {sample ? (
          <p className="mt-3 text-xs text-watch">Sample mode stays on paper. Sign in to arm live orders.</p>
        ) : null}
        {auto?.live_armed ? (
          <p className="note-down mt-3 rounded-lg border px-3 py-2 text-sm text-down">
            Live mode is armed, but cycles still stay on the paper ledger. Nothing is sent to Groww.
          </p>
        ) : null}
        {autoError ? (
          <p className="mt-3 text-sm text-down" role="alert">
            {autoError}
          </p>
        ) : null}
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => void saveAuto(!auto?.enabled)}
            className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-fg hover:opacity-90"
          >
            {auto?.enabled ? "Turn automation off" : "Turn automation on"}
          </button>
          <button
            type="button"
            disabled={!auto?.enabled || cycling}
            onClick={() => void runCycle()}
            className="inline-flex h-11 items-center justify-center rounded-lg border border-border bg-bg px-4 text-sm font-medium text-fg hover:bg-surface-2 disabled:opacity-50"
          >
            {cycling ? "Running cycle…" : "Run cycle now"}
          </button>
          <button
            type="button"
            disabled={board.length === 0}
            onClick={useLongs}
            className="inline-flex h-11 items-center justify-center rounded-lg border border-border bg-bg px-4 text-sm font-medium text-fg hover:bg-surface-2 disabled:opacity-50"
          >
            Use longs
          </button>
        </div>
        <p className="mt-3 text-xs text-muted">
          {auto?.enabled
            ? `On · ${auto.mode === "live" ? "live" : "paper"} · ${auto.strategy}`
            : "Automation is off."}
          {auto?.last_cycle ? ` Last cycle ${auto.last_cycle.slice(0, 16).replace("T", " ")}.` : ""}
        </p>
        {positions.length > 0 ? (
          <ul className="mt-3 space-y-1 text-sm">
            {positions.map(([symbol, position]) => (
              <li key={symbol} className="num text-muted">
                {symbol} · {position.qty} @ {inr(position.entry)}
              </li>
            ))}
          </ul>
        ) : null}
        {auto && auto.log.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {auto.log
              .slice()
              .reverse()
              .slice(0, 6)
              .map((row, index) => (
                <li key={`${row.at}-${index}`} className="text-xs text-muted">
                  <span className="text-fg">
                    {row.side ? `${row.side} ${row.ticker ?? ""}` : row.status === "idle" ? "Idle" : "Note"}
                  </span>
                  {row.note ? ` — ${row.note}` : ""}
                </li>
              ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-lg border border-border bg-surface p-4">
      <p className="text-xs tracking-wide text-muted uppercase">{label}</p>
      <p className="num mt-2 text-lg font-medium">{value}</p>
    </article>
  );
}
