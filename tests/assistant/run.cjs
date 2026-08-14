const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const root = path.resolve(__dirname, '..', '..');
const outDir = path.join(root, '.assistant-test-dist');
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const localTsc = path.join(root, 'node_modules', 'typescript', 'bin', 'tsc');
const tscCommand = fs.existsSync(localTsc) ? process.execPath : 'tsc';
const tscArgs = fs.existsSync(localTsc) ? [localTsc] : [];
tscArgs.push(
  'src/lib/assistantAnalysis.ts',
  'src/lib/demo.ts',
  'src/lib/structure.ts',
  'src/lib/pageEstimate.ts',
  'src/lib/screenplayEngine.ts',
  'src/lib/id.ts',
  'src/lib/types.ts',
  '--module', 'commonjs', '--target', 'es2022', '--outDir', outDir,
  '--esModuleInterop', '--skipLibCheck', '--lib', 'es2022,dom'
);
const compile = cp.spawnSync(tscCommand, tscArgs, { cwd: root, encoding: 'utf8' });
if (compile.status !== 0) {
  process.stderr.write(compile.stdout || '');
  process.stderr.write(compile.stderr || '');
  process.exit(compile.status || 1);
}
fs.writeFileSync(path.join(outDir, 'package.json'), JSON.stringify({ type: 'commonjs' }));
const { createDemoProject } = require(path.join(outDir, 'demo.js'));
const { analyzeAssistantScope } = require(path.join(outDir, 'assistantAnalysis.js'));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const snapshot = createDemoProject();
let analysis = analyzeAssistantScope(snapshot);
assert(analysis.sceneCount === 3, `المتوقع 3 مشاهد، الناتج ${analysis.sceneCount}`);
assert(analysis.characterMetrics.find((item) => item.name === 'أحمد')?.sceneCount === 2, 'يجب احتساب حضور أحمد في مشهدين.');
assert(!Object.prototype.hasOwnProperty.call(analysis, 'score'), 'المساعد لا يجب أن ينتج درجة جودة.');
assert(!analysis.consistency.some((item) => /شقة قديمة/.test(item.title)), 'المكان المرتبط ببطاقة مكان لا يجب اعتباره غير مسجل.');

// Inject an unknown speaker and a scene with missing metadata.
const scene = snapshot.scenes[2];
scene.sceneKind = null;
scene.scenePlace = '';
scene.sceneTime = '';
scene.locationId = null;
scene.blocks.push({ id: 'unknown-char', elementType: 'character', text: 'مروان' });
scene.blocks.push({ id: 'unknown-dialogue', elementType: 'dialogue', text: 'هذه جملة اختبار.' });
analysis = analyzeAssistantScope(snapshot);
assert(analysis.consistency.some((item) => item.category === 'characters' && /مروان/.test(item.title)), 'يجب كشف المتكلم غير المسجل.');
assert(analysis.consistency.some((item) => item.category === 'scenes' && item.sceneIds.includes(scene.id)), 'يجب كشف بيانات المشهد الناقصة.');

// Give أحمد enough dialogue turns to establish a baseline, then one clear statistical outlier.
const target = snapshot.scenes[0];
for (let i = 0; i < 5; i += 1) {
  target.blocks.push({ id: `c${i}`, elementType: 'character', text: 'أحمد' });
  target.blocks.push({ id: `d${i}`, elementType: 'dialogue', text: 'كلام قصير جدا هنا' });
}
target.blocks.push({ id: 'c-long', elementType: 'character', text: 'أحمد' });
target.blocks.push({ id: 'd-long', elementType: 'dialogue', text: Array.from({ length: 60 }, () => 'كلمة').join(' ') });
analysis = analyzeAssistantScope(snapshot);
const ahmed = analysis.characterMetrics.find((item) => item.name === 'أحمد');
assert(ahmed && ahmed.outlierTurns.length > 0, 'يجب كشف المداخلة المختلفة إحصائيا عن نمط أحمد المعتاد.');
assert(analysis.consistency.some((item) => item.id.startsWith('dialogue-outlier-')), 'يجب تحويل الشذوذ الإحصائي إلى ملاحظة قابلة للفحص.');

// Aliases are part of the same character identity and should not create unknown speakers.
const ahmedProfile = snapshot.characters.find((item) => item.name === 'أحمد');
ahmedProfile.aliases = 'الحاج أحمد، سي أحمد';
target.blocks.push({ id: 'alias-cue', elementType: 'character', text: 'الحاج أحمد' });
target.blocks.push({ id: 'alias-dialogue', elementType: 'dialogue', text: 'هذا الحوار مكتوب باسم بديل للشخصية نفسها' });
analysis = analyzeAssistantScope(snapshot);
const ahmedWithAlias = analysis.characterMetrics.find((item) => item.name === 'أحمد');
assert(ahmedWithAlias.aliases.includes('الحاج أحمد'), 'يجب قراءة الأسماء البديلة من بطاقة الشخصية.');
assert(!analysis.consistency.some((item) => item.category === 'characters' && /الحاج أحمد/.test(item.title)), 'الاسم البديل المسجل لا يجب اعتباره شخصية غير مسجلة.');
assert(ahmedWithAlias.dialogueTurns > ahmed.dialogueTurns, 'حوار الاسم البديل يجب أن يحتسب ضمن الشخصية الأصلية.');

// Dialogue fingerprint is descriptive and based on the character's own sample.
assert(ahmedWithAlias.averageTurnWords > 0, 'يجب حساب متوسط طول المداخلة.');
assert(ahmedWithAlias.lexicalSampleWords >= 20, 'يجب جمع عينة مفردات كافية من الحوار.');
assert(ahmedWithAlias.lexicalDiversity !== null, 'يجب حساب تنوع المفردات عندما تكون العينة كافية.');
assert(Array.isArray(ahmedWithAlias.signatureTerms), 'يجب إنتاج قائمة ألفاظ بارزة قابلة للعرض.');

// Scene composition comparison uses the scope median, not a pacing judgment.
const firstSceneMetric = analysis.sceneMetrics[0];
assert(Number.isFinite(firstSceneMetric.dialogueDeltaFromMedian), 'يجب حساب فرق الحوار عن وسيط النطاق.');
assert(Number.isFinite(analysis.compositionMedians.dialogue), 'يجب حساب وسيط تركيب المشاهد.');
assert(!analysis.consistency.some((item) => /بطيء|سريع|ميت|ضعيف/.test(`${item.title} ${item.detail}`)), 'لا يجب تحويل المقارنة التركيبية إلى حكم إيقاع أو جودة.');

console.log('✓ تحليل النطاق والمشهد');
console.log('✓ اتساق الشخصيات وبيانات المشاهد');
console.log('✓ الشذوذ النسبي في مداخلات الشخصية');
console.log('✓ الأسماء البديلة وبصمة الحوار');
console.log('✓ المقارنة التركيبية النسبية للمشاهد');
console.log('\nنجحت 5/5 اختبارات المساعد التحليلي.');
fs.rmSync(outDir, { recursive: true, force: true });
