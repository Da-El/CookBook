/** V2 API client — same origin via Vite proxy to :8081 */

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json() as Promise<T>;
}

export type Recipe = {
  id: string;
  title: string;
  summary: string;
  servings?: number | null;
  prep_minutes?: number | null;
  cook_minutes?: number | null;
  difficulty: string;
  cuisine_tags: string[];
  ingredients: {
    id: string;
    name: string;
    quantity?: number | null;
    unit?: string | null;
    notes: string;
    aisle_hint?: string | null;
  }[];
  steps: {
    id: string;
    order: number;
    instruction: string;
    timer_seconds?: number | null;
    beginner_note?: string | null;
  }[];
  timers: { id: string; label: string; seconds: number; step_order?: number | null }[];
  beginner_tips: string[];
  estimated_cost?: {
    currency: string;
    low: number;
    high: number;
    notes: string;
    is_estimate: boolean;
  } | null;
};

export type ImportJob = {
  id: string;
  kind: string;
  status: string;
  message: string;
  recipe?: Recipe | null;
};

export type MealPlan = {
  id: string;
  title: string;
  start_date: string;
  days: {
    date: string;
    slots: {
      id: string;
      meal_type: string;
      recipe_id?: string | null;
      recipe_title?: string | null;
      notes: string;
    }[];
  }[];
  reuse_notes: string[];
};

export type GroceryList = {
  id: string;
  title: string;
  items: {
    id: string;
    name: string;
    quantity?: number | null;
    unit?: string | null;
    aisle?: string | null;
    checked: boolean;
    from_recipes: string[];
  }[];
};

export type CookingSession = {
  id: string;
  recipe_id: string;
  recipe_title: string;
  current_step: number;
  timers: {
    id: string;
    label: string;
    total_seconds: number;
    remaining_seconds: number;
    running: boolean;
  }[];
};

export type GalleryItem = {
  id: string;
  title: string;
  blurb: string;
  tags: string[];
  is_stub: boolean;
};

export type Guide = {
  id: string;
  title: string;
  body: string;
  topics: string[];
};

export const v2 = {
  health: () =>
    req<{
      status: string;
      product: string;
      llm_live: boolean;
      xai_key_configured: boolean;
    }>("/healthz"),

  meta: () => req<Record<string, unknown>>("/v2/meta"),

  listRecipes: () => req<{ items: Recipe[] }>("/v2/recipes"),
  getRecipe: (id: string) => req<Recipe>(`/v2/recipes/${id}`),
  createRecipe: (title: string) =>
    req<Recipe>("/v2/recipes", { method: "POST", body: JSON.stringify({ title }) }),

  importRecipe: (body: {
    kind: string;
    payload: string;
    title_hint?: string;
  }) => req<ImportJob>("/v2/import", { method: "POST", body: JSON.stringify(body) }),

  createPlan: (body: {
    title: string;
    start_date: string;
    days?: number;
    recipe_ids?: string[];
    smart_reuse?: boolean;
  }) => req<MealPlan>("/v2/meal-plans", { method: "POST", body: JSON.stringify(body) }),

  listPlans: () => req<{ items: MealPlan[] }>("/v2/meal-plans"),

  buildGrocery: (recipe_ids: string[], title?: string) =>
    req<GroceryList>("/v2/grocery", {
      method: "POST",
      body: JSON.stringify({ recipe_ids, title }),
    }),

  startCook: (recipe_id: string) =>
    req<CookingSession>("/v2/cook/sessions", {
      method: "POST",
      body: JSON.stringify({ recipe_id }),
    }),

  timerAction: (
    sessionId: string,
    body: { timer_id: string; action: string; remaining_seconds?: number },
  ) =>
    req<CookingSession>(`/v2/cook/sessions/${sessionId}/timers`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  gallery: () => req<{ items: GalleryItem[] }>("/v2/gallery"),
  guides: () => req<{ items: Guide[] }>("/v2/guides"),
  llmStatus: () =>
    req<{ provider: string; live: boolean; xai_key_configured: boolean; note: string }>(
      "/v2/llm/status",
    ),
};
