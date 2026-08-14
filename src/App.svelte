<script lang="ts">
  import { onMount, tick } from 'svelte';
  import TopBar from './components/TopBar.svelte';
  import BeatBoard from './components/BeatBoard.svelte';
  import ScreenplayEditor from './components/ScreenplayEditor.svelte';
  import RightSidebar from './components/RightSidebar.svelte';
  import StatusBar from './components/StatusBar.svelte';
  import AiDrawer from './components/AiDrawer.svelte';
  import FountainModal from './components/FountainModal.svelte';
  import ProjectModal from './components/ProjectModal.svelte';
  import ExportModal from './components/ExportModal.svelte';
  import PrintDocument from './components/PrintDocument.svelte';
  import PasteImportModal from './components/PasteImportModal.svelte';
  import NavigationRail from './components/NavigationRail.svelte';
  import ProjectTree from './components/ProjectTree.svelte';
  import SeriesStructureModal from './components/SeriesStructureModal.svelte';
  import type { Character, Episode, Location, ProjectDraft, ProjectSnapshot, ProjectSummary, Scene, ScreenplayBlock, Season } from './lib/types';
  import { createDemoProject, createEmptyProject } from './lib/demo';
  import { deleteProject, exportBinaryFile, exportTextFile, isDesktopRuntime, listProjects, loadProject, saveProject } from './lib/bridge';
  import { newId } from './lib/id';
  import { calculateLocalAnalysis } from './lib/metrics';
  import { toFountain } from './lib/fountain';
  import { buildScreenplayDocx } from './lib/docxExport';
  import { extractDocxText } from './lib/docxImport';
  import { estimateFormattedPages } from './lib/pageEstimate';
  import { defaultSceneTime, ensureSceneHeadingMetadata, parseSceneHeading, syncSceneHeading } from './lib/sceneHeading';
  import { parseSceneHeadingEntity, type PasteRecognition, type RecognizedBlock } from './lib/pasteImport';
  import { episodeLabel, orderedEpisodes, scenesForEpisode } from './lib/structure';
  import { discoverScriptCharacterNames } from './lib/characterDiscovery';

  type DossierTab = 'basics' | 'story' | 'characters' | 'locations';
  type StructureDialogMode = 'season' | 'episode' | 'move-scene';

  const palette = ['#E8B86D', '#7DD3FC', '#A78BFA', '#6EE7B7', '#FB7185', '#F9A8D4'];

  let snapshot: ProjectSnapshot = createDemoProject();
  let projectSummaries: ProjectSummary[] = [];
  let selectedEpisodeId = snapshot.episodes[0]?.id ?? '';
  let selectedSceneId = snapshot.scenes[0]?.id ?? '';
  let activeBlockId = snapshot.scenes[0]?.blocks[0]?.id ?? '';
  let saveState: 'saved' | 'saving' | 'error' = 'saved';
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  let ready = false;
  let hasOpenProject = false;
  let startupProjects = true;
  let showAi = false;
  let assistantPaneWidth = 470;
  let assistantRevealBlockId = '';
  let showFountain = false;
  let showProjects = false;
  let projectModalMode: 'list' | 'new' | 'edit' = 'list';
  let projectModalTab: DossierTab = 'basics';
  let projectModalFocusId = '';
  let showExport = false;
  let showPasteImport = false;
  let showProjectTree = false;
  let theme: 'light' | 'dark' = 'light';
  let pasteImportText = '';
  let pasteImportSource: 'paste' | 'docx' | 'fountain' = 'paste';
  let pasteImportSourceName = '';
  let pasteImportWarnings: string[] = [];
  let pasteImportAutoAnalyze = false;
  let docxFileInput: HTMLInputElement | null = null;
  let fountainFileInput: HTMLInputElement | null = null;
  let printIncludeDossier = false;
  let toast = '';
  let toastTimer: ReturnType<typeof setTimeout> | null = null;
  let showStructureDialog = false;
  let structureDialogMode: StructureDialogMode = 'episode';
  let structureSeasonId = '';
  let structureEpisodeId = '';
  let structureSceneId = '';
  let episodePageNode: HTMLDivElement | null = null;
  let episodeScrollFrame = 0;

  $: activeEpisode = snapshot.episodes.find((episode) => episode.id === selectedEpisodeId) ?? snapshot.episodes[0] ?? null;
  $: episodeScenes = activeEpisode ? scenesForEpisode(snapshot, activeEpisode.id) : [];
  $: episodeOptions = orderedEpisodes(snapshot).map((episode) => ({ id: episode.id, label: episodeLabel(snapshot, episode.id) }));
  $: selectedScene = snapshot.scenes.find((s) => s.id === selectedSceneId) ?? episodeScenes[0];
  $: selectedSceneNumber = selectedScene ? episodeScenes.findIndex((scene) => scene.id === selectedScene.id) + 1 : 0;
  $: episodePages = episodeScenes.reduce((sum, scene) => sum + (scene.durationPages || 0), 0);
  // Rebuild this derived index from the screenplay on every snapshot change.
  // It never rewrites the screenplay itself; it only feeds conservative suggestions.
  $: scriptCharacterNames = discoverScriptCharacterNames(snapshot.scenes, snapshot.characters);
  $: activeBlock = selectedScene?.blocks.find((b) => b.id === activeBlockId) ?? null;
  $: metrics = calculateLocalAnalysis(snapshot);
  $: fountain = toFountain(snapshot);

  onMount(async () => {
    const savedTheme = localStorage.getItem('scene-writer-theme');
    theme = savedTheme === 'dark' ? 'dark' : 'light';
    document.documentElement.dataset.theme = theme;
    const savedAssistantWidth = Number(localStorage.getItem('scene-writer-assistant-width') || 0);
    if (Number.isFinite(savedAssistantWidth) && savedAssistantWidth >= 330) assistantPaneWidth = savedAssistantWidth;
    try {
      // Start on the project library every time. Do not auto-open the last project.
      projectSummaries = await listProjects();
      snapshot = normalizeSnapshot(createEmptyProject('مشروع بلا عنوان'));
      selectedEpisodeId = snapshot.episodes[0]?.id ?? '';
      selectedSceneId = '';
      activeBlockId = '';
      hasOpenProject = false;
      projectModalMode = 'list';
      projectModalTab = 'basics';
      projectModalFocusId = '';
      startupProjects = true;
      showProjects = true;
    } catch (error) {
      console.error(error);
      projectSummaries = [];
      snapshot = normalizeSnapshot(createEmptyProject('مشروع بلا عنوان'));
      selectedEpisodeId = snapshot.episodes[0]?.id ?? '';
      selectedSceneId = '';
      activeBlockId = '';
      hasOpenProject = false;
      projectModalMode = 'list';
      startupProjects = true;
      showProjects = true;
      notify('بدأ التطبيق في وضع محلي مؤقت.');
    } finally {
      ready = true;
    }
  });

  function openAssistant() {
    showProjectTree = false;
    showAi = true;
  }

  function closeAssistant() {
    showAi = false;
    assistantRevealBlockId = '';
  }

  function startAssistantResize(event: MouseEvent) {
    event.preventDefault();
    const move = (moveEvent: MouseEvent) => {
      const maxWidth = Math.max(390, Math.min(760, window.innerWidth * 0.58));
      assistantPaneWidth = Math.max(330, Math.min(maxWidth, moveEvent.clientX));
    };
    const stop = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', stop);
      document.body.classList.remove('assistant-resizing');
      localStorage.setItem('scene-writer-assistant-width', String(Math.round(assistantPaneWidth)));
    };
    document.body.classList.add('assistant-resizing');
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', stop, { once: true });
  }

  function toggleTheme() {
    theme = theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('scene-writer-theme', theme);
    notify(theme === 'dark' ? 'تم تفعيل النمط الداكن.' : 'تم تفعيل النمط الفاتح.');
  }

  function openTree() {
    showProjectTree = !showProjectTree;
  }

  function openTreeScenes() {
    showProjectTree = true;
  }

  function openDossierFromNavigation(tab: DossierTab) {
    showProjectTree = false;
    openProjectFile(tab);
  }

  function notify(message: string) {
    toast = message;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast = '', 2600);
  }

  function createSeason(projectId: string, index: number): Season {
    return { id: newId('season'), projectId, orderIndex: index, number: index + 1, title: '' };
  }

  function createEpisode(projectId: string, seasonId: string | null, index: number, title?: string): Episode {
    return {
      id: newId('episode'), projectId, seasonId, orderIndex: index, number: index + 1,
      title: title ?? '', logline: '', synopsis: '', notes: '', estimatedDurationMin: null
    };
  }

  function normalizeSnapshot(value: ProjectSnapshot): ProjectSnapshot {
    value.project.estimatedDurationMin ??= null;
    value.project.episodeCount ??= null;
    value.project.genre ??= '';
    value.project.storyIdea ??= '';
    value.project.shortSynopsis ??= '';
    value.project.story ??= '';
    value.project.treatment ??= '';
    value.project.notes ??= '';
    value.seasons = value.seasons ?? [];
    value.episodes = value.episodes ?? [];

    if (value.project.projectType === 'series') {
      if (!value.seasons.length) value.seasons = [createSeason(value.project.id, 0)];
      const firstSeason = value.seasons[0];
      if (!value.episodes.length) {
        const count = Math.max(1, value.project.episodeCount ?? 1);
        value.episodes = Array.from({ length: count }, (_, index) => createEpisode(value.project.id, firstSeason.id, index));
      }
      value.seasons = value.seasons.map((season) => ({
        ...season,
        title: /^الموسم\s+\d+$/.test((season.title ?? '').trim()) ? '' : (season.title ?? '')
      }));
      value.episodes = value.episodes.map((episode) => ({
        ...episode,
        seasonId: episode.seasonId || firstSeason.id,
        title: /^الحلقة\s+\d+$/.test((episode.title ?? '').trim()) ? '' : (episode.title ?? ''),
        logline: episode.logline ?? '',
        synopsis: episode.synopsis ?? '',
        notes: episode.notes ?? '',
        estimatedDurationMin: episode.estimatedDurationMin ?? null
      }));
      value.project.episodeCount = Math.max(value.project.episodeCount ?? 0, value.episodes.length);
    } else {
      if (!value.episodes.length) {
        const label = value.project.projectType === 'short' ? 'الفيلم القصير' : value.project.projectType === 'documentary' ? 'الفيلم الوثائقي' : 'الفيلم';
        value.episodes = [createEpisode(value.project.id, null, 0, label)];
      }
      value.episodes = value.episodes.map((episode) => ({ ...episode, seasonId: null, logline: episode.logline ?? '', synopsis: episode.synopsis ?? '', notes: episode.notes ?? '', estimatedDurationMin: episode.estimatedDurationMin ?? null }));
      value.seasons = [];
    }

    const fallbackEpisode = value.episodes[0]?.id ?? null;
    value.scenes = (value.scenes ?? []).map((scene) => {
      const normalized = ensureSceneHeadingMetadata({ ...scene, episodeId: scene.episodeId || fallbackEpisode, blocks: [...(scene.blocks ?? [])], durationPages: estimateFormattedPages(scene.blocks ?? []) });
      return normalized;
    });
    for (const episode of value.episodes) {
      const scenes = value.scenes.filter((scene) => scene.episodeId === episode.id).sort((a, b) => a.orderIndex - b.orderIndex);
      scenes.forEach((scene, index) => scene.orderIndex = index);
    }

    value.characters = (value.characters ?? []).map((character, index) => ({
      ...character,
      aliases: character.aliases ?? '',
      age: character.age ?? null,
      occupation: character.occupation ?? '',
      dramaticFunction: character.dramaticFunction ?? '',
      bio: character.bio ?? '',
      background: character.background ?? '',
      traits: character.traits ?? '',
      goal: character.goal ?? '',
      motivation: character.motivation ?? '',
      conflict: character.conflict ?? '',
      strengths: character.strengths ?? '',
      weaknesses: character.weaknesses ?? '',
      arc: character.arc ?? '',
      relationships: character.relationships ?? '',
      voiceStyle: character.voiceStyle ?? '',
      notes: character.notes ?? '',
      color: character.color || palette[index % palette.length]
    }));
    value.locations = (value.locations ?? []).map((location) => ({
      ...location,
      description: location.description ?? '',
      dramaticImportance: location.dramaticImportance ?? '',
      visualNotes: location.visualNotes ?? '',
      temporalNotes: location.temporalNotes ?? '',
      notes: location.notes ?? ''
    }));
    return value;
  }

  function setSnapshot(value: ProjectSnapshot) {
    const normalized = normalizeSnapshot(value);
    snapshot = normalized;
    hasOpenProject = true;
    const firstEpisode = orderedEpisodes(normalized)[0] ?? normalized.episodes[0];
    selectedEpisodeId = firstEpisode?.id ?? '';
    const firstScene = selectedEpisodeId ? scenesForEpisode(normalized, selectedEpisodeId)[0] : undefined;
    selectedSceneId = firstScene?.id ?? '';
    activeBlockId = firstScene?.blocks[0]?.id ?? '';
    localStorage.setItem('scene-writer-last-project', normalized.project.id);
  }

  async function refreshProjects() {
    projectSummaries = await listProjects();
  }

  async function openProjectManager() {
    await refreshProjects();
    projectModalMode = 'list';
    projectModalTab = 'basics';
    projectModalFocusId = '';
    startupProjects = false;
    showProjects = true;
  }

  function openProjectFile(tab: DossierTab = 'basics', focusEntityId = '') {
    projectModalMode = 'edit';
    projectModalTab = tab;
    projectModalFocusId = focusEntityId;
    showProjects = true;
  }

  function touchAndSchedule() {
    snapshot.project.updatedAt = new Date().toISOString();
    snapshot = { ...snapshot, project: { ...snapshot.project } };
    scheduleSave();
  }

  function scheduleSave() {
    if (!ready || !hasOpenProject) return;
    saveState = 'saving';
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      try {
        await saveProject(snapshot);
        saveState = 'saved';
        projectSummaries = projectSummaries.map((p) => p.id === snapshot.project.id ? {
          ...p,
          title: snapshot.project.title,
          author: snapshot.project.author,
          projectType: snapshot.project.projectType,
          estimatedDurationMin: snapshot.project.estimatedDurationMin,
          episodeCount: snapshot.project.episodeCount,
          updatedAt: snapshot.project.updatedAt
        } : p);
      } catch (error) {
        console.error(error);
        saveState = 'error';
      }
    }, 650);
  }

  function updateProjectTitle(value: string) {
    snapshot.project.title = value;
    touchAndSchedule();
  }

  function updateScene(scene: Scene) {
    syncSceneHeading(scene);
    scene.durationPages = estimateFormattedPages(scene.blocks ?? []);
    const index = snapshot.scenes.findIndex((s) => s.id === scene.id);
    if (index >= 0) snapshot.scenes[index] = { ...scene, blocks: [...scene.blocks] };
    snapshot.scenes = [...snapshot.scenes];
    touchAndSchedule();
  }

  function episodeDisplayName(episode: Episode | null | undefined): string {
    if (!episode) return 'الحلقة';
    return episode.title?.trim() ? `الحلقة ${episode.number} — ${episode.title.trim()}` : `الحلقة ${episode.number}`;
  }

  function seasonDisplayName(season: Season | null | undefined): string {
    if (!season) return 'الموسم';
    return season.title?.trim() ? `الموسم ${season.number} — ${season.title.trim()}` : `الموسم ${season.number}`;
  }

  function renumberSeasonEpisodes(seasonId: string | null) {
    const siblings = snapshot.episodes
      .filter((episode) => episode.seasonId === seasonId)
      .sort((a, b) => a.orderIndex - b.orderIndex || a.number - b.number);
    siblings.forEach((episode, index) => {
      episode.orderIndex = index;
      episode.number = index + 1;
      if (/^الحلقة\s+\d+$/.test((episode.title ?? '').trim())) episode.title = '';
    });
  }

  function renumberSeasons() {
    const ordered = [...snapshot.seasons].sort((a,b) => a.orderIndex - b.orderIndex || a.number - b.number);
    ordered.forEach((season, index) => {
      season.orderIndex = index;
      season.number = index + 1;
      if (/^الموسم\s+\d+$/.test((season.title ?? '').trim())) season.title = '';
    });
  }

  function openSeasonDialog(id: string) {
    structureDialogMode = 'season';
    structureSeasonId = id;
    structureEpisodeId = '';
    structureSceneId = '';
    showStructureDialog = true;
  }

  function openEpisodeDialog(id: string) {
    structureDialogMode = 'episode';
    structureEpisodeId = id;
    structureSeasonId = snapshot.episodes.find((episode) => episode.id === id)?.seasonId ?? '';
    structureSceneId = '';
    showStructureDialog = true;
  }

  function openMoveSceneDialog(id: string) {
    structureDialogMode = 'move-scene';
    structureSceneId = id;
    structureEpisodeId = '';
    structureSeasonId = '';
    showStructureDialog = true;
  }

  function closeStructureDialog() {
    showStructureDialog = false;
    structureSeasonId = '';
    structureEpisodeId = '';
    structureSceneId = '';
  }

  function saveSeasonDetails(id: string, title: string) {
    const season = snapshot.seasons.find((item) => item.id === id);
    if (!season) return;
    season.title = title;
    snapshot.seasons = [...snapshot.seasons];
    touchAndSchedule();
    closeStructureDialog();
    notify(`تم حفظ ${seasonDisplayName(season)}.`);
  }

  function saveEpisodeDetails(id: string, values: { title: string; synopsis: string; notes: string }) {
    const episode = snapshot.episodes.find((item) => item.id === id);
    if (!episode) return;
    episode.title = values.title;
    episode.synopsis = values.synopsis;
    episode.notes = values.notes;
    snapshot.episodes = [...snapshot.episodes];
    touchAndSchedule();
    closeStructureDialog();
    notify(`تم حفظ بيانات ${episodeDisplayName(episode)}.`);
  }

  function moveSceneToEpisode(sceneId: string, targetEpisodeId: string) {
    const scene = snapshot.scenes.find((item) => item.id === sceneId);
    const target = snapshot.episodes.find((item) => item.id === targetEpisodeId);
    if (!scene || !target || scene.episodeId === targetEpisodeId) {
      closeStructureDialog();
      return;
    }
    const sourceEpisodeId = scene.episodeId;
    const targetScenes = scenesForEpisode(snapshot, targetEpisodeId);
    scene.episodeId = targetEpisodeId;
    scene.orderIndex = targetScenes.length;
    if (sourceEpisodeId) {
      const sourceScenes = snapshot.scenes.filter((item) => item.episodeId === sourceEpisodeId && item.id !== sceneId).sort((a,b) => a.orderIndex - b.orderIndex);
      sourceScenes.forEach((item, index) => item.orderIndex = index);
    }
    const refreshedTarget = snapshot.scenes.filter((item) => item.episodeId === targetEpisodeId).sort((a,b) => a.orderIndex - b.orderIndex);
    refreshedTarget.forEach((item, index) => item.orderIndex = index);
    snapshot.scenes = [...snapshot.scenes];
    selectedEpisodeId = targetEpisodeId;
    selectedSceneId = sceneId;
    activeBlockId = scene.blocks[0]?.id ?? '';
    touchAndSchedule();
    closeStructureDialog();
    notify(`نُقل المشهد إلى ${episodeDisplayName(target)}.`);
  }

  function duplicateEpisode(id: string) {
    if (snapshot.project.projectType !== 'series') return;
    const source = snapshot.episodes.find((item) => item.id === id);
    if (!source || !source.seasonId) return;
    const siblings = snapshot.episodes.filter((item) => item.seasonId === source.seasonId).sort((a,b) => a.orderIndex - b.orderIndex);
    const sourceIndex = siblings.findIndex((item) => item.id === id);
    const copy: Episode = {
      ...source,
      id: newId('episode'),
      orderIndex: sourceIndex + 1,
      number: sourceIndex + 2,
      title: source.title?.trim() ? `${source.title.trim()} — نسخة` : '',
      notes: source.notes ?? ''
    };
    const before = siblings.slice(0, sourceIndex + 1);
    const after = siblings.slice(sourceIndex + 1);
    const reordered = [...before, copy, ...after];
    reordered.forEach((episode, index) => { episode.orderIndex = index; episode.number = index + 1; });
    snapshot.episodes = [
      ...snapshot.episodes.filter((item) => item.seasonId !== source.seasonId),
      ...reordered
    ];
    const now = new Date().toISOString();
    const copiedScenes = scenesForEpisode(snapshot, source.id).map((scene, index) => ({
      ...scene,
      id: newId('scene'),
      episodeId: copy.id,
      orderIndex: index,
      createdAt: now,
      blocks: (scene.blocks ?? []).map((block) => ({ ...block, id: newId('block') }))
    }));
    snapshot.scenes = [...snapshot.scenes, ...copiedScenes];
    snapshot.project.episodeCount = snapshot.episodes.length;
    selectedEpisodeId = copy.id;
    selectedSceneId = copiedScenes[0]?.id ?? '';
    activeBlockId = copiedScenes[0]?.blocks[0]?.id ?? '';
    touchAndSchedule();
    notify(`تم نسخ ${episodeDisplayName(source)}.`);
  }

  function reorderEpisode(sourceId: string, targetId: string) {
    if (snapshot.project.projectType !== 'series' || sourceId === targetId) return;
    const source = snapshot.episodes.find((item) => item.id === sourceId);
    const target = snapshot.episodes.find((item) => item.id === targetId);
    if (!source || !target || source.seasonId !== target.seasonId) {
      notify('يمكن ترتيب الحلقات بالسحب داخل الموسم نفسه.');
      return;
    }
    const siblings = snapshot.episodes.filter((item) => item.seasonId === source.seasonId).sort((a,b) => a.orderIndex - b.orderIndex);
    const from = siblings.findIndex((item) => item.id === sourceId);
    const to = siblings.findIndex((item) => item.id === targetId);
    if (from < 0 || to < 0) return;
    const [moved] = siblings.splice(from, 1);
    siblings.splice(to, 0, moved);
    siblings.forEach((episode, index) => { episode.orderIndex = index; episode.number = index + 1; });
    snapshot.episodes = [
      ...snapshot.episodes.filter((item) => item.seasonId !== source.seasonId),
      ...siblings
    ];
    touchAndSchedule();
    notify('تم تحديث ترتيب الحلقات.');
  }

  async function selectEpisode(id: string) {
    selectedEpisodeId = id;
    const first = scenesForEpisode(snapshot, id)[0];
    selectedSceneId = first?.id ?? '';
    activeBlockId = '';
    await tick();
    if (episodePageNode) episodePageNode.scrollTo({ top: 0, behavior: 'auto' });
  }

  async function scrollToScene(id: string, behavior: ScrollBehavior = 'smooth') {
    await tick();
    if (!episodePageNode) return;
    const target = episodePageNode.querySelector<HTMLElement>(`[data-episode-scene="${id}"]`);
    if (!target) return;
    const containerTop = episodePageNode.getBoundingClientRect().top;
    const targetTop = target.getBoundingClientRect().top;
    const nextTop = episodePageNode.scrollTop + targetTop - containerTop - 26;
    episodePageNode.scrollTo({ top: Math.max(0, nextTop), behavior });
  }

  async function selectScene(id: string) {
    const scene = snapshot.scenes.find((s) => s.id === id);
    if (!scene) return;
    if (scene.episodeId && scene.episodeId !== selectedEpisodeId) selectedEpisodeId = scene.episodeId;
    selectedSceneId = id;
    activeBlockId = '';
    await scrollToScene(id);
  }

  async function handleAssistantSelectScene(id: string, blockId = '') {
    await selectScene(id);
    assistantRevealBlockId = blockId;
    if (!blockId) return;
    const targetScene = snapshot.scenes.find((item) => item.id === id);
    if (!targetScene?.blocks.some((block) => block.id === blockId)) return;
    activeBlockId = blockId;
    await tick();
    const target = episodePageNode?.querySelector<HTMLElement>(`[data-block-id="${blockId}"]`);
    if (!target) return;
    target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    target.classList.remove('assistant-reveal');
    requestAnimationFrame(() => target.classList.add('assistant-reveal'));
    window.setTimeout(() => target.classList.remove('assistant-reveal'), 2200);
  }

  function activateEditorScene(sceneId: string, blockId: string) {
    const scene = snapshot.scenes.find((item) => item.id === sceneId);
    if (!scene) return;
    selectedSceneId = sceneId;
    if (scene.episodeId) selectedEpisodeId = scene.episodeId;
    activeBlockId = blockId;
  }

  function handleEpisodeScroll() {
    if (!episodePageNode) return;
    if (episodeScrollFrame) cancelAnimationFrame(episodeScrollFrame);
    episodeScrollFrame = requestAnimationFrame(() => {
      episodeScrollFrame = 0;
      if (!episodePageNode) return;
      const focused = document.activeElement instanceof HTMLElement
        ? document.activeElement.closest<HTMLElement>('[data-episode-scene]')
        : null;
      if (focused && episodePageNode.contains(focused)) {
        const focusedId = focused.dataset.episodeScene ?? '';
        if (focusedId && focusedId !== selectedSceneId) selectedSceneId = focusedId;
        return;
      }
      const anchors = Array.from(episodePageNode.querySelectorAll<HTMLElement>('[data-episode-scene]'));
      if (!anchors.length) return;
      const guide = episodePageNode.getBoundingClientRect().top + 115;
      let best = anchors[0];
      let bestDistance = Number.POSITIVE_INFINITY;
      for (const anchor of anchors) {
        const rect = anchor.getBoundingClientRect();
        const distance = rect.top <= guide && rect.bottom >= guide
          ? 0
          : Math.min(Math.abs(rect.top - guide), Math.abs(rect.bottom - guide));
        if (distance < bestDistance) { best = anchor; bestDistance = distance; }
      }
      const id = best.dataset.episodeScene ?? '';
      if (id && id !== selectedSceneId) {
        selectedSceneId = id;
        if (!snapshot.scenes.find((scene) => scene.id === id)?.blocks.some((block) => block.id === activeBlockId)) activeBlockId = '';
      }
    });
  }

  function addSeason() {
    if (snapshot.project.projectType !== 'series') return;
    const season = createSeason(snapshot.project.id, snapshot.seasons.length);
    snapshot.seasons = [...snapshot.seasons, season];
    const episode = createEpisode(snapshot.project.id, season.id, 0);
    snapshot.episodes = [...snapshot.episodes, episode];
    snapshot.project.episodeCount = snapshot.episodes.length;
    selectedEpisodeId = episode.id;
    selectedSceneId = '';
    activeBlockId = '';
    touchAndSchedule();
    notify(`أضيف ${seasonDisplayName(season)}.`);
  }

  function addEpisode(seasonId?: string) {
    if (snapshot.project.projectType !== 'series') return;
    const season = snapshot.seasons.find((item) => item.id === seasonId)
      ?? snapshot.seasons.find((item) => item.id === activeEpisode?.seasonId)
      ?? snapshot.seasons[0];
    if (!season) return;
    const siblings = snapshot.episodes.filter((episode) => episode.seasonId === season.id);
    const episode = createEpisode(snapshot.project.id, season.id, siblings.length);
    snapshot.episodes = [...snapshot.episodes, episode];
    snapshot.project.episodeCount = snapshot.episodes.length;
    selectedEpisodeId = episode.id;
    selectedSceneId = '';
    activeBlockId = '';
    touchAndSchedule();
    notify(`أضيفت ${episodeDisplayName(episode)}.`);
  }

  function deleteEpisode(id: string) {
    if (snapshot.project.projectType !== 'series') return;
    if (snapshot.episodes.length <= 1) {
      notify('يجب أن يبقى للمسلسل حلقة واحدة على الأقل.');
      return;
    }
    const episode = snapshot.episodes.find((item) => item.id === id);
    if (!episode) return;
    const count = snapshot.scenes.filter((scene) => scene.episodeId === id).length;
    if (!confirm(`حذف ${episodeDisplayName(episode)}${count ? ` وكل مشاهدها (${count})` : ''}؟`)) return;
    snapshot.scenes = snapshot.scenes.filter((scene) => scene.episodeId !== id);
    snapshot.episodes = snapshot.episodes.filter((item) => item.id !== id);
    renumberSeasonEpisodes(episode.seasonId);
    snapshot.project.episodeCount = snapshot.episodes.length;
    const next = orderedEpisodes(snapshot)[0];
    selectEpisode(next?.id ?? '');
    touchAndSchedule();
  }

  function deleteSeason(id: string) {
    if (snapshot.project.projectType !== 'series') return;
    if (snapshot.seasons.length <= 1) {
      notify('يجب أن يبقى للمسلسل موسم واحد على الأقل.');
      return;
    }
    const season = snapshot.seasons.find((item) => item.id === id);
    if (!season) return;
    const episodeIds = new Set(snapshot.episodes.filter((episode) => episode.seasonId === id).map((episode) => episode.id));
    const remainingEpisodeCount = snapshot.episodes.filter((episode) => !episodeIds.has(episode.id)).length;
    if (remainingEpisodeCount === 0) {
      notify('لا يمكن حذف الموسم إذا كان سيترك المسلسل بلا حلقات. أضف حلقة إلى موسم آخر أولاً.');
      return;
    }
    const sceneCount = snapshot.scenes.filter((scene) => scene.episodeId && episodeIds.has(scene.episodeId)).length;
    if (!confirm(`حذف ${seasonDisplayName(season)} بكل حلقاته${sceneCount ? ` ومشاهده (${sceneCount})` : ''}؟`)) return;
    snapshot.scenes = snapshot.scenes.filter((scene) => !scene.episodeId || !episodeIds.has(scene.episodeId));
    snapshot.episodes = snapshot.episodes.filter((episode) => !episodeIds.has(episode.id));
    snapshot.seasons = snapshot.seasons.filter((item) => item.id !== id).sort((a,b)=>a.orderIndex-b.orderIndex);
    renumberSeasons();
    snapshot.project.episodeCount = snapshot.episodes.length;
    const next = orderedEpisodes(snapshot)[0];
    selectEpisode(next?.id ?? '');
    touchAndSchedule();
  }

  function addScene(afterSceneId: string | null = selectedSceneId || null) {
    const afterScene = afterSceneId ? snapshot.scenes.find((item) => item.id === afterSceneId) : null;
    const episode = (afterScene?.episodeId ? snapshot.episodes.find((item) => item.id === afterScene.episodeId) : null)
      ?? activeEpisode
      ?? snapshot.episodes[0];
    if (!episode) return;

    const ordered = scenesForEpisode(snapshot, episode.id);
    const afterIndex = afterScene ? ordered.findIndex((item) => item.id === afterScene.id) : -1;
    const insertIndex = afterIndex >= 0 ? afterIndex + 1 : ordered.length;
    const now = new Date().toISOString();
    const id = newId('scene');
    const headingBlock: ScreenplayBlock = { id: newId('block'), elementType: 'scene_heading', text: '' };
    const actionBlock: ScreenplayBlock = { id: newId('block'), elementType: 'action', text: '' };
    const scene: Scene = {
      id,
      projectId: snapshot.project.id,
      episodeId: episode.id,
      orderIndex: insertIndex,
      heading: '',
      sceneKind: null,
      scenePlace: '',
      sceneTime: '',
      locationId: null,
      blocks: [headingBlock, actionBlock],
      durationPages: 0,
      colorStatus: 'draft',
      createdAt: now
    };

    const nextOrder = [...ordered];
    nextOrder.splice(insertIndex, 0, scene);
    nextOrder.forEach((item, index) => item.orderIndex = index);
    snapshot.scenes = [
      ...snapshot.scenes.filter((item) => item.episodeId !== episode.id),
      ...nextOrder
    ];
    selectedEpisodeId = episode.id;
    selectedSceneId = id;
    activeBlockId = headingBlock.id;
    touchAndSchedule();
    void scrollToScene(id);
  }

  function duplicateScene(id: string) {
    const source = snapshot.scenes.find((item) => item.id === id);
    if (!source?.episodeId) return;
    const episodeId = source.episodeId;
    const ordered = scenesForEpisode(snapshot, episodeId);
    const sourceIndex = ordered.findIndex((item) => item.id === id);
    if (sourceIndex < 0) return;
    const now = new Date().toISOString();
    const copy: Scene = {
      ...source,
      id: newId('scene'),
      orderIndex: sourceIndex + 1,
      colorStatus: 'draft',
      createdAt: now,
      blocks: source.blocks.map((block) => ({ ...block, id: newId('block') }))
    };
    const nextOrder = [...ordered];
    nextOrder.splice(sourceIndex + 1, 0, copy);
    nextOrder.forEach((item, index) => item.orderIndex = index);
    snapshot.scenes = [
      ...snapshot.scenes.filter((item) => item.episodeId !== episodeId),
      ...nextOrder
    ];
    selectedEpisodeId = episodeId;
    selectedSceneId = copy.id;
    activeBlockId = copy.blocks.find((block) => block.elementType !== 'scene_heading')?.id ?? copy.blocks[0]?.id ?? '';
    touchAndSchedule();
    notify(`تم نسخ المشهد ${sourceIndex + 1} إلى مشهد جديد قابل للتحرير.`);
  }

  function deleteScene(id: string) {
    if (!confirm('حذف هذا المشهد نهائياً؟')) return;
    const scene = snapshot.scenes.find((item) => item.id === id);
    if (!scene) return;
    const episodeId = scene.episodeId ?? selectedEpisodeId;
    const before = scenesForEpisode(snapshot, episodeId);
    const index = before.findIndex((item) => item.id === id);
    snapshot.scenes = snapshot.scenes.filter((item) => item.id !== id);
    const remaining = scenesForEpisode(snapshot, episodeId);
    remaining.forEach((item, i) => item.orderIndex = i);
    const next = remaining[Math.max(0, index - 1)] ?? remaining[0];
    selectedSceneId = next?.id ?? '';
    activeBlockId = next?.blocks[0]?.id ?? '';
    touchAndSchedule();
  }

  function moveScene(id: string, direction: -1 | 1) {
    const scene = snapshot.scenes.find((item) => item.id === id);
    if (!scene?.episodeId) return;
    const scenes = scenesForEpisode(snapshot, scene.episodeId);
    const index = scenes.findIndex((item) => item.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= scenes.length) return;
    [scenes[index], scenes[target]] = [scenes[target], scenes[index]];
    scenes.forEach((item, i) => item.orderIndex = i);
    snapshot.scenes = [...snapshot.scenes];
    touchAndSchedule();
  }

  function reorderScene(sourceId: string, targetId: string) {
    const source = snapshot.scenes.find((item) => item.id === sourceId);
    const target = snapshot.scenes.find((item) => item.id === targetId);
    if (!source?.episodeId || !target?.episodeId || source.episodeId !== target.episodeId) return;
    const scenes = scenesForEpisode(snapshot, source.episodeId);
    const from = scenes.findIndex((item) => item.id === sourceId);
    const to = scenes.findIndex((item) => item.id === targetId);
    if (from < 0 || to < 0 || from == to) return;
    const [moved] = scenes.splice(from, 1);
    scenes.splice(to, 0, moved);
    scenes.forEach((item, index) => item.orderIndex = index);
    snapshot.scenes = [...snapshot.scenes];
    touchAndSchedule();
  }

  function cycleStatus(id: string) {
    const scene = snapshot.scenes.find((s) => s.id === id);
    if (!scene) return;
    scene.colorStatus = scene.colorStatus === 'draft' ? 'done' : scene.colorStatus === 'done' ? 'needs_review' : 'draft';
    updateScene(scene);
  }

  function addCharacter(name: string, bio = '', role: Character['role'] = 'secondary'): Character | null {
    const cleanName = name.trim();
    if (!cleanName) return null;
    const existing = snapshot.characters.find((c) => c.name.trim() === cleanName);
    if (existing) return existing;
    const character: Character = {
      id: newId('character'), projectId: snapshot.project.id, name: cleanName, aliases: '', age: null, role,
      occupation: '', dramaticFunction: '', bio, background: '', traits: '', goal: '', motivation: '', conflict: '',
      strengths: '', weaknesses: '', arc: '', relationships: '', voiceStyle: '', notes: '', color: palette[snapshot.characters.length % palette.length]
    };
    snapshot.characters = [...snapshot.characters, character];
    touchAndSchedule();
    notify(`أضيفت الشخصية «${character.name}» إلى ملف المشروع.`);
    return character;
  }

  function addLocation(name: string, kind: Location['kind'] = 'INT'): Location | null {
    const cleanName = name.trim();
    if (!cleanName) return null;
    const existing = snapshot.locations.find((l) => l.name.trim() === cleanName);
    if (existing) return existing;
    const location: Location = {
      id: newId('location'), projectId: snapshot.project.id, name: cleanName, kind,
      timeOfDay: 'DAY', description: '', dramaticImportance: '', visualNotes: '', temporalNotes: '', notes: ''
    };
    snapshot.locations = [...snapshot.locations, location];
    touchAndSchedule();
    notify(`أضيف المكان «${location.name}» إلى ملف المشروع.`);
    return location;
  }

  function removeCharacter(id: string) {
    const character = snapshot.characters.find((c) => c.id === id);
    if (!character) return;
    if (!confirm(`حذف الشخصية «${character.name}» من قائمة المشروع؟\nلن يُحذف اسمها من النص المكتوب داخل المشاهد.`)) return;
    snapshot.characters = snapshot.characters.filter((c) => c.id !== id);
    touchAndSchedule();
    notify(`تم حذف الشخصية «${character.name}».`);
  }

  function removeLocation(id: string) {
    const location = snapshot.locations.find((l) => l.id === id);
    if (!location) return;
    if (!confirm(`حذف الموقع «${location.name}» من قائمة المشروع؟\nسيبقى عنوان المشهد المكتوب كما هو.`)) return;
    snapshot.locations = snapshot.locations.filter((l) => l.id !== id);
    snapshot.scenes = snapshot.scenes.map((scene) => scene.locationId === id ? { ...scene, locationId: null } : scene);
    touchAndSchedule();
    notify(`تم حذف الموقع «${location.name}».`);
  }

  function insertCharacter(character: Character) {
    const scene = selectedScene;
    if (!scene) return;
    const index = Math.max(0, scene.blocks.findIndex((b) => b.id === activeBlockId));
    const current = scene.blocks[index];
    if (current?.elementType === 'character' && !current.text.trim()) {
      current.text = character.name;
      activeBlockId = current.id;
    } else {
      const block: ScreenplayBlock = { id: newId('block'), elementType: 'character', text: character.name };
      scene.blocks.splice(index + 1, 0, block);
      activeBlockId = block.id;
    }
    updateScene(scene);
    setTimeout(() => document.querySelector<HTMLTextAreaElement>(`textarea[data-block-id="${activeBlockId}"]`)?.focus(), 0);
  }

  function insertCharacterName(name: string) {
    const cleanName = name.trim();
    const scene = selectedScene;
    if (!scene || !cleanName) return;
    const index = Math.max(0, scene.blocks.findIndex((b) => b.id === activeBlockId));
    const current = scene.blocks[index];
    if (current?.elementType === 'character' && !current.text.trim()) {
      current.text = cleanName;
      activeBlockId = current.id;
    } else {
      const block: ScreenplayBlock = { id: newId('block'), elementType: 'character', text: cleanName };
      scene.blocks.splice(index + 1, 0, block);
      activeBlockId = block.id;
    }
    updateScene(scene);
  }

  function promoteScriptCharacter(name: string) {
    addCharacter(name);
  }

  function insertLocation(location: Location) {
    const scene = selectedScene;
    if (!scene) return;
    scene.locationId = location.id;
    scene.sceneKind = scene.sceneKind ?? location.kind;
    scene.scenePlace = location.name;
    scene.sceneTime = scene.sceneTime || defaultSceneTime(location);
    syncSceneHeading(scene);
    updateScene(scene);
  }

  function replaceActive(text: string) {
    if (!selectedScene || !activeBlock) return;
    activeBlock.text = text;
    selectedScene.durationPages = estimateFormattedPages(selectedScene.blocks);
    updateScene(selectedScene);
    notify('تم تطبيق الاقتراح على العنصر المحدد.');
  }

  function insertAction(text: string) {
    if (!selectedScene) return;
    const index = Math.max(0, selectedScene.blocks.findIndex((b) => b.id === activeBlockId));
    const block: ScreenplayBlock = { id: newId('block'), elementType: 'action_line', text };
    selectedScene.blocks.splice(index + 1, 0, block);
    activeBlockId = block.id;
    updateScene(selectedScene);
    notify('أُدرج الفعل في المشهد.');
  }

  async function openProject(id: string) {
    if (saveTimer) clearTimeout(saveTimer);
    if (hasOpenProject) {
      try { await saveProject(snapshot); } catch {}
    }
    const loaded = await loadProject(id);
    if (loaded) {
      setSnapshot(loaded);
      startupProjects = false;
      showProjects = false;
      notify(`تم فتح «${loaded.project.title}»`);
    }
  }

  async function newProject(data: ProjectDraft) {
    const project = createEmptyProject(
      data.title,
      data.projectType,
      data.author,
      data.logline,
      data.estimatedDurationMin,
      data.episodeCount
    );
    project.project.genre = data.genre;
    project.project.storyIdea = data.storyIdea;
    project.project.shortSynopsis = data.shortSynopsis;
    project.project.story = data.story;
    project.project.treatment = data.treatment;
    project.project.notes = data.notes;
    project.characters = data.characters.map((character, index) => ({
      id: character.id || newId('character'),
      projectId: project.project.id,
      name: character.name,
      aliases: character.aliases ?? '',
      age: character.age ?? null,
      role: character.role,
      occupation: character.occupation,
      dramaticFunction: character.dramaticFunction,
      bio: character.bio,
      background: character.background,
      traits: character.traits,
      goal: character.goal,
      motivation: character.motivation,
      conflict: character.conflict,
      strengths: character.strengths,
      weaknesses: character.weaknesses,
      arc: character.arc,
      relationships: character.relationships,
      voiceStyle: character.voiceStyle,
      notes: character.notes,
      color: character.color || palette[index % palette.length]
    }));
    project.locations = data.locations.map((location) => ({
      id: location.id || newId('location'),
      projectId: project.project.id,
      name: location.name,
      kind: location.kind,
      timeOfDay: location.timeOfDay,
      description: location.description,
      dramaticImportance: location.dramaticImportance,
      visualNotes: location.visualNotes,
      temporalNotes: location.temporalNotes,
      notes: location.notes
    }));
    await saveProject(project);
    setSnapshot(project);
    await refreshProjects();
    startupProjects = false;
    showProjects = false;
    notify('تم إنشاء المشروع وفتح ملفه.');
  }

  function updateCurrentProject(data: ProjectDraft) {
    const previousProjectType = snapshot.project.projectType;
    const previousCharacterNames = new Map(snapshot.characters.map((character) => [character.id, character.name]));
    const previousLocationNames = new Map(snapshot.locations.map((location) => [location.id, location.name]));
    const retainedLocationIds = new Set(data.locations.map((location) => location.id).filter(Boolean));
    snapshot.project = {
      ...snapshot.project,
      title: data.title,
      author: data.author,
      projectType: data.projectType,
      genre: data.genre,
      logline: data.logline,
      storyIdea: data.storyIdea,
      shortSynopsis: data.shortSynopsis,
      story: data.story,
      treatment: data.treatment,
      notes: data.notes,
      estimatedDurationMin: data.estimatedDurationMin,
      episodeCount: data.episodeCount
    };
    snapshot.characters = data.characters.map((character, index) => ({
      id: character.id || newId('character'),
      projectId: snapshot.project.id,
      name: character.name,
      aliases: character.aliases ?? '',
      age: character.age ?? null,
      role: character.role,
      occupation: character.occupation,
      dramaticFunction: character.dramaticFunction,
      bio: character.bio,
      background: character.background,
      traits: character.traits,
      goal: character.goal,
      motivation: character.motivation,
      conflict: character.conflict,
      strengths: character.strengths,
      weaknesses: character.weaknesses,
      arc: character.arc,
      relationships: character.relationships,
      voiceStyle: character.voiceStyle,
      notes: character.notes,
      color: character.color || palette[index % palette.length]
    }));
    snapshot.locations = data.locations.map((location) => ({
      id: location.id || newId('location'),
      projectId: snapshot.project.id,
      name: location.name,
      kind: location.kind,
      timeOfDay: location.timeOfDay,
      description: location.description,
      dramaticImportance: location.dramaticImportance,
      visualNotes: location.visualNotes,
      temporalNotes: location.temporalNotes,
      notes: location.notes
    }));
    snapshot.scenes = snapshot.scenes.map((scene) => scene.locationId && !retainedLocationIds.has(scene.locationId)
      ? { ...scene, locationId: null }
      : scene);

    if (data.projectType === 'series') {
      if (!snapshot.seasons.length) snapshot.seasons = [createSeason(snapshot.project.id, 0)];
      const firstSeason = snapshot.seasons[0];
      if (previousProjectType !== 'series') {
        const firstEpisode = snapshot.episodes[0] ?? createEpisode(snapshot.project.id, firstSeason.id, 0);
        firstEpisode.seasonId = firstSeason.id;
        firstEpisode.orderIndex = 0;
        firstEpisode.number = 1;
        if (/^(الفيلم|الفيلم القصير|الفيلم الوثائقي)$/.test(firstEpisode.title)) firstEpisode.title = '';
        snapshot.episodes = [firstEpisode];
        snapshot.scenes.forEach((scene) => scene.episodeId = firstEpisode.id);
      }
      const desired = Math.max(1, data.episodeCount ?? snapshot.episodes.length ?? 1);
      while (snapshot.episodes.length < desired) {
        const siblings = snapshot.episodes.filter((episode) => episode.seasonId === firstSeason.id);
        snapshot.episodes = [...snapshot.episodes, createEpisode(snapshot.project.id, firstSeason.id, siblings.length)];
      }
      snapshot.project.episodeCount = Math.max(desired, snapshot.episodes.length);
    } else if (previousProjectType === 'series' || snapshot.episodes.length !== 1) {
      const label = data.projectType === 'short' ? 'الفيلم القصير' : data.projectType === 'documentary' ? 'الفيلم الوثائقي' : 'الفيلم';
      const single = createEpisode(snapshot.project.id, null, 0, label);
      const ordered = orderedEpisodes(snapshot);
      const episodeRank = new Map(ordered.map((episode, index) => [episode.id, index]));
      const merged = [...snapshot.scenes].sort((a, b) => {
        const ae = a.episodeId ? (episodeRank.get(a.episodeId) ?? 9999) : 9999;
        const be = b.episodeId ? (episodeRank.get(b.episodeId) ?? 9999) : 9999;
        return ae - be || a.orderIndex - b.orderIndex;
      });
      merged.forEach((scene, index) => { scene.episodeId = single.id; scene.orderIndex = index; });
      snapshot.seasons = [];
      snapshot.episodes = [single];
      snapshot.scenes = merged;
      snapshot.project.episodeCount = null;
      selectedEpisodeId = single.id;
    }

    const characterRenames = snapshot.characters
      .map((character) => ({ id: character.id, from: previousCharacterNames.get(character.id) ?? '', to: character.name }))
      .filter((change) => change.from && change.to && change.from !== change.to);
    if (characterRenames.length && confirm('تم تغيير اسم شخصية واحدة أو أكثر. هل تريد تحديث الأسماء نفسها داخل عناصر «الشخصية» في السيناريو؟')) {
      const renameMap = new Map(characterRenames.map((change) => [change.from.trim(), change.to.trim()]));
      snapshot.scenes = snapshot.scenes.map((scene) => ({
        ...scene,
        blocks: scene.blocks.map((block) => block.elementType === 'character' && renameMap.has(block.text.trim())
          ? { ...block, text: renameMap.get(block.text.trim()) ?? block.text }
          : block)
      }));
    }

    const locationRenames = snapshot.locations
      .map((location) => ({ id: location.id, from: previousLocationNames.get(location.id) ?? '', to: location.name }))
      .filter((change) => change.from && change.to && change.from !== change.to);
    if (locationRenames.length) {
      const renameById = new Map(locationRenames.map((change) => [change.id, change]));
      snapshot.scenes = snapshot.scenes.map((scene) => {
        if (!scene.locationId || !renameById.has(scene.locationId)) return scene;
        const change = renameById.get(scene.locationId)!;
        const updated = { ...scene, blocks: scene.blocks.map((block) => ({ ...block })) };
        updated.scenePlace = change.to;
        syncSceneHeading(updated);
        return updated;
      });
    }

    touchAndSchedule();
    notify('تم تحديث ملف المشروع وربطه بالمحرر.');
  }

  async function removeProject(id: string) {
    if (!confirm('حذف المشروع نهائياً؟ لا يمكن التراجع عن هذا الإجراء.')) return;
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }

    const deletingCurrent = id === snapshot.project.id;
    try {
      await deleteProject(id);
      let remaining = await listProjects();

      // Verify that the row really disappeared. This makes failures explicit
      // instead of making the Delete button appear to do nothing.
      if (remaining.some((project) => project.id === id)) {
        throw new Error('تعذر تأكيد حذف المشروع من قاعدة البيانات.');
      }

      if (deletingCurrent) {
        if (remaining.length) {
          const loaded = await loadProject(remaining[0].id);
          if (loaded) setSnapshot(loaded);
        } else {
          // Do not silently recreate and save a replacement project. The old
          // behaviour made a successful deletion look like a failed one.
          snapshot = normalizeSnapshot(createEmptyProject('مشروع بلا عنوان'));
          selectedEpisodeId = snapshot.episodes[0]?.id ?? '';
          selectedSceneId = '';
          activeBlockId = '';
          hasOpenProject = false;
          startupProjects = true;
          projectModalMode = 'list';
          showProjects = true;
          localStorage.removeItem('scene-writer-last-project');
        }
      }

      projectSummaries = remaining;
      notify('تم حذف المشروع نهائياً.');
    } catch (error) {
      console.error(error);
      notify(`تعذر حذف المشروع: ${error instanceof Error ? error.message : String(error)}`);
      await refreshProjects();
    }
  }

  async function exportFountainFile() {
    const path = await exportTextFile(snapshot.project.title || 'screenplay', fountain, 'fountain');
    notify(`تم حفظ Fountain: ${path}`);
  }

  async function exportDocxFile() {
    try {
      const bytes = buildScreenplayDocx(snapshot);
      const path = await exportBinaryFile(snapshot.project.title || 'screenplay', bytes, 'docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      showExport = false;
      notify(`تم حفظ DOCX: ${path}`);
    } catch (error) {
      console.error(error);
      notify(`تعذر تصدير DOCX: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function exportJson() {
    const path = await exportTextFile(snapshot.project.title || 'screenplay', JSON.stringify(snapshot, null, 2), 'json');
    showExport = false;
    notify(`تم حفظ نسخة المشروع: ${path}`);
  }

  function printPdf(includeDossier = false) {
    printIncludeDossier = includeDossier;
    showExport = false;
    setTimeout(() => window.print(), 120);
  }


  function openPasteImport(
    text = '',
    source: 'paste' | 'docx' | 'fountain' = 'paste',
    sourceName = '',
    warnings: string[] = [],
    autoAnalyze = false
  ) {
    pasteImportText = text;
    pasteImportSource = source;
    pasteImportSourceName = sourceName;
    pasteImportWarnings = warnings;
    pasteImportAutoAnalyze = autoAnalyze;
    showPasteImport = true;
  }

  function chooseDocxFile() {
    docxFileInput?.click();
  }

  function chooseFountainFile() {
    fountainFileInput?.click();
  }

  async function handleDocxFile(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    try {
      const extracted = await extractDocxText(file);
      if (!extracted.text.trim()) {
        notify('لم أجد نصاً قابلاً للاستيراد في ملف Word.');
        return;
      }
      openPasteImport(
        extracted.text,
        'docx',
        file.name,
        extracted.warnings,
        true
      );
      notify(`تم استخراج ${extracted.paragraphCount} فقرة من Word. راجع التعرف قبل الاستيراد.`);
    } catch (error) {
      console.error(error);
      notify(error instanceof Error ? error.message : 'تعذر استيراد ملف Word.');
    }
  }

  async function handleFountainFile(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    try {
      const text = await file.text();
      if (!text.trim()) {
        notify('ملف Fountain فارغ.');
        return;
      }
      openPasteImport(text, 'fountain', file.name, [], true);
      notify('تم فتح ملف Fountain في المعاينة قبل الاستيراد.');
    } catch (error) {
      console.error(error);
      notify('تعذر قراءة ملف Fountain.');
    }
  }

  function importSearchable(value: string): string {
    return value.trim().toLocaleLowerCase('ar').replace(/[ًٌٍَُِّْـ]/g, '').replace(/\s+/g, ' ');
  }


  function cloneImportedBlock(block: RecognizedBlock): ScreenplayBlock {
    return { id: newId('block'), elementType: block.elementType, text: block.text.trim() };
  }

  function isPlaceholderScene(scene: Scene | undefined): boolean {
    if (!scene || scene.blocks.length > 2) return false;
    const heading = scene.blocks[0];
    const body = scene.blocks[1];
    return heading?.elementType === 'scene_heading'
      && !heading.text.trim()
      && (!body || !body.text.trim());
  }

  function importRecognizedPaste(recognition: PasteRecognition, addEntities: boolean) {
    const importedBlocks = recognition.blocks.filter((block) => block.elementType === 'scene_heading' || block.text.trim());
    if (!importedBlocks.length) return;

    if (addEntities) {
      const existingCharacters = new Set(snapshot.characters.map((character) => importSearchable(character.name)));
      const additions: Character[] = [];
      for (const block of importedBlocks.filter((item) => item.elementType === 'character' && item.confidence === 'high')) {
        const name = block.text.trim();
        if (!name || existingCharacters.has(importSearchable(name))) continue;
        existingCharacters.add(importSearchable(name));
        additions.push({
          id: newId('character'), projectId: snapshot.project.id, name, aliases: '', age: null, role: 'secondary', occupation: '', dramaticFunction: '', bio: '', background: '', traits: '', goal: '', motivation: '', conflict: '', strengths: '', weaknesses: '', arc: '', relationships: '', voiceStyle: '', notes: '', color: palette[(snapshot.characters.length + additions.length) % palette.length]
        });
      }
      if (additions.length) snapshot.characters = [...snapshot.characters, ...additions];

      const existingLocations = new Set(snapshot.locations.map((location) => importSearchable(location.name)));
      const locationAdditions: Location[] = [];
      for (const block of importedBlocks.filter((item) => item.elementType === 'scene_heading')) {
        const meta = parseSceneHeadingEntity(block.text);
        if (!meta.name || meta.confidence !== 'high' || existingLocations.has(importSearchable(meta.name))) continue;
        existingLocations.add(importSearchable(meta.name));
        locationAdditions.push({
          id: newId('location'), projectId: snapshot.project.id, name: meta.name, kind: meta.kind, timeOfDay: meta.timeOfDay,
          description: '', dramaticImportance: '', visualNotes: '', temporalNotes: '', notes: ''
        });
      }
      if (locationAdditions.length) snapshot.locations = [...snapshot.locations, ...locationAdditions];
    }

    const headingIndexes = importedBlocks.map((block, index) => block.elementType === 'scene_heading' ? index : -1).filter((index) => index >= 0);
    const currentScene = selectedScene;

    if (!headingIndexes.length) {
      if (!currentScene) {
        addScene();
      }
      const target = snapshot.scenes.find((scene) => scene.id === selectedSceneId) ?? episodeScenes[0];
      if (!target) return;
      let insertIndex = target.blocks.findIndex((block) => block.id === activeBlockId);
      if (insertIndex < 0) insertIndex = target.blocks.length - 1;
      const clones = importedBlocks.map(cloneImportedBlock).filter((block) => block.elementType !== 'scene_heading');
      target.blocks.splice(insertIndex + 1, 0, ...clones);
      target.durationPages = estimateFormattedPages(target.blocks);
      activeBlockId = clones[0]?.id ?? activeBlockId;
      updateScene(target);
      showPasteImport = false;
      pasteImportText = '';
      pasteImportSource = 'paste';
      pasteImportSourceName = '';
      pasteImportWarnings = [];
      pasteImportAutoAnalyze = false;
      notify(`تم استيراد ${clones.length} عنصراً إلى المشهد الحالي.`);
      return;
    }

    const prelude = importedBlocks.slice(0, headingIndexes[0]);
    const sceneGroups: RecognizedBlock[][] = [];
    for (let i = 0; i < headingIndexes.length; i += 1) {
      const start = headingIndexes[i];
      const end = headingIndexes[i + 1] ?? importedBlocks.length;
      sceneGroups.push(importedBlocks.slice(start, end));
    }

    const now = new Date().toISOString();
    const newScenes: Scene[] = sceneGroups.map((group, groupIndex) => {
      const blocks = group.map(cloneImportedBlock);
      const heading = blocks[0]?.elementType === 'scene_heading' ? blocks[0].text : '';
      if (blocks.length === 1) blocks.push({ id: newId('block'), elementType: 'action', text: '' });
      const meta = parseSceneHeadingEntity(heading);
      const headingMeta = parseSceneHeading(heading);
      const location = meta.confidence === 'high' ? snapshot.locations.find((item) => importSearchable(item.name) === importSearchable(meta.name)) : undefined;
      const importedScene: Scene = {
        id: newId('scene'), projectId: snapshot.project.id, episodeId: activeEpisode?.id ?? snapshot.episodes[0]?.id ?? null, orderIndex: groupIndex, heading,
        sceneKind: headingMeta.kind ?? location?.kind ?? null,
        scenePlace: headingMeta.place || location?.name || '',
        sceneTime: headingMeta.time || (location ? defaultSceneTime(location) : ''),
        locationId: location?.id ?? null, blocks, durationPages: estimateFormattedPages(blocks), colorStatus: 'draft', createdAt: now
      };
      syncSceneHeading(importedScene);
      return importedScene;
    });

    if (prelude.length && currentScene) {
      let insertIndex = currentScene.blocks.findIndex((block) => block.id === activeBlockId);
      if (insertIndex < 0) insertIndex = currentScene.blocks.length - 1;
      const preludeBlocks = prelude.map(cloneImportedBlock).filter((block) => block.elementType !== 'scene_heading');
      currentScene.blocks.splice(insertIndex + 1, 0, ...preludeBlocks);
      currentScene.durationPages = estimateFormattedPages(currentScene.blocks);
    }

    const targetEpisodeId = activeEpisode?.id ?? snapshot.episodes[0]?.id;
    if (!targetEpisodeId) return;
    newScenes.forEach((scene) => scene.episodeId = targetEpisodeId);
    const currentEpisodeScenes = scenesForEpisode(snapshot, targetEpisodeId);
    const currentIndex = currentEpisodeScenes.findIndex((scene) => scene.id === selectedSceneId);
    let insertAt = currentIndex >= 0 ? currentIndex + 1 : currentEpisodeScenes.length;
    if (currentIndex >= 0 && isPlaceholderScene(currentScene) && !prelude.length) {
      currentEpisodeScenes.splice(currentIndex, 1, ...newScenes);
      insertAt = currentIndex;
    } else {
      currentEpisodeScenes.splice(insertAt, 0, ...newScenes);
    }
    currentEpisodeScenes.forEach((scene, index) => scene.orderIndex = index);
    snapshot.scenes = [
      ...snapshot.scenes.filter((scene) => scene.episodeId !== targetEpisodeId),
      ...currentEpisodeScenes
    ];
    const firstImported = currentEpisodeScenes[insertAt];
    selectedEpisodeId = targetEpisodeId;
    selectedSceneId = firstImported?.id ?? selectedSceneId;
    activeBlockId = firstImported?.blocks[0]?.id ?? activeBlockId;
    touchAndSchedule();
    showPasteImport = false;
    pasteImportText = '';
    pasteImportSource = 'paste';
    pasteImportSourceName = '';
    pasteImportWarnings = [];
    pasteImportAutoAnalyze = false;
    notify(`تم استيراد ${newScenes.length} ${newScenes.length === 1 ? 'مشهد' : 'مشاهد'} مع الحفاظ على العناصر القابلة للتحرير.`);
  }
</script>

<div class="app-shell">
  <TopBar
    projectTitle={snapshot.project.title}
    projectType={snapshot.project.projectType}
    estimatedDurationMin={snapshot.project.estimatedDurationMin}
    episodeCount={snapshot.project.episodeCount}
    {saveState}
    onProjectTitle={updateProjectTitle}
    onProjects={openProjectManager}
    onProjectFile={() => openProjectFile('basics')}
    onImportPaste={() => openPasteImport()}
    onImportDocx={chooseDocxFile}
    onImportFountain={chooseFountainFile}
    onFountain={() => showFountain = true}
    onExport={() => showExport = true}
    onAi={openAssistant}
  />

  <input
    class="hidden-file-input"
    bind:this={docxFileInput}
    type="file"
    accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    on:change={handleDocxFile}
    aria-hidden="true"
    tabindex="-1"
  />
  <input
    class="hidden-file-input"
    bind:this={fountainFileInput}
    type="file"
    accept=".fountain,text/plain"
    on:change={handleFountainFile}
    aria-hidden="true"
    tabindex="-1"
  />

  <div class:assistant-mode={showAi} class="workspace">
    {#if showAi}
      <div class="assistant-pane" style={`width:${assistantPaneWidth}px`}>
        <AiDrawer
          {snapshot}
          docked={true}
          scene={selectedScene ?? null}
          episodeId={selectedEpisodeId}
          onSelectScene={handleAssistantSelectScene}
          onClose={closeAssistant}
        />
      </div>
      <div class="assistant-divider" role="separator" aria-orientation="vertical" title="اسحب لتغيير مساحة المساعد" on:mousedown={startAssistantResize}><span></span></div>
    {:else}
    <BeatBoard
      scenes={episodeScenes}
      {selectedSceneId}
      {episodeOptions}
      activeEpisodeId={selectedEpisodeId}
      showEpisodePicker={false}
      seriesMode={snapshot.project.projectType === 'series'}
      onEpisode={selectEpisode}
      onAddEpisode={() => addEpisode()}
      onSelect={selectScene}
      onAdd={addScene}
      onDelete={deleteScene}
      onDuplicate={duplicateScene}
      onMove={moveScene}
      onTransfer={openMoveSceneDialog}
      onReorder={reorderScene}
      onStatus={cycleStatus}
    />
    {/if}

    <section class:assistant-active={showAi} class="editor-zone">
      <div class="editor-toolbar" dir="rtl">
        {#if selectedScene}
          <div><b>{selectedScene.heading || 'مشهد بلا عنوان'}</b><span>{snapshot.project.projectType === 'series' ? `${episodeLabel(snapshot, selectedEpisodeId)} · ` : ''}المشهد {selectedSceneNumber}</span></div>
          <div class="toolbar-actions">
            <button class="insert-scene-toolbar" on:click={() => addScene()} title="إدراج مشهد بعد موضع الكتابة الحالي">＋ إدراج مشهد بعد {selectedSceneNumber}</button>
            <div class="shortcuts"><span>Enter التالي</span><span>Tab النوع</span><span>Shift+Enter سطر</span></div>
          </div>
        {:else}
          <div><b>{snapshot.project.projectType === 'series' ? episodeLabel(snapshot, selectedEpisodeId) : snapshot.project.title}</b><span>لا توجد مشاهد</span></div>
          <div></div>
        {/if}
      </div>

      <div class="episode-page-scroll" bind:this={episodePageNode} on:scroll={handleEpisodeScroll} aria-label={snapshot.project.projectType === 'series' ? 'صفحة الحلقة' : 'صفحة السيناريو'}>
        <main class="episode-page" dir="rtl">
          {#if episodeScenes.length}
            <div class="episode-page-meta">
              <span>{snapshot.project.projectType === 'series' ? episodeLabel(snapshot, selectedEpisodeId) : snapshot.project.title}</span>
              <span>{episodeScenes.length} مشهد · {episodePages.toFixed(1)} ص تقريباً</span>
            </div>

            {#each episodeScenes as scene, sceneIndex (scene.id)}
              <section class:active={scene.id === selectedSceneId} class="episode-scene" data-episode-scene={scene.id}>
                <ScreenplayEditor
                  {scene}
                  embedded={true}
                  isActiveScene={scene.id === selectedSceneId}
                  sceneNumber={sceneIndex + 1}
                  characters={snapshot.characters}
                  knownCharacterNames={scriptCharacterNames}
                  locations={snapshot.locations}
                  activeBlockId={scene.id === selectedSceneId ? activeBlockId : ''}
                  onChange={updateScene}
                  onActive={(id) => activateEditorScene(scene.id, id)}
                  onQuickAddCharacter={(name) => addCharacter(name)}
                  onQuickAddLocation={(name, kind) => addLocation(name, kind)}
                  onPasteImport={(text) => { selectedSceneId = scene.id; openPasteImport(text); }}
                />
              </section>

              <div class="scene-insert-separator" aria-label={`إدراج مشهد بعد المشهد ${sceneIndex + 1}`}>
                <span></span>
                <button on:click={() => addScene(scene.id)} title={`إدراج مشهد جديد بين المشهد ${sceneIndex + 1} وما يليه`}>＋ مشهد هنا</button>
                <span></span>
              </div>
            {/each}

            <div class="episode-page-footer">{snapshot.project.projectType === 'series' ? 'تحرير الحلقة في صفحة واحدة' : 'تحرير السيناريو في صفحة واحدة'} · بطاقات المشاهد تنقلك مباشرة إلى موضع المشهد</div>
          {:else}
            <div class="blank-episode-page" aria-label="صفحة سيناريو فارغة"></div>
          {/if}
        </main>
      </div>
    </section>

    {#if !showAi}
    <RightSidebar
      projectId={snapshot.project.id}
      characters={snapshot.characters}
      scriptCharacterNames={scriptCharacterNames}
      locations={snapshot.locations}
      onAddCharacter={(name) => addCharacter(name)}
      onAddLocation={(name) => addLocation(name)}
      onDeleteCharacter={removeCharacter}
      onDeleteLocation={removeLocation}
      onEditCharacter={(id) => openProjectFile('characters', id)}
      onEditLocation={(id) => openProjectFile('locations', id)}
      onInsertCharacter={insertCharacter}
      onInsertCharacterName={insertCharacterName}
      onPromoteCharacter={promoteScriptCharacter}
      onInsertLocation={insertLocation}
    />

    <NavigationRail
      treeOpen={showProjectTree}
      {theme}
      onTree={openTree}
      onStory={() => openDossierFromNavigation('story')}
      onScenes={openTreeScenes}
      onCharacters={() => openDossierFromNavigation('characters')}
      onLocations={() => openDossierFromNavigation('locations')}
      onAssistant={openAssistant}
      onTheme={toggleTheme}
    />

    {#if showProjectTree}
      <ProjectTree
        project={snapshot.project}
        seasons={snapshot.seasons}
        episodes={snapshot.episodes}
        scenes={snapshot.scenes}
        characters={snapshot.characters}
        locations={snapshot.locations}
        selectedEpisodeId={selectedEpisodeId}
        onClose={() => showProjectTree = false}
        onSelectEpisode={(id) => selectEpisode(id)}
        onAddEpisode={(seasonId) => addEpisode(seasonId)}
        onAddSeason={addSeason}
        onDeleteEpisode={deleteEpisode}
        onDeleteSeason={deleteSeason}
        onEditSeason={openSeasonDialog}
        onEditEpisode={openEpisodeDialog}
        onDuplicateEpisode={duplicateEpisode}
        onReorderEpisode={reorderEpisode}
        onOpenBasics={() => openDossierFromNavigation('basics')}
        onOpenStory={() => openDossierFromNavigation('story')}
        onOpenCharacters={() => openDossierFromNavigation('characters')}
        onOpenLocations={() => openDossierFromNavigation('locations')}
      />
    {/if}
    {/if}
  </div>


    {#if showStructureDialog}
      <SeriesStructureModal
        mode={structureDialogMode}
        season={snapshot.seasons.find((item) => item.id === structureSeasonId) ?? null}
        episode={snapshot.episodes.find((item) => item.id === structureEpisodeId) ?? null}
        scene={snapshot.scenes.find((item) => item.id === structureSceneId) ?? null}
        seasons={snapshot.seasons}
        episodes={snapshot.episodes}
        onClose={closeStructureDialog}
        onSaveSeason={saveSeasonDetails}
        onSaveEpisode={saveEpisodeDetails}
        onMoveScene={moveSceneToEpisode}
      />
    {/if}

  <PrintDocument {snapshot} includeDossier={printIncludeDossier} />

  <StatusBar words={metrics.wordCount} pages={metrics.estimatedPages} scenes={snapshot.scenes.length} desktop={isDesktopRuntime()} />

  {#if showFountain}
    <FountainModal content={fountain} onClose={() => showFountain = false} onExport={exportFountainFile} />
  {/if}

  {#if showProjects}
    <ProjectModal
      projects={projectSummaries}
      currentProject={snapshot.project}
      currentCharacters={snapshot.characters}
      currentLocations={snapshot.locations}
      currentId={hasOpenProject ? snapshot.project.id : ''}
      hasCurrentProject={hasOpenProject}
      landing={startupProjects}
      startMode={projectModalMode}
      startTab={projectModalTab}
      focusEntityId={projectModalFocusId}
      onClose={() => { if (!startupProjects && hasOpenProject) showProjects = false; }}
      onOpen={openProject}
      onNew={newProject}
      onUpdateCurrent={updateCurrentProject}
      onDelete={removeProject}
    />
  {/if}

  {#if showExport}
    <ExportModal
      onClose={() => showExport = false}
      onFountain={() => { showExport = false; showFountain = true; }}
      onDocx={exportDocxFile}
      onPrintScript={() => printPdf(false)}
      onPrintDossier={() => printPdf(true)}
    />
  {/if}


  {#if showPasteImport}
    <PasteImportModal
      initialText={pasteImportText}
      sourceKind={pasteImportSource}
      sourceName={pasteImportSourceName}
      sourceWarnings={pasteImportWarnings}
      autoAnalyze={pasteImportAutoAnalyze}
      characters={snapshot.characters}
      locations={snapshot.locations}
      onClose={() => {
        showPasteImport = false;
        pasteImportText = '';
        pasteImportSource = 'paste';
        pasteImportSourceName = '';
        pasteImportWarnings = [];
        pasteImportAutoAnalyze = false;
      }}
      onImport={importRecognizedPaste}
    />
  {/if}

  {#if toast}<div class="toast" dir="rtl">{toast}</div>{/if}
</div>

<style>
  .app-shell { height:100vh; display:flex; flex-direction:column; background:var(--bg); overflow:hidden; }
  .hidden-file-input { position:fixed; width:1px; height:1px; opacity:0; pointer-events:none; left:-9999px; top:-9999px; }
  .workspace { min-height:0; flex:1; display:flex; direction:ltr; overflow:hidden; position:relative; }
  .workspace.assistant-mode { background:var(--bg); }
  .assistant-pane { flex:0 0 auto; min-width:330px; max-width:58vw; height:100%; overflow:hidden; background:var(--panel); border-right:1px solid var(--line); }
  .assistant-divider { flex:0 0 8px; width:8px; height:100%; cursor:col-resize; display:grid; place-items:center; background:var(--panel-2); border-left:1px solid var(--line-soft); border-right:1px solid var(--line-soft); z-index:3; }
  .assistant-divider span { width:2px; height:48px; border-radius:99px; background:var(--line); transition:background .15s ease, height .15s ease; }
  .assistant-divider:hover span { background:var(--accent); height:72px; }
  :global(body.assistant-resizing) { cursor:col-resize !important; user-select:none !important; }
  .editor-zone { min-width:0; flex:1; height:100%; display:flex; flex-direction:column; direction:rtl; }
  .editor-zone.assistant-active .episode-page-scroll { padding-left:22px; padding-right:22px; }
  .editor-zone.assistant-active .episode-page { width:min(760px, calc(100% - 18px)); min-width:0; }
  :global(.screenplay-block.assistant-reveal) { border-radius:6px; background:rgba(24,90,189,.10); box-shadow:0 0 0 2px rgba(24,90,189,.22); transition:background .25s ease, box-shadow .25s ease; }
  .editor-toolbar { height:42px; flex:0 0 42px; background:var(--panel-2); border-bottom:1px solid var(--line); display:flex; justify-content:space-between; align-items:center; padding:0 14px; }
  .editor-toolbar>div:first-child { min-width:0; display:flex;align-items:center;gap:8px; } .editor-toolbar b{font-size:12px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:380px}.editor-toolbar span{font-size:10.5px;color:var(--muted)}
  .toolbar-actions { display:flex; align-items:center; gap:10px; min-width:0; }
  .insert-scene-toolbar { height:29px; border:1px solid var(--accent-line); border-radius:7px; background:var(--accent-soft); color:var(--accent); padding:0 9px; font-size:10px; font-weight:750; white-space:nowrap; }
  .insert-scene-toolbar:hover { background:var(--hover); }
  .shortcuts { display:flex; gap:10px; direction:ltr; } .shortcuts span{border:1px solid var(--line);background:var(--panel-3);border-radius:6px;padding:4px 7px;color:var(--muted)}
  .episode-page-scroll { flex:1; min-height:0; overflow:auto; background:var(--bg); padding:36px 40px 90px; scroll-behavior:smooth; }
  .episode-page { width:min(760px, calc(100vw - 650px)); min-width:620px; min-height:1080px; margin:0 auto; background:var(--page); color:var(--ink); border-radius:3px; box-shadow:0 10px 32px rgba(0,0,0,.14),0 0 0 1px #d6d6d6; padding:48px 78px 70px; position:relative; }
  .episode-page-meta { display:flex; align-items:center; justify-content:space-between; gap:16px; padding-bottom:11px; margin-bottom:30px; border-bottom:1px solid #ddd; color:#666; font-size:11.5px; font-family:"Cairo","Segoe UI",sans-serif; }
  .episode-scene { position:relative; padding:10px 0 18px; border-radius:8px; scroll-margin-top:28px; }
  .episode-scene.active::before { content:""; position:absolute; right:-22px; top:18px; bottom:20px; width:2px; border-radius:2px; background:rgba(24,90,189,.30); }
  .scene-insert-separator { height:34px; display:flex; align-items:center; gap:8px; margin:2px 0 14px; opacity:.28; transition:opacity .15s ease; }
  .scene-insert-separator:hover, .scene-insert-separator:focus-within { opacity:1; }
  .scene-insert-separator span { height:1px; flex:1; background:#d9dde3; }
  .scene-insert-separator button { flex:0 0 auto; border:1px solid #ccd8e8; border-radius:999px; background:#fff; color:#185abd; padding:5px 10px; font-family:"Cairo","Segoe UI",sans-serif; font-size:9.5px; font-weight:750; box-shadow:0 3px 10px rgba(0,0,0,.05); }
  .scene-insert-separator button:hover { border-color:#8aaee0; background:#eef4fb; }
  .episode-page-footer { border-top:1px solid #e1e1e1; margin-top:20px; padding-top:18px; text-align:center; color:#777; font-size:10px; font-family:"Cairo","Segoe UI",sans-serif; }
  .blank-episode-page { min-height:980px; }
  .toast { position:fixed; z-index:100; bottom:46px; left:50%; transform:translateX(-50%); border:1px solid var(--line); background:var(--panel); color:var(--text); box-shadow:0 12px 32px rgba(0,0,0,.16); border-radius:9px; padding:9px 13px; font-size:11px; backdrop-filter:blur(8px); }
  @media(max-width:1200px){.episode-page{width:min(720px,calc(100vw - 540px));min-width:570px;padding-left:62px;padding-right:62px}}
  @media(max-width:1000px){.episode-page{width:min(760px,calc(100vw - 290px));min-width:560px}}
  @media(max-width:900px){.episode-page-scroll{padding:24px 18px 70px}.episode-page{width:min(760px,100%);min-width:0;padding:42px 50px 65px}.assistant-pane{min-width:300px;max-width:52vw}.editor-zone.assistant-active .episode-page-scroll{padding-left:10px;padding-right:10px}.editor-zone.assistant-active .episode-page{padding-left:34px;padding-right:34px}}
  @media(max-width:760px){.shortcuts{display:none}.editor-toolbar b{max-width:220px}.insert-scene-toolbar{font-size:9px}.episode-page{padding-left:34px;padding-right:34px}}
</style>
