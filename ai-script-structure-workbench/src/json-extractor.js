export function extractJsonCandidate(text = "") {
  const source = String(text || "").trim();
  const warnings = [];
  if (!source) {
    return { candidate: "", extractionMethod: "none", warnings: ["模型输出为空，未找到 JSON。"] };
  }

  if (canParseJson(source)) {
    return { candidate: source, extractionMethod: "direct", warnings };
  }

  const candidates = [];
  collectFencedCandidates(source, candidates);
  collectBalancedCandidates(source, "{", "}", "brace_match", candidates);
  collectBalancedCandidates(source, "[", "]", "bracket_match", candidates);

  const parseable = candidates
    .filter((item) => item.candidate && canParseJson(item.candidate))
    .sort((a, b) => b.candidate.length - a.candidate.length);
  if (parseable[0]) {
    return {
      candidate: parseable[0].candidate,
      extractionMethod: parseable[0].method,
      warnings: ["模型输出包含非 JSON 前后缀，已自动提取 JSON 主体。"]
    };
  }

  const fallback = candidates.sort((a, b) => b.candidate.length - a.candidate.length)[0];
  if (fallback) {
    return {
      candidate: fallback.candidate,
      extractionMethod: fallback.method,
      warnings: ["模型输出包含疑似 JSON 片段，但该片段仍无法直接解析。"]
    };
  }

  return { candidate: "", extractionMethod: "none", warnings: ["未找到 JSON 代码块；未找到 JSON 对象边界。"] };
}

function collectFencedCandidates(source, candidates) {
  const fenceRe = /```([A-Za-z0-9_-]*)\s*([\s\S]*?)```/g;
  let match = fenceRe.exec(source);
  while (match) {
    const lang = String(match[1] || "").toLowerCase();
    const body = String(match[2] || "").trim();
    if (body) candidates.push({ candidate: body, method: lang === "json" ? "fenced_json" : "fenced_code" });
    match = fenceRe.exec(source);
  }
}

function collectBalancedCandidates(source, opener, closer, method, candidates) {
  for (let start = source.indexOf(opener); start >= 0; start = source.indexOf(opener, start + 1)) {
    const end = findBalancedEnd(source, start, opener, closer);
    if (end > start) {
      candidates.push({ candidate: source.slice(start, end + 1).trim(), method });
    }
  }
}

function findBalancedEnd(source, start, opener, closer) {
  let depth = 0;
  let inString = false;
  let quote = "";
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const ch = source[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === quote) {
        inString = false;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      inString = true;
      quote = ch;
      continue;
    }
    if (ch === opener) depth += 1;
    if (ch === closer) depth -= 1;
    if (depth === 0) return index;
  }
  return -1;
}

function canParseJson(value) {
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
}
