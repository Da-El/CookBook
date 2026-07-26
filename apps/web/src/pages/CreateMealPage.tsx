import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FoodThumb } from "../components/FoodThumb";
import { PhotoPicker } from "../components/PhotoPicker";
import { StarRating } from "../components/StarRating";
import { useApp } from "../context/AppContext";
import { api, ApiError } from "../lib/api";
import { getFoodById } from "../lib/catalog";

type DraftIng = { foodId: string; quantity: string };

export function CreateMealPage() {
  const { user, foods, fridge } = useApp();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"cooked" | "want_to_cook">("cooked");
  const [title, setTitle] = useState("");
  const [story, setStory] = useState("");
  const [cuisine, setCuisine] = useState("");
  const [timeMinutes, setTimeMinutes] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [rating, setRating] = useState(0);
  const [photo, setPhoto] = useState<string | null>(null);
  const [ingredients, setIngredients] = useState<DraftIng[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const searchHits = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q.length < 1) return [];
    return foods
      .filter(
        (f) =>
          f.name.toLowerCase().includes(q) ||
          f.food_group.toLowerCase().includes(q) ||
          (f.food_subgroup || "").toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [foods, search]);

  function addFood(foodId: string, qty = "100g") {
    setIngredients((prev) => {
      if (prev.some((p) => p.foodId === foodId)) return prev;
      return [...prev, { foodId, quantity: qty }];
    });
    setSearch("");
  }

  function removeFood(foodId: string) {
    setIngredients((prev) => prev.filter((p) => p.foodId !== foodId));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) {
      navigate("/login");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      let photo_url: string | null = null;
      if (photo) {
        if (photo.startsWith("data:")) {
          const up = await api.uploadMedia(photo);
          photo_url = up.url;
        } else {
          photo_url = photo;
        }
      }
      const meal = await api.createMeal({
        status,
        title: title.trim(),
        story: story.trim(),
        cuisine: cuisine.trim() || undefined,
        time_minutes: timeMinutes ? Number(timeMinutes) : null,
        visibility,
        photo_url,
        rating: status === "cooked" && rating > 0 ? rating : null,
        ingredients: ingredients.map((i) => ({
          food_id: i.foodId,
          quantity_text: i.quantity,
        })),
      });
      navigate(`/meals/${meal.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save meal");
    } finally {
      setBusy(false);
    }
  }

  if (!user) {
    return (
      <div className="page page--single">
        <div className="column">
          <section className="card card-pad empty-state">
            <h1>Log a meal</h1>
            <p className="muted mt-8">Sign in to create meals and share them on your feed.</p>
            <Link to="/login" className="btn btn-primary mt-16">
              Sign in
            </Link>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <form className="column" onSubmit={onSubmit}>
        <div className="page-hero">
          <div>
            <h1>Log a meal</h1>
            <p className="lede">Cooked or want-to-cook · ingredients · notes</p>
          </div>
          <div className="row-end">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={busy || !title.trim()}>
              {busy ? "Saving…" : "Save meal"}
            </button>
          </div>
        </div>

        {error && (
          <div className="card card-pad" style={{ borderColor: "var(--danger, #c44)" }}>
            <p className="text-sm">{error}</p>
          </div>
        )}

        <section className="card card-pad">
          <PhotoPicker
            value={photo}
            onChange={setPhoto}
            label="Meal photo"
            hint="Plate shot or packaging · optional"
            large
          />
        </section>

        <section className="card card-pad">
          <div className="field">
            <label>Status</label>
            <div className="seg" style={{ maxWidth: 320 }}>
              <button
                type="button"
                className={status === "cooked" ? "active" : undefined}
                onClick={() => setStatus("cooked")}
              >
                Cooked
              </button>
              <button
                type="button"
                className={status === "want_to_cook" ? "active" : undefined}
                onClick={() => setStatus("want_to_cook")}
              >
                Want to cook
              </button>
            </div>
          </div>

          <div className="field mt-16">
            <label htmlFor="title">Meal name</label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Miso Glazed Salmon"
              required
              maxLength={200}
            />
          </div>

          <div className="field">
            <label htmlFor="story">Story / notes</label>
            <textarea
              id="story"
              value={story}
              onChange={(e) => setStory(e.target.value)}
              placeholder="How did it turn out? Tips for other cooks?"
              rows={4}
            />
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="cuisine">Cuisine</label>
              <select id="cuisine" value={cuisine} onChange={(e) => setCuisine(e.target.value)}>
                <option value="">Choose…</option>
                <option>Japanese</option>
                <option>Italian</option>
                <option>Mexican</option>
                <option>American</option>
                <option>Korean</option>
                <option>Indian</option>
                <option>Other</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="time">Time (minutes)</label>
              <input
                id="time"
                type="number"
                min={1}
                value={timeMinutes}
                onChange={(e) => setTimeMinutes(e.target.value)}
                placeholder="25"
              />
            </div>
          </div>

          <div className="field">
            <label>Visibility</label>
            <div className="seg" style={{ maxWidth: 280 }}>
              <button
                type="button"
                className={visibility === "public" ? "active" : undefined}
                onClick={() => setVisibility("public")}
              >
                Public
              </button>
              <button
                type="button"
                className={visibility === "private" ? "active" : undefined}
                onClick={() => setVisibility("private")}
              >
                Private
              </button>
            </div>
          </div>
        </section>

        <section className="card card-pad">
          <h2 className="card-title">Ingredients used</h2>
          <p className="muted text-sm mt-8">From fridge or catalog — use grams (e.g. 200g) for macro estimates</p>

          {fridge.length > 0 && (
            <div className="mt-12">
              <p className="text-sm muted">Quick add from fridge</p>
              <div className="row-end mt-8" style={{ justifyContent: "flex-start", flexWrap: "wrap", gap: 8 }}>
                {fridge.slice(0, 12).map((item) => {
                  const food = getFoodById(foods, item.foodId);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => addFood(item.foodId, item.quantity || "100g")}
                    >
                      {food?.name ?? item.foodId}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="field mt-12">
            <label htmlFor="ing-search" className="sr-only">
              Search ingredients
            </label>
            <input
              id="ing-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search ingredients…"
            />
            {searchHits.length > 0 && (
              <div className="search-results">
                {searchHits.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className="search-result search-result--btn"
                    onClick={() => addFood(f.id)}
                  >
                    <FoodThumb food={f} />
                    <div className="ing-meta">
                      <div className="name">{f.name}</div>
                      <div className="group">
                        {f.food_group} · {f.food_subgroup || "—"}
                      </div>
                    </div>
                    <span className="badge-ok">Catalog</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="ing-list mt-12">
            {ingredients.length === 0 && <p className="muted text-sm">No ingredients yet.</p>}
            {ingredients.map((ing) => {
              const food = getFoodById(foods, ing.foodId);
              return (
                <div key={ing.foodId} className="ing-row">
                  {food ? <FoodThumb food={food} /> : <div className="ing-icon">?</div>}
                  <div className="ing-meta" style={{ flex: 1 }}>
                    <div className="name">{food?.name ?? ing.foodId}</div>
                    <input
                      type="text"
                      className="mt-8"
                      value={ing.quantity}
                      onChange={(e) =>
                        setIngredients((prev) =>
                          prev.map((p) =>
                            p.foodId === ing.foodId ? { ...p, quantity: e.target.value } : p,
                          ),
                        )
                      }
                      placeholder="200g"
                      style={{ maxWidth: 140 }}
                    />
                  </div>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeFood(ing.foodId)}>
                    Remove
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {status === "cooked" && (
          <section className="card card-pad">
            <h2 className="card-title">Your rating</h2>
            <p className="muted text-sm mt-8">10-star scale</p>
            <div className="mt-12">
              <StarRating value={rating} size="lg" onChange={setRating} />
            </div>
          </section>
        )}

        <button type="submit" className="btn btn-primary" disabled={busy || !title.trim()}>
          {busy ? "Saving…" : "Save meal"}
        </button>
      </form>

      <aside className="rail">
        <div className="card card-pad">
          <h2 className="card-title">Tips</h2>
          <p className="muted text-sm mt-8">
            Public meals appear in the home feed for people who follow you. Use quantities like{" "}
            <code>200g</code> so macros can be estimated.
          </p>
        </div>
      </aside>
    </div>
  );
}
