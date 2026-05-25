import {
  analyzeScript,
  evaluateIdea,
  generateDirections,
  generateThemeCandidates,
  generateMainlineReversals,
  generateEndings,
  generateMajorNodes,
  generateMacroOutline,
  generateStageOutline,
  generateEpisodeOutline,
  generateDraft,
  generateSkillSuggestion
} from "./generators.js";
import { auditOutline, auditDraft } from "./audit.js";
import { taskLabels } from "./schemas.js";
import { appendModelLog } from "./storage.js";
import { matchSkillsForTask } from "./skill-manager.js";
import { selectFallbackModel, selectModelRoute } from "./model-router.js";
import { buildPrompt } from "./prompt-builder.js";
import { parseJsonWithRepair, extractObjectBody } from "./json-repair.js";
import { callOpenAICompatible } from "./provider-adapters/openai-compatible.js";

export async function callModel({
  taskType,
  featureArea,
  projectId,
  skillIds = [],
  prompt,
  schema,
  inputMeta = {},
  routeOverride,
  state
}) {
  const startedAt = performance.now();
  const project = inputMeta.project || state?.currentProject || null;
  const resolvedFeatureArea = featureArea || featureAreaForTask(taskType);
  const { matchedSkills, matchedSkillIds, conflicts } = matchSkillsForTask({
    taskType,
    featureArea: resolvedFeatureArea,
    project,
    state,
    skillIds
  });
  const selection = selectModelRoute({
    state,
    project,
    taskType,
    featureArea: resolvedFeatureArea,
    matchedSkills,
    routeOverride
  });
  const builtPrompt = buildPrompt({
    taskType,
    project,
    input: inputMeta,
    matchedSkills,
    outputSchema: schema
  });
  const messages = prompt
    ? [
        { role: "system", content: builtPrompt.system },
        { role: "user", content: prompt }
      ]
    : builtPrompt.messages;

  let outputText = "";
  let parsedJson = null;
  let error = null;
  let tokenUsage = null;
  let costEstimate = null;
  let usedFallback = false;
  let provider = selection.provider;
  let model = selection.model;
  let mode = selection.mode;

  try {
    if (selection.mode === "demo") {
      const output = dispatchTask(taskType, inputMeta, state);
      outputText = typeof output === "string" ? output : JSON.stringify(output, null, 2);
      parsedJson = typeof output === "string" ? null : output;
      mode = "demo";
    } else {
      const response = await callProvider({ provider, model, messages, options: selection.options });
      outputText = response.outputText;
      tokenUsage = response.tokenUsage;
      costEstimate = estimateCost(model, tokenUsage);
      if (schema || selection.options.jsonModeRequired) {
        const repaired = await parseJsonWithRepair(outputText, {
          repairFn:
            taskType === "jsonRepair"
              ? null
              : async (brokenText, errors) => {
                  const repairResult = await callModel({
                    taskType: "jsonRepair",
                    featureArea: "JSON 修复",
                    projectId,
                    skillIds,
                    inputMeta: { project, brokenText, errors },
                    state
                  });
                  return repairResult.outputText;
                }
        });
        if (!repaired.ok) throw new Error(repaired.error);
        parsedJson = repaired.value;
      }
    }
  } catch (providerError) {
    if (selection.mode === "api") {
      const fallback = selectFallbackModel({
        config: state?.apiConfig,
        route: selection.route,
        failedModelId: model?.id,
        matchedSkills
      });
      if (fallback) {
        usedFallback = true;
        provider = fallback.provider;
        model = fallback.model;
        const response = await callProvider({ provider, model, messages, options: selection.options });
        outputText = response.outputText;
        tokenUsage = response.tokenUsage;
        costEstimate = estimateCost(model, tokenUsage);
        if (schema || selection.options.jsonModeRequired) {
          const repaired = await parseJsonWithRepair(outputText);
          if (!repaired.ok) throw new Error(repaired.error);
          parsedJson = repaired.value;
        }
      } else {
        error = providerError.message;
      }
    } else {
      error = providerError.message;
    }
  }

  const latencyMs = Math.round(performance.now() - startedAt);
  const result = {
    success: !error,
    mode,
    taskType,
    providerId: provider?.id || null,
    modelId: model?.id || null,
    usedFallback,
    matchedSkillIds,
    outputText,
    parsedJson,
    error,
    latencyMs,
    tokenUsage,
    costEstimate,
    logId: createLogId()
  };
  const log = {
    id: result.logId,
    taskType,
    taskLabel: taskLabels[taskType] || taskType,
    featureArea: resolvedFeatureArea,
    mode,
    providerId: result.providerId,
    providerName: provider?.name || "未选择",
    modelId: result.modelId,
    modelName: model?.displayName || model?.modelName || "未选择",
    skillVersion: matchedSkills.map((skill) => `${skill.name} ${skill.version}`).join("；") || "未匹配",
    matchedSkillIds,
    skillConflicts: conflicts,
    routingReason: selection.routingReason,
    usedFallback,
    inputSummary: summarizeInput(inputMeta),
    outputSummary: outputText ? summarizeInput(outputText) : "无输出",
    success: result.success,
    errorMessage: error,
    latencyMs,
    tokenUsage,
    costEstimate,
    createdAt: new Date().toISOString()
  };
  await appendModelLog(log);
  if (error) {
    result.log = log;
    return result;
  }
  result.log = log;
  return result;
}

export async function runModelTask(taskType, input, state) {
  const result = await callModel({
    taskType,
    featureArea: featureAreaForTask(taskType),
    projectId: input?.project?.id || state?.currentProject?.id,
    inputMeta: input,
    state
  });
  if (!result.success) throw new Error(result.error || "模型调用失败");
  return {
    output: result.parsedJson ?? result.outputText,
    log: result.log,
    result
  };
}

function dispatchTask(taskType, input, state) {
  const project = input?.project || state.currentProject;
  switch (taskType) {
    case "analyzeScript":
      return analyzeScript(input);
    case "evaluateIdea":
      return evaluateIdea(project);
    case "generateDirections":
      return generateDirections(project);
    case "generateThemeCandidates":
      return generateThemeCandidates(project);
    case "generateMainlineReversals":
      return generateMainlineReversals(project);
    case "generateEndingCandidates":
      return generateEndings(project);
    case "generateMajorNodes":
      return generateMajorNodes(project);
    case "generateMacroOutline":
      return generateMacroOutline(project);
    case "generateStageOutline":
      return generateStageOutline(project);
    case "generateEpisodeOutline":
      return generateEpisodeOutline(project);
    case "auditOutline":
      return auditOutline(project);
    case "generateDraft":
      return generateDraft(project, input.episodeNo);
    case "auditDraft":
      return auditDraft(input.draft);
    case "generateSkillSuggestion":
      return generateSkillSuggestion(input.skill, state.cases);
    case "testSkillVersion":
      return {
        oldSkillVersion: input.skill.version,
        newSkillVersion: bumpVersion(input.skill.version),
        evaluationSetId: "默认高质量案例集",
        casesTested: Math.max(1, state.cases.length),
        improvements: ["弱集人物功能识别更稳定", "分集信息增量提示更具体"],
        regressions: ["输出长度略增，需要主编筛选"],
        neutralChanges: ["题材分类无明显变化"],
        scoreOld: 78,
        scoreNew: 86,
        recommendation: "启用",
        notes: "Demo 回归结果用于展示流程，真实启用前应接入模型评估。"
      };
    case "jsonRepair":
      return repairJsonText(input.brokenText);
    default:
      throw new Error(`暂不支持的任务：${taskType}`);
  }
}

async function callProvider({ provider, model, messages, options }) {
  if (["openai_compatible", "openai", "openrouter", "deepseek", "qwen", "zhipu", "moonshot", "doubao", "custom"].includes(provider.providerType)) {
    return callOpenAICompatible({ provider, model, messages, options });
  }
  throw new Error(`Provider 类型 ${provider.providerType} 已预留，V1 仅实现 OpenAI-compatible 调用。`);
}

function featureAreaForTask(taskType) {
  const map = {
    analyzeScript: "剧本分析中心",
    extractPatterns: "模式资产中心",
    classifyCase: "分类与标签",
    generateSkillSuggestion: "Skill 进化中心",
    testSkillVersion: "Skill 进化中心",
    evaluateIdea: "创作决策中心",
    generateDirections: "创作决策中心",
    generateThemeCandidates: "创作决策中心",
    generateMainlineReversals: "创作决策中心",
    generateEndingCandidates: "创作决策中心",
    generateMajorNodes: "创作决策中心",
    generateMacroOutline: "细纲生产中心",
    generateCharacterCore: "细纲生产中心",
    generateGoldfinger: "细纲生产中心",
    generateStoryEngine: "细纲生产中心",
    generateMaterialPools: "细纲生产中心",
    generateStageOutline: "细纲生产中心",
    generateEpisodeOutline: "细纲生产中心",
    auditOutline: "审计与修复",
    repairSection: "审计与修复",
    generateDraft: "成稿中心",
    auditDraft: "成稿中心",
    jsonRepair: "JSON 修复",
    summarizeLongText: "长文本总结",
    classifyTags: "分类与标签"
  };
  return map[taskType] || "创作决策中心";
}

function repairJsonText(text = "") {
  try {
    JSON.parse(text);
    return text;
  } catch {
    return extractObjectBody(text);
  }
}

function summarizeInput(input) {
  const text = typeof input === "string" ? input : JSON.stringify(input ?? "");
  return text.length > 180 ? `${text.slice(0, 180)}...` : text;
}

function bumpVersion(version = "1.0.0") {
  const parts = version.split(".").map((item) => Number(item) || 0);
  parts[1] += 1;
  parts[2] = 0;
  return parts.join(".");
}

function estimateCost(model, tokenUsage) {
  if (!tokenUsage) return { amount: null, currency: "USD", note: "V1 占位：未配置单价" };
  return {
    amount: null,
    currency: "USD",
    promptTokens: tokenUsage.prompt_tokens || tokenUsage.promptTokens || null,
    completionTokens: tokenUsage.completion_tokens || tokenUsage.completionTokens || null,
    note: `费用等级：${model?.costLevel || "unknown"}`
  };
}

function createLogId() {
  return `call-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
