/**
 * Build browser catalog from FooDB dumps: foods + macros + micros (compounds) + other nutrients.
 */
import fs from "fs";
import path from "path";
import readline from "readline";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const rawDir = path.join(root, "data", "foodb_raw", "foodb_2020_04_07_json");
const outDir = path.join(root, "apps", "web", "public", "data");
const outFile = path.join(outDir, "catalog.json");

/** Macro nutrient IDs in FooDB Nutrient.json */
const MACRO_MAP = {
  1: "fat_g",
  2: "protein_g",
  3: "carbs_g",
  5: "fiber_g",
  38: "energy_kcal",
};

/** Curated micro compounds (FooDB Compound.id → display name) */
const MICRO_COMPOUNDS = new Map([
  [1223, "Vitamin C (ascorbic acid)"],
  [1224, "Vitamin C (L-ascorbic acid)"],
  [565, "Vitamin E (alpha-tocopherol)"],
  [574, "Vitamin B6 (pyridoxine)"],
  [710, "Choline"],
  [1310, "Vitamin K2"],
  [3514, "Calcium"],
  [3521, "Phosphorus"],
  [3522, "Potassium"],
  [3524, "Sodium"],
  [3583, "Copper"],
  [3636, "Iodine"],
  [3637, "Manganese"],
  [3730, "Zinc"],
  [8323, "Pantothenic acid (B5)"],
  [8425, "Thiamine (B1)"],
  [13403, "Selenium"],
  [13831, "Retinol (Vitamin A)"],
  [14507, "Folic acid"],
  [14513, "Biotin"],
  [14616, "beta-Carotene"],
  [16258, "Iron"],
  [21596, "Vitamin D"],
  [23049, "Vitamin B12 (cobalamin)"],
]);

function readNdjson(filePath) {
  const text = fs.readFileSync(filePath, "utf8").trim();
  if (!text) return [];
  return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

function toNumber(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizeAmount(kind, value, unit) {
  if (value == null) return null;
  const u = (unit || "").toLowerCase().replace(/\s+/g, "");
  if (kind === "energy") {
    if (u.includes("kj")) return value / 4.184;
    return value;
  }
  // Prefer mg for micros display; convert g → mg, ug → mg
  if (kind === "micro") {
    if (u.includes("ug") || u.includes("µg") || u.includes("mcg")) return value / 1000;
    if (u.startsWith("g") || u.includes("g/")) return value * 1000;
    return value; // assume mg
  }
  // macros: grams
  if (u.includes("mg")) return value / 1000;
  if (u.includes("ug") || u.includes("µg") || u.includes("mcg")) return value / 1_000_000;
  return value;
}

function median(arr) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function emojiForGroup(group) {
  const g = (group || "").toLowerCase();
  if (g.includes("vegetable")) return "🥬";
  if (g.includes("fruit") || g.includes("gourd")) return "🍎";
  if (g.includes("animal") || g.includes("meat")) return "🥩";
  if (g.includes("aquatic") || g.includes("fish")) return "🐟";
  if (g.includes("egg")) return "🥚";
  if (g.includes("milk") || g.includes("dairy")) return "🥛";
  if (g.includes("cereal") || g.includes("baking") || g.includes("pulse") || g.includes("soy")) return "🌾";
  if (g.includes("nut")) return "🥜";
  if (g.includes("herb") || g.includes("spice")) return "🌿";
  if (g.includes("fat") || g.includes("oil")) return "🫒";
  if (g.includes("beverage") || g.includes("tea") || g.includes("coffee") || g.includes("cocoa")) return "☕";
  if (g.includes("confection") || g.includes("snack") || g.includes("baby")) return "🍪";
  if (g.includes("dish")) return "🍽️";
  return "🥗";
}

async function main() {
  if (!fs.existsSync(path.join(rawDir, "Food.json"))) {
    console.error("FooDB Food.json not found at", rawDir);
    process.exit(1);
  }

  console.log("Reading foods & nutrients…");
  const foods = readNdjson(path.join(rawDir, "Food.json"));
  const nutrients = readNdjson(path.join(rawDir, "Nutrient.json"));
  const nutNameById = Object.fromEntries(nutrients.map((n) => [n.id, n.name]));

  /** foodId → { macros: {key: number[]}, micros: {name: {values, unit}}, other: {name: {values, unit}} } */
  const acc = new Map();

  function bag(foodId) {
    if (!acc.has(foodId)) {
      acc.set(foodId, { macros: {}, micros: {}, other: {} });
    }
    return acc.get(foodId);
  }

  console.log("Streaming Content.json (macros + micros + other nutrients)…");
  const rl = readline.createInterface({
    input: fs.createReadStream(path.join(rawDir, "Content.json"), { encoding: "utf8" }),
    crlfDelay: Infinity,
  });

  let lines = 0;
  let kept = 0;
  for await (const line of rl) {
    lines++;
    if (!line.trim()) continue;
    let row;
    try {
      row = JSON.parse(line);
    } catch {
      continue;
    }
    const foodId = row.food_id;
    if (foodId == null) continue;
    const raw = toNumber(row.orig_content);
    if (raw == null || raw < 0) continue;

    if (row.source_type === "Nutrient") {
      const b = bag(foodId);
      if (MACRO_MAP[row.source_id]) {
        const key = MACRO_MAP[row.source_id];
        const amount = normalizeAmount(key === "energy_kcal" ? "energy" : "macro", raw, row.orig_unit);
        if (amount == null) continue;
        if (!b.macros[key]) b.macros[key] = [];
        b.macros[key].push(amount);
        kept++;
      } else {
        const name = nutNameById[row.source_id];
        if (!name) continue;
        const amount = normalizeAmount("macro", raw, row.orig_unit);
        if (amount == null) continue;
        if (!b.other[name]) b.other[name] = { values: [], unit: row.orig_unit || "g/100g" };
        b.other[name].values.push(amount);
        kept++;
      }
    } else if (row.source_type === "Compound" && MICRO_COMPOUNDS.has(row.source_id)) {
      const name = MICRO_COMPOUNDS.get(row.source_id);
      const amount = normalizeAmount("micro", raw, row.orig_unit);
      if (amount == null) continue;
      const b = bag(foodId);
      if (!b.micros[name]) b.micros[name] = { values: [], unit: "mg/100g" };
      b.micros[name].values.push(amount);
      kept++;
    }

    if (lines % 2_000_000 === 0) {
      console.log(`  … ${lines.toLocaleString()} lines, ${kept.toLocaleString()} kept`);
    }
  }
  console.log(`Content done: ${lines.toLocaleString()} lines, ${kept.toLocaleString()} kept`);

  // Merge Vitamin C aliases
  function mergeMicros(micros) {
    const out = { ...micros };
    const a = out["Vitamin C (ascorbic acid)"];
    const b = out["Vitamin C (L-ascorbic acid)"];
    if (a || b) {
      const values = [...(a?.values || []), ...(b?.values || [])];
      out["Vitamin C"] = { values, unit: "mg/100g" };
      delete out["Vitamin C (ascorbic acid)"];
      delete out["Vitamin C (L-ascorbic acid)"];
    }
    return out;
  }

  const catalog = foods
    .filter((f) => f.name)
    .map((f) => {
      const b = acc.get(f.id) || { macros: {}, micros: {}, other: {} };
      const macros = {
        energy_kcal: median(b.macros.energy_kcal || []),
        protein_g: median(b.macros.protein_g || []),
        fat_g: median(b.macros.fat_g || []),
        carbs_g: median(b.macros.carbs_g || []),
        fiber_g: median(b.macros.fiber_g || []),
      };
      for (const k of Object.keys(macros)) {
        if (macros[k] != null) {
          macros[k] = k === "energy_kcal" ? Math.round(macros[k] * 10) / 10 : Math.round(macros[k] * 100) / 100;
        }
      }

      const microsMerged = mergeMicros(b.micros);
      const micros = Object.entries(microsMerged)
        .map(([name, { values, unit }]) => {
          const v = median(values);
          if (v == null) return null;
          return {
            name,
            amount: Math.round(v * 1000) / 1000,
            unit: unit || "mg/100g",
          };
        })
        .filter(Boolean)
        .sort((a, b) => a.name.localeCompare(b.name));

      const other_nutrients = Object.entries(b.other)
        .map(([name, { values, unit }]) => {
          const v = median(values);
          if (v == null) return null;
          return {
            name,
            amount: Math.round(v * 1000) / 1000,
            unit: unit || "g/100g",
          };
        })
        .filter(Boolean)
        .sort((a, b) => a.name.localeCompare(b.name));

      // Live FooDB serves /full/{id}.png — dump picture_file_name is often stale (.jpg).
      const picture = f.picture_file_name || f.id
        ? `https://foodb.ca/system/foods/pictures/${f.id}/full/${f.id}.png`
        : null;
      const picture_candidates = [
        `https://foodb.ca/system/foods/pictures/${f.id}/full/${f.id}.png`,
        `https://foodb.ca/system/foods/pictures/${f.id}/full/${f.id}.jpg`,
        f.picture_file_name
          ? `https://foodb.ca/system/foods/pictures/${f.id}/full/${f.picture_file_name}`
          : null,
      ].filter(Boolean);

      return {
        id: String(f.public_id || `FOOD${String(f.id).padStart(5, "0")}`),
        foodb_id: f.id,
        name: f.name,
        name_scientific: f.name_scientific || null,
        description: f.description || "",
        food_group: f.food_group || "Unclassified",
        food_subgroup: f.food_subgroup || "",
        picture,
        picture_candidates,
        emoji: emojiForGroup(f.food_group),
        source: "foodb",
        macros,
        macros_complete:
          macros.energy_kcal != null &&
          macros.protein_g != null &&
          macros.fat_g != null &&
          macros.carbs_g != null,
        micros,
        other_nutrients,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  fs.mkdirSync(outDir, { recursive: true });
  const payload = {
    version: 2,
    source: "FooDB 2020-04-07",
    license: "CC BY-NC 4.0 — non-commercial use with attribution; commercial use needs permission",
    generated_at: new Date().toISOString(),
    count: catalog.length,
    foods: catalog,
  };
  fs.writeFileSync(outFile, JSON.stringify(payload));
  console.log(`Wrote ${catalog.length} foods → ${outFile}`);
  console.log(`Size: ${(fs.statSync(outFile).size / 1024 / 1024).toFixed(2)} MB`);
  console.log(`With complete macros: ${catalog.filter((f) => f.macros_complete).length}`);
  console.log(`With ≥1 micro: ${catalog.filter((f) => f.micros.length > 0).length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
