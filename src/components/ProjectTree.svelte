<script lang="ts">
  import AppIcon from './AppIcon.svelte';
  import IconButton from './IconButton.svelte';
  import type { Character, Episode, Location, Project, Scene, Season } from '../lib/types';

  export let project: Project;
  export let seasons: Season[] = [];
  export let episodes: Episode[] = [];
  export let scenes: Scene[] = [];
  export let characters: Character[] = [];
  export let locations: Location[] = [];
  export let selectedEpisodeId = '';
  export let onClose: () => void;
  export let onSelectEpisode: (id: string) => void = () => {};
  export let onAddEpisode: (seasonId?: string) => void = () => {};
  export let onAddSeason: () => void = () => {};
  export let onDeleteEpisode: (id: string) => void = () => {};
  export let onDeleteSeason: (id: string) => void = () => {};
  export let onEditSeason: (id: string) => void = () => {};
  export let onEditEpisode: (id: string) => void = () => {};
  export let onDuplicateEpisode: (id: string) => void = () => {};
  export let onReorderEpisode: (sourceId: string, targetId: string) => void = () => {};
  export let onOpenBasics: () => void;
  export let onOpenStory: () => void;
  export let onOpenCharacters: () => void;
  export let onOpenLocations: () => void;

  let dossierOpen = true;
  let scenesOpen = true;
  let seasonOpen: Record<string, boolean> = {};
  let draggedEpisodeId = '';

  $: orderedSeasons = [...seasons].sort((a, b) => a.orderIndex - b.orderIndex);

  function seasonEpisodes(seasonId: string): Episode[] {
    return episodes.filter((episode) => episode.seasonId === seasonId).sort((a,b)=>a.orderIndex-b.orderIndex);
  }

  function episodeScenes(episodeId: string): Scene[] {
    return scenes.filter((scene) => scene.episodeId === episodeId).sort((a,b)=>a.orderIndex-b.orderIndex);
  }

  function toggleSeason(id: string) {
    seasonOpen = { ...seasonOpen, [id]: !(seasonOpen[id] ?? true) };
  }

  function beginEpisodeDrag(event: DragEvent, id: string) {
    draggedEpisodeId = id;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', id);
    }
  }

  function dropEpisode(event: DragEvent, targetId: string) {
    event.preventDefault();
    const sourceId = draggedEpisodeId || event.dataTransfer?.getData('text/plain') || '';
    draggedEpisodeId = '';
    if (sourceId && sourceId !== targetId) onReorderEpisode(sourceId, targetId);
  }
</script>

<aside class="project-tree" dir="rtl" aria-label="هيكل المشروع">
  <header>
    <div class="tree-heading">
      <span class="project-symbol"><AppIcon name="folder" size={18} /></span>
      <div><b>هيكل المشروع</b><small>{project.title || 'مشروع بلا عنوان'}</small></div>
    </div>
    <IconButton icon="close" label="إغلاق هيكل المشروع" compact onClick={onClose} />
  </header>

  <div class="tree-body">
    <section>
      <button class="folder-row" on:click={() => dossierOpen = !dossierOpen} aria-expanded={dossierOpen}>
        <span class:open={dossierOpen} class="chevron"><AppIcon name="chevron" size={14} /></span>
        <AppIcon name="folder" size={17} />
        <b>ملف المشروع</b>
      </button>
      {#if dossierOpen}
        <div class="tree-children">
          <button on:click={onOpenBasics}><AppIcon name="file" size={15} /><span>الأساسيات</span></button>
          <button on:click={onOpenStory}><AppIcon name="story" size={15} /><span>الحكاية والمعالجة</span></button>
          <button on:click={onOpenCharacters}><AppIcon name="users" size={15} /><span>الشخصيات</span><em>{characters.length}</em></button>
          <button on:click={onOpenLocations}><AppIcon name="location" size={15} /><span>الأماكن</span><em>{locations.length}</em></button>
        </div>
      {/if}
    </section>

    {#if project.projectType === 'series'}
      <section>
        <button class="folder-row" on:click={() => scenesOpen = !scenesOpen} aria-expanded={scenesOpen}>
          <span class:open={scenesOpen} class="chevron"><AppIcon name="chevron" size={14} /></span>
          <AppIcon name="scenes" size={17} />
          <b>المواسم والحلقات</b><em>{episodes.length}</em>
        </button>

        {#if scenesOpen}
          <div class="structure-tree">
            {#each orderedSeasons as season (season.id)}
              <div class="season-block">
                <div class="structure-row season-row">
                  <button class="row-main" on:click={() => toggleSeason(season.id)}>
                    <span class:open={seasonOpen[season.id] ?? true} class="chevron small"><AppIcon name="chevron" size={12} /></span>
                    <AppIcon name="folder" size={15} />
                    <b>الموسم {season.number}{#if season.title?.trim()}<small> · {season.title}</small>{/if}</b>
                    <em>{seasonEpisodes(season.id).length}</em>
                  </button>
                  <button class="tiny-action" title="تعديل اسم الموسم" on:click={() => onEditSeason(season.id)}><AppIcon name="edit" size={13} /></button>
                  <button class="tiny-action" title="إضافة حلقة" on:click={() => onAddEpisode(season.id)}>＋</button>
                  {#if seasons.length > 1}<button class="tiny-action danger" title="حذف الموسم" on:click={() => onDeleteSeason(season.id)}>×</button>{/if}
                </div>

                {#if seasonOpen[season.id] ?? true}
                  <div class="season-children">
                    {#each seasonEpisodes(season.id) as episode (episode.id)}
                      <div
                        class:active={episode.id === selectedEpisodeId}
                        class:dragging={episode.id === draggedEpisodeId}
                        class="episode-block compact"
                        on:dragover={(event) => event.preventDefault()}
                        on:drop={(event) => dropEpisode(event, episode.id)}
                      >
                        <div class="structure-row episode-row">
                          <span class="drag-handle" title="اسحب لترتيب الحلقة" draggable="true" on:dragstart={(event) => beginEpisodeDrag(event, episode.id)} on:dragend={() => draggedEpisodeId = ''}>⋮⋮</span>
                          <button class="row-main" on:click={() => onSelectEpisode(episode.id)} title="فتح الحلقة في المحرر">
                            <AppIcon name="file" size={14} />
                            <span class="episode-label"><b>الحلقة {episode.number}</b>{#if episode.title?.trim()}<small> · {episode.title}</small>{/if}</span>
                            <em title="عدد مشاهد الحلقة">{episodeScenes(episode.id).length}</em>
                          </button>
                          <button class="tiny-action" title="بيانات الحلقة" on:click={() => onEditEpisode(episode.id)}><AppIcon name="edit" size={13} /></button>
                          <button class="tiny-action" title="نسخ الحلقة" on:click={() => onDuplicateEpisode(episode.id)}>⧉</button>
                          {#if episodes.length > 1}<button class="tiny-action danger" title="حذف الحلقة" on:click={() => onDeleteEpisode(episode.id)}>×</button>{/if}
                        </div>
                      </div>
                    {/each}
                  </div>
                {/if}
              </div>
            {/each}
            <button class="add-structure" on:click={onAddSeason}><AppIcon name="plus" size={14} /><span>إضافة موسم</span></button>
          </div>
        {/if}
      </section>
    {/if}
  </div>

  <footer>
    <AppIcon name="info" size={15} />
    <span>{project.projectType === 'series' ? 'المواسم والحلقات هنا؛ المشاهد تُدار من لوحة المشاهد في الجانب الآخر.' : 'ملف المشروع هنا؛ المشاهد تُدار من لوحة المشاهد.'}</span>
  </footer>
</aside>

<style>
  .project-tree { width:306px; height:100%; position:absolute; right:54px; top:0; z-index:45; display:flex; flex-direction:column; background:var(--panel); border-left:1px solid var(--line); border-right:1px solid var(--line); box-shadow:var(--shadow-lg); color:var(--text); }
  header { min-height:64px; display:flex; align-items:center; justify-content:space-between; gap:10px; padding:11px 12px 10px 14px; border-bottom:1px solid var(--line-soft); }
  .tree-heading { display:flex; align-items:center; gap:9px; min-width:0; }
  .project-symbol { width:32px; height:32px; border-radius:9px; display:grid; place-items:center; background:var(--accent-soft); color:var(--accent); flex:0 0 auto; }
  .tree-heading div { min-width:0; }
  .tree-heading b { display:block; font-size:14px; }
  .tree-heading small { display:block; margin-top:2px; max-width:190px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--muted); font-size:10.5px; }
  .tree-body { flex:1; overflow:auto; padding:10px 8px 18px; }
  section + section { border-top:1px solid var(--line-soft); margin-top:8px; padding-top:8px; }
  .folder-row { width:100%; display:flex; align-items:center; gap:7px; border:0; background:transparent; color:var(--text); border-radius:8px; padding:8px 7px; text-align:right; }
  .folder-row:hover { background:var(--hover); }
  .folder-row b { flex:1; font-size:12.5px; }
  .folder-row em, .structure-row em { font-style:normal; color:var(--muted); font-size:9.5px; background:var(--panel-3); min-width:22px; height:19px; display:grid; place-items:center; border-radius:99px; }
  .chevron { color:var(--muted); transition:.15s ease; transform:rotate(180deg); display:grid; }
  .chevron.open { transform:rotate(90deg); }
  .chevron.small { margin-left:1px; }
  .tree-children { margin:2px 24px 6px 0; border-right:1px solid var(--line-soft); padding-right:8px; display:flex; flex-direction:column; gap:2px; }
  .tree-children button { display:flex; align-items:center; gap:7px; width:100%; padding:7px 8px; border:0; border-radius:7px; background:transparent; color:var(--text-2); text-align:right; }
  .tree-children button:hover { background:var(--hover); color:var(--accent); }
  .tree-children span { flex:1; font-size:11.5px; }
  .tree-children em { font-style:normal; font-size:9.5px; color:var(--muted); }
  .structure-tree { margin:2px 16px 6px 0; border-right:1px solid var(--line-soft); padding:2px 8px 2px 0; display:flex; flex-direction:column; gap:4px; }
  .season-block { border-radius:8px; }
  .structure-row { display:flex; align-items:center; gap:3px; }
  .row-main { flex:1; min-width:0; border:0; background:transparent; color:var(--text-2); display:flex; align-items:center; gap:6px; padding:7px 6px; border-radius:7px; text-align:right; }
  .row-main:hover { background:var(--hover); color:var(--text); }
  .row-main b, .row-main span:not(.chevron) { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:11px; }
  .season-row .row-main b { font-size:11.5px; color:var(--text); }
  .tiny-action { width:23px; height:23px; border:0; border-radius:6px; background:transparent; color:var(--muted); font-size:13px; opacity:.55; }
  .structure-row:hover .tiny-action { opacity:1; }
  .tiny-action:hover { background:var(--hover); color:var(--accent); }
  .tiny-action.danger:hover { color:var(--danger); }
  .season-children { margin-right:17px; padding-right:7px; border-right:1px solid var(--line-soft); }
  .episode-block.active > .episode-row .row-main { background:var(--accent-soft); color:var(--accent); }
  .add-structure { width:100%; display:flex; align-items:center; justify-content:center; gap:6px; margin-top:6px; border:1px dashed var(--line); border-radius:7px; background:transparent; color:var(--muted); padding:7px; font-size:10.5px; }
  .add-structure:hover { color:var(--accent); border-color:var(--accent-line); background:var(--accent-soft); }

  .drag-handle { flex:0 0 13px; color:var(--muted); font-size:13px; line-height:1; cursor:grab; user-select:none; opacity:.45; }
  .episode-block:hover .drag-handle { opacity:.9; }
  .episode-block.dragging { opacity:.55; }
  .episode-label { display:flex !important; align-items:baseline; gap:2px; }
  .episode-label b { flex:0 0 auto; font-size:10.5px; color:inherit; }
  .episode-label small, .season-row b small { font-size:10.5px; font-weight:500; color:var(--text-2); }
  .episode-block.compact .episode-row { border-radius:7px; }
  footer { border-top:1px solid var(--line-soft); padding:10px 12px; display:flex; gap:8px; color:var(--muted); background:var(--panel-2); }
  footer span { font-size:9.5px; line-height:1.55; }
  @media(max-width:1100px){ .project-tree{ width:278px; } }
</style>
