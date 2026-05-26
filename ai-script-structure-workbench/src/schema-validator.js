const taskShapeRules = {
  analyzeScript: {
    type: "object",
    required: [
      "basicInfo",
      "hookAnalysis",
      "audienceNeedAnalysis",
      "themeAnalysis",
      "characterAnalysis",
      "mainlineStructure",
      "episodeFunctionAnalysis",
      "reusablePatterns"
    ]
  },
  schemaRepairAnalyzeScript: {
    type: "object",
    required: [
      "basicInfo",
      "hookAnalysis",
      "audienceNeedAnalysis",
      "themeAnalysis",
      "characterAnalysis",
      "mainlineStructure",
      "episodeFunctionAnalysis",
      "reusablePatterns"
    ]
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
    issues.push(...missingFields(value, rule.required || []).map((field) => `缺少 ${field}`));
  }
  return { ok: issues.length === 0, issues };
}

export function schemaValidationMessage(taskType, issues = []) {
  return `结构校验失败：${issues.join("；")}。建议执行 JSON/schema 修复，或检查该任务路由模型的输出约束。`;
}

function missingFields(value, fields) {
  return fields.filter((field) => {
    const item = value?.[field];
    if (Array.isArray(item)) return item.length === 0;
    return item === null || item === undefined || item === "";
  });
}
