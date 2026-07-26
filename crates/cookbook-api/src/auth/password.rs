use argon2::password_hash::{
    rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString,
};
use argon2::{Argon2, Params, Version};

use crate::error::AppError;

fn argon() -> Argon2<'static> {
    // ~19 MiB, t=2 — interactive but solid baseline
    let params = Params::new(19_456, 2, 1, None).expect("argon2 params");
    Argon2::new(argon2::Algorithm::Argon2id, Version::V0x13, params)
}

pub fn hash_password(password: &str) -> Result<String, AppError> {
    if password.len() < 12 {
        return Err(AppError::BadRequest(
            "password must be at least 12 characters".into(),
        ));
    }
    let salt = SaltString::generate(&mut OsRng);
    argon()
        .hash_password(password.as_bytes(), &salt)
        .map(|h| h.to_string())
        .map_err(|e| AppError::Internal(format!("password hash failed: {e}")))
}

pub fn verify_password(password: &str, hash: &str) -> Result<bool, AppError> {
    let parsed = PasswordHash::new(hash)
        .map_err(|_| AppError::Internal("invalid stored password hash".into()))?;
    Ok(argon()
        .verify_password(password.as_bytes(), &parsed)
        .is_ok())
}

/// Timing-safe-ish dummy verify when user missing (still costs Argon2 work).
pub fn dummy_verify() {
    let dummy = "$argon2id$v=19$m=19456,t=2,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
    let _ = verify_password("dummy-password-xx", dummy);
}
