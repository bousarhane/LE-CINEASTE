import type { Character, Scene, ScreenplayBlock } from './types';

const ACTION_CUE = /^(?:ي|ت|ن|أ|ا)(?:دخل|خرج|نظر|فتح|غلق|جلس|قف|مشى|مشي|جرى|جري|هرول|اقترب|وصل|ابتعد|اتجه|رفع|وضع|صمت|توقف|قال|قول|جاب|خاطب|بصر|علا|صرخ|همس|لحق|ضحك|التفت|عاد|نهض|سارع|دق|شار|حمل|لقى|سقط|خذ|تقدم|جاوز|مر|واصل|تابع|استأنف|اتكأ|مد|جمع|ركب|انحنى|نادى|طلع|تفحص|استدار|تحرك|اختفى|بدأ|بادر|مضى|تراجع|خلص|ساعد|نزل|صعد|شد|ترك|رمى|دفع|سحب|جر|وقف|جلس|ركض|هرب|نام|استيقظ|استمر|حاول|رمق|حدق|ابتسم|بكى|تنهد|أشار|اشار|انصرف|أمسك|امسك|اقتاد|ركل|ضرب)(?=\s|$|[،.؛!?؟])/i;
const COMMON_ACTION_WORD = /^(?:يتراجع|تراجع|ينهض|نهض|يجري|تجري|يجريه|يساعد|يساعده|يعود|يعودون|يتخلص|يتخلص\s+بيده|ينظر|تنظر|يلتفت|تلتفت|يتجه|تتجه|يقف|تقف|يجلس|تجلس|يقترب|تقترب|يبتعد|تبتعد|يخرج|تخرج|يدخل|تدخل|يصرخ|تصرخ|يقول|تقول|يمشي|تمشي|يركض|تركض|يمسك|تمسك|يحمل|تحمل|يدفع|تدفع|يسحب|تسحب|يرفع|ترفع|يضع|تضع|يتابع|تتابع|يتوقف|تتوقف|يستدير|تستدير|يصمت|تصمت|يضحك|تضحك|يبكي|تبكي|يتنهد|تتنهد)$/i;
const DIALOGUE_OPENING = /^(?:واش|آش|اش|علاش|علاه|فين|وفين|كيف|مالك|مالو|ياك|راه|غير|زيد|أنا|انا|أنت|انت|هو|هي|احنا|نحن|لا|نعم|إيه|ايه|آه|اهاه|والله|وحق|اللهم|قال|قالك|كاين|والو|صافي)(?=\s|$)/i;
const CONNECTIVE_OR_NARRATIVE = /^(?:ثم|بعد|قبل|عند|قرب|أمام|امام|خلف|داخل|خارج|نحو|بينما|حين|عندما|وقد|وهو|وهي|وهما|مع|من|في|على)(?=\s|$)/i;
const SENTENCE_PUNCTUATION = /[،؛!?؟:：.…]/;
const GENERIC_CUE = /^(?:صوت|الصوت|رجل|الرجل|امرأة|امراة|المرأة|المراة|شاب|الشاب|شابة|الشابة|فتاة|الفتاة|طفل|الطفل|طفلة|الطفلة|رجلان|امرأتان|شخص|الشخص|أحدهم|احدهم|أحد الرجال|احد الرجال|الشاب الأول|الشاب الاول|الشاب الثاني)$/i;

function normalize(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase('ar')
    .replace(/[ًٌٍَُِّْـ]/g, '')
    .replace(/[«»"“”]/g, '')
    .replace(/\s+/g, ' ');
}

function cleanCue(value: string): string {
  return value
    .replace(/\u00a0/g, ' ')
    .replace(/[:：]\s*$/, '')
    .replace(/^[@>]+\s*/, '')
    .replace(/\s*\([^()]{1,100}\)\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function nextMeaningfulBlock(blocks: ScreenplayBlock[], startIndex: number): ScreenplayBlock | null {
  for (let index = startIndex + 1; index < blocks.length; index += 1) {
    const block = blocks[index];
    if (!block.text.trim()) continue;
    return block;
  }
  return null;
}

function nextDialogueAfterState(blocks: ScreenplayBlock[], characterIndex: number): ScreenplayBlock | null {
  const first = nextMeaningfulBlock(blocks, characterIndex);
  if (!first) return null;
  if (first.elementType === 'dialogue') return first;
  if (first.elementType !== 'parenthetical') return null;
  const parentheticalIndex = blocks.findIndex((block) => block.id === first.id);
  if (parentheticalIndex < 0) return null;
  const second = nextMeaningfulBlock(blocks, parentheticalIndex);
  return second?.elementType === 'dialogue' ? second : null;
}

function looksLikeStandaloneCharacterCue(value: string): boolean {
  const cue = cleanCue(value);
  if (!cue || cue.length < 2 || cue.length > 38) return false;
  if (!/[\u0600-\u06ffA-Za-z]/.test(cue)) return false;
  if (/\d/.test(cue) || SENTENCE_PUNCTUATION.test(cue)) return false;

  const words = cue.split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 4) return false;
  if (GENERIC_CUE.test(cue) || COMMON_ACTION_WORD.test(cue) || ACTION_CUE.test(cue)) return false;
  if (DIALOGUE_OPENING.test(cue) || CONNECTIVE_OR_NARRATIVE.test(cue)) return false;

  // A multi-word cue containing obvious prose glue is almost certainly action/dialogue,
  // not a screenplay speaker name. Keep this conservative because these names are only
  // suggestions; the writer can still add any character manually.
  if (words.length > 1 && /(?:^|\s)(?:في|من|على|إلى|الى|ثم|بعد|قبل|مع|دون|وهو|وهي|وهما)(?:\s|$)/i.test(cue)) return false;

  return true;
}

export function discoverScriptCharacterNames(scenes: Scene[], projectCharacters: Character[]): string[] {
  const projectNames = new Set(projectCharacters.flatMap((character) => [character.name, ...(character.aliases ?? '').split(/[،,;؛|\n]+/)]).map(normalize).filter(Boolean));
  const candidates = new Map<string, { name: string; count: number }>();

  for (const scene of scenes) {
    const blocks = scene.blocks ?? [];
    for (let index = 0; index < blocks.length; index += 1) {
      const block = blocks[index];
      if (block.elementType !== 'character') continue;

      const cue = cleanCue(block.text);
      const key = normalize(cue);
      if (!key || projectNames.has(key) || !looksLikeStandaloneCharacterCue(cue)) continue;

      // Do not trust the element label by itself. A discovered character must be
      // structurally followed by dialogue, optionally through a parenthetical/state.
      // This filters imported action phrases that were accidentally classified as
      // Character blocks.
      if (!nextDialogueAfterState(blocks, index)) continue;

      const current = candidates.get(key);
      if (current) current.count += 1;
      else candidates.set(key, { name: cue, count: 1 });
    }
  }

  return [...candidates.values()]
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ar'))
    .map((candidate) => candidate.name);
}
