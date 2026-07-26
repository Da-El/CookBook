use axum::extract::{Path, Query, State};
use axum::Json;
use serde::Deserialize;
use serde_json::json;

use crate::auth::extract::AuthUser;
use crate::error::{ApiResult, AppError};
use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct ListQuery {
    pub q: Option<String>,
    pub group: Option<String>,
    pub limit: Option<usize>,
}

#[derive(Debug, Deserialize)]
pub struct FoodMetaBody {
    pub description: Option<String>,
    pub photo_url: Option<String>,
    /// When true, clears photo_url
    pub clear_photo: Option<bool>,
}

fn require_pool(state: &AppState) -> ApiResult<&sqlx::PgPool> {
    state
        .pool
        .as_ref()
        .ok_or_else(|| AppError::Unavailable("database not available".into()))
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

/// Per-user description + photo for a catalog food.
pub async fn get_food_meta(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
) -> ApiResult<Json<serde_json::Value>> {
    let pool = require_pool(&state)?;
    // Ensure food exists in catalog
    let food = state
        .catalog
        .get(&id)
        .ok_or_else(|| AppError::NotFound(format!("food not found: {id}")))?;
    let food_id = food.id.clone();

    let row: Option<(String, Option<String>)> = sqlx::query_as(
        r#"
        SELECT description, photo_url
        FROM user_food_meta
        WHERE user_id = $1 AND food_id = $2
        "#,
    )
    .bind(&auth.user_id)
    .bind(&food_id)
    .fetch_optional(pool)
    .await?;

    let (description, photo_url) = match row {
        Some((d, p)) => (d, p),
        None => (String::new(), None),
    };

    Ok(Json(json!({
        "food_id": food_id,
        "description": description,
        "photo_url": photo_url,
        "catalog_description": food.description.clone().unwrap_or_default(),
        "catalog_picture": food.picture.clone(),
    })))
}

pub async fn put_food_meta(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
    Json(body): Json<FoodMetaBody>,
) -> ApiResult<Json<serde_json::Value>> {
    let pool = require_pool(&state)?;
    let food = state
        .catalog
        .get(&id)
        .ok_or_else(|| AppError::NotFound(format!("food not found: {id}")))?;
    let food_id = food.id.clone();

    // Load existing
    let existing: Option<(String, Option<String>)> = sqlx::query_as(
        r#"
        SELECT description, photo_url
        FROM user_food_meta
        WHERE user_id = $1 AND food_id = $2
        "#,
    )
    .bind(&auth.user_id)
    .bind(&food_id)
    .fetch_optional(pool)
    .await?;

    let mut description = existing
        .as_ref()
        .map(|(d, _)| d.clone())
        .unwrap_or_default();
    let mut photo_url = existing.and_then(|(_, p)| p);

    if let Some(d) = body.description {
        if d.len() > 4000 {
            return Err(AppError::BadRequest("description too long".into()));
        }
        description = d.trim().to_string();
    }
    if body.clear_photo == Some(true) {
        photo_url = None;
    } else if let Some(p) = body.photo_url {
        let p = p.trim().to_string();
        photo_url = if p.is_empty() { None } else { Some(p) };
    }

    sqlx::query(
        r#"
        INSERT INTO user_food_meta (user_id, food_id, description, photo_url, updated_at)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (user_id, food_id)
        DO UPDATE SET
            description = EXCLUDED.description,
            photo_url = EXCLUDED.photo_url,
            updated_at = NOW()
        "#,
    )
    .bind(&auth.user_id)
    .bind(&food_id)
    .bind(&description)
    .bind(&photo_url)
    .execute(pool)
    .await?;

    Ok(Json(json!({
        "food_id": food_id,
        "description": description,
        "photo_url": photo_url,
    })))
}
