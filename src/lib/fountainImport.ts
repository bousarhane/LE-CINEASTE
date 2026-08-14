import type { Character, Location, ScreenplayElement } from './types';
import { newId } from './id';
import { recognizeSceneHeading, stripSceneHeadingNumber } from './sceneHeading';
import { rebuildRecognitionMetadata, type PasteRecognition, type RecognitionConfidence, type RecognizedBlock } from './pasteImport';

const TITLE_KEYS = /^(?:title|credit|author|authors|source|draft date|date|contact|copyright|notes)\s*:/i;
const LATIN_CHARACTER = /^[A-ZÀ-ÖØ-Þ0-9 ._'’\-]{2,48}(?:\s*\([^)]{1,40}\))?\^?$/;
const TRANSITION_TO = /(?:^|[\s.])(?:CUT|FADE|DISSOLVE|SMASH CUT|MATCH CUT)\s+TO:\s*$/i;

function clean(value: string): string {
  return (value ?? '').replace(/\u00a0/g, ' ').trim();
}

function block(elementType: ScreenplayElement, text: string, confidence: RecognitionConfidence, reason: string): RecognizedBlock {
  return { id: newId('recognition'), elementType, text: clean(text), confidence, reason };
}

function splitCue(value: string): { name: string; extension: string } {
  let text = clean(value).replace(/^@/, '').replace(/\^$/, '').trim();
  const match = text.match(/^(.+?)\s*(\([^)]{1,60}\))\s*$/);
  if (!match) return { name: text, extension: '' };
  return { name: clean(match[1]), extension: clean(match[2]) };
}

function isKnownCharacter(line: string, characters: Character[]): string | null {
  const q = clean(line).replace(/^@/, '').replace(/\^$/, '').replace(/\s*\([^)]*\)\s*$/, '').toLocaleLowerCase();
  const found = characters.find((character) => character.name.trim().toLocaleLowerCase() === q);
  return found?.name ?? null;
}

function isSceneHeading(line: string): boolean {
  const t = clean(line);
  if (!t) return false;
  if (t.startsWith('.') && !t.startsWith('..')) return true;
  return recognizeSceneHeading(t).isHeading;
}

function normalizedHeading(line: string): string {
  let t = clean(line);
  if (t.startsWith('.') && !t.startsWith('..')) t = clean(t.slice(1));
  // Fountain scene numbers are written at the end: INT. ROOM - DAY #12#
  t = t.replace(/\s+#(?:[^#\n]+)#\s*$/, '').trim();
  return stripSceneHeadingNumber(t);
}

function isTransition(line: string): boolean {
  const t = clean(line);
  if (!t) return false;
  if (t.startsWith('>') && !t.endsWith('<')) return true;
  return TRANSITION_TO.test(t) || /^[A-ZÀ-ÖØ-Þ0-9 ._'’\-]+TO:\s*$/.test(t);
}

function transitionText(line: string): string {
  return clean(line).replace(/^>\s*/, '').trim();
}

function isCharacterCue(line: string, characters: Character[], nextLine: string, previousBlank: boolean): { yes: boolean; name: string; extension: string; reason: string } {
  const t = clean(line);
  if (!t || isSceneHeading(t) || isTransition(t)) return { yes: false, name: '', extension: '', reason: '' };

  const forced = t.startsWith('@');
  const known = isKnownCharacter(t, characters);
  const latin = LATIN_CHARACTER.test(t);

  // In Fountain, a character cue starts a dialogue block. For Arabic, where
  // uppercase is unavailable, @ remains the unambiguous Fountain marker;
  // project character names are also accepted when followed by dialogue.
  const hasFollowingDialogue = !!nextLine && !nextLine.startsWith('#') && !nextLine.startsWith('=');
  if (!(forced || known || (latin && previousBlank)) || !hasFollowingDialogue) {
    return { yes: false, name: '', extension: '', reason: '' };
  }

  const cue = splitCue(t);
  if (known) cue.name = known;

  return {
    yes: true,
    name: cue.name,
    extension: cue.extension,
    reason: forced ? 'تسمية شخصية مفروضة بعلامة @ في Fountain' : known ? 'اسم شخصية معروف في المشروع' : 'تسمية شخصية قياسية بحروف كبيرة في Fountain'
  };
}

export function recognizeFountainScreenplay(rawText: string, characters: Character[] = [], _locations: Location[] = []): PasteRecognition {
  const lines = rawText.replace(/\r\n?/g, '\n').replace(/\u2028|\u2029/g, '\n').split('\n');
  const blocks: RecognizedBlock[] = [];
  const warnings: string[] = [];

  let inBoneyard = false;
  let inDialogue = false;
  let seenBody = false;
  let ignoredTitleLines = 0;
  let previousBlank = true;

  const nextContentLine = (from: number): string => {
    for (let i = from + 1; i < lines.length; i += 1) {
      const t = clean(lines[i]);
      if (!t) continue;
      if (t.startsWith('/*')) continue;
      return t;
    }
    return '';
  };

  for (let i = 0; i < lines.length; i += 1) {
    let line = clean(lines[i]);

    if (inBoneyard) {
      if (line.includes('*/')) inBoneyard = false;
      previousBlank = true;
      continue;
    }
    if (line.startsWith('/*')) {
      if (!line.includes('*/') || line.indexOf('*/') < line.indexOf('/*')) inBoneyard = true;
      previousBlank = true;
      continue;
    }

    if (!line) {
      previousBlank = true;
      inDialogue = false;
      continue;
    }

    if (!seenBody && TITLE_KEYS.test(line)) {
      ignoredTitleLines += 1;
      previousBlank = false;
      continue;
    }

    // Fountain comments, sections, synopsis lines and explicit page breaks are
    // project/planning markup, not screenplay blocks in Scene Writer.
    if (/^\[\[.*\]\]$/.test(line) || /^#+\s*/.test(line) || /^=\s*/.test(line) || /^={3,}$/.test(line)) {
      previousBlank = false;
      continue;
    }

    if (isSceneHeading(line)) {
      const heading = normalizedHeading(line);
      const confidence = recognizeSceneHeading(heading).isHeading ? 'high' : 'medium';
      blocks.push(block('scene_heading', heading, confidence, line.startsWith('.') ? 'عنوان مشهد مفروض بعلامة النقطة في Fountain' : 'عنوان مشهد قياسي في Fountain'));
      seenBody = true;
      inDialogue = false;
      previousBlank = false;
      continue;
    }

    if (isTransition(line)) {
      blocks.push(block('transition', transitionText(line), 'high', 'انتقال صريح في Fountain'));
      seenBody = true;
      inDialogue = false;
      previousBlank = false;
      continue;
    }

    const cue = isCharacterCue(line, characters, nextContentLine(i), previousBlank);
    if (cue.yes) {
      blocks.push(block('character', cue.name, 'high', cue.reason));
      if (cue.extension) {
        blocks.push(block('parenthetical', cue.extension, 'high', 'امتداد صوت/أداء ملحق باسم الشخصية في Fountain'));
      }
      seenBody = true;
      inDialogue = true;
      previousBlank = false;
      continue;
    }

    if (inDialogue && /^\([^)]*\)$/.test(line)) {
      blocks.push(block('parenthetical', line, 'high', 'حالة مكتوبة بين قوسين داخل حوار Fountain'));
      previousBlank = false;
      continue;
    }

    if (inDialogue) {
      blocks.push(block('dialogue', line.replace(/^\\/, ''), 'high', 'حوار داخل كتلة شخصية في Fountain'));
      previousBlank = false;
      continue;
    }

    // Centered text >TEXT< is kept as a direction rather than discarded.
    if (/^>.*<$/.test(line)) {
      blocks.push(block('direction', line.replace(/^>\s*/, '').replace(/\s*<$/, ''), 'medium', 'نص مركزي في Fountain؛ عومل كتوجيه قابل للمراجعة'));
      seenBody = true;
      previousBlank = false;
      continue;
    }

    // Lyrics and forced action are narrative content for Scene Writer.
    if (line.startsWith('!')) line = clean(line.slice(1));
    if (line.startsWith('~')) line = clean(line.slice(1));
    line = line.replace(/^\\(?=[@.!#=~>])/u, '');

    blocks.push(block('action', line, 'medium', 'نص سردي/فعل افتراضي من Fountain'));
    seenBody = true;
    previousBlank = false;
  }

  const sceneCount = blocks.filter((item) => item.elementType === 'scene_heading').length;
  if (ignoredTitleLines) warnings.push(`تم تجاهل ${ignoredTitleLines} سطرًا من صفحة عنوان Fountain لأنها ليست من متن السيناريو.`);
  if (!sceneCount && blocks.length) warnings.push('لم يُعثر على عنوان مشهد واضح في ملف Fountain؛ راجع المعاينة قبل الاستيراد.');

  return rebuildRecognitionMetadata({
    blocks,
    sceneCount,
    characterNames: [],
    locationNames: [],
    characterCandidates: [],
    locationCandidates: [],
    warnings
  });
}
