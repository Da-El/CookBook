# CookBook data stores

## USDA Foundation Foods (active catalog source)

**Path:** `data/usda/FoodData_Central_foundation_food_json_2026-04-30.json` (latest dump)  
**Source:** https://fdc.nal.usda.gov/download-datasets  
**Foods:** ~360+ Foundation Foods (grows as USDA adds items; live site may show more)  
**License:** Public domain / CC0 1.0 — free for commercial use  

Build the app catalog:

```bash
npm run catalog
```

Writes `apps/web/public/data/catalog.json` (what the web app + API load).

## Optional: SR Legacy (not in app catalog)

**Path:** `data/usda/FoodData_Central_sr_legacy_food_json_2018-04.json`  
~7,793 historic SR foods. Kept on disk if you want a future “expanded” catalog, but **not** used in the live app after the Foundation-only switch.

## Removed: FooDB

FooDB dumps (`data/foodb_raw/`) are **no longer used** and should be deleted from disk (large, CC BY-NC).  
Ingredient IDs are now `fdc-<id>` (USDA FDC ids), not `FOOD#####`.

## App catalog

**Path:** `apps/web/public/data/catalog.json`  

| Field | Notes |
|-------|--------|
| `id` | `fdc-321358` style |
| `fdc_id` | USDA FDC integer |
| `macros` | kcal, protein, fat, carbs, fiber per 100 g |
| `micros` | curated vitamins & minerals |
| `source` | USDA Foundation Foods |

Redeploy the Render Docker image after regenerating `catalog.json` so production picks it up.
