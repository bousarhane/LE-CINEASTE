import type { Location, Scene, ScreenplayBlock } from './types';

export interface SceneHeadingMeta {
  kind: Location['kind'] | null;
  place: string;
  time: string;
}

export type SceneHeadingConfidence = 'high' | 'medium' | 'low';

export interface SceneHeadingRecognition extends SceneHeadingMeta {
  isHeading: boolean;
  confidence: SceneHeadingConfidence;
  reason: string;
}

const KIND_PREFIX: Record<Location['kind'], string> = {
  INT: 'داخلي.',
  EXT: 'خارجي.',
  'INT/EXT': 'داخلي/خارجي.'
};

const AR_DIACRITICS = /[ًٌٍَُِّْـ]/g;
const SCENE_NUMBER_PREFIX = /^(?:المشهد|مشهد|SCENE)\s*(?:رقم\s*)?\d+\s*[:：.\-–—]?\s*/i;
const LEADING_NUMERIC_SCENE = /^\d+\s*[.)\-–—]\s*(?=(?:INT|EXT|داخلي|خارجي))/i;

function clean(value: string): string {
  return (value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/[\t ]+/g, ' ')
    .trim();
}

function normalized(value: string): string {
  return clean(value)
    .toLocaleLowerCase('ar')
    .replace(AR_DIACRITICS, '')
    .replace(/[.،,:：;؛()[\]{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function trimToken(value: string): string {
  return clean(value).replace(/^[\-–—:：.\s]+|[\-–—:：.\s]+$/g, '').trim();
}

export function stripSceneHeadingNumber(value: string): string {
  return clean(value)
    .replace(SCENE_NUMBER_PREFIX, '')
    .replace(LEADING_NUMERIC_SCENE, '')
    .trim();
}

function kindFromToken(value: string): Location['kind'] | null {
  const token = normalized(value).replace(/\s/g, '');
  if (!token) return null;

  if (
    token === 'داخلي/خارجي' || token === 'خارجي/داخلي' || token === 'داخليخارجي' || token === 'خارجيداخلي' ||
    token === 'int/ext' || token === 'ext/int' || token === 'int/ext.' || token === 'ext/int.' ||
    token === 'i/e' || token === 'i.e' || token === 'int-ext' || token === 'ext-int'
  ) return 'INT/EXT';

  if (token === 'داخلي' || token === 'int' || token === 'interior') return 'INT';
  if (token === 'خارجي' || token === 'ext' || token === 'exterior') return 'EXT';
  return null;
}

function timeFromToken(value: string): string | null {
  const token = normalized(value);
  if (!token) return null;

  if (/^(?:ليل|ليلي|ليلية|ليلا|ليلاً|night)$/.test(token)) return 'ليل';
  if (/^(?:نهار|نهاري|نهارية|نهارا|نهاراً|day)$/.test(token)) return 'نهار';
  if (/^(?:صباح|صباحي|صباحية|morning)$/.test(token)) return 'صباح';
  if (/^(?:مساء|مسائي|مسائية|evening)$/.test(token)) return 'مساء';
  if (/^(?:فجر|فجرا|فجراً|dawn)$/.test(token)) return 'فجر';
  if (/^(?:عصر|عصرا|عصراً|بعد الظهر|afternoon)$/.test(token)) return 'عصر';
  if (/^(?:مستمر|استمرار|continuous|cont)$/.test(token)) return 'مستمر';
  return null;
}

function extractKinds(tokens: string[]): Location['kind'][] {
  const kinds = tokens.map(kindFromToken).filter((value): value is Location['kind'] => !!value);
  if (kinds.includes('INT/EXT')) return ['INT/EXT'];
  if (kinds.includes('INT') && kinds.includes('EXT')) return ['INT/EXT'];
  return kinds.length ? [kinds[0]] : [];
}

function parseSlashHeading(text: string): SceneHeadingRecognition | null {
  if (!text.includes('/')) return null;
  const rawParts = text.split(/\s*\/\s*/).map(trimToken).filter(Boolean);
  if (rawParts.length < 2 || rawParts.length > 6) return null;

  const kinds = extractKinds(rawParts);
  const timeTokens = rawParts.map(timeFromToken);
  const time = timeTokens.find((value): value is string => !!value) ?? '';
  const placeParts = rawParts.filter((part) => !kindFromToken(part) && !timeFromToken(part));
  const kind = kinds[0] ?? null;

  const explicitScene = SCENE_NUMBER_PREFIX.test(clean(text));
  const structuralSignals = Number(!!kind) + Number(!!time) + Number(placeParts.length > 0);
  const isHeading = explicitScene || (!!kind && structuralSignals >= 2);
  if (!isHeading) return null;

  let confidence: SceneHeadingConfidence = 'medium';
  let reason = 'عنوان مشهد مفصول بشرطات مائلة؛ تم استخراج النوع والمكان والزمن من مواضعها.';
  if (explicitScene || (kind && time && placeParts.length === 1)) confidence = 'high';
  const kindTokenCount = rawParts.filter((part) => !!kindFromToken(part)).length;
  if (!time || placeParts.length !== 1 || kindTokenCount > 1) {
    confidence = 'medium';
    reason = kindTokenCount > 1
      ? 'العنوان يحتوي علامتي داخلي/خارجي منفصلتين؛ اعتُبر داخلي/خارجي مؤقتاً ويحتاج مراجعة.'
      : !time
        ? 'عنوان مشهد واضح، لكن الزمن غير محدد أو غير قياسي.'
        : 'عنوان مشهد واضح، لكن المكان يتكون من أكثر من جزء ويحتاج مراجعة.';
  }

  return {
    isHeading: true,
    confidence,
    reason,
    kind,
    place: placeParts.join(' / ').trim(),
    time
  };
}

function parseConventionalHeading(text: string): SceneHeadingRecognition | null {
  const combined = text.match(/^(داخلي\s*(?:\/|\-|\s+)\s*خارجي|خارجي\s*(?:\/|\-|\s+)\s*داخلي|INT\s*(?:\/|\-)\s*EXT|EXT\s*(?:\/|\-)\s*INT|INT\/EXT|EXT\/INT|I\/E)\.?\s*(.*)$/i);
  const simple = text.match(/^(داخلي|خارجي|INT|EXT)\.?\s*(.*)$/i);
  const match = combined ?? simple;
  if (!match) return null;

  const kind = kindFromToken(match[1]);
  let rest = trimToken(match[2] ?? '');
  let time = '';

  const dashParts = rest.split(/\s+[\-–—]\s+/).map(trimToken).filter(Boolean);
  if (dashParts.length > 1) {
    const possibleTime = timeFromToken(dashParts[dashParts.length - 1]);
    if (possibleTime) {
      time = possibleTime;
      dashParts.pop();
      rest = dashParts.join(' - ').trim();
    }
  }

  // Some drafts use "خارجي / المكان / ليل" but arrive here after earlier normalization.
  if (!time) {
    const endTime = rest.match(/(?:\s|[-–—])+(ليل(?:ي|ية)?|نهار(?:ي|ية)?|صباح(?:ي|ية)?|مساء(?:ي|ية)?|فجر|مستمر|NIGHT|DAY|MORNING|EVENING|DAWN|CONTINUOUS)\s*$/i);
    if (endTime) {
      time = timeFromToken(endTime[1]) ?? '';
      rest = trimToken(rest.slice(0, endTime.index));
    }
  }

  return {
    isHeading: true,
    confidence: rest ? (time ? 'high' : 'medium') : 'low',
    reason: rest
      ? (time ? 'عنوان مشهد قياسي.' : 'عنوان مشهد واضح لكن الزمن غير محدد.')
      : 'عنوان المشهد لا يحتوي مكاناً واضحاً.',
    kind,
    place: rest,
    time
  };
}

export function recognizeSceneHeading(text: string): SceneHeadingRecognition {
  const original = clean(text);
  const explicitScene = SCENE_NUMBER_PREFIX.test(original) || LEADING_NUMERIC_SCENE.test(original);
  const stripped = stripSceneHeadingNumber(original);

  const slash = parseSlashHeading(stripped);
  if (slash) {
    if (explicitScene && slash.confidence !== 'high') {
      slash.confidence = 'high';
      slash.reason = `عنوان مشهد مرقم. ${slash.reason}`;
    }
    return slash;
  }

  const conventional = parseConventionalHeading(stripped);
  if (conventional) {
    if (explicitScene && conventional.confidence !== 'high') {
      conventional.confidence = 'high';
      conventional.reason = `عنوان مشهد مرقم. ${conventional.reason}`;
    }
    return conventional;
  }

  if (explicitScene) {
    return {
      isHeading: true,
      confidence: 'medium',
      reason: 'السطر موسوم كمشهد، لكن لم يمكن استخراج النوع والمكان والزمن بثقة.',
      kind: null,
      place: stripped,
      time: ''
    };
  }

  return { isHeading: false, confidence: 'low', reason: '', kind: null, place: '', time: '' };
}

export function isLikelySceneHeading(text: string): boolean {
  return recognizeSceneHeading(text).isHeading;
}

export function parseSceneHeading(text: string): SceneHeadingMeta {
  const recognized = recognizeSceneHeading(text);
  return { kind: recognized.kind, place: recognized.place, time: recognized.time };
}

export function composeSceneHeading(meta: SceneHeadingMeta): string {
  const parts: string[] = [];
  if (meta.kind) parts.push(KIND_PREFIX[meta.kind]);
  if (meta.place.trim()) parts.push(meta.place.trim());
  let heading = parts.join(' ').trim();
  if (meta.time.trim()) heading = `${heading}${heading ? ' - ' : ''}${meta.time.trim()}`;
  return heading;
}

export function defaultSceneTime(location: Location): string {
  return location.timeOfDay === 'NIGHT' ? 'ليل' : location.timeOfDay === 'CONTINUOUS' ? 'مستمر' : 'نهار';
}

export function ensureSceneHeadingMetadata(scene: Scene): Scene {
  const legacyHeading = scene.heading || scene.blocks?.find((block) => block.elementType === 'scene_heading')?.text || '';
  const parsed = parseSceneHeading(legacyHeading);
  scene.sceneKind = scene.sceneKind || parsed.kind;
  scene.scenePlace = scene.scenePlace || parsed.place;
  scene.sceneTime = scene.sceneTime || parsed.time;
  syncSceneHeading(scene);
  return scene;
}

export function syncSceneHeading(scene: Scene): void {
  const meta: SceneHeadingMeta = {
    kind: scene.sceneKind ?? null,
    place: scene.scenePlace ?? '',
    time: scene.sceneTime ?? ''
  };
  const heading = composeSceneHeading(meta);
  scene.heading = heading;

  let headingBlock = scene.blocks?.find((block) => block.elementType === 'scene_heading');
  if (!headingBlock) {
    headingBlock = { id: `heading-${scene.id}`, elementType: 'scene_heading', text: heading } as ScreenplayBlock;
    scene.blocks = [headingBlock, ...(scene.blocks ?? [])];
  } else {
    headingBlock.text = heading;
    const index = scene.blocks.indexOf(headingBlock);
    if (index > 0) {
      scene.blocks.splice(index, 1);
      scene.blocks.unshift(headingBlock);
    }
  }
}
