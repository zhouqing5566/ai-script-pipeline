import { analyzeScript } from "./generators.js";
import { applyEvidenceValidationToAnalysis } from "./evidence-validator.js";
import { detectScriptCoverage } from "./script-coverage.js";
import { splitScriptIntoChunks, splitScriptIntoEpisodes } from "./script-splitter.js";

export const LONG_SCRIPT_CHAR_LIMIT = 18000;
export const LONG_SCRIPT_EPISODE_THRESHOLD = 5;

const evidenceGroups = ["hookEvidence", "goldfingerEvidence", "suspenseEvidence", "endingEvidence", "conflictBeats", "characterMentions"];

export function shouldUseLongScriptAnalysis(input = {}, coverage = null) {
  const text = String(input.text || "");
  const currentCoverage = coverage || detectScriptCoverage(text, input.episodeCount, { userConfirmedFullScript: input.userConfirmedFullScript });
  const userEpisodeCount = Number(input.episodeCount) || currentCoverage.userEpisodeCount || 0;
  return Boolean(
    (currentCoverage.inputType === "full_script" && userEpisodeCount >= LONG_SCRIPT_EPISODE_THRESHOLD) ||
      currentCoverage.detectedEpisodeCount >= LONG_SCRIPT_EPISODE_THRESHOLD ||
      text.length > LONG_SCRIPT_CHAR_LIMIT ||
      (input.userConfirmedFullScript && userEpisodeCount >= LONG_SCRIPT_EPISODE_THRESHOLD)
  );
}

export function prepareLongScriptChunks(input = {}, coverage = null) {
  const text = String(input.text || "");
  const currentCoverage = coverage || detectScriptCoverage(text, input.episodeCount, { userConfirmedFullScript: input.userConfirmedFullScript });
  const split = splitScriptIntoEpisodes(text);
  const base = (split.detectedEpisodeCount || 0) >= 2 ? split : text.length > LONG_SCRIPT_CHAR_LIMIT ? splitScriptIntoChunks(text, LONG_SCRIPT_CHAR_LIMIT) : split;
  return annotateChunkExpectations(base, input, currentCoverage);
}

export function createLongAnalysisProgress(chunks = [], meta = {}) {
  const missingChunks = Array.isArray(meta.missingChunks) ? meta.missingChunks : [];
  return {
    active: true,
    currentStep: "覆盖检测",
    expectedChunkCount: meta.expectedChunkCount || chunks.length,
    detectedChunkCount: meta.detectedChunkCount || chunks.length,
    inputSignature: meta.inputSignature || null,
    missingChunks,
    chunkResults: {},
    steps: [
      { id: "coverage", label: "覆盖检测", status: "成功" },
      { id: "split", label: "剧本切分", status: "待分析" },
      { id: "aggregate", label: "全剧结构聚合", status: "待分析" },
      { id: "evidence", label: "证据校验", status: "待分析" }
    ],
    chunks: chunks.map((chunk) => ({
      chunkKey: getChunkKey(chunk),
      episodeNo: chunk.episodeNo,
      title: chunk.title,
      detectedBy: chunk.detectedBy,
      chunkType: chunk.chunkType || "episode",
      status: "待分析",
      tokenEstimate: estimateTokens(chunk.text),
      error: "",
      startOffset: chunk.startOffset,
      endOffset: chunk.endOffset
    })),
    failedChunks: [],
    updatedAt: new Date().toISOString()
  };
}

export function createEpisodeChunkInput({ input = {}, chunk, coverage, globalContextSummary = "" }) {
  return {
    projectTitle: input.title || "未命名剧本",
    genre: input.genre || "",
    episodeNo: chunk.episodeNo,
    episodeTitle: chunk.title,
    episodeText: chunk.text,
    detectedBy: chunk.detectedBy,
    globalContextSummary,
    coverage,
    outputRequirements: [
      "只分析当前集文本，不编造后续。",
      "episodeBeatLedger.sourceText 必须来自本集原文。",
      "分集结尾钩子必须引用本集 beatIds。",
      "可复用模式必须引用本集 evidence/beat。"
    ]
  };
}

export function analyzeEpisodeChunk(input = {}) {
  const episodeText = String(input.episodeText || input.text || "");
  const episodeNo = Number(input.episodeNo) || null;
  const local = analyzeScript({
    title: input.projectTitle || input.title || "分集分析",
    genre: input.genre || "",
    episodeCount: 1,
    text: episodeText,
    userConfirmedFullScript: false
  });
  const beatPrefix = `E${String(episodeNo || 0).padStart(2, "0")}`;
  const episodeBeatLedger = (local.episodeBeatLedger || []).map((beat, index) => ({
    ...beat,
    beatId: `${beatPrefix}_B${String(index + 1).padStart(3, "0")}`,
    episodeNo: episodeNo || beat.episodeNo || null
  }));
  const idMap = new Map((local.episodeBeatLedger || []).map((beat, index) => [beat.beatId, episodeBeatLedger[index]?.beatId]));
  const evidenceLedger = remapEvidenceLedger(local.evidenceLedger || {}, idMap, beatPrefix);
  const episodeFunction = {
    ...(local.episodeFunctionAnalysis?.[0] || {}),
    episodeNo,
    title: input.episodeTitle || local.episodeFunctionAnalysis?.[0]?.title || `第${episodeNo || "?"}集`
  };
  episodeFunction.evidenceBeatIds = remapIds(episodeFunction.evidenceBeatIds || [], idMap);
  episodeFunction.evidenceIds = remapEvidenceIds(episodeFunction.evidenceIds || [], beatPrefix);
  return {
    episodeNo,
    title: input.episodeTitle || `第${episodeNo || "?"}集`,
    coverage: local.coverage,
    evidenceLedger,
    episodeBeatLedger,
    episodeFunctionAnalysis: episodeFunction,
    hookAnalysis: local.hookAnalysis,
    characterMentions: evidenceLedger.characterMentions || [],
    goldfingerEvidence: evidenceLedger.goldfingerEvidence || [],
    suspenseEvidence: evidenceLedger.suspenseEvidence || [],
    reusablePatterns: (local.reusablePatterns || []).map((pattern, index) => ({
      ...pattern,
      id: `${beatPrefix}_P${String(index + 1).padStart(3, "0")}`,
      sourceBeatIds: remapIds(pattern.sourceBeatIds || pattern.evidenceBeatIds || [], idMap),
      sourceEvidenceIds: remapEvidenceIds(pattern.sourceEvidenceIds || pattern.evidenceIds || [], beatPrefix),
      exampleEpisodes: [episodeNo].filter(Boolean)
    })),
    openQuestions: uniqueList([local.hookAnalysis?.viewerQuestion, local.mainlineStructure?.drivingQuestion].filter(Boolean)),
    continuityNotes: local.coverage?.warnings || [],
    confidence: local.confidence || 0.62,
    needsReview: episodeText.length < 300 || Boolean(local.sourceMeta?.needsReview)
  };
}

export function aggregateScriptAnalysis(input = {}) {
  const originalInput = input.originalInput || input.input || input;
  const coverage = input.coverage || detectScriptCoverage(originalInput.text || "", originalInput.episodeCount, { userConfirmedFullScript: originalInput.userConfirmedFullScript });
  const chunks = Array.isArray(input.episodeChunkAnalyses) ? input.episodeChunkAnalyses : [];
  const failedChunks = Array.isArray(input.failedChunks) ? input.failedChunks : [];
  const missingChunks = Array.isArray(input.missingChunks) ? input.missingChunks : [];
  const base = analyzeScript({ ...originalInput, userConfirmedFullScript: true });
  const mergedBeats = chunks.flatMap((chunk) => chunk.episodeBeatLedger || []);
  const mergedLedger = mergeEvidenceLedgers(chunks.map((chunk) => chunk.evidenceLedger || {}), coverage);
  const episodeFunctionAnalysis = chunks
    .map((chunk) => chunk.episodeFunctionAnalysis)
    .filter(Boolean)
    .sort((a, b) => (Number(a.episodeNo) || 0) - (Number(b.episodeNo) || 0));
  const reusablePatterns = chunks.flatMap((chunk) => chunk.reusablePatterns || []).slice(0, 24);
  const analysis = {
    ...base,
    coverage,
    caseScope: coverage.allowedCaseScope || "full_script",
    evidenceLedger: mergedLedger,
    episodeBeatLedger: mergedBeats,
    episodeFunctionAnalysis: episodeFunctionAnalysis.length ? episodeFunctionAnalysis : base.episodeFunctionAnalysis,
    reusablePatterns: reusablePatterns.length ? reusablePatterns : base.reusablePatterns,
    sourceMeta: {
      ...(base.sourceMeta || {}),
      chunkedAnalysis: true,
      localAggregateFallback: true,
      aggregateSource: "local_fallback",
      chunkCount: input.expectedChunkCount || chunks.length + failedChunks.length + missingChunks.length,
      expectedChunks: input.expectedChunkCount || chunks.length + failedChunks.length + missingChunks.length,
      detectedChunks: input.detectedChunkCount || chunks.length + failedChunks.length,
      successfulChunks: chunks.length,
      failedChunks,
      missingChunks,
      participatingChunks: chunks.length,
      completeAggregation: failedChunks.length === 0 && missingChunks.length === 0,
      needsReview: failedChunks.length > 0 || missingChunks.length > 0 || base.sourceMeta?.needsReview || false,
      blockedSave: base.sourceMeta?.blockedSave || false,
      warnings: uniqueList([
        ...(base.sourceMeta?.warnings || []),
        failedChunks.length ? `存在 ${failedChunks.length} 个失败分集/chunk，不能进入正式 Skill 沉淀。` : "",
        missingChunks.length ? `仅切出 ${chunks.length + failedChunks.length}/${input.expectedChunkCount || chunks.length + failedChunks.length + missingChunks.length} 个分集/chunk，不能视为完整剧本分析完成。` : "",
        "全剧聚合使用本地合并兜底，部分全剧判断仍需主编复核。",
        "完整剧本已使用分集分析流程，而不是依赖单次超大输出。"
      ])
    },
    analystNotes: [
      base.analystNotes,
      `长剧本分集分析：成功 ${chunks.length} 个 chunk，失败 ${failedChunks.length} 个。`
    ].filter(Boolean).join("\n")
  };
  applyEvidenceValidationToAnalysis(analysis, originalInput.text || "");
  applyLongScriptGateFlags(analysis);
  return analysis;
}

export function mergeEvidenceLedAnalysis(input = {}) {
  return aggregateScriptAnalysis(input);
}

function remapEvidenceLedger(ledger = {}, idMap, prefix) {
  const next = { ...ledger };
  for (const group of evidenceGroups) {
    next[group] = (Array.isArray(ledger[group]) ? ledger[group] : []).map((item, index) => ({
      ...item,
      id: `${prefix}_${item.id || `E${String(index + 1).padStart(3, "0")}`}`,
      beatId: idMap.get(item.beatId) || item.beatId,
      relatedBeatIds: remapIds(item.relatedBeatIds || (item.beatId ? [item.beatId] : []), idMap)
    }));
  }
  next.scenes = (Array.isArray(ledger.scenes) ? ledger.scenes : []).map((scene, index) => ({
    ...scene,
    sceneId: `${prefix}_${scene.sceneId || `S${String(index + 1).padStart(3, "0")}`}`,
    beatIds: remapIds(scene.beatIds || [], idMap)
  }));
  next.episodeEvidence = (Array.isArray(ledger.episodeEvidence) ? ledger.episodeEvidence : []).map((episode) => ({
    ...episode,
    beatIds: remapIds(episode.beatIds || [], idMap),
    openingHookBeatIds: remapIds(episode.openingHookBeatIds || [], idMap),
    cliffhangerBeatIds: remapIds(episode.cliffhangerBeatIds || [], idMap)
  }));
  return next;
}

function mergeEvidenceLedgers(ledgers = [], coverage = {}) {
  const merged = {
    coverage,
    scenes: [],
    characterMentions: [],
    conflictBeats: [],
    hookEvidence: [],
    goldfingerEvidence: [],
    suspenseEvidence: [],
    endingEvidence: [],
    episodeEvidence: []
  };
  for (const ledger of ledgers) {
    merged.scenes.push(...(ledger.scenes || []));
    for (const group of evidenceGroups) {
      merged[group].push(...(ledger[group] || []));
    }
    merged.episodeEvidence.push(...(ledger.episodeEvidence || []));
  }
  return merged;
}

function remapIds(ids = [], idMap) {
  return (Array.isArray(ids) ? ids : [ids]).map((id) => idMap.get(id) || id).filter(Boolean);
}

function remapEvidenceIds(ids = [], prefix) {
  return (Array.isArray(ids) ? ids : [ids]).map((id) => (id ? `${prefix}_${id}` : "")).filter(Boolean);
}

export function applyLongScriptGateFlags(analysis) {
  const meta = (analysis.sourceMeta ||= {});
  const invalidRatio = meta.evidenceValidation?.invalidEvidenceRatio || 0;
  const hasFailedChunks = (meta.failedChunks || []).length > 0;
  const hasDeclaredCoverageGap = Number(meta.expectedChunks || 0) > Number(meta.detectedChunks || meta.successfulChunks || 0);
  const hasMissingChunks = (meta.missingChunks || []).length > 0 || hasDeclaredCoverageGap;
  const hasPrimitiveNormalization = (meta.normalizedEvidenceEntries || 0) > 0 || (meta.normalizedBeatEntries || 0) > 0;
  const hasLocalAggregateFallback = meta.localAggregateFallback === true || meta.aggregateSource === "local_fallback";
  const isFullScript = analysis.coverage?.inputType === "full_script";
  meta.participatingChunks = meta.participatingChunks ?? meta.successfulChunks ?? 0;
  meta.completeAggregation = !hasFailedChunks && !hasMissingChunks;
  if (hasDeclaredCoverageGap && !(meta.missingChunks || []).length) {
    meta.warnings = uniqueList([...(meta.warnings || []), `系统仅切出 ${meta.detectedChunks || meta.successfulChunks || 0}/${meta.expectedChunks} 个分集/chunk，不能视为完整剧本分析完成。`]);
  }
  meta.usableForCaseSave = !meta.blockedSave;
  meta.usableForFullScriptCase = isFullScript && !hasFailedChunks && !hasMissingChunks && !hasLocalAggregateFallback && !meta.blockedSave && invalidRatio === 0;
  meta.usableForPatternExtraction = !hasFailedChunks && !hasMissingChunks && !hasLocalAggregateFallback && !meta.blockedSave && invalidRatio === 0;
  meta.usableForProduction = isFullScript && !hasFailedChunks && !hasMissingChunks && !hasLocalAggregateFallback && !meta.blockedSave;
  meta.usableForSkillLearning = isFullScript && !hasFailedChunks && !hasMissingChunks && !hasLocalAggregateFallback && !hasPrimitiveNormalization && !meta.blockedSave && !meta.needsReview && invalidRatio === 0;
  meta.usableForLearning = meta.usableForSkillLearning;
  if (hasFailedChunks || hasMissingChunks || hasPrimitiveNormalization || hasLocalAggregateFallback) {
    meta.needsReview = true;
    if (hasLocalAggregateFallback) {
      meta.warnings = uniqueList([...(meta.warnings || []), "本地聚合兜底结果不能进入正式完整案例或 Skill 学习沉淀。"]);
    }
    meta.usableForSkillLearning = false;
    meta.usableForLearning = false;
    meta.usableForFullScriptCase = false;
    meta.usableForProduction = false;
  }
  analysis.usableForLearning = meta.usableForLearning;
  analysis.usableForProduction = meta.usableForProduction;
  return analysis;
}

export function getChunkKey(chunk = {}) {
  return [chunk.episodeNo ?? "unknown", chunk.startOffset ?? 0, chunk.endOffset ?? 0, chunk.detectedBy || "chunk"].join(":");
}

export function createLongScriptInputSignature(input = {}) {
  const text = String(input.text || "");
  return {
    scriptTextHash: hashText(text),
    textLength: text.length,
    episodeCount: Number(input.episodeCount) || null,
    title: input.title || "",
    genre: input.genre || "",
    userConfirmedFullScript: Boolean(input.userConfirmedFullScript),
    updatedAt: new Date().toISOString()
  };
}

export function sameLongScriptInputSignature(a = null, b = null) {
  if (!a || !b) return true;
  return (
    a.scriptTextHash === b.scriptTextHash &&
    Number(a.episodeCount || 0) === Number(b.episodeCount || 0) &&
    Boolean(a.userConfirmedFullScript) === Boolean(b.userConfirmedFullScript)
  );
}

function hashText(text = "") {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function annotateChunkExpectations(split = {}, input = {}, coverage = {}) {
  const episodes = Array.isArray(split.episodes) ? split.episodes : [];
  const userEpisodeCount = Number(input.episodeCount) || Number(coverage.userEpisodeCount) || null;
  const expectsDeclaredFull =
    Boolean(input.userConfirmedFullScript && userEpisodeCount >= LONG_SCRIPT_EPISODE_THRESHOLD) ||
    (coverage.inputType === "full_script" && userEpisodeCount >= LONG_SCRIPT_EPISODE_THRESHOLD);
  const expectedChunkCount = expectsDeclaredFull ? userEpisodeCount : episodes.length;
  const detectedChunkCount = split.detectedEpisodeCount || episodes.length;
  const missingChunks = [];
  if (expectsDeclaredFull && expectedChunkCount > detectedChunkCount) {
    const detectedNos = new Set(episodes.map((episode) => Number(episode.episodeNo)).filter(Boolean));
    for (let no = 1; no <= expectedChunkCount; no += 1) {
      if (!detectedNos.has(no)) {
        missingChunks.push({
          episodeNo: no,
          title: `第${no}集未切出`,
          detectedBy: "missing",
          error: "用户声明完整剧本，但文本中未检测到该集内容。"
        });
      }
    }
  }
  return {
    ...split,
    episodes,
    expectedChunkCount,
    detectedChunkCount,
    missingChunks,
    warnings: uniqueList([
      ...(split.warnings || []),
      missingChunks.length ? `用户声明 ${expectedChunkCount} 集，但系统仅切出 ${detectedChunkCount} 集，缺失 ${missingChunks.length} 集。` : ""
    ])
  };
}

function estimateTokens(text = "") {
  return Math.ceil(String(text || "").length / 1.8);
}

function uniqueList(items = []) {
  return [...new Set(items.filter(Boolean))];
}
