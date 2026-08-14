<script lang="ts">
  export let onClose: () => void;
  export let onFountain: () => void;
  export let onDocx: () => void;
  export let onPrintScript: () => void;
  export let onPrintDossier: () => void;
</script>
<div class="modal-backdrop" on:click={onClose}>
  <div class="modal-card export" on:click|stopPropagation dir="rtl">
    <div class="modal-head"><div><h2>التصدير المهني</h2><p>ثلاث صيغ معتمدة: PDF وDOCX وFountain. يبقى ملف المشروع الكامل متاحاً كخيار PDF مستقل.</p></div><button class="icon-button" on:click={onClose}>×</button></div>
    <div class="modal-body options">
      <button class="featured" on:click={onPrintScript}><span>PDF</span><div><b>السيناريو - PDF</b><small>صفحة عنوان ثم سيناريو A4 مضبوط للطباعة والحفظ كـPDF.</small></div><em>←</em></button>
      <button on:click={onDocx}><span>W</span><div><b>السيناريو - DOCX</b><small>ملف Word قابل للتحرير مع RTL وتنسيق مستقل لكل عنصر سيناريو وترقيم الصفحات.</small></div><em>←</em></button>
      <button on:click={onFountain}><span>F</span><div><b>السيناريو - Fountain</b><small>نسخة نصية منظمة ومتوافقة مع أدوات كتابة السيناريو.</small></div><em>←</em></button>
      <button class="secondary" on:click={onPrintDossier}><span>PDF</span><div><b>ملف المشروع + السيناريو</b><small>الحكاية والشخصيات والأماكن ثم السيناريو، للاستخدام كملف تقديم.</small></div><em>←</em></button>
    </div>
  </div>
</div>
<style>
  .export{width:min(650px,96vw)}.modal-head>div p{margin:4px 0 0;color:var(--muted);font-size:11px;line-height:1.6}.options{display:flex;flex-direction:column;gap:8px}.options>button{display:grid;grid-template-columns:42px 1fr 20px;align-items:center;gap:11px;text-align:right;border:1px solid var(--line);background:var(--panel-2);color:var(--text);border-radius:11px;padding:11px}.options>button:hover{border-color:var(--accent-line);background:var(--panel-3)}.options>button.featured{border-color:var(--accent-line);background:var(--accent-soft)}.options>button.secondary{margin-top:4px}.options>button>span{width:38px;height:38px;border-radius:9px;display:grid;place-items:center;background:var(--panel-3);color:var(--accent);font-weight:850;font-size:12.5px}.options b{display:block;font-size:12.5px}.options small{display:block;color:var(--muted);font-size:10.5px;margin-top:3px;line-height:1.5}.options em{font-style:normal;color:var(--muted-2)}
</style>
