import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { FoodThumb } from "../components/FoodThumb";
import { MacroPills } from "../components/MacroPills";
import { PhotoPicker } from "../components/PhotoPicker";
import { ReviewsList } from "../components/ReviewsList";
import { StarRating } from "../components/StarRating";
import { useApp } from "../context/AppContext";
import { api, ApiError, getAccessToken, type ReviewDto } from "../lib/api";
import { getFoodById } from "../lib/catalog";
import { mediaUrl } from "../lib/photo";
import type { CatalogFood } from "../types";

const META_KEY = "grok-cookbook-food-meta-v1";

type LocalMeta = { description: string; photoUrl: string | null };

function loadLocalMeta(foodId: string): LocalMeta {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return { description: "", photoUrl: null };
    const all = JSON.parse(raw) as Record<string, LocalMeta>;
    return all[foodId] ?? { description: "", photoUrl: null };
  } catch {
    return { description: "", photoUrl: null };
  }
}

function saveLocalMeta(foodId: string, meta: LocalMeta) {
  try {
    const raw = localStorage.getItem(META_KEY);
    const all = raw ? (JSON.parse(raw) as Record<string, LocalMeta>) : {};
    all[foodId] = meta;
    localStorage.setItem(META_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

export function IngredientDetailPage() {
  const { foodId = "" } = useParams();
  const navigate = useNavigate();
  const {
    foods,
    catalog,
    catalogLoading,
    catalogError,
    fridge,
    getRating,
    setRating,
    addToFridge,
    user,
  } = useApp();

  const food = useMemo(() => getFoodById(foods, foodId), [foods, foodId]);
  const rating = food ? getRating("ingredient", food.id) : undefined;
  const [notes, setNotes] = useState(rating?.notes ?? "");

  const [description, setDescription] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [editingDesc, setEditingDesc] = useState(false);
  const [editingPhoto, setEditingPhoto] = useState(false);
  const [descDraft, setDescDraft] = useState("");
  const [photoDraft, setPhotoDraft] = useState<string | null>(null);
  const [metaLoading, setMetaLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [reviews, setReviews] = useState<ReviewDto[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewAvg, setReviewAvg] = useState<number | null>(null);
  const [reviewSaving, setReviewSaving] = useState(false);

  const inFridge = useMemo(
    () =>
      fridge.filter(
        (i) =>
          food &&
          (i.foodId === food.id ||
            (food.fdc_id != null && i.foodId === String(food.fdc_id)) ||
            (food.fdc_id != null && i.foodId === `fdc-${food.fdc_id}`)),
      ),
    [fridge, food],
  );

  // Load user meta (server if signed in, else localStorage)
  useEffect(() => {
    if (!food) return;
    let cancelled = false;
    setMetaLoading(true);
    setMetaError(null);

    (async () => {
      if (user && getAccessToken()) {
        try {
          const meta = await api.getFoodMeta(food.id);
          if (cancelled) return;
          setDescription(meta.description || "");
          setPhotoUrl(meta.photo_url);
          setDescDraft(meta.description || "");
          setPhotoDraft(meta.photo_url);
          return;
        } catch {
          /* fall through to local */
        }
      }
      const local = loadLocalMeta(food.id);
      if (!cancelled) {
        setDescription(local.description);
        setPhotoUrl(local.photoUrl);
        setDescDraft(local.description);
        setPhotoDraft(local.photoUrl);
      }
    })().finally(() => {
      if (!cancelled) setMetaLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [food, user]);

  // Load community reviews for this ingredient
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
        if (!cancelled) {
          setReviews([]);
          setReviewAvg(null);
        }
      })
      .finally(() => {
        if (!cancelled) setReviewsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [food, user, setRating]);

  async function saveIngredientReview() {
    if (!food) return;
    if (!user) {
      navigate("/login");
      return;
    }
    const score = rating?.score ?? 0;
    if (score < 1) {
      setMetaError("Pick a score from 1–10");
      return;
    }
    setReviewSaving(true);
    setMetaError(null);
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
        return [r, ...rest];
      });
      setReviewAvg((prev) => {
        const others = reviews.filter((x) => x.user_id !== user.id);
        const all = [...others, r];
        return all.reduce((s, x) => s + x.score, 0) / all.length;
      });
    } catch (err) {
      setMetaError(err instanceof ApiError ? err.message : "Could not save review");
    } finally {
      setReviewSaving(false);
    }
  }

  async function saveMeta(next: { description?: string; photoUrl?: string | null; clearPhoto?: boolean }) {
    if (!food) return;
    setSaving(true);
    setMetaError(null);
    const desc = next.description !== undefined ? next.description : description;
    let photo = next.photoUrl !== undefined ? next.photoUrl : photoUrl;
    if (next.clearPhoto) photo = null;

    try {
      if (user && getAccessToken()) {
        let photo_url = photo;
        if (photo?.startsWith("data:")) {
          const up = await api.uploadMedia(photo);
          photo_url = up.url;
        }
        const res = await api.putFoodMeta(food.id, {
          description: desc,
          photo_url: next.clearPhoto ? null : photo_url,
          clear_photo: next.clearPhoto || false,
        });
        setDescription(res.description);
        setPhotoUrl(res.photo_url);
        setDescDraft(res.description);
        setPhotoDraft(res.photo_url);
        saveLocalMeta(food.id, { description: res.description, photoUrl: res.photo_url });
      } else {
        const meta = { description: desc, photoUrl: photo };
        saveLocalMeta(food.id, meta);
        setDescription(meta.description);
        setPhotoUrl(meta.photoUrl);
        setDescDraft(meta.description);
        setPhotoDraft(meta.photoUrl);
      }
      setEditingDesc(false);
      setEditingPhoto(false);
    } catch (err) {
      setMetaError(err instanceof ApiError ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  if (catalogLoading) {
    return (
      <div className="page page--single">
        <div className="column">
          <section className="card card-pad">
            <p className="muted">Loading ingredient…</p>
          </section>
        </div>
      </div>
    );
  }

  if (catalogError) {
    return (
      <div className="page page--single">
        <div className="column">
          <section className="card card-pad">
            <p className="danger-text">{catalogError}</p>
          </section>
        </div>
      </div>
    );
  }

  if (!food) {
    return (
      <div className="page page--single">
        <div className="column">
          <section className="card card-pad empty-state">
            <h1 className="card-title">Ingredient not found</h1>
            <p className="muted mt-8">No catalog entry for “{foodId}”.</p>
            <Link to="/browse" className="btn btn-primary mt-16">
              Browse catalog
            </Link>
          </section>
        </div>
      </div>
    );
  }

  const micros = food.micros ?? [];
  const other = food.other_nutrients ?? [];
  const totalIngredients = catalog?.count ?? foods.length;

  const displayFood: CatalogFood = {
    ...food,
    picture: mediaUrl(photoUrl) || food.picture,
    picture_candidates: photoUrl
      ? [mediaUrl(photoUrl)!, ...(food.picture_candidates || [])].filter(Boolean) as string[]
      : food.picture_candidates,
  };

  const hasCustomDesc = description.trim().length > 0;
  const catalogDesc =
    food.description && food.description !== food.name ? food.description : "";

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
              {food.food_group}
              {" · "}
              <strong>{totalIngredients.toLocaleString()}</strong> ingredients in catalog
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => {
              addToFridge({
                foodId: food.id,
                quantity: "1",
                boughtOn: null,
                expiresOn: null,
                rating: rating?.score ?? null,
                notes: "",
              });
            }}
          >
            + Add to fridge
          </button>
        </div>

        {/* 1. Main card: photo + identity */}
        <section className="card">
          {editingPhoto ? (
            <div className="card-pad">
              <PhotoPicker
                value={photoDraft}
                onChange={setPhotoDraft}
                label="Ingredient photo"
                hint="Your photo of this ingredient"
                large
              />
              <div className="row-end mt-12" style={{ gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={saving}
                  onClick={() => {
                    setPhotoDraft(photoUrl);
                    setEditingPhoto(false);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={saving}
                  onClick={() => saveMeta({ clearPhoto: true })}
                >
                  Remove photo
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={saving}
                  onClick={() => saveMeta({ photoUrl: photoDraft })}
                >
                  {saving ? "Saving…" : "Save photo"}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="ingredient-photo-wrap">
                <FoodThumb food={displayFood} size="lg" />
                <button
                  type="button"
                  className="btn btn-secondary btn-sm ingredient-photo-edit"
                  onClick={() => {
                    setPhotoDraft(photoUrl);
                    setEditingPhoto(true);
                  }}
                >
                  {photoUrl ? "Edit photo" : "Add photo"}
                </button>
              </div>
              <div className="card-pad">
                <div className="meta-chips">
                  <span className="tag">{food.food_group || "Unclassified"}</span>
                  <span className="badge-ok">USDA Foundation</span>
                </div>
                {food.name_scientific && (
                  <p className="scientific mt-12">{food.name_scientific}</p>
                )}
              </div>
            </>
          )}
        </section>

        {/* Description under photo card */}
        <section className="card card-pad">
          <div className="card-head">
            <h2 className="card-title">Description</h2>
            {!editingDesc && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setDescDraft(hasCustomDesc ? description : catalogDesc);
                  setEditingDesc(true);
                }}
              >
                {hasCustomDesc || catalogDesc ? "Edit" : "Add"}
              </button>
            )}
          </div>

          {metaLoading ? (
            <p className="muted text-sm mt-8">Loading…</p>
          ) : editingDesc ? (
            <>
              <div className="field mt-8">
                <label htmlFor="food-desc" className="sr-only">
                  Description
                </label>
                <textarea
                  id="food-desc"
                  value={descDraft}
                  onChange={(e) => setDescDraft(e.target.value)}
                  rows={4}
                  placeholder="What is this ingredient? Flavor, how you use it, brands you like…"
                  autoFocus
                />
              </div>
              <div className="row-end mt-8" style={{ gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={saving}
                  onClick={() => setEditingDesc(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={saving}
                  onClick={() => saveMeta({ description: descDraft })}
                >
                  {saving ? "Saving…" : "Save description"}
                </button>
              </div>
            </>
          ) : hasCustomDesc ? (
            <p className="detail-desc mt-8">{description}</p>
          ) : catalogDesc ? (
            <p className="detail-desc mt-8 muted">{catalogDesc}</p>
          ) : (
            <p className="muted text-sm mt-8">
              No description yet.{" "}
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ display: "inline", padding: "0 4px", verticalAlign: "baseline" }}
                onClick={() => {
                  setDescDraft("");
                  setEditingDesc(true);
                }}
              >
                Write one
              </button>
            </p>
          )}
          {metaError && (
            <p className="text-sm mt-8" style={{ color: "var(--danger)" }}>
              {metaError}
            </p>
          )}
          {!user && (
            <p className="text-sm muted mt-8">
              Signed-out edits stay on this device.{" "}
              <Link to="/login" className="linkish">
                Sign in
              </Link>{" "}
              to sync.
            </p>
          )}
        </section>

        {/* Your rating */}
        <section className="card card-pad">
          <h2 className="card-title">Your rating</h2>
          <p className="muted text-sm mt-8">Rate this ingredient out of 10</p>
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
                <label htmlFor="rating-notes">Review notes</label>
                <textarea
                  id="rating-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Taste, freshness, brand, value…"
                />
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm mt-8"
                disabled={reviewSaving}
                onClick={saveIngredientReview}
              >
                {reviewSaving ? "Saving…" : "Save review"}
              </button>
            </>
          )}
        </section>

        {/* Community reviews */}
        <ReviewsList
          reviews={reviews}
          loading={reviewsLoading}
          avg={reviewAvg}
          title="All reviews"
          emptyText="No reviews yet — be the first to rate this ingredient."
        />

        <section className="card card-pad">
          <h2 className="card-title">Macronutrients</h2>
          <p className="muted text-sm mt-8">Per 100 g</p>
          <div className="mt-12">
            <MacroPills macros={food.macros} />
          </div>
          <div className="nutrient-grid mt-16">
            <div className="nutrient">
              <div className="val">{food.macros.energy_kcal ?? "—"}</div>
              <div className="lbl">kcal</div>
            </div>
            <div className="nutrient">
              <div className="val">{food.macros.protein_g ?? "—"}</div>
              <div className="lbl">protein g</div>
            </div>
            <div className="nutrient">
              <div className="val">{food.macros.fat_g ?? "—"}</div>
              <div className="lbl">fat g</div>
            </div>
            <div className="nutrient">
              <div className="val">{food.macros.carbs_g ?? "—"}</div>
              <div className="lbl">carbs g</div>
            </div>
            <div className="nutrient">
              <div className="val">{food.macros.fiber_g ?? "—"}</div>
              <div className="lbl">fiber g</div>
            </div>
          </div>
        </section>

        <section className="card card-pad">
          <h2 className="card-title">Micronutrients</h2>
          <p className="muted text-sm mt-8">Vitamins &amp; minerals</p>
          {micros.length === 0 ? (
            <p className="muted mt-12">No micronutrient rows for this food.</p>
          ) : (
            <div className="nutrient-table mt-12">
              {micros.map((m) => (
                <div key={m.name} className="nutrient-table-row">
                  <span className="name">{m.name}</span>
                  <span className="amt">
                    <strong>{m.amount}</strong> {m.unit}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {other.length > 0 && (
          <section className="card card-pad">
            <h2 className="card-title">Other nutrients</h2>
            <div className="nutrient-table mt-12">
              {other.map((m) => (
                <div key={m.name} className="nutrient-table-row">
                  <span className="name">{m.name}</span>
                  <span className="amt">
                    <strong>{m.amount}</strong> {m.unit}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {inFridge.length > 0 && (
          <section className="card card-pad">
            <h2 className="card-title">In your fridge</h2>
            <ul className="ing-list mt-12">
              {inFridge.map((item) => (
                <div key={item.id} className="ing-row">
                  <div className="ing-meta">
                    <div className="name">{item.quantity}</div>
                    <div className="group">
                      Fridge
                      {item.expiresOn ? ` · exp ${item.expiresOn}` : ""}
                    </div>
                  </div>
                </div>
              ))}
            </ul>
            <Link to="/cookbook" className="btn btn-ghost btn-sm mt-8">
              Open fridge
            </Link>
          </section>
        )}
      </div>

      <aside className="rail">
        <div className="card card-pad">
          <h2 className="card-title">Catalog</h2>
          <div className="nutrient mt-12">
            <div className="val">{totalIngredients.toLocaleString()}</div>
            <div className="lbl">ingredients</div>
          </div>
        </div>
        <div className="card card-pad">
          <h2 className="card-title">Quick macros</h2>
          <div className="mt-12">
            <MacroPills macros={food.macros} />
          </div>
        </div>
        <div className="card card-pad">
          <h2 className="card-title">Group</h2>
          <p className="text-sm mt-8">
            <strong>{food.food_group}</strong>
          </p>
        </div>
      </aside>
    </div>
  );
}
