import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { v2, type Recipe } from "../lib/api";

export function RecipeDetailPage() {
  const { id = "" } = useParams();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    v2.getRecipe(id)
      .then(setRecipe)
      .catch((e) => setError(e.message));
  }, [id]);

  if (error) return <p className="error">{error}</p>;
  if (!recipe) return <p className="muted">Loading…</p>;

  return (
    <div>
      <p className="muted">
        <Link to="/recipes">← Recipes</Link>
      </p>
      <h1 style={{ marginTop: 8 }}>{recipe.title}</h1>
      <p className="lede">{recipe.summary}</p>
      <div className="chips">
        {recipe.servings != null && <span className="chip">{recipe.servings} servings</span>}
        {recipe.prep_minutes != null && <span className="chip">{recipe.prep_minutes}m prep</span>}
        {recipe.cook_minutes != null && <span className="chip">{recipe.cook_minutes}m cook</span>}
        <span className="chip">{recipe.difficulty}</span>
      </div>

      <div className="row" style={{ marginTop: 16 }}>
        <Link className="btn btn-primary" to={`/recipes/${recipe.id}/cook`}>
          Start cooking
        </Link>
        <Link className="btn btn-secondary" to="/grocery">
          Grocery from recipes
        </Link>
      </div>

      <section className="card" style={{ marginTop: 20 }}>
        <h2>Ingredients</h2>
        <ul style={{ marginTop: 10 }}>
          {recipe.ingredients.map((i) => (
            <li key={i.id} style={{ marginBottom: 6 }}>
              {i.quantity != null ? `${i.quantity} ` : ""}
              {i.unit ? `${i.unit} ` : ""}
              <strong>{i.name}</strong>
              {i.notes ? ` — ${i.notes}` : ""}
            </li>
          ))}
        </ul>
      </section>

      <section style={{ marginTop: 20 }}>
        <h2>Steps</h2>
        <ol className="steps" style={{ marginTop: 12 }}>
          {recipe.steps.map((s) => (
            <li key={s.id}>
              <div>{s.instruction}</div>
              {s.beginner_note && (
                <p className="muted" style={{ marginTop: 6 }}>
                  Tip: {s.beginner_note}
                </p>
              )}
              {s.timer_seconds != null && (
                <span className="chip" style={{ marginTop: 8, display: "inline-block" }}>
                  Timer {Math.round(s.timer_seconds / 60)} min
                </span>
              )}
            </li>
          ))}
        </ol>
      </section>

      {recipe.beginner_tips.length > 0 && (
        <section className="card" style={{ marginTop: 20 }}>
          <h2>Beginner tips</h2>
          <ul style={{ marginTop: 8, paddingLeft: 18 }}>
            {recipe.beginner_tips.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </section>
      )}

      {recipe.estimated_cost && (
        <section className="card" style={{ marginTop: 16 }}>
          <h2>Rough cost</h2>
          <p style={{ marginTop: 8 }}>
            {recipe.estimated_cost.currency} {recipe.estimated_cost.low} –{" "}
            {recipe.estimated_cost.high}
            {recipe.estimated_cost.is_estimate ? " (estimate)" : ""}
          </p>
          <p className="muted">{recipe.estimated_cost.notes}</p>
        </section>
      )}
    </div>
  );
}
