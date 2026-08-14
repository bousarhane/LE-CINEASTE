import type { ProjectSnapshot, ScreenplayBlock } from './types';
import { episodeLabel, orderedScenes } from './structure';

const encoder = new TextEncoder();

function xml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function hasArabic(value: string): boolean {
  return /[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]/.test(value);
}

function runXml(text: string, options: { bold?: boolean; italic?: boolean; underline?: boolean; size?: number } = {}): string {
  const rtl = hasArabic(text);
  const props = [
    '<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial"/>',
    `<w:sz w:val="${options.size ?? 24}"/><w:szCs w:val="${options.size ?? 24}"/>`,
    '<w:lang w:val="en-US" w:eastAsia="en-US" w:bidi="ar-MA"/>',
    rtl ? '<w:rtl/>' : '',
    options.bold ? '<w:b/>' : '',
    options.italic ? '<w:i/>' : '',
    options.underline ? '<w:u w:val="single"/>' : ''
  ].join('');

  const parts = text.split(/\n/);
  const content = parts
    .map((part, index) => `${index ? '<w:br/>' : ''}<w:t xml:space="preserve">${xml(part)}</w:t>`)
    .join('');
  return `<w:r><w:rPr>${props}</w:rPr>${content}</w:r>`;
}

function paragraphXml(
  text: string,
  options: {
    align?: 'right' | 'left' | 'center' | 'both';
    before?: number;
    after?: number;
    line?: number;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    size?: number;
    keepNext?: boolean;
    keepLines?: boolean;
    pageBreakBefore?: boolean;
    leftIndent?: number;
    rightIndent?: number;
    bidi?: boolean;
  } = {}
): string {
  const bidi = options.bidi ?? hasArabic(text);
  const pPr = [
    bidi ? '<w:bidi/>' : '',
    `<w:jc w:val="${options.align ?? (bidi ? 'right' : 'left')}"/>`,
    `<w:spacing w:before="${options.before ?? 0}" w:after="${options.after ?? 100}" w:line="${options.line ?? 320}" w:lineRule="auto"/>`,
    options.keepNext ? '<w:keepNext/>' : '',
    options.keepLines ? '<w:keepLines/>' : '',
    options.pageBreakBefore ? '<w:pageBreakBefore/>' : '',
    options.leftIndent || options.rightIndent
      ? `<w:ind w:left="${options.leftIndent ?? 0}" w:right="${options.rightIndent ?? 0}"/>`
      : ''
  ].join('');
  return `<w:p><w:pPr>${pPr}</w:pPr>${runXml(text, options)}</w:p>`;
}

function blockXml(block: ScreenplayBlock): string {
  const text = block.text.trimEnd();
  switch (block.elementType) {
    case 'scene_heading':
      return paragraphXml(text, { bold: true, size: 24, before: 220, after: 120, keepNext: true, keepLines: true });
    case 'character':
      return paragraphXml(text, { align: 'center', bold: true, size: 24, before: 180, after: 0, keepNext: true, keepLines: true });
    case 'parenthetical': {
      const value = text.startsWith('(') ? text : `(${text})`;
      return paragraphXml(value, { align: 'center', italic: true, size: 22, before: 0, after: 0, keepNext: true, keepLines: true, leftIndent: 1300, rightIndent: 1300 });
    }
    case 'dialogue':
      return paragraphXml(text, { align: hasArabic(text) ? 'right' : 'left', bold: true, size: 24, before: 0, after: 100, line: 310, keepLines: true, leftIndent: 1650, rightIndent: 1650 });
    case 'direction':
      return paragraphXml(text, { underline: true, size: 23, before: 40, after: 100, keepLines: true });
    case 'transition':
      return paragraphXml(text, { align: 'left', bold: true, size: 23, before: 180, after: 120, keepLines: true });
    case 'action_line':
      return paragraphXml(text, { bold: true, size: 24, before: 0, after: 100, keepLines: true });
    case 'action':
    default:
      return paragraphXml(text, { align: hasArabic(text) ? 'both' : 'left', size: 24, before: 0, after: 100, keepLines: true });
  }
}

function projectTypeLabel(type: string): string {
  return type === 'series' ? 'مسلسل تلفزيوني' : type === 'short' ? 'فيلم قصير' : 'فيلم سينمائي';
}

function titlePageXml(snapshot: ProjectSnapshot): string {
  const title = snapshot.project.title.trim() || 'سيناريو';
  const author = snapshot.project.author.trim();
  const kind = projectTypeLabel(snapshot.project.projectType);
  return [
    paragraphXml('', { after: 2100 }),
    paragraphXml(title, { align: 'center', bold: true, size: 42, after: 220, keepLines: true }),
    paragraphXml(kind, { align: 'center', size: 22, after: 900, keepLines: true }),
    author ? paragraphXml('كتابة', { align: 'center', size: 20, after: 80, keepNext: true }) : '',
    author ? paragraphXml(author, { align: 'center', bold: true, size: 25, after: 0, keepLines: true }) : '',
    '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'
  ].join('');
}

function screenplayBodyXml(snapshot: ProjectSnapshot): string {
  const scenes = orderedScenes(snapshot);
  let lastEpisodeId = '';
  const output: string[] = [];

  scenes.forEach((scene, index) => {
    if (snapshot.project.projectType === 'series' && scene.episodeId && scene.episodeId !== lastEpisodeId) {
      lastEpisodeId = scene.episodeId;
      output.push(paragraphXml(episodeLabel(snapshot, scene.episodeId), {
        align: 'center', bold: true, size: 30, before: 0, after: 420,
        keepNext: true, keepLines: true, pageBreakBefore: index > 0
      }));
    }

    const firstHeading = scene.blocks.find((block) => block.elementType === 'scene_heading');
    if (!firstHeading) {
      const structured = scene.heading.trim() || [scene.sceneKind, scene.scenePlace, scene.sceneTime].filter(Boolean).join(' - ');
      if (structured) output.push(blockXml({ id: `${scene.id}-heading`, elementType: 'scene_heading', text: structured }));
    }

    scene.blocks.forEach((block) => output.push(blockXml(block)));
  });

  if (!scenes.length) {
    output.push(paragraphXml('لا توجد مشاهد في هذا المشروع بعد.', { align: 'center', size: 24, after: 0 }));
  }
  return output.join('');
}

function documentXml(snapshot: ProjectSnapshot): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    ${titlePageXml(snapshot)}
    ${screenplayBodyXml(snapshot)}
    <w:sectPr>
      <w:footerReference w:type="default" r:id="rId1"/>
      <w:titlePg/>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="907" w:right="1021" w:bottom="1021" w:left="1021" w:header="454" w:footer="454" w:gutter="0"/>
      <w:pgNumType w:start="1"/>
      <w:cols w:space="708"/>
      <w:docGrid w:linePitch="360"/>
    </w:sectPr>
  </w:body>
</w:document>`;
}

function stylesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial"/><w:sz w:val="24"/><w:szCs w:val="24"/><w:lang w:val="en-US" w:eastAsia="en-US" w:bidi="ar-MA"/></w:rPr></w:rPrDefault>
    <w:pPrDefault><w:pPr><w:spacing w:after="100" w:line="320" w:lineRule="auto"/></w:pPr></w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
</w:styles>`;
}

function footerXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>
</w:ftr>`;
}

function coreXml(snapshot: ProjectSnapshot): string {
  const created = snapshot.project.createdAt || new Date().toISOString();
  const modified = snapshot.project.updatedAt || created;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${xml(snapshot.project.title)}</dc:title>
  <dc:creator>${xml(snapshot.project.author || 'Scene Writer')}</dc:creator>
  <cp:lastModifiedBy>Scene Writer</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${xml(created)}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${xml(modified)}</dcterms:modified>
</cp:coreProperties>`;
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`;

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;

const DOCUMENT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

const APP_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Scene Writer</Application><AppVersion>0.8.0</AppVersion></Properties>`;

let crcTable: Uint32Array | null = null;
function makeCrcTable(): Uint32Array {
  if (crcTable) return crcTable;
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  crcTable = table;
  return table;
}

function crc32(bytes: Uint8Array): number {
  const table = makeCrcTable();
  let c = 0xffffffff;
  for (const byte of bytes) c = table[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function u16(value: number): Uint8Array {
  return Uint8Array.of(value & 0xff, (value >>> 8) & 0xff);
}

function u32(value: number): Uint8Array {
  return Uint8Array.of(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) { output.set(part, offset); offset += part.length; }
  return output;
}

interface ZipEntry { name: string; data: Uint8Array; crc: number; offset: number; }

function zipStore(files: Array<{ name: string; content: string }>): Uint8Array {
  const entries: ZipEntry[] = [];
  const localParts: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const name = encoder.encode(file.name);
    const data = encoder.encode(file.content);
    const crc = crc32(data);
    const header = concat([
      u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), name
    ]);
    localParts.push(header, data);
    entries.push({ name: file.name, data, crc, offset });
    offset += header.length + data.length;
  }

  const centralStart = offset;
  const centralParts: Uint8Array[] = [];
  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const header = concat([
      u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0), u32(entry.crc), u32(entry.data.length), u32(entry.data.length),
      u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(entry.offset), name
    ]);
    centralParts.push(header);
    offset += header.length;
  }
  const centralSize = offset - centralStart;
  const end = concat([
    u32(0x06054b50), u16(0), u16(0), u16(entries.length), u16(entries.length), u32(centralSize), u32(centralStart), u16(0)
  ]);
  return concat([...localParts, ...centralParts, end]);
}

export function buildScreenplayDocx(snapshot: ProjectSnapshot): Uint8Array {
  return zipStore([
    { name: '[Content_Types].xml', content: CONTENT_TYPES },
    { name: '_rels/.rels', content: ROOT_RELS },
    { name: 'docProps/core.xml', content: coreXml(snapshot) },
    { name: 'docProps/app.xml', content: APP_XML },
    { name: 'word/document.xml', content: documentXml(snapshot) },
    { name: 'word/styles.xml', content: stylesXml() },
    { name: 'word/footer1.xml', content: footerXml() },
    { name: 'word/_rels/document.xml.rels', content: DOCUMENT_RELS }
  ]);
}
