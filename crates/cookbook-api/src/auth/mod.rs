pub mod jwt;
pub mod password;
pub mod extract;

use chrono::{Duration, Utc};
use rand::RngCore;
use sha2::{Digest, Sha256};

pub fn new_refresh_token() -> String {
    let mut bytes = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut bytes);
    hex::encode(bytes)
}

pub fn hash_token(token: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(token.as_bytes());
    hex::encode(hasher.finalize())
}

pub fn refresh_ttl(remember: bool) -> Duration {
    if remember {
        Duration::days(90)
    } else {
        Duration::days(30)
    }
}

pub fn access_ttl() -> Duration {
    Duration::minutes(15)
}

pub fn now() -> chrono::DateTime<Utc> {
    Utc::now()
}
