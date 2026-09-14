//! Read-only PlayNC lookup and an isolated window containing one combat snapshot.
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;
use tauri::Manager;

static WINDOW_ID: AtomicU64 = AtomicU64::new(1);

#[tauri::command]
pub async fn open_comparison_window(
    app: tauri::AppHandle,
    mut payload: serde_json::Value,
) -> Result<(), String> {
    if !payload.is_object() { return Err("잘못된 비교 데이터입니다.".into()); }
    let state = app.state::<crate::AppState>();
    let servers: HashMap<String, u16> = state.data_storage.get_party_members()
        .into_iter().map(|(name, member)| (name, member.server_id)).collect();
    payload["serversByName"] = serde_json::to_value(servers).map_err(|e| e.to_string())?;
    let script = format!("window.__COMPARISON__ = {};", serde_json::to_string(&payload).map_err(|e| e.to_string())?);
    let label = format!("compare-{}", WINDOW_ID.fetch_add(1, Ordering::Relaxed));
    tauri::WebviewWindowBuilder::new(&app, label, tauri::WebviewUrl::App("compare.html".into()))
        .initialization_script(&script)
        .title("캐릭터 비교 · Zzuring")
        .inner_size(1180.0, 880.0)
        .min_inner_size(600.0, 500.0)
        .decorations(true)
        .resizable(true)
        .background_color(tauri::window::Color(14, 18, 27, 255))
        .build().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn comparison_api(endpoint: String, params: HashMap<String, String>) -> Result<serde_json::Value, String> {
    // Only fixed, read-only official routes are exposed. No arbitrary proxy URLs.
    let (path, allowed): (&str, &[&str]) = match endpoint.as_str() {
        "servers" => ("gameinfo/servers", &["lang"]),
        "search" => ("search/character", &["keyword", "race", "serverId", "page", "size"]),
        "info" => ("character/info", &["lang", "serverId", "characterId"]),
        "equipment" => ("character/equipment", &["lang", "serverId", "characterId"]),
        "item" => ("character/equipment/item", &["id", "enchantLevel", "characterId", "serverId", "slotPos"]),
        _ => return Err("지원하지 않는 조회입니다.".into()),
    };
    if params.iter().any(|(key, value)| !allowed.contains(&key.as_str()) || value.len() > 256) {
        return Err("잘못된 조회 조건입니다.".into());
    }
    let client = reqwest::Client::builder().timeout(Duration::from_secs(20))
        .redirect(reqwest::redirect::Policy::none())
        .user_agent("A2Tools-CharacterComparison/1.0")
        .build().map_err(|e| e.to_string())?;
    let response = client.get(format!("https://aion2.plaync.com/api/{path}"))
        .query(&params).send().await.map_err(|_| "공식 정보실에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.".to_string())?;
    if !response.status().is_success() {
        return Err(format!("공식 정보실 조회 실패 (HTTP {}). 잠시 후 다시 시도해 주세요.", response.status().as_u16()));
    }
    response.json().await.map_err(|_| "공식 정보실 응답을 읽을 수 없습니다.".into())
}
