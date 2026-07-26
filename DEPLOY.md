# Deploy CookBook (Render)

## Stack

| Layer | Choice |
|-------|--------|
| Frontend | React + Vite (`apps/web`) |
| Backend | Rust Axum (`crates/cookbook-api`) |
| Database | PostgreSQL |
| Host | Render (Docker web service + managed Postgres) |

## Local development

### 1. Postgres

```powershell
docker compose up -d db
```

### 2. API

```powershell
copy .env.example .env
# ensure DATABASE_URL points at local docker
cargo run -p cookbook-api
```

API: http://127.0.0.1:8080/healthz

### 3. Web

```powershell
cd apps/web
npm install
npm run dev
```

Vite proxies `/v1` and `/healthz` to the API.

## Render (blueprint)

1. Push to GitHub (`Da-El/CookBook`).
2. Render Dashboard → **New** → **Blueprint**.
3. Select the repo. Render reads `render.yaml`.
4. Apply — creates:
   - **cookbook-api** (Docker): serves API + SPA
   - **cookbook-db** (Postgres free)
5. Wait for first deploy. Open the service URL on your phone.

Health check: `https://<your-service>.onrender.com/healthz`

## Environment (set automatically by blueprint)

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | From Render Postgres |
| `CATALOG_PATH` | `/app/catalog.json` |
| `STATIC_DIR` | `/app/static` (Vite build) |
| `PORT` | Set by Render |

## API surface (v1)

| Method | Path | Notes |
|--------|------|--------|
| GET | `/healthz` | Liveness |
| GET | `/readyz` | DB ping |
| GET | `/v1/foods?q=&group=&limit=` | Catalog search |
| GET | `/v1/foods/{id}` | Food detail |
| GET | `/v1/foods/groups` | Groups |
| GET/POST | `/v1/fridge` | Demo-user fridge (pre-auth) |
| DELETE | `/v1/fridge/{id}` | Remove item |

Auth (enterprise sessions) is next per `DESIGN.md`.

## Free tier notes

- Render free web services **spin down** after idle; first request may take ~30–60s.
- Free Postgres may sleep / have limits — fine for demos.
