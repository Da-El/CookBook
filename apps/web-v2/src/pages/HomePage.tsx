import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { v2 } from "../lib/api";

export function HomePage() {
  const [health, setHealth] = useState<string>("…");
  const [llm, setLlm] = useState<string>("…");

  useEffect(() => {
    v2.health()
      .then((h) =>
        setHealth(
          `${h.status} · product=${h.product} · llm_live=${h.llm_live} · xai_key=${h.xai_key_configured}`,
        ),
      )
      .catch((e) => setHealth(`API offline — start V2 on :8081 (${e.message})`));
    v2.llmStatus()
      .then((s) => setLlm(`${s.provider} · live=${s.live} · ${s.note}`))
      .catch(() => setLlm("LLM status unavailable"));
  }, []);

  return (
    <div>
      <div className="home-hero">
        <h1>CookBook V2</h1>
        <p>
          LLM cooking assistant — import messy recipes, plan meals, grocery lists, step-by-step
          cook mode, and multi-timers. <strong>Bones only</strong> for now (no live model).
        </p>
        <div className="row" style={{ marginTop: 16 }}>
          <Link to="/import" className="btn btn-primary">
            Import a recipe
          </Link>
          <Link to="/recipes" className="btn btn-secondary">
            Browse recipes
          </Link>
        </div>
      </div>

      <div className="banner">
        <strong>Separate from V1</strong> — different app (port 5174), different API (8081), no
        social feed / fridge. Wire SpaceXAI later via <code>XAI_API_KEY</code>.
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2>API status</h2>
        <p className="muted mt" style={{ marginTop: 8 }}>
          {health}
        </p>
        <p className="muted" style={{ marginTop: 6 }}>
          {llm}
        </p>
      </div>

      <h2 style={{ marginTop: 24 }}>Roadmap modules</h2>
      <ul className="feature-list">
        <li>
          <strong>Import</strong> — URLs, notes, OCR, video captions, social (LLM structure later)
        </li>
        <li>
          <strong>Meal planning</strong> — weekly plan + smart ingredient reuse flag
        </li>
        <li>
          <strong>Grocery</strong> — merge ingredients from recipes into a list
        </li>
        <li>
          <strong>Cook mode</strong> — numbered steps + multiple timers
        </li>
        <li>
          <strong>Gallery / guides / cost</strong> — stub data + schema fields ready
        </li>
      </ul>
    </div>
  );
}
