mod foods;
mod fridge;
mod health;

use axum::routing::{delete, get};
use axum::Router;
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/healthz", get(health::healthz))
        .route("/readyz", get(health::readyz))
        .route("/v1/health", get(health::healthz))
        .route("/v1/foods", get(foods::list_foods))
        .route("/v1/foods/groups", get(foods::list_groups))
        .route("/v1/foods/{id}", get(foods::get_food))
        .route("/v1/fridge", get(fridge::list_fridge).post(fridge::add_fridge))
        .route("/v1/fridge/{id}", delete(fridge::delete_fridge))
}
