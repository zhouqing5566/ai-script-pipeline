export function validateEvidenceSourceText(analysis = {}, originalScriptText = "") {
  const original = String(originalScriptText || "");
  const normalizedOriginal = normalizeEvidenceText(original);
  const items = collectEvidenceItems(analysis);
  const declaredReferences = collectDeclaredEvidenceReferences(analysis);
  const invalidEvidenceIds = [];
  const invalidBeatIds = [];
  const partialEvidenceIds = [];
  const partialBeatIds = [];
  let validCount = 0;
  let partialCount = 0;
  let invalidCount = 0;

  for (const item of items) {
    const result = validateSourceText(item.sourceText, original, normalizedOriginal);
    item.target.sourceTextValidation = result;
    if (result.status === "valid") validCount += 1;
    else if (result.status === "partial") {
      partialCount += 1;
      if (item.evidenceId) partialEvidenceIds.push(item.evidenceId);
      if (item.beatId) partialBeatIds.push(item.beatId);
    }
    else {
      invalidCount += 1;
      item.target.invalidSourceText = true;
      if (item.evidenceId) invalidEvidenceIds.push(item.evidenceId);
      if (item.beatId) invalidBeatIds.push(item.beatId);
    }
  }

  const checkedCount = items.length;
  if (checkedCount === 0 && declaredReferences.hasReferences) {
    return {
      checkedCount: 0,
      validCount: 0,
      partialCount: 0,
      invalidCount: declaredReferences.evidenceIds.length + declaredReferences.beatIds.length,
      invalidEvidenceIds: declaredReferences.evidenceIds,
      invalidBeatIds: declaredReferences.beatIds,
      partialEvidenceIds: [],
      partialBeatIds: [],
      invalidEvidenceRatio: 1,
      warnings: ["分析声明了证据引用，但没有可校验 sourceText，不能作为证据驱动分析入库。"]
    };
  }
  const invalidEvidenceRatio = checkedCount ? Math.round((invalidCount / checkedCount) * 100) / 100 : 0;
  return {
    checkedCount,
    validCount,
    partialCount,
    invalidCount,
    invalidEvidenceIds: [...new Set(invalidEvidenceIds)],
    invalidBeatIds: [...new Set(invalidBeatIds)],
    partialEvidenceIds: [...new Set(partialEvidenceIds)],
    partialBeatIds: [...new Set(partialBeatIds)],
    invalidEvidenceRatio,
    warnings:
      invalidCount > 0
        ? [`发现 ${invalidCount} 条 evidence/beat 的 sourceText 未命中原文，请复核证据链。`]
        : []
  };
}

export function applyEvidenceValidationToAnalysis(analysis = {}, originalScriptText = "") {
  const evidenceValidation = validateEvidenceSourceText(analysis, originalScriptText);
  const invalidEvidence = new Set(evidenceValidation.invalidEvidenceIds || []);
  const invalidBeats = new Set(evidenceValidation.invalidBeatIds || []);
  const partialEvidence = new Set(evidenceValidation.partialEvidenceIds || []);
  const partialBeats = new Set(evidenceValidation.partialBeatIds || []);
  const modules = [
    "hookAnalysis",
    "audienceNeedAnalysis",
    "themeAnalysis",
    "characterAnalysis",
    "goldfingerAnalysis",
    "obstacleAnalysis",
    "mainlineStructure",
    "mainlineReversalAnalysis",
    "endingAnalysis"
  ];
  for (const moduleName of modules) {
    const moduleValue = analysis[moduleName];
    if (!moduleValue || typeof moduleValue !== "object") continue;
    const referencesInvalid =
      (moduleValue.evidenceIds || []).some((id) => invalidEvidence.has(id)) ||
      (moduleValue.evidenceBeatIds || []).some((id) => invalidBeats.has(id));
    if (referencesInvalid) {
      if (moduleValue.inferenceLevel === "原文明确") moduleValue.inferenceLevel = "合理推断";
      moduleValue.needsReview = true;
      moduleValue.confidence = Math.min(Number(moduleValue.confidence) || 0.5, 0.45);
      moduleValue.riskNotes = uniqueList([...(moduleValue.riskNotes || []), "引用的 evidence/beat 缺少有效原文 sourceText，需复核。"]);
    } else if (
      (moduleValue.evidenceIds || []).some((id) => partialEvidence.has(id)) ||
      (moduleValue.evidenceBeatIds || []).some((id) => partialBeats.has(id))
    ) {
      moduleValue.needsReview = true;
      moduleValue.confidence = Math.min(Number(moduleValue.confidence) || 0.7, 0.65);
      moduleValue.riskNotes = uniqueList([...(moduleValue.riskNotes || []), "引用的原文证据仅部分命中，建议复核。"]);
    }
  }
  analysis.sourceMeta ||= {};
  analysis.sourceMeta.evidenceValidation = evidenceValidation;
  if (evidenceValidation.invalidEvidenceRatio > 0.3 || evidenceValidation.partialCount / Math.max(evidenceValidation.checkedCount, 1) > 0.3) analysis.sourceMeta.needsReview = true;
  if (evidenceValidation.invalidEvidenceRatio > 0.5) analysis.sourceMeta.blockedSave = true;
  return { analysis, evidenceValidation };
}

function collectEvidenceItems(analysis = {}) {
  const items = [];
  for (const beat of analysis.episodeBeatLedger || []) {
    items.push({ target: beat, beatId: beat.beatId, sourceText: beat.sourceText });
  }
  const ledger = analysis.evidenceLedger || {};
  for (const key of ["hookEvidence", "goldfingerEvidence", "suspenseEvidence", "endingEvidence", "conflictBeats", "characterMentions"]) {
    for (const item of ledger[key] || []) {
      items.push({
        target: item,
        evidenceId: item.id,
        beatId: item.beatId || item.relatedBeatIds?.[0],
        sourceText: item.sourceText
      });
    }
  }
  return items;
}

function validateSourceText(sourceText = "", original = "", normalizedOriginal = "") {
  const source = String(sourceText || "").trim();
  if (!source) return { status: "invalid", matchType: "missingSourceText" };
  if (original.includes(source)) return { status: "valid", matchType: "direct" };
  const normalizedSource = normalizeEvidenceText(source);
  if (normalizedSource && normalizedOriginal.includes(normalizedSource)) return { status: "valid", matchType: "normalized" };
  const head = normalizedSource.slice(0, Math.min(24, Math.max(10, Math.floor(normalizedSource.length * 0.45))));
  if (head.length >= 10 && normalizedOriginal.includes(head)) return { status: "partial", matchType: "head" };
  const firstSentence = normalizeEvidenceText(source.split(/[。！？!?]/)[0] || "");
  if (firstSentence.length >= 10 && normalizedOriginal.includes(firstSentence)) return { status: "partial", matchType: "firstSentence" };
  return { status: "invalid", matchType: "none" };
}

function collectDeclaredEvidenceReferences(analysis = {}) {
  const evidenceIds = new Set();
  const beatIds = new Set();
  const modules = [
    "hookAnalysis",
    "audienceNeedAnalysis",
    "themeAnalysis",
    "characterAnalysis",
    "goldfingerAnalysis",
    "obstacleAnalysis",
    "mainlineStructure",
    "mainlineReversalAnalysis",
    "endingAnalysis"
  ];
  for (const moduleName of modules) {
    const moduleValue = analysis[moduleName] || {};
    for (const id of moduleValue.evidenceIds || []) evidenceIds.add(id);
    for (const id of moduleValue.evidenceBeatIds || []) beatIds.add(id);
  }
  for (const pattern of analysis.reusablePatterns || []) {
    for (const id of pattern.sourceEvidenceIds || []) evidenceIds.add(id);
    for (const id of pattern.sourceBeatIds || []) beatIds.add(id);
  }
  return {
    evidenceIds: [...evidenceIds],
    beatIds: [...beatIds],
    hasReferences: evidenceIds.size > 0 || beatIds.size > 0
  };
}

function normalizeEvidenceText(value = "") {
  return String(value)
    .replace(/[，]/g, ",")
    .replace(/[。]/g, ".")
    .replace(/[：]/g, ":")
    .replace(/[；]/g, ";")
    .replace(/[！]/g, "!")
    .replace(/[？]/g, "?")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, "")
    .trim();
}

function uniqueList(items = []) {
  return [...new Set(items.filter(Boolean))];
}
