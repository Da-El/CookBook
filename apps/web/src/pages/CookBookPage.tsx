import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  CookbookProfile,
  profileToCookbookData,
} from "../components/CookbookProfile";
import { FoodThumb } from "../components/FoodThumb";
import { ProfileCustomize } from "../components/ProfileCustomize";
import { StarRating } from "../components/StarRating";
import { useApp } from "../context/AppContext";
import { api, type MealDto, type ProfileDto } from "../lib/api";
import { getFoodById } from "../lib/catalog";
import { daysUntil, mediaUrl } from "../lib/photo";

const TABS = ["Cooked", "Want to cook", "Fridge"] as const;
type Tab = (typeof TABS)[number];

type Suggestion = {
  meal: MealDto;
  have: number;
  total: number;
  pct: number;
};

function emptyProfile(user: {
  id: string;
  handle: string;
  display_name: string;
  bio: string;
}): ProfileDto {
  return {
    id: user.id,
    handle: user.handle,
    display_name: user.display_name,
    bio: user.bio || "",
    avatar_url: null,
    cookbook_title: "",
    tagline: "",
    cover_style: "parchment",
    accent_hex: null,
    favorite_cuisines: "",
    location_label: "",
    cover_url: null,
    cooked_count: 0,
    want_count: 0,
    followers_count: 0,
    following_count: 0,
    is_following: false,
    is_self: true,
  };
}

export function CookBookPage() {
  const { user, fridge, foods, removeFromFridge, authLoading, patchUser } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>("Cooked");
  const [fridgeQuery, setFridgeQuery] = useState("");
  const [cooked, setCooked] = useState<MealDto[]>([]);
  const [want, setWant] = useState<MealDto[]>([]);
  const [profile, setProfile] = useState<ProfileDto | null>(null);
  const [loadingMeals, setLoadingMeals] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get("customize") === "1" && user) {
      setCustomizeOpen(true);
    }
  }, [searchParams, user]);

  useEffect(() => {
    if (!user) {
      setCooked([]);
      setWant([]);
      setProfile(null);
      return;
    }
    let cancelled = false;
    setLoadingMeals(true);
    Promise.all([
      api.listMeals({ status: "cooked", limit: 50 }),
      api.listMeals({ status: "want_to_cook", limit: 50 }),
      api.getProfile(user.handle),
    ])
      .then(([c, w, p]) => {
        if (cancelled) return;
        setCooked(c.items);
        setWant(w.items);
        setProfile(p);
      })
      .catch(() => {
        if (!cancelled) {
          setCooked([]);
          setWant([]);
          setProfile(emptyProfile(user));
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingMeals(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const fridgeIds = useMemo(() => new Set(fridge.map((f) => f.foodId)), [fridge]);

  const suggestions = useMemo((): Suggestion[] => {
    if (fridgeIds.size === 0) return [];
    const pool = [...want, ...cooked];
    const scored: Suggestion[] = [];
    for (const meal of pool) {
      const total = meal.ingredients?.length ?? 0;
      if (total === 0) continue;
      const have = meal.ingredients.filter((i) => fridgeIds.has(i.food_id)).length;
      if (have === 0) continue;
      scored.push({ meal, have, total, pct: have / total });
    }
    scored.sort((a, b) => b.pct - a.pct || b.have - a.have);
    const seen = new Set<string>();
    return scored
      .filter((s) => {
        if (seen.has(s.meal.id)) return false;
        seen.add(s.meal.id);
        return true;
      })
      .slice(0, 8);
  }, [want, cooked, fridgeIds]);

  const fridgeRows = useMemo(() => {
    const q = fridgeQuery.trim().toLowerCase();
    return fridge
      .map((item) => ({ item, food: getFoodById(foods, item.foodId) }))
      .filter(({ item, food }) => {
        if (!q) return true;
        const name = food?.name ?? item.foodId;
        const group = food?.food_group ?? "";
        const notes = item.notes ?? "";
        return (
          name.toLowerCase().includes(q) ||
          group.toLowerCase().includes(q) ||
          notes.toLowerCase().includes(q) ||
          item.quantity.toLowerCase().includes(q)
        );
      });
  }, [fridge, foods, fridgeQuery]);

  if (authLoading) {
    return (
      <div className="page page--single">
        <div className="column">
          <p className="muted">Loading…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="page page--single">
        <div className="column">
          <div className="page-hero">
            <div>
              <h1>CookBook</h1>
              <p className="lede">Your personal kitchen volume — meals, fridge, and story</p>
            </div>
          </div>
          <section className="card card-pad empty-state">
            <div className="empty-glyph" aria-hidden />
            <p className="muted mt-12">Sign in to open your personal CookBook.</p>
            <div className="row-end mt-16" style={{ justifyContent: "center", gap: 10 }}>
              <Link to="/login" className="btn btn-primary">
                Sign in
              </Link>
              <Link to="/signup" className="btn btn-secondary">
                Join
              </Link>
            </div>
          </section>
        </div>
      </div>
    );
  }

  const list = tab === "Cooked" ? cooked : tab === "Want to cook" ? want : [];
  const p = profile ?? emptyProfile(user);
  const bookData = profileToCookbookData(p);

  function onProfileSaved(saved: ProfileDto) {
    setProfile(saved);
    patchUser({
      display_name: saved.display_name,
      bio: saved.bio,
    });
  }

  return (
    <div className="page">
      <div className="column">
        <CookbookProfile
          data={bookData}
          actions={
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setCustomizeOpen(true)}
            >
              Personalize
            </button>
          }
        />

        <div className="seg" role="tablist">
          {TABS.map((t) => {
            const count =
              t === "Cooked" ? cooked.length : t === "Want to cook" ? want.length : fridge.length;
            return (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                className={tab === t ? "active" : undefined}
                onClick={() => setTab(t)}
              >
                {t} <span className="seg-count">{count}</span>
              </button>
            );
          })}
        </div>

        {(tab === "Cooked" || tab === "Want to cook") && (
          <section className="cookbook-chapter">
            <div className="cookbook-chapter-head">
              <div>
                <h2>{tab === "Cooked" ? "Cooked" : "Want to cook"}</h2>
                <p className="muted text-sm mt-4">
                  {tab === "Cooked"
                    ? "Meals you’ve made — your kitchen history"
                    : "Recipes and ideas waiting on the shelf"}
                </p>
              </div>
              <Link to="/create/meal" className="btn btn-primary btn-sm">
                Add meal
              </Link>
            </div>
            <div className="cookbook-chapter-body">
              {loadingMeals ? (
                <p className="muted">Loading meals…</p>
              ) : list.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-glyph" aria-hidden />
                  <p className="muted mt-12">
                    {tab === "Cooked" ? "No cooked meals yet." : "Your want-to-cook list is empty."}
                  </p>
                  <Link to="/create/meal" className="btn btn-primary btn-sm mt-12">
                    Create a meal
                  </Link>
                </div>
              ) : (
                <div className="cookbook-meal-grid">
                  {list.map((m) => {
                    const img = mediaUrl(m.photo_url);
                    return (
                      <Link key={m.id} to={`/meals/${m.id}`} className="cookbook-meal-card">
                        <div className="cookbook-meal-media">
                          {img ? (
                            <img src={img} alt="" />
                          ) : (
                            <span className="meal-thumb-ring" aria-hidden />
                          )}
                        </div>
                        <div className="cookbook-meal-body">
                          <div className="name">{m.title}</div>
                          <div className="meta">
                            {m.cuisine || "Meal"}
                            {m.time_minutes ? ` · ${m.time_minutes} min` : ""}
                            {m.visibility === "private" ? " · private" : ""}
                          </div>
                          {m.author_rating != null && (
                            <div className="mt-8">
                              <StarRating value={m.author_rating} showValue />
                            </div>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        )}

        {tab === "Fridge" && (
          <>
            <section className="card card-pad fridge-panel">
              <div className="card-head">
                <div>
                  <h2 className="card-title">Fridge pantry</h2>
                  <p className="muted text-sm mt-4">
                    {fridge.length === 0
                      ? "Empty — add ingredients to get meal ideas"
                      : `${fridge.length} item${fridge.length === 1 ? "" : "s"}`}
                  </p>
                </div>
                <Link to="/create/ingredient" className="btn btn-primary btn-sm">
                  Add ingredient
                </Link>
              </div>

              {fridge.length > 0 && (
                <div className="field mt-12">
                  <label htmlFor="fridge-q" className="sr-only">
                    Search fridge
                  </label>
                  <input
                    id="fridge-q"
                    type="search"
                    value={fridgeQuery}
                    onChange={(e) => setFridgeQuery(e.target.value)}
                    placeholder="Search your fridge…"
                  />
                </div>
              )}

              {fridge.length === 0 ? (
                <div className="empty-state mt-16">
                  <div className="empty-glyph" aria-hidden />
                  <p className="muted mt-12">Nothing in the fridge yet.</p>
                  <Link to="/create/ingredient" className="btn btn-primary btn-sm mt-12">
                    Add your first ingredient
                  </Link>
                </div>
              ) : fridgeRows.length === 0 ? (
                <p className="muted mt-16">No matches for “{fridgeQuery}”.</p>
              ) : (
                <div className="fridge-grid mt-16">
                  {fridgeRows.map(({ item, food }) => {
                    const custom = mediaUrl(item.photoUrl);
                    const days = daysUntil(item.expiresOn);
                    let expClass = "";
                    let expLabel = "";
                    if (days !== null) {
                      if (days < 0) {
                        expClass = "fridge-exp--bad";
                        expLabel = "Expired";
                      } else if (days === 0) {
                        expClass = "fridge-exp--warn";
                        expLabel = "Today";
                      } else if (days <= 3) {
                        expClass = "fridge-exp--warn";
                        expLabel = `${days}d left`;
                      } else {
                        expLabel = `${days}d left`;
                      }
                    }
                    return (
                      <article key={item.id} className="fridge-card">
                        <Link
                          to={
                            food
                              ? `/ingredients/${encodeURIComponent(food.id)}`
                              : "/cookbook"
                          }
                          className="fridge-card-media"
                        >
                          {custom ? (
                            <img src={custom} alt="" className="fridge-card-img" />
                          ) : food ? (
                            <FoodThumb food={food} className="fridge-card-thumb" />
                          ) : (
                            <div className="food-placeholder" aria-hidden>
                              <span className="food-placeholder-letter">?</span>
                            </div>
                          )}
                        </Link>
                        <div className="fridge-card-body">
                          <h3 className="fridge-card-title">
                            {food ? (
                              <Link
                                to={`/ingredients/${encodeURIComponent(food.id)}`}
                                className="linkish"
                              >
                                {food.name}
                              </Link>
                            ) : (
                              item.foodId
                            )}
                          </h3>
                          <p className="fridge-card-qty">{item.quantity || "—"}</p>
                          {food?.food_group && (
                            <p className="fridge-card-group">{food.food_group}</p>
                          )}
                          {expLabel && (
                            <span className={`fridge-exp ${expClass}`}>{expLabel}</span>
                          )}
                          {item.notes && (
                            <p className="fridge-card-notes">{item.notes}</p>
                          )}
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm fridge-card-remove"
                            onClick={() => removeFromFridge(item.id)}
                          >
                            Remove
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            {suggestions.length > 0 && (
              <section className="card card-pad">
                <h2 className="card-title">Make with what you have</h2>
                <p className="muted text-sm mt-8">
                  Your meals scored by how many fridge ingredients they use.
                </p>
                <div className="suggest-list mt-12">
                  {suggestions.map(({ meal, have, total, pct }) => (
                    <Link key={meal.id} to={`/meals/${meal.id}`} className="suggest-row">
                      <div
                        className="suggest-bar"
                        style={{ ["--pct" as string]: `${Math.round(pct * 100)}%` }}
                      >
                        <span className="suggest-fill" />
                      </div>
                      <div className="suggest-meta">
                        <div className="name">{meal.title}</div>
                        <div className="group">
                          {have}/{total} in fridge
                          {pct >= 1 ? " · ready to cook" : pct >= 0.5 ? " · almost there" : ""}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      <aside className="rail">
        <div className="card card-pad">
          <h2 className="card-title">Your volume</h2>
          <p className="muted text-sm mt-8">
            Personalize the cover, portrait, and dedication so this feels like{" "}
            <em>your</em> cookbook — not a generic profile.
          </p>
          <button
            type="button"
            className="btn btn-primary btn-sm mt-12"
            onClick={() => setCustomizeOpen(true)}
          >
            Personalize
          </button>
          <Link to="/create" className="btn btn-secondary btn-sm mt-8">
            Create
          </Link>
          <Link
            to={`/u/${encodeURIComponent(user.handle)}`}
            className="btn btn-ghost btn-sm mt-8"
          >
            Public profile
          </Link>
        </div>
        {suggestions.length > 0 && tab !== "Fridge" && (
          <div className="card card-pad">
            <h2 className="card-title">Fridge matches</h2>
            <ul className="suggest-list mt-12">
              {suggestions.slice(0, 3).map(({ meal, have, total }) => (
                <li key={meal.id}>
                  <Link to={`/meals/${meal.id}`} className="linkish text-sm">
                    {meal.title}
                  </Link>
                  <span className="muted text-sm">
                    {" "}
                    · {have}/{total}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>

      <ProfileCustomize
        open={customizeOpen}
        profile={p}
        onClose={() => {
          setCustomizeOpen(false);
          if (searchParams.has("customize")) {
            const next = new URLSearchParams(searchParams);
            next.delete("customize");
            setSearchParams(next, { replace: true });
          }
        }}
        onSaved={onProfileSaved}
      />
    </div>
  );
}
