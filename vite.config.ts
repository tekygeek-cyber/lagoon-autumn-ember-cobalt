import { readdirSync } from "node:fs";
import http from "node:http";
import { spawn } from "node:child_process";
import { join } from "node:path";
import type { Connect, Plugin } from "vite";
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";
// @ts-expect-error JS plugin alongside the TS vite config
import { grokPwaPlugin } from "./scripts/grok-pwa-plugin.mjs";
// @ts-expect-error JS plugin alongside the TS vite config
import { appEnvPlugin } from "./scripts/app-env-plugin.mjs";
import { isMigrationFile } from "./scripts/migration-plan.mjs";

/** The files `src/lib/db.ts` globs — same directory, same non-recursive scope. */
function hasGlobbedMigrations(root: string): boolean {
  try {
    return readdirSync(join(root, "migrations")).some(isMigrationFile);
  } catch {
    return false;
  }
}

/**
 * Finish PGLite bootstrap during dev-server setup (before traffic). Vite awaits
 * async `configureServer` hooks. Production: `src/lib/db` kicks `ensureDbReady`
 * on import.
 *
 * Vite awaiting the hook puts this on time-to-first-render, so an app with no
 * migrations — no schema to apply — skips it entirely rather than paying for a
 * PGLite instance it never queries.
 */
function pgliteBootstrapPlugin(): Plugin {
  return {
    name: "app-builder:pglite-bootstrap",
    apply: "serve",
    async configureServer(server) {
      if (!hasGlobbedMigrations(server.config.root)) return;
      try {
        const mod = (await server.ssrLoadModule("/src/lib/db.ts")) as {
          ensureDbReady?: () => Promise<void>;
        };
        if (typeof mod.ensureDbReady === "function") {
          await mod.ensureDbReady();
        }
      } catch (err) {
        console.error("[app-builder] DB bootstrap failed:", err);
        throw err;
      }
    },
  };
}

/**
 * Live-preview OAuth popup — handled HERE so the agent never has to create a
 * `/auth/popup` route (and cannot break it by scaffolding a React page that
 * paints the full app shell in the popup).
 *
 * `signIn` (client.ts) opens `/auth/popup?providerId=…` in a top-level window.
 * This middleware runs before TanStack Start, calls `handleAuthPopupRequest`,
 * and returns the 302 / completion HTML. Deployed apps do not use the popup
 * (full-page OAuth redirect), so `apply: "serve"` is enough.
 */
function authPopupPlugin(): Plugin {
  return {
    name: "app-builder:auth-popup",
    apply: "serve",
    configureServer(server) {
      // Register immediately (not in a returned post-hook) so we run BEFORE
      // TanStack Start / the SPA HTML fallback. A model-authored
      // `src/routes/auth/popup.tsx` React page must never win this path.
      server.middlewares.use(async (req, res, next) => {
        try {
          const rawUrl = req.url ?? "";
          const pathOnly = rawUrl.split("?", 1)[0] ?? "";
          if (pathOnly !== "/auth/popup") {
            next();
            return;
          }
          if ((req.method ?? "GET").toUpperCase() !== "GET") {
            res.statusCode = 405;
            res.setHeader("content-type", "text/plain; charset=utf-8");
            res.end("Method Not Allowed");
            return;
          }

          const host = String(
            req.headers["x-forwarded-host"] ?? req.headers.host ?? "localhost:8080",
          );
          const proto = String(
            req.headers["x-forwarded-proto"] ??
              ((req.socket as { encrypted?: boolean } | undefined)?.encrypted ? "https" : "http"),
          );
          const requestHeaders = new Headers();
          for (const [key, value] of Object.entries(req.headers)) {
            if (value === undefined) continue;
            if (Array.isArray(value)) {
              for (const v of value) requestHeaders.append(key, v);
            } else {
              requestHeaders.set(key, value);
            }
          }
          // Ensure Host is the public preview host so Better Auth's dynamic
          // baseURL / redirect_uri match the popup origin.
          if (!requestHeaders.has("host")) requestHeaders.set("host", host);

          const request = new Request(`${proto}://${host}${rawUrl}`, {
            method: "GET",
            headers: requestHeaders,
          });

          const mod = (await server.ssrLoadModule("/src/lib/auth/popup.server.ts")) as {
            handleAuthPopupRequest: (req: Request) => Promise<Response>;
          };
          const response = await mod.handleAuthPopupRequest(request);

          res.statusCode = response.status;
          // Preserve multiple Set-Cookie headers (OAuth state + session).
          const setCookies =
            typeof response.headers.getSetCookie === "function"
              ? response.headers.getSetCookie()
              : [];
          response.headers.forEach((value, key) => {
            if (key.toLowerCase() === "set-cookie") return;
            res.setHeader(key, value);
          });
          for (const cookie of setCookies) {
            res.appendHeader("set-cookie", cookie);
          }
          const body = Buffer.from(await response.arrayBuffer());
          res.end(body);
        } catch (err) {
          console.error("[app-builder] /auth/popup handler failed:", err);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader("content-type", "text/plain; charset=utf-8");
            res.end("auth popup failed");
          }
        }
      });
    },
  };
}

function deskApiPlugin(): Plugin {
  let booting = false;

  const ensureApi = () =>
    new Promise<void>((resolve) => {
      const probe = http.get("http://127.0.0.1:8090/api/health", (res) => {
        res.resume();
        resolve();
      });
      probe.on("error", () => {
        if (!booting) {
          booting = true;
          const child = spawn(
            "python3",
            [
              "-m",
              "uvicorn",
              "main:app",
              "--app-dir",
              "/workspace/backend",
              "--host",
              "127.0.0.1",
              "--port",
              "8090",
            ],
            { detached: true, stdio: "ignore" },
          );
          child.unref();
          child.on("error", () => {
            booting = false;
          });
        }
        setTimeout(resolve, 700);
      });
    });

  const sendDown = (res: http.ServerResponse, path: string) => {
    if (res.headersSent) return;
    const status = path === "/api/auth/status";
    res.writeHead(status ? 200 : 503, {
      "content-type": "application/json",
      "cache-control": "no-store",
    });
    res.end(
      JSON.stringify(
        status
          ? { authenticated: false, offline: true }
          : { detail: "The desk service is not running. Start the Python API and try again." },
      ),
    );
  };

  const forward = (req: http.IncomingMessage, res: http.ServerResponse, target: string, path: string) => {
    const headers: http.OutgoingHttpHeaders = {};
    for (const [key, value] of Object.entries(req.headers)) {
      if (value === undefined) continue;
      const name = key.toLowerCase();
      if (
        name === "host" ||
        name === "connection" ||
        name === "keep-alive" ||
        name === "transfer-encoding" ||
        name === "content-length"
      ) {
        continue;
      }
      headers[key] = value;
    }
    headers.host = "127.0.0.1:8090";
    const upstream = http.request(
      { hostname: "127.0.0.1", port: 8090, path: target, method: req.method, headers },
      (pres) => {
        if (res.headersSent) {
          pres.resume();
          return;
        }
        res.writeHead(pres.statusCode ?? 502, {
          ...pres.headers,
          "cache-control": "no-store",
          "access-control-allow-origin": "*",
        });
        pres.pipe(res);
      },
    );
    upstream.setTimeout(20000, () => upstream.destroy());
    upstream.on("error", () => sendDown(res, path));
    req.pipe(upstream);
  };

  const handle: Connect.NextHandleFunction = (req, res, next) => {
    const raw = req.url ?? "/";
    const q = raw.indexOf("?");
    const pathOnly = q === -1 ? raw : raw.slice(0, q);
    const stripped = pathOnly.replace(/^\/hds-[^/]+/i, "") || "/";
    if (!stripped.startsWith("/api")) {
      next();
      return;
    }
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
        "access-control-allow-headers": "content-type,accept",
        "cache-control": "no-store",
      });
      res.end();
      return;
    }
    const target = stripped + (q === -1 ? "" : raw.slice(q));
    // Status checks must not wait on the browser request body. Answer them directly.
    if ((stripped === "/api/health" || stripped === "/api/auth/status") && req.method === "GET") {
      const answer = http.get({ hostname: "127.0.0.1", port: 8090, path: stripped, timeout: 2500 }, (pres) => {
        const chunks: Buffer[] = [];
        pres.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        pres.on("end", () => {
          if (res.headersSent) return;
          res.writeHead(pres.statusCode ?? 200, {
            "content-type": "application/json",
            "cache-control": "no-store",
            "access-control-allow-origin": "*",
          });
          res.end(Buffer.concat(chunks));
        });
      });
      answer.on("timeout", () => answer.destroy());
      answer.on("error", () => {
        void ensureApi().then(() => {
          const again = http.get({ hostname: "127.0.0.1", port: 8090, path: stripped, timeout: 2500 }, (pres) => {
            res.writeHead(pres.statusCode ?? 200, {
              "content-type": "application/json",
              "cache-control": "no-store",
              "access-control-allow-origin": "*",
            });
            pres.pipe(res);
          });
          again.on("error", () => sendDown(res, stripped));
        });
      });
      return;
    }
    forward(req, res, target, stripped.split("?")[0] ?? stripped);
  };

  return {
    name: "groww-desk-api",
    apply: "serve",
    configureServer(server) {
      server.middlewares.stack.unshift({ route: "", handle });
    },
  };
}

// `0.0.0.0:8080` is the live-preview contract — don't change host/port.
// The dev server starts once `src/router.tsx` and `src/routes/` exist — see
// AGENTS.md § "First scaffold".
export default defineConfig(({ command, isPreview }) => ({
  server: {
    host: "0.0.0.0",
    port: 8080,
    strictPort: true,
    proxy: {
      "/ws": { target: "http://127.0.0.1:8090", ws: true, changeOrigin: true },
    },
  },
  preview: {
    host: "127.0.0.1",
    port: 8081,
    strictPort: true,
  },
  resolve: { tsconfigPaths: true },
  plugins: [
    deskApiPlugin(),
    pgliteBootstrapPlugin(),
    // Before tanstackStart so /auth/popup never falls through to the SPA.
    authPopupPlugin(),
    // Dev-only /__app-env, read by scripts/check-auth-invariant.mjs.
    appEnvPlugin(),
    // PWA head + ?install=1 tutorial page; runs before Start/Nitro.
    grokPwaPlugin(),
    tailwindcss(),
    tanstackStart(),
    ...(command === "build" || isPreview
      ? [
          nitro({
            preset: "vercel",
            // Auto-registers server/middleware/* (the PWA install page +
            // manifest + head-tag middleware). Nitro v3 defaults serverDir to
            // false, so removing this silently unwires /?install=1 on deploys.
            serverDir: "./server",
          }),
        ]
      : []),
    viteReact(),
  ],
}));
