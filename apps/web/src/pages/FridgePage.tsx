import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FoodThumb } from "../components/FoodThumb";
import { MacroPills } from "../components/MacroPills";
import { StarRating } from "../components/StarRating";
import { useApp } from "../context/AppContext";
import { getFoodById } from "../lib/catalog";
import type { FridgeLocation } from "../types";

const LOCATIONS: Array<"All" | FridgeLocation> = ["All", "Fridge", "Freezer", "Pantry", "Counter"];

export function FridgePage() {
  const navigate = useNavigate();
  const { fridge, foods, catalogLoading, catalogError, removeFromFridge, clearFridge, getRating } =
    useApp();
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState<"All" | FridgeLocation>("All");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return fridge
      .map((item) => ({ item, food: getFoodById(foods, item.foodId) }))
      .filter(({ item, food }) => {
        if (location !== "All" && item.location !== location) return false;
        if (!q) return true;
        const hay = `${food?.name ?? ""} ${food?.food_group ?? ""} ${item.notes}`.toLowerCase();
        return hay.includes(q);
      });
  }, [fridge, foods, query, location]);

  const selected = rows.find((r) => r.item.id === selectedId) ?? rows[0] ?? null;

  return (
    <div className="page">
      <div className="column">
        <div className="page-hero">
          <div>
            <h1>Fridge</h1>
            <p className="lede">Your live inventory · powered by FooDB catalog entries</p>
          </div>
          <div className="row-end">
            {fridge.length > 0 && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  if (confirm("Clear entire fridge?")) clearFridge();
                }}
              >
                Clear all
              </button>
            )}
            <Link to="/ingredients/add" className="btn btn-primary btn-sm">
              + Add ingredient
            </Link>
          </div>
        </div>

        <div className="search-field">
          <span className="ico" aria-hidden>
            ⌕
          </span>
          <input
            type="search"
            placeholder="Filter fridge by name or group…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Filter fridge"
          />
        </div>

        <div className="seg" role="tablist">
          {LOCATIONS.map((loc) => (
            <button
              key={loc}
              type="button"
              role="tab"
              className={location === loc ? "active" : undefined}
              onClick={() => setLocation(loc)}
            >
              {loc}
            </button>
          ))}
        </div>

        {catalogLoading && (
          <section className="card card-pad">
            <p className="muted">Loading FooDB catalog…</p>
          </section>
        )}
        {catalogError && (
          <section className="card card-pad">
            <p className="danger-text">Catalog error: {catalogError}</p>
            <p className="muted text-sm mt-8">
              Run <code>node scripts/build-catalog.mjs</code> from the CookBook root, then refresh.
            </p>
          </section>
        )}

        {rows.length === 0 ? (
          <section className="card card-pad empty-state">
            <div className="empty-icon" aria-hidden>
              🧊
            </div>
            <h2 className="card-title">Fridge is empty</h2>
            <p className="muted mt-8">Search ~990 FooDB foods and add them with quantity &amp; location.</p>
            <Link to="/ingredients/add" className="btn btn-primary mt-16">
              Browse catalog
            </Link>
          </section>
        ) : (
          <section className="card card-pad">
            <div className="card-head">
              <h2 className="card-title">
                {rows.length} item{rows.length === 1 ? "" : "s"}
              </h2>
            </div>
            <div className="ing-list">
              {rows.map(({ item, food }) => (
                <button
                  key={item.id}
                  type="button"
                  className={`ing-row ing-row--btn ${selected?.item.id === item.id ? "selected" : ""}`}
                  onClick={() => {
                    setSelectedId(item.id);
                    if (food) navigate(`/ingredients/${encodeURIComponent(food.id)}`);
                  }}
                >
                  {food ? <FoodThumb food={food} /> : <div className="ing-icon">?</div>}
                  <div className="ing-meta">
                    <div className="name">{food?.name ?? "Unknown food"}</div>
                    <div className="group">
                      {food?.food_group}
                      {food?.food_subgroup ? ` · ${food.food_subgroup}` : ""}
                    </div>
                  </div>
                  <div className="ing-side">
                    <strong>{item.quantity}</strong>
                    {item.location}
                    {item.expiresOn ? ` · exp ${item.expiresOn}` : ""}
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>

      <aside className="rail">
        {selected && selected.food ? (
          <div className="card">
            <FoodThumb food={selected.food} size="lg" />
            <div className="card-pad">
              <h2 className="card-title">{selected.food.name}</h2>
              <p className="muted text-sm mt-8">
                {selected.food.food_group}
                {selected.food.food_subgroup ? ` · ${selected.food.food_subgroup}` : ""}
              </p>
              <div className="mt-12">
                <MacroPills macros={selected.food.macros} />
              </div>
              <div className="mt-12">
                <StarRating
                  value={getRating("ingredient", selected.food.id)?.score ?? 0}
                  showValue
                />
              </div>
              <p className="text-sm mt-12">
                <strong>{selected.item.quantity}</strong> · {selected.item.location}
              </p>
              {selected.item.notes && <p className="muted text-sm mt-8">{selected.item.notes}</p>}
              <div className="row-end mt-16" style={{ flexDirection: "column", alignItems: "stretch" }}>
                <Link
                  to={`/ingredients/${encodeURIComponent(selected.food.id)}`}
                  className="btn btn-primary btn-block"
                >
                  Open ingredient page
                </Link>
                <button
                  type="button"
                  className="btn btn-secondary btn-block"
                  onClick={() => removeFromFridge(selected.item.id)}
                >
                  Remove from fridge
                </button>
              </div>
              <p className="field-hint mt-12">
                FooDB id {selected.food.foodb_id} · {selected.food.id}
              </p>
            </div>
          </div>
        ) : (
          <div className="card card-pad">
            <h2 className="card-title">Detail</h2>
            <p className="muted text-sm mt-8">Select an ingredient to see macros and notes.</p>
          </div>
        )}
      </aside>
    </div>
  );
}
