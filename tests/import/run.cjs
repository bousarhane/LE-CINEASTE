const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const root = path.resolve(__dirname, '..', '..');
const outDir = path.join(root, '.import-test-dist');
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const localTsc = path.join(root, 'node_modules', 'typescript', 'bin', 'tsc');
const tscCommand = fs.existsSync(localTsc) ? process.execPath : 'tsc';
const tscArgs = fs.existsSync(localTsc)
  ? [localTsc]
  : [];

tscArgs.push(
  'src/lib/pasteImport.ts',
  'src/lib/fountainImport.ts',
  'src/lib/sceneHeading.ts',
  'src/lib/id.ts',
  'src/lib/types.ts',
  '--module', 'commonjs',
  '--target', 'es2022',
  '--outDir', outDir,
  '--esModuleInterop',
  '--skipLibCheck',
  '--lib', 'es2022,dom'
);

const compile = cp.spawnSync(tscCommand, tscArgs, { cwd: root, encoding: 'utf8' });
if (compile.status !== 0) {
  process.stderr.write(compile.stdout || '');
  process.stderr.write(compile.stderr || '');
  process.exit(compile.status || 1);
}

fs.writeFileSync(path.join(outDir, 'package.json'), JSON.stringify({ type: 'commonjs' }));
const { recognizePastedScreenplay } = require(path.join(outDir, 'pasteImport.js'));
const { recognizeFountainScreenplay } = require(path.join(outDir, 'fountainImport.js'));

function readFixture(name) {
  return fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');
}

function count(blocks, type) {
  return blocks.filter((block) => block.elementType === type).length;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function hasBlock(result, type, text) {
  return result.blocks.some((block) => block.elementType === type && block.text.trim() === text.trim());
}

const cases = [];

cases.push(() => {
  const result = recognizePastedScreenplay(readFixture('episode-reference-01.md'));
  assert(result.sceneCount === 26, `العينة الواقعية: المتوقع 26 مشهداً، الناتج ${result.sceneCount}`);
  assert(count(result.blocks, 'transition') === 22, `العينة الواقعية: المتوقع 22 انتقالاً، الناتج ${count(result.blocks, 'transition')}`);
  assert(hasBlock(result, 'scene_heading', 'خارجي / حقول / نهار'), 'العينة الواقعية: لم يُكتشف عنوان المشهد الأول.');
  assert(hasBlock(result, 'scene_heading', 'داخلي/كشينة/ نهار'), 'العينة الواقعية: لم يُكتشف عنوان داخلي/كشينة/نهار.');
  assert(hasBlock(result, 'parenthetical', '(خارج الكادر)'), 'العينة الواقعية: لم تُفصل حالة (خارج الكادر).');
  assert(hasBlock(result, 'parenthetical', '(صوت داخلي)'), 'العينة الواقعية: لم تُفصل حالة (صوت داخلي).');
  assert(!result.blocks.some((block) => block.elementType === 'transition' && /قطع أثواب/.test(block.text)), 'العينة الواقعية: كلمة «قطع» داخل «قطع أثواب» صُنفت انتقالاً خطأ.');
  assert(!result.blocks.some((block) => block.elementType === 'scene_heading' && !block.text.trim()), 'العينة الواقعية: أُنشئ مشهد اصطناعي غير لازم.');
  assert(!result.blocks.some((block) => block.elementType === 'character' && block.text.trim() === 'اضحيكة يدق الباب'), 'العينة الواقعية: سطر حركة بدأ باسم شخصية وصُنّف شخصية خطأ.');
  assert(hasBlock(result, 'action_line', 'اضحيكة يدق الباب'), 'العينة الواقعية: سطر الحركة «اضحيكة يدق الباب» لم يُفصل كفعل.');
  assert(!result.blocks.some((block) => block.elementType === 'character' && block.text.trim() === 'الهرادي لا يجيب'), 'العينة الواقعية: «الهرادي لا يجيب» صُنفت شخصية بدل فعل.');
  return 'العينة الواقعية الطويلة';
});

cases.push(() => {
  const result = recognizePastedScreenplay(readFixture('priority-rules-ar.txt'));
  assert(result.sceneCount === 4, `قواعد الأولوية: المتوقع 4 مشاهد، الناتج ${result.sceneCount}`);
  assert(count(result.blocks, 'transition') === 1, 'قواعد الأولوية: «قطع إلى» يجب أن يكون انتقالاً واحداً.');
  assert(hasBlock(result, 'parenthetical', '(بهمس)'), 'قواعد الأولوية: النص بين القوسين يجب أن يكون حالة.');
  assert(hasBlock(result, 'parenthetical', '(خارج الكادر)'), 'قواعد الأولوية: الحالة الملحقة بالمتكلم لم تُفصل.');
  assert(hasBlock(result, 'scene_heading', 'خارجي / الطريق / ليل'), 'قواعد الأولوية: السطر الذي يبدأ بخارجي لم يُعتبر مشهداً.');
  assert(hasBlock(result, 'scene_heading', 'داخلي خارجي / سيارة / نهار'), 'قواعد الأولوية: داخلي خارجي لم يُعتبر مشهداً.');
  const synthetic = result.blocks.filter((block) => block.elementType === 'scene_heading' && !block.text.trim());
  assert(synthetic.length === 1, `قواعد الأولوية: بعد «قطع» يجب إنشاء بداية مشهد واحدة عند غياب العنوان، الناتج ${synthetic.length}.`);
  return 'قواعد الأولوية العربية';
});

cases.push(() => {
  const result = recognizePastedScreenplay(readFixture('word-like-compact-ar.txt'));
  assert(result.sceneCount === 2, `Word مضغوط: المتوقع مشهدان، الناتج ${result.sceneCount}`);
  assert(hasBlock(result, 'character', 'اعبيدة'), 'Word مضغوط: لم تُفصل الشخصية اعبيدة عن الوصف.');
  assert(hasBlock(result, 'character', 'عيشة'), 'Word مضغوط: لم تُفصل الشخصية عيشة عن الوصف.');
  assert(hasBlock(result, 'dialogue', 'مالكي على هاد الدخان؟'), 'Word مضغوط: حوار اعبيدة لم يُكتشف.');
  assert(hasBlock(result, 'dialogue', 'غير سير اتكى شوية حتى نطيب.'), 'Word مضغوط: حوار عيشة لم يُكتشف.');
  assert(!result.blocks.some((block) => (block.elementType === 'action' || block.elementType === 'action_line') && /\nاعبيدة$/.test(block.text)), 'Word مضغوط: اسم الشخصية اندمج مع الوصف السابق.');
  return 'فصل الشخصية عن الوصف في Word المضغوط';
});

cases.push(() => {
  const result = recognizeFountainScreenplay(readFixture('fountain-basic.fountain'));
  assert(result.sceneCount === 2, `Fountain: المتوقع مشهدان، الناتج ${result.sceneCount}`);
  assert(count(result.blocks, 'transition') === 2, `Fountain: المتوقع انتقالان، الناتج ${count(result.blocks, 'transition')}`);
  assert(hasBlock(result, 'scene_heading', 'INT. ROOM - DAY'), 'Fountain: لم يُكتشف عنوان INT.');
  assert(hasBlock(result, 'scene_heading', 'EXT. STREET - NIGHT'), 'Fountain: لم يُكتشف عنوان EXT.');
  assert(hasBlock(result, 'character', 'BOB'), 'Fountain: لم تُكتشف الشخصية BOB.');
  assert(hasBlock(result, 'character', 'سلمى'), 'Fountain: لم تُكتشف الشخصية العربية المفروضة بعلامة @.');
  assert(hasBlock(result, 'parenthetical', '(whispering)'), 'Fountain: لم تُكتشف الحالة الإنجليزية.');
  assert(hasBlock(result, 'parenthetical', '(بهمس)'), 'Fountain: لم تُكتشف الحالة العربية.');
  assert(hasBlock(result, 'dialogue', 'I heard something.'), 'Fountain: لم يُكتشف الحوار الإنجليزي.');
  assert(hasBlock(result, 'dialogue', 'سمعت الصوت.'), 'Fountain: لم يُكتشف الحوار العربي.');
  return 'استيراد Fountain الأساسي';
});

let passed = 0;
try {
  for (const run of cases) {
    const name = run();
    passed += 1;
    console.log(`✓ ${name}`);
  }
  console.log(`\nنجحت ${passed}/${cases.length} مجموعات اختبار الاستيراد.`);
} finally {
  fs.rmSync(outDir, { recursive: true, force: true });
}
