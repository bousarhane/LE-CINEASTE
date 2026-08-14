<script lang="ts">
  export let content = '';
  export let onClose: () => void;
  export let onExport: () => void;
  let copied = false;
  async function copy() {
    await navigator.clipboard.writeText(content);
    copied = true;
    setTimeout(() => copied = false, 1200);
  }
</script>
<div class="modal-backdrop" on:click={onClose}>
  <div class="modal-card" on:click|stopPropagation>
    <div class="modal-head"><div><h2>Fountain</h2><p>نسخة نصية قابلة للنقل إلى برامج السيناريو المتوافقة.</p></div><button class="icon-button" on:click={onClose}>×</button></div>
    <div class="modal-body">
      <textarea readonly value={content}></textarea>
      <div class="actions"><button class="ghost-button" on:click={copy}>{copied ? 'تم النسخ' : 'نسخ'}</button><button class="primary-button" on:click={onExport}>حفظ .fountain</button></div>
    </div>
  </div>
</div>
<style>
  .modal-head>div p{margin:4px 0 0;color:var(--muted);font-size:10.5px}.modal-body textarea{width:100%;min-height:54vh;background:var(--panel);color:var(--text);border:1px solid var(--line);border-radius:10px;padding:14px;resize:vertical;outline:none;font:12px/1.75 ui-monospace,SFMono-Regular,Menlo,monospace;direction:auto}.actions{display:flex;justify-content:flex-end;gap:7px;margin-top:12px}
</style>
