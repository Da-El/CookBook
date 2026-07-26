import { useEffect, useState } from "react";
import { v2, type GroceryList, type Recipe } from "../lib/api";

export function GroceryPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [list, setList] = useState<GroceryList | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    v2.listRecipes()
      .then((r) => {
        setRecipes(r.items);
        setSelected(new Set(r.items.map((x) => x.id)));
      })
      .catch((e) => setError(e.message));
  }, []);

  function toggle(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function build() {
    setError(null);
    try {
      const g = await v2.buildGrocery([...selected], "Weekly groceries");
      setList(g);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <div>
      <h1>Grocery list</h1>
      <p className="lede">Pick recipes → merge ingredients. LLM will normalize units later.</p>

      <div className="card" style={{ marginTop: 16 }}>
        <h2>From recipes</h2>
        {recipes.map((r) => (
          <label key={r.id} className="check-item">
            <input
              type="checkbox"
              checked={selected.has(r.id)}
              onChange={() => toggle(r.id)}
            />
            <span>{r.title}</span>
          </label>
        ))}
        <button type="button" className="btn btn-primary" style={{ marginTop: 12 }} onClick={build}>
          Build list
        </button>
        {error && <p className="error">{error}</p>}
      </div>

      {list && (
        <div className="card" style={{ marginTop: 16 }}>
          <h2>{list.title}</h2>
          {list.items.map((it) => (
            <div key={it.id} className="check-item">
              <input type="checkbox" defaultChecked={it.checked} readOnly />
              <div>
                <strong>
                  {it.quantity != null ? `${it.quantity} ` : ""}
                  {it.unit ? `${it.unit} ` : ""}
                  {it.name}
                </strong>
                {it.aisle && <div className="muted">{it.aisle}</div>}
                {it.from_recipes.length > 0 && (
                  <div className="muted">from {it.from_recipes.join(", ")}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
