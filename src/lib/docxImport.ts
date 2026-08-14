export interface DocxExtraction {
  text: string;
  paragraphCount: number;
  warnings: string[];
}

interface ZipEntry {
  name: string;
  compressionMethod: number;
  compressedSize: number;
  localHeaderOffset: number;
}

const ZIP_EOCD = 0x06054b50;
const ZIP_CENTRAL = 0x02014b50;
const ZIP_LOCAL = 0x04034b50;

function u16(view: DataView, offset: number): number {
  return view.getUint16(offset, true);
}

function u32(view: DataView, offset: number): number {
  return view.getUint32(offset, true);
}

function findEndOfCentralDirectory(view: DataView): number {
  // ZIP comments are limited to 65535 bytes, so the EOCD record must be near the end.
  const minOffset = Math.max(0, view.byteLength - 22 - 0xffff);
  for (let offset = view.byteLength - 22; offset >= minOffset; offset -= 1) {
    if (u32(view, offset) === ZIP_EOCD) return offset;
  }
  throw new Error('تعذر قراءة حاوية DOCX (ZIP).');
}

function listZipEntries(bytes: Uint8Array): ZipEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = findEndOfCentralDirectory(view);
  const totalEntries = u16(view, eocd + 10);
  let offset = u32(view, eocd + 16);
  const decoder = new TextDecoder('utf-8');
  const entries: ZipEntry[] = [];

  for (let index = 0; index < totalEntries; index += 1) {
    if (offset + 46 > view.byteLength || u32(view, offset) !== ZIP_CENTRAL) {
      throw new Error('بنية ملف DOCX غير مكتملة أو تالفة.');
    }

    const compressionMethod = u16(view, offset + 10);
    const compressedSize = u32(view, offset + 20);
    const fileNameLength = u16(view, offset + 28);
    const extraLength = u16(view, offset + 30);
    const commentLength = u16(view, offset + 32);
    const localHeaderOffset = u32(view, offset + 42);
    const nameStart = offset + 46;
    const nameEnd = nameStart + fileNameLength;
    const name = decoder.decode(bytes.subarray(nameStart, nameEnd));

    entries.push({ name, compressionMethod, compressedSize, localHeaderOffset });
    offset = nameEnd + extraLength + commentLength;
  }

  return entries;
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('بيئة التشغيل الحالية لا تدعم فك ضغط ملفات DOCX.');
  }

  try {
    const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw' as any));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch {
    throw new Error('تعذر فك ضغط محتوى ملف DOCX.');
  }
}

async function readZipEntry(bytes: Uint8Array, entry: ZipEntry): Promise<Uint8Array> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const offset = entry.localHeaderOffset;
  if (offset + 30 > view.byteLength || u32(view, offset) !== ZIP_LOCAL) {
    throw new Error(`تعذر قراءة ${entry.name} من ملف DOCX.`);
  }

  const fileNameLength = u16(view, offset + 26);
  const extraLength = u16(view, offset + 28);
  const dataStart = offset + 30 + fileNameLength + extraLength;
  const dataEnd = dataStart + entry.compressedSize;
  if (dataEnd > bytes.byteLength) {
    throw new Error(`محتوى ${entry.name} غير مكتمل داخل ملف DOCX.`);
  }

  const compressed = bytes.subarray(dataStart, dataEnd);
  if (entry.compressionMethod === 0) return compressed;
  if (entry.compressionMethod === 8) return inflateRaw(compressed);
  throw new Error(`طريقة ضغط غير مدعومة داخل DOCX (${entry.compressionMethod}).`);
}

async function readZipText(
  bytes: Uint8Array,
  entries: Map<string, ZipEntry>,
  name: string,
  required = true
): Promise<string> {
  const entry = entries.get(name);
  if (!entry) {
    if (required) throw new Error(`ملف Word لا يحتوي ${name}.`);
    return '';
  }
  const content = await readZipEntry(bytes, entry);
  return new TextDecoder('utf-8').decode(content);
}

function paragraphText(paragraph: Element): string {
  const parts: string[] = [];

  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) return;
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const element = node as Element;
    const name = element.localName;

    if (name === 't') {
      parts.push(element.textContent ?? '');
      return;
    }
    if (name === 'tab') {
      parts.push('\t');
      return;
    }
    if (name === 'br' || name === 'cr') {
      parts.push('\n');
      return;
    }

    for (const child of Array.from(element.childNodes)) walk(child);
  };

  walk(paragraph);
  return parts.join('').replace(/\u00a0/g, ' ').replace(/[ \t]+\n/g, '\n').trimEnd();
}

export async function extractDocxText(file: File): Promise<DocxExtraction> {
  const lower = file.name.toLowerCase();
  if (!lower.endsWith('.docx')) {
    throw new Error('صيغة Word المدعومة في الاستيراد هي DOCX فقط.');
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  let entryList: ZipEntry[];
  try {
    entryList = listZipEntries(bytes);
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error('تعذر فتح ملف DOCX. قد يكون الملف تالفاً أو ليس ملف Word صالحاً.');
  }

  const entries = new Map(entryList.map((entry) => [entry.name, entry]));
  const documentXml = await readZipText(bytes, entries, 'word/document.xml');

  const parser = new DOMParser();
  const xml = parser.parseFromString(documentXml, 'application/xml');
  if (xml.querySelector('parsererror')) {
    throw new Error('تعذر قراءة بنية ملف Word.');
  }

  const body = Array.from(xml.getElementsByTagNameNS('*', 'body'))[0];
  if (!body) throw new Error('لم أجد متن المستند داخل ملف Word.');

  // Word screenplay drafts commonly use one paragraph per screenplay element.
  // Paragraph spacing/indentation is formatting, not necessarily an actual empty
  // paragraph. The recognition engine uses blank boundaries as a structural cue,
  // so we deliberately preserve every Word paragraph as a separate screenplay
  // unit by placing one blank separator between non-empty paragraphs. Soft line
  // breaks inside the same Word paragraph remain ordinary line breaks.
  const paragraphs = Array.from(body.getElementsByTagNameNS('*', 'p'));
  const paragraphValues = paragraphs.map(paragraphText);
  const normalized: string[] = [];

  for (const value of paragraphValues) {
    const paragraph = value.trimEnd();
    if (!paragraph.trim()) {
      if (normalized.length && normalized[normalized.length - 1] !== '') normalized.push('');
      continue;
    }

    if (normalized.length && normalized[normalized.length - 1] !== '') normalized.push('');
    normalized.push(...paragraph.split('\n'));
  }

  const text = normalized.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  const warnings: string[] = [];

  if (!text) warnings.push('ملف Word لا يحتوي نصاً قابلاً للاستخراج.');
  if (entries.has('word/footnotes.xml')) {
    warnings.push('يوجد في الملف هوامش Word؛ لم تُدمج الهوامش في نص السيناريو المستورد.');
  }
  if (entries.has('word/comments.xml')) {
    warnings.push('يوجد في الملف تعليقات Word؛ لم تُدمج التعليقات في نص السيناريو المستورد.');
  }

  return { text, paragraphCount: paragraphs.length, warnings };
}
