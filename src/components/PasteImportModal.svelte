<script lang="ts">
  import { onMount } from 'svelte';
  import type { Character, Location, ScreenplayElement } from '../lib/types';
  import { ELEMENT_LABELS } from '../lib/screenplayEngine';
  import { confidenceLabel, recognizePastedScreenplay, rebuildRecognitionMetadata, type PasteRecognition, type RecognizedBlock } from '../lib/pasteImport';
  import { recognizeFountainScreenplay } from '../lib/fountainImport';

  export let initialText = '';
  export let sourceKind: 'paste' | 'docx' | 'fountain' = 'paste';
  export let sourceName = '';
  export let sourceWarnings: string[] = [];
  export let autoAnalyze = false;
  export let characters: Character[] = [];
  export let locations: Location[] = [];
  export let onClose: () => void;
  export let onImport: (recognition: PasteRecognition, addEntities: boolean) => void;

  const elementTypes: ScreenplayElement[] = ['scene_heading', 'action', 'action_line', 'character', 'parenthetical', 'dialogue', 'direction', 'transition'];
  let rawText = initialText;
  let recognition: PasteRecognition | null = null;
  let addEntities = true;
  let analyzed = false;
  let paneMode: 'split' | 'source' | 'preview' = 'split';

  $: sceneStarts = recognition ? recognition.blocks.map((block, index) => ({ block, index })).filter((item) => item.block.elementType === 'scene_heading') : [];

  $: stats = recognition ? elementTypes.map((type) => ({
    type,
    count: recognition?.blocks.filter((block) => block.elementType === type).length ?? 0
  })).filter((item) => item.count > 0) : [];

  function analyze() {
    recognition = sourceKind === 'fountain'
      ? recognizeFountainScreenplay(rawText, characters, locations)
      : recognizePastedScreenplay(rawText, characters, locations);
    if (recognition && sourceWarnings.length) {
      recognition = { ...recognition, warnings: [...sourceWarnings, ...recognition.warnings] };
    }
    analyzed = true;
  }

  onMount(() => {
    if (autoAnalyze && rawText.trim()) analyze();
  });

  $: sourceTitle = sourceKind === 'docx'
    ? 'استيراد ملف Word'
    : sourceKind === 'fountain'
      ? 'استيراد ملف Fountain'
      : 'لصق والتعرّف على بنية السيناريو';

  $: sourceDescription = sourceKind === 'docx'
    ? 'استُخرج نص ملف DOCX مع الحفاظ على ترتيب الفقرات، ثم يمر عبر محرك التعرّف نفسه قبل الإدخال.'
    : sourceKind === 'fountain'
      ? 'يقرأ التطبيق علامات Fountain الصريحة أولاً، ثم يعرض العناصر للمراجعة والتصحيح قبل الاستيراد.'
      : 'الصق النص كما هو، ثم دع التطبيق يقترح نوع كل سطر قبل إدخاله إلى المحرر.';

  $: sourceHint = sourceKind === 'docx'
    ? (sourceName ? `المصدر: ${sourceName}` : 'DOCX')
    : sourceKind === 'fountain'
      ? (sourceName ? `المصدر: ${sourceName}` : 'Fountain')
      : 'يمكن اللصق من أي محرر نصي';

  function updateType(block: RecognizedBlock, value: ScreenplayElement) {
    if (!recognition) return;
    block.elementType = value;
    block.confidence = 'high';
    block.reason = 'اعتماد يدوي من الكاتب';
    recognition = rebuildRecognitionMetadata({ ...recognition, blocks: [...recognition.blocks] });
  }

  function updateText(block: RecognizedBlock, value: string) {
    if (!recognition) return;
    block.text = value;
    recognition = rebuildRecognitionMetadata({ ...recognition, blocks: [...recognition.blocks] });
  }

  function confirmBlock(block: RecognizedBlock) {
    if (!recognition) return;
    block.confidence = 'high';
    block.reason = 'اعتماد يدوي من الكاتب';
    recognition = rebuildRecognitionMetadata({ ...recognition, blocks: [...recognition.blocks] });
  }

  function jumpToBlock(id: string) {
    const target = document.getElementById(`recognition-${id}`);
    target?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  function importNow() {
    if (!recognition || !recognition.blocks.length) return;
    onImport(recognition, addEntities);
  }
</script>

<div class="modal-backdrop" dir="rtl" on:mousedown={(event) => event.currentTarget === event.target && onClose()}>
  <section class="paste-modal" on:mousedown|stopPropagation>
    <header class="modal-head">
      <div>
        <span class="eyebrow">استيراد سيناريو</span>
        <h2>{sourceTitle}</h2>
        <p>{sourceDescription}</p>
      </div>
      <div class="modal-head-actions">
        <div class="pane-mode" aria-label="حجم مساحة المراجعة">
          <button class:active={paneMode === 'source'} on:click={() => paneMode = 'source'} title="توسيع النص الأصلي">النص</button>
          <button class:active={paneMode === 'split'} on:click={() => paneMode = 'split'} title="تقسيم النافذة بين النص والمعاينة">تقسيم</button>
          <button class:active={paneMode === 'preview'} on:click={() => paneMode = 'preview'} title="توسيع المعاينة">المعاينة</button>
        </div>
        <button class="icon-button" on:click={onClose} aria-label="إغلاق">×</button>
      </div>
    </header>
    <div class="import-caution">التعرّف آلي وقد يخطئ في بعض العناصر. راجع النص والتصنيف هنا، ويمكنك مواصلة التصحيح بعد الاستيراد بأدوات المحرر.</div>

    <div class="paste-body" class:source-focus={paneMode === 'source'} class:preview-focus={paneMode === 'preview'}>
      <section class="source-pane">
        <div class="pane-title">
          <div><b>1. النص الأصلي</b><small>{sourceHint}</small></div>
          <button class="recognize-button" on:click={analyze} disabled={!rawText.trim()}>⌕ التعرّف على البنية</button>
        </div>
        <textarea class="source-text" bind:value={rawText} placeholder="الصق هنا مشهداً واحداً أو عدة مشاهد..." autofocus={sourceKind === 'paste'}></textarea>
      </section>

      <section class="preview-pane">
        <div class="pane-title preview-title">
          <div><b>2. المعاينة</b><small>يمكن تصحيح أي عنصر قبل الاستيراد</small></div>
          {#if recognition}
            <div class="summary-pill">{recognition.sceneCount || 0} مشاهد · {recognition.blocks.length} عناصر</div>
          {/if}
        </div>

        {#if !analyzed}
          <div class="empty-preview">
            <div>⌕</div>
            <b>المعاينة ستظهر هنا</b>
            <p>اضغط «التعرّف على البنية» بعد لصق النص.</p>
          </div>
        {:else if recognition && recognition.blocks.length}
          <div class="recognition-summary">
            {#each stats as item}
              <span><b>{item.count}</b> {ELEMENT_LABELS[item.type]}</span>
            {/each}
          </div>
          {#if sceneStarts.length > 1}
            <div class="scene-jump" aria-label="التنقل بين المشاهد المكتشفة">
              <span>انتقال إلى:</span>
              {#each sceneStarts as item, sceneIndex (item.block.id)}
                <button on:click={() => jumpToBlock(item.block.id)} title={item.block.text || `مشهد ${sceneIndex + 1}`}>{sceneIndex + 1}</button>
              {/each}
            </div>
          {/if}
          <div class="recognized-list">
            {#each recognition.blocks as block, index (block.id)}
              <article id={`recognition-${block.id}`} class:scene-start={block.elementType === 'scene_heading'} class="recognized-row">
                <div class="row-index">{index + 1}</div>
                <select value={block.elementType} on:change={(e) => updateType(block, (e.currentTarget as HTMLSelectElement).value as ScreenplayElement)}>
                  {#each elementTypes as type}<option value={type}>{ELEMENT_LABELS[type]}</option>{/each}
                </select>
                <textarea rows="2" value={block.text} on:input={(e) => updateText(block, (e.currentTarget as HTMLTextAreaElement).value)}></textarea>
                <button class:high={block.confidence === 'high'} class:medium={block.confidence === 'medium'} class:low={block.confidence === 'low'} class="confidence" title={block.reason} on:click={() => confirmBlock(block)}>{confidenceLabel(block.confidence)}{block.confidence === 'high' ? '' : ' · اعتماد'}</button>
              </article>
            {/each}
          </div>
        {:else}
          <div class="empty-preview warning">
            <div>!</div>
            <b>لم أجد نصاً قابلاً للاستيراد</b>
            <p>تأكد من أن النص يحتوي على أسطر فعلية، ثم أعد المحاولة.</p>
          </div>
        {/if}
      </section>
    </div>

    <footer class="import-footer">
      <div class="footer-info">
        <label class="entity-option">
          <input type="checkbox" bind:checked={addEntities} />
          <span><b>إضافة الكيانات المؤكدة إلى ملف المشروع</b><small>تُضاف الشخصيات والأماكن المؤكدة فقط. اضغط «اعتماد» على العنصر المحتمل إذا أردت إدخاله ككيان جديد.</small></span>
        </label>
        {#if recognition?.warnings.length}
          <div class="warnings">{recognition.warnings.join(' ')}</div>
        {/if}
      </div>
      <div class="footer-actions">
        <button class="ghost-button" on:click={onClose}>إلغاء</button>
        <button class="primary-button" on:click={importNow} disabled={!recognition?.blocks.length}>استيراد إلى المحرر</button>
      </div>
    </footer>
  </section>
</div>

<style>
  .paste-modal{width:min(1540px,98vw);height:96vh;background:var(--panel);border:1px solid var(--line);border-radius:16px;box-shadow:0 24px 72px rgba(0,0,0,.2);display:flex;flex-direction:column;overflow:hidden}
  .modal-head{padding:14px 18px;align-items:flex-start}.modal-head-actions{display:flex;align-items:center;gap:10px}.pane-mode{display:flex;gap:3px;padding:3px;border:1px solid var(--line);border-radius:9px;background:var(--panel-2)}.pane-mode button{border:0;background:transparent;color:var(--muted);border-radius:6px;padding:6px 9px;font-size:10px}.pane-mode button.active{background:var(--panel);color:var(--accent);box-shadow:0 1px 3px rgba(0,0,0,.08)}.import-caution{padding:7px 18px;border-top:1px solid var(--line-soft);border-bottom:1px solid var(--line-soft);background:#fff8e8;color:#76510f;font-size:10.5px;line-height:1.55}.modal-head>div:first-child{min-width:0}.eyebrow{font-size:10px;color:var(--accent);font-weight:800}.modal-head h2{font-size:18px;margin:3px 0}.modal-head p{margin:0;color:var(--muted);font-size:11.5px}.paste-body{min-height:0;flex:1;display:grid;grid-template-columns:minmax(360px,.85fr) minmax(560px,1.15fr);direction:ltr}.paste-body.source-focus{grid-template-columns:1fr}.paste-body.source-focus .preview-pane{display:none}.paste-body.preview-focus{grid-template-columns:1fr}.paste-body.preview-focus .source-pane{display:none}.source-pane,.preview-pane{min-width:0;display:flex;flex-direction:column;direction:rtl}.source-pane{border-right:1px solid var(--line);background:var(--panel-2)}.pane-title{min-height:60px;padding:11px 14px;border-bottom:1px solid var(--line-soft);display:flex;align-items:center;justify-content:space-between;gap:12px;background:var(--panel-2)}.pane-title b{display:block;color:var(--text-2);font-size:12px}.pane-title small{display:block;color:var(--muted-2);font-size:10px;margin-top:2px}.recognize-button{border:1px solid var(--accent-line);background:#eaf2fb;color:var(--accent);border-radius:8px;padding:8px 10px;font-size:11px;font-weight:800;white-space:nowrap}.recognize-button:hover{background:#dce9f8}.source-text{flex:1;min-height:0;border:0;outline:0;resize:vertical;overflow:auto;background:var(--panel);color:var(--text);padding:17px;font-family:"Amiri","Noto Naskh Arabic","Segoe UI",serif;font-size:15px;line-height:1.8;direction:rtl}.preview-pane{background:var(--bg)}.preview-title{background:var(--panel)}.summary-pill{border:1px solid var(--line);background:var(--panel-2);color:var(--text-2);border-radius:999px;padding:5px 9px;font-size:10px;white-space:nowrap}.empty-preview{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;color:var(--muted-2);text-align:center;padding:30px}.empty-preview>div{width:44px;height:44px;border:1px solid #ccc;border-radius:12px;display:grid;place-items:center;font-size:20px;background:var(--panel);color:var(--accent);margin-bottom:9px}.empty-preview b{color:var(--text-2);font-size:13px}.empty-preview p{margin:4px 0 0;font-size:11px}.empty-preview.warning>div{color:#a15c00}.recognition-summary{padding:8px 12px;display:flex;gap:6px;flex-wrap:wrap;border-bottom:1px solid #ddd;background:var(--panel-2)}.recognition-summary span{border:1px solid var(--line);background:var(--panel);border-radius:6px;padding:4px 7px;color:var(--muted);font-size:9.5px}.recognition-summary b{color:var(--accent)}.scene-jump{display:flex;align-items:center;gap:5px;overflow-x:auto;padding:6px 10px;border-bottom:1px solid var(--line-soft);background:var(--panel);position:sticky;top:0;z-index:3}.scene-jump>span{font-size:9.5px;color:var(--muted);white-space:nowrap}.scene-jump button{min-width:26px;height:24px;border:1px solid var(--line);border-radius:6px;background:var(--panel-2);color:var(--text-2);font-size:9px}.scene-jump button:hover{border-color:var(--accent-line);color:var(--accent);background:var(--accent-soft)}.recognized-list{min-height:0;flex:1;overflow:auto;padding:10px 12px 60px;scroll-behavior:smooth}.recognized-row{display:grid;grid-template-columns:28px 92px minmax(0,1fr) 56px;gap:7px;align-items:start;padding:7px;border:1px solid var(--line-soft);border-radius:8px;background:var(--panel);margin-bottom:6px;box-shadow:0 1px 2px rgba(0,0,0,.035)}.recognized-row.scene-start{border-right:3px solid var(--accent);background:#fbfdff;margin-top:10px}.row-index{height:28px;display:grid;place-items:center;color:var(--muted-2);font-size:9px}.recognized-row select{height:30px;border:1px solid var(--line);border-radius:6px;background:var(--panel-2);color:var(--text-2);font-size:10px;padding:0 5px;outline:0}.recognized-row textarea{min-height:42px;max-height:none;field-sizing:content;border:1px solid transparent;border-radius:5px;background:transparent;color:var(--text);padding:4px 6px;resize:vertical;font-family:"Amiri","Noto Naskh Arabic","Segoe UI",serif;font-size:13px;line-height:1.55;outline:0}.recognized-row textarea:focus{border-color:#b8cce8;background:var(--panel)}.confidence{justify-self:stretch;text-align:center;border-radius:999px;padding:4px 5px;font-size:8.5px;margin-top:4px;border:1px solid;cursor:pointer;background:var(--panel)}.confidence.high{color:var(--green);background:#eff8ef;border-color:#b8d9b8}.confidence.medium{color:#8a5200;background:#fff8e8;border-color:#ead39b}.confidence.low{color:#a4262c;background:#fff1f1;border-color:#e8b8bb}.import-footer{border-top:1px solid var(--line);background:var(--panel);padding:11px 14px;display:flex;align-items:center;justify-content:space-between;gap:18px}.footer-info{min-width:0}.entity-option{display:flex;align-items:flex-start;gap:8px;color:var(--text-2);cursor:pointer}.entity-option input{margin-top:3px;accent-color:var(--accent)}.entity-option b{display:block;font-size:10.5px}.entity-option small{display:block;color:var(--muted-2);font-size:9.5px;margin-top:2px}.warnings{margin-top:5px;color:#8a5200;font-size:9.5px}.footer-actions{display:flex;gap:8px;white-space:nowrap}.footer-actions button{font-size:11px;padding:8px 12px}
  @media(max-width:850px){.paste-modal{height:96vh;width:98vw}.pane-mode{display:none}.paste-body{grid-template-columns:1fr;overflow:auto}.source-pane{min-height:280px;border-right:0;border-bottom:1px solid #ddd}.preview-pane{min-height:380px}.import-footer{align-items:flex-end}.entity-option small{display:none}}
</style>
