/**
 * Overlay USDA SR Legacy nutrients onto FooDB catalog for missing macros/micros.
 *
 * Inputs:
 *   apps/web/public/data/catalog.json  (FooDB-built)
 *   data/usda/ FoodData_Central_sr_legacy JSON dump
 *
 * Output: rewrites catalog.json with filled gaps + nutrient_sources flags.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const catalogPath = path.join(root, "apps", "web", "public", "data", "catalog.json");
const usdaRoot = path.join(root, "data", "usda");

/**
 * USDA nutrient *number* codes (string "203" etc. in SR Legacy JSON).
 * See https://fdc.nal.usda.gov nutrient number legend.
 */
const USDA_MACRO = {
  208: "energy_kcal", // Energy (kcal)
  203: "protein_g",
  204: "fat_g",
  205: "carbs_g",
  291: "fiber_g",
};

/** USDA nutrient number → micro display name */
const USDA_MICRO = {
  301: { name: "Calcium", unit: "mg/100g" },
  303: { name: "Iron", unit: "mg/100g" },
  304: { name: "Magnesium", unit: "mg/100g" },
  305: { name: "Phosphorus", unit: "mg/100g" },
  306: { name: "Potassium", unit: "mg/100g" },
  307: { name: "Sodium", unit: "mg/100g" },
  309: { name: "Zinc", unit: "mg/100g" },
  312: { name: "Copper", unit: "mg/100g" },
  315: { name: "Manganese", unit: "mg/100g" },
  317: { name: "Selenium", unit: "µg/100g" },
  401: { name: "Vitamin C", unit: "mg/100g" },
  320: { name: "Vitamin A (RAE)", unit: "µg/100g" },
  328: { name: "Vitamin D", unit: "µg/100g" },
  323: { name: "Vitamin E (alpha-tocopherol)", unit: "mg/100g" },
  430: { name: "Vitamin K", unit: "µg/100g" },
  404: { name: "Thiamine (B1)", unit: "mg/100g" },
  405: { name: "Riboflavin (B2)", unit: "mg/100g" },
  406: { name: "Niacin (B3)", unit: "mg/100g" },
  410: { name: "Pantothenic acid (B5)", unit: "mg/100g" },
  415: { name: "Vitamin B6", unit: "mg/100g" },
  417: { name: "Folate", unit: "µg/100g" },
  418: { name: "Vitamin B12 (cobalamin)", unit: "µg/100g" },
  421: { name: "Choline", unit: "mg/100g" },
};

function findUsdaJson(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...findUsdaJson(p));
    else if (/sr_legacy.*\.json$/i.test(ent.name) || /FoodData_Central_sr_legacy/i.test(ent.name)) {
      out.push(p);
    }
  }
  return out;
}

function normalizeName(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** tokens without stopwords */
function tokens(s) {
  const stop = new Set(["and", "or", "with", "the", "a", "an", "of", "in", "raw", "fresh", "nfs"]);
  return normalizeName(s)
    .split(" ")
    .filter((t) => t.length > 1 && !stop.has(t));
}

function jaccard(a, b) {
  const A = new Set(a);
  const B = new Set(b);
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  const union = A.size + B.size - inter;
  return union ? inter / union : 0;
}

function extractNutrients(food) {
  const macros = {};
  const micros = [];
  const list = food.foodNutrients || [];
  for (const fn of list) {
    // Prefer classic nutrient *number* (203=protein); fall back to FDC nutrient id
    const num = Number(
      fn.nutrient?.number ?? fn.nutrientNumber ?? fn.nutrient?.id ?? fn.nutrient_id ?? fn.nutrientId,
    );
    const amount = fn.amount ?? fn.value;
    if (amount == null || !Number.isFinite(Number(amount))) continue;
    const val = Number(amount);

    if (USDA_MACRO[num]) {
      macros[USDA_MACRO[num]] = val;
    }
    if (USDA_MICRO[num]) {
      const meta = USDA_MICRO[num];
      micros.push({ name: meta.name, amount: Math.round(val * 1000) / 1000, unit: meta.unit, source: "usda" });
    }
  }
  return { macros, micros, fdcId: food.fdcId || food.id, description: food.description };
}

function loadUsdaIndex(jsonPath) {
  console.log("Loading USDA", jsonPath);
  const raw = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  // File is either {SRLegacyFoods: [...]} or array
  const foods = raw.SRLegacyFoods || raw.FoundationFoods || raw.foods || (Array.isArray(raw) ? raw : null);
  if (!foods) {
    console.error("Unknown USDA JSON shape keys:", Object.keys(raw).slice(0, 20));
    process.exit(1);
  }
  console.log("USDA foods:", foods.length);

  /** @type {Map<string, any[]>} exact name → candidates */
  const byName = new Map();
  const records = [];

  for (const food of foods) {
    const desc = food.description || food.foodDescription || "";
    const n = normalizeName(desc);
    if (!n) continue;
    const rec = {
      name: desc,
      norm: n,
      tokens: tokens(desc),
      ...extractNutrients(food),
    };
    records.push(rec);
    if (!byName.has(n)) byName.set(n, []);
    byName.get(n).push(rec);
  }
  return { byName, records };
}

/**
 * FooDB common names → preferred USDA description substrings (first match wins).
 * Used when FooDB naming differs from SR Legacy.
 */
const ALIASES = {
  "apple cider": [
    "apple juice, canned or bottled, unsweetened, without added ascorbic acid",
    "apple juice, canned or bottled, unsweetened, with added ascorbic acid",
  ],
  "green apple": ["apples, raw, granny smith, with skin", "apples, raw, with skin"],
  "apple": ["apples, raw, with skin"],
  "egg": ["egg, whole, raw, fresh"],
  "butter": ["butter, without salt", "butter, salted"],
  "milk": ["milk, whole, 3.25% milkfat, with added vitamin d"],
  "cheddar cheese": ["cheese, cheddar"],
  "mozzarella cheese": ["cheese, mozzarella, whole milk"],
  "olive oil": ["oil, olive, salad or cooking"],
  "coconut oil": ["oil, coconut"],
  "soy sauce": ["soy sauce made from soy and wheat (shoyu)"],
  "tomato": ["tomatoes, red, ripe, raw, year round average"],
  "potato": ["potatoes, flesh and skin, raw"],
  "white rice": ["rice, white, long-grain, regular, raw, unenriched"],
  "brown rice": ["rice, brown, long-grain, raw"],
  "wheat flour": ["wheat flour, white, all-purpose, unenriched"],
  "honey": ["honey"],
  "garlic": ["garlic, raw"],
  "onion": ["onions, raw"],
  "carrot": ["carrots, raw"],
  "broccoli": ["broccoli, raw"],
  "spinach": ["spinach, raw"],
  "banana": ["bananas, raw"],
  "orange": ["oranges, raw, all commercial varieties"],
  "strawberry": ["strawberries, raw"],
  "blueberry": ["blueberries, raw"],
  "almond": ["nuts, almonds"],
  "walnut": ["nuts, walnuts, english"],
  "peanut": ["peanuts, all types, raw"],
  "chicken": ["chicken, broilers or fryers, meat only, raw"],
  "beef": ["beef, ground, 85% lean meat / 15% fat, raw"],
  "pork": ["pork, fresh, ground, raw"],
  "salmon": ["fish, salmon, atlantic, farmed, raw"],
  "tuna": ["fish, tuna, fresh, bluefin, raw"],
  "shrimp": ["crustaceans, shrimp, mixed species, raw"],
};

function pickByAlias(queryName, index) {
  const key = normalizeName(queryName);
  const list = ALIASES[key];
  if (!list) return null;
  for (const target of list) {
    const tn = normalizeName(target);
    if (index.byName.has(tn)) return index.byName.get(tn)[0];
    // prefix match on USDA descriptions
    for (const rec of index.records) {
      if (rec.norm === tn || rec.norm.startsWith(tn)) return rec;
    }
  }
  return null;
}

function pickBest(queryName, index) {
  const aliasHit = pickByAlias(queryName, index);
  if (aliasHit) return aliasHit;

  const n = normalizeName(queryName);
  if (!n) return null;

  // exact
  if (index.byName.has(n)) {
    return pickPreferredVariant(index.byName.get(n));
  }

  // USDA often uses "Apples, raw..." for "Apple"
  const plural = n.endsWith("s") ? n : n + "s";
  for (const candidate of [n, plural, `${plural} raw`, `${n} raw`]) {
    for (const rec of index.records) {
      if (rec.norm === candidate || rec.norm.startsWith(candidate + " ") || rec.norm.startsWith(candidate + ",")) {
        // strong start match
        if (rec.norm.startsWith(plural + ",") || rec.norm.startsWith(n + ",") || rec.norm.startsWith(plural + " ") || rec.norm.startsWith(n + " ")) {
          return rec;
        }
      }
    }
  }

  // exact after stripping common prefixes like "beverages"
  const stripped = n.replace(/^(beverages|babyfood|spices|oils|nuts|fruits|vegetables)\s+/, "");
  if (stripped !== n && index.byName.has(stripped)) {
    return pickPreferredVariant(index.byName.get(stripped));
  }

  const qTok = tokens(queryName);
  if (!qTok.length) return null;

  let best = null;
  let bestScore = 0;
  for (const rec of index.records) {
    if (!rec.tokens.includes(qTok[0]) && !rec.norm.includes(qTok[0])) continue;

    // skip babyfood / industrial unless query asks
    if (/\bbabyfood\b/.test(rec.norm) && !/baby/.test(n)) continue;

    let score = jaccard(qTok, rec.tokens);
    if (rec.norm === n) score = 1;
    else if (rec.norm.startsWith(n + ",") || rec.norm.startsWith(n + " ")) score = Math.max(score, 0.92);
    else if (rec.norm.includes(n)) score = Math.max(score, 0.72);
    else if (n.includes(rec.norm) && rec.norm.length > 3) score = Math.max(score, 0.65);

    score -= Math.min(0.08, rec.norm.length / 400);
    if (/\braw\b/.test(rec.norm) && qTok.length <= 3) score += 0.06;
    if (/\bfrozen concentrate\b/.test(rec.norm)) score -= 0.08;
    if (/\bcanned\b/.test(rec.norm) && !/canned|juice|cider|sauce/.test(n)) score -= 0.03;

    if (score > bestScore) {
      bestScore = score;
      best = rec;
    }
  }

  if (bestScore < 0.58) return null;
  return best;
}

function pickPreferredVariant(list) {
  if (!list?.length) return null;
  // Prefer raw, plain, shorter descriptions
  return [...list].sort((a, b) => {
    const score = (r) => {
      let s = 0;
      if (/\braw\b/.test(r.norm)) s += 3;
      if (r.norm.length < 40) s += 1;
      if (/\bbabyfood\b/.test(r.norm)) s -= 5;
      return s;
    };
    return score(b) - score(a);
  })[0];
}

function mergeMicro(existing, incoming) {
  const byName = new Map((existing || []).map((m) => [m.name.toLowerCase(), m]));
  for (const m of incoming || []) {
    const key = m.name.toLowerCase();
    if (!byName.has(key)) {
      byName.set(key, m);
    }
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function main() {
  if (!fs.existsSync(catalogPath)) {
    console.error("Missing catalog:", catalogPath);
    process.exit(1);
  }
  const usdaFiles = findUsdaJson(usdaRoot);
  if (!usdaFiles.length) {
    console.error("No USDA SR Legacy JSON under", usdaRoot);
    process.exit(1);
  }

  const index = loadUsdaIndex(usdaFiles[0]);
  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));

  let matched = 0;
  let filledMacro = 0;
  let filledMicro = 0;
  let unmatched = [];

  for (const food of catalog.foods) {
    const usda = pickBest(food.name, index);
    if (!usda) {
      unmatched.push(food.name);
      food.nutrient_sources = food.nutrient_sources || { macros: "foodb", micros: "foodb" };
      continue;
    }
    matched++;

    const sources = {
      macros: "foodb",
      micros: "foodb",
      usda_fdc_id: usda.fdcId,
      usda_description: usda.description,
    };

    // Fill missing macros only
    let macroFilled = false;
    for (const key of ["energy_kcal", "protein_g", "fat_g", "carbs_g", "fiber_g"]) {
      if (food.macros[key] == null && usda.macros[key] != null) {
        food.macros[key] = Math.round(usda.macros[key] * 100) / 100;
        macroFilled = true;
      }
    }
    if (macroFilled) {
      filledMacro++;
      sources.macros = food.macros_complete ? "foodb+usda" : "usda";
    }
    // if all macros were null and now filled enough
    food.macros_complete =
      food.macros.energy_kcal != null &&
      food.macros.protein_g != null &&
      food.macros.fat_g != null &&
      food.macros.carbs_g != null;

    if (macroFilled && sources.macros === "foodb") sources.macros = "usda";
    if (
      food.macros.energy_kcal != null &&
      [food.macros.protein_g, food.macros.fat_g, food.macros.carbs_g].some((v) => v != null)
    ) {
      // detect pure foodb vs mixed
      const hadAnyFoodb = food.nutrient_sources?.macros === "foodb";
      // leave sources as set above
    }

    const beforeMicro = (food.micros || []).length;
    food.micros = mergeMicro(food.micros, usda.micros);
    if (food.micros.length > beforeMicro) {
      filledMicro++;
      sources.micros = beforeMicro ? "foodb+usda" : "usda";
    }

    food.nutrient_sources = sources;
  }

  catalog.version = (catalog.version || 1) + 0.1;
  catalog.usda_overlay = {
    source: "USDA FoodData Central SR Legacy (2018-04)",
    license: "Public domain (US government work)",
    matched,
    filled_macros: filledMacro,
    filled_micros: filledMicro,
    unmatched_count: unmatched.length,
    generated_at: new Date().toISOString(),
  };
  catalog.generated_at = new Date().toISOString();

  fs.writeFileSync(catalogPath, JSON.stringify(catalog));
  console.log("Wrote", catalogPath);
  console.log({
    matched,
    filledMacro,
    filledMicro,
    unmatched: unmatched.length,
    sampleUnmatched: unmatched.slice(0, 15),
  });

  // show apple cider
  const cider = catalog.foods.find((f) => /apple cider/i.test(f.name));
  if (cider) {
    console.log("Apple cider after merge:", {
      macros: cider.macros,
      macros_complete: cider.macros_complete,
      sources: cider.nutrient_sources,
      micros: cider.micros?.length,
    });
  }
}

main();
