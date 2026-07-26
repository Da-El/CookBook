use axum::extract::State;
use axum::Json;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use ulid::Ulid;

use crate::auth::extract::AuthUser;
use crate::auth::password::{dummy_verify, hash_password, verify_password};
use crate::auth::{access_ttl, hash_token, new_refresh_token, now, refresh_ttl};
use crate::error::{ApiResult, AppError};
use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct RegisterBody {
    pub email: String,
    pub password: String,
    pub display_name: String,
    pub handle: String,
}

#[derive(Debug, Deserialize)]
pub struct LoginBody {
    pub email: String,
    pub password: String,
    #[serde(default)]
    pub remember: bool,
}

#[derive(Debug, Deserialize)]
pub struct RefreshBody {
    pub refresh_token: String,
}

#[derive(Debug, Serialize)]
pub struct UserPublic {
    pub id: String,
    pub email: String,
    pub email_verified: bool,
    pub display_name: String,
    pub handle: String,
    pub bio: String,
}

#[derive(Debug, Serialize)]
pub struct TokenPair {
    pub access_token: String,
    pub refresh_token: String,
    pub token_type: String,
    pub expires_in: i64,
    pub user: UserPublic,
}

#[derive(Debug, sqlx::FromRow)]
struct UserRow {
    id: String,
    email: String,
    email_verified: bool,
    password_hash: Option<String>,
    display_name: String,
    handle: String,
    bio: String,
    token_version: i32,
}

fn require_pool(state: &AppState) -> ApiResult<&sqlx::PgPool> {
    state
        .pool
        .as_ref()
        .ok_or_else(|| AppError::Unavailable("database required for auth".into()))
}

fn normalize_email(email: &str) -> String {
    email.trim().to_lowercase()
}

fn validate_handle(handle: &str) -> ApiResult<()> {
    let h = handle.trim();
    if h.len() < 3 || h.len() > 30 {
        return Err(AppError::BadRequest(
            "handle must be 3-30 characters".into(),
        ));
    }
    if !h
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
    {
        return Err(AppError::BadRequest(
            "handle may only contain letters, numbers, _ and -".into(),
        ));
    }
    let reserved = ["admin", "api", "settings", "login", "signup", "me", "null"];
    if reserved.contains(&h.to_lowercase().as_str()) {
        return Err(AppError::BadRequest("handle is reserved".into()));
    }
    Ok(())
}

fn user_public(u: &UserRow) -> UserPublic {
    UserPublic {
        id: u.id.clone(),
        email: u.email.clone(),
        email_verified: u.email_verified,
        display_name: u.display_name.clone(),
        handle: u.handle.clone(),
        bio: u.bio.clone(),
    }
}

async fn audit(
    pool: &sqlx::PgPool,
    user_id: Option<&str>,
    event: &str,
    meta: serde_json::Value,
) {
    let _ = sqlx::query(
        r#"
        INSERT INTO auth_audit (id, user_id, event, meta)
        VALUES ($1, $2, $3, $4)
        "#,
    )
    .bind(Ulid::new().to_string())
    .bind(user_id)
    .bind(event)
    .bind(meta)
    .execute(pool)
    .await;
}

async fn issue_tokens(
    state: &AppState,
    pool: &sqlx::PgPool,
    user: &UserRow,
    remember: bool,
) -> ApiResult<TokenPair> {
    let session_id = Ulid::new().to_string();
    let family_id = Ulid::new().to_string();
    let refresh = new_refresh_token();
    let refresh_hash = hash_token(&refresh);
    let now_ts = now();
    let refresh_exp = now_ts + refresh_ttl(remember);

    sqlx::query(
        r#"
        INSERT INTO sessions (id, user_id, expires_at, remember)
        VALUES ($1, $2, $3, $4)
        "#,
    )
    .bind(&session_id)
    .bind(&user.id)
    .bind(refresh_exp)
    .bind(remember)
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        INSERT INTO refresh_tokens (id, session_id, user_id, token_hash, family_id, expires_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        "#,
    )
    .bind(Ulid::new().to_string())
    .bind(&session_id)
    .bind(&user.id)
    .bind(&refresh_hash)
    .bind(&family_id)
    .bind(refresh_exp)
    .execute(pool)
    .await?;

    let access = state.jwt.mint(
        &user.id,
        &session_id,
        user.token_version,
        &user.handle,
        &user.email,
        access_ttl(),
    )?;

    Ok(TokenPair {
        access_token: access,
        refresh_token: refresh,
        token_type: "Bearer".into(),
        expires_in: access_ttl().num_seconds(),
        user: user_public(user),
    })
}

pub async fn register(
    State(state): State<AppState>,
    Json(body): Json<RegisterBody>,
) -> ApiResult<Json<TokenPair>> {
    let pool = require_pool(&state)?;
    let email = normalize_email(&body.email);
    if !email.contains('@') || email.len() < 5 {
        return Err(AppError::BadRequest("invalid email".into()));
    }
    let handle = body.handle.trim().to_lowercase();
    validate_handle(&handle)?;
    let display_name = body.display_name.trim();
    if display_name.is_empty() || display_name.len() > 80 {
        return Err(AppError::BadRequest("display_name required (max 80)".into()));
    }

    let password_hash = hash_password(&body.password)?;
    let id = Ulid::new().to_string();

    let inserted = sqlx::query(
        r#"
        INSERT INTO users (id, email, password_hash, display_name, handle, email_verified)
        VALUES ($1, $2, $3, $4, $5, FALSE)
        "#,
    )
    .bind(&id)
    .bind(&email)
    .bind(&password_hash)
    .bind(display_name)
    .bind(&handle)
    .execute(pool)
    .await;

    if let Err(e) = inserted {
        if let sqlx::Error::Database(db) = &e {
            if db.constraint().is_some() {
                return Err(AppError::Conflict(
                    "email or handle already registered".into(),
                ));
            }
        }
        return Err(e.into());
    }

    let user = UserRow {
        id: id.clone(),
        email: email.clone(),
        email_verified: false,
        password_hash: Some(password_hash),
        display_name: display_name.to_string(),
        handle: handle.clone(),
        bio: String::new(),
        token_version: 0,
    };

    let tokens = issue_tokens(&state, pool, &user, false).await?;
    audit(
        pool,
        Some(&id),
        "register",
        serde_json::json!({ "handle": handle }),
    )
    .await;
    Ok(Json(tokens))
}

pub async fn login(
    State(state): State<AppState>,
    Json(body): Json<LoginBody>,
) -> ApiResult<Json<TokenPair>> {
    let pool = require_pool(&state)?;
    let email = normalize_email(&body.email);

    let user: Option<UserRow> = sqlx::query_as(
        r#"
        SELECT id, email, email_verified, password_hash, display_name, handle, bio, token_version
        FROM users WHERE email = $1
        "#,
    )
    .bind(&email)
    .fetch_optional(pool)
    .await?;

    let Some(user) = user else {
        dummy_verify();
        audit(pool, None, "login_failed", serde_json::json!({ "email": email })).await;
        return Err(AppError::Unauthorized("invalid email or password".into()));
    };

    let hash = user.password_hash.as_deref().unwrap_or("");
    if hash.is_empty() || !verify_password(&body.password, hash)? {
        audit(
            pool,
            Some(&user.id),
            "login_failed",
            serde_json::json!({ "reason": "bad_password" }),
        )
        .await;
        return Err(AppError::Unauthorized("invalid email or password".into()));
    }

    let tokens = issue_tokens(&state, pool, &user, body.remember).await?;
    audit(pool, Some(&user.id), "login", serde_json::json!({})).await;
    Ok(Json(tokens))
}

pub async fn refresh(
    State(state): State<AppState>,
    Json(body): Json<RefreshBody>,
) -> ApiResult<Json<TokenPair>> {
    let pool = require_pool(&state)?;
    let presented = body.refresh_token.trim();
    if presented.is_empty() {
        return Err(AppError::BadRequest("refresh_token required".into()));
    }
    let presented_hash = hash_token(presented);

    #[derive(sqlx::FromRow)]
    struct RefreshRow {
        id: String,
        session_id: String,
        user_id: String,
        family_id: String,
        expires_at: DateTime<Utc>,
        revoked_at: Option<DateTime<Utc>>,
    }

    let row: Option<RefreshRow> = sqlx::query_as(
        r#"
        SELECT id, session_id, user_id, family_id, expires_at, revoked_at
        FROM refresh_tokens
        WHERE token_hash = $1
        "#,
    )
    .bind(&presented_hash)
    .fetch_optional(pool)
    .await?;

    let Some(row) = row else {
        return Err(AppError::Unauthorized("invalid refresh token".into()));
    };

    if row.revoked_at.is_some() {
        // reuse detection — revoke family
        sqlx::query(
            r#"
            UPDATE refresh_tokens SET revoked_at = NOW()
            WHERE family_id = $1 AND revoked_at IS NULL
            "#,
        )
        .bind(&row.family_id)
        .execute(pool)
        .await?;
        sqlx::query(
            r#"
            UPDATE sessions SET revoked_at = NOW()
            WHERE id = $1 AND revoked_at IS NULL
            "#,
        )
        .bind(&row.session_id)
        .execute(pool)
        .await?;
        audit(
            pool,
            Some(&row.user_id),
            "refresh_reuse",
            serde_json::json!({ "family_id": row.family_id }),
        )
        .await;
        return Err(AppError::Unauthorized(
            "refresh token reuse detected — session revoked".into(),
        ));
    }

    if row.expires_at < now() {
        return Err(AppError::Unauthorized("refresh token expired".into()));
    }

    // rotate: revoke old, mint new
    let new_raw = new_refresh_token();
    let new_hash = hash_token(&new_raw);
    let new_id = Ulid::new().to_string();

    sqlx::query(
        r#"
        UPDATE refresh_tokens
        SET revoked_at = NOW(), replaced_by = $2
        WHERE id = $1
        "#,
    )
    .bind(&row.id)
    .bind(&new_id)
    .execute(pool)
    .await?;

    let sess: Option<(bool, DateTime<Utc>)> = sqlx::query_as(
        r#"
        SELECT remember, expires_at FROM sessions WHERE id = $1 AND revoked_at IS NULL
        "#,
    )
    .bind(&row.session_id)
    .fetch_optional(pool)
    .await?;

    let Some((remember, _)) = sess else {
        return Err(AppError::Unauthorized("session revoked".into()));
    };

    let refresh_exp = now() + refresh_ttl(remember);
    sqlx::query(
        r#"
        INSERT INTO refresh_tokens (id, session_id, user_id, token_hash, family_id, expires_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        "#,
    )
    .bind(&new_id)
    .bind(&row.session_id)
    .bind(&row.user_id)
    .bind(&new_hash)
    .bind(&row.family_id)
    .bind(refresh_exp)
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        UPDATE sessions SET last_seen_at = NOW(), expires_at = $2 WHERE id = $1
        "#,
    )
    .bind(&row.session_id)
    .bind(refresh_exp)
    .execute(pool)
    .await?;

    let user: UserRow = sqlx::query_as(
        r#"
        SELECT id, email, email_verified, password_hash, display_name, handle, bio, token_version
        FROM users WHERE id = $1
        "#,
    )
    .bind(&row.user_id)
    .fetch_one(pool)
    .await?;

    let access = state.jwt.mint(
        &user.id,
        &row.session_id,
        user.token_version,
        &user.handle,
        &user.email,
        access_ttl(),
    )?;

    Ok(Json(TokenPair {
        access_token: access,
        refresh_token: new_raw,
        token_type: "Bearer".into(),
        expires_in: access_ttl().num_seconds(),
        user: user_public(&user),
    }))
}

pub async fn logout(
    State(state): State<AppState>,
    auth: AuthUser,
) -> ApiResult<Json<serde_json::Value>> {
    let pool = require_pool(&state)?;
    sqlx::query(
        r#"
        UPDATE sessions SET revoked_at = NOW()
        WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL
        "#,
    )
    .bind(&auth.session_id)
    .bind(&auth.user_id)
    .execute(pool)
    .await?;
    sqlx::query(
        r#"
        UPDATE refresh_tokens SET revoked_at = NOW()
        WHERE session_id = $1 AND revoked_at IS NULL
        "#,
    )
    .bind(&auth.session_id)
    .execute(pool)
    .await?;
    audit(pool, Some(&auth.user_id), "logout", serde_json::json!({})).await;
    Ok(Json(serde_json::json!({ "ok": true })))
}

pub async fn logout_all(
    State(state): State<AppState>,
    auth: AuthUser,
) -> ApiResult<Json<serde_json::Value>> {
    let pool = require_pool(&state)?;
    sqlx::query(
        r#"
        UPDATE sessions SET revoked_at = NOW()
        WHERE user_id = $1 AND revoked_at IS NULL
        "#,
    )
    .bind(&auth.user_id)
    .execute(pool)
    .await?;
    sqlx::query(
        r#"
        UPDATE refresh_tokens SET revoked_at = NOW()
        WHERE user_id = $1 AND revoked_at IS NULL
        "#,
    )
    .bind(&auth.user_id)
    .execute(pool)
    .await?;
    sqlx::query(
        r#"
        UPDATE users SET token_version = token_version + 1 WHERE id = $1
        "#,
    )
    .bind(&auth.user_id)
    .execute(pool)
    .await?;
    audit(
        pool,
        Some(&auth.user_id),
        "logout_all",
        serde_json::json!({}),
    )
    .await;
    Ok(Json(serde_json::json!({ "ok": true })))
}

pub async fn me(
    State(state): State<AppState>,
    auth: AuthUser,
) -> ApiResult<Json<UserPublic>> {
    let pool = require_pool(&state)?;
    let user: UserRow = sqlx::query_as(
        r#"
        SELECT id, email, email_verified, password_hash, display_name, handle, bio, token_version
        FROM users WHERE id = $1
        "#,
    )
    .bind(&auth.user_id)
    .fetch_one(pool)
    .await?;
    Ok(Json(user_public(&user)))
}

pub async fn list_sessions(
    State(state): State<AppState>,
    auth: AuthUser,
) -> ApiResult<Json<serde_json::Value>> {
    let pool = require_pool(&state)?;
    #[derive(Serialize, sqlx::FromRow)]
    struct Sess {
        id: String,
        created_at: DateTime<Utc>,
        last_seen_at: DateTime<Utc>,
        expires_at: DateTime<Utc>,
        remember: bool,
        current: bool,
    }
    let rows: Vec<(String, DateTime<Utc>, DateTime<Utc>, DateTime<Utc>, bool)> = sqlx::query_as(
        r#"
        SELECT id, created_at, last_seen_at, expires_at, remember
        FROM sessions
        WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > NOW()
        ORDER BY last_seen_at DESC
        "#,
    )
    .bind(&auth.user_id)
    .fetch_all(pool)
    .await?;

    let items: Vec<Sess> = rows
        .into_iter()
        .map(|(id, created_at, last_seen_at, expires_at, remember)| Sess {
            current: id == auth.session_id,
            id,
            created_at,
            last_seen_at,
            expires_at,
            remember,
        })
        .collect();

    Ok(Json(serde_json::json!({ "items": items })))
}
