/**
 * Backend API client. Uses VITE_API_URL when set; otherwise same-origin (Render).
 */

const base = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "";

const ACCESS_KEY = "grok-cookbook-access-token";
const REFRESH_KEY = "grok-cookbook-refresh-token";

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
  fdc_id?: number | null;
  foodb_id?: number | null;
  brand_owner?: string;
  brand_name?: string;
  gtin_upc?: string;
  ingredients_label?: string;
  serving_size?: string | null;
  name: string;
  name_scientific?: string | null;
  description?: string | null;
  food_group?: string | null;
  food_subgroup?: string | null;
  picture?: string | null;
  picture_candidates?: string[];
  emoji?: string;
  source?: string;
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
  photo_url: string | null;
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

export type AuthorDto = {
  id: string;
  handle: string;
  display_name: string;
  avatar_url: string | null;
};

export type MealIngredientDto = {
  id: string;
  food_id: string;
  food_name: string;
  quantity_text: string;
  quantity_g: number | null;
  sort_order: number;
};

export type MealMacrosDto = {
  kcal: number | null;
  protein_g: number | null;
  fat_g: number | null;
  carbs_g: number | null;
  fiber_g: number | null;
};

export type MealDto = {
  id: string;
  author: AuthorDto;
  status: "cooked" | "want_to_cook" | string;
  title: string;
  story: string;
  cuisine: string;
  time_minutes: number | null;
  visibility: "public" | "private" | string;
  photo_url: string | null;
  author_rating: number | null;
  macros_estimated: MealMacrosDto | null;
  ingredients: MealIngredientDto[];
  review_avg: number | null;
  review_count: number;
  my_score: number | null;
  created_at: string;
  updated_at: string;
};

export type ReviewDto = {
  id: string;
  user_id: string;
  handle: string;
  display_name: string;
  subject_type: string;
  subject_id: string;
  score: number;
  notes: string;
  updated_at: string;
};

export type ProfileDto = {
  id: string;
  handle: string;
  display_name: string;
  bio: string;
  avatar_url: string | null;
  cookbook_title: string;
  tagline: string;
  cover_style: string;
  accent_hex: string | null;
  favorite_cuisines: string;
  location_label: string;
  cover_url: string | null;
  cooked_count: number;
  want_count: number;
  followers_count: number;
  following_count: number;
  is_following: boolean;
  is_self: boolean;
};

export type FollowUserDto = {
  id: string;
  handle: string;
  display_name: string;
  bio: string;
  avatar_url: string | null;
  followed_at?: string;
};

export type UpdateProfileBody = {
  display_name?: string;
  bio?: string;
  avatar_url?: string | null;
  clear_avatar?: boolean;
  cookbook_title?: string;
  tagline?: string;
  cover_style?: string;
  accent_hex?: string | null;
  clear_accent?: boolean;
  favorite_cuisines?: string;
  location_label?: string;
  cover_url?: string | null;
  clear_cover?: boolean;
};

export const COVER_STYLES = [
  { id: "parchment", label: "Parchment", blurb: "Classic paper cookbook" },
  { id: "linen", label: "Linen", blurb: "Soft fabric cover" },
  { id: "indigo", label: "Indigo", blurb: "Enterprise cool" },
  { id: "kitchen", label: "Kitchen", blurb: "Warm terracotta" },
  { id: "forest", label: "Forest", blurb: "Fresh greens" },
  { id: "midnight", label: "Midnight", blurb: "Dark leather" },
  { id: "rose", label: "Rose", blurb: "Soft blush" },
  { id: "ocean", label: "Ocean", blurb: "Calm blues" },
  { id: "violet", label: "Violet", blurb: "Modern plum" },
] as const;

export type FeedItemDto = {
  type: "meal";
  id: string;
  created_at: string;
  author: AuthorDto;
  meal: MealDto;
};

export type CreateMealBody = {
  status: "cooked" | "want_to_cook";
  title: string;
  story?: string;
  cuisine?: string;
  time_minutes?: number | null;
  visibility?: "public" | "private";
  photo_url?: string | null;
  rating?: number | null;
  ingredients?: { food_id: string; quantity_text?: string; quantity_g?: number | null }[];
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

  getFoodMeta: (id: string) =>
    request<{
      food_id: string;
      description: string;
      photo_url: string | null;
      catalog_description: string;
      catalog_picture: string | null;
    }>(`/v1/foods/${encodeURIComponent(id)}/meta`, undefined, true),

  putFoodMeta: (
    id: string,
    body: { description?: string; photo_url?: string | null; clear_photo?: boolean },
  ) =>
    request<{ food_id: string; description: string; photo_url: string | null }>(
      `/v1/foods/${encodeURIComponent(id)}/meta`,
      { method: "PUT", body: JSON.stringify(body) },
      true,
    ),

  groups: () => request<{ groups: string[] }>("/v1/foods/groups"),

  /** Live USDA Branded Foods search (server proxies FDC API — nothing stored). */
  searchBranded: (params: { q: string; page?: number; page_size?: number; brand?: string }) => {
    const sp = new URLSearchParams();
    sp.set("q", params.q);
    if (params.page) sp.set("page", String(params.page));
    if (params.page_size) sp.set("page_size", String(params.page_size));
    if (params.brand) sp.set("brand", params.brand);
    return request<{
      items: ApiFood[];
      total: number;
      page: number;
      page_size: number;
      message?: string;
      note?: string;
    }>(`/v1/branded?${sp.toString()}`);
  },

  getBranded: (id: string) =>
    request<ApiFood>(`/v1/branded/${encodeURIComponent(id)}`),

  listFridge: () => request<{ items: FridgeItemDto[] }>("/v1/fridge", undefined, true),

  addFridge: (body: {
    food_id: string;
    quantity?: string;
    bought_on?: string | null;
    expires_on?: string | null;
    notes?: string;
    rating?: number | null;
    photo_url?: string | null;
  }) =>
    request<FridgeItemDto>("/v1/fridge", {
      method: "POST",
      body: JSON.stringify(body),
    }, true),

  deleteFridge: (id: string) =>
    request<{ deleted: boolean; id: string }>(`/v1/fridge/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }, true),

  uploadMedia: (imageDataUrl: string) =>
    request<{ url: string; id: string }>("/v1/media", {
      method: "POST",
      body: JSON.stringify({ image: imageDataUrl }),
    }, true),

  // Meals
  createMeal: (body: CreateMealBody) =>
    request<MealDto>("/v1/meals", { method: "POST", body: JSON.stringify(body) }, true),

  searchMeals: (params: { q?: string; limit?: number } = {}) => {
    const sp = new URLSearchParams();
    if (params.q) sp.set("q", params.q);
    if (params.limit) sp.set("limit", String(params.limit));
    const qs = sp.toString();
    return request<{ items: MealDto[] }>(
      `/v1/meals/search${qs ? `?${qs}` : ""}`,
      undefined,
      true,
    );
  },

  listMeals: (params: { user_id?: string; handle?: string; status?: string; limit?: number } = {}) => {
    const sp = new URLSearchParams();
    if (params.user_id) sp.set("user_id", params.user_id);
    if (params.handle) sp.set("handle", params.handle);
    if (params.status) sp.set("status", params.status);
    if (params.limit) sp.set("limit", String(params.limit));
    const qs = sp.toString();
    return request<{ items: MealDto[] }>(`/v1/meals${qs ? `?${qs}` : ""}`, undefined, true);
  },

  getMeal: (id: string) =>
    request<MealDto>(`/v1/meals/${encodeURIComponent(id)}`, undefined, true),

  updateMeal: (id: string, body: Partial<CreateMealBody>) =>
    request<MealDto>(`/v1/meals/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }, true),

  deleteMeal: (id: string) =>
    request<{ deleted: boolean; id: string }>(`/v1/meals/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }, true),

  // Reviews
  upsertReview: (body: {
    subject_type: "ingredient" | "meal";
    subject_id: string;
    score: number;
    notes?: string;
  }) =>
    request<ReviewDto>("/v1/reviews", { method: "PUT", body: JSON.stringify(body) }, true),

  listReviews: (params: {
    subject_type?: string;
    subject_id?: string;
    mine?: boolean;
    limit?: number;
  } = {}) => {
    const sp = new URLSearchParams();
    if (params.subject_type) sp.set("subject_type", params.subject_type);
    if (params.subject_id) sp.set("subject_id", params.subject_id);
    if (params.mine) sp.set("mine", "true");
    if (params.limit) sp.set("limit", String(params.limit));
    const qs = sp.toString();
    // Public list does not require auth; "mine" still needs a token
    const needAuth = !!params.mine || !!getAccessToken();
    return request<{ items: ReviewDto[]; count?: number; avg?: number | null }>(
      `/v1/reviews${qs ? `?${qs}` : ""}`,
      undefined,
      needAuth,
    );
  },

  deleteReview: (id: string) =>
    request<{ deleted: boolean; id: string }>(`/v1/reviews/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }, true),

  // Social
  getProfile: (handle: string) =>
    request<ProfileDto>(`/v1/users/${encodeURIComponent(handle)}`, undefined, true),

  updateProfile: (body: UpdateProfileBody) =>
    request<ProfileDto>("/v1/me/profile", {
      method: "PATCH",
      body: JSON.stringify(body),
    }, true),

  follow: (handle: string) =>
    request<{ following: boolean; handle: string }>(
      `/v1/follows/${encodeURIComponent(handle)}`,
      { method: "POST" },
      true,
    ),

  unfollow: (handle: string) =>
    request<{ following: boolean; handle: string }>(
      `/v1/follows/${encodeURIComponent(handle)}`,
      { method: "DELETE" },
      true,
    ),

  listFollowing: () =>
    request<{ items: FollowUserDto[] }>("/v1/follows/following", undefined, true),

  listFollowers: () =>
    request<{ items: FollowUserDto[] }>("/v1/follows/followers", undefined, true),

  /** People who follow this user (public list). */
  listUserFollowers: (handle: string, limit = 50) =>
    request<{ items: FollowUserDto[]; kind?: string; handle?: string }>(
      `/v1/users/${encodeURIComponent(handle)}/followers?limit=${limit}`,
      undefined,
      true,
    ),

  /** People this user follows (public list). */
  listUserFollowing: (handle: string, limit = 50) =>
    request<{ items: FollowUserDto[]; kind?: string; handle?: string }>(
      `/v1/users/${encodeURIComponent(handle)}/following?limit=${limit}`,
      undefined,
      true,
    ),

  // Feed
  feed: (params: { tab?: "following" | "discover"; limit?: number; cursor?: string } = {}) => {
    const sp = new URLSearchParams();
    if (params.tab) sp.set("tab", params.tab);
    if (params.limit) sp.set("limit", String(params.limit));
    if (params.cursor) sp.set("cursor", params.cursor);
    const qs = sp.toString();
    return request<{ items: FeedItemDto[]; next_cursor: string | null; tab: string }>(
      `/v1/feed${qs ? `?${qs}` : ""}`,
      undefined,
      true,
    );
  },
};

export function apiBase(): string {
  return base || "(same origin)";
}
