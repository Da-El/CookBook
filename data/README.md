# Grok Cookbook data stores

## FooDB (downloaded)

**Path:** `data/foodb_raw/foodb_2020_04_07_json/`  
**Source:** https://foodb.ca/downloads — JSON zip (2020-04-07)  
**Size on disk:** ~3.7 GB  

| File | Role | Downloaded? |
|------|------|-------------|
| Food.json | ~992 foods (name, group, description, picture meta) | Yes |
| Nutrient.json | Macro nutrient definitions | Yes |
| Content.json | ~5.7M content rows (compounds + nutrients in foods) | Yes (~3.3 GB) |
| Compound.json | ~70k compounds | Yes |
| Other tables | flavors, pathways, enzymes, taxonomy, etc. | Yes |

This is the **full FooDB JSON release** we downloaded.  
Not downloaded: CSV (~953 MB), XML (~6 GB), MySQL dump, or raw image binaries (images are loaded live from foodb.ca URLs).

**License:** CC BY-NC 4.0 — non-commercial + attribution; commercial use needs permission.

## USDA FoodData Central (downloaded)

**Path:** `data/usda/FoodData_Central_sr_legacy_food_json_2018-04.json`  
**Source:** https://fdc.nal.usda.gov/download-datasets  
**Size:** ~201 MB, ~7,793 SR Legacy foods  

Used only to **fill missing macros/micros** when FooDB has gaps (e.g. apple cider → closest apple juice profile).

**License:** Public domain (US government work).

## App catalog (built, what the web app loads)

**Path:** `apps/web/public/data/catalog.json`  
Built by:

1. `npm run catalog` → extract from FooDB  
2. `npm run catalog:usda` → USDA overlay for missing nutrients  
3. Or `npm run catalog:all` for both  

The browser never loads the 3.7 GB raw dump — only this compact catalog.
