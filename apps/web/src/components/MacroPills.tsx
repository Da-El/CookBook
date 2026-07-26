import type { Macros } from "../types";

export function MacroPills({ macros }: { macros: Macros }) {
  const items: { label: string; value: string }[] = [];
  if (macros.energy_kcal != null) items.push({ label: "kcal", value: String(macros.energy_kcal) });
  if (macros.protein_g != null) items.push({ label: "protein", value: `${macros.protein_g}g` });
  if (macros.fat_g != null) items.push({ label: "fat", value: `${macros.fat_g}g` });
  if (macros.carbs_g != null) items.push({ label: "carbs", value: `${macros.carbs_g}g` });
  if (macros.fiber_g != null) items.push({ label: "fiber", value: `${macros.fiber_g}g` });

  if (!items.length) {
    return <p className="muted text-sm">No macro data in catalog for this food.</p>;
  }

  return (
    <div className="macro-row">
      {items.map((it) => (
        <span key={it.label} className="macro">
          <strong>{it.value}</strong> {it.label}
        </span>
      ))}
    </div>
  );
}
