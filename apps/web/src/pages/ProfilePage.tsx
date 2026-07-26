import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { StarRating } from "../components/StarRating";
import { useApp } from "../context/AppContext";
import { api, ApiError, type MealDto, type ProfileDto } from "../lib/api";

const TABS = ["Cooked", "Want to cook"] as const;
type Tab = (typeof TABS)[number];

export function ProfilePage() {
  const { handle = "" } = useParams();
  const { user } = useApp();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileDto | null>(null);
  const [meals, setMeals] = useState<MealDto[]>([]);
  const [tab, setTab] = useState<Tab>("Cooked");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [followBusy, setFollowBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const p = await api.getProfile(handle);
        if (cancelled) return;
        setProfile(p);
        const status = tab === "Cooked" ? "cooked" : "want_to_cook";
        const m = await api.listMeals({ handle: p.handle, status, limit: 50 });
        if (!cancelled) setMeals(m.items);
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Profile not found");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [handle, tab]);

  async function toggleFollow() {
    if (!user) {
      navigate("/login");
      return;
    }
    if (!profile || profile.is_self) return;
    setFollowBusy(true);
    try {
      if (profile.is_following) {
        await api.unfollow(profile.handle);
        setProfile({
          ...profile,
          is_following: false,
          followers_count: Math.max(0, profile.followers_count - 1),
        });
      } else {
        await api.follow(profile.handle);
        setProfile({
          ...profile,
          is_following: true,
          followers_count: profile.followers_count + 1,
        });
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Follow failed");
    } finally {
      setFollowBusy(false);
    }
  }

  if (loading && !profile) {
    return (
      <div className="page page--single">
        <div className="column">
          <p className="muted">Loading profile…</p>
        </div>
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="page page--single">
        <div className="column">
          <section className="card card-pad empty-state">
            <h1>Not found</h1>
            <p className="muted mt-8">{error}</p>
          </section>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  const initials = profile.display_name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="page">
      <div className="column">
        <section className="card profile-card">
          <div className="profile-cover" aria-hidden />
          <div className="profile-main">
            <div className="profile-top">
              <div className="avatar avatar--xl avatar--accent">
                <span>{initials}</span>
              </div>
              {profile.is_self ? (
                <Link to="/settings" className="btn btn-secondary btn-sm">
                  Edit profile
                </Link>
              ) : (
                <button
                  type="button"
                  className={`btn btn-sm ${profile.is_following ? "btn-secondary" : "btn-primary"}`}
                  disabled={followBusy}
                  onClick={toggleFollow}
                >
                  {profile.is_following ? "Following" : "Follow"}
                </button>
              )}
            </div>
            <h2 className="profile-name">{profile.display_name}</h2>
            <p className="profile-handle">@{profile.handle}</p>
            {profile.bio && <p className="profile-bio">{profile.bio}</p>}
            <div className="stat-row">
              <span className="stat">
                <strong>{profile.cooked_count}</strong> cooked
              </span>
              <span className="stat">
                <strong>{profile.want_count}</strong> want to cook
              </span>
              <span className="stat">
                <strong>{profile.followers_count}</strong> followers
              </span>
              <span className="stat">
                <strong>{profile.following_count}</strong> following
              </span>
            </div>
          </div>
        </section>

        <div className="seg" role="tablist">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              className={tab === t ? "active" : undefined}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>

        <section className="card card-pad">
          {meals.length === 0 ? (
            <div className="empty-state">
              <p className="muted">No meals in this tab yet.</p>
              {profile.is_self && (
                <Link to="/meals/new" className="btn btn-primary btn-sm mt-12">
                  Log a meal
                </Link>
              )}
            </div>
          ) : (
            <div className="ing-list">
              {meals.map((m) => (
                <Link
                  key={m.id}
                  to={`/meals/${m.id}`}
                  className="ing-row"
                  style={{ textDecoration: "none" }}
                >
                  <div className="meal-thumb" aria-hidden>
                    <span className="meal-thumb-ring" />
                  </div>
                  <div className="ing-meta">
                    <div className="name">{m.title}</div>
                    <div className="group">
                      {m.cuisine || "Meal"}
                      {m.time_minutes ? ` · ${m.time_minutes} min` : ""}
                      {m.author_rating ? (
                        <>
                          {" · "}
                          <StarRating value={m.author_rating} showValue />
                        </>
                      ) : null}
                    </div>
                    {m.story && (
                      <p className="text-sm muted mt-8" style={{ margin: 0 }}>
                        {m.story.slice(0, 120)}
                        {m.story.length > 120 ? "…" : ""}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      <aside className="rail">
        <div className="card card-pad">
          <h2 className="card-title">Share</h2>
          <p className="muted text-sm mt-8">
            Profile path <code>/u/{profile.handle}</code>
          </p>
        </div>
      </aside>
    </div>
  );
}
