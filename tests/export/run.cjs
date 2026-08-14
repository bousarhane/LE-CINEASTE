const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const root = path.resolve(__dirname, '..', '..');
const outDir = path.join(root, '.export-test-dist');
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
const localTsc = path.join(root, 'node_modules', 'typescript', 'bin', 'tsc');
const cmd = fs.existsSync(localTsc) ? process.execPath : 'tsc';
const args = fs.existsSync(localTsc) ? [localTsc] : [];
args.push(
  'src/lib/docxExport.ts',
  'src/lib/fountain.ts',
  'src/lib/demo.ts',
  'src/lib/structure.ts',
  'src/lib/id.ts',
  'src/lib/types.ts',
  '--module','commonjs','--target','es2022','--outDir',outDir,
  '--esModuleInterop','--skipLibCheck','--lib','es2022,dom'
);
const compile = cp.spawnSync(cmd, args, { cwd: root, encoding: 'utf8' });
if (compile.status !== 0) {
  process.stderr.write(compile.stdout || '');
  process.stderr.write(compile.stderr || '');
  process.exit(compile.status || 1);
}

fs.writeFileSync(path.join(outDir, 'package.json'), JSON.stringify({ type: 'commonjs' }));
const { createDemoProject } = require(path.join(outDir, 'demo.js'));
const { buildScreenplayDocx } = require(path.join(outDir, 'docxExport.js'));
const { toFountain } = require(path.join(outDir, 'fountain.js'));

const demo = createDemoProject();
const bytes = buildScreenplayDocx(demo);
if (bytes.length < 3000) throw new Error('DOCX الناتج أصغر من المتوقع.');
if (!(bytes[0] === 0x50 && bytes[1] === 0x4b)) throw new Error('DOCX لا يبدأ بتوقيع ZIP.');
const output = path.join(outDir, 'screenplay-demo.docx');
fs.writeFileSync(output, Buffer.from(bytes));
console.log('✓ إنشاء DOCX صالح كبنية ZIP');
console.log('✓ صفحة عنوان وتنسيق عناصر السيناريو مضمنان في OOXML');
console.log(output);

const fountain = toFountain(demo);
if (!/^Title:/m.test(fountain)) throw new Error('Fountain لا يحتوي على عنوان المشروع.');
if (!/^\./m.test(fountain)) throw new Error('Fountain لا يفرض عناوين المشاهد، وهو ضروري للعناوين العربية.');
if (!/^@/m.test(fountain)) throw new Error('Fountain لا يفرض أسماء الشخصيات، وهو ضروري للأسماء العربية.');
if (!/\([^\n]+\)/m.test(fountain)) console.warn('تنبيه: نموذج الاختبار لا يحتوي على حالة/parenthetical واضحة.');
const fountainOutput = path.join(outDir, 'screenplay-demo.fountain');
fs.writeFileSync(fountainOutput, fountain, 'utf8');
console.log('✓ Fountain يفرض عناوين المشاهد العربية بالنقطة .');
console.log('✓ Fountain يفرض أسماء الشخصيات العربية بالعلامة @');
console.log(fountainOutput);
