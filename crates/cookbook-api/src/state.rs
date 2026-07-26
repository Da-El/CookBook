use crate::catalog::Catalog;
use sqlx::PgPool;
use std::sync::Arc;

#[derive(Clone)]
pub struct AppState {
    pub pool: Option<PgPool>,
    pub catalog: Arc<Catalog>,
}
