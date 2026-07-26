import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BrandMark } from "../components/Icons";
import { StarRating } from "../components/StarRating";
import { useApp } from "../context/AppContext";
import { api, ApiError, type FeedItemDto } from "../lib/api";

export function HomePage() {
  const { user, authLoading } = useApp();
  const [items, setItems] = useState<FeedItemDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFeed = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.feed({ tab: "following", limit: 30 });
      setItems(res.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load feed");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) loadFeed();
  }, [user, loadFeed]);

  if (authLoading) {
    return (
      <div className="page page--single">
        <div className="column">
          <p className="muted">Loading…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="page page--single">
        <div className="column">
          <section className="hero-welcome card">
            <div className="hero-welcome-inner">
              <BrandMark />
              <h1>CookBook</h1>
              <p className="lede">
                A kitchen journal for chefs — follow cooks you trust, stock a real fridge, and keep
                every meal in one place.
              </p>
              <div className="row-end mt-16" style={{ justifyContent: "flex-start", gap: 10 }}>
                <Link to="/signup" className="btn btn-primary">
                  Join CookBook
                </Link>
                <Link to="/login" className="btn btn-secondary">
                  Sign in
                </Link>
                <Link to="/browse" className="btn btn-ghost">
                  Browse
                </Link>
              </div>
            </div>
          </section>

          <div className="feature-row">
            <div className="card card-pad feature-card">
              <h2 className="card-title">Home feed</h2>
              <p className="muted text-sm mt-8">Meals from chefs you follow, in order they were logged.</p>
            </div>
            <div className="card card-pad feature-card">
              <h2 className="card-title">Browse</h2>
              <p className="muted text-sm mt-8">Search catalog ingredients and public meal pages.</p>
            </div>
            <div className="card card-pad feature-card">
              <h2 className="card-title">Your CookBook</h2>
              <p className="muted text-sm mt-8">Cooked, want-to-cook, fridge, and match suggestions.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="column">
        <div className="page-hero">
          <div>
            <h1>Home</h1>
            <p className="lede">Meals from chefs you follow</p>
          </div>
        </div>

        {error && (
          <div className="card card-pad">
            <p className="text-sm">{error}</p>
          </div>
        )}

        {loading && <p className="muted">Loading feed…</p>}

        {!loading && items.length === 0 && (
          <section className="card card-pad empty-state">
            <div className="empty-glyph" aria-hidden />
            <p className="muted mt-12">
              Your feed is empty. Create a public meal, or follow another chef so their meals show
              up here.
            </p>
            <div className="row-end mt-12" style={{ justifyContent: "center", gap: 10 }}>
              <Link to="/create/meal" className="btn btn-primary btn-sm">
                Create a meal
              </Link>
              <Link to="/browse" className="btn btn-secondary btn-sm">
                Browse
              </Link>
            </div>
          </section>
        )}

        {items.map((item) => {
          const m = item.meal;
          return (
            <article key={item.id} className="card feed-card">
              <div className="feed-card-head">
                <Link
                  to={`/u/${encodeURIComponent(m.author.handle)}`}
                  className="avatar avatar--sm avatar--accent"
                >
                  <span>
                    {m.author.display_name
                      .split(/\s+/)
                      .map((w) => w[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()}
                  </span>
                </Link>
                <div className="feed-card-author">
                  <Link to={`/u/${encodeURIComponent(m.author.handle)}`} className="linkish">
                    <strong>{m.author.display_name}</strong>
                    <span className="muted"> @{m.author.handle}</span>
                  </Link>
                  <p className="text-sm muted">
                    {new Date(m.created_at).toLocaleString()} ·{" "}
                    {m.status === "want_to_cook" ? "Want to cook" : "Cooked"}
                  </p>
                </div>
              </div>
              <Link to={`/meals/${m.id}`} className="feed-card-body">
                <div className="feed-card-media">
                  {m.photo_url ? (
                    <img
                      src={m.photo_url}
                      alt=""
                      className="feed-card-photo"
                    />
                  ) : (
                    <span className="meal-card-glyph" aria-hidden />
                  )}
                </div>
                <div>
                  <h2 className="feed-card-title">{m.title}</h2>
                  {m.story && (
                    <p className="muted text-sm mt-8">
                      {m.story.slice(0, 180)}
                      {m.story.length > 180 ? "…" : ""}
                    </p>
                  )}
                  <div className="feed-card-meta mt-12">
                    {m.author_rating != null && <StarRating value={m.author_rating} showValue />}
                    {m.review_count > 0 && (
                      <span className="text-sm muted">
                        Community {m.review_avg?.toFixed(1)}/10 ({m.review_count})
                      </span>
                    )}
                    {m.macros_estimated?.kcal != null && (
                      <span className="text-sm muted">~{m.macros_estimated.kcal} kcal</span>
                    )}
                  </div>
                </div>
              </Link>
            </article>
          );
        })}
      </div>

      <aside className="rail">
        <div className="card card-pad">
          <h2 className="card-title">@{user.handle}</h2>
          <p className="muted text-sm mt-8">Your kitchen journal is under CookBook.</p>
          <Link to="/cookbook" className="btn btn-secondary btn-sm mt-12">
            Open CookBook
          </Link>
        </div>
      </aside>
    </div>
  );
}
