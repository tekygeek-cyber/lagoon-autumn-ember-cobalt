import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import { previewPathPrefix } from "@/lib/preview-path-prefix";
import { scanBook, type ScanHit } from "@/lib/breakout";

export type GttRow = {
  symbol: string;
  quantity: number;
  buy_price: number | null;
  stoploss: number | null;
  tick_size: number | null;
  last_price: number | null;
  account_state: string;
  position_quantity: number;
  active_buy_trigger_id: string | null;
  active_stoploss_trigger_id: string | null;
  day_buy_order_id: string | null;
  day_buy_order_status: string | null;
  buy_status: string;
  buy_trigger_id: string | null;
  stoploss_status: string | null;
  stoploss_trigger_id: string | null;
  message: string;
};

type Stock = {
  trading_symbol: string;
  company_name: string;
  exchange_token: string;
  tick_size?: number;
  candles: unknown[];
};

type ScannerPayload = {
  metadata: { live_status?: string; sample?: boolean };
  stocks: Stock[];
};

type AlgoValue = {
  sample: boolean;
  loading: boolean;
  error: string | null;
  liveStatus: string;
  tickStatus: string;
  scanned: number;
  hits: ScanHit[];
  selected: string | null;
  setSelected: (symbol: string) => void;
  priceFor: (hit: ScanHit) => number | null;
  ltpFor: (hit: ScanHit) => number | null;
  gttRows: GttRow[];
  gttError: string | null;
  running: boolean;
  runLive: () => Promise<void>;
};

const AlgoContext = createContext<AlgoValue | null>(null);

export function AlgoProvider({ sample, children }: { sample: boolean; children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [liveStatus, setLiveStatus] = useState("Connecting to the tape…");
  const [tickStatus, setTickStatus] = useState("Tick socket idle");
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [ticks, setTicks] = useState<Record<string, number>>({});
  const [snapshot, setSnapshot] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [gttRows, setGttRows] = useState<GttRow[]>([]);
  const [gttError, setGttError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const load = useCallback(
    async (refresh: boolean) => {
      const query = `?sample=${sample ? "true" : "false"}${refresh ? "&refresh=true" : ""}`;
      const payload = await api<ScannerPayload>(`/api/scanner-data${query}`);
      setStocks(payload.stocks ?? []);
      setLiveStatus(payload.metadata?.live_status || "Scanner cache loaded");
      return payload.stocks ?? [];
    },
    [sample],
  );

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    setError(null);
    load(false)
      .catch((err: unknown) => {
        if (!cancel) setError(err instanceof Error ? err.message : "Could not load the scanner.");
      })
      .finally(() => {
        if (!cancel) setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [load]);

  const book = useMemo(() => scanBook(stocks), [stocks]);
  const tokens = book.hits.map((hit) => hit.exchange_token).filter(Boolean).join(",");

  useEffect(() => {
    if (!tokens || typeof window === "undefined") return;
    const prefix = previewPathPrefix(window.location.hostname, window.location.pathname) ?? "";
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(`${proto}//${window.location.host}${prefix}/ws/ticks?tokens=${tokens}&mode=full`);
    setTickStatus("Tick socket connecting");
    socket.onopen = () => setTickStatus("Tick socket live");
    socket.onerror = () => setTickStatus("Tick socket unavailable. Using the OHLC snapshot.");
    socket.onclose = () => setTickStatus("Tick socket closed");
    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(String(event.data)) as { ticks?: Array<{ exchange_token: string; ltp: number }> };
        const next: Record<string, number> = {};
        for (const tick of payload.ticks ?? []) {
          if (tick.exchange_token && Number.isFinite(tick.ltp)) next[tick.exchange_token] = tick.ltp;
        }
        if (Object.keys(next).length) setTicks((current) => ({ ...current, ...next }));
      } catch {
        /* ignore a bad frame */
      }
    };
    return () => socket.close();
  }, [tokens]);

  const priceFor = useCallback(
    (hit: ScanHit) => {
      const live = ticks[hit.exchange_token];
      if (Number.isFinite(live)) return live;
      const shot = snapshot[hit.symbol];
      if (Number.isFinite(shot)) return shot;
      return hit.currentPrice;
    },
    [snapshot, ticks],
  );

  const runLive = useCallback(async () => {
    setRunning(true);
    setGttError(null);
    try {
      const fresh = await load(true);
      const scanned = scanBook(fresh);
      const symbols = scanned.hits.map((hit) => hit.symbol).join(",");
      let shot: Record<string, number> = {};
      if (symbols) {
        const ohlc = await api<{ prices: Record<string, { last_price?: number }> }>(
          `/api/ohlc-snapshot?sample=${sample ? "true" : "false"}&symbols=${encodeURIComponent(symbols)}`,
        );
        shot = Object.fromEntries(
          Object.entries(ohlc.prices ?? {})
            .filter((entry) => Number.isFinite(entry[1]?.last_price))
            .map(([symbol, row]) => [symbol, Number(row.last_price)]),
        );
        setSnapshot((current) => ({ ...current, ...shot }));
      }
      const candidates = scanned.hits.map((hit) => {
        const stock = fresh.find((item) => item.trading_symbol === hit.symbol);
        const last = ticks[hit.exchange_token] ?? shot[hit.symbol] ?? null;
        return {
          symbol: hit.symbol,
          buy_price: hit.breakoutLow,
          last_price: last,
          tick_size: stock?.tick_size ?? 0.05,
          exchange_token: hit.exchange_token,
        };
      });
      const state = await api<{ rows: GttRow[] }>("/api/algo-orders/gtt-state", {
        method: "POST",
        body: JSON.stringify({ sample, confirm_live: false, candidates }),
      });
      const ready = (state.rows ?? []).filter(
        (row) => row.buy_status === "ready" && row.buy_price != null && row.stoploss != null && row.last_price != null,
      );
      let placed: GttRow[] = [];
      if (ready.length) {
        const live = await api<{ rows: GttRow[] }>("/api/algo-orders/live-gtt", {
          method: "POST",
          body: JSON.stringify({
            sample,
            confirm_live: true,
            candidates: ready.map((row) => ({
              symbol: row.symbol,
              buy_price: row.buy_price,
              last_price: row.last_price,
              tick_size: row.tick_size,
            })),
          }),
        });
        placed = live.rows ?? [];
      }
      const bySymbol = new Map<string, GttRow>();
      for (const row of state.rows ?? []) bySymbol.set(row.symbol, row);
      for (const row of placed) bySymbol.set(row.symbol, row);
      setGttRows([...bySymbol.values()]);
    } catch (err) {
      setGttError(err instanceof Error ? err.message : "Run Live failed.");
    } finally {
      setRunning(false);
    }
  }, [load, sample, ticks]);

  const ltpFor = useCallback(
    (hit: ScanHit) => {
      const live = ticks[hit.exchange_token];
      if (Number.isFinite(live)) return live;
      const shot = snapshot[hit.symbol];
      if (Number.isFinite(shot)) return shot;
      return null;
    },
    [snapshot, ticks],
  );

  const value: AlgoValue = {
    sample,
    loading,
    error,
    liveStatus,
    tickStatus,
    scanned: book.scanned,
    hits: book.hits,
    selected,
    setSelected,
    priceFor,
    ltpFor,
    gttRows,
    gttError,
    running,
    runLive,
  };

  return <AlgoContext.Provider value={value}>{children}</AlgoContext.Provider>;
}

export function useAlgo(): AlgoValue {
  const value = useContext(AlgoContext);
  if (!value) throw new Error("Algo book is missing.");
  return value;
}
