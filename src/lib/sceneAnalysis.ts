import type { Character, ProjectSnapshot, Scene, ScreenplayBlock } from './types';
import { countWords } from './screenplayEngine';
import { estimateFormattedPages } from './pageEstimate';

export type AnalysisTone = 'attention' | 'context' | 'info';

export interface AnalysisNotice {
  id: string;
  tone: AnalysisTone;
  title: string;
  detail: string;
}

export interface SpeakerStat {
  name: string;
  turns: number;
  words: number;
  share: number;
}

export interface RepeatedTerm {
  term: string;
  count: number;
}

export interface LongBlockMetric {
  words: number;
  text: string;
  speaker?: string;
}

export interface DialogueRunMetric {
  dialogueBlocks: number;
  words: number;
  speakers: string[];
}

export interface SceneStructuralAnalysis {
  words: number;
  contentWords: number;
  pages: number;
  dialogueWords: number;
  descriptionWords: number;
  actionWords: number;
  directionWords: number;
  parentheticalWords: number;
  dialogueRatio: number;
  descriptionRatio: number;
  actionRatio: number;
  directionRatio: number;
  elementCounts: Record<string, number>;
  speakers: SpeakerStat[];
  unknownSpeakers: string[];
  longestDialogue: LongBlockMetric | null;
  longestDescription: LongBlockMetric | null;
  longestAction: LongBlockMetric | null;
  longestDialogueRun: DialogueRunMetric;
  repeatedTerms: RepeatedTerm[];
  projectAverageWords: number | null;
  projectMedianWords: number | null;
  lengthRatioToAverage: number | null;
  projectAverageDialogueRatio: number | null;
  dialogueRatioDelta: number | null;
  notices: AnalysisNotice[];
}

const ARABIC_STOPWORDS = new Set([
  'من','في','على','إلى','الى','عن','أن','ان','إن','هذا','هذه','ذلك','تلك','هو','هي','هم','هن','أنا','انا','أنت','انت','نحن',
  'كان','كانت','يكون','تكون','ما','لا','لم','لن','قد','ثم','أو','او','و','ف','ب','ك','ل','يا','مع','بعد','قبل','بين','عند','حتى',
  'كل','أي','اي','هناك','هنا','لكن','بل','إذا','اذا','كيف','ماذا','لماذا','هل','نعم','ليس','ليست','له','لها','فيه','فيها','عليه',
  'عليها','كما','أيضا','ايضا','جدا','أمام','امام','خلف','فوق','تحت','داخل','خارج','نحو','مرة','شيء','شيئا','شيئاً'
]);

const ENGLISH_STOPWORDS = new Set([
  'the','a','an','and','or','but','if','then','to','of','in','on','at','for','from','with','without','is','are','was','were','be',
  'been','being','it','this','that','these','those','he','she','they','we','you','i','his','her','their','our','your','my','as','by',
  'not','no','yes','do','does','did','have','has','had','can','could','will','would','should','may','might','there','here','into','out'
]);

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

function contentBlocks(scene: Scene): ScreenplayBlock[] {
  return scene.blocks.filter((block) => ['action', 'action_line', 'dialogue', 'parenthetical', 'direction'].includes(block.elementType));
}

function sceneContentWords(scene: Scene): number {
  return contentBlocks(scene).reduce((sum, block) => sum + countWords(block.text), 0);
}

function sceneDialogueRatio(scene: Scene): number | null {
  const content = sceneContentWords(scene);
  if (!content) return null;
  const dialogue = scene.blocks
    .filter((block) => block.elementType === 'dialogue')
    .reduce((sum, block) => sum + countWords(block.text), 0);
  return dialogue / content;
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function roundedPct(value: number): number {
  return Math.round(value * 100);
}

function trimSnippet(text: string, max = 100): string {
  const compact = text.replace(/\s+/g, ' ').trim();
  return compact.length > max ? `${compact.slice(0, max - 1)}…` : compact;
}

function extractRepeatedTerms(scene: Scene): RepeatedTerm[] {
  const displayByNormalized = new Map<string, string>();
  const counts = new Map<string, number>();
  const text = contentBlocks(scene).map((block) => block.text).join(' ');
  const tokens = text.match(/[\p{L}\p{N}][\p{L}\p{N}'’_-]*/gu) ?? [];

  for (const raw of tokens) {
    const normalized = normalizeArabic(raw).replace(/^[-_'’]+|[-_'’]+$/g, '');
    if (normalized.length < 3 || /^\d+$/.test(normalized)) continue;
    if (ARABIC_STOPWORDS.has(normalized) || ENGLISH_STOPWORDS.has(normalized)) continue;
    if (!displayByNormalized.has(normalized)) displayByNormalized.set(normalized, raw);
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }

  return [...counts.entries()]
    .filter(([, count]) => count >= 4)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([term, count]) => ({ term: displayByNormalized.get(term) ?? term, count }));
}

export function analyzeSceneStructure(snapshot: ProjectSnapshot, scene: Scene | null): SceneStructuralAnalysis {
  const empty: SceneStructuralAnalysis = {
    words: 0,
    contentWords: 0,
    pages: 0,
    dialogueWords: 0,
    descriptionWords: 0,
    actionWords: 0,
    directionWords: 0,
    parentheticalWords: 0,
    dialogueRatio: 0,
    descriptionRatio: 0,
    actionRatio: 0,
    directionRatio: 0,
    elementCounts: {},
    speakers: [],
    unknownSpeakers: [],
    longestDialogue: null,
    longestDescription: null,
    longestAction: null,
    longestDialogueRun: { dialogueBlocks: 0, words: 0, speakers: [] },
    repeatedTerms: [],
    projectAverageWords: null,
    projectMedianWords: null,
    lengthRatioToAverage: null,
    projectAverageDialogueRatio: null,
    dialogueRatioDelta: null,
    notices: []
  };
  if (!scene) return empty;

  const allText = scene.blocks.map((block) => block.text).join('\n');
  const words = countWords(allText);
  const contentWords = sceneContentWords(scene);
  const descriptionWords = scene.blocks.filter((block) => block.elementType === 'action').reduce((sum, block) => sum + countWords(block.text), 0);
  const actionWords = scene.blocks.filter((block) => block.elementType === 'action_line').reduce((sum, block) => sum + countWords(block.text), 0);
  const directionWords = scene.blocks.filter((block) => block.elementType === 'direction').reduce((sum, block) => sum + countWords(block.text), 0);
  const dialogueWords = scene.blocks.filter((block) => block.elementType === 'dialogue').reduce((sum, block) => sum + countWords(block.text), 0);
  const parentheticalWords = scene.blocks.filter((block) => block.elementType === 'parenthetical').reduce((sum, block) => sum + countWords(block.text), 0);
  const dialogueRatio = contentWords ? dialogueWords / contentWords : 0;
  const descriptionRatio = contentWords ? descriptionWords / contentWords : 0;
  const actionRatio = contentWords ? actionWords / contentWords : 0;
  const directionRatio = contentWords ? directionWords / contentWords : 0;

  const elementCounts = scene.blocks.reduce<Record<string, number>>((acc, block) => {
    acc[block.elementType] = (acc[block.elementType] ?? 0) + 1;
    return acc;
  }, {});

  const speakerMap = new Map<string, { name: string; turns: number; words: number }>();
  let currentSpeaker = '';
  let longestDialogue: LongBlockMetric | null = null;
  let longestDescription: LongBlockMetric | null = null;
  let longestAction: LongBlockMetric | null = null;
  let currentRun = { dialogueBlocks: 0, words: 0, speakers: new Set<string>() };
  let longestRun = { dialogueBlocks: 0, words: 0, speakers: new Set<string>() };

  const finishRun = () => {
    if (currentRun.dialogueBlocks > longestRun.dialogueBlocks || (currentRun.dialogueBlocks === longestRun.dialogueBlocks && currentRun.words > longestRun.words)) {
      longestRun = { dialogueBlocks: currentRun.dialogueBlocks, words: currentRun.words, speakers: new Set(currentRun.speakers) };
    }
    currentRun = { dialogueBlocks: 0, words: 0, speakers: new Set<string>() };
  };

  for (const block of scene.blocks) {
    if (block.elementType === 'character') {
      currentSpeaker = block.text.trim();
      continue;
    }

    if (block.elementType === 'dialogue') {
      const blockWords = countWords(block.text);
      if (currentSpeaker) {
        const key = normalizeName(currentSpeaker);
        const existing = speakerMap.get(key) ?? { name: currentSpeaker, turns: 0, words: 0 };
        existing.turns += 1;
        existing.words += blockWords;
        speakerMap.set(key, existing);
        currentRun.speakers.add(existing.name);
      }
      currentRun.dialogueBlocks += 1;
      currentRun.words += blockWords;
      if (!longestDialogue || blockWords > longestDialogue.words) {
        longestDialogue = { words: blockWords, text: trimSnippet(block.text), speaker: currentSpeaker || undefined };
      }
      continue;
    }

    if (block.elementType === 'parenthetical') continue;

    if (block.elementType === 'action') {
      const blockWords = countWords(block.text);
      if (!longestDescription || blockWords > longestDescription.words) longestDescription = { words: blockWords, text: trimSnippet(block.text) };
    }

    if (block.elementType === 'action_line') {
      const blockWords = countWords(block.text);
      if (!longestAction || blockWords > longestAction.words) longestAction = { words: blockWords, text: trimSnippet(block.text) };
    }

    finishRun();
    currentSpeaker = '';
  }
  finishRun();

  const speakers = [...speakerMap.values()]
    .map((speaker) => ({ ...speaker, share: dialogueWords ? speaker.words / dialogueWords : 0 }))
    .sort((a, b) => b.words - a.words || b.turns - a.turns || a.name.localeCompare(b.name));

  const projectNames = new Map(snapshot.characters.map((character) => [normalizeName(character.name), character.name]));
  const unknownSpeakers = speakers.filter((speaker) => !projectNames.has(normalizeName(speaker.name))).map((speaker) => speaker.name);

  const otherScenes = snapshot.scenes.filter((item) => item.id !== scene.id && (!scene.episodeId || item.episodeId === scene.episodeId));
  const otherWordCounts = otherScenes.map(sceneContentWords).filter((value) => value > 0);
  const projectAverageWords = otherWordCounts.length >= 2 ? otherWordCounts.reduce((a, b) => a + b, 0) / otherWordCounts.length : null;
  const projectMedianWords = otherWordCounts.length >= 2 ? median(otherWordCounts) : null;
  const lengthRatioToAverage = projectAverageWords && contentWords ? contentWords / projectAverageWords : null;

  const otherDialogueRatios = otherScenes.map(sceneDialogueRatio).filter((value): value is number => value !== null);
  const projectAverageDialogueRatio = otherDialogueRatios.length >= 2 ? otherDialogueRatios.reduce((a, b) => a + b, 0) / otherDialogueRatios.length : null;
  const dialogueRatioDelta = projectAverageDialogueRatio === null ? null : dialogueRatio - projectAverageDialogueRatio;

  const repeatedTerms = extractRepeatedTerms(scene);
  const notices: AnalysisNotice[] = [];

  if (unknownSpeakers.length) {
    notices.push({
      id: 'unknown-speakers', tone: 'attention', title: 'أسماء حوار غير موجودة في ملف الشخصيات',
      detail: `${unknownSpeakers.join('، ')}. قد تكون شخصيات جديدة أو اختلافاً في كتابة الاسم.`
    });
  }

  // Scene/page length is reference information only; it never creates an analytical notice.

  // A scene with no dialogue can be entirely valid. Do not turn dialogue absence into a warning.
  if (dialogueWords > 0 && dialogueRatioDelta !== null && contentWords >= 50 && Math.abs(dialogueRatioDelta) >= 0.22) {
    const direction = dialogueRatioDelta > 0 ? 'أعلى' : 'أقل';
    notices.push({
      id: 'dialogue-vs-project', tone: 'context', title: 'تركيب الحوار مختلف عن متوسط المشروع',
      detail: `الحوار يشكل ${roundedPct(dialogueRatio)}% من محتوى المشهد، وهو ${direction} بنحو ${Math.abs(roundedPct(dialogueRatioDelta))} نقطة مئوية من متوسط المشاهد الأخرى.`
    });
  }

  if (longestRun.dialogueBlocks >= 6 || longestRun.words >= 120) {
    notices.push({
      id: 'dialogue-run', tone: 'info', title: 'تتابع حواري متصل',
      detail: `${longestRun.dialogueBlocks} مداخلات حوارية متتابعة، مجموعها ${longestRun.words} كلمة، قبل عنصر سردي جديد. هذا توصيف بنيوي لا حكم على المشهد.`
    });
  }

  if (longestDialogue && longestDialogue.words >= 45) {
    notices.push({
      id: 'long-dialogue-block', tone: 'info', title: 'كتلة حوار طويلة',
      detail: `${longestDialogue.speaker ? `${longestDialogue.speaker}: ` : ''}${longestDialogue.words} كلمة في مداخلة واحدة — «${longestDialogue.text}»`
    });
  }

  if (longestDescription && longestDescription.words >= 80) {
    notices.push({
      id: 'long-description-block', tone: 'info', title: 'كتلة وصف طويلة',
      detail: `${longestDescription.words} كلمة في عنصر وصف واحد — «${longestDescription.text}»`
    });
  }

  if (longestAction && longestAction.words >= 60) {
    notices.push({
      id: 'long-action-block', tone: 'info', title: 'كتلة فعل طويلة',
      detail: `${longestAction.words} كلمة في عنصر فعل واحد — «${longestAction.text}»`
    });
  }

  if (speakers.length >= 2 && dialogueWords >= 50 && speakers[0].share >= 0.65 && speakers[0].turns >= 3) {
    notices.push({
      id: 'dominant-speaker', tone: 'context', title: 'تركيز حواري لدى شخصية واحدة',
      detail: `${speakers[0].name} يحمل ${roundedPct(speakers[0].share)}% من كلمات الحوار (${speakers[0].words} كلمة في ${speakers[0].turns} مداخلات).`
    });
  }

  if (repeatedTerms.length && contentWords >= 50) {
    const [top] = repeatedTerms;
    if (top.count >= Math.max(4, Math.ceil(contentWords / 40))) {
      notices.push({
        id: 'repetition', tone: 'info', title: 'تكرار لفظي لافت',
        detail: repeatedTerms.slice(0, 3).map((item) => `«${item.term}» ×${item.count}`).join(' · ')
      });
    }
  }

  return {
    words,
    contentWords,
    pages: estimateFormattedPages(scene.blocks),
    dialogueWords,
    descriptionWords,
    actionWords,
    directionWords,
    parentheticalWords,
    dialogueRatio,
    descriptionRatio,
    actionRatio,
    directionRatio,
    elementCounts,
    speakers,
    unknownSpeakers,
    longestDialogue,
    longestDescription,
    longestAction,
    longestDialogueRun: { dialogueBlocks: longestRun.dialogueBlocks, words: longestRun.words, speakers: [...longestRun.speakers] },
    repeatedTerms,
    projectAverageWords,
    projectMedianWords,
    lengthRatioToAverage,
    projectAverageDialogueRatio,
    dialogueRatioDelta,
    notices
  };
}
