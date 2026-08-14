import type { Episode, ProjectSnapshot, Scene, Season } from './types';

export function orderedSeasons(snapshot: ProjectSnapshot): Season[] {
  return [...(snapshot.seasons ?? [])].sort((a, b) => a.orderIndex - b.orderIndex || a.number - b.number);
}

export function orderedEpisodes(snapshot: ProjectSnapshot): Episode[] {
  const seasons = orderedSeasons(snapshot);
  const seasonOrder = new Map(seasons.map((season, index) => [season.id, index]));
  return [...(snapshot.episodes ?? [])].sort((a, b) => {
    const aSeason = a.seasonId ? (seasonOrder.get(a.seasonId) ?? 9999) : -1;
    const bSeason = b.seasonId ? (seasonOrder.get(b.seasonId) ?? 9999) : -1;
    return aSeason - bSeason || a.orderIndex - b.orderIndex || a.number - b.number;
  });
}

export function scenesForEpisode(snapshot: ProjectSnapshot, episodeId: string): Scene[] {
  return snapshot.scenes
    .filter((scene) => scene.episodeId === episodeId)
    .sort((a, b) => a.orderIndex - b.orderIndex);
}

export function orderedScenes(snapshot: ProjectSnapshot): Scene[] {
  const episodes = orderedEpisodes(snapshot);
  const episodeOrder = new Map(episodes.map((episode, index) => [episode.id, index]));
  return [...snapshot.scenes].sort((a, b) => {
    const ae = a.episodeId ? (episodeOrder.get(a.episodeId) ?? 9999) : 9999;
    const be = b.episodeId ? (episodeOrder.get(b.episodeId) ?? 9999) : 9999;
    return ae - be || a.orderIndex - b.orderIndex;
  });
}

export function episodeLabel(snapshot: ProjectSnapshot, episodeId: string | null | undefined): string {
  if (!episodeId) return '';
  const episode = snapshot.episodes.find((item) => item.id === episodeId);
  if (!episode) return '';
  if (snapshot.project.projectType !== 'series') return episode.title || snapshot.project.title;
  const season = episode.seasonId ? snapshot.seasons.find((item) => item.id === episode.seasonId) : undefined;
  const seasonText = season ? (season.title?.trim() ? `الموسم ${season.number} — ${season.title.trim()}` : `الموسم ${season.number}`) : '';
  const episodeText = episode.title?.trim() ? `الحلقة ${episode.number} — ${episode.title.trim()}` : `الحلقة ${episode.number}`;
  return seasonText ? `${seasonText} · ${episodeText}` : episodeText;
}
