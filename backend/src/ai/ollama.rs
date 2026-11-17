use std::time::Duration;

use async_trait::async_trait;
use serde::Deserialize;

use super::{parse_json_loose, AiError, AiProvider, JsonRequest, ModelInfo};
use serde_json::json;

pub struct Ollama {
    endpoint: String,
    http: reqwest::Client,
    /// Separate client for generation: local models can take minutes.
    gen_http: reqwest::Client,
}

impl Ollama {
    pub fn new(endpoint: &str) -> Self {
        let http = reqwest::Client::builder()
            .connect_timeout(Duration::from_secs(3))
            .timeout(Duration::from_secs(10))
            .build()
            .expect("http client");
        let gen_http = reqwest::Client::builder()
            .connect_timeout(Duration::from_secs(3))
            .timeout(Duration::from_secs(GENERATION_TIMEOUT_SECS))
            .build()
            .expect("http client");
        Ollama {
            endpoint: endpoint.trim_end_matches('/').to_string(),
            http,
            gen_http,
        }
    }

    fn map_err(&self, e: reqwest::Error) -> AiError {
        if e.is_timeout() {
            AiError::Timeout
        } else if e.is_connect() {
            AiError::Unreachable(self.endpoint.clone())
        } else {
            AiError::Provider(e.to_string())
        }
    }
}

pub const GENERATION_TIMEOUT_SECS: u64 = 300;

#[derive(Deserialize)]
struct ChatResponse {
    message: ChatMessage,
}
#[derive(Deserialize)]
struct ChatMessage {
    content: String,
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
        let tags: TagsResponse = res
            .json()
            .await
            .map_err(|e| AiError::Provider(e.to_string()))?;
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

    async fn generate_json(&self, req: &JsonRequest) -> Result<serde_json::Value, AiError> {
        let body = json!({
            "model": req.model,
            "stream": false,
            // Thinking models (qwen3...) would otherwise spend minutes reasoning.
            "think": false,
            // Ollama constrains the output to this JSON schema.
            "format": req.schema,
            "options": { "temperature": req.temperature, "num_ctx": 8192 },
            "messages": [
                { "role": "system", "content": req.system },
                { "role": "user", "content": req.prompt },
            ],
        });
        let res = self
            .gen_http
            .post(format!("{}/api/chat", self.endpoint))
            .json(&body)
            .send()
            .await
            .map_err(|e| self.map_err(e))?;
        if !res.status().is_success() {
            let status = res.status();
            let text = res.text().await.unwrap_or_default();
            let msg = serde_json::from_str::<serde_json::Value>(&text)
                .ok()
                .and_then(|v| v["error"].as_str().map(String::from))
                .unwrap_or_else(|| format!("HTTP {status}"));
            return Err(AiError::Provider(msg));
        }
        let chat: ChatResponse = res.json().await.map_err(|e| self.map_err(e))?;
        parse_json_loose(&chat.message.content)
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
