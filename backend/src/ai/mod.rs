//! AI provider abstraction. The calendar engine only talks to `AiProvider`,
//! so another provider can be added without touching generation logic.

pub mod ollama;

use async_trait::async_trait;
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct ModelInfo {
    pub name: String,
    pub size_bytes: u64,
    pub parameter_size: Option<String>,
    pub family: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ProviderStatus {
    pub provider: &'static str,
    pub endpoint: String,
    pub available: bool,
    pub models: Vec<ModelInfo>,
    pub error: Option<String>,
}

#[derive(Debug, thiserror::Error)]
pub enum AiError {
    #[error("AI provider unreachable at {0}. Is it running?")]
    Unreachable(String),
    #[error("AI provider timed out")]
    Timeout,
    #[error("AI provider error: {0}")]
    Provider(String),
}

#[async_trait]
pub trait AiProvider: Send + Sync {
    fn name(&self) -> &'static str;
    fn endpoint(&self) -> String;
    async fn list_models(&self) -> Result<Vec<ModelInfo>, AiError>;

    async fn status(&self) -> ProviderStatus {
        match self.list_models().await {
            Ok(models) => ProviderStatus {
                provider: self.name(),
                endpoint: self.endpoint(),
                available: true,
                models,
                error: None,
            },
            Err(e) => ProviderStatus {
                provider: self.name(),
                endpoint: self.endpoint(),
                available: false,
                models: vec![],
                error: Some(e.to_string()),
            },
        }
    }
}
