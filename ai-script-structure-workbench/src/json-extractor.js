import { scoreEpisodeChunkCandidate } from "./episode-chunk-shape.js";

export function extractJsonCandidate(text = "") {
  const candidates = extractJsonCandidates(text);
  const source = String(text || "").trim();
  if (!source) {
    return { candidate: "", extractionMethod: "none", warnings: ["模型输出为空，未找到 JSON。"] };
  }

  const parseable = candidates
    .filter((item) => item.candidate && canParseJson(item.candidate))
    .sort((a, b) => b.candidate.length - a.candidate.length);
  if (parseable[0]) {
    return formatCandidateResult(parseable[0]);
  }

  const fallback = candidates.sort((a, b) => b.candidate.length - a.candidate.length)[0];
  if (fallback) {
    return {
      candidate: fallback.candidate,
      extractionMethod: fallback.extractionMethod,
      warnings: ["模型输出包含疑似 JSON 片段，但该片段仍无法直接解析。"]
    };
  }

  return { candidate: "", extractionMethod: "none", warnings: ["未找到 JSON 代码块；未找到 JSON 对象边界。"] };
}

export function extractTaskJsonCandidate(text = "", taskType = "") {
  const candidates = extractJsonCandidates(text);
  const source = String(text || "").trim();
  if (!source) {
    return { candidate: "", extractionMethod: "none", warnings: ["模型输出为空，未找到 JSON。"] };
  }

  const parseable = candidates
    .map((item) => {
      const parsed = safeParseJson(item.candidate);
      return parsed.ok ? { ...item, parsedJson: parsed.value, taskScore: taskCandidateScore(parsed.value, taskType) } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.taskScore - a.taskScore || b.candidate.length - a.candidate.length);
  if (parseable[0]) {
    return formatCandidateResult(parseable[0]);
  }

  return extractJsonCandidate(text);
}

export function extractJsonCandidates(text = "") {
  const source = String(text || "").trim();
  if (!source) {
    return [];
  }

  const candidates = [];
  if (canParseJson(source)) {
    candidates.push({ candidate: source, extractionMethod: "direct" });
  }
  collectFencedCandidates(source, candidates);
  collectBalancedCandidates(source, "{", "}", "brace_match", candidates);
  collectBalancedCandidates(source, "[", "]", "bracket_match", candidates);

  const seen = new Set();
  return candidates.filter((item) => {
    const key = `${item.extractionMethod}:${item.candidate}`;
    if (!item.candidate || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function formatCandidateResult(candidate) {
  return {
    candidate: candidate.candidate,
    extractionMethod: candidate.extractionMethod,
    warnings: candidate.extractionMethod === "direct" ? [] : ["模型输出包含非 JSON 前后缀，已自动提取 JSON 主体。"]
  };
}

function taskCandidateScore(value, taskType = "") {
  if (!value || typeof value !== "object") return 0;
  const directScore = directTaskCandidateScore(value, taskType);
  const wrapperScore = wrapperTaskCandidateScore(value, taskType);
  return Math.max(directScore, wrapperScore);
}

function directTaskCandidateScore(value, taskType = "") {
  if (!value || typeof value !== "object") return 0;
  if (taskType === "analyzeEpisodeChunk" || taskType === "analyzeScriptChunk") {
    return scoreEpisodeChunkCandidate(value);
  }
  if (taskType === "analyzeScript" || taskType === "aggregateScriptAnalysis" || taskType === "mergeEvidenceLedAnalysis" || taskType === "schemaRepairAnalyzeScript") {
    return [
      value.evidenceLedger && typeof value.evidenceLedger === "object" ? 50 : 0,
      Array.isArray(value.episodeBeatLedger) && value.episodeBeatLedger.length ? 45 : 0,
      value.basicInfo && typeof value.basicInfo === "object" ? 30 : 0,
      value.hookAnalysis && typeof value.hookAnalysis === "object" ? 25 : 0,
      value.sourceMeta && typeof value.sourceMeta === "object" ? 10 : 0
    ].reduce((sum, item) => sum + item, 0);
  }
  return 0;
}

function wrapperTaskCandidateScore(value, taskType = "") {
  if (!value || typeof value !== "object" || Array.isArray(value)) return 0;
  const wrapperKeys = ["result", "data", "output", "payload", "content", "scriptAnalysis", "analysis"];
  let bestScore = 0;
  for (const key of wrapperKeys) {
    const nested = value[key];
    if (!nested || typeof nested !== "object") continue;
    bestScore = Math.max(bestScore, directTaskCandidateScore(nested, taskType));
    if (!Array.isArray(nested)) {
      bestScore = Math.max(bestScore, wrapperTaskCandidateScore(nested, taskType));
    }
  }
  return bestScore ? bestScore + 1 : 0;
}

function collectFencedCandidates(source, candidates) {
  const fenceRe = /```([A-Za-z0-9_-]*)\s*([\s\S]*?)```/g;
  let match = fenceRe.exec(source);
  while (match) {
    const lang = String(match[1] || "").toLowerCase();
    const body = String(match[2] || "").trim();
    if (body) candidates.push({ candidate: body, extractionMethod: lang === "json" ? "fenced_json" : "fenced_code" });
    match = fenceRe.exec(source);
  }
}

function collectBalancedCandidates(source, opener, closer, method, candidates) {
  for (let start = source.indexOf(opener); start >= 0; start = source.indexOf(opener, start + 1)) {
    const end = findBalancedEnd(source, start, opener, closer);
    if (end > start) {
      candidates.push({ candidate: source.slice(start, end + 1).trim(), extractionMethod: method });
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

function safeParseJson(value) {
  try {
    return { ok: true, value: JSON.parse(value) };
  } catch {
    return { ok: false, value: null };
  }
}
