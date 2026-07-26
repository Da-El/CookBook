import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FoodThumb } from "../components/FoodThumb";
import { MacroPills } from "../components/MacroPills";
import { PhotoPicker } from "../components/PhotoPicker";
import { StarRating } from "../components/StarRating";
import { useApp } from "../context/AppContext";
import { searchFoods, uniqueGroups } from "../lib/catalog";
import type { CatalogFood } from "../types";

export function AddIngredientPage() {
  const navigate = useNavigate();
  const { foods, catalogLoading, catalogError, catalog, addToFridge, setRating: saveSubjectRating } =
    useApp();

  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("All");
  const [selected, setSelected] = useState<CatalogFood | null>(null);

  const [quantity, setQuantity] = useState("1");
  const [boughtOn, setBoughtOn] = useState("");
  const [expiresOn, setExpiresOn] = useState("");
  const [rating, setRatingLocal] = useState(0);
  const [notes, setNotes] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const groups = useMemo(() => ["All", ...uniqueGroups(foods)], [foods]);

  const results = useMemo(
    () => searchFoods(foods, query, group === "All" ? undefined : group, 50),
    [foods, query, group],
  );

  const active = useMemo(() => {
    if (selected && results.some((r) => r.id === selected.id)) return selected;
    return results[0] ?? selected;
  }, [selected, results]);

  async function handleAdd(andAnother: boolean) {
    if (!active) return;
    setBusy(true);
    try {
      await addToFridge({
        foodId: active.id,
        quantity,
        boughtOn: boughtOn || null,
        expiresOn: expiresOn || null,
        rating: rating || null,
        notes,
        photoUrl: photo,
      });
      if (rating > 0) {
        saveSubjectRating("ingredient", active.id, rating, notes);
      }
      setSavedMsg(`Added ${active.name} to your fridge.`);
      if (andAnother) {
        setQuantity("1");
        setNotes("");
        setRatingLocal(0);
        setPhoto(null);
        setQuery("");
        setSelected(null);
        setBoughtOn("");
        setExpiresOn("");
        return;
      }
      navigate("/cookbook");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <div className="column">
        <div className="page-hero">
          <div>
            <h1>Add ingredient</h1>
            <p className="lede">Pick from the catalog · photo · quantity · dates</p>
          </div>
          <div className="row-end">
            <Link to="/create" className="btn btn-ghost btn-sm">
              Cancel
            </Link>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={!active || busy}
              onClick={() => handleAdd(false)}
            >
              {busy ? "Saving…" : "Add to fridge"}
            </button>
          </div>
        </div>

        {savedMsg && (
          <div className="card card-pad" style={{ borderColor: "var(--success)" }}>
            <p>
              {savedMsg}{" "}
              <Link to="/cookbook" className="btn btn-soft btn-sm">
                Open CookBook
              </Link>
            </p>
          </div>
        )}

        <section className="card card-pad">
          <PhotoPicker
            value={photo}
            onChange={setPhoto}
            label="Your photo (optional)"
            hint="Snap the package or produce · overrides catalog image in your fridge"
            large
          />
        </section>

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
                ? "Loading catalog…"
                : catalogError
                  ? catalogError
                  : `${catalog?.count ?? foods.length} foods`}
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
                    <span className="tag">Catalog</span>
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
                <span className="plate-badge plate-badge--inline">From catalog</span>
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
                <div className="mt-12">
                  <MacroPills macros={active.macros} />
                </div>
              </div>
            </section>

            <section className="card card-pad">
              <h2 className="card-title">In your fridge</h2>
              <div className="field mt-12">
                <label htmlFor="qty">Quantity</label>
                <input
                  id="qty"
                  type="text"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="1 head, 200g…"
                />
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
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => handleAdd(true)}
                  disabled={!active || busy}
                >
                  Save &amp; add another
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => handleAdd(false)}
                  disabled={!active || busy}
                >
                  {busy ? "Saving…" : "Add to fridge"}
                </button>
              </div>
            </section>
          </>
        )}
      </div>

      <aside className="rail">
        <div className="card card-pad">
          <h2 className="card-title">Tips</h2>
          <ul className="muted text-sm mt-8 tip-list">
            <li>Add a photo so your fridge is easy to scan</li>
            <li>Use grams in quantity for meal macros later</li>
            <li>Everything goes into one fridge list</li>
          </ul>
        </div>
      </aside>
    </div>
  );
}
