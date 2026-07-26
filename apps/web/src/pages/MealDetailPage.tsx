import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { FoodThumb } from "../components/FoodThumb";
import { ReviewsList } from "../components/ReviewsList";
import { StarRating } from "../components/StarRating";
import { useApp } from "../context/AppContext";
import { api, ApiError, type MealDto, type ReviewDto } from "../lib/api";
import { getFoodById } from "../lib/catalog";

export function MealDetailPage() {
  const { mealId = "" } = useParams();
  const navigate = useNavigate();
  const { user, foods } = useApp();
  const [meal, setMeal] = useState<MealDto | null>(null);
  const [reviews, setReviews] = useState<ReviewDto[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewAvg, setReviewAvg] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [score, setScore] = useState(0);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const m = await api.getMeal(mealId);
        if (cancelled) return;
        setMeal(m);
        setScore(m.my_score ?? 0);
        if (user && m.author.handle !== user.handle) {
          try {
            const p = await api.getProfile(m.author.handle);
            if (!cancelled) setIsFollowing(p.is_following);
          } catch {
            /* ignore */
          }
        }
        // Community reviews (public meals; works signed-out too)
        setReviewsLoading(true);
        try {
          const r = await api.listReviews({ subject_type: "meal", subject_id: mealId, limit: 100 });
          if (!cancelled) {
            setReviews(r.items);
            setReviewAvg(r.avg ?? m.review_avg ?? null);
            if (user) {
              const mine = r.items.find((x) => x.user_id === user.id);
              if (mine) {
                setScore(mine.score);
                setNotes(mine.notes);
              }
            }
          }
        } catch {
          if (!cancelled) {
            setReviews([]);
            setReviewAvg(m.review_avg ?? null);
          }
        } finally {
          if (!cancelled) setReviewsLoading(false);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Meal not found");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mealId, user]);

  async function saveReview() {
    if (!user) {
      navigate("/login");
      return;
    }
    if (score < 1) {
      setError("Pick a score from 1–10");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const r = await api.upsertReview({
        subject_type: "meal",
        subject_id: mealId,
        score,
        notes,
      });
      setReviews((prev) => {
        const rest = prev.filter((x) => x.user_id !== user.id);
        const next = [r, ...rest];
        setReviewAvg(next.reduce((s, x) => s + x.score, 0) / next.length);
        return next;
      });
      setMeal((m) =>
        m
          ? {
              ...m,
              my_score: score,
              review_count: reviews.some((x) => x.user_id === user.id)
                ? m.review_count
                : m.review_count + 1,
            }
          : m,
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save review");
    } finally {
      setSaving(false);
    }
  }

  async function toggleFollow() {
    if (!user || !meal) {
      navigate("/login");
      return;
    }
    if (meal.author.id === user.id) return;
    setFollowBusy(true);
    try {
      if (isFollowing) {
        await api.unfollow(meal.author.handle);
        setIsFollowing(false);
      } else {
        await api.follow(meal.author.handle);
        setIsFollowing(true);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Follow failed");
    } finally {
      setFollowBusy(false);
    }
  }

  async function removeMeal() {
    if (!meal || !user || meal.author.id !== user.id) return;
    if (!confirm("Delete this meal?")) return;
    try {
      await api.deleteMeal(meal.id);
      navigate("/kitchen");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Delete failed");
    }
  }

  if (loading) {
    return (
      <div className="page page--single">
        <div className="column">
          <p className="muted">Loading meal…</p>
        </div>
      </div>
    );
  }

  if (error && !meal) {
    return (
      <div className="page page--single">
        <div className="column">
          <section className="card card-pad empty-state">
            <h1>Meal not found</h1>
            <p className="muted mt-8">{error}</p>
            <Link to="/" className="btn btn-secondary mt-16">
              Home
            </Link>
          </section>
        </div>
      </div>
    );
  }

  if (!meal) return null;

  const isOwner = user?.id === meal.author.id;
  const macros = meal.macros_estimated;

  return (
    <div className="page">
      <div className="column">
        <div className="page-hero">
          <div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>
              ← Back
            </button>
            <h1 className="mt-8">{meal.title}</h1>
            <p className="lede">
              <Link to={`/u/${encodeURIComponent(meal.author.handle)}`} className="linkish">
                @{meal.author.handle}
              </Link>
              {" · "}
              {meal.status === "want_to_cook" ? "Want to cook" : "Cooked"}
              {meal.cuisine ? ` · ${meal.cuisine}` : ""}
              {meal.time_minutes ? ` · ${meal.time_minutes} min` : ""}
              {" · "}
              {meal.visibility}
            </p>
          </div>
          <div className="row-end" style={{ gap: 8 }}>
            {!isOwner && user && (
              <button
                type="button"
                className={`btn btn-sm ${isFollowing ? "btn-secondary" : "btn-primary"}`}
                disabled={followBusy}
                onClick={toggleFollow}
              >
                {isFollowing ? "Following" : "Follow"}
              </button>
            )}
            {isOwner && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={removeMeal}>
                Delete
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="card card-pad">
            <p className="text-sm">{error}</p>
          </div>
        )}

        <section className="card card-pad">
          <div
            className="plate-media var-2 meal-hero-plate"
            style={{ borderRadius: "var(--radius-sm)", marginBottom: 16 }}
          >
            {meal.photo_url ? (
              <img
                src={meal.photo_url.startsWith("http") || meal.photo_url.startsWith("data:")
                  ? meal.photo_url
                  : meal.photo_url}
                alt=""
                className="plate-img"
              />
            ) : (
              <span className="meal-card-glyph meal-card-glyph--lg" aria-hidden />
            )}
          </div>
          {meal.story && <p className="mt-8">{meal.story}</p>}
          {(meal.author_rating || meal.review_avg) && (
            <div className="mt-12">
              {meal.author_rating != null && (
                <p className="text-sm muted">
                  Chef rating: <strong>{meal.author_rating}</strong>/10
                </p>
              )}
              {meal.review_count > 0 && (
                <p className="text-sm muted">
                  Community: <strong>{meal.review_avg?.toFixed(1)}</strong>/10 ({meal.review_count})
                </p>
              )}
            </div>
          )}
          {macros && (
            <div className="nutrient-grid mt-16" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
              <div className="nutrient">
                <div className="val">{macros.kcal ?? "—"}</div>
                <div className="lbl">kcal</div>
              </div>
              <div className="nutrient">
                <div className="val">{macros.protein_g ?? "—"}</div>
                <div className="lbl">protein g</div>
              </div>
              <div className="nutrient">
                <div className="val">{macros.fat_g ?? "—"}</div>
                <div className="lbl">fat g</div>
              </div>
              <div className="nutrient">
                <div className="val">{macros.carbs_g ?? "—"}</div>
                <div className="lbl">carbs g</div>
              </div>
            </div>
          )}
        </section>

        <section className="card card-pad">
          <h2 className="card-title">Ingredients</h2>
          {meal.ingredients.length === 0 ? (
            <p className="muted text-sm mt-8">No ingredients listed.</p>
          ) : (
            <div className="ing-list mt-12">
              {meal.ingredients.map((ing) => {
                const food = getFoodById(foods, ing.food_id);
                return (
                  <div key={ing.id} className="ing-row">
                    {food ? (
                      <Link to={`/ingredients/${encodeURIComponent(food.id)}`}>
                        <FoodThumb food={food} />
                      </Link>
                    ) : (
                      <div className="ing-icon ing-icon--fallback" aria-hidden>
                        <span>{ing.food_name.slice(0, 1).toUpperCase()}</span>
                      </div>
                    )}
                    <div className="ing-meta">
                      {food ? (
                        <Link
                          to={`/ingredients/${encodeURIComponent(food.id)}`}
                          className="name linkish"
                        >
                          {ing.food_name}
                        </Link>
                      ) : (
                        <div className="name">{ing.food_name}</div>
                      )}
                      <div className="group">{ing.quantity_text || "—"}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="card card-pad">
          <h2 className="card-title">Your rating</h2>
          <p className="muted text-sm mt-8">Every meal uses a 10-star scale</p>
          {!user ? (
            <p className="mt-12">
              <Link to="/login">Sign in</Link> to leave a review.
            </p>
          ) : meal.visibility === "private" && !isOwner ? (
            <p className="muted mt-12">Private meal.</p>
          ) : meal.visibility === "private" ? (
            <p className="muted mt-12">Private meals don’t take community reviews (use chef rating when logging).</p>
          ) : (
            <>
              <div className="mt-12">
                <StarRating value={score} size="lg" onChange={setScore} />
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
                disabled={saving}
                onClick={saveReview}
              >
                {saving ? "Saving…" : "Save review"}
              </button>
            </>
          )}
        </section>

        <ReviewsList
          reviews={reviews}
          loading={reviewsLoading}
          avg={reviewAvg}
          title="All reviews"
          emptyText="No reviews yet — be the first to rate this meal."
        />
      </div>

      <aside className="rail">
        <div className="card card-pad">
          <h2 className="card-title">Chef</h2>
          <p className="mt-8">
            <strong>{meal.author.display_name}</strong>
          </p>
          <p className="muted text-sm">@{meal.author.handle}</p>
          <Link
            to={`/u/${encodeURIComponent(meal.author.handle)}`}
            className="btn btn-secondary btn-sm mt-12"
          >
            View kitchen
          </Link>
        </div>
      </aside>
    </div>
  );
}
