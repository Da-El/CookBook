import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError, type FollowUserDto } from "../lib/api";
import { mediaUrl } from "../lib/photo";

export type FollowListKind = "followers" | "following";

type Props = {
  open: boolean;
  kind: FollowListKind;
  handle: string;
  onClose: () => void;
};

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function FollowListModal({ open, kind, handle, onClose }: Props) {
  const [items, setItems] = useState<FollowUserDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !handle) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    const req =
      kind === "followers"
        ? api.listUserFollowers(handle)
        : api.listUserFollowing(handle);
    req
      .then((res) => {
        if (!cancelled) setItems(res.items ?? []);
      })
      .catch((err) => {
        if (!cancelled) {
          setItems([]);
          setError(err instanceof ApiError ? err.message : "Could not load list");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, kind, handle]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const title = kind === "followers" ? "Followers" : "Following";
  const empty =
    kind === "followers" ? "No followers yet." : "Not following anyone yet.";

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal follow-list-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="follow-list-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <h2 id="follow-list-title">{title}</h2>
            <p className="muted text-sm mt-4">@{handle}</p>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="modal-body follow-list-body">
          {loading ? (
            <p className="muted">Loading…</p>
          ) : error ? (
            <p className="form-error">{error}</p>
          ) : items.length === 0 ? (
            <p className="muted">{empty}</p>
          ) : (
            <ul className="follow-list">
              {items.map((u) => {
                const av = mediaUrl(u.avatar_url);
                return (
                  <li key={u.id}>
                    <Link
                      to={`/u/${encodeURIComponent(u.handle)}`}
                      className="follow-list-row"
                      onClick={onClose}
                    >
                      {av ? (
                        <img className="follow-list-av" src={av} alt="" />
                      ) : (
                        <span className="follow-list-av follow-list-av--fallback" aria-hidden>
                          {initialsOf(u.display_name)}
                        </span>
                      )}
                      <span className="follow-list-meta">
                        <span className="follow-list-name">{u.display_name}</span>
                        <span className="follow-list-handle">@{u.handle}</span>
                        {u.bio?.trim() ? (
                          <span className="follow-list-bio">{u.bio.trim()}</span>
                        ) : null}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
