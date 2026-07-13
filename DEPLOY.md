# Deploying Perp for free (Render + Tiger Cloud + Vercel)

This deploys the whole app on free tiers:

| Piece | Host | Notes |
|---|---|---|
| Postgres + TimescaleDB | **Tiger Cloud** (Timescale) | Free **30-day** trial, no credit card |
| `engine` + `dbpoller` + `backend` + Redis | **Render** (1 Docker web service) | Free forever; **sleeps after 15 min idle**, ~50s cold start, 512 MB RAM |
| `frontend` | **Vercel** | Free static hosting |

Everything the app needs is already wired up in this repo:
`Dockerfile`, `start.sh`, and `render.yaml`.

> ⚠️ **Free-tier caveats to expect**
> - The Tiger Cloud database is free for **30 days**, then it needs a paid plan.
> - The Render service **sleeps when idle**. Because `engine`/`dbpoller` live in
>   the same container, the exchange pauses while asleep and resumes on the next
>   visit (~50s cold start). In-container Redis + engine state are **ephemeral**,
>   so live orderbook/positions reset on each cold start (persisted users/orders
>   in Postgres survive). This is fine for a demo/portfolio.

---

## 0. Push these changes to GitHub

```bash
git add -A
git commit -m "Add free-tier deploy config (Docker, Render, Vercel)"
git push
```

---

## 1. Database — Tiger Cloud (TimescaleDB)

1. Go to <https://console.cloud.tigerdata.com/signup> and sign up (email only).
2. Create a new **Time Series / PostgreSQL** service (any region). Wait ~1 min.
3. Open the service → **Connection info** → copy the **Service URL**
   (looks like `postgres://tsdbadmin:PASSWORD@HOST:PORT/tsdb?sslmode=require`).
   - If the password is shown separately, paste it into the URL.
   - Make sure it ends with `?sslmode=require`.
4. Keep this string — it's your `DATABASE_URL`.

TimescaleDB is pre-installed there, so the migration's `CREATE EXTENSION timescaledb`,
hypertables, and continuous aggregates will apply cleanly.

---

## 2. Backend — Render (Blueprint)

1. Go to <https://dashboard.render.com> → sign up (connect GitHub).
2. **New → Blueprint** → pick this repo. Render reads `render.yaml` and proposes
   a service named **perp-backend**. Click **Apply**.
3. When prompted, fill the three secret env vars:
   - `DATABASE_URL` → the Tiger Cloud URL from step 1
   - `JWT_SECRET_KEY` → any long random string (e.g. `openssl rand -hex 32`)
   - `FRONTEND_ORIGIN` → set to `*` for now (you'll tighten it in step 4)
4. Deploy. First build takes a few minutes. On boot, `start.sh` launches Redis,
   runs `prisma migrate deploy`, then starts `engine`, `dbpoller`, and `backend`.
5. Copy the service URL, e.g. `https://perp-backend.onrender.com`.
   Verify it's alive: open `https://perp-backend.onrender.com/healthz` → `{"status":"ok"}`.

---

## 3. Frontend — Vercel

1. Go to <https://vercel.com> → **Add New → Project** → import this repo.
2. Set **Root Directory** to `apps/frontend` (Framework preset: **Vite**).
3. Add **Environment Variables** (from your Render URL in step 2):
   - `VITE_API_URL` = `https://perp-backend.onrender.com`
   - `VITE_WS_URL`  = `wss://perp-backend.onrender.com`   ← note `wss://`
4. **Deploy**. Copy the resulting URL, e.g. `https://perp.vercel.app`.

---

## 4. Lock down CORS

Back in Render → **perp-backend → Environment**, set:

- `FRONTEND_ORIGIN` = `https://perp.vercel.app` (your Vercel URL, no trailing slash)

Save — Render redeploys automatically. Done. Open the Vercel URL and use the app.
(The first request after idle takes ~50s while the backend wakes up.)

---

## Optional: reduce cold starts

Free Render services sleep after 15 min. To keep it warm during the day, add a
free cron ping (e.g. <https://cron-job.org>) hitting
`https://perp-backend.onrender.com/healthz` every 14 minutes.
(Don't ping 24/7 or you'll exhaust the 750 free instance-hours/month.)

## Optional: if the container runs out of memory (512 MB)

Running Redis + 3 Node processes in 512 MB is tight. If you see OOM restarts,
move Redis out of the container:

1. Render → **New → Key Value** (free) → create an instance in the same region.
2. Copy its **Internal** connection URL.
3. On **perp-backend**, set `REDIS_URL` to that URL (this overrides the
   in-container Redis; `start.sh` skips launching local Redis when `REDIS_URL`
   is external).

## Test the container locally (optional)

```bash
docker build -t perp .
docker run -p 3001:3001 \
  -e DATABASE_URL="postgres://...sslmode=require" \
  -e JWT_SECRET_KEY="dev-secret" \
  -e FRONTEND_ORIGIN="http://localhost:5173" \
  -e REDIS_ENGINE_SEND_STREAM_NAME="engine:input" \
  -e REDIS_ENGINE_RECEIVE_STREAM_NAME="backend:responses" \
  -e REDIS_ENGINE_STREAM="engine:input" \
  -e DB_POLLER_REDIS_STREAM="dbpoller:events" \
  -e PRICE_UPDATES_WEBSOCKET_BACKEND_URL="wss://fstream.binance.com/ws" \
  perp
# then open http://localhost:3001/healthz
```
