import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FoodThumb } from "../components/FoodThumb";
import { MacroPills } from "../components/MacroPills";
import { StarRating } from "../components/StarRating";
import { useApp } from "../context/AppContext";
import { api, ApiError, type ApiFood, type MealDto } from "../lib/api";
import type { CatalogFood } from "../types";

type Mode = "foundation" | "branded" | "meals";

function brandedToCatalog(f: ApiFood): CatalogFood {
  return {
    id: f.id,
    fdc_id: f.fdc_id ?? null,
    foodb_id: null,
    name: f.name,
    name_scientific: null,
    description: f.description || f.name,
    food_group: f.food_group || "Branded",
    food_subgroup: "Branded",
    picture: null,
    emoji: "",
    source: "USDA Branded Foods",
    macros: {
      energy_kcal: f.macros?.energy_kcal ?? null,
      protein_g: f.macros?.protein_g ?? null,
      fat_g: f.macros?.fat_g ?? null,
      carbs_g: f.macros?.carbs_g ?? null,
      fiber_g: f.macros?.fiber_g ?? null,
    },
    macros_complete: !!f.macros_complete,
    micros: [],
    other_nutrients: [],
  };
}

export function BrowsePage() {
  const { foods, catalog, catalogLoading, getRating } = useApp();
  const [mode, setMode] = useState<Mode>("foundation");
  const [q, setQ] = useState("");
  const [group, setGroup] = useState("");
  const [meals, setMeals] = useState<MealDto[]>([]);
  const [mealsLoading, setMealsLoading] = useState(false);
  const [mealsError, setMealsError] = useState<string | null>(null);

  const [branded, setBranded] = useState<ApiFood[]>([]);
  const [brandedTotal, setBrandedTotal] = useState(0);
  const [brandedPage, setBrandedPage] = useState(1);
  const [brandedLoading, setBrandedLoading] = useState(false);
  const [brandedError, setBrandedError] = useState<string | null>(null);
  const [brandedHint, setBrandedHint] = useState<string | null>(null);

  const totalFoundation = catalog?.count ?? foods.length;

  const groups = useMemo(() => {
    const set = new Set(foods.map((f) => f.food_group).filter(Boolean));
    return Array.from(set).sort();
  }, [foods]);

  const foundationHits = useMemo(() => {
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

  useEffect(() => {
    if (mode !== "branded") return;
    const query = q.trim();
    if (query.length < 2) {
      setBranded([]);
      setBrandedTotal(0);
      setBrandedHint("Type at least 2 characters to search ~400k branded products");
      setBrandedError(null);
      setBrandedLoading(false);
      return;
    }
    let cancelled = false;
    const t = setTimeout(() => {
      setBrandedLoading(true);
      setBrandedError(null);
      setBrandedHint(null);
      api
        .searchBranded({ q: query, page: brandedPage, page_size: 25 })
        .then((res) => {
          if (cancelled) return;
          setBranded(res.items);
          setBrandedTotal(res.total);
          setBrandedHint(res.message || res.note || null);
        })
        .catch((err: Error) => {
          if (cancelled) return;
          setBranded([]);
          setBrandedTotal(0);
          setBrandedError(err instanceof ApiError ? err.message : err.message);
        })
        .finally(() => {
          if (!cancelled) setBrandedLoading(false);
        });
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [mode, q, brandedPage]);

  // Reset branded page when query changes
  useEffect(() => {
    setBrandedPage(1);
  }, [q, mode]);

  const countChip =
    mode === "foundation" ? (
      <>
        <strong>{catalogLoading ? "…" : totalFoundation.toLocaleString()}</strong>
        <span>foundation</span>
      </>
    ) : mode === "branded" ? (
      <>
        <strong>~430k</strong>
        <span>branded</span>
      </>
    ) : (
      <>
        <strong>Meals</strong>
        <span>community</span>
      </>
    );

  return (
    <div className="page page--single">
      <div className="column">
        <div className="page-hero">
          <div>
            <h1>Browse</h1>
            <p className="lede">
              Foundation (lab-style) · Branded (packages, search-on-demand) · Meals
            </p>
          </div>
          <div className="catalog-count-chip" title="Catalog size">
            {countChip}
          </div>
        </div>

        <div className="seg" role="tablist">
          <button
            type="button"
            role="tab"
            className={mode === "foundation" ? "active" : undefined}
            aria-selected={mode === "foundation"}
            onClick={() => setMode("foundation")}
          >
            Foundation ({catalogLoading ? "…" : totalFoundation.toLocaleString()})
          </button>
          <button
            type="button"
            role="tab"
            className={mode === "branded" ? "active" : undefined}
            aria-selected={mode === "branded"}
            onClick={() => setMode("branded")}
          >
            Branded
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
                mode === "foundation"
                  ? "Search foundation ingredients…"
                  : mode === "branded"
                    ? "Search branded products (e.g. Cheerios, salsa)…"
                    : "Search public meals…"
              }
              autoFocus
            />
          </div>

          {mode === "foundation" && (
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

          {mode === "branded" && (
            <p className="text-sm muted mt-12">
              Searches USDA’s branded database live (~430k products). We only fetch matching pages —
              nothing is bulk-stored on our servers.
            </p>
          )}
        </section>

        {mode === "foundation" && (
          <section className="card card-pad">
            {catalogLoading ? (
              <p className="muted">Loading catalog…</p>
            ) : foundationHits.length === 0 ? (
              <div className="empty-state">
                <p className="muted">No foundation ingredients match.</p>
              </div>
            ) : (
              <div className="ing-list">
                {foundationHits.map((food) => (
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
                    <span className="badge-ok">Foundation</span>
                  </Link>
                ))}
              </div>
            )}
            <p className="text-sm muted mt-12">
              Showing {foundationHits.length}
              {q || group ? " matches" : ` of ${totalFoundation.toLocaleString()}`}
              {" · "}
              <strong>{totalFoundation.toLocaleString()}</strong> foundation ingredients
            </p>
          </section>
        )}

        {mode === "branded" && (
          <section className="card card-pad">
            {brandedLoading ? (
              <p className="muted">Searching USDA branded foods…</p>
            ) : brandedError ? (
              <div className="empty-state">
                <p className="muted">{brandedError}</p>
                <p className="text-sm muted mt-8">
                  Free API key:{" "}
                  <a href="https://api.data.gov/signup/" target="_blank" rel="noreferrer" className="linkish">
                    api.data.gov/signup
                  </a>
                  . Set <code>FDC_API_KEY</code> on the server.
                </p>
              </div>
            ) : branded.length === 0 ? (
              <div className="empty-state">
                <p className="muted">{brandedHint || "No products match."}</p>
              </div>
            ) : (
              <>
                <div className="ing-list">
                  {branded.map((item) => {
                    const food = brandedToCatalog(item);
                    return (
                      <Link
                        key={item.id}
                        to={`/branded/${item.fdc_id ?? item.id.replace("branded-", "")}`}
                        className="ing-row"
                        style={{ textDecoration: "none" }}
                      >
                        <FoodThumb food={food} />
                        <div className="ing-meta">
                          <div className="name">{item.name}</div>
                          <div className="group">
                            {item.brand_owner || item.brand_name || "Brand"}
                            {item.food_group ? ` · ${item.food_group}` : ""}
                          </div>
                          <div className="mt-8">
                            <MacroPills macros={food.macros} />
                          </div>
                        </div>
                        <span className="badge-ok">Branded</span>
                      </Link>
                    );
                  })}
                </div>
                <div className="row-end mt-16" style={{ justifyContent: "space-between", width: "100%" }}>
                  <p className="text-sm muted" style={{ margin: 0 }}>
                    Page {brandedPage}
                    {brandedTotal > 0
                      ? ` · ${brandedTotal.toLocaleString()} hits (showing ${branded.length})`
                      : ""}
                  </p>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={brandedPage <= 1 || brandedLoading}
                      onClick={() => setBrandedPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={brandedLoading || branded.length < 25}
                      onClick={() => setBrandedPage((p) => p + 1)}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </>
            )}
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
