# Deploy Grok Cookbook (Render)

## Stack

| Layer | Choice |
|-------|--------|
| Frontend | React + Vite (`apps/web`) |
| Backend | Rust Axum (`crates/grok-cookbook-api`) |
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
cargo run -p grok-cookbook-api
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

1. Push to GitHub (`Da-El/grok_cookbook`).
2. Render Dashboard → **New** → **Blueprint**.
3. Select the repo. Render reads `render.yaml`.
4. Apply — creates:
   - **grok-cookbook-api** (Docker): serves API + SPA
   - **grok-cookbook-db** (Postgres free)
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
| POST | `/v1/auth/register` | Create account |
| POST | `/v1/auth/login` | Returns access + refresh tokens |
| POST | `/v1/auth/refresh` | Rotate refresh, mint access |
| POST | `/v1/auth/logout` | Revoke current session |
| POST | `/v1/auth/logout-all` | Revoke all + bump token_version |
| GET | `/v1/auth/me` | Current user |
| GET | `/v1/auth/sessions` | Active sessions |
| GET | `/v1/foods?q=&group=&limit=` | Catalog search |
| GET | `/v1/foods/{id}` | Food detail |
| GET | `/v1/foods/groups` | Groups |
| GET/POST | `/v1/fridge` | Auth required |
| DELETE | `/v1/fridge/{id}` | Auth required |

Auth: Argon2id passwords, 15m JWT access, rotating hashed refresh tokens, session inventory.

## Free tier notes

- Render free web services **spin down** after idle; first request may take ~30–60s.
- Free Postgres may sleep / have limits — fine for demos.

## Live URL (CLI deploy)

- App (API + SPA + PWA): https://cookbook-sqbd.onrender.com
- Health: https://cookbook-sqbd.onrender.com/healthz
- Dashboard: https://dashboard.render.com/web/srv-d9iobpf41pts73bi1cg0
- Postgres: cookbook-db (free)

### Mobile PWA

1. Open the live URL on your phone.
2. First load may take 30�60s if free tier spun down.
3. Chrome/Safari: Add to Home Screen / Install app.

### CLI used

`render login`
`render postgres create --name cookbook-db --plan free ...`
`render services create --name cookbook --runtime docker --repo Da-El/grok-cookbook ...`
`render deploys create <serviceId> --wait`
