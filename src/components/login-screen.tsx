import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, KeyRound, ShieldCheck } from "lucide-react";
import { api, apiCandidates, type SessionStatus } from "@/lib/api";
import { AccentSwitch } from "@/components/accent";
import { Wordmark } from "@/components/wordmark";

const fieldClass =
  "h-11 w-full rounded-lg border border-border bg-bg px-3 text-sm text-fg outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-primary";

const SAVED_LOGIN_KEY = "groww-connect-login";

type SavedLogin = {
  apiKey: string;
  apiSecret: string;
  requestToken: string;
};

function readSavedLogin(): SavedLogin | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SAVED_LOGIN_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<SavedLogin>;
    return {
      apiKey: typeof data.apiKey === "string" ? data.apiKey : "",
      apiSecret: typeof data.apiSecret === "string" ? data.apiSecret : "",
      requestToken: typeof data.requestToken === "string" ? data.requestToken : "",
    };
  } catch {
    return null;
  }
}

export function LoginScreen() {
  const navigate = useNavigate();
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [requestToken, setRequestToken] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [apiState, setApiState] = useState<"checking" | "up" | "down">("checking");

  useEffect(() => {
    const saved = readSavedLogin();
    if (!saved) return;
    setApiKey(saved.apiKey);
    setApiSecret(saved.apiSecret);
    setRequestToken(saved.requestToken);
    if (saved.apiKey || saved.apiSecret || saved.requestToken) {
      setSavedNote("Saved details loaded from this browser.");
    }
  }, []);

  useEffect(() => {
    let cancel = false;
    let timer = 0;
    let misses = 0;
    const ping = () => {
      const urls = [...apiCandidates("/api/health"), ...apiCandidates("/api/auth/status")];
      const attempt = (index: number) => {
        const url = urls[index];
        if (!url) {
          misses += 1;
          setApiState("down");
          if (misses >= 2) setNotice("The page could not reach port 8090 through the website.");
          timer = window.setTimeout(ping, 1500);
          return;
        }
        fetch(url, { cache: "no-store", headers: { accept: "*/*" } })
          .then(async (response) => {
            const text = await response.text();
            let data: (SessionStatus & { ok?: boolean }) | null = null;
            try {
              data = JSON.parse(text) as SessionStatus & { ok?: boolean };
            } catch {
              data = null;
            }
            if (!response.ok || !data || data.offline || (data.ok === false && data.authenticated === undefined)) {
              throw new Error(text.slice(0, 140) || `Status ${response.status}`);
            }
            return data;
          })
          .then((status) => {
            if (cancel) return;
            misses = 0;
            setApiState("up");
            if (status.authenticated) {
              setNotice("A saved access token is already on the server. Opening your desk.");
              void navigate({ to: "/dashboard", search: { sample: false } });
              return;
            }
            setNotice(null);
          })
          .catch(() => {
            if (cancel) return;
            attempt(index + 1);
          });
      };
      attempt(0);
    };
    ping();
    return () => {
      cancel = true;
      window.clearTimeout(timer);
    };
  }, [navigate]);

  function saveDetails() {
    const details: SavedLogin = {
      apiKey: apiKey.trim(),
      apiSecret: apiSecret.trim(),
      requestToken: requestToken.trim(),
    };
    if (!details.apiKey && !details.apiSecret && !details.requestToken) {
      setError("Enter the details you want to keep, then press Save.");
      setSavedNote(null);
      return;
    }
    window.localStorage.setItem(SAVED_LOGIN_KEY, JSON.stringify(details));
    setApiKey(details.apiKey);
    setApiSecret(details.apiSecret);
    setRequestToken(details.requestToken);
    setError(null);
    setSavedNote("Details saved in this browser. They fill in again when you come back.");
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const send = () =>
      api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          api_key: apiKey.trim(),
          api_secret: apiSecret.trim(),
          request_token: requestToken.trim(),
        }),
      });
    try {
      try {
        await send();
      } catch (err) {
        const message = err instanceof Error ? err.message : "";
        if (!/not running|not reachable/i.test(message)) throw err;
        await new Promise((resolve) => setTimeout(resolve, 800));
        await send();
      }
      setApiSecret("");
      setRequestToken("");
      setNotice(null);
      await navigate({ to: "/dashboard", search: { sample: false } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex items-center justify-between gap-4">
        <Wordmark />
        <AccentSwitch />
      </header>

      <div className="mt-8 grid items-start gap-8 lg:mt-14 lg:grid-cols-2">
        <section className="order-2 lg:order-1">
          <p className="text-xs font-medium tracking-widest text-primary uppercase">Local desk</p>
          <h1 className="mt-2 max-w-md text-3xl font-semibold tracking-tight sm:text-4xl">
            Sign in once. The access token stays on the server.
          </h1>
          <p className="mt-3 max-w-md text-sm text-muted">
            This page sends your key to the Python API. Groww's SDK mints the access token there.
            The browser never receives it, and a restart reuses it until 6:00 AM IST.
          </p>

          <ol className="mt-6 space-y-3 text-sm">
            <SetupStep
              n="1"
              title="Create a key"
              body="In Groww, open Trading APIs and generate a key on the API keys page. Approve it for today if Groww asks."
            />
            <SetupStep
              n="2"
              title="API secret flow"
              body="Paste the API key and API secret. Leave Request token empty. This is the daily-approval flow."
            />
            <SetupStep
              n="3"
              title="Or a TOTP request token"
              body="If you use a TOTP key, paste that API key and put the 6-digit code in Request token. Leave API secret empty."
            />
          </ol>

          <div className="mt-6 flex gap-3 rounded-lg border border-border bg-surface p-4 text-sm">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <p className="text-muted">
              Save details keeps the key, secret, and request token in this browser so the form can fill them
              in again. Login still mints the access token on the server, and that token is never sent back
              to the page.
            </p>
          </div>

          <details className="mt-4 rounded-lg border border-border bg-surface px-4 py-3 text-sm">
            <summary className="cursor-pointer font-medium">Run it yourself</summary>
            <div className="mt-3 space-y-2 text-muted">
              <p>From the project folder, start the API and the web app:</p>
              <pre className="num overflow-x-auto rounded-lg bg-bg p-3 text-xs text-fg">{`pip install -r backend/requirements.txt
python -m uvicorn main:app --app-dir backend --host 127.0.0.1 --port 8090
npm install
npm run dev`}</pre>
              <p>
                Open the web app and sign in. The API proxies through <span className="num">/api</span>. Colors
                live in <span className="num">src/styles.css</span>.
              </p>
            </div>
          </details>
        </section>

        <section className="order-1 rounded-lg border border-border bg-surface p-5 sm:p-6 lg:order-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <KeyRound className="size-4 text-primary" aria-hidden="true" />
            Groww login
          </div>
          <p className="mt-1 text-sm text-muted">Nothing here is sent to the browser after the token is created.</p>
          <p className="mt-2 text-xs text-muted">
            Desk API:{" "}
            <span className={apiState === "up" ? "text-up" : apiState === "down" ? "text-down" : ""}>
              {apiState === "up" ? "running" : apiState === "down" ? "not answering" : "checking"}
            </span>
          </p>

          <form className="mt-5 space-y-4" onSubmit={onSubmit}>
            <label className="block text-sm">
              <span className="mb-1.5 block font-medium">API key</span>
              <input
                className={fieldClass}
                autoComplete="off"
                spellCheck={false}
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                required
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1.5 block font-medium">API secret</span>
              <span className="relative block">
                <input
                  className={fieldClass + " pr-12"}
                  type={showSecret ? "text" : "password"}
                  autoComplete="new-password"
                  spellCheck={false}
                  value={apiSecret}
                  onChange={(event) => setApiSecret(event.target.value)}
                />
                <Reveal pressed={showSecret} onClick={() => setShowSecret((value) => !value)} label="secret" />
              </span>
            </label>
            <label className="block text-sm">
              <span className="mb-1.5 block font-medium">Request token</span>
              <span className="relative block">
                <input
                  className={fieldClass + " pr-12"}
                  type={showToken ? "text" : "password"}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  spellCheck={false}
                  placeholder="TOTP, or leave blank"
                  value={requestToken}
                  onChange={(event) => setRequestToken(event.target.value)}
                />
                <Reveal pressed={showToken} onClick={() => setShowToken((value) => !value)} label="request token" />
              </span>
              <span className="mt-1.5 block text-xs text-muted">
                6-digit authenticator code, or the TOTP secret. Not used with the API secret.
              </span>
            </label>

            {error ? (
              <p className="note-down rounded-lg border bg-bg px-3 py-2 text-sm text-down" role="alert">
                {error}
              </p>
            ) : null}
            {notice ? <p className="text-sm text-muted">{notice}</p> : null}
            {savedNote ? <p className="text-sm text-muted">{savedNote}</p> : null}

            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                className="inline-flex h-11 items-center justify-center rounded-lg border border-border bg-bg px-4 text-sm font-medium text-fg hover:bg-surface-2"
                onClick={saveDetails}
              >
                Save details
              </button>
              <button
                type="submit"
                disabled={busy}
                className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-fg hover:opacity-90 disabled:opacity-50"
              >
                {busy ? "Signing in…" : "Login"}
              </button>
            </div>
          </form>

          <button
            type="button"
            className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-lg border border-border bg-bg px-4 text-sm font-medium text-fg hover:bg-surface-2"
            onClick={() => void navigate({ to: "/dashboard", search: { sample: true } })}
          >
            Preview the dashboard with sample data
          </button>
        </section>
      </div>
    </main>
  );
}

function SetupStep({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <li className="flex gap-3">
      <span className="num flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs text-primary">
        {n}
      </span>
      <span>
        <span className="font-medium">{title}. </span>
        <span className="text-muted">{body}</span>
      </span>
    </li>
  );
}

function Reveal({ pressed, onClick, label }: { pressed: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      className="absolute top-0 right-0 flex h-11 w-11 items-center justify-center text-muted hover:text-fg"
      aria-pressed={pressed}
      aria-label={pressed ? `Hide ${label}` : `Show ${label}`}
      onClick={onClick}
    >
      {pressed ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
    </button>
  );
}
