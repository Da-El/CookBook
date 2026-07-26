mod auth;
mod catalog;
mod error;
mod routes;
mod state;

use auth::jwt::JwtKeys;
use axum::Router;
use state::AppState;
use std::net::SocketAddr;
use std::path::PathBuf;
use tower_http::cors::{Any, CorsLayer};
use tower_http::services::{ServeDir, ServeFile};
use tower_http::trace::TraceLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();

    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "grok_cookbook_api=info,tower_http=info".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let database_url = std::env::var("DATABASE_URL").unwrap_or_else(|_| {
        "postgres://grok_cookbook:grok_cookbook@127.0.0.1:5432/grok_cookbook".to_string()
    });
    let host = std::env::var("HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
    let port: u16 = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(8080);
    let catalog_path = std::env::var("CATALOG_PATH").unwrap_or_else(|_| {
        "apps/web/public/data/catalog.json".to_string()
    });
    let static_dir = std::env::var("STATIC_DIR").ok();

    tracing::info!(%database_url, %catalog_path, "starting grok-cookbook-api");

    let pool = match grok_cookbook_db::connect(&database_url).await {
        Ok(pool) => {
            if let Err(e) = grok_cookbook_db::migrate(&pool).await {
                tracing::error!(error = %e, "migration failed");
                return Err(e);
            }
            Some(pool)
        }
        Err(e) => {
            tracing::warn!(
                error = %e,
                "database unavailable — API will start in degraded mode (catalog + health only)"
            );
            None
        }
    };

    let catalog = catalog::load_catalog(&catalog_path)?;
    tracing::info!(foods = catalog.foods.len(), "catalog loaded");

    let jwt_secret = std::env::var("JWT_SECRET").unwrap_or_else(|_| {
        tracing::warn!("JWT_SECRET not set — using insecure dev default");
        "dev-only-change-me-grok-cookbook-jwt-secret-32b".into()
    });
    if jwt_secret.len() < 32 {
        tracing::warn!("JWT_SECRET should be at least 32 characters");
    }
    let jwt = JwtKeys::from_secret(&jwt_secret);

    let state = AppState {
        pool,
        catalog,
        jwt,
    };

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let mut app = Router::new()
        .merge(routes::router())
        .layer(TraceLayer::new_for_http())
        .layer(cors)
        .with_state(state);

    if let Some(dir) = static_dir {
        let dir = PathBuf::from(dir);
        if dir.exists() {
            tracing::info!(path = %dir.display(), "serving static frontend");
            let index = dir.join("index.html");
            let spa = ServeDir::new(&dir).not_found_service(ServeFile::new(index));
            app = app.fallback_service(spa);
        } else {
            tracing::warn!(path = %dir.display(), "STATIC_DIR set but missing");
        }
    }

    let addr: SocketAddr = format!("{host}:{port}").parse()?;
    tracing::info!(%addr, "listening");
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}
