<script lang="ts">
  import type { ProjectSnapshot, Scene } from '../lib/types';
  import { analyzeSceneStructure } from '../lib/sceneAnalysis';
  import { analyzeAssistantScope } from '../lib/assistantAnalysis';
  import { episodeLabel } from '../lib/structure';

  export let snapshot: ProjectSnapshot;
  export let scene: Scene | null = null;
  export let episodeId = '';
  export let onClose: () => void;
  export let onSelectScene: (id: string, blockId?: string) => void = () => {};
  export let docked = false;

  type Mode = 'scene' | 'episode' | 'project';
  type View = 'overview' | 'scenes' | 'characters' | 'consistency';
  let mode: Mode = 'scene';
  let view: View = 'overview';

  const typeLabels: Record<string, string> = {
    scene_heading: 'عنوان مشهد',
    action: 'وصف',
    action_line: 'فعل',
    character: 'شخصية',
    dialogue: 'حوار',
    parenthetical: 'حالة',
    direction: 'توجيه',
    transition: 'انتقال'
  };
  const roleLabels: Record<string, string> = { main: 'رئيسية', secondary: 'ثانوية', extra: 'إضافية' };
  const categoryLabels: Record<string, string> = { characters: 'الشخصيات', locations: 'الأماكن', scenes: 'المشاهد', text: 'النص' };

  $: current = analyzeSceneStructure(snapshot, scene);
  $: activeEpisodeId = episodeId || scene?.episodeId || snapshot.episodes[0]?.id || '';
  $: episodeSnapshot = { ...snapshot, scenes: snapshot.scenes.filter((item) => item.episodeId === activeEpisodeId) };
  $: episodeAnalysis = analyzeAssistantScope(episodeSnapshot);
  $: projectAnalysis = analyzeAssistantScope(snapshot);
  $: sceneComparisonScope = snapshot.project.projectType === 'series' ? episodeAnalysis : projectAnalysis;
  $: sceneScopeMetric = scene ? sceneComparisonScope.sceneMetrics.find((item) => item.id === scene.id) ?? null : null;
  $: scopeAnalysis = mode === 'episode' ? episodeAnalysis : projectAnalysis;
  $: scopeLabel = mode === 'episode'
    ? episodeLabel(snapshot, activeEpisodeId)
    : snapshot.project.projectType === 'series' ? snapshot.project.title : snapshot.project.title;
  $: attentionCount = current.notices.filter((notice) => notice.tone === 'attention').length;
  $: episodeAttentionCount = episodeAnalysis.consistency.filter((item) => item.tone === 'attention').length;
  $: projectAttentionCount = projectAnalysis.consistency.filter((item) => item.tone === 'attention').length;
  $: if (snapshot.project.projectType !== 'series' && mode === 'episode') mode = 'project';
  $: if (mode === 'scene' && view !== 'overview') view = 'overview';

  function setMode(next: Mode) {
    mode = next;
    view = 'overview';
  }

  function goScene(id: string, blockId = '') {
    onSelectScene(id, blockId);
    mode = 'scene';
    view = 'overview';
  }

  function pct(value: number): string {
    return `${Math.round(value * 100)}%`;
  }

  function pp(value: number): string {
    const points = Math.round(value * 100);
    return `${points > 0 ? '+' : ''}${points}`;
  }
</script>

{#if !docked}<div class="drawer-backdrop" on:click={onClose}></div>{/if}
<aside class:docked class="ai-drawer" dir="rtl">
  <header>
    <div>
      <span class="eyebrow">المساعد التحليلي · محلي</span>
      <h2>قراءة بنيوية للسيناريو</h2>
      <p><i></i>يقيس · يقارن · يكشف الاتساق · ولا يكتب بدل الكاتب</p>
    </div>
    <button class="close" on:click={onClose} aria-label="إغلاق">×</button>
  </header>

  <nav class:three-tabs={snapshot.project.projectType === 'series'} class="analysis-tabs" aria-label="مستوى التحليل">
    <button class:active={mode === 'scene'} on:click={() => setMode('scene')}>
      المشهد الحالي
      {#if attentionCount}<span>{attentionCount}</span>{/if}
    </button>
    {#if snapshot.project.projectType === 'series'}
      <button class:active={mode === 'episode'} on:click={() => setMode('episode')}>
        الحلقة الحالية
        {#if episodeAttentionCount}<span>{episodeAttentionCount}</span>{/if}
      </button>
    {/if}
    <button class:active={mode === 'project'} on:click={() => setMode('project')}>
      {snapshot.project.projectType === 'series' ? 'المسلسل الكامل' : 'العمل الكامل'}
      {#if projectAttentionCount}<span>{projectAttentionCount}</span>{/if}
    </button>
  </nav>

  {#if mode !== 'scene'}
    <nav class="view-tabs" aria-label="نوع القراءة">
      <button class:active={view === 'overview'} on:click={() => view = 'overview'}>نظرة عامة</button>
      <button class:active={view === 'scenes'} on:click={() => view = 'scenes'}>المشاهد</button>
      <button class:active={view === 'characters'} on:click={() => view = 'characters'}>الشخصيات</button>
      <button class:active={view === 'consistency'} on:click={() => view = 'consistency'}>
        الاتساق
        {#if scopeAnalysis.consistency.length}<span>{scopeAnalysis.consistency.length}</span>{/if}
      </button>
    </nav>
  {/if}

  <div class="content">
    {#if mode === 'scene'}
      <section>
        <div class="section-intro">
          <span class="section-kicker">المشهد الحالي</span>
          <h3>{scene ? `مشهد ${scene.orderIndex + 1}: ${scene.heading || 'بلا عنوان'}` : 'لا يوجد مشهد محدد'}</h3>
          <p>النتائج مشتقة من العناصر المنظمة داخل المحرر، وليست حكماً على الجودة أو الإيقاع أو القيمة الدرامية.</p>
        </div>

        <div class="metric-grid">
          <div><b>{current.contentWords}</b><span>كلمة محتوى</span></div>
          <div><b>{current.pages.toFixed(1)}</b><span>صفحة تقريباً</span></div>
          <div><b>{pct(current.dialogueRatio)}</b><span>حوار</span></div>
        </div>

        <div class="composition-bar" aria-label="توزيع محتوى المشهد">
          <span class="dialogue" style={`width:${current.dialogueRatio * 100}%`}></span>
          <span class="description" style={`width:${current.descriptionRatio * 100}%`}></span>
          <span class="action" style={`width:${current.actionRatio * 100}%`}></span>
          <span class="direction" style={`width:${current.directionRatio * 100}%`}></span>
        </div>
        <div class="composition-legend">
          <span><i class="dialogue-dot"></i>حوار {current.dialogueWords}</span>
          <span><i class="description-dot"></i>وصف {current.descriptionWords}</span>
          <span><i class="action-dot"></i>فعل {current.actionWords}</span>
          <span><i class="direction-dot"></i>توجيه {current.directionWords}</span>
          <span>حالة {current.parentheticalWords}</span>
        </div>

        {#if sceneScopeMetric && sceneScopeMetric.contentWords >= 20}
          <div class="panel comparison-panel">
            <div class="panel-title-row"><h4>مقارنة مع {snapshot.project.projectType === 'series' ? 'وسيط الحلقة' : 'وسيط العمل'}</h4><span>وصفي</span></div>
            <div class="comparison-grid">
              <div><span>الحوار</span><b>{pct(sceneScopeMetric.dialogueRatio)}</b><small>{pp(sceneScopeMetric.dialogueDeltaFromMedian)} نقطة</small></div>
              <div><span>الوصف</span><b>{pct(sceneScopeMetric.descriptionRatio)}</b><small>{pp(sceneScopeMetric.descriptionDeltaFromMedian)} نقطة</small></div>
              <div><span>الفعل</span><b>{pct(sceneScopeMetric.actionRatio)}</b><small>{pp(sceneScopeMetric.actionDeltaFromMedian)} نقطة</small></div>
            </div>
            <p class="micro-note">الفرق محسوب بالنسبة إلى وسيط المشاهد في النطاق نفسه، ولا يعني بطئاً أو سرعة أو جودة.</p>
          </div>
        {/if}

        <div class="panel notices-panel">
          <div class="panel-title-row"><h4>مؤشرات قابلة للمراجعة</h4><span class:has-attention={attentionCount > 0}>{current.notices.length}</span></div>
          {#if current.notices.length}
            <div class="notice-list">
              {#each current.notices as notice}
                <article class:attention={notice.tone === 'attention'} class:context={notice.tone === 'context'}>
                  <div class="notice-mark"></div><div><b>{notice.title}</b><p>{notice.detail}</p></div>
                </article>
              {/each}
            </div>
          {:else}
            <p class="empty positive">لا توجد حالياً فروق بنيوية لافتة تستحق التسجيل.</p>
          {/if}
        </div>

        <div class="panel">
          <h4>توزيع الحوار</h4>
          {#if current.speakers.length}
            <div class="speaker-list">
              {#each current.speakers as speaker}
                <div class="speaker-row">
                  <div class="speaker-head"><b>{speaker.name}</b><span>{speaker.words} كلمة · {speaker.turns} مداخلة</span></div>
                  <div class="speaker-bar"><i style={`width:${speaker.share * 100}%`}></i></div>
                  <small>{pct(speaker.share)}</small>
                </div>
              {/each}
            </div>
          {:else}<p class="empty">لا توجد مداخلات حوارية مصنفة في هذا المشهد.</p>{/if}
        </div>

        <div class="split-grid">
          <article><span>أطول مداخلة</span><b>{current.longestDialogue?.words ?? 0}</b><small>كلمة</small></article>
          <article><span>أطول وصف</span><b>{current.longestDescription?.words ?? 0}</b><small>كلمة</small></article>
          <article><span>أطول فعل</span><b>{current.longestAction?.words ?? 0}</b><small>كلمة</small></article>
          <article><span>تتابع حواري</span><b>{current.longestDialogueRun.dialogueBlocks}</b><small>مداخلة</small></article>
        </div>

        <div class="panel">
          <h4>عناصر المشهد</h4>
          <div class="element-list">
            {#each Object.entries(current.elementCounts) as [type, count]}<div><span>{typeLabels[type] ?? type}</span><b>{count}</b></div>{/each}
            {#if Object.keys(current.elementCounts).length === 0}<p class="empty">لا توجد عناصر مكتوبة في هذا المشهد.</p>{/if}
          </div>
        </div>

        {#if current.repeatedTerms.length}
          <div class="panel">
            <h4>ألفاظ متكررة داخل المشهد</h4>
            <div class="chips">{#each current.repeatedTerms as item}<span>{item.term} <b>×{item.count}</b></span>{/each}</div>
            <p class="micro-note">التكرار هنا ملاحظة عددية فقط.</p>
          </div>
        {/if}
      </section>
    {:else}
      <section>
        <div class="section-intro">
          <span class="section-kicker">{mode === 'episode' ? 'الحلقة الحالية' : snapshot.project.projectType === 'series' ? 'المسلسل الكامل' : 'العمل الكامل'}</span>
          <h3>{scopeLabel}</h3>
          <p>يقرأ المساعد العلاقات والتوزيع والاتساق انطلاقاً من بيانات المشروع، من دون تقييم أدبي أو درجة نهائية.</p>
        </div>

        {#if view === 'overview'}
          <div class="metric-grid project-metrics">
            <div><b>{scopeAnalysis.sceneCount}</b><span>مشهد</span></div>
            <div><b>{scopeAnalysis.pages.toFixed(1)}</b><span>صفحة تقريباً</span></div>
            <div><b>{scopeAnalysis.contentWords}</b><span>كلمة محتوى</span></div>
            <div><b>{pct(scopeAnalysis.dialogueRatio)}</b><span>حوار</span></div>
            <div><b>{scopeAnalysis.characterMetrics.filter((item) => item.sceneCount > 0).length}</b><span>شخصية حاضرة</span></div>
            <div><b>{scopeAnalysis.locationMetrics.filter((item) => item.name !== 'غير محدد').length}</b><span>موقع مستخدم</span></div>
          </div>

          <div class="panel">
            <h4>تركيب النص</h4>
            <div class="composition-bar large">
              <span class="dialogue" style={`width:${scopeAnalysis.dialogueRatio * 100}%`}></span>
              <span class="description" style={`width:${scopeAnalysis.descriptionRatio * 100}%`}></span>
              <span class="action" style={`width:${scopeAnalysis.actionRatio * 100}%`}></span>
              <span class="direction" style={`width:${scopeAnalysis.directionRatio * 100}%`}></span>
            </div>
            <div class="composition-legend compact">
              <span>حوار {scopeAnalysis.dialogueWords}</span><span>وصف {scopeAnalysis.descriptionWords}</span><span>فعل {scopeAnalysis.actionWords}</span><span>توجيه {scopeAnalysis.directionWords}</span><span>حالة {scopeAnalysis.parentheticalWords}</span>
            </div>
          </div>

          <div class="panel heading-panel">
            <h4>عناوين المشاهد</h4>
            <div class="heading-stats">
              <span>داخلي <b>{scopeAnalysis.headingCounts.interior}</b></span>
              <span>خارجي <b>{scopeAnalysis.headingCounts.exterior}</b></span>
              <span>مختلط <b>{scopeAnalysis.headingCounts.mixed}</b></span>
              <span>غير محدد <b>{scopeAnalysis.headingCounts.unknownKind}</b></span>
              <span>نهار/صباح <b>{scopeAnalysis.headingCounts.day}</b></span>
              <span>ليل <b>{scopeAnalysis.headingCounts.night}</b></span>
            </div>
          </div>

          <div class="panel">
            <h4>الأماكن الأكثر حضوراً</h4>
            {#if scopeAnalysis.locationMetrics.length}
              <div class="location-list">
                {#each scopeAnalysis.locationMetrics.slice(0, 8) as location}
                  <div><span>{location.name}</span><b>{location.sceneCount} مشهد</b><small>{pct(location.share)}</small></div>
                {/each}
              </div>
            {:else}<p class="empty">لا توجد بيانات أماكن بعد.</p>{/if}
          </div>

          {#if scopeAnalysis.repeatedTerms.length}
            <div class="panel">
              <h4>ألفاظ متكررة على مستوى النطاق</h4>
              <div class="chips">{#each scopeAnalysis.repeatedTerms as item}<span>{item.term} <b>×{item.count}</b></span>{/each}</div>
              <p class="micro-note">للمراجعة فقط؛ بعض التكرار مقصود أسلوبياً أو درامياً.</p>
            </div>
          {/if}

          <button class="consistency-summary" on:click={() => view = 'consistency'}>
            <span><b>{scopeAnalysis.consistency.length}</b> ملاحظة اتساق قابلة للفحص</span>
            <small>فتح التفاصيل ←</small>
          </button>

        {:else if view === 'scenes'}
          <div class="panel scene-list-panel">
            <div class="panel-title-row"><h4>خريطة المشاهد</h4><span>{scopeAnalysis.sceneMetrics.length}</span></div>
            {#if scopeAnalysis.sceneMetrics.length}
              <div class="scene-list">
                {#each scopeAnalysis.sceneMetrics as item}
                  <button class:current={scene?.id === item.id} on:click={() => goScene(item.id)}>
                    <span class="scene-no">{item.index}</span>
                    <span class="scene-main">
                      <b>{item.heading}</b>
                      <small>{item.place || 'مكان غير محدد'} · {item.speakerNames.length} متكلم · {item.contentWords} كلمة</small>
                    </span>
                    <span class="scene-side"><b>{item.pages.toFixed(1)} ص</b><small>{pct(item.dialogueRatio)} حوار</small></span>
                    {#if item.missingMetadata.length}<span class="warning-dot" title={`ينقص: ${item.missingMetadata.join('، ')}`}>!</span>{/if}
                  </button>
                {/each}
              </div>
            {:else}<p class="empty">لا توجد مشاهد في هذا النطاق.</p>{/if}
          </div>

        {:else if view === 'characters'}
          {#if scopeAnalysis.characterMetrics.length}
            <div class="character-cards">
              {#each scopeAnalysis.characterMetrics as character}
                <article class="character-card">
                  <div class="character-title">
                    <span><b>{character.name}</b><small>{roleLabels[character.role] ?? character.role}</small></span>
                    <strong>{character.sceneCount}/{scopeAnalysis.sceneCount}</strong>
                  </div>
                  {#if character.aliases.length}
                    <div class="alias-row"><span>أسماء بديلة:</span>{#each character.aliases as alias}<em>{alias}</em>{/each}</div>
                  {/if}
                  <div class="character-metrics">
                    <span><b>{character.speakingSceneCount}</b> مشهد متكلم</span>
                    <span><b>{character.dialogueTurns}</b> مداخلة</span>
                    <span><b>{character.dialogueWords}</b> كلمة حوار</span>
                    <span><b>{character.maxGap}</b> أكبر فجوة داخلية</span>
                  </div>
                  {#if character.firstScene}
                    <p class="micro-note">الظهور: من المشهد {character.firstScene} إلى {character.lastScene}.</p>
                  {/if}
                  {#if character.dialogueTurns}
                    <div class="fingerprint-grid">
                      <span><small>متوسط المداخلة</small><b>{character.averageTurnWords.toFixed(1)}</b><em>كلمة</em></span>
                      <span><small>وسيط المداخلة</small><b>{Math.round(character.medianTurnWords)}</b><em>كلمة</em></span>
                      <span><small>أطول مداخلة</small><b>{character.longestTurnWords}</b><em>كلمة</em></span>
                      <span><small>تنوع المفردات</small><b>{character.lexicalDiversity === null ? '—' : pct(character.lexicalDiversity)}</b><em>{character.lexicalDiversity === null ? 'عينة قصيرة' : `${character.lexicalSampleWords} كلمة`}</em></span>
                    </div>
                    {#if character.signatureTerms.length}
                      <div class="signature-row"><span>ألفاظ بارزة في حواره:</span>{#each character.signatureTerms as item}<em>{item.term} · {item.count}</em>{/each}</div>
                    {/if}
                  {/if}
                  {#if character.coAppearances.length}
                    <div class="co-row"><span>الأكثر اجتماعاً:</span>{#each character.coAppearances.slice(0, 3) as co}<em>{co.name} · {co.scenes}</em>{/each}</div>
                  {/if}
                  {#if character.outlierTurns.length}
                    <div class="outlier-row">
                      <span>مداخلات مختلفة عن النمط المعتاد:</span>
                      {#each character.outlierTurns as turn}
                        <button on:click={() => goScene(turn.sceneId, turn.blockId)}>م {turn.sceneIndex} · {turn.words} كلمة</button>
                      {/each}
                    </div>
                  {/if}
                </article>
              {/each}
            </div>
          {:else}<p class="empty">لا توجد شخصيات في ملف المشروع بعد.</p>{/if}

        {:else if view === 'consistency'}
          <div class="consistency-head">
            <p>هذه القائمة تركز على الأشياء التي يستطيع التطبيق التحقق منها: أسماء غير مسجلة أو بديلة، بيانات مشاهد ناقصة، أماكن غير موحدة، واختلافات إحصائية داخل النص.</p>
          </div>
          {#if scopeAnalysis.consistency.length}
            <div class="finding-list">
              {#each scopeAnalysis.consistency as finding}
                <article class:attention={finding.tone === 'attention'} class:context={finding.tone === 'context'}>
                  <div class="finding-top"><span>{categoryLabels[finding.category] ?? finding.category}</span>{#if finding.sceneIds.length}<small>{finding.sceneIds.length} موضع</small>{/if}</div>
                  <b>{finding.title}</b>
                  <p>{finding.detail}</p>
                  {#if finding.sceneIds.length}
                    <button on:click={() => goScene(finding.sceneIds[0])}>فتح أول موضع</button>
                  {/if}
                </article>
              {/each}
            </div>
          {:else}<p class="empty positive">لم يجد المساعد حالياً مسائل اتساق واضحة في هذا النطاق.</p>{/if}
        {/if}

        <div class="local-note">
          <b>حدود المساعد</b>
          <p>لا يعطي علامة من 10، ولا يقرر أن مشهداً جيد أو ضعيف، ولا يقترح حذف شخصية أو إعادة كتابة الحوار. يعرض بيانات وفروقاً قابلة للفحص ويترك القرار الإبداعي للكاتب.</p>
        </div>
      </section>
    {/if}
  </div>
</aside>

<style>
  .drawer-backdrop{position:fixed;inset:72px 0 30px;z-index:49;background:rgba(32,32,32,.12);backdrop-filter:blur(2px)}
  .ai-drawer{position:fixed;z-index:50;top:72px;bottom:30px;left:0;width:min(570px,98vw);background:var(--panel);border-right:1px solid var(--line);box-shadow:18px 0 48px rgba(0,0,0,.13);display:flex;flex-direction:column}
  .ai-drawer.docked{position:relative;z-index:auto;inset:auto;width:100%;height:100%;border-right:0;box-shadow:none}
  header{padding:17px 18px 13px;border-bottom:1px solid var(--line-soft);display:flex;justify-content:space-between;align-items:flex-start}.eyebrow{color:var(--accent);font-size:10px;font-weight:900}h2{margin:4px 0 5px;font-size:18px;color:var(--text)}header p{margin:0;color:var(--muted);font-size:10.5px;display:flex;align-items:center;gap:6px}header p i{width:7px;height:7px;border-radius:99px;background:var(--green)}.close{border:1px solid var(--line);background:var(--panel-2);color:var(--muted);width:32px;height:32px;border-radius:8px;font-size:19px;cursor:pointer}
  .analysis-tabs{display:grid;grid-template-columns:1fr 1fr;padding:8px 12px;border-bottom:1px solid var(--line-soft);background:var(--panel-2);gap:7px}.analysis-tabs.three-tabs{grid-template-columns:1fr 1fr 1fr}.analysis-tabs button,.view-tabs button{border:1px solid var(--line);background:var(--panel);color:var(--muted);border-radius:8px;padding:8px 10px;font-size:11px;font-weight:800;cursor:pointer}.analysis-tabs button.active,.view-tabs button.active{background:#eaf2fb;color:var(--accent);border-color:#a9c7ea}.analysis-tabs span,.view-tabs span{display:inline-grid;place-items:center;min-width:18px;height:18px;margin-right:5px;border-radius:99px;background:#fff0f0;color:#a4262c;font-size:9px}
  .view-tabs{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;padding:7px 12px;border-bottom:1px solid var(--line-soft);background:var(--panel)}.view-tabs button{padding:6px 5px;font-size:9.5px}
  .content{flex:1;overflow:auto;padding:16px 17px 24px}section{display:flex;flex-direction:column;gap:10px}.section-intro h3{margin:2px 0 4px;font-size:14px;line-height:1.5;color:var(--text)}.section-intro p{margin:0;color:var(--muted);font-size:10.5px;line-height:1.65}.section-kicker{font-size:9.5px;color:var(--accent);font-weight:850}
  .metric-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.metric-grid div{background:var(--panel-2);border:1px solid #d9dde3;border-radius:9px;padding:11px 8px;text-align:center}.metric-grid b{display:block;font-size:18px;color:var(--text)}.metric-grid span{font-size:9px;color:var(--muted)}.project-metrics{grid-template-columns:repeat(3,1fr)}
  .composition-bar{height:8px;border-radius:99px;overflow:hidden;background:#eceff3;display:flex;direction:ltr}.composition-bar.large{height:11px}.composition-bar span{display:block;height:100%}.composition-bar .dialogue{background:var(--accent)}.composition-bar .description{background:#7a9cc9}.composition-bar .action{background:#4f7f67}.composition-bar .direction{background:#9a7d57}.composition-legend{display:flex;flex-wrap:wrap;gap:10px;color:var(--muted);font-size:9px}.composition-legend.compact{margin-top:8px}.composition-legend span{display:flex;align-items:center;gap:4px}.composition-legend i{width:7px;height:7px;border-radius:99px;display:inline-block}.dialogue-dot{background:var(--accent)}.description-dot{background:#7a9cc9}.action-dot{background:#4f7f67}.direction-dot{background:#9a7d57}
  .panel{border:1px solid #d9dde3;border-radius:10px;padding:10px 11px;background:var(--panel)}.panel h4{margin:0 0 8px;color:var(--text-2);font-size:10.5px}.panel-title-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}.panel-title-row h4{margin:0}.panel-title-row>span{font-size:8.5px;border:1px solid #ddd;border-radius:99px;padding:3px 7px;color:var(--muted)}.panel-title-row>span.has-attention{color:#a4262c;border-color:#e1b7bb;background:#fff4f4}
  .notice-list{display:flex;flex-direction:column;gap:6px}.notice-list article{display:grid;grid-template-columns:4px 1fr;gap:8px;border:1px solid var(--line-soft);border-radius:8px;padding:8px;background:var(--panel-2)}.notice-mark{border-radius:99px;background:#7297c8}.notice-list article.attention .notice-mark{background:var(--danger)}.notice-list article.context .notice-mark{background:#ca5010}.notice-list article b{font-size:10px;color:var(--text-2)}.notice-list article p{margin:2px 0 0;color:var(--muted);font-size:9.5px;line-height:1.6}.empty{margin:0;color:var(--muted-2);font-size:10px;line-height:1.65}.positive{color:#557055}
  .speaker-list{display:flex;flex-direction:column;gap:8px}.speaker-row{display:grid;grid-template-columns:1fr 72px 34px;gap:7px;align-items:center}.speaker-head{min-width:0}.speaker-head b{display:block;font-size:10px;color:var(--text-2)}.speaker-head span{display:block;font-size:8.5px;color:var(--muted-2)}.speaker-bar{height:6px;background:#edf0f4;border-radius:99px;overflow:hidden;direction:ltr}.speaker-bar i{display:block;height:100%;background:var(--accent)}.speaker-row small{font-size:8.5px;color:var(--muted);text-align:left}
  .split-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px}.split-grid article{display:flex;align-items:baseline;gap:6px;border:1px solid #dde1e6;background:var(--panel);border-radius:9px;padding:10px}.split-grid span{flex:1;color:var(--muted);font-size:9.5px}.split-grid b{color:var(--accent);font-size:15px}.split-grid small{color:var(--muted-2);font-size:8.5px}.element-list{display:grid;grid-template-columns:1fr 1fr;gap:5px}.element-list>div{display:flex;justify-content:space-between;border-bottom:1px dashed var(--line-soft);padding:4px 0;color:var(--muted);font-size:9.5px}.element-list b{color:var(--text-2)}.chips{display:flex;flex-wrap:wrap;gap:5px}.chips span{border:1px solid var(--line);background:var(--panel-2);border-radius:99px;padding:4px 7px;color:var(--muted);font-size:9px}.micro-note{margin:7px 0 0;color:var(--muted-2);font-size:8.5px;line-height:1.6}
  .heading-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.heading-stats span{background:var(--panel-2);border:1px solid var(--line-soft);border-radius:7px;padding:7px;color:var(--muted);font-size:8.5px;text-align:center}.heading-stats b{display:block;color:var(--accent);font-size:13px;margin-top:2px}.location-list{display:flex;flex-direction:column;gap:2px}.location-list>div{display:grid;grid-template-columns:1fr 72px 34px;gap:6px;padding:5px 0;border-bottom:1px dashed #e4e4e4;font-size:9px}.location-list span{color:var(--text-2)}.location-list b{color:var(--muted)}.location-list small{color:var(--accent);text-align:left}
  .consistency-summary{border:1px solid #cbdced;background:#f2f7fd;color:var(--text-2);border-radius:10px;padding:11px 13px;display:flex;justify-content:space-between;align-items:center;cursor:pointer;text-align:right}.consistency-summary b{color:var(--accent);font-size:16px;margin-left:4px}.consistency-summary small{color:var(--accent);font-weight:800}
  .scene-list{display:flex;flex-direction:column;gap:5px}.scene-list button{position:relative;border:1px solid var(--line-soft);background:var(--panel-2);border-radius:8px;padding:7px 8px;display:grid;grid-template-columns:28px 1fr 62px;gap:7px;align-items:center;text-align:right;color:inherit;cursor:pointer}.scene-list button:hover,.scene-list button.current{border-color:#a9c7ea;background:#f3f7fc}.scene-no{width:25px;height:25px;display:grid;place-items:center;border-radius:7px;background:var(--panel);border:1px solid var(--line);font-weight:900;color:var(--accent);font-size:9px}.scene-main{min-width:0}.scene-main b{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--text-2);font-size:9.8px}.scene-main small,.scene-side small{display:block;color:var(--muted-2);font-size:7.9px;margin-top:2px}.scene-side{text-align:left}.scene-side b{font-size:9px;color:var(--muted)}.warning-dot{position:absolute;left:4px;top:4px;width:15px;height:15px;border-radius:99px;background:#fff0f0;color:#a4262c;display:grid;place-items:center;font-size:8px;font-weight:900}
  .character-cards{display:flex;flex-direction:column;gap:8px}.character-card{border:1px solid var(--line);border-radius:10px;padding:10px;background:var(--panel)}.character-title{display:flex;justify-content:space-between;align-items:flex-start}.character-title span b{display:block;font-size:11px;color:var(--text-2)}.character-title span small{font-size:8px;color:var(--muted-2)}.character-title strong{font-size:11px;color:var(--accent);background:#eef5fd;padding:4px 7px;border-radius:99px}.character-metrics{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-top:8px}.character-metrics span{font-size:8.5px;color:var(--muted);border-bottom:1px dashed var(--line-soft);padding:4px}.character-metrics b{color:var(--text-2)}.co-row,.outlier-row{display:flex;gap:5px;align-items:center;flex-wrap:wrap;margin-top:7px}.co-row>span,.outlier-row>span{font-size:8px;color:var(--muted-2)}.co-row em{font-style:normal;font-size:8px;background:var(--panel-2);border:1px solid var(--line-soft);padding:3px 6px;border-radius:99px}.outlier-row button{border:1px solid #d5c6aa;background:#fff9ee;color:#7c5c2f;border-radius:99px;padding:3px 6px;font-size:8px;cursor:pointer}
  .comparison-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.comparison-grid>div{border:1px solid var(--line-soft);background:var(--panel-2);border-radius:8px;padding:7px;text-align:center}.comparison-grid span,.comparison-grid small{display:block;color:var(--muted-2);font-size:8px}.comparison-grid b{display:block;color:var(--text-2);font-size:13px;margin:2px 0}.alias-row,.signature-row{display:flex;gap:5px;align-items:center;flex-wrap:wrap;margin-top:7px}.alias-row>span,.signature-row>span{font-size:8px;color:var(--muted-2)}.alias-row em,.signature-row em{font-style:normal;font-size:8px;background:var(--panel-2);border:1px solid var(--line-soft);padding:3px 6px;border-radius:99px}.fingerprint-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin-top:8px}.fingerprint-grid>span{border:1px solid var(--line-soft);background:var(--panel-2);border-radius:7px;padding:6px;text-align:center}.fingerprint-grid small,.fingerprint-grid em{display:block;font-style:normal;font-size:7.5px;color:var(--muted-2)}.fingerprint-grid b{display:block;font-size:11px;color:var(--text-2);margin:2px 0}
  .consistency-head p{margin:0 0 2px;color:var(--muted);font-size:9.5px;line-height:1.65}.finding-list{display:flex;flex-direction:column;gap:7px}.finding-list article{border:1px solid var(--line);border-right:4px solid #7894b7;border-radius:9px;padding:9px 10px;background:var(--panel)}.finding-list article.attention{border-right-color:var(--danger)}.finding-list article.context{border-right-color:#ca5010}.finding-top{display:flex;justify-content:space-between;margin-bottom:4px}.finding-top span{font-size:7.8px;color:var(--accent);font-weight:900}.finding-top small{font-size:7.5px;color:var(--muted-2)}.finding-list article>b{font-size:10px;color:var(--text-2)}.finding-list p{margin:3px 0 7px;color:var(--muted);font-size:9px;line-height:1.55}.finding-list button{border:1px solid var(--line);background:var(--panel-2);color:var(--accent);border-radius:6px;padding:4px 7px;font-size:8px;font-weight:800;cursor:pointer}
  .local-note{border:1px solid #d6e2f0;background:#f4f8fd;border-radius:10px;padding:10px 11px;color:#4d6075}.local-note b{font-size:10px}.local-note p{margin:3px 0 0;font-size:9px;line-height:1.65}
  @media(max-width:560px){.ai-drawer:not(.docked){width:100vw}.project-metrics{grid-template-columns:repeat(2,1fr)}.view-tabs{grid-template-columns:repeat(2,1fr)}}
</style>
