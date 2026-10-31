import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { StrategiesPanel } from "@/components/strategies-panel";
import { AlgoSignalsPanel } from "@/components/algo-signals";
import { GttPanel } from "@/components/gtt-panel";
import { AlgoProvider } from "@/lib/algo-context";
import { AccentSwitch } from "@/components/accent";
import { Wordmark } from "@/components/wordmark";
import {
  api,
  expiryLabel,
  inr,
  pct,
  prettyDate,
  type Profile,
  type ScanJob,
  type ScanMeta,
  type ScanParams,
  type SessionStatus,
  type SignalRow,
  type SimResult,
} from "@/lib/api";

const fieldClass =
  "h-11 w-full rounded-lg border border-border bg-bg px-3 text-sm text-fg outline-none focus-visible:ring-2 focus-visible:ring-primary";

const GUIDE = [
  { signal: "BUY" as const, text: "Bullish cross, at least 58% of paths finish higher, and the median path is up." },
  { signal: "SELL" as const, text: "Bearish cross, at most 42% of paths finish higher, and the median path is down." },
  { signal: "WATCH" as const, text: "The cross is four sessions old or newer, but the simulated edge is still too small to act." },
  { signal: "HOLD" as const, text: "A cross is on the board, yet the simulation does not support buying or selling." },
];

const PRODUCT_LABEL: Record<string, string> = {
  CASH: "Cash equity",
  FNO: "Futures & options",
  CNC: "Delivery (CNC)",
  MIS: "Intraday (MIS)",
  NRML: "Normal (NRML)",
};

export function Desk({ sample }: { sample: boolean }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"user" | "signals" | "strategies" | "algo" | "gtt">("user");
  const [ready, setReady] = useState(sample);
  const [session, setSession] = useState<SessionStatus | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    if (sample) {
      setReady(true);
      return;
    }
    api<SessionStatus>("/api/auth/status")
      .then((status) => {
        if (cancel) return;
        if (!status.authenticated) {
          void navigate({ to: "/" });
          return;
        }
        setSession(status);
        setReady(true);
      })
      .catch(() => {
        if (!cancel) {
          setReady(true);
          setProfileError("The desk service is not reachable yet.");
        }
      });
    return () => {
      cancel = true;
    };
  }, [navigate, sample]);

  useEffect(() => {
    if (!ready) return;
    let cancel = false;
    setProfileLoading(true);
    setProfileError(null);
    const path = sample ? "/api/demo/profile" : "/api/profile";
    api<Profile>(path)
      .then((next) => {
        if (!cancel) setProfile(next);
      })
      .catch((err: unknown) => {
        if (cancel) return;
        const message = err instanceof Error ? err.message : "Could not load the profile.";
        if (!sample && /sign in/i.test(message)) {
          void navigate({ to: "/" });
          return;
        }
        setProfileError(message);
      })
      .finally(() => {
        if (!cancel) setProfileLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [navigate, ready, sample]);

  async function signOut() {
    if (sample) {
      await navigate({ to: "/" });
      return;
    }
    try {
      await api("/api/auth/logout", { method: "POST" });
    } catch {
      /* still leave the desk */
    }
    await navigate({ to: "/" });
  }

  if (!ready) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-10">
        <p className="text-sm text-muted">Checking the saved session…</p>
      </main>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-border bg-bg">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <Wordmark compact />
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <AccentSwitch />
            <button
              type="button"
              onClick={() => void signOut()}
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-border px-3 text-sm text-fg hover:bg-surface"
            >
              <LogOut className="size-4" aria-hidden="true" />
              {sample ? "Exit sample" : "Sign out"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <AlgoProvider sample={sample}>
          {sample ? (
            <p className="note-watch mb-4 rounded-lg border bg-surface px-4 py-3 text-sm text-watch">
              Sample data. Prices are invented so you can learn the screen. Sign in to scan the live Nifty 100.
            </p>
          ) : session?.expires_at ? (
            <p className="mb-4 rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted">
              Access token is on the server until <span className="text-fg">{expiryLabel(session.expires_at)}</span>
              {session.flow === "totp" ? " (TOTP login)" : " (API secret login)"}. It is not in this browser.
            </p>
          ) : null}

          <div role="tablist" aria-label="Desk" className="flex flex-wrap gap-2">
            <TabButton id="user" selected={tab === "user"} onSelect={() => setTab("user")} label="User" />
            <TabButton id="signals" selected={tab === "signals"} onSelect={() => setTab("signals")} label="Signals" />
            <TabButton
              id="strategies"
              selected={tab === "strategies"}
              onSelect={() => setTab("strategies")}
              label="Strategies"
            />
            <TabButton id="algo" selected={tab === "algo"} onSelect={() => setTab("algo")} label="Algo Signals" />
            <TabButton id="gtt" selected={tab === "gtt"} onSelect={() => setTab("gtt")} label="GTT Placement" />
          </div>

          <div className="mt-5" role="tabpanel" id="panel-user" aria-labelledby="tab-user" hidden={tab !== "user"}>
            <UserPanel profile={profile} loading={profileLoading} error={profileError} />
          </div>
          <div className="mt-5" role="tabpanel" id="panel-signals" aria-labelledby="tab-signals" hidden={tab !== "signals"}>
            <SignalsPanel sample={sample} />
          </div>
          <div
            className="mt-5"
            role="tabpanel"
            id="panel-strategies"
            aria-labelledby="tab-strategies"
            hidden={tab !== "strategies"}
          >
            <StrategiesPanel sample={sample} />
          </div>
          <div className="mt-5" role="tabpanel" id="panel-algo" aria-labelledby="tab-algo" hidden={tab !== "algo"}>
            <AlgoSignalsPanel />
          </div>
          <div className="mt-5" role="tabpanel" id="panel-gtt" aria-labelledby="tab-gtt" hidden={tab !== "gtt"}>
            <GttPanel />
          </div>
        </AlgoProvider>
      </main>
    </div>
  );
}

function TabButton({
  id,
  label,
  selected,
  onSelect,
}: {
  id: string;
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      id={`tab-${id}`}
      aria-selected={selected}
      aria-controls={`panel-${id}`}
      className={
        "h-11 rounded-lg px-4 text-sm font-medium " +
        (selected ? "bg-primary text-primary-fg" : "border border-border bg-surface text-fg hover:bg-surface-2")
      }
      onClick={onSelect}
    >
      {label}
    </button>
  );
}

function UserPanel({
  profile,
  loading,
  error,
}: {
  profile: Profile | null;
  loading: boolean;
  error: string | null;
}) {
  if (loading) return <p className="text-sm text-muted">Loading profile…</p>;
  if (error) {
    return (
      <p className="note-down rounded-lg border bg-surface px-4 py-3 text-sm text-down" role="alert">
        {error}
      </p>
    );
  }
  if (!profile) return null;
  const products = profile.products.map((item) => PRODUCT_LABEL[item] ?? item);
  return (
    <section>
      <h1 className="text-2xl font-semibold tracking-tight">Account</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        Groww's profile call returns your client code, enabled segments, and exchange access. It does not
        return a display name.
        {profile.ddpi_enabled === null
          ? ""
          : profile.ddpi_enabled
            ? " DDPI is enabled on this account."
            : " DDPI is not enabled on this account."}
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <Stat label="User name" value={profile.user_name ?? "Not provided by Groww"} muted={!profile.user_name} />
        <Stat label="User ID" value={profile.user_id ?? "—"} mono />
        <Stat label="Products" value={products.length ? products.join(", ") : "—"} />
        <Stat label="Exchanges" value={profile.exchanges.length ? profile.exchanges.join(", ") : "—"} />
      </div>
    </section>
  );
}

function Stat({ label, value, mono = false, muted = false }: { label: string; value: string; mono?: boolean; muted?: boolean }) {
  return (
    <article className="rounded-lg border border-border bg-surface p-4">
      <p className="text-xs tracking-wide text-muted uppercase">{label}</p>
      <p className={(mono ? "num " : "") + "mt-2 text-lg font-medium " + (muted ? "text-muted" : "text-fg")}>{value}</p>
    </article>
  );
}

function SignalsPanel({ sample }: { sample: boolean }) {
  const [params, setParams] = useState<ScanParams>({
    short_window: 6,
    long_window: 30,
    lookback_days: 90,
    max_stocks: 25,
  });
  const [paths, setPaths] = useState(1000);
  const [horizon, setHorizon] = useState(21);
  const [job, setJob] = useState<ScanJob | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [sim, setSim] = useState<Record<string, SimResult>>({});
  const [simulating, setSimulating] = useState(false);
  const [simError, setSimError] = useState<string | null>(null);

  const rows = job?.results ?? [];
  const meta: ScanMeta | null = job?.meta ?? null;
  const shortLabel = meta?.short_window ?? params.short_window;
  const longLabel = meta?.long_window ?? params.long_window;
  const windowsMatch =
    !meta || (meta.short_window === params.short_window && meta.long_window === params.long_window && meta.lookback_days === params.lookback_days);

  useEffect(() => {
    if (!job || job.status !== "running") return;
    let cancel = false;
    const timer = window.setInterval(() => {
      api<ScanJob>(`/api/signals/jobs/${job.id}`)
        .then((next) => {
          if (cancel) return;
          setJob(next);
          if (next.status !== "running") {
            setScanning(false);
            if (next.status === "error") setScanError(next.error || "Scan failed.");
          }
        })
        .catch((err: unknown) => {
          if (cancel) return;
          setScanning(false);
          setScanError(err instanceof Error ? err.message : "Scan failed.");
        });
    }, 700);
    return () => {
      cancel = true;
      window.clearInterval(timer);
    };
  }, [job]);

  const allSelected = rows.length > 0 && rows.every((row) => selected.includes(row.ticker));

  function toggle(ticker: string) {
    setSelected((current) => (current.includes(ticker) ? current.filter((item) => item !== ticker) : [...current, ticker]));
  }

  async function generate() {
    setScanning(true);
    setScanError(null);
    setSim({});
    setSelected([]);
    setJob(null);
    try {
      const path = sample ? "/api/demo/scan" : "/api/signals/scan";
      const started = await api<{ id: string }>(path, { method: "POST", body: JSON.stringify(params) });
      setJob({
        id: started.id,
        status: "running",
        done: 0,
        total: 0,
        message: "Starting",
        results: null,
        meta: null,
        error: null,
      });
    } catch (err) {
      setScanning(false);
      setScanError(err instanceof Error ? err.message : "Scan failed.");
    }
  }

  async function simulate() {
    if (!windowsMatch) {
      setSimError("Generate signals again so the moving averages match these inputs.");
      return;
    }
    setSimulating(true);
    setSimError(null);
    try {
      const payload = await api<{ results: SimResult[] }>("/api/signals/simulate", {
        method: "POST",
        body: JSON.stringify({
          tickers: selected,
          short_window: params.short_window,
          long_window: params.long_window,
          lookback_days: params.lookback_days,
          paths,
          horizon_days: horizon,
          sample,
        }),
      });
      const next: Record<string, SimResult> = {};
      for (const row of payload.results) next[row.ticker] = row;
      setSim(next);
    } catch (err) {
      setSimError(err instanceof Error ? err.message : "Simulation failed.");
    } finally {
      setSimulating(false);
    }
  }

  const progress = job && job.total > 0 ? Math.min(100, Math.round((job.done / job.total) * 100)) : scanning ? 8 : 0;
  const counts = useMemo(() => {
    const tally = { BUY: 0, SELL: 0, HOLD: 0, WATCH: 0 };
    for (const item of Object.values(sim)) tally[item.signal] += 1;
    return tally;
  }, [sim]);

  return (
    <section>
      <h1 className="text-2xl font-semibold tracking-tight">Signals</h1>
      <p className="mt-1 max-w-3xl text-sm text-muted">
        Loads the official Nifty 100 list, matches each symbol to its NSE cash token, then reads daily candles.
        A bullish cross is the short average moving above the long average. Results are ranked by the newest cross.
      </p>

      <div className="mt-5 grid gap-3 rounded-lg border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-5">
        <NumberField label="Short SMA" value={params.short_window} onChange={(value) => setParams({ ...params, short_window: value })} />
        <NumberField label="Long SMA" value={params.long_window} onChange={(value) => setParams({ ...params, long_window: value })} />
        <NumberField label="Lookback days" value={params.lookback_days} onChange={(value) => setParams({ ...params, lookback_days: value })} />
        <NumberField label="Max stocks" value={params.max_stocks} onChange={(value) => setParams({ ...params, max_stocks: value })} />
        <div className="flex items-end">
          <button
            type="button"
            disabled={scanning}
            onClick={() => void generate()}
            className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-fg hover:opacity-90 disabled:opacity-50"
          >
            {scanning ? "Scanning…" : "Generate signals"}
          </button>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted">
        Lookback is calendar days. Max stocks is how many ranked names to show, after the full list is scanned.
        Close and both averages are the latest daily bar. A live pass can take a minute; candles are cached on the server.
      </p>

      {scanning ? (
        <div className="mt-4" aria-live="polite">
          <div className="h-2 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-2 text-xs text-muted">
            {job?.message || "Working"} {job?.total ? `· ${job.done}/${job.total}` : ""}
          </p>
        </div>
      ) : null}
      {scanError ? (
        <p className="note-down mt-4 rounded-lg border bg-surface px-4 py-3 text-sm text-down" role="alert">
          {scanError}
        </p>
      ) : null}

      {meta ? (
        <p className="mt-4 text-sm text-muted">
          {meta.with_crossover} names crossed inside {meta.lookback_days} days. Showing {meta.shown}. Matched{" "}
          {meta.matched} of {meta.universe} to an NSE token
          {meta.source === "snapshot" ? " (saved Nifty list — the live file was unavailable)" : ""}.
          {meta.unmapped.length ? ` Skipped with no token: ${meta.unmapped.join(", ")}.` : ""}
          {meta.failed.length ? ` Could not download: ${meta.failed.join(", ")}.` : ""}
        </p>
      ) : null}

      <div className="mt-4 overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-max text-left text-sm">
          <thead className="bg-surface text-xs tracking-wide text-muted uppercase">
            <tr>
              <th className="w-12 px-3 py-3">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  aria-label="Select all"
                  checked={allSelected}
                  onChange={() => setSelected(allSelected ? [] : rows.map((row) => row.ticker))}
                />
              </th>
              <th className="px-3 py-3 font-medium">Rank</th>
              <th className="px-3 py-3 font-medium">Ticker</th>
              <th className="px-3 py-3 font-medium">Company</th>
              <th className="px-3 py-3 font-medium">Crossover</th>
              <th className="px-3 py-3 font-medium">Date</th>
              <th className="px-3 py-3 text-right font-medium">Close</th>
              <th className="px-3 py-3 text-right font-medium">SMA {shortLabel}</th>
              <th className="px-3 py-3 text-right font-medium">SMA {longLabel}</th>
              <th className="px-3 py-3 font-medium">Signal</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-sm text-muted">
                  {scanning ? "Scanning the Nifty 100…" : "Generate signals to fill this table."}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <SignalTableRow
                  key={row.ticker}
                  row={row}
                  checked={selected.includes(row.ticker)}
                  onToggle={() => toggle(row.ticker)}
                  sim={sim[row.ticker]}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-5 rounded-lg border border-border bg-surface p-4">
        <h2 className="text-base font-semibold">Monte Carlo</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          Pick names in the table. Each path resamples that stock's own daily returns and walks them forward.
          The same candles and settings always give the same label. This is a study, not an order, and nothing is sent
          to the exchange.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <NumberField label="Paths" value={paths} onChange={setPaths} />
          <NumberField label="Horizon days" value={horizon} onChange={setHorizon} />
          <div className="flex items-end lg:col-span-2">
            <button
              type="button"
              disabled={simulating || selected.length === 0}
              onClick={() => void simulate()}
              className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-fg hover:opacity-90 disabled:opacity-50"
            >
              {simulating ? "Simulating…" : `Run simulation${selected.length ? ` (${selected.length})` : ""}`}
            </button>
          </div>
        </div>
        {!windowsMatch ? (
          <p className="mt-3 text-xs text-watch">Inputs changed. Generate signals again before simulating.</p>
        ) : null}
        {simError ? (
          <p className="mt-3 text-sm text-down" role="alert">
            {simError}
          </p>
        ) : null}
        {Object.keys(sim).length > 0 ? (
          <p className="num mt-3 text-xs text-muted">
            BUY {counts.BUY} · SELL {counts.SELL} · WATCH {counts.WATCH} · HOLD {counts.HOLD}
          </p>
        ) : null}
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {GUIDE.map((item) => (
            <li key={item.signal} className="flex gap-2 text-xs text-muted">
              <SignalChip signal={item.signal} />
              <span>{item.text}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function SignalTableRow({
  row,
  checked,
  onToggle,
  sim,
}: {
  row: SignalRow;
  checked: boolean;
  onToggle: () => void;
  sim?: SimResult;
}) {
  const bullish = row.crossover_type === "bullish";
  return (
    <tr className={checked ? "border-t border-border bg-surface-2" : "border-t border-border"}>
      <td className="px-3 py-3">
        <input
          type="checkbox"
          className="size-4 accent-primary"
          aria-label={`Select ${row.ticker}`}
          checked={checked}
          onChange={onToggle}
        />
      </td>
      <td className="num px-3 py-3 text-muted">{row.rank}</td>
      <td className="px-3 py-3">
        <div className="font-medium">{row.ticker}</div>
        <div className="num text-xs text-muted">NSE {row.nse_token}</div>
      </td>
      <td className="max-w-56 truncate px-3 py-3 text-muted" title={row.company}>
        {row.company}
      </td>
      <td className="px-3 py-3">
        <span className={"rounded-full px-2 py-1 text-xs font-medium " + (bullish ? "tone-up" : "tone-down")}>
          {bullish ? "Bullish" : "Bearish"}
        </span>
      </td>
      <td className="num px-3 py-3 whitespace-nowrap">{prettyDate(row.crossover_date)}</td>
      <td className="num px-3 py-3 text-right">{inr(row.close)}</td>
      <td className="num px-3 py-3 text-right">{inr(row.sma_short)}</td>
      <td className="num px-3 py-3 text-right">{inr(row.sma_long)}</td>
      <td className="px-3 py-3">
        {sim ? (
          <div>
            <SignalChip signal={sim.signal} />
            <p className="mt-1 max-w-48 text-xs text-muted">{sim.reason}</p>
          </div>
        ) : (
          <span className="text-muted">—</span>
        )}
      </td>
    </tr>
  );
}

function SignalChip({ signal }: { signal: SimResult["signal"] }) {
  const tone =
    signal === "BUY" ? "tone-up" : signal === "SELL" ? "tone-down" : signal === "WATCH" ? "tone-watch" : "tone-hold";
  return <span className={`num rounded-full px-2 py-1 text-xs font-medium ${tone}`}>{signal}</span>;
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="block text-sm">
      <span className="mb-1.5 block text-xs font-medium tracking-wide text-muted uppercase">{label}</span>
      <input
        className={fieldClass + " num"}
        type="number"
        inputMode="numeric"
        value={Number.isFinite(value) ? value : 0}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}
