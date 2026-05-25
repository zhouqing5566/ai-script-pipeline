const docxDocumentPath = "word/document.xml";

export async function parseScriptFile(file) {
  const name = (file?.name || "").toLowerCase();
  if (name.endsWith(".docx")) {
    const text = await extractDocxTextFromArrayBuffer(await file.arrayBuffer());
    if (!text.trim()) throw new Error("未能从 Word 文件中提取正文，请确认文件包含可复制文本。");
    return text;
  }
  if (name.endsWith(".doc")) {
    throw new Error("暂不支持老式 .doc 二进制格式，请在 Word 中另存为 .docx、txt 或 md 后再上传。");
  }
  if (name.endsWith(".pdf")) {
    throw new Error("PDF 正文解析尚未接入，为避免乱码，请先转成 txt、md 或 docx 后上传。");
  }
  return file.text();
}

export async function extractDocxTextFromArrayBuffer(arrayBuffer) {
  const entry = findZipEntry(arrayBuffer, docxDocumentPath);
  if (!entry) throw new Error("这不是有效的 .docx 文件，缺少 word/document.xml。");
  const xmlBytes = await readZipEntryBytes(entry);
  const xml = new TextDecoder("utf-8").decode(xmlBytes);
  return extractWordDocumentText(xml);
}

export function extractWordDocumentText(xml) {
  const paragraphs = [];
  const paragraphPattern = /<w:p[\s\S]*?<\/w:p>/g;
  for (const match of xml.matchAll(paragraphPattern)) {
    const text = extractTextRuns(match[0]).trim();
    if (text) paragraphs.push(text);
  }
  if (paragraphs.length) return paragraphs.join("\n\n");
  return extractTextRuns(xml).trim();
}

function findZipEntry(arrayBuffer, targetPath) {
  const view = new DataView(arrayBuffer);
  const eocdOffset = findEndOfCentralDirectory(view);
  const entryCount = view.getUint16(eocdOffset + 10, true);
  let offset = view.getUint32(eocdOffset + 16, true);
  const decoder = new TextDecoder("utf-8");

  for (let index = 0; index < entryCount; index += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) break;
    const compressionMethod = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const fileNameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localHeaderOffset = view.getUint32(offset + 42, true);
    const fileName = decoder.decode(new Uint8Array(arrayBuffer, offset + 46, fileNameLength));
    if (fileName === targetPath) {
      return { arrayBuffer, compressionMethod, compressedSize, localHeaderOffset };
    }
    offset += 46 + fileNameLength + extraLength + commentLength;
  }
  return null;
}

function findEndOfCentralDirectory(view) {
  const minOffset = Math.max(0, view.byteLength - 0xffff - 22);
  for (let offset = view.byteLength - 22; offset >= minOffset; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) return offset;
  }
  throw new Error("无法识别 Word 文件结构，请确认文件没有损坏。");
}

async function readZipEntryBytes(entry) {
  const view = new DataView(entry.arrayBuffer);
  const localOffset = entry.localHeaderOffset;
  if (view.getUint32(localOffset, true) !== 0x04034b50) {
    throw new Error("Word 文件内部结构异常，无法读取正文。");
  }
  const fileNameLength = view.getUint16(localOffset + 26, true);
  const extraLength = view.getUint16(localOffset + 28, true);
  const dataOffset = localOffset + 30 + fileNameLength + extraLength;
  const compressed = new Uint8Array(entry.arrayBuffer, dataOffset, entry.compressedSize);
  if (entry.compressionMethod === 0) return compressed;
  if (entry.compressionMethod === 8) return decompressDeflateRaw(compressed);
  throw new Error(`暂不支持该 Word 压缩方式：${entry.compressionMethod}`);
}

async function decompressDeflateRaw(bytes) {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("当前运行环境不支持 docx 解压，请使用新版 Chrome/Edge，或先转成 txt/md。");
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function extractTextRuns(fragment) {
  const parts = [];
  const pattern = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\s*\/>|<w:br\s*\/>/g;
  for (const match of fragment.matchAll(pattern)) {
    if (match[1] !== undefined) {
      parts.push(decodeXml(match[1]));
    } else if (match[0].startsWith("<w:tab")) {
      parts.push("\t");
    } else {
      parts.push("\n");
    }
  }
  return parts.join("");
}

function decodeXml(value) {
  return value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'");
}
