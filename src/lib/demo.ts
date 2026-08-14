import type { Character, Episode, Location, ProjectSnapshot, ProjectType, Scene, ScreenplayBlock, Season } from './types';
import { newId } from './id';

function block(elementType: ScreenplayBlock['elementType'], text: string): ScreenplayBlock {
  return { id: newId('block'), elementType, text };
}

function initialStructure(projectId: string, projectType: ProjectType, episodeCount: number | null): { seasons: Season[]; episodes: Episode[] } {
  if (projectType === 'series') {
    const seasonId = newId('season');
    const count = Math.max(1, episodeCount ?? 1);
    const season: Season = { id: seasonId, projectId, orderIndex: 0, number: 1, title: '' };
    const episodes: Episode[] = Array.from({ length: count }, (_, index) => ({
      id: newId('episode'), projectId, seasonId, orderIndex: index, number: index + 1,
      title: '', logline: '', synopsis: '', notes: '', estimatedDurationMin: null
    }));
    return { seasons: [season], episodes };
  }
  const title = projectType === 'short' ? 'الفيلم القصير' : projectType === 'documentary' ? 'الفيلم الوثائقي' : 'الفيلم';
  return {
    seasons: [],
    episodes: [{ id: newId('episode'), projectId, seasonId: null, orderIndex: 0, number: 1, title, logline: '', synopsis: '', notes: '', estimatedDurationMin: null }]
  };
}

export function blankCharacter(projectId: string, name = '', color = '#E8B86D'): Character {
  return {
    id: newId('character'), projectId, name, aliases: '', age: null, role: 'secondary', occupation: '', dramaticFunction: '',
    bio: '', background: '', traits: '', goal: '', motivation: '', conflict: '', strengths: '', weaknesses: '',
    arc: '', relationships: '', voiceStyle: '', notes: '', color
  };
}

export function blankLocation(projectId: string, name = ''): Location {
  return {
    id: newId('location'), projectId, name, kind: 'INT', timeOfDay: 'DAY', description: '',
    dramaticImportance: '', visualNotes: '', temporalNotes: '', notes: ''
  };
}

export function createEmptyProject(
  title = 'سيناريو جديد',
  projectType: ProjectType = 'film',
  author = '',
  logline = '',
  estimatedDurationMin: number | null = null,
  episodeCount: number | null = null
): ProjectSnapshot {
  const now = new Date().toISOString();
  const projectId = newId('project');
  const structure = initialStructure(projectId, projectType, episodeCount);
  return {
    project: {
      id: projectId,
      title,
      author,
      projectType,
      genre: '',
      logline,
      storyIdea: '',
      shortSynopsis: '',
      story: '',
      treatment: '',
      notes: '',
      estimatedDurationMin,
      episodeCount,
      createdAt: now,
      updatedAt: now
    },
    seasons: structure.seasons,
    episodes: structure.episodes,
    scenes: [],
    characters: [],
    locations: []
  };
}

export function createDemoProject(): ProjectSnapshot {
  const now = new Date().toISOString();
  const projectId = newId('project');
  const demoEpisode = newId('episode');
  const scene1 = newId('scene');
  const scene2 = newId('scene');
  const scene3 = newId('scene');
  const ahmed = newId('character');
  const sara = newId('character');
  const narrator = newId('character');
  const apartment = newId('location');
  const roof = newId('location');
  const street = newId('location');

  const scenes: Scene[] = [
    {
      id: scene1,
      projectId,
      episodeId: demoEpisode,
      orderIndex: 0,
      heading: 'داخلي. شقة قديمة - ليل',
      sceneKind: 'INT',
      scenePlace: 'شقة قديمة',
      sceneTime: 'ليل',
      locationId: apartment,
      colorStatus: 'done',
      durationPages: 0.9,
      createdAt: now,
      blocks: [
        block('scene_heading', 'داخلي. شقة قديمة - ليل'),
        block('action', 'شقة صغيرة مكتظة بالكتب. نافذة مفتوحة على شارع ممطر. ساعة حائط تشير إلى الثالثة فجراً.'),
        block('action', 'أحمد (30 سنة) يجلس أمام آلة كاتبة قديمة. فنجان قهوة بارد بجانبه.'),
        block('character', 'أحمد'),
        block('parenthetical', '(بهمس لنفسه)'),
        block('dialogue', 'لا أستطيع كتابة النهاية... كل شيء يبدو مزيفاً.'),
        block('action', 'يمزق الورقة بعصبية. ينهض ويتجه نحو النافذة.'),
        block('transition', 'قطع إلى:')
      ]
    },
    {
      id: scene2,
      projectId,
      episodeId: demoEpisode,
      orderIndex: 1,
      heading: 'داخلي. نفس الشقة - نهار',
      sceneKind: 'INT',
      scenePlace: 'نفس الشقة',
      sceneTime: 'نهار',
      locationId: apartment,
      colorStatus: 'draft',
      durationPages: 1.2,
      createdAt: now,
      blocks: [
        block('scene_heading', 'داخلي. نفس الشقة - نهار'),
        block('action', 'ضوء الصباح يتسلل إلى الغرفة. الأوراق الممزقة ما تزال على الأرض.'),
        block('character', 'سارة'),
        block('dialogue', 'واش بقيتي ساهر حتى دابا؟')
      ]
    },
    {
      id: scene3,
      projectId,
      episodeId: demoEpisode,
      orderIndex: 2,
      heading: 'خارجي. سطح المبنى - عصراً',
      sceneKind: 'EXT',
      scenePlace: 'سطح المبنى',
      sceneTime: 'عصراً',
      locationId: roof,
      colorStatus: 'needs_review',
      durationPages: 0.7,
      createdAt: now,
      blocks: [
        block('scene_heading', 'خارجي. سطح المبنى - عصراً'),
        block('action', 'المدينة ممتدة تحت سماء رمادية. أحمد يقف عند الحافة ودفتره في يده.')
      ]
    }
  ];

  return {
    project: {
      id: projectId,
      title: 'مشروع بلا عنوان',
      author: '',
      projectType: 'film',
      genre: 'دراما',
      logline: 'كاتب يبحث عن نهاية نصه فيجد نفسه داخل الحكاية.',
      storyIdea: 'ماذا يحدث حين يصبح النص الذي يكتبه المؤلف مرآة لحياته؟',
      shortSynopsis: '',
      story: '',
      treatment: '',
      notes: '',
      estimatedDurationMin: 95,
      episodeCount: null,
      createdAt: now,
      updatedAt: now
    },
    seasons: [],
    episodes: [{ id: demoEpisode, projectId, seasonId: null, orderIndex: 0, number: 1, title: 'الفيلم', logline: '', synopsis: '', notes: '', estimatedDurationMin: 95 }],
    scenes,
    characters: [
      {
        id: ahmed, projectId, name: 'أحمد', aliases: '', age: 30, role: 'main', occupation: 'كاتب', dramaticFunction: 'البطل',
        bio: 'كاتب من الدار البيضاء.', background: '', traits: 'قلق، دقيق، عنيد', goal: 'إنهاء السيناريو.',
        motivation: '', conflict: '', strengths: '', weaknesses: '', arc: '', relationships: '', voiceStyle: 'جمل قصيرة ومترددة حين يكون تحت الضغط.', notes: '', color: '#E8B86D'
      },
      {
        id: sara, projectId, name: 'سارة', aliases: '', age: null, role: 'secondary', occupation: '', dramaticFunction: '', bio: '',
        background: '', traits: '', goal: '', motivation: '', conflict: '', strengths: '', weaknesses: '', arc: '', relationships: '', voiceStyle: '', notes: '', color: '#7DD3FC'
      },
      {
        id: narrator, projectId, name: 'الراوي', aliases: '', age: null, role: 'extra', occupation: '', dramaticFunction: '', bio: '',
        background: '', traits: '', goal: '', motivation: '', conflict: '', strengths: '', weaknesses: '', arc: '', relationships: '', voiceStyle: '', notes: '', color: '#A78BFA'
      }
    ],
    locations: [
      { id: apartment, projectId, name: 'شقة قديمة', kind: 'INT', timeOfDay: 'NIGHT', description: '', dramaticImportance: '', visualNotes: '', temporalNotes: '', notes: '' },
      { id: roof, projectId, name: 'سطح المبنى', kind: 'EXT', timeOfDay: 'DAY', description: '', dramaticImportance: '', visualNotes: '', temporalNotes: '', notes: '' },
      { id: street, projectId, name: 'شارع ممطر', kind: 'EXT', timeOfDay: 'NIGHT', description: '', dramaticImportance: '', visualNotes: '', temporalNotes: '', notes: '' }
    ]
  };
}
