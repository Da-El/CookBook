mod auth;
mod foods;
mod fridge;
mod health;

use axum::routing::{delete, get, post};
use axum::Router;
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/healthz", get(health::healthz))
        .route("/readyz", get(health::readyz))
        .route("/v1/health", get(health::healthz))
        // Auth
        .route("/v1/auth/register", post(auth::register))
        .route("/v1/auth/login", post(auth::login))
        .route("/v1/auth/refresh", post(auth::refresh))
        .route("/v1/auth/logout", post(auth::logout))
        .route("/v1/auth/logout-all", post(auth::logout_all))
        .route("/v1/auth/me", get(auth::me))
        .route("/v1/auth/sessions", get(auth::list_sessions))
        // Catalog
        .route("/v1/foods", get(foods::list_foods))
        .route("/v1/foods/groups", get(foods::list_groups))
        .route("/v1/foods/{id}", get(foods::get_food))
        // Fridge (auth required)
        .route("/v1/fridge", get(fridge::list_fridge).post(fridge::add_fridge))
        .route("/v1/fridge/{id}", delete(fridge::delete_fridge))
}
