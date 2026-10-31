import { previewPathPrefix } from "@/lib/preview-path-prefix";

export type SessionStatus = {
  authenticated: boolean;
  expires_at?: string;
  flow?: "approval" | "totp" | string;
  offline?: boolean;
};

export type Profile = {
  user_name: string | null;
  user_id: string | null;
  products: string[];
  exchanges: string[];
  ddpi_enabled: boolean | null;
  sample: boolean;
};

export type SignalRow = {
  rank: number;
  ticker: string;
  company: string;
  nse_token: string;
  crossover_type: "bullish" | "bearish";
  crossover_date: string;
  close: number;
  sma_short: number;
  sma_long: number;
  bars_since: number;
};

export type ScanMeta = {
  sample: boolean;
  universe: number;
  matched: number;
  with_crossover: number;
  shown: number;
  unmapped: string[];
  failed: string[];
  source: string;
  short_window: number;
  long_window: number;
  lookback_days: number;
};

export type ScanJob = {
  id: string;
  status: "running" | "done" | "error";
  done: number;
  total: number;
  message: string;
  results: SignalRow[] | null;
  meta: ScanMeta | null;
  error: string | null;
};

export type SimResult = {
  ticker: string;
  signal: "BUY" | "SELL" | "HOLD" | "WATCH";
  p_up: number;
  median_return: number;
  p05: number;
  p95: number;
  paths: number;
  horizon_days: number;
  reason: string;
};

export type ScanParams = {
  short_window: number;
  long_window: number;
  lookback_days: number;
  max_stocks: number;
};

function apiUrl(path: string): string {
  if (typeof window === "undefined") return path;
  const known = previewPathPrefix(window.location.hostname, window.location.pathname);
  if (known) return `${known}${path}`;
  const any = /^\/hds-[a-z0-9]+-\d+-[a-z0-9]+(?=\/|$)/i.exec(window.location.pathname)?.[0];
  return any ? `${any}${path}` : path;
}

export function apiCandidates(path: string): string[] {
  const urls = new Set<string>([apiUrl(path), path]);
  if (typeof window !== "undefined") {
    const any = /^\/hds-[a-z0-9]+-\d+-[a-z0-9]+(?=\/|$)/i.exec(window.location.pathname)?.[0];
    if (any) urls.add(`${any}${path}`);
  }
  return [...urls];
}

function errorDetail(data: unknown, status: number): string {
  if (data && typeof data === "object" && "detail" in data) {
    const detail = (data as { detail: unknown }).detail;
    if (typeof detail === "string" && detail) return detail;
    if (Array.isArray(detail)) {
      return detail
        .map((item) => {
          if (item && typeof item === "object" && "msg" in item) return String(item.msg);
          return String(item);
        })
        .join(" ");
    }
  }
  return `Request failed (${status}).`;
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(apiUrl(path), {
      ...init,
      cache: "no-store",
      headers: {
        accept: "application/json",
        ...(init?.body ? { "content-type": "application/json" } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new Error("The desk service is not reachable yet. Wait a moment and try again.");
  }
  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  if (!response.ok) throw new Error(errorDetail(data, response.status));
  return data as T;
}

export function inr(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function pct(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(1)}%`;
}

export function prettyDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

export function expiryLabel(iso: string): string {
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return iso;
  const clock = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(when);
  return `${clock} IST`;
}
