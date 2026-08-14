<script lang="ts">
  import IconButton from './IconButton.svelte';

  export let treeOpen = false;
  export let theme: 'light' | 'dark' = 'light';
  export let onTree: () => void;
  export let onStory: () => void;
  export let onScenes: () => void;
  export let onCharacters: () => void;
  export let onLocations: () => void;
  export let onAssistant: () => void;
  export let onTheme: () => void;
</script>

<nav class="nav-rail" aria-label="التنقل الرئيسي" dir="rtl">
  <div class="rail-top">
    <IconButton icon="folder" label="هيكل المشروع" active={treeOpen} placement="left" onClick={onTree} />
    <span class="separator"></span>
    <IconButton icon="story" label="الحكاية والمعالجة" placement="left" onClick={onStory} />
    <IconButton icon="scenes" label="المشاهد" placement="left" onClick={onScenes} />
    <IconButton icon="users" label="الشخصيات" placement="left" onClick={onCharacters} />
    <IconButton icon="location" label="الأماكن" placement="left" onClick={onLocations} />
    <span class="separator"></span>
    <IconButton icon="sparkles" label="المساعد التحليلي" placement="left" onClick={onAssistant} />
  </div>
  <div class="rail-bottom">
    <IconButton icon={theme === 'light' ? 'moon' : 'sun'} label={theme === 'light' ? 'تفعيل النمط الداكن' : 'تفعيل النمط الفاتح'} placement="left" onClick={onTheme} />
  </div>
</nav>

<style>
  .nav-rail { width:54px; flex:0 0 54px; height:100%; background:var(--panel); border-left:1px solid var(--line); display:flex; flex-direction:column; justify-content:space-between; align-items:center; padding:9px 7px; position:relative; z-index:50; }
  .rail-top,.rail-bottom { display:flex; flex-direction:column; gap:7px; align-items:center; }
  .separator { width:28px; height:1px; background:var(--line-soft); margin:3px 0; }
</style>
