import { i as __toESM } from "../_runtime.mjs";
import { q as require_react, x as require_jsx_runtime, y as useNavigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as Eye, i as KeyRound, n as ShieldCheck, o as EyeOff } from "../_libs/lucide-react.mjs";
import { r as AccentSwitch } from "./router-BPJPt6fL.mjs";
import { n as api, r as apiCandidates, t as Wordmark } from "./wordmark-B1NLevsU.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-BvbEygfn.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var fieldClass = "h-11 w-full rounded-lg border border-border bg-bg px-3 text-sm text-fg outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-primary";
var SAVED_LOGIN_KEY = "groww-connect-login";
function readSavedLogin() {
	if (typeof window === "undefined") return null;
	try {
		const raw = window.localStorage.getItem(SAVED_LOGIN_KEY);
		if (!raw) return null;
		const data = JSON.parse(raw);
		return {
			apiKey: typeof data.apiKey === "string" ? data.apiKey : "",
			apiSecret: typeof data.apiSecret === "string" ? data.apiSecret : "",
			requestToken: typeof data.requestToken === "string" ? data.requestToken : ""
		};
	} catch {
		return null;
	}
}
function LoginScreen() {
	const navigate = useNavigate();
	const [apiKey, setApiKey] = (0, import_react.useState)("");
	const [apiSecret, setApiSecret] = (0, import_react.useState)("");
	const [requestToken, setRequestToken] = (0, import_react.useState)("");
	const [showSecret, setShowSecret] = (0, import_react.useState)(false);
	const [showToken, setShowToken] = (0, import_react.useState)(false);
	const [busy, setBusy] = (0, import_react.useState)(false);
	const [error, setError] = (0, import_react.useState)(null);
	const [notice, setNotice] = (0, import_react.useState)(null);
	const [savedNote, setSavedNote] = (0, import_react.useState)(null);
	const [apiState, setApiState] = (0, import_react.useState)("checking");
	(0, import_react.useEffect)(() => {
		const saved = readSavedLogin();
		if (!saved) return;
		setApiKey(saved.apiKey);
		setApiSecret(saved.apiSecret);
		setRequestToken(saved.requestToken);
		if (saved.apiKey || saved.apiSecret || saved.requestToken) setSavedNote("Saved details loaded from this browser.");
	}, []);
	(0, import_react.useEffect)(() => {
		let cancel = false;
		let timer = 0;
		let misses = 0;
		const ping = () => {
			const urls = [...apiCandidates("/api/health"), ...apiCandidates("/api/auth/status")];
			const attempt = (index) => {
				const url = urls[index];
				if (!url) {
					misses += 1;
					setApiState("down");
					if (misses >= 2) setNotice("The page could not reach port 8090 through the website.");
					timer = window.setTimeout(ping, 1500);
					return;
				}
				fetch(url, {
					cache: "no-store",
					headers: { accept: "*/*" }
				}).then(async (response) => {
					const text = await response.text();
					let data = null;
					try {
						data = JSON.parse(text);
					} catch {
						data = null;
					}
					if (!response.ok || !data || data.offline || data.ok === false && data.authenticated === void 0) throw new Error(text.slice(0, 140) || `Status ${response.status}`);
					return data;
				}).then((status) => {
					if (cancel) return;
					misses = 0;
					setApiState("up");
					if (status.authenticated) {
						setNotice("A saved access token is already on the server. Opening your desk.");
						navigate({
							to: "/dashboard",
							search: { sample: false }
						});
						return;
					}
					setNotice(null);
				}).catch(() => {
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
		const details = {
			apiKey: apiKey.trim(),
			apiSecret: apiSecret.trim(),
			requestToken: requestToken.trim()
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
	async function onSubmit(event) {
		event.preventDefault();
		setBusy(true);
		setError(null);
		const send = () => api("/api/auth/login", {
			method: "POST",
			body: JSON.stringify({
				api_key: apiKey.trim(),
				api_secret: apiSecret.trim(),
				request_token: requestToken.trim()
			})
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
			await navigate({
				to: "/dashboard",
				search: { sample: false }
			});
		} catch (err) {
			setError(err instanceof Error ? err.message : "Login failed.");
		} finally {
			setBusy(false);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-6 sm:px-6 lg:px-8",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
			className: "flex items-center justify-between gap-4",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Wordmark, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AccentSwitch, {})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-8 grid items-start gap-8 lg:mt-14 lg:grid-cols-2",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "order-2 lg:order-1",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs font-medium tracking-widest text-primary uppercase",
						children: "Local desk"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "mt-2 max-w-md text-3xl font-semibold tracking-tight sm:text-4xl",
						children: "Sign in once. The access token stays on the server."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-3 max-w-md text-sm text-muted",
						children: "This page sends your key to the Python API. Groww's SDK mints the access token there. The browser never receives it, and a restart reuses it until 6:00 AM IST."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ol", {
						className: "mt-6 space-y-3 text-sm",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SetupStep, {
								n: "1",
								title: "Create a key",
								body: "In Groww, open Trading APIs and generate a key on the API keys page. Approve it for today if Groww asks."
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SetupStep, {
								n: "2",
								title: "API secret flow",
								body: "Paste the API key and API secret. Leave Request token empty. This is the daily-approval flow."
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SetupStep, {
								n: "3",
								title: "Or a TOTP request token",
								body: "If you use a TOTP key, paste that API key and put the 6-digit code in Request token. Leave API secret empty."
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-6 flex gap-3 rounded-lg border border-border bg-surface p-4 text-sm",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldCheck, {
							className: "mt-0.5 size-4 shrink-0 text-primary",
							"aria-hidden": "true"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-muted",
							children: "Save details keeps the key, secret, and request token in this browser so the form can fill them in again. Login still mints the access token on the server, and that token is never sent back to the page."
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", {
						className: "mt-4 rounded-lg border border-border bg-surface px-4 py-3 text-sm",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("summary", {
							className: "cursor-pointer font-medium",
							children: "Run it yourself"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-3 space-y-2 text-muted",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "From the project folder, start the API and the web app:" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", {
									className: "num overflow-x-auto rounded-lg bg-bg p-3 text-xs text-fg",
									children: `pip install -r backend/requirements.txt
python -m uvicorn main:app --app-dir backend --host 127.0.0.1 --port 8090
npm install
npm run dev`
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
									"Open the web app and sign in. The API proxies through ",
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "num",
										children: "/api"
									}),
									". Colors live in ",
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "num",
										children: "src/styles.css"
									}),
									"."
								] })
							]
						})]
					})
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "order-1 rounded-lg border border-border bg-surface p-5 sm:p-6 lg:order-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2 text-sm font-medium",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(KeyRound, {
							className: "size-4 text-primary",
							"aria-hidden": "true"
						}), "Groww login"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-sm text-muted",
						children: "Nothing here is sent to the browser after the token is created."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-2 text-xs text-muted",
						children: [
							"Desk API:",
							" ",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: apiState === "up" ? "text-up" : apiState === "down" ? "text-down" : "",
								children: apiState === "up" ? "running" : apiState === "down" ? "not answering" : "checking"
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
						className: "mt-5 space-y-4",
						onSubmit,
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "block text-sm",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "mb-1.5 block font-medium",
									children: "API key"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									className: fieldClass,
									autoComplete: "off",
									spellCheck: false,
									value: apiKey,
									onChange: (event) => setApiKey(event.target.value),
									required: true
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "block text-sm",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "mb-1.5 block font-medium",
									children: "API secret"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "relative block",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										className: fieldClass + " pr-12",
										type: showSecret ? "text" : "password",
										autoComplete: "new-password",
										spellCheck: false,
										value: apiSecret,
										onChange: (event) => setApiSecret(event.target.value)
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Reveal, {
										pressed: showSecret,
										onClick: () => setShowSecret((value) => !value),
										label: "secret"
									})]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "block text-sm",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "mb-1.5 block font-medium",
										children: "Request token"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "relative block",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											className: fieldClass + " pr-12",
											type: showToken ? "text" : "password",
											inputMode: "numeric",
											autoComplete: "one-time-code",
											spellCheck: false,
											placeholder: "TOTP, or leave blank",
											value: requestToken,
											onChange: (event) => setRequestToken(event.target.value)
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Reveal, {
											pressed: showToken,
											onClick: () => setShowToken((value) => !value),
											label: "request token"
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "mt-1.5 block text-xs text-muted",
										children: "6-digit authenticator code, or the TOTP secret. Not used with the API secret."
									})
								]
							}),
							error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "note-down rounded-lg border bg-bg px-3 py-2 text-sm text-down",
								role: "alert",
								children: error
							}) : null,
							notice ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-sm text-muted",
								children: notice
							}) : null,
							savedNote ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-sm text-muted",
								children: savedNote
							}) : null,
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "grid gap-2 sm:grid-cols-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									className: "inline-flex h-11 items-center justify-center rounded-lg border border-border bg-bg px-4 text-sm font-medium text-fg hover:bg-surface-2",
									onClick: saveDetails,
									children: "Save details"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "submit",
									disabled: busy,
									className: "inline-flex h-11 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-fg hover:opacity-90 disabled:opacity-50",
									children: busy ? "Signing in…" : "Login"
								})]
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "mt-3 inline-flex h-11 w-full items-center justify-center rounded-lg border border-border bg-bg px-4 text-sm font-medium text-fg hover:bg-surface-2",
						onClick: () => void navigate({
							to: "/dashboard",
							search: { sample: true }
						}),
						children: "Preview the dashboard with sample data"
					})
				]
			})]
		})]
	});
}
function SetupStep({ n, title, body }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
		className: "flex gap-3",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "num flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs text-primary",
			children: n
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
			className: "font-medium",
			children: [title, ". "]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "text-muted",
			children: body
		})] })]
	});
}
function Reveal({ pressed, onClick, label }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		type: "button",
		className: "absolute top-0 right-0 flex h-11 w-11 items-center justify-center text-muted hover:text-fg",
		"aria-pressed": pressed,
		"aria-label": pressed ? `Hide ${label}` : `Show ${label}`,
		onClick,
		children: pressed ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EyeOff, { className: "size-4" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Eye, { className: "size-4" })
	});
}
var SplitComponent = LoginScreen;
//#endregion
export { SplitComponent as component };
