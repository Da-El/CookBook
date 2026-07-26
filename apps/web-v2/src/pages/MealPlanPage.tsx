import { useEffect, useState } from "react";
import { v2, type MealPlan, type Recipe } from "../lib/api";

export function MealPlanPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [plan, setPlan] = useState<MealPlan | null>(null);
  const [title, setTitle] = useState("This week");
  const [start, setStart] = useState(() => new Date().toISOString().slice(0, 10));
  const [smart, setSmart] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    v2.listRecipes()
      .then((r) => setRecipes(r.items))
      .catch((e) => setError(e.message));
  }, []);

  async function create() {
    setError(null);
    try {
      const p = await v2.createPlan({
        title,
        start_date: start,
        days: 7,
        recipe_ids: recipes.map((r) => r.id),
        smart_reuse: smart,
      });
      setPlan(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <div>
      <h1>Meal planning</h1>
      <p className="lede">
        Build a week plan from your V2 recipes. Smart reuse is a flag for the future LLM planner.
      </p>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="field">
          <label>Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="field">
          <label>Start date</label>
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <label className="row" style={{ marginBottom: 12 }}>
          <input type="checkbox" checked={smart} onChange={(e) => setSmart(e.target.checked)} />
          Smart ingredient reuse (LLM later)
        </label>
        <button type="button" className="btn btn-primary" onClick={create}>
          Create plan (stub)
        </button>
        {error && <p className="error">{error}</p>}
      </div>

      {plan && (
        <div className="card" style={{ marginTop: 16 }}>
          <h2>{plan.title}</h2>
          {plan.reuse_notes.map((n) => (
            <p key={n} className="muted" style={{ marginTop: 6 }}>
              {n}
            </p>
          ))}
          <div className="grid" style={{ marginTop: 14 }}>
            {plan.days.map((d) => (
              <div key={d.date} style={{ borderTop: "1px solid var(--border)", paddingTop: 10 }}>
                <strong>{d.date}</strong>
                {d.slots.map((s) => (
                  <div key={s.id} className="muted" style={{ marginTop: 4 }}>
                    {s.meal_type}: {s.recipe_title || "—"} {s.notes ? `· ${s.notes}` : ""}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
