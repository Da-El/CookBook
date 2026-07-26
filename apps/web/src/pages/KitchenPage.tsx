import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FoodThumb } from "../components/FoodThumb";
import { MacroPills } from "../components/MacroPills";
import { StarRating } from "../components/StarRating";
import { useApp } from "../context/AppContext";
import { getFoodById } from "../lib/catalog";

const TABS = ["Cooked", "Want to cook", "Fridge", "Reviews"] as const;
type Tab = (typeof TABS)[number];

export function KitchenPage() {
  const { fridge, foods, removeFromFridge, getRating } = useApp();
  const [tab, setTab] = useState<Tab>("Fridge");
  const [locationFilter, setLocationFilter] = useState<string>("All");

  const fridgeRows = useMemo(() => {
    return fridge
      .map((item) => ({ item, food: getFoodById(foods, item.foodId) }))
      .filter((row) => {
        if (!row.food) return true;
        if (locationFilter === "All") return true;
        return row.item.location === locationFilter;
      });
  }, [fridge, foods, locationFilter]);

  return (
    <div className="page">
      <div className="column">
        <div className="page-hero">
          <div>
            <h1>Your kitchen</h1>
            <p className="lede">Profile, meals (soon), and a live fridge from FooDB</p>
          </div>
          <Link to="/ingredients/add" className="btn btn-primary btn-sm">
            + Add ingredient
          </Link>
        </div>

        <section className="card profile-card">
          <div className="profile-cover" aria-hidden />
          <div className="profile-main">
            <div className="profile-top">
              <div className="avatar avatar--xl avatar--accent">
                <span>AJ</span>
              </div>
              <Link to="/settings" className="btn btn-secondary btn-sm">
                Edit profile
              </Link>
            </div>
            <h2 className="profile-name">Alex Jordan</h2>
            <p className="profile-handle">@chef_alex · Home kitchen</p>
            <p className="profile-bio">
              Weeknight cook building Grok Cookbook. Fridge is live; meals &amp; social features land next.
            </p>
            <div className="stat-row">
              <span className="stat">
                <strong>0</strong> cooked
              </span>
              <span className="stat">
                <strong>0</strong> want to cook
              </span>
              <span className="stat">
                <strong>{fridge.length}</strong> fridge
              </span>
            </div>
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

        {tab === "Fridge" && (
          <section className="card card-pad">
            <div className="card-head">
              <h2 className="card-title">Fridge</h2>
              <Link to="/ingredients" className="btn btn-ghost btn-sm">
                Full fridge page
              </Link>
            </div>

            <div className="seg mt-8" style={{ maxWidth: 420 }}>
              {["All", "Fridge", "Freezer", "Pantry", "Counter"].map((loc) => (
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

        {tab === "Cooked" && (
          <section className="card card-pad empty-state">
            <p className="muted">Meal logging ships in the next feature slice.</p>
            <Link to="/meals/new" className="btn btn-secondary btn-sm mt-12">
              Preview log meal
            </Link>
          </section>
        )}

        {tab === "Want to cook" && (
          <section className="card card-pad empty-state">
            <p className="muted">Want-to-cook list will appear when meals are live.</p>
          </section>
        )}

        {tab === "Reviews" && (
          <section className="card card-pad empty-state">
            <p className="muted">Ingredient reviews you leave when adding to the fridge show on those items.</p>
            <ul className="ing-list mt-12">
              {foods
                .map((f) => ({ food: f, rating: getRating("ingredient", f.id) }))
                .filter((r) => r.rating && r.rating.score > 0)
                .slice(0, 40)
                .map(({ food, rating }) => (
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
                        <StarRating value={rating!.score} showValue />
                        {rating!.notes ? ` · ${rating!.notes}` : ""}
                      </div>
                    </div>
                  </Link>
                ))}
            </ul>
            {foods.every((f) => !getRating("ingredient", f.id)?.score) && (
              <p className="muted text-sm mt-8">No reviews yet — open an ingredient and rate it /10.</p>
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
              <div className="lbl">Items</div>
            </div>
            <div className="nutrient">
              <div className="val">{new Set(fridge.map((f) => f.location)).size}</div>
              <div className="lbl">Locations</div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
