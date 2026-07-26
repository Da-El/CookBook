//! Image upload — stores compressed JPEG/PNG under UPLOAD_DIR, serves at /media/*.

use axum::extract::State;
use axum::Json;
use base64::Engine;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use ulid::Ulid;

use crate::auth::extract::AuthUser;
use crate::error::{ApiResult, AppError};
use crate::state::AppState;

const MAX_BYTES: usize = 3 * 1024 * 1024; // 3 MB decoded

#[derive(Debug, Deserialize)]
pub struct UploadBody {
    /// data:image/jpeg;base64,... or raw base64
    pub image: String,
}

#[derive(Debug, Serialize)]
pub struct UploadResponse {
    pub url: String,
    pub id: String,
}

fn upload_dir() -> PathBuf {
    PathBuf::from(
        std::env::var("UPLOAD_DIR").unwrap_or_else(|_| "uploads".to_string()),
    )
}

pub async fn upload_image(
    State(_state): State<AppState>,
    _auth: AuthUser,
    Json(body): Json<UploadBody>,
) -> ApiResult<Json<UploadResponse>> {
    let raw = body.image.trim();
    if raw.is_empty() {
        return Err(AppError::BadRequest("image required".into()));
    }

    let (content_type, b64) = if let Some(rest) = raw.strip_prefix("data:") {
        let (meta, data) = rest
            .split_once(',')
            .ok_or_else(|| AppError::BadRequest("invalid data URL".into()))?;
        let ct = meta
            .split(';')
            .next()
            .unwrap_or("image/jpeg")
            .to_string();
        (ct, data)
    } else {
        ("image/jpeg".to_string(), raw)
    };

    let ext = match content_type.as_str() {
        "image/png" => "png",
        "image/webp" => "webp",
        "image/gif" => "gif",
        "image/jpeg" | "image/jpg" => "jpg",
        _ => {
            return Err(AppError::BadRequest(
                "unsupported image type (use jpeg, png, or webp)".into(),
            ))
        }
    };

    let bytes = base64::engine::general_purpose::STANDARD
        .decode(b64.trim())
        .map_err(|_| AppError::BadRequest("invalid base64 image".into()))?;

    if bytes.is_empty() {
        return Err(AppError::BadRequest("empty image".into()));
    }
    if bytes.len() > MAX_BYTES {
        return Err(AppError::BadRequest(
            "image too large (max 3MB after compress)".into(),
        ));
    }

    // Basic magic-byte check
    let ok_magic = match ext {
        "jpg" => bytes.len() >= 3 && bytes[0] == 0xFF && bytes[1] == 0xD8,
        "png" => bytes.starts_with(&[0x89, b'P', b'N', b'G']),
        "webp" => bytes.len() >= 12 && &bytes[0..4] == b"RIFF" && &bytes[8..12] == b"WEBP",
        "gif" => bytes.starts_with(b"GIF8"),
        _ => false,
    };
    if !ok_magic {
        return Err(AppError::BadRequest("file does not look like a valid image".into()));
    }

    let dir = upload_dir();
    tokio::fs::create_dir_all(&dir)
        .await
        .map_err(|e| AppError::Internal(format!("upload dir: {e}")))?;

    let id = Ulid::new().to_string();
    let filename = format!("{id}.{ext}");
    let path = dir.join(&filename);
    tokio::fs::write(&path, &bytes)
        .await
        .map_err(|e| AppError::Internal(format!("write upload: {e}")))?;

    let url = format!("/media/{filename}");
    Ok(Json(UploadResponse { url, id }))
}

pub fn media_dir() -> PathBuf {
    upload_dir()
}
