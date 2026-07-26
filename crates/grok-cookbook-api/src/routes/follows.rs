//! Follow / unfollow + user profile for social graph.

use axum::extract::{Path, Query, State};
use axum::Json;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::auth::extract::{AuthUser, OptionalAuthUser};
use crate::error::{ApiResult, AppError};
use crate::state::AppState;

#[derive(Debug, Serialize)]
pub struct ProfileDto {
    pub id: String,
    pub handle: String,
    pub display_name: String,
    pub bio: String,
    pub avatar_url: Option<String>,
    pub cooked_count: i64,
    pub want_count: i64,
    pub followers_count: i64,
    pub following_count: i64,
    pub is_following: bool,
    pub is_self: bool,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct FollowUserDto {
    pub id: String,
    pub handle: String,
    pub display_name: String,
    pub bio: String,
    pub avatar_url: Option<String>,
    pub followed_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct ListFollowQuery {
    pub limit: Option<i64>,
}

fn require_pool(state: &AppState) -> ApiResult<&sqlx::PgPool> {
    state
        .pool
        .as_ref()
        .ok_or_else(|| AppError::Unavailable("database not available".into()))
}

async fn blocked_either(pool: &sqlx::PgPool, a: &str, b: &str) -> ApiResult<bool> {
    let n: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(*)::bigint FROM blocks
        WHERE (blocker_id = $1 AND blocked_id = $2)
           OR (blocker_id = $2 AND blocked_id = $1)
        "#,
    )
    .bind(a)
    .bind(b)
    .fetch_one(pool)
    .await?;
    Ok(n > 0)
}

async fn user_id_by_handle(pool: &sqlx::PgPool, handle: &str) -> ApiResult<String> {
    let id: Option<String> =
        sqlx::query_scalar("SELECT id FROM users WHERE lower(handle) = lower($1)")
            .bind(handle)
            .fetch_optional(pool)
            .await?;
    id.ok_or_else(|| AppError::NotFound("user not found".into()))
}

pub async fn get_profile(
    State(state): State<AppState>,
    auth: OptionalAuthUser,
    Path(handle): Path<String>,
) -> ApiResult<Json<ProfileDto>> {
    let pool = require_pool(&state)?;
    #[derive(sqlx::FromRow)]
    struct Row {
        id: String,
        handle: String,
        display_name: String,
        bio: String,
        avatar_url: Option<String>,
    }
    let row: Option<Row> = sqlx::query_as(
        r#"
        SELECT id, handle, display_name, bio, avatar_url
        FROM users WHERE lower(handle) = lower($1)
        "#,
    )
    .bind(&handle)
    .fetch_optional(pool)
    .await?;
    let row = row.ok_or_else(|| AppError::NotFound("user not found".into()))?;

    if let Some(viewer) = auth.0.as_ref() {
        if blocked_either(pool, &viewer.user_id, &row.id).await? {
            return Err(AppError::NotFound("user not found".into()));
        }
    }

    let is_owner = auth
        .0
        .as_ref()
        .map(|u| u.user_id == row.id)
        .unwrap_or(false);

    let cooked_count: i64 = if is_owner {
        sqlx::query_scalar(
            "SELECT COUNT(*)::bigint FROM meals WHERE user_id = $1 AND status = 'cooked'",
        )
        .bind(&row.id)
        .fetch_one(pool)
        .await?
    } else {
        sqlx::query_scalar(
            "SELECT COUNT(*)::bigint FROM meals WHERE user_id = $1 AND status = 'cooked' AND visibility = 'public'",
        )
        .bind(&row.id)
        .fetch_one(pool)
        .await?
    };

    let want_count: i64 = if is_owner {
        sqlx::query_scalar(
            "SELECT COUNT(*)::bigint FROM meals WHERE user_id = $1 AND status = 'want_to_cook'",
        )
        .bind(&row.id)
        .fetch_one(pool)
        .await?
    } else {
        sqlx::query_scalar(
            "SELECT COUNT(*)::bigint FROM meals WHERE user_id = $1 AND status = 'want_to_cook' AND visibility = 'public'",
        )
        .bind(&row.id)
        .fetch_one(pool)
        .await?
    };

    let followers_count: i64 =
        sqlx::query_scalar("SELECT COUNT(*)::bigint FROM follows WHERE following_id = $1")
            .bind(&row.id)
            .fetch_one(pool)
            .await?;
    let following_count: i64 =
        sqlx::query_scalar("SELECT COUNT(*)::bigint FROM follows WHERE follower_id = $1")
            .bind(&row.id)
            .fetch_one(pool)
            .await?;

    let is_following = if let Some(viewer) = auth.0.as_ref() {
        if is_owner {
            false
        } else {
            let n: i64 = sqlx::query_scalar(
                "SELECT COUNT(*)::bigint FROM follows WHERE follower_id = $1 AND following_id = $2",
            )
            .bind(&viewer.user_id)
            .bind(&row.id)
            .fetch_one(pool)
            .await?;
            n > 0
        }
    } else {
        false
    };

    Ok(Json(ProfileDto {
        id: row.id,
        handle: row.handle,
        display_name: row.display_name,
        bio: row.bio,
        avatar_url: row.avatar_url,
        cooked_count,
        want_count,
        followers_count,
        following_count,
        is_following,
        is_self: is_owner,
    }))
}

pub async fn follow(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(handle): Path<String>,
) -> ApiResult<Json<serde_json::Value>> {
    let pool = require_pool(&state)?;
    let target = user_id_by_handle(pool, &handle).await?;
    if target == auth.user_id {
        return Err(AppError::BadRequest("cannot follow yourself".into()));
    }
    if blocked_either(pool, &auth.user_id, &target).await? {
        return Err(AppError::BadRequest("cannot follow this user".into()));
    }

    sqlx::query(
        r#"
        INSERT INTO follows (follower_id, following_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
        "#,
    )
    .bind(&auth.user_id)
    .bind(&target)
    .execute(pool)
    .await?;

    Ok(Json(serde_json::json!({
        "following": true,
        "handle": handle,
    })))
}

pub async fn unfollow(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(handle): Path<String>,
) -> ApiResult<Json<serde_json::Value>> {
    let pool = require_pool(&state)?;
    let target = user_id_by_handle(pool, &handle).await?;
    sqlx::query("DELETE FROM follows WHERE follower_id = $1 AND following_id = $2")
        .bind(&auth.user_id)
        .bind(&target)
        .execute(pool)
        .await?;
    Ok(Json(serde_json::json!({
        "following": false,
        "handle": handle,
    })))
}

pub async fn list_following(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(q): Query<ListFollowQuery>,
) -> ApiResult<Json<serde_json::Value>> {
    let pool = require_pool(&state)?;
    let limit = q.limit.unwrap_or(50).clamp(1, 100);
    let rows: Vec<FollowUserDto> = sqlx::query_as(
        r#"
        SELECT u.id, u.handle, u.display_name, u.bio, u.avatar_url, f.created_at AS followed_at
        FROM follows f
        JOIN users u ON u.id = f.following_id
        WHERE f.follower_id = $1
        ORDER BY f.created_at DESC
        LIMIT $2
        "#,
    )
    .bind(&auth.user_id)
    .bind(limit)
    .fetch_all(pool)
    .await?;
    Ok(Json(serde_json::json!({ "items": rows })))
}

pub async fn list_followers(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(q): Query<ListFollowQuery>,
) -> ApiResult<Json<serde_json::Value>> {
    let pool = require_pool(&state)?;
    let limit = q.limit.unwrap_or(50).clamp(1, 100);
    let rows: Vec<FollowUserDto> = sqlx::query_as(
        r#"
        SELECT u.id, u.handle, u.display_name, u.bio, u.avatar_url, f.created_at AS followed_at
        FROM follows f
        JOIN users u ON u.id = f.follower_id
        WHERE f.following_id = $1
        ORDER BY f.created_at DESC
        LIMIT $2
        "#,
    )
    .bind(&auth.user_id)
    .bind(limit)
    .fetch_all(pool)
    .await?;
    Ok(Json(serde_json::json!({ "items": rows })))
}
