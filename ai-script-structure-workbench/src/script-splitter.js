const chineseDigits = {
  零: 0,
  〇: 0,
  一: 1,
  二: 2,
  两: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9
};

const markerPattern =
  /(?:^|\n)\s*(?:【\s*)?((?:第\s*([0-9０-９零〇一二两三四五六七八九十百千]+)\s*[集话回章][^\n]*)|(?:(?:EP|Episode)\s*0*([0-9]+)[^\n]*)|(?:([一二两三四五六七八九十百千]+)\s*[、.．]\s*[^\n]{0,40}))(?:\s*】)?/gi;

export function splitScriptIntoEpisodes(scriptText = "") {
  const text = String(scriptText || "").trim();
  if (!text) return { episodes: [], detectedEpisodeCount: 0, warnings: ["剧本文本为空。"] };
  const matches = [...text.matchAll(markerPattern)]
    .map((match) => {
      const raw = match[1].trim();
      const episodeNo = parseEpisodeNo(match[2] || match[3] || match[4]);
      return {
        index: match.index + (match[0].startsWith("\n") ? 1 : 0),
        raw,
        episodeNo,
        detectedBy: match[3] ? "episode_marker" : match[4] ? "heading" : "episode_marker"
      };
    })
    .filter((item) => item.episodeNo);

  if (!matches.length) {
    return {
      episodes: [
        {
          episodeNo: null,
          title: "未分集文本",
          text,
          startOffset: 0,
          endOffset: text.length,
          detectedBy: "single_block"
        }
      ],
      detectedEpisodeCount: 0,
      warnings: ["未检测到明确分集标记。"]
    };
  }

  const episodes = matches.map((match, index) => {
    const startOffset = match.index;
    const endOffset = matches[index + 1]?.index ?? text.length;
    return {
      episodeNo: match.episodeNo,
      title: match.raw,
      text: text.slice(startOffset, endOffset).trim(),
      startOffset,
      endOffset,
      detectedBy: match.detectedBy
    };
  });

  return {
    episodes,
    detectedEpisodeCount: new Set(episodes.map((item) => item.episodeNo)).size,
    warnings: []
  };
}

export function splitScriptIntoChunks(scriptText = "", maxCharsPerChunk = 9000) {
  const text = String(scriptText || "").trim();
  if (!text) return { episodes: [], detectedEpisodeCount: 0, warnings: ["剧本文本为空。"] };
  const size = Math.max(2000, Number(maxCharsPerChunk) || 9000);
  const episodes = [];
  for (let start = 0; start < text.length; start += size) {
    const end = Math.min(text.length, start + size);
    episodes.push({
      episodeNo: episodes.length + 1,
      title: `启发式切块 ${episodes.length + 1}`,
      text: text.slice(start, end).trim(),
      startOffset: start,
      endOffset: end,
      detectedBy: "heuristic_chunk",
      chunkType: "heuristic_chunk",
      needsReview: true
    });
  }
  return {
    episodes,
    detectedEpisodeCount: episodes.length,
    warnings: ["文本较长但无法明确分集，已按字符长度切块；需人工复核分集边界。"]
  };
}

export function parseEpisodeNo(value) {
  const source = String(value || "").trim();
  if (!source) return null;
  const normalizedDigits = source.replace(/[０-９]/g, (char) => String(char.charCodeAt(0) - 0xff10));
  if (/^\d+$/.test(normalizedDigits)) return Number(normalizedDigits);
  return chineseNumberToInt(normalizedDigits);
}

function chineseNumberToInt(value = "") {
  const source = String(value || "").replace(/\s+/g, "");
  if (!source) return null;
  let total = 0;
  let section = 0;
  let number = 0;
  const unitMap = { 十: 10, 百: 100, 千: 1000 };
  for (const char of source) {
    if (Object.hasOwn(chineseDigits, char)) {
      number = chineseDigits[char];
    } else if (Object.hasOwn(unitMap, char)) {
      const unit = unitMap[char];
      section += (number || 1) * unit;
      number = 0;
    } else {
      return null;
    }
  }
  total += section + number;
  return total || null;
}
