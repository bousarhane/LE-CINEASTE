<script lang="ts">
  import type { ProjectType } from '../lib/types';
  import IconButton from './IconButton.svelte';

  export let title = 'تحرير السيناريو';
  export let projectTitle = 'سيناريو جديد';
  export let projectType: ProjectType = 'film';
  export let estimatedDurationMin: number | null = null;
  export let episodeCount: number | null = null;
  export let saveState: 'saved' | 'saving' | 'error' = 'saved';
  export let onProjectTitle: (value: string) => void;
  export let onProjects: () => void;
  export let onProjectFile: () => void;
  export let onImportPaste: () => void;
  export let onImportDocx: () => void;
  // Kept as compatibility props while App.svelte is left stable; Fountain is no longer exposed in the UI.
  export let onImportFountain: () => void;
  export let onFountain: () => void;
  export let onExport: () => void;
  export let onAi: () => void;

  const headerIcon = 'data:image/png;base64,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';

  const typeLabels: Record<ProjectType, string> = {
    film: 'فيلم سينمائي',
    series: 'مسلسل تلفزيوني',
    short: 'فيلم قصير',
    documentary: 'سيناريو وثائقي'
  };

  let importMenuOpen = false;

  function chooseImport(action: () => void) {
    importMenuOpen = false;
    action();
  }

  $: projectMeta = projectType === 'series'
    ? `${typeLabels[projectType]}${episodeCount ? ` · ${episodeCount} حلقة` : ''}${estimatedDurationMin ? ` · ${estimatedDurationMin} د/حلقة` : ''}`
    : `${typeLabels[projectType]}${estimatedDurationMin ? ` · ${estimatedDurationMin} دقيقة` : ''}`;
</script>

<header class="topbar" dir="rtl">
  <div class="brand-area">
    <div class="brand">
      <div class="logo-mark"><img src={headerIcon} alt="شعار التطبيق" /></div>
      <div class="brand-copy" dir="rtl">
        <div class="app-name">{title}</div>
        <div class="app-sub">المساعد في التحرير والتنسيق</div>
        <div class="app-credit">إعداد التطبيق: بوسرحان الزيتوني · باستعمال ChatGPT</div>
      </div>
    </div>
    <IconButton icon="projects" label="المشاريع" onClick={onProjects} />
  </div>

  <div class="project-center">
    <input
      class="project-title"
      value={projectTitle}
      aria-label="عنوان المشروع"
      on:input={(e) => onProjectTitle((e.currentTarget as HTMLInputElement).value)}
    />
    <button class="project-meta" on:click={onProjectFile} title="فتح ملف المشروع">{projectMeta}</button>
    <span class:busy={saveState === 'saving'} class:error={saveState === 'error'} class="save-state">
      <i></i>{saveState === 'saving' ? 'يحفظ...' : saveState === 'error' ? 'تعذر الحفظ' : 'محفوظ'}
    </span>
  </div>

  <div class="actions" aria-label="أوامر المشروع">
    <IconButton icon="file" label="ملف المشروع" onClick={onProjectFile} />
    <div class="import-wrap">
      <IconButton icon="import" label="استيراد" active={importMenuOpen} onClick={() => importMenuOpen = !importMenuOpen} />
      {#if importMenuOpen}
        <div class="import-menu" dir="rtl">
          <button type="button" on:click={() => chooseImport(onImportPaste)}>
            <b>لصق نص</b><small>التعرّف من الحافظة أو نص منسوخ</small>
          </button>
          <button type="button" on:click={() => chooseImport(onImportDocx)}>
            <b>Word · DOCX</b><small>استخراج الفقرات ثم المعاينة</small>
          </button>
        </div>
      {/if}
    </div>
    <IconButton icon="sparkles" label="المساعد التحليلي" onClick={onAi} />
    <IconButton icon="export" label="تصدير" primary onClick={onExport} />
  </div>
</header>

<style>
  .topbar { height:78px; border-bottom:1px solid var(--line); background:var(--panel); display:grid; grid-template-columns:1fr minmax(320px, 520px) 1fr; align-items:center; padding:0 16px; position:relative; z-index:60; box-shadow:var(--shadow-sm); }
  .brand-area { display:flex; align-items:center; gap:10px; justify-self:start; direction:ltr; min-width:0; }
  .brand { display:flex; align-items:center; gap:10px; direction:ltr; min-width:0; }
  .brand-copy { min-width:0; text-align:right; }
  .logo-mark { width:48px; height:48px; flex:0 0 48px; border-radius:10px; border:1px solid var(--line); background:#fff; display:grid; place-items:center; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,.06); }
  .logo-mark img { width:46px; height:46px; object-fit:contain; display:block; }
  .app-name { font-size:15.5px; font-weight:800; color:var(--text); letter-spacing:.03em; line-height:1.1; }
  .app-sub { color:var(--muted); font-size:10.5px; margin-top:2px; direction:rtl; line-height:1.25; }
  .app-credit { color:var(--muted-2); font-size:8.5px; margin-top:2px; direction:rtl; white-space:nowrap; line-height:1.2; }
  .project-center { display:flex; flex-direction:column; align-items:center; justify-content:center; min-width:0; gap:1px; position:relative; padding-bottom:14px; }
  .project-title { width:min(360px, 100%); border:none; background:transparent; color:var(--text); text-align:center; font-size:16.5px; font-weight:780; outline:none; padding:4px 10px 2px; border-radius:8px; }
  .project-title:focus { background:var(--panel-2); box-shadow:inset 0 0 0 1px var(--line); }
  .project-meta { border:0; background:transparent; color:var(--muted); font-size:11px; padding:1px 5px; border-radius:5px; }
  .project-meta:hover { color:var(--text); background:var(--hover); }
  .save-state { position:absolute; bottom:1px; color:var(--muted-2); font-size:10.5px; display:flex; align-items:center; gap:5px; white-space:nowrap; }
  .save-state i { width:5px; height:5px; background:var(--green); border-radius:99px; }
  .save-state.busy i { background:var(--accent); animation:pulse 1s infinite; }
  .save-state.error i { background:var(--danger); }
  .actions { display:flex; gap:7px; justify-self:end; direction:ltr; }
  .import-wrap { position:relative; display:inline-grid; }
  .import-menu { position:absolute; top:48px; right:-6px; width:230px; z-index:260; padding:6px; border:1px solid var(--line); border-radius:11px; background:var(--panel); box-shadow:var(--shadow-md); direction:rtl; }
  .import-menu button { width:100%; border:0; border-radius:8px; background:transparent; padding:8px 9px; text-align:right; color:var(--text); display:block; }
  .import-menu button:hover { background:var(--hover); }
  .import-menu b { display:block; font-size:11.5px; }
  .import-menu small { display:block; color:var(--muted); font-size:9.5px; margin-top:2px; }
  @keyframes pulse { 50% { opacity:.35; } }
  @media (max-width: 1260px) { .app-credit{display:none}.topbar{height:74px}.logo-mark{width:42px;height:42px;flex-basis:42px}.logo-mark img{width:40px;height:40px} }
  @media (max-width: 1130px) { .app-sub{display:none}.topbar{grid-template-columns:1fr minmax(280px,440px) 1fr} }
  @media (max-width: 930px) { .topbar { grid-template-columns:1fr 1fr; } .project-center { display:none; } }
</style>
