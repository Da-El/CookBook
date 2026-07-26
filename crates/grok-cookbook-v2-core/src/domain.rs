//! Shared V2 domain types — API and UI both speak this shape.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use ulid::Ulid;

fn new_id() -> String {
    Ulid::new().to_string()
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

/// Where a raw recipe blob came from (before LLM structuring).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ImportSourceKind {
    WebsiteUrl,
    CookbookScan,
    HandwrittenNote,
    VideoTranscript,
    SocialPost,
    FreeText,
    /// LLM / vision not wired yet
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportRequest {
    pub kind: ImportSourceKind,
    /// URL, free text, OCR dump, captions, etc.
    pub payload: String,
    /// Optional title hint from the user
    #[serde(default)]
    pub title_hint: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportJob {
    pub id: String,
    pub kind: ImportSourceKind,
    pub status: JobStatus,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    /// Structured result when ready
    #[serde(default)]
    pub recipe: Option<Recipe>,
    /// Human-readable progress / errors
    #[serde(default)]
    pub message: String,
    /// Raw payload kept for re-runs when LLM is wired
    #[serde(default)]
    pub raw_payload: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum JobStatus {
    Queued,
    /// Waiting for LLM (provider not configured or stub)
    AwaitingLlm,
    Completed,
    Failed,
}

// ---------------------------------------------------------------------------
// Recipe (V2 structured form — LLM target schema)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Recipe {
    pub id: String,
    pub title: String,
    #[serde(default)]
    pub summary: String,
    #[serde(default)]
    pub servings: Option<u32>,
    #[serde(default)]
    pub prep_minutes: Option<u32>,
    #[serde(default)]
    pub cook_minutes: Option<u32>,
    #[serde(default)]
    pub difficulty: Difficulty,
    #[serde(default)]
    pub cuisine_tags: Vec<String>,
    #[serde(default)]
    pub ingredients: Vec<IngredientLine>,
    #[serde(default)]
    pub steps: Vec<CookingStep>,
    #[serde(default)]
    pub timers: Vec<TimerHint>,
    #[serde(default)]
    pub beginner_tips: Vec<String>,
    #[serde(default)]
    pub estimated_cost: Option<CostEstimate>,
    #[serde(default)]
    pub source: Option<ImportSourceKind>,
    #[serde(default)]
    pub source_ref: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum Difficulty {
    #[default]
    Unknown,
    Beginner,
    Intermediate,
    Advanced,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IngredientLine {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub quantity: Option<f64>,
    #[serde(default)]
    pub unit: Option<String>,
    #[serde(default)]
    pub notes: String,
    /// For grocery grouping later
    #[serde(default)]
    pub aisle_hint: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CookingStep {
    pub id: String,
    pub order: u32,
    pub instruction: String,
    /// Optional timer started when this step begins
    #[serde(default)]
    pub timer_seconds: Option<u32>,
    #[serde(default)]
    pub beginner_note: Option<String>,
}

/// A named timer the cook UI can run (multiple concurrent).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimerHint {
    pub id: String,
    pub label: String,
    pub seconds: u32,
    #[serde(default)]
    pub step_order: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CostEstimate {
    pub currency: String,
    pub low: f64,
    pub high: f64,
    #[serde(default)]
    pub notes: String,
    /// Always false until LLM/pricing service is real
    pub is_estimate: bool,
}

impl Recipe {
    pub fn new_stub(title: &str) -> Self {
        let now = Utc::now();
        Self {
            id: new_id(),
            title: title.to_string(),
            summary: "Stub recipe — LLM structuring not wired yet.".into(),
            servings: Some(4),
            prep_minutes: Some(15),
            cook_minutes: Some(30),
            difficulty: Difficulty::Beginner,
            cuisine_tags: vec!["stub".into()],
            ingredients: vec![
                IngredientLine {
                    id: new_id(),
                    name: "Example ingredient".into(),
                    quantity: Some(1.0),
                    unit: Some("cup".into()),
                    notes: String::new(),
                    aisle_hint: Some("pantry".into()),
                },
            ],
            steps: vec![
                CookingStep {
                    id: new_id(),
                    order: 1,
                    instruction: "Prep ingredients (replace with LLM-parsed steps).".into(),
                    timer_seconds: None,
                    beginner_note: Some("Read the whole recipe once before starting.".into()),
                },
                CookingStep {
                    id: new_id(),
                    order: 2,
                    instruction: "Cook according to your source.".into(),
                    timer_seconds: Some(600),
                    beginner_note: None,
                },
            ],
            timers: vec![TimerHint {
                id: new_id(),
                label: "Example simmer".into(),
                seconds: 600,
                step_order: Some(2),
            }],
            beginner_tips: vec![
                "Mise en place: measure everything first.".into(),
                "Taste as you go.".into(),
            ],
            estimated_cost: Some(CostEstimate {
                currency: "USD".into(),
                low: 8.0,
                high: 14.0,
                notes: "Placeholder range — cost model not wired.".into(),
                is_estimate: true,
            }),
            source: None,
            source_ref: None,
            created_at: now,
            updated_at: now,
        }
    }
}

// ---------------------------------------------------------------------------
// Meal planning
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MealPlan {
    pub id: String,
    pub title: String,
    pub start_date: String, // YYYY-MM-DD
    pub days: Vec<MealPlanDay>,
    #[serde(default)]
    pub reuse_notes: Vec<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MealPlanDay {
    pub date: String,
    pub slots: Vec<MealSlot>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MealSlot {
    pub id: String,
    pub meal_type: MealType,
    #[serde(default)]
    pub recipe_id: Option<String>,
    #[serde(default)]
    pub recipe_title: Option<String>,
    #[serde(default)]
    pub notes: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum MealType {
    Breakfast,
    Lunch,
    Dinner,
    Snack,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateMealPlanRequest {
    pub title: String,
    pub start_date: String,
    /// Number of days (default 7)
    #[serde(default = "default_days")]
    pub days: u32,
    /// Recipe ids the planner may use
    #[serde(default)]
    pub recipe_ids: Vec<String>,
    /// Prefer reusing ingredients across days (LLM flag later)
    #[serde(default)]
    pub smart_reuse: bool,
}

fn default_days() -> u32 {
    7
}

// ---------------------------------------------------------------------------
// Grocery
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GroceryList {
    pub id: String,
    pub title: String,
    pub items: Vec<GroceryItem>,
    /// Recipe ids this list was built from
    #[serde(default)]
    pub source_recipe_ids: Vec<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GroceryItem {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub quantity: Option<f64>,
    #[serde(default)]
    pub unit: Option<String>,
    #[serde(default)]
    pub aisle: Option<String>,
    pub checked: bool,
    #[serde(default)]
    pub from_recipes: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BuildGroceryRequest {
    pub recipe_ids: Vec<String>,
    #[serde(default)]
    pub title: Option<String>,
}

// ---------------------------------------------------------------------------
// Cooking session + multi-timer runtime
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CookingSession {
    pub id: String,
    pub recipe_id: String,
    pub recipe_title: String,
    pub current_step: u32,
    pub timers: Vec<ActiveTimer>,
    pub started_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActiveTimer {
    pub id: String,
    pub label: String,
    pub total_seconds: u32,
    /// Seconds remaining when last synced (client owns countdown UI)
    pub remaining_seconds: u32,
    pub running: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StartCookingRequest {
    pub recipe_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimerActionRequest {
    pub timer_id: String,
    pub action: TimerAction,
    /// For set_remaining
    #[serde(default)]
    pub remaining_seconds: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TimerAction {
    Start,
    Pause,
    Reset,
    SetRemaining,
}

// ---------------------------------------------------------------------------
// Gallery / guides (nice-to-have bones)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GalleryItem {
    pub id: String,
    pub title: String,
    pub blurb: String,
    pub tags: Vec<String>,
    /// Placeholder image key / URL later
    #[serde(default)]
    pub image_hint: Option<String>,
    pub is_stub: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BeginnerGuide {
    pub id: String,
    pub title: String,
    pub body: String,
    pub topics: Vec<String>,
}

// ---------------------------------------------------------------------------
// LLM job envelope (generic)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LlmCapabilityRequest {
    pub capability: LlmCapability,
    pub input: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum LlmCapability {
    StructureRecipe,
    MealPlanSmart,
    GroceryMerge,
    BeginnerRewrite,
    CostEstimate,
    ImportFromMessyText,
}
