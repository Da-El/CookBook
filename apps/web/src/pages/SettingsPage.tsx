import { Link } from "react-router-dom";
import { useApp } from "../context/AppContext";

export function SettingsPage() {
  const { theme, toggleTheme, fridge, catalog, clearFridge } = useApp();

  return (
    <div className="page page--single">
      <div className="column">
        <div className="page-hero">
          <div>
            <h1>Settings</h1>
            <p className="lede">Appearance and local kitchen data</p>
          </div>
        </div>

        <section className="card">
          <div className="settings-group">Appearance</div>
          <div className="settings-item" style={{ cursor: "default" }}>
            <div className="left">
              <div className="ico-box" aria-hidden>
                ◐
              </div>
              <div className="copy">
                <div className="title">Theme</div>
                <div className="desc">Currently {theme}</div>
              </div>
            </div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={toggleTheme}>
              {theme === "dark" ? "☀️ Light" : "🌙 Dark"}
            </button>
          </div>

          <div className="settings-group">Local data</div>
          <div className="settings-item" style={{ cursor: "default" }}>
            <div className="left">
              <div className="ico-box" aria-hidden>
                🧊
              </div>
              <div className="copy">
                <div className="title">Fridge items</div>
                <div className="desc">{fridge.length} stored in this browser</div>
              </div>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                if (confirm("Clear fridge?")) clearFridge();
              }}
            >
              Clear
            </button>
          </div>
          <div className="settings-item" style={{ cursor: "default" }}>
            <div className="left">
              <div className="ico-box" aria-hidden>
                📚
              </div>
              <div className="copy">
                <div className="title">Catalog</div>
                <div className="desc">
                  {catalog ? `${catalog.count} foods · ${catalog.source}` : "Not loaded"}
                </div>
              </div>
            </div>
            <Link to="/ingredients/add" className="btn btn-soft btn-sm">
              Browse
            </Link>
          </div>

          <div className="settings-group">Coming later</div>
          <div className="settings-item">
            <div className="left">
              <div className="ico-box">🔑</div>
              <div className="copy">
                <div className="title">Account &amp; auth</div>
                <div className="desc">Enterprise sign-in ships with the Rust backend</div>
              </div>
            </div>
            <span className="chev">›</span>
          </div>
        </section>
      </div>
    </div>
  );
}
