use serde::{Deserialize, Serialize};

/// Standard JSON API envelope for success/error.
#[derive(Debug, Serialize)]
pub struct ApiErrorBody {
    pub error: ApiError,
}

#[derive(Debug, Serialize)]
pub struct ApiError {
    pub code: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthResponse {
    pub status: String,
    pub service: String,
    pub version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReadyResponse {
    pub status: String,
    pub database: String,
}
