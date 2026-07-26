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
  if (food.foodb_id) {
    const id = food.foodb_id;
    list.push(
      `https://foodb.ca/system/foods/pictures/${id}/full/${id}.png`,
      `https://foodb.ca/system/foods/pictures/${id}/full/${id}.jpg`,
      `https://foodb.ca/system/foods/pictures/${id}/thumb/${id}.png`,
      `https://foodb.ca/system/foods/pictures/${id}/thumb/${id}.jpg`,
    );
  }
  return [...new Set(list.filter(Boolean))];
}

export function FoodThumb({ food, size = "md", className = "" }: Props) {
  const candidates = useMemo(() => buildCandidates(food), [food]);
  const [idx, setIdx] = useState(0);
  const [failedAll, setFailedAll] = useState(false);

  useEffect(() => {
    setIdx(0);
    setFailedAll(false);
  }, [food.id, food.foodb_id]);

  const src = !failedAll && idx < candidates.length ? candidates[idx] : null;

  const onError = () => {
    if (idx + 1 < candidates.length) {
      setIdx((i) => i + 1);
    } else {
      setFailedAll(true);
    }
  };

  if (size === "lg") {
    return (
      <div className={`plate-media ${className}`.trim()}>
        {src ? (
          <img src={src} alt={food.name} className="plate-img" onError={onError} />
        ) : (
          <span aria-hidden className="plate-emoji">
            {food.emoji}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={`ing-icon ${className}`.trim()} aria-hidden>
      {src ? <img src={src} alt="" className="ing-img" onError={onError} /> : food.emoji}
    </div>
  );
}
