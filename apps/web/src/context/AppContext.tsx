import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  api,
  clearTokens,
  getAccessToken,
  setTokens,
  type SessionDto,
  type UserPublic,
} from "../lib/api";
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
  addToFridge: (input: AddFridgeInput) => void | Promise<void>;
  updateFridgeItem: (id: string, patch: Partial<FridgeItem>) => void;
  removeFromFridge: (id: string) => void | Promise<void>;
  clearFridge: () => void;
  ratings: SubjectRating[];
  getRating: (subjectType: "ingredient" | "meal", subjectId: string) => SubjectRating | undefined;
  setRating: (
    subjectType: "ingredient" | "meal",
    subjectId: string,
    score: number,
    notes?: string,
  ) => void;
  // Auth
  user: UserPublic | null;
  authLoading: boolean;
  login: (email: string, password: string, remember?: boolean) => Promise<void>;
  register: (body: {
    email: string;
    password: string;
    display_name: string;
    handle: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  refreshSessions: () => Promise<SessionDto[]>;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => loadTheme());
  const [catalog, setCatalog] = useState<CatalogPayload | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [fridge, setFridge] = useState<FridgeItem[]>(() => loadFridge());
  const [ratings, setRatings] = useState<SubjectRating[]>(() => loadRatings());
  const [user, setUser] = useState<UserPublic | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

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

  // Restore session
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!getAccessToken()) {
        setAuthLoading(false);
        return;
      }
      try {
        const me = await api.me();
        if (!cancelled) setUser(me);
        try {
          const remote = await api.listFridge();
          if (!cancelled && remote.items) {
            setFridge(
              remote.items.map((i) => ({
                id: i.id,
                foodId: i.food_id,
                quantity: i.quantity,
                location: i.location as FridgeLocation,
                boughtOn: i.bought_on,
                expiresOn: i.expires_on,
                notes: i.notes,
                rating: i.rating,
                addedAt: new Date().toISOString(),
              })),
            );
          }
        } catch {
          /* keep local fridge */
        }
      } catch {
        clearTokens();
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setAuthLoading(false);
      }
    })();
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

  const login = useCallback(async (email: string, password: string, remember = true) => {
    const tokens = await api.login({ email, password, remember });
    setTokens(tokens.access_token, tokens.refresh_token);
    setUser(tokens.user);
    try {
      const remote = await api.listFridge();
      setFridge(
        remote.items.map((i) => ({
          id: i.id,
          foodId: i.food_id,
          quantity: i.quantity,
          location: i.location as FridgeLocation,
          boughtOn: i.bought_on,
          expiresOn: i.expires_on,
          notes: i.notes,
          rating: i.rating,
          addedAt: new Date().toISOString(),
        })),
      );
    } catch {
      /* empty remote fridge ok */
    }
  }, []);

  const register = useCallback(
    async (body: {
      email: string;
      password: string;
      display_name: string;
      handle: string;
    }) => {
      const tokens = await api.register(body);
      setTokens(tokens.access_token, tokens.refresh_token);
      setUser(tokens.user);
      setFridge([]);
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      /* still clear local */
    }
    clearTokens();
    setUser(null);
  }, []);

  const logoutAll = useCallback(async () => {
    await api.logoutAll();
    clearTokens();
    setUser(null);
  }, []);

  const refreshSessions = useCallback(async () => {
    const res = await api.sessions();
    return res.items;
  }, []);

  const addToFridge = useCallback(
    async (input: AddFridgeInput) => {
      if (user && getAccessToken()) {
        try {
          const item = await api.addFridge({
            food_id: input.foodId,
            quantity: input.quantity.trim() || "1",
            location: input.location,
            bought_on: input.boughtOn,
            expires_on: input.expiresOn,
            notes: input.notes.trim(),
            rating: input.rating,
          });
          setFridge((prev) => [
            {
              id: item.id,
              foodId: item.food_id,
              quantity: item.quantity,
              location: item.location as FridgeLocation,
              boughtOn: item.bought_on,
              expiresOn: item.expires_on,
              notes: item.notes,
              rating: item.rating,
              addedAt: new Date().toISOString(),
            },
            ...prev,
          ]);
          return;
        } catch {
          /* fall through to local */
        }
      }
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
    },
    [user],
  );

  const updateFridgeItem = useCallback((id: string, patch: Partial<FridgeItem>) => {
    setFridge((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  const removeFromFridge = useCallback(
    async (id: string) => {
      if (user && getAccessToken()) {
        try {
          await api.deleteFridge(id);
        } catch {
          /* still remove local */
        }
      }
      setFridge((prev) => prev.filter((item) => item.id !== id));
    },
    [user],
  );

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
      user,
      authLoading,
      login,
      register,
      logout,
      logoutAll,
      refreshSessions,
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
      user,
      authLoading,
      login,
      register,
      logout,
      logoutAll,
      refreshSessions,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
