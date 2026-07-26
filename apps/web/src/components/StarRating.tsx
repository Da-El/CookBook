type Props = {
  /** Current score 0–10 (0 = unrated) */
  value: number;
  onChange?: (n: number) => void;
  size?: "sm" | "lg";
  max?: number;
  showValue?: boolean;
};

/**
 * 10-star rating (Grok Cookbook standard for meals and ingredients).
 */
export function StarRating({
  value,
  onChange,
  size = "sm",
  max = 10,
  showValue = true,
}: Props) {
  const interactive = Boolean(onChange);
  const clamped = Math.max(0, Math.min(max, Math.round(value)));

  return (
    <div className={`star-rating ${size === "lg" ? "star-rating--lg" : ""}`}>
      <div
        className="stars"
        role={interactive ? "radiogroup" : "img"}
        aria-label={`${clamped} of ${max} stars`}
      >
        {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            className={`star-btn ${n <= clamped ? "on" : ""}`}
            disabled={!interactive}
            onClick={() => onChange?.(n === clamped ? 0 : n)}
            aria-label={`${n} of ${max} stars`}
            title={`${n}/10`}
          >
            {n <= clamped ? "★" : "☆"}
          </button>
        ))}
      </div>
      {showValue && (
        <span className="star-score">
          {clamped > 0 ? (
            <>
              <strong>{clamped}</strong>
              <span className="muted">/{max}</span>
            </>
          ) : (
            <span className="muted">Not rated</span>
          )}
        </span>
      )}
    </div>
  );
}
