import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { api, apiBase } from "../lib/api";

export function HomePage() {
  const { fridge, foods, catalog, user } = useApp();
  const [apiStatus, setApiStatus] = useState<string>("checking…");

  useEffect(() => {
    api
      .health()
      .then((h) => setApiStatus(`${h.status} · ${h.service} v${h.version}`))
      .catch(() => setApiStatus("offline (using static catalog)"));
  }, []);

  return (
    <div className="page">
      <div className="column">
        <div className="page-hero">
          <div>
            <h1>Today’s table</h1>
            <p className="lede">React + Vite frontend · Rust/Axum API · PostgreSQL · Render</p>
          </div>
        </div>

        <section className="card card-pad">
          <h2 className="card-title">Welcome to Grok Cookbook</h2>
          <p className="muted text-sm mt-8">
            Browse FooDB ingredients, stock your fridge, rate foods.
            {user ? (
              <> Signed in as <strong>@{user.handle}</strong>.</>
            ) : (
              <> Sign in to sync fridge to Postgres.</>
            )}
          </p>
          <div className="row-end mt-16" style={{ justifyContent: "flex-start", gap: 10 }}>
            <Link to="/ingredients/browse" className="btn btn-primary">
              Browse all foods
            </Link>
            {!user && (
              <Link to="/signup" className="btn btn-secondary">
                Create account
              </Link>
            )}
            <Link to="/ingredients" className="btn btn-secondary">
              Open fridge
            </Link>
          </div>
        </section>

        <section className="card card-pad">
          <div className="card-head">
            <h2 className="card-title">Stack status</h2>
          </div>
          <div className="nutrient-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
            <div className="nutrient">
              <div className="val">{catalog?.count ?? "…"}</div>
              <div className="lbl">Foods</div>
            </div>
            <div className="nutrient">
              <div className="val">{fridge.length}</div>
              <div className="lbl">Fridge</div>
            </div>
            <div className="nutrient">
              <div className="val">{foods.filter((f) => f.macros_complete).length || "—"}</div>
              <div className="lbl">W/ macros</div>
            </div>
          </div>
          <p className="text-sm muted mt-16">
            API base: <code>{apiBase()}</code>
            <br />
            Health: {apiStatus}
          </p>
        </section>
      </div>

      <aside className="rail">
        <div className="card card-pad">
          <h2 className="card-title">Deploy</h2>
          <p className="muted text-sm mt-8">
            Connect this repo on Render with <code>render.yaml</code> — API + Postgres + static SPA in one Docker
            service.
          </p>
        </div>
      </aside>
    </div>
  );
}
