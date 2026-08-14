export type Lang = 'ar' | 'en';
export type ScreenplayElement =
  | 'scene_heading'
  | 'action'
  | 'action_line'
  | 'character'
  | 'dialogue'
  | 'parenthetical'
  | 'direction'
  | 'transition';

export type SceneStatus = 'draft' | 'done' | 'needs_review';
export type CharacterRole = 'main' | 'secondary' | 'extra';
export type ProjectType = 'film' | 'series' | 'short' | 'documentary';

export interface ScreenplayBlock {
  id: string;
  elementType: ScreenplayElement;
  text: string;
}

export interface Season {
  id: string;
  projectId: string;
  orderIndex: number;
  number: number;
  title: string;
}

export interface Episode {
  id: string;
  projectId: string;
  seasonId: string | null;
  orderIndex: number;
  number: number;
  title: string;
  logline: string;
  synopsis: string;
  notes: string;
  estimatedDurationMin: number | null;
}

export interface Scene {
  id: string;
  projectId: string;
  episodeId: string | null;
  orderIndex: number;
  heading: string;
  sceneKind: Location['kind'] | null;
  scenePlace: string;
  sceneTime: string;
  locationId: string | null;
  blocks: ScreenplayBlock[];
  durationPages: number;
  colorStatus: SceneStatus;
  createdAt: string;
}

export interface Character {
  id: string;
  projectId: string;
  name: string;
  aliases: string;
  age: number | null;
  role: CharacterRole;
  occupation: string;
  dramaticFunction: string;
  bio: string;
  background: string;
  traits: string;
  goal: string;
  motivation: string;
  conflict: string;
  strengths: string;
  weaknesses: string;
  arc: string;
  relationships: string;
  voiceStyle: string;
  notes: string;
  color: string;
}

export interface Location {
  id: string;
  projectId: string;
  name: string;
  kind: 'INT' | 'EXT' | 'INT/EXT';
  timeOfDay: 'DAY' | 'NIGHT' | 'CONTINUOUS';
  description: string;
  dramaticImportance: string;
  visualNotes: string;
  temporalNotes: string;
  notes: string;
}

export interface Project {
  id: string;
  title: string;
  author: string;
  projectType: ProjectType;
  genre: string;
  logline: string;
  storyIdea: string;
  shortSynopsis: string;
  story: string;
  treatment: string;
  notes: string;
  estimatedDurationMin: number | null;
  episodeCount: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CharacterDraft {
  id?: string;
  name: string;
  aliases: string;
  age: number | null | undefined;
  role: CharacterRole;
  occupation: string;
  dramaticFunction: string;
  bio: string;
  background: string;
  traits: string;
  goal: string;
  motivation: string;
  conflict: string;
  strengths: string;
  weaknesses: string;
  arc: string;
  relationships: string;
  voiceStyle: string;
  notes: string;
  color?: string;
}

export interface LocationDraft {
  id?: string;
  name: string;
  kind: Location['kind'];
  timeOfDay: Location['timeOfDay'];
  description: string;
  dramaticImportance: string;
  visualNotes: string;
  temporalNotes: string;
  notes: string;
}

export interface ProjectDraft {
  title: string;
  author: string;
  projectType: ProjectType;
  genre: string;
  logline: string;
  storyIdea: string;
  shortSynopsis: string;
  story: string;
  treatment: string;
  notes: string;
  estimatedDurationMin: number | null;
  episodeCount: number | null;
  characters: CharacterDraft[];
  locations: LocationDraft[];
}

export interface ProjectSummary {
  id: string;
  title: string;
  author: string;
  projectType: ProjectType;
  estimatedDurationMin: number | null;
  episodeCount: number | null;
  updatedAt: string;
}

export interface ProjectSnapshot {
  project: Project;
  seasons: Season[];
  episodes: Episode[];
  scenes: Scene[];
  characters: Character[];
  locations: Location[];
}
