use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};

use crate::error::AppError;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccessClaims {
    pub sub: String, // user id
    pub sid: String, // session id
    pub ver: i32,    // token_version
    pub handle: String,
    pub email: String,
    pub exp: i64,
    pub iat: i64,
}

#[derive(Clone)]
pub struct JwtKeys {
    encoding: EncodingKey,
    decoding: DecodingKey,
}

impl JwtKeys {
    pub fn from_secret(secret: &str) -> Self {
        Self {
            encoding: EncodingKey::from_secret(secret.as_bytes()),
            decoding: DecodingKey::from_secret(secret.as_bytes()),
        }
    }

    pub fn mint(
        &self,
        user_id: &str,
        session_id: &str,
        token_version: i32,
        handle: &str,
        email: &str,
        ttl: Duration,
    ) -> Result<String, AppError> {
        let now = Utc::now();
        let claims = AccessClaims {
            sub: user_id.to_string(),
            sid: session_id.to_string(),
            ver: token_version,
            handle: handle.to_string(),
            email: email.to_string(),
            iat: now.timestamp(),
            exp: (now + ttl).timestamp(),
        };
        encode(&Header::default(), &claims, &self.encoding)
            .map_err(|e| AppError::Internal(format!("jwt encode: {e}")))
    }

    pub fn verify(&self, token: &str) -> Result<AccessClaims, AppError> {
        let mut validation = Validation::default();
        validation.validate_exp = true;
        decode::<AccessClaims>(token, &self.decoding, &validation)
            .map(|d| d.claims)
            .map_err(|_| AppError::Unauthorized("invalid or expired access token".into()))
    }
}
