<script lang="ts">
  export let words = 0;
  export let pages = 0;
  export let scenes = 0;
  export let desktop = false;
</script>
<footer class="statusbar" dir="rtl">
  <div><span class="dot"></span>{desktop ? 'قاعدة SQLite محلية' : 'وضع معاينة المتصفح'}</div>
  <div class="stats"><span>{scenes} مشاهد</span><span>{words} كلمة</span><span>{pages.toFixed(1)} صفحة · ≈ {pages.toFixed(1)} دقيقة</span><span>RTL / LTR</span></div>
</footer>
<style>
  .statusbar{height:34px;border-top:1px solid var(--line);background:var(--bg);display:flex;align-items:center;justify-content:space-between;padding:0 14px;color:var(--muted);font-size:11px;position:relative;z-index:30}.statusbar>div{display:flex;align-items:center;gap:7px}.dot{width:6px;height:6px;border-radius:99px;background:var(--green)}.stats{gap:16px!important;direction:ltr}@media(max-width:800px){.stats span:nth-child(4),.stats span:nth-child(3){display:none}}
</style>
