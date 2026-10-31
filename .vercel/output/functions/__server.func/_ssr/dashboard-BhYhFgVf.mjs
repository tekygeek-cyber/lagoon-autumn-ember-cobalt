import { i as __toESM } from "../_runtime.mjs";
import { q as require_react, x as require_jsx_runtime, y as useNavigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { r as LogOut } from "../_libs/lucide-react.mjs";
import { i as previewPathPrefix, n as Route$1, r as AccentSwitch } from "./router-BPJPt6fL.mjs";
import { a as inr, i as expiryLabel, n as api, o as pct, s as prettyDate, t as Wordmark } from "./wordmark-B1NLevsU.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/dashboard-BhYhFgVf.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var fieldClass = "h-11 w-full rounded-lg border border-border bg-bg px-3 text-sm text-fg outline-none focus-visible:ring-2 focus-visible:ring-primary";
function StrategiesPanel({ sample }) {
	const [list, setList] = (0, import_react.useState)([]);
	const [strategy, setStrategy] = (0, import_react.useState)("turtle");
	const [ticker, setTicker] = (0, import_react.useState)("RELIANCE");
	const [study, setStudy] = (0, import_react.useState)(null);
	const [busy, setBusy] = (0, import_react.useState)(false);
	const [error, setError] = (0, import_react.useState)(null);
	const [auto, setAuto] = (0, import_react.useState)(null);
	const [mode, setMode] = (0, import_react.useState)("paper");
	const [quantity, setQuantity] = (0, import_react.useState)(1);
	const [maxOrders, setMaxOrders] = (0, import_react.useState)(3);
	const [book, setBook] = (0, import_react.useState)("");
	const [confirm, setConfirm] = (0, import_react.useState)("");
	const [autoError, setAutoError] = (0, import_react.useState)(null);
	const [cycling, setCycling] = (0, import_react.useState)(false);
	const [board, setBoard] = (0, import_react.useState)([]);
	const [ranking, setRanking] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		let cancel = false;
		api("/api/strategies").then((payload) => {
			if (!cancel) setList(payload.strategies);
		}).catch(() => {
			if (!cancel) setError("Could not load the strategy list.");
		});
		api(`/api/automation${sample ? "?sample=true" : "?sample=false"}`).then((state) => {
			if (cancel) return;
			setAuto(state);
			setStrategy(state.strategy || "turtle");
			setQuantity(state.quantity || 1);
			setMaxOrders(state.max_orders || 3);
			setBook((state.symbols || []).join(", "));
			setMode(state.mode === "live" ? "live" : "paper");
		}).catch(() => {});
		return () => {
			cancel = true;
		};
	}, [sample]);
	async function runBacktest() {
		setBusy(true);
		setError(null);
		try {
			const result = await api("/api/strategies/backtest", {
				method: "POST",
				body: JSON.stringify({
					strategy,
					ticker,
					sample
				})
			});
			setStudy(result);
		} catch (err) {
			setStudy(null);
			setError(err instanceof Error ? err.message : "Backtest failed.");
		} finally {
			setBusy(false);
		}
	}
	async function rankBook() {
		setRanking(true);
		setError(null);
		try {
			const payload = await api("/api/strategies/board", {
				method: "POST",
				body: JSON.stringify({
					strategy,
					sample,
					limit: 15
				})
			});
			setBoard(payload.rows);
		} catch (err) {
			setBoard([]);
			setError(err instanceof Error ? err.message : "Could not rank the book.");
		} finally {
			setRanking(false);
		}
	}
	function useLongs() {
		const longs = board.filter((row) => row.stance === "LONG").map((row) => row.ticker);
		if (longs.length) setBook(longs.join(", "));
	}
	async function saveAuto(enabled) {
		setAutoError(null);
		try {
			const next = await api("/api/automation", {
				method: "POST",
				body: JSON.stringify({
					enabled,
					mode: sample ? "paper" : mode,
					strategy,
					quantity,
					max_orders: maxOrders,
					symbols: book,
					confirm,
					sample
				})
			});
			setAuto(next);
			if (!enabled) setConfirm("");
		} catch (err) {
			setAutoError(err instanceof Error ? err.message : "Could not update automation.");
		}
	}
	async function runCycle() {
		setCycling(true);
		setAutoError(null);
		try {
			const next = await api(`/api/automation/cycle?sample=${sample ? "true" : "false"}`, { method: "POST" });
			setAuto(next);
		} catch (err) {
			setAutoError(err instanceof Error ? err.message : "Cycle failed.");
		} finally {
			setCycling(false);
		}
	}
	const positions = auto ? Object.entries(auto.positions) : [];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
			className: "text-2xl font-semibold tracking-tight",
			children: "Strategies"
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-1 max-w-3xl text-sm text-muted",
			children: "Published playbooks from Dennis, Connors, Appel, Bollinger, and the momentum research of Jegadeesh and Titman. These are not a private fund's model. The study uses daily closes. Nothing is ordered until you arm automation."
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-5 grid gap-3 lg:grid-cols-2",
			children: list.map((item) => {
				const selected = strategy === item.id;
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					"aria-pressed": selected,
					onClick: () => setStrategy(item.id),
					className: "rounded-lg border p-4 text-left " + (selected ? "border-primary bg-surface-2" : "border-border bg-surface hover:bg-surface-2"),
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "block text-sm font-semibold",
							children: item.name
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "mt-1 block text-xs text-primary",
							children: item.source
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "mt-2 block text-sm text-muted",
							children: item.summary
						})
					]
				}, item.id);
			})
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-5 grid gap-3 rounded-lg border border-border bg-surface p-4 sm:grid-cols-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
				className: "block text-sm sm:col-span-1",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "mb-1.5 block text-xs font-medium tracking-wide text-muted uppercase",
					children: "Ticker"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					className: fieldClass + " num",
					value: ticker,
					spellCheck: false,
					onChange: (event) => setTicker(event.target.value.toUpperCase())
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-col items-stretch justify-end gap-2 sm:col-span-2 sm:flex-row",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					disabled: busy,
					onClick: () => void runBacktest(),
					className: "inline-flex h-11 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-fg hover:opacity-90 disabled:opacity-50",
					children: busy ? "Running study…" : "Run backtest"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					disabled: ranking,
					onClick: () => void rankBook(),
					className: "inline-flex h-11 items-center justify-center rounded-lg border border-border bg-bg px-4 text-sm font-medium text-fg hover:bg-surface-2 disabled:opacity-50",
					children: ranking ? "Ranking…" : "Rank the book"
				})]
			})]
		}),
		error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "note-down mt-3 rounded-lg border bg-surface px-4 py-3 text-sm text-down",
			role: "alert",
			children: error
		}) : null,
		study ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Metric, {
					label: "Total return",
					value: pct(study.total_return)
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Metric, {
					label: "Max drawdown",
					value: pct(study.max_drawdown)
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Metric, {
					label: "Closed trades",
					value: String(study.trades)
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Metric, {
					label: "Win rate",
					value: study.win_rate === null ? "—" : `${Math.round(study.win_rate * 100)}%`
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-sm text-muted sm:col-span-2 lg:col-span-4",
					children: [
						study.ticker,
						" is ",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-fg",
							children: study.stance
						}),
						" on this rule. Last close",
						" ",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "num text-fg",
							children: inr(study.last_close)
						}),
						". ",
						study.bars,
						" daily bars, ",
						study.from,
						" to",
						" ",
						study.to,
						".",
						study.open ? " One trade is still open, so its result is inside the total return." : "",
						study.sample ? " Sample prices, not the live tape." : ""
					]
				}),
				study.recent_trades.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "overflow-x-auto rounded-lg border border-border sm:col-span-2 lg:col-span-4",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
						className: "w-full min-w-max text-left text-sm",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
							className: "bg-bg text-xs tracking-wide text-muted uppercase",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "px-3 py-2 font-medium",
									children: "Entered"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "px-3 py-2 font-medium",
									children: "Exited"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "px-3 py-2 text-right font-medium",
									children: "Return"
								})
							] })
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: study.recent_trades.map((trade) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
							className: "border-t border-border",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "num px-3 py-2",
									children: trade.entry_date
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "num px-3 py-2",
									children: trade.open ? "Open" : trade.exit_date
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "num px-3 py-2 text-right",
									children: pct(trade.return)
								})
							]
						}, `${trade.entry_date}-${trade.exit_date ?? "open"}`)) })]
					})
				}) : null
			]
		}) : null,
		board.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-4 overflow-x-auto rounded-lg border border-border",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
				className: "w-full min-w-max text-left text-sm",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
					className: "bg-surface text-xs tracking-wide text-muted uppercase",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "px-3 py-3 font-medium",
							children: "Rank"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "px-3 py-3 font-medium",
							children: "Ticker"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "px-3 py-3 font-medium",
							children: "Company"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "px-3 py-3 font-medium",
							children: "Stance"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "px-3 py-3 text-right font-medium",
							children: "Return"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "px-3 py-3 text-right font-medium",
							children: "Drawdown"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "px-3 py-3 text-right font-medium",
							children: "Trades"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "px-3 py-3 text-right font-medium",
							children: "Close"
						})
					] })
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: board.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
					className: "border-t border-border",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "num px-3 py-2",
							children: row.rank
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "px-3 py-2 font-medium",
							children: row.ticker
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "max-w-[16rem] truncate px-3 py-2 text-muted",
							children: row.company
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "px-3 py-2",
							children: row.stance
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "num px-3 py-2 text-right",
							children: pct(row.total_return)
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "num px-3 py-2 text-right",
							children: pct(row.max_drawdown)
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
							className: "num px-3 py-2 text-right",
							children: [row.trades, row.open ? " + open" : ""]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "num px-3 py-2 text-right",
							children: inr(row.last_close)
						})
					]
				}, row.ticker)) })]
			})
		}) : null,
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-6 rounded-lg border border-border bg-surface p-4",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "text-base font-semibold",
					children: "Automated trading"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 max-w-3xl text-sm text-muted",
					children: "While this is on, the desk checks the saved names about every 90 seconds and also when you run a cycle. Every fill stays on the paper ledger. Live sending is off, including when the mode says Live. No order is sent to Groww."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "block text-sm",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "mb-1.5 block text-xs font-medium tracking-wide text-muted uppercase",
								children: "Mode"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
								className: fieldClass,
								value: sample ? "paper" : mode,
								disabled: sample,
								onChange: (event) => setMode(event.target.value === "live" ? "live" : "paper"),
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: "paper",
									children: "Paper"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: "live",
									children: "Live"
								})]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "block text-sm",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "mb-1.5 block text-xs font-medium tracking-wide text-muted uppercase",
								children: "Shares"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								className: fieldClass + " num",
								type: "number",
								min: 1,
								max: 10,
								value: quantity,
								onChange: (event) => setQuantity(Number(event.target.value))
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "block text-sm",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "mb-1.5 block text-xs font-medium tracking-wide text-muted uppercase",
								children: "Max orders"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								className: fieldClass + " num",
								type: "number",
								min: 1,
								max: 5,
								value: maxOrders,
								onChange: (event) => setMaxOrders(Number(event.target.value))
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "block text-sm lg:col-span-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "mb-1.5 block text-xs font-medium tracking-wide text-muted uppercase",
								children: "Book, blank uses scanned names"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								className: fieldClass + " num",
								value: book,
								spellCheck: false,
								placeholder: "RELIANCE, TCS, INFY",
								onChange: (event) => setBook(event.target.value.toUpperCase())
							})]
						}),
						!sample && mode === "live" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "block text-sm lg:col-span-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "mb-1.5 block text-xs font-medium tracking-wide text-muted uppercase",
								children: "Type ENABLE LIVE"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								className: fieldClass + " num",
								value: confirm,
								spellCheck: false,
								onChange: (event) => setConfirm(event.target.value)
							})]
						}) : null
					]
				}),
				sample ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-3 text-xs text-watch",
					children: "Sample mode stays on paper. Sign in to arm live orders."
				}) : null,
				auto?.live_armed ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "note-down mt-3 rounded-lg border px-3 py-2 text-sm text-down",
					children: "Live mode is armed, but cycles still stay on the paper ledger. Nothing is sent to Groww."
				}) : null,
				autoError ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-3 text-sm text-down",
					role: "alert",
					children: autoError
				}) : null,
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-4 flex flex-col gap-2 sm:flex-row",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => void saveAuto(!auto?.enabled),
							className: "inline-flex h-11 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-fg hover:opacity-90",
							children: auto?.enabled ? "Turn automation off" : "Turn automation on"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							disabled: !auto?.enabled || cycling,
							onClick: () => void runCycle(),
							className: "inline-flex h-11 items-center justify-center rounded-lg border border-border bg-bg px-4 text-sm font-medium text-fg hover:bg-surface-2 disabled:opacity-50",
							children: cycling ? "Running cycle…" : "Run cycle now"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							disabled: board.length === 0,
							onClick: useLongs,
							className: "inline-flex h-11 items-center justify-center rounded-lg border border-border bg-bg px-4 text-sm font-medium text-fg hover:bg-surface-2 disabled:opacity-50",
							children: "Use longs"
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-3 text-xs text-muted",
					children: [auto?.enabled ? `On · ${auto.mode === "live" ? "live" : "paper"} · ${auto.strategy}` : "Automation is off.", auto?.last_cycle ? ` Last cycle ${auto.last_cycle.slice(0, 16).replace("T", " ")}.` : ""]
				}),
				positions.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "mt-3 space-y-1 text-sm",
					children: positions.map(([symbol, position]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "num text-muted",
						children: [
							symbol,
							" · ",
							position.qty,
							" @ ",
							inr(position.entry)
						]
					}, symbol))
				}) : null,
				auto && auto.log.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "mt-3 space-y-2",
					children: auto.log.slice().reverse().slice(0, 6).map((row, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "text-xs text-muted",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-fg",
							children: row.side ? `${row.side} ${row.ticker ?? ""}` : row.status === "idle" ? "Idle" : "Note"
						}), row.note ? ` — ${row.note}` : ""]
					}, `${row.at}-${index}`))
				}) : null
			]
		})
	] });
}
function Metric({ label, value }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
		className: "rounded-lg border border-border bg-surface p-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-xs tracking-wide text-muted uppercase",
			children: label
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "num mt-2 text-lg font-medium",
			children: value
		})]
	});
}
var VOLUME_MULTIPLE = 3;
var PRICE_LOOKBACK = 20;
var MAX_AGE = 20;
var MIDPOINT_TOLERANCE = 1;
function dateText(value) {
	if (typeof value === "number" || typeof value === "string" && /^\d+$/.test(value.trim())) {
		let n = Number(value);
		if (n > 1e10) n /= 1e3;
		const day = /* @__PURE__ */ new Date(n * 1e3);
		if (Number.isNaN(day.getTime())) return null;
		return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
	}
	const text = String(value ?? "").trim().slice(0, 10);
	return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}
function normalizeCandles(raw) {
	const parsed = [];
	for (const row of raw) {
		let candle = null;
		if (row && typeof row === "object" && !Array.isArray(row)) {
			const item = row;
			const date = dateText(item.date ?? item.timestamp ?? item.time);
			const open = Number(item.open);
			const high = Number(item.high);
			const low = Number(item.low);
			const close = Number(item.close);
			const volume = Number(item.volume ?? 0);
			if (date && [
				open,
				high,
				low,
				close,
				volume
			].every((n) => Number.isFinite(n))) candle = {
				date,
				open,
				high,
				low,
				close,
				volume
			};
		} else if (Array.isArray(row) && row.length >= 5) {
			const date = dateText(row[0]);
			const open = Number(row[1]);
			const high = Number(row[2]);
			const low = Number(row[3]);
			const close = Number(row[4]);
			const volume = row.length > 5 && row[5] != null ? Number(row[5]) : 0;
			if (date && [
				open,
				high,
				low,
				close,
				volume
			].every((n) => Number.isFinite(n))) candle = {
				date,
				open,
				high,
				low,
				close,
				volume
			};
		}
		if (candle) parsed.push(candle);
	}
	parsed.sort((a, b) => a.date.localeCompare(b.date));
	const dedup = /* @__PURE__ */ new Map();
	for (const candle of parsed) dedup.set(candle.date, candle);
	return [...dedup.values()];
}
function scanStock(raw) {
	const candles = normalizeCandles(raw);
	const count = candles.length;
	if (count < 25) return null;
	const latest = count - 1;
	const earliest = Math.max(PRICE_LOOKBACK, latest - MAX_AGE);
	for (let index = count - 2; index >= earliest; index -= 1) {
		const window = candles.slice(index - PRICE_LOOKBACK, index);
		if (window.length < PRICE_LOOKBACK) continue;
		const average = window.reduce((sum, item) => sum + item.volume, 0) / PRICE_LOOKBACK;
		const previousHigh = Math.max(...window.map((item) => item.high));
		const candle = candles[index];
		if (!average) continue;
		if (!(candle.close > candle.open)) continue;
		if (!(candle.volume >= VOLUME_MULTIPLE * average)) continue;
		if (!(candle.close > previousHigh)) continue;
		const after = candles.slice(index + 1);
		if (after.length === 0) continue;
		const maxAfter = Math.max(...after.map((item) => item.high));
		if (!(maxAfter > candle.high)) continue;
		const midpoint = (candle.high + candle.low) / 2;
		if (!midpoint) continue;
		const current = candles[latest].close;
		const distance = (current - midpoint) / midpoint * 100;
		const age = latest - index;
		if (Math.abs(distance) > MIDPOINT_TOLERANCE || age > MAX_AGE) continue;
		return {
			breakoutDate: candle.date,
			bIndex: index,
			daysSince: age,
			breakoutLow: round4(candle.low),
			breakoutHigh: round4(candle.high),
			midpoint: round4(midpoint),
			distanceFromMidpoint: round4(distance),
			volMultiple: round4(candle.volume / average),
			prevHigh: round4(previousHigh),
			maxPriceAfter: round4(maxAfter),
			returnFromCloseToSubHigh: round4((maxAfter - candle.close) / candle.close * 100),
			retracementHigh: round4((current - maxAfter) / maxAfter * 100),
			currentPrice: round4(current)
		};
	}
	return null;
}
function round4(value) {
	return Math.round(value * 1e4) / 1e4;
}
function scanBook(stocks) {
	const hits = [];
	for (const stock of stocks) {
		const setup = scanStock(stock.candles ?? []);
		if (!setup) continue;
		hits.push({
			...setup,
			symbol: stock.trading_symbol,
			companyName: stock.company_name ?? stock.trading_symbol,
			exchange_token: String(stock.exchange_token ?? ""),
			candles: normalizeCandles(stock.candles ?? [])
		});
	}
	hits.sort((a, b) => a.daysSince - b.daysSince || Math.abs(a.distanceFromMidpoint) - Math.abs(b.distanceFromMidpoint));
	return {
		scanned: stocks.length,
		hits
	};
}
var AlgoContext = (0, import_react.createContext)(null);
function AlgoProvider({ sample, children }) {
	const [loading, setLoading] = (0, import_react.useState)(true);
	const [error, setError] = (0, import_react.useState)(null);
	const [liveStatus, setLiveStatus] = (0, import_react.useState)("Connecting to the tape…");
	const [tickStatus, setTickStatus] = (0, import_react.useState)("Tick socket idle");
	const [stocks, setStocks] = (0, import_react.useState)([]);
	const [ticks, setTicks] = (0, import_react.useState)({});
	const [snapshot, setSnapshot] = (0, import_react.useState)({});
	const [selected, setSelected] = (0, import_react.useState)(null);
	const [gttRows, setGttRows] = (0, import_react.useState)([]);
	const [gttError, setGttError] = (0, import_react.useState)(null);
	const [running, setRunning] = (0, import_react.useState)(false);
	const load = (0, import_react.useCallback)(async (refresh) => {
		const payload = await api(`/api/scanner-data${`?sample=${sample ? "true" : "false"}${refresh ? "&refresh=true" : ""}`}`);
		setStocks(payload.stocks ?? []);
		setLiveStatus(payload.metadata?.live_status || "Scanner cache loaded");
		return payload.stocks ?? [];
	}, [sample]);
	(0, import_react.useEffect)(() => {
		let cancel = false;
		setLoading(true);
		setError(null);
		load(false).catch((err) => {
			if (!cancel) setError(err instanceof Error ? err.message : "Could not load the scanner.");
		}).finally(() => {
			if (!cancel) setLoading(false);
		});
		return () => {
			cancel = true;
		};
	}, [load]);
	const book = (0, import_react.useMemo)(() => scanBook(stocks), [stocks]);
	const tokens = book.hits.map((hit) => hit.exchange_token).filter(Boolean).join(",");
	(0, import_react.useEffect)(() => {
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
				const payload = JSON.parse(String(event.data));
				const next = {};
				for (const tick of payload.ticks ?? []) if (tick.exchange_token && Number.isFinite(tick.ltp)) next[tick.exchange_token] = tick.ltp;
				if (Object.keys(next).length) setTicks((current) => ({
					...current,
					...next
				}));
			} catch {}
		};
		return () => socket.close();
	}, [tokens]);
	const priceFor = (0, import_react.useCallback)((hit) => {
		const live = ticks[hit.exchange_token];
		if (Number.isFinite(live)) return live;
		const shot = snapshot[hit.symbol];
		if (Number.isFinite(shot)) return shot;
		return hit.currentPrice;
	}, [snapshot, ticks]);
	const runLive = (0, import_react.useCallback)(async () => {
		setRunning(true);
		setGttError(null);
		try {
			const fresh = await load(true);
			const scanned = scanBook(fresh);
			const symbols = scanned.hits.map((hit) => hit.symbol).join(",");
			let shot = {};
			if (symbols) {
				const ohlc = await api(`/api/ohlc-snapshot?sample=${sample ? "true" : "false"}&symbols=${encodeURIComponent(symbols)}`);
				shot = Object.fromEntries(Object.entries(ohlc.prices ?? {}).filter((entry) => Number.isFinite(entry[1]?.last_price)).map(([symbol, row]) => [symbol, Number(row.last_price)]));
				setSnapshot((current) => ({
					...current,
					...shot
				}));
			}
			const candidates = scanned.hits.map((hit) => {
				const stock = fresh.find((item) => item.trading_symbol === hit.symbol);
				const last = ticks[hit.exchange_token] ?? shot[hit.symbol] ?? null;
				return {
					symbol: hit.symbol,
					buy_price: hit.breakoutLow,
					last_price: last,
					tick_size: stock?.tick_size ?? .05,
					exchange_token: hit.exchange_token
				};
			});
			const state = await api("/api/algo-orders/gtt-state", {
				method: "POST",
				body: JSON.stringify({
					sample,
					confirm_live: false,
					candidates
				})
			});
			const ready = (state.rows ?? []).filter((row) => row.buy_status === "ready" && row.buy_price != null && row.stoploss != null && row.last_price != null);
			let placed = [];
			if (ready.length) placed = (await api("/api/algo-orders/live-gtt", {
				method: "POST",
				body: JSON.stringify({
					sample,
					confirm_live: true,
					candidates: ready.map((row) => ({
						symbol: row.symbol,
						buy_price: row.buy_price,
						last_price: row.last_price,
						tick_size: row.tick_size
					}))
				})
			})).rows ?? [];
			const bySymbol = /* @__PURE__ */ new Map();
			for (const row of state.rows ?? []) bySymbol.set(row.symbol, row);
			for (const row of placed) bySymbol.set(row.symbol, row);
			setGttRows([...bySymbol.values()]);
		} catch (err) {
			setGttError(err instanceof Error ? err.message : "Run Live failed.");
		} finally {
			setRunning(false);
		}
	}, [
		load,
		sample,
		ticks
	]);
	const ltpFor = (0, import_react.useCallback)((hit) => {
		const live = ticks[hit.exchange_token];
		if (Number.isFinite(live)) return live;
		const shot = snapshot[hit.symbol];
		if (Number.isFinite(shot)) return shot;
		return null;
	}, [snapshot, ticks]);
	const value = {
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
		runLive
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlgoContext.Provider, {
		value,
		children
	});
}
function useAlgo() {
	const value = (0, import_react.useContext)(AlgoContext);
	if (!value) throw new Error("Algo book is missing.");
	return value;
}
function signed(value) {
	return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}
function AlgoSignalsPanel() {
	const algo = useAlgo();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex flex-wrap items-start justify-between gap-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "text-2xl font-semibold tracking-tight",
				children: "High-volume breakout and retest setups"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 max-w-3xl text-sm text-muted",
				children: "A breakout needs a green close through the prior 20-day high on at least 3× volume, a higher high after that candle, and a retest within 1% of the breakout midpoint."
			})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				disabled: algo.running || algo.loading,
				onClick: () => void algo.runLive(),
				className: "inline-flex h-11 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-fg hover:opacity-90 disabled:opacity-50",
				children: algo.running ? "Running..." : "Run Live"
			})]
		}),
		algo.gttError ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "note-down mt-4 rounded-lg border bg-surface px-4 py-3 text-sm text-down",
			role: "alert",
			children: algo.gttError
		}) : null,
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
			className: "mt-4 text-sm text-muted",
			children: [
				algo.hits.length,
				" triggered breakouts · ",
				algo.scanned,
				" stocks scanned · ",
				algo.liveStatus,
				" · ",
				algo.tickStatus
			]
		}),
		algo.error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "note-down mt-3 rounded-lg border bg-surface px-4 py-3 text-sm text-down",
			role: "alert",
			children: algo.error
		}) : null,
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
			className: "mt-5 text-base font-semibold",
			children: "Triggered Breakouts"
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-2 overflow-x-auto rounded-lg border border-border",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
				className: "w-full min-w-max text-left text-xs",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
					className: "bg-surface tracking-wide text-muted uppercase",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", { children: [
						"Rank",
						"Symbol",
						"Current Price",
						"Breakout Date",
						"Age",
						"Breakout Vol",
						"Retest Distance",
						"Peak Gains",
						"Retracement"
					].map((label) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "px-2 py-2 font-medium whitespace-nowrap",
						children: label
					}, label)) })
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: algo.loading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
					colSpan: 9,
					className: "px-3 py-8 text-center text-sm text-muted",
					children: "Loading scanner cache..."
				}) }) : algo.hits.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
					colSpan: 9,
					className: "px-3 py-8 text-center text-sm text-muted",
					children: "No breakout retest setups match the current parameters."
				}) }) : algo.hits.map((hit, index) => {
					const price = algo.priceFor(hit);
					const selected = algo.selected === hit.symbol;
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
						onClick: () => algo.setSelected(hit.symbol),
						className: "cursor-pointer border-t border-border " + (selected ? "bg-surface-2" : "hover:bg-surface"),
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "num px-2 py-1.5",
								children: index + 1
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-2 py-1.5 text-sm font-semibold",
								children: hit.symbol
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "num px-2 py-1.5",
								children: price == null ? "Waiting" : inr(price)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "num px-2 py-1.5",
								children: hit.breakoutDate
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "num px-2 py-1.5",
								children: hit.daysSince
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
								className: "num px-2 py-1.5",
								children: [hit.volMultiple.toFixed(2), "x"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "num px-2 py-1.5",
								children: signed(hit.distanceFromMidpoint)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "num px-2 py-1.5",
								children: signed(hit.returnFromCloseToSubHigh)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "num px-2 py-1.5",
								children: signed(hit.retracementHigh)
							})
						]
					}, hit.symbol);
				}) })]
			})
		})
	] });
}
function money(value) {
	return value == null ? "—" : inr(value);
}
function GttPanel() {
	const algo = useAlgo();
	const bySymbol = new Map(algo.gttRows.map((row) => [row.symbol, row]));
	const visible = algo.hits.map((hit) => {
		const known = bySymbol.get(hit.symbol);
		if (known) return known;
		const last = algo.ltpFor(hit);
		const waiting = last == null;
		return {
			symbol: hit.symbol,
			quantity: 1,
			buy_price: hit.breakoutLow,
			stoploss: null,
			tick_size: null,
			last_price: last,
			account_state: waiting ? "waiting" : "clear",
			position_quantity: 0,
			active_buy_trigger_id: null,
			active_stoploss_trigger_id: null,
			day_buy_order_id: null,
			day_buy_order_status: null,
			buy_status: waiting ? "waiting" : "ready",
			buy_trigger_id: null,
			stoploss_status: "planned_after_buy",
			stoploss_trigger_id: null,
			message: waiting ? "Waiting for LTP." : "Run Live on Algo Signals to create a dummy GTT."
		};
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
			className: "text-2xl font-semibold tracking-tight",
			children: "GTT Order Placement"
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-1 max-w-3xl text-sm text-muted",
			children: "Read-only status from Algo Signals · Qty 1 · Buy GTT at breakout candle low · Stoploss 5% below buy · State from Groww orders, positions, holdings, and GTTs"
		}),
		algo.gttError ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "note-down mt-4 rounded-lg border bg-surface px-4 py-3 text-sm text-down",
			role: "alert",
			children: algo.gttError
		}) : null,
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
			className: "mt-5 text-base font-semibold",
			children: "Groww GTT Placement"
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-1 text-xs text-muted",
			children: "Simulation only. Run Live writes a local DUMMY- record and does not send an order to Groww."
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-3 overflow-x-auto rounded-lg border border-border",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
				className: "w-full min-w-max text-left text-xs",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
					className: "bg-surface tracking-wide text-muted uppercase",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", { children: [
						"Rank",
						"Symbol",
						"Qty",
						"Buy",
						"Stoploss",
						"Last Price",
						"Account State",
						"Buy Status",
						"Buy Trigger",
						"Day Buy Order",
						"Position Qty",
						"Stoploss Status",
						"Stoploss Trigger",
						"Message"
					].map((label) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "px-2 py-2 font-medium whitespace-nowrap",
						children: label
					}, label)) })
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: algo.loading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
					colSpan: 14,
					className: "px-3 py-8 text-center text-sm text-muted",
					children: "Loading scanner cache..."
				}) }) : visible.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
					colSpan: 14,
					className: "px-3 py-8 text-center text-sm text-muted",
					children: "No breakout retest setups match the current parameters."
				}) }) : visible.map((row, index) => {
					const hit = algo.hits.find((item) => item.symbol === row.symbol);
					const last = (hit ? algo.ltpFor(hit) : null) ?? row.last_price;
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
						onClick: () => algo.setSelected(row.symbol),
						className: "border-t border-border " + (algo.selected === row.symbol ? "bg-surface-2" : "hover:bg-surface"),
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "num px-2 py-1.5",
								children: index + 1
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-2 py-1.5 text-sm font-semibold",
								children: row.symbol
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "num px-2 py-1.5",
								children: row.quantity
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "num px-2 py-1.5",
								children: money(row.buy_price)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "num px-2 py-1.5",
								children: money(row.stoploss)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "num px-2 py-1.5",
								children: last == null ? "Waiting" : inr(last)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-2 py-1.5",
								children: row.account_state
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-2 py-1.5",
								children: row.buy_status
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "num px-2 py-1.5",
								children: row.buy_trigger_id ?? "—"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "num px-2 py-1.5",
								children: row.day_buy_order_id ?? "—"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "num px-2 py-1.5",
								children: row.position_quantity
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-2 py-1.5",
								children: row.stoploss_status ?? "—"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "num px-2 py-1.5",
								children: row.stoploss_trigger_id ?? "—"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "max-w-[18rem] px-2 py-1.5 text-muted",
								children: row.message
							})
						]
					}, row.symbol);
				}) })]
			})
		})
	] });
}
var GUIDE = [
	{
		signal: "BUY",
		text: "Bullish cross, at least 58% of paths finish higher, and the median path is up."
	},
	{
		signal: "SELL",
		text: "Bearish cross, at most 42% of paths finish higher, and the median path is down."
	},
	{
		signal: "WATCH",
		text: "The cross is four sessions old or newer, but the simulated edge is still too small to act."
	},
	{
		signal: "HOLD",
		text: "A cross is on the board, yet the simulation does not support buying or selling."
	}
];
var PRODUCT_LABEL = {
	CASH: "Cash equity",
	FNO: "Futures & options",
	CNC: "Delivery (CNC)",
	MIS: "Intraday (MIS)",
	NRML: "Normal (NRML)"
};
function Desk({ sample }) {
	const navigate = useNavigate();
	const [tab, setTab] = (0, import_react.useState)("user");
	const [ready, setReady] = (0, import_react.useState)(sample);
	const [session, setSession] = (0, import_react.useState)(null);
	const [profile, setProfile] = (0, import_react.useState)(null);
	const [profileError, setProfileError] = (0, import_react.useState)(null);
	const [profileLoading, setProfileLoading] = (0, import_react.useState)(true);
	(0, import_react.useEffect)(() => {
		let cancel = false;
		if (sample) {
			setReady(true);
			return;
		}
		api("/api/auth/status").then((status) => {
			if (cancel) return;
			if (!status.authenticated) {
				navigate({ to: "/" });
				return;
			}
			setSession(status);
			setReady(true);
		}).catch(() => {
			if (!cancel) {
				setReady(true);
				setProfileError("The desk service is not reachable yet.");
			}
		});
		return () => {
			cancel = true;
		};
	}, [navigate, sample]);
	(0, import_react.useEffect)(() => {
		if (!ready) return;
		let cancel = false;
		setProfileLoading(true);
		setProfileError(null);
		api(sample ? "/api/demo/profile" : "/api/profile").then((next) => {
			if (!cancel) setProfile(next);
		}).catch((err) => {
			if (cancel) return;
			const message = err instanceof Error ? err.message : "Could not load the profile.";
			if (!sample && /sign in/i.test(message)) {
				navigate({ to: "/" });
				return;
			}
			setProfileError(message);
		}).finally(() => {
			if (!cancel) setProfileLoading(false);
		});
		return () => {
			cancel = true;
		};
	}, [
		navigate,
		ready,
		sample
	]);
	async function signOut() {
		if (sample) {
			await navigate({ to: "/" });
			return;
		}
		try {
			await api("/api/auth/logout", { method: "POST" });
		} catch {}
		await navigate({ to: "/" });
	}
	if (!ready) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
		className: "mx-auto max-w-6xl px-4 py-10",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-sm text-muted",
			children: "Checking the saved session…"
		})
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-h-screen",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("header", {
			className: "sticky top-0 z-10 border-b border-border bg-bg",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6 lg:px-8",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Wordmark, { compact: true }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "ml-auto flex items-center gap-2 sm:gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AccentSwitch, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: () => void signOut(),
						className: "inline-flex h-11 items-center gap-2 rounded-lg border border-border px-3 text-sm text-fg hover:bg-surface",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LogOut, {
							className: "size-4",
							"aria-hidden": "true"
						}), sample ? "Exit sample" : "Sign out"]
					})]
				})]
			})
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
			className: "mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AlgoProvider, {
				sample,
				children: [
					sample ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "note-watch mb-4 rounded-lg border bg-surface px-4 py-3 text-sm text-watch",
						children: "Sample data. Prices are invented so you can learn the screen. Sign in to scan the live Nifty 100."
					}) : session?.expires_at ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mb-4 rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted",
						children: [
							"Access token is on the server until ",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-fg",
								children: expiryLabel(session.expires_at)
							}),
							session.flow === "totp" ? " (TOTP login)" : " (API secret login)",
							". It is not in this browser."
						]
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						role: "tablist",
						"aria-label": "Desk",
						className: "flex flex-wrap gap-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabButton, {
								id: "user",
								selected: tab === "user",
								onSelect: () => setTab("user"),
								label: "User"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabButton, {
								id: "signals",
								selected: tab === "signals",
								onSelect: () => setTab("signals"),
								label: "Signals"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabButton, {
								id: "strategies",
								selected: tab === "strategies",
								onSelect: () => setTab("strategies"),
								label: "Strategies"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabButton, {
								id: "algo",
								selected: tab === "algo",
								onSelect: () => setTab("algo"),
								label: "Algo Signals"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabButton, {
								id: "gtt",
								selected: tab === "gtt",
								onSelect: () => setTab("gtt"),
								label: "GTT Placement"
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-5",
						role: "tabpanel",
						id: "panel-user",
						"aria-labelledby": "tab-user",
						hidden: tab !== "user",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(UserPanel, {
							profile,
							loading: profileLoading,
							error: profileError
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-5",
						role: "tabpanel",
						id: "panel-signals",
						"aria-labelledby": "tab-signals",
						hidden: tab !== "signals",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SignalsPanel, { sample })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-5",
						role: "tabpanel",
						id: "panel-strategies",
						"aria-labelledby": "tab-strategies",
						hidden: tab !== "strategies",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StrategiesPanel, { sample })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-5",
						role: "tabpanel",
						id: "panel-algo",
						"aria-labelledby": "tab-algo",
						hidden: tab !== "algo",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlgoSignalsPanel, {})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-5",
						role: "tabpanel",
						id: "panel-gtt",
						"aria-labelledby": "tab-gtt",
						hidden: tab !== "gtt",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GttPanel, {})
					})
				]
			})
		})]
	});
}
function TabButton({ id, label, selected, onSelect }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		type: "button",
		role: "tab",
		id: `tab-${id}`,
		"aria-selected": selected,
		"aria-controls": `panel-${id}`,
		className: "h-11 rounded-lg px-4 text-sm font-medium " + (selected ? "bg-primary text-primary-fg" : "border border-border bg-surface text-fg hover:bg-surface-2"),
		onClick: onSelect,
		children: label
	});
}
function UserPanel({ profile, loading, error }) {
	if (loading) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "text-sm text-muted",
		children: "Loading profile…"
	});
	if (error) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "note-down rounded-lg border bg-surface px-4 py-3 text-sm text-down",
		role: "alert",
		children: error
	});
	if (!profile) return null;
	const products = profile.products.map((item) => PRODUCT_LABEL[item] ?? item);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
			className: "text-2xl font-semibold tracking-tight",
			children: "Account"
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
			className: "mt-1 max-w-2xl text-sm text-muted",
			children: ["Groww's profile call returns your client code, enabled segments, and exchange access. It does not return a display name.", profile.ddpi_enabled === null ? "" : profile.ddpi_enabled ? " DDPI is enabled on this account." : " DDPI is not enabled on this account."]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-5 grid gap-3 sm:grid-cols-2",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
					label: "User name",
					value: profile.user_name ?? "Not provided by Groww",
					muted: !profile.user_name
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
					label: "User ID",
					value: profile.user_id ?? "—",
					mono: true
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
					label: "Products",
					value: products.length ? products.join(", ") : "—"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
					label: "Exchanges",
					value: profile.exchanges.length ? profile.exchanges.join(", ") : "—"
				})
			]
		})
	] });
}
function Stat({ label, value, mono = false, muted = false }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
		className: "rounded-lg border border-border bg-surface p-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-xs tracking-wide text-muted uppercase",
			children: label
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: (mono ? "num " : "") + "mt-2 text-lg font-medium " + (muted ? "text-muted" : "text-fg"),
			children: value
		})]
	});
}
function SignalsPanel({ sample }) {
	const [params, setParams] = (0, import_react.useState)({
		short_window: 6,
		long_window: 30,
		lookback_days: 90,
		max_stocks: 25
	});
	const [paths, setPaths] = (0, import_react.useState)(1e3);
	const [horizon, setHorizon] = (0, import_react.useState)(21);
	const [job, setJob] = (0, import_react.useState)(null);
	const [scanning, setScanning] = (0, import_react.useState)(false);
	const [scanError, setScanError] = (0, import_react.useState)(null);
	const [selected, setSelected] = (0, import_react.useState)([]);
	const [sim, setSim] = (0, import_react.useState)({});
	const [simulating, setSimulating] = (0, import_react.useState)(false);
	const [simError, setSimError] = (0, import_react.useState)(null);
	const rows = job?.results ?? [];
	const meta = job?.meta ?? null;
	const shortLabel = meta?.short_window ?? params.short_window;
	const longLabel = meta?.long_window ?? params.long_window;
	const windowsMatch = !meta || meta.short_window === params.short_window && meta.long_window === params.long_window && meta.lookback_days === params.lookback_days;
	(0, import_react.useEffect)(() => {
		if (!job || job.status !== "running") return;
		let cancel = false;
		const timer = window.setInterval(() => {
			api(`/api/signals/jobs/${job.id}`).then((next) => {
				if (cancel) return;
				setJob(next);
				if (next.status !== "running") {
					setScanning(false);
					if (next.status === "error") setScanError(next.error || "Scan failed.");
				}
			}).catch((err) => {
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
	function toggle(ticker) {
		setSelected((current) => current.includes(ticker) ? current.filter((item) => item !== ticker) : [...current, ticker]);
	}
	async function generate() {
		setScanning(true);
		setScanError(null);
		setSim({});
		setSelected([]);
		setJob(null);
		try {
			const started = await api(sample ? "/api/demo/scan" : "/api/signals/scan", {
				method: "POST",
				body: JSON.stringify(params)
			});
			setJob({
				id: started.id,
				status: "running",
				done: 0,
				total: 0,
				message: "Starting",
				results: null,
				meta: null,
				error: null
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
			const payload = await api("/api/signals/simulate", {
				method: "POST",
				body: JSON.stringify({
					tickers: selected,
					short_window: params.short_window,
					long_window: params.long_window,
					lookback_days: params.lookback_days,
					paths,
					horizon_days: horizon,
					sample
				})
			});
			const next = {};
			for (const row of payload.results) next[row.ticker] = row;
			setSim(next);
		} catch (err) {
			setSimError(err instanceof Error ? err.message : "Simulation failed.");
		} finally {
			setSimulating(false);
		}
	}
	const progress = job && job.total > 0 ? Math.min(100, Math.round(job.done / job.total * 100)) : scanning ? 8 : 0;
	const counts = (0, import_react.useMemo)(() => {
		const tally = {
			BUY: 0,
			SELL: 0,
			HOLD: 0,
			WATCH: 0
		};
		for (const item of Object.values(sim)) tally[item.signal] += 1;
		return tally;
	}, [sim]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
			className: "text-2xl font-semibold tracking-tight",
			children: "Signals"
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-1 max-w-3xl text-sm text-muted",
			children: "Loads the official Nifty 100 list, matches each symbol to its NSE cash token, then reads daily candles. A bullish cross is the short average moving above the long average. Results are ranked by the newest cross."
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-5 grid gap-3 rounded-lg border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-5",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(NumberField, {
					label: "Short SMA",
					value: params.short_window,
					onChange: (value) => setParams({
						...params,
						short_window: value
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(NumberField, {
					label: "Long SMA",
					value: params.long_window,
					onChange: (value) => setParams({
						...params,
						long_window: value
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(NumberField, {
					label: "Lookback days",
					value: params.lookback_days,
					onChange: (value) => setParams({
						...params,
						lookback_days: value
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(NumberField, {
					label: "Max stocks",
					value: params.max_stocks,
					onChange: (value) => setParams({
						...params,
						max_stocks: value
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex items-end",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						disabled: scanning,
						onClick: () => void generate(),
						className: "inline-flex h-11 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-fg hover:opacity-90 disabled:opacity-50",
						children: scanning ? "Scanning…" : "Generate signals"
					})
				})
			]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-2 text-xs text-muted",
			children: "Lookback is calendar days. Max stocks is how many ranked names to show, after the full list is scanned. Close and both averages are the latest daily bar. A live pass can take a minute; candles are cached on the server."
		}),
		scanning ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-4",
			"aria-live": "polite",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "h-2 overflow-hidden rounded-full bg-surface-2",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "h-full bg-primary transition-all",
					style: { width: `${progress}%` }
				})
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-2 text-xs text-muted",
				children: [
					job?.message || "Working",
					" ",
					job?.total ? `· ${job.done}/${job.total}` : ""
				]
			})]
		}) : null,
		scanError ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "note-down mt-4 rounded-lg border bg-surface px-4 py-3 text-sm text-down",
			role: "alert",
			children: scanError
		}) : null,
		meta ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
			className: "mt-4 text-sm text-muted",
			children: [
				meta.with_crossover,
				" names crossed inside ",
				meta.lookback_days,
				" days. Showing ",
				meta.shown,
				". Matched",
				" ",
				meta.matched,
				" of ",
				meta.universe,
				" to an NSE token",
				meta.source === "snapshot" ? " (saved Nifty list — the live file was unavailable)" : "",
				".",
				meta.unmapped.length ? ` Skipped with no token: ${meta.unmapped.join(", ")}.` : "",
				meta.failed.length ? ` Could not download: ${meta.failed.join(", ")}.` : ""
			]
		}) : null,
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-4 overflow-x-auto rounded-lg border border-border",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
				className: "w-full min-w-max text-left text-sm",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
					className: "bg-surface text-xs tracking-wide text-muted uppercase",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "w-12 px-3 py-3",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "checkbox",
								className: "size-4 accent-primary",
								"aria-label": "Select all",
								checked: allSelected,
								onChange: () => setSelected(allSelected ? [] : rows.map((row) => row.ticker))
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "px-3 py-3 font-medium",
							children: "Rank"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "px-3 py-3 font-medium",
							children: "Ticker"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "px-3 py-3 font-medium",
							children: "Company"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "px-3 py-3 font-medium",
							children: "Crossover"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "px-3 py-3 font-medium",
							children: "Date"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "px-3 py-3 text-right font-medium",
							children: "Close"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("th", {
							className: "px-3 py-3 text-right font-medium",
							children: ["SMA ", shortLabel]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("th", {
							className: "px-3 py-3 text-right font-medium",
							children: ["SMA ", longLabel]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "px-3 py-3 font-medium",
							children: "Signal"
						})
					] })
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: rows.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
					colSpan: 10,
					className: "px-4 py-10 text-center text-sm text-muted",
					children: scanning ? "Scanning the Nifty 100…" : "Generate signals to fill this table."
				}) }) : rows.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SignalTableRow, {
					row,
					checked: selected.includes(row.ticker),
					onToggle: () => toggle(row.ticker),
					sim: sim[row.ticker]
				}, row.ticker)) })]
			})
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-5 rounded-lg border border-border bg-surface p-4",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "text-base font-semibold",
					children: "Monte Carlo"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 max-w-3xl text-sm text-muted",
					children: "Pick names in the table. Each path resamples that stock's own daily returns and walks them forward. The same candles and settings always give the same label. This is a study, not an order, and nothing is sent to the exchange."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(NumberField, {
							label: "Paths",
							value: paths,
							onChange: setPaths
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(NumberField, {
							label: "Horizon days",
							value: horizon,
							onChange: setHorizon
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex items-end lg:col-span-2",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								disabled: simulating || selected.length === 0,
								onClick: () => void simulate(),
								className: "inline-flex h-11 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-fg hover:opacity-90 disabled:opacity-50",
								children: simulating ? "Simulating…" : `Run simulation${selected.length ? ` (${selected.length})` : ""}`
							})
						})
					]
				}),
				!windowsMatch ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-3 text-xs text-watch",
					children: "Inputs changed. Generate signals again before simulating."
				}) : null,
				simError ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-3 text-sm text-down",
					role: "alert",
					children: simError
				}) : null,
				Object.keys(sim).length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "num mt-3 text-xs text-muted",
					children: [
						"BUY ",
						counts.BUY,
						" · SELL ",
						counts.SELL,
						" · WATCH ",
						counts.WATCH,
						" · HOLD ",
						counts.HOLD
					]
				}) : null,
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "mt-4 grid gap-2 sm:grid-cols-2",
					children: GUIDE.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "flex gap-2 text-xs text-muted",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SignalChip, { signal: item.signal }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: item.text })]
					}, item.signal))
				})
			]
		})
	] });
}
function SignalTableRow({ row, checked, onToggle, sim }) {
	const bullish = row.crossover_type === "bullish";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
		className: checked ? "border-t border-border bg-surface-2" : "border-t border-border",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
				className: "px-3 py-3",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					type: "checkbox",
					className: "size-4 accent-primary",
					"aria-label": `Select ${row.ticker}`,
					checked,
					onChange: onToggle
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
				className: "num px-3 py-3 text-muted",
				children: row.rank
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
				className: "px-3 py-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "font-medium",
					children: row.ticker
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "num text-xs text-muted",
					children: ["NSE ", row.nse_token]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
				className: "max-w-56 truncate px-3 py-3 text-muted",
				title: row.company,
				children: row.company
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
				className: "px-3 py-3",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "rounded-full px-2 py-1 text-xs font-medium " + (bullish ? "tone-up" : "tone-down"),
					children: bullish ? "Bullish" : "Bearish"
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
				className: "num px-3 py-3 whitespace-nowrap",
				children: prettyDate(row.crossover_date)
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
				className: "num px-3 py-3 text-right",
				children: inr(row.close)
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
				className: "num px-3 py-3 text-right",
				children: inr(row.sma_short)
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
				className: "num px-3 py-3 text-right",
				children: inr(row.sma_long)
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
				className: "px-3 py-3",
				children: sim ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SignalChip, { signal: sim.signal }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 max-w-48 text-xs text-muted",
					children: sim.reason
				})] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-muted",
					children: "—"
				})
			})
		]
	});
}
function SignalChip({ signal }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: `num rounded-full px-2 py-1 text-xs font-medium ${signal === "BUY" ? "tone-up" : signal === "SELL" ? "tone-down" : signal === "WATCH" ? "tone-watch" : "tone-hold"}`,
		children: signal
	});
}
function NumberField({ label, value, onChange }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
		className: "block text-sm",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "mb-1.5 block text-xs font-medium tracking-wide text-muted uppercase",
			children: label
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
			className: "h-11 w-full rounded-lg border border-border bg-bg px-3 text-sm text-fg outline-none focus-visible:ring-2 focus-visible:ring-primary num",
			type: "number",
			inputMode: "numeric",
			value: Number.isFinite(value) ? value : 0,
			onChange: (event) => onChange(Number(event.target.value))
		})]
	});
}
function DashboardRoute() {
	const { sample } = Route$1.useSearch();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Desk, { sample });
}
//#endregion
export { DashboardRoute as component };
