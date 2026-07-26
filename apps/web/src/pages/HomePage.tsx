import { Link } from "react-router-dom";
import { useApp } from "../context/AppContext";

export function HomePage() {
  const { fridge, foods, catalog } = useApp();

  return (
    <div className="page">
      <div className="column">
        <div className="page-hero">
          <div>
            <h1>Today’s table</h1>
            <p className="lede">Start with your kitchen inventory — meals &amp; social feed come next.</p>
          </div>
        </div>

        <section className="card card-pad">
          <h2 className="card-title">Welcome to CookBook</h2>
          <p className="muted text-sm mt-8">
            This working slice focuses on <strong>ingredients</strong>: search the FooDB catalog, add items to
            your fridge, and manage them. Your fridge is saved in this browser.
          </p>
          <div className="row-end mt-16" style={{ justifyContent: "flex-start", gap: 10 }}>
            <Link to="/ingredients/browse" className="btn btn-primary">
              Browse all 992 foods
            </Link>
            <Link to="/ingredients" className="btn btn-secondary">
              Open fridge
            </Link>
            <Link to="/ingredients/add" className="btn btn-secondary">
              Add ingredient
            </Link>
          </div>
        </section>

        <section className="card card-pad">
          <div className="card-head">
            <h2 className="card-title">Quick stats</h2>
          </div>
          <div className="nutrient-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
            <div className="nutrient">
              <div className="val">{catalog?.count ?? "…"}</div>
              <div className="lbl">Catalog</div>
            </div>
            <div className="nutrient">
              <div className="val">{fridge.length}</div>
              <div className="lbl">In fridge</div>
            </div>
            <div className="nutrient">
              <div className="val">{foods.filter((f) => f.macros_complete).length || "—"}</div>
              <div className="lbl">W/ macros</div>
            </div>
          </div>
        </section>
      </div>

      <aside className="rail">
        <div className="card card-pad">
          <h2 className="card-title">Catalog source</h2>
          <p className="muted text-sm mt-8">
            {catalog?.source ?? "Loading…"}
            <br />
            <span className="text-sm">CC BY-NC 4.0 FooDB data · attribution required</span>
          </p>
        </div>
      </aside>
    </div>
  );
}
