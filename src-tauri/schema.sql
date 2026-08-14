PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT NOT NULL DEFAULT '',
  project_type TEXT NOT NULL DEFAULT 'film',
  genre TEXT NOT NULL DEFAULT '',
  logline TEXT NOT NULL DEFAULT '',
  story_idea TEXT NOT NULL DEFAULT '',
  short_synopsis TEXT NOT NULL DEFAULT '',
  story TEXT NOT NULL DEFAULT '',
  treatment TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  estimated_duration_min INTEGER,
  episode_count INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);


CREATE TABLE IF NOT EXISTS seasons (
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

CREATE TABLE IF NOT EXISTS characters (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  aliases TEXT NOT NULL DEFAULT '',
  age INTEGER,
  role TEXT NOT NULL CHECK(role IN ('main', 'secondary', 'extra')) DEFAULT 'secondary',
  occupation TEXT NOT NULL DEFAULT '',
  dramatic_function TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '',
  background TEXT NOT NULL DEFAULT '',
  traits TEXT NOT NULL DEFAULT '',
  goal TEXT NOT NULL DEFAULT '',
  motivation TEXT NOT NULL DEFAULT '',
  conflict TEXT NOT NULL DEFAULT '',
  strengths TEXT NOT NULL DEFAULT '',
  weaknesses TEXT NOT NULL DEFAULT '',
  arc TEXT NOT NULL DEFAULT '',
  relationships TEXT NOT NULL DEFAULT '',
  voice_style TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '#E8B86D'
);

CREATE TABLE IF NOT EXISTS locations (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('INT', 'EXT', 'INT/EXT')) DEFAULT 'INT',
  time_of_day TEXT NOT NULL CHECK(time_of_day IN ('DAY', 'NIGHT', 'CONTINUOUS')) DEFAULT 'DAY',
  description TEXT NOT NULL DEFAULT '',
  dramatic_importance TEXT NOT NULL DEFAULT '',
  visual_notes TEXT NOT NULL DEFAULT '',
  temporal_notes TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS scenes (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  episode_id TEXT REFERENCES episodes(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL,
  heading TEXT NOT NULL,
  scene_kind TEXT NOT NULL DEFAULT '',
  scene_place TEXT NOT NULL DEFAULT '',
  scene_time TEXT NOT NULL DEFAULT '',
  location_id TEXT REFERENCES locations(id) ON DELETE SET NULL,
  content_json TEXT NOT NULL,
  content_text TEXT NOT NULL DEFAULT '',
  duration_pages REAL NOT NULL DEFAULT 0.0,
  color_status TEXT NOT NULL CHECK(color_status IN ('draft', 'done', 'needs_review')) DEFAULT 'draft',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS scene_characters (
  scene_id TEXT NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
  character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  PRIMARY KEY (scene_id, character_id)
);

CREATE TABLE IF NOT EXISTS backups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  snapshot_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_seasons_project ON seasons(project_id, order_index);
CREATE INDEX IF NOT EXISTS idx_episodes_project ON episodes(project_id, season_id, order_index);
CREATE INDEX IF NOT EXISTS idx_scenes_project ON scenes(project_id, order_index);
CREATE INDEX IF NOT EXISTS idx_characters_project ON characters(project_id);
CREATE INDEX IF NOT EXISTS idx_locations_project ON locations(project_id);
CREATE INDEX IF NOT EXISTS idx_backups_project ON backups(project_id, id DESC);
