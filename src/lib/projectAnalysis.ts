import type { Character, ProjectSnapshot, Scene } from './types';
import { countWords } from './screenplayEngine';
import { estimateFormattedPages } from './pageEstimate';
import type { AnalysisNotice } from './sceneAnalysis';
import { orderedScenes } from './structure';

export interface ProjectSceneStat {
  id: string;
  index: number;
  heading: string;
  words: number;
  pages: number;
  dialogueWords: number;
  descriptionWords: number;
  actionWords: number;
  directionWords: number;
  dialogueRatio: number;
  speakerCount: number;
  location: string;
  kind: 'INT' | 'EXT' | 'INT/EXT' | 'UNKNOWN';
  time: 'DAY' | 'NIGHT' | 'CONTINUOUS' | 'UNKNOWN';
}

export interface ProjectCharacterStat {
  id: string;
  name: string;
  role: Character['role'];
  sceneCount: number;
  sceneShare: number;
  dialogueWords: number;
  dialogueTurns: number;
  firstScene: number | null;
  lastScene: number | null;
  maxAbsenceRun: number;
}

export interface ProjectLocationStat {
  name: string;
  sceneCount: number;
  share: number;
}

export interface RhythmWindow {
  startScene: number;
  endScene: number;
  words: number;
  averageWords: number;
  dialogueRatio: number;
}

export interface ProjectStructuralAnalysis {
  sceneCount: number;
  contentWords: number;
  pages: number;
  averageWords: number;
  medianWords: number;
  averageDialogueRatio: number;
  sceneStats: ProjectSceneStat[];
  longestScenes: ProjectSceneStat[];
  shortestScenes: ProjectSceneStat[];
  characterStats: ProjectCharacterStat[];
  locationStats: ProjectLocationStat[];
  headingCounts: {
    interior: number;
    exterior: number;
    mixed: number;
    day: number;
    night: number;
    continuous: number;
    unknown: number;
  };
  unknownSpeakers: string[];
  highDialogueWindow: RhythmWindow | null;
  lowDialogueWindow: RhythmWindow | null;
  notices: AnalysisNotice[];
}

function normalizeArabic(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
    .replace(/ـ/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .toLowerCase();
}

function normalizeName(value: string): string {
  return normalizeArabic(value)
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[\[\]{}:؛،,.!?؟!\-–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function contentWords(scene: Scene): number {
  return scene.blocks
    .filter((block) => ['action', 'action_line', 'dialogue', 'parenthetical', 'direction'].includes(block.elementType))
    .reduce((sum, block) => sum + countWords(block.text), 0);
}

function parseHeading(scene: Scene, snapshot: ProjectSnapshot): Pick<ProjectSceneStat, 'location' | 'kind' | 'time'> {
  const linked = scene.locationId ? snapshot.locations.find((location) => location.id === scene.locationId) : undefined;
  const raw = (scene.heading || scene.blocks.find((block) => block.elementType === 'scene_heading')?.text || '').trim();
  const prefix = raw.match(/^(داخلي\s*\/\s*خارجي|خارجي\s*\/\s*داخلي|داخلي|خارجي|INT\s*\/\s*EXT|EXT\s*\/\s*INT|INT\/EXT|EXT\/INT|I\/E|INT|EXT)\.?/i)?.[1] ?? '';
  const normalizedPrefix = normalizeArabic(prefix).replace(/\s/g, '');
  let kind: ProjectSceneStat['kind'] = 'UNKNOWN';
  if (normalizedPrefix.includes('/')) kind = 'INT/EXT';
  else if (normalizedPrefix.includes('خارجي') || normalizedPrefix === 'ext') kind = 'EXT';
  else if (normalizedPrefix.includes('داخلي') || normalizedPrefix === 'int') kind = 'INT';

  const time: ProjectSceneStat['time'] = /(?:ليل|night)\s*$/i.test(raw)
    ? 'NIGHT'
    : /(?:مستمر|continuous)\s*$/i.test(raw)
      ? 'CONTINUOUS'
      : /(?:نهار|صباح|مساء|فجر|day|morning|evening|dawn)\s*$/i.test(raw)
        ? 'DAY'
        : linked?.timeOfDay ?? 'UNKNOWN';

  let location = linked?.name?.trim() ?? '';
  if (!location) {
    let rest = raw.replace(/^(داخلي\s*\/\s*خارجي|خارجي\s*\/\s*داخلي|داخلي|خارجي|INT\s*\/\s*EXT|EXT\s*\/\s*INT|INT\/EXT|EXT\/INT|I\/E|INT|EXT)\.?\s*/i, '');
    rest = rest.replace(/^[-–—:]\s*/, '').trim();
    rest = rest.replace(/\s*[-–—]\s*(?:ليل|نهار|صباح|مساء|فجر|مستمر|night|day|morning|evening|dawn|continuous)\s*$/i, '').trim();
    location = rest || 'غير محدد';
  }

  return { location, kind, time };
}

function speakersInScene(scene: Scene): { names: Set<string>; words: Map<string, number>; turns: Map<string, number> } {
  const names = new Set<string>();
  const words = new Map<string, number>();
  const turns = new Map<string, number>();
  let speaker = '';
  for (const block of scene.blocks) {
    if (block.elementType === 'character') {
      speaker = block.text.trim();
      if (speaker) names.add(normalizeName(speaker));
      continue;
    }
    if (block.elementType === 'dialogue' && speaker) {
      const key = normalizeName(speaker);
      words.set(key, (words.get(key) ?? 0) + countWords(block.text));
      turns.set(key, (turns.get(key) ?? 0) + 1);
      continue;
    }
    if (!['parenthetical'].includes(block.elementType)) speaker = '';
  }
  return { names, words, turns };
}

function characterMentionedInAction(scene: Scene, name: string): boolean {
  const needle = normalizeName(name);
  if (needle.length < 2) return false;
  const haystack = normalizeName(scene.blocks.filter((block) => block.elementType === 'action' || block.elementType === 'action_line').map((block) => block.text).join(' '));
  return haystack.includes(needle);
}

function maximumAbsenceRun(appearances: boolean[]): number {
  let current = 0;
  let max = 0;
  for (const appears of appearances) {
    if (appears) current = 0;
    else {
      current += 1;
      max = Math.max(max, current);
    }
  }
  return max;
}

function buildRhythmWindows(sceneStats: ProjectSceneStat[]): RhythmWindow[] {
  if (sceneStats.length < 6) return [];
  const size = sceneStats.length >= 18 ? 5 : sceneStats.length >= 10 ? 4 : 3;
  const windows: RhythmWindow[] = [];
  for (let start = 0; start <= sceneStats.length - size; start += 1) {
    const group = sceneStats.slice(start, start + size);
    const words = group.reduce((sum, scene) => sum + scene.words, 0);
    const dialogueWords = group.reduce((sum, scene) => sum + scene.dialogueWords, 0);
    windows.push({
      startScene: group[0].index,
      endScene: group[group.length - 1].index,
      words,
      averageWords: words / group.length,
      dialogueRatio: words ? dialogueWords / words : 0
    });
  }
  return windows;
}

export function analyzeProjectStructure(snapshot: ProjectSnapshot): ProjectStructuralAnalysis {
  const ordered = orderedScenes(snapshot);
  const knownNames = new Map(snapshot.characters.map((character) => [normalizeName(character.name), character]));
  const unknownSpeakers = new Set<string>();

  const sceneStats: ProjectSceneStat[] = ordered.map((scene, idx) => {
    const words = contentWords(scene);
    const dialogueWords = scene.blocks.filter((block) => block.elementType === 'dialogue').reduce((sum, block) => sum + countWords(block.text), 0);
    const descriptionWords = scene.blocks.filter((block) => block.elementType === 'action').reduce((sum, block) => sum + countWords(block.text), 0);
    const actionWords = scene.blocks.filter((block) => block.elementType === 'action_line').reduce((sum, block) => sum + countWords(block.text), 0);
    const directionWords = scene.blocks.filter((block) => block.elementType === 'direction').reduce((sum, block) => sum + countWords(block.text), 0);
    const speakers = speakersInScene(scene);
    for (const block of scene.blocks.filter((block) => block.elementType === 'character')) {
      const raw = block.text.trim();
      if (raw && !knownNames.has(normalizeName(raw))) unknownSpeakers.add(raw);
    }
    return {
      id: scene.id,
      index: idx + 1,
      heading: scene.heading || 'مشهد بلا عنوان',
      words,
      pages: estimateFormattedPages(scene.blocks),
      dialogueWords,
      descriptionWords,
      actionWords,
      directionWords,
      dialogueRatio: words ? dialogueWords / words : 0,
      speakerCount: speakers.names.size,
      ...parseHeading(scene, snapshot)
    };
  });

  const contentWordList = sceneStats.map((scene) => scene.words).filter((value) => value > 0);
  const contentWordsTotal = contentWordList.reduce((a, b) => a + b, 0);
  const dialogueWordsTotal = sceneStats.reduce((sum, scene) => sum + scene.dialogueWords, 0);
  const averageWords = contentWordList.length ? contentWordsTotal / contentWordList.length : 0;
  const medianWords = median(contentWordList);

  const perSceneSpeakerData = ordered.map(speakersInScene);
  const characterStats: ProjectCharacterStat[] = snapshot.characters.map((character) => {
    const key = normalizeName(character.name);
    const appearances = ordered.map((scene, index) => perSceneSpeakerData[index].names.has(key) || characterMentionedInAction(scene, character.name));
    const sceneNumbers = appearances.map((appears, index) => appears ? index + 1 : 0).filter(Boolean);
    const dialogueWords = perSceneSpeakerData.reduce((sum, data) => sum + (data.words.get(key) ?? 0), 0);
    const dialogueTurns = perSceneSpeakerData.reduce((sum, data) => sum + (data.turns.get(key) ?? 0), 0);
    return {
      id: character.id,
      name: character.name,
      role: character.role,
      sceneCount: sceneNumbers.length,
      sceneShare: ordered.length ? sceneNumbers.length / ordered.length : 0,
      dialogueWords,
      dialogueTurns,
      firstScene: sceneNumbers[0] ?? null,
      lastScene: sceneNumbers[sceneNumbers.length - 1] ?? null,
      maxAbsenceRun: maximumAbsenceRun(appearances)
    };
  }).sort((a, b) => b.sceneCount - a.sceneCount || b.dialogueWords - a.dialogueWords || a.name.localeCompare(b.name));

  const locationMap = new Map<string, { name: string; sceneCount: number }>();
  for (const scene of sceneStats) {
    const key = normalizeName(scene.location || 'غير محدد');
    const current = locationMap.get(key) ?? { name: scene.location || 'غير محدد', sceneCount: 0 };
    current.sceneCount += 1;
    locationMap.set(key, current);
  }
  const locationStats: ProjectLocationStat[] = [...locationMap.values()]
    .map((item) => ({ ...item, share: ordered.length ? item.sceneCount / ordered.length : 0 }))
    .sort((a, b) => b.sceneCount - a.sceneCount || a.name.localeCompare(b.name));

  const headingCounts = sceneStats.reduce<ProjectStructuralAnalysis['headingCounts']>((acc, scene) => {
    if (scene.kind === 'INT') acc.interior += 1;
    else if (scene.kind === 'EXT') acc.exterior += 1;
    else if (scene.kind === 'INT/EXT') acc.mixed += 1;
    else acc.unknown += 1;
    if (scene.time === 'DAY') acc.day += 1;
    else if (scene.time === 'NIGHT') acc.night += 1;
    else if (scene.time === 'CONTINUOUS') acc.continuous += 1;
    return acc;
  }, { interior: 0, exterior: 0, mixed: 0, day: 0, night: 0, continuous: 0, unknown: 0 });

  const sortedByLength = sceneStats.filter((scene) => scene.pages > 0).sort((a, b) => b.pages - a.pages);
  const longestScenes = sortedByLength.slice(0, 4);
  const shortestScenes = [...sortedByLength].reverse().slice(0, 4);

  const windows = buildRhythmWindows(sceneStats);
  const highDialogueWindow = windows.length ? [...windows].sort((a, b) => b.dialogueRatio - a.dialogueRatio)[0] : null;
  const lowDialogueWindow = windows.length ? [...windows].sort((a, b) => a.dialogueRatio - b.dialogueRatio)[0] : null;

  const notices: AnalysisNotice[] = [];

  if (unknownSpeakers.size) {
    notices.push({
      id: 'project-unknown-speakers',
      tone: 'attention',
      title: 'أسماء حوار غير مسجلة في ملف الشخصيات',
      detail: `${[...unknownSpeakers].slice(0, 8).join('، ')}${unknownSpeakers.size > 8 ? `، و${unknownSpeakers.size - 8} أخرى` : ''}.`
    });
  }

  // Page/scene length is reference information only and does not create alerts.


  const mainGapThreshold = Math.max(3, Math.ceil(ordered.length * 0.2));
  const mainGaps = characterStats.filter((character) => character.role === 'main' && character.sceneCount > 0 && character.maxAbsenceRun >= mainGapThreshold);
  if (ordered.length >= 8 && mainGaps.length) {
    notices.push({
      id: 'project-main-gaps',
      tone: 'context',
      title: 'فترات غياب متصلة لشخصيات رئيسية',
      detail: mainGaps.slice(0, 5).map((character) => `${character.name}: حتى ${character.maxAbsenceRun} مشاهد متتالية`).join(' · ')
    });
  }

  const speakingCharacters = characterStats.filter((character) => character.dialogueWords > 0);
  const topSpeaker = [...speakingCharacters].sort((a, b) => b.dialogueWords - a.dialogueWords)[0];
  if (topSpeaker && speakingCharacters.length >= 2 && dialogueWordsTotal >= 250 && topSpeaker.dialogueWords / dialogueWordsTotal >= 0.5) {
    notices.push({
      id: 'project-dialogue-dominance',
      tone: 'context',
      title: 'تركيز مرتفع لكلمات الحوار لدى شخصية واحدة',
      detail: `${topSpeaker.name} يحمل ${Math.round((topSpeaker.dialogueWords / dialogueWordsTotal) * 100)}% من كلمات الحوار في العمل (${topSpeaker.dialogueWords} كلمة).`
    });
  }

  const topLocation = locationStats.find((location) => normalizeName(location.name) !== normalizeName('غير محدد'));
  if (ordered.length >= 10 && topLocation && topLocation.share >= 0.55) {
    notices.push({
      id: 'project-location-concentration',
      tone: 'info',
      title: 'تركيز مكاني مرتفع',
      detail: `${topLocation.name} حاضر في ${topLocation.sceneCount} من ${ordered.length} مشاهد (${Math.round(topLocation.share * 100)}%).`
    });
  }

  return {
    sceneCount: ordered.length,
    contentWords: contentWordsTotal,
    pages: ordered.reduce((sum, scene) => sum + estimateFormattedPages(scene.blocks), 0),
    averageWords,
    medianWords,
    averageDialogueRatio: contentWordsTotal ? dialogueWordsTotal / contentWordsTotal : 0,
    sceneStats,
    longestScenes,
    shortestScenes,
    characterStats,
    locationStats,
    headingCounts,
    unknownSpeakers: [...unknownSpeakers],
    highDialogueWindow,
    lowDialogueWindow,
    notices
  };
}
