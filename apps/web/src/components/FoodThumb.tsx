import { useEffect, useMemo, useState } from "react";
import type { CatalogFood } from "../types";

type Props = {
  food: CatalogFood;
  size?: "sm" | "md" | "lg";
  className?: string;
};

function buildCandidates(food: CatalogFood): string[] {
  const list: string[] = [];
  if (food.picture_candidates?.length) list.push(...food.picture_candidates);
  if (food.picture) list.push(food.picture);
  return [...new Set(list.filter(Boolean))];
}

function monogram(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/** Hash food id to a stable warm hue for CSS placeholders */
function hueFromId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 360;
}

export function FoodThumb({ food, size = "md", className = "" }: Props) {
  const candidates = useMemo(() => buildCandidates(food), [food]);
  const [idx, setIdx] = useState(0);
  const [failedAll, setFailedAll] = useState(false);

  useEffect(() => {
    setIdx(0);
    setFailedAll(false);
  }, [food.id, food.fdc_id]);

  const src = !failedAll && idx < candidates.length ? candidates[idx] : null;
  const hue = hueFromId(food.id);

  const onError = () => {
    if (idx + 1 < candidates.length) {
      setIdx((i) => i + 1);
    } else {
      setFailedAll(true);
    }
  };

  const fallback = (
    <span
      className="food-placeholder"
      style={{ ["--ph-hue" as string]: String(hue) }}
      aria-hidden
    >
      <span className="food-placeholder-letter">{monogram(food.name)}</span>
    </span>
  );

  if (size === "lg") {
    return (
      <div className={`plate-media ${className}`.trim()}>
        {src ? (
          <img src={src} alt={food.name} className="plate-img" onError={onError} />
        ) : (
          fallback
        )}
      </div>
    );
  }

  return (
    <div className={`ing-icon ${className}`.trim()} aria-hidden>
      {src ? <img src={src} alt="" className="ing-img" onError={onError} /> : fallback}
    </div>
  );
}
