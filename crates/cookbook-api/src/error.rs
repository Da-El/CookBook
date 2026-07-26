use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use cookbook_core::{ApiError, ApiErrorBody};

pub type ApiResult<T> = Result<T, AppError>;

#[derive(Debug)]
pub enum AppError {
    NotFound(String),
    BadRequest(String),
    Unauthorized(String),
    Conflict(String),
    Unavailable(String),
    Internal(String),
}

impl AppError {
    fn status(&self) -> StatusCode {
        match self {
            AppError::NotFound(_) => StatusCode::NOT_FOUND,
            AppError::BadRequest(_) => StatusCode::BAD_REQUEST,
            AppError::Unauthorized(_) => StatusCode::UNAUTHORIZED,
            AppError::Conflict(_) => StatusCode::CONFLICT,
            AppError::Unavailable(_) => StatusCode::SERVICE_UNAVAILABLE,
            AppError::Internal(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }

    fn code(&self) -> &'static str {
        match self {
            AppError::NotFound(_) => "not_found",
            AppError::BadRequest(_) => "bad_request",
            AppError::Unauthorized(_) => "unauthorized",
            AppError::Conflict(_) => "conflict",
            AppError::Unavailable(_) => "unavailable",
            AppError::Internal(_) => "internal",
        }
    }

    fn message(&self) -> &str {
        match self {
            AppError::NotFound(m)
            | AppError::BadRequest(m)
            | AppError::Unauthorized(m)
            | AppError::Conflict(m)
            | AppError::Unavailable(m)
            | AppError::Internal(m) => m,
        }
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let body = ApiErrorBody {
            error: ApiError {
                code: self.code().to_string(),
                message: self.message().to_string(),
            },
        };
        (self.status(), Json(body)).into_response()
    }
}

impl From<sqlx::Error> for AppError {
    fn from(value: sqlx::Error) -> Self {
        tracing::error!(error = %value, "database error");
        AppError::Internal("database error".into())
    }
}
