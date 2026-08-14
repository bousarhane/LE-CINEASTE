<script lang="ts">
  import type { Character, Location, ProjectSnapshot } from '../lib/types';
  import { detectLang } from '../lib/screenplayEngine';
  import { episodeLabel, orderedScenes } from '../lib/structure';
  export let snapshot: ProjectSnapshot;
  export let includeDossier = false;
  $: printScenes = orderedScenes(snapshot);

  function isEpisodeStart(index: number): boolean {
    if (snapshot.project.projectType !== 'series') return false;
    return index === 0 || printScenes[index - 1]?.episodeId !== printScenes[index]?.episodeId;
  }

  function projectTypeLabel(type: string): string {
    return type === 'series' ? 'مسلسل تلفزيوني' : type === 'short' ? 'فيلم قصير' : type === 'documentary' ? 'سيناريو وثائقي' : 'فيلم سينمائي';
  }

  function roleLabel(role: Character['role']): string {
    return role === 'main' ? 'رئيسية' : role === 'secondary' ? 'ثانوية' : 'إضافية';
  }

  function locationKind(kind: Location['kind']): string {
    return kind === 'INT' ? 'داخلي' : kind === 'EXT' ? 'خارجي' : 'داخلي/خارجي';
  }

  function timeLabel(time: Location['timeOfDay']): string {
    return time === 'DAY' ? 'نهار' : time === 'NIGHT' ? 'ليل' : 'مستمر';
  }
</script>

<div class="print-document">
  <section class="title-page" dir="rtl">
    <h1>{snapshot.project.title}</h1>
    <p class="project-kind">{projectTypeLabel(snapshot.project.projectType)}{#if snapshot.project.genre} · {snapshot.project.genre}{/if}</p>
    {#if snapshot.project.author}<p>كتابة: {snapshot.project.author}</p>{/if}
    {#if snapshot.project.projectType === 'series' && snapshot.project.episodeCount}<p class="project-meta">{snapshot.project.episodeCount} حلقة{#if snapshot.project.estimatedDurationMin} · {snapshot.project.estimatedDurationMin} دقيقة للحلقة{/if}</p>{/if}
    {#if snapshot.project.projectType !== 'series' && snapshot.project.estimatedDurationMin}<p class="project-meta">المدة التقديرية: {snapshot.project.estimatedDurationMin} دقيقة</p>{/if}
  </section>

  {#if includeDossier}
    <section class="dossier-pages" dir="rtl">
      <header class="dossier-heading">
        <span>ملف المشروع</span>
        <h2>{snapshot.project.title}</h2>
        <p>{projectTypeLabel(snapshot.project.projectType)}{#if snapshot.project.genre} · {snapshot.project.genre}{/if}</p>
      </header>

      {#if snapshot.project.storyIdea || snapshot.project.logline || snapshot.project.shortSynopsis || snapshot.project.story || snapshot.project.treatment || snapshot.project.notes}
        <section class="dossier-section story-section">
          <h3>الحكاية</h3>
          {#if snapshot.project.storyIdea}<div class="dossier-field"><b>الفكرة / السؤال المركزي</b><p>{snapshot.project.storyIdea}</p></div>{/if}
          {#if snapshot.project.logline}<div class="dossier-field"><b>Logline</b><p>{snapshot.project.logline}</p></div>{/if}
          {#if snapshot.project.shortSynopsis}<div class="dossier-field"><b>الملخص القصير</b><p>{snapshot.project.shortSynopsis}</p></div>{/if}
          {#if snapshot.project.story}<div class="dossier-field"><b>الحكاية / الملخص الموسع</b><p>{snapshot.project.story}</p></div>{/if}
          {#if snapshot.project.treatment}<div class="dossier-field"><b>المعالجة</b><p>{snapshot.project.treatment}</p></div>{/if}
          {#if snapshot.project.notes}<div class="dossier-field"><b>ملاحظات المشروع</b><p>{snapshot.project.notes}</p></div>{/if}
        </section>
      {/if}

      {#if snapshot.characters.length}
        <section class="dossier-section break-before">
          <h3>الشخصيات</h3>
          <div class="print-cards">
            {#each snapshot.characters as character}
              <article class="print-card">
                <div class="card-title"><h4>{character.name}</h4><span>{roleLabel(character.role)}{#if character.age} · {character.age} سنة{/if}</span></div>
                <p class="card-meta">{[character.occupation, character.dramaticFunction].filter(Boolean).join(' · ')}</p>
                {#if character.bio}<div><b>وصف مختصر</b><p>{character.bio}</p></div>{/if}
                {#if character.background}<div><b>الخلفية</b><p>{character.background}</p></div>{/if}
                {#if character.traits}<div><b>السمات</b><p>{character.traits}</p></div>{/if}
                {#if character.goal}<div><b>الهدف</b><p>{character.goal}</p></div>{/if}
                {#if character.motivation}<div><b>الدافع</b><p>{character.motivation}</p></div>{/if}
                {#if character.conflict}<div><b>الصراع</b><p>{character.conflict}</p></div>{/if}
                {#if character.strengths}<div><b>نقاط القوة</b><p>{character.strengths}</p></div>{/if}
                {#if character.weaknesses}<div><b>نقاط الضعف</b><p>{character.weaknesses}</p></div>{/if}
                {#if character.arc}<div><b>القوس / التحول</b><p>{character.arc}</p></div>{/if}
                {#if character.relationships}<div><b>العلاقات</b><p>{character.relationships}</p></div>{/if}
                {#if character.voiceStyle}<div><b>طريقة الكلام / الصوت</b><p>{character.voiceStyle}</p></div>{/if}
                {#if character.notes}<div><b>ملاحظات</b><p>{character.notes}</p></div>{/if}
              </article>
            {/each}
          </div>
        </section>
      {/if}

      {#if snapshot.locations.length}
        <section class="dossier-section break-before">
          <h3>الأماكن</h3>
          <div class="print-cards">
            {#each snapshot.locations as location}
              <article class="print-card location-print-card">
                <div class="card-title"><h4>{location.name}</h4><span>{locationKind(location.kind)} · {timeLabel(location.timeOfDay)}</span></div>
                {#if location.dramaticImportance}<div><b>الأهمية الدرامية</b><p>{location.dramaticImportance}</p></div>{/if}
                {#if location.description}<div><b>الوصف</b><p>{location.description}</p></div>{/if}
                {#if location.visualNotes}<div><b>ملاحظات بصرية</b><p>{location.visualNotes}</p></div>{/if}
                {#if location.temporalNotes}<div><b>ملاحظات زمنية</b><p>{location.temporalNotes}</p></div>{/if}
                {#if location.notes}<div><b>ملاحظات</b><p>{location.notes}</p></div>{/if}
              </article>
            {/each}
          </div>
        </section>
      {/if}
    </section>
  {/if}

  <section class="script-pages" class:after-dossier={includeDossier}>
    {#each printScenes as scene, sceneIndex}
      {#if isEpisodeStart(sceneIndex)}<div class:episode-break={sceneIndex > 0} class="print-episode-heading" dir="rtl">{episodeLabel(snapshot, scene.episodeId)}</div>{/if}
      <div class="print-scene">
        {#each scene.blocks as block}
          {#if block.elementType === 'scene_heading' && scene.blocks[0]?.id === block.id}
            <div class="print-block print-scene-heading print-heading-row" dir={detectLang(block.text) === 'ar' ? 'rtl' : 'ltr'}>
              <span class="print-scene-number" dir="rtl">مشهد {scene.orderIndex + 1} :</span>
              <span>{block.text}</span>
            </div>
          {:else}
            <div class={`print-block print-${block.elementType.replace('_','-')}`} dir={detectLang(block.text) === 'ar' ? 'rtl' : 'ltr'}>{block.text}</div>
          {/if}
        {/each}
      </div>
    {/each}
  </section>
</div>

<style>
  .print-document{display:none;color:#111;background:white}
  @media print{
    .print-document{display:block!important;width:100%;font-family:"Amiri","Noto Naskh Arabic","Times New Roman",serif}
    .title-page{height:258mm;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;break-after:page;padding:30mm}
    .title-page h1{font-size:28pt;margin:0 0 10mm}.title-page p{font-size:14pt}.title-page .project-kind{font-size:11pt;color:#555;margin:0 0 8mm}.title-page .project-meta{font-size:10.5pt;color:#666;margin:3mm 0}.title-page blockquote{font-size:12pt;max-width:130mm;line-height:1.8;color:#444;margin-top:18mm}
    .dossier-pages{width:165mm;margin:0 auto;font-size:11.5pt;line-height:1.8}.dossier-heading{border-bottom:1.5pt solid #222;padding-bottom:8mm;margin-bottom:10mm}.dossier-heading span{font-size:9pt;color:#666}.dossier-heading h2{font-size:24pt;margin:2mm 0}.dossier-heading p{margin:0;color:#555;font-size:10.5pt}.dossier-section{margin-bottom:12mm}.dossier-section h3{font-size:18pt;margin:0 0 8mm;border-bottom:.6pt solid #aaa;padding-bottom:3mm}.dossier-field{margin-bottom:7mm}.dossier-field b,.print-card b{font-size:9.5pt;color:#555}.dossier-field p,.print-card p{white-space:pre-wrap;margin:1mm 0 0}.break-before{break-before:page;padding-top:4mm}.print-cards{display:flex;flex-direction:column;gap:7mm}.print-card{border:.6pt solid #bbb;border-radius:2mm;padding:6mm;break-inside:avoid}.card-title{display:flex;justify-content:space-between;gap:6mm;align-items:baseline;border-bottom:.5pt solid #ddd;padding-bottom:3mm;margin-bottom:4mm}.card-title h4{font-size:15pt;margin:0}.card-title span{font-size:9pt;color:#666}.card-meta{font-size:10pt;color:#555;margin:-1mm 0 4mm!important}.print-card>div:not(.card-title){margin-top:4mm}.location-print-card{break-inside:avoid}
    .script-pages{width:160mm;margin:0 auto}.script-pages.after-dossier{break-before:page}.print-episode-heading{font-size:16pt;font-weight:800;text-align:center;margin:0 0 10mm;padding-top:4mm;break-after:avoid}.print-episode-heading.episode-break{break-before:page}.print-scene{break-inside:auto}.print-block{font-size:12pt;line-height:1.65;margin:0 0 2.5mm;white-space:pre-wrap;orphans:2;widows:2}
    .print-scene-heading{font-weight:800;margin-top:8mm;margin-bottom:5mm;break-after:avoid}.print-heading-row{display:flex;gap:3mm;align-items:baseline}.print-scene-number{white-space:nowrap;font-weight:800}
    .print-character{width:60%;margin:5mm auto 0;text-align:center;font-weight:800;break-after:avoid}.print-dialogue{width:62%;margin:0 auto 3mm;text-align:right;font-weight:700;orphans:2;widows:2}.print-parenthetical{width:55%;margin:0 auto;text-align:center;font-size:11pt;font-style:italic;break-after:avoid}.print-direction{width:100%;margin:2mm 0 3mm;text-align:right;font-size:11.5pt;font-style:normal;font-weight:400;text-decoration:underline;text-underline-offset:2pt;color:#333}.print-transition{width:65%;margin:6mm 0 5mm auto;text-align:left;font-weight:700}.print-action{text-align:justify}.print-action-line{text-align:right;font-weight:600}
  }
</style>
