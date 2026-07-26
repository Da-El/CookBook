/**
 * Multi-pass enrichment of FooDB catalog with USDA SR Legacy + Foundation.
 * Passes: exact → alias → plural/raw heuristics → fuzzy → API (optional).
 * Writes missing-data report for anything still incomplete.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const catalogPath = path.join(root, "apps", "web", "public", "data", "catalog.json");
const usdaRoot = path.join(root, "data", "usda");
const reportPath = path.join(root, "data", "missing-data-report.json");
const reportMdPath = path.join(root, "data", "MISSING_DATA.md");

const USDA_MACRO = {
  208: "energy_kcal",
  203: "protein_g",
  204: "fat_g",
  205: "carbs_g",
  291: "fiber_g",
};

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

/** Hand-tuned FooDB → USDA description starts-with / equals */
const ALIASES = {
  "apple cider": ["apple juice, canned or bottled, unsweetened, without added ascorbic acid"],
  "green apple": ["apples, raw, granny smith, with skin", "apples, raw, with skin"],
  apple: ["apples, raw, with skin"],
  egg: ["egg, whole, raw, fresh"],
  butter: ["butter, without salt"],
  milk: ["milk, whole, 3.25% milkfat, with added vitamin d"],
  "olive oil": ["oil, olive, salad or cooking"],
  "coconut oil": ["oil, coconut"],
  garlic: ["garlic, raw"],
  onion: ["onions, raw"],
  carrot: ["carrots, raw"],
  broccoli: ["broccoli, raw"],
  spinach: ["spinach, raw"],
  banana: ["bananas, raw"],
  orange: ["oranges, raw, all commercial varieties"],
  strawberry: ["strawberries, raw"],
  blueberry: ["blueberries, raw"],
  potato: ["potatoes, flesh and skin, raw"],
  tomato: ["tomatoes, red, ripe, raw, year round average"],
  honey: ["honey"],
  almond: ["nuts, almonds"],
  walnut: ["nuts, walnuts, english"],
  peanut: ["peanuts, all types, raw"],
  chicken: ["chicken, broilers or fryers, meat only, raw"],
  beef: ["beef, ground, 85% lean meat / 15% fat, raw"],
  pork: ["pork, fresh, ground, raw"],
  salmon: ["fish, salmon, atlantic, farmed, raw"],
  tuna: ["fish, tuna, fresh, bluefin, raw"],
  shrimp: ["crustaceans, shrimp, mixed species, raw"],
  rice: ["rice, white, long-grain, regular, raw, unenriched"],
  "white rice": ["rice, white, long-grain, regular, raw, unenriched"],
  "brown rice": ["rice, brown, long-grain, raw"],
  wheat: ["wheat, hard red winter"],
  flour: ["wheat flour, white, all-purpose, unenriched"],
  cheese: ["cheese, cheddar"],
  yogurt: ["yogurt, plain, whole milk"],
  cream: ["cream, fluid, heavy whipping"],
  sugar: ["sugars, granulated"],
  salt: ["salt, table"],
  water: ["water, bottled, generic"],
  coffee: ["coffee, brewed from grounds, prepared with tap water"],
  tea: ["tea, black, brewed, prepared with tap water"],
  wine: ["alcohol, wine, table, red"],
  beer: ["alcohol, beer, regular, all"],
  vinegar: ["vinegar, cider"],
  soy: ["soybeans, mature seeds, raw"],
  tofu: ["tofu, raw, firm, prepared with calcium sulfate"],
  mushroom: ["mushrooms, white, raw"],
  corn: ["corn, sweet, yellow, raw"],
  cabbage: ["cabbage, raw"],
  lettuce: ["lettuce, cos or romaine, raw"],
  cucumber: ["cucumbers, with peel, raw"],
  pepper: ["peppers, sweet, green, raw"],
  "bell pepper": ["peppers, sweet, green, raw"],
  lemon: ["lemons, raw, without peel"],
  lime: ["limes, raw"],
  grape: ["grapes, red or green (european type, such as thompson seedless), raw"],
  peach: ["peaches, yellow, raw"],
  pear: ["pears, raw"],
  plum: ["plums, raw"],
  cherry: ["cherries, sweet, raw"],
  avocado: ["avocados, raw, all commercial varieties"],
  coconut: ["nuts, coconut meat, raw"],
  mango: ["mangos, raw"],
  pineapple: ["pineapple, raw, all varieties"],
  watermelon: ["watermelon, raw"],
  melon: ["melons, cantaloupe, raw"],
  pumpkin: ["pumpkin, raw"],
  squash: ["squash, winter, butternut, raw"],
  zucchini: ["squash, summer, zucchini, includes skin, raw"],
  celery: ["celery, raw"],
  parsley: ["parsley, fresh"],
  basil: ["basil, fresh"],
  oregano: ["spices, oregano, dried"],
  cinnamon: ["spices, cinnamon, ground"],
  ginger: ["spices, ginger, ground"],
  turmeric: ["spices, turmeric, ground"],
  paprika: ["spices, paprika"],
  cumin: ["spices, cumin seed"],
  "black pepper": ["spices, pepper, black"],
  mustard: ["mustard, prepared, yellow"],
  mayonnaise: ["salad dressing, mayonnaise, regular"],
  ketchup: ["catsup"],
  bread: ["bread, white, commercially prepared (includes soft bread crumbs)"],
  pasta: ["pasta, dry, unenriched"],
  oatmeal: ["cereals, oats, regular and quick, not fortified, dry"],
  chocolate: ["candies, semisweet chocolate"],
  cocoa: ["cocoa, dry powder, unsweetened"],
  "sour cream": ["cream, sour, cultured"],
  "cream cheese": ["cheese, cream"],
  "cottage cheese": ["cheese, cottage, creamed, large or small curd"],
  "swiss cheese": ["cheese, swiss"],
  "parmesan cheese": ["cheese, parmesan, grated"],
  lamb: ["lamb, ground, raw"],
  turkey: ["turkey, whole, meat only, raw"],
  duck: ["duck, domesticated, meat only, raw"],
  bacon: ["pork, cured, bacon, unprepared"],
  ham: ["pork, cured, ham, boneless, extra lean and regular, unheated"],
  sausage: ["sausage, italian, pork, raw"],
  "olive": ["olives, ripe, canned (small-extra large)"],
  date: ["dates, medjool"],
  fig: ["figs, raw"],
  raisin: ["raisins, seedless"],
  "sweet potato": ["sweet potato, raw, unprepared"],
  yam: ["yam, raw"],
  cassava: ["cassava, raw"],
  quinoa: ["quinoa, uncooked"],
  barley: ["barley, hulled"],
  rye: ["rye grain"],
  oat: ["oats"],
  millet: ["millet, raw"],
  buckwheat: ["buckwheat"],
  lentil: ["lentils, raw"],
  chickpea: ["chickpeas (garbanzo beans, bengal gram), mature seeds, raw"],
  "black bean": ["beans, black, mature seeds, raw"],
  "kidney bean": ["beans, kidney, all types, mature seeds, raw"],
  "green bean": ["beans, snap, green, raw"],
  pea: ["peas, green, raw"],
  "soy sauce": ["soy sauce made from soy and wheat (shoyu)"],
  miso: ["miso"],
  seaweed: ["seaweed, kelp, raw"],
  "sesame seed": ["seeds, sesame seeds, whole, dried"],
  "sunflower seed": ["seeds, sunflower seed kernels, dried"],
  "pumpkin seed": ["seeds, pumpkin and squash seed kernels, dried"],
  cashew: ["nuts, cashew nuts, raw"],
  pistachio: ["nuts, pistachio nuts, raw"],
  hazelnut: ["nuts, hazelnuts or filberts"],
  pecan: ["nuts, pecans"],
  macadamia: ["nuts, macadamia nuts, raw"],
  brazil: ["nuts, brazilnuts, dried, unblanched"],
  chestnut: ["nuts, chestnuts, european, raw, unpeeled"],
  "grape juice": ["grape juice, canned or bottled, unsweetened, without added ascorbic acid"],
  "orange juice": ["orange juice, raw"],
  "cranberry juice": ["cranberry juice, unsweetened"],
  "tomato juice": ["tomato juice, canned, without salt added"],
  "clam": ["mollusks, clam, mixed species, raw"],
  oyster: ["mollusks, oyster, eastern, wild, raw"],
  crab: ["crustaceans, crab, blue, raw"],
  lobster: ["crustaceans, lobster, northern, raw"],
  cod: ["fish, cod, atlantic, raw"],
  trout: ["fish, trout, rainbow, farmed, raw"],
  sardine: ["fish, sardine, atlantic, canned in oil, drained solids with bone"],
  anchovy: ["fish, anchovy, european, canned in oil, drained solids"],
  herring: ["fish, herring, atlantic, raw"],
  mackerel: ["fish, mackerel, atlantic, raw"],
  eel: ["fish, eel, mixed species, raw"],
  octopus: ["mollusks, octopus, common, raw"],
  squid: ["mollusks, squid, mixed species, raw"],
  scallop: ["mollusks, scallop, mixed species, raw"],
  mussel: ["mollusks, mussel, blue, raw"],
};

function normalizeName(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(s) {
  const stop = new Set([
    "and", "or", "with", "the", "a", "an", "of", "in", "raw", "fresh", "nfs", "all",
    "types", "type", "from", "for", "to", "by", "on", "as", "includes", "include",
  ]);
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
  for (const fn of food.foodNutrients || []) {
    const num = Number(fn.nutrient?.number ?? fn.nutrientNumber ?? fn.nutrient?.id);
    const amount = fn.amount ?? fn.value;
    if (amount == null || !Number.isFinite(Number(amount))) continue;
    const val = Number(amount);
    if (USDA_MACRO[num]) macros[USDA_MACRO[num]] = val;
    if (USDA_MICRO[num]) {
      const meta = USDA_MICRO[num];
      micros.push({
        name: meta.name,
        amount: Math.round(val * 1000) / 1000,
        unit: meta.unit,
        source: "usda",
      });
    }
  }
  return {
    macros,
    micros,
    fdcId: food.fdcId || food.id,
    description: food.description,
    dataType: food.dataType || "USDA",
  };
}

function findUsdaFiles(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...findUsdaFiles(p));
    else if (/\.json$/i.test(ent.name) && /FoodData_Central|sr_legacy|foundation/i.test(ent.name)) {
      out.push(p);
    }
  }
  return out;
}

function loadUsdaIndex(files) {
  const byName = new Map();
  const records = [];
  const byFirstToken = new Map();

  for (const file of files) {
    console.log("Loading", path.basename(file));
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));
    const foods =
      raw.SRLegacyFoods || raw.FoundationFoods || raw.SurveyFoods || raw.foods || (Array.isArray(raw) ? raw : null);
    if (!foods) {
      console.warn("  skip unknown shape", Object.keys(raw).slice(0, 8));
      continue;
    }
    console.log("  foods:", foods.length);
    for (const food of foods) {
      const desc = food.description || "";
      const n = normalizeName(desc);
      if (!n) continue;
      const rec = {
        name: desc,
        norm: n,
        tokens: tokens(desc),
        ...extractNutrients(food),
      };
      // skip if no useful nutrients
      if (!Object.keys(rec.macros).length && !rec.micros.length) continue;
      records.push(rec);
      if (!byName.has(n)) byName.set(n, []);
      byName.get(n).push(rec);
      const ft = rec.tokens[0];
      if (ft) {
        if (!byFirstToken.has(ft)) byFirstToken.set(ft, []);
        byFirstToken.get(ft).push(rec);
      }
    }
  }
  console.log("Index size:", records.length);
  return { byName, records, byFirstToken };
}

function prefer(list) {
  if (!list?.length) return null;
  return [...list].sort((a, b) => {
    const score = (r) => {
      let s = 0;
      if (/\braw\b/.test(r.norm)) s += 4;
      if (r.macros.energy_kcal != null) s += 2;
      if (r.macros.protein_g != null) s += 1;
      if (/\bbabyfood\b|\binfant\b/.test(r.norm)) s -= 6;
      if (/\bfortified\b|\benriched\b/.test(r.norm)) s -= 1;
      if (r.norm.length < 50) s += 1;
      return s;
    };
    return score(b) - score(a);
  })[0];
}

function findByDescriptionStart(index, target) {
  const tn = normalizeName(target);
  if (index.byName.has(tn)) return prefer(index.byName.get(tn));
  let best = null;
  for (const rec of index.records) {
    if (rec.norm === tn || rec.norm.startsWith(tn + ",") || rec.norm.startsWith(tn + " ")) {
      if (!best || rec.norm.length < best.norm.length) best = rec;
    }
  }
  return best;
}

function pickAlias(queryName, index) {
  const key = normalizeName(queryName);
  if (ALIASES[key]) {
    for (const t of ALIASES[key]) {
      const hit = findByDescriptionStart(index, t);
      if (hit) return { rec: hit, pass: "alias" };
    }
  }
  // try last word alias (e.g. "Savoy cabbage" → cabbage)
  const parts = key.split(" ");
  if (parts.length > 1) {
    const last = parts[parts.length - 1];
    if (ALIASES[last]) {
      for (const t of ALIASES[last]) {
        const hit = findByDescriptionStart(index, t);
        if (hit) return { rec: hit, pass: "alias-last-token" };
      }
    }
  }
  return null;
}

function pickExact(queryName, index) {
  const n = normalizeName(queryName);
  if (index.byName.has(n)) return { rec: prefer(index.byName.get(n)), pass: "exact" };
  return null;
}

function pickHeuristic(queryName, index) {
  const n = normalizeName(queryName);
  const variants = [
    n,
    n.endsWith("s") ? n : n + "s",
    n.replace(/ies$/, "y"),
    n.replace(/oes$/, "o"),
  ];
  // "X, raw" patterns
  for (const v of variants) {
    for (const suffix of ["", ", raw", " raw", ", raw, with skin", ", raw, all commercial varieties"]) {
      const hit = findByDescriptionStart(index, v + suffix);
      if (hit) return { rec: hit, pass: "heuristic" };
    }
  }
  // reverse: USDA starts with plural form
  const plural = n.endsWith("s") ? n : n + "s";
  for (const rec of index.byFirstToken.get(tokens(queryName)[0]) || []) {
    if (rec.norm.startsWith(plural + ",") || rec.norm.startsWith(n + ",")) {
      return { rec: prefer([rec]), pass: "heuristic-prefix" };
    }
  }
  return null;
}

function pickFuzzy(queryName, index) {
  const n = normalizeName(queryName);
  const qTok = tokens(queryName);
  if (!qTok.length) return null;

  const pool = index.byFirstToken.get(qTok[0]) || index.records;
  let best = null;
  let bestScore = 0;

  for (const rec of pool) {
    if (/\bbabyfood\b|\binfant formula\b/.test(rec.norm) && !/baby|infant/.test(n)) continue;

    let score = jaccard(qTok, rec.tokens);
    if (rec.norm.includes(n)) score = Math.max(score, 0.78);
    if (n.split(" ").every((w) => w.length < 2 || rec.norm.includes(w))) score = Math.max(score, 0.7);
    // all query tokens present
    if (qTok.every((t) => rec.tokens.includes(t) || rec.norm.includes(t))) {
      score = Math.max(score, 0.8);
    }
    score -= Math.min(0.1, rec.norm.length / 350);
    if (/\braw\b/.test(rec.norm)) score += 0.05;

    if (score > bestScore) {
      bestScore = score;
      best = rec;
    }
  }
  if (bestScore >= 0.55) return { rec: best, pass: `fuzzy:${bestScore.toFixed(2)}` };
  return null;
}

function pickByScientific(scientific, index) {
  if (!scientific) return null;
  // "Malus domestica" → try matching common fruit names via first genus in USDA is rare;
  // use second token (species) is worse. Try full scientific string includes.
  const n = normalizeName(scientific);
  const parts = n.split(" ");
  if (parts.length < 1) return null;
  // Search records that mention the genus (first word) is too broad for Brassica etc.
  // Only try exact scientific if USDA ever includes it (rarely).
  for (const rec of index.records) {
    if (rec.norm.includes(n)) return { rec, pass: "scientific" };
  }
  return null;
}

async function pickApi(queryName) {
  const key = process.env.FDC_API_KEY || "DEMO_KEY";
  const q = encodeURIComponent(queryName);
  const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${key}&query=${q}&pageSize=5&dataType=Foundation,SR%20Legacy`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const foods = data.foods || [];
    if (!foods.length) return null;
    // prefer foundation/sr with nutrients
    for (const f of foods) {
      // search results include foodNutrients sometimes
      const rec = extractNutrients({
        ...f,
        description: f.description,
        foodNutrients: (f.foodNutrients || []).map((fn) => ({
          amount: fn.value ?? fn.amount,
          nutrient: { number: fn.nutrientNumber, id: fn.nutrientId, name: fn.nutrientName },
        })),
      });
      if (Object.keys(rec.macros).length || rec.micros.length) {
        return {
          rec: {
            name: f.description,
            norm: normalizeName(f.description),
            tokens: tokens(f.description),
            ...rec,
          },
          pass: "api",
        };
      }
    }
  } catch {
    return null;
  }
  return null;
}

function mergeMicro(existing, incoming) {
  const byName = new Map((existing || []).map((m) => [m.name.toLowerCase(), { ...m }]));
  for (const m of incoming || []) {
    const key = m.name.toLowerCase();
    if (!byName.has(key)) byName.set(key, m);
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function applyUsda(food, match) {
  if (!match?.rec) return { macroFilled: false, microFilled: false };
  const usda = match.rec;
  const sources = {
    macros: food.nutrient_sources?.macros || "foodb",
    micros: food.nutrient_sources?.micros || "foodb",
    usda_fdc_id: usda.fdcId,
    usda_description: usda.description,
    match_pass: match.pass,
  };

  let macroFilled = false;
  for (const key of ["energy_kcal", "protein_g", "fat_g", "carbs_g", "fiber_g"]) {
    if (food.macros[key] == null && usda.macros[key] != null) {
      food.macros[key] = Math.round(usda.macros[key] * 100) / 100;
      macroFilled = true;
    }
  }
  if (macroFilled) {
    const anyFoodb =
      food.macros_complete ||
      Object.values(food.macros).some((v) => v != null && sources.macros === "foodb");
    // simpler: if we filled any, tag
    sources.macros = food.macros.energy_kcal != null && !macroFilled ? "foodb" : macroFilled ? "foodb+usda" : "foodb";
    // detect pure usda if all five were null before - approximate:
    sources.macros = "usda"; // filled from usda only for nulls - mixed is fine
    // check if foodb had any macro before fill - use flag
  }

  // Better source labeling
  const hadMacroBefore = food._hadAnyMacro;
  if (macroFilled) sources.macros = hadMacroBefore ? "foodb+usda" : "usda";
  else if (hadMacroBefore) sources.macros = "foodb";

  food.macros_complete =
    food.macros.energy_kcal != null &&
    food.macros.protein_g != null &&
    food.macros.fat_g != null &&
    food.macros.carbs_g != null;

  const before = (food.micros || []).length;
  food.micros = mergeMicro(food.micros, usda.micros);
  const microFilled = food.micros.length > before;
  if (microFilled) sources.micros = before ? "foodb+usda" : "usda";
  else if (before) sources.micros = "foodb";

  food.nutrient_sources = sources;
  return { macroFilled, microFilled };
}

function completeness(food) {
  const missing = [];
  if (!food.name) missing.push("name");
  if (!food.description || food.description.length < 10) missing.push("description");
  if (!food.food_group) missing.push("food_group");
  if (!food.food_subgroup) missing.push("food_subgroup");
  if (!food.picture) missing.push("picture_url");
  if (food.macros.energy_kcal == null) missing.push("macro:energy_kcal");
  if (food.macros.protein_g == null) missing.push("macro:protein_g");
  if (food.macros.fat_g == null) missing.push("macro:fat_g");
  if (food.macros.carbs_g == null) missing.push("macro:carbs_g");
  if (food.macros.fiber_g == null) missing.push("macro:fiber_g");
  if (!(food.micros || []).length) missing.push("micros");
  return missing;
}

async function main() {
  const useApi = process.env.USE_FDC_API !== "0";
  if (!fs.existsSync(catalogPath)) {
    console.error("Run build-catalog.mjs first");
    process.exit(1);
  }

  const files = findUsdaFiles(usdaRoot);
  if (!files.length) {
    console.error("No USDA files in", usdaRoot);
    process.exit(1);
  }

  const index = loadUsdaIndex(files);
  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));

  let stats = {
    exact: 0,
    alias: 0,
    heuristic: 0,
    fuzzy: 0,
    api: 0,
    none: 0,
    filledMacro: 0,
    filledMicro: 0,
  };

  // Pass 1-4 local
  for (const food of catalog.foods) {
    food.micros = food.micros || [];
    food.other_nutrients = food.other_nutrients || [];
    food._hadAnyMacro = Object.values(food.macros || {}).some((v) => v != null);

    // only match if missing macros or micros
    const needsMacro = !food.macros_complete || Object.values(food.macros).some((v) => v == null);
    const needsMicro = !(food.micros || []).length;
    if (!needsMacro && !needsMicro) {
      food.nutrient_sources = food.nutrient_sources || { macros: "foodb", micros: "foodb" };
      continue;
    }

    let match =
      pickExact(food.name, index) ||
      pickAlias(food.name, index) ||
      pickHeuristic(food.name, index) ||
      pickByScientific(food.name_scientific, index) ||
      pickFuzzy(food.name, index);

    if (match) {
      const pass = match.pass.startsWith("fuzzy")
        ? "fuzzy"
        : match.pass.startsWith("alias")
          ? "alias"
          : match.pass.startsWith("heuristic")
            ? "heuristic"
            : match.pass;
      stats[pass] = (stats[pass] || 0) + 1;
      const r = applyUsda(food, match);
      if (r.macroFilled) stats.filledMacro++;
      if (r.microFilled) stats.filledMicro++;
    } else {
      food._needApi = true;
    }
  }

  // Pass 5: API for remaining incomplete (rate-limited)
  const needApi = catalog.foods.filter(
    (f) =>
      f._needApi &&
      (Object.values(f.macros).some((v) => v == null) || !(f.micros || []).length),
  );

  console.log(`API candidates: ${needApi.length} (USE_FDC_API=${useApi})`);
  if (useApi) {
    let i = 0;
    for (const food of needApi) {
      i++;
      // DEMO_KEY: be gentle
      if (i > 1) await new Promise((r) => setTimeout(r, 350));
      const match = await pickApi(food.name);
      if (match) {
        stats.api++;
        const r = applyUsda(food, match);
        if (r.macroFilled) stats.filledMacro++;
        if (r.microFilled) stats.filledMicro++;
        food._needApi = false;
      }
      if (i % 25 === 0) console.log(`  API ${i}/${needApi.length}`);
    }
  }

  // Second local fuzzy pass with lower threshold for still-missing macros
  for (const food of catalog.foods) {
    if (food.macros_complete) continue;
    const qTok = tokens(food.name);
    if (qTok.length < 1) continue;
    // try scientific name if present
    if (food.name_scientific) {
      const sciFirst = tokens(food.name_scientific)[0];
      // skip genus-only usually
    }
    const match = pickFuzzy(food.name, index);
    if (match && Number(match.pass.split(":")[1] || 0) >= 0.55) {
      const r = applyUsda(food, match);
      if (r.macroFilled || r.microFilled) {
        stats.fuzzy++;
        if (r.macroFilled) stats.filledMacro++;
        if (r.microFilled) stats.filledMicro++;
      }
    }
  }

  // Pass: sensible zero defaults (not inventing calories/protein)
  // - Fiber is 0 for pure animal products / oils / pure fats
  // - Carbs often ~0 for pure meat/fish/oil when other macros exist
  for (const food of catalog.foods) {
    const g = (food.food_group || "").toLowerCase();
    const animalish =
      g.includes("animal") ||
      g.includes("aquatic") ||
      g.includes("egg") ||
      g.includes("milk") ||
      g.includes("dish");
    const fatOil = g.includes("fat") || g.includes("oil");
    const hasCore =
      food.macros.energy_kcal != null ||
      food.macros.protein_g != null ||
      food.macros.fat_g != null;

    if (hasCore && food.macros.fiber_g == null && (animalish || fatOil)) {
      food.macros.fiber_g = 0;
      food.nutrient_sources = {
        ...(food.nutrient_sources || {}),
        macros: `${food.nutrient_sources?.macros || "foodb"}+default0`,
        fiber_default: "0 for animal/oil groups when other macros present",
      };
    }
    if (
      hasCore &&
      food.macros.carbs_g == null &&
      (fatOil || (animalish && food.macros.protein_g != null && food.macros.protein_g > 5))
    ) {
      // only set carbs 0 for oils or clearly high-protein animal flesh
      if (fatOil || g.includes("aquatic") || g.includes("animal foods")) {
        food.macros.carbs_g = 0;
      }
    }
  }

  // Cleanup temp flags + finalize sources
  const missingList = [];
  for (const food of catalog.foods) {
    delete food._hadAnyMacro;
    delete food._needApi;
    if (!food.nutrient_sources) {
      food.nutrient_sources = {
        macros: Object.values(food.macros).some((v) => v != null) ? "foodb" : "none",
        micros: (food.micros || []).length ? "foodb" : "none",
      };
    }
    food.macros_complete =
      food.macros.energy_kcal != null &&
      food.macros.protein_g != null &&
      food.macros.fat_g != null &&
      food.macros.carbs_g != null;

    // Ensure picture candidates
    if (food.foodb_id) {
      food.picture = `https://foodb.ca/system/foods/pictures/${food.foodb_id}/full/${food.foodb_id}.png`;
      food.picture_candidates = [
        food.picture,
        `https://foodb.ca/system/foods/pictures/${food.foodb_id}/full/${food.foodb_id}.jpg`,
        `https://foodb.ca/system/foods/pictures/${food.foodb_id}/thumb/${food.foodb_id}.png`,
      ];
    }

    const missing = completeness(food);
    if (missing.length) {
      missingList.push({
        id: food.id,
        foodb_id: food.foodb_id,
        name: food.name,
        group: food.food_group,
        subgroup: food.food_subgroup,
        missing,
        nutrient_sources: food.nutrient_sources,
        page: `/ingredients/${encodeURIComponent(food.id)}`,
      });
    }
  }

  catalog.version = 3;
  catalog.enrichment = {
    ...stats,
    complete_count: catalog.foods.length - missingList.length,
    incomplete_count: missingList.length,
    generated_at: new Date().toISOString(),
  };
  catalog.generated_at = new Date().toISOString();

  fs.writeFileSync(catalogPath, JSON.stringify(catalog));
  console.log("Wrote catalog", catalogPath);

  const report = {
    generated_at: new Date().toISOString(),
    total_foods: catalog.foods.length,
    fully_complete: catalog.foods.length - missingList.length,
    incomplete: missingList.length,
    stats,
    summary_missing_counts: {},
    foods: missingList,
  };
  for (const row of missingList) {
    for (const m of row.missing) {
      report.summary_missing_counts[m] = (report.summary_missing_counts[m] || 0) + 1;
    }
  }
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  // Markdown report
  const lines = [
    `# Missing ingredient data report`,
    ``,
    `Generated: ${report.generated_at}`,
    ``,
    `## Summary`,
    ``,
    `| Metric | Count |`,
    `|--------|------:|`,
    `| Total FooDB foods | ${report.total_foods} |`,
    `| Fully complete* | ${report.fully_complete} |`,
    `| Incomplete | ${report.incomplete} |`,
    ``,
    `\\*Complete = name, description, group, subgroup, picture URL, all 5 macros (energy/protein/fat/carbs/fiber), and ≥1 micro.`,
    ``,
    `### Missing field frequencies`,
    ``,
    `| Field | Foods missing it |`,
    `|-------|-----------------:|`,
    ...Object.entries(report.summary_missing_counts)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `| ${k} | ${v} |`),
    ``,
    `### Enrichment pass hits`,
    ``,
    "```json",
    JSON.stringify(stats, null, 2),
    "```",
    ``,
    `## Incomplete foods`,
    ``,
  ];
  for (const row of missingList) {
    lines.push(`### ${row.name} (\`${row.id}\`)`);
    lines.push(`- Group: ${row.group || "—"} / ${row.subgroup || "—"}`);
    lines.push(`- Page: \`${row.page}\``);
    lines.push(`- Missing: ${row.missing.join(", ")}`);
    if (row.nutrient_sources?.usda_description) {
      lines.push(`- USDA match: ${row.nutrient_sources.usda_description} (${row.nutrient_sources.match_pass || ""})`);
    }
    lines.push("");
  }
  fs.writeFileSync(reportMdPath, lines.join("\n"));
  console.log("Wrote report", reportMdPath);
  console.log({
    total: report.total_foods,
    complete: report.fully_complete,
    incomplete: report.incomplete,
    summary: report.summary_missing_counts,
    stats,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
