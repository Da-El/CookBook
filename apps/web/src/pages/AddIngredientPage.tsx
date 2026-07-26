import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FoodThumb } from "../components/FoodThumb";
import { MacroPills } from "../components/MacroPills";
import { StarRating } from "../components/StarRating";
import { useApp } from "../context/AppContext";
import { searchFoods, uniqueGroups } from "../lib/catalog";
import type { CatalogFood, FridgeLocation } from "../types";

export function AddIngredientPage() {
  const navigate = useNavigate();
  const { foods, catalogLoading, catalogError, catalog, addToFridge, setRating: saveSubjectRating } =
    useApp();

  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("All");
  const [selected, setSelected] = useState<CatalogFood | null>(null);

  const [quantity, setQuantity] = useState("1");
  const [location, setLocation] = useState<FridgeLocation>("Fridge");
  const [boughtOn, setBoughtOn] = useState("");
  const [expiresOn, setExpiresOn] = useState("");
  const [rating, setRatingLocal] = useState(0);
  const [notes, setNotes] = useState("");
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const groups = useMemo(() => ["All", ...uniqueGroups(foods)], [foods]);

  const results = useMemo(
    () => searchFoods(foods, query, group === "All" ? undefined : group, 50),
    [foods, query, group],
  );

  // Auto-select first result when searching if nothing selected / selection not in results
  const active = useMemo(() => {
    if (selected && results.some((r) => r.id === selected.id)) return selected;
    return results[0] ?? selected;
  }, [selected, results]);

  function handleAdd(andAnother: boolean) {
    if (!active) return;
    addToFridge({
      foodId: active.id,
      quantity,
      location,
      boughtOn: boughtOn || null,
      expiresOn: expiresOn || null,
      rating: rating || null,
      notes,
    });
    if (rating > 0) {
      saveSubjectRating("ingredient", active.id, rating, notes);
    }
    setSavedMsg(`Added ${active.name} to ${location}.`);
    if (andAnother) {
      setQuantity("1");
      setNotes("");
      setRatingLocal(0);
      setQuery("");
      setSelected(null);
      return;
    }
    navigate(`/ingredients/${encodeURIComponent(active.id)}`);
  }

  return (
    <div className="page">
      <div className="column">
        <div className="page-hero">
          <div>
            <h1>Add to fridge</h1>
            <p className="lede">Search FooDB · set quantity · optional review</p>
          </div>
          <div className="row-end">
            <Link to="/ingredients" className="btn btn-ghost btn-sm">
              Cancel
            </Link>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={!active}
              onClick={() => handleAdd(false)}
            >
              Add to fridge
            </button>
          </div>
        </div>

        {savedMsg && (
          <div className="card card-pad" style={{ borderColor: "var(--success)" }}>
            <p>
              {savedMsg}{" "}
              <Link to="/ingredients" className="btn btn-soft btn-sm">
                View fridge
              </Link>
            </p>
          </div>
        )}

        <section className="card card-pad">
          <div className="field">
            <label htmlFor="search">Search catalog</label>
            <input
              id="search"
              type="search"
              placeholder="Name, group, scientific name…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelected(null);
              }}
              autoFocus
            />
            <p className="field-hint">
              {catalogLoading
                ? "Loading FooDB…"
                : catalogError
                  ? catalogError
                  : `${catalog?.count ?? foods.length} foods · ${catalog?.source ?? "FooDB"}`}
            </p>
          </div>

          <div className="field">
            <label htmlFor="group">Food group</label>
            <select id="group" value={group} onChange={(e) => setGroup(e.target.value)}>
              {groups.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          <div className="search-results" role="listbox" aria-label="Search results">
            {catalogLoading && <div className="search-result">Loading catalog…</div>}
            {!catalogLoading && results.length === 0 && (
              <div className="search-result">No matches. Try another name or group.</div>
            )}
            {results.map((food) => (
              <div
                key={food.id}
                role="option"
                aria-selected={active?.id === food.id}
                className={`search-result search-result--row ${active?.id === food.id ? "selected" : ""}`}
              >
                <button
                  type="button"
                  className="search-result--btn"
                  onClick={() => setSelected(food)}
                >
                  <FoodThumb food={food} />
                  <div className="ing-meta">
                    <div className="name">{food.name}</div>
                    <div className="group">
                      {food.food_group}
                      {food.food_subgroup ? ` · ${food.food_subgroup}` : ""}
                    </div>
                  </div>
                  {food.macros_complete ? (
                    <span className="badge-ok">Macros</span>
                  ) : (
                    <span className="tag">FooDB</span>
                  )}
                </button>
                <Link
                  to={`/ingredients/${encodeURIComponent(food.id)}`}
                  className="btn btn-ghost btn-sm"
                  title="Open full page"
                >
                  Open
                </Link>
              </div>
            ))}
          </div>
        </section>

        {active && (
          <>
            <section className="card">
              <FoodThumb food={active} size="lg" />
              <div className="plate-body">
                <span className="plate-badge plate-badge--inline">From FooDB</span>
                <h3>{active.name}</h3>
                {active.name_scientific && (
                  <p className="plate-meta" style={{ fontStyle: "italic" }}>
                    {active.name_scientific}
                  </p>
                )}
                <p className="plate-meta">
                  {active.food_group}
                  {active.food_subgroup ? ` · ${active.food_subgroup}` : ""}
                </p>
                {active.description && (
                  <p className="text-sm muted mt-8 desc-clamp">{active.description}</p>
                )}
                <div className="mt-12">
                  <MacroPills macros={active.macros} />
                </div>
                <p className="field-hint mt-12">
                  Per 100g when available · catalog id {active.id}
                </p>
              </div>
            </section>

            <section className="card card-pad">
              <h2 className="card-title">In your kitchen</h2>
              <div className="field-row mt-12">
                <div className="field">
                  <label htmlFor="qty">Quantity</label>
                  <input
                    id="qty"
                    type="text"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="1 head, 200g…"
                  />
                </div>
                <div className="field">
                  <label htmlFor="loc">Location</label>
                  <select
                    id="loc"
                    value={location}
                    onChange={(e) => setLocation(e.target.value as FridgeLocation)}
                  >
                    <option>Fridge</option>
                    <option>Freezer</option>
                    <option>Pantry</option>
                    <option>Counter</option>
                  </select>
                </div>
              </div>
              <div className="field-row">
                <div className="field">
                  <label htmlFor="bought">Bought on</label>
                  <input
                    id="bought"
                    type="date"
                    value={boughtOn}
                    onChange={(e) => setBoughtOn(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="exp">Expires</label>
                  <input
                    id="exp"
                    type="date"
                    value={expiresOn}
                    onChange={(e) => setExpiresOn(e.target.value)}
                  />
                </div>
              </div>

              <p className="section-label">Optional review (out of 10)</p>
              <div className="field">
                <label>Quality rating</label>
                <StarRating value={rating} onChange={setRatingLocal} size="lg" />
              </div>
              {active && (
                <Link to={`/ingredients/${encodeURIComponent(active.id)}`} className="btn btn-soft btn-sm">
                  View full ingredient page
                </Link>
              )}
              <div className="field">
                <label htmlFor="notes">Notes</label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Freshness, brand, value…"
                />
              </div>

              <div className="row-end mt-16">
                <button type="button" className="btn btn-secondary" onClick={() => handleAdd(true)} disabled={!active}>
                  Save &amp; add another
                </button>
                <button type="button" className="btn btn-primary" onClick={() => handleAdd(false)} disabled={!active}>
                  Add to fridge
                </button>
              </div>
            </section>
          </>
        )}
      </div>

      <aside className="rail">
        <div className="card card-pad">
          <h2 className="card-title">Why FooDB?</h2>
          <p className="muted text-sm mt-8">
            Name, description, group, subgroup, picture, and macronutrients when present in the dump. Full compound
            graph stays offline for later enrichment.
          </p>
        </div>
        <div className="card card-pad">
          <h2 className="card-title">Tips</h2>
          <ul className="muted text-sm mt-8 tip-list">
            <li>Filter by group to narrow results</li>
            <li>Use grams in quantity when you want macros later</li>
            <li>Fridge data is stored only in this browser</li>
          </ul>
        </div>
      </aside>
    </div>
  );
}
