use axum::extract::{Path, Query, State};
use axum::Json;
use serde::Deserialize;
use serde_json::json;

use crate::error::{ApiResult, AppError};
use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct ListQuery {
    pub q: Option<String>,
    pub group: Option<String>,
    pub limit: Option<usize>,
}

pub async fn list_foods(
    State(state): State<AppState>,
    Query(q): Query<ListQuery>,
) -> Json<serde_json::Value> {
    let limit = q.limit.unwrap_or(50).clamp(1, 1000);
    let items = state
        .catalog
        .search(q.q.as_deref().unwrap_or(""), q.group.as_deref(), limit);
    Json(json!({
        "count": items.len(),
        "total": state.catalog.foods.len(),
        "items": items,
    }))
}

pub async fn get_food(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> ApiResult<Json<serde_json::Value>> {
    let food = state
        .catalog
        .get(&id)
        .ok_or_else(|| AppError::NotFound(format!("food not found: {id}")))?;
    Ok(Json(json!(food)))
}

pub async fn list_groups(State(state): State<AppState>) -> Json<serde_json::Value> {
    Json(json!({ "groups": state.catalog.groups() }))
}
