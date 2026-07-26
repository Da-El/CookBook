import type { CatalogFood, CatalogPayload } from "../types";

let cache: CatalogPayload | null = null;
let loadPromise: Promise<CatalogPayload> | null = null;

export async function loadCatalog(): Promise<CatalogPayload> {
  if (cache) return cache;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    // Prefer API (Rust backend) when available; fall back to static USDA catalog.
    try {
      const base = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "";
      const res = await fetch(`${base}/v1/foods?limit=2000`);
      if (res.ok) {
        const body = (await res.json()) as { total?: number; items: CatalogFood[] };
        if (body.items?.length) {
          const data: CatalogPayload = {
            version: 3,
            source: "API /v1/foods",
            license: "USDA public domain / CC0",
            generated_at: new Date().toISOString(),
            count: body.total ?? body.items.length,
            foods: body.items.map((f) => ensureFoodShape(f as CatalogFood)),
          };
          cache = data;
          return data;
        }
      }
    } catch {
      /* offline / API down */
    }

    const res = await fetch("/data/catalog.json");
    if (!res.ok) throw new Error(`Failed to load catalog (${res.status})`);
    const data = (await res.json()) as CatalogPayload;
    data.foods = (data.foods || []).map((f) => ensureFoodShape(f));
    cache = data;
    return data;
  })().catch((err) => {
    loadPromise = null;
    throw err;
  });

  return loadPromise;
}

export function searchFoods(
  foods: CatalogFood[],
  query: string,
  groupFilter?: string,
  limit = 40,
): CatalogFood[] {
  const q = query.trim().toLowerCase();
  let list = foods;

  if (groupFilter && groupFilter !== "All") {
    list = list.filter((f) => f.food_group === groupFilter);
  }

  if (!q) {
    return list.slice(0, limit);
  }

  const scored: { food: CatalogFood; score: number }[] = [];
  for (const food of list) {
    const name = food.name.toLowerCase();
    const group = food.food_group.toLowerCase();
    const sub = (food.food_subgroup || "").toLowerCase();
    const sci = (food.name_scientific || "").toLowerCase();
    const desc = (food.description || "").toLowerCase();

    let score = 0;
    if (name === q) score = 100;
    else if (name.startsWith(q)) score = 80;
    else if (name.includes(q)) score = 60;
    else if (sci.includes(q)) score = 40;
    else if (sub.includes(q) || group.includes(q)) score = 25;
    else if (desc.includes(q)) score = 10;
    else continue;

    scored.push({ food, score });
  }

  scored.sort((a, b) => b.score - a.score || a.food.name.localeCompare(b.food.name));
  return scored.slice(0, limit).map((s) => s.food);
}

export function getFoodById(foods: CatalogFood[], id: string): CatalogFood | undefined {
  const decoded = decodeURIComponent(id);
  return foods.find(
    (f) =>
      f.id === id ||
      f.id === decoded ||
      (f.fdc_id != null && String(f.fdc_id) === id) ||
      (f.fdc_id != null && String(f.fdc_id) === decoded) ||
      (f.fdc_id != null && `fdc-${f.fdc_id}` === decoded) ||
      f.id.toLowerCase() === decoded.toLowerCase(),
  );
}

/** Normalize older catalog entries that lack micros arrays. */
export function ensureFoodShape(food: CatalogFood): CatalogFood {
  return {
    ...food,
    micros: food.micros ?? [],
    other_nutrients: food.other_nutrients ?? [],
  };
}

export function uniqueGroups(foods: CatalogFood[]): string[] {
  return [...new Set(foods.map((f) => f.food_group).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );
}
