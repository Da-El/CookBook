import { Link } from "react-router-dom";

export function LegalPage() {
  return (
    <div className="page page--single">
      <div className="column">
        <div className="page-hero">
          <div>
            <h1>Legal</h1>
            <p className="lede">Terms, privacy, and data sources for CookBook</p>
          </div>
        </div>

        <section className="card card-pad">
          <h2 className="card-title">Terms of use</h2>
          <p className="muted text-sm mt-8">
            CookBook is a personal kitchen journal. You are responsible for the content you post
            (meals, photos, reviews). Do not share content you do not have rights to. We may remove
            abusive or unlawful material.
          </p>
        </section>

        <section className="card card-pad">
          <h2 className="card-title">Privacy</h2>
          <p className="muted text-sm mt-8">
            We store your account (email, display name, handle), meals, fridge items, and social
            follows to run the service. Media you upload is stored on our servers. You can sign out
            of all devices from Settings. For account deletion requests, contact support from your
            registered email.
          </p>
        </section>

        <section className="card card-pad">
          <h2 className="card-title">Nutrition data</h2>
          <p className="muted text-sm mt-8">
            Foundation ingredients use USDA FoodData Central Foundation Foods. Branded product
            search is provided live via the USDA FDC API and is not stored in bulk by CookBook.
            Nutrition values are estimates and not medical advice.
          </p>
        </section>

        <p className="muted text-sm">
          <Link to="/settings" className="linkish">
            Back to settings
          </Link>
        </p>
      </div>
    </div>
  );
}
