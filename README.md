# CookBook

A chef-focused kitchen web app: browse FooDB ingredients, log a fridge, rate foods (10★), and (soon) meals & social feed.

**Stack (web-first):** Vite + React + TypeScript. Catalog built from **FooDB** + **USDA SR Legacy** overlays.

## Quick start

```powershell
# Need Node 20+
cd apps/web
npm install
npm run dev
```

Open the URL Vite prints (usually http://127.0.0.1:5173).

From repo root:

```powershell
npm run dev      # starts apps/web
npm run build    # production build
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
