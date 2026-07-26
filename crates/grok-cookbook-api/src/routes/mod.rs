mod auth;
mod feed;
mod foods;
mod follows;
mod fridge;
mod health;
mod meals;
pub mod media;
mod reviews;

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
        // Media
        .route("/v1/media", post(media::upload_image))
        // Catalog (meta before bare {id} is fine; static segments first)
        .route("/v1/foods", get(foods::list_foods))
        .route("/v1/foods/groups", get(foods::list_groups))
        .route(
            "/v1/foods/{id}/meta",
            get(foods::get_food_meta).put(foods::put_food_meta),
        )
        .route("/v1/foods/{id}", get(foods::get_food))
        // Fridge (auth required)
        .route("/v1/fridge", get(fridge::list_fridge).post(fridge::add_fridge))
        .route("/v1/fridge/{id}", delete(fridge::delete_fridge))
        // Meals (search before {id})
        .route("/v1/meals", get(meals::list_meals).post(meals::create_meal))
        .route("/v1/meals/search", get(meals::search_meals))
        .route(
            "/v1/meals/{id}",
            get(meals::get_meal)
                .patch(meals::update_meal)
                .delete(meals::delete_meal),
        )
        // Reviews
        .route("/v1/reviews", get(reviews::list_reviews).put(reviews::upsert_review))
        .route("/v1/reviews/{id}", delete(reviews::delete_review))
        // Social (static follow lists before {handle})
        .route("/v1/users/{handle}", get(follows::get_profile))
        .route("/v1/follows/following", get(follows::list_following))
        .route("/v1/follows/followers", get(follows::list_followers))
        .route(
            "/v1/follows/{handle}",
            post(follows::follow).delete(follows::unfollow),
        )
        // Feed
        .route("/v1/feed", get(feed::get_feed))
}
