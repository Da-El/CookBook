use crate::auth::jwt::JwtKeys;
use crate::catalog::Catalog;
use sqlx::PgPool;
use std::sync::Arc;

#[derive(Clone)]
pub struct AppState {
    pub pool: Option<PgPool>,
    pub catalog: Arc<Catalog>,
    pub jwt: JwtKeys,
    /// Free USDA FoodData Central API key (api.data.gov). Used for Branded search only.
    pub fdc_api_key: String,
    pub http: reqwest::Client,
}
