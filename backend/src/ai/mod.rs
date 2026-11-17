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
    #[error("The AI answer was not valid JSON")]
    InvalidJson,
}

/// One structured-generation request: the provider must answer with JSON
/// matching `schema` (a JSON Schema object).
#[derive(Debug, Clone)]
pub struct JsonRequest {
    pub model: String,
    pub system: String,
    pub prompt: String,
    pub schema: serde_json::Value,
    pub temperature: f32,
}

#[async_trait]
pub trait AiProvider: Send + Sync {
    fn name(&self) -> &'static str;
    fn endpoint(&self) -> String;
    async fn list_models(&self) -> Result<Vec<ModelInfo>, AiError>;
    /// Returns the parsed JSON value produced by the model.
    async fn generate_json(&self, req: &JsonRequest) -> Result<serde_json::Value, AiError>;

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

/// Parses a model answer as JSON, tolerating stray text around the object.
pub fn parse_json_loose(text: &str) -> Result<serde_json::Value, AiError> {
    if let Ok(v) = serde_json::from_str(text) {
        return Ok(v);
    }
    let start = text.find('{').ok_or(AiError::InvalidJson)?;
    let end = text.rfind('}').ok_or(AiError::InvalidJson)?;
    if end <= start {
        return Err(AiError::InvalidJson);
    }
    serde_json::from_str(&text[start..=end]).map_err(|_| AiError::InvalidJson)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn loose_json_parsing() {
        assert!(parse_json_loose(r#"{"a":1}"#).is_ok());
        assert!(parse_json_loose(
            "Sure! ```json
{\"a\":1}
``` done"
        )
        .is_ok());
        assert!(parse_json_loose("no json here").is_err());
    }
}
