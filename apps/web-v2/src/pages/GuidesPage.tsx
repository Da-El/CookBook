import { useEffect, useState } from "react";
import { v2, type Guide } from "../lib/api";

export function GuidesPage() {
  const [items, setItems] = useState<Guide[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    v2.guides()
      .then((r) => setItems(r.items))
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div>
      <h1>Beginner guides</h1>
      <p className="lede">Static tips now; LLM can rewrite recipe steps into beginner mode later.</p>
      {error && <p className="error">{error}</p>}
      <div className="grid" style={{ marginTop: 16 }}>
        {items.map((g) => (
          <article key={g.id} className="card">
            <h3>{g.title}</h3>
            <p style={{ marginTop: 8 }}>{g.body}</p>
            <div className="chips">
              {g.topics.map((t) => (
                <span key={t} className="chip">
                  {t}
                </span>
              ))}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
