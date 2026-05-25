import { taskLabels } from "./schemas.js";

export const skillStatuses = ["草稿", "测试中", "已启用", "已停用", "已归档"];
export const skillSources = ["system", "admin", "ai_suggestion"];

export const functionalSkillTypes = [
  "剧本分析 Skill",
  "开头钩子识别 Skill",
  "观众情绪需求识别 Skill",
  "主题分析 Skill",
  "人物动机分析 Skill",
  "金手指分析 Skill",
  "主线骨架提取 Skill",
  "分集功能拆解 Skill",
  "模式提取 Skill",
  "创意评估 Skill",
  "方向生成 Skill",
  "主线大反差生成 Skill",
  "细纲生成 Skill",
  "成稿生成 Skill",
  "审计 Skill",
  "局部修复 Skill"
];

export const genreSkillTypes = [
  "都市逆袭 Skill",
  "豪门甜宠 Skill",
  "重生复仇 Skill",
  "穿越系统 Skill",
  "玄幻升级 Skill",
  "仙侠虐恋 Skill",
  "权谋宫斗 Skill",
  "悬疑反转 Skill",
  "群像成长 Skill",
  "AI 漫剧 Skill",
  "短剧强爽 Skill",
  "女频情感 Skill",
  "男频升级 Skill"
];

export const audienceNeedSkillTypes = [
  "尊严修复 Skill",
  "公平清算 Skill",
  "极致偏爱 Skill",
  "身份跃迁 Skill",
  "控制感补偿 Skill",
  "自由幻想 Skill",
  "被爱与被拯救 Skill",
  "命运反抗 Skill",
  "复仇释放 Skill",
  "秩序重建 Skill"
];

const globalBaseId = "skill-global-structure-v1";

export function createDefaultModelPreference(overrides = {}) {
  return {
    preferredModelIds: [],
    forbiddenModelIds: [],
    requireCapabilities: [],
    allowFallback: true,
    fallbackStrategy: "按任务路由备用模型降级",
    notes: "",
    ...overrides
  };
}

export function normalizeEditableSkill(skill, index = 0) {
  const now = new Date().toISOString();
  const skillType = skill.skillType || skill.type || "剧本分析 Skill";
  const category = skill.category || inferSkillCategory(skillType, skill.name);
  const source = skill.source || (skill.createdBy === "系统" ? "system" : "admin");
  return {
    id: skill.id || createId("skill"),
    name: skill.name || "未命名 Skill",
    description: skill.description || "",
    category,
    skillType,
    genreScope: toList(skill.genreScope),
    audienceNeedScope: toList(skill.audienceNeedScope),
    platformScope: toList(skill.platformScope || ["短剧", "漫剧"]),
    taskScope: toList(skill.taskScope || inferTaskScope(skillType)),
    priority: Number.isFinite(Number(skill.priority)) ? Number(skill.priority) : Math.max(10, 80 - index),
    status: skillStatuses.includes(skill.status) ? skill.status : "草稿",
    source: skillSources.includes(skill.source) ? source : source,
    version: skill.version || "1.0.0",
    rules: toList(skill.rules),
    positiveExamples: toList(skill.positiveExamples),
    negativeExamples: toList(skill.negativeExamples),
    promptAdditions: toList(skill.promptAdditions || skill.promptTemplate),
    outputSchemaRef: skill.outputSchemaRef || skill.schemaRef || "",
    evaluationCriteria: toList(skill.evaluationCriteria || skill.expectedImprovement),
    riskWarnings: toList(skill.riskWarnings || skill.knownRisks),
    modelPreference: createDefaultModelPreference(skill.modelPreference || {}),
    createdBy: skill.createdBy || (source === "system" ? "系统" : "管理员"),
    createdAt: skill.createdAt || now,
    updatedAt: skill.updatedAt || now,
    lastTestAt: skill.lastTestAt || null,
    changelog: normalizeChangelog(skill.changelog, skill)
  };
}

export function normalizeSkillList(skills = []) {
  return skills.map((skill, index) => normalizeEditableSkill(skill, index));
}

export function createNewSkill(overrides = {}) {
  const now = new Date().toISOString();
  const base = normalizeEditableSkill({
    id: createId("skill"),
    name: "新建 Skill",
    description: "补充这个 Skill 的用途、适用边界和风险。",
    category: "按功能",
    skillType: "剧本分析 Skill",
    status: "草稿",
    source: "admin",
    version: "1.0.0",
    rules: ["必须说明结构功能，不能只复述剧情。"],
    promptAdditions: ["输出前检查已锁定内容是否被尊重。"],
    evaluationCriteria: ["输出是否具体、可审计、可修复。"],
    riskWarnings: ["规则过宽会导致匹配过多。"],
    createdBy: "管理员",
    createdAt: now,
    updatedAt: now,
    changelog: [{ at: now, summary: "创建 Skill 草稿", actor: "管理员" }]
  });
  return normalizeEditableSkill({ ...base, ...overrides });
}

export function updateSkill(skills, skillId, patch, actor = "管理员") {
  return skills.map((skill) => {
    if (skill.id !== skillId) return skill;
    const previous = normalizeEditableSkill(skill);
    const next = normalizeEditableSkill({
      ...previous,
      ...patch,
      version: patch.version || bumpPatch(previous.version),
      updatedAt: new Date().toISOString()
    });
    next.changelog = [
      {
        at: next.updatedAt,
        actor,
        summary: patch.changeSummary || "编辑 Skill 配置",
        beforeStatus: previous.status,
        afterStatus: next.status,
        previousSnapshot: stripChangelog(previous)
      },
      ...(previous.changelog || [])
    ].slice(0, 50);
    return next;
  });
}

export function duplicateSkill(skills, skillId) {
  const source = skills.find((skill) => skill.id === skillId);
  if (!source) return skills;
  const now = new Date().toISOString();
  const copy = normalizeEditableSkill({
    ...source,
    id: createId("skill-copy"),
    name: `${source.name} 副本`,
    status: "草稿",
    source: "admin",
    version: "1.0.0",
    createdBy: "管理员",
    createdAt: now,
    updatedAt: now,
    changelog: [{ at: now, actor: "管理员", summary: `从 ${source.name} 复制` }]
  });
  return [copy, ...skills];
}

export function setSkillStatus(skills, skillId, status, actor = "管理员") {
  return updateSkill(skills, skillId, {
    status,
    changeSummary: `状态调整为${status}`
  }, actor);
}

export function rollbackSkill(skills, skillId) {
  return skills.map((skill) => {
    if (skill.id !== skillId) return skill;
    const entry = (skill.changelog || []).find((item) => item.previousSnapshot);
    if (!entry) return skill;
    const now = new Date().toISOString();
    const restored = normalizeEditableSkill({
      ...entry.previousSnapshot,
      updatedAt: now,
      changelog: [
        {
          at: now,
          actor: "管理员",
          summary: `回滚到 ${entry.at} 前的版本`,
          rollbackFrom: skill.version
        },
        ...(skill.changelog || [])
      ]
    });
    return restored;
  });
}

export function mergeSkillsDemo(skills, skillIds) {
  const selected = skills.filter((skill) => skillIds.includes(skill.id));
  if (selected.length < 2) return skills;
  const now = new Date().toISOString();
  const merged = createNewSkill({
    id: createId("skill-merge"),
    name: `${selected[0].name} + ${selected[1].name} 合并草稿`,
    description: "Demo 合并：整合两个 Skill 的规则、适用范围和风险提示，等待管理员人工确认。",
    category: "按功能",
    skillType: selected[0].skillType,
    genreScope: unique(selected.flatMap((skill) => skill.genreScope || [])),
    audienceNeedScope: unique(selected.flatMap((skill) => skill.audienceNeedScope || [])),
    platformScope: unique(selected.flatMap((skill) => skill.platformScope || [])),
    taskScope: unique(selected.flatMap((skill) => skill.taskScope || [])),
    priority: Math.max(...selected.map((skill) => Number(skill.priority) || 0)) + 1,
    rules: unique(selected.flatMap((skill) => skill.rules || [])),
    positiveExamples: unique(selected.flatMap((skill) => skill.positiveExamples || [])),
    negativeExamples: unique(selected.flatMap((skill) => skill.negativeExamples || [])),
    promptAdditions: unique(selected.flatMap((skill) => skill.promptAdditions || [])),
    evaluationCriteria: unique(selected.flatMap((skill) => skill.evaluationCriteria || [])),
    riskWarnings: unique(selected.flatMap((skill) => skill.riskWarnings || [])),
    status: "草稿",
    changelog: [{ at: now, actor: "管理员", summary: `Demo 合并：${selected.map((skill) => skill.name).join("、")}` }]
  });
  return [merged, ...skills];
}

export function matchSkillsForTask({ taskType, featureArea, project, state, skillIds = [] }) {
  const allSkills = normalizeSkillList(state?.skills || []);
  const manualIds = unique([
    ...toList(skillIds),
    ...toList(project?.lockedSkillIds),
    ...toList(project?.skillOverrides?.[taskType]),
    ...toList(project?.skillOverrides?.global)
  ]);
  const genres = collectProjectGenres(project);
  const audienceNeeds = collectProjectAudienceNeeds(project);
  const platforms = collectProjectPlatforms(project);
  const candidates = [];

  for (const skill of allSkills) {
    if (skill.status === "已归档" || skill.status === "已停用") continue;
    let score = 0;
    const reasons = [];
    if (manualIds.includes(skill.id)) {
      score += 1000;
      reasons.push("项目手动指定");
    }
    if (skill.taskScope.includes(taskType) || skill.skillType.includes(taskLabels[taskType] || taskType)) {
      score += 400;
      reasons.push("任务类型匹配");
    }
    if (matchesAny(skill.genreScope, genres) || keywordHit(skill.name, genres)) {
      score += 240;
      reasons.push("题材匹配");
    }
    if (matchesAny(skill.audienceNeedScope, audienceNeeds) || keywordHit(skill.name, audienceNeeds)) {
      score += 220;
      reasons.push("情绪需求匹配");
    }
    if (matchesAny(skill.platformScope, platforms) || keywordHit(skill.name, platforms)) {
      score += 180;
      reasons.push("平台/形态匹配");
    }
    if (skill.id === globalBaseId || skill.category === "全局" || skill.name.includes("基础")) {
      score += 80;
      reasons.push("全局基础 Skill");
    }
    if (featureArea && keywordHit(`${skill.description} ${skill.skillType}`, [featureArea])) {
      score += 40;
      reasons.push("功能区提示匹配");
    }
    if (score > 0) {
      candidates.push({ skill, score: score + (Number(skill.priority) || 0), reasons });
    }
  }

  const matchedSkills = candidates
    .sort((a, b) => b.score - a.score)
    .map((item) => ({ ...item.skill, matchReasons: item.reasons }))
    .slice(0, 8);
  const conflicts = detectSkillConflicts(matchedSkills, taskType);
  return {
    matchedSkills,
    matchedSkillIds: matchedSkills.map((skill) => skill.id),
    conflicts
  };
}

export function detectSkillConflicts(skills, taskType = "unknown") {
  const conflicts = [];
  for (let i = 0; i < skills.length; i += 1) {
    for (let j = i + 1; j < skills.length; j += 1) {
      const skillA = skills[i];
      const skillB = skills[j];
      const textA = skillText(skillA);
      const textB = skillText(skillB);
      if (hasFastSlap(textA) && hasSlowEmotion(textB)) {
        conflicts.push(createConflict(skillA, skillB, "一个 Skill 强调前期高频打脸，另一个强调情感压抑与关系铺垫。", taskType));
      } else if (hasFastSlap(textB) && hasSlowEmotion(textA)) {
        conflicts.push(createConflict(skillB, skillA, "一个 Skill 强调前期高频打脸，另一个强调情感压抑与关系铺垫。", taskType));
      }
      if (textA.includes("无限制") && /限制|代价|成本/.test(textB)) {
        conflicts.push(createConflict(skillA, skillB, "金手指无限制表达与规则/代价约束冲突。", taskType));
      } else if (textB.includes("无限制") && /限制|代价|成本/.test(textA)) {
        conflicts.push(createConflict(skillB, skillA, "金手指无限制表达与规则/代价约束冲突。", taskType));
      }
    }
  }
  return conflicts;
}

export function summarizeSkillForPrompt(skill) {
  return [
    `Skill：${skill.name}（${skill.skillType}，优先级 ${skill.priority}）`,
    `适用任务：${skill.taskScope.join("、") || "全局"}`,
    `适用题材：${skill.genreScope.join("、") || "不限"}`,
    `适用情绪：${skill.audienceNeedScope.join("、") || "不限"}`,
    `规则：${(skill.rules || []).join("；")}`,
    `补充提示：${(skill.promptAdditions || []).join("；")}`,
    `风险：${(skill.riskWarnings || []).join("；")}`
  ].join("\n");
}

function inferSkillCategory(skillType = "", name = "") {
  if (genreSkillTypes.some((item) => skillType.includes(item.replace(" Skill", "")) || name.includes(item.replace(" Skill", "")))) return "按题材";
  if (audienceNeedSkillTypes.some((item) => skillType.includes(item.replace(" Skill", "")) || name.includes(item.replace(" Skill", "")))) return "按观众情绪需求";
  if (skillType.includes("基础")) return "全局";
  return "按功能";
}

function inferTaskScope(skillType = "") {
  const map = [
    ["剧本分析", ["analyzeScript"]],
    ["开头钩子", ["analyzeScript"]],
    ["观众情绪需求", ["analyzeScript", "generateThemeCandidates"]],
    ["主题分析", ["analyzeScript", "generateThemeCandidates", "auditOutline"]],
    ["人物动机", ["analyzeScript", "generateCharacterCore", "generateEpisodeOutline", "auditOutline"]],
    ["金手指", ["analyzeScript", "generateGoldfinger", "generateMacroOutline"]],
    ["主线骨架", ["analyzeScript", "generateMacroOutline", "generateStageOutline"]],
    ["分集功能", ["analyzeScript", "generateEpisodeOutline", "auditOutline"]],
    ["模式提取", ["extractPatterns"]],
    ["创意评估", ["evaluateIdea"]],
    ["方向生成", ["generateDirections"]],
    ["主线大反差", ["generateMainlineReversals", "auditOutline"]],
    ["细纲生成", ["generateMacroOutline", "generateStageOutline", "generateEpisodeOutline"]],
    ["成稿生成", ["generateDraft"]],
    ["审计", ["auditOutline", "auditDraft"]],
    ["局部修复", ["repairSection"]]
  ];
  return map.find(([keyword]) => skillType.includes(keyword))?.[1] || [];
}

function collectProjectGenres(project = {}) {
  return unique([
    ...splitText(project.creativeConstraints?.format),
    ...splitText(project.creativeConstraints?.tone),
    ...splitText(project.selectedDirection?.type),
    ...splitText(project.selectedDirection?.logline),
    ...splitText(project.creativeInput),
    ...splitText(project.macroOutline?.genre)
  ]);
}

function collectProjectAudienceNeeds(project = {}) {
  return unique([
    ...toList(project.lockedTheme?.audienceNeed),
    ...toList(project.lockedTheme?.audienceNeedTypes),
    ...toList(project.selectedDirection?.audienceNeeds),
    ...toList(project.ideaEvaluation?.potentialAudienceNeeds),
    ...toList(project.macroOutline?.audienceNeeds)
  ]);
}

function collectProjectPlatforms(project = {}) {
  return unique([
    ...splitText(project.creativeConstraints?.format),
    ...splitText(project.creativeConstraints?.platformFit),
    ...splitText(project.creativeConstraints?.tone),
    ...splitText(project.title)
  ]);
}

function normalizeChangelog(changelog = [], skill = {}) {
  const entries = toList(changelog);
  if (entries.length) return entries;
  return [
    {
      at: skill.createdAt || new Date().toISOString(),
      actor: skill.createdBy || "系统",
      summary: "初始化 Skill",
      passed: true
    }
  ];
}

function stripChangelog(skill) {
  const copy = { ...skill };
  delete copy.changelog;
  return copy;
}

function createConflict(skillA, skillB, conflictDescription, affectedTask) {
  return {
    skillA: skillA.id,
    skillB: skillB.id,
    conflictDescription,
    affectedTask,
    suggestedResolution: "按项目锁定 Skill、管理员指定 Skill、当前任务 Skill、题材/情绪 Skill 的优先级处理；无法自动判断时提示人工选择。",
    requiresAdminDecision: true
  };
}

function skillText(skill) {
  return [...toList(skill.rules), ...toList(skill.riskWarnings), ...toList(skill.promptAdditions)].join(" ");
}

function hasFastSlap(text) {
  return /高频打脸|强爽|快速反打|前期.*打脸|密集爽点/.test(text);
}

function hasSlowEmotion(text) {
  return /情感宿命|情绪压抑|关系铺垫|慢热|克制/.test(text);
}

function matchesAny(scope, values) {
  return scope.some((scopeItem) => values.some((value) => String(value).includes(scopeItem) || scopeItem.includes(String(value))));
}

function keywordHit(text = "", values = []) {
  return values.some((value) => value && String(text).includes(String(value)));
}

function splitText(value) {
  return toList(value)
    .flatMap((item) => String(item).split(/[、,，/｜|\s]+/))
    .map((item) => item.trim())
    .filter(Boolean);
}

function toList(value) {
  if (Array.isArray(value)) return value.filter((item) => item !== null && item !== undefined && item !== "");
  if (value === null || value === undefined || value === "") return [];
  if (typeof value === "string") {
    return value
      .split(/\n|；|;/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [value];
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function bumpPatch(version = "1.0.0") {
  const parts = version.split(".").map((item) => Number(item) || 0);
  while (parts.length < 3) parts.push(0);
  parts[2] += 1;
  return parts.join(".");
}

function createId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
