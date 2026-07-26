# CookBook

Chef kitchen web app: FooDB ingredients, fridge, 10★ ratings, meals & social next.

## Stack

| Layer | Tech |
|-------|------|
| Frontend | **React + Vite** (`apps/web`) |
| Backend | **Rust (Axum)** (`crates/cookbook-api`) |
| Database | **PostgreSQL** |
| Hosting | **Render** (`render.yaml` + `Dockerfile`) |

Catalog data: **FooDB** + **USDA** overlays → `apps/web/public/data/catalog.json`.

## Quick start (frontend only)

```powershell
cd apps/web
npm install
npm run dev
```

→ http://127.0.0.1:5173

## Full local stack

```powershell
# 1) Postgres
docker compose up -d db

# 2) API (needs Rust + Docker Postgres)
copy .env.example .env
cargo run -p cookbook-api

# 3) Web (separate terminal)
cd apps/web
npm run dev
```

Vite proxies `/v1` and `/healthz` to `http://127.0.0.1:8080`.

See **[DEPLOY.md](./DEPLOY.md)** for Render.

From repo root:

```powershell
npm run dev        # web only
npm run build      # web production build
cargo run -p cookbook-api
```

## Features (current)

| Area | Status |
|------|--------|
| All **992** FooDB foods with detail pages | Live |
| Search / browse / group filter | Live |
| Fridge (localStorage) | Live |
| Add ingredient + optional review | Live |
| 10-star ratings (ingredients & meal shell) | Live |
| Light / dark theme | Live |
| FooDB + USDA nutrient enrichment | Live |
| Auth, meals CRUD, social feed | Next |

### Important URLs

- `/` — home  
- `/ingredients/browse` — all foods  
- `/ingredients/:id` — ingredient page  
- `/ingredients` — your fridge  
- `/ingredients/add` — add to fridge  
- `/kitchen` — profile + fridge tabs  
- `/settings` — theme & local data  

## Catalog data

The app loads `apps/web/public/data/catalog.json` (committed, ~3 MB).

Offline dumps (not in git — too large):

| Path | Source |
|------|--------|
| `data/foodb_raw/` | FooDB JSON dump (~3.7 GB) |
| `data/usda/` | USDA SR Legacy + Foundation |

Rebuild catalog after downloading dumps:

```powershell
npm run catalog:all   # FooDB extract + multi-pass USDA enrich
```

Missing-field report after enrich:

- `data/MISSING_DATA.md`
- `data/missing-data-report.json`

## Design

- Product design doc: `DESIGN.md`
- Static HTML mockups: `design/`

## License notes

- **FooDB** data: [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) — attribution required; commercial use needs permission from FooDB rights holders.
- **USDA FoodData Central**: U.S. government public domain.
- **This application code**: see repository license (add one if desired).

## Author

GitHub: [Da-El](https://github.com/Da-El)
