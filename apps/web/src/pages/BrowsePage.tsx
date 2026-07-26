import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FoodThumb } from "../components/FoodThumb";
import { MacroPills } from "../components/MacroPills";
import { StarRating } from "../components/StarRating";
import { useApp } from "../context/AppContext";
import { api, type MealDto } from "../lib/api";

type Mode = "meals" | "ingredients";

export function BrowsePage() {
  const { foods, catalogLoading, getRating } = useApp();
  const [mode, setMode] = useState<Mode>("ingredients");
  const [q, setQ] = useState("");
  const [group, setGroup] = useState("");
  const [meals, setMeals] = useState<MealDto[]>([]);
  const [mealsLoading, setMealsLoading] = useState(false);
  const [mealsError, setMealsError] = useState<string | null>(null);

  const groups = useMemo(() => {
    const set = new Set(foods.map((f) => f.food_group).filter(Boolean));
    return Array.from(set).sort();
  }, [foods]);

  const ingredientHits = useMemo(() => {
    const query = q.trim().toLowerCase();
    return foods
      .filter((f) => {
        if (group && f.food_group !== group) return false;
        if (!query) return true;
        return (
          f.name.toLowerCase().includes(query) ||
          f.food_group.toLowerCase().includes(query) ||
          (f.food_subgroup || "").toLowerCase().includes(query) ||
          (f.description || "").toLowerCase().includes(query)
        );
      })
      .slice(0, 60);
  }, [foods, q, group]);

  useEffect(() => {
    if (mode !== "meals") return;
    let cancelled = false;
    const t = setTimeout(() => {
      setMealsLoading(true);
      setMealsError(null);
      api
        .searchMeals({ q: q.trim() || undefined, limit: 40 })
        .then((res) => {
          if (!cancelled) setMeals(res.items);
        })
        .catch((err: Error) => {
          if (!cancelled) {
            setMeals([]);
            setMealsError(err.message || "Could not search meals");
          }
        })
        .finally(() => {
          if (!cancelled) setMealsLoading(false);
        });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [mode, q]);

  return (
    <div className="page page--single">
      <div className="column">
        <div className="page-hero">
          <div>
            <h1>Browse</h1>
            <p className="lede">Search public meals and catalog ingredients</p>
          </div>
        </div>

        <div className="seg" role="tablist">
          <button
            type="button"
            role="tab"
            className={mode === "ingredients" ? "active" : undefined}
            aria-selected={mode === "ingredients"}
            onClick={() => setMode("ingredients")}
          >
            Ingredients
          </button>
          <button
            type="button"
            role="tab"
            className={mode === "meals" ? "active" : undefined}
            aria-selected={mode === "meals"}
            onClick={() => setMode("meals")}
          >
            Meals
          </button>
        </div>

        <section className="card card-pad">
          <div className="field">
            <label htmlFor="browse-q" className="sr-only">
              Search
            </label>
            <input
              id="browse-q"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={
                mode === "ingredients" ? "Search ingredients…" : "Search public meals…"
              }
              autoFocus
            />
          </div>

          {mode === "ingredients" && (
            <div className="chip-row mt-12">
              <button
                type="button"
                className={`chip ${!group ? "chip--on" : ""}`}
                onClick={() => setGroup("")}
              >
                All groups
              </button>
              {groups.slice(0, 12).map((g) => (
                <button
                  key={g}
                  type="button"
                  className={`chip ${group === g ? "chip--on" : ""}`}
                  onClick={() => setGroup(g === group ? "" : g)}
                >
                  {g}
                </button>
              ))}
            </div>
          )}
        </section>

        {mode === "ingredients" && (
          <section className="card card-pad">
            {catalogLoading ? (
              <p className="muted">Loading catalog…</p>
            ) : ingredientHits.length === 0 ? (
              <div className="empty-state">
                <p className="muted">No ingredients match.</p>
              </div>
            ) : (
              <div className="ing-list">
                {ingredientHits.map((food) => (
                  <Link
                    key={food.id}
                    to={`/ingredients/${encodeURIComponent(food.id)}`}
                    className="ing-row"
                    style={{ textDecoration: "none" }}
                  >
                    <FoodThumb food={food} />
                    <div className="ing-meta">
                      <div className="name">{food.name}</div>
                      <div className="group">
                        {food.food_group}
                        {food.food_subgroup ? ` · ${food.food_subgroup}` : ""}
                      </div>
                      <div className="mt-8">
                        <MacroPills macros={food.macros} />
                      </div>
                      <div className="mt-8">
                        <StarRating value={getRating("ingredient", food.id)?.score ?? 0} showValue />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
            <p className="text-sm muted mt-12">
              Showing {ingredientHits.length}
              {q || group ? " matches" : ` of ${foods.length}`}
            </p>
          </section>
        )}

        {mode === "meals" && (
          <section className="card card-pad">
            {mealsLoading ? (
              <p className="muted">Searching meals…</p>
            ) : mealsError ? (
              <p className="muted">{mealsError}</p>
            ) : meals.length === 0 ? (
              <div className="empty-state">
                <p className="muted">
                  {q.trim()
                    ? "No public meals match that search."
                    : "No public meals yet — create one and set visibility to public."}
                </p>
                <Link to="/create/meal" className="btn btn-primary btn-sm mt-12">
                  Create a meal
                </Link>
              </div>
            ) : (
              <div className="meal-grid">
                {meals.map((m) => (
                  <Link key={m.id} to={`/meals/${m.id}`} className="meal-card">
                    <div className="meal-card-media">
                      <span className="meal-card-glyph" aria-hidden />
                    </div>
                    <div className="meal-card-body">
                      <h3 className="meal-card-title">{m.title}</h3>
                      <p className="meal-card-meta">
                        @{m.author.handle}
                        {m.cuisine ? ` · ${m.cuisine}` : ""}
                        {m.time_minutes ? ` · ${m.time_minutes} min` : ""}
                      </p>
                      {m.author_rating != null && (
                        <div className="mt-8">
                          <StarRating value={m.author_rating} showValue />
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
