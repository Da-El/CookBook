//! Authenticated fridge API — requires Bearer access token.

use axum::extract::{Path, State};
use axum::Json;
use chrono::NaiveDate;
use serde::{Deserialize, Serialize};
use ulid::Ulid;

use crate::auth::extract::AuthUser;
use crate::error::{ApiResult, AppError};
use crate::state::AppState;

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct FridgeItem {
    pub id: String,
    pub user_id: String,
    pub food_id: String,
    pub food_name: String,
    pub quantity: String,
    pub location: String,
    pub bought_on: Option<NaiveDate>,
    pub expires_on: Option<NaiveDate>,
    pub notes: String,
    pub rating: Option<i16>,
}

#[derive(Debug, Deserialize)]
pub struct AddFridgeBody {
    pub food_id: String,
    pub quantity: Option<String>,
    pub location: Option<String>,
    pub bought_on: Option<String>,
    pub expires_on: Option<String>,
    pub notes: Option<String>,
    pub rating: Option<i16>,
}

fn require_pool(state: &AppState) -> ApiResult<&sqlx::PgPool> {
    state
        .pool
        .as_ref()
        .ok_or_else(|| AppError::Unavailable("database not available".into()))
}

pub async fn list_fridge(
    State(state): State<AppState>,
    auth: AuthUser,
) -> ApiResult<Json<serde_json::Value>> {
    let pool = require_pool(&state)?;
    let items: Vec<FridgeItem> = sqlx::query_as(
        r#"
        SELECT id, user_id, food_id, food_name, quantity, location,
               bought_on, expires_on, notes, rating
        FROM fridge_items
        WHERE user_id = $1
        ORDER BY created_at DESC
        "#,
    )
    .bind(&auth.user_id)
    .fetch_all(pool)
    .await?;
    Ok(Json(serde_json::json!({ "items": items })))
}

pub async fn add_fridge(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(body): Json<AddFridgeBody>,
) -> ApiResult<Json<FridgeItem>> {
    let pool = require_pool(&state)?;

    if body.food_id.trim().is_empty() {
        return Err(AppError::BadRequest("food_id required".into()));
    }

    let food_name = state
        .catalog
        .get(&body.food_id)
        .map(|f| f.name.clone())
        .unwrap_or_else(|| body.food_id.clone());

    let id = Ulid::new().to_string();
    let quantity = body.quantity.unwrap_or_else(|| "1".into());
    let location = body.location.unwrap_or_else(|| "Fridge".into());
    let notes = body.notes.unwrap_or_default();
    let rating = body.rating;
    if let Some(r) = rating {
        if !(0..=10).contains(&r) {
            return Err(AppError::BadRequest("rating must be 0-10".into()));
        }
    }

    let bought_on = parse_date_opt(body.bought_on.as_deref())?;
    let expires_on = parse_date_opt(body.expires_on.as_deref())?;

    let item: FridgeItem = sqlx::query_as(
        r#"
        INSERT INTO fridge_items
            (id, user_id, food_id, food_name, quantity, location, bought_on, expires_on, notes, rating)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        RETURNING id, user_id, food_id, food_name, quantity, location,
                  bought_on, expires_on, notes, rating
        "#,
    )
    .bind(&id)
    .bind(&auth.user_id)
    .bind(&body.food_id)
    .bind(&food_name)
    .bind(&quantity)
    .bind(&location)
    .bind(bought_on)
    .bind(expires_on)
    .bind(&notes)
    .bind(rating)
    .fetch_one(pool)
    .await?;

    Ok(Json(item))
}

pub async fn delete_fridge(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
) -> ApiResult<Json<serde_json::Value>> {
    let pool = require_pool(&state)?;
    let res = sqlx::query("DELETE FROM fridge_items WHERE id = $1 AND user_id = $2")
        .bind(&id)
        .bind(&auth.user_id)
        .execute(pool)
        .await?;
    if res.rows_affected() == 0 {
        return Err(AppError::NotFound("fridge item not found".into()));
    }
    Ok(Json(serde_json::json!({ "deleted": true, "id": id })))
}

fn parse_date_opt(s: Option<&str>) -> ApiResult<Option<NaiveDate>> {
    match s {
        None | Some("") => Ok(None),
        Some(v) => NaiveDate::parse_from_str(v, "%Y-%m-%d")
            .map(Some)
            .map_err(|_| AppError::BadRequest(format!("invalid date: {v}"))),
    }
}
