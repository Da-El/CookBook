//! CookBook V2 API — separate binary from V1 (`grok-cookbook-api`).
//! Default port **8081**. No V1 auth/DB required for bones.

mod state;
mod routes;

use axum::Router;
use state::AppState;
use std::net::SocketAddr;
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();

    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "grok_cookbook_v2_api=info,tower_http=info".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let host = std::env::var("V2_HOST").unwrap_or_else(|_| "127.0.0.1".into());
    let port: u16 = std::env::var("V2_PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(8081);

    let state = AppState::new();
    tracing::info!(
        llm_stub = true,
        xai_key_set = grok_cookbook_v2_core::xai_key_configured(),
        "starting CookBook V2 API (LLM bones only)"
    );

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .merge(routes::router())
        .layer(TraceLayer::new_for_http())
        .layer(cors)
        .with_state(Arc::new(state));

    let addr: SocketAddr = format!("{host}:{port}").parse()?;
    tracing::info!(%addr, "listening (V2 — not V1)");
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}
