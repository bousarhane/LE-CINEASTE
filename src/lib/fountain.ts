import type { ProjectSnapshot, ScreenplayBlock } from './types';
import { episodeLabel, orderedScenes } from './structure';

function blockToFountain(block: ScreenplayBlock): string {
  const text = block.text.trimEnd();
  switch (block.elementType) {
    case 'scene_heading':
      return text;
    case 'character':
      return text;
    case 'parenthetical':
      return text.startsWith('(') ? text : `(${text})`;
    case 'direction':
      return text;
    case 'transition':
      return text.endsWith(':') ? `> ${text}` : `> ${text}:`;
    default:
      return text;
  }
}

export function toFountain(snapshot: ProjectSnapshot): string {
  const lines: string[] = [];
  if (snapshot.project.title) lines.push(`Title: ${snapshot.project.title}`);
  if (snapshot.project.author) lines.push(`Author: ${snapshot.project.author}`);
  lines.push('');

  let lastEpisodeId = '';
  orderedScenes(snapshot).forEach((scene) => {
      if (snapshot.project.projectType === 'series' && scene.episodeId && scene.episodeId !== lastEpisodeId) {
        lastEpisodeId = scene.episodeId;
        lines.push(`/* ${episodeLabel(snapshot, scene.episodeId)} */`, '');
      }
      scene.blocks.forEach((block) => {
        const line = blockToFountain(block);
        lines.push(line);
        if (block.elementType !== 'dialogue') lines.push('');
      });
      lines.push('');
    });

  return lines.join('\n').replace(/\n{4,}/g, '\n\n\n').trim() + '\n';
}

export function snapshotText(snapshot: ProjectSnapshot): string {
  return orderedScenes(snapshot)
    .flatMap((scene) => scene.blocks.map((block) => block.text))
    .filter(Boolean)
    .join('\n');
}
