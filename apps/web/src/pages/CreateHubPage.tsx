import { Link } from "react-router-dom";
import { IconIngredient, IconMeal } from "../components/Icons";
import { useApp } from "../context/AppContext";

export function CreateHubPage() {
  const { user } = useApp();

  return (
    <div className="page page--single">
      <div className="column">
        <div className="page-hero">
          <div>
            <h1>Create</h1>
            <p className="lede">Start a meal page or add an ingredient to your fridge</p>
          </div>
        </div>

        {!user && (
          <section className="card card-pad">
            <p className="muted text-sm">
              You can browse without an account.{" "}
              <Link to="/login" className="linkish">
                Sign in
              </Link>{" "}
              to save meals and fridge items.
            </p>
          </section>
        )}

        <div className="create-hub">
          <Link to="/create/meal" className="create-tile create-tile--meal">
            <span className="create-tile-icon">
              <IconMeal size={28} />
            </span>
            <span className="create-tile-label">New meal</span>
            <span className="create-tile-desc">
              Log something you cooked or want to cook — ingredients, notes, rating.
            </span>
            <span className="create-tile-cta">Open meal form</span>
          </Link>

          <Link to="/create/ingredient" className="create-tile create-tile--ing">
            <span className="create-tile-icon">
              <IconIngredient size={28} />
            </span>
            <span className="create-tile-label">New ingredient</span>
            <span className="create-tile-desc">
              Add a catalog food to your fridge with a photo and quantity.
            </span>
            <span className="create-tile-cta">Open ingredient form</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
