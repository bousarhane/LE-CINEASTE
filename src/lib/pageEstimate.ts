import type { ScreenplayBlock, ScreenplayElement } from './types';

/**
 * Relative screenplay page estimate.
 *
 * Scene Writer deliberately does not try to predict real screen time. The only
 * time reference shown to the writer is the conventional rough rule:
 *   1 formatted screenplay page ≈ 1 minute.
 *
 * This estimator approximates how much vertical space the current editor
 * formatting occupies. It accounts for narrower dialogue/character blocks and
 * the extra vertical spacing around headings/transitions. It is intentionally
 * simple, deterministic and local.
 */

const PAGE_LINE_UNITS = 30;

type ElementLayout = {
  lineCapacity: number;
  lineWeight: number;
  spacingBefore: number;
  spacingAfter: number;
};

const LAYOUT: Record<ScreenplayElement, ElementLayout> = {
  scene_heading: { lineCapacity: 58, lineWeight: 0.92, spacingBefore: 0.55, spacingAfter: 0.55 },
  action:        { lineCapacity: 58, lineWeight: 1.00, spacingBefore: 0.00, spacingAfter: 0.24 },
  action_line:   { lineCapacity: 58, lineWeight: 1.00, spacingBefore: 0.03, spacingAfter: 0.24 },
  character:     { lineCapacity: 34, lineWeight: 0.86, spacingBefore: 0.46, spacingAfter: 0.00 },
  dialogue:      { lineCapacity: 40, lineWeight: 0.96, spacingBefore: 0.00, spacingAfter: 0.27 },
  parenthetical: { lineCapacity: 34, lineWeight: 0.80, spacingBefore: 0.00, spacingAfter: 0.04 },
  direction:     { lineCapacity: 58, lineWeight: 0.92, spacingBefore: 0.20, spacingAfter: 0.30 },
  transition:    { lineCapacity: 40, lineWeight: 0.80, spacingBefore: 0.55, spacingAfter: 0.40 }
};

function stripCombiningMarks(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
    .replace(/ـ/g, '');
}

function glyphUnits(value: string): number {
  let total = 0;
  for (const char of stripCombiningMarks(value)) {
    if (/\s/u.test(char)) total += 0.45;
    else if (/[\u0600-\u06FF]/u.test(char)) total += 1.04;
    else if (/[A-Z]/.test(char)) total += 0.92;
    else if (/[a-z0-9]/.test(char)) total += 0.78;
    else total += 0.52;
  }
  return total;
}

function wrappedLineCount(text: string, capacity: number): number {
  const paragraphs = text.replace(/\r/g, '').split('\n');
  let lines = 0;

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();
    if (!trimmed) {
      // Preserve an intentional internal line break, but ignore a wholly empty
      // block elsewhere by checking text.trim() before calling this function.
      lines += 1;
      continue;
    }

    const words = trimmed.split(/\s+/).filter(Boolean);
    let current = 0;
    let paragraphLines = 1;

    for (const word of words) {
      const units = Math.max(0.5, glyphUnits(word));
      const separator = current > 0 ? 0.45 : 0;
      if (current > 0 && current + separator + units > capacity) {
        paragraphLines += Math.max(1, Math.ceil(units / capacity));
        current = units > capacity ? units % capacity : units;
      } else if (current === 0 && units > capacity) {
        paragraphLines += Math.ceil(units / capacity) - 1;
        current = units % capacity;
      } else {
        current += separator + units;
      }
    }

    lines += paragraphLines;
  }

  return Math.max(1, lines);
}

export function estimateBlockLineUnits(block: ScreenplayBlock): number {
  if (!block.text.trim()) return 0;
  const layout = LAYOUT[block.elementType];
  const wrapped = wrappedLineCount(block.text, layout.lineCapacity);
  return layout.spacingBefore + (wrapped * layout.lineWeight) + layout.spacingAfter;
}

export function estimateFormattedPages(blocks: ScreenplayBlock[]): number {
  const lineUnits = blocks.reduce((sum, block) => sum + estimateBlockLineUnits(block), 0);
  if (lineUnits <= 0) return 0;
  return Math.max(0.1, lineUnits / PAGE_LINE_UNITS);
}

export function roundedPageEstimate(blocks: ScreenplayBlock[]): number {
  return Math.round(estimateFormattedPages(blocks) * 10) / 10;
}

export function pageEstimateLabel(pages: number): string {
  const value = Math.max(0, pages).toFixed(1);
  return `${value} صفحة · ≈ ${value} دقيقة`;
}
