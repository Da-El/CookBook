import type { FridgeItem, SubjectRating, Theme } from "../types";

const FRIDGE_KEY = "grok-cookbook-fridge-v1";
const THEME_KEY = "grok-cookbook-theme";
const RATINGS_KEY = "grok-cookbook-ratings-v1";

export function loadFridge(): FridgeItem[] {
  try {
    const raw = localStorage.getItem(FRIDGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as FridgeItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => ({
      ...item,
      location: "Fridge" as const,
      photoUrl: item.photoUrl ?? null,
    }));
  } catch {
    return [];
  }
}

export function saveFridge(items: FridgeItem[]) {
  localStorage.setItem(FRIDGE_KEY, JSON.stringify(items));
}

export function loadTheme(): Theme {
  try {
    const t = localStorage.getItem(THEME_KEY);
    if (t === "dark" || t === "light") return t;
  } catch {
    /* ignore */
  }
  return "light";
}

export function saveTheme(theme: Theme) {
  localStorage.setItem(THEME_KEY, theme);
}

export function loadRatings(): SubjectRating[] {
  try {
    const raw = localStorage.getItem(RATINGS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SubjectRating[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveRatings(ratings: SubjectRating[]) {
  localStorage.setItem(RATINGS_KEY, JSON.stringify(ratings));
}

export function uid() {
  return crypto.randomUUID();
}
