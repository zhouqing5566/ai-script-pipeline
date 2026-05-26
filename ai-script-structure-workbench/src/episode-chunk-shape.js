const functionCoreFields = [
  "summary",
  "openingHook",
  "mainConflict",
  "coolMoment",
  "informationGain",
  "characterFunction",
  "cliffhanger"
];

const evidenceGroups = [
  "hookEvidence",
  "conflictBeats",
  "suspenseEvidence",
  "goldfingerEvidence",
  "endingEvidence",
  "characterMentions",
  "episodeEvidence"
];

const expectedCompactFields = ["evidenceLedger", "episodeBeatLedger", "episodeFunctionAnalysis"];

export function evaluateEpisodeChunkCompactShape(value = {}, options = {}) {
  const source = isPlainObject(value) ? value : {};
  const episodeText = normalizeText(options.episodeText || "");
  const issues = [];
  const missingCompactFields = expectedCompactFields.filter((field) => !hasCompactField(source, field));
  const modelProvidedFields = expectedCompactFields.filter((field) => !missingCompactFields.includes(field));
  const localFallbackSections = [...missingCompactFields];
  const beatLedger = Array.isArray(source.episodeBeatLedger) ? source.episodeBeatLedger : [];
  const validBeats = beatLedger.filter((beat) => isValidModelBeat(beat, episodeText));
  const validBeatIds = new Set(validBeats.map((beat) => String(beat.beatId || "").trim()).filter(Boolean));
  const evidenceItems = collectEvidenceItems(source.evidenceLedger);
  const validEvidenceItems = evidenceItems.filter((item) => isValidEvidenceItem(item, episodeText));
  const validEvidenceIds = new Set(validEvidenceItems.map((item) => String(item.id || "").trim()).filter(Boolean));
  const episodeFunction = isPlainObject(source.episodeFunctionAnalysis) ? source.episodeFunctionAnalysis : {};
  const nonEmptyFunctionFields = functionCoreFields.filter((field) => hasText(episodeFunction[field]));
  const evidenceBeatIds = toStringArray(episodeFunction.evidenceBeatIds);
  const evidenceIds = toStringArray(episodeFunction.evidenceIds);
  const linkedBeatIds = evidenceBeatIds.filter((id) => validBeatIds.has(id));
  const linkedEvidenceIds = evidenceIds.filter((id) => validEvidenceIds.has(id));

  if (missingCompactFields.length) {
    issues.push(`缺少 compact 字段：${missingCompactFields.join("、")}`);
  }
  if (!validBeats.length) {
    issues.push(episodeText ? "episodeBeatLedger 缺少可命中原文的有效 beat" : "episodeBeatLedger 缺少有效 beat");
  }
  if (nonEmptyFunctionFields.length < 2) {
    issues.push("episodeFunctionAnalysis 核心字段有效内容不足");
  }
  if (!linkedBeatIds.length && !linkedEvidenceIds.length) {
    issues.push("episodeFunctionAnalysis 缺少可链接到模型 beat/evidence 的证据引用");
  }

  const score = scoreEpisodeChunkCandidate(source, {
    compactShape: {
      validBeatCount: validBeats.length,
      validEvidenceCount: validEvidenceItems.length,
      nonEmptyFunctionFieldCount: nonEmptyFunctionFields.length,
      linkedBeatCount: linkedBeatIds.length,
      linkedEvidenceCount: linkedEvidenceIds.length,
      hasEpisodeNo: Boolean(source.episodeNo)
    }
  });

  return {
    valid: issues.length === 0,
    score,
    issues,
    missingCompactFields,
    localFallbackSections,
    modelProvidedFields,
    validBeatCount: validBeats.length,
    validEvidenceCount: validEvidenceItems.length,
    nonEmptyFunctionFields,
    linkedBeatIds,
    linkedEvidenceIds
  };
}

export function scoreEpisodeChunkCandidate(value = {}, options = {}) {
  if (!isPlainObject(value)) return 0;
  const shape = options.compactShape || deriveScoringShape(value);
  let score = 0;
  score += Math.min(shape.validBeatCount || 0, 4) * 25;
  score += Math.min(shape.validEvidenceCount || 0, 4) * 12;
  score += Math.min(shape.nonEmptyFunctionFieldCount || 0, 7) * 8;
  score += Math.min((shape.linkedBeatCount || 0) + (shape.linkedEvidenceCount || 0), 4) * 15;
  if (shape.hasEpisodeNo) score += 8;
  return score;
}

function deriveScoringShape(value) {
  const beatLedger = Array.isArray(value.episodeBeatLedger) ? value.episodeBeatLedger : [];
  const validBeats = beatLedger.filter((beat) => isValidModelBeat(beat, ""));
  const validBeatIds = new Set(validBeats.map((beat) => String(beat.beatId || "").trim()).filter(Boolean));
  const evidenceItems = collectEvidenceItems(value.evidenceLedger);
  const validEvidenceItems = evidenceItems.filter((item) => isValidEvidenceItem(item, ""));
  const validEvidenceIds = new Set(validEvidenceItems.map((item) => String(item.id || "").trim()).filter(Boolean));
  const episodeFunction = isPlainObject(value.episodeFunctionAnalysis) ? value.episodeFunctionAnalysis : {};
  const evidenceBeatIds = toStringArray(episodeFunction.evidenceBeatIds);
  const evidenceIds = toStringArray(episodeFunction.evidenceIds);
  return {
    validBeatCount: validBeats.length,
    validEvidenceCount: validEvidenceItems.length,
    nonEmptyFunctionFieldCount: functionCoreFields.filter((field) => hasText(episodeFunction[field])).length,
    linkedBeatCount: evidenceBeatIds.filter((id) => validBeatIds.has(id)).length,
    linkedEvidenceCount: evidenceIds.filter((id) => validEvidenceIds.has(id)).length,
    hasEpisodeNo: Boolean(value.episodeNo)
  };
}

function hasCompactField(value, field) {
  if (field === "evidenceLedger") return isPlainObject(value.evidenceLedger) && collectEvidenceItems(value.evidenceLedger).length > 0;
  if (field === "episodeBeatLedger") return Array.isArray(value.episodeBeatLedger) && value.episodeBeatLedger.length > 0;
  if (field === "episodeFunctionAnalysis") return isPlainObject(value.episodeFunctionAnalysis);
  return value[field] !== undefined && value[field] !== null;
}

function isValidModelBeat(beat, normalizedEpisodeText) {
  if (!isPlainObject(beat)) return false;
  const beatId = String(beat.beatId || "").trim();
  const sourceText = String(beat.sourceText || "").trim();
  const beatSummary = String(beat.beatSummary || beat.summary || "").trim();
  const structureFunction = String(beat.structureFunction || "").trim();
  if (!beatId || !sourceText || (!beatSummary && !structureFunction)) return false;
  if (!normalizedEpisodeText) return true;
  return normalizedEpisodeText.includes(normalizeText(sourceText));
}

function isValidEvidenceItem(item, normalizedEpisodeText) {
  if (!isPlainObject(item)) return false;
  const sourceText = String(item.sourceText || "").trim();
  if (!String(item.id || "").trim() || !sourceText) return false;
  if (!normalizedEpisodeText) return true;
  return normalizedEpisodeText.includes(normalizeText(sourceText));
}

function collectEvidenceItems(evidenceLedger) {
  if (!isPlainObject(evidenceLedger)) return [];
  return evidenceGroups.flatMap((group) => (Array.isArray(evidenceLedger[group]) ? evidenceLedger[group] : []));
}

function toStringArray(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
  if (value === undefined || value === null || value === "") return [];
  return [String(value).trim()].filter(Boolean);
}

function hasText(value) {
  return typeof value === "string" ? value.trim().length > 0 : value !== undefined && value !== null && value !== "";
}

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, "");
}

function isPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}
