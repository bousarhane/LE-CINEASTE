<script lang="ts">
  import { onMount } from 'svelte';
  import AppIcon from './AppIcon.svelte';
  import type { Scene } from '../lib/types';

  type ViewMode = 'board' | 'list';

  export let scenes: Scene[] = [];
  export let selectedSceneId = '';
  export let episodeOptions: Array<{ id: string; label: string }> = [];
  export let activeEpisodeId = '';
  export let showEpisodePicker = false;
  export let seriesMode = false;
  export let onEpisode: (id: string) => void = () => {};
  export let onAddEpisode: () => void = () => {};
  export let onSelect: (id: string) => void;
  export let onAdd: () => void;
  export let onDelete: (id: string) => void;
  export let onDuplicate: (id: string) => void;
  export let onMove: (id: string, direction: -1 | 1) => void;
  export let onTransfer: (id: string) => void = () => {};
  export let onReorder: (sourceId: string, targetId: string) => void = () => {};
  export let onStatus: (id: string) => void;

  let viewMode: ViewMode = 'board';
  let filtersOpen = false;
  let query = '';
  let characterFilter = '';
  let locationFilter = '';
  let kindFilter = '';
  let timeFilter = '';
  let statusFilter = '';
  let dragSceneId = '';

  onMount(() => {
    const saved = localStorage.getItem('scene-writer-scene-view');
    if (saved === 'board' || saved === 'list') viewMode = saved;
  });

  function setView(mode: ViewMode) {
    viewMode = mode;
    localStorage.setItem('scene-writer-scene-view', mode);
  }

  function preview(scene: Scene): string {
    return scene.blocks
      .filter((b) => b.elementType === 'action' || b.elementType === 'action_line' || b.elementType === 'dialogue')
      .map((b) => b.text)
      .filter(Boolean)
      .join(' ')
      .slice(0, 110);
  }

  function sceneCharacters(scene: Scene): string[] {
    const names = scene.blocks
      .filter((block) => block.elementType === 'character')
      .map((block) => block.text.trim())
      .filter(Boolean);
    return [...new Set(names)];
  }

  function statusLabel(status: Scene['colorStatus']): string {
    if (status === 'done') return 'منتهي';
    if (status === 'needs_review') return 'مراجعة';
    return 'مسودة';
  }

  function kindLabel(kind: Scene['sceneKind']): string {
    if (kind === 'EXT') return 'خارجي';
    if (kind === 'INT/EXT') return 'داخلي/خارجي';
    if (kind === 'INT') return 'داخلي';
    return '';
  }

  function normal(value: string): string {
    return value.trim().toLocaleLowerCase('ar').replace(/[ًٌٍَُِّْـ]/g, '').replace(/\s+/g, ' ');
  }

  function sceneNumber(scene: Scene): number {
    const index = scenes.findIndex((item) => item.id === scene.id);
    return index >= 0 ? index + 1 : 0;
  }

  function matches(scene: Scene): boolean {
    if (statusFilter && scene.colorStatus !== statusFilter) return false;
    if (kindFilter && scene.sceneKind !== kindFilter) return false;
    if (timeFilter && scene.sceneTime !== timeFilter) return false;
    if (locationFilter && scene.scenePlace !== locationFilter) return false;
    if (characterFilter && !sceneCharacters(scene).includes(characterFilter)) return false;
    const search = normal(query);
    if (!search) return true;
    const haystack = normal([
      scene.heading,
      scene.scenePlace,
      scene.sceneTime,
      ...sceneCharacters(scene),
      ...scene.blocks.map((block) => block.text)
    ].join(' '));
    return haystack.includes(search);
  }

  function clearFilters() {
    query = '';
    characterFilter = '';
    locationFilter = '';
    kindFilter = '';
    timeFilter = '';
    statusFilter = '';
  }

  function dragStart(event: DragEvent, id: string) {
    if (filtersActive) {
      event.preventDefault();
      return;
    }
    dragSceneId = id;
    event.dataTransfer?.setData('text/plain', id);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  function dropOn(event: DragEvent, targetId: string) {
    event.preventDefault();
    if (filtersActive) return;
    const sourceId = dragSceneId || event.dataTransfer?.getData('text/plain') || '';
    dragSceneId = '';
    if (!sourceId || sourceId === targetId) return;
    onReorder(sourceId, targetId);
  }

  $: characterOptions = [...new Set(scenes.flatMap(sceneCharacters))].sort((a, b) => a.localeCompare(b, 'ar'));
  $: locationOptions = [...new Set(scenes.map((scene) => scene.scenePlace.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ar'));
  $: timeOptions = [...new Set(scenes.map((scene) => scene.sceneTime.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ar'));
  $: filtersActive = Boolean(query.trim() || characterFilter || locationFilter || kindFilter || timeFilter || statusFilter);
  $: visibleScenes = scenes.filter(matches);
</script>

<aside class="left-panel" dir="rtl">
  <div class="panel-head">
    <div>
      <h2>لوحة المشاهد</h2>
      <p>{filtersActive ? `${visibleScenes.length} من ${scenes.length}` : scenes.length} {scenes.length === 1 ? 'مشهد' : 'مشاهد'}</p>
    </div>
    <button class="mini-add" on:click={() => onAdd()} aria-label="إضافة مشهد" title="إضافة مشهد">＋</button>
  </div>

  {#if showEpisodePicker}
    <div class="episode-strip">
      <select value={activeEpisodeId} on:change={(e) => onEpisode((e.currentTarget as HTMLSelectElement).value)} aria-label="الحلقة الحالية">
        {#each episodeOptions as option}
          <option value={option.id}>{option.label}</option>
        {/each}
      </select>
      <button on:click={onAddEpisode} title="إضافة حلقة" aria-label="إضافة حلقة">＋</button>
    </div>
  {/if}

  <div class="scene-controls">
    <div class="view-switch" aria-label="طريقة عرض المشاهد">
      <button class:active={viewMode === 'board'} on:click={() => setView('board')} title="عرض كبطاقات" aria-label="لوحة">
        <AppIcon name="board" size={16} /><span>لوحة</span>
      </button>
      <button class:active={viewMode === 'list'} on:click={() => setView('list')} title="عرض كقائمة مضغوطة" aria-label="قائمة">
        <AppIcon name="list" size={16} /><span>قائمة</span>
      </button>
    </div>
    <button class="filter-toggle" class:active={filtersOpen || filtersActive} on:click={() => filtersOpen = !filtersOpen} title="تصفية المشاهد" aria-label="تصفية المشاهد">
      <AppIcon name="filter" size={16} />
      {#if filtersActive}<span class="filter-dot"></span>{/if}
    </button>
  </div>

  {#if filtersOpen}
    <div class="filters">
      <div class="filter-head"><b>تصفية المشاهد</b>{#if filtersActive}<button on:click={clearFilters}>مسح</button>{/if}</div>
      <input bind:value={query} placeholder="بحث في العنوان أو النص..." aria-label="بحث في المشاهد" />
      <div class="filter-grid">
        <select bind:value={characterFilter} aria-label="تصفية حسب الشخصية">
          <option value="">كل الشخصيات</option>
          {#each characterOptions as name}<option value={name}>{name}</option>{/each}
        </select>
        <select bind:value={locationFilter} aria-label="تصفية حسب المكان">
          <option value="">كل الأماكن</option>
          {#each locationOptions as place}<option value={place}>{place}</option>{/each}
        </select>
        <select bind:value={kindFilter} aria-label="تصفية حسب نوع المشهد">
          <option value="">داخلي/خارجي</option>
          <option value="INT">داخلي</option>
          <option value="EXT">خارجي</option>
          <option value="INT/EXT">داخلي/خارجي</option>
        </select>
        <select bind:value={timeFilter} aria-label="تصفية حسب الزمن">
          <option value="">كل الأزمنة</option>
          {#each timeOptions as time}<option value={time}>{time}</option>{/each}
        </select>
        <select bind:value={statusFilter} aria-label="تصفية حسب الحالة">
          <option value="">كل الحالات</option>
          <option value="draft">مسودة</option>
          <option value="done">منتهي</option>
          <option value="needs_review">مراجعة</option>
        </select>
      </div>
      {#if filtersActive}<p class="filter-note">السحب لإعادة الترتيب يتوقف أثناء التصفية حتى يبقى ترتيب المشاهد واضحًا.</p>{/if}
    </div>
  {/if}

  <div class="scene-list" class:list-mode={viewMode === 'list'}>
    {#if viewMode === 'board'}
      {#each visibleScenes as scene (scene.id)}
        <article
          class:active={scene.id === selectedSceneId}
          class:dragging={dragSceneId === scene.id}
          class="scene-card"
          draggable={!filtersActive}
          on:dragstart={(event) => dragStart(event, scene.id)}
          on:dragend={() => dragSceneId = ''}
          on:dragover|preventDefault
          on:drop={(event) => dropOn(event, scene.id)}
          on:click={() => onSelect(scene.id)}
          title={filtersActive ? '' : 'يمكن سحب البطاقة لإعادة ترتيب المشهد'}
        >
          <div class="scene-accent" class:done={scene.colorStatus === 'done'} class:review={scene.colorStatus === 'needs_review'}></div>
          <div class="scene-top">
            <span class="scene-index">{String(sceneNumber(scene)).padStart(2, '0')}</span>
            <button class="status" on:click|stopPropagation={() => onStatus(scene.id)}>{statusLabel(scene.colorStatus)}</button>
          </div>
          <h3>{scene.heading || 'مشهد بلا عنوان'}</h3>
          <div class="meta-line">
            {#if kindLabel(scene.sceneKind)}<span>{kindLabel(scene.sceneKind)}</span>{/if}
            {#if scene.sceneTime}<span>{scene.sceneTime}</span>{/if}
            {#if sceneCharacters(scene).length}<span class="characters">{sceneCharacters(scene).slice(0, 3).join('، ')}{sceneCharacters(scene).length > 3 ? ` +${sceneCharacters(scene).length - 3}` : ''}</span>{/if}
          </div>
          <p class="preview">{preview(scene) || 'ابدأ كتابة هذا المشهد...'}</p>
          <div class="scene-foot">
            <span title={`≈ ${scene.durationPages.toFixed(1)} دقيقة تقديرية`}>{scene.durationPages.toFixed(1)} ص</span>
            <div class="card-tools">
              <button on:click|stopPropagation={() => onMove(scene.id, -1)} title="لأعلى" disabled={sceneNumber(scene) === 1}>↑</button>
              <button on:click|stopPropagation={() => onMove(scene.id, 1)} title="لأسفل" disabled={sceneNumber(scene) === scenes.length}>↓</button>
              {#if seriesMode && episodeOptions.length > 1}<button on:click|stopPropagation={() => onTransfer(scene.id)} title="نقل المشهد إلى حلقة أخرى" aria-label="نقل المشهد إلى حلقة أخرى">⇄</button>{/if}
              <button on:click|stopPropagation={() => onDuplicate(scene.id)} title="نسخ المشهد" aria-label="نسخ المشهد">⧉</button>
              <button class="danger" on:click|stopPropagation={() => onDelete(scene.id)} title="حذف المشهد">×</button>
            </div>
          </div>
        </article>
      {/each}
    {:else}
      {#each visibleScenes as scene (scene.id)}
        <article class:active={scene.id === selectedSceneId} class="scene-row" on:click={() => onSelect(scene.id)}>
          <div class="row-main">
            <span class="row-index">{String(sceneNumber(scene)).padStart(2, '0')}</span>
            <div class="row-copy">
              <h3>{scene.heading || 'مشهد بلا عنوان'}</h3>
              <p>
                {#if scene.scenePlace}<span>{scene.scenePlace}</span>{/if}
                {#if scene.sceneTime}<span>{scene.sceneTime}</span>{/if}
                {#if sceneCharacters(scene).length}<span>{sceneCharacters(scene).slice(0, 2).join('، ')}{sceneCharacters(scene).length > 2 ? '…' : ''}</span>{/if}
              </p>
            </div>
          </div>
          <div class="row-side">
            <button class="status compact" on:click|stopPropagation={() => onStatus(scene.id)}>{statusLabel(scene.colorStatus)}</button>
            <span>{scene.durationPages.toFixed(1)} ص</span>
            <div class="row-tools">
              {#if seriesMode && episodeOptions.length > 1}<button on:click|stopPropagation={() => onTransfer(scene.id)} title="نقل المشهد إلى حلقة أخرى">⇄</button>{/if}
              <button on:click|stopPropagation={() => onDuplicate(scene.id)} title="نسخ المشهد">⧉</button>
              <button class="danger" on:click|stopPropagation={() => onDelete(scene.id)} title="حذف المشهد">×</button>
            </div>
          </div>
        </article>
      {/each}
    {/if}

    {#if visibleScenes.length === 0 && scenes.length > 0}
      <div class="empty-list"><b>لا توجد نتائج</b><span>غيّر معايير التصفية أو امسحها.</span><button on:click={clearFilters}>مسح التصفية</button></div>
    {/if}
  </div>

  {#if scenes.length === 0}<div class="empty-list base">{seriesMode ? 'لا توجد مشاهد في هذه الحلقة بعد.' : 'لا توجد مشاهد بعد.'}</div>{/if}
  <button class="add-scene" on:click={() => onAdd()}><span>＋</span> إضافة مشهد جديد</button>
</aside>

<style>
  .left-panel { width:304px; flex:0 0 304px; height:100%; background:var(--panel); border-right:1px solid var(--line); display:flex; flex-direction:column; overflow:hidden; }
  .panel-head { padding:17px 16px 13px; border-bottom:1px solid var(--line-soft); display:flex; justify-content:space-between; align-items:center; }
  h2 { margin:0; font-size:17px; color:var(--text); font-weight:820; } .panel-head p { margin:5px 0 0; font-size:12px; color:var(--muted); }
  .mini-add { width:31px; height:31px; border-radius:9px; border:1px solid var(--line); background:var(--panel-2); color:var(--text); font-size:17px; }
  .episode-strip { display:flex; align-items:center; gap:6px; padding:8px 11px; border-bottom:1px solid var(--line-soft); background:var(--panel-2); }
  .episode-strip select { min-width:0; flex:1; height:31px; border:1px solid var(--line); border-radius:8px; background:var(--panel); color:var(--text-2); padding:0 9px; font:600 11px inherit; outline:none; }
  .episode-strip select:focus { border-color:var(--accent-line); box-shadow:0 0 0 2px var(--accent-soft); }
  .episode-strip button { width:31px; height:31px; flex:0 0 31px; border:1px solid var(--line); border-radius:8px; background:var(--panel); color:var(--accent); font-size:16px; }

  .scene-controls { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:8px 11px; border-bottom:1px solid var(--line-soft); background:var(--panel); }
  .view-switch { display:flex; align-items:center; padding:2px; border:1px solid var(--line); border-radius:9px; background:var(--panel-2); }
  .view-switch button { height:29px; border:0; border-radius:7px; background:transparent; color:var(--muted); display:flex; align-items:center; gap:5px; padding:0 9px; font-size:11px; font-weight:700; }
  .view-switch button.active { background:var(--panel); color:var(--accent); box-shadow:var(--shadow-sm); }
  .filter-toggle { position:relative; width:33px; height:33px; border:1px solid var(--line); border-radius:9px; background:var(--panel-2); color:var(--muted); display:grid; place-items:center; }
  .filter-toggle.active, .filter-toggle:hover { color:var(--accent); border-color:var(--accent-line); background:var(--accent-soft); }
  .filter-dot { position:absolute; top:5px; left:5px; width:6px; height:6px; border-radius:50%; background:var(--accent); border:1px solid var(--panel); }

  .filters { padding:10px 11px 11px; border-bottom:1px solid var(--line-soft); background:var(--panel-2); }
  .filter-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; font-size:11.5px; color:var(--text-2); }
  .filter-head button { border:0; background:transparent; color:var(--accent); font-size:10.5px; padding:2px 4px; }
  .filters input, .filters select { width:100%; height:31px; border:1px solid var(--line); border-radius:8px; background:var(--panel); color:var(--text-2); outline:none; font-size:10.8px; padding:0 8px; }
  .filters input:focus, .filters select:focus { border-color:var(--accent-line); box-shadow:0 0 0 2px var(--accent-soft); }
  .filters input { margin-bottom:6px; }
  .filter-grid { display:grid; grid-template-columns:1fr 1fr; gap:6px; }
  .filter-grid select:last-child { grid-column:1 / -1; }
  .filter-note { margin:7px 1px 0; color:var(--muted); font-size:9.8px; line-height:1.5; }

  .scene-list { flex:1; overflow:auto; padding:11px; display:flex; flex-direction:column; gap:9px; }
  .scene-list.list-mode { padding:7px 8px; gap:5px; }
  .scene-card { position:relative; flex:0 0 auto; min-height:139px; border:1px solid var(--line); background:var(--panel-2); border-radius:12px; padding:11px 12px 9px; cursor:pointer; overflow:hidden; transition:.16s ease; }
  .scene-card[draggable="true"] { cursor:grab; }
  .scene-card[draggable="true"]:active { cursor:grabbing; }
  .scene-card.dragging { opacity:.52; transform:scale(.985); }
  .scene-card:hover { background:var(--panel-3); border-color:var(--accent-line); transform:translateY(-1px); }
  .scene-card.active { border-color:var(--accent-line); background:linear-gradient(135deg, var(--accent-soft), var(--panel-2) 52%); box-shadow:0 0 0 1px var(--accent-soft), 0 10px 24px rgba(0,0,0,.10); }
  .scene-accent { position:absolute; right:0; top:0; bottom:0; width:3px; background:var(--muted-2); }
  .scene-accent.done { background:var(--green); } .scene-accent.review { background:#ca5010; }
  .scene-top { display:flex; justify-content:space-between; align-items:center; direction:ltr; }
  .scene-index, .row-index { font:750 11.5px ui-monospace, monospace; color:var(--muted); letter-spacing:.10em; }
  .status { border:0; border-radius:999px; padding:4px 8px; font-size:10.7px; background:var(--panel-3); color:var(--text-2); }
  .status.compact { padding:3px 7px; font-size:9.7px; }
  h3 { font-size:13.5px; line-height:1.5; margin:7px 0 5px; color:var(--text); display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
  .meta-line { min-height:22px; display:flex; align-items:center; gap:4px; flex-wrap:wrap; margin-bottom:5px; }
  .meta-line span { max-width:100%; padding:2px 6px; border:1px solid var(--line-soft); border-radius:999px; background:var(--panel); color:var(--muted); font-size:9.7px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .meta-line .characters { max-width:150px; }
  .preview { font-size:11.2px; color:var(--muted); margin:0; line-height:1.55; min-height:34px; max-height:34px; overflow:hidden; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; }
  .scene-foot { margin-top:8px; padding-top:7px; border-top:1px solid var(--line-soft); display:flex; justify-content:space-between; align-items:center; color:var(--muted); font-size:10.7px; direction:ltr; }
  .card-tools { display:flex; gap:3px; opacity:0; transition:.15s; } .scene-card:hover .card-tools, .scene-card.active .card-tools { opacity:1; }
  .card-tools button, .row-tools button { border:0; width:21px; height:20px; border-radius:5px; background:var(--panel-3); color:var(--text-2); font-size:11px; }
  .card-tools button:hover, .row-tools button:hover { color:var(--accent); } .card-tools .danger:hover, .row-tools .danger:hover { color:var(--danger); } .card-tools button:disabled { opacity:.2; }

  .scene-row { flex:0 0 auto; min-height:65px; border:1px solid var(--line-soft); border-radius:9px; background:var(--panel-2); display:flex; align-items:center; justify-content:space-between; gap:7px; padding:7px 8px; cursor:pointer; transition:.14s ease; }
  .scene-row:hover { border-color:var(--accent-line); background:var(--hover); }
  .scene-row.active { border-color:var(--accent-line); background:var(--accent-soft); box-shadow:inset -3px 0 0 var(--accent); }
  .row-main { min-width:0; display:flex; align-items:flex-start; gap:8px; flex:1; }
  .row-index { flex:0 0 24px; padding-top:4px; }
  .row-copy { min-width:0; flex:1; }
  .row-copy h3 { margin:0 0 3px; font-size:11.5px; line-height:1.45; min-height:0; -webkit-line-clamp:1; }
  .row-copy p { margin:0; display:flex; align-items:center; gap:5px; min-width:0; color:var(--muted); font-size:9.5px; line-height:1.4; overflow:hidden; }
  .row-copy p span { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .row-copy p span + span::before { content:'•'; margin-left:5px; color:var(--muted-2); }
  .row-side { flex:0 0 auto; display:flex; flex-direction:column; align-items:flex-end; gap:3px; color:var(--muted); font-size:9.5px; }
  .row-tools { display:flex; gap:2px; opacity:0; transition:.12s; }
  .scene-row:hover .row-tools, .scene-row.active .row-tools { opacity:1; }
  .row-tools button { width:19px; height:18px; font-size:10px; }

  .empty-list { margin:8px 4px 0; padding:13px 10px; text-align:center; color:var(--muted); font-size:11px; border:1px dashed var(--line); border-radius:10px; display:flex; flex-direction:column; gap:5px; align-items:center; }
  .empty-list.base { margin:8px 14px 0; }
  .empty-list b { color:var(--text-2); font-size:11.5px; }
  .empty-list button { border:0; background:transparent; color:var(--accent); font-size:10.5px; }
  .add-scene { margin:0 11px 11px; border:1px dashed var(--line); color:var(--muted); background:var(--bg); border-radius:10px; padding:11px; font-size:12px; }
  .add-scene:hover { color:var(--accent); border-color:var(--accent-line); background:var(--accent-soft); }
  @media(max-width:1150px){ .left-panel{ width:260px; flex-basis:260px; } .view-switch button span{ display:none; } .view-switch button{ padding:0 8px; } }
  @media(max-width:900px){ .left-panel{ display:none; } }
</style>
