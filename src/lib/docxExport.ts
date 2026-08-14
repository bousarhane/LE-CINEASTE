import { strToU8, zipSync } from 'fflate';
import type { ProjectSnapshot, ScreenplayBlock } from './types';
import { episodeLabel, orderedScenes } from './structure';

function escapeXml(value: string): string {
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

function run(text: string, options: { bold?: boolean; italic?: boolean; underline?: boolean; size?: number } = {}): string {
  const rtl = hasArabic(text);
  const rPr = [
    '<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial"/>',
    options.bold ? '<w:b/><w:bCs/>' : '',
    options.italic ? '<w:i/><w:iCs/>' : '',
    options.underline ? '<w:u w:val="single"/>' : '',
    `<w:sz w:val="${options.size ?? 24}"/><w:szCs w:val="${options.size ?? 24}"/>`,
    rtl ? '<w:rtl/>' : '',
    '<w:lang w:val="en-US" w:eastAsia="en-US" w:bidi="ar-MA"/>'
  ].join('');

  const parts = text.split(/\n/);
  const body = parts
    .map((part, index) => `${index ? '<w:br/>' : ''}<w:t xml:space="preserve">${escapeXml(part)}</w:t>`)
    .join('');

  return `<w:r><w:rPr>${rPr}</w:rPr>${body}</w:r>`;
}

function paragraph(
  text: string,
  options: {
    align?: 'left' | 'right' | 'center';
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    size?: number;
    before?: number;
    after?: number;
    left?: number;
    right?: number;
    keepNext?: boolean;
    pageBreakBefore?: boolean;
    line?: number;
  } = {}
): string {
  const rtl = hasArabic(text);
  const pPr = [
    options.keepNext ? '<w:keepNext/>' : '',
    options.pageBreakBefore ? '<w:pageBreakBefore/>' : '',
    rtl ? '<w:bidi/>' : '',
    `<w:spacing w:before="${options.before ?? 0}" w:after="${options.after ?? 100}" w:line="${options.line ?? 300}" w:lineRule="auto"/>`,
    options.left || options.right ? `<w:ind w:left="${options.left ?? 0}" w:right="${options.right ?? 0}"/>` : '',
    `<w:jc w:val="${options.align ?? (rtl ? 'right' : 'left')}"/>`
  ].join('');

  return `<w:p><w:pPr>${pPr}</w:pPr>${run(text, options)}</w:p>`;
}

function blockToXml(block: ScreenplayBlock): string {
  const text = block.text.trimEnd();
  if (!text && block.elementType !== 'action') return '';

  switch (block.elementType) {
    case 'scene_heading':
      return paragraph(text, { align: hasArabic(text) ? 'right' : 'left', bold: true, size: 24, before: 220, after: 120, keepNext: true });
    case 'character':
      return paragraph(text, { align: 'center', bold: true, size: 24, before: 160, after: 20, keepNext: true });
    case 'parenthetical': {
      const value = text.startsWith('(') ? text : `(${text})`;
      return paragraph(value, { align: 'center', italic: true, size: 22, after: 20, left: 1350, right: 1350, keepNext: true });
    }
    case 'dialogue':
      return paragraph(text, { align: hasArabic(text) ? 'right' : 'left', size: 24, after: 120, left: 1450, right: 1450, line: 300 });
    case 'direction':
      return paragraph(text, { align: hasArabic(text) ? 'right' : 'left', underline: true, size: 23, before: 40, after: 110 });
    case 'transition':
      return paragraph(text, { align: 'left', bold: true, size: 23, before: 160, after: 120 });
    case 'action_line':
      return paragraph(text, { align: hasArabic(text) ? 'right' : 'left', bold: true, size: 24, after: 100 });
    case 'action':
    default:
      return paragraph(text, { align: hasArabic(text) ? 'right' : 'left', size: 24, after: 100, line: 300 });
  }
}

function projectTypeLabel(type: string): string {
  if (type === 'series') return 'مسلسل تلفزيوني';
  if (type === 'short') return 'فيلم قصير';
  return 'فيلم تلفزيوني';
}

function titlePage(snapshot: ProjectSnapshot): string {
  const title = snapshot.project.title.trim() || 'سيناريو';
  const author = snapshot.project.author.trim();
  return [
    paragraph('', { after: 1800 }),
    paragraph(title, { align: 'center', bold: true, size: 40, after: 240 }),
    paragraph(projectTypeLabel(snapshot.project.projectType), { align: 'center', size: 22, after: 900 }),
    author ? paragraph('كتابة', { align: 'center', size: 20, after: 80, keepNext: true }) : '',
    author ? paragraph(author, { align: 'center', bold: true, size: 25, after: 0 }) : '',
    '<w:p><w:pPr><w:bidi/><w:jc w:val="right"/></w:pPr><w:r><w:br w:type="page"/></w:r></w:p>'
  ].join('');
}

function screenplay(snapshot: ProjectSnapshot): string {
  const output: string[] = [];
  let lastEpisodeId = '';

  orderedScenes(snapshot).forEach((scene, index) => {
    if (snapshot.project.projectType === 'series' && scene.episodeId && scene.episodeId !== lastEpisodeId) {
      lastEpisodeId = scene.episodeId;
      output.push(paragraph(episodeLabel(snapshot, scene.episodeId), {
        align: 'center', bold: true, size: 30, after: 360,
        pageBreakBefore: index > 0, keepNext: true
      }));
    }

    const hasHeading = scene.blocks.some((block) => block.elementType === 'scene_heading');
    if (!hasHeading) {
      const fallback = scene.heading.trim() || [scene.sceneKind, scene.scenePlace, scene.sceneTime].filter(Boolean).join(' - ');
      if (fallback) output.push(paragraph(fallback, { align: hasArabic(fallback) ? 'right' : 'left', bold: true, size: 24, before: 220, after: 120, keepNext: true }));
    }

    for (const block of scene.blocks) output.push(blockToXml(block));
  });

  if (!output.length) output.push(paragraph('لا توجد مشاهد في هذا المشروع بعد.', { align: 'center' }));
  return output.join('');
}

function documentXml(snapshot: ProjectSnapshot): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<w:body>
${titlePage(snapshot)}
${screenplay(snapshot)}
<w:sectPr>
<w:footerReference w:type="default" r:id="rIdFooter"/>
<w:bidi/>
<w:rtlGutter/>
<w:pgSz w:w="11906" w:h="16838"/>
<w:pgMar w:top="907" w:right="1021" w:bottom="1021" w:left="1021" w:header="454" w:footer="454" w:gutter="0"/>
<w:cols w:space="708"/>
<w:titlePg/>
</w:sectPr>
</w:body>
</w:document>`;
}

function stylesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults>
<w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial"/><w:rtl/><w:sz w:val="24"/><w:szCs w:val="24"/><w:lang w:val="en-US" w:eastAsia="en-US" w:bidi="ar-MA"/></w:rPr></w:rPrDefault>
<w:pPrDefault><w:pPr><w:bidi/><w:spacing w:after="100" w:line="300" w:lineRule="auto"/><w:jc w:val="right"/></w:pPr></w:pPrDefault>
</w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
</w:styles>`;
}

function footerXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:p><w:pPr><w:bidi/><w:jc w:val="center"/></w:pPr>
<w:r><w:fldChar w:fldCharType="begin"/></w:r>
<w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r>
<w:r><w:fldChar w:fldCharType="end"/></w:r>
</w:p>
</w:ftr>`;
}

function coreXml(snapshot: ProjectSnapshot): string {
  const created = snapshot.project.createdAt || new Date().toISOString();
  const modified = snapshot.project.updatedAt || created;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<dc:title>${escapeXml(snapshot.project.title)}</dc:title>
<dc:creator>${escapeXml(snapshot.project.author || 'Scene Writer')}</dc:creator>
<cp:lastModifiedBy>Scene Writer</cp:lastModifiedBy>
<dcterms:created xsi:type="dcterms:W3CDTF">${escapeXml(created)}</dcterms:created>
<dcterms:modified xsi:type="dcterms:W3CDTF">${escapeXml(modified)}</dcterms:modified>
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
<Relationship Id="rIdOffice" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
<Relationship Id="rIdCore" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
<Relationship Id="rIdApp" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;

const DOCUMENT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
<Relationship Id="rIdFooter" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>
</Relationships>`;

const APP_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
<Application>Scene Writer</Application><AppVersion>0.8</AppVersion>
</Properties>`;

export function buildScreenplayDocx(snapshot: ProjectSnapshot): Uint8Array {
  return zipSync({
    '[Content_Types].xml': strToU8(CONTENT_TYPES),
    '_rels/.rels': strToU8(ROOT_RELS),
    'docProps/core.xml': strToU8(coreXml(snapshot)),
    'docProps/app.xml': strToU8(APP_XML),
    'word/document.xml': strToU8(documentXml(snapshot)),
    'word/styles.xml': strToU8(stylesXml()),
    'word/footer1.xml': strToU8(footerXml()),
    'word/_rels/document.xml.rels': strToU8(DOCUMENT_RELS)
  }, { level: 6 });
}
