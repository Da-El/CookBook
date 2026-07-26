import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FoodThumb } from "../components/FoodThumb";
import { MacroPills } from "../components/MacroPills";
import { StarRating } from "../components/StarRating";
import { useApp } from "../context/AppContext";
import { api, type MealDto, type ReviewDto } from "../lib/api";
import { getFoodById } from "../lib/catalog";

const TABS = ["Cooked", "Want to cook", "Fridge", "Reviews"] as const;
type Tab = (typeof TABS)[number];

export function KitchenPage() {
  const { fridge, foods, removeFromFridge, getRating, user, ratings } = useApp();
  const [tab, setTab] = useState<Tab>("Cooked");
  const [locationFilter, setLocationFilter] = useState<string>("All");
  const [meals, setMeals] = useState<MealDto[]>([]);
  const [myReviews, setMyReviews] = useState<ReviewDto[]>([]);
  const [mealsLoading, setMealsLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      setMeals([]);
      return;
    }
    if (tab !== "Cooked" && tab !== "Want to cook") return;
    let cancelled = false;
    setMealsLoading(true);
    const status = tab === "Cooked" ? "cooked" : "want_to_cook";
    api
      .listMeals({ status, limit: 50 })
      .then((res) => {
        if (!cancelled) setMeals(res.items);
      })
      .catch(() => {
        if (!cancelled) setMeals([]);
      })
      .finally(() => {
        if (!cancelled) setMealsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, tab]);

  useEffect(() => {
    if (!user || tab !== "Reviews") return;
    let cancelled = false;
    api
      .listReviews({ mine: true, limit: 50 })
      .then((res) => {
        if (!cancelled) setMyReviews(res.items);
      })
      .catch(() => {
        if (!cancelled) setMyReviews([]);
      });
    return () => {
      cancelled = true;
    };
  }, [user, tab]);

  const fridgeRows = useMemo(() => {
    return fridge
      .map((item) => ({ item, food: getFoodById(foods, item.foodId) }))
      .filter((row) => {
        if (locationFilter === "All") return true;
        return row.item.location === locationFilter;
      });
  }, [fridge, foods, locationFilter]);

  const initials = user
    ? user.display_name
        .split(/\s+/)
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "?";

  const cookedCount = tab === "Cooked" ? meals.length : undefined;

  return (
    <div className="page">
      <div className="column">
        <div className="page-hero">
          <div>
            <h1>Your kitchen</h1>
            <p className="lede">Meals, fridge, and reviews</p>
          </div>
          <div className="row-end" style={{ gap: 8 }}>
            <Link to="/meals/new" className="btn btn-primary btn-sm">
              + Log meal
            </Link>
            <Link to="/ingredients/add" className="btn btn-secondary btn-sm">
              + Ingredient
            </Link>
          </div>
        </div>

        <section className="card profile-card">
          <div className="profile-cover" aria-hidden />
          <div className="profile-main">
            <div className="profile-top">
              <div className="avatar avatar--xl avatar--accent">
                <span>{initials}</span>
              </div>
              <Link to="/settings" className="btn btn-secondary btn-sm">
                Edit profile
              </Link>
            </div>
            {user ? (
              <>
                <h2 className="profile-name">{user.display_name}</h2>
                <p className="profile-handle">@{user.handle}</p>
                {user.bio && <p className="profile-bio">{user.bio}</p>}
                <div className="stat-row">
                  <span className="stat">
                    <strong>{cookedCount ?? "—"}</strong> cooked
                  </span>
                  <span className="stat">
                    <strong>{fridge.length}</strong> fridge
                  </span>
                  <span className="stat">
                    <Link to={`/u/${encodeURIComponent(user.handle)}`} className="linkish">
                      Public profile
                    </Link>
                  </span>
                </div>
              </>
            ) : (
              <>
                <h2 className="profile-name">Guest kitchen</h2>
                <p className="profile-handle">Sign in to sync meals &amp; follow chefs</p>
                <div className="row-end mt-12" style={{ justifyContent: "flex-start", gap: 8 }}>
                  <Link to="/login" className="btn btn-primary btn-sm">
                    Sign in
                  </Link>
                  <Link to="/signup" className="btn btn-secondary btn-sm">
                    Join
                  </Link>
                </div>
              </>
            )}
          </div>
        </section>

        <div className="seg" role="tablist">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              className={tab === t ? "active" : undefined}
              onClick={() => setTab(t)}
            >
              {t}
              {t === "Fridge" ? ` (${fridge.length})` : ""}
            </button>
          ))}
        </div>

        {(tab === "Cooked" || tab === "Want to cook") && (
          <section className="card card-pad">
            {!user ? (
              <div className="empty-state">
                <p className="muted">Sign in to log and list meals.</p>
                <Link to="/login" className="btn btn-primary btn-sm mt-12">
                  Sign in
                </Link>
              </div>
            ) : mealsLoading ? (
              <p className="muted">Loading meals…</p>
            ) : meals.length === 0 ? (
              <div className="empty-state">
                <p className="muted">
                  {tab === "Cooked" ? "No cooked meals yet." : "Nothing on your want-to-cook list."}
                </p>
                <Link to="/meals/new" className="btn btn-primary btn-sm mt-12">
                  Log a meal
                </Link>
              </div>
            ) : (
              <div className="ing-list">
                {meals.map((m) => (
                  <Link
                    key={m.id}
                    to={`/meals/${m.id}`}
                    className="ing-row"
                    style={{ textDecoration: "none" }}
                  >
                    <div className="ing-icon" aria-hidden>
                      🍽️
                    </div>
                    <div className="ing-meta">
                      <div className="name">{m.title}</div>
                      <div className="group">
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
                ))}
              </div>
            )}
          </section>
        )}

        {tab === "Fridge" && (
          <section className="card card-pad">
            <div className="card-head">
              <h2 className="card-title">Fridge</h2>
              <Link to="/ingredients" className="btn btn-ghost btn-sm">
                Full fridge page
              </Link>
            </div>

            <div className="seg mt-8" style={{ maxWidth: 200 }}>
              {["All", "Fridge"].map((loc) => (
                <button
                  key={loc}
                  type="button"
                  className={locationFilter === loc ? "active" : undefined}
                  onClick={() => setLocationFilter(loc)}
                >
                  {loc}
                </button>
              ))}
            </div>

            {fridgeRows.length === 0 ? (
              <div className="empty-state mt-16">
                <p className="muted">No ingredients here yet.</p>
                <Link to="/ingredients/add" className="btn btn-primary btn-sm mt-12">
                  Add from catalog
                </Link>
              </div>
            ) : (
              <div className="ing-list mt-12">
                {fridgeRows.map(({ item, food }) => (
                  <div key={item.id} className="ing-row">
                    {food ? (
                      <Link to={`/ingredients/${encodeURIComponent(food.id)}`}>
                        <FoodThumb food={food} />
                      </Link>
                    ) : (
                      <div className="ing-icon">?</div>
                    )}
                    <div className="ing-meta">
                      {food ? (
                        <Link to={`/ingredients/${encodeURIComponent(food.id)}`} className="name linkish">
                          {food.name}
                        </Link>
                      ) : (
                        <div className="name">Unknown food</div>
                      )}
                      <div className="group">
                        {food ? `${food.food_group} · ${food.food_subgroup || "—"}` : item.foodId}
                      </div>
                      {food && (
                        <div className="mt-8">
                          <MacroPills macros={food.macros} />
                          <div className="mt-8">
                            <StarRating value={getRating("ingredient", food.id)?.score ?? 0} showValue />
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="ing-side">
                      <strong>{item.quantity}</strong>
                      {item.location}
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm mt-8"
                        onClick={() => removeFromFridge(item.id)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {tab === "Reviews" && (
          <section className="card card-pad">
            {!user ? (
              <div className="empty-state">
                <p className="muted">Sign in to sync reviews to the server.</p>
              </div>
            ) : myReviews.length === 0 ? (
              <div className="empty-state">
                <p className="muted">No server reviews yet. Rate a public meal or keep local ingredient stars.</p>
                <ul className="ing-list mt-12">
                  {ratings
                    .filter((r) => r.score > 0)
                    .slice(0, 20)
                    .map((r) => (
                      <div key={`${r.subjectType}-${r.subjectId}`} className="ing-row">
                        <div className="ing-meta">
                          <div className="name">
                            {r.subjectType} · {r.subjectId.slice(0, 24)}
                          </div>
                          <StarRating value={r.score} showValue />
                        </div>
                      </div>
                    ))}
                </ul>
              </div>
            ) : (
              <div className="ing-list">
                {myReviews.map((r) => (
                  <Link
                    key={r.id}
                    to={
                      r.subject_type === "meal"
                        ? `/meals/${r.subject_id}`
                        : `/ingredients/${encodeURIComponent(r.subject_id)}`
                    }
                    className="ing-row"
                    style={{ textDecoration: "none" }}
                  >
                    <div className="ing-meta">
                      <div className="name">
                        {r.subject_type === "meal" ? "Meal" : "Ingredient"} review
                      </div>
                      <div className="group">
                        <StarRating value={r.score} showValue />
                        {r.notes ? ` · ${r.notes}` : ""}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      <aside className="rail">
        <div className="card card-pad">
          <h2 className="card-title">This kitchen</h2>
          <div className="nutrient-grid mt-12" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div className="nutrient">
              <div className="val">{fridge.length}</div>
              <div className="lbl">Fridge</div>
            </div>
            <div className="nutrient">
              <div className="val">{meals.length}</div>
              <div className="lbl">Listed meals</div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
