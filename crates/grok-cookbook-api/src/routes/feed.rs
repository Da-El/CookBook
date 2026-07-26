//! Chronological home feed of public meals from followed chefs (+ own).

use axum::extract::{Query, State};
use axum::Json;
use chrono::{DateTime, Utc};
use serde::Deserialize;

use crate::auth::extract::AuthUser;
use crate::error::{ApiResult, AppError};
use crate::routes::meals::{AuthorDto, MacrosDto, MealDto, MealIngredientDto};
use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct FeedQuery {
    pub tab: Option<String>,
    pub limit: Option<i64>,
    /// Keyset cursor: ISO timestamp of last item (optional v1 simplification: offset not used)
    pub cursor: Option<String>,
}

fn require_pool(state: &AppState) -> ApiResult<&sqlx::PgPool> {
    state
        .pool
        .as_ref()
        .ok_or_else(|| AppError::Unavailable("database not available".into()))
}

#[derive(Debug, sqlx::FromRow)]
struct FeedRow {
    id: String,
    user_id: String,
    status: String,
    title: String,
    story: String,
    cuisine: String,
    time_minutes: Option<i32>,
    visibility: String,
    photo_url: Option<String>,
    author_rating: Option<i16>,
    macros_kcal: Option<f64>,
    macros_protein_g: Option<f64>,
    macros_fat_g: Option<f64>,
    macros_carbs_g: Option<f64>,
    macros_fiber_g: Option<f64>,
    macros_estimated: bool,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
    author_handle: String,
    author_display_name: String,
    author_avatar_url: Option<String>,
    review_avg: Option<f64>,
    review_count: i64,
}

pub async fn get_feed(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(q): Query<FeedQuery>,
) -> ApiResult<Json<serde_json::Value>> {
    let pool = require_pool(&state)?;
    let tab = q.tab.as_deref().unwrap_or("following");
    let limit = q.limit.unwrap_or(20).clamp(1, 50);

    if tab == "discover" {
        // v1 stub
        return Ok(Json(serde_json::json!({
            "items": [],
            "next_cursor": null,
            "tab": "discover",
        })));
    }

    if tab != "following" {
        return Err(AppError::BadRequest(
            "tab must be following or discover".into(),
        ));
    }

    // Cursor: created_at less than cursor time
    let cursor_ts: Option<DateTime<Utc>> = match q.cursor.as_deref() {
        None | Some("") => None,
        Some(c) => Some(
            DateTime::parse_from_rfc3339(c)
                .map(|d| d.with_timezone(&Utc))
                .or_else(|_| {
                    // allow without timezone
                    chrono::NaiveDateTime::parse_from_str(c, "%Y-%m-%dT%H:%M:%S%.f")
                        .or_else(|_| chrono::NaiveDateTime::parse_from_str(c, "%Y-%m-%dT%H:%M:%S"))
                        .map(|n| n.and_utc())
                })
                .map_err(|_| AppError::BadRequest("invalid cursor".into()))?,
        ),
    };

    let rows: Vec<FeedRow> = if let Some(ts) = cursor_ts {
        sqlx::query_as(
            r#"
            SELECT m.id, m.user_id, m.status, m.title, m.story, m.cuisine, m.time_minutes,
                   m.visibility, m.photo_url, m.author_rating,
                   m.macros_kcal, m.macros_protein_g, m.macros_fat_g, m.macros_carbs_g, m.macros_fiber_g,
                   m.macros_estimated, m.created_at, m.updated_at,
                   u.handle AS author_handle, u.display_name AS author_display_name,
                   u.avatar_url AS author_avatar_url,
                   (SELECT AVG(score)::float8 FROM subject_ratings sr
                      WHERE sr.subject_type = 'meal' AND sr.subject_id = m.id) AS review_avg,
                   (SELECT COUNT(*)::bigint FROM subject_ratings sr
                      WHERE sr.subject_type = 'meal' AND sr.subject_id = m.id) AS review_count
            FROM meals m
            JOIN users u ON u.id = m.user_id
            WHERE m.visibility = 'public'
              AND m.created_at < $2
              AND (
                    m.user_id = $1
                 OR m.user_id IN (SELECT following_id FROM follows WHERE follower_id = $1)
              )
              AND NOT EXISTS (
                    SELECT 1 FROM blocks b
                    WHERE (b.blocker_id = $1 AND b.blocked_id = m.user_id)
                       OR (b.blocked_id = $1 AND b.blocker_id = m.user_id)
              )
            ORDER BY m.created_at DESC, m.id DESC
            LIMIT $3
            "#,
        )
        .bind(&auth.user_id)
        .bind(ts)
        .bind(limit)
        .fetch_all(pool)
        .await?
    } else {
        sqlx::query_as(
            r#"
            SELECT m.id, m.user_id, m.status, m.title, m.story, m.cuisine, m.time_minutes,
                   m.visibility, m.photo_url, m.author_rating,
                   m.macros_kcal, m.macros_protein_g, m.macros_fat_g, m.macros_carbs_g, m.macros_fiber_g,
                   m.macros_estimated, m.created_at, m.updated_at,
                   u.handle AS author_handle, u.display_name AS author_display_name,
                   u.avatar_url AS author_avatar_url,
                   (SELECT AVG(score)::float8 FROM subject_ratings sr
                      WHERE sr.subject_type = 'meal' AND sr.subject_id = m.id) AS review_avg,
                   (SELECT COUNT(*)::bigint FROM subject_ratings sr
                      WHERE sr.subject_type = 'meal' AND sr.subject_id = m.id) AS review_count
            FROM meals m
            JOIN users u ON u.id = m.user_id
            WHERE m.visibility = 'public'
              AND (
                    m.user_id = $1
                 OR m.user_id IN (SELECT following_id FROM follows WHERE follower_id = $1)
              )
              AND NOT EXISTS (
                    SELECT 1 FROM blocks b
                    WHERE (b.blocker_id = $1 AND b.blocked_id = m.user_id)
                       OR (b.blocked_id = $1 AND b.blocker_id = m.user_id)
              )
            ORDER BY m.created_at DESC, m.id DESC
            LIMIT $2
            "#,
        )
        .bind(&auth.user_id)
        .bind(limit)
        .fetch_all(pool)
        .await?
    };

    let mut items = Vec::with_capacity(rows.len());
    for row in rows {
        let ings: Vec<(String, String, String, Option<f64>, i32, String)> = sqlx::query_as(
            r#"
            SELECT id, food_id, food_name, quantity_g, sort_order, quantity_text
            FROM meal_ingredients WHERE meal_id = $1
            ORDER BY sort_order ASC
            "#,
        )
        .bind(&row.id)
        .fetch_all(pool)
        .await?;

        let ingredients: Vec<MealIngredientDto> = ings
            .into_iter()
            .map(|(id, food_id, food_name, quantity_g, sort_order, quantity_text)| {
                MealIngredientDto {
                    id,
                    food_id,
                    food_name,
                    quantity_text,
                    quantity_g,
                    sort_order,
                }
            })
            .collect();

        let my_score: Option<i16> = sqlx::query_scalar(
            r#"
            SELECT score FROM subject_ratings
            WHERE user_id = $1 AND subject_type = 'meal' AND subject_id = $2
            "#,
        )
        .bind(&auth.user_id)
        .bind(&row.id)
        .fetch_optional(pool)
        .await?;

        let macros_estimated = if row.macros_estimated {
            Some(MacrosDto {
                kcal: row.macros_kcal,
                protein_g: row.macros_protein_g,
                fat_g: row.macros_fat_g,
                carbs_g: row.macros_carbs_g,
                fiber_g: row.macros_fiber_g,
            })
        } else {
            None
        };

        let meal = MealDto {
            id: row.id.clone(),
            author: AuthorDto {
                id: row.user_id,
                handle: row.author_handle,
                display_name: row.author_display_name,
                avatar_url: row.author_avatar_url,
            },
            status: row.status,
            title: row.title,
            story: row.story,
            cuisine: row.cuisine,
            time_minutes: row.time_minutes,
            visibility: row.visibility,
            photo_url: row.photo_url,
            author_rating: row.author_rating,
            macros_estimated,
            ingredients,
            review_avg: row.review_avg,
            review_count: row.review_count,
            my_score,
            created_at: row.created_at,
            updated_at: row.updated_at,
        };

        items.push(serde_json::json!({
            "type": "meal",
            "id": meal.id,
            "created_at": meal.created_at,
            "author": meal.author,
            "meal": meal,
        }));
    }

    let next_cursor = items
        .last()
        .and_then(|i| i.get("created_at"))
        .cloned();

    Ok(Json(serde_json::json!({
        "items": items,
        "next_cursor": next_cursor,
        "tab": "following",
    })))
}
