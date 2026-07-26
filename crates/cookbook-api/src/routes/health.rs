use axum::extract::State;
use axum::Json;
use cookbook_core::{HealthResponse, ReadyResponse};

use crate::error::{ApiResult, AppError};
use crate::state::AppState;

pub async fn healthz() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok".into(),
        service: "cookbook-api".into(),
        version: env!("CARGO_PKG_VERSION").into(),
    })
}

pub async fn readyz(State(state): State<AppState>) -> ApiResult<Json<ReadyResponse>> {
    match &state.pool {
        Some(pool) => match cookbook_db::ping(pool).await {
            Ok(()) => Ok(Json(ReadyResponse {
                status: "ready".into(),
                database: "up".into(),
            })),
            Err(e) => {
                tracing::warn!(error = %e, "readyz db ping failed");
                Err(AppError::Unavailable("database not ready".into()))
            }
        },
        None => Err(AppError::Unavailable("database not configured".into())),
    }
}
