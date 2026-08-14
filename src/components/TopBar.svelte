<script lang="ts">
  import type { ProjectType } from '../lib/types';
  import AppIcon from './AppIcon.svelte';
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
  export let onImportFountain: () => void;
  export let onFountain: () => void;
  export let onExport: () => void;
  export let onAi: () => void;

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
      <div class="logo-mark">SW</div>
      <div>
        <div class="app-name">{title}</div>
        <div class="app-sub">المساعد في التحرير والتنسيق</div>
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
          <button type="button" on:click={() => chooseImport(onImportFountain)}>
            <b>Fountain</b><small>قراءة البنية الصريحة ثم المعاينة</small>
          </button>
        </div>
      {/if}
    </div>
    <IconButton icon="fountain" label="معاينة Fountain" onClick={onFountain} />
    <IconButton icon="sparkles" label="المساعد التحليلي" onClick={onAi} />
    <IconButton icon="export" label="تصدير" primary onClick={onExport} />
  </div>
</header>

<style>
  .topbar { height:72px; border-bottom:1px solid var(--line); background:var(--panel); display:grid; grid-template-columns:1fr minmax(320px, 520px) 1fr; align-items:center; padding:0 16px; position:relative; z-index:60; box-shadow:var(--shadow-sm); }
  .brand-area { display:flex; align-items:center; gap:10px; justify-self:start; direction:ltr; }
  .brand { display:flex; align-items:center; gap:10px; direction:ltr; }
  .logo-mark { width:36px; height:36px; border-radius:10px; border:1px solid var(--line); background:linear-gradient(145deg,var(--panel),var(--panel-3)); display:grid; place-items:center; color:var(--accent); font-size:9px; font-weight:900; letter-spacing:.08em; }
  .app-name { font-size:15.5px; font-weight:800; color:var(--text); letter-spacing:.03em; }
  .app-sub { color:var(--muted); font-size:11px; margin-top:2px; direction:rtl; }
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
  @media (max-width: 1130px) { .app-sub{display:none}.topbar{grid-template-columns:1fr minmax(280px,440px) 1fr} }
  @media (max-width: 930px) { .topbar { grid-template-columns:1fr 1fr; } .project-center { display:none; } }
</style>
