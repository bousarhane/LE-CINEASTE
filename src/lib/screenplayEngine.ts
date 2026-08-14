import type { Lang, ScreenplayElement } from './types';

export const ELEMENT_LABELS: Record<ScreenplayElement, string> = {
  scene_heading: 'مشهد',
  action: 'وصف',
  action_line: 'فعل',
  character: 'شخصية',
  dialogue: 'حوار',
  parenthetical: 'حالة',
  direction: 'توجيه',
  transition: 'انتقال'
};

const NEXT_ON_ENTER: Record<ScreenplayElement, ScreenplayElement> = {
  scene_heading: 'action',
  action: 'action',
  action_line: 'action_line',
  character: 'dialogue',
  dialogue: 'character',
  parenthetical: 'dialogue',
  direction: 'action',
  transition: 'action'
};

const NEXT_ON_TAB: Record<ScreenplayElement, ScreenplayElement> = {
  scene_heading: 'action',
  action: 'action_line',
  action_line: 'character',
  character: 'parenthetical',
  parenthetical: 'dialogue',
  dialogue: 'direction',
  direction: 'transition',
  transition: 'action'
};

export function nextOnEnter(type: ScreenplayElement): ScreenplayElement {
  return NEXT_ON_ENTER[type] ?? 'action';
}

export function nextOnTab(type: ScreenplayElement): ScreenplayElement {
  return NEXT_ON_TAB[type] ?? 'action';
}

export function detectLang(text: string): Lang {
  return /[\u0600-\u06ff]/.test(text) ? 'ar' : 'en';
}

export function normalizeText(type: ScreenplayElement, text: string): string {
  const lang = detectLang(text);
  const t = text.trim();
  if (!t) return '';

  if (type === 'scene_heading' && lang === 'ar') {
    return t
      .replace(/^داخلي\s*\/\s*خارجي\.?\s*/i, 'داخلي/خارجي. ')
      .replace(/^داخلي\.?\s*/i, 'داخلي. ')
      .replace(/^خارجي\.?\s*/i, 'خارجي. ')
      .replace(/\s*-\s*/g, ' - ')
      .trim();
  }

  if (type === 'scene_heading' && lang === 'en') return t.toUpperCase();
  if (type === 'character' && lang === 'en') return t.toUpperCase();

  if (type === 'parenthetical') {
    let value = t;
    if (!value.startsWith('(')) value = `(${value}`;
    if (!value.endsWith(')')) value = `${value})`;
    return value;
  }

  return text;
}

// Screen time is not inferred from raw word count. Page-based reference estimates live in pageEstimate.ts.
export function detectElementType(text: string): ScreenplayElement {
  const t = text.trim();
  if (/^(INT\.|EXT\.|INT\/EXT|داخلي\s*\/\s*خارجي\.?|داخلي\.?|خارجي\.?)/i.test(t)) return 'scene_heading';
  if (/^(CUT TO:|SMASH CUT TO:|MATCH CUT TO:|DISSOLVE TO:|FADE IN:|FADE OUT:?|مزج إلى|قطع إلى|قطع مفاجئ إلى|مطابقة قطع إلى|تلاشي إلى|ظهور تدريجي)/i.test(t)) return 'transition';
  if (/^\(.+\)$/.test(t)) return 'parenthetical';
  if (/^(توجيه|ملاحظة تنفيذية|SHOT|CAMERA)\s*[:：]/i.test(t)) return 'direction';
  if (/^(فعل|ACTION)\s*[:：]/i.test(t)) return 'action_line';
  if (/^(وصف|DESCRIPTION)\s*[:：]/i.test(t)) return 'action';
  if (/^[A-Z\s.'’-]{2,30}$/.test(t)) return 'character';
  return 'action';
}

export function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;
}
