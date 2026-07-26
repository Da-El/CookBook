//! Reviews via subject_ratings (ingredient + meal, 1–10).

use axum::extract::{Path, Query, State};
use axum::Json;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use ulid::Ulid;

use crate::auth::extract::{AuthUser, OptionalAuthUser};
use crate::error::{ApiResult, AppError};
use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct UpsertReviewBody {
    pub subject_type: String,
    pub subject_id: String,
    pub score: i16,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ListReviewsQuery {
    pub subject_type: Option<String>,
    pub subject_id: Option<String>,
    pub mine: Option<bool>,
    pub limit: Option<i64>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ReviewDto {
    pub id: String,
    pub user_id: String,
    pub handle: String,
    pub display_name: String,
    pub subject_type: String,
    pub subject_id: String,
    pub score: i16,
    pub notes: String,
    pub updated_at: DateTime<Utc>,
}

fn require_pool(state: &AppState) -> ApiResult<&sqlx::PgPool> {
    state
        .pool
        .as_ref()
        .ok_or_else(|| AppError::Unavailable("database not available".into()))
}

fn validate_subject_type(s: &str) -> ApiResult<&str> {
    match s {
        "ingredient" | "meal" => Ok(s),
        _ => Err(AppError::BadRequest(
            "subject_type must be ingredient or meal".into(),
        )),
    }
}

async fn can_review_meal(pool: &sqlx::PgPool, user_id: &str, meal_id: &str) -> ApiResult<()> {
    let row: Option<(String, String)> =
        sqlx::query_as("SELECT user_id, visibility FROM meals WHERE id = $1")
            .bind(meal_id)
            .fetch_optional(pool)
            .await?;
    match row {
        None => Err(AppError::NotFound("meal not found".into())),
        Some((owner, vis)) if vis == "private" && owner != user_id => {
            Err(AppError::NotFound("meal not found".into()))
        }
        Some((_, vis)) if vis == "private" => {
            // v1: no reviews on private meals (even owner self-note via author_rating)
            Err(AppError::BadRequest(
                "cannot review private meals".into(),
            ))
        }
        Some(_) => Ok(()),
    }
}

pub async fn upsert_review(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(body): Json<UpsertReviewBody>,
) -> ApiResult<Json<ReviewDto>> {
    let pool = require_pool(&state)?;
    let st = validate_subject_type(body.subject_type.trim())?;
    let sid = body.subject_id.trim();
    if sid.is_empty() {
        return Err(AppError::BadRequest("subject_id required".into()));
    }
    if !(1..=10).contains(&body.score) {
        return Err(AppError::BadRequest("score must be 1-10".into()));
    }
    let notes = body.notes.unwrap_or_default();
    if notes.len() > 2000 {
        return Err(AppError::BadRequest("notes too long".into()));
    }

    if st == "meal" {
        can_review_meal(pool, &auth.user_id, sid).await?;
    }

    let id = Ulid::new().to_string();
    sqlx::query(
        r#"
        INSERT INTO subject_ratings (id, user_id, subject_type, subject_id, score, notes, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (user_id, subject_type, subject_id)
        DO UPDATE SET score = EXCLUDED.score, notes = EXCLUDED.notes, updated_at = NOW()
        "#,
    )
    .bind(&id)
    .bind(&auth.user_id)
    .bind(st)
    .bind(sid)
    .bind(body.score)
    .bind(&notes)
    .execute(pool)
    .await?;

    // Fetch canonical row (conflict may keep old id)
    let row: ReviewDto = sqlx::query_as(
        r#"
        SELECT sr.id, sr.user_id, u.handle, u.display_name,
               sr.subject_type, sr.subject_id, sr.score, sr.notes, sr.updated_at
        FROM subject_ratings sr
        JOIN users u ON u.id = sr.user_id
        WHERE sr.user_id = $1 AND sr.subject_type = $2 AND sr.subject_id = $3
        "#,
    )
    .bind(&auth.user_id)
    .bind(st)
    .bind(sid)
    .fetch_one(pool)
    .await?;

    Ok(Json(row))
}

pub async fn list_reviews(
    State(state): State<AppState>,
    auth: OptionalAuthUser,
    Query(q): Query<ListReviewsQuery>,
) -> ApiResult<Json<serde_json::Value>> {
    let pool = require_pool(&state)?;
    let limit = q.limit.unwrap_or(50).clamp(1, 100);
    let viewer = auth.0.as_ref();

    if q.mine.unwrap_or(false) {
        let uid = viewer
            .map(|u| u.user_id.as_str())
            .ok_or_else(|| AppError::Unauthorized("login required".into()))?;
        let rows: Vec<ReviewDto> = sqlx::query_as(
            r#"
            SELECT sr.id, sr.user_id, u.handle, u.display_name,
                   sr.subject_type, sr.subject_id, sr.score, sr.notes, sr.updated_at
            FROM subject_ratings sr
            JOIN users u ON u.id = sr.user_id
            WHERE sr.user_id = $1
            ORDER BY sr.updated_at DESC
            LIMIT $2
            "#,
        )
        .bind(uid)
        .bind(limit)
        .fetch_all(pool)
        .await?;
        return Ok(Json(serde_json::json!({ "items": rows })));
    }

    let st = q
        .subject_type
        .as_deref()
        .ok_or_else(|| AppError::BadRequest("subject_type required".into()))?;
    let st = validate_subject_type(st)?;
    let sid = q
        .subject_id
        .as_deref()
        .ok_or_else(|| AppError::BadRequest("subject_id required".into()))?;

    if st == "meal" {
        let row: Option<(String, String)> =
            sqlx::query_as("SELECT user_id, visibility FROM meals WHERE id = $1")
                .bind(sid)
                .fetch_optional(pool)
                .await?;
        match row {
            None => return Err(AppError::NotFound("meal not found".into())),
            Some((owner, vis)) if vis == "private" => {
                let is_owner = viewer.map(|u| u.user_id.as_str()) == Some(owner.as_str());
                if !is_owner {
                    return Err(AppError::NotFound("meal not found".into()));
                }
            }
            _ => {}
        }
    }

    let rows: Vec<ReviewDto> = sqlx::query_as(
        r#"
        SELECT sr.id, sr.user_id, u.handle, u.display_name,
               sr.subject_type, sr.subject_id, sr.score, sr.notes, sr.updated_at
        FROM subject_ratings sr
        JOIN users u ON u.id = sr.user_id
        WHERE sr.subject_type = $1 AND sr.subject_id = $2
        ORDER BY sr.updated_at DESC
        LIMIT $3
        "#,
    )
    .bind(st)
    .bind(sid)
    .bind(limit)
    .fetch_all(pool)
    .await?;

    let avg: Option<f64> = if rows.is_empty() {
        None
    } else {
        Some(rows.iter().map(|r| r.score as f64).sum::<f64>() / rows.len() as f64)
    };

    Ok(Json(serde_json::json!({
        "items": rows,
        "count": rows.len(),
        "avg": avg,
    })))
}

pub async fn delete_review(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<String>,
) -> ApiResult<Json<serde_json::Value>> {
    let pool = require_pool(&state)?;
    let res = sqlx::query("DELETE FROM subject_ratings WHERE id = $1 AND user_id = $2")
        .bind(&id)
        .bind(&auth.user_id)
        .execute(pool)
        .await?;
    if res.rows_affected() == 0 {
        return Err(AppError::NotFound("review not found".into()));
    }
    Ok(Json(serde_json::json!({ "deleted": true, "id": id })))
}
