export type Macros = {
  energy_kcal: number | null;
  protein_g: number | null;
  fat_g: number | null;
  carbs_g: number | null;
  fiber_g: number | null;
};

export type NutrientAmount = {
  name: string;
  amount: number;
  unit: string;
};

export type CatalogFood = {
  id: string;
  foodb_id: number;
  name: string;
  name_scientific: string | null;
  description: string;
  food_group: string;
  food_subgroup: string;
  picture: string | null;
  /** Fallback image URLs when primary 404s (FooDB dump often has wrong extension). */
  picture_candidates?: string[];
  emoji: string;
  source: string;
  macros: Macros;
  macros_complete: boolean;
  micros: NutrientAmount[];
  other_nutrients: NutrientAmount[];
  /** Where nutrient values came from after USDA overlay */
  nutrient_sources?: {
    macros?: string;
    micros?: string;
    usda_fdc_id?: number;
    usda_description?: string;
  };
};

export type CatalogPayload = {
  version: number;
  source: string;
  license: string;
  generated_at: string;
  count: number;
  foods: CatalogFood[];
};

/** Single storage location — fridge only. */
export type FridgeLocation = "Fridge";

export type FridgeItem = {
  id: string;
  foodId: string;
  quantity: string;
  location: FridgeLocation;
  boughtOn: string | null;
  expiresOn: string | null;
  /** @deprecated use catalog ratings; kept for fridge-entry notes */
  rating: number | null;
  notes: string;
  addedAt: string;
  photoUrl: string | null;
};

/** 1–10 star community-style rating stored per user (local for now) */
export type SubjectRating = {
  subjectType: "ingredient" | "meal";
  subjectId: string;
  score: number; // 1–10
  notes: string;
  updatedAt: string;
};

export type Theme = "light" | "dark";
