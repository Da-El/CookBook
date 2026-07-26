import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { StarRating } from "../components/StarRating";
import { useApp } from "../context/AppContext";

/**
 * Meal detail shell — full meals CRUD lands next.
 * Rating system (10 stars) is live so UX matches ingredient pages.
 */
export function MealDetailPage() {
  const { mealId = "" } = useParams();
  const navigate = useNavigate();
  const { getRating, setRating } = useApp();
  const rating = getRating("meal", mealId);
  const [notes, setNotes] = useState(rating?.notes ?? "");

  return (
    <div className="page page--single">
      <div className="column">
        <div className="page-hero">
          <div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>
              ← Back
            </button>
            <h1 className="mt-8">Meal</h1>
            <p className="lede">id {mealId || "—"}</p>
          </div>
        </div>

        <section className="card card-pad">
          <div className="plate-media var-2" style={{ borderRadius: "var(--radius-sm)", marginBottom: 16 }}>
            <span className="plate-emoji" aria-hidden>
              🍽️
            </span>
          </div>
          <h2 className="card-title">Meal details coming soon</h2>
          <p className="muted text-sm mt-8">
            When meal logging ships, this page will show the photo, story, ingredients, macros, and visibility —
            same layout pattern as ingredient pages.
          </p>
        </section>

        <section className="card card-pad">
          <h2 className="card-title">Your rating</h2>
          <p className="muted text-sm mt-8">Every meal uses a 10-star scale (same as ingredients)</p>
          <div className="mt-12">
            <StarRating
              value={rating?.score ?? 0}
              size="lg"
              onChange={(score) => setRating("meal", mealId || "draft", score, notes)}
            />
          </div>
          <div className="field mt-16">
            <label htmlFor="meal-notes">Review notes</label>
            <textarea
              id="meal-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Taste, texture, would you cook again?"
            />
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm mt-8"
            onClick={() => setRating("meal", mealId || "draft", rating?.score ?? 0, notes)}
          >
            Save review
          </button>
        </section>

        <Link to="/meals/new" className="btn btn-primary">
          Log a meal
        </Link>
      </div>
    </div>
  );
}
