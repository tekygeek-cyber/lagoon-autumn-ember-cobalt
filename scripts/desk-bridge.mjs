#!/usr/bin/env node
/**
 * Private HTTPS hop in front of the desk API.
 *
 * The API itself stays on 127.0.0.1:8090 and is not published.
 * The built site connects here over TLS, on this machine's private address,
 * and only with the server-side bridge token. The token is never sent to the browser.
 */
import { execFileSync } from "node:child_process";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import http from "node:http";
import https from "node:https";
import { networkInterfaces } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(ROOT, "backend/data/bridge");
const META = join(ROOT, "backend/data/desk-bridge.json");
const PORT = 8443;

function privateIp() {
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === "IPv4" && !entry.internal) return entry.address;
    }
  }
  return "";
}

function ensureMaterial(ip) {
  mkdirSync(DIR, { recursive: true });
  const cert = join(DIR, "cert.pem");
  const key = join(DIR, "key.pem");
  let token = "";
  if (existsSync(META)) {
    try {
      const saved = JSON.parse(readFileSync(META, "utf8"));
      if (typeof saved.token === "string" && saved.token.length >= 32) token = saved.token;
    } catch {
      token = "";
    }
  }
  if (!token) token = randomBytes(32).toString("hex");
  const origin = `https://${ip}:${PORT}`;
  const needsCert = !existsSync(cert) || !existsSync(key);
  let previous = "";
  try {
    previous = JSON.parse(readFileSync(META, "utf8")).origin ?? "";
  } catch {
    previous = "";
  }
  if (needsCert || previous !== origin) {
    execFileSync(
      "openssl",
      [
        "req",
        "-x509",
        "-newkey",
        "rsa:2048",
        "-keyout",
        key,
        "-out",
        cert,
        "-days",
        "30",
        "-nodes",
        "-subj",
        "/CN=groww-desk-bridge",
        "-addext",
        `subjectAltName=IP:${ip}`,
      ],
      { stdio: "ignore" },
    );
  }
  const meta = { origin, token, ca: cert };
  writeFileSync(META, `${JSON.stringify(meta)}\n`, { mode: 0o600 });
  return { ...meta, key };
}

function tokenOk(header, token) {
  const given = Buffer.from(String(header ?? ""));
  const want = Buffer.from(token);
  return given.length === want.length && timingSafeEqual(given, want);
}

function start(ip, material) {
  const server = https.createServer(
    { cert: readFileSync(material.ca), key: readFileSync(material.key) },
    (req, res) => {
      const path = req.url ?? "/";
      if (!path.startsWith("/api/") && path !== "/api") {
        res.writeHead(404, { "content-type": "application/json", "cache-control": "no-store" });
        res.end(JSON.stringify({ detail: "Not found." }));
        return;
      }
      if (!tokenOk(req.headers["x-desk-bridge"], material.token)) {
        res.writeHead(401, { "content-type": "application/json", "cache-control": "no-store" });
        res.end(JSON.stringify({ detail: "Desk bridge rejected the connection." }));
        return;
      }
      const upstream = http.request(
        {
          hostname: "127.0.0.1",
          port: 8090,
          path,
          method: req.method,
          headers: {
            accept: req.headers.accept ?? "application/json",
            ...(req.headers["content-type"] ? { "content-type": req.headers["content-type"] } : {}),
            host: "127.0.0.1:8090",
          },
        },
        (pres) => {
          res.writeHead(pres.statusCode ?? 502, {
            "content-type": pres.headers["content-type"] ?? "application/json",
            "cache-control": "no-store",
            "x-desk-bridge-hop": "1",
          });
          pres.pipe(res);
        },
      );
      upstream.setTimeout(20000, () => upstream.destroy());
      upstream.on("error", () => {
        if (res.headersSent) return;
        res.writeHead(503, { "content-type": "application/json", "cache-control": "no-store" });
        res.end(JSON.stringify({ detail: "The desk API did not answer over its private connection." }));
      });
      if (req.method === "GET" || req.method === "HEAD") upstream.end();
      else req.pipe(upstream);
    },
  );
  server.on("error", (error) => {
    if (error && error.code === "EADDRINUSE") {
      console.log("desk bridge already listening");
      process.exit(0);
    }
    console.error("desk bridge failed");
    process.exit(1);
  });
  server.listen(PORT, ip, () => {
    console.log(`desk bridge listening on ${material.origin} (API stays on 127.0.0.1:8090)`);
  });
}

const ip = privateIp();
if (!ip) {
  console.error("desk bridge: no private IPv4 address");
  process.exit(1);
}
const material = ensureMaterial(ip);

if (process.argv.includes("--check")) {
  const req = https.get(
    `${material.origin}/api/health`,
    {
      ca: readFileSync(material.ca),
      headers: { "x-desk-bridge": material.token },
      timeout: 2000,
    },
    (res) => {
      res.resume();
      process.exit(res.statusCode === 200 ? 0 : 1);
    },
  );
  req.on("error", () => process.exit(1));
  req.on("timeout", () => {
    req.destroy();
    process.exit(1);
  });
} else {
  start(ip, material);
}
