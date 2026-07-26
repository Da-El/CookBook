//! Application services used by V2 API — pure stubs today, LLM later.

use chrono::Utc;
use ulid::Ulid;

use crate::domain::*;
use crate::llm::{LlmProvider, LlmRequest, LlmMessage};
use crate::prompts::{system_prompt, user_envelope};

fn id() -> String {
    Ulid::new().to_string()
}

/// In-memory demo catalog for gallery inspiration (not LLM).
pub fn stub_gallery() -> Vec<GalleryItem> {
    vec![
        GalleryItem {
            id: "gal-1".into(),
            title: "Weeknight grain bowl".into(),
            blurb: "Flexible base + whatever is in the fridge.".into(),
            tags: vec!["quick".into(), "healthy".into()],
            image_hint: None,
            is_stub: true,
        },
        GalleryItem {
            id: "gal-2".into(),
            title: "One-pan chicken & veg".into(),
            blurb: "Minimal dishes, high reward.".into(),
            tags: vec!["dinner".into(), "beginner".into()],
            image_hint: None,
            is_stub: true,
        },
        GalleryItem {
            id: "gal-3".into(),
            title: "Tomato soup from pantry".into(),
            blurb: "Cans + herbs + crusty bread.".into(),
            tags: vec!["budget".into(), "comfort".into()],
            image_hint: None,
            is_stub: true,
        },
    ]
}

pub fn stub_guides() -> Vec<BeginnerGuide> {
    vec![
        BeginnerGuide {
            id: "g-1".into(),
            title: "How to read a recipe".into(),
            body: "Skim ingredients, then steps. Check times. Preheat before you need heat."
                .into(),
            topics: vec!["basics".into()],
        },
        BeginnerGuide {
            id: "g-2".into(),
            title: "Knife safety 101".into(),
            body: "Claw grip, stable board, sharp knife is safer than dull.".into(),
            topics: vec!["safety".into(), "skills".into()],
        },
        BeginnerGuide {
            id: "g-3".into(),
            title: "Salt as you go".into(),
            body: "Season layers lightly; final taste at the end.".into(),
            topics: vec!["flavor".into()],
        },
    ]
}

pub async fn import_recipe_stub(
    llm: &dyn LlmProvider,
    req: ImportRequest,
) -> ImportJob {
    let now = Utc::now();
    // Touch LLM path so wiring is obvious later
    let _ = llm
        .complete(LlmRequest {
            capability: LlmCapability::ImportFromMessyText,
            system: system_prompt(LlmCapability::ImportFromMessyText).into(),
            messages: vec![LlmMessage {
                role: "user".into(),
                content: user_envelope(LlmCapability::ImportFromMessyText, &req.payload),
            }],
            schema_hint: Some("recipe_v2".into()),
        })
        .await;

    let title = req
        .title_hint
        .clone()
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| "Imported recipe (stub)".into());

    let mut recipe = Recipe::new_stub(&title);
    recipe.source = Some(req.kind.clone());
    recipe.source_ref = Some(req.payload.chars().take(200).collect());
    recipe.summary = format!(
        "Stub import from {:?}. Full LLM structuring will replace this when XAI is wired.",
        req.kind
    );

    ImportJob {
        id: id(),
        kind: req.kind,
        status: JobStatus::AwaitingLlm,
        created_at: now,
        updated_at: now,
        recipe: Some(recipe),
        message: "Import accepted. LLM not live — returned structured stub. Set XAI_API_KEY and implement XaiLlm::complete.".into(),
        raw_payload: req.payload,
    }
}

pub fn build_meal_plan_stub(req: CreateMealPlanRequest, recipes: &[Recipe]) -> MealPlan {
    let now = Utc::now();
    let days_n = req.days.clamp(1, 14);
    let mut days = Vec::new();
    for i in 0..days_n {
        let date = format!("{}+{}", req.start_date, i); // client can fix dates; stub offset label
        let recipe = recipes.get((i as usize) % recipes.len().max(1));
        days.push(MealPlanDay {
            date,
            slots: vec![
                MealSlot {
                    id: id(),
                    meal_type: MealType::Dinner,
                    recipe_id: recipe.map(|r| r.id.clone()),
                    recipe_title: recipe.map(|r| r.title.clone()).or(Some("TBD".into())),
                    notes: if req.smart_reuse {
                        "Smart reuse: prefer overlapping ingredients (LLM later).".into()
                    } else {
                        String::new()
                    },
                },
            ],
        });
    }

    MealPlan {
        id: id(),
        title: req.title,
        start_date: req.start_date,
        days,
        reuse_notes: if req.smart_reuse {
            vec![
                "Stub: will group proteins/produce across days when LLM is on.".into(),
            ]
        } else {
            vec![]
        },
        created_at: now,
        updated_at: now,
    }
}

pub fn build_grocery_stub(req: BuildGroceryRequest, recipes: &[Recipe]) -> GroceryList {
    let now = Utc::now();
    let mut items = Vec::new();
    for rid in &req.recipe_ids {
        if let Some(r) = recipes.iter().find(|r| &r.id == rid) {
            for ing in &r.ingredients {
                items.push(GroceryItem {
                    id: id(),
                    name: ing.name.clone(),
                    quantity: ing.quantity,
                    unit: ing.unit.clone(),
                    aisle: ing.aisle_hint.clone(),
                    checked: false,
                    from_recipes: vec![r.title.clone()],
                });
            }
        }
    }
    // naive merge by name
    let mut merged: Vec<GroceryItem> = Vec::new();
    for it in items {
        if let Some(ex) = merged.iter_mut().find(|m| m.name.eq_ignore_ascii_case(&it.name)) {
            if let (Some(a), Some(b)) = (ex.quantity, it.quantity) {
                ex.quantity = Some(a + b);
            }
            ex.from_recipes.extend(it.from_recipes);
        } else {
            merged.push(it);
        }
    }

    GroceryList {
        id: id(),
        title: req.title.unwrap_or_else(|| "Grocery list".into()),
        items: merged,
        source_recipe_ids: req.recipe_ids,
        created_at: now,
        updated_at: now,
    }
}

pub fn start_cooking_stub(recipe: &Recipe) -> CookingSession {
    let now = Utc::now();
    let timers: Vec<ActiveTimer> = recipe
        .timers
        .iter()
        .map(|t| ActiveTimer {
            id: t.id.clone(),
            label: t.label.clone(),
            total_seconds: t.seconds,
            remaining_seconds: t.seconds,
            running: false,
        })
        .collect();

    CookingSession {
        id: id(),
        recipe_id: recipe.id.clone(),
        recipe_title: recipe.title.clone(),
        current_step: 1,
        timers,
        started_at: now,
        updated_at: now,
    }
}
