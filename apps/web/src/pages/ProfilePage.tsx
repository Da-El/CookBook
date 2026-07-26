import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  CookbookProfile,
  profileToCookbookData,
} from "../components/CookbookProfile";
import { ProfileCustomize } from "../components/ProfileCustomize";
import { StarRating } from "../components/StarRating";
import { useApp } from "../context/AppContext";
import { api, ApiError, type MealDto, type ProfileDto } from "../lib/api";
import { mediaUrl } from "../lib/photo";

const TABS = ["Cooked", "Want to cook"] as const;
type Tab = (typeof TABS)[number];

export function ProfilePage() {
  const { handle = "" } = useParams();
  const { user, patchUser } = useApp();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileDto | null>(null);
  const [meals, setMeals] = useState<MealDto[]>([]);
  const [tab, setTab] = useState<Tab>("Cooked");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [followBusy, setFollowBusy] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);

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

  return (
    <div className="page">
      <div className="column">
        <CookbookProfile
          data={profileToCookbookData(profile)}
          actions={
            profile.is_self ? (
              <>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => setCustomizeOpen(true)}
                >
                  Personalize
                </button>
                <Link to="/cookbook" className="btn btn-secondary btn-sm">
                  My CookBook
                </Link>
              </>
            ) : (
              <button
                type="button"
                className={`btn btn-sm ${profile.is_following ? "btn-secondary" : "btn-primary"}`}
                disabled={followBusy}
                onClick={toggleFollow}
              >
                {profile.is_following ? "Following" : "Follow"}
              </button>
            )
          }
        />

        <div className="seg" role="tablist">
          {TABS.map((t) => {
            const count = t === "Cooked" ? profile.cooked_count : profile.want_count;
            return (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                className={tab === t ? "active" : undefined}
                onClick={() => setTab(t)}
              >
                {t} <span className="seg-count">{count}</span>
              </button>
            );
          })}
        </div>

        <section className="cookbook-chapter">
          <div className="cookbook-chapter-head">
            <div>
              <h2>{tab === "Cooked" ? "Cooked" : "Want to cook"}</h2>
              <p className="muted text-sm mt-4">
                Meals from {profile.display_name.split(/\s+/)[0]}
              </p>
            </div>
          </div>
          <div className="cookbook-chapter-body">
            {meals.length === 0 ? (
              <div className="empty-state">
                <p className="muted">No meals in this list yet.</p>
                {profile.is_self && (
                  <Link to="/create/meal" className="btn btn-primary btn-sm mt-12">
                    Add a meal
                  </Link>
                )}
              </div>
            ) : (
              <div className="cookbook-meal-grid">
                {meals.map((m) => {
                  const img = mediaUrl(m.photo_url);
                  return (
                    <Link key={m.id} to={`/meals/${m.id}`} className="cookbook-meal-card">
                      <div className="cookbook-meal-media">
                        {img ? <img src={img} alt="" /> : <span className="meal-thumb-ring" aria-hidden />}
                      </div>
                      <div className="cookbook-meal-body">
                        <div className="name">{m.title}</div>
                        <div className="meta">
                          {m.cuisine || "Meal"}
                          {m.time_minutes ? ` · ${m.time_minutes} min` : ""}
                        </div>
                        {m.author_rating != null && (
                          <div className="mt-8">
                            <StarRating value={m.author_rating} showValue />
                          </div>
                        )}
                        {m.story && (
                          <p className="text-sm muted mt-8" style={{ margin: 0 }}>
                            {m.story.slice(0, 90)}
                            {m.story.length > 90 ? "…" : ""}
                          </p>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>

      <aside className="rail">
        <div className="card card-pad">
          <h2 className="card-title">This volume</h2>
          <p className="muted text-sm mt-8">
            Share path <code>/u/{profile.handle}</code>
          </p>
          {profile.is_self && (
            <button
              type="button"
              className="btn btn-primary btn-sm mt-12"
              onClick={() => setCustomizeOpen(true)}
            >
              Personalize cover
            </button>
          )}
        </div>
      </aside>

      {profile.is_self && (
        <ProfileCustomize
          open={customizeOpen}
          profile={profile}
          onClose={() => setCustomizeOpen(false)}
          onSaved={(saved) => {
            setProfile(saved);
            patchUser({
              display_name: saved.display_name,
              bio: saved.bio,
            });
          }}
        />
      )}
    </div>
  );
}
