<script lang="ts">
  import { onMount } from 'svelte';
  import type { Character, CharacterDraft, Location, LocationDraft, Project, ProjectDraft, ProjectSummary, ProjectType } from '../lib/types';

  export let projects: ProjectSummary[] = [];
  export let currentProject: Project;
  export let currentCharacters: Character[] = [];
  export let currentLocations: Location[] = [];
  export let currentId = '';
  export let hasCurrentProject = true;
  export let landing = false;
  export let startMode: 'list' | 'new' | 'edit' = 'list';
  export let startTab: 'basics' | 'story' | 'characters' | 'locations' = 'basics';
  export let focusEntityId = '';
  export let onClose: () => void;
  export let onOpen: (id: string) => void;
  export let onNew: (data: ProjectDraft) => void;
  export let onUpdateCurrent: (data: ProjectDraft) => void;
  export let onDelete: (id: string) => void;

  let mode: 'list' | 'new' | 'edit' = startMode;
  let tab: 'basics' | 'story' | 'characters' | 'locations' = startTab;
  let title = '';
  let author = '';
  let projectType: ProjectType = 'film';
  let genre = '';
  let logline = '';
  let storyIdea = '';
  let shortSynopsis = '';
  let story = '';
  let treatment = '';
  let notes = '';
  let estimatedDuration: number | undefined = undefined;
  let episodeCount: number | undefined = undefined;
  let characters: CharacterDraft[] = [];
  let locations: LocationDraft[] = [];

  const typeOptions: Array<{ id: ProjectType; label: string; hint: string }> = [
    { id: 'film', label: 'فيلم سينمائي', hint: 'سيناريو طويل للعرض السينمائي' },
    { id: 'series', label: 'مسلسل تلفزيوني', hint: 'مشروع حلقات متتابعة' },
    { id: 'short', label: 'فيلم قصير', hint: 'سيناريو قصير ومكثف' }
  ];

  const palette = ['#E8B86D', '#7DD3FC', '#A78BFA', '#6EE7B7', '#FB7185', '#F9A8D4'];

  onMount(() => {
    if (startMode === 'edit') openEdit(startTab);
    if (startMode === 'new') openNew(startTab);
  });

  function typeLabel(type: ProjectType | string): string {
    if (type === 'documentary') return 'سيناريو وثائقي'; // توافق مع مشاريع تجريبية قديمة فقط
    return typeOptions.find((item) => item.id === type)?.label ?? type;
  }

  function projectDetail(project: ProjectSummary): string {
    if (project.projectType === 'series') {
      const count = project.episodeCount ? `${project.episodeCount} حلقة` : 'عدد الحلقات غير محدد';
      const duration = project.estimatedDurationMin ? ` · ${project.estimatedDurationMin} د/حلقة` : '';
      return `${count}${duration}`;
    }
    return project.estimatedDurationMin ? `${project.estimatedDurationMin} دقيقة` : 'المدة غير محددة';
  }

  function blankCharacterDraft(): CharacterDraft {
    return {
      name: '', aliases: '', age: null, role: 'secondary', occupation: '', dramaticFunction: '', bio: '', background: '', traits: '',
      goal: '', motivation: '', conflict: '', strengths: '', weaknesses: '', arc: '', relationships: '', voiceStyle: '', notes: '',
      color: palette[characters.length % palette.length]
    };
  }

  function blankLocationDraft(): LocationDraft {
    return {
      name: '', kind: 'INT', timeOfDay: 'DAY', description: '', dramaticImportance: '', visualNotes: '', temporalNotes: '', notes: ''
    };
  }

  function resetForm() {
    title = '';
    author = '';
    projectType = 'film';
    genre = '';
    logline = '';
    storyIdea = '';
    shortSynopsis = '';
    story = '';
    treatment = '';
    notes = '';
    estimatedDuration = undefined;
    episodeCount = undefined;
    characters = [];
    locations = [];
  }

  function openNew(initialTab: typeof tab = 'basics') {
    resetForm();
    tab = initialTab;
    mode = 'new';
  }

  function openEdit(initialTab: typeof tab = 'basics') {
    title = currentProject.title;
    author = currentProject.author;
    projectType = currentProject.projectType;
    genre = currentProject.genre ?? '';
    logline = currentProject.logline;
    storyIdea = currentProject.storyIdea ?? '';
    shortSynopsis = currentProject.shortSynopsis ?? '';
    story = currentProject.story ?? '';
    treatment = currentProject.treatment ?? '';
    notes = currentProject.notes ?? '';
    estimatedDuration = currentProject.estimatedDurationMin ?? undefined;
    episodeCount = currentProject.episodeCount ?? undefined;
    characters = currentCharacters.map((c) => ({
      id: c.id, name: c.name, aliases: c.aliases ?? '', age: c.age, role: c.role, occupation: c.occupation ?? '', dramaticFunction: c.dramaticFunction ?? '',
      bio: c.bio, background: c.background ?? '', traits: c.traits ?? '', goal: c.goal, motivation: c.motivation ?? '',
      conflict: c.conflict ?? '', strengths: c.strengths ?? '', weaknesses: c.weaknesses ?? '', arc: c.arc,
      relationships: c.relationships ?? '', voiceStyle: c.voiceStyle ?? '', notes: c.notes ?? '', color: c.color
    }));
    locations = currentLocations.map((l) => ({
      id: l.id, name: l.name, kind: l.kind, timeOfDay: l.timeOfDay, description: l.description,
      dramaticImportance: l.dramaticImportance ?? '', visualNotes: l.visualNotes ?? '', temporalNotes: l.temporalNotes ?? '', notes: l.notes ?? ''
    }));
    tab = initialTab;
    mode = 'edit';
  }

  function buildDraft(): ProjectDraft {
    const duration = estimatedDuration;
    const episodes = episodeCount;
    return {
      title: title.trim() || 'سيناريو جديد',
      author: author.trim(),
      projectType,
      genre: genre.trim(),
      logline: logline.trim(),
      storyIdea: storyIdea.trim(),
      shortSynopsis: shortSynopsis.trim(),
      story: story.trim(),
      treatment: treatment.trim(),
      notes: notes.trim(),
      estimatedDurationMin: typeof duration === 'number' && Number.isFinite(duration) && duration > 0 ? Math.round(duration) : null,
      episodeCount: projectType === 'series' && typeof episodes === 'number' && Number.isFinite(episodes) && episodes > 0 ? Math.round(episodes) : null,
      characters: characters.filter((c) => c.name.trim()).map((c) => ({ ...c, name: c.name.trim() })),
      locations: locations.filter((l) => l.name.trim()).map((l) => ({ ...l, name: l.name.trim() }))
    };
  }

  function submit() {
    const data = buildDraft();
    if (mode === 'edit') {
      onUpdateCurrent(data);
      onClose();
      return;
    }
    onNew(data);
  }

  function removeCharacterAt(index: number) {
    const item = characters[index];
    if (item?.name && !confirm(`حذف الشخصية «${item.name}» من ملف المشروع؟`)) return;
    characters = characters.filter((_, i) => i !== index);
  }

  function removeLocationAt(index: number) {
    const item = locations[index];
    if (item?.name && !confirm(`حذف المكان «${item.name}» من ملف المشروع؟`)) return;
    locations = locations.filter((_, i) => i !== index);
  }
</script>

<div class:landing class:formBackdrop={mode !== 'list'} class="modal-backdrop" on:click={() => { if (!landing) onClose(); }}>
  <div class:landingCard={landing} class:formCard={mode !== 'list'} class="modal-card projects" on:click|stopPropagation dir="rtl">
    {#if !(landing && mode === 'list')}
      <div class="modal-head">
        <div>
          <h2>{mode === 'new' ? 'إنشاء مشروع' : mode === 'edit' ? 'ملف المشروع' : 'المشاريع'}</h2>
          <p>{mode === 'list' ? 'افتح مشروعاً، أنشئ مشروعاً جديداً أو ادخل إلى ملف المشروع المفتوح.' : 'املأ ما تحتاجه الآن واترك الباقي لوقت لاحق. لا توجد خانات إلزامية سوى عنوان المشروع.'}</p>
        </div>
        {#if !landing}<button class="icon-button" on:click={onClose}>×</button>{/if}
      </div>
    {/if}

    {#if mode !== 'list'}
      <div class="form-top-actions">
        <button class="ghost-button" on:click={() => mode = 'list'}>المشاريع</button>
        <div class="spacer"></div>
        {#if tab !== 'basics'}<button class="ghost-button" on:click={() => tab = tab === 'story' ? 'basics' : tab === 'characters' ? 'story' : 'characters'}>السابق</button>{/if}
        {#if tab !== 'locations'}<button class="ghost-button" on:click={() => tab = tab === 'basics' ? 'story' : tab === 'story' ? 'characters' : 'locations'}>التالي</button>{/if}
        <button class="primary-button" on:click={submit}>{mode === 'edit' ? 'حفظ ملف المشروع' : 'إنشاء وفتح المشروع'}</button>
      </div>
    {/if}

    <div class:basics-view={mode !== 'list' && tab === 'basics'} class="modal-body">
      {#if mode === 'list'}
        {#if landing}
          <section class="welcome-hero" aria-label="مرحبا بك في Scene Writer">
            <div class="welcome-brand">
              <div class="welcome-mark" aria-hidden="true">SW</div>
              <div class="welcome-copy">
                <div class="welcome-kicker"><span dir="ltr">SCENE WRITER</span><em>v0.7.2</em></div>
                <h1>مرحباً بك في عالم إبداعك</h1>
                <p>ابدأ مشروعاً جديداً، أو واصل العمل على أحد مشاريعك القائمة. هنا تبدأ الحكاية، وتبقى أدوات التحرير والتنظيم في خدمتك.</p>
                <small>تحرير السيناريو · المساعد في التحرير والتنسيق</small>
              </div>
            </div>
            <button class="primary-button welcome-create" on:click={() => openNew('basics')}>
              <span aria-hidden="true">＋</span><b>إنشاء مشروع جديد</b>
            </button>
          </section>

          <div class="library-head">
            <div>
              <h2>مشاريعك</h2>
              <p>{projects.length ? 'اختر مشروعاً للعودة إلى الكتابة من حيث توقفت.' : 'لا توجد مشاريع بعد. مشروعك الأول يبدأ بخطوة واحدة.'}</p>
            </div>
            <span class="project-count">{projects.length} {projects.length === 1 ? 'مشروع' : 'مشاريع'}</span>
          </div>
        {:else}
          <div class="list-actions">
            <button class="primary-button create-project" on:click={() => openNew('basics')}>＋ إنشاء مشروع</button>
            {#if hasCurrentProject}
              <button class="ghost-button dossier-button" on:click={() => openEdit('basics')}>▤ ملف المشروع المفتوح</button>
            {/if}
          </div>
        {/if}

        <div class:list-landing={landing} class="list">
          {#if projects.length === 0}
            <div class="empty-projects landing-empty">
              <span class="empty-symbol" aria-hidden="true">✦</span>
              <b>مساحة جديدة تنتظر حكايتك</b>
              <p>أنشئ فيلماً سينمائياً، مسلسلاً تلفزيونياً أو فيلماً قصيراً، ثم أضف الحكاية والشخصيات والأماكن عندما تحتاجها.</p>
              <button class="ghost-button" on:click={() => openNew('basics')}>إنشاء أول مشروع</button>
            </div>
          {/if}
          {#each projects as project}
            <article class:current={hasCurrentProject && project.id === currentId} class="project-row">
              <button class="project-open" on:click={() => onOpen(project.id)}>
                <span class="project-main">
                  <span class="project-title-row">
                    <b>{project.title}</b>
                    <em>{typeLabel(project.projectType)}</em>
                  </span>
                  <small>{project.author || 'دون اسم مؤلف'} · {projectDetail(project)} · آخر تعديل {new Date(project.updatedAt).toLocaleDateString('ar-MA')}</small>
                </span>
                <span class="open-project-label">فتح المشروع</span>
              </button>
              <button class="delete-project" on:click={() => onDelete(project.id)} title="حذف المشروع">حذف</button>
            </article>
          {/each}
        </div>
      {:else}
        <div class="project-form-scroll">
        <nav class="dossier-tabs" aria-label="أقسام ملف المشروع">
          <button class:active={tab === 'basics'} on:click={() => tab = 'basics'}><b>01</b><span>الأساسيات</span></button>
          <button class:active={tab === 'story'} on:click={() => tab = 'story'}><b>02</b><span>الحكاية</span></button>
          <button class:active={tab === 'characters'} on:click={() => tab = 'characters'}><b>03</b><span>الشخصيات</span><em>{characters.filter(c => c.name.trim()).length}</em></button>
          <button class:active={tab === 'locations'} on:click={() => tab = 'locations'}><b>04</b><span>الأماكن</span><em>{locations.filter(l => l.name.trim()).length}</em></button>
        </nav>

        {#if tab === 'basics'}
          <div class="section-intro">
            <div><h3>هوية المشروع</h3><p>المعلومات التي تعرّف العمل وترافقه في التصدير والنسخ المهنية.</p></div>
            <span>أساسي</span>
          </div>
          <div class="basics-form">
            <div class="basics-primary">
              <label class="title-field"><span>عنوان المشروع</span><input class="field field-lg" bind:value={title} placeholder="عنوان السيناريو" /></label>
              <div class="identity-row">
                <label class="author-field"><span>المؤلف</span><input class="field" bind:value={author} placeholder="اسم الكاتب" /></label>
                <label class="genre-field"><span>النوع الدرامي</span><input class="field" bind:value={genre} placeholder="دراما، كوميديا، تشويق..." /></label>
              </div>
            </div>

            <div class="form-group type-group">
              <div class="group-label"><span>نوع المشروع</span><small>اختر القالب الأقرب إلى طبيعة العمل، ويمكن تعديله لاحقاً.</small></div>
              <div class="type-cards">
                {#each typeOptions as item}
                  <button type="button" class:selected={projectType === item.id} on:click={() => projectType = item.id}>
                    <b>{item.label}</b><small>{item.hint}</small>
                  </button>
                {/each}
              </div>
            </div>

            <div class="form-group duration-group">
              <div class="group-label"><span>{projectType === 'series' ? 'بنية الحلقات' : 'الحجم التقديري'}</span><small>{projectType === 'series' ? 'أرقام أولية لتنظيم الموسم، وليست قيوداً على الكتابة.' : 'قيمة تقريبية تساعد في تنظيم المشروع ولا تفرض طولاً على السيناريو.'}</small></div>
              <div class="metric-row">
                {#if projectType === 'series'}
                  <label class="metric-field"><span>عدد الحلقات</span><div class="metric-input"><input class="field" type="number" min="1" bind:value={episodeCount} placeholder="8" /><em>حلقة</em></div></label>
                  <label class="metric-field"><span>مدة الحلقة</span><div class="metric-input"><input class="field" type="number" min="1" bind:value={estimatedDuration} placeholder="52" /><em>دقيقة</em></div></label>
                {:else}
                  <label class="metric-field"><span>المدة التقديرية</span><div class="metric-input"><input class="field" type="number" min="1" bind:value={estimatedDuration} placeholder="90" /><em>دقيقة</em></div></label>
                {/if}
              </div>
            </div>
          </div>
        {:else if tab === 'story'}
          <div class="section-intro">
            <div><h3>الحكاية</h3><p>من الفكرة الأولى إلى الحكاية أو المعالجة. استخدم فقط المستوى الذي يخدم مشروعك.</p></div>
            <span>اختياري</span>
          </div>
          <div class="story-grid">
            <label><span>الفكرة / السؤال المركزي</span><textarea class="textarea compact" bind:value={storyIdea} placeholder="الفكرة التي ينطلق منها العمل أو السؤال الذي يحركه..."></textarea></label>
            <label><span>Logline / الجملة التعريفية</span><textarea class="textarea compact" bind:value={logline} placeholder="سطر موجز يعرّف بالمشروع..."></textarea></label>
            <label class="wide"><span>الملخص القصير</span><textarea class="textarea" bind:value={shortSynopsis} placeholder="ملخص مركز للحكاية في فقرة أو فقرتين..."></textarea></label>
            <label class="wide"><span>الحكاية / الملخص الموسع</span><textarea class="textarea story-area" bind:value={story} placeholder="اكتب الحكاية كما تريد أن تراها كاملة قبل تفصيل المشاهد..."></textarea></label>
            <label class="wide"><span>المعالجة</span><textarea class="textarea story-area" bind:value={treatment} placeholder="المعالجة الدرامية أو البصرية إن رغبت في إعدادها..."></textarea></label>
            <label class="wide"><span>ملاحظات المشروع</span><textarea class="textarea" bind:value={notes} placeholder="ملاحظات حرة، مراجع، قرارات مؤجلة..."></textarea></label>
          </div>
        {:else if tab === 'characters'}
          <div class="section-intro with-action">
            <div><h3>الشخصيات</h3><p>أنشئ الشخصيات مسبقاً إن رغبت، أو عد إليها لاحقاً من أثناء الكتابة.</p></div>
            <button class="soft-button" on:click={() => characters = [...characters, blankCharacterDraft()]}>＋ شخصية</button>
          </div>
          {#if characters.length === 0}
            <button class="empty-builder" on:click={() => characters = [blankCharacterDraft()]}><b>＋</b><span>إضافة أول شخصية</span><small>يمكنك تجاوز هذه الخطوة والبدء بالكتابة مباشرة.</small></button>
          {/if}
          <div class="entity-edit-list">
            {#each characters as character, index}
              <details class="entity-card" open={character.id === focusEntityId || (index === characters.length - 1 && !character.id)}>
                <summary>
                  <i style={`background:${character.color || palette[index % palette.length]}`}></i>
                  <div><b>{character.name || `شخصية ${index + 1}`}</b><small>{character.dramaticFunction || (character.role === 'main' ? 'رئيسية' : character.role === 'secondary' ? 'ثانوية' : 'إضافية')}</small></div>
                  <span>تفاصيل</span>
                </summary>
                <div class="entity-card-body">
                  <div class="form-grid three character-grid">
                    <label class="character-name"><span>الاسم</span><input class="field" bind:value={character.name} placeholder="اسم الشخصية" /></label>
                    <label class="span2"><span>أسماء بديلة / ألقاب</span><input class="field" bind:value={character.aliases} placeholder="مثال: الحاج، سي ولد منو، ولد منو" /></label>
                    <label class="character-age"><span>العمر</span><input class="field" type="number" min="0" bind:value={character.age} placeholder="اختياري" /></label>
                    <label class="character-role"><span>الحضور</span><select class="select" bind:value={character.role}><option value="main">رئيسية</option><option value="secondary">ثانوية</option><option value="extra">إضافية</option></select></label>
                    <label><span>المهنة / الوضع</span><input class="field" bind:value={character.occupation} placeholder="مهنة أو وضع اجتماعي" /></label>
                    <label class="span2"><span>الوظيفة الدرامية</span><input class="field" bind:value={character.dramaticFunction} placeholder="بطل، خصم، مرشد، شاهد..." /></label>
                    <label class="wide"><span>وصف مختصر</span><textarea class="textarea compact" bind:value={character.bio} placeholder="كيف تقدم هذه الشخصية في جمل قليلة؟"></textarea></label>
                    <label class="wide"><span>الخلفية</span><textarea class="textarea compact" bind:value={character.background} placeholder="الماضي والظروف التي شكّلت الشخصية..."></textarea></label>
                    <label><span>السمات</span><textarea class="textarea compact" bind:value={character.traits} placeholder="نفسية، سلوكية، اجتماعية..."></textarea></label>
                    <label><span>الهدف</span><textarea class="textarea compact" bind:value={character.goal} placeholder="ماذا تريد؟"></textarea></label>
                    <label><span>الدافع</span><textarea class="textarea compact" bind:value={character.motivation} placeholder="لماذا تريده؟"></textarea></label>
                    <label><span>الصراع</span><textarea class="textarea compact" bind:value={character.conflict} placeholder="ما الذي يعوقها؟"></textarea></label>
                    <label><span>نقاط القوة</span><textarea class="textarea compact" bind:value={character.strengths}></textarea></label>
                    <label><span>نقاط الضعف</span><textarea class="textarea compact" bind:value={character.weaknesses}></textarea></label>
                    <label class="wide"><span>القوس / التحول</span><textarea class="textarea compact" bind:value={character.arc} placeholder="كيف تبدأ الشخصية وإلى أين تصل؟"></textarea></label>
                    <label class="wide"><span>العلاقات</span><textarea class="textarea compact" bind:value={character.relationships} placeholder="علاقاتها بالشخصيات الأخرى..."></textarea></label>
                    <label class="wide"><span>طريقة الكلام / الصوت</span><textarea class="textarea compact" bind:value={character.voiceStyle} placeholder="الإيقاع، المفردات، اللهجة، ما تقوله وما تتجنبه..."></textarea></label>
                    <label class="wide"><span>ملاحظات</span><textarea class="textarea compact" bind:value={character.notes}></textarea></label>
                  </div>
                  <div class="entity-card-actions"><button class="danger-link" on:click={() => removeCharacterAt(index)}>حذف الشخصية</button></div>
                </div>
              </details>
            {/each}
          </div>
        {:else}
          <div class="section-intro with-action">
            <div><h3>الأماكن</h3><p>سجل المواقع الأساسية الآن، أو أضفها سريعاً من الشريط الجانبي أثناء الكتابة.</p></div>
            <button class="soft-button" on:click={() => locations = [...locations, blankLocationDraft()]}>＋ مكان</button>
          </div>
          {#if locations.length === 0}
            <button class="empty-builder" on:click={() => locations = [blankLocationDraft()]}><b>＋</b><span>إضافة أول مكان</span><small>يمكنك تجاوز هذه الخطوة وإضافة الأماكن من المحرر لاحقاً.</small></button>
          {/if}
          <div class="entity-edit-list">
            {#each locations as location, index}
              <details class="entity-card location-card" open={location.id === focusEntityId || (index === locations.length - 1 && !location.id)}>
                <summary>
                  <i></i>
                  <div><b>{location.name || `مكان ${index + 1}`}</b><small>{location.kind} · {location.timeOfDay}</small></div>
                  <span>تفاصيل</span>
                </summary>
                <div class="entity-card-body">
                  <div class="form-grid three location-grid">
                    <label class="location-name"><span>اسم المكان</span><input class="field" bind:value={location.name} placeholder="اسم الموقع" /></label>
                    <label class="location-kind"><span>النوع</span><select class="select" bind:value={location.kind}><option value="INT">داخلي</option><option value="EXT">خارجي</option><option value="INT/EXT">داخلي/خارجي</option></select></label>
                    <label class="location-time"><span>الزمن المرجعي</span><select class="select" bind:value={location.timeOfDay}><option value="DAY">نهار</option><option value="NIGHT">ليل</option><option value="CONTINUOUS">مستمر</option></select></label>
                    <label class="span2"><span>الأهمية الدرامية</span><input class="field" bind:value={location.dramaticImportance} placeholder="ماذا يمثل المكان داخل الحكاية؟" /></label>
                    <label class="wide"><span>وصف المكان</span><textarea class="textarea" bind:value={location.description} placeholder="الفضاء، الجو، العناصر الأساسية..."></textarea></label>
                    <label><span>ملاحظات بصرية</span><textarea class="textarea compact" bind:value={location.visualNotes} placeholder="ضوء، ألوان، ملمس، تفاصيل..."></textarea></label>
                    <label><span>ملاحظات زمنية</span><textarea class="textarea compact" bind:value={location.temporalNotes} placeholder="موسم، فترة، تغيرات زمنية..."></textarea></label>
                    <label class="wide"><span>ملاحظات</span><textarea class="textarea compact" bind:value={location.notes}></textarea></label>
                  </div>
                  <div class="entity-card-actions"><button class="danger-link" on:click={() => removeLocationAt(index)}>حذف المكان</button></div>
                </div>
              </details>
            {/each}
          </div>
        {/if}

        </div>

      {/if}
    </div>
  </div>
</div>

<style>
  .projects{width:min(1010px,97vw);max-height:92vh}

  .modal-backdrop.landing{background:linear-gradient(180deg,var(--bg) 0%,color-mix(in srgb,var(--bg) 86%,var(--panel) 14%) 100%);backdrop-filter:none;padding:34px;align-items:start;overflow:auto}
  :global(:root[data-theme="dark"]) .modal-backdrop.landing{background:linear-gradient(180deg,var(--bg),#15181d)}
  .projects.landingCard{width:min(1180px,96vw);max-height:none;margin:34px auto 70px;border-radius:22px;box-shadow:0 18px 50px rgba(30,50,80,.10);overflow:hidden;border:1px solid var(--line);background:var(--panel)}
  :global(:root[data-theme="dark"]) .projects.landingCard{box-shadow:0 22px 60px rgba(0,0,0,.34)}
  .projects.landingCard .modal-body{padding:0}
  .modal-head>div p{margin:4px 0 0;color:var(--muted);font-size:11.5px;line-height:1.6}

  .welcome-hero{display:flex;align-items:center;justify-content:space-between;gap:34px;padding:38px 42px 34px;background:linear-gradient(135deg,color-mix(in srgb,var(--accent-soft) 72%,var(--panel) 28%),var(--panel) 58%);border-bottom:1px solid var(--line-soft)}
  .welcome-brand{display:flex;align-items:center;gap:22px;min-width:0}
  .welcome-mark{width:72px;height:72px;flex:0 0 72px;border-radius:20px;display:grid;place-items:center;background:var(--accent);color:#fff;font-weight:900;letter-spacing:.04em;font-size:21px;box-shadow:0 12px 28px rgba(24,90,189,.20)}
  .welcome-copy{min-width:0}
  .welcome-kicker{display:flex;align-items:center;gap:9px;margin-bottom:7px;color:var(--accent);font-size:11px;font-weight:850;letter-spacing:.07em}
  .welcome-kicker em{font-style:normal;letter-spacing:0;background:var(--panel);border:1px solid var(--accent-line);border-radius:999px;padding:3px 8px;font-size:9.5px;color:var(--muted)}
  .welcome-copy h1{margin:0;color:var(--text);font-size:28px;line-height:1.35;letter-spacing:-.02em}
  .welcome-copy p{margin:10px 0 8px;max-width:680px;color:var(--text-2);font-size:13.5px;line-height:1.9}
  .welcome-copy small{color:var(--muted);font-size:11px}
  .welcome-create{min-width:178px;min-height:48px;padding-inline:20px;border-radius:12px;box-shadow:0 8px 22px rgba(24,90,189,.15);white-space:nowrap}
  .welcome-create b{font-size:13px}

  .library-head{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:26px 34px 16px}
  .library-head h2{margin:0;color:var(--text);font-size:18px}
  .library-head p{margin:5px 0 0;color:var(--muted);font-size:11.5px;line-height:1.7}
  .project-count{flex:0 0 auto;border:1px solid var(--line);background:var(--panel-2);color:var(--muted);border-radius:999px;padding:5px 10px;font-size:10px}

  .list-actions{display:flex;gap:8px;margin-bottom:16px}.dossier-button{color:var(--accent);border-color:var(--accent-line)}
  .projects.landingCard .list{padding:0 34px 34px}
  .list{display:flex;flex-direction:column;gap:9px}
  .empty-projects{border:1px dashed var(--line);background:var(--panel-2);color:var(--muted);border-radius:14px;padding:24px;text-align:center;font-size:12px;line-height:1.7}
  .landing-empty{min-height:190px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;padding:28px}
  .landing-empty .empty-symbol{width:42px;height:42px;border-radius:14px;display:grid;place-items:center;background:var(--accent-soft);color:var(--accent);font-size:21px;margin-bottom:3px}
  .landing-empty b{font-size:15px;color:var(--text)}
  .landing-empty p{max-width:560px;margin:0 0 8px;color:var(--muted);font-size:11.5px;line-height:1.8}

  .project-row{display:flex;align-items:stretch;border:1px solid var(--line);border-radius:13px;background:var(--panel);overflow:hidden;transition:.16s ease;box-shadow:0 2px 7px rgba(0,0,0,.025)}
  .project-row:hover,.project-row.current{border-color:var(--accent-line);background:color-mix(in srgb,var(--accent-soft) 34%,var(--panel) 66%);transform:translateY(-1px);box-shadow:0 7px 18px rgba(30,60,100,.06)}
  .project-row.current{box-shadow:inset -3px 0 var(--accent),0 7px 18px rgba(30,60,100,.06)}
  .project-open{flex:1;min-width:0;display:flex;align-items:center;gap:14px;text-align:right;background:transparent;border:0;padding:15px 16px;color:var(--text)}
  .project-main{flex:1;min-width:0}.project-title-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.project-title-row b{font-size:14px}.project-title-row em{font-style:normal;font-size:9.5px;color:var(--accent);background:var(--accent-soft);border:1px solid var(--accent-line);border-radius:999px;padding:2px 7px}.project-open small{display:block;margin-top:5px;color:var(--muted);font-size:10.5px}.opened{font-size:11px;color:var(--accent);white-space:nowrap}.open-project-label{font-size:10.5px;color:var(--accent);white-space:nowrap;opacity:.78}.project-row:hover .open-project-label{opacity:1}
  .delete-project{width:62px;border:0;border-right:1px solid var(--line-soft);background:var(--panel-2);color:var(--muted);font-size:10px}.delete-project:hover{background:var(--danger-soft);color:var(--danger)}

  @media(max-width:760px){.welcome-hero{align-items:flex-start;flex-direction:column;padding:28px 24px}.welcome-brand{align-items:flex-start}.welcome-mark{width:58px;height:58px;flex-basis:58px;border-radius:16px}.welcome-copy h1{font-size:23px}.welcome-create{width:100%}.library-head{padding:22px 22px 14px}.projects.landingCard .list{padding:0 22px 26px}}
  /* Compact project-file navigation: the label occupies only the space it needs. */
  .dossier-tabs{display:flex;justify-content:center;align-items:center;gap:8px;width:fit-content;max-width:100%;margin:0 auto 25px;position:sticky;top:-20px;z-index:4;padding:8px 10px;background:color-mix(in srgb,var(--panel) 92%,transparent);border:1px solid var(--line-soft);border-radius:16px;box-shadow:0 5px 18px rgba(20,45,80,.04);backdrop-filter:blur(10px)}
  .dossier-tabs button{width:auto;min-width:118px;min-height:42px;border:1px solid transparent;background:transparent;color:var(--text-2);border-radius:11px;display:flex;align-items:center;justify-content:center;gap:7px;padding:8px 13px;text-align:center;transition:.16s ease}
  .dossier-tabs button:hover{border-color:var(--line);background:var(--hover)}
  .dossier-tabs button.active{border-color:var(--accent-line);background:var(--accent-soft);color:var(--accent);box-shadow:0 2px 7px rgba(30,80,150,.06)}
  .dossier-tabs b{width:21px;height:21px;border-radius:999px;display:grid;place-items:center;background:var(--panel-3);font-size:8.5px;color:var(--muted-2);font-variant-numeric:tabular-nums}
  .dossier-tabs button.active b{background:color-mix(in srgb,var(--accent) 12%,var(--panel) 88%);color:var(--accent)}
  .dossier-tabs span{font-size:11.5px;font-weight:800;white-space:nowrap}
  .dossier-tabs em{font-style:normal;min-width:19px;height:19px;padding:0 5px;border-radius:99px;background:var(--panel-3);display:grid;place-items:center;font-size:8.5px;color:var(--muted)}

  /* Keep the section title visually centred; tags/actions live beside it without pulling it off axis. */
  .section-intro{max-width:900px;margin:0 auto 20px;display:grid;grid-template-columns:120px minmax(0,1fr) 120px;align-items:center;gap:14px;min-height:55px}
  .section-intro>div{grid-column:2;text-align:center}
  .section-intro h3{margin:0;color:var(--text);font-size:17px}
  .section-intro p{max-width:620px;margin:5px auto 0;color:var(--muted);font-size:11.5px;line-height:1.7}
  .section-intro>span,.section-intro>.soft-button{grid-column:3;justify-self:end}
  .section-intro>span{border:1px solid var(--line);background:var(--panel-2);border-radius:999px;padding:4px 9px;color:var(--muted);font-size:9.5px}
  .section-intro.with-action{align-items:center}

  /* Project identity: fields follow the size of the information instead of stretching across the modal. */
  .basics-form{max-width:900px;margin-inline:auto;display:flex;flex-direction:column;gap:22px;padding:2px 4px 8px}
  .basics-primary{display:flex;flex-direction:column;gap:13px}
  .title-field{width:min(100%,680px)}
  .identity-row{display:grid;grid-template-columns:minmax(240px,390px) minmax(220px,330px);gap:12px;align-items:end}
  .author-field,.genre-field{min-width:0}
  .field-lg{font-size:14px;font-weight:650;padding-block:13px}
  .form-group{border-top:1px solid var(--line-soft);padding-top:18px}
  .group-label{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:10px}
  .group-label>span{color:var(--text-2);font-size:11px;font-weight:750}
  .group-label>small{color:var(--muted-2);font-size:9.8px;line-height:1.55}
  .metric-row{display:flex;align-items:flex-start;gap:12px;flex-wrap:wrap}
  .metric-field{width:190px}
  .metric-input{position:relative}
  .metric-input .field{padding-left:58px;font-variant-numeric:tabular-nums}
  .metric-input em{position:absolute;left:10px;top:50%;transform:translateY(-50%);font-style:normal;color:var(--muted-2);font-size:9.5px;border-right:1px solid var(--line-soft);padding-right:9px;pointer-events:none}
  .form-grid{display:grid;grid-template-columns:1fr 1fr;gap:13px 12px}.form-grid.three{grid-template-columns:1fr 1fr 1fr}.wide{grid-column:1/-1}.span2{grid-column:span 2}label>span{display:block;color:var(--text-2);font-size:11px;margin:0 2px 6px}.textarea{min-height:86px}.textarea.compact{min-height:72px}.story-area{min-height:155px;line-height:1.8}.story-grid{max-width:900px;margin-inline:auto;display:grid;grid-template-columns:minmax(250px,1fr) minmax(250px,1fr);gap:13px 14px}.story-grid .wide{grid-column:1/-1}
  .type-cards{display:grid;grid-template-columns:repeat(3,minmax(150px,1fr));gap:8px;max-width:840px}.type-cards button{border:1px solid var(--line);background:var(--panel-2);color:var(--text-2);border-radius:12px;padding:12px 12px 11px;text-align:right;min-height:72px;transition:.16s ease}.type-cards button:hover{border-color:var(--accent-line);background:color-mix(in srgb,var(--accent-soft) 30%,var(--panel-2) 70%);transform:translateY(-1px)}.type-cards button.selected{border-color:var(--accent-line);background:var(--accent-soft);color:var(--accent);box-shadow:inset 0 0 0 1px rgba(24,90,189,.06)}.type-cards b{display:block;font-size:11.8px}.type-cards small{display:block;font-size:9.5px;color:var(--muted-2);margin-top:5px;line-height:1.55}
  .character-grid{grid-template-columns:minmax(220px,1.25fr) minmax(90px,.42fr) minmax(150px,.7fr)}
  .character-grid .character-name{grid-column:auto}.character-grid .character-age{grid-column:auto}.character-grid .character-role{grid-column:auto}
  .location-grid{grid-template-columns:minmax(260px,1.6fr) minmax(135px,.65fr) minmax(135px,.65fr)}
  .location-grid .location-name{grid-column:auto}.location-grid .location-kind{grid-column:auto}.location-grid .location-time{grid-column:auto}

  .empty-builder{width:min(100%,900px);margin-inline:auto;border:1px dashed var(--line);background:var(--panel-2);color:var(--text-2);border-radius:13px;padding:25px;display:flex;flex-direction:column;align-items:center;gap:4px}.empty-builder:hover{border-color:var(--accent-line);background:var(--panel-2)}.empty-builder b{font-size:25px;color:var(--accent)}.empty-builder span{font-size:13px;font-weight:800;color:var(--text)}.empty-builder small{font-size:10.5px;color:var(--muted-2)}
  .entity-edit-list{width:min(100%,960px);margin-inline:auto;display:flex;flex-direction:column;gap:9px}.entity-card{border:1px solid var(--line);background:var(--panel-2);border-radius:12px;overflow:hidden}.entity-card[open]{border-color:var(--accent-line);background:var(--panel-2)}.entity-card summary{list-style:none;display:flex;align-items:center;gap:10px;padding:11px 12px;cursor:pointer}.entity-card summary::-webkit-details-marker{display:none}.entity-card summary>i{width:10px;height:10px;border-radius:99px;box-shadow:0 0 10px rgba(255,255,255,.12)}.location-card summary>i{border-radius:2px;background:#8a8a8a;transform:rotate(45deg)}.entity-card summary>div{flex:1;min-width:0}.entity-card summary b{display:block;font-size:13px;color:var(--text)}.entity-card summary small{display:block;font-size:10px;color:var(--muted-2);margin-top:2px}.entity-card summary>span{font-size:10px;color:var(--muted)}.entity-card-body{padding:14px;border-top:1px solid var(--line-soft);background:var(--panel-2)}.entity-card-actions{display:flex;justify-content:flex-end;padding-top:12px}.danger-link{border:1px solid rgba(239,107,115,.28);background:rgba(239,107,115,.06);color:var(--danger);border-radius:8px;padding:7px 10px;font-size:10px}.danger-link:hover{background:rgba(239,107,115,.13)}
  .form-actions{display:flex;align-items:center;gap:8px;margin-top:20px;padding-top:15px;border-top:1px solid var(--line);position:sticky;bottom:-20px;background:var(--panel);padding-bottom:2px}.spacer{flex:1}
  @media(max-width:800px){.basics-form{max-width:none}.identity-row{grid-template-columns:1fr}.title-field,.author-field,.genre-field{width:100%}.metric-field{width:min(100%,220px)}.form-grid,.form-grid.three,.story-grid,.character-grid,.location-grid{grid-template-columns:1fr}.wide,.span2,.story-grid .wide,.character-grid .character-name,.character-grid .character-age,.character-grid .character-role,.location-grid .location-name,.location-grid .location-kind,.location-grid .location-time{grid-column:auto}.type-cards{grid-template-columns:1fr 1fr;max-width:none}.dossier-tabs{width:100%;justify-content:flex-start;overflow-x:auto;position:static;border-radius:12px}.dossier-tabs button{min-width:112px;flex:0 0 auto}.section-intro{grid-template-columns:1fr;gap:10px}.section-intro>div{grid-column:1}.section-intro>span,.section-intro>.soft-button{grid-column:1;justify-self:center}.form-actions{position:static;flex-wrap:wrap}.spacer{display:none}}

  /* v0.5.5 — larger project-file typography for long writing sessions. */
  .projects .modal-head h2{font-size:22px;line-height:1.35}
  .projects .modal-head>div p{font-size:13.5px;line-height:1.75}

  .projects .dossier-tabs button{min-height:46px;padding:9px 15px}
  .projects .dossier-tabs b{width:24px;height:24px;font-size:10px}
  .projects .dossier-tabs span{font-size:14px;font-weight:850}
  .projects .dossier-tabs em{min-width:22px;height:22px;font-size:10px}

  .projects .section-intro h3{font-size:21px;line-height:1.4}
  .projects .section-intro p{font-size:13.5px;line-height:1.85;max-width:680px}
  .projects .section-intro>span{font-size:11.5px;padding:5px 11px}
  .projects .section-intro>.soft-button{font-size:13px;padding:9px 13px}

  .projects label>span{font-size:13.5px;font-weight:650;margin-bottom:7px}
  .projects .field,.projects .textarea,.projects .select{font-size:14.5px;line-height:1.65;padding:12px 13px}
  .projects .field-lg{font-size:16px;font-weight:700;padding-block:14px}
  .projects .textarea{line-height:1.85}

  .projects .group-label>span{font-size:13.5px;font-weight:800}
  .projects .group-label>small{font-size:11.5px;line-height:1.7}
  .projects .metric-input em{font-size:11.5px}

  .projects .type-cards button{min-height:82px;padding:14px 14px 13px}
  .projects .type-cards b{font-size:14px}
  .projects .type-cards small{font-size:11.5px;line-height:1.65;margin-top:6px}

  .projects .entity-card summary{padding:13px 14px}
  .projects .entity-card summary b{font-size:15px}
  .projects .entity-card summary small{font-size:11.5px;line-height:1.55}
  .projects .entity-card summary>span{font-size:11.5px}
  .projects .empty-builder span{font-size:15px}
  .projects .empty-builder small{font-size:12px;line-height:1.6}
  .projects .danger-link{font-size:11.5px}

  .projects .primary-button,.projects .ghost-button,.projects .soft-button{font-size:13.5px}

  .projects .welcome-kicker{font-size:12.5px}
  .projects .welcome-kicker em{font-size:10.5px}
  .projects .welcome-copy h1{font-size:31px}
  .projects .welcome-copy p{font-size:15px;line-height:1.95}
  .projects .welcome-copy small{font-size:12.5px}
  .projects .welcome-create b{font-size:14.5px}
  .projects .library-head h2{font-size:20px}
  .projects .library-head p{font-size:13px}
  .projects .project-count{font-size:11.5px}
  .projects .project-title-row b{font-size:16px}
  .projects .project-title-row em{font-size:11px}
  .projects .project-open small{font-size:12px;line-height:1.65}
  .projects .open-project-label{font-size:12px}
  .projects .delete-project{font-size:11.5px}

  @media(max-width:760px){
    .projects .welcome-copy h1{font-size:26px}
    .projects .welcome-copy p{font-size:14px}
    .projects .dossier-tabs span{font-size:13px}
  }
  /* v0.5.9 — only the Basics step is vertically compact.
     Story, characters and locations keep their natural height and the modal scrolls normally. */
  .projects .modal-body.basics-view .project-form-scroll{padding-top:14px;padding-bottom:12px}
  .basics-view .dossier-tabs{margin-bottom:12px}
  .basics-view .section-intro{margin-bottom:9px;min-height:44px}
  .basics-view .section-intro p{margin-top:2px}
  .basics-view .basics-form{gap:12px;padding-bottom:0}
  .basics-view .basics-primary{gap:8px}
  .basics-view .identity-row{gap:10px}
  .basics-view .form-group{padding-top:10px}
  .basics-view .group-label{margin-bottom:7px}
  .basics-view .type-cards button{min-height:68px;padding:10px 12px}
  .basics-view .type-cards small{margin-top:3px;line-height:1.45}
  .basics-view .metric-row{gap:10px}
  .basics-view + .form-actions{margin-top:12px}
  .basics-view .form-actions{margin-top:12px;padding-top:10px}

  /* v0.6.18 — keep project actions permanently inside the visible window.
     Only the form content scrolls; the action bar is a fixed footer of the card. */
  .modal-backdrop.formBackdrop{
    padding:12px;
    overflow:hidden;
    align-items:stretch;
    justify-items:center;
  }
  .projects.landingCard.formCard{
    height:calc(100dvh - 24px);
    max-height:calc(100dvh - 24px);
    margin:0 auto;
    display:flex;
    flex-direction:column;
    overflow:hidden;
  }
  .projects.landingCard.formCard .modal-head{flex:0 0 auto}
  .projects.landingCard.formCard .modal-body{
    flex:1 1 auto;
    min-height:0;
    display:flex;
    flex-direction:column;
    overflow:hidden;
    padding:0;
  }
  .project-form-scroll{
    flex:1 1 auto;
    min-height:0;
    overflow-y:auto;
    overflow-x:hidden;
    padding:14px 24px 12px;
    scrollbar-gutter:stable;
  }
  .projects.landingCard.formCard .form-actions{
    flex:0 0 auto;
    position:static;
    bottom:auto;
    z-index:8;
    margin:0;
    padding:12px 24px 14px;
    border-top:1px solid var(--line);
    background:var(--panel);
    box-shadow:0 -8px 22px rgba(20,45,80,.045);
  }
  :global(:root[data-theme="dark"]) .projects.landingCard.formCard .form-actions{box-shadow:0 -10px 24px rgba(0,0,0,.16)}

  /* v0.6.17 — three project types, balanced in one row. */
  .basics-view .type-cards{grid-template-columns:repeat(3,minmax(0,1fr));max-width:840px;width:100%;margin-inline:auto}
  .basics-view .form-actions{margin-top:0}

  @media(max-height:950px){
    .projects .modal-body.basics-view .project-form-scroll{padding-top:10px;padding-bottom:8px}
    .basics-view .dossier-tabs{margin-bottom:8px;padding-block:6px}
    .basics-view .dossier-tabs button{min-height:40px;padding-block:6px}
    .basics-view .section-intro{margin-bottom:6px;min-height:40px}
    .basics-view .section-intro p{line-height:1.55}
    .basics-view .basics-form{gap:9px}
    .basics-view .basics-primary{gap:6px}
    .basics-view .identity-row{gap:8px}
    .basics-view .form-group{padding-top:8px}
    .basics-view .group-label{margin-bottom:5px}
    .basics-view .type-cards button{min-height:64px;padding:8px 10px}
    .basics-view .type-cards small{line-height:1.35;margin-top:2px}
    .basics-view .field,.basics-view .select{padding-block:9px}
    .basics-view .field-lg{padding-block:10px}
    .basics-view .form-actions{margin-top:0}
  }

  @media(max-width:800px){
    .basics-view .type-cards{grid-template-columns:1fr 1fr}
  }

  @media(max-height:800px){
    .basics-view .dossier-tabs{margin-bottom:6px}
    .basics-view .section-intro{margin-bottom:4px;min-height:34px}
    .basics-view .basics-form{gap:7px}
    .basics-view .basics-primary{gap:5px}
    .basics-view .form-group{padding-top:6px}
    .basics-view .type-cards button{min-height:58px;padding:7px 9px}
    .basics-view .field,.basics-view .select{padding-block:8px}
  }



  /* v0.6.19 — project actions live at the top of the form, outside the scroll area. */
  .projects.landingCard.formCard .form-top-actions{
    flex:0 0 auto;
    display:flex;
    align-items:center;
    gap:9px;
    padding:11px 24px;
    border-bottom:1px solid var(--line);
    background:var(--panel);
    box-shadow:0 6px 18px rgba(20,45,80,.035);
    z-index:9;
  }
  :global(:root[data-theme="dark"]) .projects.landingCard.formCard .form-top-actions{box-shadow:0 8px 20px rgba(0,0,0,.12)}
  .projects.landingCard.formCard .form-top-actions .primary-button{min-width:160px}
  .projects.landingCard.formCard .form-top-actions .ghost-button{white-space:nowrap}
  @media(max-width:800px){
    .projects.landingCard.formCard .form-top-actions{padding:9px 12px;flex-wrap:wrap}
    .projects.landingCard.formCard .form-top-actions .spacer{display:none}
    .projects.landingCard.formCard .form-top-actions .primary-button{min-width:0;flex:1 1 190px}
  }
</style>
