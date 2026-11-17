//! Installed Windows transport. Model credentials stay in Windows Credential Manager.
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Manager, State};
use tokio::sync::Semaphore;

const MAX_RESPONSE: usize = 2 * 1024 * 1024;

pub struct ModelState {
    config_lock: Mutex<()>,
    requests: Arc<Semaphore>,
}

impl Default for ModelState {
    fn default() -> Self {
        Self {
            config_lock: Mutex::new(()),
            requests: Arc::new(Semaphore::new(2)),
        }
    }
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct StoredConfig {
    provider: String,
    base_url: String,
    model: String,
    enabled: bool,
}

impl Default for StoredConfig {
    fn default() -> Self {
        Self {
            provider: "kanshan".into(),
            base_url: String::new(),
            model: String::new(),
            enabled: false,
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicConfig {
    provider: String,
    base_url: String,
    model: String,
    configured: bool,
    enabled: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SaveSettings {
    provider: String,
    base_url: String,
    model: String,
    api_key: String,
    enabled: bool,
}

#[derive(Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Message {
    role: String,
    content: String,
}

#[derive(Serialize)]
pub struct ModelReply {
    content: String,
    provider: String,
    model: String,
}

fn config_file(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_config_dir()
        .map_err(|_| "无法访问软件配置目录".to_string())?
        .join("career-model.json"))
}

fn read_config(app: &AppHandle) -> Result<StoredConfig, String> {
    let path = config_file(app)?;
    match fs::read(path) {
        Ok(bytes) => serde_json::from_slice(&bytes)
            .map_err(|_| "模型设置无法读取，请清除配置后重新保存".to_string()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(StoredConfig::default()),
        Err(_) => Err("模型设置无法读取，请检查设备权限".into()),
    }
}

fn write_config(app: &AppHandle, config: &StoredConfig) -> Result<(), String> {
    let path = config_file(app)?;
    let parent = path.parent().ok_or("配置目录无效")?;
    fs::create_dir_all(parent).map_err(|_| "无法创建软件配置目录".to_string())?;
    let bytes = serde_json::to_vec(config).map_err(|_| "模型设置保存失败".to_string())?;
    // This file contains only the endpoint, model ID, provider and opt-in flag.
    fs::write(path, bytes).map_err(|_| "模型设置保存失败，请检查设备权限".to_string())
}

fn entry(config: &StoredConfig) -> Result<keyring::Entry, String> {
    // Separate vault entries per destination: a failed config update cannot send
    // a new provider's credential to the previously configured provider.
    let account = format!("{}|{}", config.provider, config.base_url);
    keyring::Entry::new("com.secondcurve.app.model", &account)
        .map_err(|_| "无法访问 Windows 凭据管理器".to_string())
}

fn read_key(config: &StoredConfig) -> Result<String, String> {
    if config.base_url.is_empty() || config.model.is_empty() {
        return Ok(String::new());
    }
    match entry(config)?.get_password() {
        Ok(key) => Ok(key),
        Err(keyring::Error::NoEntry) => Ok(String::new()),
        Err(_) => Err("无法读取设备保存的模型凭据，请重新配置".into()),
    }
}

fn delete_key(config: &StoredConfig) -> Result<(), String> {
    if config.base_url.is_empty() {
        return Ok(());
    }
    match entry(config)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(_) => Err("无法清除 Windows 中保存的模型凭据".into()),
    }
}

fn public_config(config: StoredConfig) -> Result<PublicConfig, String> {
    let configured = !config.base_url.is_empty()
        && !config.model.is_empty()
        && !read_key(&config)?.is_empty();
    Ok(PublicConfig {
        provider: config.provider,
        base_url: config.base_url,
        model: config.model,
        configured,
        enabled: config.enabled && configured,
    })
}

fn normalize_base(value: &str) -> Result<String, String> {
    let base = value.trim().trim_end_matches('/');
    if base.is_empty() || base.len() > 2000 {
        return Err("请填写平台提供的 HTTPS Base URL".into());
    }
    let parsed = reqwest::Url::parse(base).map_err(|_| "模型接口地址格式无效".to_string())?;
    if parsed.scheme() != "https"
        || parsed.host_str().is_none()
        || !parsed.username().is_empty()
        || parsed.password().is_some()
        || parsed.query().is_some()
        || parsed.fragment().is_some()
    {
        return Err("模型接口地址必须是 HTTPS，不能包含密钥、查询参数或片段".into());
    }
    Ok(base.to_string())
}

fn validate_settings(settings: SaveSettings) -> Result<(StoredConfig, String), String> {
    if !["kanshan", "deepseek", "kimi"].contains(&settings.provider.as_str()) {
        return Err("请选择看山、DeepSeek 或 Kimi".into());
    }
    let model = settings.model.trim();
    let api_key = settings.api_key.trim();
    if model.is_empty() || model.len() > 200 {
        return Err("请填写平台提供的有效模型 ID".into());
    }
    if api_key.len() > 4096 || api_key.contains('\r') || api_key.contains('\n') {
        return Err("API Key 格式无效，不能包含换行".into());
    }
    Ok((
        StoredConfig {
            provider: settings.provider,
            base_url: normalize_base(&settings.base_url)?,
            model: model.into(),
            enabled: settings.enabled,
        },
        api_key.into(),
    ))
}

#[tauri::command]
pub fn career_model_load(app: AppHandle, state: State<'_, ModelState>) -> Result<PublicConfig, String> {
    let _guard = state.config_lock.lock().map_err(|_| "模型设置暂时不可用")?;
    public_config(read_config(&app)?)
}

#[tauri::command]
pub fn career_model_save(
    app: AppHandle,
    state: State<'_, ModelState>,
    settings: SaveSettings,
) -> Result<PublicConfig, String> {
    let (config, entered_key) = validate_settings(settings)?;
    let _guard = state.config_lock.lock().map_err(|_| "模型设置暂时不可用")?;
    let previous = read_config(&app)?;
    let same_destination = previous.provider == config.provider && previous.base_url == config.base_url;
    let api_key = if entered_key.is_empty() && same_destination {
        read_key(&previous)?
    } else {
        entered_key
    };
    if api_key.is_empty() {
        return Err("首次配置或更换平台地址时，请重新输入 API Key".into());
    }
    entry(&config)?
        .set_password(&api_key)
        .map_err(|_| "模型密钥保存失败，请检查 Windows 凭据管理器".to_string())?;
    write_config(&app, &config)?;
    if !same_destination {
        // Failure to remove an unused old vault entry does not invalidate the
        // newly committed configuration. It is never selected for requests.
        let _ = delete_key(&previous);
    }
    public_config(config)
}

#[tauri::command]
pub fn career_model_set_enabled(
    app: AppHandle,
    state: State<'_, ModelState>,
    enabled: bool,
) -> Result<PublicConfig, String> {
    let _guard = state.config_lock.lock().map_err(|_| "模型设置暂时不可用")?;
    let mut config = read_config(&app)?;
    if enabled && (config.base_url.is_empty() || config.model.is_empty() || read_key(&config)?.is_empty()) {
        return Err("请先保存模型地址、模型 ID 和 API Key".into());
    }
    config.enabled = enabled;
    write_config(&app, &config)?;
    public_config(config)
}

#[tauri::command]
pub fn career_model_clear(app: AppHandle, state: State<'_, ModelState>) -> Result<PublicConfig, String> {
    let _guard = state.config_lock.lock().map_err(|_| "模型设置暂时不可用")?;
    let previous = read_config(&app).unwrap_or_default();
    delete_key(&previous)?;
    let path = config_file(&app)?;
    match fs::remove_file(path) {
        Ok(()) => {}
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
        Err(_) => return Err("模型设置清除失败，请检查设备权限".into()),
    }
    public_config(StoredConfig::default())
}

fn validate_messages(messages: &[Message], max_tokens: u32) -> Result<(), String> {
    if messages.is_empty() || messages.len() > 16 || !(1..=16000).contains(&max_tokens) {
        return Err("模型请求参数无效".into());
    }
    let mut total = 0usize;
    for message in messages {
        total += message.content.chars().count();
        if !["system", "user", "assistant"].contains(&message.role.as_str())
            || message.content.trim().is_empty()
            || message.content.chars().count() > 120000
            || total > 160000
        {
            return Err("对话内容过长或消息格式无效".into());
        }
    }
    Ok(())
}

fn request_failure(error: reqwest::Error) -> String {
    if error.is_timeout() {
        "模型响应超时，请稍后重试".into()
    } else {
        // Reqwest error display includes URLs. Never expose it or response bodies.
        "模型连接失败，请检查设备网络和模型地址".into()
    }
}

#[tauri::command]
pub async fn career_model_request(
    app: AppHandle,
    state: State<'_, ModelState>,
    messages: Vec<Message>,
    max_tokens: u32,
) -> Result<ModelReply, String> {
    validate_messages(&messages, max_tokens)?;
    let _permit = state.requests.clone().try_acquire_owned()
        .map_err(|_| "正在处理其他请求，请稍后再试".to_string())?;
    let (config, api_key) = {
        let _guard = state.config_lock.lock().map_err(|_| "模型设置暂时不可用")?;
        let config = read_config(&app)?;
        let key = read_key(&config)?;
        if !config.enabled || key.is_empty() || config.model.is_empty() {
            return Err("请先保存并启用云模型配置".into());
        }
        (config, key)
    };
    let endpoint = normalize_base(&config.base_url)? + "/chat/completions";
    let mut payload = json!({
        "model": config.model,
        "messages": messages,
        "max_tokens": max_tokens,
        "stream": false,
    });
    if config.provider == "deepseek" {
        payload["thinking"] = json!({"type": "disabled"});
    } else if config.provider == "kimi" {
        payload["reasoning_effort"] = json!("low");
    }
    let bytes = serde_json::to_vec(&payload).map_err(|_| "模型请求格式无效".to_string())?;
    if bytes.len() > 512 * 1024 {
        return Err("请求内容过大，请精简后重试".into());
    }
    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .connect_timeout(Duration::from_secs(15))
        .timeout(Duration::from_secs(90))
        .build()
        .map_err(|_| "无法初始化模型连接".to_string())?;
    let mut response = client.post(endpoint)
        .bearer_auth(api_key)
        .header(reqwest::header::CONTENT_TYPE, "application/json; charset=utf-8")
        .body(bytes)
        .send().await.map_err(request_failure)?;
    let status = response.status();
    if status.as_u16() == 401 || status.as_u16() == 403 {
        return Err("模型鉴权失败，请检查 API Key 和模型权限".into());
    }
    if status.as_u16() == 429 {
        return Err("模型额度或速率受限，请稍后再试".into());
    }
    if !status.is_success() {
        return Err(format!("模型平台返回 HTTP {}，请检查接口地址和模型 ID", status.as_u16()));
    }
    if response.content_length().is_some_and(|size| size > MAX_RESPONSE as u64) {
        return Err("模型响应过大，请精简输入后重试".into());
    }
    let mut body = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(request_failure)? {
        if body.len() + chunk.len() > MAX_RESPONSE {
            return Err("模型响应过大，请精简输入后重试".into());
        }
        body.extend_from_slice(&chunk);
    }
    parse_reply(&body, &config)
}

fn parse_reply(body: &[u8], config: &StoredConfig) -> Result<ModelReply, String> {
    let envelope: Value = serde_json::from_slice(body)
        .map_err(|_| "模型响应格式无效，请稍后重试".to_string())?;
    let choice = envelope.get("choices").and_then(Value::as_array)
        .and_then(|choices| choices.first()).and_then(Value::as_object)
        .ok_or("模型响应格式无效，请稍后重试")?;
    if choice.get("finish_reason").and_then(Value::as_str) == Some("length") {
        return Err("模型输出未完成，请精简输入后重试".into());
    }
    let content = choice.get("message").and_then(Value::as_object)
        .and_then(|message| message.get("content")).and_then(Value::as_str)
        .filter(|content| !content.trim().is_empty())
        .ok_or("模型未返回可用文字，请稍后重试")?;
    Ok(ModelReply {
        content: content.trim().into(),
        provider: config.provider.clone(),
        model: config.model.clone(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn base_requires_https_without_credentials_or_query() {
        assert_eq!(normalize_base(" https://example.org/v1/ ").unwrap(), "https://example.org/v1");
        for url in ["http://example.org", "https://key@example.org", "https://example.org?key=x", "https://example.org#x", "https://[bad"] {
            assert!(normalize_base(url).is_err());
        }
    }

    #[test]
    fn reply_rejects_truncation_and_bad_envelope() {
        let config = StoredConfig::default();
        for value in [json!({"choices": [null]}), json!({"choices": []}), json!({"choices": [{"finish_reason": "length", "message": {"content": "{}"}}]})] {
            assert!(parse_reply(&serde_json::to_vec(&value).unwrap(), &config).is_err());
        }
        let value = json!({"choices": [{"message": {"content": "[]"}}]});
        assert_eq!(parse_reply(&serde_json::to_vec(&value).unwrap(), &config).unwrap().content, "[]");
    }
}
