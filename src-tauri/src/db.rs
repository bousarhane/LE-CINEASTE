use std::fs;
use rusqlite::{params, Connection, OptionalExtension};
use tauri::{AppHandle, Manager};

use crate::models::{Character, Episode, Location, Project, ProjectSnapshot, ProjectSummary, Scene, ScreenplayBlock, Season};

fn open_connection(app: &AppHandle) -> Result<Connection, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let db_path = dir.join("scene-writer.sqlite3");
    let mut conn = Connection::open(db_path).map_err(|e| e.to_string())?;
    conn.execute_batch(include_str!("../schema.sql")).map_err(|e| e.to_string())?;
    migrate_projects(&mut conn)?;
    migrate_project_dossier(&conn)?;
    migrate_story_structure(&conn)?;
    migrate_scene_metadata(&conn)?;
    migrate_character_aliases(&conn)?;
    Ok(conn)
}

fn migrate_projects(conn: &mut Connection) -> Result<(), String> {
    let table_sql: Option<String> = conn.query_row(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name='projects'",
        [],
        |row| row.get(0),
    ).optional().map_err(|e| e.to_string())?;

    let mut has_duration = false;
    let mut has_episode_count = false;
    {
        let mut stmt = conn.prepare("PRAGMA table_info(projects)").map_err(|e| e.to_string())?;
        let cols = stmt.query_map([], |row| row.get::<_, String>(1)).map_err(|e| e.to_string())?;
        for col in cols {
            match col.map_err(|e| e.to_string())?.as_str() {
                "estimated_duration_min" => has_duration = true,
                "episode_count" => has_episode_count = true,
                _ => {}
            }
        }
    }

    let old_type_check = table_sql.as_deref().map(|sql| sql.contains("CHECK(project_type")).unwrap_or(false);
    if has_duration && has_episode_count && !old_type_check {
        return Ok(());
    }

    conn.execute_batch("PRAGMA foreign_keys = OFF;").map_err(|e| e.to_string())?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    tx.execute_batch(
        "CREATE TABLE projects_v2 (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            author TEXT NOT NULL DEFAULT '',
            project_type TEXT NOT NULL DEFAULT 'film',
            logline TEXT NOT NULL DEFAULT '',
            estimated_duration_min INTEGER,
            episode_count INTEGER,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );"
    ).map_err(|e| e.to_string())?;

    let duration_expr = if has_duration { "estimated_duration_min" } else { "NULL" };
    let episode_expr = if has_episode_count { "episode_count" } else { "NULL" };
    let copy_sql = format!(
        "INSERT INTO projects_v2 (id,title,author,project_type,logline,estimated_duration_min,episode_count,created_at,updated_at) \
         SELECT id,title,author,project_type,logline,{duration_expr},{episode_expr},created_at,updated_at FROM projects"
    );
    tx.execute(&copy_sql, []).map_err(|e| e.to_string())?;
    tx.execute_batch("DROP TABLE projects; ALTER TABLE projects_v2 RENAME TO projects;")
        .map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;
    conn.execute_batch("PRAGMA foreign_keys = ON;").map_err(|e| e.to_string())?;
    Ok(())
}

fn has_column(conn: &Connection, table: &str, column: &str) -> Result<bool, String> {
    let sql = format!("PRAGMA table_info({table})");
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let cols = stmt.query_map([], |row| row.get::<_, String>(1)).map_err(|e| e.to_string())?;
    for col in cols {
        if col.map_err(|e| e.to_string())? == column {
            return Ok(true);
        }
    }
    Ok(false)
}

fn add_text_column(conn: &Connection, table: &str, column: &str) -> Result<(), String> {
    if has_column(conn, table, column)? {
        return Ok(());
    }
    let sql = format!("ALTER TABLE {table} ADD COLUMN {column} TEXT NOT NULL DEFAULT ''");
    conn.execute(&sql, []).map_err(|e| e.to_string())?;
    Ok(())
}





fn migrate_character_aliases(conn: &Connection) -> Result<(), String> {
    add_text_column(conn, "characters", "aliases")?;
    Ok(())
}

fn migrate_scene_metadata(conn: &Connection) -> Result<(), String> {
    for col in ["scene_kind", "scene_place", "scene_time"] {
        add_text_column(conn, "scenes", col)?;
    }
    Ok(())
}

fn migrate_story_structure(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS seasons (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            order_index INTEGER NOT NULL DEFAULT 0,
            number INTEGER NOT NULL DEFAULT 1,
            title TEXT NOT NULL DEFAULT ''
        );
        CREATE TABLE IF NOT EXISTS episodes (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            season_id TEXT REFERENCES seasons(id) ON DELETE CASCADE,
            order_index INTEGER NOT NULL DEFAULT 0,
            number INTEGER NOT NULL DEFAULT 1,
            title TEXT NOT NULL DEFAULT '',
            logline TEXT NOT NULL DEFAULT '',
            synopsis TEXT NOT NULL DEFAULT '',
            notes TEXT NOT NULL DEFAULT '',
            estimated_duration_min INTEGER
        );
        CREATE INDEX IF NOT EXISTS idx_seasons_project ON seasons(project_id, order_index);
        CREATE INDEX IF NOT EXISTS idx_episodes_project ON episodes(project_id, season_id, order_index);"
    ).map_err(|e| e.to_string())?;

    add_text_column(conn, "episodes", "notes")?;

    if !has_column(conn, "scenes", "episode_id")? {
        conn.execute("ALTER TABLE scenes ADD COLUMN episode_id TEXT", []).map_err(|e| e.to_string())?;
    }
    conn.execute_batch("DROP INDEX IF EXISTS idx_scenes_project; CREATE INDEX IF NOT EXISTS idx_scenes_project ON scenes(project_id, episode_id, order_index);")
        .map_err(|e| e.to_string())?;

    let projects: Vec<(String, String, Option<i64>)> = {
        let mut stmt = conn.prepare("SELECT id, project_type, episode_count FROM projects").map_err(|e| e.to_string())?;
        let rows = stmt.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?, row.get::<_, Option<i64>>(2)?))
        }).map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?
    };

    for (project_id, project_type, episode_count) in projects {
        let existing: i64 = conn.query_row(
            "SELECT COUNT(*) FROM episodes WHERE project_id = ?1",
            params![project_id.clone()],
            |row| row.get(0)
        ).map_err(|e| e.to_string())?;

        if existing == 0 {
            if project_type == "series" {
                let season_id = format!("legacy-season-{}", project_id);
                conn.execute(
                    "INSERT OR IGNORE INTO seasons (id, project_id, order_index, number, title) VALUES (?1, ?2, 0, 1, 'الموسم 1')",
                    params![season_id.clone(), project_id.clone()]
                ).map_err(|e| e.to_string())?;
                let count = episode_count.unwrap_or(1).max(1);
                for index in 0..count {
                    let episode_id = format!("legacy-episode-{}-{}", project_id, index + 1);
                    conn.execute(
                        "INSERT OR IGNORE INTO episodes (id, project_id, season_id, order_index, number, title) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                        params![episode_id, project_id.clone(), season_id.clone(), index, index + 1, format!("الحلقة {}", index + 1)]
                    ).map_err(|e| e.to_string())?;
                }
            } else {
                let episode_id = format!("legacy-episode-{}", project_id);
                let title = match project_type.as_str() {
                    "short" => "الفيلم القصير",
                    "documentary" => "الفيلم الوثائقي",
                    _ => "الفيلم",
                };
                conn.execute(
                    "INSERT OR IGNORE INTO episodes (id, project_id, season_id, order_index, number, title) VALUES (?1, ?2, NULL, 0, 1, ?3)",
                    params![episode_id, project_id.clone(), title]
                ).map_err(|e| e.to_string())?;
            }
        }

        let first_episode: Option<String> = conn.query_row(
            "SELECT id FROM episodes WHERE project_id = ?1 ORDER BY CASE WHEN season_id IS NULL THEN 0 ELSE 1 END, order_index, number LIMIT 1",
            params![project_id.clone()],
            |row| row.get(0)
        ).optional().map_err(|e| e.to_string())?;
        if let Some(episode_id) = first_episode {
            conn.execute(
                "UPDATE scenes SET episode_id = ?1 WHERE project_id = ?2 AND (episode_id IS NULL OR episode_id = '')",
                params![episode_id, project_id]
            ).map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}

fn migrate_project_dossier(conn: &Connection) -> Result<(), String> {
    for col in ["genre", "story_idea", "short_synopsis", "story", "treatment", "notes"] {
        add_text_column(conn, "projects", col)?;
    }
    for col in [
        "occupation", "dramatic_function", "background", "traits", "motivation", "conflict",
        "strengths", "weaknesses", "relationships", "voice_style", "notes"
    ] {
        add_text_column(conn, "characters", col)?;
    }
    for col in ["dramatic_importance", "visual_notes", "temporal_notes", "notes"] {
        add_text_column(conn, "locations", col)?;
    }
    Ok(())
}

pub fn init(app: &AppHandle) -> Result<(), String> {
    let _ = open_connection(app)?;
    Ok(())
}

#[tauri::command]
pub fn list_projects(app: AppHandle) -> Result<Vec<ProjectSummary>, String> {
    let conn = open_connection(&app)?;
    let mut stmt = conn.prepare(
        "SELECT id, title, author, project_type, estimated_duration_min, episode_count, updated_at FROM projects ORDER BY updated_at DESC"
    ).map_err(|e| e.to_string())?;

    let rows = stmt.query_map([], |row| {
        Ok(ProjectSummary {
            id: row.get(0)?,
            title: row.get(1)?,
            author: row.get(2)?,
            project_type: row.get(3)?,
            estimated_duration_min: row.get(4)?,
            episode_count: row.get(5)?,
            updated_at: row.get(6)?,
        })
    }).map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn load_project(app: AppHandle, project_id: String) -> Result<Option<ProjectSnapshot>, String> {
    let conn = open_connection(&app)?;

    let project = conn.query_row(
        "SELECT id, title, author, project_type, genre, logline, story_idea, short_synopsis, story, treatment, notes, estimated_duration_min, episode_count, created_at, updated_at FROM projects WHERE id = ?1",
        params![project_id],
        |row| Ok(Project {
            id: row.get(0)?,
            title: row.get(1)?,
            author: row.get(2)?,
            project_type: row.get(3)?,
            genre: row.get(4)?,
            logline: row.get(5)?,
            story_idea: row.get(6)?,
            short_synopsis: row.get(7)?,
            story: row.get(8)?,
            treatment: row.get(9)?,
            notes: row.get(10)?,
            estimated_duration_min: row.get(11)?,
            episode_count: row.get(12)?,
            created_at: row.get(13)?,
            updated_at: row.get(14)?,
        })
    ).optional().map_err(|e| e.to_string())?;

    let Some(project) = project else { return Ok(None); };

    let seasons = {
        let mut stmt = conn.prepare(
            "SELECT id, project_id, order_index, number, title FROM seasons WHERE project_id = ?1 ORDER BY order_index, number"
        ).map_err(|e| e.to_string())?;
        let rows = stmt.query_map(params![project.id.clone()], |row| Ok(Season {
            id: row.get(0)?, project_id: row.get(1)?, order_index: row.get(2)?, number: row.get(3)?, title: row.get(4)?,
        })).map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?
    };

    let episodes = {
        let mut stmt = conn.prepare(
            "SELECT id, project_id, season_id, order_index, number, title, logline, synopsis, notes, estimated_duration_min FROM episodes WHERE project_id = ?1 ORDER BY CASE WHEN season_id IS NULL THEN 0 ELSE 1 END, order_index, number"
        ).map_err(|e| e.to_string())?;
        let rows = stmt.query_map(params![project.id.clone()], |row| Ok(Episode {
            id: row.get(0)?, project_id: row.get(1)?, season_id: row.get(2)?, order_index: row.get(3)?, number: row.get(4)?,
            title: row.get(5)?, logline: row.get(6)?, synopsis: row.get(7)?, notes: row.get(8)?, estimated_duration_min: row.get(9)?,
        })).map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?
    };

    let characters = {
        let mut stmt = conn.prepare(
            "SELECT id, project_id, name, aliases, age, role, occupation, dramatic_function, bio, background, traits, goal, motivation, conflict, strengths, weaknesses, arc, relationships, voice_style, notes, color FROM characters WHERE project_id = ?1 ORDER BY rowid"
        ).map_err(|e| e.to_string())?;
        let rows = stmt.query_map(params![project.id.clone()], |row| Ok(Character {
            id: row.get(0)?, project_id: row.get(1)?, name: row.get(2)?, aliases: row.get(3)?, age: row.get(4)?, role: row.get(5)?,
            occupation: row.get(6)?, dramatic_function: row.get(7)?, bio: row.get(8)?, background: row.get(9)?,
            traits: row.get(10)?, goal: row.get(11)?, motivation: row.get(12)?, conflict: row.get(13)?,
            strengths: row.get(14)?, weaknesses: row.get(15)?, arc: row.get(16)?, relationships: row.get(17)?, voice_style: row.get(18)?,
            notes: row.get(19)?, color: row.get(20)?,
        })).map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?
    };

    let locations = {
        let mut stmt = conn.prepare(
            "SELECT id, project_id, name, kind, time_of_day, description, dramatic_importance, visual_notes, temporal_notes, notes FROM locations WHERE project_id = ?1 ORDER BY rowid"
        ).map_err(|e| e.to_string())?;
        let rows = stmt.query_map(params![project.id.clone()], |row| Ok(Location {
            id: row.get(0)?, project_id: row.get(1)?, name: row.get(2)?, kind: row.get(3)?, time_of_day: row.get(4)?,
            description: row.get(5)?, dramatic_importance: row.get(6)?, visual_notes: row.get(7)?, temporal_notes: row.get(8)?, notes: row.get(9)?,
        })).map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?
    };

    let scenes = {
        let mut stmt = conn.prepare(
            "SELECT id, project_id, episode_id, order_index, heading, scene_kind, scene_place, scene_time, location_id, content_json, duration_pages, color_status, created_at FROM scenes WHERE project_id = ?1 ORDER BY episode_id, order_index"
        ).map_err(|e| e.to_string())?;
        let rows = stmt.query_map(params![project.id.clone()], |row| {
            let raw: String = row.get(9)?;
            let blocks: Vec<ScreenplayBlock> = serde_json::from_str(&raw).unwrap_or_default();
            Ok(Scene {
                id: row.get(0)?, project_id: row.get(1)?, episode_id: row.get(2)?, order_index: row.get(3)?, heading: row.get(4)?,
                scene_kind: row.get(5)?, scene_place: row.get(6)?, scene_time: row.get(7)?, location_id: row.get(8)?,
                blocks, duration_pages: row.get(10)?, color_status: row.get(11)?, created_at: row.get(12)?,
            })
        }).map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?
    };

    Ok(Some(ProjectSnapshot { project, seasons, episodes, scenes, characters, locations }))
}

#[tauri::command]
pub fn save_project_snapshot(app: AppHandle, snapshot: ProjectSnapshot) -> Result<(), String> {
    let mut conn = open_connection(&app)?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    tx.execute(
        "INSERT INTO projects (id, title, author, project_type, genre, logline, story_idea, short_synopsis, story, treatment, notes, estimated_duration_min, episode_count, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)
         ON CONFLICT(id) DO UPDATE SET title=excluded.title, author=excluded.author, project_type=excluded.project_type,
         genre=excluded.genre, logline=excluded.logline, story_idea=excluded.story_idea, short_synopsis=excluded.short_synopsis,
         story=excluded.story, treatment=excluded.treatment, notes=excluded.notes,
         estimated_duration_min=excluded.estimated_duration_min, episode_count=excluded.episode_count, updated_at=excluded.updated_at",
        params![
            snapshot.project.id, snapshot.project.title, snapshot.project.author, snapshot.project.project_type,
            snapshot.project.genre, snapshot.project.logline, snapshot.project.story_idea, snapshot.project.short_synopsis,
            snapshot.project.story, snapshot.project.treatment, snapshot.project.notes,
            snapshot.project.estimated_duration_min, snapshot.project.episode_count,
            snapshot.project.created_at, snapshot.project.updated_at
        ]
    ).map_err(|e| e.to_string())?;

    tx.execute("DELETE FROM scenes WHERE project_id = ?1", params![snapshot.project.id]).map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM episodes WHERE project_id = ?1", params![snapshot.project.id]).map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM seasons WHERE project_id = ?1", params![snapshot.project.id]).map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM characters WHERE project_id = ?1", params![snapshot.project.id]).map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM locations WHERE project_id = ?1", params![snapshot.project.id]).map_err(|e| e.to_string())?;

    for season in &snapshot.seasons {
        tx.execute(
            "INSERT INTO seasons (id, project_id, order_index, number, title) VALUES (?1,?2,?3,?4,?5)",
            params![season.id, season.project_id, season.order_index, season.number, season.title]
        ).map_err(|e| e.to_string())?;
    }

    for episode in &snapshot.episodes {
        tx.execute(
            "INSERT INTO episodes (id, project_id, season_id, order_index, number, title, logline, synopsis, notes, estimated_duration_min) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)",
            params![episode.id, episode.project_id, episode.season_id, episode.order_index, episode.number, episode.title, episode.logline, episode.synopsis, episode.notes, episode.estimated_duration_min]
        ).map_err(|e| e.to_string())?;
    }

    for character in &snapshot.characters {
        tx.execute(
            "INSERT INTO characters (id, project_id, name, aliases, age, role, occupation, dramatic_function, bio, background, traits, goal, motivation, conflict, strengths, weaknesses, arc, relationships, voice_style, notes, color)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20,?21)",
            params![
                character.id, character.project_id, character.name, character.aliases, character.age, character.role, character.occupation,
                character.dramatic_function, character.bio, character.background, character.traits, character.goal,
                character.motivation, character.conflict, character.strengths, character.weaknesses, character.arc,
                character.relationships, character.voice_style, character.notes, character.color
            ]
        ).map_err(|e| e.to_string())?;
    }

    for location in &snapshot.locations {
        tx.execute(
            "INSERT INTO locations (id, project_id, name, kind, time_of_day, description, dramatic_importance, visual_notes, temporal_notes, notes)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)",
            params![
                location.id, location.project_id, location.name, location.kind, location.time_of_day, location.description,
                location.dramatic_importance, location.visual_notes, location.temporal_notes, location.notes
            ]
        ).map_err(|e| e.to_string())?;
    }

    for scene in &snapshot.scenes {
        let content_json = serde_json::to_string(&scene.blocks).map_err(|e| e.to_string())?;
        let content_text = scene.blocks.iter().map(|b| b.text.as_str()).collect::<Vec<_>>().join("\n");
        tx.execute(
            "INSERT INTO scenes (id, project_id, episode_id, order_index, heading, scene_kind, scene_place, scene_time, location_id, content_json, content_text, duration_pages, color_status, created_at)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14)",
            params![scene.id, scene.project_id, scene.episode_id, scene.order_index, scene.heading, scene.scene_kind.clone().unwrap_or_default(), scene.scene_place, scene.scene_time, scene.location_id, content_json, content_text, scene.duration_pages, scene.color_status, scene.created_at]
        ).map_err(|e| e.to_string())?;
    }

    let snapshot_json = serde_json::to_string(&snapshot).map_err(|e| e.to_string())?;
    tx.execute(
        "INSERT INTO backups (project_id, snapshot_json) VALUES (?1, ?2)",
        params![snapshot.project.id, snapshot_json]
    ).map_err(|e| e.to_string())?;
    tx.execute(
        "DELETE FROM backups WHERE project_id = ?1 AND id NOT IN (SELECT id FROM backups WHERE project_id = ?1 ORDER BY id DESC LIMIT 20)",
        params![snapshot.project.id]
    ).map_err(|e| e.to_string())?;

    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_project(app: AppHandle, project_id: String) -> Result<(), String> {
    let mut conn = open_connection(&app)?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    // Delete explicitly as well as relying on ON DELETE CASCADE. Older databases
    // have passed through schema migrations, so this keeps project deletion
    // deterministic even if a legacy foreign-key definition is imperfect.
    tx.execute(
        "DELETE FROM scene_characters WHERE scene_id IN (SELECT id FROM scenes WHERE project_id = ?1)",
        params![project_id.clone()]
    ).map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM backups WHERE project_id = ?1", params![project_id.clone()]).map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM scenes WHERE project_id = ?1", params![project_id.clone()]).map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM episodes WHERE project_id = ?1", params![project_id.clone()]).map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM seasons WHERE project_id = ?1", params![project_id.clone()]).map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM characters WHERE project_id = ?1", params![project_id.clone()]).map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM locations WHERE project_id = ?1", params![project_id.clone()]).map_err(|e| e.to_string())?;
    let deleted = tx.execute("DELETE FROM projects WHERE id = ?1", params![project_id]).map_err(|e| e.to_string())?;
    if deleted == 0 {
        return Err("المشروع غير موجود أو حُذف سابقاً.".to_string());
    }
    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}
