import type { Character, Location, ScreenplayElement } from './types';
import { newId } from './id';
import { recognizeSceneHeading, stripSceneHeadingNumber } from './sceneHeading';

export type RecognitionConfidence = 'high' | 'medium' | 'low';

export interface RecognizedBlock {
  id: string;
  elementType: ScreenplayElement;
  text: string;
  confidence: RecognitionConfidence;
  reason: string;
}

export interface EntityCandidate {
  name: string;
  confidence: RecognitionConfidence;
  reason: string;
}

export interface ParsedSceneHeadingEntity {
  name: string;
  kind: Location['kind'];
  timeOfDay: Location['timeOfDay'];
  confidence: RecognitionConfidence;
  reason: string;
}

export interface PasteRecognition {
  blocks: RecognizedBlock[];
  sceneCount: number;
  characterNames: string[];
  locationNames: string[];
  characterCandidates: EntityCandidate[];
  locationCandidates: EntityCandidate[];
  warnings: string[];
}

const TRANSITION = /^(?:انتقال(?:\s+إلى)?|مزج(?:\s+إلى)?|إظلام|تلاشي(?:\s+إلى\s+السواد)?|ظهور\s+تدريجي|FADE\s+IN|FADE\s+OUT|CUT\s+TO|DISSOLVE\s+TO|SMASH\s+CUT\s+TO|MATCH\s+CUT\s+TO)\s*:?\s*[.،…]*$/i;
const CUT_SIGNAL = /^قطع(?:\s+إلى)?(?:$|[\s:：.،؛…\-–—])/i;
const DIRECTION = /^(?:توجيه|ملاحظة\s+تنفيذية|SHOT|CAMERA)\s*[:：]/i;
const LATIN_CHARACTER = /^[A-ZÀ-ÖØ-Þ0-9 ._'’\-]{2,40}$/;
const SENTENCE_END = /[.!?؟؛،,:：]$/;
const ACTION_PUNCTUATION = /[،؛!?؟]/;
const RELATIONAL_OR_DESCRIPTIVE_CUE = /^(?:زوجته|زوجها|زوجة\s+.+|زوج\s+.+|ابنه|ابنته|ابنها|ابنهم|أمه|امه|أبيه|ابيه|والده|والدته|أخوه|اخوه|أخته|اخته|الرجل|المرأة|المراة|الشرطي|العامل|السائق|الطبيب|الممرضة|النادل|الحارس|الطفل|الفتاة|الشاب|العجوز)$/i;
const NEVER_CHARACTER_CUE = /^(?:لحظة|لحظة\s+صمت|صمت|قطع|مزج|انتقال|صوت\s+ناي|الشمس|المكان|الليل|النهار|الفجر|صباح|مساء)$/i;
const CHARACTER_TITLE = /^(?:ولد|الشيخ|السي|سيدي|الفقيه|الحاج|الشاب|الشابة|الرجل|المرأة|المراة|صوت|الصوت)\s+/i;
const DIALOGUE_CUE_BLACKLIST = /^(?:أنا|انا|انت|أنت|انتي|أنتي|هو|هي|هما|احنا|نحن|واش|آش|اش|علاش|علاه|فين|كيف|مالو|مالك|ياك|راه|غير|زيد|واتا|تا|ناري|العافية|والله|وحق|اللهم|بحال|جات|قال|قالك|كاين|والو|صافي|هيه|آه|اهاه|إيه|ايه|لا|لا لا|بنتي|ولدي|أوليدي|اخويا|أخويا|عمي|اعمي|أعمي)$/i;
const ARABIC_ACTION_STARTS = /^(?:يدخل|تدخل|يدخلان|يدخلون|يخرج|تخرج|يخرجان|يخرجون|ينظر|تنظر|ينظران|ينظرون|يفتح|تفتح|يغلق|تغلق|يجلس|تجلس|يجلسان|يجلسون|يقف|تقف|يقفان|يقفون|يمشي|تمشي|يمشيان|يمشون|يركض|تركض|يجري|تجري|يهرول|تهرول|يقترب|تقترب|يصل|تصل|يبتعد|تبتعد|نرى|نسمع|تظهر|يظهر|تبدو|يبدو|يتجه|تتجه|يرفع|ترفع|يضع|تضع|يصمت|تصمت|يتوقف|تتوقف|ي+توقف|يقول|تقول|يجيب|تجيب|يخاطب|تخاطب|يبصر|تبصر|أبصر|ابصر|يعلو|تعلو|يعلوها|تعلوها|يصرخ|تصرخ|يهمس|تهمس|يلحق|تلحق|لحق|يضحك|تضحك|يضحكون|يلتفت|تلتفت|يعود|تعود|ينهض|تنهض|يسارع|تسارع|يدق|تدق|يشير|تشير|يحمل|تحمل|يلقي|تلقي|يسقط|تسقط|يأخذ|تأخذ|يتقدم|تتقدم|يتجاوز|تتجاوز|يمر|تمر|يواصل|تواصل|يتابع|تتابع|يستأنف|يستانف|تستأنف|تستانف|يتكئ|تتكئ|يمد|تمد|يجمع|تجمع|يركب|تركب|ينحني|تنحني|يأمر|يامر|تأمر|ينادي|تنادي|يتطلع|تتطلع|يتفحص|تتفحص|يستدير|تستدير|يتحرك|تتحرك|يختفي|تختفي|يختفون|يتعالى|تتعالى|يبدأ|تبدأ|يبادر|تبادر|يمضي|تمضي|يواصل|تواصل)(?=\s|$|[،.؛])/;
const ACTION_VERB_NEAR_START = /(?:^|\s)(?:يدخل|تدخل|يخرج|تخرج|ينظر|تنظر|يفتح|تفتح|يغلق|تغلق|يجلس|تجلس|يقف|تقف|يمشي|تمشي|يجري|تجري|يهرول|تهرول|يقترب|تقترب|يصل|تصل|يبتعد|تبتعد|يتجه|تتجه|يرفع|ترفع|يضع|تضع|يصمت|تصمت|يتوقف|تتوقف|ي+توقف|يقول|تقول|يجيب|تجيب|يخاطب|تخاطب|يبصر|تبصر|أبصر|ابصر|يعلو|تعلو|يعلوها|تعلوها|يلحق|تلحق|لحق|يضحك|تضحك|يضحكون|يلتفت|تلتفت|يعود|تعود|ينهض|تنهض|يسارع|تسارع|يدق|تدق|يشير|تشير|يحمل|تحمل|يلقي|تلقي|يسقط|تسقط|يأخذ|تأخذ|يتقدم|تتقدم|يتجاوز|تتجاوز|يمر|تمر|يواصل|تواصل|يتابع|تتابع|يستأنف|يستانف|يتكئ|تتكئ|يمد|تمد|يجمع|تجمع|يركب|تركب|ينحني|تنحني|ينادي|تنادي|يتطلع|تتطلع|يتفحص|تتفحص|يستدير|تستدير|يتحرك|تتحرك|يختفي|تختفي|يتعالى|تتعالى|يبدأ|تبدأ|يبادر|تبادر|يمضي|تمضي)(?=\s|$|[،.؛])/;
const STATIC_DESCRIPTION_START = /^(?:حقول|حقل|خيمة|الخيمة|دوار|الدوار|طريق|الطريق|مكان|المكان|غرفة|الغرفة|بيت|البيت|حوش|الحوش|جبل|الجبل|بئر|البئر|أرض|الارض|الأرض|سماء|السماء|ليل|الليل|نهار|النهار|فجر|الفجر|صباح|المشهد|دجاجة|كلب|أشجار|اشجار|صوت|صرخة|صيحة|لحظة|صمت|أمام\s+المشهد|في\s+الخلفية)(?=\s|$|[،.؛])/;
const BARE_PARENTHETICAL = /^(?:هامس(?:اً|ا|ة)?|لاهث(?:اً|ا|ة)?|متنهّد(?:اً|ا|ة)?|متنهدا|متنهدة|مبادراً|مبادرا|مبادرة|مقاطعاً|مقاطعا|مقاطعة|مستدركاً|مستدركا|مستدركة|متضاحكاً|متضاحكا|متضاحكة|معترض(?:اً|ا|ة)?(?:\s+.+)?|مستعين(?:اً|ا|ة)?(?:\s+.+)?|ساخراً|ساخرا|ساخرة|مستنكراً|مستنكرا|مستنكرة|غاضباً|غاضبا|غاضبة|بهمس|بصوت\s+.+|من\s+خارج\s+(?:الكادر|الإطار|الاطار)|خارج\s+(?:الكادر|الإطار|الاطار)|صوت\s+داخلي|دون\s+أن\s+.+|دون\s+.+|من\s+بعد|وهو\s+.{1,70}|وهي\s+.{1,70}|وهما\s+.{1,70})$/i;
const FOOTNOTE_INLINE = /\[\\?\[\d+\\?\]\]\(#_ftn\d+\)/gi;
const FOOTNOTE_DEFINITION = /^\[\\?\[\d+\\?\]\]\(#_ftnref\d+\)/i;

function cleanLine(value: string): string {
  return (value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(FOOTNOTE_INLINE, '')
    .replace(/\*\*/g, '')
    .replace(/__/g, '')
    .replace(/[\t ]+/g, ' ')
    .trim();
}

function isIgnorableSourceLine(value: string): boolean {
  const t = cleanLine(value);
  if (!t) return false;
  if (/^(?:---+|___+|\*\*\*+)$/.test(t)) return true;
  if (FOOTNOTE_DEFINITION.test(t)) return true;
  return false;
}

function searchable(value: string): string {
  return cleanLine(value)
    .toLocaleLowerCase('ar')
    .replace(/[ًٌٍَُِّْـ]/g, '')
    .replace(/[«»"“”]/g, '')
    .replace(/\s+/g, ' ');
}

function isSceneHeading(line: string): boolean {
  return recognizeSceneHeading(cleanLine(line)).isHeading;
}

function isTransition(line: string): boolean {
  const t = cleanLine(line);
  // قاعدة أولوية عربية: وجود كلمة «قطع» في السطر يجعله انتقالاً.
  // تأتي هذه القاعدة قبل التخمين السياقي عمداً وفق قواعد الاستيراد المعتمدة.
  return CUT_SIGNAL.test(t) || TRANSITION.test(t);
}

function isDirection(line: string): boolean {
  return DIRECTION.test(cleanLine(line));
}

function isParenthetical(line: string): boolean {
  const t = cleanLine(line);
  return (t.startsWith('(') && t.endsWith(')')) || (t.startsWith('（') && t.endsWith('）'));
}

function normalizedName(value: string): string {
  return searchable(value.replace(/[:：]\s*$/, '').replace(/\s*\([^)]*\)\s*$/, ''));
}

function knownCharacterName(line: string, characters: Character[], inferredNames: Set<string>): string | null {
  const q = normalizedName(line);
  if (!q) return null;
  const projectCharacter = characters.find((character) => searchable(character.name) === q);
  if (projectCharacter) return projectCharacter.name;
  for (const inferred of inferredNames) {
    if (searchable(inferred) === q) return inferred;
  }
  return null;
}

function looksLikeDialogueFollower(line: string): boolean {
  const t = cleanLine(line);
  if (!t || isSceneHeading(t) || isTransition(t) || isDirection(t) || isParenthetical(t)) return false;
  if (t.length > 340) return false;
  if (ARABIC_ACTION_STARTS.test(t) || (STATIC_DESCRIPTION_START.test(t) && t.length > 24)) return false;
  if (/^(?:وقد|وهو|وهي|وهما|ثم|بعد\s+لحظة|أمام|خلف|عند|قرب|في\s+الخلفية)(?=\s|$|[،.؛])/.test(t) && ACTION_VERB_NEAR_START.test(t.slice(0, 120))) return false;
  return true;
}

function shortArabicNameCandidate(line: string, previousBlank: boolean, nextLine: string): { yes: boolean; confidence: RecognitionConfidence; reason: string } {
  const t = cleanLine(line).replace(/[:：]\s*$/, '');
  if (!/[\u0600-\u06ff]/.test(t)) return { yes: false, confidence: 'low', reason: '' };
  if (!nextLine) return { yes: false, confidence: 'low', reason: '' };
  const dialogueFollower = looksLikeDialogueFollower(nextLine);
  // Word screenplays often separate elements by paragraph formatting rather than
  // empty paragraphs. Do not require a physical blank line when the following
  // paragraph strongly resembles dialogue.
  if (!previousBlank && !dialogueFollower) return { yes: false, confidence: 'low', reason: '' };
  if (t.length < 2 || t.length > 34) return { yes: false, confidence: 'low', reason: '' };
  if (SENTENCE_END.test(t) || ACTION_PUNCTUATION.test(t) || ARABIC_ACTION_STARTS.test(t) || ACTION_VERB_NEAR_START.test(t) || NEVER_CHARACTER_CUE.test(t)) return { yes: false, confidence: 'low', reason: '' };
  if (/^(?:وقد|ثم|بينما|حين|عندما)(?=\s|$)/.test(t)) return { yes: false, confidence: 'low', reason: '' };
  if (/^(?:السلام\s+عليكم|وعليكم\s+السلام)(?:\s+ورحمة\s+الله(?:\s+وبركاته)?)?$/i.test(t)) return { yes: false, confidence: 'low', reason: '' };
  if (/(?:^|\s)(?:دون|وهو|وهي|وهما|بينما|حين|عندما|ثم|قبل|بعد|نحو|أمام|خلف|داخل|خارج|يرفع|ترفع|ينظر|تنظر|يقف|تقف|يجلس|تجلس|يتجه|تتجه)(?=\s|$|[،.؛])/.test(t)) return { yes: false, confidence: 'low', reason: '' };
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length < 1 || words.length > 3 || /\d/.test(t)) return { yes: false, confidence: 'low', reason: '' };
  if (/[.!…]/.test(t)) return { yes: false, confidence: 'low', reason: '' };
  if (/^وا[\u0600-\u06ff]{3,}$/.test(t)) return { yes: false, confidence: 'low', reason: '' };
  if (!/^[\u0600-\u06ff\s.'’\-]+$/.test(t)) return { yes: false, confidence: 'low', reason: '' };
  if (DIALOGUE_CUE_BLACKLIST.test(words[0])) return { yes: false, confidence: 'low', reason: '' };
  const stems = words.map((word) => searchable(word).replace(/^و(?=[\u0600-\u06ff]{2,})/, ''));
  if (stems.length > 1 && new Set(stems).size === 1) return { yes: false, confidence: 'low', reason: '' };
  // Without a physical paragraph break, accept only a single-word cue or a
  // titled multi-word cue (مثل «ولد منو» أو «الشيخ بوقطاية»). This avoids
  // turning short action phrases into speaker names while still handling soft
  // line breaks commonly found inside Word paragraphs.
  if (!previousBlank && words.length > 1 && !CHARACTER_TITLE.test(t)) return { yes: false, confidence: 'low', reason: '' };
  if (words.length > 1 && !CHARACTER_TITLE.test(t) && !dialogueFollower) return { yes: false, confidence: 'low', reason: '' };
  if (RELATIONAL_OR_DESCRIPTIVE_CUE.test(t)) return { yes: true, confidence: 'low', reason: 'تسمية وصفية قد تكون متكلماً في النص، لكنها ليست بالضرورة شخصية مستقلة' };
  return {
    yes: true,
    confidence: previousBlank ? 'medium' : 'medium',
    reason: previousBlank
      ? 'سطر عربي قصير مستقل قبل كلام؛ يرجح أنه اسم متكلم'
      : 'سطر عربي قصير يليه كلام مباشر؛ اعتُبر اسم متكلم حتى دون سطر فارغ'
  };
}

function looksLikeCharacterLine(
  line: string,
  previousBlank: boolean,
  nextLine: string,
  characters: Character[],
  inferredNames: Set<string>
): { yes: boolean; confidence: RecognitionConfidence; reason: string; canonicalName?: string } {
  const t = cleanLine(line);
  if (!t) return { yes: false, confidence: 'low', reason: '' };

  const known = knownCharacterName(t, characters, inferredNames);
  if (known) return { yes: true, confidence: 'high', reason: characters.some((character) => searchable(character.name) === searchable(known)) ? 'اسم موجود في ملف المشروع' : 'اسم متكرر بوضوح داخل النص المستورد', canonicalName: known };

  if (LATIN_CHARACTER.test(t) && /[A-ZÀ-ÖØ-Þ]/.test(t)) return { yes: true, confidence: 'high', reason: 'اسم شخصية مكتوب بحروف كبيرة' };
  if (/^[\u0600-\u06ff\s.'’\-]{2,34}[:：]$/.test(t) && !ACTION_PUNCTUATION.test(t.slice(0, -1))) {
    const stripped = t.replace(/[:：]\s*$/, '');
    if (RELATIONAL_OR_DESCRIPTIVE_CUE.test(stripped)) return { yes: true, confidence: 'medium', reason: 'تسمية حوار وصفية متبوعة بنقطتين؛ راجعها قبل إضافتها كشخصية' };
    return { yes: true, confidence: 'high', reason: 'اسم قصير متبوع بنقطتين' };
  }
  return shortArabicNameCandidate(t, previousBlank, nextLine);
}

function splitCharacterCueWithParenthetical(
  line: string,
  previousBlank: boolean,
  nextLine: string,
  characters: Character[],
  inferredNames: Set<string>
): { name: string; parenthetical: string; confidence: RecognitionConfidence; reason: string } | null {
  const t = cleanLine(line);
  const match = t.match(/^(.{1,42}?)\s*(\([^()]{1,80}\))\s*$/);
  if (!match) return null;
  const name = cleanLine(match[1]);
  const guess = looksLikeCharacterLine(name, previousBlank, nextLine, characters, inferredNames);
  if (!guess.yes) return null;
  return {
    name: guess.canonicalName ?? name,
    parenthetical: cleanLine(match[2]),
    confidence: guess.confidence,
    reason: `${guess.reason} مع حالة/صوت ملحقة باسم المتكلم`
  };
}

function splitInlineDialogue(
  line: string,
  characters: Character[],
  inferredNames: Set<string>
): { name: string; dialogue: string; confidence: RecognitionConfidence; reason: string } | null {
  const match = cleanLine(line).match(/^([^:：]{1,34})\s*[:：]\s*(.+)$/);
  if (!match) return null;
  const name = cleanLine(match[1]);
  const dialogue = cleanLine(match[2]);
  if (!dialogue || ACTION_PUNCTUATION.test(name) || ARABIC_ACTION_STARTS.test(name)) return null;
  const known = knownCharacterName(name, characters, inferredNames);
  const words = name.split(/\s+/).filter(Boolean);
  const nameLike = !!known || (words.length <= 4 && !SENTENCE_END.test(name) && !NEVER_CHARACTER_CUE.test(name));
  if (!nameLike) return null;
  if (known) return { name: known, dialogue, confidence: 'high', reason: 'اسم متكلم معروف قبل نقطتين' };
  if (RELATIONAL_OR_DESCRIPTIVE_CUE.test(name)) return { name, dialogue, confidence: 'medium', reason: 'تسمية حوار وصفية قبل نقطتين؛ تحتاج مراجعة' };
  return { name, dialogue, confidence: 'high', reason: 'اسم قصير قبل نقطتين' };
}

function splitKnownSpeakerWithTrailingAction(
  line: string,
  nextLine: string,
  characters: Character[],
  inferredNames: Set<string>,
  knownNames: Set<string>
): { name: string; action: string; confidence: RecognitionConfidence; reason: string } | null {
  const t = cleanLine(line);
  const next = cleanLine(nextLine);
  if (!t || !next || isSceneHeading(next) || isTransition(next) || isDirection(next) || isParenthetical(next)) return null;

  const names = [...characters.map((character) => character.name), ...inferredNames]
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = t.match(new RegExp(`^${escaped}(?=\\s)([\\s\\S]+)$`, 'i'));
    if (!match) continue;
    const action = cleanLine(match[1]);
    if (!action || action.length > 180) continue;
    const actionLike = looksLikeBareParenthetical(action)
      || /^(?:وهو|وهي|وهما|من\s+الجانب|ملتفت(?:اً|ا|ة)?|مستعين(?:اً|ا|ة)?|متضاحك(?:اً|ا|ة)?)(?=\s|$)/i.test(action)
      || /(?:^|\s)(?:متكلم(?:اً|ا|ة)?|يقول|تقول|قال|قالت|يخاطب|تخاطب|يسأل|تسأل|يصرخ|تصرخ|ينادي|تنادي)(?=\s|$|[،.؛:])/.test(action);
    if (!actionLike) continue;

    const nextGuess = looksLikeCharacterLine(next, true, '', characters, inferredNames);
    if (nextGuess.yes || looksLikeNarrativeLine(next, knownNames)) continue;

    return {
      name,
      action,
      confidence: 'high',
      reason: 'اسم متكلم معروف يتبعه فعل قصير في السطر نفسه قبل الحوار'
    };
  }
  return null;
}

function looksLikeActionLine(line: string, knownNames: Set<string>): boolean {
  const t = cleanLine(line);
  if (!t) return false;
  if (ARABIC_ACTION_STARTS.test(t)) return true;

  const firstSlice = t.slice(0, 80);
  if (ACTION_VERB_NEAR_START.test(firstSlice)) {
    const firstWords = searchable(firstSlice).split(/\s+/).slice(0, 4).join(' ');
    for (const name of knownNames) {
      const q = searchable(name);
      if (firstWords.startsWith(q) || searchable(firstSlice).startsWith(q)) return true;
    }
    if (/^(?:أمام|خلف|عند|قرب|بعد|ثم|وقد|وهو|وهي|وهما|الرجل|المرأة|الفتاة|الشاب|الرجال|الأهالي|الرعاة|كلب|دجاجة)(?=\s|$|[،.؛])/.test(t)) return true;
  }

  return false;
}

function looksLikeNarrativeLine(line: string, knownNames: Set<string>): boolean {
  const t = cleanLine(line);
  if (!t) return false;
  if (looksLikeActionLine(t, knownNames)) return true;
  if (STATIC_DESCRIPTION_START.test(t) && t.length > 28) return true;
  if (/^(?:وقد|وهو|وهي|وهما|بعد\s+لحظة|لحظة(?:\s+صمت)?|ثم)\s+/.test(t) && (ACTION_VERB_NEAR_START.test(t.slice(0, 120)) || t.length < 90)) return true;
  if (/^(?:أمام|خلف|عند|قرب)\s+.{2,50}\s+(?:يقف|تجلس|يجلس|يدق|ينظر|تنظر|يتجه|تتجه|يظهر|تظهر)(?=\s|$|[،.؛])/.test(t)) return true;
  const normalizedStart = searchable(t.slice(0, 120));
  for (const name of knownNames) {
    const q = searchable(name);
    if (!q || !normalizedStart.startsWith(`${q} `)) continue;
    const rest = normalizedStart.slice(q.length + 1);
    if (/^(?:رجل|امرأة|المراة|المرأة|شاب|شابة|فتاة|طفل|عجوز)(?=\s|$)/.test(rest)) return true;
  }
  return false;
}

function narrativeType(line: string, knownNames: Set<string>): ScreenplayElement {
  return looksLikeActionLine(line, knownNames) ? 'action_line' : 'action';
}

function looksLikeBareParenthetical(line: string): boolean {
  const t = cleanLine(line).replace(/^\(|\)$/g, '').trim();
  return !!t && t.length <= 90 && BARE_PARENTHETICAL.test(t);
}

function parentheticalText(line: string): string {
  const t = cleanLine(line);
  if (!t) return '';
  return t.startsWith('(') && t.endsWith(')') ? t : `(${t.replace(/^\(|\)$/g, '').trim()})`;
}

function preScanInferredNames(lines: string[], characters: Character[]): Set<string> {
  const counts = new Map<string, { name: string; count: number }>();
  const existing = new Set(characters.map((character) => searchable(character.name)));

  const nextNonBlank = (from: number): string => {
    for (let i = from + 1; i < lines.length; i += 1) {
      const t = cleanLine(lines[i]);
      if (t && !isIgnorableSourceLine(t)) return t;
    }
    return '';
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = cleanLine(lines[i]);
    if (!line || isIgnorableSourceLine(line) || isSceneHeading(line) || isTransition(line) || isDirection(line) || isParenthetical(line)) continue;
    const previousBlank = i === 0 || !cleanLine(lines[i - 1]);
    const cueMatch = line.match(/^(.{1,42}?)\s*\([^()]{1,80}\)\s*$/);
    const candidateLine = cueMatch ? cleanLine(cueMatch[1]) : line;
    const guess = shortArabicNameCandidate(candidateLine, previousBlank, nextNonBlank(i));
    if (!guess.yes || guess.confidence === 'low') continue;
    const key = searchable(candidateLine);
    if (!key || existing.has(key)) continue;
    const current = counts.get(key) ?? { name: candidateLine, count: 0 };
    current.count += 1;
    counts.set(key, current);
  }

  return new Set([...counts.values()].filter((item) => item.count >= 2).map((item) => item.name));
}

export function parseSceneHeadingEntity(text: string): ParsedSceneHeadingEntity {
  const parsed = recognizeSceneHeading(cleanLine(text));
  const kind: Location['kind'] = parsed.kind ?? 'INT';
  const timeOfDay: Location['timeOfDay'] = /ليل/i.test(parsed.time)
    ? 'NIGHT'
    : /مستمر/i.test(parsed.time)
      ? 'CONTINUOUS'
      : 'DAY';

  if (!parsed.place) {
    return { name: '', kind, timeOfDay, confidence: 'low', reason: 'عنوان المشهد لا يحتوي اسماً مكانياً واضحاً' };
  }

  if (parsed.place.length > 70 || /[،؛!?؟]/.test(parsed.place)) {
    return { name: parsed.place, kind, timeOfDay, confidence: 'low', reason: 'المقطع المكاني طويل أو وصفي أكثر من كونه اسماً مختصراً' };
  }

  const confidence: RecognitionConfidence = parsed.confidence === 'high' && !!parsed.kind ? 'high' : parsed.confidence;
  return {
    name: parsed.place,
    kind,
    timeOfDay,
    confidence,
    reason: confidence === 'high' ? 'اسم مكان منفرد مستخرج من عنوان المشهد' : parsed.reason
  };
}

function pushBlock(target: RecognizedBlock[], elementType: ScreenplayElement, text: string, confidence: RecognitionConfidence, reason: string, mergeWithPrevious = true) {
  const clean = cleanLine(text);
  if (!clean) return;
  const previous = target[target.length - 1];
  if (mergeWithPrevious && previous && previous.elementType === elementType && (elementType === 'action' || elementType === 'action_line' || elementType === 'dialogue')) {
    previous.text = `${previous.text}\n${clean}`;
    if (previous.confidence === 'high' && confidence !== 'high') previous.confidence = confidence;
    return;
  }
  target.push({ id: newId('recognition'), elementType, text: clean, confidence, reason });
}

function pushSyntheticSceneStart(target: RecognizedBlock[], reason: string) {
  target.push({
    id: newId('recognition'),
    elementType: 'scene_heading',
    text: '',
    confidence: 'low',
    reason
  });
}

function uniqueCandidates(items: EntityCandidate[]): EntityCandidate[] {
  const result = new Map<string, EntityCandidate>();
  const rank: Record<RecognitionConfidence, number> = { low: 0, medium: 1, high: 2 };
  for (const item of items) {
    const key = searchable(item.name);
    if (!key) continue;
    const previous = result.get(key);
    if (!previous || rank[item.confidence] > rank[previous.confidence]) result.set(key, item);
  }
  return [...result.values()];
}

export function rebuildRecognitionMetadata(recognition: PasteRecognition): PasteRecognition {
  const characterCandidates = uniqueCandidates(recognition.blocks
    .filter((block) => block.elementType === 'character')
    .map((block) => ({ name: cleanLine(block.text), confidence: block.confidence, reason: block.reason }))
    .filter((candidate) => candidate.name));

  const locationCandidates = uniqueCandidates(recognition.blocks
    .filter((block) => block.elementType === 'scene_heading')
    .map((block) => {
      const parsed = parseSceneHeadingEntity(block.text);
      return { name: parsed.name, confidence: parsed.confidence, reason: parsed.reason };
    })
    .filter((candidate) => candidate.name));

  const warnings = recognition.warnings.filter((warning) => !warning.startsWith('هناك ') && !warning.startsWith('بعض عناوين'));
  const uncertainCharacters = characterCandidates.filter((candidate) => candidate.confidence !== 'high').length;
  const uncertainLocations = locationCandidates.filter((candidate) => candidate.confidence !== 'high').length;
  const syntheticSceneStarts = recognition.blocks.filter((block) => block.elementType === 'scene_heading' && !block.text.trim()).length;
  if (syntheticSceneStarts) warnings.push(`هناك ${syntheticSceneStarts} بداية مشهد استنتجها المحرك بعد «قطع» من دون عنوان صريح؛ أكمل بياناتها في المعاينة.`);
  if (uncertainCharacters) warnings.push(`هناك ${uncertainCharacters} تسمية شخصية محتملة لن تُضاف تلقائياً إلى ملف المشروع قبل تأكيدها.`);
  if (uncertainLocations) warnings.push(`بعض عناوين المشاهد تحتوي مواقع أو صيغاً غير مؤكدة؛ لن تُنشأ منها أماكن تلقائياً قبل المراجعة.`);

  return {
    ...recognition,
    sceneCount: recognition.blocks.filter((block) => block.elementType === 'scene_heading').length,
    characterCandidates,
    locationCandidates,
    characterNames: characterCandidates.map((candidate) => candidate.name),
    locationNames: locationCandidates.map((candidate) => candidate.name),
    warnings
  };
}

export function recognizePastedScreenplay(rawText: string, characters: Character[] = [], locations: Location[] = []): PasteRecognition {
  const normalized = rawText.replace(/\r\n?/g, '\n').replace(/\u2028|\u2029/g, '\n');
  const lines = normalized.split('\n').map((line) => line.replace(/\u00a0/g, ' '));
  const blocks: RecognizedBlock[] = [];
  const warnings: string[] = [];
  const inferredNames = preScanInferredNames(lines, characters);
  const knownNames = new Set<string>([...characters.map((character) => character.name), ...inferredNames]);

  let previousBlank = true;
  let inDialogue = false;
  let pendingSpeaker = false;
  let pendingNarrativeCount = 0;
  let forceNextScene = false;

  const nextNonBlank = (from: number): string => {
    for (let i = from + 1; i < lines.length; i += 1) {
      const t = cleanLine(lines[i]);
      if (t && !isIgnorableSourceLine(t)) return t;
    }
    return '';
  };

  for (let i = 0; i < lines.length; i += 1) {
    const rawLine = lines[i];
    const line = cleanLine(rawLine);

    if (!line) {
      previousBlank = true;
      inDialogue = false;
      continue;
    }

    if (isIgnorableSourceLine(line)) {
      previousBlank = true;
      continue;
    }

    const headingRecognition = recognizeSceneHeading(line);

    // بعد «قطع» يبدأ النص الموالي مشهداً جديداً حتى إن لم يحمل عنواناً صريحاً.
    // إذا كان السطر التالي عنواناً واضحاً فلا نضيف فاصلاً اصطناعياً آخر.
    if (forceNextScene && !headingRecognition.isHeading && !isTransition(line)) {
      pushSyntheticSceneStart(blocks, 'بداية مشهد جديدة مستنتجة من الانتقال «قطع» السابق؛ أكمل النوع/المكان/الزمن في المعاينة إن لزم.');
      forceNextScene = false;
      previousBlank = true;
      inDialogue = false;
      pendingSpeaker = false;
      pendingNarrativeCount = 0;
    }
    if (headingRecognition.isHeading) {
      pushBlock(blocks, 'scene_heading', stripSceneHeadingNumber(line), headingRecognition.confidence, headingRecognition.reason, false);
      previousBlank = false;
      inDialogue = false;
      pendingSpeaker = false;
      pendingNarrativeCount = 0;
      forceNextScene = false;
      continue;
    }

    if (isTransition(line)) {
      pushBlock(blocks, 'transition', line.replace(/\s+([.،…]+)$/u, '$1'), 'high', 'صيغة انتقال معروفة', false);
      previousBlank = false;
      inDialogue = false;
      pendingSpeaker = false;
      pendingNarrativeCount = 0;
      forceNextScene = true;
      continue;
    }

    if (/^(?:فعل|ACTION)\s*[:：]/i.test(line)) {
      pushBlock(blocks, 'action_line', line.replace(/^(?:فعل|ACTION)\s*[:：]\s*/i, ''), 'high', 'سطر موسوم صراحة كفعل');
      previousBlank = false;
      inDialogue = false;
      continue;
    }

    if (/^(?:وصف|DESCRIPTION)\s*[:：]/i.test(line)) {
      pushBlock(blocks, 'action', line.replace(/^(?:وصف|DESCRIPTION)\s*[:：]\s*/i, ''), 'high', 'سطر موسوم صراحة كوصف');
      previousBlank = false;
      inDialogue = false;
      continue;
    }

    if (isDirection(line)) {
      pushBlock(blocks, 'direction', line, 'high', 'صيغة توجيه أو ملاحظة تنفيذية');
      previousBlank = false;
      inDialogue = false;
      continue;
    }

    const inline = splitInlineDialogue(line, characters, inferredNames);
    if (inline) {
      pushBlock(blocks, 'character', inline.name, inline.confidence, inline.reason, false);
      pushBlock(blocks, 'dialogue', inline.dialogue, 'high', 'حوار في السطر نفسه بعد تسمية المتكلم');
      knownNames.add(inline.name);
      previousBlank = false;
      inDialogue = true;
      pendingSpeaker = false;
      pendingNarrativeCount = 0;
      continue;
    }

    const speakerWithTrailingAction = splitKnownSpeakerWithTrailingAction(
      line,
      nextNonBlank(i),
      characters,
      inferredNames,
      knownNames
    );
    if (speakerWithTrailingAction) {
      pushBlock(blocks, 'character', speakerWithTrailingAction.name, speakerWithTrailingAction.confidence, speakerWithTrailingAction.reason, false);
      if (looksLikeBareParenthetical(speakerWithTrailingAction.action)) {
        pushBlock(blocks, 'parenthetical', parentheticalText(speakerWithTrailingAction.action), 'medium', 'حالة أداء ملحقة باسم المتكلم في السطر نفسه', false);
      } else {
        pushBlock(blocks, narrativeType(speakerWithTrailingAction.action, knownNames), speakerWithTrailingAction.action, 'medium', 'فعل ملحق باسم المتكلم في السطر نفسه قبل الحوار', false);
      }
      knownNames.add(speakerWithTrailingAction.name);
      previousBlank = false;
      inDialogue = false;
      pendingSpeaker = true;
      pendingNarrativeCount = 1;
      continue;
    }

    // A new speaker cue must take precedence over the previous dialogue context.
    // This is especially important for forms such as "الهرادي (خارج الكادر)".
    const cueWithParenthetical = splitCharacterCueWithParenthetical(line, previousBlank, nextNonBlank(i), characters, inferredNames);
    if (cueWithParenthetical) {
      pushBlock(blocks, 'character', cueWithParenthetical.name, cueWithParenthetical.confidence, cueWithParenthetical.reason, false);
      pushBlock(blocks, 'parenthetical', parentheticalText(cueWithParenthetical.parenthetical), 'high', 'حالة أو صوت ملحق باسم المتكلم', false);
      knownNames.add(cueWithParenthetical.name);
      previousBlank = false;
      inDialogue = false;
      pendingSpeaker = true;
      pendingNarrativeCount = 0;
      continue;
    }

    // Parentheticals can occur immediately after a character cue or between two
    // lines by the same speaker. They must never be consumed as dialogue.
    if (isParenthetical(line) || ((pendingSpeaker || inDialogue) && looksLikeBareParenthetical(line))) {
      pushBlock(
        blocks,
        'parenthetical',
        parentheticalText(line),
        isParenthetical(line) ? 'high' : 'medium',
        isParenthetical(line) ? 'حالة مكتوبة بين قوسين' : 'حالة أداء قصيرة مستنتجة من موقعها بعد اسم المتكلم',
        false
      );
      previousBlank = false;
      pendingSpeaker = true;
      inDialogue = false;
      continue;
    }

    const characterGuess = looksLikeCharacterLine(line, previousBlank, nextNonBlank(i), characters, inferredNames);
    if (characterGuess.yes && (!pendingSpeaker || characterGuess.confidence === 'high')) {
      const name = characterGuess.canonicalName ?? line.replace(/[:：]\s*$/, '');
      pushBlock(blocks, 'character', name, characterGuess.confidence, characterGuess.reason, false);
      knownNames.add(name);
      previousBlank = false;
      inDialogue = false;
      pendingSpeaker = true;
      pendingNarrativeCount = 0;
      continue;
    }

    if (pendingSpeaker) {
      // Drafts may place action or description between a cue and its dialogue.
      // We accept only strong narrative signals here; otherwise the line remains dialogue.
      if (looksLikeNarrativeLine(line, knownNames) && pendingNarrativeCount < 2) {
        const type = narrativeType(line, knownNames);
        pushBlock(blocks, type, line, 'medium', type === 'action_line' ? 'فعل واضح ورد بين تسمية المتكلم وحواره' : 'وصف واضح ورد بين تسمية المتكلم وحواره');
        pendingNarrativeCount += 1;
        previousBlank = false;
        continue;
      }

      pushBlock(blocks, 'dialogue', line, 'high', pendingNarrativeCount ? 'حوار بعد فعل/وصف قصير مرتبط بالمتكلم السابق' : 'سطر يلي تسمية متكلم');
      pendingSpeaker = false;
      pendingNarrativeCount = 0;
      inDialogue = true;
      previousBlank = false;
      continue;
    }

    if (characterGuess.yes) {
      const name = characterGuess.canonicalName ?? line.replace(/[:：]\s*$/, '');
      pushBlock(blocks, 'character', name, characterGuess.confidence, characterGuess.reason, false);
      knownNames.add(name);
      previousBlank = false;
      inDialogue = false;
      pendingSpeaker = true;
      pendingNarrativeCount = 0;
      continue;
    }

    if (inDialogue) {
      if (looksLikeActionLine(line, knownNames) || (STATIC_DESCRIPTION_START.test(line) && line.length > 28)) {
        const type = narrativeType(line, knownNames);
        pushBlock(blocks, type, line, 'medium', type === 'action_line' ? 'فعل سردي واضح بعد الحوار' : 'وصف سردي واضح بعد الحوار');
        inDialogue = false;
      } else {
        pushBlock(blocks, 'dialogue', line, 'medium', 'استمرار حوار المتكلم الحالي');
      }
      previousBlank = false;
      continue;
    }

    const type = narrativeType(line, knownNames);
    pushBlock(blocks, type, line, 'medium', type === 'action_line' ? 'سطر فعل مستنتج من صياغة الحركة' : 'نص وصفي افتراضي', !previousBlank);
    previousBlank = false;
  }

  const sceneCount = blocks.filter((block) => block.elementType === 'scene_heading').length;
  if (!sceneCount && blocks.length) warnings.push('لم يُعثر على عنوان مشهد؛ يمكن إدراج العناصر في المشهد الحالي.');
  if (sceneCount > 1) warnings.push(`تم التعرف على ${sceneCount} مشهداً داخل النص؛ سيُرقمها Scene Writer تلقائياً وفق ترتيبها عند الاستيراد.`);

  const base: PasteRecognition = {
    blocks,
    sceneCount,
    characterNames: [],
    locationNames: [],
    characterCandidates: [],
    locationCandidates: [],
    warnings
  };
  const rebuilt = rebuildRecognitionMetadata(base);

  const knownLocations = new Set(locations.map((location) => searchable(location.name)));
  rebuilt.locationCandidates.sort((a, b) => Number(knownLocations.has(searchable(b.name))) - Number(knownLocations.has(searchable(a.name))));
  rebuilt.locationNames = rebuilt.locationCandidates.map((candidate) => candidate.name);
  return rebuilt;
}

export function confidenceLabel(value: RecognitionConfidence): string {
  return value === 'high' ? 'مؤكد' : value === 'medium' ? 'محتمل' : 'راجع';
}
