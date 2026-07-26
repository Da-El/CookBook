import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { FoodThumb } from "../components/FoodThumb";
import { MacroPills } from "../components/MacroPills";
import { StarRating } from "../components/StarRating";
import { useApp } from "../context/AppContext";
import { getFoodById } from "../lib/catalog";

export function IngredientDetailPage() {
  const { foodId = "" } = useParams();
  const navigate = useNavigate();
  const { foods, catalogLoading, catalogError, fridge, getRating, setRating, addToFridge } =
    useApp();

  const food = useMemo(() => getFoodById(foods, foodId), [foods, foodId]);
  const rating = food ? getRating("ingredient", food.id) : undefined;
  const [notes, setNotes] = useState(rating?.notes ?? "");

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

  return (
    <div className="page">
      <div className="column">
        <div className="page-hero">
          <div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>
              ← Back
            </button>
            <h1 className="mt-8">{food.name}</h1>
            <p className="lede">{food.food_group}</p>
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
          <FoodThumb food={food} size="lg" />
          <div className="card-pad">
            <div className="meta-chips">
              <span className="tag">{food.food_group || "Unclassified"}</span>
            </div>

            {food.name_scientific && (
              <p className="scientific mt-12">{food.name_scientific}</p>
            )}

            {food.description && food.description !== food.name ? (
              <p className="detail-desc mt-12">{food.description}</p>
            ) : null}
          </div>
        </section>

        {/* 2. Rating / review — second card */}
        <section className="card card-pad">
          <h2 className="card-title">Your rating</h2>
          <p className="muted text-sm mt-8">Rate this ingredient out of 10</p>
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
              onBlur={() => {
                if (rating?.score) setRating("ingredient", food.id, rating.score, notes);
              }}
              placeholder="Taste, freshness, brand, value…"
            />
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm mt-8"
            onClick={() => setRating("ingredient", food.id, rating?.score ?? 0, notes)}
          >
            Save review
          </button>
        </section>

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
            <p className="muted text-sm mt-8">Additional nutrient values</p>
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
