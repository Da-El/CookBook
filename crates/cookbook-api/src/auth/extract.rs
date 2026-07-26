use axum::extract::FromRequestParts;
use axum::http::request::Parts;
use axum_extra::headers::{authorization::Bearer, Authorization};
use axum_extra::TypedHeader;

use crate::auth::jwt::AccessClaims;
use crate::error::AppError;
use crate::state::AppState;

#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct AuthUser {
    pub user_id: String,
    pub session_id: String,
    pub handle: String,
    pub email: String,
    pub token_version: i32,
}

impl FromRequestParts<AppState> for AuthUser {
    type Rejection = AppError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let TypedHeader(Authorization(bearer)) =
            TypedHeader::<Authorization<Bearer>>::from_request_parts(parts, state)
                .await
                .map_err(|_| AppError::Unauthorized("missing bearer token".into()))?;

        let claims: AccessClaims = state.jwt.verify(bearer.token())?;

        // Optional: verify session not revoked + token_version matches
        if let Some(pool) = &state.pool {
            let row: Option<(i32, Option<chrono::DateTime<chrono::Utc>>)> = sqlx::query_as(
                r#"
                SELECT u.token_version, s.revoked_at
                FROM users u
                JOIN sessions s ON s.user_id = u.id
                WHERE u.id = $1 AND s.id = $2
                "#,
            )
            .bind(&claims.sub)
            .bind(&claims.sid)
            .fetch_optional(pool)
            .await?;

            match row {
                None => return Err(AppError::Unauthorized("session not found".into())),
                Some((_, Some(_))) => {
                    return Err(AppError::Unauthorized("session revoked".into()))
                }
                Some((ver, None)) if ver != claims.ver => {
                    return Err(AppError::Unauthorized("token version mismatch".into()))
                }
                Some(_) => {}
            }
        }

        Ok(AuthUser {
            user_id: claims.sub,
            session_id: claims.sid,
            handle: claims.handle,
            email: claims.email,
            token_version: claims.ver,
        })
    }
}
