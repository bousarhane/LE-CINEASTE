use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: String,
    pub title: String,
    pub author: String,
    pub project_type: String,
    pub genre: String,
    pub logline: String,
    pub story_idea: String,
    pub short_synopsis: String,
    pub story: String,
    pub treatment: String,
    pub notes: String,
    pub estimated_duration_min: Option<i64>,
    pub episode_count: Option<i64>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSummary {
    pub id: String,
    pub title: String,
    pub author: String,
    pub project_type: String,
    pub estimated_duration_min: Option<i64>,
    pub episode_count: Option<i64>,
    pub updated_at: String,
}


#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Season {
    pub id: String,
    pub project_id: String,
    pub order_index: i64,
    pub number: i64,
    pub title: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Episode {
    pub id: String,
    pub project_id: String,
    pub season_id: Option<String>,
    pub order_index: i64,
    pub number: i64,
    pub title: String,
    pub logline: String,
    pub synopsis: String,
    pub notes: String,
    pub estimated_duration_min: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScreenplayBlock {
    pub id: String,
    pub element_type: String,
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Scene {
    pub id: String,
    pub project_id: String,
    pub episode_id: Option<String>,
    pub order_index: i64,
    pub heading: String,
    pub scene_kind: Option<String>,
    pub scene_place: String,
    pub scene_time: String,
    pub location_id: Option<String>,
    pub blocks: Vec<ScreenplayBlock>,
    pub duration_pages: f64,
    pub color_status: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Character {
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub aliases: String,
    pub age: Option<i64>,
    pub role: String,
    pub occupation: String,
    pub dramatic_function: String,
    pub bio: String,
    pub background: String,
    pub traits: String,
    pub goal: String,
    pub motivation: String,
    pub conflict: String,
    pub strengths: String,
    pub weaknesses: String,
    pub arc: String,
    pub relationships: String,
    pub voice_style: String,
    pub notes: String,
    pub color: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Location {
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub kind: String,
    pub time_of_day: String,
    pub description: String,
    pub dramatic_importance: String,
    pub visual_notes: String,
    pub temporal_notes: String,
    pub notes: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSnapshot {
    pub project: Project,
    pub seasons: Vec<Season>,
    pub episodes: Vec<Episode>,
    pub scenes: Vec<Scene>,
    pub characters: Vec<Character>,
    pub locations: Vec<Location>,
}
