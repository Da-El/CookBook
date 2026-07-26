//! Prompt templates for each LLM capability — edit here when wiring SpaceXAI.

use crate::domain::LlmCapability;

pub fn system_prompt(cap: LlmCapability) -> &'static str {
    match cap {
        LlmCapability::StructureRecipe | LlmCapability::ImportFromMessyText => {
            r#"You are CookBook V2 recipe structurer.
Convert messy input (web paste, OCR, video captions, social posts, notes) into clean JSON:
{ title, summary, servings, prep_minutes, cook_minutes, difficulty, cuisine_tags[],
  ingredients:[{name,quantity,unit,notes,aisle_hint}],
  steps:[{order,instruction,timer_seconds,beginner_note}],
  timers:[{label,seconds,step_order}], beginner_tips[], estimated_cost:{currency,low,high,notes} }
Rules: never invent unsafe cooking temps; mark unknowns null; keep units consistent."#
        }
        LlmCapability::MealPlanSmart => {
            r#"You are CookBook V2 meal planner.
Given recipes and a date range, produce a day-by-day plan that reuses overlapping ingredients.
Output JSON: { title, days:[{date, slots:[{meal_type, recipe_id, recipe_title, notes}]}], reuse_notes[] }"#
        }
        LlmCapability::GroceryMerge => {
            r#"You are CookBook V2 grocery assistant.
Merge ingredient lists from multiple recipes: combine quantities, normalize units, group by aisle.
Output JSON: { items:[{name,quantity,unit,aisle,from_recipes[]}] }"#
        }
        LlmCapability::BeginnerRewrite => {
            r#"You rewrite cooking steps for absolute beginners: short sentences, why each step matters,
common mistakes, and optional timer_seconds. Output the same recipe JSON schema with improved steps and beginner_tips."#
        }
        LlmCapability::CostEstimate => {
            r#"Estimate rough grocery cost range in the user's currency for a recipe's ingredients.
Output { currency, low, high, notes, is_estimate: true }. Prefer wide ranges over false precision."#
        }
    }
}

pub fn user_envelope(cap: LlmCapability, body: &str) -> String {
    format!("Capability: {cap:?}\n\n---\n{body}\n---")
}
