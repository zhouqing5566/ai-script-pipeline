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
import { schemaValidationMessage, validateTaskOutput } from "./schema-validator.js";
import { resolveRequestFormat } from "./request-format.js";

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
  let actualRequestFormat = null;
  let endpointType = null;
  let providerStatus = null;
  let providerRawPreview = null;
  let serverStatus = null;
  let settingsUpdatedAt = null;
  let providerUpdatedAt = null;
  let modelUpdatedAt = null;
  let usedFallback = false;
  let provider = selection.provider;
  let model = selection.model;
  let mode = selection.mode;
  const warnings = [];
  const requestedMode = state?.apiConfig?.mode || "demo";
  const requiresRouteFix = requestedMode === "api" && selection.mode === "demo" && !state?.apiConfig?.allowDemoInApiMode;
  if (requestedMode === "api" && selection.mode === "demo") {
    warnings.push("当前为真实 API Mode，但该任务路由仍指向 Demo 模型。请在系统设置 → 路由配置中绑定真实模型。");
  }
  const attemptErrors = [];

  try {
    if (requiresRouteFix) {
      error = "当前是真实 API Mode，但该任务仍指向 Demo 模型。请点击“一键切换核心任务到当前真实模型”，或手动修改任务路由。";
    } else if (selection.mode === "demo") {
      const output = dispatchTask(taskType, inputMeta, state);
      outputText = typeof output === "string" ? output : JSON.stringify(output, null, 2);
      parsedJson = typeof output === "string" ? null : output;
      mode = "demo";
    } else {
      const response = await executeApiAttemptWithRetries({
        label: "主模型",
        attemptErrors,
        taskType,
        projectId,
        skillIds,
        provider,
        model,
        messages,
        options: selection.options,
        schema,
        state,
        project,
        route: selection.route
      });
      outputText = response.outputText;
      parsedJson = response.parsedJson;
      tokenUsage = response.tokenUsage;
      actualRequestFormat = response.requestFormat;
      endpointType = response.endpointType;
      providerStatus = response.providerStatus || response.status || null;
      providerRawPreview = response.providerRawPreview || null;
      serverStatus = response.serverStatus || response.status || null;
      settingsUpdatedAt = response.settingsUpdatedAt || null;
      providerUpdatedAt = response.providerUpdatedAt || null;
      modelUpdatedAt = response.modelUpdatedAt || null;
      costEstimate = estimateCost(model, tokenUsage);
    }
  } catch (providerError) {
    if (!attemptErrors.length) attemptErrors.push(`主模型失败：${providerError.message}`);
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
        try {
          const response = await executeApiAttemptWithRetries({
            label: "备用模型",
            attemptErrors,
            taskType,
            projectId,
            skillIds,
            provider,
            model,
            messages,
            options: selection.options,
            schema,
            state,
            project,
            route: selection.route
          });
          outputText = response.outputText;
          parsedJson = response.parsedJson;
          tokenUsage = response.tokenUsage;
          actualRequestFormat = response.requestFormat;
          endpointType = response.endpointType;
          providerStatus = response.providerStatus || response.status || null;
          providerRawPreview = response.providerRawPreview || null;
          serverStatus = response.serverStatus || response.status || null;
          settingsUpdatedAt = response.settingsUpdatedAt || null;
          providerUpdatedAt = response.providerUpdatedAt || null;
          modelUpdatedAt = response.modelUpdatedAt || null;
          costEstimate = estimateCost(model, tokenUsage);
        } catch (fallbackError) {
          if (!attemptErrors.some((item) => item.includes("备用模型"))) attemptErrors.push(`备用模型失败：${fallbackError.message}`);
          error = attemptErrors.join("；");
        }
      } else {
        error = attemptErrors.join("；");
      }
    } else {
      error = attemptErrors.join("；");
    }
  }

  const latencyMs = Math.round(performance.now() - startedAt);
  const requestFormat = mode === "api" ? actualRequestFormat || resolveRequestFormat({ provider, model }) : "demo";
  const resolvedEndpointType = mode === "api" ? endpointType || "server_proxy" : "local_demo";
  const status = error ? "failed" : "success";
  const apiModeDemoFallback = requestedMode === "api" && mode === "demo" && !requiresRouteFix;
  const result = {
    success: !error,
    mode,
    requestedMode,
    requestFormat,
    endpointType: resolvedEndpointType,
    status,
    taskType,
    routeId: selection.route?.id || null,
    providerId: provider?.id || null,
    modelId: model?.id || null,
    usedFallback,
    requiresRouteFix,
    apiModeDemoFallback,
    serverStatus,
    providerStatus,
    providerRawPreview,
    settingsUpdatedAt,
    providerUpdatedAt,
    modelUpdatedAt,
    matchedSkillIds,
    warnings,
    attemptErrors,
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
    requestedMode,
    providerId: result.providerId,
    providerName: provider?.name || "未选择",
    routeId: result.routeId,
    requestFormat,
    endpointType: resolvedEndpointType,
    serverProxy: resolvedEndpointType === "server_proxy",
    status,
    providerStatus,
    serverStatus,
    providerRawPreview,
    modelId: result.modelId,
    modelName: model?.displayName || model?.modelName || "未选择",
    skillVersion: matchedSkills.map((skill) => `${skill.name} ${skill.version}`).join("；") || "未匹配",
    matchedSkillIds,
    skillConflicts: conflicts,
    warnings,
    apiModeDemoWarning: warnings.some((item) => item.includes("真实 API Mode")),
    apiModeDemoFallback,
    requiresRouteFix,
    routingReason: selection.routingReason,
    usedFallback,
    attemptErrors,
    settingsUpdatedAt,
    providerUpdatedAt,
    modelUpdatedAt,
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
  if (!result.success) {
    const error = new Error(result.error || "模型调用失败");
    error.result = result;
    error.log = result.log;
    throw error;
  }
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

async function executeApiAttempt({ taskType, projectId, skillIds, provider, model, messages, options, schema, state, project, route }) {
  const response = await callProvider({ provider, model, messages, options, taskType, route });
  let parsedJson = null;
  if (schema || options.jsonModeRequired) {
    const repaired = await parseJsonWithRepair(response.outputText, {
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
              if (!repairResult.success) {
                throw new Error(repairResult.error || "JSON 修复模型调用失败");
              }
              return repairResult.outputText;
            }
    });
    if (!repaired.ok) throw new Error(repaired.error);
    parsedJson = repaired.value;
    const shape = validateTaskOutput(taskType, parsedJson);
    if (!shape.ok) throw new Error(schemaValidationMessage(taskType, shape.issues));
  }
  return {
    outputText: response.outputText,
    parsedJson,
    tokenUsage: response.tokenUsage,
    requestFormat: response.requestFormat,
    endpointType: response.endpointType,
    status: response.status,
    serverStatus: response.serverStatus,
    providerStatus: response.providerStatus,
    providerRawPreview: response.providerRawPreview,
    settingsUpdatedAt: response.settingsUpdatedAt,
    providerUpdatedAt: response.providerUpdatedAt,
    modelUpdatedAt: response.modelUpdatedAt
  };
}

async function executeApiAttemptWithRetries({ label, attemptErrors, ...args }) {
  const retryCount = Math.max(0, Math.min(5, Number(args.options?.retryCount) || 0));
  const totalAttempts = retryCount + 1;
  let lastError = null;
  for (let index = 0; index < totalAttempts; index += 1) {
    try {
      return await executeApiAttempt(args);
    } catch (error) {
      lastError = error;
      const prefix = totalAttempts === 1 ? `${label}失败` : `${label}第 ${index + 1}/${totalAttempts} 次失败`;
      attemptErrors.push(`${prefix}：${error.message}`);
      if (!shouldRetryModelError(error)) {
        attemptErrors.push(`${label}不可重试原因：${modelErrorRetryBlockReason(error)}`);
        break;
      }
      if (index === totalAttempts - 1) break;
    }
  }
  throw lastError || new Error(`${label}调用失败`);
}

async function callProvider({ provider, model, messages, options, taskType, route }) {
  const requestFormat = resolveRequestFormat({ provider, model });
  const payload = {
    providerId: provider?.id || null,
    modelId: model?.id || null,
    routeId: route?.id || null,
    taskType: taskType || null,
    messages,
    options,
    requestFormat
  };
  if (typeof globalThis.__MODEL_CALL_PROXY__ === "function") {
    try {
      return await globalThis.__MODEL_CALL_PROXY__(payload);
    } catch (error) {
      throw new Error(normalizeClientProviderError(error.message));
    }
  }
  try {
    const response = await fetch("/api/model-call", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) {
      throw new Error(data.errorMessage || data.error || `Provider 请求失败：${response.status}`);
    }
    return {
      outputText: data.outputText || "",
      tokenUsage: data.tokenUsage || null,
      requestFormat: data.requestFormat || requestFormat,
      endpointType: data.endpointType || "server_proxy",
      status: data.status || response.status,
      serverStatus: data.serverStatus || response.status,
      providerStatus: data.providerStatus || data.status || null,
      providerRawPreview: data.providerRawPreview || null,
      settingsUpdatedAt: data.settingsUpdatedAt || null,
      providerUpdatedAt: data.providerUpdatedAt || null,
      modelUpdatedAt: data.modelUpdatedAt || null
    };
  } catch (error) {
    throw new Error(normalizeClientProviderError(error.message));
  }
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

function normalizeClientProviderError(message = "") {
  if (message.includes("当前接口不接受 OpenAI Chat Completions 格式") || message.includes("真实任务应走本地 server proxy") || message.includes("请求被中止")) {
    return message;
  }
  if (/Unknown name "messages"|Unknown name "max_tokens"|Unknown name "temperature"|Cannot find field/i.test(message)) {
    return `${message}。当前接口不接受 OpenAI Chat Completions 格式。若你使用 OpenAI 代理/DeepSeek，请将 requestFormat 改为 openai_chat，并确认 Base URL 是 OpenAI-compatible 地址；若你使用官方 Gemini API，请改为 gemini_native。`;
  }
  if (/Failed to fetch/i.test(message)) {
    return `${message}。前端请求本地 /api/model-call 失败。请确认本地服务 http://127.0.0.1:4178 正在运行，server.js 未报错，且没有被浏览器/代理拦截。`;
  }
  if (/The user aborted a request|signal is aborted|AbortError|aborted/i.test(message)) {
    return `${message}。请求被中止，可能是超时、重复触发或页面状态切换。请查看 timeoutMs 和是否重复点击。`;
  }
  return message;
}

export function shouldRetryModelError(error) {
  const message = error?.message || String(error || "");
  if (/结构校验失败|当前接口不接受 OpenAI Chat Completions 格式|缺少 Base URL|缺少 API Key|模型不属于当前 Provider|未找到 Provider 配置|未找到模型配置|400\b/i.test(message)) {
    return false;
  }
  if (/Failed to fetch|fetch failed|timeout|timed out|超时|aborted|AbortError|请求被中止|429\b|500\b|502\b|503\b|504\b|empty response|空响应/i.test(message)) {
    return true;
  }
  return false;
}

export function modelErrorRetryBlockReason(error) {
  const message = error?.message || String(error || "");
  if (/结构校验失败/i.test(message)) return "结构校验失败，重试会重复消耗 token，请先修复输出 schema 或 Prompt。";
  if (/当前接口不接受 OpenAI Chat Completions 格式|Unknown name "messages"|Unknown name "max_tokens"|Unknown name "temperature"|Cannot find field/i.test(message)) return "400 请求格式错误或 requestFormat 不匹配，请修正 Provider 请求格式。";
  if (/缺少 Base URL/i.test(message)) return "缺少 Base URL，请先保存 Provider 配置。";
  if (/缺少 API Key/i.test(message)) return "缺少 API Key，请先保存本地密钥配置。";
  if (/未找到 Provider 配置/i.test(message)) return "未找到 Provider 配置，请先保存 Provider。";
  if (/未找到模型配置/i.test(message)) return "未找到 Model 配置，请先保存并启用模型。";
  if (/模型不属于当前 Provider/i.test(message)) return "模型不属于当前 Provider，请重新选择模型。";
  if (/400\b/i.test(message)) return "400 请求格式错误，请修正请求体或模型参数。";
  return "该错误不属于临时网络/限流/5xx 类错误。";
}

function createLogId() {
  return `call-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
