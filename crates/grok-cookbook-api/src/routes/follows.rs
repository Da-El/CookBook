//! Follow / unfollow + user profile for social graph.

use axum::extract::{Path, Query, State};
use axum::Json;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::auth::extract::{AuthUser, OptionalAuthUser};
use crate::error::{ApiResult, AppError};
use crate::state::AppState;

const COVER_STYLES: &[&str] = &[
    "parchment",
    "indigo",
    "kitchen",
    "forest",
    "midnight",
    "rose",
    "ocean",
    "violet",
    "linen",
];

#[derive(Debug, Serialize)]
pub struct ProfileDto {
    pub id: String,
    pub handle: String,
    pub display_name: String,
    pub bio: String,
    pub avatar_url: Option<String>,
    pub cookbook_title: String,
    pub tagline: String,
    pub cover_style: String,
    pub accent_hex: Option<String>,
    pub favorite_cuisines: String,
    pub location_label: String,
    pub cover_url: Option<String>,
    pub cooked_count: i64,
    pub want_count: i64,
    pub followers_count: i64,
    pub following_count: i64,
    pub is_following: bool,
    pub is_self: bool,
}

#[derive(Debug, Deserialize)]
pub struct UpdateProfileBody {
    pub display_name: Option<String>,
    pub bio: Option<String>,
    pub avatar_url: Option<String>,
    pub clear_avatar: Option<bool>,
    pub cookbook_title: Option<String>,
    pub tagline: Option<String>,
    pub cover_style: Option<String>,
    pub accent_hex: Option<String>,
    pub clear_accent: Option<bool>,
    pub favorite_cuisines: Option<String>,
    pub location_label: Option<String>,
    pub cover_url: Option<String>,
    pub clear_cover: Option<bool>,
}

fn normalize_accent(hex: &str) -> ApiResult<Option<String>> {
    let t = hex.trim();
    if t.is_empty() {
        return Ok(None);
    }
    let h = t.strip_prefix('#').unwrap_or(t);
    if h.len() != 6 || !h.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err(AppError::BadRequest(
            "accent_hex must be #RRGGBB".into(),
        ));
    }
    Ok(Some(format!("#{}", h.to_lowercase())))
}

fn clamp_text(s: &str, max: usize) -> String {
    let t = s.trim();
    if t.chars().count() <= max {
        t.to_string()
    } else {
        t.chars().take(max).collect()
    }
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

#[derive(sqlx::FromRow)]
struct ProfileRow {
    id: String,
    handle: String,
    display_name: String,
    bio: String,
    avatar_url: Option<String>,
    cookbook_title: String,
    tagline: String,
    cover_style: String,
    accent_hex: Option<String>,
    favorite_cuisines: String,
    location_label: String,
    cover_url: Option<String>,
}

async fn load_profile_row(pool: &sqlx::PgPool, handle: &str) -> ApiResult<ProfileRow> {
    let row: Option<ProfileRow> = sqlx::query_as(
        r#"
        SELECT id, handle, display_name, bio, avatar_url,
               COALESCE(cookbook_title, '') AS cookbook_title,
               COALESCE(tagline, '') AS tagline,
               COALESCE(NULLIF(cover_style, ''), 'parchment') AS cover_style,
               accent_hex,
               COALESCE(favorite_cuisines, '') AS favorite_cuisines,
               COALESCE(location_label, '') AS location_label,
               cover_url
        FROM users WHERE lower(handle) = lower($1)
        "#,
    )
    .bind(handle)
    .fetch_optional(pool)
    .await?;
    row.ok_or_else(|| AppError::NotFound("user not found".into()))
}

async fn build_profile_dto(
    pool: &sqlx::PgPool,
    row: ProfileRow,
    viewer_id: Option<&str>,
) -> ApiResult<ProfileDto> {
    if let Some(vid) = viewer_id {
        if blocked_either(pool, vid, &row.id).await? {
            return Err(AppError::NotFound("user not found".into()));
        }
    }

    let is_owner = viewer_id.map(|v| v == row.id).unwrap_or(false);

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

    let is_following = if let Some(vid) = viewer_id {
        if is_owner {
            false
        } else {
            let n: i64 = sqlx::query_scalar(
                "SELECT COUNT(*)::bigint FROM follows WHERE follower_id = $1 AND following_id = $2",
            )
            .bind(vid)
            .bind(&row.id)
            .fetch_one(pool)
            .await?;
            n > 0
        }
    } else {
        false
    };

    Ok(ProfileDto {
        id: row.id,
        handle: row.handle,
        display_name: row.display_name,
        bio: row.bio,
        avatar_url: row.avatar_url,
        cookbook_title: row.cookbook_title,
        tagline: row.tagline,
        cover_style: row.cover_style,
        accent_hex: row.accent_hex,
        favorite_cuisines: row.favorite_cuisines,
        location_label: row.location_label,
        cover_url: row.cover_url,
        cooked_count,
        want_count,
        followers_count,
        following_count,
        is_following,
        is_self: is_owner,
    })
}

pub async fn get_profile(
    State(state): State<AppState>,
    auth: OptionalAuthUser,
    Path(handle): Path<String>,
) -> ApiResult<Json<ProfileDto>> {
    let pool = require_pool(&state)?;
    let row = load_profile_row(pool, &handle).await?;
    let viewer = auth.0.as_ref().map(|u| u.user_id.as_str());
    Ok(Json(build_profile_dto(pool, row, viewer).await?))
}

/// PATCH /v1/me/profile — personalize cookbook cover, bio, accents, etc.
pub async fn update_profile(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(body): Json<UpdateProfileBody>,
) -> ApiResult<Json<ProfileDto>> {
    let pool = require_pool(&state)?;

    #[derive(sqlx::FromRow)]
    struct Cur {
        handle: String,
        display_name: String,
        bio: String,
        avatar_url: Option<String>,
        cookbook_title: String,
        tagline: String,
        cover_style: String,
        accent_hex: Option<String>,
        favorite_cuisines: String,
        location_label: String,
        cover_url: Option<String>,
    }

    let cur: Cur = sqlx::query_as(
        r#"
        SELECT handle, display_name, bio, avatar_url,
               COALESCE(cookbook_title, '') AS cookbook_title,
               COALESCE(tagline, '') AS tagline,
               COALESCE(NULLIF(cover_style, ''), 'parchment') AS cover_style,
               accent_hex,
               COALESCE(favorite_cuisines, '') AS favorite_cuisines,
               COALESCE(location_label, '') AS location_label,
               cover_url
        FROM users WHERE id = $1
        "#,
    )
    .bind(&auth.user_id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::NotFound("user not found".into()))?;

    let display_name = if let Some(ref n) = body.display_name {
        let n = clamp_text(n, 80);
        if n.is_empty() {
            return Err(AppError::BadRequest("display_name required".into()));
        }
        n
    } else {
        cur.display_name
    };

    let bio = body
        .bio
        .as_ref()
        .map(|b| clamp_text(b, 500))
        .unwrap_or(cur.bio);

    let avatar_url = if body.clear_avatar == Some(true) {
        None
    } else if let Some(ref u) = body.avatar_url {
        let u = u.trim();
        if u.is_empty() {
            None
        } else if u.len() > 500 {
            return Err(AppError::BadRequest("avatar_url too long".into()));
        } else {
            Some(u.to_string())
        }
    } else {
        cur.avatar_url
    };

    let cookbook_title = body
        .cookbook_title
        .as_ref()
        .map(|t| clamp_text(t, 80))
        .unwrap_or(cur.cookbook_title);

    let tagline = body
        .tagline
        .as_ref()
        .map(|t| clamp_text(t, 160))
        .unwrap_or(cur.tagline);

    let cover_style = if let Some(ref s) = body.cover_style {
        let s = s.trim().to_lowercase();
        if !COVER_STYLES.contains(&s.as_str()) {
            return Err(AppError::BadRequest(format!(
                "cover_style must be one of: {}",
                COVER_STYLES.join(", ")
            )));
        }
        s
    } else {
        cur.cover_style
    };

    let accent_hex = if body.clear_accent == Some(true) {
        None
    } else if let Some(ref h) = body.accent_hex {
        normalize_accent(h)?
    } else {
        cur.accent_hex
    };

    let favorite_cuisines = body
        .favorite_cuisines
        .as_ref()
        .map(|t| clamp_text(t, 200))
        .unwrap_or(cur.favorite_cuisines);

    let location_label = body
        .location_label
        .as_ref()
        .map(|t| clamp_text(t, 80))
        .unwrap_or(cur.location_label);

    let cover_url = if body.clear_cover == Some(true) {
        None
    } else if let Some(ref u) = body.cover_url {
        let u = u.trim();
        if u.is_empty() {
            None
        } else if u.len() > 500 {
            return Err(AppError::BadRequest("cover_url too long".into()));
        } else {
            Some(u.to_string())
        }
    } else {
        cur.cover_url
    };

    sqlx::query(
        r#"
        UPDATE users SET
            display_name = $2,
            bio = $3,
            avatar_url = $4,
            cookbook_title = $5,
            tagline = $6,
            cover_style = $7,
            accent_hex = $8,
            favorite_cuisines = $9,
            location_label = $10,
            cover_url = $11,
            updated_at = NOW()
        WHERE id = $1
        "#,
    )
    .bind(&auth.user_id)
    .bind(&display_name)
    .bind(&bio)
    .bind(&avatar_url)
    .bind(&cookbook_title)
    .bind(&tagline)
    .bind(&cover_style)
    .bind(&accent_hex)
    .bind(&favorite_cuisines)
    .bind(&location_label)
    .bind(&cover_url)
    .execute(pool)
    .await?;

    let row = load_profile_row(pool, &cur.handle).await?;
    Ok(Json(
        build_profile_dto(pool, row, Some(auth.user_id.as_str())).await?,
    ))
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

/// GET /v1/users/{handle}/following — people this user follows
pub async fn list_user_following(
    State(state): State<AppState>,
    auth: OptionalAuthUser,
    Path(handle): Path<String>,
    Query(q): Query<ListFollowQuery>,
) -> ApiResult<Json<serde_json::Value>> {
    let pool = require_pool(&state)?;
    let target = user_id_by_handle(pool, &handle).await?;
    if let Some(viewer) = auth.0.as_ref() {
        if blocked_either(pool, &viewer.user_id, &target).await? {
            return Err(AppError::NotFound("user not found".into()));
        }
    }
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
    .bind(&target)
    .bind(limit)
    .fetch_all(pool)
    .await?;
    Ok(Json(serde_json::json!({ "items": rows, "kind": "following", "handle": handle })))
}

/// GET /v1/users/{handle}/followers — people who follow this user
pub async fn list_user_followers(
    State(state): State<AppState>,
    auth: OptionalAuthUser,
    Path(handle): Path<String>,
    Query(q): Query<ListFollowQuery>,
) -> ApiResult<Json<serde_json::Value>> {
    let pool = require_pool(&state)?;
    let target = user_id_by_handle(pool, &handle).await?;
    if let Some(viewer) = auth.0.as_ref() {
        if blocked_either(pool, &viewer.user_id, &target).await? {
            return Err(AppError::NotFound("user not found".into()));
        }
    }
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
    .bind(&target)
    .bind(limit)
    .fetch_all(pool)
    .await?;
    Ok(Json(serde_json::json!({ "items": rows, "kind": "followers", "handle": handle })))
}
