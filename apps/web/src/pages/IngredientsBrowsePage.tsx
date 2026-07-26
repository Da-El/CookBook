import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FoodThumb } from "../components/FoodThumb";
import { MacroPills } from "../components/MacroPills";
import { useApp } from "../context/AppContext";
import { searchFoods, uniqueGroups } from "../lib/catalog";

export function IngredientsBrowsePage() {
  const { foods, catalogLoading, catalogError, catalog } = useApp();
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("All");

  const groups = useMemo(() => ["All", ...uniqueGroups(foods)], [foods]);
  const results = useMemo(
    () => searchFoods(foods, query, group === "All" ? undefined : group, 9999),
    [foods, query, group],
  );

  return (
    <div className="page page--single">
      <div className="column">
        <div className="page-hero">
          <div>
            <h1>All ingredients</h1>
            <p className="lede">
              {catalogLoading
                ? "Loading…"
                : `${results.length} of ${catalog?.count ?? foods.length} FooDB foods · each has its own page`}
            </p>
          </div>
          <Link to="/ingredients/add" className="btn btn-primary btn-sm">
            Add to fridge
          </Link>
        </div>

        <div className="search-field">
          <span className="ico" aria-hidden>
            ⌕
          </span>
          <input
            type="search"
            placeholder="Search all ingredients…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="g">Group</label>
          <select id="g" value={group} onChange={(e) => setGroup(e.target.value)}>
            {groups.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>

        {catalogError && (
          <section className="card card-pad">
            <p className="danger-text">{catalogError}</p>
          </section>
        )}

        <section className="card card-pad">
          <div className="ing-list">
            {results.map((food) => {
              const incomplete =
                !food.macros_complete || !(food.micros || []).length || !food.description;
              return (
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
                      {incomplete ? " · incomplete data" : " · complete"}
                    </div>
                    <div className="mt-8">
                      <MacroPills macros={food.macros} />
                    </div>
                  </div>
                  <div className="ing-side">
                    <strong>Open</strong>
                    page
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
