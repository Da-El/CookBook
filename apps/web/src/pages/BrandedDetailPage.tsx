import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { FoodThumb } from "../components/FoodThumb";
import { MacroPills } from "../components/MacroPills";
import { ReviewsList } from "../components/ReviewsList";
import { StarRating } from "../components/StarRating";
import { useApp } from "../context/AppContext";
import { api, ApiError, type ApiFood, type ReviewDto } from "../lib/api";
import type { CatalogFood } from "../types";

function toCatalogFood(f: ApiFood): CatalogFood {
  return {
    id: f.id,
    fdc_id: f.fdc_id ?? null,
    foodb_id: null,
    name: f.name,
    name_scientific: null,
    description: f.description || f.ingredients_label || f.name,
    food_group: f.food_group || "Branded",
    food_subgroup: "Branded",
    picture: f.picture ?? null,
    picture_candidates: f.picture_candidates || [],
    emoji: "",
    source: f.source || "USDA Branded Foods",
    macros: {
      energy_kcal: f.macros?.energy_kcal ?? null,
      protein_g: f.macros?.protein_g ?? null,
      fat_g: f.macros?.fat_g ?? null,
      carbs_g: f.macros?.carbs_g ?? null,
      fiber_g: f.macros?.fiber_g ?? null,
    },
    macros_complete: !!f.macros_complete,
    micros: (f.micros as CatalogFood["micros"]) || [],
    other_nutrients: [],
    nutrient_sources: f.nutrient_sources as CatalogFood["nutrient_sources"],
  };
}

export function BrandedDetailPage() {
  const { fdcId = "" } = useParams();
  const navigate = useNavigate();
  const { user, addToFridge, getRating, setRating } = useApp();
  const [food, setFood] = useState<ApiFood | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [reviews, setReviews] = useState<ReviewDto[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewAvg, setReviewAvg] = useState<number | null>(null);
  const [reviewSaving, setReviewSaving] = useState(false);

  const catalogFood = food ? toCatalogFood(food) : null;
  const rating = catalogFood ? getRating("ingredient", catalogFood.id) : undefined;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .getBranded(fdcId)
      .then((f) => {
        if (!cancelled) setFood(f);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Not found");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fdcId]);

  useEffect(() => {
    if (!food) return;
    let cancelled = false;
    setReviewsLoading(true);
    api
      .listReviews({ subject_type: "ingredient", subject_id: food.id, limit: 100 })
      .then((res) => {
        if (cancelled) return;
        setReviews(res.items);
        setReviewAvg(res.avg ?? null);
        if (user) {
          const mine = res.items.find((x) => x.user_id === user.id);
          if (mine) {
            setNotes(mine.notes);
            setRating("ingredient", food.id, mine.score, mine.notes);
          }
        }
      })
      .catch(() => {
        if (!cancelled) setReviews([]);
      })
      .finally(() => {
        if (!cancelled) setReviewsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [food, user, setRating]);

  async function saveReview() {
    if (!food || !user) {
      navigate("/login");
      return;
    }
    const score = rating?.score ?? 0;
    if (score < 1) {
      setError("Pick a score from 1–10");
      return;
    }
    setReviewSaving(true);
    try {
      const r = await api.upsertReview({
        subject_type: "ingredient",
        subject_id: food.id,
        score,
        notes,
      });
      setRating("ingredient", food.id, score, notes);
      setReviews((prev) => {
        const rest = prev.filter((x) => x.user_id !== user.id);
        const next = [r, ...rest];
        setReviewAvg(next.reduce((s, x) => s + x.score, 0) / next.length);
        return next;
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save review");
    } finally {
      setReviewSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="page page--single">
        <div className="column">
          <p className="muted">Loading branded food…</p>
        </div>
      </div>
    );
  }

  if (error && !food) {
    return (
      <div className="page page--single">
        <div className="column">
          <section className="card card-pad empty-state">
            <h1>Not found</h1>
            <p className="muted mt-8">{error}</p>
            <Link to="/browse" className="btn btn-secondary mt-16">
              Back to Browse
            </Link>
          </section>
        </div>
      </div>
    );
  }

  if (!food || !catalogFood) return null;

  return (
    <div className="page">
      <div className="column">
        <div className="page-hero">
          <div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>
              ← Back
            </button>
            <h1 className="mt-8">{food.name}</h1>
            <p className="lede">
              {food.brand_owner || food.brand_name || "Branded product"}
              {food.serving_size ? ` · serving ${food.serving_size}` : ""}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() =>
              addToFridge({
                foodId: food.id,
                quantity: food.serving_size || "1",
                boughtOn: null,
                expiresOn: null,
                rating: rating?.score ?? null,
                notes: "",
              })
            }
          >
            + Add to fridge
          </button>
        </div>

        <section className="card">
          <FoodThumb food={catalogFood} size="lg" />
          <div className="card-pad">
            <div className="meta-chips">
              <span className="tag">{food.food_group || "Branded"}</span>
              <span className="badge-ok">USDA Branded</span>
            </div>
            {(food.brand_owner || food.brand_name) && (
              <p className="mt-12">
                <strong>{food.brand_owner || food.brand_name}</strong>
                {food.brand_name && food.brand_owner && food.brand_name !== food.brand_owner
                  ? ` · ${food.brand_name}`
                  : ""}
              </p>
            )}
            {food.gtin_upc && (
              <p className="text-sm muted mt-8">UPC {food.gtin_upc}</p>
            )}
            {food.ingredients_label && (
              <p className="detail-desc mt-12">
                <strong>Ingredients: </strong>
                {food.ingredients_label}
              </p>
            )}
            <p className="field-hint mt-12">
              {food.id}
              {food.fdc_id != null ? ` · FDC #${food.fdc_id}` : ""} · label data via USDA
            </p>
          </div>
        </section>

        <section className="card card-pad">
          <h2 className="card-title">Your rating</h2>
          {!user ? (
            <p className="mt-12">
              <Link to="/login">Sign in</Link> to leave a review.
            </p>
          ) : (
            <>
              <div className="mt-12">
                <StarRating
                  value={rating?.score ?? 0}
                  size="lg"
                  onChange={(score) => setRating("ingredient", food.id, score, notes)}
                />
              </div>
              <div className="field mt-16">
                <label htmlFor="branded-notes">Review notes</label>
                <textarea
                  id="branded-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Taste, value, would you buy again?"
                />
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm mt-8"
                disabled={reviewSaving}
                onClick={saveReview}
              >
                {reviewSaving ? "Saving…" : "Save review"}
              </button>
            </>
          )}
          {error && (
            <p className="text-sm mt-8" style={{ color: "var(--danger)" }}>
              {error}
            </p>
          )}
        </section>

        <ReviewsList
          reviews={reviews}
          loading={reviewsLoading}
          avg={reviewAvg}
          title="All reviews"
          emptyText="No reviews yet for this product."
        />

        <section className="card card-pad">
          <h2 className="card-title">Nutrition (label)</h2>
          <p className="muted text-sm mt-8">From package label data · not lab Foundation values</p>
          <div className="mt-12">
            <MacroPills macros={catalogFood.macros} />
          </div>
          <div className="nutrient-grid mt-16">
            <div className="nutrient">
              <div className="val">{catalogFood.macros.energy_kcal ?? "—"}</div>
              <div className="lbl">kcal</div>
            </div>
            <div className="nutrient">
              <div className="val">{catalogFood.macros.protein_g ?? "—"}</div>
              <div className="lbl">protein g</div>
            </div>
            <div className="nutrient">
              <div className="val">{catalogFood.macros.fat_g ?? "—"}</div>
              <div className="lbl">fat g</div>
            </div>
            <div className="nutrient">
              <div className="val">{catalogFood.macros.carbs_g ?? "—"}</div>
              <div className="lbl">carbs g</div>
            </div>
          </div>
        </section>
      </div>

      <aside className="rail">
        <div className="card card-pad">
          <h2 className="card-title">Branded foods</h2>
          <p className="muted text-sm mt-8">
            400k+ products are searched live from USDA — we never store the full branded database.
          </p>
          <Link to="/browse" className="btn btn-secondary btn-sm mt-12">
            Back to Browse
          </Link>
        </div>
      </aside>
    </div>
  );
}
