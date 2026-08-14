<script lang="ts">
  import { tick } from 'svelte';
  import type { Character, Location, Scene, ScreenplayBlock, ScreenplayElement } from '../lib/types';
  import { detectLang, ELEMENT_LABELS, nextOnEnter, nextOnTab, normalizeText } from '../lib/screenplayEngine';
  import { estimateFormattedPages, pageEstimateLabel } from '../lib/pageEstimate';
  import { defaultSceneTime, syncSceneHeading } from '../lib/sceneHeading';
  import { newId } from '../lib/id';

  export let scene: Scene;
  export let characters: Character[] = [];
  export let knownCharacterNames: string[] = [];
  export let locations: Location[] = [];
  export let activeBlockId = '';
  export let onChange: (scene: Scene) => void;
  export let onActive: (blockId: string) => void;
  export let onQuickAddCharacter: (name: string) => Character | null;
  export let onQuickAddLocation: (name: string, kind: Location['kind']) => Location | null;
  export let onPasteImport: (text: string) => void;
  export let embedded = false;
  export let isActiveScene = false;
  export let sceneNumber: number | null = null;

  $: displaySceneNumber = sceneNumber ?? scene.orderIndex + 1;

  const elementOrder: ScreenplayElement[] = ['action', 'action_line', 'character', 'parenthetical', 'dialogue', 'direction', 'transition'];
  const kindOptions: { value: Location['kind']; label: string }[] = [
    { value: 'INT', label: 'داخلي' },
    { value: 'EXT', label: 'خارجي' },
    { value: 'INT/EXT', label: 'داخلي/خارجي' }
  ];
  const timeOptions = ['نهار', 'ليل', 'صباح', 'مساء', 'عصراً', 'مستمر'];
  const transitionOptions = ['قطع إلى:', 'مزج إلى:', 'تلاشي إلى السواد:', 'ظهور تدريجي:', 'قطع مفاجئ إلى:', 'مطابقة قطع إلى:'];

  let suggestionIndex = 0;
  let headingSuggestionIndex = 0;
  let placeFocused = false;
  let editorNode: HTMLDivElement | null = null;

  type EditorSelection = {
    startBlockId: string;
    startOffset: number;
    endBlockId: string;
    endOffset: number;
    collapsed: boolean;
  };

  type SceneHistoryState = {
    scene: Scene;
    activeBlockId: string;
    selectionStart: number | null;
    selectionEnd: number | null;
  };

  let historySceneId = '';
  let undoStack: SceneHistoryState[] = [];
  let redoStack: SceneHistoryState[] = [];
  let isRestoringHistory = false;
  let lastHistoryKey = '';
  let lastHistoryAt = 0;

  function searchable(value: string): string {
    return value.trim().toLocaleLowerCase('ar').replace(/[ًٌٍَُِّْـ]/g, '').replace(/\s+/g, ' ');
  }

  function rankedMatches<T extends { name: string }>(items: T[], query: string): T[] {
    const q = searchable(query);
    if (!q) return items.slice(0, 6);
    return items
      .filter((item) => searchable(item.name).includes(q))
      .sort((a, b) => {
        const aStart = searchable(a.name).startsWith(q) ? 0 : 1;
        const bStart = searchable(b.name).startsWith(q) ? 0 : 1;
        return aStart - bStart || a.name.localeCompare(b.name, 'ar');
      })
      .slice(0, 6);
  }

  type CharacterSuggestion = { name: string; color: string; subtitle: string; projectCharacter: Character | null };

  function characterSuggestionPool(): CharacterSuggestion[] {
    const byName = new Map<string, CharacterSuggestion>();
    for (const character of characters) {
      const key = searchable(character.name);
      if (key) {
        byName.set(key, {
          name: character.name,
          color: character.color,
          subtitle: character.dramaticFunction || character.occupation || (character.role === 'main' ? 'رئيسية' : character.role === 'secondary' ? 'ثانوية' : 'إضافية'),
          projectCharacter: character
        });
      }
      for (const alias of (character.aliases ?? '').split(/[،,;؛|\n]+/).map((item) => item.trim()).filter(Boolean)) {
        const aliasKey = searchable(alias);
        if (!aliasKey || byName.has(aliasKey)) continue;
        byName.set(aliasKey, { name: alias, color: character.color, subtitle: `اسم بديل لـ ${character.name}`, projectCharacter: character });
      }
    }
    for (const name of knownCharacterNames) {
      const clean = name.trim();
      const key = searchable(clean);
      if (!key || byName.has(key)) continue;
      byName.set(key, { name: clean, color: '#8a8a8a', subtitle: 'موجودة في نص المشروع', projectCharacter: null });
    }
    return [...byName.values()];
  }

  function characterMatches(block: ScreenplayBlock): CharacterSuggestion[] { return rankedMatches(characterSuggestionPool(), block.text); }
  function hasExactProjectCharacter(block: ScreenplayBlock): boolean {
    const q = searchable(block.text);
    return !!q && characters.some((character) => [character.name, ...(character.aliases ?? '').split(/[،,;؛|\n]+/)].some((name) => searchable(name) === q));
  }

  function hasExactKnownCharacter(block: ScreenplayBlock): boolean {
    const q = searchable(block.text);
    return !!q && (hasExactProjectCharacter(block) || knownCharacterNames.some((name) => searchable(name) === q));
  }

  function headingBlock(): ScreenplayBlock | undefined {
    return scene.blocks.find((block) => block.elementType === 'scene_heading');
  }

  function headingMatches(): Location[] { return rankedMatches(locations, scene.scenePlace ?? ''); }
  function hasExactHeadingLocation(): boolean {
    const q = searchable(scene.scenePlace ?? '');
    return !!q && locations.some((location) => searchable(location.name) === q);
  }

  function blockTextElement(id: string): HTMLElement | null {
    if (!editorNode) return null;
    return editorNode.querySelector<HTMLElement>(`[data-block-text="${id}"]`);
  }

  function closestBlockText(node: Node | null): HTMLElement | null {
    if (!node || !editorNode) return null;
    const element = node instanceof HTMLElement ? node : node.parentElement;
    const block = element?.closest<HTMLElement>('[data-block-text]') ?? null;
    return block && editorNode.contains(block) ? block : null;
  }

  function textOffsetWithin(block: HTMLElement, node: Node, offset: number): number {
    try {
      const range = document.createRange();
      range.setStart(block, 0);
      range.setEnd(node, offset);
      return Math.max(0, Math.min(range.toString().length, block.textContent?.length ?? 0));
    } catch {
      return 0;
    }
  }

  function getEditorSelection(): EditorSelection | null {
    if (!editorNode) return null;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;
    const range = selection.getRangeAt(0);
    if (!editorNode.contains(range.startContainer) || !editorNode.contains(range.endContainer)) return null;
    const startBlock = closestBlockText(range.startContainer);
    const endBlock = closestBlockText(range.endContainer);
    if (!startBlock || !endBlock) return null;
    const startBlockId = startBlock.dataset.blockText ?? '';
    const endBlockId = endBlock.dataset.blockText ?? '';
    if (!startBlockId || !endBlockId) return null;
    return {
      startBlockId,
      startOffset: textOffsetWithin(startBlock, range.startContainer, range.startOffset),
      endBlockId,
      endOffset: textOffsetWithin(endBlock, range.endContainer, range.endOffset),
      collapsed: range.collapsed
    };
  }

  function currentSelection() {
    const selection = getEditorSelection();
    if (!selection) return { blockId: activeBlockId, start: null, end: null };
    if (selection.startBlockId !== selection.endBlockId) {
      return { blockId: selection.endBlockId, start: null, end: null };
    }
    return { blockId: selection.endBlockId, start: selection.startOffset, end: selection.endOffset };
  }

  function domPointAtOffset(root: HTMLElement, requestedOffset: number): { node: Node; offset: number } {
    const max = root.textContent?.length ?? 0;
    let remaining = Math.max(0, Math.min(requestedOffset, max));
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      const length = node.textContent?.length ?? 0;
      if (remaining <= length) return { node, offset: remaining };
      remaining -= length;
      node = walker.nextNode();
    }
    return { node: root, offset: root.childNodes.length };
  }

  async function restoreEditorSelection(selectionState: EditorSelection, scroll = false) {
    await tick();
    if (!editorNode) return;
    const startBlock = blockTextElement(selectionState.startBlockId);
    const endBlock = blockTextElement(selectionState.endBlockId);
    if (!startBlock || !endBlock) return;
    const start = domPointAtOffset(startBlock, selectionState.startOffset);
    const end = domPointAtOffset(endBlock, selectionState.endOffset);
    const range = document.createRange();
    try {
      range.setStart(start.node, start.offset);
      range.setEnd(end.node, end.offset);
    } catch {
      return;
    }
    const selection = window.getSelection();
    if (!selection) return;
    editorNode.focus({ preventScroll: true });
    selection.removeAllRanges();
    selection.addRange(range);
    if (scroll) endBlock.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  async function focusBlock(id: string, caret: 'start' | 'end' | 'preserve' = 'end', start: number | null = null, end: number | null = null) {
    await tick();
    const block = scene.blocks.find((item) => item.id === id);
    if (!block || block.elementType === 'scene_heading') return;
    const max = block.text.length;
    const selectionStart = caret === 'start' ? 0 : caret === 'preserve' && start !== null ? Math.min(start, max) : max;
    const selectionEnd = caret === 'start' ? 0 : caret === 'preserve' && end !== null ? Math.min(end, max) : selectionStart;
    await restoreEditorSelection({ startBlockId: id, startOffset: selectionStart, endBlockId: id, endOffset: selectionEnd, collapsed: selectionStart === selectionEnd }, true);
  }

  function cloneSceneState(source: Scene): SceneHistoryState {
    const selection = currentSelection();
    return {
      scene: { ...source, blocks: source.blocks.map((block) => ({ ...block })) },
      activeBlockId: selection.blockId,
      selectionStart: selection.start,
      selectionEnd: selection.end
    };
  }

  $: if (scene.id !== historySceneId) {
    historySceneId = scene.id;
    undoStack = [];
    redoStack = [];
    lastHistoryKey = '';
    lastHistoryAt = 0;
  }

  function checkpoint(key = 'structure', groupTyping = false) {
    if (isRestoringHistory) return;
    const now = Date.now();
    if (groupTyping && key === lastHistoryKey && now - lastHistoryAt < 900) {
      lastHistoryAt = now;
      return;
    }
    undoStack = [...undoStack, cloneSceneState(scene)].slice(-100);
    redoStack = [];
    lastHistoryKey = key;
    lastHistoryAt = now;
  }

  async function restoreHistory(state: SceneHistoryState) {
    isRestoringHistory = true;
    scene.heading = state.scene.heading;
    scene.sceneKind = state.scene.sceneKind;
    scene.scenePlace = state.scene.scenePlace;
    scene.sceneTime = state.scene.sceneTime;
    scene.locationId = state.scene.locationId;
    scene.blocks = state.scene.blocks.map((block) => ({ ...block }));
    scene.durationPages = state.scene.durationPages;
    onChange(scene);
    isRestoringHistory = false;
    lastHistoryKey = '';
    lastHistoryAt = 0;
    const preferred = scene.blocks.find((block) => block.id === state.activeBlockId && block.elementType !== 'scene_heading')
      ?? scene.blocks.find((block) => block.elementType !== 'scene_heading');
    if (preferred) {
      onActive(preferred.id);
      await focusBlock(preferred.id, 'preserve', state.selectionStart, state.selectionEnd);
    }
  }

  function undo() {
    const previous = undoStack[undoStack.length - 1];
    if (!previous) return;
    redoStack = [...redoStack, cloneSceneState(scene)].slice(-100);
    undoStack = undoStack.slice(0, -1);
    restoreHistory(previous);
  }

  function redo() {
    const next = redoStack[redoStack.length - 1];
    if (!next) return;
    undoStack = [...undoStack, cloneSceneState(scene)].slice(-100);
    redoStack = redoStack.slice(0, -1);
    restoreHistory(next);
  }

  function commitHeading() {
    const q = searchable(scene.scenePlace ?? '');
    const exactLocation = q ? locations.find((location) => searchable(location.name) === q) : undefined;
    scene.locationId = exactLocation?.id ?? scene.locationId ?? null;
    if (!exactLocation && scene.locationId) {
      const linked = locations.find((location) => location.id === scene.locationId);
      if (!linked || searchable(linked.name) !== q) scene.locationId = null;
    }
    syncSceneHeading(scene);
    scene.durationPages = estimateFormattedPages(scene.blocks);
    onChange(scene);
  }

  function activateHeading() {
    const block = headingBlock();
    if (block) onActive(block.id);
  }

  function setHeadingKind(kind: Location['kind']) {
    checkpoint('heading-kind');
    scene.sceneKind = kind;
    commitHeading();
  }

  function setHeadingPlace(value: string) {
    checkpoint('heading-place', true);
    scene.scenePlace = value;
    headingSuggestionIndex = 0;
    commitHeading();
  }

  function applyHeadingLocation(location: Location) {
    checkpoint('heading-location');
    scene.locationId = location.id;
    scene.scenePlace = location.name;
    scene.sceneKind = scene.sceneKind ?? location.kind;
    scene.sceneTime = scene.sceneTime || defaultSceneTime(location);
    headingSuggestionIndex = 0;
    commitHeading();
  }

  function addHeadingLocation() {
    const name = (scene.scenePlace ?? '').trim();
    if (!name || !scene.sceneKind) return;
    const location = onQuickAddLocation(name, scene.sceneKind);
    if (location) applyHeadingLocation(location);
  }

  function setHeadingTime(time: string, groupTyping = false) {
    checkpoint(groupTyping ? 'heading-time-custom' : 'heading-time', groupTyping);
    scene.sceneTime = time;
    commitHeading();
  }

  async function focusFirstContentBlock() {
    const first = scene.blocks.find((block) => block.elementType !== 'scene_heading');
    if (!first) return;
    onActive(first.id);
    await focusBlock(first.id, 'start');
  }

  function headingKeydown(event: KeyboardEvent) {
    const matches = headingMatches();
    if (event.key === 'ArrowDown' && matches.length) {
      event.preventDefault();
      headingSuggestionIndex = (headingSuggestionIndex + 1) % matches.length;
      return;
    }
    if (event.key === 'ArrowUp' && matches.length) {
      event.preventDefault();
      headingSuggestionIndex = (headingSuggestionIndex - 1 + matches.length) % matches.length;
      return;
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if ((scene.scenePlace ?? '').trim() && !hasExactHeadingLocation() && matches.length) {
        applyHeadingLocation(matches[Math.min(headingSuggestionIndex, matches.length - 1)]);
      } else {
        focusFirstContentBlock();
      }
    }
  }

  function commitBodyChange(selectionToRestore?: EditorSelection, scroll = false) {
    scene.durationPages = estimateFormattedPages(scene.blocks);
    onChange(scene);
    if (selectionToRestore) restoreEditorSelection(selectionToRestore, scroll);
  }

  function setType(block: ScreenplayBlock, type: ScreenplayElement) {
    if (type === 'scene_heading' || type === block.elementType) return;
    const selection = getEditorSelection();
    checkpoint(`type:${block.id}`);
    const previousType = block.elementType;
    let nextText = block.text;
    // الحالة تضيف القوسين للعرض/الكتابة. إذا غيّر الكاتب النوع لاحقاً
    // (مثلاً بالـ Tab حتى يصل إلى «حوار») لا ينبغي أن تبقى الأقواس
    // كجزء من نص الحوار نفسه.
    if (previousType === 'parenthetical' && type !== 'parenthetical') {
      const trimmed = nextText.trim();
      if ((trimmed.startsWith('(') && trimmed.endsWith(')')) || (trimmed.startsWith('（') && trimmed.endsWith('）'))) {
        nextText = trimmed.slice(1, -1).trim();
      }
    }
    block.elementType = type;
    block.text = normalizeText(type, nextText);
    suggestionIndex = 0;
    commitBodyChange();
    onActive(block.id);
    if (selection && selection.startBlockId === block.id && selection.endBlockId === block.id) {
      const max = block.text.length;
      restoreEditorSelection({
        startBlockId: block.id,
        startOffset: Math.min(selection.startOffset, max),
        endBlockId: block.id,
        endOffset: Math.min(selection.endOffset, max),
        collapsed: selection.collapsed
      });
    } else {
      focusBlock(block.id);
    }
  }

  function adjacentContentBlock(index: number, direction: -1 | 1): { block: ScreenplayBlock; index: number } | null {
    let cursor = index + direction;
    while (cursor >= 0 && cursor < scene.blocks.length) {
      const candidate = scene.blocks[cursor];
      if (candidate.elementType !== 'scene_heading') return { block: candidate, index: cursor };
      cursor += direction;
    }
    return null;
  }

  function insertAfter(index: number, type: ScreenplayElement, text = '') {
    checkpoint('insert-block');
    const safeType = type === 'scene_heading' ? 'action' : type;
    const newBlock: ScreenplayBlock = { id: newId('block'), elementType: safeType, text };
    scene.blocks.splice(index + 1, 0, newBlock);
    suggestionIndex = 0;
    commitBodyChange();
    onActive(newBlock.id);
    focusBlock(newBlock.id, 'start');
  }

  function removeBlock(index: number) {
    const contentCount = scene.blocks.filter((block) => block.elementType !== 'scene_heading').length;
    if (contentCount <= 1) return;
    const previous = adjacentContentBlock(index, -1) ?? adjacentContentBlock(index, 1);
    checkpoint('remove-block');
    scene.blocks.splice(index, 1);
    suggestionIndex = 0;
    commitBodyChange();
    if (previous) {
      onActive(previous.block.id);
      focusBlock(previous.block.id);
    }
  }

  function applyCharacter(block: ScreenplayBlock, character: CharacterSuggestion | Character) {
    checkpoint(`character:${block.id}`);
    block.text = character.name;
    suggestionIndex = 0;
    commitBodyChange();
    onActive(block.id);
    focusBlock(block.id);
  }

  function addTypedCharacter(block: ScreenplayBlock) {
    const name = block.text.trim();
    if (!name) return;
    const character = onQuickAddCharacter(name);
    if (character) applyCharacter(block, character);
  }

  function transitionMatches(block: ScreenplayBlock): string[] {
    const q = searchable(block.text).replace(/:$/, '');
    if (!q) return transitionOptions;
    return transitionOptions.filter((item) => searchable(item).replace(/:$/, '').includes(q));
  }

  function applyTransition(block: ScreenplayBlock, value: string) {
    checkpoint(`transition:${block.id}`);
    block.text = value;
    suggestionIndex = 0;
    commitBodyChange();
    onActive(block.id);
    focusBlock(block.id);
  }

  function suggestionKeydown(event: KeyboardEvent, block: ScreenplayBlock): boolean {
    if (block.elementType === 'character') {
      const matches = characterMatches(block);
      if (event.key === 'ArrowDown' && matches.length) {
        event.preventDefault(); suggestionIndex = (suggestionIndex + 1) % matches.length; return true;
      }
      if (event.key === 'ArrowUp' && matches.length) {
        event.preventDefault(); suggestionIndex = (suggestionIndex - 1 + matches.length) % matches.length; return true;
      }
      if (event.key === 'Enter' && !event.shiftKey && block.text.trim() && !hasExactKnownCharacter(block) && matches.length) {
        event.preventDefault(); applyCharacter(block, matches[Math.min(suggestionIndex, matches.length - 1)]); return true;
      }
    }

    if (block.elementType === 'transition') {
      const matches = transitionMatches(block);
      if (event.key === 'ArrowDown' && matches.length) {
        event.preventDefault(); suggestionIndex = (suggestionIndex + 1) % matches.length; return true;
      }
      if (event.key === 'ArrowUp' && matches.length) {
        event.preventDefault(); suggestionIndex = (suggestionIndex - 1 + matches.length) % matches.length; return true;
      }
      if (event.key === 'Enter' && !event.shiftKey && block.text.trim() && matches.length) {
        const exact = matches.find((item) => searchable(item) === searchable(block.text));
        if (!exact) {
          event.preventDefault(); applyTransition(block, matches[Math.min(suggestionIndex, matches.length - 1)]); return true;
        }
      }
    }
    return false;
  }

  function looksLikeStructuredScreenplay(text: string): boolean {
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (lines.length < 3) return false;
    const heading = lines.some((line) => /^(?:مشهد\s*\d+\s*[:：-]?\s*)?(?:INT\.?|EXT\.?|INT\/EXT|داخلي(?:\s*\/\s*خارجي)?\.?|خارجي\.?)/i.test(line));
    const transition = lines.some((line) => /^(?:CUT TO:|DISSOLVE TO:|FADE (?:IN|OUT):?|قطع إلى|مزج إلى|تلاشي إلى|ظهور تدريجي)/i.test(line));
    const knownCharacter = lines.some((line) => characters.some((character) => [character.name, ...(character.aliases ?? '').split(/[،,;؛|\n]+/)].some((name) => searchable(name) === searchable(line.replace(/[：:]$/, '')))));
    const uppercaseCharacter = lines.some((line) => /^[A-Z][A-Z0-9 ._'’-]{1,32}$/.test(line));
    return heading || transition || knownCharacter || uppercaseCharacter;
  }

  function handleStructuredPaste(event: ClipboardEvent) {
    const text = event.clipboardData?.getData('text/plain') ?? '';
    if (!text || !/[\r\n]/.test(text)) return;
    event.preventDefault();
    onPasteImport(text);
  }

  function selectedPlainText(selection: EditorSelection): string {
    const startIndex = scene.blocks.findIndex((block) => block.id === selection.startBlockId);
    const endIndex = scene.blocks.findIndex((block) => block.id === selection.endBlockId);
    if (startIndex < 0 || endIndex < 0) return '';
    if (startIndex === endIndex) {
      return scene.blocks[startIndex].text.slice(selection.startOffset, selection.endOffset);
    }
    const parts: string[] = [];
    parts.push(scene.blocks[startIndex].text.slice(selection.startOffset));
    for (let index = startIndex + 1; index < endIndex; index += 1) {
      if (scene.blocks[index].elementType !== 'scene_heading') parts.push(scene.blocks[index].text);
    }
    parts.push(scene.blocks[endIndex].text.slice(0, selection.endOffset));
    return parts.join('\n');
  }

  function replaceSelection(text: string, key = 'selection-edit', groupTyping = false): boolean {
    const selection = getEditorSelection();
    if (!selection) return false;
    const startIndex = scene.blocks.findIndex((block) => block.id === selection.startBlockId);
    const endIndex = scene.blocks.findIndex((block) => block.id === selection.endBlockId);
    if (startIndex < 0 || endIndex < 0 || startIndex > endIndex) return false;
    const startBlock = scene.blocks[startIndex];
    const endBlock = scene.blocks[endIndex];
    checkpoint(key, groupTyping);
    const before = startBlock.text.slice(0, selection.startOffset);
    const after = endBlock.text.slice(selection.endOffset);
    startBlock.text = before + text + after;
    if (endIndex > startIndex) scene.blocks.splice(startIndex + 1, endIndex - startIndex);
    const caret = before.length + text.length;
    suggestionIndex = 0;
    commitBodyChange();
    onActive(startBlock.id);
    restoreEditorSelection({ startBlockId: startBlock.id, startOffset: caret, endBlockId: startBlock.id, endOffset: caret, collapsed: true });
    return true;
  }

  function handleCopy(event: ClipboardEvent) {
    const selection = getEditorSelection();
    if (!selection || selection.collapsed) return;
    event.preventDefault();
    event.clipboardData?.setData('text/plain', selectedPlainText(selection));
  }

  function handleCut(event: ClipboardEvent) {
    const selection = getEditorSelection();
    if (!selection || selection.collapsed) return;
    event.preventDefault();
    event.clipboardData?.setData('text/plain', selectedPlainText(selection));
    replaceSelection('', 'cut-selection');
  }

  function handleEditorPaste(event: ClipboardEvent) {
    const text = event.clipboardData?.getData('text/plain') ?? '';
    if (!text) return;
    if (/[\r\n]/.test(text) && looksLikeStructuredScreenplay(text)) {
      event.preventDefault();
      onPasteImport(text);
      return;
    }
    event.preventDefault();
    replaceSelection(text.replace(/\r/g, ''), 'paste');
  }

  function syncActiveFromSelection() {
    const selection = getEditorSelection();
    if (!selection) return;
    if (selection.endBlockId !== activeBlockId) suggestionIndex = 0;
    onActive(selection.endBlockId);
  }

  function syncBlockTextsFromDom(): boolean {
    let changed = false;
    for (const block of scene.blocks) {
      if (block.elementType === 'scene_heading') continue;
      const element = blockTextElement(block.id);
      if (!element) continue;
      const text = (element.textContent ?? '').replace(/\r/g, '');
      if (text !== block.text) {
        block.text = text;
        changed = true;
      }
    }
    return changed;
  }

  function editorBeforeInput(event: InputEvent) {
    const selection = getEditorSelection();
    if (!selection) return;
    const inputType = event.inputType;
    const crossesBlocks = selection.startBlockId !== selection.endBlockId;

    if (crossesBlocks && !selection.collapsed) {
      if (inputType === 'insertText' || inputType === 'insertCompositionText') {
        event.preventDefault();
        replaceSelection(event.data ?? '', `block:${selection.startBlockId}`, true);
        return;
      }
      if (inputType.startsWith('delete')) {
        event.preventDefault();
        replaceSelection('', 'delete-selection');
        return;
      }
    }

    if (inputType === 'insertParagraph' || inputType === 'insertLineBreak') {
      event.preventDefault();
      return;
    }

    const grouped = inputType === 'insertText' || inputType === 'insertCompositionText' || inputType === 'deleteContentBackward' || inputType === 'deleteContentForward';
    checkpoint(`block:${selection.endBlockId}`, grouped);
  }

  async function editorInput() {
    const selection = getEditorSelection();
    if (!syncBlockTextsFromDom()) return;
    suggestionIndex = 0;
    scene.durationPages = estimateFormattedPages(scene.blocks);
    onChange(scene);
    if (selection) {
      onActive(selection.endBlockId);
      await restoreEditorSelection(selection);
    }
  }

  function splitBlockAtSelection() {
    const selection = getEditorSelection();
    if (!selection) return;
    const startIndex = scene.blocks.findIndex((block) => block.id === selection.startBlockId);
    const endIndex = scene.blocks.findIndex((block) => block.id === selection.endBlockId);
    if (startIndex < 0 || endIndex < 0 || startIndex > endIndex) return;
    const startBlock = scene.blocks[startIndex];
    const endBlock = scene.blocks[endIndex];
    checkpoint('split-block');

    let left = startBlock.text.slice(0, selection.startOffset);
    const right = endBlock.text.slice(selection.endOffset);
    if (selection.startOffset >= startBlock.text.length) left = normalizeText(startBlock.elementType, left);
    startBlock.text = left;
    const newType = nextOnEnter(startBlock.elementType);
    const newBlock: ScreenplayBlock = { id: newId('block'), elementType: newType === 'scene_heading' ? 'action' : newType, text: right };

    if (endIndex > startIndex) {
      scene.blocks.splice(startIndex + 1, endIndex - startIndex, newBlock);
    } else {
      scene.blocks.splice(startIndex + 1, 0, newBlock);
    }
    suggestionIndex = 0;
    commitBodyChange();
    onActive(newBlock.id);
    focusBlock(newBlock.id, 'start');
  }

  function mergeAtBoundary(block: ScreenplayBlock, index: number, direction: -1 | 1) {
    const adjacent = adjacentContentBlock(index, direction);
    if (!adjacent) return false;
    checkpoint('merge-blocks');
    if (direction < 0) {
      const caret = adjacent.block.text.length;
      adjacent.block.text += block.text;
      scene.blocks.splice(index, 1);
      suggestionIndex = 0;
      commitBodyChange();
      onActive(adjacent.block.id);
      restoreEditorSelection({ startBlockId: adjacent.block.id, startOffset: caret, endBlockId: adjacent.block.id, endOffset: caret, collapsed: true });
    } else {
      const caret = block.text.length;
      block.text += adjacent.block.text;
      scene.blocks.splice(adjacent.index, 1);
      suggestionIndex = 0;
      commitBodyChange();
      onActive(block.id);
      restoreEditorSelection({ startBlockId: block.id, startOffset: caret, endBlockId: block.id, endOffset: caret, collapsed: true });
    }
    return true;
  }

  function blockPlaceholder(type: ScreenplayElement): string {
    if (type === 'action') return 'وصف المكان أو الجو أو الحالة البصرية';
    if (type === 'action_line') return 'فعل يحدث داخل المشهد';
    if (type === 'character') return 'اسم الشخصية';
    if (type === 'parenthetical') return '(الحالة أو طريقة الأداء)';
    if (type === 'direction') return 'توجيه أو ملاحظة تنفيذية داخل المشهد';
    if (type === 'transition') return 'اختر انتقالاً أو اكتب انتقالاً مخصصاً';
    return '';
  }

  function keydown(event: KeyboardEvent) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      if (event.shiftKey) redo(); else undo();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
      event.preventDefault();
      redo();
      return;
    }

    const selection = getEditorSelection();
    if (!selection) return;
    const block = scene.blocks.find((item) => item.id === selection.endBlockId);
    if (!block || block.elementType === 'scene_heading') return;
    const index = scene.blocks.findIndex((item) => item.id === block.id);
    if (index < 0) return;
    onActive(block.id);

    if (selection.collapsed && suggestionKeydown(event, block)) return;

    if (event.key === 'Tab') {
      event.preventDefault();
      setType(block, nextOnTab(block.elementType));
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      if (event.shiftKey) replaceSelection('\n', 'line-break');
      else splitBlockAtSelection();
      return;
    }

    if (selection.collapsed && selection.startBlockId === block.id && selection.startOffset === 0 && event.key === 'Backspace') {
      event.preventDefault();
      mergeAtBoundary(block, index, -1);
      return;
    }

    if (selection.collapsed && selection.endBlockId === block.id && selection.endOffset === block.text.length && event.key === 'Delete') {
      event.preventDefault();
      mergeAtBoundary(block, index, 1);
      return;
    }

    if ((event.ctrlKey || event.metaKey) && /^[1-7]$/.test(event.key)) {
      event.preventDefault();
      setType(block, elementOrder[Number(event.key) - 1]);
    }
  }

  function blockClass(type: ScreenplayElement): string { return `block-${type.replace('_', '-')}`; }
</script>

<div class:embedded class="paper-scroll">
  <main class:embedded class="screenplay-paper" dir="rtl">
    <div class="paper-meta">
      <span>مسودة · النسخة العربية</span>
      <span>مشهد {displaySceneNumber} · {pageEstimateLabel(scene.durationPages)}</span>
    </div>

    {#if embedded && activeBlockId !== headingBlock()?.id}
      <section class:activeScene={isActiveScene} class="scene-heading-compact" dir="rtl" on:mousedown={activateHeading} title="انقر لتحرير بيانات عنوان المشهد">
        <span class="scene-number">مشهد {displaySceneNumber}</span>
        <strong>{scene.heading || 'مشهد بلا عنوان'}</strong>
        <span class="compact-pages">{pageEstimateLabel(scene.durationPages)}</span>
      </section>
    {:else}
    <section class:active={activeBlockId === headingBlock()?.id} class="scene-metadata" dir="rtl" on:mousedown={activateHeading}>
      <div class="scene-metadata-top">
        <span class="scene-number">مشهد {displaySceneNumber}</span>
        <span class="metadata-label">عنوان المشهد</span>
        <span class="metadata-preview">{scene.heading || 'حدد نوع المشهد والمكان والزمن'}</span>
      </div>

      <div class="metadata-grid">
        <div class="metadata-field kind-field">
          <label>النوع</label>
          <div class="metadata-pills">
            {#each kindOptions as option}
              <button class:selected={scene.sceneKind === option.value} type="button" on:mousedown|preventDefault={() => setHeadingKind(option.value)}>{option.label}</button>
            {/each}
          </div>
        </div>

        <div class="metadata-field place-field">
          <label for={`scene-place-${scene.id}`}>المكان</label>
          <input
            id={`scene-place-${scene.id}`}
            value={scene.scenePlace}
            placeholder="اكتب أو اختر مكاناً"
            autocomplete="off"
            on:focus={() => { activateHeading(); placeFocused = true; headingSuggestionIndex = 0; }}
            on:blur={() => setTimeout(() => placeFocused = false, 120)}
            on:input={(e) => setHeadingPlace((e.currentTarget as HTMLInputElement).value)}
            on:keydown={headingKeydown}
            on:paste={handleStructuredPaste}
          />
          {#if placeFocused}
            <div class="metadata-suggestions">
              {#each headingMatches() as location, matchIndex (location.id)}
                <button class:selected={matchIndex === headingSuggestionIndex} type="button" on:mousedown|preventDefault={() => applyHeadingLocation(location)}>
                  <span><b>{location.name}</b><small>{location.kind === 'INT' ? 'داخلي' : location.kind === 'EXT' ? 'خارجي' : 'داخلي/خارجي'} · {defaultSceneTime(location)}</small></span>
                  <em>اختيار</em>
                </button>
              {/each}
              {#if (scene.scenePlace ?? '').trim() && !hasExactHeadingLocation()}
                {#if scene.sceneKind}
                  <button class="create-suggestion" type="button" on:mousedown|preventDefault={addHeadingLocation}>＋ إضافة «{scene.scenePlace.trim()}» إلى الأماكن</button>
                {:else}
                  <div class="metadata-hint">حدد نوع المشهد أولاً إذا أردت إضافة هذا المكان إلى ملف المشروع.</div>
                {/if}
              {/if}
            </div>
          {/if}
        </div>

        <div class="metadata-field time-field">
          <label>الزمن</label>
          <div class="metadata-pills time-pills">
            {#each timeOptions as time}
              <button class:selected={scene.sceneTime === time} type="button" on:mousedown|preventDefault={() => setHeadingTime(time)}>{time}</button>
            {/each}
          </div>
          <input class="custom-time" value={timeOptions.includes(scene.sceneTime) ? '' : scene.sceneTime} placeholder="زمن آخر" on:focus={activateHeading} on:input={(e) => setHeadingTime((e.currentTarget as HTMLInputElement).value, true)} />
        </div>
      </div>
    </section>
    {/if}

    <div
      class="blocks continuous-editor"
      bind:this={editorNode}
      contenteditable="true"
      role="textbox"
      aria-label="نص المشهد"
      aria-multiline="true"
      spellcheck="true"
      on:beforeinput={editorBeforeInput}
      on:input={editorInput}
      on:keydown={keydown}
      on:paste={handleEditorPaste}
      on:copy={handleCopy}
      on:cut={handleCut}
      on:mouseup={syncActiveFromSelection}
      on:keyup={syncActiveFromSelection}
      on:focus={syncActiveFromSelection}
    >
      {#each scene.blocks as block, index (block.id)}
        {#if block.elementType !== 'scene_heading'}
          <div class:active={block.id === activeBlockId} class={`screenplay-block ${blockClass(block.elementType)}`} data-block-id={block.id} dir={detectLang(block.text) === 'ar' ? 'rtl' : 'ltr'}>
            {#if block.id === activeBlockId}
              <div class="block-label" dir="rtl" contenteditable="false">
                <span>{ELEMENT_LABELS[block.elementType]}</span>
                <div class="type-menu">
                  {#each elementOrder as type, typeIndex}
                    <button type="button" tabindex="-1" class:current={type === block.elementType} on:mousedown|preventDefault={() => setType(block, type)} title={`Ctrl/Cmd + ${typeIndex + 1}`}>
                      {ELEMENT_LABELS[type]}
                    </button>
                  {/each}
                </div>
              </div>
            {/if}

            <div
              class="block-text"
              data-block-text={block.id}
              data-placeholder={blockPlaceholder(block.elementType)}
              aria-label={ELEMENT_LABELS[block.elementType]}
            >{block.text}</div>

            {#if block.id === activeBlockId && block.elementType === 'character'}
              <div class="inline-suggestions character-suggestions" dir="rtl" contenteditable="false">
                <div class="suggestion-title"><span>شخصيات المشروع</span><small>اكتب جزءاً من الاسم</small></div>
                {#each characterMatches(block) as character, matchIndex (character.name)}
                  <button type="button" tabindex="-1" class:selected={matchIndex === suggestionIndex} on:mousedown|preventDefault={() => applyCharacter(block, character)}>
                    <i style={`background:${character.color}`}></i>
                    <span><b>{character.name}</b><small>{character.subtitle}</small></span>
                    <em>اختيار</em>
                  </button>
                {/each}
                {#if block.text.trim() && !hasExactProjectCharacter(block)}
                  <button type="button" tabindex="-1" class="create-suggestion" on:mousedown|preventDefault={() => addTypedCharacter(block)}>＋ إضافة «{block.text.trim()}» إلى ملف المشروع</button>
                {/if}
              </div>
            {/if}

            {#if block.id === activeBlockId && block.elementType === 'transition'}
              <div class="inline-suggestions transition-suggestions" dir="rtl" contenteditable="false">
                <div class="suggestion-title"><span>انتقالات قياسية</span><small>اختر أو اكتب انتقالاً مخصصاً</small></div>
                <div class="transition-grid">
                  {#each transitionMatches(block) as item, matchIndex}
                    <button type="button" tabindex="-1" class:selected={matchIndex === suggestionIndex} on:mousedown|preventDefault={() => applyTransition(block, item)}>{item}</button>
                  {/each}
                </div>
              </div>
            {/if}
          </div>
        {/if}
      {/each}
    </div>

    {#if !embedded}<div class="paper-footer">تحرير السيناريو · صفحة تحرير متصلة · Enter عنصر جديد · Tab تغيير النوع · Shift+Enter سطر داخلي · Ctrl+Z تراجع</div>{/if}
  </main>
</div>


<style>
  .paper-scroll { flex:1; min-height:0; overflow:auto; padding:36px 40px 90px; background:var(--bg); }
  .screenplay-paper { width:min(760px, calc(100vw - 650px)); min-width:620px; min-height:1080px; height:max-content; overflow:visible; margin:0 auto; background:var(--page); color:var(--ink); border-radius:3px; box-shadow:0 10px 32px rgba(0,0,0,.14), 0 0 0 1px #d6d6d6; padding:58px 78px 70px; position:relative; }
  .paper-scroll.embedded { flex:none; min-height:0; overflow:visible; padding:0; background:transparent; }
  .screenplay-paper.embedded { width:auto; min-width:0; min-height:0; margin:0; padding:0; background:transparent; box-shadow:none; border-radius:0; }
  .screenplay-paper.embedded .paper-meta { display:none; }
  .paper-meta { display:flex; justify-content:space-between; color:#666666; font-size:11.5px; border-bottom:1px solid #dddddd; padding-bottom:11px; margin-bottom:40px; }
  .scene-heading-compact { position:relative; display:flex; align-items:center; gap:10px; margin:0 0 18px; padding:9px 11px; border-radius:7px; border:1px solid transparent; cursor:pointer; font-family:"Cairo","Segoe UI",sans-serif; transition:.14s ease; }
  .scene-heading-compact:hover { background:#f7f9fc; border-color:#dbe3ee; }
  .scene-heading-compact.activeScene { background:#f5f9ff; border-color:rgba(24,90,189,.22); }
  .scene-heading-compact strong { min-width:0; flex:1; color:#17191c; font-size:14px; font-weight:800; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .scene-heading-compact .scene-number { padding:0; color:#185abd; font-size:12px; }
  .compact-pages { color:#7a7a7a; font-size:10px; white-space:nowrap; }
  .blocks { display:flex; flex-direction:column; gap:0; outline:none; user-select:text; caret-color:#17191c; }
  .screenplay-block { position:relative; border-radius:4px; transition:background .12s ease, box-shadow .12s ease; margin:0; padding:1px 0; }
  .screenplay-block.active { background:transparent; box-shadow:none; }
  .screenplay-block.active::after { content:""; position:absolute; right:-11px; top:8px; width:2px; height:18px; border-radius:2px; background:rgba(24,90,189,.55); }
  .block-text { display:block; width:100%; box-sizing:border-box; overflow-wrap:anywhere; white-space:pre-wrap; border:0; outline:none; background:transparent; color:#17191c; padding:4px 7px; min-height:26px; font-family:"Amiri", "Noto Naskh Arabic", "Segoe UI", serif; font-size:17px; line-height:1.78; cursor:text; }
  .block-text:empty::before { content:attr(data-placeholder); color:#a6a6a6; pointer-events:none; }
  .block-scene-heading { margin-top:16px; margin-bottom:16px; }
  .scene-heading-row { display:flex; align-items:flex-start; gap:8px; direction:rtl; }
  .scene-number { flex:0 0 auto; padding:5px 7px 4px 0; font-family:"Cairo", "Segoe UI", sans-serif; font-size:14px; line-height:1.65; font-weight:850; color:#17191c; white-space:nowrap; }
  .scene-heading-row .block-text { flex:1 1 auto; min-width:0; }
  .block-scene-heading .block-text { font-weight:800; font-size:16.5px; line-height:1.65; letter-spacing:.01em; }
  .block-action { margin-bottom:7px; }
  .block-action .block-text { text-align:justify; }
  .block-action-line { margin:1px 0 7px; }
  .block-action-line .block-text { text-align:right; font-weight:600; }
  .block-character { width:62%; margin:14px auto 0; }
  .block-character .block-text { text-align:center; font-family:"Cairo", "Segoe UI", sans-serif; font-weight:800; font-size:15px; padding-bottom:0; }
  .block-dialogue { width:67%; margin:0 auto 8px; }
  .block-dialogue .block-text { text-align:right; font-size:16.5px; line-height:1.72; font-weight:700; }
  .block-parenthetical { width:58%; margin:0 auto; }
  .block-parenthetical .block-text { text-align:center; font-size:14px; font-style:italic; color:#404040; padding-top:1px; padding-bottom:1px; }
  .block-direction { width:100%; margin:6px 0 9px; }
  .block-direction .block-text { text-align:right; font-size:15px; line-height:1.7; font-style:normal; font-weight:400; text-decoration:underline; text-underline-offset:3px; color:#333; padding-right:7px; padding-left:7px; }
  .block-transition { width:68%; margin:17px 0 12px auto; }
  .block-transition .block-text { text-align:left; font-family:"Cairo", sans-serif; font-size:13px; font-weight:750; }
  .block-label { position:absolute; right:calc(100% + 13px); top:2px; display:flex; align-items:center; gap:7px; z-index:7; white-space:nowrap; }
  .block-label > span { background:#eef4fb; color:#185abd; border:1px solid rgba(24,90,189,.24); border-radius:6px; padding:3px 7px; font-family:Inter, sans-serif; font-size:9.5px; box-shadow:0 6px 18px rgba(0,0,0,.12); }
  .type-menu { position:absolute; right:0; top:24px; display:none; width:120px; padding:5px; background:#ffffff; border:1px solid #d0d0d0; border-radius:9px; box-shadow:0 12px 35px rgba(0,0,0,.20); }
  .block-label:hover .type-menu { display:grid; }
  .type-menu button { border:0; background:transparent; color:#666666; font-size:10px; padding:7px 7px; border-radius:5px; text-align:right; }
  .type-menu button:hover, .type-menu button.current { background:#e9eff8; color:#185abd; }

  .inline-suggestions { position:absolute; z-index:6; top:calc(100% + 5px); right:0; width:min(330px, 88%); background:#fff; border:1px solid #c9c9c9; border-radius:9px; padding:6px; box-shadow:0 10px 28px rgba(0,0,0,.16); font-family:"Segoe UI", Tahoma, sans-serif; }
  .character-suggestions { right:50%; transform:translateX(50%); width:min(300px, 100%); }
  .transition-suggestions { right:auto; left:0; width:min(360px, 92%); }
  .transition-grid { display:grid; grid-template-columns:1fr 1fr; gap:5px; padding:3px; }
  .transition-grid button { border:1px solid #d4d4d4; background:#f8f8f8; color:#333; border-radius:6px; padding:7px 8px; font-size:10px; text-align:right; }
  .transition-grid button:hover, .transition-grid button.selected { border-color:#8aaee0; background:#eaf2fb; color:#185abd; }
  .suggestion-title { display:flex; justify-content:space-between; gap:10px; align-items:center; padding:4px 6px 6px; border-bottom:1px solid #ececec; margin-bottom:3px; color:#444; }
  .suggestion-title span { font-weight:700; font-size:10.5px; }
  .suggestion-title small { color:#777; font-size:9px; }
  .inline-suggestions > button:not(.create-suggestion) { width:100%; display:flex; align-items:center; gap:8px; border:0; border-radius:6px; padding:7px 8px; background:transparent; color:#242424; text-align:right; }
  .inline-suggestions > button:not(.create-suggestion):hover, .inline-suggestions > button.selected { background:#eaf2fb; color:#185abd; }
  .inline-suggestions button i { width:8px; height:8px; flex:0 0 auto; border-radius:999px; }
  .inline-suggestions button span { flex:1; min-width:0; }
  .inline-suggestions button b { display:block; font-size:11px; }
  .inline-suggestions button small { display:block; color:#707070; font-size:9.5px; margin-top:1px; }
  .inline-suggestions button em { font-style:normal; font-size:9px; color:#707070; }
  .create-suggestion { width:100%; border:0; background:#f7f7f7; color:#185abd; border-radius:6px; padding:7px 8px; text-align:right; font-size:10.5px; margin-top:3px; }
  .create-suggestion:hover { background:#eaf2fb; }
  .kind-row, .time-row { display:flex; align-items:center; gap:4px; flex-wrap:wrap; border-top:1px solid #ececec; margin-top:5px; padding:6px 5px 1px; }
  .kind-row > span, .time-row > span { color:#666; font-size:9.5px; margin-left:2px; font-weight:700; }
  .kind-row button, .time-row button { border:1px solid #d5d5d5; background:#f7f7f7; color:#444; border-radius:5px; padding:3px 6px; font-size:9px; }
  .kind-row button:hover, .time-row button:hover { border-color:#185abd; color:#185abd; background:#eef4fb; }

  .kind-row button.selected { background:var(--accent); border-color:var(--accent); color:#fff; font-weight:800; }
  .paper-footer { position:absolute; bottom:24px; right:0; left:0; text-align:center; font-size:10.5px; color:#707070; letter-spacing:.01em; }
  @media(max-width:1200px){ .screenplay-paper{ width:min(720px, calc(100vw - 540px)); min-width:570px; padding-left:62px; padding-right:62px; } }
  @media(max-width:1000px){ .screenplay-paper{ width:min(760px, calc(100vw - 290px)); min-width:560px; } }
  @media(max-width:900px){ .paper-scroll{ padding:24px 18px 70px; } .screenplay-paper{ width:min(760px, 100%); min-width:0; padding:48px 50px 65px; } .block-label{ right:auto; left:calc(100% + 8px); } }

  .scene-metadata{position:relative;margin:0 0 30px;padding:14px 15px 13px;border:1px solid #d9dde3;border-radius:10px;background:#fafbfc;transition:border-color .15s ease,box-shadow .15s ease,background .15s ease}
  .scene-metadata.active{border-color:rgba(24,90,189,.45);box-shadow:0 0 0 3px rgba(24,90,189,.07);background:#fbfdff}
  .scene-metadata-top{display:flex;align-items:baseline;gap:9px;padding-bottom:10px;margin-bottom:11px;border-bottom:1px solid #e6e8eb}
  .scene-metadata-top .scene-number{padding:0;font-size:14px;color:#17191c}
  .metadata-label{font-family:"Cairo","Segoe UI",sans-serif;font-size:10px;font-weight:750;color:#69717d}
  .metadata-preview{margin-right:auto;font-family:"Cairo","Segoe UI",sans-serif;font-size:11px;font-weight:700;color:#185abd;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:48%}
  .metadata-grid{display:grid;grid-template-columns:auto minmax(190px,1fr) auto;gap:12px;align-items:start}
  .metadata-field{position:relative;min-width:0}
  .metadata-field>label{display:block;margin:0 0 5px;font-family:"Cairo","Segoe UI",sans-serif;font-size:9.5px;font-weight:800;color:#666}
  .metadata-pills{display:flex;gap:4px;flex-wrap:wrap}
  .metadata-pills button{border:1px solid #d4d8dd;background:#fff;color:#42474f;border-radius:6px;padding:6px 8px;font-family:"Cairo","Segoe UI",sans-serif;font-size:10px;line-height:1;cursor:pointer}
  .metadata-pills button:hover{border-color:#185abd;color:#185abd;background:#eef4fb}
  .metadata-pills button.selected{background:#185abd;border-color:#185abd;color:#fff;font-weight:800}
  .place-field input,.custom-time{width:100%;box-sizing:border-box;border:1px solid #d4d8dd;background:#fff;color:#202327;border-radius:6px;outline:none;font-family:"Cairo","Segoe UI",sans-serif;font-size:11px;padding:6px 8px;line-height:1.3}
  .place-field input:focus,.custom-time:focus{border-color:#185abd;box-shadow:0 0 0 2px rgba(24,90,189,.08)}
  .time-field{min-width:165px}.time-pills{max-width:210px}.custom-time{margin-top:5px;max-width:120px}
  .metadata-suggestions{position:absolute;top:100%;right:0;left:0;margin-top:5px;padding:5px;background:#fff;border:1px solid #d5d9df;border-radius:8px;box-shadow:0 12px 30px rgba(0,0,0,.15);z-index:12}
  .metadata-suggestions>button:not(.create-suggestion){width:100%;display:flex;align-items:center;justify-content:space-between;gap:8px;border:0;background:transparent;border-radius:6px;padding:7px 8px;text-align:right;color:#333}
  .metadata-suggestions>button:hover,.metadata-suggestions>button.selected{background:#eef4fb;color:#185abd}
  .metadata-suggestions button span{min-width:0}.metadata-suggestions button b{display:block;font-size:11px}.metadata-suggestions button small{display:block;color:#777;font-size:9px;margin-top:1px}.metadata-suggestions button em{font-style:normal;font-size:9px;color:#777}
  .metadata-hint{padding:7px 8px;color:#7a6b4a;background:#fff9e8;border-radius:6px;font-family:"Cairo","Segoe UI",sans-serif;font-size:9px;line-height:1.5}
  @media(max-width:1100px){.metadata-grid{grid-template-columns:1fr 1.3fr}.time-field{grid-column:1/-1}.time-pills{max-width:none}.custom-time{display:inline-block;width:120px;margin-right:6px}.metadata-preview{display:none}}

</style>
