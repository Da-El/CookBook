import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { loadCatalog } from "../lib/catalog";
import {
  loadFridge,
  loadRatings,
  loadTheme,
  saveFridge,
  saveRatings,
  saveTheme,
  uid,
} from "../lib/storage";
import type {
  CatalogFood,
  CatalogPayload,
  FridgeItem,
  FridgeLocation,
  SubjectRating,
  Theme,
} from "../types";

type AddFridgeInput = {
  foodId: string;
  quantity: string;
  location: FridgeLocation;
  boughtOn: string | null;
  expiresOn: string | null;
  rating: number | null;
  notes: string;
};

type AppContextValue = {
  theme: Theme;
  toggleTheme: () => void;
  catalog: CatalogPayload | null;
  foods: CatalogFood[];
  catalogLoading: boolean;
  catalogError: string | null;
  fridge: FridgeItem[];
  addToFridge: (input: AddFridgeInput) => void;
  updateFridgeItem: (id: string, patch: Partial<FridgeItem>) => void;
  removeFromFridge: (id: string) => void;
  clearFridge: () => void;
  ratings: SubjectRating[];
  getRating: (subjectType: "ingredient" | "meal", subjectId: string) => SubjectRating | undefined;
  setRating: (
    subjectType: "ingredient" | "meal",
    subjectId: string,
    score: number,
    notes?: string,
  ) => void;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => loadTheme());
  const [catalog, setCatalog] = useState<CatalogPayload | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [fridge, setFridge] = useState<FridgeItem[]>(() => loadFridge());
  const [ratings, setRatings] = useState<SubjectRating[]>(() => loadRatings());

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    saveTheme(theme);
  }, [theme]);

  useEffect(() => {
    let cancelled = false;
    setCatalogLoading(true);
    loadCatalog()
      .then((data) => {
        if (!cancelled) {
          setCatalog(data);
          setCatalogError(null);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) setCatalogError(err.message || "Failed to load catalog");
      })
      .finally(() => {
        if (!cancelled) setCatalogLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    saveFridge(fridge);
  }, [fridge]);

  useEffect(() => {
    saveRatings(ratings);
  }, [ratings]);

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === "light" ? "dark" : "light"));
  }, []);

  const addToFridge = useCallback((input: AddFridgeInput) => {
    const item: FridgeItem = {
      id: uid(),
      foodId: input.foodId,
      quantity: input.quantity.trim() || "1",
      location: input.location,
      boughtOn: input.boughtOn,
      expiresOn: input.expiresOn,
      rating: input.rating,
      notes: input.notes.trim(),
      addedAt: new Date().toISOString(),
    };
    setFridge((prev) => [item, ...prev]);
  }, []);

  const updateFridgeItem = useCallback((id: string, patch: Partial<FridgeItem>) => {
    setFridge((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  const removeFromFridge = useCallback((id: string) => {
    setFridge((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const clearFridge = useCallback(() => setFridge([]), []);

  const getRating = useCallback(
    (subjectType: "ingredient" | "meal", subjectId: string) =>
      ratings.find((r) => r.subjectType === subjectType && r.subjectId === subjectId),
    [ratings],
  );

  const setRating = useCallback(
    (subjectType: "ingredient" | "meal", subjectId: string, score: number, notes = "") => {
      const clamped = Math.max(0, Math.min(10, Math.round(score)));
      setRatings((prev) => {
        const rest = prev.filter(
          (r) => !(r.subjectType === subjectType && r.subjectId === subjectId),
        );
        if (clamped <= 0) return rest;
        return [
          {
            subjectType,
            subjectId,
            score: clamped,
            notes,
            updatedAt: new Date().toISOString(),
          },
          ...rest,
        ];
      });
    },
    [],
  );

  const value = useMemo<AppContextValue>(
    () => ({
      theme,
      toggleTheme,
      catalog,
      foods: catalog?.foods ?? [],
      catalogLoading,
      catalogError,
      fridge,
      addToFridge,
      updateFridgeItem,
      removeFromFridge,
      clearFridge,
      ratings,
      getRating,
      setRating,
    }),
    [
      theme,
      toggleTheme,
      catalog,
      catalogLoading,
      catalogError,
      fridge,
      addToFridge,
      updateFridgeItem,
      removeFromFridge,
      clearFridge,
      ratings,
      getRating,
      setRating,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
