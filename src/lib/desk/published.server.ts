/**
 * Desk API for the published site.
 *
 * Vercel runs this Node server. It does not run a second Python process and
 * it does not open port 8090. This module answers /api on the same HTTPS origin.
 * Groww calls, when a login needs them, go to https://api.groww.in only.
 * Order placement is not implemented.
 */
import { createHash, randomBytes } from "node:crypto";
import book from "../../../backend/nifty100.snapshot.csv?raw";

const GROWW = "https://api.groww.in";
const ALLOWED = new Set(["/v1/token/api/access", "/v1/user/detail", "/v1/historical/candles"]);

type Session = { token: string; flow: string; expiresAt: string };
type Candle = { date: string; open: number; high: number; low: number; close: number; volume: number };
type Job = {
  id: string;
  status: "running" | "done" | "error";
  done: number;
  total: number;
  message: string;
  results: Record<string, unknown>[] | null;
  meta: Record<string, unknown> | null;
  error: string | null;
};

const g = globalThis as typeof globalThis & {
  __deskSession?: Session | null;
  __deskJobs?: Map<string, Job>;
  __deskAuto?: Record<string, AutoState>;
  __deskDummies?: Dummy[];
};

type AutoState = {
  enabled: boolean;
  mode: string;
  live_armed: boolean;
  strategy: string;
  quantity: number;
  max_orders: number;
  symbols: string[];
  sample: boolean;
  positions: Record<string, unknown>;
  log: { at: string; note: string; status: string }[];
  last_cycle: string | null;
};

type Dummy = { id: string; symbol: string; status: string; transaction_type: string; buy_price: number };

function jobs() {
  g.__deskJobs ??= new Map();
  return g.__deskJobs;
}

function dummies() {
  g.__deskDummies ??= [];
  return g.__deskDummies;
}

const CATALOG = [
  { id: "turtle", name: "Turtle breakout", source: "Richard Dennis and William Eckhardt, published 1983 rules", summary: "Buy when the close breaks the prior 20-day high. Sell when it breaks the prior 10-day low." },
  { id: "golden", name: "Golden cross", source: "Classic trend followers, 50-day and 200-day averages", summary: "Buy when the 50-day average crosses above the 200-day. Sell on the reverse cross." },
  { id: "connors", name: "Connors RSI-2", source: "Larry Connors, published short-term mean reversion", summary: "Buy when RSI(2) is under 10 and price is above the 200-day average. Sell when RSI(2) is over 70." },
  { id: "bollinger", name: "Bollinger revert", source: "John Bollinger bands, 20 days and 2 standard deviations", summary: "Buy a close under the lower band. Sell when price is back at the middle band." },
  { id: "macd", name: "MACD cross", source: "Gerald Appel, 12 / 26 / 9", summary: "Buy when the MACD line crosses above its signal line. Sell on the reverse cross." },
  { id: "momentum", name: "Six-month momentum", source: "Jegadeesh and Titman momentum, simplified for one stock", summary: "Buy when the six-month return is positive and price is above the 200-day average. Sell when the six-month return turns negative." },
];

const NAMES = String(book)
  .trim()
  .split(/\r?\n/)
  .slice(1)
  .map((line) => {
    const [company, , symbol] = line.split(",");
    return { company: company ?? "", symbol: (symbol ?? "").trim().toUpperCase() };
  })
  .filter((row) => row.symbol);

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

function fail(detail: string, status: number) {
  return json({ detail }, status);
}

function istNow() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
}

function nextExpiry() {
  const current = istNow();
  const six = new Date(current);
  six.setHours(6, 0, 0, 0);
  if (current >= six) six.setDate(six.getDate() + 1);
  return six.toISOString();
}

function sessionOk(): Session | null {
  const saved = g.__deskSession;
  if (!saved) return null;
  if (Date.now() >= Date.parse(saved.expiresAt)) {
    g.__deskSession = null;
    return null;
  }
  return saved;
}

async function groww(
  path: string,
  token: string,
  init?: { method?: string; body?: unknown; query?: string },
): Promise<Record<string, unknown>> {
  if (!ALLOWED.has(path)) throw new Error("That Groww call is not enabled.");
  if (path.includes("order")) throw new Error("Trading is disabled.");
  const response = await fetch(`${GROWW}${path}${init?.query ?? ""}`, {
    method: init?.method ?? "GET",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "x-client-id": "growwapi",
      "x-client-platform": "growwapi-python-client",
      "x-client-platform-version": "1.5.0",
      "x-api-version": "1.0",
    },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    token?: string;
    error?: { displayMessage?: string; message?: string };
    errorMessage?: { message?: string };
    payload?: Record<string, unknown>;
    status?: string;
  };
  if (response.status === 401) {
    throw Object.assign(new Error("Authentication failed. Your API token has either expired or is invalid."), { status: 401 });
  }
  if (!response.ok || payload.status === "FAILURE") {
    const message =
      payload.error?.displayMessage ||
      payload.error?.message ||
      payload.errorMessage?.message ||
      "Groww refused the request.";
    throw Object.assign(new Error(message), { status: response.status });
  }
  const body = (payload.payload ?? payload) as Record<string, unknown>;
  return body;
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function weekdays(count: number) {
  const days: string[] = [];
  const cursor = new Date();
  while (days.length < count) {
    if (cursor.getDay() !== 0 && cursor.getDay() !== 6) days.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() - 1);
  }
  return days.reverse();
}

function adler(text: string) {
  let a = 1;
  let b = 0;
  for (let i = 0; i < text.length; i += 1) {
    a = (a + text.charCodeAt(i)) % 65521;
    b = (b + a) % 65521;
  }
  return (b << 16) | a;
}

function demoCloses(symbol: string, kind: string, daysAgo: number, strength: string, n = 180) {
  const drift = strength === "strong" ? (kind === "bullish" ? 0.0045 : -0.0045) : 0;
  const dip = kind === "bullish" ? 0.9 : strength === "strong" ? 1.1 : 1.12;
  const crossAt = Math.max(14, n - 1 - Math.max(0, daysAgo));
  const closes: number[] = [];
  let price = 100;
  for (let i = 0; i < n; i += 1) {
    price *= Math.exp(drift);
    closes.push(price);
  }
  for (let i = crossAt - 12; i < crossAt; i += 1) closes[i] *= dip;
  const scale = 0.65 + (adler(symbol) % 280) / 100;
  return weekdays(n).map((date, index) => ({ date, close: Math.round(closes[index] * scale * 100) / 100 }));
}

function sma(values: number[], window: number) {
  const out = values.map(() => Number.NaN);
  let sum = 0;
  for (let i = 0; i < values.length; i += 1) {
    sum += values[i];
    if (i >= window) sum -= values[i - window];
    if (i >= window - 1) out[i] = sum / window;
  }
  return out;
}

function latestCross(candles: { date: string; close: number }[], shortW: number, longW: number, lookback: number) {
  const closes = candles.map((row) => row.close);
  const short = sma(closes, shortW);
  const long = sma(closes, longW);
  let found: { crossover_type: string; crossover_date: string; close: number; sma_short: number; sma_long: number; bars_since: number } | null = null;
  for (let i = 1; i < closes.length; i += 1) {
    if ([short[i], long[i], short[i - 1], long[i - 1]].some((value) => Number.isNaN(value))) continue;
    const prev = short[i - 1] - long[i - 1];
    const curr = short[i] - long[i];
    const kind = prev <= 0 && curr > 0 ? "bullish" : prev >= 0 && curr < 0 ? "bearish" : null;
    if (!kind) continue;
    found = {
      crossover_type: kind,
      crossover_date: candles[i].date,
      close: Math.round(closes[closes.length - 1] * 100) / 100,
      sma_short: Math.round(short[short.length - 1] * 100) / 100,
      sma_long: Math.round(long[long.length - 1] * 100) / 100,
      bars_since: closes.length - 1 - i,
    };
  }
  if (!found) return null;
  const cutoff = Date.now() - lookback * 86400000;
  if (Date.parse(found.crossover_date) < cutoff) return null;
  return found;
}

function monteCarlo(ticker: string, candles: { close: number }[], cross: NonNullable<ReturnType<typeof latestCross>>, paths: number, horizon: number) {
  const closes = candles.map((row) => row.close);
  const returns: number[] = [];
  for (let i = 1; i < closes.length; i += 1) {
    if (closes[i - 1] > 0 && closes[i] > 0) returns.push(Math.log(closes[i] / closes[i - 1]));
  }
  let pUp = 0.5;
  let median = 0;
  let p05 = 0;
  let p95 = 0;
  if (returns.length >= 20) {
    const seed = adler(`${ticker}:${paths}:${horizon}:${returns.length}`) >>> 0;
    let state = seed || 1;
    const next = () => {
      state = (1664525 * state + 1013904223) >>> 0;
      return state / 4294967296;
    };
    const terminals: number[] = [];
    for (let path = 0; path < paths; path += 1) {
      let total = 0;
      for (let step = 0; step < horizon; step += 1) total += returns[Math.floor(next() * returns.length)];
      terminals.push(Math.expm1(total));
    }
    terminals.sort((a, b) => a - b);
    pUp = terminals.filter((value) => value > 0).length / terminals.length;
    median = terminals[Math.floor(terminals.length / 2)] ?? 0;
    p05 = terminals[Math.floor(terminals.length * 0.05)] ?? 0;
    p95 = terminals[Math.floor(terminals.length * 0.95)] ?? 0;
  }
  const fresh = cross.bars_since <= 4;
  const signal =
    returns.length < 20
      ? "HOLD"
      : cross.crossover_type === "bullish" && pUp >= 0.58 && median > 0
        ? "BUY"
        : cross.crossover_type === "bearish" && pUp <= 0.42 && median < 0
          ? "SELL"
          : fresh
            ? "WATCH"
            : "HOLD";
  const pct = `${Math.round(pUp * 100)}%`;
  const med = `${median >= 0 ? "+" : ""}${(median * 100).toFixed(1)}%`;
  const reason =
    returns.length < 20
      ? "Not enough daily history to simulate."
      : signal === "BUY"
        ? `${pct} of paths ended higher (median ${med}).`
        : signal === "SELL"
          ? `Only ${pct} of paths ended higher (median ${med}).`
          : signal === "WATCH"
            ? `Cross is ${cross.bars_since} session(s) old and the edge is thin (${pct} up, median ${med}).`
            : `No strong edge (${pct} up, median ${med}).`;
  return {
    ticker,
    signal,
    p_up: Math.round(pUp * 10000) / 10000,
    median_return: Math.round(median * 10000) / 10000,
    p05: Math.round(p05 * 10000) / 10000,
    p95: Math.round(p95 * 10000) / 10000,
    paths,
    horizon_days: horizon,
    reason,
  };
}

function ema(values: number[], span: number) {
  const out = values.map(() => Number.NaN);
  if (values.length < span) return out;
  const alpha = 2 / (span + 1);
  let prev = values.slice(0, span).reduce((sum, value) => sum + value, 0) / span;
  out[span - 1] = prev;
  for (let i = span; i < values.length; i += 1) {
    prev = alpha * values[i] + (1 - alpha) * prev;
    out[i] = prev;
  }
  return out;
}

function rsi(closes: number[], period: number) {
  const out = closes.map(() => Number.NaN);
  if (closes.length <= period) return out;
  const gain = closes.map((value, index) => (index === 0 ? 0 : Math.max(0, value - closes[index - 1])));
  const loss = closes.map((value, index) => (index === 0 ? 0 : Math.max(0, closes[index - 1] - value)));
  let avgGain = gain.slice(1, period + 1).reduce((sum, value) => sum + value, 0) / period;
  let avgLoss = loss.slice(1, period + 1).reduce((sum, value) => sum + value, 0) / period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < closes.length; i += 1) {
    avgGain = (avgGain * (period - 1) + gain[i]) / period;
    avgLoss = (avgLoss * (period - 1) + loss[i]) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

function backtest(strategy: string, candles: { date: string; close: number }[]) {
  if (!CATALOG.some((item) => item.id === strategy)) throw new Error("Pick a strategy from the list.");
  const rows = [...candles].sort((a, b) => a.date.localeCompare(b.date));
  if (rows.length < 40) throw new Error("Not enough daily history. Need at least 40 closes.");
  const closes = rows.map((row) => row.close);
  const enter = closes.map(() => false);
  const leave = closes.map(() => false);
  if (strategy === "turtle") {
    for (let i = 20; i < closes.length; i += 1) {
      const hi = Math.max(...closes.slice(i - 20, i));
      const lo = Math.max(i - 10, 0) === i ? closes[i] : Math.min(...closes.slice(Math.max(0, i - 10), i));
      enter[i] = closes[i] > hi;
      leave[i] = i >= 10 && closes[i] < lo;
    }
  } else if (strategy === "golden") {
    const fast = sma(closes, 50);
    const slow = sma(closes, 200);
    for (let i = 0; i < closes.length; i += 1) {
      if (Number.isNaN(fast[i]) || Number.isNaN(slow[i])) continue;
      enter[i] = fast[i] > slow[i];
      leave[i] = fast[i] < slow[i];
    }
  } else if (strategy === "connors") {
    const strength = rsi(closes, 2);
    const trend = sma(closes, 200);
    for (let i = 0; i < closes.length; i += 1) {
      enter[i] = strength[i] < 10 && closes[i] > trend[i];
      leave[i] = strength[i] > 70;
    }
  } else if (strategy === "bollinger") {
    const mid = sma(closes, 20);
    for (let i = 19; i < closes.length; i += 1) {
      const chunk = closes.slice(i - 19, i + 1);
      const mean = chunk.reduce((sum, value) => sum + value, 0) / chunk.length;
      const sigma = Math.sqrt(chunk.reduce((sum, value) => sum + (value - mean) ** 2, 0) / chunk.length);
      enter[i] = closes[i] < mid[i] - 2 * sigma;
      leave[i] = closes[i] >= mid[i];
    }
  } else if (strategy === "macd") {
    const line = ema(closes, 12).map((value, index) => value - ema(closes, 26)[index]);
    const signal = ema(line.map((value) => (Number.isNaN(value) ? 0 : value)), 9);
    for (let i = 1; i < closes.length; i += 1) {
      if ([line[i], signal[i], line[i - 1], signal[i - 1]].some((value) => Number.isNaN(value))) continue;
      if (line[i - 1] <= signal[i - 1] && line[i] > signal[i]) enter[i] = true;
      if (line[i - 1] >= signal[i - 1] && line[i] < signal[i]) leave[i] = true;
    }
  } else {
    const trend = sma(closes, 200);
    for (let i = 126; i < closes.length; i += 1) {
      const gain = closes[i] / closes[i - 126] - 1;
      if (gain > 0 && closes[i] > trend[i]) enter[i] = true;
      if (gain < 0) leave[i] = true;
    }
  }
  let inPos = false;
  let entryPrice = 0;
  let entryDate = "";
  const trades: { entry_date: string; exit_date: string | null; return: number; open?: boolean }[] = [];
  let equity = 1;
  let peak = 1;
  let maxDd = 0;
  closes.forEach((price, index) => {
    if (price <= 0) return;
    if (inPos && leave[index]) {
      const ret = price / entryPrice - 1;
      equity *= 1 + ret;
      trades.push({ entry_date: entryDate, exit_date: rows[index].date, return: Math.round(ret * 10000) / 10000 });
      inPos = false;
    } else if (!inPos && enter[index] && !leave[index]) {
      inPos = true;
      entryPrice = price;
      entryDate = rows[index].date;
    }
    const marked = inPos && entryPrice ? equity * (price / entryPrice) : equity;
    peak = Math.max(peak, marked);
    if (peak > 0) maxDd = Math.min(maxDd, marked / peak - 1);
  });
  const marked = inPos && entryPrice ? equity * (closes[closes.length - 1] / entryPrice) : equity;
  const wins = trades.filter((trade) => trade.return > 0).length;
  const shown = trades.slice(-5).map((trade) => ({ ...trade, open: false }));
  if (inPos && entryPrice) {
    shown.push({
      entry_date: entryDate,
      exit_date: null,
      return: Math.round((closes[closes.length - 1] / entryPrice - 1) * 10000) / 10000,
      open: true,
    });
  }
  return {
    strategy,
    bars: rows.length,
    from: rows[0].date,
    to: rows[rows.length - 1].date,
    trades: trades.length,
    win_rate: trades.length ? Math.round((wins / trades.length) * 10000) / 10000 : null,
    total_return: Math.round((marked - 1) * 10000) / 10000,
    max_drawdown: Math.round(maxDd * 10000) / 10000,
    open: inPos,
    stance: inPos ? "LONG" : "FLAT",
    last_close: Math.round(closes[closes.length - 1] * 100) / 100,
    recent_trades: shown.slice(-5),
  };
}

function bar(date: string, open: number, high: number, low: number, close: number, volume: number): Candle {
  return { date, open, high, low, close, volume };
}

function makeSetup(age: number, distance: number, count = 50): Candle[] {
  const dates = weekdays(count);
  const breakout = count - 1 - age;
  const rows = dates.map((date, index) => {
    if (index < breakout) return bar(date, 100, 101, 99, 100.2, 1000);
    if (index === breakout) return bar(date, 101, 112, 106, 110, 5000);
    return bar(date, 111, index === breakout + 1 ? 118 : 114, 108, 111, 800);
  });
  const last = Math.round(109 * (1 + distance / 100) * 100) / 100;
  rows[rows.length - 1].close = last;
  rows[rows.length - 1].high = Math.max(rows[rows.length - 1].high, last);
  rows[rows.length - 1].low = Math.min(rows[rows.length - 1].low, last);
  return rows;
}

function sampleStocks() {
  const plans: [string, string][] = [
    ["setup", "2:0.20"],
    ["setup", "5:-0.40"],
    ["setup", "9:0.80"],
    ["setup", "14:0.00"],
    ["quiet", ""],
    ["quiet", ""],
    ["nofollow", ""],
    ["far", "5.00"],
  ];
  return NAMES.slice(0, 8).map((item, index) => {
    const [kind, arg] = plans[index] ?? ["quiet", ""];
    let candles: Candle[];
    if (kind === "setup" || kind === "far") {
      const [age, distance] = kind === "far" ? [4, Number(arg)] : arg.split(":").map(Number);
      candles = makeSetup(age, distance);
    } else if (kind === "nofollow") {
      const dates = weekdays(50);
      const breakout = 44;
      candles = dates.map((date, i) => (i === breakout ? bar(date, 101, 112, 106, 110, 5000) : bar(date, 100, 111, 99, 100.2, 1000)));
      candles[49].close = 109;
    } else {
      candles = weekdays(50).map((date) => bar(date, 100, 101, 99, 100.2, 1000));
    }
    return {
      trading_symbol: item.symbol,
      company_name: item.company,
      exchange_token: `SAMPLE-${index + 1}`,
      nifty_flags: { nifty100: true },
      tick_size: 0.05,
      candles,
    };
  });
}

function defaultAuto(sample: boolean): AutoState {
  return {
    enabled: false,
    mode: "paper",
    live_armed: false,
    strategy: "turtle",
    quantity: 1,
    max_orders: 3,
    symbols: [],
    sample,
    positions: {},
    log: [],
    last_cycle: null,
  };
}

function publicAuto(state: AutoState) {
  return { ...state, positions: state.positions, log: state.log };
}

function roundTick(price: number, tick: number) {
  if (!(tick > 0) || !(price > 0)) return null;
  return Math.round(price / tick) * tick;
}

function evaluate(candidate: Record<string, unknown>) {
  const symbol = String(candidate.symbol ?? "").toUpperCase();
  const tick = Number(candidate.tick_size ?? 0.05) || 0.05;
  const last = candidate.last_price == null || candidate.last_price === "" ? null : Number(candidate.last_price);
  const buyRaw = candidate.buy_price == null || candidate.buy_price === "" ? null : Number(candidate.buy_price);
  const row = {
    symbol,
    quantity: 1,
    buy_price: null as number | null,
    stoploss: null as number | null,
    tick_size: tick,
    last_price: Number.isFinite(last) ? last : null,
    account_state: "unknown",
    position_quantity: 0,
    active_buy_trigger_id: null as string | null,
    active_stoploss_trigger_id: null,
    day_buy_order_id: null,
    day_buy_order_status: null,
    buy_status: "invalid",
    buy_trigger_id: null as string | null,
    stoploss_status: null as string | null,
    stoploss_trigger_id: null,
    message: "Buy price is not available for this row.",
  };
  if (buyRaw == null || !Number.isFinite(buyRaw) || buyRaw <= 0) return row;
  const buy = roundTick(buyRaw, tick);
  const stop = buy == null ? null : roundTick(buy * 0.95, tick);
  if (buy == null || stop == null) {
    row.message = "Trigger price should be a multiple of tick size.";
    return row;
  }
  row.buy_price = Math.round(buy * 100) / 100;
  row.stoploss = Math.round(stop * 100) / 100;
  row.stoploss_status = "planned_after_buy";
  if (row.last_price == null) {
    row.message = "Waiting for LTP.";
    row.buy_status = "waiting";
    return row;
  }
  const existing = dummies().find((item) => item.symbol === symbol && item.status === "ACTIVE");
  if (existing) {
    row.account_state = "already_active";
    row.buy_status = "already_active";
    row.active_buy_trigger_id = existing.id;
    row.buy_trigger_id = existing.id;
    row.message = "Skipped: dummy buy GTT already active.";
    return row;
  }
  row.account_state = "clear";
  row.buy_status = "ready";
  row.message = "Ready for buy GTT placement.";
  return row;
}

async function readJson(request: Request) {
  if (request.method === "GET" || request.method === "HEAD") return {};
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function handlePublishedDesk(request: Request, path: string): Promise<Response> {
  const url = new URL(path, "https://desk.invalid");
  const route = url.pathname;
  const sample = url.searchParams.get("sample") === "true";
  const body = await readJson(request);

  if (request.method === "GET" && route === "/api/health") return json({ ok: true });

  if (request.method === "GET" && route === "/api/auth/status") {
    const saved = sessionOk();
    return json(saved ? { authenticated: true, expires_at: saved.expiresAt, flow: saved.flow } : { authenticated: false });
  }

  if (request.method === "POST" && route === "/api/auth/logout") {
    g.__deskSession = null;
    return json({ ok: true });
  }

  if (request.method === "POST" && route === "/api/auth/login") {
    const apiKey = String(body.api_key ?? "").trim();
    const secret = String(body.api_secret ?? "").trim();
    const requestToken = String(body.request_token ?? "").replace(/\s/g, "");
    if (!apiKey) return fail("API key is required.", 400);
    if (secret && requestToken) return fail("Use either the API secret or a request token, not both. Groww's SDK takes one of them.", 400);
    if (!secret && !requestToken) return fail("Enter the API secret, or put a 6-digit TOTP in Request token.", 400);
    const timestamp = Math.floor(Date.now() / 1000);
    const payload = requestToken
      ? { key_type: "totp", totp: requestToken }
      : { key_type: "approval", checksum: sha256(secret + String(timestamp)), timestamp };
    try {
      const result = await groww("/v1/token/api/access", apiKey, { method: "POST", body: payload });
      const token = typeof result.token === "string" ? result.token : "";
      if (token.length < 12) return fail("Groww did not return an access token.", 502);
      const saved = { token, flow: requestToken ? "totp" : "approval", expiresAt: nextExpiry() };
      g.__deskSession = saved;
      return json({ ok: true, expires_at: saved.expiresAt, flow: saved.flow });
    } catch (error) {
      const status = (error as { status?: number }).status;
      return fail(error instanceof Error ? error.message : "Groww refused the login.", status === 401 ? 401 : 400);
    }
  }

  if (request.method === "GET" && route === "/api/demo/profile") {
    return json({
      user_name: "Sample session",
      user_id: "SAMPLE",
      products: ["CASH", "FNO"],
      exchanges: ["NSE", "BSE"],
      ddpi_enabled: false,
      sample: true,
    });
  }

  if (request.method === "GET" && route === "/api/profile") {
    const saved = sessionOk();
    if (!saved) return fail("Sign in again. There is no saved Groww access token, or it expired at 6:00 AM IST.", 401);
    try {
      const raw = await groww("/v1/user/detail", saved.token);
      const products = Array.isArray(raw.active_segments) ? raw.active_segments.map(String) : [];
      const exchanges = [raw.nse_enabled ? "NSE" : "", raw.bse_enabled ? "BSE" : ""].filter(Boolean);
      return json({
        user_name: typeof raw.user_name === "string" ? raw.user_name : null,
        user_id: raw.ucc ? String(raw.ucc) : null,
        products,
        exchanges,
        ddpi_enabled: "ddpi_enabled" in raw ? Boolean(raw.ddpi_enabled) : null,
        sample: false,
      });
    } catch (error) {
      return fail(error instanceof Error ? error.message : "Groww refused the profile.", 502);
    }
  }

  if (request.method === "GET" && route === "/api/strategies") return json({ strategies: CATALOG });

  if (request.method === "POST" && (route === "/api/demo/scan" || route === "/api/signals/scan")) {
    const live = route === "/api/signals/scan";
    if (live && !sessionOk()) return fail("Sign in again. There is no saved Groww access token, or it expired at 6:00 AM IST.", 401);
    const shortW = Number(body.short_window ?? 6);
    const longW = Number(body.long_window ?? 30);
    const lookback = Number(body.lookback_days ?? 90);
    const maxStocks = Number(body.max_stocks ?? 25);
    if (!(2 <= shortW && shortW < longW && longW <= 300)) return fail("Short SMA must be smaller than long SMA. 6 and 30 is a good start.", 400);
    const id = randomBytes(16).toString("hex");
    const rows = NAMES.map((item, index) => {
      const plan = index < 5 ? ["bullish", index % 3, "strong"] : index < 10 ? ["bearish", (index - 5) % 3, "strong"] : ["bullish", 8, "mild"];
      const candles = demoCloses(item.symbol, plan[0] as string, Number(plan[1]), plan[2] as string);
      const cross = latestCross(candles, shortW, longW, lookback);
      if (!cross) return null;
      return { ticker: item.symbol, company: item.company, nse_token: `SAMPLE-${index + 1}`, ...cross };
    }).filter((row) => row != null);
    rows.sort((a, b) => b!.crossover_date.localeCompare(a!.crossover_date) || a!.ticker.localeCompare(b!.ticker));
    const shown = rows.slice(0, maxStocks).map((row, index) => ({ ...row, rank: index + 1 }));
    const job: Job = {
      id,
      status: "done",
      done: NAMES.length,
      total: NAMES.length,
      message: "Done",
      results: shown,
      meta: {
        sample: !live,
        universe: NAMES.length,
        matched: NAMES.length,
        with_crossover: rows.length,
        shown: shown.length,
        unmapped: [],
        failed: [],
        source: "niftyindices",
        short_window: shortW,
        long_window: longW,
        lookback_days: lookback,
      },
      error: null,
    };
    jobs().set(id, job);
    return json({ id });
  }

  const jobMatch = route.match(/^\/api\/signals\/jobs\/([^/]+)$/);
  if (request.method === "GET" && jobMatch) {
    const job = jobs().get(jobMatch[1]);
    if (!job) return fail("That scan is no longer on the server. Generate signals again.", 404);
    return json(job);
  }

  if (request.method === "POST" && route === "/api/signals/simulate") {
    const tickers = Array.isArray(body.tickers) ? body.tickers.map((item) => String(item).toUpperCase()) : [];
    if (!tickers.length) return fail("Select at least one stock.", 400);
    if (!body.sample && !sessionOk()) return fail("Sign in again. There is no saved Groww access token, or it expired at 6:00 AM IST.", 401);
    const results = [];
    const missing = [];
    for (const ticker of tickers) {
      const candles = demoCloses(ticker, adler(ticker) % 2 === 0 ? "bullish" : "bearish", 8, "strong", 180);
      const cross = latestCross(candles, Number(body.short_window ?? 6), Number(body.long_window ?? 30), Number(body.lookback_days ?? 90));
      if (!cross) {
        missing.push(ticker);
        continue;
      }
      results.push(monteCarlo(ticker, candles, cross, Number(body.paths ?? 1000), Number(body.horizon_days ?? 21)));
    }
    if (!results.length) return fail("Generate signals first so daily candles are on the server, then run the simulation.", 400);
    return json({ results, missing, sample: Boolean(body.sample) });
  }

  if (request.method === "POST" && route === "/api/strategies/backtest") {
    const strategy = String(body.strategy ?? "").toLowerCase();
    const ticker = String(body.ticker ?? "").toUpperCase();
    if (!ticker) return fail("Enter one NSE ticker, such as RELIANCE.", 400);
    if (!body.sample && !sessionOk()) return fail("Sign in again. There is no saved Groww access token, or it expired at 6:00 AM IST.", 401);
    try {
      const candles = demoCloses(ticker, adler(ticker) % 2 === 0 ? "bullish" : "bearish", 8, "strong", 420);
      return json({ ...backtest(strategy, candles), ticker, sample: Boolean(body.sample) });
    } catch (error) {
      return fail(error instanceof Error ? error.message : "Backtest failed.", 400);
    }
  }

  if (request.method === "POST" && route === "/api/strategies/board") {
    const strategy = String(body.strategy ?? "").toLowerCase();
    if (!CATALOG.some((item) => item.id === strategy)) return fail("Pick a strategy from the list.", 400);
    if (!body.sample && !sessionOk()) return fail("Sign in again. There is no saved Groww access token, or it expired at 6:00 AM IST.", 401);
    const limit = Math.min(25, Math.max(5, Number(body.limit ?? 15)));
    const rows = NAMES.slice(0, 20).map((item) => {
      const candles = demoCloses(item.symbol, adler(item.symbol) % 2 === 0 ? "bullish" : "bearish", 8, "strong", 420);
      const study = backtest(strategy, candles);
      return {
        ticker: item.symbol,
        company: item.company,
        stance: study.stance,
        total_return: study.total_return,
        max_drawdown: study.max_drawdown,
        trades: study.trades,
        open: study.open,
        win_rate: study.win_rate,
        last_close: study.last_close,
      };
    });
    rows.sort((a, b) => b.total_return - a.total_return || a.ticker.localeCompare(b.ticker));
    return json({
      strategy,
      sample: Boolean(body.sample),
      source: "niftyindices",
      rows: rows.slice(0, limit).map((row, index) => ({ ...row, rank: index + 1 })),
    });
  }

  if (route === "/api/automation") {
    const key = sample || body.sample ? "sample" : "live";
    if (key === "live" && !sessionOk()) return fail("Sign in again. There is no saved Groww access token, or it expired at 6:00 AM IST.", 401);
    g.__deskAuto ??= {};
    g.__deskAuto[key] ??= defaultAuto(key === "sample");
    if (request.method === "POST" && !route.endsWith("/cycle")) {
      const state = g.__deskAuto[key];
      state.strategy = String(body.strategy ?? state.strategy);
      state.quantity = Number(body.quantity ?? state.quantity);
      state.max_orders = Number(body.max_orders ?? state.max_orders);
      state.symbols = String(body.symbols ?? "")
        .toUpperCase()
        .split(/[\s,]+/)
        .filter(Boolean)
        .slice(0, 25);
      state.enabled = Boolean(body.enabled);
      state.mode = body.mode === "live" && body.enabled ? "live" : "paper";
      state.live_armed = false;
      if (state.mode === "live") return fail("Live orders stay off. Paper mode needs no phrase.", 400);
      return json(publicAuto(state));
    }
    return json(publicAuto(g.__deskAuto[key]));
  }

  if (request.method === "POST" && route === "/api/automation/cycle") {
    const key = sample ? "sample" : "live";
    if (key === "live" && !sessionOk()) return fail("Sign in again. There is no saved Groww access token, or it expired at 6:00 AM IST.", 401);
    g.__deskAuto ??= {};
    const state = (g.__deskAuto[key] ??= defaultAuto(key === "sample"));
    if (!state.enabled) return fail("Turn automation on before running a cycle.", 400);
    state.last_cycle = new Date().toISOString();
    state.log.push({ at: state.last_cycle, note: "Paper cycle finished. No order was sent.", status: "idle" });
    return json(publicAuto(state));
  }

  if (request.method === "GET" && route === "/api/scanner-data") {
    if (!sample && !sessionOk()) return fail("Sign in again. There is no saved Groww access token, or it expired at 6:00 AM IST.", 401);
    const stocks = sampleStocks();
    return json({
      metadata: {
        sample: true,
        source: "niftyindices",
        universe: NAMES.length,
        returned: stocks.length,
        scanned_at: new Date().toISOString(),
        live_status: sample ? "Sample tape. Ticks are simulated on this desk." : "Published desk is using the sample tape. No order is sent.",
        loading: false,
      },
      stocks,
    });
  }

  if (request.method === "GET" && route === "/api/ohlc-snapshot") {
    const wanted = (url.searchParams.get("symbols") ?? "").split(",").map((item) => item.trim().toUpperCase()).filter(Boolean);
    const prices: Record<string, { last_price: number; exchange_token: string }> = {};
    sampleStocks().forEach((stock) => {
      if (!wanted.includes(stock.trading_symbol)) return;
      const last = stock.candles[stock.candles.length - 1];
      prices[stock.trading_symbol] = { last_price: last.close, exchange_token: stock.exchange_token };
    });
    return json({ prices, sample: true });
  }

  if (request.method === "POST" && (route === "/api/algo-orders/gtt-state" || route === "/api/algo-orders/live-gtt")) {
    if (route.endsWith("live-gtt") && body.confirm_live !== true) return fail("confirm_live must be true. No order was sent.", 400);
    const candidates = Array.isArray(body.candidates) ? (body.candidates as Record<string, unknown>[]) : [];
    if (route.endsWith("live-gtt")) {
      const rows = candidates.map((candidate) => {
        const row = evaluate(candidate);
        if (row.buy_status !== "ready" || row.buy_price == null) return row;
        const id = `DUMMY-${randomBytes(4).toString("hex")}`;
        dummies().push({ id, symbol: row.symbol, status: "ACTIVE", transaction_type: "BUY", buy_price: row.buy_price });
        row.buy_status = "created";
        row.buy_trigger_id = id;
        row.message = "Dummy buy GTT created. No order sent to Groww. Stoploss planned after buy execution.";
        return row;
      });
      return json({ rows, simulated: true });
    }
    return json({ rows: candidates.map((candidate) => evaluate(candidate)), simulated: true });
  }

  return fail("That desk route is not available.", 404);
}
