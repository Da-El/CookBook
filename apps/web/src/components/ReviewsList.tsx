import { Link } from "react-router-dom";
import { StarRating } from "./StarRating";
import type { ReviewDto } from "../lib/api";

type Props = {
  reviews: ReviewDto[];
  loading?: boolean;
  emptyText?: string;
  title?: string;
  avg?: number | null;
};

export function ReviewsList({
  reviews,
  loading,
  emptyText = "No reviews yet.",
  title = "Reviews",
  avg,
}: Props) {
  return (
    <section className="card card-pad">
      <div className="card-head">
        <h2 className="card-title">{title}</h2>
        {reviews.length > 0 && (
          <span className="text-sm muted">
            {avg != null ? (
              <>
                avg <strong>{avg.toFixed(1)}</strong>/10 · {reviews.length}
              </>
            ) : (
              <>{reviews.length}</>
            )}
          </span>
        )}
      </div>

      {loading ? (
        <p className="muted text-sm mt-8">Loading reviews…</p>
      ) : reviews.length === 0 ? (
        <p className="muted text-sm mt-8">{emptyText}</p>
      ) : (
        <ul className="ing-list mt-12">
          {reviews.map((r) => (
            <li key={r.id} className="ing-row">
              <div className="avatar avatar--sm avatar--accent">
                <span>
                  {r.display_name
                    .split(/\s+/)
                    .map((w) => w[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase() || "?"}
                </span>
              </div>
              <div className="ing-meta">
                <div className="name">
                  <Link to={`/u/${encodeURIComponent(r.handle)}`} className="linkish">
                    {r.display_name}
                  </Link>{" "}
                  <span className="muted text-sm">@{r.handle}</span>
                </div>
                <div className="group">
                  <StarRating value={r.score} showValue />
                </div>
                {r.notes ? <p className="text-sm mt-8" style={{ margin: 0 }}>{r.notes}</p> : null}
                <p className="text-sm muted mt-4" style={{ margin: 0 }}>
                  {new Date(r.updated_at).toLocaleDateString()}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
