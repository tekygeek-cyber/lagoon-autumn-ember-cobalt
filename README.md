# Groww Connect

A dark desk for a Groww account: sign in with the official Python SDK, then scan the Nifty 100 for SMA crossovers and stress-test the names you pick.

The access token is created on the API and saved in `backend/data/session.json`. The browser never receives it. Restarting the app reuses that file until 6:00 AM IST.

## Run

```bash
pip install -r backend/requirements.txt
python -m uvicorn main:app --app-dir backend --host 127.0.0.1 --port 8090
npm install
npm run dev
```

The live preview talks to the Python service on this machine. The published site does not. Vercel runs the Node server only, so the published `/api` routes live in that server and call Groww at `https://api.groww.in`. Port 8090 is not part of the published site. The access token is never returned to the browser. Order placement is not implemented.

## Sign in

1. Create a key at [Groww API keys](https://groww.in/trade-api/api-keys). Approve it for the day if Groww asks.
2. **API secret flow:** API key + API secret. Leave Request token empty.
3. **TOTP flow:** API key + the 6-digit code in Request token. Leave API secret empty.

`GrowwAPI.get_access_token` mints the token. Profile data comes from `get_user_profile`.

## Signals

- Constituents: the official Nifty Indices file `ind_nifty100list.csv`.
- Each symbol is matched to the NSE cash row in Groww's instrument master (`exchange_token`, the NSE token).
- Daily candles come from `get_historical_candles` (`1day`).
- Bullish: short SMA crosses above long SMA. Bearish: the reverse. Newest cross ranks first.
- Monte Carlo resamples that stock's daily returns. Labels are Buy, Sell, Watch, or Hold. The Signals tab does not place orders.

## Strategies

The Strategies tab backtests six published long-only rules on daily closes: Turtle breakout, golden cross, Connors RSI-2, Bollinger revert, MACD cross, and six-month momentum. Cycles update a paper ledger only. No order is sent to Groww.

## Algo Signals

The Algo Signals tab loads `GET /api/scanner-data` and looks for a high-volume breakout that has pulled back to within 1% of the breakout midpoint. **Run Live** creates a local dummy buy GTT (`DUMMY-` ids) after a read-only Groww state check. It never calls `place_order` or `create_smart_order`.

## Customize

Color tokens and accent presets (`blue`, `sea`, `brass`) are in `src/styles.css`. The header switch stores the choice in the browser.
