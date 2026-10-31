import { x as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { s as Activity } from "../_libs/lucide-react.mjs";
import { i as previewPathPrefix } from "./router-BPJPt6fL.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/wordmark-B1NLevsU.js
var import_jsx_runtime = require_jsx_runtime();
function apiUrl(path) {
	if (typeof window === "undefined") return path;
	const known = previewPathPrefix(window.location.hostname, window.location.pathname);
	if (known) return `${known}${path}`;
	const any = /^\/hds-[a-z0-9]+-\d+-[a-z0-9]+(?=\/|$)/i.exec(window.location.pathname)?.[0];
	return any ? `${any}${path}` : path;
}
function apiCandidates(path) {
	const urls = /* @__PURE__ */ new Set([apiUrl(path), path]);
	if (typeof window !== "undefined") {
		const any = /^\/hds-[a-z0-9]+-\d+-[a-z0-9]+(?=\/|$)/i.exec(window.location.pathname)?.[0];
		if (any) urls.add(`${any}${path}`);
	}
	return [...urls];
}
function errorDetail(data, status) {
	if (data && typeof data === "object" && "detail" in data) {
		const detail = data.detail;
		if (typeof detail === "string" && detail) return detail;
		if (Array.isArray(detail)) return detail.map((item) => {
			if (item && typeof item === "object" && "msg" in item) return String(item.msg);
			return String(item);
		}).join(" ");
	}
	return `Request failed (${status}).`;
}
async function api(path, init) {
	let response;
	try {
		response = await fetch(apiUrl(path), {
			...init,
			cache: "no-store",
			headers: {
				accept: "application/json",
				...init?.body ? { "content-type": "application/json" } : {},
				...init?.headers
			}
		});
	} catch {
		throw new Error("The desk service is not reachable yet. Wait a moment and try again.");
	}
	const text = await response.text();
	let data = null;
	if (text) try {
		data = JSON.parse(text);
	} catch {
		data = null;
	}
	if (!response.ok) throw new Error(errorDetail(data, response.status));
	return data;
}
function inr(value) {
	return new Intl.NumberFormat("en-IN", {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2
	}).format(value);
}
function pct(value) {
	return `${value > 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;
}
function prettyDate(iso) {
	const [year, month, day] = iso.split("-").map(Number);
	if (!year || !month || !day) return iso;
	return new Intl.DateTimeFormat("en-IN", {
		day: "2-digit",
		month: "short",
		year: "numeric"
	}).format(new Date(year, month - 1, day));
}
function expiryLabel(iso) {
	const when = new Date(iso);
	if (Number.isNaN(when.getTime())) return iso;
	return `${new Intl.DateTimeFormat("en-IN", {
		timeZone: "Asia/Kolkata",
		day: "2-digit",
		month: "short",
		hour: "numeric",
		minute: "2-digit"
	}).format(when)} IST`;
}
function Wordmark({ compact = false }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-center gap-3",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "flex size-10 items-center justify-center rounded-lg bg-primary text-primary-fg",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Activity, {
				className: "size-5",
				"aria-hidden": "true"
			})
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
			className: "leading-tight",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "block text-sm font-semibold tracking-wide",
				children: "Groww Connect"
			}), compact ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "block text-xs text-muted",
				children: "Nifty 100 desk"
			})]
		})]
	});
}
//#endregion
export { inr as a, expiryLabel as i, api as n, pct as o, apiCandidates as r, prettyDate as s, Wordmark as t };
