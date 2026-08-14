<script lang="ts">
  import type { Character, Location } from '../lib/types';

  export let projectId = '';
  export let characters: Character[] = [];
  export let scriptCharacterNames: string[] = [];
  export let locations: Location[] = [];
  export let onAddCharacter: (name: string) => void;
  export let onAddLocation: (name: string) => void;
  export let onInsertCharacter: (character: Character) => void;
  export let onInsertCharacterName: (name: string) => void;
  export let onPromoteCharacter: (name: string) => void;
  export let onInsertLocation: (location: Location) => void;
  export let onDeleteCharacter: (id: string) => void;
  export let onDeleteLocation: (id: string) => void;
  export let onEditCharacter: (id: string) => void;
  export let onEditLocation: (id: string) => void;

  let characterName = '';
  let locationName = '';

  function addCharacter() {
    const value = characterName.trim();
    if (!value) return;
    onAddCharacter(value);
    characterName = '';
  }
  function addLocation() {
    const value = locationName.trim();
    if (!value) return;
    onAddLocation(value);
    locationName = '';
  }
  function roleLabel(role: Character['role']) {
    if (role === 'main') return 'رئيسية';
    if (role === 'secondary') return 'ثانوية';
    return 'إضافية';
  }

  let dismissedScriptCharacterKeys: string[] = [];
  let loadedDismissedProjectId = '';

  function searchable(value: string) {
    return value
      .trim()
      .toLocaleLowerCase('ar')
      .replace(/[ًٌٍَُِّْـ]/g, '')
      .replace(/[\s]+/g, ' ')
      .replace(/[\s\.,،؛:;!؟?…]+$/g, '')
      .trim();
  }

  function dismissedStorageKey(id: string) {
    return `scene-writer-dismissed-script-characters:${id}`;
  }

  function loadDismissed(id: string) {
    if (typeof localStorage === 'undefined' || !id) return [];
    try {
      const raw = localStorage.getItem(dismissedStorageKey(id));
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
    } catch {
      return [];
    }
  }

  function saveDismissed(values: string[]) {
    if (typeof localStorage === 'undefined' || !projectId) return;
    localStorage.setItem(dismissedStorageKey(projectId), JSON.stringify(values));
  }

  function dismissScriptCharacter(name: string) {
    const key = searchable(name);
    if (!key || dismissedScriptCharacterKeys.includes(key)) return;
    dismissedScriptCharacterKeys = [...dismissedScriptCharacterKeys, key];
    saveDismissed(dismissedScriptCharacterKeys);
  }

  function restoreDismissedScriptCharacters() {
    dismissedScriptCharacterKeys = [];
    saveDismissed([]);
  }

  $: if (projectId !== loadedDismissedProjectId) {
    loadedDismissedProjectId = projectId;
    dismissedScriptCharacterKeys = loadDismissed(projectId);
  }

  $: projectCharacterKeys = new Set(characters.flatMap((character) => [character.name, ...(character.aliases ?? '').split(/[،,;؛|\n]+/)]).map(searchable).filter(Boolean));
  $: scriptNameMap = new Map(
    scriptCharacterNames
      .map((name) => name.trim())
      .filter(Boolean)
      .map((name) => [searchable(name), name] as const)
      .filter(([key]) => Boolean(key))
  );
  $: scriptOnlyNames = [...scriptNameMap.entries()]
    .filter(([key]) => !projectCharacterKeys.has(key) && !dismissedScriptCharacterKeys.includes(key))
    .map(([, name]) => name)
    .sort((a, b) => a.localeCompare(b, 'ar'));
</script>

<aside class="right-panel" dir="rtl">
  <section>
    <div class="section-title"><h2>الشخصيات</h2><span>{characters.length}</span></div>
    <p class="section-hint">انقر على الشخصية لإدراجها مباشرة في المشهد.</p>
    <div class="entity-list">
      {#each characters as character (character.id)}
        <div class="entity-row">
          <button class="entity" on:click={() => onInsertCharacter(character)} title={`إدراج ${character.name} في المشهد`}>
            <i style={`background:${character.color}`}></i>
            <span><b>{character.name}</b><small>{character.dramaticFunction || character.occupation || roleLabel(character.role)}</small></span>
            <em>↵</em>
          </button>
          <button class="edit-entity" on:click={() => onEditCharacter(character.id)} title={`فتح بطاقة ${character.name}`} aria-label={`تحرير الشخصية ${character.name}`}>✎</button>
          <button class="delete-entity" on:click={() => onDeleteCharacter(character.id)} title={`حذف ${character.name}`} aria-label={`حذف الشخصية ${character.name}`}>×</button>
        </div>
      {/each}
    </div>
    {#if scriptOnlyNames.length}
      <div class="script-characters">
        <div class="script-characters-head">
          <span>شخصيات جديدة مكتشفة</span>
          <div class="script-head-actions">
            {#if dismissedScriptCharacterKeys.length}
              <button class="restore-dismissed" on:click={restoreDismissedScriptCharacters} title="إعادة إظهار الاقتراحات المستبعدة" aria-label="إعادة إظهار الاقتراحات المستبعدة">↺</button>
            {/if}
            <em>{scriptOnlyNames.length}</em>
          </div>
        </div>
        {#each scriptOnlyNames as name (name)}
          <div class="script-character-row">
            <button class="script-character" on:click={() => onInsertCharacterName(name)} title={`إدراج ${name}`}><span>◌</span><b>{name}</b><small>غير مضافة إلى ملف الشخصيات</small></button>
            <button class="promote-character" on:click={() => onPromoteCharacter(name)} title={`إضافة ${name} إلى ملف الشخصيات`} aria-label={`إضافة ${name} إلى ملف الشخصيات`}>＋</button>
            <button class="dismiss-character" on:click={() => dismissScriptCharacter(name)} title={`تجاهل الاقتراح «${name}» فقط — لن يتغير نص السيناريو`} aria-label={`تجاهل اقتراح الشخصية ${name}`}>×</button>
          </div>
        {/each}
      </div>
    {/if}
    <div class="quick-add">
      <input class="field" bind:value={characterName} placeholder="اسم شخصية جديدة" on:keydown={(e) => e.key === 'Enter' && addCharacter()} />
      <button on:click={addCharacter}>＋</button>
    </div>
  </section>

  <section class="locations">
    <div class="section-title"><h2>المواقع</h2><span>{locations.length}</span></div>
    <p class="section-hint">أضف المكان دون مغادرة صفحة الكتابة.</p>
    <div class="entity-list">
      {#each locations as location (location.id)}
        <div class="entity-row">
          <button class="entity location" on:click={() => onInsertLocation(location)} title={`إدراج الموقع ${location.name}`}>
            <i></i>
            <span><b>{location.name}</b><small>{location.kind}</small></span>
            <em>↵</em>
          </button>
          <button class="edit-entity" on:click={() => onEditLocation(location.id)} title={`فتح بطاقة ${location.name}`} aria-label={`تحرير الموقع ${location.name}`}>✎</button>
          <button class="delete-entity" on:click={() => onDeleteLocation(location.id)} title={`حذف ${location.name}`} aria-label={`حذف الموقع ${location.name}`}>×</button>
        </div>
      {/each}
    </div>
    <div class="quick-add">
      <input class="field" bind:value={locationName} placeholder="موقع جديد" on:keydown={(e) => e.key === 'Enter' && addLocation()} />
      <button on:click={addLocation}>＋</button>
    </div>
  </section>

  <div class="sidebar-note">
    <span>⌘</span>
    <p><b>كتابة أسرع</b><br />انقر الاسم لإدراجه في المشهد، أو استخدم ✎ لفتح بطاقته الكاملة داخل ملف المشروع.</p>
  </div>
</aside>

<style>
  .right-panel { width:270px; flex:0 0 270px; height:100%; background:var(--panel); border-left:1px solid var(--line); overflow:auto; padding:17px 14px; }
  section + section { margin-top:24px; padding-top:21px; border-top:1px solid var(--line-soft); }
  .section-title { display:flex; justify-content:space-between; align-items:center; }
  h2 { font-size:17px; margin:0; color:var(--text); font-weight:820; } .section-title span { min-width:24px; height:22px; display:grid; place-items:center; border-radius:99px; background:var(--panel-3); color:var(--muted); font-size:11px; }
  .section-hint { margin:5px 0 10px; font-size:11.5px; line-height:1.7; color:var(--muted); }
  .entity-list { display:flex; flex-direction:column; gap:5px; }
  .entity-row { display:grid; grid-template-columns:minmax(0,1fr) 27px 27px; gap:4px; align-items:stretch; }
  .entity { width:100%; min-width:0; display:flex; align-items:center; gap:9px; text-align:right; background:transparent; border:1px solid transparent; border-radius:9px; padding:8px 8px; color:var(--text); }
  .entity:hover { background:var(--hover); border-color:var(--line); }
  .edit-entity,.delete-entity { width:27px; min-width:27px; border-radius:8px; border:1px solid transparent; background:transparent; color:var(--muted-2); line-height:1; opacity:.45; transition:.15s ease; }
  .edit-entity{font-size:12px}.delete-entity{font-size:17px}
  .entity-row:hover .edit-entity,.entity-row:hover .delete-entity { opacity:1; }
  .edit-entity:hover { color:var(--accent); background:var(--accent-soft); border-color:var(--accent-line); }
  .delete-entity:hover { color:var(--danger); background:var(--danger-soft); border-color:var(--danger-line); }
  .entity i { width:8px; height:8px; border-radius:99px; flex:0 0 auto; box-shadow:0 0 10px rgba(255,255,255,.1); }
  .entity.location i { border-radius:2px; background:var(--muted-2); transform:rotate(45deg); }
  .entity span { min-width:0; flex:1; } .entity b { display:block; font-size:13.5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; } .entity small { color:var(--muted); font-size:11px; display:block; margin-top:2px; }
  .entity em { font-style:normal; color:var(--muted-2); font-size:12px; opacity:0; } .entity:hover em { opacity:1; }
  .script-characters{margin-top:10px;padding-top:9px;border-top:1px dashed var(--line-soft)}
  .script-characters-head{display:flex;align-items:center;justify-content:space-between;color:var(--muted);font-size:10px;margin:0 4px 5px}.script-characters-head em{font-style:normal;background:var(--panel-3);border-radius:99px;padding:2px 6px}.script-head-actions{display:flex;align-items:center;gap:4px}.restore-dismissed{width:22px;height:22px;display:grid;place-items:center;border:1px solid transparent;border-radius:7px;background:transparent;color:var(--muted);font-size:13px}.restore-dismissed:hover{color:var(--accent);background:var(--accent-soft);border-color:var(--accent-line)}
  .script-character-row{display:grid;grid-template-columns:minmax(0,1fr) 27px 27px;gap:4px;align-items:stretch}.script-character{min-width:0;border:1px solid transparent;background:transparent;border-radius:8px;color:var(--text-2);display:grid;grid-template-columns:14px minmax(0,1fr);grid-template-rows:auto auto;column-gap:6px;text-align:right;padding:6px 7px}.script-character:hover{background:var(--hover);border-color:var(--line)}.script-character>span{grid-row:1/3;color:var(--muted-2);align-self:center}.script-character b{font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.script-character small{font-size:9.5px;color:var(--muted)}.promote-character,.dismiss-character{width:27px;border:1px solid transparent;border-radius:8px;background:transparent;color:var(--muted)}.promote-character:hover{color:var(--accent);background:var(--accent-soft);border-color:var(--accent-line)}.dismiss-character{font-size:16px;opacity:.62}.script-character-row:hover .dismiss-character{opacity:1}.dismiss-character:hover{color:var(--danger);background:var(--danger-soft);border-color:var(--danger-line)}
  .quick-add { display:grid; grid-template-columns:1fr 35px; gap:6px; margin-top:9px; direction:rtl; }
   .quick-add .field { padding:9px 10px; font-size:12px; border-radius:8px; }
  .quick-add button { border:1px solid var(--line); background:var(--panel-3); color:var(--text); border-radius:8px; font-size:16px; }
  .quick-add button:hover { color:var(--accent); border-color:var(--accent-line); }
  .sidebar-note { margin-top:26px; border:1px solid var(--line); background:var(--panel-2); border-radius:11px; padding:11px; display:flex; gap:9px; color:var(--muted); }
  .sidebar-note > span { color:var(--accent); } .sidebar-note p { margin:0; font-size:11.5px; line-height:1.75; } .sidebar-note b { color:var(--text-2); }
  @media(max-width:1200px){ .right-panel{ width:235px; flex-basis:235px; } }
  @media(max-width:1000px){ .right-panel{ display:none; } }
</style>
