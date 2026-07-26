/**
 * Backend API client. Uses VITE_API_URL when set; otherwise same-origin (Render).
 */

const base = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "";

const ACCESS_KEY = "cookbook-access-token";
const REFRESH_KEY = "cookbook-refresh-token";

export class ApiError extends Error {
  code: string;
  status: number;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function getAccessToken(): string | null {
  try {
    return localStorage.getItem(ACCESS_KEY);
  } catch {
    return null;
  }
}

export function getRefreshToken(): string | null {
  try {
    return localStorage.getItem(REFRESH_KEY);
  } catch {
    return null;
  }
}

export function setTokens(access: string, refresh: string) {
  localStorage.setItem(ACCESS_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

async function request<T>(path: string, init?: RequestInit, auth = false): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (auth) {
    const token = getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let res = await fetch(`${base}${path}`, { ...init, headers });

  // One silent refresh attempt on 401 for authenticated routes
  if (res.status === 401 && auth && getRefreshToken()) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      headers.Authorization = `Bearer ${getAccessToken()}`;
      res = await fetch(`${base}${path}`, { ...init, headers });
    }
  }

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const code = data?.error?.code ?? "error";
    const message = data?.error?.message ?? res.statusText;
    throw new ApiError(res.status, code, message);
  }
  return data as T;
}

async function tryRefresh(): Promise<boolean> {
  const refresh_token = getRefreshToken();
  if (!refresh_token) return false;
  try {
    const res = await fetch(`${base}/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token }),
    });
    if (!res.ok) {
      clearTokens();
      return false;
    }
    const data = (await res.json()) as TokenPair;
    setTokens(data.access_token, data.refresh_token);
    return true;
  } catch {
    clearTokens();
    return false;
  }
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

export type UserPublic = {
  id: string;
  email: string;
  email_verified: boolean;
  display_name: string;
  handle: string;
  bio: string;
};

export type TokenPair = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: UserPublic;
};

export type SessionDto = {
  id: string;
  created_at: string;
  last_seen_at: string;
  expires_at: string;
  remember: boolean;
  current: boolean;
};

export const api = {
  health: () => request<{ status: string; service: string; version: string }>("/healthz"),

  register: (body: {
    email: string;
    password: string;
    display_name: string;
    handle: string;
  }) =>
    request<TokenPair>("/v1/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  login: (body: { email: string; password: string; remember?: boolean }) =>
    request<TokenPair>("/v1/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  refresh: (refresh_token: string) =>
    request<TokenPair>("/v1/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refresh_token }),
    }),

  logout: () => request<{ ok: boolean }>("/v1/auth/logout", { method: "POST" }, true),

  logoutAll: () => request<{ ok: boolean }>("/v1/auth/logout-all", { method: "POST" }, true),

  me: () => request<UserPublic>("/v1/auth/me", undefined, true),

  sessions: () => request<{ items: SessionDto[] }>("/v1/auth/sessions", undefined, true),

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

  listFridge: () => request<{ items: FridgeItemDto[] }>("/v1/fridge", undefined, true),

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
    }, true),

  deleteFridge: (id: string) =>
    request<{ deleted: boolean; id: string }>(`/v1/fridge/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }, true),
};

export function apiBase(): string {
  return base || "(same origin)";
}
