import { evaluateEpisodeChunkCompactShape } from "./episode-chunk-shape.js";

const taskShapeRules = {
  analyzeScript: {
    type: "object",
    required: [
      "coverage",
      "caseScope",
      "evidenceLedger",
      "episodeBeatLedger",
      "basicInfo",
      "hookAnalysis",
      "audienceNeedAnalysis",
      "themeAnalysis",
      "characterAnalysis",
      "goldfingerAnalysis",
      "obstacleAnalysis",
      "mainlineStructure",
      "mainlineReversalAnalysis",
      "endingAnalysis",
      "episodeFunctionAnalysis",
      "reusablePatterns"
    ]
  },
  analyzeScriptChunk: {
    type: "object",
    required: ["episodeNo", "title", "coverage", "evidenceLedger", "episodeBeatLedger", "episodeFunctionAnalysis", "openQuestions", "continuityNotes", "confidence", "needsReview"],
    allowEmptyArrays: ["openQuestions", "continuityNotes"]
  },
  analyzeEpisodeChunk: {
    type: "object",
    required: ["episodeNo", "title", "coverage", "evidenceLedger", "episodeBeatLedger", "episodeFunctionAnalysis", "openQuestions", "continuityNotes", "confidence", "needsReview"],
    allowEmptyArrays: ["openQuestions", "continuityNotes"]
  },
  aggregateScriptAnalysis: {
    type: "object",
    required: [
      "coverage",
      "caseScope",
      "evidenceLedger",
      "episodeBeatLedger",
      "basicInfo",
      "hookAnalysis",
      "audienceNeedAnalysis",
      "themeAnalysis",
      "characterAnalysis",
      "goldfingerAnalysis",
      "obstacleAnalysis",
      "mainlineStructure",
      "mainlineReversalAnalysis",
      "endingAnalysis",
      "episodeFunctionAnalysis",
      "reusablePatterns"
    ]
  },
  mergeEvidenceLedAnalysis: {
    type: "object",
    required: [
      "coverage",
      "caseScope",
      "evidenceLedger",
      "episodeBeatLedger",
      "basicInfo",
      "hookAnalysis",
      "audienceNeedAnalysis",
      "themeAnalysis",
      "characterAnalysis",
      "goldfingerAnalysis",
      "obstacleAnalysis",
      "mainlineStructure",
      "mainlineReversalAnalysis",
      "endingAnalysis",
      "episodeFunctionAnalysis",
      "reusablePatterns"
    ]
  },
  schemaRepairAnalyzeScript: {
    type: "object",
    required: [
      "coverage",
      "caseScope",
      "evidenceLedger",
      "episodeBeatLedger",
      "basicInfo",
      "hookAnalysis",
      "audienceNeedAnalysis",
      "themeAnalysis",
      "characterAnalysis",
      "goldfingerAnalysis",
      "obstacleAnalysis",
      "mainlineStructure",
      "mainlineReversalAnalysis",
      "endingAnalysis",
      "episodeFunctionAnalysis",
      "reusablePatterns"
    ]
  },
  schemaRepairAnalyzeEpisodeChunk: {
    type: "object",
    required: ["episodeNo", "title", "evidenceLedger", "episodeBeatLedger", "episodeFunctionAnalysis", "reusablePatterns", "openQuestions", "continuityNotes", "confidence", "needsReview"],
    allowEmptyArrays: ["reusablePatterns", "openQuestions", "continuityNotes"]
  },
  extractStoryBlueprint: {
    type: "object",
    required: ["storyEngine", "protagonistLoop", "emotionalLoop", "reusableSkeleton", "nonTransferableSurface", "sourceEvidence", "confidence", "needsReview"]
  },
  analyzeViralMechanism: {
    type: "object",
    required: ["audienceNeeds", "coolPointMechanisms", "retentionHooks", "whyItCanWork", "whyItMayFail", "sourceEvidence", "confidence", "needsReview"]
  },
  extractPatternCards: {
    type: "array",
    minItems: 5,
    itemRequired: ["name", "sourceEvidence", "structuralFunction", "audiencePsychology", "abstractTemplate", "variableSlots", "transferPrompt", "scoringRubric"]
  },
  buildSkillAssetsFromPatterns: {
    type: "array",
    minItems: 1,
    itemRequired: ["id", "name", "purpose", "patternCardIds", "promptAdditions", "positiveExamples", "negativeExamples", "evaluationCriteria", "status"]
  },
  applyPatternsToNewIdea: {
    type: "object",
    required: ["patternSelection", "variableMapping", "newStoryEngine", "firstFiveEpisodes", "risks", "patternCardIds"]
  },
  auditPatternTransfer: {
    type: "object",
    required: ["transferScore", "copiedSurfaceRisks", "mechanismCoverage", "suggestedRepairs"]
  },
  evaluateIdea: {
    type: "object",
    required: ["logline", "coreHook", "potentialAudienceNeeds", "commercialPotentialScore", "risks", "suggestions"]
  },
  generateDirections: {
    type: "array",
    minItems: 5,
    itemRequired: ["id", "title", "type", "logline", "audienceNeeds", "risks", "recommendation"]
  },
  generateThemeCandidates: {
    type: "array",
    minItems: 1,
    itemRequired: ["id", "audienceNeed", "themeStatement", "antiThemeForce", "emotionalPayoff", "risks"]
  },
  generateMainlineReversals: {
    type: "array",
    minItems: 3,
    itemRequired: ["id", "title", "surfaceStory", "deepTruth", "foreshadowingPlan", "impactOnEnding", "risks"]
  },
  generateEndingCandidates: {
    type: "array",
    minItems: 1,
    itemRequired: ["id", "title", "finalSituation", "protagonistFinalChoice", "themePayoff", "emotionalPayoff", "risks"]
  },
  generateMajorNodes: {
    type: "array",
    minItems: 1,
    itemRequired: ["id", "title", "nodes"]
  },
  generateMacroOutline: {
    type: "object",
    required: ["title", "logline", "themeStatement", "mainlineReversal", "ending", "characterCore", "storyEngine", "stageOutline"]
  },
  generateStageOutline: {
    type: "array",
    minItems: 3,
    itemRequired: ["stageNo", "title", "episodeRange", "stageGoal", "majorConflict", "endingHook"]
  },
  generateEpisodeOutline: {
    type: "array",
    minItems: 1,
    itemRequired: ["episodeNo", "title", "openingHook", "episodeGoal", "conflict", "keyEvent", "characterFunction", "themeFunction", "cliffhanger"]
  },
  auditOutline: {
    type: "object",
    required: ["overallScore", "themeAudit", "characterAudit", "reversalAudit", "episodeAudit", "summary"]
  },
  repairSection: {
    type: "object",
    required: ["id", "targetType", "repairType", "before", "after", "changeSummary", "impactScope", "risks"]
  },
  generateDraft: {
    type: "object",
    required: ["episodeNo", "title", "sceneList", "dialogueStyleNotes", "pacingNotes"]
  },
  auditDraft: {
    type: "object",
    required: ["score", "issues", "suggestions"]
  }
};

export function validateTaskOutput(taskType, value) {
  const rule = taskShapeRules[taskType];
  if (!rule) return { ok: true, issues: [] };
  const issues = [];
  if (rule.type === "array") {
    if (!Array.isArray(value)) {
      issues.push(`任务 ${taskType} 需要返回数组。`);
      return { ok: false, issues };
    }
    if (rule.minItems && value.length < rule.minItems) issues.push(`任务 ${taskType} 至少需要 ${rule.minItems} 条结果。`);
    value.slice(0, Math.max(rule.minItems || 1, 1)).forEach((item, index) => {
      issues.push(...missingFields(item, rule.itemRequired || []).map((field) => `第 ${index + 1} 条缺少 ${field}`));
    });
  } else {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      issues.push(`任务 ${taskType} 需要返回对象。`);
      return { ok: false, issues };
    }
    issues.push(...missingFields(value, rule.required || [], rule.allowEmptyArrays || []).map((field) => `缺少 ${field}`));
  }
  if (taskType === "analyzeScript" || taskType === "schemaRepairAnalyzeScript" || taskType === "aggregateScriptAnalysis" || taskType === "mergeEvidenceLedAnalysis") {
    issues.push(...validateAnalyzeScriptContract(value));
  }
  if (taskType === "analyzeEpisodeChunk" || taskType === "analyzeScriptChunk" || taskType === "schemaRepairAnalyzeEpisodeChunk") {
    issues.push(...validateEpisodeChunkContract(value));
  }
  if (taskType === "extractPatternCards") issues.push(...validatePatternCardsContract(value));
  if (taskType === "buildSkillAssetsFromPatterns") issues.push(...validatePatternSkillContract(value));
  return { ok: issues.length === 0, issues };
}

export function schemaValidationMessage(taskType, issues = []) {
  return `结构校验失败：${issues.join("；")}。建议执行 JSON/schema 修复，或检查该任务路由模型的输出约束。`;
}

function missingFields(value, fields, allowEmptyArrays = []) {
  return fields.filter((field) => {
    const item = value?.[field];
    if (Array.isArray(item)) return !allowEmptyArrays.includes(field) && item.length === 0;
    return item === null || item === undefined || item === "";
  });
}

function validateAnalyzeScriptContract(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const issues = [];
  const coreModules = [
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
  for (const moduleName of coreModules) {
    const moduleValue = value[moduleName];
    if (!moduleValue || typeof moduleValue !== "object") continue;
    if (!moduleValue.inferenceLevel) issues.push(`${moduleName} 缺少 inferenceLevel`);
    if (moduleValue.confidence === undefined || moduleValue.confidence === null || moduleValue.confidence === "") issues.push(`${moduleName} 缺少 confidence`);
    const hasEvidence = arrayHasItems(moduleValue.evidenceIds) || arrayHasItems(moduleValue.evidenceBeatIds);
    if (!hasEvidence && moduleValue.needsReview !== true) issues.push(`${moduleName} 缺少 evidenceIds/evidenceBeatIds 时必须 needsReview=true`);
  }
  const episodes = Array.isArray(value.episodeFunctionAnalysis) ? value.episodeFunctionAnalysis : [];
  episodes.forEach((episode, index) => {
    if (!episode.inferenceLevel) issues.push(`episodeFunctionAnalysis[${index}] 缺少 inferenceLevel`);
    if (episode.confidence === undefined || episode.confidence === null || episode.confidence === "") issues.push(`episodeFunctionAnalysis[${index}] 缺少 confidence`);
  });
  const patterns = Array.isArray(value.reusablePatterns) ? value.reusablePatterns : [];
  patterns.forEach((pattern, index) => {
    if (!arrayHasItems(pattern.structureSteps)) issues.push(`reusablePatterns[${index}] 缺少 structureSteps`);
    if (!pattern.variableSlots || typeof pattern.variableSlots !== "object" || Array.isArray(pattern.variableSlots)) issues.push(`reusablePatterns[${index}] 缺少 variableSlots`);
    if (!pattern.reusePrompt) issues.push(`reusablePatterns[${index}] 缺少 reusePrompt`);
  });
  if (value.coverage?.canAnalyzeEnding === false && value.endingAnalysis?.inferenceLevel === "原文明确") {
    issues.push("输入不完整时 endingAnalysis.inferenceLevel 不能是原文明确");
  }
  if (value.coverage?.canAnalyzeFullMainline === false && value.mainlineStructure?.inferenceLevel === "原文明确") {
    issues.push("输入不完整时 mainlineStructure.inferenceLevel 不能是原文明确");
  }
  if (value.coverage?.canAnalyzeFullMainline === false && value.mainlineReversalAnalysis?.inferenceLevel === "原文明确") {
    issues.push("输入不完整时 mainlineReversalAnalysis.inferenceLevel 不能是原文明确");
  }
  const beatLedger = Array.isArray(value.episodeBeatLedger) ? value.episodeBeatLedger : [];
  beatLedger.slice(0, 12).forEach((beat, index) => {
    for (const field of ["beatId", "sourceText", "beatSummary", "confidence"]) {
      if (beat?.[field] === undefined || beat?.[field] === null || beat?.[field] === "") issues.push(`episodeBeatLedger[${index}] 缺少 ${field}`);
    }
  });
  const evidenceLedger = value.evidenceLedger || {};
  for (const group of ["hookEvidence", "goldfingerEvidence", "suspenseEvidence", "endingEvidence", "conflictBeats", "characterMentions"]) {
    const list = Array.isArray(evidenceLedger[group]) ? evidenceLedger[group] : [];
    list.slice(0, 12).forEach((item, index) => {
      if (item?.id && !item.sourceText) issues.push(`evidenceLedger.${group}[${index}] 缺少 sourceText`);
    });
  }
  return issues;
}

function validatePatternCardsContract(cards) {
  if (!Array.isArray(cards)) return [];
  const issues = [];
  cards.forEach((card, index) => {
    const hasEvidence = arrayHasItems(card.sourceEvidence);
    if (!hasEvidence && card.needsReview !== true) issues.push(`PatternCard[${index}] sourceEvidence 不足时必须 needsReview=true`);
    if (!hasEvidence && card.canPromoteToSkill === true) issues.push(`PatternCard[${index}] sourceEvidence 不足时不能 canPromoteToSkill=true`);
    if (card.variableSlots && (typeof card.variableSlots !== "object" || Array.isArray(card.variableSlots))) {
      issues.push(`PatternCard[${index}] variableSlots 必须是对象`);
    }
  });
  return issues;
}

function validatePatternSkillContract(skills) {
  if (!Array.isArray(skills)) return [];
  const issues = [];
  skills.forEach((skill, index) => {
    if (skill.needsReview && skill.status === "已启用") issues.push(`SkillAsset[${index}] needsReview=true 时不能是已启用`);
  });
  return issues;
}

function validateEpisodeChunkContract(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const issues = [];
  const compactShape = evaluateEpisodeChunkCompactShape(value);
  if (!compactShape.valid) {
    issues.push(...compactShape.issues.map((issue) => `analyzeEpisodeChunk compact 结构无效：${issue}`));
  }
  const beats = Array.isArray(value.episodeBeatLedger) ? value.episodeBeatLedger : [];
  beats.slice(0, 8).forEach((beat, index) => {
    for (const field of ["beatId", "sourceText", "beatSummary", "confidence"]) {
      if (beat?.[field] === undefined || beat?.[field] === null || beat?.[field] === "") issues.push(`episodeBeatLedger[${index}] 缺少 ${field}`);
    }
  });
  const episode = value.episodeFunctionAnalysis || {};
  if (!arrayHasItems(episode.evidenceIds) && !arrayHasItems(episode.evidenceBeatIds) && episode.needsReview !== true) {
    issues.push("episodeFunctionAnalysis 缺少 evidenceIds/evidenceBeatIds 时必须 needsReview=true");
  }
  return issues;
}

function arrayHasItems(value) {
  return Array.isArray(value) && value.length > 0;
}
