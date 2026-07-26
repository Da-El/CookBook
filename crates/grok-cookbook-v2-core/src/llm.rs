//! LLM provider bones — **SpaceXAI / xAI** ready; not live yet.
//!
//! Env (when you wire it):
//! - `XAI_API_KEY` — server-side only
//! - `XAI_BASE_URL` — default `https://api.x.ai/v1`
//! - `XAI_MODEL` — default `grok-4.5` (confirm on docs.x.ai)

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use thiserror::Error;

use crate::domain::LlmCapability;

#[derive(Debug, Error)]
pub enum LlmError {
    #[error("LLM not configured: {0}")]
    NotConfigured(String),
    #[error("LLM stub only — capability {0:?} not executed")]
    StubOnly(LlmCapability),
    #[error("provider error: {0}")]
    Provider(String),
    #[error("parse error: {0}")]
    Parse(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LlmMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LlmRequest {
    pub capability: LlmCapability,
    pub system: String,
    pub messages: Vec<LlmMessage>,
    /// Optional JSON schema name for structured outputs later
    #[serde(default)]
    pub schema_hint: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LlmResponse {
    pub text: String,
    #[serde(default)]
    pub json: Option<serde_json::Value>,
    pub model: String,
    pub provider: String,
    /// true when response is a local stub
    pub is_stub: bool,
}

/// Implement this with a real SpaceXAI client later.
#[async_trait]
pub trait LlmProvider: Send + Sync {
    fn name(&self) -> &str;
    fn is_live(&self) -> bool;

    async fn complete(&self, req: LlmRequest) -> Result<LlmResponse, LlmError>;
}

/// Default provider — never calls the network.
pub struct StubLlm;

#[async_trait]
impl LlmProvider for StubLlm {
    fn name(&self) -> &str {
        "stub"
    }

    fn is_live(&self) -> bool {
        false
    }

    async fn complete(&self, req: LlmRequest) -> Result<LlmResponse, LlmError> {
        Ok(LlmResponse {
            text: format!(
                "[stub] capability={:?} — set XAI_API_KEY and swap StubLlm for XaiLlm later.",
                req.capability
            ),
            json: None,
            model: "none".into(),
            provider: "stub".into(),
            is_stub: true,
        })
    }
}

/// Skeleton for SpaceXAI (xAI OpenAI-compatible API).
/// **Not used until you implement `complete` with reqwest + `XAI_API_KEY`.**
pub struct XaiLlm {
    pub api_key: String,
    pub base_url: String,
    pub model: String,
}

impl XaiLlm {
    /// Build from env if `XAI_API_KEY` is set; otherwise `None`.
    pub fn from_env() -> Option<Self> {
        let api_key = std::env::var("XAI_API_KEY").ok().filter(|s| !s.is_empty())?;
        let base_url = std::env::var("XAI_BASE_URL")
            .unwrap_or_else(|_| "https://api.x.ai/v1".into());
        let model = std::env::var("XAI_MODEL").unwrap_or_else(|_| "grok-4.5".into());
        Some(Self {
            api_key,
            base_url,
            model,
        })
    }
}

#[async_trait]
impl LlmProvider for XaiLlm {
    fn name(&self) -> &str {
        "spacexai-xai"
    }

    fn is_live(&self) -> bool {
        // Bones only — treat as not live until complete() is implemented for real.
        false
    }

    async fn complete(&self, req: LlmRequest) -> Result<LlmResponse, LlmError> {
        // Intentionally not calling the network yet.
        // When ready: POST {base_url}/chat/completions or /responses with Bearer api_key.
        let _ = (&self.api_key, &self.base_url);
        Err(LlmError::NotConfigured(format!(
            "XaiLlm bones only (model={}). Implement HTTP client when ready. Capability={:?}",
            self.model, req.capability
        )))
    }
}

/// Pick provider: prefer XAI env skeleton if present, else stub.
pub fn default_provider() -> Box<dyn LlmProvider> {
    if XaiLlm::from_env().is_some() {
        // Still return Stub for actual calls until XaiLlm::complete is real;
        // expose that key exists via health.
        Box::new(StubLlm)
    } else {
        Box::new(StubLlm)
    }
}

pub fn xai_key_configured() -> bool {
    std::env::var("XAI_API_KEY")
        .map(|s| !s.is_empty())
        .unwrap_or(false)
}
