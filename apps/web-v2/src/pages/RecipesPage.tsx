import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { v2, type Recipe } from "../lib/api";

export function RecipesPage() {
  const [items, setItems] = useState<Recipe[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    v2.listRecipes()
      .then((r) => setItems(r.items))
      .catch((e) => setError(e.message));
  }, []);

  async function addDemo() {
    const r = await v2.createRecipe(`Quick idea ${items.length + 1}`);
    setItems((prev) => [r, ...prev]);
  }

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <h1>Your recipes</h1>
          <p className="lede">In-memory V2 store (resets when API restarts).</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={addDemo}>
          + Stub recipe
        </button>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="grid grid-2">
        {items.map((r) => (
          <Link key={r.id} to={`/recipes/${r.id}`} className="card">
            <h3>{r.title}</h3>
            <p className="muted" style={{ marginTop: 6 }}>
              {r.summary}
            </p>
            <div className="chips">
              {r.cuisine_tags.map((t) => (
                <span key={t} className="chip">
                  {t}
                </span>
              ))}
              {r.estimated_cost && (
                <span className="chip green">
                  ~{r.estimated_cost.currency} {r.estimated_cost.low}–{r.estimated_cost.high}
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
