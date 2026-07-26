import { useEffect, useState } from "react";
import { v2, type GalleryItem } from "../lib/api";

export function GalleryPage() {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    v2.gallery()
      .then((r) => setItems(r.items))
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div>
      <h1>Recipe gallery</h1>
      <p className="lede">Inspiration beyond your saved recipes (stub catalog for now).</p>
      {error && <p className="error">{error}</p>}
      <div className="grid grid-2">
        {items.map((g) => (
          <article key={g.id} className="card">
            <h3>{g.title}</h3>
            <p className="muted" style={{ marginTop: 6 }}>
              {g.blurb}
            </p>
            <div className="chips">
              {g.tags.map((t) => (
                <span key={t} className="chip">
                  {t}
                </span>
              ))}
              {g.is_stub && <span className="chip green">stub</span>}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
