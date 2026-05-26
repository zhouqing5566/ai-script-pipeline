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
import { classifyProviderError } from "./provider-diagnostics.js";
import { applyEvidenceValidationToAnalysis } from "./evidence-validator.js";
import { aggregateScriptAnalysis, analyzeEpisodeChunk, mergeEvidenceLedAnalysis } from "./long-script-analysis.js";
import { evaluateEpisodeChunkCompactShape } from "./episode-chunk-shape.js";

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
  let rawOutputPreview = null;
  let jsonExtractionMethod = null;
  let jsonRepairAttempted = false;
  let jsonRepairError = null;
  let parseErrorPosition = null;
  let errorType = null;
  let serverStatus = null;
  let settingsUpdatedAt = null;
  let providerUpdatedAt = null;
  let modelUpdatedAt = null;
  let usedFallback = false;
  let provider = selection.provider;
  let model = selection.model;
  let mode = selection.mode;
  const warnings = [];
  warnings.push(...(selection.optionWarnings || []));
  let schemaMeta = null;
  let schemaIssues = [];
  let compactSchemaAccepted = null;
  let invalidParsedJson = null;
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
        inputMeta,
        route: selection.route
      });
      outputText = response.outputText;
      parsedJson = response.parsedJson;
      tokenUsage = response.tokenUsage;
      actualRequestFormat = response.requestFormat;
      endpointType = response.endpointType;
      providerStatus = response.providerStatus || response.status || null;
      providerRawPreview = response.providerRawPreview || null;
      rawOutputPreview = response.rawOutputPreview || null;
      jsonExtractionMethod = response.jsonExtractionMethod || null;
      jsonRepairAttempted = Boolean(response.jsonRepairAttempted);
      jsonRepairError = response.jsonRepairError || null;
      parseErrorPosition = response.parseErrorPosition ?? null;
      errorType = response.errorType || null;
      serverStatus = response.serverStatus || response.status || null;
      settingsUpdatedAt = response.settingsUpdatedAt || null;
      providerUpdatedAt = response.providerUpdatedAt || null;
      modelUpdatedAt = response.modelUpdatedAt || null;
      costEstimate = estimateCost(model, tokenUsage);
      warnings.push(...(response.schemaWarnings || []));
      schemaMeta = response.schemaMeta || schemaMeta;
    }
  } catch (providerError) {
    const mainMeta = providerError.providerPayload || null;
    if (mainMeta) {
      endpointType = mainMeta.endpointType || endpointType;
      providerStatus = mainMeta.providerStatus || providerStatus;
      serverStatus = mainMeta.serverStatus || mainMeta.status || serverStatus;
      providerRawPreview = mainMeta.providerRawPreview || providerRawPreview;
      settingsUpdatedAt = mainMeta.settingsUpdatedAt || settingsUpdatedAt;
      providerUpdatedAt = mainMeta.providerUpdatedAt || providerUpdatedAt;
      modelUpdatedAt = mainMeta.modelUpdatedAt || modelUpdatedAt;
    }
    copyJsonErrorMeta(providerError, {
      setRawOutputPreview: (value) => (rawOutputPreview = value || rawOutputPreview),
      setJsonExtractionMethod: (value) => (jsonExtractionMethod = value || jsonExtractionMethod),
      setJsonRepairAttempted: (value) => (jsonRepairAttempted = jsonRepairAttempted || Boolean(value)),
      setJsonRepairError: (value) => (jsonRepairError = value || jsonRepairError),
      setParseErrorPosition: (value) => (parseErrorPosition = value ?? parseErrorPosition),
      setErrorType: (value) => (errorType = value || errorType),
      setOutputText: (value) => (outputText = value || outputText),
      setInvalidParsedJson: (value) => (invalidParsedJson = value || invalidParsedJson),
      setSchemaIssues: (value) => (schemaIssues = value || schemaIssues),
      setCompactSchemaAccepted: (value) => (compactSchemaAccepted = value ?? compactSchemaAccepted)
    });
    if (invalidParsedJson && !parsedJson) parsedJson = invalidParsedJson;
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
            inputMeta,
            route: selection.route
          });
          outputText = response.outputText;
          parsedJson = response.parsedJson;
          tokenUsage = response.tokenUsage;
          actualRequestFormat = response.requestFormat;
          endpointType = response.endpointType;
          providerStatus = response.providerStatus || response.status || null;
          providerRawPreview = response.providerRawPreview || null;
          rawOutputPreview = response.rawOutputPreview || null;
          jsonExtractionMethod = response.jsonExtractionMethod || null;
          jsonRepairAttempted = Boolean(response.jsonRepairAttempted);
          jsonRepairError = response.jsonRepairError || null;
          parseErrorPosition = response.parseErrorPosition ?? null;
          errorType = response.errorType || null;
          serverStatus = response.serverStatus || response.status || null;
          settingsUpdatedAt = response.settingsUpdatedAt || null;
          providerUpdatedAt = response.providerUpdatedAt || null;
          modelUpdatedAt = response.modelUpdatedAt || null;
          costEstimate = estimateCost(model, tokenUsage);
          warnings.push(...(response.schemaWarnings || []));
          schemaMeta = response.schemaMeta || schemaMeta;
        } catch (fallbackError) {
          const fallbackMeta = fallbackError.providerPayload || null;
          if (fallbackMeta) {
            endpointType = fallbackMeta.endpointType || endpointType;
            providerStatus = fallbackMeta.providerStatus || providerStatus;
            serverStatus = fallbackMeta.serverStatus || fallbackMeta.status || serverStatus;
            providerRawPreview = fallbackMeta.providerRawPreview || providerRawPreview;
            settingsUpdatedAt = fallbackMeta.settingsUpdatedAt || settingsUpdatedAt;
            providerUpdatedAt = fallbackMeta.providerUpdatedAt || providerUpdatedAt;
            modelUpdatedAt = fallbackMeta.modelUpdatedAt || modelUpdatedAt;
          }
          copyJsonErrorMeta(fallbackError, {
            setRawOutputPreview: (value) => (rawOutputPreview = value || rawOutputPreview),
            setJsonExtractionMethod: (value) => (jsonExtractionMethod = value || jsonExtractionMethod),
            setJsonRepairAttempted: (value) => (jsonRepairAttempted = jsonRepairAttempted || Boolean(value)),
            setJsonRepairError: (value) => (jsonRepairError = value || jsonRepairError),
            setParseErrorPosition: (value) => (parseErrorPosition = value ?? parseErrorPosition),
            setErrorType: (value) => (errorType = value || errorType),
            setOutputText: (value) => (outputText = value || outputText),
            setInvalidParsedJson: (value) => (invalidParsedJson = value || invalidParsedJson),
            setSchemaIssues: (value) => (schemaIssues = value || schemaIssues),
            setCompactSchemaAccepted: (value) => (compactSchemaAccepted = value ?? compactSchemaAccepted)
          });
          if (invalidParsedJson && !parsedJson) parsedJson = invalidParsedJson;
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
  const effectiveSchemaMeta = schemaMeta || parsedJson?.sourceMeta || null;
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
    needsReview: Boolean(effectiveSchemaMeta?.needsReview),
    blockedSave: Boolean(effectiveSchemaMeta?.blockedSave),
    usableForLearning: effectiveSchemaMeta?.usableForLearning !== false,
    usableForProduction: effectiveSchemaMeta?.usableForProduction !== false,
    modelCompletenessScore: effectiveSchemaMeta?.modelCompletenessScore ?? null,
    autoFilledFields: effectiveSchemaMeta?.autoFilledFields || [],
    autoFilledSections: effectiveSchemaMeta?.autoFilledSections || [],
    serverStatus,
    providerStatus,
    providerRawPreview,
    rawOutputPreview,
    jsonExtractionMethod,
    jsonRepairAttempted,
    jsonRepairError,
    parseErrorPosition,
    errorType,
    schemaIssues,
    compactSchemaAccepted,
    invalidParsedJson,
    settingsUpdatedAt,
    providerUpdatedAt,
    modelUpdatedAt,
    matchedSkillIds,
    warnings,
    schemaMeta: effectiveSchemaMeta,
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
    rawOutputPreview,
    jsonExtractionMethod,
    jsonRepairAttempted,
    jsonRepairError,
    parseErrorPosition,
    errorType,
    schemaIssues,
    compactSchemaAccepted,
    modelId: result.modelId,
    modelName: model?.displayName || model?.modelName || "未选择",
    skillVersion: matchedSkills.map((skill) => `${skill.name} ${skill.version}`).join("；") || "未匹配",
    matchedSkillIds,
    skillConflicts: conflicts,
    warnings,
    schemaMeta: effectiveSchemaMeta,
    needsReview: result.needsReview,
    blockedSave: result.blockedSave,
    usableForLearning: result.usableForLearning,
    usableForProduction: result.usableForProduction,
    modelCompletenessScore: result.modelCompletenessScore,
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

export async function testModelRoute({
  taskType,
  featureArea,
  projectId,
  skillIds = [],
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
  const requestedMode = state?.apiConfig?.mode || "demo";
  const requiresRouteFix = requestedMode === "api" && selection.mode === "demo" && !state?.apiConfig?.allowDemoInApiMode;
  const warnings = [...(selection.optionWarnings || [])];
  if (requestedMode === "api" && selection.mode === "demo") {
    warnings.push("当前为真实 API Mode，但该任务路由仍指向 Demo 模型。请在系统设置 → 路由配置中绑定真实模型。");
  }

  let outputText = "";
  let error = null;
  let tokenUsage = null;
  let requestFormat = selection.mode === "api" ? resolveRequestFormat({ provider: selection.provider, model: selection.model }) : "demo";
  let endpointType = selection.mode === "api" ? "server_proxy" : "local_demo";
  let providerStatus = null;
  let serverStatus = null;
  let providerRawPreview = null;
  let settingsUpdatedAt = null;
  let providerUpdatedAt = null;
  let modelUpdatedAt = null;
  const attemptErrors = [];

  try {
    if (requiresRouteFix) {
      error = "当前是真实 API Mode，但该任务仍指向 Demo 模型。请点击“一键切换核心任务到当前真实模型”，或手动修改任务路由。";
    } else if (selection.mode === "demo") {
      outputText = "ROUTE_OK_DEMO";
      providerStatus = 200;
      serverStatus = 200;
    } else {
      const probeOptions = {
        ...selection.options,
        jsonModeRequired: false,
        maxOutputTokens: Math.min(256, selection.options.maxOutputTokens || 256),
        retryCount: 0,
        timeoutMs: Math.min(Math.max(selection.options.timeoutMs || 30000, 10000), 30000)
      };
      const response = await callProvider({
        provider: selection.provider,
        model: selection.model,
        route: selection.route,
        taskType,
        messages: [
          { role: "system", content: "你是模型路由连通性诊断探针。" },
          { role: "user", content: "请只回复 ROUTE_OK，不要解释。" }
        ],
        options: probeOptions
      });
      outputText = response.outputText || "";
      tokenUsage = response.tokenUsage || null;
      requestFormat = response.requestFormat || requestFormat;
      endpointType = response.endpointType || endpointType;
      providerStatus = response.providerStatus || response.status || null;
      serverStatus = response.serverStatus || response.status || null;
      providerRawPreview = response.providerRawPreview || null;
      settingsUpdatedAt = response.settingsUpdatedAt || null;
      providerUpdatedAt = response.providerUpdatedAt || null;
      modelUpdatedAt = response.modelUpdatedAt || null;
    }
  } catch (probeError) {
    error = normalizeClientProviderError(probeError.message);
    const meta = probeError.providerPayload || null;
    if (meta) {
      requestFormat = meta.requestFormat || requestFormat;
      endpointType = meta.endpointType || endpointType;
      providerStatus = meta.providerStatus || providerStatus;
      serverStatus = meta.serverStatus || meta.status || serverStatus;
      providerRawPreview = meta.providerRawPreview || providerRawPreview;
      settingsUpdatedAt = meta.settingsUpdatedAt || settingsUpdatedAt;
      providerUpdatedAt = meta.providerUpdatedAt || providerUpdatedAt;
      modelUpdatedAt = meta.modelUpdatedAt || modelUpdatedAt;
    }
    attemptErrors.push(`路由探针失败：${error}`);
  }

  const latencyMs = Math.round(performance.now() - startedAt);
  const apiModeDemoFallback = requestedMode === "api" && selection.mode === "demo" && !requiresRouteFix;
  const result = {
    success: !error,
    mode: selection.mode,
    requestedMode,
    requestFormat,
    endpointType,
    status: error ? "failed" : "success",
    taskType,
    routeId: selection.route?.id || null,
    providerId: selection.provider?.id || null,
    modelId: selection.model?.id || null,
    usedFallback: false,
    requiresRouteFix,
    apiModeDemoFallback,
    matchedSkillIds,
    warnings,
    attemptErrors,
    outputText,
    parsedJson: null,
    error,
    latencyMs,
    tokenUsage,
    costEstimate: estimateCost(selection.model, tokenUsage),
    serverStatus,
    providerStatus,
    providerRawPreview,
    settingsUpdatedAt,
    providerUpdatedAt,
    modelUpdatedAt,
    logId: createLogId()
  };
  const log = {
    id: result.logId,
    taskType,
    taskLabel: `${taskLabels[taskType] || taskType} 路由诊断`,
    featureArea: resolvedFeatureArea,
    mode: result.mode,
    requestedMode,
    providerId: result.providerId,
    providerName: selection.provider?.name || "未选择",
    routeId: result.routeId,
    requestFormat,
    endpointType,
    serverProxy: endpointType === "server_proxy",
    status: result.status,
    providerStatus,
    serverStatus,
    providerRawPreview,
    modelId: result.modelId,
    modelName: selection.model?.displayName || selection.model?.modelName || "未选择",
    skillVersion: matchedSkills.map((skill) => `${skill.name} ${skill.version}`).join("；") || "未匹配",
    matchedSkillIds,
    skillConflicts: conflicts,
    warnings,
    apiModeDemoWarning: warnings.some((item) => item.includes("真实 API Mode")),
    apiModeDemoFallback,
    requiresRouteFix,
    routingReason: selection.routingReason,
    usedFallback: false,
    attemptErrors,
    inputSummary: `路由诊断：${taskType}`,
    outputSummary: outputText ? summarizeInput(outputText) : "无输出",
    success: result.success,
    errorMessage: error,
    latencyMs,
    tokenUsage,
    costEstimate: result.costEstimate,
    settingsUpdatedAt,
    providerUpdatedAt,
    modelUpdatedAt,
    createdAt: new Date().toISOString()
  };
  await appendModelLog(log);
  result.log = log;
  return result;
}

function dispatchTask(taskType, input, state) {
  const project = input?.project || state.currentProject;
  switch (taskType) {
    case "analyzeScript":
      return analyzeScript(input);
    case "analyzeScriptChunk":
    case "analyzeEpisodeChunk":
      return analyzeEpisodeChunk(input);
    case "aggregateScriptAnalysis":
      return aggregateScriptAnalysis(input);
    case "mergeEvidenceLedAnalysis":
      return mergeEvidenceLedAnalysis(input);
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
    case "schemaRepairAnalyzeScript":
      return createDemoSchemaRepairDraft(input);
    case "schemaRepairAnalyzeEpisodeChunk":
      return createDemoEpisodeChunkSchemaRepair(input);
    default:
      throw new Error(`暂不支持的任务：${taskType}`);
  }
}

function normalizeParsedOutputForTask(taskType, value, inputMeta = {}) {
  const unwrapped = unwrapTaskPayload(value, taskType);
  const warnings = [];
  if (unwrapped.changed) {
    warnings.push(`模型返回包含 ${unwrapped.unwrapPath.join(".")} 外层，已自动展开为任务根对象。`);
  }

  if (taskType === "analyzeEpisodeChunk" || taskType === "analyzeScriptChunk" || taskType === "schemaRepairAnalyzeEpisodeChunk") {
    const normalized = coerceEpisodeChunkOutput(unwrapped.value, inputMeta);
    warnings.push(...normalized.warnings);
    return {
      value: normalized.value,
      warnings,
      meta: {
        unwrapped: unwrapped.changed,
        unwrapPath: unwrapped.unwrapPath,
        ...(normalized.value.sourceMeta || {}),
        usableForLearning: !normalized.value.needsReview,
        usableForProduction: !normalized.value.needsReview
      }
    };
  }

  if (!isAnalyzeRootTask(taskType)) {
    return {
      value: unwrapped.value,
      warnings,
      meta: {
        unwrapped: unwrapped.changed,
        unwrapPath: unwrapped.unwrapPath,
        usableForLearning: true,
        usableForProduction: true
      }
    };
  }

  const shape = validateTaskOutput(taskType, unwrapped.value);
  if (shape.ok) {
    const meta = createAnalyzeSourceMeta({ source: unwrapped.value, unwrapped, missingCoreSections: [] });
    return { value: stabilizeAnalyzeScriptOutput(unwrapped.value, analyzeInputMeta(inputMeta), meta), warnings, meta };
  }

  const meta = createAnalyzeSourceMeta({ source: unwrapped.value, unwrapped, issues: shape.issues });
  const normalized = coerceAnalyzeScriptOutput(unwrapped.value, analyzeInputMeta(inputMeta), shape.issues, meta);
  warnings.push(
    meta.blockedSave
      ? "真实模型输出缺少多个核心分析模块，已作为待复核草稿展示并阻止直接入库。请执行结构修复或重新分析。"
      : "真实模型输出的剧本分析结构不完整，已按标准分析档案补齐缺失字段；请查看质量备注并按需重新生成。"
  );
  return { value: normalized, warnings, meta };
}

function coerceEpisodeChunkOutput(value, inputMeta = {}) {
  const base = analyzeEpisodeChunk(inputMeta);
  const source = isPlainObject(value) ? value : {};
  const compactShape = evaluateEpisodeChunkCompactShape(source, { episodeText: inputMeta.episodeText || inputMeta.text || "" });
  const merged = deepMerge(base, source);
  const warnings = [];
  const missingCompactFields = compactShape.missingCompactFields || [];
  merged.episodeNo = Number(source.episodeNo) || Number(inputMeta.episodeNo) || base.episodeNo || null;
  merged.title = source.title || inputMeta.episodeTitle || base.title || `第${merged.episodeNo || "?"}集`;
  merged.coverage = isPlainObject(source.coverage) ? source.coverage : base.coverage;
  merged.evidenceLedger = isPlainObject(source.evidenceLedger) ? deepMerge(base.evidenceLedger, source.evidenceLedger) : base.evidenceLedger;
  merged.episodeBeatLedger = Array.isArray(source.episodeBeatLedger) && source.episodeBeatLedger.length ? source.episodeBeatLedger : base.episodeBeatLedger;
  merged.episodeFunctionAnalysis = isPlainObject(source.episodeFunctionAnalysis)
    ? ensureEpisodeAnalysisContract(source.episodeFunctionAnalysis, base.episodeFunctionAnalysis)
    : base.episodeFunctionAnalysis;
  merged.reusablePatterns = Array.isArray(source.reusablePatterns) ? source.reusablePatterns : [];
  merged.openQuestions = Array.isArray(source.openQuestions) && source.openQuestions.length ? source.openQuestions : ["本集后续悬念待复核。"];
  merged.continuityNotes = Array.isArray(source.continuityNotes) && source.continuityNotes.length ? source.continuityNotes : ["本集未发现明确连续性备注。"];
  merged.confidence = Number(source.confidence ?? base.confidence ?? 0.55);
  merged.needsReview = Boolean(source.needsReview ?? base.needsReview);
  merged.sourceMeta = {
    ...(source.sourceMeta || {}),
    normalizedEpisodeChunk: true,
    modelStructureIncomplete: !compactShape.valid,
    modelStructureIssues: compactShape.issues,
    missingCompactFields,
    localFallbackSections: compactShape.localFallbackSections,
    modelProvidedFields: compactShape.modelProvidedFields,
    modelProvidedCompactScore: compactShape.score,
    validModelBeatCount: compactShape.validBeatCount,
    validModelEvidenceCount: compactShape.validEvidenceCount,
    nonEmptyModelFunctionFields: compactShape.nonEmptyFunctionFields,
    linkedModelBeatIds: compactShape.linkedBeatIds,
    linkedModelEvidenceIds: compactShape.linkedEvidenceIds
  };
  if (!compactShape.valid) {
    merged.needsReview = true;
    warnings.push(`模型返回的分集 compact 结构无效：${compactShape.issues.join("；")} 本地仅能补齐展示草稿，不能视为真实分集分析成功。`);
  }
  applyEvidenceValidationToAnalysis(merged, inputMeta.episodeText || inputMeta.text || "");
  const validation = merged.sourceMeta.evidenceValidation || {};
  if ((validation.invalidEvidenceRatio || 0) > 0.5 || (validation.checkedCount || 0) === 0) {
    merged.needsReview = true;
    warnings.push("分集 evidence/sourceText 校验不足，需复核或重试。");
  }
  return { value: merged, warnings };
}

function unwrapTaskPayload(value, taskType) {
  if (!isPlainObject(value)) return { value, changed: false, wrapperKey: null, unwrapPath: [] };
  const wrapperKeys = isAnalyzeRootTask(taskType) ? ["scriptAnalysis", "analysis", "result", "data", "output", "payload", "content"] : ["result", "data", "output", "payload", "content"];
  let current = value;
  const unwrapPath = [];
  for (let depth = 0; depth < 5 && isPlainObject(current); depth += 1) {
    if (isAnalyzeRootTask(taskType) && hasAnalyzeCoreField(current)) break;
    const key = wrapperKeys.find((candidate) => current[candidate] && (isPlainObject(current[candidate]) || Array.isArray(current[candidate])));
    if (!key) break;
    if (!isWrapperPayload(current, key)) break;
    const inner = current[key];
    unwrapPath.push(key);
    current = inner;
  }
  return {
    value: current,
    changed: unwrapPath.length > 0,
    wrapperKey: unwrapPath.join(".") || null,
    unwrapPath
  };
}

function hasAnalyzeCoreField(value) {
  return analyzeCoreSections.some((section) => Object.hasOwn(value, section));
}

function isWrapperPayload(value, wrapperKey) {
  const auxiliaryKeys = new Set(["meta", "status", "message", "msg", "error", "errors", "ok", "success", "title", "name", "code", "requestId", "traceId", "usage", "model", "created", "id", "choices"]);
  return Object.keys(value).every((key) => key === wrapperKey || auxiliaryKeys.has(key));
}

const analyzeCoreSections = [
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
];

function isAnalyzeRootTask(taskType) {
  return ["analyzeScript", "aggregateScriptAnalysis", "mergeEvidenceLedAnalysis"].includes(taskType);
}

function analyzeInputMeta(inputMeta = {}) {
  return inputMeta.originalInput || inputMeta.input || inputMeta;
}

const locallyDerivableAnalyzeSections = new Set(["coverage", "caseScope", "evidenceLedger", "episodeBeatLedger"]);

function createAnalyzeSourceMeta({ source, unwrapped, issues = [] }) {
  const modelProvidedSections = analyzeCoreSections.filter((section) => hasUsefulSection(source?.[section]));
  const missingCoreSections = analyzeCoreSections.filter((section) => !modelProvidedSections.includes(section));
  const localFallbackSections = [...missingCoreSections];
  const autoFilledSections = [...missingCoreSections];
  const modelCompletenessScore = Math.round((modelProvidedSections.length / analyzeCoreSections.length) * 100);
  const criticalMissingSections = missingCoreSections.filter((section) => !locallyDerivableAnalyzeSections.has(section));
  const blockedSave = criticalMissingSections.length >= 3;
  const needsReview = missingCoreSections.length > 0;
  return {
    unwrapped: Boolean(unwrapped.changed),
    unwrapPath: unwrapped.unwrapPath || [],
    autoFilledFields: issuesToFields(issues),
    autoFilledSections,
    missingCoreSections,
    modelProvidedSections,
    localFallbackSections,
    criticalMissingSections,
    userPreservedFields: ["basicInfo.title", "basicInfo.genre", "basicInfo.episodeCount"],
    needsReview,
    blockedSave,
    usableForLearning: !needsReview && !blockedSave,
    usableForProduction: !blockedSave,
    modelCompletenessScore,
    warnings: []
  };
}

function hasUsefulSection(value) {
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number" || typeof value === "boolean") return true;
  if (Array.isArray(value)) return value.some(hasUsefulSection);
  if (isPlainObject(value)) return Object.values(value).some(hasUsefulSection);
  return false;
}

function issuesToFields(issues = []) {
  return issues
    .map((issue) => {
      const match = String(issue).match(/缺少\s+([A-Za-z0-9_.]+)/);
      return match?.[1] || "";
    })
    .filter(Boolean);
}

function coerceAnalyzeScriptOutput(value, inputMeta = {}, issues = [], sourceMeta = null) {
  const base = analyzeScript(inputMeta);
  const source = isPlainObject(value) ? value : {};
  const merged = deepMerge(base, source);
  const structureFunction = source.structureFunction || source.structure || source.structureValue || {};
  if (isPlainObject(structureFunction)) {
    const hook = firstText(structureFunction.hook, structureFunction.openingHook, structureFunction.coreHook);
    if (hook) merged.hookAnalysis.openingSummary = hook;
    const pacing = firstText(structureFunction.pacing, structureFunction.rhythm, structureFunction.stagePacing);
    if (pacing) merged.mainlineStructure.escalationLogic = pacing;
    const riskItems = toStringArray(structureFunction.riskAssessment || structureFunction.risks || []);
    if (riskItems.length) merged.qualityNotes.weaknesses = uniqueList([...(merged.qualityNotes.weaknesses || []), ...riskItems]);
  }
  const sourceTitle = firstText(source.title, source.name, source.basicInfo?.title);
  if (sourceTitle && !inputMeta.title) {
    merged.title = sourceTitle;
    merged.basicInfo.title = sourceTitle;
  }
  merged.qualityNotes.suggestedRepairs = uniqueList([
    ...(merged.qualityNotes.suggestedRepairs || []),
    "当前真实模型返回字段未完全匹配标准档案，建议在路由测试后重新分析，或调高该任务 Prompt/schema 约束。"
  ]);
  merged.qualityNotes.weaknesses = uniqueList([
    ...(merged.qualityNotes.weaknesses || []),
    `模型结构缺项：${issues.join("；") || "字段层级不完整"}`
  ]);
  merged.analystNotes = [source.analystNotes, source.summary, merged.analystNotes].filter(Boolean).join("\n");
  return stabilizeAnalyzeScriptOutput(merged, inputMeta, sourceMeta);
}

function stabilizeAnalyzeScriptOutput(value, inputMeta = {}, sourceMeta = null) {
  const base = analyzeScript(inputMeta);
  const merged = deepMerge(base, isPlainObject(value) ? value : {});
  const title = inputMeta.title || merged.basicInfo?.title || merged.title || "未命名剧本";
  merged.title = title;
  merged.basicInfo.title = title;
  const inputGenres = splitScope(inputMeta.genre);
  const modelGenres = toStringArray(merged.classificationTags?.genre || merged.basicInfo?.genre);
  if (inputGenres.length) {
    merged.basicInfo.genre = inputGenres;
    merged.basicInfo.userGenreNote = inputMeta.genre;
    merged.classificationTags.genre = uniqueList([...inputGenres, ...modelGenres]);
  } else {
    merged.basicInfo.genre = toStringArray(merged.basicInfo.genre);
    merged.classificationTags.genre = toStringArray(merged.classificationTags.genre || merged.basicInfo.genre);
  }
  const episodeCount = Number(inputMeta.episodeCount) || Number(merged.basicInfo.episodeCount) || 24;
  merged.basicInfo.episodeCount = episodeCount;
  merged.basicInfo.estimatedLength = merged.basicInfo.estimatedLength || `${episodeCount} 集`;
  merged.coverage = merged.coverage || base.coverage;
  merged.evidenceLedger = merged.evidenceLedger || base.evidenceLedger;
  merged.episodeBeatLedger = Array.isArray(merged.episodeBeatLedger) && merged.episodeBeatLedger.length ? merged.episodeBeatLedger : base.episodeBeatLedger;
  merged.caseScope = merged.caseScope || merged.coverage?.allowedCaseScope || base.caseScope;
  merged.classificationTags.audienceNeeds = toStringArray(merged.classificationTags.audienceNeeds || merged.audienceNeedAnalysis.primaryNeeds);
  merged.classificationTags.hookTypes = toStringArray(merged.classificationTags.hookTypes || merged.hookAnalysis.hookTypes);
  merged.episodeFunctionAnalysis = Array.isArray(merged.episodeFunctionAnalysis) ? merged.episodeFunctionAnalysis : base.episodeFunctionAnalysis;
  if (merged.coverage?.inputType !== "full_script") {
    merged.episodeFunctionAnalysis = base.episodeFunctionAnalysis;
    if (merged.mainlineStructure?.inferenceLevel === "原文明确") merged.mainlineStructure.inferenceLevel = "创作建议";
    if (merged.mainlineReversalAnalysis?.inferenceLevel === "原文明确") merged.mainlineReversalAnalysis.inferenceLevel = "创作建议";
    if (merged.endingAnalysis?.inferenceLevel === "原文明确") merged.endingAnalysis.inferenceLevel = "不足以判断";
    if (merged.endingAnalysis) {
      merged.endingAnalysis.confidence = Math.min(Number(merged.endingAnalysis.confidence) || 0.4, 0.35);
      merged.endingAnalysis.riskNotes = uniqueList([...(merged.endingAnalysis.riskNotes || []), "输入不完整，结局不能标记为原文明确。"]);
    }
  }
  merged.episodeFunctionAnalysis = merged.episodeFunctionAnalysis.map((episode, index) =>
    ensureEpisodeAnalysisContract(episode, base.episodeFunctionAnalysis[index] || base.episodeFunctionAnalysis[0] || {})
  );
  merged.reusablePatterns = Array.isArray(merged.reusablePatterns) ? merged.reusablePatterns : base.reusablePatterns;
  merged.reusablePatterns = merged.reusablePatterns.map((pattern, index) =>
    ensureReusablePatternContract(pattern, base.reusablePatterns[index] || base.reusablePatterns[index % base.reusablePatterns.length] || {})
  );
  if (sourceMeta) {
    sourceMeta.allowedCaseScope = merged.caseScope;
    merged.sourceMeta = sourceMeta;
    applyEvidenceValidationToAnalysis(merged, inputMeta.text || "");
    applyAnalyzeLearningFlags(merged);
    if (sourceMeta.blockedSave) merged.confidence = Math.min(Number(merged.confidence) || 0.78, 0.35);
    else if ((sourceMeta.localFallbackSections || []).length >= 3) merged.confidence = Math.min(Number(merged.confidence) || 0.78, 0.45);
    else if (sourceMeta.unwrapped) merged.confidence = Math.min(Number(merged.confidence) || 0.78, 0.85);
  } else {
    applyEvidenceValidationToAnalysis(merged, inputMeta.text || "");
    applyAnalyzeLearningFlags(merged);
  }
  return merged;
}

function applyAnalyzeLearningFlags(analysis) {
  const meta = (analysis.sourceMeta ||= {});
  const invalidRatio = meta.evidenceValidation?.invalidEvidenceRatio || 0;
  const localFallbackCount = (meta.localFallbackSections || []).length;
  const isFullScript = analysis.coverage?.inputType === "full_script";
  meta.usableForCaseSave = !meta.blockedSave;
  meta.usableForPatternExtraction = !meta.blockedSave && invalidRatio <= 0.3;
  meta.usableForFullScriptCase = isFullScript && !meta.blockedSave && invalidRatio === 0;
  meta.usableForSkillLearning = isFullScript && !meta.blockedSave && !meta.needsReview && localFallbackCount === 0 && invalidRatio === 0;
  meta.usableForLearning = meta.usableForSkillLearning;
  analysis.usableForLearning = meta.usableForLearning;
  analysis.usableForProduction = isFullScript && !meta.blockedSave;
}

function ensureEpisodeAnalysisContract(episode = {}, fallback = {}) {
  const next = { ...fallback, ...episode };
  next.evidenceIds = arrayOrFallback(episode.evidenceIds, fallback.evidenceIds);
  next.evidenceBeatIds = arrayOrFallback(episode.evidenceBeatIds, fallback.evidenceBeatIds);
  next.inferenceLevel = episode.inferenceLevel || fallback.inferenceLevel || (next.evidenceBeatIds.length ? "原文明确" : "合理推断");
  next.confidence = episode.confidence ?? fallback.confidence ?? 0.55;
  next.needsReview = episode.needsReview ?? fallback.needsReview ?? (!next.evidenceIds.length && !next.evidenceBeatIds.length);
  next.riskNotes = arrayOrFallback(episode.riskNotes, fallback.riskNotes);
  return next;
}

function ensureReusablePatternContract(pattern = {}, fallback = {}) {
  const next = { ...fallback, ...pattern };
  next.sourceEvidenceIds = arrayOrFallback(pattern.sourceEvidenceIds, fallback.sourceEvidenceIds);
  next.sourceBeatIds = arrayOrFallback(pattern.sourceBeatIds, fallback.sourceBeatIds);
  next.structureSteps = arrayOrFallback(pattern.structureSteps, fallback.structureSteps);
  next.variableSlots = isPlainObject(pattern.variableSlots) ? pattern.variableSlots : fallback.variableSlots || {};
  next.reusePrompt = pattern.reusePrompt || fallback.reusePrompt || "基于该模式替换变量槽，生成同功能桥段。";
  next.emotionalMechanism = pattern.emotionalMechanism || fallback.emotionalMechanism || pattern.whyItWorks || "";
  next.characterFunction = pattern.characterFunction || fallback.characterFunction || "";
  next.plotFunction = pattern.plotFunction || fallback.plotFunction || "";
  next.antiPatterns = arrayOrFallback(pattern.antiPatterns, fallback.antiPatterns);
  next.inferenceLevel = pattern.inferenceLevel || fallback.inferenceLevel || (next.sourceEvidenceIds.length || next.sourceBeatIds.length ? "合理推断" : "创作建议");
  next.confidence = pattern.confidence ?? fallback.confidence ?? 0.5;
  return next;
}

function arrayOrFallback(value, fallback) {
  return Array.isArray(value) && value.length ? value : Array.isArray(fallback) ? fallback : [];
}

function createDemoSchemaRepairDraft(input = {}) {
  const draft = analyzeScript(input);
  draft.sourceMeta = {
    unwrapped: false,
    unwrapPath: [],
    autoFilledFields: analyzeCoreSections,
    autoFilledSections: analyzeCoreSections,
    missingCoreSections: analyzeCoreSections,
    modelProvidedSections: [],
    localFallbackSections: analyzeCoreSections,
    userPreservedFields: ["basicInfo.title", "basicInfo.genre", "basicInfo.episodeCount"],
    needsReview: true,
    blockedSave: true,
    usableForLearning: false,
    usableForProduction: false,
    modelCompletenessScore: 0,
    warnings: ["Demo schema repair 不代表真实模型修复。"]
  };
  draft.usableForLearning = false;
  draft.usableForProduction = false;
  draft.confidence = Math.min(Number(draft.confidence) || 0.78, 0.35);
  draft.qualityNotes.weaknesses = uniqueList([...(draft.qualityNotes.weaknesses || []), "Demo schema repair 不代表真实模型修复。"]);
  return draft;
}

function createDemoEpisodeChunkSchemaRepair(input = {}) {
  const draft = analyzeEpisodeChunk(input);
  const sourceText = firstEpisodeSourceText(input.episodeText || input.text || "");
  const structural = Array.isArray(input.rawModelJson?.episodeAnalysis)
    ? input.rawModelJson.episodeAnalysis[0]?.structuralAnalysis || {}
    : input.rawModelJson?.structuralAnalysis || {};
  draft.evidenceLedger.hookEvidence = [
    {
      id: "E001",
      episodeNo: draft.episodeNo,
      sourceText,
      summary: structural.openingHook || "根据原分集文本提取的开头证据。",
      evidenceType: "hook",
      relatedBeatIds: ["B001"],
      confidence: 0.65
    }
  ];
  draft.episodeBeatLedger = [
    {
      beatId: "B001",
      episodeNo: draft.episodeNo,
      sourceText,
      beatSummary: structural.openingHook || "本集开头事件。",
      characters: [],
      audienceEmotion: ["紧张"],
      suspenseQuestion: "",
      structureFunction: "开头钩子",
      confidence: 0.65
    }
  ];
  draft.episodeFunctionAnalysis = ensureEpisodeAnalysisContract(
    {
      episodeNo: draft.episodeNo,
      summary: structural.openingHook || "本集结构修复摘要。",
      openingHook: structural.openingHook || "开头钩子待复核。",
      mainConflict: structural.conflictProgression || "本集冲突待复核。",
      informationGain: structural.pacing || "本集信息增量待复核。",
      characterFunction: "结构修复生成，需人工复核。",
      evidenceBeatIds: ["B001"],
      inferenceLevel: "合理推断",
      confidence: 0.55,
      riskNotes: ["Demo 分集 schema repair 只用于流程演示，需复核。"],
      needsReview: true
    },
    draft.episodeFunctionAnalysis
  );
  draft.sourceMeta = {
    ...(draft.sourceMeta || {}),
    schemaRepaired: true,
    schemaRepairSource: "demo",
    needsReview: true,
    usableForSkillLearning: false,
    usableForLearning: false,
    usableForFullScriptCase: false,
    warnings: ["Demo 分集 schema repair 不代表真实模型修复。"]
  };
  draft.needsReview = true;
  draft.confidence = Math.min(Number(draft.confidence) || 0.55, 0.55);
  applyEvidenceValidationToAnalysis(draft, input.episodeText || input.text || "");
  return draft;
}

function firstEpisodeSourceText(text = "") {
  const lines = String(text || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line && !/^第\s*[一二三四五六七八九十\d]+\s*[集话]/.test(line));
  return lines[0] || String(text || "").slice(0, 80);
}

function deepMerge(base, source) {
  if (Array.isArray(base)) return mergeArray(base, source);
  if (isPlainObject(base)) {
    const result = { ...base };
    if (!isPlainObject(source)) return result;
    for (const [key, value] of Object.entries(source)) {
      result[key] = key in result ? deepMerge(result[key], value) : value;
    }
    return result;
  }
  if (source === null || source === undefined || source === "") return base;
  return source;
}

function mergeArray(base, source) {
  if (Array.isArray(source)) {
    if (!source.length) return base;
    if (base.every(isPlainObject) && source.every(isPlainObject)) {
      return source.map((item, index) => deepMerge(base[index] || {}, item));
    }
    return source.map((item) => (typeof item === "string" ? item : item));
  }
  if (typeof source === "string" && source.trim()) return [source.trim()];
  return base;
}

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function splitScope(value = "") {
  return String(value)
    .split(/[、，,\/|｜\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function toStringArray(value) {
  if (Array.isArray(value)) return value.map((item) => (typeof item === "string" ? item : JSON.stringify(item))).filter(Boolean);
  if (typeof value === "string") return splitScope(value);
  return [];
}

function firstText(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function uniqueList(items = []) {
  return [...new Set(items.filter(Boolean))];
}

function attachJsonErrorMeta(error, response = {}, errorType = "json_parse") {
  error.rawOutputPreview = response.rawOutputPreview || createRawOutputPreview(response.outputText);
  error.jsonExtractionMethod = response.jsonExtractionMethod || "none";
  error.jsonRepairAttempted = Boolean(response.jsonRepairAttempted);
  error.jsonRepairError = response.jsonRepairError || null;
  error.parseErrorPosition = response.parseErrorPosition ?? null;
  error.errorType = errorType;
  return error;
}

function copyJsonErrorMeta(error, setters = {}) {
  if (!error) return;
  setters.setRawOutputPreview?.(error.rawOutputPreview);
  setters.setJsonExtractionMethod?.(error.jsonExtractionMethod);
  setters.setJsonRepairAttempted?.(error.jsonRepairAttempted);
  setters.setJsonRepairError?.(error.jsonRepairError);
  setters.setParseErrorPosition?.(error.parseErrorPosition);
  setters.setErrorType?.(error.errorType);
  setters.setOutputText?.(error.outputText);
  setters.setInvalidParsedJson?.(error.invalidParsedJson);
  setters.setSchemaIssues?.(error.schemaIssues);
  setters.setCompactSchemaAccepted?.(error.compactSchemaAccepted);
}

function createRawOutputPreview(text = "", limit = 500) {
  return redactPreview(String(text || "").slice(0, limit));
}

function redactPreview(text = "") {
  return String(text)
    .replace(/(api[_-]?key|authorization|x-goog-api-key)(["'\s:=]+)([^"'\s,}]+)/gi, "$1$2[已脱敏]")
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]{12,}/gi, "Bearer [已脱敏]")
    .replace(/sk-[A-Za-z0-9._-]{12,}/g, "sk-[已脱敏]");
}

async function executeApiAttempt({ taskType, projectId, skillIds, provider, model, messages, options, schema, state, project, inputMeta, route }) {
  const response = await callProvider({ provider, model, messages, options, taskType, route });
  response.rawOutputPreview = createRawOutputPreview(response.outputText);
  let parsedJson = null;
  if (schema || options.jsonModeRequired) {
    const repaired = await parseJsonWithRepair(response.outputText, {
      taskType,
      repairFn:
        taskType === "jsonRepair"
          ? null
          : async (brokenText, errors) => {
              const repairResult = await callModel({
                taskType: "jsonRepair",
                featureArea: "JSON 修复",
                projectId,
                skillIds,
                inputMeta: { project, brokenText, errors, targetTaskType: taskType },
                state
              });
              if (!repairResult.success) {
                throw new Error(repairResult.error || "JSON 修复模型调用失败");
              }
              return repairResult.outputText;
            }
    });
    response.jsonExtractionMethod = repaired.extractionMethod || "none";
    response.jsonRepairAttempted = Boolean(repaired.jsonRepairAttempted);
    response.jsonRepairError = repaired.jsonRepairError || null;
    response.parseErrorPosition = repaired.parseErrorPosition ?? null;
    response.schemaWarnings = [
      ...(response.schemaWarnings || []),
      ...(repaired.extractionWarnings || []),
      repaired.extractionMethod && repaired.extractionMethod !== "direct" ? "模型输出包含非 JSON 前后缀，已自动提取 JSON 主体。" : ""
    ].filter(Boolean);
    if (!repaired.ok) {
      const error = new Error(repaired.error);
      error.outputText = response.outputText;
      attachJsonErrorMeta(error, response, "json_parse");
      throw error;
    }
    const normalized = normalizeParsedOutputForTask(taskType, repaired.value, inputMeta || { project });
    parsedJson = normalized.value;
    const shape = validateTaskOutput(taskType, parsedJson);
    if (!shape.ok || normalized.meta?.modelStructureIncomplete) {
      const missingFields = normalized.meta?.missingCompactFields || [];
      const structureIssues = normalized.meta?.modelStructureIssues || [];
      const issueDetails = [
        missingFields.length ? `模型未返回 ${missingFields.join("、")}` : "",
        structureIssues.length ? `模型返回结构空壳或错结构：${structureIssues.join("；")}` : ""
      ]
        .filter(Boolean)
        .join("；");
      const message = normalized.meta?.modelStructureIncomplete
        ? `分集结构校验失败：${issueDetails || "模型返回分集 compact 结构无效"}，不能用本地补齐结果冒充真实分集分析。`
        : schemaValidationMessage(taskType, shape.issues);
      const error = new Error(message);
      error.outputText = response.outputText;
      error.invalidParsedJson = repaired.value;
      error.schemaIssues = normalized.meta?.modelStructureIssues?.length ? normalized.meta.modelStructureIssues : shape.issues;
      error.compactSchemaAccepted = false;
      attachJsonErrorMeta(error, response, "schema_validation");
      throw error;
    }
    response.schemaWarnings = [...(response.schemaWarnings || []), ...(normalized.warnings || [])];
    response.schemaMeta = normalized.meta || null;
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
    rawOutputPreview: response.rawOutputPreview,
    jsonExtractionMethod: response.jsonExtractionMethod || "none",
    jsonRepairAttempted: Boolean(response.jsonRepairAttempted),
    jsonRepairError: response.jsonRepairError || null,
    parseErrorPosition: response.parseErrorPosition ?? null,
    errorType: response.errorType || null,
    settingsUpdatedAt: response.settingsUpdatedAt,
    providerUpdatedAt: response.providerUpdatedAt,
    modelUpdatedAt: response.modelUpdatedAt,
    schemaWarnings: response.schemaWarnings || [],
    schemaMeta: response.schemaMeta || null
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
      const error = new Error(data.errorMessage || data.error || `Provider 请求失败：${response.status}`);
      error.providerPayload = data;
      error.errorType = data.errorType || classifyProviderError(error.message);
      throw error;
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
    const normalized = new Error(normalizeClientProviderError(error.message));
    if (error.providerPayload) normalized.providerPayload = error.providerPayload;
    normalized.errorType = error.errorType || error.providerPayload?.errorType || classifyProviderError(normalized.message);
    throw normalized;
  }
}

function featureAreaForTask(taskType) {
  const map = {
    analyzeScript: "剧本分析中心",
    analyzeScriptChunk: "剧本分析中心",
    analyzeEpisodeChunk: "剧本分析中心",
    aggregateScriptAnalysis: "剧本分析中心",
    mergeEvidenceLedAnalysis: "剧本分析中心",
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
    schemaRepairAnalyzeScript: "JSON 修复",
    schemaRepairAnalyzeEpisodeChunk: "JSON 修复",
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
    return `${message}。当前接口不接受 OpenAI Chat Completions 请求体。你可能把 Gemini native 接口配置成了 OpenAI-compatible，或 Base URL 不是 /chat/completions 兼容地址。`;
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
  const errorType = error?.errorType || error?.providerPayload?.errorType || classifyProviderError(message);
  if (errorType === "provider_protocol_mismatch") return false;
  if (/JSON 解析失败|not valid JSON|未找到 JSON|结构校验失败|当前接口不接受 OpenAI Chat Completions 格式|当前接口不接受 OpenAI Chat Completions 请求体|缺少 Base URL|缺少 API Key|模型不属于当前 Provider|未找到 Provider 配置|未找到模型配置|400\b/i.test(message)) {
    return false;
  }
  if (/Failed to fetch|fetch failed|timeout|timed out|超时|aborted|AbortError|请求被中止|429\b|500\b|502\b|503\b|504\b|empty response|空响应/i.test(message)) {
    return true;
  }
  return false;
}

export function modelErrorRetryBlockReason(error) {
  const message = error?.message || String(error || "");
  const errorType = error?.errorType || error?.providerPayload?.errorType || classifyProviderError(message);
  if (errorType === "provider_protocol_mismatch") return "Provider 协议不匹配：当前接口不接受 OpenAI Chat Completions 请求体，请修正 requestFormat / Base URL。";
  if (/JSON 解析失败|not valid JSON|未找到 JSON/i.test(message)) return "模型返回非 JSON，重试同一 Prompt 通常会重复消耗 token，请先执行分集 JSON 输出测试、调整 Prompt 或更换模型。";
  if (/结构校验失败/i.test(message)) return "结构校验失败，重试会重复消耗 token，请先修复输出 schema 或 Prompt。";
  if (/当前接口不接受 OpenAI Chat Completions 格式|当前接口不接受 OpenAI Chat Completions 请求体|Unknown name "messages"|Unknown name "max_tokens"|Unknown name "temperature"|Cannot find field/i.test(message)) return "400 请求格式错误或 requestFormat 不匹配，请修正 Provider 请求格式。";
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
