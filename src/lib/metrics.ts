import type { ProjectSnapshot } from './types';
import { countWords } from './screenplayEngine';
import { snapshotText } from './fountain';
import { estimateFormattedPages } from './pageEstimate';

export interface LocalAnalysis {
  wordCount: number;
  estimatedPages: number;
  estimatedDurationMin: number;
  dialogueRatio: number;
}

export function calculateLocalAnalysis(snapshot: ProjectSnapshot): LocalAnalysis {
  const text = snapshotText(snapshot);
  const wordCount = countWords(text);
  const dialogueWords = snapshot.scenes
    .flatMap((scene) => scene.blocks)
    .filter((block) => block.elementType === 'dialogue')
    .reduce((sum, block) => sum + countWords(block.text), 0);

  // Scene Writer does not predict real cinematic duration. The only time
  // reference is the conventional rough screenplay rule: 1 formatted page ≈
  // 1 minute. Pages are estimated from the screenplay element layout.
  const estimatedPages = snapshot.scenes.reduce(
    (sum, scene) => sum + estimateFormattedPages(scene.blocks),
    0
  );
  const estimatedDurationMin = estimatedPages;
  const dialogueRatio = wordCount ? dialogueWords / wordCount : 0;

  return { wordCount, estimatedPages, estimatedDurationMin, dialogueRatio };
}
