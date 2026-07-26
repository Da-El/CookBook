# grok-cookbook

Chef kitchen web app (**Grok Cookbook**): FooDB ingredients, fridge, 10-star ratings, auth, meals & social next.

## Stack

| Layer | Tech |
|-------|------|
| Frontend | **React + Vite** (pps/web) |
| Backend | **Rust (Axum)** (crates/grok-cookbook-api) |
| Database | **PostgreSQL** |
| Hosting | **Render** (ender.yaml + Dockerfile) |

Repo: https://github.com/Da-El/grok-cookbook

## Quick start (frontend)

```powershell
cd apps/web
npm install
npm run dev
```

## Full local stack

```powershell
docker compose up -d db
cargo run -p grok-cookbook-api --target x86_64-pc-windows-msvc
cd apps/web
npm run dev
```

See **DEPLOY.md** for Render.

Postgres (Docker): user/password/db = `grok_cookbook`
