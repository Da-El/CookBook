//! CookBook **V2** core — domain models + LLM bones.
//!
//! Completely independent of V1 (meals / fridge / social). Wire SpaceXAI later via
//! [`llm::LlmProvider`]; today only [`llm::StubLlm`] is used.

pub mod domain;
pub mod llm;
pub mod prompts;
pub mod services;

pub use domain::*;
pub use llm::*;
pub use services::*;
