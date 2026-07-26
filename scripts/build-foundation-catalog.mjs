/**
 * Build CookBook ingredient catalog from USDA Foundation Foods only.
 *
 * Input:  data/usda/FoodData_Central_foundation_food_json_*.json
 * Output: apps/web/public/data/catalog.json
 *
 * License: USDA public domain / CC0 — free for commercial use.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const usdaDir = path.join(root, "data", "usda");
const outFile = path.join(root, "apps", "web", "public", "data", "catalog.json");

/** USDA nutrient number → macro field (per 100 g) */
const MACRO = {
  208: "energy_kcal", // classic Energy kcal
  203: "protein_g",
  204: "fat_g",
  205: "carbs_g",
  291: "fiber_g",
};

/** Prefer classic 208, then Atwater specific/general, then kJ */
const ENERGY_CODES = ["208", "958", "957", "268"];

/** Preferred micro nutrients (USDA number → display) */
const MICRO = {
  301: { name: "Calcium", unit: "mg" },
  303: { name: "Iron", unit: "mg" },
  304: { name: "Magnesium", unit: "mg" },
  305: { name: "Phosphorus", unit: "mg" },
  306: { name: "Potassium", unit: "mg" },
  307: { name: "Sodium", unit: "mg" },
  309: { name: "Zinc", unit: "mg" },
  312: { name: "Copper", unit: "mg" },
  315: { name: "Manganese", unit: "mg" },
  317: { name: "Selenium", unit: "µg" },
  401: { name: "Vitamin C", unit: "mg" },
  320: { name: "Vitamin A (RAE)", unit: "µg" },
  328: { name: "Vitamin D (D2+D3)", unit: "µg" },
  323: { name: "Vitamin E (alpha-tocopherol)", unit: "mg" },
  430: { name: "Vitamin K (phylloquinone)", unit: "µg" },
  404: { name: "Thiamine (B1)", unit: "mg" },
  405: { name: "Riboflavin (B2)", unit: "mg" },
  406: { name: "Niacin (B3)", unit: "mg" },
  410: { name: "Pantothenic acid (B5)", unit: "mg" },
  415: { name: "Vitamin B6", unit: "mg" },
  417: { name: "Folate, total", unit: "µg" },
  418: { name: "Vitamin B12", unit: "µg" },
  421: { name: "Choline, total", unit: "mg" },
};

function findFoundationJson(dir) {
  if (!fs.existsSync(dir)) return null;
  const files = fs
    .readdirSync(dir)
    .filter((n) => /foundation.*\.json$/i.test(n) || /FoodData_Central_foundation/i.test(n))
    .map((n) => path.join(dir, n));
  if (!files.length) return null;
  files.sort();
  return files[files.length - 1]; // latest by name
}

function num(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function nutrientNumber(row) {
  const n = row.nutrient?.number ?? row.number ?? row.nutrientNumber;
  return n != null ? String(n) : "";
}

function nutrientAmount(row) {
  return num(row.amount ?? row.value);
}

function nutrientUnit(row) {
  return row.nutrient?.unitName ?? row.unitName ?? row.unit ?? "";
}

function nutrientName(row) {
  return row.nutrient?.name ?? row.name ?? "Unknown";
}

function round(n, d = 2) {
  if (n == null) return null;
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

function main() {
  const srcPath = findFoundationJson(usdaDir);
  if (!srcPath) {
    console.error("No Foundation Foods JSON in data/usda/");
    console.error("Download from https://fdc.nal.usda.gov/download-datasets");
    process.exit(1);
  }
  console.log("Reading", srcPath);
  const raw = JSON.parse(fs.readFileSync(srcPath, "utf8"));
  const list = raw.FoundationFoods || raw.foundationFoods || [];
  if (!list.length) {
    console.error("No FoundationFoods array in file");
    process.exit(1);
  }

  const foods = list.map((f) => {
    const fdcId = f.fdcId;
    const macros = {
      energy_kcal: null,
      protein_g: null,
      fat_g: null,
      carbs_g: null,
      fiber_g: null,
    };
    const micros = [];
    const other = [];
    const seenMicro = new Set();

    // First pass: collect energy candidates by priority
    const energyByCode = {};
    for (const row of f.foodNutrients || []) {
      const code = nutrientNumber(row);
      const amount = nutrientAmount(row);
      if (amount == null) continue;
      const unit = nutrientUnit(row);
      const name = nutrientName(row);

      if (ENERGY_CODES.includes(code)) {
        const u = unit.toLowerCase();
        const kcal = u.includes("kj") ? amount / 4.184 : amount;
        energyByCode[code] = round(kcal, 1);
      }

      if (MACRO[code] && code !== "208") {
        macros[MACRO[code]] = round(amount, 2);
        continue;
      }
      if (code === "208") {
        // handled via ENERGY_CODES
        continue;
      }

      if (MICRO[code] && !seenMicro.has(code)) {
        seenMicro.add(code);
        micros.push({
          name: MICRO[code].name,
          amount: round(amount, 3),
          unit: unit || MICRO[code].unit,
        });
        continue;
      }

      // Skip noise / duplicates for "other"
      if (amount === 0) continue;
      if (other.length < 40) {
        other.push({
          name,
          amount: round(amount, 3),
          unit: unit || "",
        });
      }
    }
    for (const code of ENERGY_CODES) {
      if (energyByCode[code] != null) {
        macros.energy_kcal = energyByCode[code];
        break;
      }
    }

    micros.sort((a, b) => a.name.localeCompare(b.name));

    const macrosComplete =
      macros.energy_kcal != null &&
      macros.protein_g != null &&
      macros.fat_g != null &&
      macros.carbs_g != null;

    const group = f.foodCategory?.description || f.foodCategory?.description || "Uncategorized";
    const name = (f.description || `FDC ${fdcId}`).trim();

    return {
      id: `fdc-${fdcId}`,
      fdc_id: fdcId,
      ndb_number: f.ndbNumber ?? null,
      foodb_id: null,
      name,
      name_scientific: f.scientificName || null,
      description: name,
      food_group: typeof group === "string" ? group : "Uncategorized",
      food_subgroup: f.dataType || "Foundation",
      picture: null,
      picture_candidates: [],
      emoji: "",
      source: "USDA Foundation Foods",
      macros,
      macros_complete: macrosComplete,
      micros,
      other_nutrients: other,
      nutrient_sources: {
        macros: "usda_foundation",
        micros: "usda_foundation",
        usda_fdc_id: fdcId,
        usda_description: name,
      },
      portions: (f.foodPortions || []).slice(0, 8).map((p) => ({
        amount: p.amount ?? p.value ?? null,
        unit: p.measureUnit?.abbreviation || p.measureUnit?.name || "",
        gram_weight: p.gramWeight ?? null,
        modifier: p.modifier || "",
      })),
    };
  });

  foods.sort((a, b) => a.name.localeCompare(b.name));

  const payload = {
    version: 3,
    source: "USDA FoodData Central — Foundation Foods",
    license: "Public domain / CC0 1.0 (USDA)",
    generated_at: new Date().toISOString(),
    count: foods.length,
    source_file: path.basename(srcPath),
    foods,
  };

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(payload));
  const complete = foods.filter((f) => f.macros_complete).length;
  console.log(`Wrote ${foods.length} foods → ${outFile}`);
  console.log(`Macros complete: ${complete}/${foods.length}`);
}

main();
