/**
 * Backend API client. Uses VITE_API_URL when set; otherwise same-origin (Render).
 */

const base = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "";

export class ApiError extends Error {
  code: string;
  status: number;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const code = data?.error?.code ?? "error";
    const message = data?.error?.message ?? res.statusText;
    throw new ApiError(res.status, code, message);
  }
  return data as T;
}

export type ApiFood = {
  id: string;
  foodb_id?: number;
  name: string;
  name_scientific?: string | null;
  description?: string | null;
  food_group?: string | null;
  food_subgroup?: string | null;
  picture?: string | null;
  picture_candidates?: string[];
  emoji?: string;
  macros: Record<string, number | null>;
  macros_complete?: boolean;
  micros?: unknown;
  other_nutrients?: unknown;
  nutrient_sources?: unknown;
};

export type FridgeItemDto = {
  id: string;
  user_id: string;
  food_id: string;
  food_name: string;
  quantity: string;
  location: string;
  bought_on: string | null;
  expires_on: string | null;
  notes: string;
  rating: number | null;
};

export const api = {
  health: () => request<{ status: string; service: string; version: string }>("/healthz"),

  listFoods: (params: { q?: string; group?: string; limit?: number } = {}) => {
    const sp = new URLSearchParams();
    if (params.q) sp.set("q", params.q);
    if (params.group) sp.set("group", params.group);
    if (params.limit) sp.set("limit", String(params.limit));
    const qs = sp.toString();
    return request<{ count: number; total: number; items: ApiFood[] }>(
      `/v1/foods${qs ? `?${qs}` : ""}`,
    );
  },

  getFood: (id: string) => request<ApiFood>(`/v1/foods/${encodeURIComponent(id)}`),

  groups: () => request<{ groups: string[] }>("/v1/foods/groups"),

  listFridge: () => request<{ items: FridgeItemDto[] }>("/v1/fridge"),

  addFridge: (body: {
    food_id: string;
    quantity?: string;
    location?: string;
    bought_on?: string | null;
    expires_on?: string | null;
    notes?: string;
    rating?: number | null;
  }) =>
    request<FridgeItemDto>("/v1/fridge", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  deleteFridge: (id: string) =>
    request<{ deleted: boolean; id: string }>(`/v1/fridge/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
};

export function apiBase(): string {
  return base || "(same origin)";
}
