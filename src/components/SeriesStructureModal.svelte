<script lang="ts">
  import AppIcon from './AppIcon.svelte';
  import type { Episode, Scene, Season } from '../lib/types';

  type StructureDialogMode = 'season' | 'episode' | 'move-scene';

  export let mode: StructureDialogMode = 'episode';
  export let season: Season | null = null;
  export let episode: Episode | null = null;
  export let scene: Scene | null = null;
  export let seasons: Season[] = [];
  export let episodes: Episode[] = [];
  export let onClose: () => void;
  export let onSaveSeason: (id: string, title: string) => void = () => {};
  export let onSaveEpisode: (id: string, values: { title: string; synopsis: string; notes: string }) => void = () => {};
  export let onMoveScene: (sceneId: string, episodeId: string) => void = () => {};

  let seasonTitle = '';
  let episodeTitle = '';
  let episodeSynopsis = '';
  let episodeNotes = '';
  let targetEpisodeId = '';
  let lastKey = '';

  $: key = `${mode}:${season?.id ?? ''}:${episode?.id ?? ''}:${scene?.id ?? ''}`;
  $: if (key !== lastKey) {
    lastKey = key;
    seasonTitle = season?.title ?? '';
    episodeTitle = episode?.title ?? '';
    episodeSynopsis = episode?.synopsis ?? '';
    episodeNotes = episode?.notes ?? '';
    const firstTarget = orderedEpisodes.find((item) => item.id !== scene?.episodeId);
    targetEpisodeId = firstTarget?.id ?? '';
  }

  $: orderedSeasons = [...seasons].sort((a,b) => a.orderIndex - b.orderIndex || a.number - b.number);
  $: orderedEpisodes = [...episodes].sort((a,b) => {
    const sa = orderedSeasons.findIndex((s) => s.id === a.seasonId);
    const sb = orderedSeasons.findIndex((s) => s.id === b.seasonId);
    return sa - sb || a.orderIndex - b.orderIndex || a.number - b.number;
  });

  function seasonLabel(item: Season | undefined | null) {
    if (!item) return '';
    return item.title?.trim() ? `الموسم ${item.number} — ${item.title.trim()}` : `الموسم ${item.number}`;
  }

  function episodeLabel(item: Episode) {
    const parent = seasons.find((s) => s.id === item.seasonId);
    const title = item.title?.trim() ? ` — ${item.title.trim()}` : '';
    return `${parent ? `م${parent.number} · ` : ''}الحلقة ${item.number}${title}`;
  }

  function submit() {
    if (mode === 'season' && season) {
      onSaveSeason(season.id, seasonTitle.trim());
      return;
    }
    if (mode === 'episode' && episode) {
      onSaveEpisode(episode.id, { title: episodeTitle.trim(), synopsis: episodeSynopsis.trim(), notes: episodeNotes.trim() });
      return;
    }
    if (mode === 'move-scene' && scene && targetEpisodeId) {
      onMoveScene(scene.id, targetEpisodeId);
    }
  }
</script>

<div class="backdrop" role="presentation" on:click={(event) => event.currentTarget === event.target && onClose()}>
  <section class="dialog" dir="rtl" role="dialog" aria-modal="true">
    <header>
      <div class="heading">
        <span class="symbol"><AppIcon name={mode === 'move-scene' ? 'scenes' : mode === 'season' ? 'folder' : 'file'} size={19} /></span>
        <div>
          <h2>{mode === 'season' ? 'بيانات الموسم' : mode === 'episode' ? 'بيانات الحلقة' : 'نقل المشهد'}</h2>
          {#if mode === 'season' && season}<p>الموسم {season.number} · الاسم اختياري ويمكن تغييره في أي وقت.</p>{/if}
          {#if mode === 'episode' && episode}<p>الحلقة {episode.number} · الرقم يتبع ترتيب الحلقة تلقائياً.</p>{/if}
          {#if mode === 'move-scene' && scene}<p>{scene.heading || 'مشهد بلا عنوان'}</p>{/if}
        </div>
      </div>
      <button class="icon-close" on:click={onClose} title="إغلاق"><AppIcon name="close" size={18} /></button>
    </header>

    <div class="body">
      {#if mode === 'season' && season}
        <label>
          <span>اسم الموسم</span>
          <input bind:value={seasonTitle} placeholder={`الموسم ${season.number}`} autofocus />
          <small>إذا تركته فارغاً سيظهر تلقائياً باسم «الموسم {season.number}».</small>
        </label>
      {:else if mode === 'episode' && episode}
        <div class="number-card">
          <span>الرقم</span>
          <b>الحلقة {episode.number}</b>
          <small>{seasonLabel(seasons.find((item) => item.id === episode?.seasonId))}</small>
        </div>
        <label>
          <span>عنوان الحلقة</span>
          <input bind:value={episodeTitle} placeholder="عنوان اختياري" autofocus />
        </label>
        <label>
          <span>ملخص الحلقة</span>
          <textarea bind:value={episodeSynopsis} rows="5" placeholder="ملخص موجز لأحداث الحلقة..."></textarea>
        </label>
        <label>
          <span>ملاحظات</span>
          <textarea bind:value={episodeNotes} rows="4" placeholder="ملاحظات الكاتب الخاصة بهذه الحلقة..."></textarea>
        </label>
      {:else if mode === 'move-scene' && scene}
        <div class="move-note">
          <AppIcon name="info" size={17} />
          <span>سينتقل المشهد بكامل محتواه إلى نهاية الحلقة المختارة، ثم يعاد ترقيم مشاهد الحلقتين تلقائياً.</span>
        </div>
        <label>
          <span>الحلقة الهدف</span>
          <select bind:value={targetEpisodeId}>
            {#each orderedEpisodes.filter((item) => item.id !== scene?.episodeId) as item (item.id)}
              <option value={item.id}>{episodeLabel(item)}</option>
            {/each}
          </select>
        </label>
        {#if !orderedEpisodes.some((item) => item.id !== scene?.episodeId)}
          <p class="empty">لا توجد حلقة أخرى يمكن نقل المشهد إليها.</p>
        {/if}
      {/if}
    </div>

    <footer>
      <button class="secondary" on:click={onClose}>إلغاء</button>
      <button class="primary" on:click={submit} disabled={mode === 'move-scene' && !targetEpisodeId}>
        {mode === 'move-scene' ? 'نقل المشهد' : 'حفظ'}
      </button>
    </footer>
  </section>
</div>

<style>
  .backdrop { position:fixed; inset:0; z-index:120; display:grid; place-items:center; padding:24px; background:rgba(15,23,42,.34); backdrop-filter:blur(3px); }
  .dialog { width:min(620px, calc(100vw - 34px)); max-height:min(760px, calc(100vh - 34px)); overflow:auto; border:1px solid var(--line); border-radius:16px; background:var(--panel); color:var(--text); box-shadow:var(--shadow-lg); }
  header { min-height:72px; display:flex; align-items:center; justify-content:space-between; gap:16px; padding:16px 18px; border-bottom:1px solid var(--line-soft); }
  .heading { display:flex; align-items:center; gap:11px; min-width:0; }
  .symbol { width:38px; height:38px; flex:0 0 auto; display:grid; place-items:center; border-radius:11px; background:var(--accent-soft); color:var(--accent); }
  h2 { margin:0; font-size:18px; }
  p { margin:4px 0 0; color:var(--muted); font-size:11px; line-height:1.55; }
  .icon-close { width:34px; height:34px; display:grid; place-items:center; border:0; border-radius:9px; background:transparent; color:var(--muted); }
  .icon-close:hover { background:var(--hover); color:var(--text); }
  .body { display:flex; flex-direction:column; gap:16px; padding:20px 22px 22px; }
  label { display:flex; flex-direction:column; gap:7px; }
  label > span { font-size:12px; font-weight:700; color:var(--text-2); }
  label small { color:var(--muted); font-size:10px; }
  input, textarea, select { width:100%; box-sizing:border-box; border:1px solid var(--line); border-radius:9px; background:var(--panel); color:var(--text); font:inherit; font-size:13px; padding:10px 12px; outline:none; }
  input:focus, textarea:focus, select:focus { border-color:var(--accent); box-shadow:0 0 0 3px var(--accent-soft); }
  textarea { resize:vertical; line-height:1.7; }
  .number-card { display:grid; grid-template-columns:auto 1fr; align-items:center; column-gap:10px; row-gap:2px; padding:12px 14px; border:1px solid var(--line-soft); border-radius:10px; background:var(--panel-2); }
  .number-card > span { grid-row:1 / span 2; width:46px; height:46px; display:grid; place-items:center; border-radius:9px; background:var(--accent-soft); color:var(--accent); font-size:10px; font-weight:700; }
  .number-card b { font-size:14px; }
  .number-card small { color:var(--muted); font-size:10.5px; }
  .move-note { display:flex; align-items:flex-start; gap:8px; padding:11px 12px; border-radius:9px; background:var(--panel-2); color:var(--muted); font-size:11px; line-height:1.65; }
  .move-note :global(svg) { flex:0 0 auto; margin-top:2px; color:var(--accent); }
  .empty { margin:0; padding:12px; text-align:center; border:1px dashed var(--line); border-radius:9px; }
  footer { display:flex; justify-content:flex-start; gap:8px; padding:13px 18px; border-top:1px solid var(--line-soft); background:var(--panel-2); }
  footer button { min-width:92px; border-radius:8px; padding:9px 14px; font:inherit; font-size:12px; font-weight:700; }
  .secondary { border:1px solid var(--line); background:var(--panel); color:var(--text-2); }
  .primary { border:1px solid var(--accent); background:var(--accent); color:white; }
  .primary:disabled { opacity:.45; cursor:not-allowed; }
</style>
