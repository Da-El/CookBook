use std::sync::Arc;

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::routing::{get, post};
use axum::{Json, Router};
use grok_cookbook_v2_core::{
    build_grocery_stub, build_meal_plan_stub, import_recipe_stub, start_cooking_stub, stub_gallery,
    stub_guides, BuildGroceryRequest, CookingSession, CreateMealPlanRequest, GroceryList,
    ImportJob, ImportRequest, MealPlan, Recipe, StartCookingRequest, TimerAction,
    TimerActionRequest, xai_key_configured,
};
use serde::Serialize;
use serde_json::{json, Value};

use crate::state::AppState;

type S = Arc<AppState>;

pub fn router() -> Router<S> {
    Router::new()
        .route("/healthz", get(healthz))
        .route("/v2/health", get(healthz))
        .route("/v2/meta", get(meta))
        // Recipes
        .route("/v2/recipes", get(list_recipes).post(create_recipe_manual))
        .route("/v2/recipes/{id}", get(get_recipe))
        // Import (LLM later)
        .route("/v2/import", post(import_recipe))
        .route("/v2/import/{id}", get(get_import))
        // Meal plans
        .route("/v2/meal-plans", get(list_plans).post(create_plan))
        .route("/v2/meal-plans/{id}", get(get_plan))
        // Grocery
        .route("/v2/grocery", get(list_grocery).post(build_grocery))
        .route("/v2/grocery/{id}", get(get_grocery))
        // Cooking + timers
        .route("/v2/cook/sessions", post(start_cook))
        .route("/v2/cook/sessions/{id}", get(get_session))
        .route("/v2/cook/sessions/{id}/timers", post(timer_action))
        // Nice-to-haves
        .route("/v2/gallery", get(gallery))
        .route("/v2/guides", get(guides))
        // LLM probe (always stub until wired)
        .route("/v2/llm/status", get(llm_status))
}

#[derive(Serialize)]
struct Health {
    status: &'static str,
    service: &'static str,
    version: &'static str,
    product: &'static str,
    llm_live: bool,
    xai_key_configured: bool,
}

async fn healthz(State(st): State<S>) -> Json<Health> {
    Json(Health {
        status: "ok",
        service: "grok-cookbook-v2-api",
        version: env!("CARGO_PKG_VERSION"),
        product: "cookbook-v2",
        llm_live: st.llm.is_live(),
        xai_key_configured: xai_key_configured(),
    })
}

async fn meta() -> Json<Value> {
    Json(json!({
        "product": "CookBook V2",
        "description": "LLM cooking assistant bones — separate from V1 social CookBook",
        "llm": {
            "provider_default": "stub",
            "planned_provider": "SpaceXAI (xAI)",
            "env": ["XAI_API_KEY", "XAI_BASE_URL", "XAI_MODEL"],
            "base_url_default": "https://api.x.ai/v1",
            "model_default": "grok-4.5"
        },
        "features": {
            "import": "bones",
            "meal_planning": "bones",
            "grocery": "bones",
            "step_by_step": "bones",
            "multi_timer": "bones",
            "gallery": "stub_catalog",
            "smart_reuse": "flag_only",
            "beginner_guides": "static",
            "cost_estimate": "placeholder_fields"
        }
    }))
}

async fn list_recipes(State(st): State<S>) -> Json<Value> {
    let map = st.recipes.lock().unwrap();
    let items: Vec<_> = map.values().cloned().collect();
    Json(json!({ "items": items, "count": items.len() }))
}

async fn get_recipe(
    State(st): State<S>,
    Path(id): Path<String>,
) -> Result<Json<Recipe>, StatusCode> {
    st.recipes
        .lock()
        .unwrap()
        .get(&id)
        .cloned()
        .map(Json)
        .ok_or(StatusCode::NOT_FOUND)
}

async fn create_recipe_manual(
    State(st): State<S>,
    Json(body): Json<Value>,
) -> Json<Recipe> {
    let title = body
        .get("title")
        .and_then(|v| v.as_str())
        .unwrap_or("Untitled recipe");
    let recipe = Recipe::new_stub(title);
    st.recipes
        .lock()
        .unwrap()
        .insert(recipe.id.clone(), recipe.clone());
    Json(recipe)
}

async fn import_recipe(State(st): State<S>, Json(req): Json<ImportRequest>) -> Json<ImportJob> {
    let job = import_recipe_stub(st.llm.as_ref(), req).await;
    if let Some(ref r) = job.recipe {
        st.recipes.lock().unwrap().insert(r.id.clone(), r.clone());
    }
    st.imports
        .lock()
        .unwrap()
        .insert(job.id.clone(), job.clone());
    Json(job)
}

async fn get_import(
    State(st): State<S>,
    Path(id): Path<String>,
) -> Result<Json<ImportJob>, StatusCode> {
    st.imports
        .lock()
        .unwrap()
        .get(&id)
        .cloned()
        .map(Json)
        .ok_or(StatusCode::NOT_FOUND)
}

async fn list_plans(State(st): State<S>) -> Json<Value> {
    let items: Vec<_> = st.meal_plans.lock().unwrap().values().cloned().collect();
    Json(json!({ "items": items }))
}

async fn create_plan(
    State(st): State<S>,
    Json(req): Json<CreateMealPlanRequest>,
) -> Json<MealPlan> {
    let recipes: Vec<_> = {
        let map = st.recipes.lock().unwrap();
        if req.recipe_ids.is_empty() {
            map.values().cloned().collect()
        } else {
            req.recipe_ids
                .iter()
                .filter_map(|id| map.get(id).cloned())
                .collect()
        }
    };
    let plan = build_meal_plan_stub(req, &recipes);
    st.meal_plans
        .lock()
        .unwrap()
        .insert(plan.id.clone(), plan.clone());
    Json(plan)
}

async fn get_plan(
    State(st): State<S>,
    Path(id): Path<String>,
) -> Result<Json<MealPlan>, StatusCode> {
    st.meal_plans
        .lock()
        .unwrap()
        .get(&id)
        .cloned()
        .map(Json)
        .ok_or(StatusCode::NOT_FOUND)
}

async fn list_grocery(State(st): State<S>) -> Json<Value> {
    let items: Vec<_> = st.groceries.lock().unwrap().values().cloned().collect();
    Json(json!({ "items": items }))
}

async fn build_grocery(
    State(st): State<S>,
    Json(req): Json<BuildGroceryRequest>,
) -> Json<GroceryList> {
    let recipes: Vec<_> = {
        let map = st.recipes.lock().unwrap();
        req.recipe_ids
            .iter()
            .filter_map(|id| map.get(id).cloned())
            .collect()
    };
    let list = build_grocery_stub(req, &recipes);
    st.groceries
        .lock()
        .unwrap()
        .insert(list.id.clone(), list.clone());
    Json(list)
}

async fn get_grocery(
    State(st): State<S>,
    Path(id): Path<String>,
) -> Result<Json<GroceryList>, StatusCode> {
    st.groceries
        .lock()
        .unwrap()
        .get(&id)
        .cloned()
        .map(Json)
        .ok_or(StatusCode::NOT_FOUND)
}

async fn start_cook(
    State(st): State<S>,
    Json(req): Json<StartCookingRequest>,
) -> Result<Json<CookingSession>, StatusCode> {
    let recipe = st
        .recipes
        .lock()
        .unwrap()
        .get(&req.recipe_id)
        .cloned()
        .ok_or(StatusCode::NOT_FOUND)?;
    let session = start_cooking_stub(&recipe);
    st.sessions
        .lock()
        .unwrap()
        .insert(session.id.clone(), session.clone());
    Ok(Json(session))
}

async fn get_session(
    State(st): State<S>,
    Path(id): Path<String>,
) -> Result<Json<CookingSession>, StatusCode> {
    st.sessions
        .lock()
        .unwrap()
        .get(&id)
        .cloned()
        .map(Json)
        .ok_or(StatusCode::NOT_FOUND)
}

async fn timer_action(
    State(st): State<S>,
    Path(id): Path<String>,
    Json(body): Json<TimerActionRequest>,
) -> Result<Json<CookingSession>, StatusCode> {
    let mut map = st.sessions.lock().unwrap();
    let session = map.get_mut(&id).ok_or(StatusCode::NOT_FOUND)?;
    let timer = session
        .timers
        .iter_mut()
        .find(|t| t.id == body.timer_id)
        .ok_or(StatusCode::NOT_FOUND)?;
    match body.action {
        TimerAction::Start => timer.running = true,
        TimerAction::Pause => timer.running = false,
        TimerAction::Reset => {
            timer.remaining_seconds = timer.total_seconds;
            timer.running = false;
        }
        TimerAction::SetRemaining => {
            if let Some(r) = body.remaining_seconds {
                timer.remaining_seconds = r;
            }
        }
    }
    session.updated_at = chrono::Utc::now();
    Ok(Json(session.clone()))
}

async fn gallery() -> Json<Value> {
    Json(json!({ "items": stub_gallery() }))
}

async fn guides() -> Json<Value> {
    Json(json!({ "items": stub_guides() }))
}

async fn llm_status(State(st): State<S>) -> Json<Value> {
    Json(json!({
        "provider": st.llm.name(),
        "live": st.llm.is_live(),
        "xai_key_configured": xai_key_configured(),
        "note": "V2 bones only. Implement XaiLlm::complete + swap default_provider when ready."
    }))
}
