use std::time::Duration;

use async_trait::async_trait;
use serde::Deserialize;

use super::{AiError, AiProvider, ModelInfo};

pub struct Ollama {
    endpoint: String,
    http: reqwest::Client,
}

impl Ollama {
    pub fn new(endpoint: &str) -> Self {
        let http = reqwest::Client::builder()
            .connect_timeout(Duration::from_secs(3))
            .timeout(Duration::from_secs(10))
            .build()
            .expect("http client");
        Ollama { endpoint: endpoint.trim_end_matches('/').to_string(), http }
    }
}

#[derive(Deserialize)]
struct TagsResponse {
    models: Vec<TagModel>,
}
#[derive(Deserialize)]
struct TagModel {
    name: String,
    #[serde(default)]
    size: u64,
    #[serde(default)]
    details: Option<TagDetails>,
}
#[derive(Deserialize)]
struct TagDetails {
    parameter_size: Option<String>,
    family: Option<String>,
}

/// Models that cannot write calendar text (embeddings, OCR) are filtered out.
fn is_text_model(name: &str) -> bool {
    let n = name.to_lowercase();
    !(n.contains("embed") || n.contains("ocr"))
}

#[async_trait]
impl AiProvider for Ollama {
    fn name(&self) -> &'static str {
        "ollama"
    }
    fn endpoint(&self) -> String {
        self.endpoint.clone()
    }

    async fn list_models(&self) -> Result<Vec<ModelInfo>, AiError> {
        let url = format!("{}/api/tags", self.endpoint);
        let res = self.http.get(&url).send().await.map_err(|e| {
            if e.is_timeout() {
                AiError::Timeout
            } else {
                AiError::Unreachable(self.endpoint.clone())
            }
        })?;
        if !res.status().is_success() {
            return Err(AiError::Provider(format!("HTTP {}", res.status())));
        }
        let tags: TagsResponse = res.json().await.map_err(|e| AiError::Provider(e.to_string()))?;
        let mut models: Vec<ModelInfo> = tags
            .models
            .into_iter()
            .filter(|m| is_text_model(&m.name))
            .map(|m| ModelInfo {
                name: m.name,
                size_bytes: m.size,
                parameter_size: m.details.as_ref().and_then(|d| d.parameter_size.clone()),
                family: m.details.and_then(|d| d.family),
            })
            .collect();
        models.sort_by(|a, b| a.name.cmp(&b.name));
        Ok(models)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn filters_non_text_models() {
        assert!(is_text_model("qwen3:8b"));
        assert!(!is_text_model("nomic-embed-text:latest"));
        assert!(!is_text_model("glm-ocr:latest"));
    }

    #[tokio::test]
    async fn unreachable_endpoint_reports_error() {
        let o = Ollama::new("http://127.0.0.1:9");
        let s = o.status().await;
        assert!(!s.available);
        assert!(s.error.is_some());
    }
}
