import type { Character, ProjectSnapshot, Scene, ScreenplayBlock } from './types';
import { countWords } from './screenplayEngine';
import { estimateFormattedPages } from './pageEstimate';
import { orderedScenes } from './structure';

export type AssistantTone = 'attention' | 'context' | 'info';
export type ConsistencyCategory = 'characters' | 'locations' | 'scenes' | 'text';

export interface AssistantSceneMetric {
  id: string;
  index: number;
  heading: string;
  pages: number;
  contentWords: number;
  dialogueWords: number;
  descriptionWords: number;
  actionWords: number;
  directionWords: number;
  dialogueRatio: number;
  descriptionRatio: number;
  actionRatio: number;
  directionRatio: number;
  dialogueDeltaFromMedian: number;
  descriptionDeltaFromMedian: number;
  actionDeltaFromMedian: number;
  speakerNames: string[];
  place: string;
  kind: 'INT' | 'EXT' | 'INT/EXT' | 'UNKNOWN';
  time: string;
  missingMetadata: string[];
  longestDialogueWords: number;
}

export interface DialogueTurnRef {
  sceneId: string;
  blockId: string;
  sceneIndex: number;
  words: number;
  text: string;
  fullText: string;
}

export interface CharacterCoAppearance {
  name: string;
  scenes: number;
}

export interface CharacterAssistantMetric {
  id: string;
  name: string;
  aliases: string[];
  role: Character['role'];
  sceneCount: number;
  speakingSceneCount: number;
  sceneShare: number;
  dialogueTurns: number;
  dialogueWords: number;
  firstScene: number | null;
  lastScene: number | null;
  maxGap: number;
  averageTurnWords: number;
  medianTurnWords: number;
  longestTurnWords: number;
  lexicalDiversity: number | null;
  lexicalSampleWords: number;
  signatureTerms: { term: string; count: number }[];
  outlierTurns: DialogueTurnRef[];
  coAppearances: CharacterCoAppearance[];
}

export interface LocationAssistantMetric {
  name: string;
  sceneCount: number;
  share: number;
}

export interface ConsistencyFinding {
  id: string;
  tone: AssistantTone;
  category: ConsistencyCategory;
  title: string;
  detail: string;
  sceneIds: string[];
}

export interface AssistantScopeAnalysis {
  sceneCount: number;
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
  sceneMetrics: AssistantSceneMetric[];
  characterMetrics: CharacterAssistantMetric[];
  locationMetrics: LocationAssistantMetric[];
  consistency: ConsistencyFinding[];
  repeatedTerms: { term: string; count: number }[];
  compositionMedians: { dialogue: number; description: number; action: number; direction: number };
  headingCounts: {
    interior: number;
    exterior: number;
    mixed: number;
    unknownKind: number;
    day: number;
    night: number;
    otherTime: number;
  };
}

const ARABIC_STOPWORDS = new Set([
  'من','في','على','إلى','الى','عن','أن','ان','إن','هذا','هذه','ذلك','تلك','هو','هي','هم','هن','أنا','انا','أنت','انت','نحن',
  'كان','كانت','يكون','تكون','ما','لا','لم','لن','قد','ثم','أو','او','و','ف','ب','ك','ل','يا','مع','بعد','قبل','بين','عند','حتى',
  'كل','أي','اي','هناك','هنا','لكن','بل','إذا','اذا','كيف','ماذا','لماذا','هل','نعم','ليس','ليست','له','لها','فيه','فيها','عليه',
  'عليها','كما','أيضا','ايضا','جدا','أمام','امام','خلف','فوق','تحت','داخل','خارج','نحو','مرة','شيء','شيئا','شيئاً','غير','راه'
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
    .replace(/[\[\]{}:؛،,.!?؟!\-–—"'«»]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitAliases(value: string | undefined): string[] {
  return (value ?? '')
    .split(/[،,;؛|\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function characterNames(character: Character): string[] {
  return [character.name, ...splitAliases(character.aliases)]
    .map((item) => item.trim())
    .filter(Boolean);
}

function characterKeys(character: Character): string[] {
  return [...new Set(characterNames(character).map(normalizeName).filter(Boolean))];
}

function dialogueTokens(text: string): string[] {
  return (text.match(/[\p{L}\p{N}][\p{L}\p{N}'’_-]*/gu) ?? [])
    .map((word) => normalizeArabic(word).replace(/^[-_'’]+|[-_'’]+$/g, ''))
    .filter((word) => word.length > 1 && !/^\d+$/.test(word));
}

function movingLexicalDiversity(tokens: string[], windowSize = 40): number | null {
  if (tokens.length < 20) return null;
  if (tokens.length <= windowSize) return new Set(tokens).size / tokens.length;
  const values: number[] = [];
  const step = Math.max(5, Math.floor(windowSize / 4));
  for (let start = 0; start + windowSize <= tokens.length; start += step) {
    const window = tokens.slice(start, start + windowSize);
    values.push(new Set(window).size / window.length);
  }
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function contentBlocks(scene: Scene): ScreenplayBlock[] {
  return scene.blocks.filter((block) => ['action', 'action_line', 'dialogue', 'parenthetical', 'direction'].includes(block.elementType));
}

function sumWords(scene: Scene, type: ScreenplayBlock['elementType']): number {
  return scene.blocks.filter((block) => block.elementType === type).reduce((sum, block) => sum + countWords(block.text), 0);
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function trimSnippet(text: string, max = 90): string {
  const compact = text.replace(/\s+/g, ' ').trim();
  return compact.length > max ? `${compact.slice(0, max - 1)}…` : compact;
}

function maximumInternalGap(sceneNumbers: number[]): number {
  if (sceneNumbers.length < 2) return 0;
  let max = 0;
  for (let index = 1; index < sceneNumbers.length; index += 1) {
    max = Math.max(max, sceneNumbers[index] - sceneNumbers[index - 1] - 1);
  }
  return max;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const old = prev[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diagonal + cost);
      diagonal = old;
    }
  }
  return prev[b.length];
}

function scenePlace(scene: Scene, snapshot: ProjectSnapshot): string {
  const linked = scene.locationId ? snapshot.locations.find((location) => location.id === scene.locationId) : undefined;
  if (linked?.name?.trim()) return linked.name.trim();
  return scene.scenePlace?.trim() || '';
}

function sceneKind(scene: Scene): AssistantSceneMetric['kind'] {
  if (scene.sceneKind === 'INT' || scene.sceneKind === 'EXT' || scene.sceneKind === 'INT/EXT') return scene.sceneKind;
  const raw = normalizeArabic(scene.heading || '').replace(/\s+/g, '');
  if (raw.startsWith('داخلي/خارجي') || raw.startsWith('خارجي/داخلي') || raw.startsWith('int/ext') || raw.startsWith('ext/int')) return 'INT/EXT';
  if (raw.startsWith('داخلي') || raw.startsWith('int')) return 'INT';
  if (raw.startsWith('خارجي') || raw.startsWith('ext')) return 'EXT';
  return 'UNKNOWN';
}

function sceneTime(scene: Scene): string {
  return scene.sceneTime?.trim() || '';
}

function collectSceneSpeakers(scene: Scene): { display: Map<string, string>; turns: Map<string, DialogueTurnRef[]> } {
  const display = new Map<string, string>();
  const turns = new Map<string, DialogueTurnRef[]>();
  let speaker = '';
  for (const block of scene.blocks) {
    if (block.elementType === 'character') {
      speaker = block.text.trim();
      if (speaker) display.set(normalizeName(speaker), speaker);
      continue;
    }
    if (block.elementType === 'dialogue' && speaker) {
      const key = normalizeName(speaker);
      const refs = turns.get(key) ?? [];
      refs.push({ sceneId: scene.id, blockId: block.id, sceneIndex: 0, words: countWords(block.text), text: trimSnippet(block.text), fullText: block.text });
      turns.set(key, refs);
      continue;
    }
    if (block.elementType !== 'parenthetical') speaker = '';
  }
  return { display, turns };
}

function characterMentioned(scene: Scene, character: Character): boolean {
  const haystack = normalizeName(
    scene.blocks
      .filter((block) => block.elementType === 'action' || block.elementType === 'action_line')
      .map((block) => block.text)
      .join(' ')
  );
  return characterKeys(character).some((needle) => needle.length >= 2 && (` ${haystack} `).includes(` ${needle} `));
}

function repeatedTerms(scenes: Scene[]): { term: string; count: number }[] {
  const counts = new Map<string, number>();
  const display = new Map<string, string>();
  const text = scenes.flatMap(contentBlocks).map((block) => block.text).join(' ');
  const tokens = text.match(/[\p{L}\p{N}][\p{L}\p{N}'’_-]*/gu) ?? [];
  for (const raw of tokens) {
    const normalized = normalizeArabic(raw).replace(/^[-_'’]+|[-_'’]+$/g, '');
    if (normalized.length < 3 || /^\d+$/.test(normalized)) continue;
    if (ARABIC_STOPWORDS.has(normalized) || ENGLISH_STOPWORDS.has(normalized)) continue;
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
    if (!display.has(normalized)) display.set(normalized, raw);
  }
  return [...counts.entries()]
    .filter(([, count]) => count >= 7)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ar'))
    .slice(0, 10)
    .map(([term, count]) => ({ term: display.get(term) ?? term, count }));
}

export function analyzeAssistantScope(snapshot: ProjectSnapshot): AssistantScopeAnalysis {
  const scenes = orderedScenes(snapshot);
  const knownCharacters = new Map<string, Character>();
  for (const character of snapshot.characters) {
    for (const key of characterKeys(character)) knownCharacters.set(key, character);
  }
  const knownLocations = new Map(snapshot.locations.map((location) => [normalizeName(location.name), location.name]));

  const sceneSpeakerData = new Map<string, ReturnType<typeof collectSceneSpeakers>>();
  const sceneMetrics: AssistantSceneMetric[] = scenes.map((scene, index) => {
    const speakerData = collectSceneSpeakers(scene);
    sceneSpeakerData.set(scene.id, speakerData);
    for (const refs of speakerData.turns.values()) refs.forEach((ref) => ref.sceneIndex = index + 1);

    const dialogueWords = sumWords(scene, 'dialogue');
    const descriptionWords = sumWords(scene, 'action');
    const actionWords = sumWords(scene, 'action_line');
    const directionWords = sumWords(scene, 'direction');
    const parentheticalWords = sumWords(scene, 'parenthetical');
    const contentWords = dialogueWords + descriptionWords + actionWords + directionWords + parentheticalWords;
    const kind = sceneKind(scene);
    const place = scenePlace(scene, snapshot);
    const time = sceneTime(scene);
    const missingMetadata: string[] = [];
    if (kind === 'UNKNOWN') missingMetadata.push('داخلي/خارجي');
    if (!place) missingMetadata.push('المكان');
    if (!time) missingMetadata.push('الزمن');
    const longestDialogueWords = Math.max(0, ...scene.blocks.filter((block) => block.elementType === 'dialogue').map((block) => countWords(block.text)));
    return {
      id: scene.id,
      index: index + 1,
      heading: scene.heading?.trim() || 'مشهد بلا عنوان',
      pages: estimateFormattedPages(scene.blocks),
      contentWords,
      dialogueWords,
      descriptionWords,
      actionWords,
      directionWords,
      dialogueRatio: contentWords ? dialogueWords / contentWords : 0,
      descriptionRatio: contentWords ? descriptionWords / contentWords : 0,
      actionRatio: contentWords ? actionWords / contentWords : 0,
      directionRatio: contentWords ? directionWords / contentWords : 0,
      dialogueDeltaFromMedian: 0,
      descriptionDeltaFromMedian: 0,
      actionDeltaFromMedian: 0,
      speakerNames: [...speakerData.display.values()],
      place,
      kind,
      time,
      missingMetadata,
      longestDialogueWords
    };
  });

  const comparableScenes = sceneMetrics.filter((item) => item.contentWords >= 20);
  const compositionMedians = {
    dialogue: median(comparableScenes.map((item) => item.dialogueRatio)),
    description: median(comparableScenes.map((item) => item.descriptionRatio)),
    action: median(comparableScenes.map((item) => item.actionRatio)),
    direction: median(comparableScenes.map((item) => item.directionRatio))
  };
  for (const item of sceneMetrics) {
    item.dialogueDeltaFromMedian = item.dialogueRatio - compositionMedians.dialogue;
    item.descriptionDeltaFromMedian = item.descriptionRatio - compositionMedians.description;
    item.actionDeltaFromMedian = item.actionRatio - compositionMedians.action;
  }

  const totals = sceneMetrics.reduce((acc, item) => {
    acc.contentWords += item.contentWords;
    acc.dialogueWords += item.dialogueWords;
    acc.descriptionWords += item.descriptionWords;
    acc.actionWords += item.actionWords;
    acc.directionWords += item.directionWords;
    return acc;
  }, { contentWords: 0, dialogueWords: 0, descriptionWords: 0, actionWords: 0, directionWords: 0 });
  const parentheticalWords = scenes.reduce((sum, scene) => sum + sumWords(scene, 'parenthetical'), 0);

  const globalDialogueTokenCounts = new Map<string, number>();
  let globalDialogueTokenTotal = 0;
  for (const scene of scenes) {
    for (const block of scene.blocks.filter((item) => item.elementType === 'dialogue')) {
      for (const token of dialogueTokens(block.text)) {
        globalDialogueTokenCounts.set(token, (globalDialogueTokenCounts.get(token) ?? 0) + 1);
        globalDialogueTokenTotal += 1;
      }
    }
  }

  const characterMetrics: CharacterAssistantMetric[] = snapshot.characters.map((character) => {
    const keys = characterKeys(character);
    const appearanceScenes: number[] = [];
    const speakingScenes: number[] = [];
    const dialogueTurns: DialogueTurnRef[] = [];

    scenes.forEach((scene, index) => {
      const data = sceneSpeakerData.get(scene.id)!;
      const speaks = keys.some((key) => data.display.has(key));
      if (speaks || characterMentioned(scene, character)) appearanceScenes.push(index + 1);
      if (speaks) speakingScenes.push(index + 1);
      for (const key of keys) dialogueTurns.push(...(data.turns.get(key) ?? []));
    });

    const turnLengths = dialogueTurns.map((turn) => turn.words).filter((value) => value > 0);
    const averageTurnWords = turnLengths.length ? turnLengths.reduce((sum, value) => sum + value, 0) / turnLengths.length : 0;
    const medianTurnWords = median(turnLengths);
    const outlierThreshold = turnLengths.length >= 5 ? Math.max(35, medianTurnWords * 3) : Number.POSITIVE_INFINITY;
    const tokens = dialogueTokens(dialogueTurns.map((turn) => turn.fullText).join(' '));
    const lexicalDiversity = movingLexicalDiversity(tokens);
    const tokenCounts = new Map<string, number>();
    for (const token of tokens) {
      if (ARABIC_STOPWORDS.has(token) || ENGLISH_STOPWORDS.has(token) || token.length < 3) continue;
      tokenCounts.set(token, (tokenCounts.get(token) ?? 0) + 1);
    }
    const signatureTerms = [...tokenCounts.entries()]
      .filter(([, count]) => count >= 2)
      .map(([term, count]) => {
        const otherCount = Math.max(0, (globalDialogueTokenCounts.get(term) ?? 0) - count);
        const ownRate = count / Math.max(1, tokens.length);
        const otherRate = otherCount / Math.max(20, globalDialogueTokenTotal - tokens.length);
        return { term, count, score: ownRate / Math.max(0.002, otherRate) };
      })
      .sort((a, b) => b.score - a.score || b.count - a.count || a.term.localeCompare(b.term, 'ar'))
      .slice(0, 5)
      .map(({ term, count }) => ({ term, count }));
    const outlierTurns = dialogueTurns
      .filter((turn) => turn.words >= outlierThreshold)
      .sort((a, b) => b.words - a.words)
      .slice(0, 4);

    const coMap = new Map<string, number>();
    for (const sceneNo of appearanceScenes) {
      const scene = scenes[sceneNo - 1];
      for (const other of snapshot.characters) {
        if (other.id === character.id) continue;
        const otherKeys = characterKeys(other);
        const data = sceneSpeakerData.get(scene.id)!;
        if (otherKeys.some((key) => data.display.has(key)) || characterMentioned(scene, other)) {
          coMap.set(other.name, (coMap.get(other.name) ?? 0) + 1);
        }
      }
    }

    return {
      id: character.id,
      name: character.name,
      aliases: splitAliases(character.aliases),
      role: character.role,
      sceneCount: appearanceScenes.length,
      speakingSceneCount: speakingScenes.length,
      sceneShare: scenes.length ? appearanceScenes.length / scenes.length : 0,
      dialogueTurns: dialogueTurns.length,
      dialogueWords: turnLengths.reduce((sum, value) => sum + value, 0),
      firstScene: appearanceScenes[0] ?? null,
      lastScene: appearanceScenes[appearanceScenes.length - 1] ?? null,
      maxGap: maximumInternalGap(appearanceScenes),
      averageTurnWords,
      medianTurnWords,
      longestTurnWords: Math.max(0, ...turnLengths),
      lexicalDiversity,
      lexicalSampleWords: tokens.length,
      signatureTerms,
      outlierTurns,
      coAppearances: [...coMap.entries()]
        .map(([name, count]) => ({ name, scenes: count }))
        .sort((a, b) => b.scenes - a.scenes || a.name.localeCompare(b.name, 'ar'))
        .slice(0, 5)
    };
  }).sort((a, b) => b.sceneCount - a.sceneCount || b.dialogueWords - a.dialogueWords || a.name.localeCompare(b.name, 'ar'));

  const locationMap = new Map<string, { name: string; sceneCount: number }>();
  for (const item of sceneMetrics) {
    const name = item.place || 'غير محدد';
    const key = normalizeName(name);
    const current = locationMap.get(key) ?? { name, sceneCount: 0 };
    current.sceneCount += 1;
    locationMap.set(key, current);
  }
  const locationMetrics = [...locationMap.values()]
    .map((item) => ({ ...item, share: scenes.length ? item.sceneCount / scenes.length : 0 }))
    .sort((a, b) => b.sceneCount - a.sceneCount || a.name.localeCompare(b.name, 'ar'));

  const consistency: ConsistencyFinding[] = [];

  const unknownByKey = new Map<string, { name: string; sceneIds: Set<string> }>();
  for (const scene of scenes) {
    const data = sceneSpeakerData.get(scene.id)!;
    for (const [key, displayName] of data.display) {
      if (!key || knownCharacters.has(key)) continue;
      const current = unknownByKey.get(key) ?? { name: displayName, sceneIds: new Set<string>() };
      current.sceneIds.add(scene.id);
      unknownByKey.set(key, current);
    }
  }
  for (const [key, item] of unknownByKey) {
    const closest = [...knownCharacters.entries()]
      .map(([knownKey, character]) => ({ character, distance: levenshtein(key, knownKey), length: Math.max(key.length, knownKey.length) }))
      .filter((match) => match.length >= 4 && match.distance <= (match.length <= 6 ? 1 : 2))
      .sort((a, b) => a.distance - b.distance)[0];
    consistency.push({
      id: `unknown-character-${key}`,
      tone: closest ? 'context' : 'attention',
      category: 'characters',
      title: closest ? `اسم قريب من شخصية مسجلة: ${item.name}` : `شخصية حوار غير مسجلة: ${item.name}`,
      detail: closest ? `قد يكون اختلافاً في كتابة «${closest.character.name}». راجع المواضع قبل توحيد الاسم.` : 'ظهر الاسم كمتكلم في النص لكنه غير موجود في ملف الشخصيات.',
      sceneIds: [...item.sceneIds]
    });
  }

  const missingScenes = sceneMetrics.filter((item) => item.missingMetadata.length > 0);
  for (const item of missingScenes) {
    consistency.push({
      id: `scene-meta-${item.id}`,
      tone: 'attention',
      category: 'scenes',
      title: `بيانات ناقصة في المشهد ${item.index}`,
      detail: `ينقص: ${item.missingMetadata.join('، ')}.`,
      sceneIds: [item.id]
    });
  }

  const unregisteredPlaces = new Map<string, { name: string; sceneIds: string[] }>();
  for (const item of sceneMetrics) {
    if (!item.place) continue;
    const key = normalizeName(item.place);
    if (knownLocations.has(key)) continue;
    const current = unregisteredPlaces.get(key) ?? { name: item.place, sceneIds: [] };
    current.sceneIds.push(item.id);
    unregisteredPlaces.set(key, current);
  }
  for (const [key, item] of unregisteredPlaces) {
    const closest = [...knownLocations.entries()]
      .map(([knownKey, name]) => ({ name, distance: levenshtein(key, knownKey), length: Math.max(key.length, knownKey.length) }))
      .filter((match) => match.length >= 4 && match.distance <= (match.length <= 7 ? 1 : 2))
      .sort((a, b) => a.distance - b.distance)[0];
    consistency.push({
      id: `unknown-location-${key}`,
      tone: closest ? 'context' : 'info',
      category: 'locations',
      title: closest ? `مكان قريب من اسم مسجل: ${item.name}` : `مكان مستخدم وغير مسجل: ${item.name}`,
      detail: closest ? `قد يكون اختلافاً في كتابة «${closest.name}».` : `استُخدم في ${item.sceneIds.length} مشهد${item.sceneIds.length > 1 ? 'اً' : ''} ولم يُضف إلى ملف الأماكن.`,
      sceneIds: item.sceneIds
    });
  }

  for (const character of characterMetrics) {
    if (!character.outlierTurns.length) continue;
    const turn = character.outlierTurns[0];
    consistency.push({
      id: `dialogue-outlier-${character.id}`,
      tone: 'context',
      category: 'text',
      title: `مداخلة خارج النمط المعتاد لـ${character.name}`,
      detail: `وسيط مداخلاته ${Math.round(character.medianTurnWords)} كلمة، بينما توجد مداخلة من ${turn.words} كلمة في المشهد ${turn.sceneIndex}. هذا اختلاف إحصائي فقط.`,
      sceneIds: [turn.sceneId]
    });
  }

  const headingCounts = sceneMetrics.reduce<AssistantScopeAnalysis['headingCounts']>((acc, item) => {
    if (item.kind === 'INT') acc.interior += 1;
    else if (item.kind === 'EXT') acc.exterior += 1;
    else if (item.kind === 'INT/EXT') acc.mixed += 1;
    else acc.unknownKind += 1;
    const time = normalizeArabic(item.time);
    if (/ليل|night/.test(time)) acc.night += 1;
    else if (/نهار|صباح|فجر|day|morning|dawn/.test(time)) acc.day += 1;
    else if (time) acc.otherTime += 1;
    return acc;
  }, { interior: 0, exterior: 0, mixed: 0, unknownKind: 0, day: 0, night: 0, otherTime: 0 });

  return {
    sceneCount: scenes.length,
    contentWords: totals.contentWords,
    pages: scenes.reduce((sum, scene) => sum + estimateFormattedPages(scene.blocks), 0),
    dialogueWords: totals.dialogueWords,
    descriptionWords: totals.descriptionWords,
    actionWords: totals.actionWords,
    directionWords: totals.directionWords,
    parentheticalWords,
    dialogueRatio: totals.contentWords ? totals.dialogueWords / totals.contentWords : 0,
    descriptionRatio: totals.contentWords ? totals.descriptionWords / totals.contentWords : 0,
    actionRatio: totals.contentWords ? totals.actionWords / totals.contentWords : 0,
    directionRatio: totals.contentWords ? totals.directionWords / totals.contentWords : 0,
    sceneMetrics,
    characterMetrics,
    locationMetrics,
    consistency: consistency.sort((a, b) => {
      const toneOrder: Record<AssistantTone, number> = { attention: 0, context: 1, info: 2 };
      return toneOrder[a.tone] - toneOrder[b.tone] || a.title.localeCompare(b.title, 'ar');
    }),
    repeatedTerms: repeatedTerms(scenes),
    compositionMedians,
    headingCounts
  };
}
