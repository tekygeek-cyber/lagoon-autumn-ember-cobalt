import { i as __toESM } from "../_runtime.mjs";
import { _ as createFileRoute, b as useRouter, d as Scripts, f as HeadContent, g as lazyRouteComponent, h as Outlet, m as createRouter, q as require_react, v as createRootRoute, x as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { t as TriangleAlert } from "../_libs/lucide-react.mjs";
import { a as union, i as string, n as number, r as object, t as literal } from "../_libs/zod.mjs";
import { createHash, randomBytes } from "node:crypto";
//#region node_modules/.nitro/vite/services/ssr/assets/router-BPJPt6fL.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var __defProp = Object.defineProperty;
var __exportAll = (all, no_symbols) => {
	let target = {};
	for (var name in all) __defProp(target, name, {
		get: all[name],
		enumerable: true
	});
	if (!no_symbols) __defProp(target, Symbol.toStringTag, { value: "Module" });
	return target;
};
var FALLBACK_MESSAGE = "An unexpected error occurred. Try reloading the page.";
function errorMessage(error) {
	if (error instanceof Error && error.message) return error.message;
	if (typeof error === "string" && error) return error;
	return FALLBACK_MESSAGE;
}
function AppErrorComponent({ error }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-red-500",
				"aria-hidden": "true",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, {
					className: "size-10",
					strokeWidth: 2
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "text-lg font-semibold",
				children: "Something went wrong"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "max-w-md text-sm break-words text-zinc-500 dark:text-zinc-400",
				children: errorMessage(error)
			})
		]
	});
}
/**
* Path-based preview hosts serve the dev server under `/{port_id}/` and strip
* that prefix before forwarding, so SSR sees `/` while the browser URL keeps the
* prefix. TanStack Start resets `basepath` on hydration, so a `rewrite` keeps
* client routing and generated links aligned with the public URL.
*/
var PATH_BASED_PREVIEW_HOSTS = /* @__PURE__ */ new Set([
	"preview.grok.genai.mil",
	"preview.grok.mil",
	"preview.grokgsac.com"
]);
var PORT_ID_PREFIX = /^\/hds-[a-z0-9]+-\d+-[a-z0-9]+(?=\/|$)/i;
function previewPathPrefix(hostname, pathname) {
	if (!PATH_BASED_PREVIEW_HOSTS.has(hostname.toLowerCase())) return void 0;
	return PORT_ID_PREFIX.exec(pathname)?.[0];
}
function prefixRewrite(prefix) {
	return {
		input: ({ url }) => {
			if (url.pathname === prefix) url.pathname = "/";
			else if (url.pathname.startsWith(`${prefix}/`)) url.pathname = url.pathname.slice(prefix.length);
			return url;
		},
		output: ({ url }) => {
			url.pathname = `${prefix}${url.pathname}`;
			return url;
		}
	};
}
function previewPathRewrite() {
	if (typeof window === "undefined") return void 0;
	const prefix = previewPathPrefix(window.location.hostname, window.location.pathname);
	return prefix ? prefixRewrite(prefix) : void 0;
}
/**
* App-wide client provider mounted once near the root (in `src/routes/__root.tsx`):
*
*   <AuthProvider><Outlet /></AuthProvider>
*
* Better Auth's React client (`@/lib/auth/client`) needs NO context provider —
* its `useSession()` works standalone — so this is a passthrough today. It's
* kept as the single, stable mount point for any future client-side providers
* (e.g. a toast or theme provider) without churning the root shell.
*/
function AuthProvider({ children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children });
}
var CONNECTOR_TOKEN_READY_EVENT = "grok:connector-token-ready";
function isGrokEmbedderOrigin(origin) {
	try {
		const url = new URL(origin);
		if (url.protocol !== "https:" && url.protocol !== "http:") return false;
		const host = url.hostname.toLowerCase();
		if (host === "grok.com" || host.endsWith(".grok.com")) return true;
		if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") return true;
		return false;
	} catch {
		return false;
	}
}
function isSandboxPreviewGuestHost(hostname) {
	const host = hostname.toLowerCase();
	return host === "grok-sandbox.com" || host.endsWith(".grok-sandbox.com");
}
function isRemintPreviewPair(guestHost, parentHost) {
	const guest = guestHost.toLowerCase();
	const parent = parentHost.toLowerCase();
	const i = guest.indexOf(".preview.");
	if (i <= 0) return false;
	const label = guest.slice(0, i);
	const rest = guest.slice(i + 9);
	if (label.includes(".") || !rest.includes(".")) return false;
	return parent === rest || parent === `grok.${rest}`;
}
function resolveParentEmbedderOrigin(parentIsSelf, referrer, ancestorOrigin, guestHostname = "") {
	if (parentIsSelf) return null;
	for (const candidate of [referrer, ancestorOrigin ?? ""].filter(Boolean)) try {
		const url = new URL(candidate.includes("://") ? candidate : `https://${candidate}`);
		if (url.protocol !== "https:" && url.protocol !== "http:") continue;
		if (isGrokEmbedderOrigin(url.origin)) return url.origin;
		if (isSandboxPreviewGuestHost(guestHostname) || isRemintPreviewPair(guestHostname, url.hostname)) return url.origin;
	} catch {}
	return null;
}
/**
* Guest side of the grok-web ↔ sandbox preview postMessage bridge.
*
* Activates only when this page is framed by an allowlisted Grok embedder.
* Top-level runs (download/export, local `npm run dev`, deployed sites) noop.
*/
var PREVIEW_BRIDGE_CHANNEL = "grok-preview-bridge";
var EnvelopeSchema = object({
	channel: literal(PREVIEW_BRIDGE_CHANNEL),
	version: number().int().positive(),
	type: string().min(1)
});
var HelloSchema = EnvelopeSchema.extend({ type: literal("hello") });
var NavigateSchema = EnvelopeSchema.extend({
	type: literal("navigate"),
	path: string().min(1)
});
var HistorySchema = EnvelopeSchema.extend({
	type: literal("history"),
	delta: union([literal(-1), literal(1)])
});
var ConnectorTokenReadySchema = EnvelopeSchema.extend({ type: literal("connector-token-ready") });
function isSafeBridgePath(path) {
	if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return false;
	try {
		return new URL(path, "https://preview.invalid").origin === "https://preview.invalid";
	} catch {
		return false;
	}
}
/**
* Origin of the Grok embedder framing this page, or null when the page runs
* top-level (download/export, local `npm run dev`, deployed sites) or under a
* non-Grok parent. Client-only; null during SSR.
*/
function resolveCurrentEmbedderOrigin() {
	if (typeof window === "undefined") return null;
	const ancestorOrigin = typeof location.ancestorOrigins !== "undefined" && location.ancestorOrigins.length > 0 ? location.ancestorOrigins[0] : null;
	return resolveParentEmbedderOrigin(window.parent === window, document.referrer, ancestorOrigin, window.location.hostname);
}
/**
* Install host↔guest messaging. Returns a dispose function.
* Noops (returns a no-op dispose) when not embedded under a Grok parent.
*/
function installPreviewHostBridge(options = {}) {
	const parentOrigin = resolveCurrentEmbedderOrigin();
	if (parentOrigin === null) return () => {};
	const ROOT_STATE_KEY = "__grokPreviewBridgeRoot";
	const originalPushState = window.history.pushState.bind(window.history);
	const originalReplaceState = window.history.replaceState.bind(window.history);
	const isAtHistoryRoot = () => {
		const state = window.history.state;
		return Boolean(state && typeof state === "object" && state[ROOT_STATE_KEY] === true);
	};
	try {
		const current = window.history.state;
		if (!(current !== null && typeof current === "object" && Object.prototype.hasOwnProperty.call(current, ROOT_STATE_KEY))) {
			const isRoot = window.history.length <= 1;
			originalReplaceState(current && typeof current === "object" ? {
				...current,
				[ROOT_STATE_KEY]: isRoot
			} : { [ROOT_STATE_KEY]: isRoot }, "", window.location.href);
		}
	} catch {}
	const post = (message) => {
		window.parent.postMessage(message, parentOrigin);
	};
	const reportLocation = () => {
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "location",
			path: window.location.pathname || "/",
			search: window.location.search,
			hash: window.location.hash
		});
	};
	const reportRoutes = () => {
		const paths = options.getRoutePaths?.() ?? [];
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "routes",
			paths
		});
	};
	const defaultNavigate = (path) => {
		if (!isSafeBridgePath(path)) return;
		try {
			const url = new URL(path, window.location.origin);
			if (url.origin !== window.location.origin) return;
			const next = `${url.pathname}${url.search}${url.hash}`;
			window.history.pushState(window.history.state, "", next);
			window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
		} catch {}
	};
	const navigate = (path) => {
		if (!isSafeBridgePath(path)) return;
		if (options.navigate) {
			options.navigate(path);
			return;
		}
		defaultNavigate(path);
	};
	const announce = () => {
		reportLocation();
		reportRoutes();
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "ready"
		});
	};
	const onHello = (data) => {
		if (!HelloSchema.safeParse(data).success) return;
		announce();
	};
	const onNavigate = (data) => {
		const parsed = NavigateSchema.safeParse(data);
		if (!parsed.success) return;
		navigate(parsed.data.path);
		queueMicrotask(reportLocation);
	};
	const onHistory = (data) => {
		const parsed = HistorySchema.safeParse(data);
		if (!parsed.success) return;
		if (parsed.data.delta === -1 && isAtHistoryRoot()) return;
		window.history.go(parsed.data.delta);
	};
	const onConnectorTokenReady = (data) => {
		if (!ConnectorTokenReadySchema.safeParse(data).success) return;
		window.dispatchEvent(new Event(CONNECTOR_TOKEN_READY_EVENT));
	};
	const hostMessageHandlers = /* @__PURE__ */ new Map([
		["hello", onHello],
		["navigate", onNavigate],
		["history", onHistory],
		["connector-token-ready", onConnectorTokenReady]
	]);
	const onMessage = (event) => {
		if (event.source !== window.parent) return;
		if (event.origin !== parentOrigin) return;
		const envelope = EnvelopeSchema.safeParse(event.data);
		if (!envelope.success || envelope.data.version !== 1) return;
		hostMessageHandlers.get(envelope.data.type)?.(event.data);
	};
	const onPopState = () => {
		reportLocation();
	};
	const onHashChange = () => {
		reportLocation();
	};
	window.history.pushState = (data, unused, url) => {
		const next = data && typeof data === "object" ? {
			...data,
			[ROOT_STATE_KEY]: false
		} : data;
		originalPushState(next, unused, url);
		reportLocation();
	};
	window.history.replaceState = (data, unused, url) => {
		const next = isAtHistoryRoot() ? {
			...data && typeof data === "object" ? data : {},
			[ROOT_STATE_KEY]: true
		} : data;
		originalReplaceState(next, unused, url);
		reportLocation();
	};
	window.addEventListener("message", onMessage);
	window.addEventListener("popstate", onPopState);
	window.addEventListener("hashchange", onHashChange);
	announce();
	return () => {
		window.removeEventListener("message", onMessage);
		window.removeEventListener("popstate", onPopState);
		window.removeEventListener("hashchange", onHashChange);
		window.history.pushState = originalPushState;
		window.history.replaceState = originalReplaceState;
	};
}
/** Collect static path patterns from a TanStack route tree (best-effort). */
function collectRoutePathsFromTree(routeTree) {
	const paths = /* @__PURE__ */ new Set();
	const walk = (node) => {
		if (!node || typeof node !== "object") return;
		const record = node;
		const full = typeof record.fullPath === "string" ? record.fullPath : typeof record.path === "string" ? record.path : null;
		if (full !== null && full !== "") paths.add(full.startsWith("/") ? full : `/${full}`);
		else if (full === "") paths.add("/");
		const children = record.children;
		if (Array.isArray(children)) for (const child of children) walk(child);
		else if (children && typeof children === "object") for (const child of Object.values(children)) walk(child);
	};
	walk(routeTree);
	return [...paths];
}
/**
* Mount once in `__root.tsx` so the Grok preview chrome can drive navigation
* (and later receive registered routes). Noops when the app is not embedded.
*/
function PreviewHostBridge() {
	const router = useRouter();
	(0, import_react.useEffect)(() => {
		return installPreviewHostBridge({
			navigate: (path) => {
				router.history.push(path);
			},
			getRoutePaths: () => collectRoutePathsFromTree(router.routeTree)
		});
	}, [router]);
	return null;
}
var STORAGE_KEY = "groww-connect-accent";
var ACCENTS = [
	{
		id: "blue",
		label: "Blue"
	},
	{
		id: "sea",
		label: "Sea"
	},
	{
		id: "brass",
		label: "Brass"
	}
];
function applyAccent(id) {
	document.documentElement.dataset.accent = id;
}
function AccentInit() {
	(0, import_react.useEffect)(() => {
		const saved = localStorage.getItem(STORAGE_KEY);
		if (saved === "sea" || saved === "brass" || saved === "blue") applyAccent(saved);
	}, []);
	return null;
}
function AccentSwitch() {
	const [current, setCurrent] = (0, import_react.useState)("blue");
	(0, import_react.useEffect)(() => {
		const saved = localStorage.getItem(STORAGE_KEY);
		if (saved === "sea" || saved === "brass" || saved === "blue") setCurrent(saved);
	}, []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-center gap-2",
		role: "group",
		"aria-label": "Accent color",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "hidden text-xs text-muted sm:inline",
			children: "Accent"
		}), ACCENTS.map((accent) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			type: "button",
			"aria-label": `${accent.label} accent`,
			"aria-pressed": current === accent.id,
			className: "size-11 rounded-full border border-border p-2 sm:size-8 " + (current === accent.id ? "ring-2 ring-primary ring-offset-2 ring-offset-bg" : ""),
			onClick: () => {
				applyAccent(accent.id);
				localStorage.setItem(STORAGE_KEY, accent.id);
				setCurrent(accent.id);
			},
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `block size-full rounded-full swatch-${accent.id}` })
		}, accent.id))]
	});
}
var styles_default = "/assets/styles-CbEGBlgV.css";
var APP_NAME = "Groww Connect";
/** Same public-host guard the share injector uses for og:image. */
function shareHost() {
	const raw = String({
		"BASE_URL": "/",
		"DEV": false,
		"MODE": "production",
		"PROD": true,
		"SSR": true,
		"TSS_DEV_SERVER": "false",
		"TSS_DEV_SSR_STYLES_BASEPATH": "/",
		"TSS_DEV_SSR_STYLES_ENABLED": "true",
		"TSS_DISABLE_CSRF_MIDDLEWARE_WARNING": "false",
		"TSS_INLINE_CSS_ENABLED": "false",
		"TSS_ROUTER_BASEPATH": "",
		"TSS_SERVER_FN_BASE": "/_serverFn/",
		"VITE_AUTH_ENABLED": "false",
		"VITE_DEV_SERVER_HOST": "0.0.0.0"
	}.VITE_PUBLIC_HOSTNAME || (typeof window !== "undefined" ? window.location.hostname : "")).split(",")[0].trim().split(":")[0].toLowerCase();
	if (!raw || !/^[a-z0-9.-]+$/.test(raw) || !raw.includes(".")) return "";
	if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(raw)) return "";
	if (raw === "vercel.app" || raw.endsWith(".vercel.app") || raw === "vercel.com" || raw.endsWith(".vercel.com")) return "";
	return raw;
}
var Route$3 = createRootRoute({
	head: () => {
		const host = shareHost();
		const xBanner = host ? `https://${host}/x-banner.jpg` : "";
		const ogImage = host ? `https://${host}/og.jpg` : "";
		return {
			meta: [
				{ charSet: "utf-8" },
				{
					name: "viewport",
					content: "width=device-width, initial-scale=1"
				},
				{ title: APP_NAME },
				{
					name: "description",
					content: "Groww Connect desk for Nifty 100 SMA crossovers."
				},
				{
					name: "theme-color",
					content: "#0b1016"
				},
				...host ? [
					{
						property: "og:image",
						content: ogImage
					},
					{
						property: "og:image:width",
						content: "1200"
					},
					{
						property: "og:image:height",
						content: "630"
					},
					{
						property: "x:game:image",
						content: xBanner
					},
					{
						property: "x:game:image:width",
						content: "1200"
					},
					{
						property: "x:game:image:height",
						content: "264"
					}
				] : []
			],
			links: [
				{
					rel: "icon",
					type: "image/svg+xml",
					href: "/favicon.svg"
				},
				{
					rel: "stylesheet",
					href: styles_default
				},
				{
					rel: "manifest",
					href: "/__grok/manifest.webmanifest"
				},
				{
					rel: "apple-touch-icon",
					href: "/__grok/icon-180.png"
				}
			]
		};
	},
	component: () => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("html", {
		lang: "en",
		suppressHydrationWarning: true,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("head", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HeadContent, {}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("body", { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PreviewHostBridge, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AccentInit, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AuthProvider, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Outlet, {}) }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scripts, {})
		] })]
	})
});
var $$splitComponentImporter$1 = () => import("./routes-BvbEygfn.mjs");
var Route$2 = createFileRoute("/")({ component: lazyRouteComponent($$splitComponentImporter$1, "component") });
var $$splitComponentImporter = () => import("./dashboard-BhYhFgVf.mjs");
var Route$1 = createFileRoute("/dashboard")({
	validateSearch: (search) => ({ sample: search.sample === true || search.sample === "1" || search.sample === "true" }),
	component: lazyRouteComponent($$splitComponentImporter, "component")
});
var nifty100_snapshot_default = "Company Name,Industry,Symbol,Series,ISIN Code\nABB India Ltd.,Capital Goods,ABB,EQ,INE117A01022\nAdani Energy Solutions Ltd.,Power,ADANIENSOL,EQ,INE931S01010\nAdani Enterprises Ltd.,Metals & Mining,ADANIENT,EQ,INE423A01024\nAdani Green Energy Ltd.,Power,ADANIGREEN,EQ,INE364U01010\nAdani Ports and Special Economic Zone Ltd.,Services,ADANIPORTS,EQ,INE742F01042\nAdani Power Ltd.,Power,ADANIPOWER,EQ,INE814H01029\nAmbuja Cements Ltd.,Construction Materials,AMBUJACEM,EQ,INE079A01024\nApollo Hospitals Enterprise Ltd.,Healthcare,APOLLOHOSP,EQ,INE437A01024\nAsian Paints Ltd.,Consumer Durables,ASIANPAINT,EQ,INE021A01026\nAvenue Supermarts Ltd.,Consumer Services,DMART,EQ,INE192R01011\nAxis Bank Ltd.,Financial Services,AXISBANK,EQ,INE238A01034\nBSE Ltd.,Financial Services,BSE,EQ,INE118H01025\nBajaj Auto Ltd.,Automobile and Auto Components,BAJAJ-AUTO,EQ,INE917I01010\nBajaj Finance Ltd.,Financial Services,BAJFINANCE,EQ,INE296A01032\nBajaj Finserv Ltd.,Financial Services,BAJAJFINSV,EQ,INE918I01026\nBajaj Holdings & Investment Ltd.,Financial Services,BAJAJHLDNG,EQ,INE118A01012\nBank of Baroda,Financial Services,BANKBARODA,EQ,INE028A01039\nBharat Electronics Ltd.,Capital Goods,BEL,EQ,INE263A01024\nBharat Petroleum Corporation Ltd.,Oil Gas & Consumable Fuels,BPCL,EQ,INE029A01011\nBharti Airtel Ltd.,Telecommunication,BHARTIARTL,EQ,INE397D01024\nBosch Ltd.,Automobile and Auto Components,BOSCHLTD,EQ,INE323A01026\nBritannia Industries Ltd.,Fast Moving Consumer Goods,BRITANNIA,EQ,INE216A01030\nCG Power and Industrial Solutions Ltd.,Capital Goods,CGPOWER,EQ,INE067A01029\nCanara Bank,Financial Services,CANBK,EQ,INE476A01022\nCholamandalam Investment and Finance Company Ltd.,Financial Services,CHOLAFIN,EQ,INE121A01024\nCipla Ltd.,Healthcare,CIPLA,EQ,INE059A01026\nCoal India Ltd.,Oil Gas & Consumable Fuels,COALINDIA,EQ,INE522F01014\nCummins India Ltd.,Capital Goods,CUMMINSIND,EQ,INE298A01020\nDLF Ltd.,Realty,DLF,EQ,INE271C01023\nDivi's Laboratories Ltd.,Healthcare,DIVISLAB,EQ,INE361B01024\nDr. Reddy's Laboratories Ltd.,Healthcare,DRREDDY,EQ,INE089A01031\nEicher Motors Ltd.,Automobile and Auto Components,EICHERMOT,EQ,INE066A01021\nEternal Ltd.,Consumer Services,ETERNAL,EQ,INE758T01015\nGAIL (India) Ltd.,Oil Gas & Consumable Fuels,GAIL,EQ,INE129A01019\nGodrej Consumer Products Ltd.,Fast Moving Consumer Goods,GODREJCP,EQ,INE102D01028\nGrasim Industries Ltd.,Construction Materials,GRASIM,EQ,INE047A01021\nHCL Technologies Ltd.,Information Technology,HCLTECH,EQ,INE860A01027\nHDFC Asset Management Company Ltd.,Financial Services,HDFCAMC,EQ,INE127D01025\nHDFC Bank Ltd.,Financial Services,HDFCBANK,EQ,INE040A01034\nHDFC Life Insurance Company Ltd.,Financial Services,HDFCLIFE,EQ,INE795G01014\nHindalco Industries Ltd.,Metals & Mining,HINDALCO,EQ,INE038A01020\nHindustan Aeronautics Ltd.,Capital Goods,HAL,EQ,INE066F01020\nHindustan Unilever Ltd.,Fast Moving Consumer Goods,HINDUNILVR,EQ,INE030A01027\nHindustan Zinc Ltd.,Metals & Mining,HINDZINC,EQ,INE267A01025\nHitachi Energy India Ltd.,Capital Goods,POWERINDIA,EQ,INE07Y701011\nHyundai Motor India Ltd.,Automobile and Auto Components,HYUNDAI,EQ,INE0V6F01027\nICICI Bank Ltd.,Financial Services,ICICIBANK,EQ,INE090A01021\nITC Ltd.,Fast Moving Consumer Goods,ITC,EQ,INE154A01025\nIndian Oil Corporation Ltd.,Oil Gas & Consumable Fuels,IOC,EQ,INE242A01010\nIndian Railway Finance Corporation Ltd.,Financial Services,IRFC,EQ,INE053F01010\nInfosys Ltd.,Information Technology,INFY,EQ,INE009A01021\nInterGlobe Aviation Ltd.,Services,INDIGO,EQ,INE646L01027\nJSW Steel Ltd.,Metals & Mining,JSWSTEEL,EQ,INE019A01038\nJindal Steel Ltd.,Metals & Mining,JINDALSTEL,EQ,INE749A01030\nJio Financial Services Ltd.,Financial Services,JIOFIN,EQ,INE758E01017\nKotak Mahindra Bank Ltd.,Financial Services,KOTAKBANK,EQ,INE237A01036\nLTM Ltd.,Information Technology,LTM,EQ,INE214T01019\nLarsen & Toubro Ltd.,Construction,LT,EQ,INE018A01030\nMahindra & Mahindra Ltd.,Automobile and Auto Components,M&M,EQ,INE101A01026\nMaruti Suzuki India Ltd.,Automobile and Auto Components,MARUTI,EQ,INE585B01010\nMax Healthcare Institute Ltd.,Healthcare,MAXHEALTH,EQ,INE027H01010\nMazagoan Dock Shipbuilders Ltd.,Capital Goods,MAZDOCK,EQ,INE249Z01020\nMuthoot Finance Ltd.,Financial Services,MUTHOOTFIN,EQ,INE414G01012\nNTPC Ltd.,Power,NTPC,EQ,INE733E01010\nNestle India Ltd.,Fast Moving Consumer Goods,NESTLEIND,EQ,INE239A01024\nOil & Natural Gas Corporation Ltd.,Oil Gas & Consumable Fuels,ONGC,EQ,INE213A01029\nPidilite Industries Ltd.,Chemicals,PIDILITIND,EQ,INE318A01026\nPolycab India Ltd.,Capital Goods,POLYCAB,EQ,INE455K01017\nPower Finance Corporation Ltd.,Financial Services,PFC,EQ,INE134E01011\nPower Grid Corporation of India Ltd.,Power,POWERGRID,EQ,INE752E01010\nPunjab National Bank,Financial Services,PNB,EQ,INE160A01022\nReliance Industries Ltd.,Oil Gas & Consumable Fuels,RELIANCE,EQ,INE002A01018\nSBI Life Insurance Company Ltd.,Financial Services,SBILIFE,EQ,INE123W01016\nSamvardhana Motherson International Ltd.,Automobile and Auto Components,MOTHERSON,EQ,INE775A01035\nShriram Finance Ltd.,Financial Services,SHRIRAMFIN,EQ,INE721A01047\nSiemens Energy India Ltd.,Capital Goods,ENRIN,EQ,INE1NPP01017\nSiemens Ltd.,Capital Goods,SIEMENS,EQ,INE003A01024\nSolar Industries India Ltd.,Chemicals,SOLARINDS,EQ,INE343H01029\nState Bank of India,Financial Services,SBIN,EQ,INE062A01020\nSun Pharmaceutical Industries Ltd.,Healthcare,SUNPHARMA,EQ,INE044A01036\nTVS Motor Company Ltd.,Automobile and Auto Components,TVSMOTOR,EQ,INE494B01023\nTata Capital Ltd.,Financial Services,TATACAP,EQ,INE976I01016\nTata Consultancy Services Ltd.,Information Technology,TCS,EQ,INE467B01029\nTata Consumer Products Ltd.,Fast Moving Consumer Goods,TATACONSUM,EQ,INE192A01025\nTata Motors Ltd.,Capital Goods,TMCV,EQ,INE1TAE01010\nTata Motors Passenger Vehicles Ltd.,Automobile and Auto Components,TMPV,EQ,INE155A01022\nTata Power Co. Ltd.,Power,TATAPOWER,EQ,INE245A01021\nTata Steel Ltd.,Metals & Mining,TATASTEEL,EQ,INE081A01020\nTech Mahindra Ltd.,Information Technology,TECHM,EQ,INE669C01036\nTitan Company Ltd.,Consumer Durables,TITAN,EQ,INE280A01028\nTorrent Pharmaceuticals Ltd.,Healthcare,TORNTPHARM,EQ,INE685A01028\nTrent Ltd.,Consumer Services,TRENT,EQ,INE849A01020\nUltraTech Cement Ltd.,Construction Materials,ULTRACEMCO,EQ,INE481G01011\nUnion Bank of India,Financial Services,UNIONBANK,EQ,INE692A01016\nVarun Beverages Ltd.,Fast Moving Consumer Goods,VBL,EQ,INE200M01039\nVedanta Aluminium Metal Ltd.,Metals & Mining,VAML,EQ,INE1CDF01017\nVedanta Ltd.,Metals & Mining,VEDL,EQ,INE205A01025\nVodafone Idea Ltd.,Telecommunication,IDEA,EQ,INE669E01016\nWipro Ltd.,Information Technology,WIPRO,EQ,INE075A01022\nZydus Lifesciences Ltd.,Healthcare,ZYDUSLIFE,EQ,INE010B01027\n";
/**
* Desk API for the published site.
*
* Vercel runs this Node server. It does not run a second Python process and
* it does not open port 8090. This module answers /api on the same HTTPS origin.
* Groww calls, when a login needs them, go to https://api.groww.in only.
* Order placement is not implemented.
*/
var GROWW = "https://api.groww.in";
var ALLOWED = /* @__PURE__ */ new Set([
	"/v1/token/api/access",
	"/v1/user/detail",
	"/v1/historical/candles"
]);
var g = globalThis;
function jobs() {
	g.__deskJobs ??= /* @__PURE__ */ new Map();
	return g.__deskJobs;
}
function dummies() {
	g.__deskDummies ??= [];
	return g.__deskDummies;
}
var CATALOG = [
	{
		id: "turtle",
		name: "Turtle breakout",
		source: "Richard Dennis and William Eckhardt, published 1983 rules",
		summary: "Buy when the close breaks the prior 20-day high. Sell when it breaks the prior 10-day low."
	},
	{
		id: "golden",
		name: "Golden cross",
		source: "Classic trend followers, 50-day and 200-day averages",
		summary: "Buy when the 50-day average crosses above the 200-day. Sell on the reverse cross."
	},
	{
		id: "connors",
		name: "Connors RSI-2",
		source: "Larry Connors, published short-term mean reversion",
		summary: "Buy when RSI(2) is under 10 and price is above the 200-day average. Sell when RSI(2) is over 70."
	},
	{
		id: "bollinger",
		name: "Bollinger revert",
		source: "John Bollinger bands, 20 days and 2 standard deviations",
		summary: "Buy a close under the lower band. Sell when price is back at the middle band."
	},
	{
		id: "macd",
		name: "MACD cross",
		source: "Gerald Appel, 12 / 26 / 9",
		summary: "Buy when the MACD line crosses above its signal line. Sell on the reverse cross."
	},
	{
		id: "momentum",
		name: "Six-month momentum",
		source: "Jegadeesh and Titman momentum, simplified for one stock",
		summary: "Buy when the six-month return is positive and price is above the 200-day average. Sell when the six-month return turns negative."
	}
];
var NAMES = String(nifty100_snapshot_default).trim().split(/\r?\n/).slice(1).map((line) => {
	const [company, , symbol] = line.split(",");
	return {
		company: company ?? "",
		symbol: (symbol ?? "").trim().toUpperCase()
	};
}).filter((row) => row.symbol);
function json(body, status = 200) {
	return Response.json(body, {
		status,
		headers: { "cache-control": "no-store" }
	});
}
function fail(detail, status) {
	return json({ detail }, status);
}
function istNow() {
	return new Date((/* @__PURE__ */ new Date()).toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
}
function nextExpiry() {
	const current = istNow();
	const six = new Date(current);
	six.setHours(6, 0, 0, 0);
	if (current >= six) six.setDate(six.getDate() + 1);
	return six.toISOString();
}
function sessionOk() {
	const saved = g.__deskSession;
	if (!saved) return null;
	if (Date.now() >= Date.parse(saved.expiresAt)) {
		g.__deskSession = null;
		return null;
	}
	return saved;
}
async function groww(path, token, init) {
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
			"x-api-version": "1.0"
		},
		body: init?.body === void 0 ? void 0 : JSON.stringify(init.body)
	});
	const payload = await response.json().catch(() => ({}));
	if (response.status === 401) throw Object.assign(/* @__PURE__ */ new Error("Authentication failed. Your API token has either expired or is invalid."), { status: 401 });
	if (!response.ok || payload.status === "FAILURE") {
		const message = payload.error?.displayMessage || payload.error?.message || payload.errorMessage?.message || "Groww refused the request.";
		throw Object.assign(new Error(message), { status: response.status });
	}
	return payload.payload ?? payload;
}
function sha256(value) {
	return createHash("sha256").update(value).digest("hex");
}
function weekdays(count) {
	const days = [];
	const cursor = /* @__PURE__ */ new Date();
	while (days.length < count) {
		if (cursor.getDay() !== 0 && cursor.getDay() !== 6) days.push(cursor.toISOString().slice(0, 10));
		cursor.setDate(cursor.getDate() - 1);
	}
	return days.reverse();
}
function adler(text) {
	let a = 1;
	let b = 0;
	for (let i = 0; i < text.length; i += 1) {
		a = (a + text.charCodeAt(i)) % 65521;
		b = (b + a) % 65521;
	}
	return b << 16 | a;
}
function demoCloses(symbol, kind, daysAgo, strength, n = 180) {
	const drift = strength === "strong" ? kind === "bullish" ? .0045 : -.0045 : 0;
	const dip = kind === "bullish" ? .9 : strength === "strong" ? 1.1 : 1.12;
	const crossAt = Math.max(14, n - 1 - Math.max(0, daysAgo));
	const closes = [];
	let price = 100;
	for (let i = 0; i < n; i += 1) {
		price *= Math.exp(drift);
		closes.push(price);
	}
	for (let i = crossAt - 12; i < crossAt; i += 1) closes[i] *= dip;
	const scale = .65 + adler(symbol) % 280 / 100;
	return weekdays(n).map((date, index) => ({
		date,
		close: Math.round(closes[index] * scale * 100) / 100
	}));
}
function sma(values, window) {
	const out = values.map(() => NaN);
	let sum = 0;
	for (let i = 0; i < values.length; i += 1) {
		sum += values[i];
		if (i >= window) sum -= values[i - window];
		if (i >= window - 1) out[i] = sum / window;
	}
	return out;
}
function latestCross(candles, shortW, longW, lookback) {
	const closes = candles.map((row) => row.close);
	const short = sma(closes, shortW);
	const long = sma(closes, longW);
	let found = null;
	for (let i = 1; i < closes.length; i += 1) {
		if ([
			short[i],
			long[i],
			short[i - 1],
			long[i - 1]
		].some((value) => Number.isNaN(value))) continue;
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
			bars_since: closes.length - 1 - i
		};
	}
	if (!found) return null;
	const cutoff = Date.now() - lookback * 864e5;
	if (Date.parse(found.crossover_date) < cutoff) return null;
	return found;
}
function monteCarlo(ticker, candles, cross, paths, horizon) {
	const closes = candles.map((row) => row.close);
	const returns = [];
	for (let i = 1; i < closes.length; i += 1) if (closes[i - 1] > 0 && closes[i] > 0) returns.push(Math.log(closes[i] / closes[i - 1]));
	let pUp = .5;
	let median = 0;
	let p05 = 0;
	let p95 = 0;
	if (returns.length >= 20) {
		let state = adler(`${ticker}:${paths}:${horizon}:${returns.length}`) >>> 0 || 1;
		const next = () => {
			state = 1664525 * state + 1013904223 >>> 0;
			return state / 4294967296;
		};
		const terminals = [];
		for (let path = 0; path < paths; path += 1) {
			let total = 0;
			for (let step = 0; step < horizon; step += 1) total += returns[Math.floor(next() * returns.length)];
			terminals.push(Math.expm1(total));
		}
		terminals.sort((a, b) => a - b);
		pUp = terminals.filter((value) => value > 0).length / terminals.length;
		median = terminals[Math.floor(terminals.length / 2)] ?? 0;
		p05 = terminals[Math.floor(terminals.length * .05)] ?? 0;
		p95 = terminals[Math.floor(terminals.length * .95)] ?? 0;
	}
	const fresh = cross.bars_since <= 4;
	const signal = returns.length < 20 ? "HOLD" : cross.crossover_type === "bullish" && pUp >= .58 && median > 0 ? "BUY" : cross.crossover_type === "bearish" && pUp <= .42 && median < 0 ? "SELL" : fresh ? "WATCH" : "HOLD";
	const pct = `${Math.round(pUp * 100)}%`;
	const med = `${median >= 0 ? "+" : ""}${(median * 100).toFixed(1)}%`;
	const reason = returns.length < 20 ? "Not enough daily history to simulate." : signal === "BUY" ? `${pct} of paths ended higher (median ${med}).` : signal === "SELL" ? `Only ${pct} of paths ended higher (median ${med}).` : signal === "WATCH" ? `Cross is ${cross.bars_since} session(s) old and the edge is thin (${pct} up, median ${med}).` : `No strong edge (${pct} up, median ${med}).`;
	return {
		ticker,
		signal,
		p_up: Math.round(pUp * 1e4) / 1e4,
		median_return: Math.round(median * 1e4) / 1e4,
		p05: Math.round(p05 * 1e4) / 1e4,
		p95: Math.round(p95 * 1e4) / 1e4,
		paths,
		horizon_days: horizon,
		reason
	};
}
function ema(values, span) {
	const out = values.map(() => NaN);
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
function rsi(closes, period) {
	const out = closes.map(() => NaN);
	if (closes.length <= period) return out;
	const gain = closes.map((value, index) => index === 0 ? 0 : Math.max(0, value - closes[index - 1]));
	const loss = closes.map((value, index) => index === 0 ? 0 : Math.max(0, closes[index - 1] - value));
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
function backtest(strategy, candles) {
	if (!CATALOG.some((item) => item.id === strategy)) throw new Error("Pick a strategy from the list.");
	const rows = [...candles].sort((a, b) => a.date.localeCompare(b.date));
	if (rows.length < 40) throw new Error("Not enough daily history. Need at least 40 closes.");
	const closes = rows.map((row) => row.close);
	const enter = closes.map(() => false);
	const leave = closes.map(() => false);
	if (strategy === "turtle") for (let i = 20; i < closes.length; i += 1) {
		const hi = Math.max(...closes.slice(i - 20, i));
		const lo = Math.max(i - 10, 0) === i ? closes[i] : Math.min(...closes.slice(Math.max(0, i - 10), i));
		enter[i] = closes[i] > hi;
		leave[i] = i >= 10 && closes[i] < lo;
	}
	else if (strategy === "golden") {
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
		const signal = ema(line.map((value) => Number.isNaN(value) ? 0 : value), 9);
		for (let i = 1; i < closes.length; i += 1) {
			if ([
				line[i],
				signal[i],
				line[i - 1],
				signal[i - 1]
			].some((value) => Number.isNaN(value))) continue;
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
	const trades = [];
	let equity = 1;
	let peak = 1;
	let maxDd = 0;
	closes.forEach((price, index) => {
		if (price <= 0) return;
		if (inPos && leave[index]) {
			const ret = price / entryPrice - 1;
			equity *= 1 + ret;
			trades.push({
				entry_date: entryDate,
				exit_date: rows[index].date,
				return: Math.round(ret * 1e4) / 1e4
			});
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
	const shown = trades.slice(-5).map((trade) => ({
		...trade,
		open: false
	}));
	if (inPos && entryPrice) shown.push({
		entry_date: entryDate,
		exit_date: null,
		return: Math.round((closes[closes.length - 1] / entryPrice - 1) * 1e4) / 1e4,
		open: true
	});
	return {
		strategy,
		bars: rows.length,
		from: rows[0].date,
		to: rows[rows.length - 1].date,
		trades: trades.length,
		win_rate: trades.length ? Math.round(wins / trades.length * 1e4) / 1e4 : null,
		total_return: Math.round((marked - 1) * 1e4) / 1e4,
		max_drawdown: Math.round(maxDd * 1e4) / 1e4,
		open: inPos,
		stance: inPos ? "LONG" : "FLAT",
		last_close: Math.round(closes[closes.length - 1] * 100) / 100,
		recent_trades: shown.slice(-5)
	};
}
function bar(date, open, high, low, close, volume) {
	return {
		date,
		open,
		high,
		low,
		close,
		volume
	};
}
function makeSetup(age, distance, count = 50) {
	const dates = weekdays(count);
	const breakout = count - 1 - age;
	const rows = dates.map((date, index) => {
		if (index < breakout) return bar(date, 100, 101, 99, 100.2, 1e3);
		if (index === breakout) return bar(date, 101, 112, 106, 110, 5e3);
		return bar(date, 111, index === breakout + 1 ? 118 : 114, 108, 111, 800);
	});
	const last = Math.round(109 * (1 + distance / 100) * 100) / 100;
	rows[rows.length - 1].close = last;
	rows[rows.length - 1].high = Math.max(rows[rows.length - 1].high, last);
	rows[rows.length - 1].low = Math.min(rows[rows.length - 1].low, last);
	return rows;
}
function sampleStocks() {
	const plans = [
		["setup", "2:0.20"],
		["setup", "5:-0.40"],
		["setup", "9:0.80"],
		["setup", "14:0.00"],
		["quiet", ""],
		["quiet", ""],
		["nofollow", ""],
		["far", "5.00"]
	];
	return NAMES.slice(0, 8).map((item, index) => {
		const [kind, arg] = plans[index] ?? ["quiet", ""];
		let candles;
		if (kind === "setup" || kind === "far") {
			const [age, distance] = kind === "far" ? [4, Number(arg)] : arg.split(":").map(Number);
			candles = makeSetup(age, distance);
		} else if (kind === "nofollow") {
			const dates = weekdays(50);
			const breakout = 44;
			candles = dates.map((date, i) => i === breakout ? bar(date, 101, 112, 106, 110, 5e3) : bar(date, 100, 111, 99, 100.2, 1e3));
			candles[49].close = 109;
		} else candles = weekdays(50).map((date) => bar(date, 100, 101, 99, 100.2, 1e3));
		return {
			trading_symbol: item.symbol,
			company_name: item.company,
			exchange_token: `SAMPLE-${index + 1}`,
			nifty_flags: { nifty100: true },
			tick_size: .05,
			candles
		};
	});
}
function defaultAuto(sample) {
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
		last_cycle: null
	};
}
function publicAuto(state) {
	return {
		...state,
		positions: state.positions,
		log: state.log
	};
}
function roundTick(price, tick) {
	if (!(tick > 0) || !(price > 0)) return null;
	return Math.round(price / tick) * tick;
}
function evaluate(candidate) {
	const symbol = String(candidate.symbol ?? "").toUpperCase();
	const tick = Number(candidate.tick_size ?? .05) || .05;
	const last = candidate.last_price == null || candidate.last_price === "" ? null : Number(candidate.last_price);
	const buyRaw = candidate.buy_price == null || candidate.buy_price === "" ? null : Number(candidate.buy_price);
	const row = {
		symbol,
		quantity: 1,
		buy_price: null,
		stoploss: null,
		tick_size: tick,
		last_price: Number.isFinite(last) ? last : null,
		account_state: "unknown",
		position_quantity: 0,
		active_buy_trigger_id: null,
		active_stoploss_trigger_id: null,
		day_buy_order_id: null,
		day_buy_order_status: null,
		buy_status: "invalid",
		buy_trigger_id: null,
		stoploss_status: null,
		stoploss_trigger_id: null,
		message: "Buy price is not available for this row."
	};
	if (buyRaw == null || !Number.isFinite(buyRaw) || buyRaw <= 0) return row;
	const buy = roundTick(buyRaw, tick);
	const stop = buy == null ? null : roundTick(buy * .95, tick);
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
async function readJson(request) {
	if (request.method === "GET" || request.method === "HEAD") return {};
	try {
		return await request.json();
	} catch {
		return {};
	}
}
async function handlePublishedDesk(request, path) {
	const url = new URL(path, "https://desk.invalid");
	const route = url.pathname;
	const sample = url.searchParams.get("sample") === "true";
	const body = await readJson(request);
	if (request.method === "GET" && route === "/api/health") return json({ ok: true });
	if (request.method === "GET" && route === "/api/auth/status") {
		const saved = sessionOk();
		return json(saved ? {
			authenticated: true,
			expires_at: saved.expiresAt,
			flow: saved.flow
		} : { authenticated: false });
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
		const timestamp = Math.floor(Date.now() / 1e3);
		const payload = requestToken ? {
			key_type: "totp",
			totp: requestToken
		} : {
			key_type: "approval",
			checksum: sha256(secret + String(timestamp)),
			timestamp
		};
		try {
			const result = await groww("/v1/token/api/access", apiKey, {
				method: "POST",
				body: payload
			});
			const token = typeof result.token === "string" ? result.token : "";
			if (token.length < 12) return fail("Groww did not return an access token.", 502);
			const saved = {
				token,
				flow: requestToken ? "totp" : "approval",
				expiresAt: nextExpiry()
			};
			g.__deskSession = saved;
			return json({
				ok: true,
				expires_at: saved.expiresAt,
				flow: saved.flow
			});
		} catch (error) {
			const status = error.status;
			return fail(error instanceof Error ? error.message : "Groww refused the login.", status === 401 ? 401 : 400);
		}
	}
	if (request.method === "GET" && route === "/api/demo/profile") return json({
		user_name: "Sample session",
		user_id: "SAMPLE",
		products: ["CASH", "FNO"],
		exchanges: ["NSE", "BSE"],
		ddpi_enabled: false,
		sample: true
	});
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
				sample: false
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
			const plan = index < 5 ? [
				"bullish",
				index % 3,
				"strong"
			] : index < 10 ? [
				"bearish",
				(index - 5) % 3,
				"strong"
			] : [
				"bullish",
				8,
				"mild"
			];
			const cross = latestCross(demoCloses(item.symbol, plan[0], Number(plan[1]), plan[2]), shortW, longW, lookback);
			if (!cross) return null;
			return {
				ticker: item.symbol,
				company: item.company,
				nse_token: `SAMPLE-${index + 1}`,
				...cross
			};
		}).filter((row) => row != null);
		rows.sort((a, b) => b.crossover_date.localeCompare(a.crossover_date) || a.ticker.localeCompare(b.ticker));
		const shown = rows.slice(0, maxStocks).map((row, index) => ({
			...row,
			rank: index + 1
		}));
		const job = {
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
				lookback_days: lookback
			},
			error: null
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
			results.push(monteCarlo(ticker, candles, cross, Number(body.paths ?? 1e3), Number(body.horizon_days ?? 21)));
		}
		if (!results.length) return fail("Generate signals first so daily candles are on the server, then run the simulation.", 400);
		return json({
			results,
			missing,
			sample: Boolean(body.sample)
		});
	}
	if (request.method === "POST" && route === "/api/strategies/backtest") {
		const strategy = String(body.strategy ?? "").toLowerCase();
		const ticker = String(body.ticker ?? "").toUpperCase();
		if (!ticker) return fail("Enter one NSE ticker, such as RELIANCE.", 400);
		if (!body.sample && !sessionOk()) return fail("Sign in again. There is no saved Groww access token, or it expired at 6:00 AM IST.", 401);
		try {
			return json({
				...backtest(strategy, demoCloses(ticker, adler(ticker) % 2 === 0 ? "bullish" : "bearish", 8, "strong", 420)),
				ticker,
				sample: Boolean(body.sample)
			});
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
				last_close: study.last_close
			};
		});
		rows.sort((a, b) => b.total_return - a.total_return || a.ticker.localeCompare(b.ticker));
		return json({
			strategy,
			sample: Boolean(body.sample),
			source: "niftyindices",
			rows: rows.slice(0, limit).map((row, index) => ({
				...row,
				rank: index + 1
			}))
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
			state.symbols = String(body.symbols ?? "").toUpperCase().split(/[\s,]+/).filter(Boolean).slice(0, 25);
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
		const state = g.__deskAuto[key] ??= defaultAuto(key === "sample");
		if (!state.enabled) return fail("Turn automation on before running a cycle.", 400);
		state.last_cycle = (/* @__PURE__ */ new Date()).toISOString();
		state.log.push({
			at: state.last_cycle,
			note: "Paper cycle finished. No order was sent.",
			status: "idle"
		});
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
				scanned_at: (/* @__PURE__ */ new Date()).toISOString(),
				live_status: sample ? "Sample tape. Ticks are simulated on this desk." : "Published desk is using the sample tape. No order is sent.",
				loading: false
			},
			stocks
		});
	}
	if (request.method === "GET" && route === "/api/ohlc-snapshot") {
		const wanted = (url.searchParams.get("symbols") ?? "").split(",").map((item) => item.trim().toUpperCase()).filter(Boolean);
		const prices = {};
		sampleStocks().forEach((stock) => {
			if (!wanted.includes(stock.trading_symbol)) return;
			const last = stock.candles[stock.candles.length - 1];
			prices[stock.trading_symbol] = {
				last_price: last.close,
				exchange_token: stock.exchange_token
			};
		});
		return json({
			prices,
			sample: true
		});
	}
	if (request.method === "POST" && (route === "/api/algo-orders/gtt-state" || route === "/api/algo-orders/live-gtt")) {
		if (route.endsWith("live-gtt") && body.confirm_live !== true) return fail("confirm_live must be true. No order was sent.", 400);
		const candidates = Array.isArray(body.candidates) ? body.candidates : [];
		if (route.endsWith("live-gtt")) return json({
			rows: candidates.map((candidate) => {
				const row = evaluate(candidate);
				if (row.buy_status !== "ready" || row.buy_price == null) return row;
				const id = `DUMMY-${randomBytes(4).toString("hex")}`;
				dummies().push({
					id,
					symbol: row.symbol,
					status: "ACTIVE",
					transaction_type: "BUY",
					buy_price: row.buy_price
				});
				row.buy_status = "created";
				row.buy_trigger_id = id;
				row.message = "Dummy buy GTT created. No order sent to Groww. Stoploss planned after buy execution.";
				return row;
			}),
			simulated: true
		});
		return json({
			rows: candidates.map((candidate) => evaluate(candidate)),
			simulated: true
		});
	}
	return fail("That desk route is not available.", 404);
}
function requestUrl(request) {
	try {
		return new URL(request.url);
	} catch {
		return new URL(request.url, "https://desk.invalid");
	}
}
function upstreamPath(url) {
	return `${url.pathname.replace(/^\/hds-[^/]+/i, "") || "/"}${url.search}`;
}
async function proxy(request) {
	try {
		return await handlePublishedDesk(request, upstreamPath(requestUrl(request)));
	} catch (error) {
		console.error("[desk-api]", error instanceof Error ? error.message : "failed");
		return Response.json({ detail: "The desk service is not running. Start the Python API and try again." }, {
			status: 503,
			headers: { "cache-control": "no-store" }
		});
	}
}
var Route = createFileRoute("/api/$")({ server: { handlers: {
	GET: ({ request }) => proxy(request),
	POST: ({ request }) => proxy(request),
	PUT: ({ request }) => proxy(request),
	PATCH: ({ request }) => proxy(request),
	DELETE: ({ request }) => proxy(request)
} } });
var rootRouteChildren = {
	IndexRoute: Route$2.update({
		id: "/",
		path: "/",
		getParentRoute: () => Route$3
	}),
	DashboardRoute: Route$1.update({
		id: "/dashboard",
		path: "/dashboard",
		getParentRoute: () => Route$3
	}),
	ApiSplatRoute: Route.update({
		id: "/api/$",
		path: "/api/$",
		getParentRoute: () => Route$3
	})
};
var routeTree = Route$3._addFileChildren(rootRouteChildren)._addFileTypes();
var router_exports = /* @__PURE__ */ __exportAll({ getRouter: () => getRouter });
function getRouter() {
	return createRouter({
		routeTree,
		rewrite: previewPathRewrite(),
		defaultErrorComponent: AppErrorComponent
	});
}
//#endregion
export { previewPathPrefix as i, Route$1 as n, AccentSwitch as r, router_exports as t };
