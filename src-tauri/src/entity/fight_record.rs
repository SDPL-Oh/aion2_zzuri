use serde::{Deserialize, Serialize};

use super::details_context::{DetailsActorSummary, TargetDetailsResponse};

pub const APP_VERSION: &str = env!("CARGO_PKG_VERSION");

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FightRecord {
    pub id: String,
    /// Display name (for backward compat). New files also have mob_code for i18n resolution.
    pub boss_name: String,
    pub target_id: i32,
    pub start_time_ms: i64,
    pub duration_ms: i64,
    pub total_damage: i32,
    /// Job class prefix IDs (e.g. [11, 14, 17]) for language-independent storage.
    pub jobs: Vec<String>,
    /// Job class prefix IDs for i18n resolution (new field).
    #[serde(default)]
    pub job_ids: Vec<i32>,
    pub details: TargetDetailsResponse,
    pub actors: Vec<DetailsActorSummary>,
    #[serde(default)]
    pub is_train: bool,
    #[serde(default)]
    pub app_version: String,
    /// NPC mob type code for i18n boss name resolution (new field).
    #[serde(default)]
    pub mob_code: i32,
    /// Party roster when the fight was saved — includes members who dealt no
    /// damage, which `actors` never lists.
    #[serde(default)]
    pub party: Vec<PartyMemberRecord>,
    /// Dungeon id from the roster header (0 = unknown).
    #[serde(default)]
    pub dungeon_id: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PartyMemberRecord {
    pub slot: u8,
    pub nickname: String,
    #[serde(default)]
    pub job: String,
    #[serde(default)]
    pub level: i32,
    #[serde(default)]
    pub gear_score: i32,
    #[serde(default)]
    pub combat_power: i64,
    #[serde(default)]
    pub server_id: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FightSummary {
    pub id: String,
    pub boss_name: String,
    pub target_id: i32,
    pub start_time_ms: i64,
    pub duration_ms: i64,
    pub total_damage: i32,
    pub jobs: Vec<String>,
    #[serde(default)]
    pub job_ids: Vec<i32>,
    #[serde(default)]
    pub is_train: bool,
    #[serde(default)]
    pub is_live: bool,
    #[serde(default)]
    pub app_version: String,
    #[serde(default)]
    pub mob_code: i32,
}

/// Obscure a nickname for privacy: keep first char and last char, mask the middle.
/// For CJK names (2-3 chars), keep first char, mask rest.
/// The local player's name is NOT obscured.
pub fn obscure_nickname(name: &str) -> String {
    let chars: Vec<char> = name.chars().collect();
    if chars.len() <= 1 {
        return name.to_string();
    }
    if chars.len() == 2 {
        return format!("{}*", chars[0]);
    }
    if chars.len() == 3 {
        return format!("{}*{}", chars[0], chars[2]);
    }
    // For longer names: first 2 chars + asterisks + last char
    let mask_len = (chars.len() - 3).min(4);
    let mask: String = std::iter::repeat_n('*', mask_len).collect();
    format!("{}{}{}{}", chars[0], chars[1], mask, chars[chars.len() - 1])
}
